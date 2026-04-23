export const SETTINGS_TABS = [
  { value: "general", label: "General" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "branding", label: "Branding" },
  { value: "modules", label: "Modules" },
] as const;

export type SettingsTab = (typeof SETTINGS_TABS)[number]["value"];
