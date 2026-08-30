import React from "react";
import { useLanguage } from "../i18n/LanguageContext.jsx";

export default function StyleToggle({ className = "" }) {
  const { tone, setTone, t } = useLanguage();

  return (
    <div className={`inline-flex rounded-lg border border-ink-600 overflow-hidden text-[11px] font-display uppercase tracking-widest ${className}`}>
      <button
        type="button"
        onClick={() => setTone("gamer")}
        className={`px-2 py-1 transition-colors ${
          tone === "gamer" ? "bg-neon-purple/15 text-neon-purple" : "bg-ink-800 text-slate-500 hover:text-slate-200"
        }`}
      >
        {t("nav.styleGamer")}
      </button>
      <button
        type="button"
        onClick={() => setTone("simple")}
        className={`px-2 py-1 transition-colors ${
          tone === "simple" ? "bg-neon-purple/15 text-neon-purple" : "bg-ink-800 text-slate-500 hover:text-slate-200"
        }`}
      >
        {t("nav.styleSimple")}
      </button>
    </div>
  );
}
