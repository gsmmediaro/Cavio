import { useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  Plus,
  Users,
  LogOut,
  Menu,
  X,
  ArrowLeft,
  MessageCircle,
  HelpCircle,
  Settings,
  CornerDownRight,
  PanelLeft,
} from "lucide-react";
import { getPatientsFromFirestore, type PatientSummary } from "../api/client";
import { useAuth } from "../contexts/AuthContext";
import { useTranslation } from "react-i18next";

function useIsMobile(breakpoint = 768) {
  const [mobile, setMobile] = useState(() => window.innerWidth <= breakpoint);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const handler = (e: MediaQueryListEvent) => setMobile(e.matches);
    mq.addEventListener("change", handler);
    setMobile(mq.matches);
    return () => mq.removeEventListener("change", handler);
  }, [breakpoint]);
  return mobile;
}

function suspicionDotColor(s: string): string {
  switch (s) {
    case "HIGH": return "var(--color-high)";
    case "MODERATE": return "var(--color-moderate)";
    case "REVIEW": return "var(--color-review)";
    default: return "var(--color-low)";
  }
}

function initials(name: string): string {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

interface Props {
  children: ReactNode;
}

const navItemBase: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "8px 10px",
  borderRadius: 8,
  fontSize: 13.5,
  fontWeight: 500,
  transition: "background 0.12s, color 0.12s",
  textDecoration: "none",
  cursor: "pointer",
  border: "none",
  width: "100%",
  textAlign: "left",
  fontFamily: "var(--font-body)",
  background: "transparent",
  color: "var(--color-ink)",
};

export default function Layout({ children }: Props) {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { user, userProfile, logout, setShowAuthGate } = useAuth();
  const [patients, setPatients] = useState<PatientSummary[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerView, setDrawerView] = useState<"menu" | "patients">("menu");
  const [mobileProfileOpen, setMobileProfileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const refreshPatients = useCallback(() => {
    if (!user) return;
    getPatientsFromFirestore(user.uid).then(setPatients);
  }, [user]);

  useEffect(() => {
    if (user) refreshPatients();
  }, [user, refreshPatients]);

  useEffect(() => {
    const handler = () => refreshPatients();
    window.addEventListener("cavio:patients-updated", handler);
    return () => window.removeEventListener("cavio:patients-updated", handler);
  }, [refreshPatients]);

  const handleNewScanClick = (event?: React.MouseEvent) => {
    event?.preventDefault();
    setSelectedPatient(null);
    navigate(`/analyze?new=${Date.now()}`);
    if (isMobile) {
      setDrawerOpen(false);
      setDrawerView("menu");
    }
  };

  const handlePatientClick = (name: string) => {
    setSelectedPatient(name);
    navigate(`/analyze?patient=${encodeURIComponent(name)}`);
    if (isMobile) {
      setDrawerOpen(false);
      setDrawerView("menu");
    }
  };

  useEffect(() => {
    if (isMobile) {
      setDrawerOpen(false);
      setDrawerView("menu");
    }
  }, [location.pathname, isMobile]);

  useEffect(() => {
    if (!drawerOpen) setMobileProfileOpen(false);
  }, [drawerOpen]);

  const displayName = userProfile
    ? `${userProfile.firstName} ${userProfile.lastName}`.trim()
    : user?.displayName || user?.email || "";
  const userInitials = displayName
    ? initials(displayName)
    : (user?.email?.[0]?.toUpperCase() || "?");

  const sidebarWidth = sidebarCollapsed ? 64 : 248;

  /* ───────────────────── LOGGED-OUT LAYOUT ───────────────────── */
  if (!user) {
    return (
      <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "var(--color-bg)" }}>
        <header style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: isMobile ? "12px 16px" : "12px 24px",
          background: "var(--color-surface)",
          borderBottom: "1px solid var(--border-color)",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}>
          <img src="/Cavio Header.png" alt="Cavio" style={{ height: 28 }} />
          <button
            type="button"
            onClick={() => setShowAuthGate(true)}
            className="cavio-btn-primary"
            style={{ padding: "8px 18px", fontSize: 13 }}
          >
            {t("layout.nav.logIn")}
          </button>
        </header>
        <div style={{ flex: 1 }}>{children}</div>
      </div>
    );
  }

  /* ───────────────────── SIDEBAR CONTENT (shared) ───────────────────── */
  const SidebarBody = ({ compact = false, onNavigate }: { compact?: boolean; onNavigate?: () => void }) => (
    <>
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: compact ? "center" : "space-between",
        padding: compact ? "16px 8px 12px" : "16px 14px 12px",
        gap: 8,
      }}>
        {!compact && <img src="/Cavio Header.png" alt="Cavio" style={{ height: 26 }} />}
        {compact && <img src="/Cavio Logo.png" alt="Cavio" style={{ width: 28, height: 28 }} />}
      </div>

      <nav style={{ display: "flex", flexDirection: "column", gap: 2, padding: compact ? "0 8px" : "0 10px" }}>
        <button
          type="button"
          onClick={(e) => { handleNewScanClick(e); onNavigate?.(); }}
          style={{
            ...navItemBase,
            color: "var(--color-leaf-text)",
            background: "var(--color-leaf-subtle)",
            justifyContent: compact ? "center" : "flex-start",
            gap: compact ? 0 : 10,
          }}
        >
          <div style={{
            width: 20, height: 20, borderRadius: "50%",
            background: "var(--color-leaf)",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <Plus size={11} strokeWidth={3} color="white" />
          </div>
          {!compact && t("layout.nav.newScan")}
        </button>
      </nav>

      {!compact && (
        <div style={{ flex: 1, overflowY: "auto", padding: "0 10px", marginTop: 8 }}>
          <div style={{
            padding: "16px 10px 8px",
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            color: "var(--color-ink-tertiary)",
          }}>
            {t("layout.nav.recentScans")}
          </div>
          {patients.length === 0 ? (
            <div style={{ padding: "12px 10px", color: "var(--color-ink-tertiary)", fontSize: 13 }}>
              {t("layout.patients.noScans")}
            </div>
          ) : (
            <>
              {patients.slice(0, 8).map((p) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => { handlePatientClick(p.name); onNavigate?.(); }}
                  style={{
                    ...navItemBase,
                    background: selectedPatient === p.name ? "var(--color-surface-hover)" : "transparent",
                  }}
                  onMouseEnter={(e) => { if (selectedPatient !== p.name) e.currentTarget.style.background = "var(--color-surface-hover)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = selectedPatient === p.name ? "var(--color-surface-hover)" : "transparent"; }}
                >
                  <MessageCircle size={15} style={{ color: "var(--color-ink-tertiary)", flexShrink: 0 }} />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{p.name}</span>
                  <span style={{
                    width: 7, height: 7, borderRadius: "50%",
                    background: suspicionDotColor(p.worst_suspicion), flexShrink: 0,
                  }} />
                </button>
              ))}
              <button
                type="button"
                onClick={() => { navigate("/history"); onNavigate?.(); }}
                style={{ ...navItemBase, color: "var(--color-ink-secondary)" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "var(--color-surface-hover)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              >
                <CornerDownRight size={15} style={{ color: "var(--color-ink-tertiary)" }} />
                {t("layout.nav.viewAll")}
              </button>
            </>
          )}
        </div>
      )}

      {compact && <div style={{ flex: 1 }} />}

      <div style={{ padding: compact ? "8px" : "8px 10px 14px", display: "flex", flexDirection: "column", gap: 2, borderTop: "1px solid var(--border-color)", marginTop: "auto" }}>
        <button
          type="button"
          style={{ ...navItemBase, justifyContent: compact ? "center" : "flex-start" }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "var(--color-surface-hover)"; e.currentTarget.style.color = "var(--color-leaf)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--color-ink)"; }}
          title={t("layout.nav.helpResources")}
        >
          <HelpCircle size={16} style={{ color: "var(--color-ink-secondary)" }} />
          {!compact && t("layout.nav.helpResources")}
        </button>
        <button
          type="button"
          onClick={() => { navigate("/settings"); onNavigate?.(); }}
          style={{
            ...navItemBase,
            justifyContent: compact ? "center" : "flex-start",
            background: location.pathname === "/settings" ? "var(--color-surface-hover)" : "transparent",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "var(--color-surface-hover)"; e.currentTarget.style.color = "var(--color-leaf)"; }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = location.pathname === "/settings" ? "var(--color-surface-hover)" : "transparent";
            e.currentTarget.style.color = "var(--color-ink)";
          }}
          title={t("layout.nav.settings")}
        >
          <Settings size={16} style={{ color: "var(--color-ink-secondary)" }} />
          {!compact && t("layout.nav.settings")}
        </button>

        {!compact && (
          <div style={{
            padding: "10px 10px 0",
            fontSize: 11,
            lineHeight: 1.5,
            color: "var(--color-ink-tertiary)",
          }}>
            {t("layout.disclaimer")}{" "}
            <a href="/terms" style={{ color: "var(--color-ink-secondary)", textDecoration: "underline" }}>{t("layout.footer.terms")}</a>
            {" "}{t("layout.footer.and")}{" "}
            <a href="/privacy" style={{ color: "var(--color-ink-secondary)", textDecoration: "underline" }}>{t("layout.footer.privacy")}</a>.
          </div>
        )}
      </div>
    </>
  );

  /* ───────────────────── MOBILE LAYOUT ───────────────────── */
  if (isMobile) {
    return (
      <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "var(--color-bg)" }}>
        <header style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
          borderBottom: "1px solid var(--border-color)",
          background: "var(--color-surface)",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              type="button"
              onClick={() => { setDrawerView("menu"); setDrawerOpen(true); refreshPatients(); }}
              aria-label={t("layout.nav.openMenu")}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                background: "none", border: "none", cursor: "pointer", padding: 4,
                color: "var(--color-ink-secondary)", borderRadius: 8,
              }}
            >
              <Menu size={20} />
            </button>
            <img src="/Cavio Header.png" alt="Cavio" style={{ height: 26 }} />
          </div>
          <button
            type="button"
            onClick={() => setProfileOpen((p) => !p)}
            aria-label={displayName || "Profile"}
            style={{
              width: 32, height: 32, borderRadius: "50%", border: "none",
              background: "var(--color-leaf-subtle)", color: "var(--color-leaf-text)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-body)",
            }}
          >
            {userInitials}
          </button>
        </header>

        <div style={{ flex: 1 }}>{children}</div>

        <AnimatePresence>
          {drawerOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                onClick={() => { setDrawerOpen(false); setDrawerView("menu"); }}
                style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 30 }}
              />
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", stiffness: 300, damping: 32 }}
                style={{
                  position: "fixed", bottom: 0, left: 0, right: 0,
                  maxHeight: "82vh",
                  background: "var(--color-surface)",
                  borderRadius: "16px 16px 0 0",
                  zIndex: 35,
                  overflowY: "auto",
                  paddingBottom: "env(safe-area-inset-bottom, 0px)",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 4px" }}>
                  <div style={{ width: 36, height: 4, borderRadius: 2, background: "var(--color-ink-ghost)" }} />
                </div>

                {drawerView === "menu" ? (
                  <div style={{ padding: "8px 12px 20px", display: "flex", flexDirection: "column", minHeight: 320 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, padding: "0 4px" }}>
                      <img src="/Cavio Header.png" alt="Cavio" style={{ height: 26 }} />
                      <button
                        type="button"
                        onClick={() => { setDrawerOpen(false); setDrawerView("menu"); }}
                        aria-label="Close"
                        style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "var(--color-ink-tertiary)" }}
                      >
                        <X size={20} />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={handleNewScanClick}
                      style={{ ...navItemBase, color: "var(--color-leaf-text)", background: "var(--color-leaf-subtle)", marginBottom: 4 }}
                    >
                      <div style={{ width: 18, height: 18, borderRadius: "50%", background: "var(--color-leaf)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Plus size={11} strokeWidth={3} color="white" />
                      </div>
                      {t("layout.nav.newScan")}
                    </button>

                    <button
                      type="button"
                      style={navItemBase}
                      onClick={() => setDrawerView("patients")}
                    >
                      <Users size={16} />
                      <span style={{ flex: 1 }}>{t("layout.nav.recentScans")}</span>
                    </button>

                    <button
                      type="button"
                      style={navItemBase}
                      onClick={() => { setDrawerOpen(false); navigate("/settings"); }}
                    >
                      <Settings size={16} />
                      {t("layout.nav.settings")}
                    </button>

                    <div style={{ marginTop: "auto", paddingTop: 16, borderTop: "1px solid var(--border-color)" }}>
                      {mobileProfileOpen && (
                        <>
                          <div style={{ position: "fixed", inset: 0, zIndex: 40 }} onClick={() => setMobileProfileOpen(false)} />
                          <div style={{
                            position: "relative", zIndex: 41, marginBottom: 8,
                            background: "var(--color-surface)", border: "1px solid var(--border-emphasis)",
                            borderRadius: 10, boxShadow: "var(--shadow-card)", padding: 4,
                          }}>
                            <button
                              type="button"
                              onClick={() => { setDrawerOpen(false); setMobileProfileOpen(false); logout(); }}
                              style={{ ...navItemBase, padding: "8px 12px" }}
                            >
                              <LogOut size={14} />
                              {t("layout.nav.signOut")}
                            </button>
                          </div>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => setMobileProfileOpen((prev) => !prev)}
                        style={{
                          display: "flex", alignItems: "center", gap: 10, width: "100%",
                          padding: "8px 10px", borderRadius: 8, border: "none", cursor: "pointer",
                          background: mobileProfileOpen ? "var(--color-surface-hover)" : "transparent",
                          fontFamily: "var(--font-body)",
                        }}
                      >
                        <div style={{
                          width: 30, height: 30, borderRadius: "50%",
                          background: "var(--color-leaf-subtle)", color: "var(--color-leaf-text)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 12, fontWeight: 600,
                        }}>
                          {userInitials}
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 500, color: "var(--color-ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {displayName || user.email}
                        </span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: "8px 0 24px" }}>
                    <div style={{
                      display: "flex", alignItems: "center", gap: 8,
                      padding: "0 16px 12px", borderBottom: "1px solid var(--border-color)", marginBottom: 8,
                    }}>
                      <button type="button" onClick={() => setDrawerView("menu")} aria-label="Back"
                        style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "var(--color-ink-secondary)", display: "flex" }}>
                        <ArrowLeft size={20} />
                      </button>
                      <span style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 500, flex: 1 }}>{t("layout.nav.patients")}</span>
                      <button type="button" onClick={() => { setDrawerOpen(false); setDrawerView("menu"); }} aria-label="Close"
                        style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "var(--color-ink-tertiary)" }}>
                        <X size={20} />
                      </button>
                    </div>
                    {patients.length === 0 ? (
                      <div style={{ textAlign: "center", padding: "32px 20px", color: "var(--color-ink-tertiary)" }}>
                        <div style={{ fontSize: 13 }}>{t("layout.patients.noPatients")}</div>
                        <div style={{ fontSize: 12, marginTop: 4 }}>{t("layout.patients.scansWillAppear")}</div>
                      </div>
                    ) : (
                      patients.map((p) => (
                        <button
                          key={p.name}
                          type="button"
                          onClick={() => handlePatientClick(p.name)}
                          style={{
                            display: "flex", alignItems: "center", gap: 12,
                            padding: "12px 20px", width: "100%", textAlign: "left",
                            border: "none", cursor: "pointer", color: "var(--color-ink)",
                            fontFamily: "var(--font-body)", fontSize: 14,
                            background: selectedPatient === p.name ? "var(--color-leaf-subtle)" : "transparent",
                          }}
                        >
                          <div style={{
                            width: 36, height: 36, borderRadius: "50%",
                            background: "var(--color-surface-inset)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 13, fontWeight: 600, color: "var(--color-ink-secondary)",
                          }}>
                            {initials(p.name)}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 500 }}>{p.name}</div>
                            <div style={{ fontSize: 12, color: "var(--color-ink-tertiary)" }}>
                              {p.scan_count} {p.scan_count === 1 ? t("layout.patients.scan") : t("layout.patients.scans")}
                            </div>
                          </div>
                          <div style={{ width: 8, height: 8, borderRadius: "50%", background: suspicionDotColor(p.worst_suspicion) }} />
                        </button>
                      ))
                    )}
                  </div>
                )}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    );
  }

  /* ───────────────────── DESKTOP — Notra-like persistent sidebar ───────────────────── */
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--color-bg)" }}>
      <aside
        style={{
          width: sidebarWidth,
          flexShrink: 0,
          background: "var(--color-surface)",
          borderRight: "1px solid var(--border-color)",
          display: "flex",
          flexDirection: "column",
          position: "sticky",
          top: 0,
          height: "100vh",
          transition: "width 0.2s ease",
          zIndex: 20,
        }}
      >
        <SidebarBody compact={sidebarCollapsed} />
      </aside>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <header style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "10px 20px",
          background: "var(--color-surface)",
          borderBottom: "1px solid var(--border-color)",
          position: "sticky",
          top: 0,
          zIndex: 10,
          minHeight: 52,
        }}>
          <button
            type="button"
            onClick={() => setSidebarCollapsed((c) => !c)}
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            style={{
              width: 34, height: 34, borderRadius: 8,
              border: "1px solid var(--border-color)",
              background: "var(--color-surface)",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: "var(--color-ink-secondary)",
            }}
          >
            <PanelLeft size={16} />
          </button>
          <div style={{ flex: 1 }} />
          <div ref={profileRef} style={{ position: "relative" }}>
            <button
              type="button"
              onClick={() => setProfileOpen((prev) => !prev)}
              aria-label={displayName || "Account"}
              style={{
                width: 34, height: 34, borderRadius: "50%", border: "none",
                background: "var(--color-leaf-subtle)", color: "var(--color-leaf-text)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-body)",
              }}
            >
              {userInitials}
            </button>
            {profileOpen && (
              <>
                <div style={{ position: "fixed", inset: 0, zIndex: 50 }} onClick={() => setProfileOpen(false)} />
                <div className="cavio-card" style={{
                  position: "absolute", top: "calc(100% + 8px)", right: 0,
                  padding: 6, minWidth: 180, zIndex: 51,
                }}>
                  <button
                    type="button"
                    onClick={() => { setProfileOpen(false); navigate("/settings"); }}
                    style={{ ...navItemBase, padding: "10px 12px" }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "var(--color-surface-hover)"; e.currentTarget.style.color = "var(--color-leaf)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--color-ink)"; }}
                  >
                    {t("layout.nav.accountSettings")}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setProfileOpen(false); logout(); }}
                    style={{ ...navItemBase, padding: "10px 12px" }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "var(--color-surface-hover)"; e.currentTarget.style.color = "var(--color-leaf)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--color-ink)"; }}
                  >
                    <LogOut size={14} />
                    {t("layout.nav.logout")}
                  </button>
                </div>
              </>
            )}
          </div>
        </header>

        <main style={{ flex: 1, minWidth: 0 }}>{children}</main>
      </div>
    </div>
  );
}