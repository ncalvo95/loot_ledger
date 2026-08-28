import React, { useState } from "react";
import { api } from "../api.js";
import { useLanguage } from "../i18n/LanguageContext.jsx";

export default function EntitiesPanel({ projectId, entities, onChanged }) {
  const { t, tError } = useLanguage();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const [error, setError] = useState("");

  const startEdit = (ent) => {
    setEditingId(ent.id);
    setEditingName(ent.name);
    setError("");
  };

  const saveEdit = async (id) => {
    const trimmed = editingName.trim();
    if (!trimmed) return;
    try {
      await api.patch(`/projects/${projectId}/entities/${id}`, { name: trimmed });
      setEditingId(null);
      onChanged();
    } catch (err) {
      setError(tError(err));
    }
  };

  const remove = async (ent) => {
    if (!confirm(t("ledger.confirmDeleteEntity"))) return;
    setError("");
    try {
      await api.delete(`/projects/${projectId}/entities/${ent.id}`);
      onChanged();
    } catch (err) {
      setError(tError(err));
    }
  };

  return (
    <div className="panel p-4">
      <button
        type="button"
        className="font-display uppercase tracking-widest text-slate-300 text-xs flex items-center gap-2"
        onClick={() => setOpen((o) => !o)}
      >
        {open ? "▾" : "▸"} {t("ledger.manageEntities")}
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {error && <p className="text-neon-red text-xs">{error}</p>}
          {entities.length === 0 && <p className="text-slate-500 text-xs">{t("ledger.noEntitiesYet")}</p>}
          {entities.map((ent) => (
            <div key={ent.id} className="flex items-center gap-2">
              {editingId === ent.id ? (
                <>
                  <input
                    className="field !py-1 flex-1"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    autoFocus
                  />
                  <button className="btn-primary !px-2 !py-1 text-[10px]" onClick={() => saveEdit(ent.id)}>
                    {t("common.save")}
                  </button>
                  <button
                    className="btn-secondary !px-2 !py-1 text-[10px]"
                    onClick={() => setEditingId(null)}
                  >
                    {t("common.cancel")}
                  </button>
                </>
              ) : (
                <>
                  <span className="badge border-neon-cyan/50 text-neon-cyan flex-1">{ent.name}</span>
                  <button className="btn-secondary !px-2 !py-1 text-[10px]" onClick={() => startEdit(ent)}>
                    {t("common.edit")}
                  </button>
                  <button className="btn-danger !px-2 !py-1 text-[10px]" onClick={() => remove(ent)}>
                    {t("common.delete")}
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
