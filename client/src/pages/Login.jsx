import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useLanguage } from "../i18n/LanguageContext.jsx";
import LanguageToggle from "../components/LanguageToggle.jsx";
import PasswordInput from "../components/PasswordInput.jsx";

export default function Login() {
  const { login } = useAuth();
  const { t, tError } = useLanguage();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(username, password, remember);
      navigate("/");
    } catch (err) {
      setError(tError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative">
      <div className="absolute top-4 right-4">
        <LanguageToggle />
      </div>
      <div className="panel w-full max-w-sm p-8 shadow-neon">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🕹️</div>
          <h1 className="title-glow text-2xl">{t("appName")}</h1>
          <p className="text-slate-400 text-sm mt-1">{t("auth.login")}</p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
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
          <div>
            <label className="label">{t("common.password")}</label>
            <PasswordInput
              className="field"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-300 select-none cursor-pointer">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            {t("auth.rememberMe")}
          </label>
          {error && <p className="text-neon-red text-sm">{error}</p>}
          <button type="submit" disabled={busy} className="btn-primary w-full">
            {busy ? t("auth.loginBusy") : t("auth.loginCta")}
          </button>
        </form>
        <div className="flex items-center justify-between mt-4 text-xs">
          <Link to="/forgot-password" className="text-slate-400 hover:text-neon-cyan">
            {t("auth.forgotPassword")}
          </Link>
        </div>
        <p className="text-center text-sm text-slate-400 mt-6">
          {t("auth.noAccount")}{" "}
          <Link to="/register" className="text-neon-cyan hover:underline">
            {t("auth.createCharacter")}
          </Link>
        </p>
      </div>
    </div>
  );
}
