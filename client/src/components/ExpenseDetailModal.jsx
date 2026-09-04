import React from "react";
import { createPortal } from "react-dom";
import { api } from "../api.js";
import { useLanguage } from "../i18n/LanguageContext.jsx";
import { useConfirm } from "../context/ConfirmContext.jsx";
import { useToast } from "../context/ToastContext.jsx";

const CURRENCY_SYMBOL = { EUR: "€", USD: "$", ARS: "AR$" };

export default function ExpenseDetailModal({ expense, projectId, canEdit, onClose, onEdit, onChanged }) {
  const { t, tError } = useLanguage();
  const confirmAction = useConfirm();
  const showError = useToast();

  const remove = async () => {
    if (!(await confirmAction(t("ledger.confirmDelete")))) return;
    try {
      await api.delete(`/projects/${projectId}/expenses/${expense.id}`);
      onChanged();
      onClose();
    } catch (err) {
      showError(tError(err));
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 bg-black/70 flex items-start justify-center overflow-y-auto px-4 py-8 z-30"
      onClick={onClose}
    >
      <div className="panel p-6 w-full max-w-md space-y-4 shadow-neon" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display font-bold text-lg text-slate-100">{expense.title}</h3>
          <button className="text-slate-500 hover:text-slate-200 shrink-0" onClick={onClose} aria-label={t("common.close")}>
            ✕
          </button>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {expense.isReimbursement && (
            <span className="badge border-neon-gold/60 text-neon-gold">🔁 {t("ledger.reimbursementBadge")}</span>
          )}
          {expense.categoryName && (
            <span className="badge border-neon-purple/50 text-neon-purple">{expense.categoryName}</span>
          )}
          {expense.entityName && <span className="badge border-neon-cyan/50 text-neon-cyan">{expense.entityName}</span>}
          {expense.isTreasury && (
            <span className="badge border-neon-gold/60 text-neon-gold">🏦 {t("ledger.treasuryBadge")}</span>
          )}
          {expense.installmentTotal && (
            <span className="badge border-neon-cyan/50 text-neon-cyan">
              🧾 {expense.installmentCurrent}/{expense.installmentTotal}
            </span>
          )}
        </div>

        <div className="space-y-1.5 text-sm text-slate-400">
          <p>
            {t("ledger.date")}: <span className="text-slate-200">{expense.date}</span>
          </p>
          <p>
            {expense.isTreasury ? t("ledger.chargedByLine") : t("ledger.paidByLine")}:{" "}
            <span className="text-slate-200">{expense.paidByUsername}</span>
          </p>
          {!expense.isTreasury && expense.participants?.length > 0 && (
            <p>
              {t("ledger.forLine")}:{" "}
              <span className="text-slate-200">{expense.participants.map((p) => p.username).join(", ")}</span>
            </p>
          )}
        </div>

        <p className="font-mono text-2xl text-neon-green">
          {CURRENCY_SYMBOL[expense.currency] || expense.currency} {expense.amount.toFixed(2)}
        </p>

        {canEdit && (
          <div className="flex gap-3 pt-2">
            <button
              className="btn-secondary"
              onClick={() => {
                onClose();
                onEdit(expense);
              }}
            >
              {t("common.edit")}
            </button>
            <button className="btn-danger" onClick={remove}>
              {t("common.delete")}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
