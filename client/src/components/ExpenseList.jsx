import React, { useState } from "react";
import { useLanguage } from "../i18n/LanguageContext.jsx";
import ExpenseDetailModal from "./ExpenseDetailModal.jsx";

const CURRENCY_SYMBOL = { EUR: "€", USD: "$", ARS: "AR$" };
const MAX_NAMES_SHOWN = 2;

function ParticipantsSummary({ e, t }) {
  if (e.isTreasury) return <span className="text-slate-600 text-xs">—</span>;
  const names = (e.participants || []).map((p) => p.username);
  if (names.length === 0) return <span className="text-slate-600 text-xs">—</span>;
  const shown = names.slice(0, MAX_NAMES_SHOWN);
  const extra = names.length - shown.length;
  return (
    <span className={names.length > MAX_NAMES_SHOWN ? "text-[11px]" : "text-xs"}>
      {shown.join(", ")}
      {extra > 0 && <span className="text-slate-500"> +{extra} {t("ledger.more")}</span>}
    </span>
  );
}

export default function ExpenseList({ projectId, expenses, canManage, currentUserId, onChanged, onEdit }) {
  const { t } = useLanguage();
  const [categoryFilter, setCategoryFilter] = useState(null);
  const [entityFilter, setEntityFilter] = useState(null);
  const [selected, setSelected] = useState(null);

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
        onClick={(ev) => {
          ev.stopPropagation();
          toggleCategoryFilter(e.categoryName);
        }}
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
        onClick={(ev) => {
          ev.stopPropagation();
          toggleEntityFilter(e.entityName);
        }}
        className={`badge cursor-pointer transition-colors ${
          entityFilter === e.entityName
            ? "border-neon-cyan bg-neon-cyan/20 text-neon-cyan"
            : "border-neon-cyan/50 text-neon-cyan hover:bg-neon-cyan/10"
        } ${className}`}
      >
        {e.entityName}
      </button>
    ) : null;

  const selectedExpense = selected ? filtered.find((e) => e.id === selected) || expenses.find((e) => e.id === selected) : null;

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

      {/* Desktop/tablet: tabla real. Cada fila es clickeable y abre el
          detalle (con opción de editar/borrar desde ahí) en vez de tener
          botones sueltos por fila -- así entran más columnas sin amontonar.
          Las etiquetas de categoría/entidad cortan la propagación del click
          para poder seguir usándose como filtro. */}
      <div className="panel hidden sm:block overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="font-display text-left text-[10px] uppercase tracking-widest text-slate-500 border-b border-ink-700">
              <th className="px-3 py-2 font-normal">{t("ledger.title")}</th>
              <th className="px-3 py-2 font-normal">{t("ledger.category")}</th>
              <th className="px-3 py-2 font-normal hidden md:table-cell">{t("ledger.entity")}</th>
              <th className="px-3 py-2 font-normal hidden md:table-cell">{t("ledger.paidByShort")}</th>
              <th className="px-3 py-2 font-normal hidden lg:table-cell">{t("ledger.forLine")}</th>
              <th className="px-3 py-2 font-normal text-right">{t("ledger.amount")}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((e) => {
              const isReimbursement = e.isReimbursement;
              return (
                <tr
                  key={e.id}
                  onClick={() => setSelected(e.id)}
                  className="border-b border-ink-800 last:border-0 hover:bg-ink-800/40 cursor-pointer align-top"
                >
                  <td className="px-3 py-2">
                    <div className="text-slate-100">{e.title}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">{e.date}</div>
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
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <CategoryTag e={e} />
                      <EntityTag e={e} className="md:hidden" />
                    </div>
                  </td>
                  <td className="px-3 py-2 hidden md:table-cell">
                    <EntityTag e={e} />
                    {!e.entityName && <span className="text-slate-600 text-xs">—</span>}
                  </td>
                  <td className="px-3 py-2 hidden md:table-cell text-slate-300 text-xs">{e.paidByUsername}</td>
                  <td className="px-3 py-2 hidden lg:table-cell">
                    <ParticipantsSummary e={e} t={t} />
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-neon-green whitespace-nowrap">
                    {CURRENCY_SYMBOL[e.currency] || e.currency} {e.amount.toFixed(2)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile: cards clickeables, mismo criterio que la tabla. */}
      <div className="space-y-3 sm:hidden">
        {filtered.map((e) => {
          const isReimbursement = e.isReimbursement;
          return (
            <div
              key={e.id}
              onClick={() => setSelected(e.id)}
              className={`panel p-4 flex flex-col gap-2 cursor-pointer ${
                isReimbursement ? "border-neon-gold/40" : e.isTreasury ? "border-neon-gold/30" : ""
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold text-slate-100">{e.title}</span>
                <span className="font-mono text-neon-green shrink-0">
                  {CURRENCY_SYMBOL[e.currency] || e.currency} {e.amount.toFixed(2)}
                </span>
              </div>
              <p className="text-[10px] text-slate-500">{e.date}</p>
              <div className="flex items-center gap-1.5 flex-wrap">
                {isReimbursement && (
                  <span className="badge border-neon-gold/60 text-neon-gold">
                    🔁 {t("ledger.reimbursementBadge")}
                  </span>
                )}
                <CategoryTag e={e} />
                <EntityTag e={e} />
                {e.isTreasury && (
                  <span className="badge border-neon-gold/60 text-neon-gold">🏦 {t("ledger.treasuryBadge")}</span>
                )}
                {e.installmentTotal && (
                  <span className="badge border-neon-cyan/50 text-neon-cyan">
                    🧾 {e.installmentCurrent}/{e.installmentTotal}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                {t("ledger.paidByShort")} <span className="text-slate-300">{e.paidByUsername}</span>
                {!e.isTreasury && e.participants?.length > 0 && (
                  <>
                    {" "}
                    · {t("ledger.forLine")} <ParticipantsSummary e={e} t={t} />
                  </>
                )}
              </p>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <p className="text-slate-500 text-sm py-8 text-center">{t("ledger.empty")}</p>
      )}

      {selectedExpense && (
        <ExpenseDetailModal
          expense={selectedExpense}
          projectId={projectId}
          canEdit={canManage || selectedExpense.createdBy === currentUserId}
          onClose={() => setSelected(null)}
          onEdit={onEdit}
          onChanged={onChanged}
        />
      )}
    </div>
  );
}
