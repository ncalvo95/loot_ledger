import React, { useState } from "react";
import { api } from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useLanguage } from "../i18n/LanguageContext.jsx";
import { useToast } from "../context/ToastContext.jsx";

const CURRENCIES = [
  { code: "EUR", label: "EUR - Euro" },
  { code: "USD", label: "USD - Dolar" },
  { code: "ARS", label: "ARS - Peso Argentino" },
];

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function ExpenseForm({
  projectId,
  members,
  categories,
  entities,
  editingExpense,
  individual,
  onCreated,
  onCancel,
}) {
  const { t, tError } = useLanguage();
  const showError = useToast();
  const { user } = useAuth();
  const [categoryId, setCategoryId] = useState(editingExpense?.categoryId || "");
  const [newCategory, setNewCategory] = useState("");
  const [entityId, setEntityId] = useState(editingExpense?.entityId || "");
  const [newEntity, setNewEntity] = useState("");
  const [title, setTitle] = useState(editingExpense?.title || "");
  const [currency, setCurrency] = useState(editingExpense?.currency || user?.defaultCurrency || "EUR");
  const [amount, setAmount] = useState(editingExpense ? String(editingExpense.amount) : "");
  const [paidBy, setPaidBy] = useState(editingExpense?.paidBy || members[0]?.id || "");
  const [date, setDate] = useState(editingExpense?.date || today());
  const [participantIds, setParticipantIds] = useState(
    editingExpense ? editingExpense.participants.map((p) => p.userId) : members.map((m) => m.id)
  );
  const [paidByTreasury, setPaidByTreasury] = useState(!!editingExpense?.isTreasury);
  const [busy, setBusy] = useState(false);
  const hideSplit = individual || paidByTreasury;

  const toggleParticipant = (id) => {
    setParticipantIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const reset = () => {
    setTitle("");
    setAmount("");
    setNewCategory("");
    setEntityId("");
    setNewEntity("");
    setParticipantIds(members.map((m) => m.id));
    setDate(today());
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!hideSplit && participantIds.length === 0) {
      showError(t("ledger.forWhomError"));
      return;
    }
    setBusy(true);
    try {
      const payload = {
        title,
        currency,
        amount,
        paidBy: Number(paidBy),
        date,
        participantIds,
        paidByTreasury: !individual && paidByTreasury,
      };
      if (newCategory.trim()) {
        payload.categoryName = newCategory.trim();
      } else if (categoryId) {
        payload.categoryId = Number(categoryId);
      }
      if (newEntity.trim()) {
        payload.entityName = newEntity.trim();
      } else if (entityId) {
        payload.entityId = Number(entityId);
      }
      if (editingExpense) {
        await api.put(`/projects/${projectId}/expenses/${editingExpense.id}`, payload);
      } else {
        await api.post(`/projects/${projectId}/expenses`, payload);
        reset();
      }
      onCreated();
    } catch (err) {
      showError(tError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="panel p-5 space-y-4 border-neon-green/30">
      <h3 className="font-display uppercase tracking-widest text-neon-green text-sm">
        {editingExpense ? t("ledger.editExpense") : t("ledger.newExpense")}
      </h3>

      <div className="grid sm:grid-cols-2 gap-4">
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
            {categories.map((c) => (
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
          <label className="label">{t("ledger.entity")}</label>
          <select
            className="field"
            value={newEntity ? "" : entityId}
            onChange={(e) => {
              setEntityId(e.target.value);
              setNewEntity("");
            }}
            disabled={!!newEntity}
          >
            <option value="">{t("ledger.noEntity")}</option>
            {entities.map((ent) => (
              <option key={ent.id} value={ent.id}>
                {ent.name}
              </option>
            ))}
          </select>
          <input
            className="field mt-2"
            placeholder={t("ledger.newEntityPlaceholder")}
            value={newEntity}
            onChange={(e) => setNewEntity(e.target.value)}
          />
        </div>

        <div>
          <label className="label">{t("ledger.title")}</label>
          <input
            className="field"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("ledger.titlePlaceholder")}
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

        {!individual && (
          <div>
            <label className="label">{t("ledger.paidBy")}</label>
            <select className="field" value={paidBy} onChange={(e) => setPaidBy(e.target.value)}>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.username}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="label">{t("ledger.date")}</label>
          <input type="date" className="field" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
      </div>

      {!individual && (
        <label className="flex items-center gap-2 text-sm text-slate-300 select-none cursor-pointer">
          <input
            type="checkbox"
            checked={paidByTreasury}
            onChange={(e) => setPaidByTreasury(e.target.checked)}
          />
          {t("ledger.paidByTreasury")}
        </label>
      )}

      {!hideSplit && (
        <div>
          <label className="label">{t("ledger.forWhom")}</label>
          <div className="flex flex-wrap gap-2">
            {members.map((m) => {
              const checked = participantIds.includes(m.id);
              return (
                <label
                  key={m.id}
                  className={`badge cursor-pointer select-none ${
                    checked
                      ? "border-neon-cyan/70 text-neon-cyan bg-neon-cyan/10"
                      : "border-ink-600 text-slate-400 hover:border-slate-400"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="hidden"
                    checked={checked}
                    onChange={() => toggleParticipant(m.id)}
                  />
                  {checked ? "✓ " : ""}
                  {m.username}
                </label>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={busy} className="btn-primary">
          {busy ? t("common.saving") : editingExpense ? t("common.save") : t("ledger.addExpense")}
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => {
            reset();
            onCancel();
          }}
        >
          {t("common.cancel")}
        </button>
      </div>
    </form>
  );
}
