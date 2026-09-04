import React, { createContext, useCallback, useContext, useState } from "react";
import { createPortal } from "react-dom";
import { useLanguage } from "../i18n/LanguageContext.jsx";

const ConfirmContext = createContext(null);

// Reemplazo del confirm() nativo del navegador (gris, sin estilo) por un
// modal con la estética de la app. Se usa como una promesa, igual que
// confirm(): const ok = await confirmAction(mensaje); if (!ok) return;
// Un solo modal compartido para toda la app, en vez de que cada componente
// arme el suyo -- así queda consistente en todos lados con un solo lugar
// para tocar el estilo.
export function ConfirmProvider({ children }) {
  const { t } = useLanguage();
  const [state, setState] = useState(null);

  const confirmAction = useCallback(
    (message, opts = {}) => {
      return new Promise((resolve) => {
        setState({
          message,
          danger: opts.danger !== false,
          confirmLabel: opts.confirmLabel || t("common.delete"),
          cancelLabel: opts.cancelLabel || t("common.cancel"),
          resolve,
        });
      });
    },
    [t]
  );

  const close = (result) => {
    state?.resolve(result);
    setState(null);
  };

  return (
    <ConfirmContext.Provider value={confirmAction}>
      {children}
      {state &&
        createPortal(
          <div className="fixed inset-0 bg-black/70 flex items-start justify-center overflow-y-auto px-4 py-8 z-40">
            <div
              className={`panel p-6 w-full max-w-sm space-y-4 ${
                state.danger ? "shadow-neon-red border-neon-red/40" : "shadow-neon"
              }`}
            >
              <p className="text-sm text-slate-200">{state.message}</p>
              <div className="flex gap-3">
                <button
                  autoFocus
                  className={state.danger ? "btn-danger" : "btn-primary"}
                  onClick={() => close(true)}
                >
                  {state.confirmLabel}
                </button>
                <button className="btn-secondary" onClick={() => close(false)}>
                  {state.cancelLabel}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm debe usarse dentro de ConfirmProvider");
  return ctx;
}
