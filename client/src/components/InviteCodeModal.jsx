import React, { useState } from "react";
import { createPortal } from "react-dom";
import { useLanguage } from "../i18n/LanguageContext.jsx";

// Muestra un codigo de invitacion recien generado, con boton de copiar.
// El codigo no se vuelve a mostrar despues de cerrar este modal -- si se
// pierde, hay que generar uno nuevo desde el panel.
export default function InviteCodeModal({ title, code, onClose }) {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard no disponible -- el usuario lo copia a mano */
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/70 flex items-start justify-center overflow-y-auto px-4 py-8 z-30">
      <div className="panel p-6 w-full max-w-sm space-y-4 shadow-neon-purple">
        <h3 className="font-display uppercase tracking-widest text-neon-purple text-sm">{title}</h3>
        <p className="text-sm text-slate-300">{t("admin.inviteCodeWarning")}</p>
        <div className="flex items-center gap-2">
          <code className="field flex-1 font-mono text-xs break-all select-all">{code}</code>
          <button type="button" className="btn-secondary !px-3 !py-2 shrink-0" onClick={copy}>
            {copied ? t("admin.copied") : t("admin.copy")}
          </button>
        </div>
        <button type="button" className="btn-primary w-full" onClick={onClose}>
          {t("common.close")}
        </button>
      </div>
    </div>,
    document.body
  );
}
