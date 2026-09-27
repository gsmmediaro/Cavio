"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  DEFAULT_SETTINGS_SECTION,
  type CavioSettingsSection,
} from "@/components/settings/settings-constants";

type OpenOptions = {
  section?: CavioSettingsSection;
};

type SettingsModalContextValue = {
  isOpen: boolean;
  section: CavioSettingsSection;
  openSettings: (options?: OpenOptions) => void;
  closeSettings: () => void;
  setSection: (section: CavioSettingsSection) => void;
};

const SettingsModalContext = createContext<SettingsModalContextValue | null>(null);

export function SettingsModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [section, setSectionState] = useState<CavioSettingsSection>(
    DEFAULT_SETTINGS_SECTION
  );

  const openSettings = useCallback((options?: OpenOptions) => {
    if (options?.section) {
      setSectionState(options.section);
    }
    setIsOpen(true);
  }, []);

  const closeSettings = useCallback(() => {
    setIsOpen(false);
  }, []);

  const setSection = useCallback((next: CavioSettingsSection) => {
    setSectionState(next);
  }, []);

  const value = useMemo(
    () => ({ isOpen, section, openSettings, closeSettings, setSection }),
    [isOpen, section, openSettings, closeSettings, setSection]
  );

  return (
    <SettingsModalContext.Provider value={value}>{children}</SettingsModalContext.Provider>
  );
}

export function useSettingsModal(): SettingsModalContextValue {
  const ctx = useContext(SettingsModalContext);
  if (!ctx) {
    throw new Error("useSettingsModal must be used within SettingsModalProvider");
  }
  return ctx;
}
