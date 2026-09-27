import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Upload, X, Loader2, Layers, Gauge, Waypoints, Send, Shield, Pencil, ArrowLeft, Download } from "lucide-react";
import * as SelectPrimitive from "@radix-ui/react-select";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { AnimatePresence, motion } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import {
  analyzeImage,
  getModels,
  getPatientScansFromFirestore,
  saveScanToFirestore,
  updateScanPatientName,
  type AnalysisResult,
  type ModelInfo,
  type ScanRecord,
} from "../api/client";
import { useAuth } from "../contexts/AuthContext";
import FindingsTable from "../components/FindingsTable";
import { useTranslation } from "react-i18next";

const ACCEPT = ".jpg,.jpeg,.png,.bmp,.tiff,.tif";

function to_result_from_saved_scan(scan: ScanRecord): AnalysisResult {
  return {
    filename: scan.filename,
    suspicion_level: scan.suspicion,
    overall_confidence: scan.confidence,
    detections: [],
    annotated_image_url: scan.annotated_image_url || scan.image_url || "",
    modality: scan.modality || "Panoramic",
    model_name: "Saved scan",
    num_detections: scan.detections_count,
    turnaround_s: scan.turnaround_s,
  };
}

function check_image_url(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (!url) {
      resolve(false);
      return;
    }
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
  });
}

async function pick_first_valid_saved_scan(
  scans: ScanRecord[],
): Promise<ScanRecord | null> {
  for (const scan of scans) {
    const candidate_url = scan.annotated_image_url || scan.image_url || "";
    if (!candidate_url) continue;
    const ok = await check_image_url(candidate_url);
    if (ok) return scan;
  }
  return null;
}

export default function AnalyzeScan() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, userProfile, setShowAuthGate } = useAuth();
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [conf, setConf] = useState(0.5);
  const [toothAssign, setToothAssign] = useState(false);
  const [patientName, setPatientName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [savedScanId, setSavedScanId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [resultImageError, setResultImageError] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [openPopover, setOpenPopover] = useState<string | null>(null);
  const [modelDrawerOpen, setModelDrawerOpen] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const patientInputRef = useRef<HTMLInputElement>(null);

  const LOADING_MESSAGES = [
    t("analyze.loading.analyzing"),
    t("analyze.loading.detecting"),
    t("analyze.loading.mapping"),
    t("analyze.loading.almost"),
  ];

  useEffect(() => {
    if (!loading) { setLoadingMsg(0); return; }
    const interval = setInterval(() => {
      setLoadingMsg((prev) => (prev + 1) % LOADING_MESSAGES.length);
    }, 2800);
    return () => clearInterval(interval);
  }, [loading]);

  const firstName = userProfile?.firstName || user?.displayName?.split(" ")[0] || "";

  // Time-aware greeting for warm professional touch
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t("analyze.greeting.morning");
    if (hour < 17) return t("analyze.greeting.afternoon");
    return t("analyze.greeting.evening");
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const idToken = user ? await user.getIdToken() : undefined;
        const loaded = await getModels({ idToken });
        if (!cancelled) setModels(loaded);
      } catch {
        if (!cancelled) setError(t("analyze.errors.noModels"));
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!models.length || selectedModel) return;

    const preferred = models.find((m) => {
      const raw = `${m.id || ""} ${m.name} ${m.path}`.toLowerCase();
      return raw.includes("pano_gpu2") || raw.includes("pano_caries_only_gpu2");
    });

    const fallback = models[0].id || models[0].path;
    setSelectedModel(preferred ? (preferred.id || preferred.path) : fallback);
  }, [models, selectedModel]);

  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (!params.has("new")) return;
    setFile(null);
    setPreview(null);
    setResult(null);
    setError("");
    setPatientName("");
    setLoading(false);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }, [location.search]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const patient = params.get("patient")?.trim();
    if (!user || !patient || params.has("new")) return;

    let cancelled = false;
    setLoading(true);
    setError("");
    setResultImageError(false);
    getPatientScansFromFirestore(user.uid, patient)
      .then(async (scans) => {
        if (cancelled) return;
        if (!scans.length) {
          setError(t("analyze.errors.noSavedScans"));
          return;
        }

        const valid_scan = await pick_first_valid_saved_scan(scans);
        if (cancelled) return;
        if (!valid_scan) {
          setError(t("analyze.errors.imageNotAvailable"));
          return;
        }

        const saved_result = to_result_from_saved_scan(valid_scan);
        setSavedScanId(valid_scan.id);
        if (!saved_result.annotated_image_url) {
          setError(t("analyze.errors.noImageUrl"));
          return;
        }

        setPatientName(patient);
        setFile(null);
        setPreview(null);
        setResult(saved_result);
      })
      .catch((err: unknown) => {
        const message = err instanceof Error
          ? err.message
          : t("analyze.errors.couldNotLoad");
        setError(message);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [location.search, user]);

  const handleFile = useCallback((f: File) => {
    setFile(f);
    setResult(null);
    setResultImageError(false);
    setError("");
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const clearFile = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setResultImageError(false);
    setError("");
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const handleAnalyze = async () => {
    if (!file || !selectedModel) return;

    // Guest free-run gate: block if already used
    if (!user && localStorage.getItem("cavio_guest_used")) {
      setShowAuthGate(true);
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);
    setResultImageError(false);
    try {
      const idToken = user ? await user.getIdToken() : undefined;
      const res = await analyzeImage(
        file,
        selectedModel,
        conf,
        selectedModel.toLowerCase().includes("bitewing") ? "Bitewing" : "Panoramic",
        toothAssign,
        patientName,
        { idToken },
      );
      setResult(res);

      // Guest: mark free run used, then force auth after a short delay
      if (!user) {
        localStorage.setItem("cavio_guest_used", "1");
        setTimeout(() => setShowAuthGate(true), 2500);
      }

      if (user) {
        void saveScanToFirestore(user.uid, {
          file,
          filename: res.filename,
          patientName,
          suspicion: res.suspicion_level,
          confidence: res.overall_confidence,
          detectionsCount: res.num_detections,
          modality: res.modality,
          turnaroundS: res.turnaround_s,
          annotatedImageUrl: res.annotated_image_url,
        })
          .then(() => {
            window.dispatchEvent(new Event("cavio:patients-updated"));
          })
          .catch((save_error: unknown) => {
            const message =
              save_error instanceof Error
                ? save_error.message
                : t("analyze.errors.saveFailed");
            setError(message);
          });
      }
    } catch (e: any) {
      setError(e.message || t("analyze.errors.analysisFailed"));
    } finally {
      setLoading(false);
    }
  };

  const MODEL_DISPLAY: Record<string, string> = {
    "pano_gpu2": "Panoramic",
    "pano_caries_only_gpu2": "Panoramic",
    "bitewing": "Bitewing",
    "bitewing_caries_only": "Bitewing",
    "potato": "Kiwi",
    "pano_dc1000_potato": "Kiwi",
  };

  const modelOptions = useMemo(() => (
    models.map((m) => {
      const raw = m.name.toLowerCase();
      const path = (m.id || m.path).toLowerCase();

      let label = m.name;
      for (const [key, value] of Object.entries(MODEL_DISPLAY)) {
        if (raw.includes(key) || path.includes(key)) {
          label = value;
          break;
        }
      }

      return { value: m.id || m.path, label };
    })
  ), [models]);

  const currentModelLabel = modelOptions.find((o) => o.value === selectedModel)?.label || "Panoramic";
  const isMobile = window.innerWidth <= 768;

  const toolbarBtnStyle = (active: boolean = false): React.CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 10px",
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 500,
    border: "1px solid var(--border-color)",
    cursor: "pointer",
    transition: "background 0.15s, color 0.15s, border-color 0.15s",
    background: active ? "var(--color-leaf-subtle)" : "var(--color-surface)",
    color: active ? "var(--color-leaf-text)" : "var(--color-ink-secondary)",
    fontFamily: "var(--font-body)",
  });

  const isSavedScan = !!result && !file;
  const isWelcome = !file && !result && !loading;

  /* ───────── WELCOME STATE ───────── */
  if (isWelcome) {
    return (
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={(e) => {
          if (e.currentTarget.contains(e.relatedTarget as Node)) return;
          setDragOver(false);
        }}
        onDrop={handleDrop}
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: isMobile ? "40px 20px" : "60px 32px",
          maxWidth: 680,
          width: "100%",
          margin: "0 auto",
          minHeight: "calc(100vh - 200px)",
          position: "relative",
        }}
      >
        {/* Drag overlay */}
        <AnimatePresence>
          {dragOver && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(45, 122, 79, 0.06)",
                backdropFilter: "blur(2px)",
                zIndex: 50,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                pointerEvents: "none",
              }}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                style={{
                  background: "var(--color-surface)",
                  borderRadius: 20,
                  padding: "48px 64px",
                  boxShadow: "0 20px 60px rgba(0,0,0,0.1)",
                  textAlign: "center",
                  border: "2px dashed var(--color-leaf)",
                }}
              >
                <motion.div
                  animate={{ y: [0, -6, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                >
                  <Upload size={40} strokeWidth={1.5} style={{ color: "var(--color-leaf)" }} />
                </motion.div>
                <div style={{ fontSize: 18, fontWeight: 500, color: "var(--color-ink)", fontFamily: "var(--font-display)", marginTop: 12 }}>
                  Drop your X-ray here
                </div>
                <div style={{ fontSize: 13, color: "var(--color-ink-tertiary)", marginTop: 4 }}>
                  JPG, PNG, BMP, or TIFF
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Avatar cluster — Quinn logo + two dental professional avatars */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 28,
          }}
        >
          {/* Quinn logo avatar — on the left */}
          <div style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            background: "var(--color-bg)",
            border: "3px solid var(--color-ink)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 3,
            boxShadow: "0 0 0 3px var(--color-bg)",
          }}>
            <img src="/Cavio Logo.png" alt="Cavio" style={{ width: 24, height: 24, filter: "brightness(0)" }} />
          </div>
          {/* Dentist avatar 1 */}
          <div style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            background: "var(--color-surface-inset)",
            overflow: "hidden",
            marginLeft: -10,
            zIndex: 2,
            boxShadow: "0 0 0 3px var(--color-bg)",
          }}>
            <img
              src="https://cdn.shadcnstudio.com/ss-assets/avatar/avatar-3.png"
              alt="Dr. Anna"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </div>
          {/* Dentist avatar 2 */}
          <div style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            background: "var(--color-surface-inset)",
            overflow: "hidden",
            marginLeft: -10,
            zIndex: 1,
            boxShadow: "0 0 0 3px var(--color-bg)",
          }}>
            <img
              src="https://cdn.shadcnstudio.com/ss-assets/avatar/avatar-6.png"
              alt="Dr. Mark"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </div>
        </motion.div>

        {/* Greeting */}
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.08, ease: "easeOut" }}
          style={{
            fontFamily: "var(--font-display)",
            fontSize: isMobile ? 36 : 52,
            fontWeight: 400,
            color: "var(--color-ink)",
            textAlign: "center",
            lineHeight: 1.15,
            marginBottom: 24,
            textWrap: "balance",
          }}
        >
          {firstName
            ? t("analyze.home.greetingWithName", { name: firstName })
            : t("analyze.home.greeting")}
        </motion.h1>

        {/* Description — only shown to non-logged-in users */}
        {!user && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15, ease: "easeOut" }}
            style={{
              fontSize: 15,
              color: "var(--color-ink-secondary)",
              textAlign: "left",
              marginBottom: 40,
              lineHeight: 1.75,
              maxWidth: 520,
            }}
          >
            <p style={{ marginBottom: 12 }}>{t("analyze.home.desc1Before")} <strong style={{ color: "var(--color-ink)", fontWeight: 600 }}>{t("analyze.home.desc1Bold")}</strong>{t("analyze.home.desc1After")}</p>
            <p style={{ marginBottom: 12 }}>{t("analyze.home.desc2Before")} <strong style={{ color: "var(--color-ink)", fontWeight: 600 }}>{t("analyze.home.desc2Bold")}</strong> {t("analyze.home.desc2After")}</p>
            <p>{t("analyze.home.desc3")}</p>
          </motion.div>
        )}

        {/* Upload input box */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.25, ease: "easeOut" }}
          style={{ width: "100%", maxWidth: 680, marginBottom: 16 }}
        >
          <div
            onClick={() => inputRef.current?.click()}
            style={{
              display: "flex",
              alignItems: "center",
              background: "var(--color-surface)",
              borderRadius: 18,
              border: "none",
              boxShadow: inputFocused
                ? "0 0 0 1px rgba(45, 42, 36, 0.18), 0 2px 4px rgba(0,0,0,0.04), 0 6px 16px rgba(0,0,0,0.03)"
                : "0 0 0 1px rgba(45, 42, 36, 0.06), 0 2px 4px rgba(0,0,0,0.04), 0 6px 16px rgba(0,0,0,0.03)",
              transition: "box-shadow 0.25s cubic-bezier(0.2, 0, 0, 1)",
              cursor: "pointer",
              overflow: "hidden",
            }}
            onMouseEnter={() => setInputFocused(true)}
            onMouseLeave={() => { if (!patientInputRef.current?.matches(":focus")) setInputFocused(false); }}
          >
            <div style={{ padding: "20px 0 20px 20px", display: "flex", alignItems: "center" }}>
              <Upload size={20} strokeWidth={1.5} style={{ color: "var(--color-ink-ghost)" }} />
            </div>
            <input
              ref={patientInputRef}
              type="text"
              placeholder={t("analyze.home.inputPlaceholder")}
              value={patientName}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => setPatientName(e.target.value)}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  inputRef.current?.click();
                }
              }}
              style={{
                flex: 1,
                padding: "20px 14px",
                background: "transparent",
                border: "none",
                fontSize: 16,
                fontFamily: "var(--font-body)",
                color: "var(--color-ink)",
                outline: "none",
              }}
            />
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.96 }}
              transition={{ type: "spring", duration: 0.3, bounce: 0 }}
              onClick={(e) => {
                e.stopPropagation();
                inputRef.current?.click();
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                padding: "12px 22px",
                margin: "8px 8px 8px 0",
                borderRadius: 12,
                border: "none",
                background: "var(--color-surface-inset)",
                color: "var(--color-ink-secondary)",
                fontSize: 14,
                fontWeight: 500,
                cursor: "pointer",
                fontFamily: "var(--font-body)",
                whiteSpace: "nowrap",
                transition: "background 0.15s, color 0.15s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--color-ink)"; e.currentTarget.style.color = "white"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "var(--color-surface-inset)"; e.currentTarget.style.color = "var(--color-ink-secondary)"; }}
            >
              {t("analyze.home.getStarted")}
              <Send size={14} />
            </motion.button>
          </div>
        </motion.div>

        {/* Error */}
        {error && (
          <div style={{ color: "var(--color-high)", fontWeight: 500, fontSize: 13, marginTop: 12, textAlign: "center" }}>
            {error}
          </div>
        )}

        {/* Hidden file input */}
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.currentTarget.value = "";
          }}
        />

      </div>
    );
  }

  /* ───────── SAVED SCAN VIEW ───────── */
  if (isSavedScan && result) {
    const savedSuspicionColor = {
      low: { bg: "var(--color-low-bg)", text: "var(--color-low)" },
      moderate: { bg: "var(--color-moderate-bg)", text: "var(--color-moderate)" },
      high: { bg: "var(--color-high-bg)", text: "var(--color-high)" },
      review: { bg: "var(--color-review-bg)", text: "var(--color-review)" },
    }[result.suspicion_level.toLowerCase()] || { bg: "var(--color-low-bg)", text: "var(--color-low)" };

    const handleNameBlur = () => {
      if (user && savedScanId && patientName.trim()) {
        void updateScanPatientName(user.uid, savedScanId, patientName.trim());
        window.dispatchEvent(new Event("cavio:patients-updated"));
      }
    };

    const handleDownload = () => {
      if (!result.annotated_image_url) return;
      const a = document.createElement("a");
      a.href = result.annotated_image_url;
      a.download = `${patientName || "scan"}.jpg`;
      a.target = "_blank";
      a.click();
    };

    return (
      <div style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: isMobile ? "24px 16px 32px" : "48px 32px 32px",
        maxWidth: 800,
        width: "100%",
        margin: "0 auto",
      }}>
        {/* Back button */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          style={{ width: "100%", marginBottom: 20 }}
        >
          <button
            onClick={() => navigate(`/analyze?new=${Date.now()}`)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "none", border: "none", cursor: "pointer",
              color: "var(--color-ink-secondary)", fontSize: 13, fontWeight: 500,
              fontFamily: "var(--font-body)", padding: "4px 0",
              transition: "color 0.15s",
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = "var(--color-ink)"}
            onMouseLeave={(e) => e.currentTarget.style.color = "var(--color-ink-secondary)"}
          >
            <ArrowLeft size={15} />
            {t("analyze.newScan")}
          </button>
        </motion.div>

        {/* Logo + editable name */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 8, width: "100%" }}
        >
          <img src="/Cavio Logo.png" alt="Cavio" style={{ width: 28, height: 28, flexShrink: 0 }} />
          <div style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
            <input
              type="text"
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
              onBlur={handleNameBlur}
              placeholder={t("analyze.unnamedPatient")}
              style={{
                fontFamily: "var(--font-display)", fontSize: isMobile ? 24 : 30,
                fontWeight: 400, color: "var(--color-ink)", margin: 0, lineHeight: 1.2,
                background: "transparent", border: "none", outline: "none",
                padding: "2px 24px 2px 0", width: `${Math.max((patientName || t("analyze.unnamedPatient")).length, 10)}ch`,
                borderBottom: "1px dashed transparent",
                transition: "border-color 0.15s",
              }}
              onFocus={(e) => e.currentTarget.style.borderColor = "var(--border-emphasis)"}
            />
            <Pencil size={13} style={{
              position: "absolute", right: 2, top: "50%", transform: "translateY(-50%)",
              color: "var(--color-ink-ghost)", pointerEvents: "none",
            }} />
          </div>
        </motion.div>

        {/* Metadata subtitle */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.06 }}
          style={{
            fontSize: 13, color: "var(--color-ink-tertiary)", marginBottom: 20,
            fontFamily: "var(--font-body)", textAlign: "center",
          }}
        >
          {result.modality} &middot; {result.num_detections} {result.num_detections !== 1 ? t("analyze.findings") : t("analyze.finding")} &middot;{" "}
          <span style={{ color: savedSuspicionColor.text, fontWeight: 500 }}>{result.suspicion_level}</span>
        </motion.p>

        {/* Image */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          style={{ width: "100%", position: "relative" }}
          className="group"
        >
          <div style={{
            width: "100%",
            background: "#111",
            borderRadius: 16,
            overflow: "hidden",
            boxShadow: "0 4px 24px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.06)",
          }}>
            {resultImageError ? (
              <div style={{
                width: "100%", minHeight: 260, display: "flex",
                flexDirection: "column", alignItems: "center", justifyContent: "center",
                color: "rgba(255,255,255,0.75)", fontSize: 14, padding: 32, textAlign: "center", gap: 12,
              }}>
                <span>{t("analyze.savedImageUnavailable")}</span>
                <button
                  onClick={() => navigate(`/analyze?new=${Date.now()}`)}
                  style={{
                    padding: "8px 18px", borderRadius: 8, border: "none",
                    background: "var(--color-leaf)", color: "white", fontSize: 13,
                    fontWeight: 500, cursor: "pointer", fontFamily: "var(--font-body)",
                  }}
                >
                  {t("analyze.startNewScan")}
                </button>
              </div>
            ) : (
              <img
                src={result.annotated_image_url}
                alt={`${patientName || t("analyze.unnamedPatient")} ${result.modality}`}
                style={{ width: "100%", display: "block" }}
                onLoad={() => setResultImageError(false)}
                onError={() => setResultImageError(true)}
              />
            )}
          </div>

          {/* Download button — appears on hover */}
          {!resultImageError && (
            <button
              onClick={handleDownload}
              className="opacity-0 group-hover:opacity-100"
              style={{
                position: "absolute", bottom: 12, right: 12,
                width: 36, height: 36, borderRadius: "50%",
                background: "rgba(0,0,0,0.55)", color: "white",
                display: "flex", alignItems: "center", justifyContent: "center",
                border: "none", cursor: "pointer",
                transition: "opacity 0.2s, background 0.15s",
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "rgba(0,0,0,0.75)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "rgba(0,0,0,0.55)"}
              title={t("analyze.downloadImage")}
            >
              <Download size={15} />
            </button>
          )}
        </motion.div>
      </div>
    );
  }

  /* ───────── ACTIVE STATE (file selected, loading, or fresh result) ───────── */

  const suspicionColor = result ? {
    low: { bg: "var(--color-low-bg)", text: "var(--color-low)" },
    moderate: { bg: "var(--color-moderate-bg)", text: "var(--color-moderate)" },
    high: { bg: "var(--color-high-bg)", text: "var(--color-high)" },
    review: { bg: "var(--color-review-bg)", text: "var(--color-review)" },
  }[result.suspicion_level.toLowerCase()] || { bg: "var(--color-low-bg)", text: "var(--color-low)" } : null;

  return (
    <div style={{
      flex: 1,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: result ? "flex-start" : "center",
      padding: isMobile ? "20px 16px 24px" : "40px 32px 24px",
      maxWidth: 900,
      width: "100%",
      margin: "0 auto",
      minHeight: 0,
    }}>
      {/* Header */}
      {result ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          style={{ width: "100%", marginBottom: 28 }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 6 }}>
            <img src="/Cavio Logo.png" alt="Cavio" style={{ width: 28, height: 28, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 style={{
                fontFamily: "var(--font-display)", fontSize: isMobile ? 24 : 30,
                fontWeight: 400, color: "var(--color-ink)", margin: 0, lineHeight: 1.2,
              }}>
                {patientName || t("analyze.scanAnalysis")}
              </h1>
              <p style={{
                fontSize: 13, color: "var(--color-ink-tertiary)", margin: "2px 0 0",
                fontFamily: "var(--font-body)",
              }}>
                {result.modality} &middot; {result.model_name} &middot; {result.num_detections} {result.num_detections !== 1 ? t("analyze.findings") : t("analyze.finding")}
              </p>
            </div>
          </div>
        </motion.div>
      ) : (
        <div style={{
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          alignItems: isMobile ? "stretch" : "baseline",
          gap: isMobile ? 12 : 24,
          width: "100%",
          marginBottom: 24,
        }}>
          <h1 style={{
            fontFamily: "var(--font-display)",
            fontSize: isMobile ? 22 : 26,
            fontWeight: 400,
            color: "var(--color-ink)",
            whiteSpace: "nowrap",
            margin: 0,
          }}>
            {t("analyze.analyzeXray")}
          </h1>
          <input
            style={{
              flex: 1, padding: "8px 14px", background: "transparent",
              border: "1px solid var(--border-color)", borderRadius: 8,
              fontSize: 14, fontFamily: "var(--font-body)", color: "var(--color-ink)",
              outline: "none", transition: "border-color 0.15s",
            }}
            type="text"
            placeholder={t("analyze.patientNameOptional")}
            value={patientName}
            onChange={(e) => setPatientName(e.target.value)}
            onFocus={(e) => e.currentTarget.style.borderColor = "var(--color-leaf)"}
            onBlur={(e) => e.currentTarget.style.borderColor = "var(--border-color)"}
          />
        </div>
      )}

      {/* Summary stat cards — shown when result exists */}
      {result && suspicionColor && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.08, ease: "easeOut" }}
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)",
            gap: 10,
            width: "100%",
            marginBottom: 20,
          }}
        >
          {/* Suspicion */}
          <div style={{
            background: suspicionColor.bg,
            borderRadius: 14,
            padding: "16px 18px",
            display: "flex", flexDirection: "column", gap: 4,
          }}>
            <span style={{ fontSize: 11, fontWeight: 500, color: suspicionColor.text, textTransform: "uppercase", letterSpacing: "0.04em", fontFamily: "var(--font-body)", opacity: 0.8 }}>
              Suspicion
            </span>
            <span style={{ fontSize: 20, fontWeight: 600, color: suspicionColor.text, fontFamily: "var(--font-display)", lineHeight: 1.2 }}>
              {result.suspicion_level}
            </span>
          </div>
          {/* Confidence */}
          <div style={{
            background: "var(--color-surface)",
            borderRadius: 14,
            padding: "16px 18px",
            boxShadow: "0 0 0 1px rgba(45, 42, 36, 0.06), 0 1px 2px rgba(0,0,0,0.03)",
            display: "flex", flexDirection: "column", gap: 4,
          }}>
            <span style={{ fontSize: 11, fontWeight: 500, color: "var(--color-ink-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em", fontFamily: "var(--font-body)" }}>
              Confidence
            </span>
            <span style={{ fontSize: 20, fontWeight: 600, color: "var(--color-ink)", fontFamily: "var(--font-display)", lineHeight: 1.2, fontVariantNumeric: "tabular-nums" }}>
              {(result.overall_confidence * 100).toFixed(0)}%
            </span>
          </div>
          {/* Detections */}
          <div style={{
            background: "var(--color-surface)",
            borderRadius: 14,
            padding: "16px 18px",
            boxShadow: "0 0 0 1px rgba(45, 42, 36, 0.06), 0 1px 2px rgba(0,0,0,0.03)",
            display: "flex", flexDirection: "column", gap: 4,
          }}>
            <span style={{ fontSize: 11, fontWeight: 500, color: "var(--color-ink-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em", fontFamily: "var(--font-body)" }}>
              Findings
            </span>
            <span style={{ fontSize: 20, fontWeight: 600, color: "var(--color-ink)", fontFamily: "var(--font-display)", lineHeight: 1.2, fontVariantNumeric: "tabular-nums" }}>
              {result.num_detections}
            </span>
          </div>
          {/* Turnaround */}
          <div style={{
            background: "var(--color-surface)",
            borderRadius: 14,
            padding: "16px 18px",
            boxShadow: "0 0 0 1px rgba(45, 42, 36, 0.06), 0 1px 2px rgba(0,0,0,0.03)",
            display: "flex", flexDirection: "column", gap: 4,
          }}>
            <span style={{ fontSize: 11, fontWeight: 500, color: "var(--color-ink-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em", fontFamily: "var(--font-body)" }}>
              Speed
            </span>
            <span style={{ fontSize: 20, fontWeight: 600, color: "var(--color-ink)", fontFamily: "var(--font-display)", lineHeight: 1.2, fontVariantNumeric: "tabular-nums" }}>
              {result.turnaround_s?.toFixed(1) || "—"}s
            </span>
          </div>
        </motion.div>
      )}

      {/* Upload / Image area */}
      <div style={{ width: "100%", marginBottom: result ? 24 : 16 }}>
        {!file && !result ? (
          <div
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            style={{
              width: "100%",
              border: `1.5px dashed ${dragOver ? "var(--color-leaf)" : "var(--border-emphasis)"}`,
              borderRadius: 14,
              padding: isMobile ? "40px 20px" : "56px 32px",
              textAlign: "center",
              cursor: "pointer",
              transition: "border-color 0.2s, background 0.2s",
              background: dragOver ? "var(--color-leaf-subtle)" : "var(--color-surface)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Upload size={36} strokeWidth={1.5} style={{ color: "var(--color-ink-ghost)", marginBottom: 10 }} />
            <div style={{ fontSize: 15, color: "var(--color-ink-secondary)" }}>
              Drag an X-ray here, or click to select
            </div>
            <div style={{ fontSize: 12, color: "var(--color-ink-tertiary)", marginTop: 4 }}>
              JPG, PNG, BMP, TIFF
            </div>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            style={{ position: "relative" }}
            className="group"
          >
            <div style={{
              width: "100%",
              background: "#111",
              borderRadius: 16,
              overflow: "hidden",
              boxShadow: result
                ? "0 4px 24px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.06)"
                : "0 1px 4px rgba(0,0,0,0.08)",
            }}>
              {result && resultImageError ? (
                <div style={{
                  width: "100%", minHeight: 260, display: "flex",
                  alignItems: "center", justifyContent: "center",
                  color: "rgba(255,255,255,0.75)", fontSize: 14, padding: 24, textAlign: "center",
                }}>
                  Saved image is unavailable (404). Please re-analyze this patient.
                </div>
              ) : (
                <img
                  src={result ? result.annotated_image_url : preview!}
                  alt="X-ray"
                  style={{ width: "100%", display: "block", outline: "1px solid rgba(255,255,255,0.04)", outlineOffset: -1 }}
                  onLoad={() => setResultImageError(false)}
                  onError={() => { if (result) setResultImageError(true); }}
                />
              )}
            </div>
            {!loading && !isSavedScan && (
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onClick={clearFile}
                className="opacity-0 group-hover:opacity-100"
                style={{
                  position: "absolute", top: 10, right: 10, width: 36, height: 36,
                  borderRadius: "50%", background: "rgba(0,0,0,0.55)", color: "white",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  border: "none", cursor: "pointer",
                  transition: "opacity 0.2s, background 0.15s, transform 0.15s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(0,0,0,0.75)"; e.currentTarget.style.transform = "scale(1.06)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(0,0,0,0.55)"; e.currentTarget.style.transform = "scale(1)"; }}
              >
                <X size={14} />
              </motion.button>
            )}
            {!result && (
              <div style={{
                position: "absolute", bottom: 0, left: 0, right: 0, padding: "14px 18px",
                background: "linear-gradient(to top, rgba(0,0,0,0.6), transparent)",
                borderRadius: "0 0 16px 16px", display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginRight: 12 }}>
                  {file?.name || "Scan"}
                </span>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.96 }}
                  transition={{ type: "spring", duration: 0.3, bounce: 0 }}
                  onClick={handleAnalyze}
                  disabled={loading}
                  style={{
                    display: "flex", alignItems: "center", gap: 6, padding: "8px 18px",
                    borderRadius: 8, fontSize: 13, fontWeight: 500, border: "none",
                    cursor: loading ? "default" : "pointer",
                    transition: "background 0.15s, color 0.15s",
                    background: loading ? "rgba(255,255,255,0.2)" : "var(--color-leaf)",
                    color: loading ? "rgba(255,255,255,0.6)" : "white", flexShrink: 0,
                  }}
                >
                  {loading ? (<><Loader2 size={14} className="animate-spin" /> {LOADING_MESSAGES[loadingMsg]}</>) : t("analyze.analyze")}
                </motion.button>
              </div>
            )}
          </motion.div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.currentTarget.value = "";
          }}
        />
      </div>

      {/* Settings toolbar — hidden when viewing saved result (no file) */}
      {(file || !result) && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", marginBottom: 20, flexWrap: "wrap" }}>
          {isMobile ? (
            <button
              style={toolbarBtnStyle(modelDrawerOpen)}
              onClick={() => {
                setOpenPopover(null);
                setModelDrawerOpen(true);
              }}
            >
              <Layers size={13} />
              {currentModelLabel}
            </button>
          ) : (
            <SelectPrimitive.Root value={selectedModel} onValueChange={setSelectedModel}>
              <SelectPrimitive.Trigger style={toolbarBtnStyle()}>
                <Layers size={13} />
                <SelectPrimitive.Value>{currentModelLabel}</SelectPrimitive.Value>
              </SelectPrimitive.Trigger>
              <SelectPrimitive.Portal>
                <SelectPrimitive.Content
                  style={{
                    background: "var(--color-surface)",
                    border: "1px solid var(--border-emphasis)",
                    borderRadius: 10,
                    boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
                    overflow: "hidden",
                    zIndex: 100,
                    minWidth: 180,
                  }}
                  position="popper"
                  sideOffset={6}
                  side="bottom"
                  align="start"
                >
                  <SelectPrimitive.Viewport style={{ padding: 4 }}>
                    {modelOptions.map(opt => (
                      <SelectPrimitive.Item
                        key={opt.value}
                        value={opt.value}
                        style={{
                          padding: "7px 12px",
                          fontSize: 13,
                          color: "var(--color-ink)",
                          borderRadius: 6,
                          cursor: "pointer",
                          outline: "none",
                          transition: "background 0.1s",
                        }}
                        className="data-[highlighted]:bg-leaf-subtle"
                      >
                        <SelectPrimitive.ItemText>{opt.label}</SelectPrimitive.ItemText>
                      </SelectPrimitive.Item>
                    ))}
                  </SelectPrimitive.Viewport>
                </SelectPrimitive.Content>
              </SelectPrimitive.Portal>
            </SelectPrimitive.Root>
          )}

          <div style={{ position: "relative" }}>
            <button
              style={toolbarBtnStyle(openPopover === "conf")}
              onClick={() => setOpenPopover(openPopover === "conf" ? null : "conf")}
            >
              <Gauge size={13} />
              <span style={{ fontVariantNumeric: "tabular-nums" }}>{Math.round(conf * 100)}%</span>
            </button>
            {openPopover === "conf" && (
              <>
                <div style={{ position: "fixed", inset: 0, zIndex: 40 }} onClick={() => setOpenPopover(null)} />
                <div style={{
                  position: "absolute",
                  top: "calc(100% + 6px)",
                  left: 0,
                  background: "var(--color-surface)",
                  border: "1px solid var(--border-emphasis)",
                  borderRadius: 10,
                  boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
                  padding: 16,
                  zIndex: 50,
                  width: 220,
                }}>
                  <div style={{ fontSize: 11, fontWeight: 500, color: "var(--color-ink-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10, fontFamily: "var(--font-display)" }}>
                    {t("analyze.confidenceThreshold")}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <SliderPrimitive.Root
                      value={[conf]}
                      onValueChange={([v]) => setConf(v)}
                      min={0.05}
                      max={0.95}
                      step={0.05}
                      style={{ position: "relative", display: "flex", alignItems: "center", flex: 1, height: 20, userSelect: "none", touchAction: "none" }}
                    >
                      <SliderPrimitive.Track style={{ position: "relative", height: 3, width: "100%", borderRadius: 9999, background: "var(--color-surface-inset)", flexGrow: 1 }}>
                        <SliderPrimitive.Range style={{ position: "absolute", height: "100%", borderRadius: 9999, background: "var(--color-leaf)" }} />
                      </SliderPrimitive.Track>
                      <SliderPrimitive.Thumb style={{ display: "block", width: 16, height: 16, borderRadius: "50%", background: "white", border: "2px solid var(--color-leaf)", boxShadow: "0 1px 3px rgba(0,0,0,0.12)", cursor: "pointer", outline: "none" }} />
                    </SliderPrimitive.Root>
                    <span style={{ fontSize: 13, fontWeight: 500, color: "var(--color-ink)", fontFamily: "var(--font-body)", minWidth: 36, textAlign: "right" }}>
                      {Math.round(conf * 100)}%
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>

          <button
            onClick={() => setToothAssign(!toothAssign)}
            style={toolbarBtnStyle(toothAssign)}
            title={t("analyze.toothAssignment")}
          >
            <Waypoints size={13} />
            {t("analyze.tooth")}
          </button>

          {file && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.96 }}
              transition={{ type: "spring", duration: 0.3, bounce: 0 }}
              onClick={handleAnalyze}
              disabled={loading}
              style={{
                ...toolbarBtnStyle(false),
                background: loading ? "var(--color-surface-inset)" : "var(--color-leaf)",
                color: loading ? "var(--color-ink-tertiary)" : "white",
                border: "none",
                fontWeight: 600,
              }}
            >
              {loading ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  {LOADING_MESSAGES[loadingMsg]}
                </>
              ) : result ? t("analyze.analyzeAgain") : t("analyze.analyze")}
            </motion.button>
          )}
        </div>
      )}

      <AnimatePresence>
        {isMobile && modelDrawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 60 }}
              onClick={() => setModelDrawerOpen(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 280, damping: 32 }}
              style={{
                position: "fixed",
                bottom: 0,
                left: 0,
                right: 0,
                background: "var(--color-surface)",
                borderRadius: "16px 16px 0 0",
                maxHeight: "70vh",
                overflowY: "auto",
                zIndex: 61,
                paddingBottom: "env(safe-area-inset-bottom, 0px)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 4px" }}>
                <div style={{ width: 36, height: 4, borderRadius: 2, background: "var(--color-ink-ghost)" }} />
              </div>
              <div style={{ padding: "8px 16px 16px" }}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 500, color: "var(--color-ink)", marginBottom: 10 }}>
                  {t("analyze.modelsTitle", { defaultValue: "Modele" })}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {modelOptions.map((opt) => {
                    const active = opt.value === selectedModel;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => {
                          setSelectedModel(opt.value);
                          setModelDrawerOpen(false);
                        }}
                        style={{
                          width: "100%",
                          textAlign: "left",
                          border: "none",
                          borderRadius: 8,
                          padding: "10px 12px",
                          cursor: "pointer",
                          background: active ? "var(--color-leaf-subtle)" : "transparent",
                          color: active ? "var(--color-leaf-text)" : "var(--color-ink)",
                          fontSize: 14,
                          fontWeight: active ? 600 : 500,
                          fontFamily: "var(--font-body)",
                        }}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Error */}
      {error && (
        <div style={{ color: "var(--color-high)", fontWeight: 500, fontSize: 13, marginBottom: 12, width: "100%" }}>
          {error}
        </div>
      )}

      {/* Results — findings table with polished wrapper */}
      {result && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          style={{ width: "100%" }}
        >
          {result.detections.length > 0 ? (
            <div>
              <div style={{
                fontSize: 11, fontWeight: 500, color: "var(--color-ink-tertiary)",
                textTransform: "uppercase", letterSpacing: "0.04em",
                fontFamily: "var(--font-body)", marginBottom: 10,
              }}>
                Detailed Findings
              </div>
              <FindingsTable detections={result.detections} />
            </div>
          ) : (
            <div style={{
              background: "var(--color-surface)",
              borderRadius: 14,
              padding: "32px 24px",
              textAlign: "center",
              boxShadow: "0 0 0 1px rgba(45, 42, 36, 0.06), 0 1px 2px rgba(0,0,0,0.03)",
            }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>&#10003;</div>
              <div style={{ fontSize: 15, fontWeight: 500, color: "var(--color-ink)", fontFamily: "var(--font-body)" }}>
                No findings detected
              </div>
              <div style={{ fontSize: 13, color: "var(--color-ink-tertiary)", marginTop: 4, fontFamily: "var(--font-body)" }}>
                The analysis did not identify any notable pathology in this radiograph.
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* HIPAA footer on result page */}
      {result && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            fontSize: 11, color: "var(--color-ink-ghost)",
            marginTop: 32, paddingBottom: 16,
          }}
        >
          <Shield size={12} />
          {t("analyze.aiDisclaimer", { defaultValue: "Suport AI — nu înlocuiește diagnosticul clinic" })}
        </motion.div>
      )}
    </div>
  );
}
