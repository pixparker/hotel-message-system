import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Language } from "@hms/shared";

export interface WizardState {
  step: number;
  title: string;
  mode: "template" | "custom";
  templateId: string | null;
  customBodies: Partial<Record<Language, string>>;
  primaryLanguage: Language;
  recipientStatus: "checked_in" | "checked_out";
  reset: () => void;
  patch: (p: Partial<Omit<WizardState, "reset" | "patch">>) => void;
}

const initial = {
  step: 1,
  title: "",
  mode: "template" as const,
  templateId: null,
  customBodies: {},
  primaryLanguage: "en" as Language,
  recipientStatus: "checked_in" as const,
};

export const useWizard = create<WizardState>()(
  persist(
    (set) => ({
      ...initial,
      reset: () => set(initial),
      patch: (p) => set(p),
    }),
    { name: "hms-wizard" },
  ),
);
