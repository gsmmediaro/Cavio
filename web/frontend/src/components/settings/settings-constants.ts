import {
  CreditCardIcon,
  Globe02Icon,
  UserCircleIcon,
  Wallet01Icon,
} from "@hugeicons/core-free-icons";
export type CavioSettingsSection = "credits" | "billing" | "account" | "language";

export type SettingsNavItem = {
  id: CavioSettingsSection;
  label: string;
  description: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: any;
};

export type SettingsNavGroup = {
  id: string;
  label: string;
  items: SettingsNavItem[];
};

/** Slimmed Notra SETTINGS_NAV_GROUPS for Cavio (credits/billing/account/language). */
export const CAVIO_SETTINGS_NAV_GROUPS: readonly SettingsNavGroup[] = [
  {
    id: "billing",
    label: "Billing",
    items: [
      {
        id: "credits",
        label: "Credits",
        description: "Balance, usage, and subscriptions",
        icon: Wallet01Icon,
      },
      {
        id: "billing",
        label: "Plans",
        description: "Subscribe monthly or yearly",
        icon: CreditCardIcon,
      },
    ],
  },
  {
    id: "account",
    label: "Account",
    items: [
      {
        id: "account",
        label: "Account",
        description: "Profile and login details",
        icon: UserCircleIcon,
      },
      {
        id: "language",
        label: "Language",
        description: "Interface language",
        icon: Globe02Icon,
      },
    ],
  },
];

export const CAVIO_SETTINGS_LABELS: Record<CavioSettingsSection, string> = {
  credits: "Credits",
  billing: "Plans",
  account: "Account",
  language: "Language",
};

export const CAVIO_SETTINGS_DESCRIPTIONS: Record<CavioSettingsSection, string> = {
  credits: "Scan credit balance and subscription allotment.",
  billing: "Subscribe to Starter, Pro, or Clinic. Monthly or yearly, like Notra.",
  account: "Profile, email, and account information.",
  language: "Interface language for Cavio.",
};

export const DEFAULT_SETTINGS_SECTION: CavioSettingsSection = "credits";
