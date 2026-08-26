import React, { useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useLanguage } from "../i18n/LanguageContext.jsx";

export default function ChangePasswordModal({ onClose }) {
  const { changePassword } = useAuth();
  const { t, tError } = useLanguage();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await changePassword(currentPassword, newPassword);
      setDone(true);
    } catch (err) {
      setError(tError(err));
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/70 flex items-start justify-center overflow-y-auto px-4 py-8 z-30">
      <div className="panel p-6 w-full max-w-sm space-y-4 shadow-neon">
        <h3 className="font-display uppercase tracking-widest text-neon-cyan text-sm">
          {t("auth.changePasswordTitle")}
        </h3>
        {done ? (
          <>
            <p className="text-neon-green text-sm">{t("auth.changePasswordDone")}</p>
            <button className="btn-secondary" onClick={onClose}>
              {t("common.close")}
            </button>
          </>
        ) : (
          <form onSubmit={onSubmit} className="space-y-3">
            <div>
              <label className="label">{t("common.currentPassword")}</label>
              <input
                type="password"
                className="field"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            <div>
              <label className="label">{t("common.newPassword")}</label>
              <input
                type="password"
                className="field"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>
            {error && <p className="text-neon-red text-xs">{error}</p>}
            <div className="flex gap-3">
              <button type="submit" disabled={busy} className="btn-primary">
                {busy ? t("common.saving") : t("common.save")}
              </button>
              <button type="button" className="btn-secondary" onClick={onClose}>
                {t("common.cancel")}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
}
