import React from "react";
import { useLanguage } from "../i18n/LanguageContext.jsx";

export default function LanguageToggle({ className = "" }) {
  const { lang, setLang } = useLanguage();

  return (
    <div className={`inline-flex rounded-lg border border-ink-600 overflow-hidden text-[11px] font-display uppercase tracking-widest ${className}`}>
      <button
        type="button"
        onClick={() => setLang("es")}
        className={`px-2 py-1 transition-colors ${
          lang === "es" ? "bg-neon-cyan/15 text-neon-cyan" : "bg-ink-800 text-slate-500 hover:text-slate-200"
        }`}
      >
        ES
      </button>
      <button
        type="button"
        onClick={() => setLang("en")}
        className={`px-2 py-1 transition-colors ${
          lang === "en" ? "bg-neon-cyan/15 text-neon-cyan" : "bg-ink-800 text-slate-500 hover:text-slate-200"
        }`}
      >
        EN
      </button>
    </div>
  );
}
