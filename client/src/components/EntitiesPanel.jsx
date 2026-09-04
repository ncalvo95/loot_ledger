import React, { useState } from "react";
import { api } from "../api.js";
import { useLanguage } from "../i18n/LanguageContext.jsx";
import { useConfirm } from "../context/ConfirmContext.jsx";
import { useToast } from "../context/ToastContext.jsx";

export default function EntitiesPanel({ projectId, entities, onChanged }) {
  const { t, tError } = useLanguage();
  const confirmAction = useConfirm();
  const showError = useToast();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);

  const startEdit = (ent) => {
    setEditingId(ent.id);
    setEditingName(ent.name);
  };

  const saveEdit = async (id) => {
    const trimmed = editingName.trim();
    if (!trimmed) return;
    try {
      await api.patch(`/projects/${projectId}/entities/${id}`, { name: trimmed });
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
      await api.post(`/projects/${projectId}/entities`, { name: trimmed });
      setNewName("");
      onChanged();
    } catch (err) {
      showError(tError(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (ent) => {
    if (!(await confirmAction(t("ledger.confirmDeleteEntity")))) return;
    try {
      await api.delete(`/projects/${projectId}/entities/${ent.id}`);
      onChanged();
    } catch (err) {
      showError(tError(err));
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
          <form onSubmit={create} className="flex items-center gap-2 pt-1">
            <input
              className="field !py-1 flex-1"
              placeholder={t("ledger.newEntityPlaceholder")}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <button type="submit" disabled={busy || !newName.trim()} className="btn-primary !px-2 !py-1 text-[10px]">
              {t("common.add")}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
