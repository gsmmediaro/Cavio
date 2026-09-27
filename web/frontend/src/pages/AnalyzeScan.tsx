import { useEffect, useRef, useState, useCallback } from "react";
import { Upload, X, Send, Pencil, ArrowLeft, Download } from "lucide-react";
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
import FindingsTable from "../components/FindingsTable";
import { useAuth } from "../contexts/AuthContext";
import { useTranslation } from "react-i18next";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";

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
  const [inputFocused, setInputFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const patientInputRef = useRef<HTMLInputElement>(null);

  const firstName = userProfile?.firstName || user?.displayName?.split(" ")[0] || "";

  // Time-aware greeting for warm professional touch
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t("analyze.greeting.morning");
    if (hour < 17) return t("analyze.greeting.afternoon");
    return t("analyze.greeting.evening");
  };

  useEffect(() => {
    getModels()
      .then(setModels)
      .catch(() => {
        setError(t("analyze.errors.noModels"));
      });
  }, []);

  useEffect(() => {
    if (!models.length || selectedModel) return;

    const preferred = models.find((m) => {
      const raw = `${m.name} ${m.path}`.toLowerCase();
      return raw.includes("pano_gpu2") || raw.includes("pano_caries_only_gpu2");
    });

    setSelectedModel(preferred?.path || models[0].path);
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
    // Validate MIME type
    const validTypes = ["image/jpeg", "image/png", "image/bmp", "image/tiff"];
    if (f.type && !validTypes.includes(f.type)) {
      setError("Please upload a valid image file (JPG, PNG, BMP, TIFF).");
      return;
    }
    // Validate the browser can render the image
    const testUrl = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(testUrl);
      setFile(f);
      setResult(null);
      setResultImageError(false);
      setError("");
    };
    img.onerror = () => {
      URL.revokeObjectURL(testUrl);
      setError("This file could not be read as an image.");
    };
    img.src = testUrl;
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
    if (!file || !selectedModel || loading) return;

    // Basic file validation
    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
    if (file.size > MAX_FILE_SIZE) {
      setError(t("analyze.errors.fileTooLarge", { defaultValue: "File is too large (max 50 MB)." }));
      return;
    }
    if (file.size === 0) {
      setError(t("analyze.errors.fileEmpty", { defaultValue: "File is empty." }));
      return;
    }

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
      const res = await analyzeImage(
        file,
        selectedModel,
        conf,
        selectedModel.toLowerCase().includes("bitewing") ? "Bitewing" : "Panoramic",
        toothAssign,
        patientName,
      );

      // Validate the response has usable data
      if (!res || typeof res.suspicion_level !== "string") {
        throw new Error(t("analyze.errors.invalidResponse", { defaultValue: "Invalid response from server." }));
      }

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
      const msg = e?.message || "";
      const status = e?.status as number | undefined;
      if (status === 401) {
        setShowAuthGate(true);
        setError(t("analyze.errors.authRequired", { defaultValue: "Please sign in to run a scan." }));
      } else if (status === 402 || /insufficient credits/i.test(msg)) {
        setError(t("analyze.errors.noCredits", { defaultValue: "No credits left. Buy a credit pack in Settings." }));
      } else if (status === 429 || /rate limit/i.test(msg)) {
        setError(t("analyze.errors.rateLimited", { defaultValue: "Too many requests. Please wait and try again." }));
      } else if (status === 413 || /too large/i.test(msg)) {
        setError(t("analyze.errors.fileTooLarge", { defaultValue: "File is too large." }));
      } else if (msg.includes("Could not decode image")) {
        setError(t("analyze.errors.invalidImage", { defaultValue: "Could not process this file. Please upload a valid dental X-ray." }));
      } else if (msg.includes("timed out") || msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
        setError(t("analyze.errors.network", { defaultValue: "Network error — check your connection and try again." }));
      } else {
        setError(msg || t("analyze.errors.analysisFailed"));
      }
    } finally {
      setLoading(false);
    }
  };

  const isMobile = window.innerWidth <= 768;

  const isWelcome = !result && !loading;

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
            {file && preview ? (
              <motion.div
                key="thumb"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: [0.42, 0, 1, 1] }}
                style={{ padding: "8px 0 8px 12px", display: "flex", alignItems: "center" }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ width: 48, height: 48, borderRadius: 10, overflow: "hidden", flexShrink: 0, position: "relative" }}>
                  <img src={preview} alt="Preview" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  <Button
                    type="button"
                    size="icon-xs"
                    variant="secondary"
                    className="absolute top-0.5 right-0.5 size-[18px] rounded-full border-0 bg-black/55 p-0 text-white hover:bg-black/70 hover:text-white"
                    onClick={(e) => { e.stopPropagation(); clearFile(); }}
                  >
                    <X size={10} />
                  </Button>
                </div>
              </motion.div>
            ) : (
              <div style={{ padding: "20px 0 20px 20px", display: "flex", alignItems: "center" }}>
                <Upload size={20} strokeWidth={1.5} style={{ color: "var(--color-ink-ghost)" }} />
              </div>
            )}
            <Input
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
              className="h-auto flex-1 rounded-none border-0 bg-transparent px-3.5 py-5 text-base shadow-none focus-visible:ring-0 md:text-base"
            />
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.96 }}
              transition={{ type: "spring", duration: 0.3, bounce: 0 }}
              onClick={(e) => {
                e.stopPropagation();
                if (file) handleAnalyze();
                else inputRef.current?.click();
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                padding: "12px 22px",
                margin: "8px 8px 8px 0",
                borderRadius: 12,
                border: "none",
                background: file ? "var(--color-leaf)" : "var(--color-surface-inset)",
                color: file ? "white" : "var(--color-ink-secondary)",
                fontSize: 14,
                fontWeight: 500,
                cursor: "pointer",
                fontFamily: "var(--font-body)",
                whiteSpace: "nowrap",
                transition: "background 0.15s, color 0.15s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = file ? "var(--color-leaf-dark, #1a5c3a)" : "var(--color-ink)"; e.currentTarget.style.color = "white"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = file ? "var(--color-leaf)" : "var(--color-surface-inset)"; e.currentTarget.style.color = file ? "white" : "var(--color-ink-secondary)"; }}
            >
              {file ? t("analyze.analyze") : t("analyze.home.getStarted")}
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

  /* ───────── LOADING STATE ───────── */
  if (loading && !result) {
    return (
      <div style={{
        flex: 1, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        minHeight: "calc(100vh - 200px)",
      }}>
        <AnimatePresence>
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.42, 0, 1, 1] }}
          >
            <motion.img
              src="/Cavio Logo.png"
              alt="Loading"
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              style={{ width: 56, height: 56 }}
            />
          </motion.div>
        </AnimatePresence>
      </div>
    );
  }

  /* ───────── RESULT VIEW (saved or fresh scan) ───────── */
  if (result) {
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
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-auto gap-1.5 px-0 text-muted-foreground hover:bg-transparent hover:text-foreground"
            onClick={() => navigate(`/analyze?new=${Date.now()}`)}
          >
            <ArrowLeft size={15} />
            {t("analyze.newScan")}
          </Button>
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
            {resultImageError && !preview ? (
              <div style={{
                width: "100%", minHeight: 260, display: "flex",
                flexDirection: "column", alignItems: "center", justifyContent: "center",
                color: "rgba(255,255,255,0.75)", fontSize: 14, padding: 32, textAlign: "center", gap: 12,
              }}>
                <span>{t("analyze.savedImageUnavailable")}</span>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => navigate(`/analyze?new=${Date.now()}`)}
                >
                  {t("analyze.startNewScan")}
                </Button>
              </div>
            ) : (
              <img
                src={resultImageError ? preview! : (result.annotated_image_url || preview || "")}
                alt={`${patientName || t("analyze.unnamedPatient")} ${result.modality}`}
                style={{ width: "100%", display: "block" }}
                onError={() => { if (!resultImageError) setResultImageError(true); }}
              />
            )}
          </div>

          {/* Download — always reachable via keyboard/touch; hover polish on pointer devices */}
          {!resultImageError && (
            <Button
              type="button"
              size="icon"
              variant="secondary"
              onClick={handleDownload}
              aria-label={t("analyze.downloadImage")}
              title={t("analyze.downloadImage")}
              className="cavio-download-btn absolute bottom-3 right-3 z-[2] size-10 rounded-full border-0 bg-black/60 text-white hover:bg-black/80 hover:text-white"
              style={{ touchAction: "manipulation" }}
            >
              <Download size={16} aria-hidden="true" />
            </Button>
          )}
        </motion.div>

        {/* Findings table (incl. empty / zero detections) */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.14 }}
          style={{ width: "100%", marginTop: 20 }}
        >
          <FindingsTable detections={result.detections || []} />
        </motion.div>
      </div>
    );
  }

  /* No more active state — all results use the unified result view above */
  return null;
}
