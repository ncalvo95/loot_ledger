import React from "react";
import { api } from "../api.js";
import { useLanguage } from "../i18n/LanguageContext.jsx";

const CURRENCY_SYMBOL = { EUR: "€", USD: "$", ARS: "AR$" };

export default function ExpenseList({ projectId, expenses, canManage, currentUserId, onChanged, onEdit }) {
  const { t } = useLanguage();

  const remove = async (id) => {
    if (!confirm(t("ledger.confirmDelete"))) return;
    await api.delete(`/projects/${projectId}/expenses/${id}`);
    onChanged();
  };

  if (expenses.length === 0) {
    return <p className="text-slate-500 text-sm py-8 text-center">{t("ledger.empty")}</p>;
  }

  return (
    <div className="space-y-3">
      {expenses.map((e) => {
        const isReimbursement = e.isReimbursement;
        const canEdit = canManage || e.createdBy === currentUserId;
        return (
          <div
            key={e.id}
            className={`panel p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${
              isReimbursement ? "border-neon-gold/40" : e.isTreasury ? "border-neon-gold/30" : ""
            }`}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-slate-100">{e.title}</span>
                {isReimbursement ? (
                  <span className="badge border-neon-gold/60 text-neon-gold">
                    🔁 {t("ledger.reimbursementBadge")}
                  </span>
                ) : (
                  <span className="badge border-neon-purple/50 text-neon-purple">
                    {e.categoryName || t("ledger.noCategory")}
                  </span>
                )}
                {e.entityName && (
                  <span className="badge border-neon-cyan/50 text-neon-cyan">{e.entityName}</span>
                )}
                {e.isTreasury && (
                  <span className="badge border-neon-gold/60 text-neon-gold">🏦 {t("ledger.treasuryBadge")}</span>
                )}
                {e.installmentTotal && (
                  <span className="badge border-neon-cyan/50 text-neon-cyan">
                    🧾 {t("respawn.installmentBadge")} {e.installmentCurrent}/{e.installmentTotal}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {e.isTreasury ? (
                  <>
                    {e.date} · {t("ledger.chargedByLine")} <span className="text-slate-300">{e.paidByUsername}</span>
                  </>
                ) : (
                  <>
                    {e.date} · {t("ledger.paidByLine")} <span className="text-slate-300">{e.paidByUsername}</span> ·{" "}
                    {t("ledger.forLine")} {e.participants.map((p) => p.username).join(", ")}
                  </>
                )}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <span className="font-mono text-lg text-neon-green">
                {CURRENCY_SYMBOL[e.currency] || e.currency} {e.amount.toFixed(2)}
              </span>
              {canEdit && (
                <button onClick={() => onEdit(e)} className="btn-secondary !px-2 !py-1 text-[10px]">
                  {t("common.edit")}
                </button>
              )}
              {canEdit && (
                <button onClick={() => remove(e.id)} className="btn-danger !px-2 !py-1 text-[10px]">
                  {t("common.delete")}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
