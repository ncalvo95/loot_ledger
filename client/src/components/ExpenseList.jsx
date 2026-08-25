import React from "react";
import { api } from "../api.js";

const CURRENCY_SYMBOL = { EUR: "€", USD: "$", ARS: "AR$" };

export default function ExpenseList({ projectId, expenses, canManage, currentUserId, onChanged }) {
  const remove = async (id) => {
    if (!confirm("Eliminar este gasto? Esta accion no se puede deshacer.")) return;
    await api.delete(`/projects/${projectId}/expenses/${id}`);
    onChanged();
  };

  if (expenses.length === 0) {
    return <p className="text-slate-500 text-sm py-8 text-center">Sin gastos registrados todavia. ¡A cargar loot!</p>;
  }

  return (
    <div className="space-y-3">
      {expenses.map((e) => {
        const isReimbursement = e.categoryName === "Reembolso";
        const canDelete = canManage || e.createdBy === currentUserId;
        return (
          <div
            key={e.id}
            className={`panel p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${
              isReimbursement ? "border-neon-gold/40" : ""
            }`}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-slate-100">{e.title}</span>
                <span
                  className={`badge ${
                    isReimbursement
                      ? "border-neon-gold/60 text-neon-gold"
                      : "border-neon-purple/50 text-neon-purple"
                  }`}
                >
                  {e.categoryName}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {e.date} · Pago <span className="text-slate-300">{e.paidByUsername}</span> · Para{" "}
                {e.participants.map((p) => p.username).join(", ")}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <span className="font-mono text-lg text-neon-green">
                {CURRENCY_SYMBOL[e.currency] || e.currency} {e.amount.toFixed(2)}
              </span>
              {canDelete && (
                <button onClick={() => remove(e.id)} className="btn-danger !px-2 !py-1 text-[10px]">
                  Borrar
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
