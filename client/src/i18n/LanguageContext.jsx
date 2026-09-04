import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { translations } from "./translations.js";

const LanguageContext = createContext(null);
const STORAGE_KEY = "loot_ledger_lang";
const TONE_STORAGE_KEY = "loot_ledger_tone";
const THEME_STORAGE_KEY = "loot_ledger_theme";
const SHOW_HELP_STORAGE_KEY = "loot_ledger_show_help";

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

// El default es "dark" (la estética de siempre) para no sorprender a nadie
// -- el modo claro es opt-in. index.html tiene un script inline que aplica
// esto mismo ANTES de que React monte, para no mostrar un flash oscuro
// cuando alguien ya había elegido claro.
function detectDefaultTheme() {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "dark" || stored === "light") return stored;
  } catch {
    /* localStorage no disponible */
  }
  return "dark";
}

// Ayuda contextual (una línea explicando qué es el Fondo común, etc.):
// arranca activada, a diferencia de tema/tono, porque Recurrentes ya
// mostraba su propio texto de ayuda antes de que existiera este toggle
// -- que arranque apagada sería sacarle algo a quien ya lo tenía.
function detectDefaultShowHelp() {
  try {
    const stored = localStorage.getItem(SHOW_HELP_STORAGE_KEY);
    if (stored === "on" || stored === "off") return stored === "on";
  } catch {
    /* localStorage no disponible */
  }
  return true;
}

function lookup(dict, path) {
  return path.split(".").reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), dict);
}

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(detectDefaultLang);
  const [tone, setToneState] = useState(detectDefaultTone);
  const [theme, setThemeState] = useState(detectDefaultTheme);
  const [showHelp, setShowHelpState] = useState(detectDefaultShowHelp);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    const meta = document.getElementById("theme-color-meta");
    if (meta) meta.setAttribute("content", theme === "light" ? "#f6f8fb" : "#07070c");
  }, [theme]);

  // El modo Simple también afloja la estética (ver index.css) -- mismo
  // mecanismo de atributo en <html> que el tema claro/oscuro.
  useEffect(() => {
    document.documentElement.dataset.tone = tone;
  }, [tone]);

  const setTheme = (next) => {
    setThemeState(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* localStorage no disponible */
    }
  };

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

  const setShowHelp = (next) => {
    setShowHelpState(next);
    try {
      localStorage.setItem(SHOW_HELP_STORAGE_KEY, next ? "on" : "off");
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
    <LanguageContext.Provider
      value={{ lang, setLang, tone, setTone, theme, setTheme, showHelp, setShowHelp, t, tError }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage debe usarse dentro de LanguageProvider");
  return ctx;
}
