import type { Language } from "./index";

/**
 * Use this for screen-specific copy that is not yet part of the short global
 * dictionary. It keeps Arabic and English text together at the call site,
 * which prevents a screen from silently falling back to Arabic in English mode.
 */
export function localize(
  language: Language,
  arabic: string,
  english: string,
): string {
  return language === "en" ? english : arabic;
}

export function isEnglish(language: Language): boolean {
  return language === "en";
}

export function writingDirection(language: Language): "rtl" | "ltr" {
  return language === "en" ? "ltr" : "rtl";
}

export function textAlignFor(language: Language): "left" | "right" {
  return language === "en" ? "left" : "right";
}

/** Labels for stable system codes. User-entered names are intentionally not
 * machine-translated: they remain the exact data entered by the business. */
export const custodyStageEnglish: Record<string, string> = {
  production: "Production",
  rosso: "Rosso",
  qalb: "Qalb",
  antislip: "Anti-slip",
  kawiya: "Ironing",
  inspection: "Inspection",
  packing: "Packing",
  storage: "Storage & Finished Goods",
  followup: "Follow-up",
  customer_service: "Customer Service",
};

export const custodyStatusEnglish: Record<string, string> = {
  pending: "Pending receipt",
  received: "Received",
  working: "In progress",
  paused: "Paused",
  completed: "Completed",
  sent: "Sent — pending confirmation",
  confirmed: "Confirmed",
  rejected: "Rejected",
  disputed: "Quantity discrepancy",
  closed: "Closed",
  stored: "Stored in finished goods",
  destroyed: "Destroyed",
};

export const custodyQualityEnglish: Record<string, string> = {
  first: "First grade",
  second: "Second grade",
  suspected: "Suspected",
  damaged: "Damaged",
};

export const departmentEnglish: Record<string, string> = {
  production: "Production",
  sales: "Sales & Marketing",
  customer_service: "Customer Service",
  rosso: "Rosso",
  qalb: "Qalb",
  antislip: "Anti-slip",
  kawiya: "Ironing",
  inspection: "Inspection",
  packing: "Packing",
  storage: "Storage",
  followup: "Follow-up",
  administrative: "Administration",
  executive_management: "Executive Management",
  board_chair: "Chairman of the Board",
};

/** Stable business terms that may arrive from older Arabic records. */
const dataEnglish: Record<string, string> = {
  "أبيض": "White",
  "اسود": "Black",
  "أسود": "Black",
  "أحمر": "Red",
  "أزرق": "Blue",
  "أخضر": "Green",
  "أصفر": "Yellow",
  "بنفسجي": "Purple",
  "رمادي": "Gray",
  "بيج": "Beige",
  "بني": "Brown",
  "وردي": "Pink",
  "برتقالي": "Orange",
  "قطن": "Cotton",
  "بامبو": "Bamboo",
  "نايلون": "Nylon",
  "مطاط": "Rubber",
  "إسباندكس": "Spandex",
  "سباندكس": "Spandex",
  "نخب أول": "First grade",
  "نخب ثاني": "Second grade",
  "فرد": "Individual",
  "مؤسسة": "Company",
  "شركة": "Company",
  "عميل": "Customer",
  "مندوب": "Representative",
  "مدير": "Manager",
  "موظف": "Employee",
  "الإنتاج": "Production",
  "قسم الإنتاج": "Production",
  "المبيعات": "Sales",
  "التسويق والمبيعات": "Sales & Marketing",
  "خدمة العملاء": "Customer Service",
  "المستودعات": "Warehouses",
  "المستودع": "Warehouse",
  "التخزين": "Storage",
  "الفحص": "Inspection",
  "التغليف": "Packing",
  "الكاوية": "Ironing",
  "القلب": "Qalb",
  "الروسو": "Rosso",
  "مانع الانزلاق": "Anti-slip",
};

const arabicLetters: Record<string, string> = {
  "ا": "a", "أ": "a", "إ": "i", "آ": "aa", "ب": "b", "ت": "t", "ث": "th",
  "ج": "j", "ح": "h", "خ": "kh", "د": "d", "ذ": "dh", "ر": "r", "ز": "z",
  "س": "s", "ش": "sh", "ص": "s", "ض": "d", "ط": "t", "ظ": "z", "ع": "a",
  "غ": "gh", "ف": "f", "ق": "q", "ك": "k", "ل": "l", "م": "m", "ن": "n",
  "ه": "h", "ة": "h", "و": "w", "ؤ": "w", "ي": "y", "ى": "a", "ئ": "y",
  "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4", "٥": "5", "٦": "6",
  "٧": "7", "٨": "8", "٩": "9",
};

/**
 * English-mode display only. It translates known operational values and
 * transliterates any remaining Arabic names so English users never receive an
 * Arabic-only record. The database value itself is never changed.
 */
export function englishDataDisplay(value: unknown): string {
  const source = String(value ?? "").trim();
  if (!source) return source;
  const exact = dataEnglish[source];
  if (exact) return exact;
  const canonical = source.replace(/[ًٌٍَُِّْـ]/g, "");
  if (dataEnglish[canonical]) return dataEnglish[canonical];
  if (!/[\u0600-\u06ff]/.test(source)) return source;
  return canonical
    .split(/(\s+|[\/،,;:()\-]+)/)
    .map((part) => {
      if (!/[\u0600-\u06ff]/.test(part)) return part;
      const translated = dataEnglish[part];
      if (translated) return translated;
      const latin = Array.from(part).map((char) => arabicLetters[char] ?? char).join("");
      return latin ? latin.charAt(0).toUpperCase() + latin.slice(1) : part;
    })
    .join("");
}

export function displayData(language: Language, value: unknown): string {
  return language === "en" ? englishDataDisplay(value) : String(value ?? "");
}

/** Returns an English-safe visual value for a legacy text node on web only. */
export function translateWebDisplayText(value: string): string {
  return englishDataDisplay(value);
}
