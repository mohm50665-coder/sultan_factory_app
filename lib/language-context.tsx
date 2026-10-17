import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { I18nManager, Platform } from "react-native";
import { type Language, type TranslationKeys, getTranslation, isRTL } from "./i18n";
import { translateWebDisplayText } from "./i18n/runtime";

interface LanguageContextType {
  language: Language;
  isRtl: boolean;
  t: (key: TranslationKeys) => string;
  setLanguage: (lang: Language) => Promise<void>;
  toggleLanguage: () => Promise<void>;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const LANGUAGE_KEY = "app_language";

/**
 * Legacy screens still contain fixed Arabic React Native Web text. This web
 * presentation layer keeps English mode readable while each screen migrates to
 * explicit bilingual copy. Inputs and editable regions are excluded so no
 * user-entered value is ever mutated.
 */
function applyWebLanguagePresentation(language: Language) {
  if (Platform.OS !== "web" || typeof document === "undefined") return () => {};
  const root = document.documentElement;
  root.lang = language === "en" ? "en" : "ar";
  root.dir = language === "en" ? "ltr" : "rtl";
  root.dataset.language = language;
  const originals = new Map<Text, string>();

  const isEditable = (node: Node | null) => {
    const parent = node?.parentElement;
    return Boolean(parent?.closest("input, textarea, select, [contenteditable='true']"));
  };
  const translateNode = (node: Node) => {
    if (language !== "en" || node.nodeType !== Node.TEXT_NODE || isEditable(node)) return;
    const textNode = node as Text;
    const source = textNode.textContent || "";
    if (!/[\u0600-\u06ff]/.test(source)) return;
    const translated = translateWebDisplayText(source);
    if (translated !== source) {
      originals.set(textNode, source);
      textNode.textContent = translated;
    }
  };
  const translateTree = (rootNode: Node) => {
    translateNode(rootNode);
    rootNode.childNodes.forEach(translateTree);
  };
  if (language === "en") translateTree(document.body);
  const observer = new MutationObserver((records) => {
    if (language !== "en") return;
    for (const record of records) {
      record.addedNodes.forEach(translateTree);
      if (record.type === "characterData") translateNode(record.target);
    }
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  return () => {
    observer.disconnect();
    originals.forEach((source, textNode) => {
      if (textNode.isConnected) textNode.textContent = source;
    });
  };
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("ar");

  useEffect(() => {
    loadLanguage();
  }, []);

  useEffect(() => applyWebLanguagePresentation(language), [language]);

  const loadLanguage = async () => {
    try {
      const saved = await AsyncStorage.getItem(LANGUAGE_KEY);
      if (saved === "ar" || saved === "en") {
        setLanguageState(saved);
      }
    } catch (error) {
      // Silently fail - default to Arabic
    }
  };

  const setLanguage = useCallback(async (lang: Language) => {
    try {
      await AsyncStorage.setItem(LANGUAGE_KEY, lang);
      setLanguageState(lang);
    } catch (error) {
      // Silently fail
    }
  }, []);

  const toggleLanguage = useCallback(async () => {
    const newLang = language === "ar" ? "en" : "ar";
    await setLanguage(newLang);
  }, [language, setLanguage]);

  const t = useCallback(
    (key: TranslationKeys) => getTranslation(language, key),
    [language]
  );

  const isRtl = isRTL(language);

  return (
    <LanguageContext.Provider value={{ language, isRtl, t, setLanguage, toggleLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
