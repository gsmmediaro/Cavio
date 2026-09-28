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

const LOCAL_TOKEN_KEY = "cavio_local_token";

export function setLocalAccessToken(token: string | null) {
  if (token) localStorage.setItem(LOCAL_TOKEN_KEY, token);
  else localStorage.removeItem(LOCAL_TOKEN_KEY);
}

export function getLocalAccessToken(): string | null {
  return localStorage.getItem(LOCAL_TOKEN_KEY);
}

/** Prefer Firebase ID token; fall back to local JWT from /api/auth. */
export async function getAccessToken(forceRefresh = false): Promise<string | null> {
  try {
    const { auth } = await import("../firebase");
    const u = auth.currentUser;
    if (u) return await u.getIdToken(forceRefresh);
  } catch {
    // firebase may be unconfigured in some local flows
  }
  return getLocalAccessToken();
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getAccessToken();
  return token ? { Authorization: "Bearer " + token } : {};
}


function ensure_https_url(url: string): string {
  if (!url) return "";
  // Keep localhost / loopback on http for local API
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(url)) {
    return url;
  }
  if (url.startsWith("http://")) {
    return `https://${url.slice("http://".length)}`;
  }
  return url;
}


function extract_result_filename(url: string): string {
  if (!url) return "";
  try {
    const path = url.startsWith("http") ? new URL(url).pathname : url.split("?")[0];
    const marker = "/static/results/";
    const idx = path.indexOf(marker);
    if (idx < 0) return "";
    const name = path.slice(idx + marker.length).split("/")[0];
    if (!name || !/\.(jpe?g|png|webp)$/i.test(name)) return "";
    if (name.includes("..")) return "";
    return name;
  } catch {
    return "";
  }
}

export async function refreshResultImageUrl(filename: string): Promise<string> {
  const headers = await authHeaders();
  const res = await fetch(build_api_url("/api/results/" + encodeURIComponent(filename) + "/url"), {
    headers,
  });
  if (!res.ok) {
    throw new Error("Could not refresh result image (" + res.status + ")");
  }
  const data = await res.json();
  return ensure_https_url(data.url || "");
}

async function persist_annotated_image(uid: string, annotatedUrl: string, filenameHint: string): Promise<string> {
  if (!annotatedUrl) return "";
  // Already durable (Firebase Storage / GCS) — keep as-is.
  if (/firebasestorage\.googleapis\.com|storage\.googleapis\.com/i.test(annotatedUrl)) {
    return annotatedUrl;
  }
  try {
    // Cross-origin fetch of Railway /static/results requires CORS allowlist
    // (cavio.ro / pages.dev). Without that, past scans 404 after Railway redeploy.
    const res = await with_timeout(
      fetch(annotatedUrl, { mode: "cors", credentials: "omit", cache: "no-store" }),
      15000,
    );
    if (!res.ok) return "";
    const blob = await with_timeout(res.blob(), 15000);
    if (!blob || blob.size < 32) return "";
    const safe_name = (filenameHint || "annotated.jpg").replace(/[^a-zA-Z0-9._-]/g, "_");
    const storage_path = `users/${uid}/scans/${Date.now()}_annotated_${safe_name}`;
    const image_ref = ref(storage, storage_path);
    await with_timeout(uploadBytes(image_ref, blob, { contentType: blob.type || "image/jpeg" }), 20000);
    return await with_timeout(getDownloadURL(image_ref), 8000);
  } catch (error) {
    console.error("Could not persist annotated image to Firebase Storage", error);
    return "";
  }
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
  credits_remaining?: number | null;
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
  result_filename?: string;
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
  path: string;
  name: string;
}

/* â”€â”€ Backend API calls (inference stays server-side) â”€â”€ */

export async function analyzeImage(
  file: File,
  modelPath: string,
  confThreshold: number,
  modality: string,
  useToothAssignment: boolean,
  patientName: string,
): Promise<AnalysisResult> {
  const form = new FormData();
  form.append("file", file);
  form.append("model_path", modelPath);
  form.append("conf_threshold", String(confThreshold));
  form.append("modality", modality);
  form.append("use_tooth_assignment", String(useToothAssignment));
  form.append("patient_name", patientName);
  const headers = await authHeaders();
  const res = await fetch(build_api_url("/api/analyze"), {
    method: "POST",
    body: form,
    headers,
  });
  if (!res.ok) {
    let detail = await res.text();
    try {
      const parsed = JSON.parse(detail);
      detail = parsed.detail || detail;
    } catch { /* keep text */ }
    const err = new Error(detail || ("Analyze failed (" + res.status + ")")) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  const data: AnalysisResult = await res.json();
  if (data.annotated_image_url?.startsWith("/")) {
    data.annotated_image_url = build_api_url(data.annotated_image_url);
  }
  data.annotated_image_url = ensure_https_url(data.annotated_image_url);
  return data;
}

export async function getModels(): Promise<ModelInfo[]> {
  const res = await fetch(build_api_url("/api/models"));
  if (!res.ok) throw new Error(`Could not load models (${res.status})`);
  return res.json();
}

/* â”€â”€ Firestore CRUD (scoped to authenticated user) â”€â”€ */

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
  const result_filename = extract_result_filename(scan.annotatedImageUrl || "");

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

  // Prefer a durable Firebase URL over the short-lived HMAC result link.
  let annotated_url = ensure_https_url(scan.annotatedImageUrl || "");
  const durable = await persist_annotated_image(
    uid,
    annotated_url,
    scan.filename || result_filename || "annotated.jpg",
  );
  if (durable) {
    annotated_url = ensure_https_url(durable);
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
    annotatedImageUrl: annotated_url,
    resultFilename: result_filename,
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
      result_filename: data.resultFilename || extract_result_filename(data.annotatedImageUrl || ""),
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
        result_filename: data.resultFilename || extract_result_filename(data.annotatedImageUrl || ""),
      };
    })
    .sort((a, b) => timestamp_to_millis(b.timestamp) - timestamp_to_millis(a.timestamp));
}


/** Resolve a saved scan image: durable URL, or re-sign local /static/results file. */
export async function resolveSavedScanImageUrl(scan: ScanRecord): Promise<string> {
  const candidates = [scan.annotated_image_url || "", scan.image_url || ""].filter(Boolean);
  for (const url of candidates) {
    const ok = await new Promise<boolean>((resolve) => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = url;
    });
    if (ok) return url;
  }

  const filename =
    scan.result_filename ||
    extract_result_filename(scan.annotated_image_url || "") ||
    extract_result_filename(scan.image_url || "");
  if (!filename) return "";

  try {
    return await refreshResultImageUrl(filename);
  } catch (error) {
    console.error("Could not refresh saved scan image URL", error);
    return "";
  }
}

export async function deleteScanFromFirestore(uid: string, scanId: string): Promise<void> {
  await deleteDoc(doc(db, "users", uid, "scans", scanId));
}

export async function updateScanPatientName(uid: string, scanId: string, newName: string): Promise<void> {
  const { updateDoc } = await import("firebase/firestore");
  await updateDoc(doc(db, "users", uid, "scans", scanId), { patientName: newName });
}


/* ── Credits / billing (backend) ── */

export interface PlanInfo {
  id: string;
  name: string;
  description: string;
  price_cents: number;
  price_cents_monthly?: number;
  price_cents_yearly?: number;
  credits: number;
  credits_monthly?: number;
  featured?: boolean;
  stripe_price_id?: string;
  stripe_price_id_monthly?: string;
  stripe_price_id_yearly?: string;
  interval?: string;
}

export interface CreditsInfo {
  credits: number;
  scan_cost: number;
  pack_credits: number;
  pack_price_cents: number;
  publishable_key: string;
  plans?: PlanInfo[];
  featured_plan_id?: string;
  subscription_plan_id?: string;
  subscription_interval?: string;
  subscription_status?: string;
}

export async function getCredits(): Promise<CreditsInfo> {
  const attempt = async (forceRefresh: boolean) => {
    const token = await getAccessToken(forceRefresh);
    const headers: Record<string, string> = token
      ? { Authorization: "Bearer " + token }
      : {};
    return fetch(build_api_url("/api/credits"), { headers });
  };
  let res = await attempt(false);
  if (res.status === 401) {
    // Stale Firebase ID token → force refresh once
    res = await attempt(true);
  }
  if (!res.ok) {
    let detail = await res.text();
    try {
      const parsed = JSON.parse(detail);
      if (parsed?.detail) detail = String(parsed.detail);
    } catch {
      /* keep raw */
    }
    throw new Error(detail || "Could not load credits");
  }
  return res.json();
}

export async function createCheckoutSession(
  planId: string = "pro",
  interval: "month" | "year" = "month",
): Promise<{
  checkout_url: string;
  session_id: string;
  plan_id: string;
  credits: number;
  interval?: string;
}> {
  const headers = await authHeaders();
  headers["Content-Type"] = "application/json";
  const res = await fetch(build_api_url("/api/billing/checkout"), {
    method: "POST",
    headers,
    body: JSON.stringify({ plan_id: planId, interval }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function syncBackendAccount(): Promise<{ uid: string; email: string; credits: number }> {
  const headers = await authHeaders();
  const res = await fetch(build_api_url('/api/auth/sync'), {
    method: 'POST',
    headers,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function localRegister(email: string, password: string) {
  const res = await fetch(build_api_url('/api/auth/register'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  setLocalAccessToken(data.access_token);
  return data;
}

export async function localLogin(email: string, password: string) {
  const res = await fetch(build_api_url('/api/auth/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  setLocalAccessToken(data.access_token);
  return data;
}
