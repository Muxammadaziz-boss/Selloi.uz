"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { Language, LanguageContextType } from "./types";
import { translations } from "./translations";

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const STORAGE_KEY_LANGUAGE = "ai_sales_language";

export interface LanguageProviderProps {
  children: React.ReactNode;
  initialLanguage?: Language;
}

export function LanguageProvider({
  children,
  initialLanguage = "uz",
}: LanguageProviderProps) {
  const [language, setLanguageState] = useState<Language>(initialLanguage);

  useEffect(() => {
    try {
      const savedLang = localStorage.getItem(STORAGE_KEY_LANGUAGE) as Language | null;
      if (savedLang === "uz" || savedLang === "en") {
        setLanguageState(savedLang);
        document.documentElement.setAttribute("lang", savedLang);
      } else {
        document.documentElement.setAttribute("lang", initialLanguage);
      }
    } catch {
      // Safe fallback for SSR or restricted environments
    }
  }, [initialLanguage]);

  const setLanguage = useCallback((newLang: Language) => {
    setLanguageState(newLang);
    try {
      localStorage.setItem(STORAGE_KEY_LANGUAGE, newLang);
      document.documentElement.setAttribute("lang", newLang);
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      const langDict = translations[language] || translations.uz;
      let text = langDict[key] || translations.uz[key] || key;

      if (params) {
        Object.entries(params).forEach(([paramKey, paramVal]) => {
          text = text.replace(new RegExp(`\\{${paramKey}\\}`, "g"), String(paramVal));
        });
      }

      return text;
    },
    [language]
  );

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      t,
    }),
    [language, setLanguage, t]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextType {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
