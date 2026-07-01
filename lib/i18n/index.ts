import { ar } from "./ar";
import { en } from "./en";

export type Language = "ar" | "en";
export type TranslationKeys = keyof typeof ar;

const translations: Record<Language, Record<string, string>> = {
  ar,
  en,
};

export function getTranslation(lang: Language, key: TranslationKeys): string {
  return translations[lang]?.[key] || translations.ar[key] || key;
}

export function isRTL(lang: Language): boolean {
  return lang === "ar";
}

export { ar, en };
