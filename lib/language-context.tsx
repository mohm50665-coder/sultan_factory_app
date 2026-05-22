import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { I18nManager, Platform } from "react-native";
import { type Language, type TranslationKeys, getTranslation, isRTL } from "./i18n";

interface LanguageContextType {
  language: Language;
  isRtl: boolean;
  t: (key: TranslationKeys) => string;
  setLanguage: (lang: Language) => Promise<void>;
  toggleLanguage: () => Promise<void>;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const LANGUAGE_KEY = "app_language";

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("ar");

  useEffect(() => {
    loadLanguage();
  }, []);

  const loadLanguage = async () => {
    try {
      const saved = await AsyncStorage.getItem(LANGUAGE_KEY);
      if (saved === "ar" || saved === "en") {
        setLanguageState(saved);
        applyRTL(saved);
      }
    } catch (error) {
      console.error("Failed to load language:", error);
    }
  };

  const applyRTL = (lang: Language) => {
    const rtl = isRTL(lang);
    if (Platform.OS !== "web") {
      if (I18nManager.isRTL !== rtl) {
        I18nManager.allowRTL(rtl);
        I18nManager.forceRTL(rtl);
      }
    }
  };

  const setLanguage = useCallback(async (lang: Language) => {
    try {
      await AsyncStorage.setItem(LANGUAGE_KEY, lang);
      setLanguageState(lang);
      applyRTL(lang);
    } catch (error) {
      console.error("Failed to save language:", error);
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
