import React, { createContext, useCallback, useContext, useState } from "react";
import { createPortal } from "react-dom";

const ToastContext = createContext(null);
let idCounter = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showError = useCallback(
    (message) => {
      const id = ++idCounter;
      setToasts((prev) => [...prev, { id, message }]);
      setTimeout(() => dismiss(id), 5000);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={showError}>
      {children}
      {createPortal(
        <div className="fixed bottom-4 right-4 left-4 sm:left-auto z-50 flex flex-col items-end gap-2 pointer-events-none">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              role="alert"
              className="panel border-neon-red/50 shadow-neon-red px-4 py-3 flex items-start gap-3 text-sm text-slate-100 w-full sm:w-auto sm:max-w-sm pointer-events-auto"
            >
              <span className="text-neon-red shrink-0">⚠</span>
              <span className="flex-1">{toast.message}</span>
              <button
                className="text-slate-500 hover:text-slate-200 shrink-0 leading-none"
                onClick={() => dismiss(toast.id)}
                aria-label="✕"
              >
                ✕
              </button>
            </div>
          ))}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast debe usarse dentro de ToastProvider");
  return ctx;
}
