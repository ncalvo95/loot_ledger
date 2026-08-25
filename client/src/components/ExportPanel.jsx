import React, { useState } from "react";
import { downloadExport } from "../api.js";

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export default function ExportPanel({ projectId }) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  return (
    <div className="panel p-4 flex flex-wrap items-center gap-3">
      <span className="font-display uppercase tracking-widest text-xs text-slate-400 mr-1">Exportar a Excel</span>
      <button className="btn-secondary !px-3 !py-1.5" onClick={() => downloadExport(projectId, { scope: "all" })}>
        Historico completo
      </button>
      <div className="flex items-center gap-2">
        <select className="field !w-auto !py-1.5" value={month} onChange={(e) => setMonth(e.target.value)}>
          {MONTHS.map((m, idx) => (
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
          Por mes
        </button>
        <button
          className="btn-secondary !px-3 !py-1.5"
          onClick={() => downloadExport(projectId, { scope: "year", year })}
        >
          Por ano
        </button>
      </div>
    </div>
  );
}
