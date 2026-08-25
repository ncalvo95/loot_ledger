import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useLanguage } from "../i18n/LanguageContext.jsx";

export default function ForgotPassword() {
  const { forgotPassword } = useAuth();
  const { t, tError } = useLanguage();
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await forgotPassword(username);
      setSent(true);
    } catch (err) {
      setError(tError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="panel w-full max-w-sm p-8 shadow-neon">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🔑</div>
          <h1 className="title-glow text-xl">{t("auth.forgotTitle")}</h1>
        </div>

        {sent ? (
          <div className="space-y-4 text-center">
            <p className="text-slate-300 text-sm">{t("auth.forgotSent")}</p>
            <Link to="/login" className="btn-secondary inline-flex">
              {t("auth.backToLogin")}
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <p className="text-slate-400 text-sm">{t("auth.forgotBody")}</p>
            <div>
              <label className="label">{t("common.username")}</label>
              <input
                className="field"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
              />
            </div>
            {error && <p className="text-neon-red text-sm">{error}</p>}
            <button type="submit" disabled={busy} className="btn-primary w-full">
              {busy ? t("common.sending") : t("auth.forgotCta")}
            </button>
            <Link to="/login" className="block text-center text-xs text-slate-400 hover:text-neon-cyan">
              {t("auth.backToLogin")}
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
