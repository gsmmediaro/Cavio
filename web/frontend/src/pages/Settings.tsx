import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { getCredits, type CreditsInfo } from "../api/client";
import { AccountSettingsPane } from "../components/settings/panes/account-pane";
import { BillingSettingsPane } from "../components/settings/panes/billing-pane";
import { CreditsSettingsPane } from "../components/settings/panes/credits-pane";
import { LanguageSettingsPane } from "../components/settings/panes/language-pane";
import {
  DEFAULT_SETTINGS_SECTION,
  type CavioSettingsSection,
} from "../components/settings/settings-constants";
import { SettingsShell } from "../components/settings/settings-shell";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "sonner";

export default function Settings() {
  const { t, i18n } = useTranslation();
  const { user, userProfile } = useAuth();

  const displayName = userProfile
    ? (userProfile.firstName + " " + userProfile.lastName).trim()
    : user?.displayName || "";
  const email = user?.email || "";

  const [credits, setCredits] = useState<CreditsInfo | null>(null);
  const [creditsError, setCreditsError] = useState("");
  const [notice, setNotice] = useState("");
  const [section, setSection] = useState<CavioSettingsSection>(DEFAULT_SETTINGS_SECTION);
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
      setNotice("Payment received — credits will appear after Stripe webhook confirmation.");
      setSection("credits");
      setTopupSuccess(true);
      void refreshCredits();
    } else if (params.get("credits") === "cancel") {
      setNotice("Checkout canceled.");
      setSection("credits");
    }
    const hash = window.location.hash.replace("#", "");
    if (hash === "billing" || hash === "plans") setSection("billing");
    if (hash === "account") setSection("account");
    if (hash === "language") setSection("language");
    if (hash === "credits") setSection("credits");
  }, [refreshCredits]);

  const lang = (i18n.language || "en").startsWith("ro") ? "ro" : "en";

  void t; // keep i18n hook wired for future labels

  return (
    <SettingsShell onSectionChange={setSection} section={section}>
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
        <BillingSettingsPane credits={credits} creditsLoading={creditsLoading} />
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
    </SettingsShell>
  );
}
