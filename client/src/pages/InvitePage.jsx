import React, { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useLanguage } from "../i18n/LanguageContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import LanguageToggle from "../components/LanguageToggle.jsx";
import PasswordInput from "../components/PasswordInput.jsx";
import { Loading } from "../components/ProtectedRoute.jsx";

const USERNAME_RULE = /^[A-Za-z0-9._-]{4,10}$/;
const PASSWORD_RULE = /^[A-Za-z0-9._-]{6,16}$/;

// Unica puerta de entrada para crear una cuenta (reachable en /register y
// en /invite?code=...) -- este server es por invitacion, asi que antes de
// mostrar los campos de usuario/contraseña siempre hay que tener un codigo
// valido, ya sea pegado en la URL (link directo, o embebido desde afuera
// tipo el portfolio) o tipeado a mano en el primer paso.
//
// - code invalido/ya usado -> mensaje de error.
// - mode "gate" (Caso B, cuenta ya activa) -> manda a /login.
// - mode "claim" (Caso A, placeholder sin reclamar) -> formulario para
//   elegir usuario/contraseña; al confirmar, la cuenta pasa a 'pending'
//   (mismo flujo de aprobacion del admin que un registro comun) SIN
//   iniciar sesion sola.
export default function InvitePage() {
  const { user, loading: authLoading } = useAuth();
  const { t, tError } = useLanguage();
  const showError = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const codeFromUrl = (searchParams.get("code") || "").trim();

  const [checking, setChecking] = useState(!!codeFromUrl);
  const [mode, setMode] = useState(null); // 'claim' | 'gate' | null (sin validar / invalido)
  const [code, setCode] = useState(codeFromUrl);
  const [codeInput, setCodeInput] = useState("");
  const [codeBusy, setCodeBusy] = useState(false);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(false);

  const checkCode = (value) => {
    return api.get(`/auth/invite/${encodeURIComponent(value)}`).then((data) => {
      if (data.mode === "gate") {
        navigate("/login", { replace: true });
        return;
      }
      setCode(value);
      setMode(data.mode);
    });
  };

  useEffect(() => {
    if (!codeFromUrl) {
      setChecking(false);
      return;
    }
    checkCode(codeFromUrl)
      .catch(() => setMode(null))
      .finally(() => setChecking(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codeFromUrl]);

  if (authLoading || checking) return <Loading />;
  if (user) return <Navigate to="/" replace />;

  const onSubmitCode = async (e) => {
    e.preventDefault();
    if (!codeInput.trim()) return;
    setCodeBusy(true);
    try {
      await checkCode(codeInput.trim());
    } catch (err) {
      showError(tError(err) || t("invite.invalidBody"));
    } finally {
      setCodeBusy(false);
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!USERNAME_RULE.test(username)) {
      showError(t("auth.usernameRule"));
      return;
    }
    if (!PASSWORD_RULE.test(password)) {
      showError(t("auth.passwordRule"));
      return;
    }
    if (password !== confirm) {
      showError(t("auth.passwordMismatch"));
      return;
    }
    setBusy(true);
    try {
      await api.post("/auth/claim-invite", { code, username, password });
      setPending(true);
    } catch (err) {
      showError(tError(err));
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

  // Paso 1: sin código validado todavía -- si vino por URL y era inválido,
  // mostramos el error fijo; si nunca hubo código, mostramos el form para
  // tipearlo a mano.
  if (mode !== "claim") {
    if (codeFromUrl) {
      return (
        <div className="min-h-screen flex items-center justify-center px-4">
          <div className="panel w-full max-w-sm p-8 shadow-neon-red text-center space-y-4">
            <div className="text-4xl">🚫</div>
            <h1 className="title-glow text-xl">{t("invite.invalidTitle")}</h1>
            <p className="text-slate-300 text-sm">{t("invite.invalidBody")}</p>
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
            <div className="text-4xl mb-2">🔑</div>
            <h1 className="title-glow text-2xl">{t("invite.enterCodeTitle")}</h1>
            <p className="text-slate-400 text-sm mt-1">{t("invite.enterCodeSubtitle")}</p>
          </div>
          <form onSubmit={onSubmitCode} className="space-y-4">
            <div>
              <label className="label">{t("invite.codeFieldLabel")}</label>
              <input
                className="field font-mono"
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value)}
                autoFocus
                required
              />
            </div>
            <button type="submit" disabled={codeBusy} className="btn-primary w-full">
              {codeBusy ? t("common.loading") : t("invite.continueCta")}
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

  // Paso 2: código validado (mode "claim") -- elegir usuario/contraseña.
  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative">
      <div className="absolute top-4 right-4">
        <LanguageToggle />
      </div>
      <div className="panel w-full max-w-sm p-8 shadow-neon-purple">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">✉️</div>
          <h1 className="title-glow text-2xl">{t("invite.claimTitle")}</h1>
          <p className="text-slate-400 text-sm mt-1">{t("invite.claimSubtitle")}</p>
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
            <PasswordInput
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
            <PasswordInput
              className="field"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              required
            />
          </div>
          <button type="submit" disabled={busy} className="btn-primary w-full">
            {busy ? t("auth.registerBusy") : t("invite.claimCta")}
          </button>
        </form>
      </div>
    </div>
  );
}
