"use client";

import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@notra/ui/lib/utils";
import { useCallback, useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { getCredits, type CreditsInfo } from "@/api/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { AccountSettingsPane } from "@/components/settings/panes/account-pane";
import { BillingSettingsPane } from "@/components/settings/panes/billing-pane";
import { CreditsSettingsPane } from "@/components/settings/panes/credits-pane";
import { LanguageSettingsPane } from "@/components/settings/panes/language-pane";
import {
  CAVIO_SETTINGS_DESCRIPTIONS,
  CAVIO_SETTINGS_LABELS,
  CAVIO_SETTINGS_NAV_GROUPS,
  type CavioSettingsSection,
} from "@/components/settings/settings-constants";
import { SettingsNav } from "@/components/settings/settings-nav";
import { useAuth } from "@/contexts/AuthContext";
import { useSettingsModal } from "@/hooks/use-settings-modal";

/**
 * Notra-style SettingsModal: Dialog overlay over the current shell
 * (size / left nav / panes / close X / backdrop — not a full route page).
 */
export function SettingsModal() {
  const { section, isOpen, setSection, closeSettings } = useSettingsModal();
  const titleId = useId();
  const descriptionId = useId();

  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open) {
          closeSettings();
        }
      }}
      open={isOpen}
    >
      <DialogContent
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        className={cn(
          "flex! max-w-none min-w-0 flex-col gap-0 overflow-hidden p-0 sm:max-w-none",
          "top-0 right-0 bottom-0 left-0 h-auto w-auto translate-none rounded-none",
          "md:top-1/2 md:right-auto md:bottom-auto md:left-1/2 md:h-[min(44rem,calc(100svh-2rem))] md:w-[min(64rem,calc(100%-1.5rem))] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-2xl",
          "bg-background border-border"
        )}
        showCloseButton={false}
      >
        {isOpen ? (
          <SettingsModalSession
            closeSettings={closeSettings}
            descriptionId={descriptionId}
            section={section}
            setSection={setSection}
            titleId={titleId}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function SettingsModalSession({
  closeSettings,
  descriptionId,
  section,
  setSection,
  titleId,
}: {
  closeSettings: () => void;
  descriptionId: string;
  section: CavioSettingsSection;
  setSection: (section: CavioSettingsSection) => void;
  titleId: string;
}) {
  const { i18n } = useTranslation();
  const { user, userProfile } = useAuth();

  const displayName = userProfile
    ? (userProfile.firstName + " " + userProfile.lastName).trim()
    : user?.displayName || "";
  const email = user?.email || "";

  const [credits, setCredits] = useState<CreditsInfo | null>(null);
  const [creditsError, setCreditsError] = useState("");
  const [notice, setNotice] = useState("");
  const [creditsLoading, setCreditsLoading] = useState(Boolean(user));
  const [topupSuccess, setTopupSuccess] = useState(false);

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
      toast.error(msg, {
        description: "Credits API failed — check Firebase project match on Railway.",
      });
    } finally {
      setCreditsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void refreshCredits();
    const params = new URLSearchParams(window.location.search);
    if (params.get("credits") === "success") {
      setNotice(
        "Payment received — credits will appear after Stripe webhook confirmation."
      );
      setSection("credits");
      setTopupSuccess(true);
      void refreshCredits();
    } else if (params.get("credits") === "cancel") {
      setNotice("Checkout canceled.");
      setSection("credits");
    }
  }, [refreshCredits, setSection]);

  const lang = (i18n.language || "en").startsWith("ro") ? "ro" : "en";

  return (
    <div className="flex min-h-0 flex-1 flex-col md:flex-row">
      <SettingsNav
        activeSection={section}
        groups={CAVIO_SETTINGS_NAV_GROUPS}
        onSelect={setSection}
      />
      <section className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-start justify-between gap-3 border-b px-4 py-3.5 md:px-5">
          <div className="min-w-0 space-y-1">
            <DialogTitle
              className="text-sm leading-none font-medium"
              id={titleId}
            >
              {CAVIO_SETTINGS_LABELS[section]}
            </DialogTitle>
            <DialogDescription
              className="text-muted-foreground text-xs"
              id={descriptionId}
            >
              {CAVIO_SETTINGS_DESCRIPTIONS[section]}
            </DialogDescription>
          </div>
          <Button
            aria-label="Close settings"
            className="shrink-0"
            onClick={closeSettings}
            size="icon-sm"
            variant="ghost"
          >
            <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
          </Button>
        </header>
        <div className="scrollbar-floating min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-sm md:px-5 md:pb-4">
          {user && creditsLoading && !credits && !creditsError ? (
            <div className="space-y-4" aria-busy="true" aria-label="Loading settings">
              <div className="bg-muted h-36 animate-pulse rounded-lg" />
              <div className="bg-muted h-24 animate-pulse rounded-lg" />
              <div className="bg-muted h-40 animate-pulse rounded-lg" />
            </div>
          ) : (
            <>
              {section === "credits" ? (
                <CreditsSettingsPane
                  credits={credits}
                  creditsError={creditsError}
                  creditsLoading={creditsLoading}
                  notice={notice}
                  onRefresh={() => void refreshCredits()}
                  topupSuccess={topupSuccess}
                />
              ) : null}
              {section === "billing" ? (
                <BillingSettingsPane
                  credits={credits}
                  creditsLoading={creditsLoading}
                />
              ) : null}
              {section === "account" ? (
                <AccountSettingsPane displayName={displayName} email={email} />
              ) : null}
              {section === "language" ? (
                <LanguageSettingsPane
                  lang={lang}
                  onChange={(next) => {
                    void i18n.changeLanguage(next);
                  }}
                />
              ) : null}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
