// Non-decomposable Latin-extended chars that NFD-stripping misses,
// mostly Turkish + a few other Latin-script languages.
const FOLD_MAP: Record<string, string> = {
  ş: "s", Ş: "s",
  ı: "i", İ: "i",
  ğ: "g", Ğ: "g",
  ç: "c", Ç: "c",
  ü: "u", Ü: "u",
  ö: "o", Ö: "o",
  ä: "a", Ä: "a",
  ñ: "n", Ñ: "n",
  ø: "o", Ø: "o",
  æ: "ae", Æ: "ae",
  œ: "oe", Œ: "oe",
  ß: "ss",
  đ: "d", Đ: "d",
  ł: "l", Ł: "l",
  ș: "s", Ș: "s",
  ț: "t", Ț: "t",
};

/**
 * Fold a string for loose search: lowercase, NFD-strip combining marks,
 * map non-decomposable Latin-extended letters (ş→s, ı→i, ğ→g, …).
 * "Ayşe Yılmaz" becomes "ayse yilmaz" and matches a user typing "ayse".
 */
export function foldForSearch(input: string): string {
  if (!input) return "";
  const folded = input.replace(/[^\u0000-\u007f]/g, (ch) => FOLD_MAP[ch] ?? ch);
  return folded.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/** `needle` and `haystack` both get folded before .includes(). */
export function matchesSearch(haystack: string, needle: string): boolean {
  const n = foldForSearch(needle).trim();
  if (!n) return true;
  return foldForSearch(haystack).includes(n);
}
