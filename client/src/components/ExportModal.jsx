import React, { useState } from "react";
import { createPortal } from "react-dom";
import { downloadExport } from "../api.js";
import { useLanguage } from "../i18n/LanguageContext.jsx";

export default function ExportModal({ projectId, onClose }) {
  const { t } = useLanguage();
  const now = new Date();
  const [scope, setScope] = useState("all");
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const months = t("ledger.months");

  const download = () => {
    if (scope === "month") downloadExport(projectId, { scope: "month", month, year });
    else if (scope === "year") downloadExport(projectId, { scope: "year", year });
    else downloadExport(projectId, { scope: "all" });
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/70 flex items-start justify-center overflow-y-auto px-4 py-8 z-30">
      <div className="panel p-6 w-full max-w-sm space-y-4 shadow-neon">
        <h3 className="font-display uppercase tracking-widest text-neon-cyan text-sm">{t("ledger.exportTitle")}</h3>

        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
            <input type="radio" checked={scope === "all"} onChange={() => setScope("all")} />
            {t("ledger.exportAll")}
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
            <input type="radio" checked={scope === "month"} onChange={() => setScope("month")} />
            {t("ledger.exportByMonth")}
          </label>
          {scope === "month" && (
            <div className="flex items-center gap-2 pl-6">
              <select className="field !w-auto !py-1.5" value={month} onChange={(e) => setMonth(e.target.value)}>
                {months.map((m, idx) => (
                  <option key={m} value={idx + 1}>
                    {m}
                  </option>
                ))}
              </select>
              <input
                type="number"
                className="field !w-24 !py-1.5"
                value={year}
                onChange={(e) => setYear(e.target.value)}
              />
            </div>
          )}
          <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
            <input type="radio" checked={scope === "year"} onChange={() => setScope("year")} />
            {t("ledger.exportByYear")}
          </label>
          {scope === "year" && (
            <div className="pl-6">
              <input
                type="number"
                className="field !w-24 !py-1.5"
                value={year}
                onChange={(e) => setYear(e.target.value)}
              />
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-2">
          <button className="btn-primary" onClick={download}>
            {t("ledger.exportDownload")}
          </button>
          <button className="btn-secondary" onClick={onClose}>
            {t("common.cancel")}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
