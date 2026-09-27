import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";
import {
  createCheckoutSession,
  getCredits,
  type CreditsInfo,
} from "../api/client";
import { Button } from "../components/ui/button";
import { CtaButton } from "../components/ui/cta-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Separator } from "../components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { toast } from "sonner";
import {
  ErrorBanner,
  SettingsCreditsSkeleton,
} from "../components/chat/notra-chat-states";

export default function Settings() {
  const { t, i18n } = useTranslation();
  const { user, userProfile } = useAuth();
  const isMobile = typeof window !== "undefined" && window.innerWidth <= 768;

  const displayName = userProfile
    ? (userProfile.firstName + " " + userProfile.lastName).trim()
    : user?.displayName || "";
  const email = user?.email || "";

  const [credits, setCredits] = useState<CreditsInfo | null>(null);
  const [creditsError, setCreditsError] = useState("");
  const [buying, setBuying] = useState(false);
  const [notice, setNotice] = useState("");
  const [tab, setTab] = useState("credits");
  const [creditsLoading, setCreditsLoading] = useState(Boolean(user));

  const refreshCredits = useCallback(async () => {
    if (!user) {
      setCredits(null);
      setCreditsLoading(false);
      return;
    }
    try {
      setCreditsLoading(true);
      setCreditsError("");
      const info = await getCredits();
      setCredits(info);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not load credits";
      setCreditsError(msg);
      toast.error(msg, { description: "Credits API failed — check Firebase project match on Railway." });
    } finally {
      setCreditsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void refreshCredits();
    const params = new URLSearchParams(window.location.search);
    if (params.get("credits") === "success") {
      setNotice("Payment received — credits will appear after Stripe webhook confirmation.");
      setTab("credits");
      void refreshCredits();
    } else if (params.get("credits") === "cancel") {
      setNotice("Checkout canceled.");
      setTab("credits");
    }
  }, [refreshCredits]);

  const handleBuy = async () => {
    setBuying(true);
    setCreditsError("");
    try {
      const { checkout_url } = await createCheckoutSession();
      window.location.href = checkout_url;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Checkout failed";
      setCreditsError(msg);
      toast.error(msg, { description: "Stripe checkout could not start." });
      setBuying(false);
    }
  };

  const packLabel = credits
    ? ("Buy " + credits.pack_credits + " credits ($" + (credits.pack_price_cents / 100).toFixed(2) + ")")
    : "Buy credits";

  const lang = (i18n.language || "en").startsWith("ro") ? "ro" : "en";

  return (
    <div
      className="mx-auto flex w-full max-w-[720px] flex-1 flex-col"
      style={{ padding: isMobile ? "28px 16px 40px" : "48px 32px 56px" }}
    >
      <div className="mb-6">
        <h1
          className="text-balance text-ink"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: isMobile ? 30 : 40,
            fontWeight: 400,
            color: "var(--color-ink)",
            lineHeight: 1.15,
          }}
        >
          {t("layout.nav.accountSettings")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Credits, profile, and language — Notra-style segmented settings.
        </p>
      </div>

      {notice ? (
        <div className="mb-4 rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-foreground" role="status">
          {notice}
        </div>
      ) : null}

      <Tabs value={tab} onValueChange={setTab} className="gap-5">
        <TabsList variant="default" className="w-full max-w-md">
          <TabsTrigger value="credits">Credits</TabsTrigger>
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="language">Language</TabsTrigger>
        </TabsList>

        <TabsContent value="credits" className="outline-none">
          <Card className="gap-0 py-0">
            <CardHeader className={isMobile ? "px-5 pt-6" : "px-8 pt-7"}>
              <CardTitle style={{ fontFamily: "var(--font-display)" }}>Scan credits</CardTitle>
              <CardDescription>
                One credit is deducted per OPG caries scan. Buy a single credit pack via Stripe (test mode).
              </CardDescription>
            </CardHeader>
            <CardContent className={isMobile ? "px-5 pb-6" : "px-8 pb-7"}>
              {!user ? (
                <p className="text-sm text-muted-foreground">Sign in to view and buy credits.</p>
              ) : creditsLoading && !credits ? (
                <SettingsCreditsSkeleton />
              ) : (
                <>
                  {creditsError ? (
                    <div className="mb-4">
                      <ErrorBanner
                        title="Could not load credits"
                        description={creditsError}
                        onRetry={() => void refreshCredits()}
                      />
                    </div>
                  ) : null}
                  <div className="mb-4 flex items-baseline gap-2">
                    <span
                      style={{ fontFamily: "var(--font-display)", fontSize: 36, color: "var(--color-ink)" }}
                    >
                      {credits ? credits.credits : "—"}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      remaining
                      {credits ? " · " + credits.scan_cost + " per scan" : ""}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <CtaButton size="default" className="h-11" onClick={handleBuy} disabled={buying || Boolean(creditsError)}>
                      {buying ? "Redirecting…" : packLabel}
                    </CtaButton>
                    <Button size="lg" variant="outline" onClick={() => void refreshCredits()}>
                      Refresh
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="account" className="outline-none">
          <Card className="gap-0 py-0">
            <CardHeader className={isMobile ? "px-5 pt-6" : "px-8 pt-7"}>
              <CardTitle style={{ fontFamily: "var(--font-display)" }}>Account Information</CardTitle>
              <CardDescription>Manage & update your profile information</CardDescription>
            </CardHeader>
            <CardContent className={isMobile ? "px-5 pb-6" : "px-8 pb-7"}>
              <Separator className="mb-0" />
              <div
                className="flex justify-between gap-1 border-b border-border py-5"
                style={{ flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "flex-start" : "center" }}
              >
                <span className="text-sm font-semibold text-foreground">Name</span>
                <span className="text-sm text-muted-foreground">{displayName || "—"}</span>
              </div>
              <div
                className="flex justify-between gap-1 py-5"
                style={{ flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "flex-start" : "center" }}
              >
                <span className="text-sm font-semibold text-foreground">Email</span>
                <span className="text-sm text-muted-foreground">{email || "—"}</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="language" className="outline-none">
          <Card className="gap-0 py-0">
            <CardHeader className={isMobile ? "px-5 pt-6" : "px-8 pt-7"}>
              <CardTitle style={{ fontFamily: "var(--font-display)" }}>Language</CardTitle>
              <CardDescription>Interface language for Cavio.</CardDescription>
            </CardHeader>
            <CardContent className={isMobile ? "px-5 pb-6" : "px-8 pb-7"}>
              <Tabs
                value={lang}
                onValueChange={(next) => {
                  void i18n.changeLanguage(next);
                }}
              >
                <TabsList variant="default">
                  <TabsTrigger value="en">English</TabsTrigger>
                  <TabsTrigger value="ro">Română</TabsTrigger>
                </TabsList>
              </Tabs>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}