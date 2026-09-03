import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { useLanguage } from "../i18n/LanguageContext.jsx";
import LanguageToggle from "./LanguageToggle.jsx";
import StyleToggle from "./StyleToggle.jsx";

const CURRENCIES = ["EUR", "USD", "ARS"];

// Dropdown de cuenta ("Consola"/"Configuracion"): agrupa todo lo que es
// preferencia/config personal (idioma, modo gamer/simple, contraseña,
// sesiones, logout) para que la barra de navegacion no tenga un boton
// suelto por cada cosa.
export default function AccountMenu({ onChangePassword, onSessions, onLogout, className = "" }) {
  const { t } = useLanguage();
  const { user, setDefaultCurrency } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const closeAnd = (fn) => () => {
    setOpen(false);
    fn();
  };

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button type="button" onClick={() => setOpen((o) => !o)} className="btn-ghost !px-2 !py-1">
        ⚙ {t("nav.console")} {open ? "▴" : "▾"}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-60 panel p-3 space-y-3 shadow-neon z-30">
          <div className="flex items-center gap-2 flex-wrap">
            <LanguageToggle />
            <StyleToggle />
          </div>
          <div className="border-t border-ink-700 pt-2">
            <label className="label !mb-1">{t("nav.defaultCurrency")}</label>
            <select
              className="field !py-1"
              value={user?.defaultCurrency || "EUR"}
              onChange={(e) => setDefaultCurrency(e.target.value)}
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="border-t border-ink-700 pt-2 space-y-1">
            <button
              type="button"
              onClick={closeAnd(onChangePassword)}
              className="btn-ghost w-full !justify-start !px-2 !py-1.5"
            >
              {t("nav.changePassword")}
            </button>
            <button
              type="button"
              onClick={closeAnd(onSessions)}
              className="btn-ghost w-full !justify-start !px-2 !py-1.5"
            >
              {t("nav.sessions")}
            </button>
          </div>
          <div className="border-t border-ink-700 pt-2">
            <button
              type="button"
              onClick={closeAnd(onLogout)}
              className="btn-ghost w-full !justify-start !px-2 !py-1.5 text-neon-red"
            >
              {t("nav.logout")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
