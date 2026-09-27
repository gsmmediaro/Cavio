import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import {
  createCheckoutSession,
  getCredits,
  type CreditsInfo,
} from "../api/client";

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
      setNotice("Payment received ? credits will appear after Stripe webhook confirmation.");
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
    <div style={{
      flex: 1,
      display: "flex",
      flexDirection: "column",
      padding: isMobile ? "32px 20px" : "60px 32px",
      maxWidth: 680,
      width: "100%",
      margin: "0 auto",
    }}>
      <h1 style={{
        fontFamily: "var(--font-display)",
        fontSize: isMobile ? 32 : 42,
        fontWeight: 400,
        color: "var(--color-ink)",
        marginBottom: 32,
        textWrap: "balance",
      }}>
        Account Settings
      </h1>

      {notice && (
        <div style={{
          marginBottom: 16,
          padding: "12px 16px",
          borderRadius: 12,
          background: "rgba(76, 140, 90, 0.12)",
          color: "var(--color-ink)",
          fontFamily: "var(--font-body)",
          fontSize: 14,
        }}>
          {notice}
        </div>
      )}

      <div style={{
        background: "var(--color-surface)",
        borderRadius: 16,
        boxShadow: "0 0 0 1px rgba(45, 42, 36, 0.06), 0 1px 2px rgba(0,0,0,0.03)",
        padding: isMobile ? "24px 20px" : "28px 32px",
        marginBottom: 20,
      }}>
        <h2 style={{
          fontFamily: "var(--font-display)",
          fontSize: 18,
          fontWeight: 500,
          color: "var(--color-ink)",
          margin: 0,
        }}>
          Scan credits
        </h2>
        <p style={{
          fontSize: 13,
          color: "var(--color-ink-tertiary)",
          margin: "4px 0 16px",
          fontFamily: "var(--font-body)",
        }}>
          One credit is deducted per OPG caries scan. Buy a single credit pack via Stripe (test mode).
        </p>

        {!user ? (
          <p style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "var(--color-ink-secondary)" }}>
            Sign in to view and buy credits.
          </p>
        ) : (
          <>
            <div style={{
              display: "flex",
              alignItems: "baseline",
              gap: 8,
              marginBottom: 16,
            }}>
              <span style={{
                fontFamily: "var(--font-display)",
                fontSize: 36,
                color: "var(--color-ink)",
              }}>
                {credits ? credits.credits : "?"}
              </span>
              <span style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "var(--color-ink-tertiary)" }}>
                remaining
                {credits ? " ? " + credits.scan_cost + " per scan" : ""}
              </span>
            </div>
            <button
              onClick={handleBuy}
              disabled={buying}
              style={{
                padding: "12px 20px",
                background: "var(--color-leaf)",
                color: "white",
                border: "none",
                borderRadius: 12,
                fontSize: 14,
                fontWeight: 600,
                cursor: buying ? "wait" : "pointer",
                fontFamily: "var(--font-body)",
                opacity: buying ? 0.7 : 1,
              }}
            >
              {buying ? "Redirecting?" : packLabel}
            </button>
            {creditsError && (
              <p style={{
                marginTop: 12,
                color: "var(--color-high)",
                fontSize: 13,
                fontFamily: "var(--font-body)",
              }}>
                {creditsError}
              </p>
            )}
          </>
        )}
      </div>

      <div style={{
        background: "var(--color-surface)",
        borderRadius: 16,
        boxShadow: "0 0 0 1px rgba(45, 42, 36, 0.06), 0 1px 2px rgba(0,0,0,0.03)",
        padding: isMobile ? "24px 20px" : "28px 32px",
      }}>
        <div style={{ marginBottom: 24 }}>
          <h2 style={{
            fontFamily: "var(--font-display)",
            fontSize: 18,
            fontWeight: 500,
            color: "var(--color-ink)",
            margin: 0,
            lineHeight: 1.3,
          }}>
            Account Information
          </h2>
          <p style={{
            fontSize: 13,
            color: "var(--color-ink-tertiary)",
            margin: "4px 0 0",
            fontFamily: "var(--font-body)",
          }}>
            Manage & update your profile information
          </p>
        </div>

        <div style={{ borderTop: "1px solid var(--border-color)" }}>
          <div style={{
            display: "flex",
            alignItems: isMobile ? "flex-start" : "center",
            flexDirection: isMobile ? "column" : "row",
            justifyContent: "space-between",
            padding: "20px 0",
            borderBottom: "1px solid var(--border-color)",
            gap: isMobile ? 4 : 0,
          }}>
            <span style={{
              fontSize: 14,
              fontWeight: 600,
              color: "var(--color-ink)",
              fontFamily: "var(--font-body)",
            }}>
              Name
            </span>
            <span style={{
              fontSize: 14,
              color: "var(--color-ink-secondary)",
              fontFamily: "var(--font-body)",
            }}>
              {displayName || "?"}
            </span>
          </div>

          <div style={{
            display: "flex",
            alignItems: isMobile ? "flex-start" : "center",
            flexDirection: isMobile ? "column" : "row",
            justifyContent: "space-between",
            padding: "20px 0",
            gap: isMobile ? 4 : 0,
          }}>
            <span style={{
              fontSize: 14,
              fontWeight: 600,
              color: "var(--color-ink)",
              fontFamily: "var(--font-body)",
            }}>
              Email
            </span>
            <span style={{
              fontSize: 14,
              color: "var(--color-ink-secondary)",
              fontFamily: "var(--font-body)",
            }}>
              {email || "?"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
