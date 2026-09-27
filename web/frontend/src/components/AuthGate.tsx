import { useRef, useState } from "react";
import { Loader2Icon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { useAuth } from "../contexts/AuthContext";
import OnboardingFlow from "./OnboardingFlow";
import { AuthShell } from "./shell/auth-shell";
import { Separator } from "./ui/separator";

import { AuthEmailField } from "@notra/ui/components/shared/auth/auth-email-field";
import { AuthFormError } from "@notra/ui/components/shared/auth/auth-form-error";
import { AuthFormHeader } from "@notra/ui/components/shared/auth/auth-form-header";
import { AuthOrDivider } from "@notra/ui/components/shared/auth/auth-or-divider";
import { AuthPasswordField } from "@notra/ui/components/shared/auth/auth-password-field";
import { CtaButton } from "@notra/ui/components/shared/cta-button";
import { Google } from "@notra/ui/components/ui/svgs/google";
import { Input } from "@notra/ui/components/ui/input";
import { Label } from "@notra/ui/components/ui/label";

/**
 * Cavio AuthGate — component tree mirrored from Notra SOURCE:
 *
 * AuthLayout (auth-shell)
 *   └─ login|signup page: div.mx-auto.w-full.max-w-md.rounded-md.p-6.lg:px-8.lg:py-10
 *        └─ LoginForm | SignupForm (packages/ui/src/components/shared/auth/login-form.tsx)
 *             div.flex.w-full.flex-col.gap-5
 *               AuthFormHeader
 *               div.grid.gap-4
 *                 AuthSocialButtons → CtaButton variant="light" rounded-full (Google only for Cavio)
 *                 AuthOrDivider
 *                 form
 *                   div.grid.gap-3
 *                     AuthEmailField (Input h-11 rounded-xl)
 *                     AuthPasswordField (Input h-11 rounded-xl)
 *                   AuthFormError
 *                   CtaButton primary w-full rounded-full - NO rounded-lg override
 *               footer links
 *
 * Firebase/Google/email adapted for Cavio. No method-picker screen.
 */

type View = "login" | "register";
type AuthMethod = "email" | "google" | null;

function mapFirebaseError(code: string, fallback: string, t: (k: string) => string) {
  if (code === "auth/email-already-in-use") return t("auth.errors.emailInUse");
  if (code === "auth/invalid-email") return t("auth.errors.invalidEmail");
  if (code === "auth/weak-password") return t("auth.errors.weakPassword");
  if (code === "auth/invalid-credential") return t("auth.errors.wrongCredentials");
  return fallback;
}

/** Google-only social row — same CtaButton light as Notra AuthSocialButtons. */
function CavioGoogleButton({
  authMethod,
  disabled,
  onSelect,
}: {
  authMethod: AuthMethod;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <div className="relative">
      <CtaButton
        className="w-full"
        disabled={disabled}
        onClick={onSelect}
        type="button"
        variant="light"
      >
        {authMethod === "google" ? (
          <Loader2Icon className="size-4 animate-spin" />
        ) : (
          <Google className="size-4" />
        )}
        Google
      </CtaButton>
    </div>
  );
}

export default function AuthGate() {
  const { t } = useTranslation();
  const {
    user,
    userProfile,
    loading,
    login,
    register,
    loginWithGoogle,
    showAuthGate,
    setShowAuthGate,
  } = useAuth();

  const [view, setView] = useState<View>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [authMethod, setAuthMethod] = useState<AuthMethod>(null);
  const authInFlightRef = useRef(false);

  if (loading) return null;

  if (user && userProfile?.onboarded) return null;

  if (user && userProfile && !userProfile.onboarded) {
    return (
      <AuthShell mode="onboarding">
        <OnboardingFlow />
      </AuthShell>
    );
  }

  if (user) return null;
  if (!showAuthGate) return null;

  const isAuthLoading = authMethod !== null;

  function releaseAuth() {
    authInFlightRef.current = false;
    setAuthMethod(null);
  }

  function switchView(next: View) {
    setView(next);
    setEmail("");
    setPassword("");
    setFirstName("");
    setLastName("");
    setFormError(null);
    releaseAuth();
  }

  async function handleGoogle() {
    if (authInFlightRef.current) return;
    setFormError(null);
    authInFlightRef.current = true;
    setAuthMethod("google");
    try {
      await loginWithGoogle();
      setShowAuthGate(false);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || "";
      if (code !== "auth/popup-closed-by-user") {
        setFormError(
          (err as { message?: string })?.message ||
            "Social sign-in failed. Please try again.",
        );
      }
      releaseAuth();
    }
  }

  async function handleEmailSubmit(event: React.FormEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (authInFlightRef.current) return;

    if (!email.trim()) {
      setFormError(t("auth.errors.invalidEmail"));
      return;
    }
    if (!password) {
      setFormError(t("auth.errors.weakPassword"));
      return;
    }
    if (view === "register" && !firstName.trim()) {
      setFormError(t("auth.errors.enterFirstName"));
      return;
    }

    setFormError(null);
    authInFlightRef.current = true;
    setAuthMethod("email");
    try {
      if (view === "login") {
        await login(email.trim(), password);
      } else {
        await register(
          email.trim(),
          password,
          firstName.trim(),
          lastName.trim(),
        );
      }
      setShowAuthGate(false);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || "";
      setFormError(
        mapFirebaseError(
          code,
          (err as { message?: string })?.message ||
            "Failed to sign in. Please try again.",
          t,
        ),
      );
      releaseAuth();
    }
  }

  const title =
    view === "login"
      ? t("auth.login.title", { defaultValue: "Welcome back" })
      : t("auth.register.title", { defaultValue: "Create your account" });
  const description =
    view === "login"
      ? t("auth.login.subtitle", {
          defaultValue: "Log in to pick up where your team left off.",
        })
      : t("auth.register.subtitle", {
          defaultValue: "Start your Cavio workspace in a minute.",
        });

  return (
    <AuthShell mode="auth" onClose={() => setShowAuthGate(false)}>
      {/* login/signup page chrome from source */}
      <div className="mx-auto w-full max-w-md rounded-md p-6 lg:px-8 lg:py-10">
        <div className="flex w-full flex-col gap-5">
          <AuthFormHeader description={description} title={title} />

          <div className="grid gap-4">
            <CavioGoogleButton
              authMethod={authMethod}
              disabled={isAuthLoading}
              onSelect={handleGoogle}
            />

            <AuthOrDivider />

            <form
              aria-busy={isAuthLoading}
              noValidate
              onSubmit={handleEmailSubmit}
            >
              <div className="grid gap-3">
                {view === "register" ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-1.5">
                      <Label htmlFor="firstName">
                        {t("auth.emailForm.firstName", {
                          defaultValue: "First name",
                        })}
                      </Label>
                      <Input
                        autoComplete="given-name"
                        className="h-11 rounded-xl px-4"
                        disabled={isAuthLoading}
                        id="firstName"
                        name="firstName"
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder="Jane"
                        value={firstName}
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="lastName">
                        {t("auth.emailForm.lastName", {
                          defaultValue: "Last name",
                        })}
                      </Label>
                      <Input
                        autoComplete="family-name"
                        className="h-11 rounded-xl px-4"
                        disabled={isAuthLoading}
                        id="lastName"
                        name="lastName"
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder="Doe"
                        value={lastName}
                      />
                    </div>
                  </div>
                ) : null}

                <AuthEmailField
                  disabled={isAuthLoading}
                  error={undefined}
                  id="email"
                  label="Email"
                  onBlur={() => undefined}
                  onChange={setEmail}
                  placeholder="jane@company.com"
                  value={email}
                />

                <AuthPasswordField
                  autoComplete={
                    view === "login" ? "current-password" : "new-password"
                  }
                  disabled={isAuthLoading}
                  error={undefined}
                  id="password"
                  onBlur={() => undefined}
                  onChange={setPassword}
                  placeholder={
                    view === "login"
                      ? "Your password"
                      : "At least 10 characters"
                  }
                  value={password}
                />
              </div>

              <AuthFormError className="mt-4" error={formError} />

              <div className="relative mt-4 pt-2">
                <CtaButton
                  className="w-full"
                  disabled={isAuthLoading}
                  type="submit"
                >
                  {authMethod === "email" ? (
                    <>
                      <Loader2Icon className="size-4 animate-spin" />
                      {view === "login"
                        ? "Signing in..."
                        : "Creating account..."}
                    </>
                  ) : view === "login" ? (
                    "Log in"
                  ) : (
                    "Create account"
                  )}
                </CtaButton>
              </div>
            </form>
          </div>

          <div className="text-muted-foreground flex flex-col gap-4 px-8 text-center text-xs">
            {view === "login" ? (
              <>
                <p>
                  Don&apos;t have an account?{" "}
                  <button
                    type="button"
                    className="hover:text-primary underline underline-offset-4"
                    onClick={() => switchView("register")}
                  >
                    Register
                  </button>
                </p>
              </>
            ) : (
              <>
                <p>
                  Already have an account?{" "}
                  <button
                    type="button"
                    className="hover:text-primary underline underline-offset-4"
                    onClick={() => switchView("login")}
                  >
                    Log in
                  </button>
                </p>
                <Separator />
                <p>
                  By continuing you agree to our{" "}
                  <Link
                    className="hover:text-primary underline underline-offset-4"
                    to="/terms"
                  >
                    Terms
                  </Link>{" "}
                  and{" "}
                  <Link
                    className="hover:text-primary underline underline-offset-4"
                    to="/privacy"
                  >
                    Privacy Policy
                  </Link>
                  .
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </AuthShell>
  );
}
