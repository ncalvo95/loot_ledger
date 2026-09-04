import React from "react";
import { useLanguage } from "../i18n/LanguageContext.jsx";

export default function HelpToggle({ className = "" }) {
  const { showHelp, setShowHelp, t } = useLanguage();

  return (
    <label className={`flex items-center gap-2 text-xs text-slate-400 select-none cursor-pointer ${className}`}>
      <input type="checkbox" checked={showHelp} onChange={(e) => setShowHelp(e.target.checked)} />
      {t("nav.showHelp")}
    </label>
  );
}
