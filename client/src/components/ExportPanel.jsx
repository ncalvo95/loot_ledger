import React, { useState } from "react";
import { downloadExport } from "../api.js";
import { useLanguage } from "../i18n/LanguageContext.jsx";

export default function ExportPanel({ projectId }) {
  const { t } = useLanguage();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const months = t("ledger.months");

  return (
    <div className="panel p-4 flex flex-wrap items-center gap-3">
      <span className="font-display uppercase tracking-widest text-xs text-slate-400 mr-1">
        {t("ledger.exportTitle")}
      </span>
      <button className="btn-secondary !px-3 !py-1.5" onClick={() => downloadExport(projectId, { scope: "all" })}>
        {t("ledger.exportAll")}
      </button>
      <div className="flex items-center gap-2">
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
        <button
          className="btn-secondary !px-3 !py-1.5"
          onClick={() => downloadExport(projectId, { scope: "month", month, year })}
        >
          {t("ledger.exportByMonth")}
        </button>
        <button
          className="btn-secondary !px-3 !py-1.5"
          onClick={() => downloadExport(projectId, { scope: "year", year })}
        >
          {t("ledger.exportByYear")}
        </button>
      </div>
    </div>
  );
}
