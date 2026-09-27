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
        description: "Balance, usage, and top-ups",
        icon: Wallet01Icon,
      },
      {
        id: "billing",
        label: "Plans",
        description: "Credit packs and upgrade",
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
  credits: "Scan credit balance, pack size, and Stripe top-ups.",
  billing: "Choose a credit pack — Notra-style plan cards, Cavio Stripe backend.",
  account: "Profile, email, and account information.",
  language: "Interface language for Cavio.",
};

export const DEFAULT_SETTINGS_SECTION: CavioSettingsSection = "credits";
