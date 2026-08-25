import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useLanguage } from "../i18n/LanguageContext.jsx";
import LanguageToggle from "../components/LanguageToggle.jsx";

const USERNAME_RULE = /^[A-Za-z0-9._-]{4,10}$/;
const PASSWORD_RULE = /^[A-Za-z0-9._-]{6,16}$/;

export default function Register() {
  const { register } = useAuth();
  const { t, tError } = useLanguage();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!USERNAME_RULE.test(username)) {
      setError(t("auth.usernameRule"));
      return;
    }
    if (!PASSWORD_RULE.test(password)) {
      setError(t("auth.passwordRule"));
      return;
    }
    if (password !== confirm) {
      setError(t("auth.passwordMismatch"));
      return;
    }
    setBusy(true);
    try {
      const data = await register(username, password);
      if (data.status === "pending") {
        setPending(true);
      } else {
        navigate("/");
      }
    } catch (err) {
      setError(tError(err));
    } finally {
      setBusy(false);
    }
  };

  if (pending) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="panel w-full max-w-sm p-8 shadow-neon-purple text-center space-y-4">
          <div className="text-4xl">⏳</div>
          <h1 className="title-glow text-xl">{t("auth.pendingTitle")}</h1>
          <p className="text-slate-300 text-sm">{t("auth.pendingBody")}</p>
          <Link to="/login" className="btn-secondary inline-flex">
            {t("auth.backToLogin")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative">
      <div className="absolute top-4 right-4">
        <LanguageToggle />
      </div>
      <div className="panel w-full max-w-sm p-8 shadow-neon-purple">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🎲</div>
          <h1 className="title-glow text-2xl">{t("auth.createCharacter")}</h1>
          <p className="text-slate-400 text-sm mt-1">{t("auth.register")}</p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="label">{t("common.username")}</label>
            <input
              className="field"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={t("auth.usernameHint")}
              autoComplete="username"
              required
            />
          </div>
          <div>
            <label className="label">{t("common.password")}</label>
            <input
              type="password"
              className="field"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("auth.passwordHint")}
              autoComplete="new-password"
              required
            />
          </div>
          <div>
            <label className="label">{t("common.confirmPassword")}</label>
            <input
              type="password"
              className="field"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              required
            />
          </div>
          {error && <p className="text-neon-red text-sm">{error}</p>}
          <button type="submit" disabled={busy} className="btn-primary w-full">
            {busy ? t("auth.registerBusy") : t("auth.registerCta")}
          </button>
        </form>
        <p className="text-center text-sm text-slate-400 mt-6">
          {t("auth.haveAccount")}{" "}
          <Link to="/login" className="text-neon-cyan hover:underline">
            {t("auth.login")}
          </Link>
        </p>
      </div>
    </div>
  );
}
