import React, { useState } from "react";
import { createPortal } from "react-dom";
import { useLanguage } from "../i18n/LanguageContext.jsx";

// Clona un proyecto individual como uno nuevo, grupal -- elegir si el clon
// arranca con el historial de gastos ya cargado (todos con el mismo
// "pagado por" hasta que alguien los reasigne) o arranca vacío.
export default function CloneProjectModal({ onConfirm, onClose }) {
  const { t, tError } = useLanguage();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const go = async (withExpenses) => {
    setBusy(true);
    setError("");
    try {
      await onConfirm(withExpenses);
    } catch (err) {
      setError(tError(err));
      setBusy(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/70 flex items-start justify-center overflow-y-auto px-4 py-8 z-30">
      <div className="panel p-6 w-full max-w-sm space-y-4 shadow-neon">
        <h3 className="font-display uppercase tracking-widest text-neon-cyan text-sm">
          {t("project.cloneTitle")}
        </h3>
        <p className="text-sm text-slate-300">{t("project.cloneSubtitle")}</p>
        {error && <p className="text-neon-red text-xs">{error}</p>}
        <div className="flex flex-col gap-2">
          <button className="btn-primary" disabled={busy} onClick={() => go(true)}>
            {t("project.cloneWithExpenses")}
          </button>
          <button className="btn-secondary" disabled={busy} onClick={() => go(false)}>
            {t("project.cloneWithoutExpenses")}
          </button>
          <button className="btn-ghost" disabled={busy} onClick={onClose}>
            {t("common.cancel")}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
