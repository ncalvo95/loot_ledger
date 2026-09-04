import React from "react";
import { useLanguage } from "../i18n/LanguageContext.jsx";

export default function ThemeToggle({ className = "" }) {
  const { theme, setTheme, t } = useLanguage();

  return (
    <div className={`inline-flex rounded-lg border border-ink-600 overflow-hidden text-[11px] font-display uppercase tracking-widest ${className}`}>
      <button
        type="button"
        onClick={() => setTheme("dark")}
        className={`px-2 py-1 transition-colors ${
          theme === "dark" ? "bg-neon-purple/15 text-neon-purple" : "bg-ink-800 text-slate-500 hover:text-slate-200"
        }`}
      >
        🌙 {t("nav.themeDark")}
      </button>
      <button
        type="button"
        onClick={() => setTheme("light")}
        className={`px-2 py-1 transition-colors ${
          theme === "light" ? "bg-neon-purple/15 text-neon-purple" : "bg-ink-800 text-slate-500 hover:text-slate-200"
        }`}
      >
        ☀️ {t("nav.themeLight")}
      </button>
    </div>
  );
}
