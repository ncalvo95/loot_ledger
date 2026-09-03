import React, { useEffect, useState } from "react";
import { api } from "../api.js";
import { useLanguage } from "../i18n/LanguageContext.jsx";

const CURRENCIES = [
  { code: "EUR", label: "EUR - Euro" },
  { code: "USD", label: "USD - Dolar" },
  { code: "ARS", label: "ARS - Peso Argentino" },
];
const CURRENCY_SYMBOL = { EUR: "€", USD: "$", ARS: "AR$" };

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function TreasuryPanel({ projectId }) {
  const { t, tError } = useLanguage();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);

  const [concept, setConcept] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today());
  const [categoryId, setCategoryId] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const res = await api.get(`/projects/${projectId}/treasury`);
    setData(res);
  };

  useEffect(() => {
    load().catch((err) => setError(tError(err)));
  }, [projectId]);

  const resetForm = () => {
    setConcept("");
    setAmount("");
    setCategoryId("");
    setNewCategory("");
    setDate(today());
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const payload = { concept, currency, amount, date };
      if (newCategory.trim()) payload.categoryName = newCategory.trim();
      else if (categoryId) payload.categoryId = Number(categoryId);
      await api.post(`/projects/${projectId}/treasury/contributions`, payload);
      resetForm();
      setShowForm(false);
      await load();
    } catch (err) {
      setError(tError(err));
    } finally {
      setBusy(false);
    }
  };

  const removeContribution = async (id) => {
    if (!confirm(t("treasury.confirmDelete"))) return;
    try {
      await api.delete(`/projects/${projectId}/treasury/contributions/${id}`);
      await load();
    } catch (err) {
      setError(tError(err));
    }
  };

  if (!data) return <p className="text-slate-500 text-sm py-8 text-center">{t("common.loading")}</p>;

  return (
    <div className="space-y-5">
      <div className="grid sm:grid-cols-2 gap-3">
        {data.balance.length === 0 ? (
          <p className="text-slate-500 text-sm py-4 text-center col-span-2">{t("treasury.empty")}</p>
        ) : (
          data.balance.map((b) => {
            const negative = b.balanceCents < 0;
            return (
              <div
                key={b.currency}
                className={`panel p-4 flex items-center justify-between ${negative ? "border-neon-red/40" : "border-neon-green/40"}`}
              >
                <span className="font-display uppercase tracking-widest text-xs text-slate-400">
                  {CURRENCY_SYMBOL[b.currency] || b.currency} {b.currency}
                </span>
                <span className={`font-mono font-bold text-lg ${negative ? "text-neon-red" : "text-neon-green"}`}>
                  {b.balance.toFixed(2)}
                </span>
              </div>
            );
          })
        )}
      </div>

      {!showForm && (
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          + {t("treasury.addFunds")}
        </button>
      )}

      {showForm && (
        <form onSubmit={submit} className="panel p-5 space-y-4 border-neon-green/30">
          <h3 className="font-display uppercase tracking-widest text-neon-green text-sm">{t("treasury.addFunds")}</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">{t("treasury.concept")}</label>
              <input
                className="field"
                value={concept}
                onChange={(e) => setConcept(e.target.value)}
                placeholder={t("treasury.conceptPlaceholder")}
                required
              />
            </div>
            <div>
              <label className="label">{t("ledger.amount")}</label>
              <div className="flex gap-2">
                <select className="field w-32" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  className="field"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  required
                />
              </div>
            </div>
            <div>
              <label className="label">{t("ledger.category")}</label>
              <select
                className="field"
                value={newCategory ? "" : categoryId}
                onChange={(e) => {
                  setCategoryId(e.target.value);
                  setNewCategory("");
                }}
                disabled={!!newCategory}
              >
                <option value="">{t("ledger.noCategory")}</option>
                {data.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <input
                className="field mt-2"
                placeholder={t("ledger.newCategoryPlaceholder")}
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
              />
            </div>
            <div>
              <label className="label">{t("ledger.date")}</label>
              <input type="date" className="field" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
          </div>
          {error && <p className="text-neon-red text-sm">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={busy} className="btn-primary">
              {busy ? t("common.saving") : t("common.confirm")}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                resetForm();
                setShowForm(false);
              }}
            >
              {t("common.cancel")}
            </button>
          </div>
        </form>
      )}

      {error && !showForm && <p className="text-neon-red text-sm">{error}</p>}

      {data.movements.length === 0 ? (
        <p className="text-slate-500 text-sm py-8 text-center">{t("treasury.noMovements")}</p>
      ) : (
        <div className="panel p-4">
          <p className="text-xs font-display uppercase tracking-widest text-slate-400 mb-3">{t("treasury.movements")}</p>
          <ul className="space-y-2">
            {data.movements.map((m) => {
              const isContribution = m.kind === "contribution";
              return (
                <li
                  key={`${m.kind}-${m.id}`}
                  className="flex items-center justify-between gap-3 flex-wrap text-sm bg-ink-800/60 rounded-lg px-3 py-2"
                >
                  <div className="min-w-0">
                    <span className="text-slate-200">{m.concept}</span>
                    {m.categoryName && (
                      <span className="badge border-neon-purple/50 text-neon-purple ml-2">{m.categoryName}</span>
                    )}
                    <p className="text-xs text-slate-500 mt-0.5">
                      {m.date} · {m.username}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`font-mono font-bold ${isContribution ? "text-neon-green" : "text-neon-red"}`}>
                      {isContribution ? "+" : "-"}
                      {m.amount.toFixed(2)} {m.currency}
                    </span>
                    {isContribution && (
                      <button
                        className="btn-danger !px-2 !py-1 text-[10px]"
                        onClick={() => removeContribution(m.id)}
                      >
                        {t("common.delete")}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
