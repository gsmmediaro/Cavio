import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  limit as fsLimit,
  where,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "../firebase";

const BASE =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  "";
const API_BASE = BASE.replace(/\/+$/, "");
const ENABLE_SOURCE_UPLOAD =
  import.meta.env.VITE_ENABLE_SOURCE_UPLOAD === "true";

function build_api_url(path: string): string {
  if (API_BASE) return `${API_BASE}${path}`;
  return path;
}

function ensure_https_url(url: string): string {
  if (!url) return "";
  if (url.startsWith("http://")) {
    return `https://${url.slice("http://".length)}`;
  }
  return url;
}

function timestamp_to_millis(value: unknown): number {
  if (value instanceof Timestamp) {
    return value.toMillis();
  }
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

async function with_timeout<T>(promise: Promise<T>, timeout_ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error("Operation timed out"));
        }, timeout_ms);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

export interface Detection {
  class_name: string;
  confidence: number;
  bbox: number[];
}

export interface AnalysisResult {
  filename: string;
  suspicion_level: string;
  overall_confidence: number;
  detections: Detection[];
  annotated_image_url: string;
  modality: string;
  model_name: string;
  num_detections: number;
  turnaround_s: number;
}

export interface ScanRecord {
  id: string;
  timestamp: string;
  filename: string;
  patient_name: string;
  suspicion: string;
  confidence: number;
  detections_count: number;
  modality: string;
  turnaround_s: number;
  image_url?: string;
  annotated_image_url?: string;
}

export interface PatientSummary {
  name: string;
  scan_count: number;
  last_scan: string;
  worst_suspicion: string;
}

export interface DailyStats {
  total: number;
  high: number;
  review: number;
  avg_turnaround: number;
}

export interface ModelInfo {
  id?: string;
  path: string;
  name: string;
}

export interface AnalyzeAuth {
  idToken?: string;
}

function auth_headers(auth?: AnalyzeAuth): HeadersInit {
  const headers: Record<string, string> = {};
  if (auth?.idToken) {
    headers.Authorization = `Bearer ${auth.idToken}`;
  }
  const apiKey = import.meta.env.VITE_API_KEY;
  if (apiKey) {
    headers["X-API-Key"] = apiKey;
  }
  const trial = import.meta.env.VITE_TRIAL_TOKEN;
  if (trial) {
    headers["X-Trial-Token"] = trial;
  }
  return headers;
}

async function read_api_error(res: Response, fallback: string): Promise<Error> {
  const text = await res.text();
  try {
    const data = JSON.parse(text) as { detail?: unknown };
    if (typeof data.detail === "string" && data.detail.trim()) {
      return new Error(data.detail);
    }
  } catch {
    // Use status-based fallback; never surface raw HTML/stack traces.
  }
  if (res.status === 401) {
    return new Error("Authentication required");
  }
  if (res.status === 413) {
    return new Error("Image is too large");
  }
  if (res.status === 415) {
    return new Error("Unsupported file type");
  }
  if (res.status === 429) {
    return new Error("Too many analyses. Try again later.");
  }
  if (res.status === 503 || res.status === 504) {
    return new Error("Analysis timed out or the server is busy");
  }
  return new Error(fallback);
}

/* ── Backend API calls (inference stays server-side) ── */

export async function analyzeImage(
  file: File,
  modelPath: string,
  confThreshold: number,
  modality: string,
  useToothAssignment: boolean,
  patientName: string,
  auth?: AnalyzeAuth,
): Promise<AnalysisResult> {
  const form = new FormData();
  form.append("file", file);
  form.append("model_path", modelPath);
  form.append("conf_threshold", String(confThreshold));
  form.append("modality", modality);
  form.append("use_tooth_assignment", String(useToothAssignment));
  form.append("patient_name", patientName);
  const res = await fetch(build_api_url("/api/analyze"), {
    method: "POST",
    body: form,
    headers: auth_headers(auth),
  });
  if (!res.ok) {
    throw await read_api_error(res, "Analysis failed");
  }
  const data: AnalysisResult = await res.json();
  if (data.annotated_image_url?.startsWith("/")) {
    data.annotated_image_url = build_api_url(data.annotated_image_url);
  }
  data.annotated_image_url = ensure_https_url(data.annotated_image_url);
  return data;
}

export async function getModels(auth?: AnalyzeAuth): Promise<ModelInfo[]> {
  const res = await fetch(build_api_url("/api/models"), {
    headers: auth_headers(auth),
  });
  if (!res.ok) {
    throw await read_api_error(res, `Could not load models (${res.status})`);
  }
  return res.json();
}

/* ── Firestore CRUD (scoped to authenticated user) ── */

const SUSPICION_ORDER: Record<string, number> = { LOW: 0, MODERATE: 1, HIGH: 2, REVIEW: 3 };

function normalize_patient_name(name: string): string {
  const trimmed = name.trim();
  return trimmed || "Pacient anonim";
}

function patient_doc_id(name: string): string {
  return name.replace(/\//g, "-");
}

export async function saveScanToFirestore(
  uid: string,
  scan: {
    file: File;
    filename: string;
    patientName: string;
    suspicion: string;
    confidence: number;
    detectionsCount: number;
    modality: string;
    turnaroundS: number;
    annotatedImageUrl?: string;
  },
) {
  const clean_patient_name = normalize_patient_name(scan.patientName);
  let image_url = "";

  if (ENABLE_SOURCE_UPLOAD) {
    try {
      const safe_name = scan.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
      const storage_path = `users/${uid}/scans/${Date.now()}_${safe_name}`;
      const image_ref = ref(storage, storage_path);
      await with_timeout(uploadBytes(image_ref, scan.file), 8000);
      image_url = await with_timeout(getDownloadURL(image_ref), 4000);
    } catch (error) {
      console.error("Could not upload scan image to Firebase Storage", error);
    }
  }

  const scansRef = collection(db, "users", uid, "scans");
  await addDoc(scansRef, {
    timestamp: serverTimestamp(),
    filename: scan.filename,
    patientName: clean_patient_name,
    suspicion: scan.suspicion,
    confidence: scan.confidence,
    detectionsCount: scan.detectionsCount,
    modality: scan.modality,
    turnaroundS: scan.turnaroundS,
    imageUrl: ensure_https_url(image_url),
    annotatedImageUrl: ensure_https_url(scan.annotatedImageUrl || ""),
  });

  const patRef = doc(db, "users", uid, "patients", patient_doc_id(clean_patient_name));
  const patSnap = await getDoc(patRef);
  if (patSnap.exists()) {
    const data = patSnap.data();
    const oldWorst = SUSPICION_ORDER[data.worstSuspicion] ?? -1;
    const newWorst = SUSPICION_ORDER[scan.suspicion] ?? -1;
    await setDoc(patRef, {
      name: clean_patient_name,
      scanCount: (data.scanCount || 0) + 1,
      lastScan: new Date().toISOString(),
      worstSuspicion: newWorst > oldWorst ? scan.suspicion : data.worstSuspicion,
    });
  } else {
    await setDoc(patRef, {
      name: clean_patient_name,
      scanCount: 1,
      lastScan: new Date().toISOString(),
      worstSuspicion: scan.suspicion,
    });
  }
}

export async function getHistoryFromFirestore(uid: string, count = 50): Promise<ScanRecord[]> {
  const q = query(
    collection(db, "users", uid, "scans"),
    orderBy("timestamp", "desc"),
    fsLimit(count),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    const ts = data.timestamp instanceof Timestamp
      ? data.timestamp.toDate().toISOString()
      : new Date().toISOString();
    return {
      id: d.id,
      timestamp: ts,
      filename: data.filename || "",
      patient_name: data.patientName || "",
      suspicion: data.suspicion || "LOW",
      confidence: data.confidence || 0,
      detections_count: data.detectionsCount || 0,
      modality: data.modality || "",
      turnaround_s: data.turnaroundS || 0,
      image_url: ensure_https_url(data.imageUrl || ""),
      annotated_image_url: ensure_https_url(data.annotatedImageUrl || ""),
    };
  });
}

export async function getStatsFromFirestore(uid: string): Promise<DailyStats> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const q = query(
    collection(db, "users", uid, "scans"),
    where("timestamp", ">=", Timestamp.fromDate(todayStart)),
  );
  const snap = await getDocs(q);

  let total = 0;
  let high = 0;
  let review = 0;
  let sumTurnaround = 0;

  snap.docs.forEach((d) => {
    const data = d.data();
    total++;
    if (data.suspicion === "HIGH") high++;
    if (data.suspicion === "REVIEW") review++;
    sumTurnaround += data.turnaroundS || 0;
  });

  return {
    total,
    high,
    review,
    avg_turnaround: total > 0 ? Math.round((sumTurnaround / total) * 100) / 100 : 0,
  };
}

export async function getPatientsFromFirestore(uid: string): Promise<PatientSummary[]> {
  const snap = await getDocs(collection(db, "users", uid, "patients"));
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      name: data.name || d.id,
      scan_count: data.scanCount || 0,
      last_scan: data.lastScan || "",
      worst_suspicion: data.worstSuspicion || "LOW",
    };
  });
}

export async function getPatientScansFromFirestore(uid: string, name: string): Promise<ScanRecord[]> {
  const q = query(
    collection(db, "users", uid, "scans"),
    where("patientName", "==", name),
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => {
      const data = d.data();
      const ts = data.timestamp instanceof Timestamp
        ? data.timestamp.toDate().toISOString()
        : new Date().toISOString();
      return {
        id: d.id,
        timestamp: ts,
        filename: data.filename || "",
        patient_name: data.patientName || "",
        suspicion: data.suspicion || "LOW",
        confidence: data.confidence || 0,
        detections_count: data.detectionsCount || 0,
        modality: data.modality || "",
        turnaround_s: data.turnaroundS || 0,
        image_url: ensure_https_url(data.imageUrl || ""),
        annotated_image_url: ensure_https_url(data.annotatedImageUrl || ""),
      };
    })
    .sort((a, b) => timestamp_to_millis(b.timestamp) - timestamp_to_millis(a.timestamp));
}

export async function deleteScanFromFirestore(uid: string, scanId: string): Promise<void> {
  await deleteDoc(doc(db, "users", uid, "scans", scanId));
}

export async function updateScanPatientName(uid: string, scanId: string, newName: string): Promise<void> {
  const { updateDoc } = await import("firebase/firestore");
  await updateDoc(doc(db, "users", uid, "scans", scanId), { patientName: newName });
}
