import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import {
  createCheckoutSession,
  getCredits,
  type CreditsInfo,
} from "../api/client";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Separator } from "../components/ui/separator";

export default function Settings() {
  const { user, userProfile } = useAuth();
  const isMobile = window.innerWidth <= 768;

  const displayName = userProfile
    ? (userProfile.firstName + " " + userProfile.lastName).trim()
    : user?.displayName || "";
  const email = user?.email || "";

  const [credits, setCredits] = useState<CreditsInfo | null>(null);
  const [creditsError, setCreditsError] = useState("");
  const [buying, setBuying] = useState(false);
  const [notice, setNotice] = useState("");

  const refreshCredits = useCallback(async () => {
    if (!user) {
      setCredits(null);
      return;
    }
    try {
      setCreditsError("");
      const info = await getCredits();
      setCredits(info);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not load credits";
      setCreditsError(msg);
    }
  }, [user]);

  useEffect(() => {
    void refreshCredits();
    const params = new URLSearchParams(window.location.search);
    if (params.get("credits") === "success") {
      setNotice("Payment received — credits will appear after Stripe webhook confirmation.");
      void refreshCredits();
    } else if (params.get("credits") === "cancel") {
      setNotice("Checkout canceled.");
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
      setBuying(false);
    }
  };

  const packLabel = credits
    ? ("Buy " + credits.pack_credits + " credits ($" + (credits.pack_price_cents / 100).toFixed(2) + ")")
    : "Buy credits";

  return (
    <div
      className="mx-auto flex w-full max-w-[680px] flex-1 flex-col"
      style={{ padding: isMobile ? "32px 20px" : "60px 32px" }}
    >
      <h1
        className="mb-8 text-balance font-display text-ink"
        style={{
          fontFamily: "var(--font-display)",
          fontSize: isMobile ? 32 : 42,
          fontWeight: 400,
          color: "var(--color-ink)",
        }}
      >
        Account Settings
      </h1>

      {notice && (
        <div className="mb-4 rounded-xl bg-accent px-4 py-3 text-sm text-foreground">
          {notice}
        </div>
      )}

      <Card className="mb-5 gap-0 py-0">
        <CardHeader className={isMobile ? "px-5 pt-6" : "px-8 pt-7"}>
          <CardTitle style={{ fontFamily: "var(--font-display)" }}>Scan credits</CardTitle>
          <CardDescription>
            One credit is deducted per OPG caries scan. Buy a single credit pack via Stripe (test mode).
          </CardDescription>
        </CardHeader>
        <CardContent className={isMobile ? "px-5 pb-6" : "px-8 pb-7"}>
          {!user ? (
            <p className="text-sm text-muted-foreground">Sign in to view and buy credits.</p>
          ) : (
            <>
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
              <Button size="lg" onClick={handleBuy} disabled={buying}>
                {buying ? "Redirecting…" : packLabel}
              </Button>
              {creditsError && (
                <p className="mt-3 text-[13px] text-destructive">{creditsError}</p>
              )}
            </>
          )}
        </CardContent>
      </Card>

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
    </div>
  );
}
