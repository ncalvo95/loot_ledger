import React, { useEffect, useState } from "react";
import { api } from "../api.js";
import { useLanguage } from "../i18n/LanguageContext.jsx";

const CURRENCIES = [
  { code: "EUR", label: "EUR - Euro" },
  { code: "USD", label: "USD - Dolar" },
  { code: "ARS", label: "ARS - Peso Argentino" },
];
const CURRENCY_SYMBOL = { EUR: "€", USD: "$", ARS: "AR$" };

function emptyForm(members, individual) {
  return {
    title: "",
    categoryId: "",
    newCategory: "",
    entityId: "",
    newEntity: "",
    currency: "EUR",
    amount: "",
    paidBy: members[0]?.id || "",
    dayOfMonth: "1",
    paidByTreasury: false,
    participantIds: individual ? [] : members.map((m) => m.id),
  };
}

export default function RespawnPanel({ projectId, members, categories, entities, individual, canManage }) {
  const { t, tError } = useLanguage();
  const [rules, setRules] = useState(null);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm(members, individual));
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const res = await api.get(`/projects/${projectId}/recurring`);
    setRules(res.rules);
  };

  useEffect(() => {
    load().catch((err) => setError(tError(err)));
  }, [projectId]);

  const toggleParticipant = (id) => {
    setForm((f) => ({
      ...f,
      participantIds: f.participantIds.includes(id)
        ? f.participantIds.filter((x) => x !== id)
        : [...f.participantIds, id],
    }));
  };

  const startCreate = () => {
    setEditingId(null);
    setForm(emptyForm(members, individual));
    setShowForm(true);
  };

  const startEdit = (rule) => {
    setEditingId(rule.id);
    setForm({
      title: rule.title,
      categoryId: rule.categoryId || "",
      newCategory: "",
      entityId: rule.entityId || "",
      newEntity: "",
      currency: rule.currency,
      amount: String(rule.amount),
      paidBy: rule.paidBy,
      dayOfMonth: String(rule.dayOfMonth),
      paidByTreasury: rule.isTreasury,
      participantIds: rule.participantIds,
    });
    setShowForm(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    const hideSplit = individual || form.paidByTreasury;
    if (!hideSplit && form.participantIds.length === 0) {
      setError(t("ledger.forWhomError"));
      return;
    }
    setBusy(true);
    try {
      const payload = {
        title: form.title,
        currency: form.currency,
        amount: form.amount,
        paidBy: Number(form.paidBy),
        dayOfMonth: Number(form.dayOfMonth),
        participantIds: form.participantIds,
        paidByTreasury: !individual && form.paidByTreasury,
      };
      if (form.newCategory.trim()) payload.categoryName = form.newCategory.trim();
      else if (form.categoryId) payload.categoryId = Number(form.categoryId);
      if (form.newEntity.trim()) payload.entityName = form.newEntity.trim();
      else if (form.entityId) payload.entityId = Number(form.entityId);

      if (editingId) {
        await api.patch(`/projects/${projectId}/recurring/${editingId}`, payload);
      } else {
        await api.post(`/projects/${projectId}/recurring`, payload);
      }
      setShowForm(false);
      setEditingId(null);
      await load();
    } catch (err) {
      setError(tError(err));
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (rule) => {
    try {
      await api.patch(`/projects/${projectId}/recurring/${rule.id}`, { active: !rule.active });
      await load();
    } catch (err) {
      setError(tError(err));
    }
  };

  const remove = async (rule) => {
    if (!confirm(t("respawn.confirmDelete"))) return;
    try {
      await api.delete(`/projects/${projectId}/recurring/${rule.id}`);
      await load();
    } catch (err) {
      setError(tError(err));
    }
  };

  if (!rules) return <p className="text-slate-500 text-sm py-8 text-center">{t("common.loading")}</p>;

  const hideSplit = individual || form.paidByTreasury;

  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-400">{t("respawn.subtitle")}</p>

      {canManage && !showForm && (
        <button className="btn-primary" onClick={startCreate}>
          + {t("respawn.newRule")}
        </button>
      )}

      {showForm && (
        <form onSubmit={submit} className="panel p-5 space-y-4 border-neon-green/30">
          <h3 className="font-display uppercase tracking-widest text-neon-green text-sm">
            {editingId ? t("respawn.editRule") : t("respawn.newRule")}
          </h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">{t("ledger.title")}</label>
              <input
                className="field"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder={t("ledger.titlePlaceholder")}
                required
              />
            </div>
            <div>
              <label className="label">{t("ledger.amount")}</label>
              <div className="flex gap-2">
                <select
                  className="field w-32"
                  value={form.currency}
                  onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                >
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
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                  placeholder="0.00"
                  required
                />
              </div>
            </div>
            <div>
              <label className="label">{t("ledger.category")}</label>
              <select
                className="field"
                value={form.newCategory ? "" : form.categoryId}
                onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value, newCategory: "" }))}
                disabled={!!form.newCategory}
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
                value={form.newCategory}
                onChange={(e) => setForm((f) => ({ ...f, newCategory: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">{t("ledger.entity")}</label>
              <select
                className="field"
                value={form.newEntity ? "" : form.entityId}
                onChange={(e) => setForm((f) => ({ ...f, entityId: e.target.value, newEntity: "" }))}
                disabled={!!form.newEntity}
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
                value={form.newEntity}
                onChange={(e) => setForm((f) => ({ ...f, newEntity: e.target.value }))}
              />
            </div>
            {!individual && (
              <div>
                <label className="label">{t("ledger.paidBy")}</label>
                <select
                  className="field"
                  value={form.paidBy}
                  onChange={(e) => setForm((f) => ({ ...f, paidBy: e.target.value }))}
                >
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.username}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="label">{t("respawn.dayOfMonth")}</label>
              <input
                type="number"
                min="1"
                max="31"
                className="field"
                value={form.dayOfMonth}
                onChange={(e) => setForm((f) => ({ ...f, dayOfMonth: e.target.value }))}
                required
              />
              <p className="text-xs text-slate-500 mt-1">{t("respawn.dayOfMonthHint")}</p>
            </div>
          </div>

          {!individual && (
            <label className="flex items-center gap-2 text-sm text-slate-300 select-none cursor-pointer">
              <input
                type="checkbox"
                checked={form.paidByTreasury}
                onChange={(e) => setForm((f) => ({ ...f, paidByTreasury: e.target.checked }))}
              />
              {t("ledger.paidByTreasury")}
            </label>
          )}

          {!hideSplit && (
            <div>
              <label className="label">{t("ledger.forWhom")}</label>
              <div className="flex flex-wrap gap-2">
                {members.map((m) => {
                  const checked = form.participantIds.includes(m.id);
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

          {error && <p className="text-neon-red text-sm">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={busy} className="btn-primary">
              {busy ? t("common.saving") : t("common.save")}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
              }}
            >
              {t("common.cancel")}
            </button>
          </div>
        </form>
      )}

      {error && !showForm && <p className="text-neon-red text-sm">{error}</p>}

      {rules.length === 0 ? (
        <p className="text-slate-500 text-sm py-8 text-center">{t("respawn.empty")}</p>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className={`panel p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${
                rule.active ? "" : "opacity-50"
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-slate-100">{rule.title}</span>
                  {rule.categoryName && (
                    <span className="badge border-neon-purple/50 text-neon-purple">{rule.categoryName}</span>
                  )}
                  {rule.isTreasury && (
                    <span className="badge border-neon-gold/60 text-neon-gold">🏦 {t("ledger.treasuryBadge")}</span>
                  )}
                  {!rule.active && (
                    <span className="badge border-slate-600 text-slate-500">{t("respawn.paused")}</span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {t("respawn.dayLabel")} {rule.dayOfMonth} · {t("ledger.paidByLine")}{" "}
                  <span className="text-slate-300">{rule.paidByUsername}</span>
                  {!rule.isTreasury && !individual && (
                    <>
                      {" "}
                      · {rule.participantIds.length} {t("respawn.people")}
                    </>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-lg text-neon-green">
                  {CURRENCY_SYMBOL[rule.currency] || rule.currency} {rule.amount.toFixed(2)}
                </span>
                {canManage && (
                  <>
                    <button className="btn-secondary !px-2 !py-1 text-[10px]" onClick={() => toggleActive(rule)}>
                      {rule.active ? t("respawn.pause") : t("respawn.resume")}
                    </button>
                    <button className="btn-secondary !px-2 !py-1 text-[10px]" onClick={() => startEdit(rule)}>
                      {t("common.edit")}
                    </button>
                    <button className="btn-danger !px-2 !py-1 text-[10px]" onClick={() => remove(rule)}>
                      {t("common.delete")}
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
