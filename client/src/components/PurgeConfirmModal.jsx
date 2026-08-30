import React, { useState } from "react";
import { createPortal } from "react-dom";
import { useLanguage } from "../i18n/LanguageContext.jsx";

// Doble confirmación para un borrado definitivo e irreversible: primero
// hay que escribir el nombre exacto para habilitar el botón, y al
// tocarlo todavía aparece el confirm() nativo del navegador como
// segunda barrera.
export default function PurgeConfirmModal({ title, description, confirmWord, onConfirm, onClose }) {
  const { t, tError } = useLanguage();
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const canConfirm = typed.trim() === confirmWord;

  const handleConfirm = async () => {
    if (!canConfirm) return;
    if (!confirm(t("admin.purgeFinalConfirm"))) return;
    setBusy(true);
    setError("");
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      setError(tError(err));
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/70 flex items-start justify-center overflow-y-auto px-4 py-8 z-30">
      <div className="panel p-6 w-full max-w-sm space-y-4 shadow-neon-red border-neon-red/40">
        <h3 className="font-display uppercase tracking-widest text-neon-red text-sm">{title}</h3>
        <p className="text-sm text-slate-300">{description}</p>
        <div>
          <label className="label">
            {t("admin.purgeTypeToConfirm")} <span className="text-neon-red font-mono">{confirmWord}</span>
          </label>
          <input className="field" value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus />
        </div>
        {error && <p className="text-neon-red text-xs">{error}</p>}
        <div className="flex gap-3">
          <button className="btn-danger" disabled={!canConfirm || busy} onClick={handleConfirm}>
            {busy ? t("common.saving") : t("admin.purgeConfirmButton")}
          </button>
          <button className="btn-secondary" onClick={onClose}>
            {t("common.cancel")}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
