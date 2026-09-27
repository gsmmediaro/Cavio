import { useEffect, useRef, useState, useCallback } from "react";
import { Upload, X, ArrowUp, Pencil, ArrowLeft, Download } from "lucide-react";
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
import { Tabs, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Badge } from "../components/ui/badge";
import { cn } from "../lib/utils";
import { toast } from "sonner";
import {
  AnalyzingIndicator,
  AnalyzeResultSkeleton,
  ChatAssistantBlock,
  ChatUserBubble,
  ErrorBanner,
} from "../components/chat/notra-chat-states";

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
  const [modality, setModality] = useState<"Panoramic" | "Bitewing">("Panoramic");
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
    if (!models.length) return;
    const wantBite = modality === "Bitewing";
    const match = models.find((m) => {
      const raw = `${m.name} ${m.path}`.toLowerCase();
      const isBite = raw.includes("bite");
      return wantBite ? isBite : (raw.includes("pano_gpu2") || raw.includes("pano_caries_only_gpu2") || !isBite);
    });
    const next = match?.path || models[0].path;
    if (next !== selectedModel) setSelectedModel(next);
  }, [models, modality]);

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
        modality,
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
      toast.error(msg || t("analyze.errors.analysisFailed"), { description: "Cavio could not finish this scan." });
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

        {/* Notra-style chat composer */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.25, ease: "easeOut" }}
          className="mb-4 w-full max-w-[680px]"
        >
          <div
            className={cn(
              "overflow-hidden rounded-2xl border border-border bg-background shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-[box-shadow,border-color]",
              inputFocused || dragOver ? "border-foreground/20 shadow-[0_0_0_1px_rgba(45,42,36,0.12),0_6px_16px_rgba(0,0,0,0.04)]" : "",
            )}
            onClick={() => patientInputRef.current?.focus()}
          >
            {(file && preview) ? (
              <div className="flex items-center gap-2 border-b border-border/60 px-3 pt-3">
                <div className="relative size-14 overflow-hidden rounded-lg border border-border">
                  <img src={preview} alt="Preview" className="size-full object-cover" />
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
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-foreground">{file.name}</div>
                  <div className="text-xs text-muted-foreground">{modality} · ready to analyze</div>
                </div>
              </div>
            ) : null}

            <div className="flex items-end gap-2 px-3 pt-3">
              <Input
                ref={patientInputRef}
                type="text"
                placeholder={t("analyze.home.inputPlaceholder")}
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (file) void handleAnalyze();
                    else inputRef.current?.click();
                  }
                }}
                className="h-auto flex-1 rounded-none border-0 bg-transparent px-1 py-2 text-base shadow-none focus-visible:ring-0 md:text-base"
              />
            </div>

            <div className="flex items-center gap-2 px-2.5 pb-2.5 pt-1">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 gap-1.5 px-2 text-muted-foreground"
                onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
              >
                <Upload size={14} />
                <span className="text-xs">{file ? "Replace" : "Attach"}</span>
              </Button>

              <Tabs
                value={modality}
                onValueChange={(v) => setModality(v as "Panoramic" | "Bitewing")}
              >
                <TabsList variant="default" className="h-7">
                  <TabsTrigger value="Panoramic" className="px-2.5 text-xs">Panoramic</TabsTrigger>
                  <TabsTrigger value="Bitewing" className="px-2.5 text-xs">Bitewing</TabsTrigger>
                </TabsList>
              </Tabs>

              <Button
                type="button"
                size="icon"
                className={cn(
                  "ml-auto size-7 shrink-0 rounded-full",
                  file ? "bg-foreground text-background hover:bg-foreground/90" : "bg-muted text-muted-foreground",
                )}
                disabled={!file || loading}
                onClick={(e) => {
                  e.stopPropagation();
                  if (file) void handleAnalyze();
                }}
                aria-label={file ? t("analyze.analyze") : t("analyze.home.getStarted")}
              >
                <ArrowUp size={14} />
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Error banner (Notra Alert) */}
        {error && (
          <div className="mt-3 w-full max-w-[680px]">
            <ErrorBanner title="Analysis issue" description={error} />
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

  /* ───────── LOADING / STREAMING STATE (Notra shimmer) ───────── */
  if (loading && !result) {
    return (
      <div className="mx-auto flex w-full max-w-[800px] flex-1 flex-col px-4 pb-8 pt-8 md:px-8 md:pt-12">
        {(file && preview) || patientName ? (
          <div className="mb-6">
            <ChatUserBubble>
              <div className="font-medium">{patientName || (file?.name ?? "Scan")}</div>
              <div className="mt-1 text-xs text-muted-foreground">{modality}</div>
              {preview ? (
                <div className="mt-3 overflow-hidden rounded-xl border border-border/50">
                  <img src={preview} alt="" className="max-h-36 w-full object-cover" />
                </div>
              ) : null}
            </ChatUserBubble>
          </div>
        ) : null}
        <ChatAssistantBlock
          reasoning={<AnalyzingIndicator label={t("analyze.analyzing", { defaultValue: "Analyzing scan…" })} />}
        >
          <AnalyzeResultSkeleton />
        </ChatAssistantBlock>
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
      <div className="mx-auto flex w-full max-w-[800px] flex-1 flex-col px-4 pb-8 pt-6 md:px-8 md:pt-10">
        <div className="mb-5 flex items-center gap-2">
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
        </div>

        {/* Chat thread: user upload bubble */}
        <div className="mb-6">
          <ChatUserBubble>
            <div className="mb-2 flex items-center gap-2">
              <div className="relative">
                <input
                  type="text"
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  onBlur={handleNameBlur}
                  placeholder={t("analyze.unnamedPatient")}
                  className="bg-transparent font-display text-base outline-none md:text-lg"
                  style={{
                    fontFamily: "var(--font-display)",
                    width: `${Math.max((patientName || t("analyze.unnamedPatient")).length, 10)}ch`,
                    color: "var(--color-ink)",
                  }}
                />
                <Pencil size={12} className="pointer-events-none absolute top-1/2 -right-4 -translate-y-1/2 text-muted-foreground" />
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              {result.modality} · {result.filename || "scan"}
            </div>
            {(preview || result.annotated_image_url) && !resultImageError ? (
              <div className="mt-3 overflow-hidden rounded-xl border border-border/60">
                <img
                  src={preview || result.annotated_image_url}
                  alt="Uploaded scan"
                  className="max-h-40 w-full object-cover"
                />
              </div>
            ) : null}
          </ChatUserBubble>
        </div>

        {/* Assistant analysis message */}
        <ChatAssistantBlock
          className="mb-8 w-full"
          reasoning={
            <div className="flex items-center gap-2">
              <img src="/Cavio Logo.png" alt="Cavio" className="size-6" />
              <span className="text-sm font-medium text-foreground">Cavio</span>
              <Badge
                variant="secondary"
                className="ml-1"
                style={{ color: savedSuspicionColor.text, background: savedSuspicionColor.bg }}
              >
                {result.suspicion_level}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {result.num_detections} {result.num_detections !== 1 ? t("analyze.findings") : t("analyze.finding")}
              </span>
            </div>
          }
        >
          <div className="group relative overflow-hidden rounded-2xl border border-border bg-[#111] shadow-[0_4px_24px_rgba(0,0,0,0.12)]">
            {resultImageError && !preview ? (
              <div className="flex min-h-[260px] flex-col items-center justify-center gap-3 p-8 text-center text-sm text-white/75">
                <span>{t("analyze.savedImageUnavailable")}</span>
                <Button type="button" size="sm" onClick={() => navigate(`/analyze?new=${Date.now()}`)}>
                  {t("analyze.startNewScan")}
                </Button>
              </div>
            ) : (
              <img
                src={resultImageError ? preview! : (result.annotated_image_url || preview || "")}
                alt={`${patientName || t("analyze.unnamedPatient")} ${result.modality}`}
                className="block w-full"
                onError={() => { if (!resultImageError) setResultImageError(true); }}
              />
            )}
            {!resultImageError && (
              <Button
                type="button"
                size="icon"
                variant="secondary"
                onClick={handleDownload}
                aria-label={t("analyze.downloadImage")}
                title={t("analyze.downloadImage")}
                className="cavio-download-btn absolute right-3 bottom-3 z-[2] size-10 rounded-full border-0 bg-black/60 text-white hover:bg-black/80 hover:text-white"
                style={{ touchAction: "manipulation" }}
              >
                <Download size={16} aria-hidden="true" />
              </Button>
            )}
          </div>

          <FindingsTable detections={result.detections || []} />
        </ChatAssistantBlock>

        {/* Sticky-ish follow-up composer cue */}
        <div className="mt-auto rounded-2xl border border-border bg-background p-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">Analyze another panoramic or bitewing.</p>
            <Button size="sm" onClick={() => navigate(`/analyze?new=${Date.now()}`)}>
              {t("analyze.newScan")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  /* No more active state — all results use the unified result view above */
  return null;
}
