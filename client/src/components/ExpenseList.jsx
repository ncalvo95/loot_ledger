import React, { useState } from "react";
import { api } from "../api.js";
import { useLanguage } from "../i18n/LanguageContext.jsx";
import { useConfirm } from "../context/ConfirmContext.jsx";

const CURRENCY_SYMBOL = { EUR: "€", USD: "$", ARS: "AR$" };

export default function ExpenseList({ projectId, expenses, canManage, currentUserId, onChanged, onEdit }) {
  const { t } = useLanguage();
  const confirmAction = useConfirm();
  const [categoryFilter, setCategoryFilter] = useState(null);
  const [entityFilter, setEntityFilter] = useState(null);

  const remove = async (id) => {
    if (!(await confirmAction(t("ledger.confirmDelete")))) return;
    await api.delete(`/projects/${projectId}/expenses/${id}`);
    onChanged();
  };

  if (expenses.length === 0) {
    return <p className="text-slate-500 text-sm py-8 text-center">{t("ledger.empty")}</p>;
  }

  const toggleCategoryFilter = (name) => setCategoryFilter((prev) => (prev === name ? null : name));
  const toggleEntityFilter = (name) => setEntityFilter((prev) => (prev === name ? null : name));
  const clearFilters = () => {
    setCategoryFilter(null);
    setEntityFilter(null);
  };

  const filtered = expenses.filter((e) => {
    if (categoryFilter && e.categoryName !== categoryFilter) return false;
    if (entityFilter && e.entityName !== entityFilter) return false;
    return true;
  });

  const CategoryTag = ({ e, className = "" }) =>
    e.categoryName ? (
      <button
        type="button"
        onClick={() => toggleCategoryFilter(e.categoryName)}
        className={`badge cursor-pointer transition-colors ${
          categoryFilter === e.categoryName
            ? "border-neon-purple bg-neon-purple/20 text-neon-purple"
            : "border-neon-purple/50 text-neon-purple hover:bg-neon-purple/10"
        } ${className}`}
      >
        {e.categoryName}
      </button>
    ) : (
      <span className={`text-slate-600 text-xs ${className}`}>{t("ledger.noCategory")}</span>
    );

  const EntityTag = ({ e, className = "" }) =>
    e.entityName ? (
      <button
        type="button"
        onClick={() => toggleEntityFilter(e.entityName)}
        className={`badge cursor-pointer transition-colors ${
          entityFilter === e.entityName
            ? "border-neon-cyan bg-neon-cyan/20 text-neon-cyan"
            : "border-neon-cyan/50 text-neon-cyan hover:bg-neon-cyan/10"
        } ${className}`}
      >
        {e.entityName}
      </button>
    ) : null;

  return (
    <div className="space-y-3">
      {(categoryFilter || entityFilter) && (
        <div className="flex items-center gap-2 flex-wrap text-xs text-slate-400">
          <span>{t("ledger.filteringBy")}</span>
          {categoryFilter && (
            <span className="badge border-neon-purple/60 text-neon-purple">{categoryFilter}</span>
          )}
          {entityFilter && <span className="badge border-neon-cyan/60 text-neon-cyan">{entityFilter}</span>}
          <button className="btn-ghost !px-2 !py-0.5 text-[10px]" onClick={clearFilters}>
            {t("ledger.clearFilter")}
          </button>
        </div>
      )}

      {/* Desktop/tablet: tabla real, con las etiquetas de categoría/entidad
          funcionando como botón de filtro (clic activa/desactiva). En
          mobile se reemplaza por las cards de siempre -- una tabla angosta
          ahí sería ilegible. */}
      <div className="panel hidden sm:block overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-widest text-slate-500 border-b border-ink-700">
              <th className="px-3 py-2 font-normal">{t("ledger.date")}</th>
              <th className="px-3 py-2 font-normal">{t("ledger.title")}</th>
              <th className="px-3 py-2 font-normal">{t("ledger.category")}</th>
              <th className="px-3 py-2 font-normal hidden md:table-cell">{t("ledger.entity")}</th>
              <th className="px-3 py-2 font-normal hidden lg:table-cell">{t("ledger.paidBy")}</th>
              <th className="px-3 py-2 font-normal text-right">{t("ledger.amount")}</th>
              <th className="px-3 py-2 font-normal"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((e) => {
              const isReimbursement = e.isReimbursement;
              const canEdit = canManage || e.createdBy === currentUserId;
              return (
                <tr key={e.id} className="border-b border-ink-800 last:border-0 hover:bg-ink-800/40 align-top">
                  <td className="px-3 py-2 text-xs text-slate-500 whitespace-nowrap">{e.date}</td>
                  <td className="px-3 py-2">
                    <div className="text-slate-100">{e.title}</div>
                    <div className="flex items-center gap-1.5 flex-wrap mt-1">
                      {isReimbursement && (
                        <span className="badge border-neon-gold/60 text-neon-gold">
                          🔁 {t("ledger.reimbursementBadge")}
                        </span>
                      )}
                      {e.isTreasury && (
                        <span className="badge border-neon-gold/60 text-neon-gold">
                          🏦 {t("ledger.treasuryBadge")}
                        </span>
                      )}
                      {e.installmentTotal && (
                        <span className="badge border-neon-cyan/50 text-neon-cyan">
                          🧾 {e.installmentCurrent}/{e.installmentTotal}
                        </span>
                      )}
                    </div>
                    <div
                      className="text-[10px] text-slate-500 mt-1 md:hidden"
                      title={e.isTreasury ? undefined : `${t("ledger.forLine")} ${e.participants.map((p) => p.username).join(", ")}`}
                    >
                      <EntityTag e={e} />
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <CategoryTag e={e} />
                  </td>
                  <td className="px-3 py-2 hidden md:table-cell">
                    <EntityTag e={e} />
                  </td>
                  <td
                    className="px-3 py-2 hidden lg:table-cell text-slate-300 text-xs"
                    title={
                      e.isTreasury
                        ? undefined
                        : `${t("ledger.forLine")} ${e.participants.map((p) => p.username).join(", ")}`
                    }
                  >
                    {e.paidByUsername}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-neon-green whitespace-nowrap">
                    {CURRENCY_SYMBOL[e.currency] || e.currency} {e.amount.toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    {canEdit && (
                      <div className="flex items-center justify-end gap-1.5">
                        <button onClick={() => onEdit(e)} className="btn-secondary !px-2 !py-1 text-[10px]">
                          {t("common.edit")}
                        </button>
                        <button onClick={() => remove(e.id)} className="btn-danger !px-2 !py-1 text-[10px]">
                          {t("common.delete")}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile: cards (igual que antes), con las mismas etiquetas
          clickeables para filtrar. */}
      <div className="space-y-3 sm:hidden">
        {filtered.map((e) => {
          const isReimbursement = e.isReimbursement;
          const canEdit = canManage || e.createdBy === currentUserId;
          return (
            <div
              key={e.id}
              className={`panel p-4 flex flex-col gap-3 ${
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
                    <CategoryTag e={e} />
                  )}
                  <EntityTag e={e} />
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
              <div className="flex items-center justify-between gap-3">
                <span className="font-mono text-lg text-neon-green">
                  {CURRENCY_SYMBOL[e.currency] || e.currency} {e.amount.toFixed(2)}
                </span>
                {canEdit && (
                  <div className="flex items-center gap-2">
                    <button onClick={() => onEdit(e)} className="btn-secondary !px-2 !py-1 text-[10px]">
                      {t("common.edit")}
                    </button>
                    <button onClick={() => remove(e.id)} className="btn-danger !px-2 !py-1 text-[10px]">
                      {t("common.delete")}
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <p className="text-slate-500 text-sm py-8 text-center">{t("ledger.empty")}</p>
      )}
    </div>
  );
}
