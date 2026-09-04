import React, { useState } from "react";
import { api } from "../api.js";
import { useLanguage } from "../i18n/LanguageContext.jsx";
import { useConfirm } from "../context/ConfirmContext.jsx";
import { useToast } from "../context/ToastContext.jsx";

// Contenido de la ventana "Categorías" -- el modal en sí (título, botón de
// cerrar) lo arma ProjectPage, esto es solo la lista + alta/edición/borrado.
export default function CategoriesPanel({ projectId, categories, onChanged }) {
  const { t, tError } = useLanguage();
  const confirmAction = useConfirm();
  const showError = useToast();
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);

  const startEdit = (c) => {
    setEditingId(c.id);
    setEditingName(c.name);
  };

  const saveEdit = async (id) => {
    const trimmed = editingName.trim();
    if (!trimmed) return;
    try {
      await api.patch(`/projects/${projectId}/categories/${id}`, { name: trimmed });
      setEditingId(null);
      onChanged();
    } catch (err) {
      showError(tError(err));
    }
  };

  const create = async (e) => {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      await api.post(`/projects/${projectId}/categories`, { name: trimmed });
      setNewName("");
      onChanged();
    } catch (err) {
      showError(tError(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (c) => {
    if (!(await confirmAction(t("ledger.confirmDeleteCategory")))) return;
    try {
      await api.delete(`/projects/${projectId}/categories/${c.id}`);
      onChanged();
    } catch (err) {
      showError(tError(err));
    }
  };

  return (
    <div className="space-y-2">
      {categories.length === 0 && <p className="text-slate-500 text-xs">{t("ledger.noCategoriesYet")}</p>}
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
              <button className="btn-secondary !px-2 !py-1 text-[10px]" onClick={() => setEditingId(null)}>
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
      <form onSubmit={create} className="flex items-center gap-2 pt-1">
        <input
          className="field !py-1 flex-1"
          placeholder={t("ledger.newCategoryPlaceholder")}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <button type="submit" disabled={busy || !newName.trim()} className="btn-primary !px-2 !py-1 text-[10px]">
          {t("common.add")}
        </button>
      </form>
    </div>
  );
}
