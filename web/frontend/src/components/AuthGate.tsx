import { useState } from "react";
// framer-motion removed â€” CSS animation used instead
import { X, ArrowLeft } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import OnboardingFlow from "./OnboardingFlow";
import { useTranslation } from "react-i18next";
import { Button } from "./ui/button";
import { CtaButton } from "./ui/cta-button";
import { AuthShell } from "./shell/auth-shell";
import { Input } from "./ui/input";
import { Card } from "./ui/card";
import { Separator } from "./ui/separator";

/* â”€â”€ Google "G" icon â”€â”€ */
const GOOGLE_G = (
  <svg width="20" height="20" viewBox="0 0 48 48">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
    <path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.01 24.01 0 0 0 0 21.56l7.98-6.19z"/>
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
  </svg>
);

/* â”€â”€ View type â”€â”€ */
type View = "login" | "register" | "email-login" | "email-register";

/* â”€â”€ Shared styles â”€â”€ */
const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 1000,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  backdropFilter: "blur(10px)",
  WebkitBackdropFilter: "blur(10px)",
  background: "rgba(0,0,0,0.45)",
};

const cardStyle: React.CSSProperties = {
  position: "relative",
  width: 460,
  maxWidth: "92vw",
  minHeight: 520,
  background: "var(--color-surface)",
  borderRadius: 20,
  boxShadow: "0 12px 48px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.04)",
  padding: "44px 36px 36px",
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
};

const headingStyle: React.CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: 26,
  fontWeight: 600,
  color: "var(--color-ink)",
  textAlign: "center",
  margin: 0,
  lineHeight: 1.25,
};

const subtitleStyle: React.CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 15,
  color: "var(--color-ink-secondary)",
  textAlign: "center",
  margin: "8px 0 0",
};

const primaryBtnStyle: React.CSSProperties = {
  width: "100%",
  padding: "14px 0",
  background: "var(--color-leaf)",
  color: "white",
  border: "none",
  borderRadius: 12,
  fontSize: 15,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "var(--font-body)",
  transition: "opacity 0.15s",
};

const googleBtnStyle: React.CSSProperties = {
  width: "100%",
  padding: "14px 0",
  background: "rgba(66, 133, 244, 0.08)",
  color: "#4285F4",
  border: "none",
  borderRadius: 12,
  fontSize: 15,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "var(--font-body)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
  transition: "background 0.15s",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  background: "transparent",
  border: "1px solid var(--border-color)",
  borderRadius: 10,
  fontSize: 14,
  fontFamily: "var(--font-body)",
  color: "var(--color-ink)",
  outline: "none",
  transition: "border-color 0.15s",
  boxSizing: "border-box",
};

const linkBtnStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "var(--color-leaf)",
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "var(--font-body)",
  fontSize: 14,
  padding: 0,
};

const closeBtnStyle: React.CSSProperties = {
  position: "absolute",
  top: 16,
  right: 16,
  background: "none",
  border: "none",
  cursor: "pointer",
  color: "var(--color-ink-tertiary)",
  padding: 4,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 8,
  transition: "color 0.15s",
};

const backBtnStyle: React.CSSProperties = {
  position: "absolute",
  top: 16,
  left: 16,
  background: "none",
  border: "none",
  cursor: "pointer",
  color: "var(--color-ink-tertiary)",
  padding: 4,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 8,
  transition: "color 0.15s",
};

/* â”€â”€ Divider â”€â”€ */
function Divider() {
  const { t } = useTranslation();
  return (
    <div className="my-5 flex items-center gap-3.5">
      <Separator className="flex-1" />
      <span className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
        {t("auth.divider.or")}
      </span>
      <Separator className="flex-1" />
    </div>
  );
}

/* â”€â”€ View wrapper â€” simple fade via CSS â”€â”€ */
const viewStyle: React.CSSProperties = {
  animation: "authFadeIn 0.22s ease-out",
};

/* â”€â”€ Main component â”€â”€ */
export default function AuthGate() {
  const { t } = useTranslation();
  const { user, userProfile, loading, login, register, loginWithGoogle, showAuthGate, setShowAuthGate } = useAuth();

  const [view, setView] = useState<View>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (loading) return null;

  // Authenticated and onboarded â†’ no gate
  if (user && userProfile?.onboarded) return null;

  // Authenticated but not onboarded â†’ show onboarding
  if (user && userProfile && !userProfile.onboarded) {
    return (
      <AuthShell>
        <OnboardingFlow />
      </AuthShell>
    );
  }

  // If user exists (profile still loading maybe), don't show auth gate
  if (user) return null;

  // Not authenticated: only show when triggered by "Log in" button
  if (!showAuthGate) return null;

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setFirstName("");
    setLastName("");
    setError("");
    setSubmitting(false);
  };

  const switchView = (v: View) => {
    resetForm();
    setView(v);
  };

  const handleClose = () => {
    // Only allow closing if externally triggered (user exists scenario)
    // When no user, modal is mandatory â€” but we still wire the X for future use
    setShowAuthGate(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      if (view === "email-login") {
        await login(email, password);
      } else {
        if (!firstName.trim()) { setError(t("auth.errors.enterFirstName")); setSubmitting(false); return; }
        await register(email, password, firstName.trim(), lastName.trim());
      }
      setShowAuthGate(false);
    } catch (err: any) {
      const code = err?.code || "";
      if (code === "auth/email-already-in-use") setError(t("auth.errors.emailInUse"));
      else if (code === "auth/invalid-email") setError(t("auth.errors.invalidEmail"));
      else if (code === "auth/weak-password") setError(t("auth.errors.weakPassword"));
      else if (code === "auth/invalid-credential") setError(t("auth.errors.wrongCredentials"));
      else setError(err?.message || "Something went wrong");
    }
    setSubmitting(false);
  };

  const handleGoogleSignIn = async () => {
    setError("");
    try {
      await loginWithGoogle();
      setShowAuthGate(false);
    } catch (err: any) {
      if (err?.code !== "auth/popup-closed-by-user") {
        setError(err?.message || "Google Sign-In error");
      }
    }
  };

  /* Login method selection */
  const renderLogin = () => (
    <div key="login" style={viewStyle}>
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <img src="/Cavio Logo.png" alt="Cavio" style={{ width: 52, height: 52, marginBottom: 14, display: "block", marginLeft: "auto", marginRight: "auto" }} />
        <h2 style={headingStyle}>{t("auth.login.title")}</h2>
        <p style={subtitleStyle}>{t("auth.login.subtitle")}</p>
      </div>

      <div className="flex flex-col gap-3">
        {/*
          Notra social uses CtaButton light; primary email uses CtaButton primary.
          Full-width rounded-full reads as a sausage pill — override to rounded-lg
          so email matches the Google control radius Stefan called correct, while
          keeping Notra CtaButton structure (gradient + glow / light).
        */}
        <CtaButton
          size="default"
          className="h-11 w-full !rounded-lg"
          onClick={() => switchView("email-login")}
        >
          {t("auth.login.emailBtn")}
        </CtaButton>
        <CtaButton
          type="button"
          variant="light"
          size="default"
          className="h-11 w-full !rounded-lg"
          onClick={handleGoogleSignIn}
        >
          {GOOGLE_G}
          {t("auth.login.googleBtn")}
        </CtaButton>
      </div>

      <Divider />

      <div style={{ textAlign: "center", fontSize: 14, color: "var(--color-ink-secondary)", fontFamily: "var(--font-body)" }}>
        {t("auth.login.noAccount")}{" "}
        <Button variant="link" className="h-auto p-0 text-primary" onClick={() => switchView("register")}>
          {t("auth.login.createAccount")}
        </Button>
      </div>
    </div>
  );

  /* Register method selection */
  const renderRegister = () => (
    <div key="register" style={viewStyle}>
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <img src="/Cavio Logo.png" alt="Cavio" style={{ width: 52, height: 52, marginBottom: 14, display: "block", marginLeft: "auto", marginRight: "auto" }} />
        <h2 style={headingStyle}>{t("auth.register.title")}</h2>
        <p style={subtitleStyle}>{t("auth.register.subtitle")}</p>
      </div>

      <div className="flex flex-col gap-3">
        <CtaButton
          size="default"
          className="h-11 w-full !rounded-lg"
          onClick={() => switchView("email-register")}
        >
          {t("auth.register.emailBtn")}
        </CtaButton>
        <CtaButton
          type="button"
          variant="light"
          size="default"
          className="h-11 w-full !rounded-lg"
          onClick={handleGoogleSignIn}
        >
          {GOOGLE_G}
          {t("auth.register.googleBtn")}
        </CtaButton>
      </div>

      <Divider />

      <div style={{ textAlign: "center", fontSize: 14, color: "var(--color-ink-secondary)", fontFamily: "var(--font-body)" }}>
        {t("auth.register.hasAccount")}{" "}
        <Button variant="link" className="h-auto p-0 text-primary" onClick={() => switchView("login")}>
          {t("auth.register.loginHere")}
        </Button>
      </div>

      <p style={{ textAlign: "center", fontSize: 12, color: "var(--color-ink-tertiary)", fontFamily: "var(--font-body)", marginTop: 16, lineHeight: 1.5 }}>
        {t("auth.register.termsText")}{" "}
        <a href="/terms" style={{ color: "var(--color-leaf)", textDecoration: "underline" }}>{t("auth.register.termsLink")}</a>{" "}
        {t("auth.register.and")}{" "}
        <a href="/privacy" style={{ color: "var(--color-leaf)", textDecoration: "underline" }}>{t("auth.register.privacyLink")}</a>.
      </p>
    </div>
  );

  /* Email form (login or register) */
  const renderEmailForm = () => {
    const isLogin = view === "email-login";
    return (
      <div key="email-form" style={viewStyle}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <img src="/Cavio Logo.png" alt="Cavio" style={{ width: 52, height: 52, marginBottom: 14, display: "block", marginLeft: "auto", marginRight: "auto" }} />
          <h2 style={headingStyle}>{isLogin ? t("auth.emailForm.signIn") : t("auth.emailForm.createAccount")}</h2>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {!isLogin && (
            <div className="flex gap-3">
              <Input
                placeholder={t("auth.emailForm.firstName")}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
              <Input
                placeholder={t("auth.emailForm.lastName")}
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
          )}
          <Input
            type="email"
            placeholder={t("auth.emailForm.email")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            type="password"
            placeholder={t("auth.emailForm.password")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />

          {error && (
            <div style={{ color: "var(--color-high)", fontSize: 13, fontWeight: 500, fontFamily: "var(--font-body)" }}>
              {error}
            </div>
          )}

          <CtaButton type="submit" size="default" className="mt-1 h-11 w-full !rounded-lg" disabled={submitting}>
            {submitting ? t("auth.emailForm.loading") : isLogin ? t("auth.emailForm.signIn") : t("auth.emailForm.createAccountBtn")}
          </CtaButton>
        </form>
      </div>
    );
  };

  const isEmailView = view === "email-login" || view === "email-register";

  return (
    <AuthShell onClose={handleClose}>
      <div className="relative w-full" style={{ animation: "authFadeIn 0.25s ease" }}>
        {isEmailView && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute -top-2 -left-2 z-10 text-muted-foreground"
            onClick={() => switchView(view === "email-login" ? "login" : "register")}
            aria-label="Back"
          >
            <ArrowLeft size={20} />
          </Button>
        )}
        {view === "login" && renderLogin()}
        {view === "register" && renderRegister()}
        {isEmailView && renderEmailForm()}
      </div>
    </AuthShell>
  );
}
