import React, { useState } from "react";
import { api } from "../api.js";
import { useLanguage } from "../i18n/LanguageContext.jsx";

export default function CategoriesPanel({ projectId, categories, onChanged }) {
  const { t, tError } = useLanguage();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const [error, setError] = useState("");

  const startEdit = (c) => {
    setEditingId(c.id);
    setEditingName(c.name);
    setError("");
  };

  const saveEdit = async (id) => {
    const trimmed = editingName.trim();
    if (!trimmed) return;
    try {
      await api.patch(`/projects/${projectId}/categories/${id}`, { name: trimmed });
      setEditingId(null);
      onChanged();
    } catch (err) {
      setError(tError(err));
    }
  };

  const remove = async (c) => {
    if (!confirm(t("ledger.confirmDeleteCategory"))) return;
    setError("");
    try {
      await api.delete(`/projects/${projectId}/categories/${c.id}`);
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
        {open ? "▾" : "▸"} {t("ledger.manageCategories")}
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {error && <p className="text-neon-red text-xs">{error}</p>}
          {categories.map((c) => (
            <div key={c.id} className="flex items-center gap-2">
              {editingId === c.id ? (
                <>
                  <input
                    className="field !py-1 flex-1"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    autoFocus
                  />
                  <button className="btn-primary !px-2 !py-1 text-[10px]" onClick={() => saveEdit(c.id)}>
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
                  <span className="badge border-neon-purple/50 text-neon-purple flex-1">{c.name}</span>
                  <button className="btn-secondary !px-2 !py-1 text-[10px]" onClick={() => startEdit(c)}>
                    {t("common.edit")}
                  </button>
                  <button className="btn-danger !px-2 !py-1 text-[10px]" onClick={() => remove(c)}>
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
