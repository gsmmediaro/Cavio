import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import ro from "./locales/ro.json";
import en from "./locales/en.json";

/**
 * Product UI is English by default. Do not auto-detect browser/RO locale.
 * RO resources stay loaded so Settings can switch later if Stefan asks.
 */
void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ro: { translation: ro },
  },
  lng: "en",
  fallbackLng: "en",
  supportedLngs: ["en", "ro"],
  // No LanguageDetector: ignore navigator / htmlTag / localStorage locale.
  interpolation: {
    escapeValue: false,
  },
});

if (typeof document !== "undefined") {
  document.documentElement.lang = "en";
}

export default i18n;
