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
  selectedAudienceIds: string[];
  saveAsTemplate: boolean;
  templateName: string;
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
  selectedAudienceIds: [] as string[],
  saveAsTemplate: false,
  templateName: "",
};

export const useWizard = create<WizardState>()(
  persist(
    (set) => ({
      ...initial,
      reset: () => set(initial),
      patch: (p) => set(p),
    }),
    // Bump the persisted key — the shape changed (recipientStatus →
    // selectedAudienceIds) so old localStorage would crash on load.
    { name: "hms-wizard-v2" },
  ),
);
