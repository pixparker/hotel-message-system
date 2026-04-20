/**
 * Sample hotel fixture — used by self-serve signup (opt-in) and by tests.
 * Kept as TypeScript (not JSON) so the structure is type-checked.
 */

export interface SampleContact {
  name: string;
  phoneE164: string;
  language: "en" | "tr" | "fa";
  roomNumber?: string;
  status?: "checked_in" | "checked_out";
}

/** @deprecated use SampleContact */
export type SampleGuest = SampleContact;

export interface SampleTemplate {
  name: string;
  description: string;
  bodies: Array<{ language: "en" | "tr" | "fa"; body: string }>;
}

export const SAMPLE_CONTACTS: SampleContact[] = [
  { name: "Ayşe Yılmaz", phoneE164: "+905321112233", language: "tr", roomNumber: "204" },
  { name: "John Parker", phoneE164: "+14155552671", language: "en", roomNumber: "312" },
  { name: "Farhad Karimi", phoneE164: "+989121234567", language: "fa", roomNumber: "508" },
  { name: "Marta Silva", phoneE164: "+351912345678", language: "en" },
  { name: "Mehmet Demir", phoneE164: "+905331234567", language: "tr", roomNumber: "221" },
  { name: "Sara Ahmadi", phoneE164: "+989351112233", language: "fa", roomNumber: "417" },
  { name: "Liam O'Brien", phoneE164: "+353851234567", language: "en", roomNumber: "108" },
  { name: "Nora Schmidt", phoneE164: "+491751234567", language: "en", roomNumber: "605" },
  { name: "Ali Reza", phoneE164: "+989121119988", language: "fa", roomNumber: "302" },
  { name: "Zeynep Kaya", phoneE164: "+905551119988", language: "tr", roomNumber: "412" },
  { name: "Emma Walsh", phoneE164: "+14085551211", language: "en", roomNumber: "219" },
  { name: "Takeshi Sato", phoneE164: "+819012345678", language: "en", roomNumber: "507" },
  { name: "Isabella Rossi", phoneE164: "+393931234567", language: "en", roomNumber: "113" },
  { name: "David Cohen", phoneE164: "+447700900123", language: "en", status: "checked_out" },
  { name: "Lucia Fernández", phoneE164: "+34612345678", language: "en", status: "checked_out" },
];

/** @deprecated use SAMPLE_CONTACTS */
export const SAMPLE_GUESTS = SAMPLE_CONTACTS;

export const SAMPLE_TEMPLATES: SampleTemplate[] = [
  {
    name: "Welcome to the hotel",
    description: "Sent on check-in.",
    bodies: [
      {
        language: "en",
        body: "Welcome! Your Wi-Fi password is GUEST2026. Reception is open 24/7 — just reply to this message if you need anything.",
      },
      {
        language: "tr",
        body: "Hoş geldiniz! Wi-Fi şifreniz: GUEST2026. Her türlü ihtiyacınız için bu mesaja yanıt verebilirsiniz.",
      },
      {
        language: "fa",
        body: "خوش آمدید! رمز وای‌فای: GUEST2026. برای هر درخواستی کافیست همین پیام را پاسخ دهید.",
      },
    ],
  },
  {
    name: "Breakfast reminder",
    description: "Morning reminder for the restaurant hours.",
    bodies: [
      {
        language: "en",
        body: "Good morning! Breakfast is served in the main restaurant from 07:00 to 10:30. Have a lovely day.",
      },
      {
        language: "tr",
        body: "Günaydın! Kahvaltı ana restoranda 07:00-10:30 arasında servis edilmektedir. İyi günler dileriz.",
      },
      {
        language: "fa",
        body: "صبح بخیر! صبحانه در رستوران اصلی از ساعت ۷:۰۰ تا ۱۰:۳۰ سرو می‌شود. روز خوبی داشته باشید.",
      },
    ],
  },
  {
    name: "Late checkout offer",
    description: "Offered the morning of departure.",
    bodies: [
      {
        language: "en",
        body: "Hope you enjoyed your stay! Late checkout until 14:00 is available for €25 — reply YES to confirm.",
      },
      {
        language: "tr",
        body: "Umarız konaklamanız güzel geçmiştir! 14:00'e kadar geç çıkış 25€ karşılığında mümkün — onaylamak için EVET yazın.",
      },
      {
        language: "fa",
        body: "امیدواریم از اقامت خود لذت برده باشید! ترک اتاق تا ۱۴:۰۰ به قیمت ۲۵ یورو امکان‌پذیر است — برای تأیید بله ارسال کنید.",
      },
    ],
  },
];
