import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

import {
  DEFAULT_SETTINGS_SECTION,
  type CavioSettingsSection,
} from "../components/settings/settings-constants";
import { useSettingsModal } from "../hooks/use-settings-modal";

/**
 * /settings is no longer a full page. It opens the Notra-style SettingsModal
 * over the analyze shell and replaces the URL with /analyze (preserving
 * Stripe return query params when present).
 */
export default function Settings() {
  const navigate = useNavigate();
  const { openSettings } = useSettingsModal();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hash = window.location.hash.replace("#", "");

    let section: CavioSettingsSection = DEFAULT_SETTINGS_SECTION;
    if (hash === "billing" || hash === "plans") section = "billing";
    else if (hash === "account") section = "account";
    else if (hash === "language") section = "language";
    else if (hash === "credits" || params.get("credits")) section = "credits";

    openSettings({ section });

    const qs = params.toString();
    navigate(`/analyze${qs ? `?${qs}` : ""}`, { replace: true });
  }, [navigate, openSettings]);

  return null;
}
