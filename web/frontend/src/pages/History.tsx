import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { MessageCircle, MoreVertical, Send, FileText, Trash2 } from "lucide-react";
import {
  deleteScanFromFirestore,
  getHistoryFromFirestore,
  getPatientScansFromFirestore,
  type ScanRecord,
} from "../api/client";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";

function makeTimeAgo(t: (key: string, opts?: Record<string, unknown>) => string) {
  return function timeAgo(timestamp: string | number): string {
    const ms = typeof timestamp === "string" ? new Date(timestamp).getTime() : timestamp;
    const seconds = Math.floor((Date.now() - ms) / 1000);
    if (seconds < 60) return t("history.timeAgo.justNow");
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return t("history.timeAgo.mAgo", { n: minutes });
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return t("history.timeAgo.hAgo", { n: hours });
    const days = Math.floor(hours / 24);
    if (days < 7) return t("history.timeAgo.dAgo", { n: days });
    if (days < 30) return t("history.timeAgo.wAgo", { n: Math.floor(days / 7) });
    const months = Math.floor(days / 30);
    if (days < 365) return months === 1
      ? t("history.timeAgo.monthAgo", { n: months })
      : t("history.timeAgo.monthsAgo", { n: months });
    return t("history.timeAgo.yAgo", { n: Math.floor(days / 365) });
  };
}

function suspicionColor(s: string) {
  switch (s) {
    case "HIGH": return "var(--color-high)";
    case "MODERATE": return "var(--color-moderate)";
    case "REVIEW": return "var(--color-review)";
    default: return "var(--color-low)";
  }
}

export default function History() {
  const { t } = useTranslation();
  const timeAgo = makeTimeAgo(t);
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [records, setRecords] = useState<ScanRecord[]>([]);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ScanRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const selectedPatient = searchParams.get("patient")?.trim() || "";
  const isMobile = window.innerWidth <= 768;

  const loadRecords = () => {
    if (!user) return;
    if (selectedPatient) {
      getPatientScansFromFirestore(user.uid, selectedPatient).then(setRecords);
      return;
    }
    getHistoryFromFirestore(user.uid, 100).then(setRecords);
  };

  useEffect(loadRecords, [user, selectedPatient]);

  // Close menu on click outside
  useEffect(() => {
    if (!menuOpenId) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenId(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpenId]);

  const handleNewScan = () => {
    navigate(`/analyze?new=${Date.now()}`);
  };

  const handleOpen = (r: ScanRecord) => {
    setMenuOpenId(null);
    if (r.patient_name) {
      navigate(`/analyze?patient=${encodeURIComponent(r.patient_name)}`);
    }
  };

  const handleDelete = (r: ScanRecord) => {
    setMenuOpenId(null);
    setDeleteTarget(r);
  };

  const confirmDelete = async () => {
    if (!user || !deleteTarget) return;
    setDeleting(true);
    await deleteScanFromFirestore(user.uid, deleteTarget.id);
    setRecords((prev) => prev.filter((rec) => rec.id !== deleteTarget.id));
    window.dispatchEvent(new Event("cavio:patients-updated"));
    setDeleting(false);
    setDeleteTarget(null);
    toast.success(t("history.toast.deleted"));
  };

  return (
    <div style={{
      flex: 1,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      padding: isMobile ? "32px 20px" : "60px 32px",
      maxWidth: 680,
      width: "100%",
      margin: "0 auto",
    }}>
      {/* Header */}
      <h1 style={{
        fontFamily: "var(--font-display)",
        fontSize: isMobile ? 32 : 42,
        fontWeight: 400,
        color: "var(--color-ink)",
        marginBottom: 8,
        textAlign: "left",
        width: "100%",
        textWrap: "balance",
      }}>
        {t("history.title")}
      </h1>
      <p style={{
        fontSize: 15,
        color: "var(--color-ink-secondary)",
        marginBottom: 32,
        textAlign: "left",
        width: "100%",
      }}>
        {selectedPatient
          ? <>{t("history.subtitlePatient")} <strong style={{ color: "var(--color-ink)" }}>{selectedPatient}</strong></>
          : t("history.subtitle")
        }
      </p>

      {/* New scan input */}
      <div
        onClick={handleNewScan}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          background: "var(--color-surface)",
          borderRadius: 14,
          boxShadow: "0 0 0 1px rgba(45, 42, 36, 0.06), 0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)",
          cursor: "pointer",
          overflow: "hidden",
          marginBottom: 8,
          transition: "box-shadow 0.2s",
        }}
        onMouseEnter={(e) => e.currentTarget.style.boxShadow = "0 0 0 1px rgba(45, 42, 36, 0.08), 0 2px 8px rgba(0,0,0,0.06)"}
        onMouseLeave={(e) => e.currentTarget.style.boxShadow = "0 0 0 1px rgba(45, 42, 36, 0.06), 0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)"}
      >
        <div style={{
          flex: 1,
          padding: "16px 20px",
          fontSize: 15,
          color: "var(--color-ink-ghost)",
          fontFamily: "var(--font-body)",
        }}>
          {t("history.startNewScan")}
        </div>
        <div style={{
          padding: "16px 18px",
          color: "var(--color-ink-ghost)",
          display: "flex",
          alignItems: "center",
        }}>
          <Send size={16} />
        </div>
      </div>

      {/* Disclaimer */}
      <p style={{
        fontSize: 12,
        color: "var(--color-ink-tertiary)",
        textAlign: "center",
        marginBottom: 32,
        lineHeight: 1.5,
      }}>
        {t("history.disclaimer")}
      </p>

      {/* Previous scans */}
      {records.length > 0 && (
        <div style={{ width: "100%" }}>
          <div style={{
            fontSize: 12,
            fontWeight: 500,
            color: "var(--color-ink-tertiary)",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            padding: "0 0 14px",
            marginBottom: 0,
          }}>
            {t("history.previous")}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {records.map((r) => (
            <div
              key={r.id}
              style={{ position: "relative" }}
            >
              <button
                onClick={() => handleOpen(r)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "14px 16px",
                  width: "100%",
                  textAlign: "left",
                  border: "none",
                  borderRadius: 14,
                  cursor: r.patient_name ? "pointer" : "default",
                  transition: "background 0.12s, box-shadow 0.12s",
                  color: "var(--color-ink)",
                  fontFamily: "var(--font-body)",
                  fontSize: 14,
                  background: "var(--color-surface)",
                  boxShadow: "0 0 0 1px rgba(45, 42, 36, 0.06), 0 1px 2px rgba(0,0,0,0.03)",
                }}
                onMouseEnter={(e) => { if (r.patient_name) e.currentTarget.style.boxShadow = "0 0 0 1px rgba(45, 42, 36, 0.1), 0 2px 6px rgba(0,0,0,0.05)"; }}
                onMouseLeave={(e) => e.currentTarget.style.boxShadow = "0 0 0 1px rgba(45, 42, 36, 0.06), 0 1px 2px rgba(0,0,0,0.03)"}
              >
                {/* Icon */}
                <div style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: "rgba(45, 122, 79, 0.06)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}>
                  <MessageCircle size={18} style={{ color: "var(--color-leaf)" }} />
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r.patient_name || r.filename}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--color-ink-tertiary)", marginTop: 2, display: "flex", alignItems: "center", gap: 8 }}>
                    <span>{timeAgo(r.timestamp)}</span>
                    <span style={{ width: 3, height: 3, borderRadius: "50%", background: "var(--color-ink-ghost)", display: "inline-block" }} />
                    <span style={{ color: suspicionColor(r.suspicion) }}>{r.suspicion}</span>
                  </div>
                </div>

                {/* More button */}
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpenId(menuOpenId === r.id ? null : r.id);
                  }}
                  style={{
                    padding: 6,
                    color: "var(--color-ink-ghost)",
                    flexShrink: 0,
                    cursor: "pointer",
                    borderRadius: 6,
                    transition: "background 0.12s, color 0.12s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "var(--color-surface-inset)"; e.currentTarget.style.color = "var(--color-ink-secondary)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--color-ink-ghost)"; }}
                >
                  <MoreVertical size={16} />
                </div>
              </button>

              {/* Context menu */}
              {menuOpenId === r.id && (
                <div
                  ref={menuRef}
                  style={{
                    position: "absolute",
                    top: 8,
                    right: 36,
                    background: "var(--color-surface)",
                    borderRadius: 12,
                    boxShadow: "0 4px 24px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.04)",
                    padding: 4,
                    zIndex: 20,
                    minWidth: 140,
                  }}
                >
                  <button
                    onClick={() => handleOpen(r)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "9px 14px",
                      width: "100%",
                      border: "none",
                      borderRadius: 8,
                      cursor: "pointer",
                      background: "transparent",
                      color: "var(--color-ink)",
                      fontSize: 14,
                      fontFamily: "var(--font-body)",
                      fontWeight: 500,
                      transition: "background 0.1s",
                      textAlign: "left",
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "var(--color-surface-hover)"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                  >
                    <FileText size={15} style={{ color: "var(--color-ink-secondary)" }} />
                    {t("history.menu.open")}
                  </button>
                  <button
                    onClick={() => handleDelete(r)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "9px 14px",
                      width: "100%",
                      border: "none",
                      borderRadius: 8,
                      cursor: "pointer",
                      background: "transparent",
                      color: "var(--color-high)",
                      fontSize: 14,
                      fontFamily: "var(--font-body)",
                      fontWeight: 500,
                      transition: "background 0.1s",
                      textAlign: "left",
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "var(--color-high-bg)"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                  >
                    <Trash2 size={15} />
                    {t("history.menu.delete")}
                  </button>
                </div>
              )}
            </div>
          ))}
          </div>
        </div>
      )}

      {records.length === 0 && (
        <div style={{
          textAlign: "center",
          padding: "48px 20px",
          color: "var(--color-ink-tertiary)",
        }}>
          <MessageCircle size={32} strokeWidth={1.5} style={{ color: "var(--color-ink-ghost)", marginBottom: 12 }} />
          <div style={{ fontSize: 15, fontWeight: 500, color: "var(--color-ink-secondary)" }}>
            {t("history.noScans.title")}
          </div>
          <div style={{ fontSize: 13, marginTop: 4 }}>
            {t("history.noScans.subtitle")}
          </div>
        </div>
      )}

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("history.delete.title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("history.delete.message")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{t("history.delete.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleting ? t("history.delete.deleting") : t("history.delete.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
