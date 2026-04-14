export const SUPPORTED_LANGUAGES = ["en", "tr", "fa", "ar"] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

export const LANGUAGE_LABELS: Record<Language, string> = {
  en: "English",
  tr: "Türkçe",
  fa: "فارسی",
  ar: "العربية",
};

export const RTL_LANGUAGES = new Set<Language>(["fa", "ar"]);
