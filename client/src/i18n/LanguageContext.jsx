import React, { createContext, useContext, useMemo, useState } from "react";
import { translations } from "./translations.js";

const LanguageContext = createContext(null);
const STORAGE_KEY = "loot_ledger_lang";
const TONE_STORAGE_KEY = "loot_ledger_tone";

function detectDefaultLang() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "es" || stored === "en") return stored;
  } catch {
    /* localStorage no disponible */
  }
  const nav = typeof navigator !== "undefined" ? navigator.language : "es";
  return nav && nav.toLowerCase().startsWith("en") ? "en" : "es";
}

function detectDefaultTone() {
  try {
    const stored = localStorage.getItem(TONE_STORAGE_KEY);
    if (stored === "gamer" || stored === "simple") return stored;
  } catch {
    /* localStorage no disponible */
  }
  return "gamer";
}

function lookup(dict, path) {
  return path.split(".").reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), dict);
}

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(detectDefaultLang);
  const [tone, setToneState] = useState(detectDefaultTone);

  const setLang = (next) => {
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* localStorage no disponible */
    }
  };

  const setTone = (next) => {
    setToneState(next);
    try {
      localStorage.setItem(TONE_STORAGE_KEY, next);
    } catch {
      /* localStorage no disponible */
    }
  };

  const t = useMemo(() => {
    return (key, fallback) => {
      // Modo "simple": los terminos con onda gamer (Loot, Quests, Party, etc.)
      // tienen un diccionario aparte con solo esos overrides -- todo lo demas
      // (botones, formularios) ya es neutral y cae al diccionario normal.
      if (tone === "simple") {
        const simpleValue = lookup(translations[`${lang}_simple`], key);
        if (simpleValue !== undefined) return simpleValue;
      }
      const value = lookup(translations[lang], key);
      if (value !== undefined) return value;
      const esValue = lookup(translations.es, key);
      if (esValue !== undefined) return esValue;
      return fallback !== undefined ? fallback : key;
    };
  }, [lang, tone]);

  // Traduce un error de backend: prioriza el "code" (mapeado en errors.*),
  // y si no hay match usa el texto crudo que ya viene en espanol.
  const tError = (err) => {
    if (err && err.code) {
      const translated = lookup(translations[lang], `errors.${err.code}`);
      if (translated) return translated;
    }
    return (err && err.message) || t("common.error", "Ocurrio un error.");
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, tone, setTone, t, tError }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage debe usarse dentro de LanguageProvider");
  return ctx;
}
