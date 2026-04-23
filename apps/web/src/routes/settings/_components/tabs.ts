export const SETTINGS_TABS = [
  { value: "general", label: "General" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "branding", label: "Branding" },
] as const;

export type SettingsTab = (typeof SETTINGS_TABS)[number]["value"];
