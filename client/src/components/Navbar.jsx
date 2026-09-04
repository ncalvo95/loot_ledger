import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useLanguage } from "../i18n/LanguageContext.jsx";
import { useInstallPrompt } from "../context/InstallPromptContext.jsx";
import LanguageToggle from "./LanguageToggle.jsx";
import StyleToggle from "./StyleToggle.jsx";
import ThemeToggle from "./ThemeToggle.jsx";
import AccountMenu from "./AccountMenu.jsx";
import ChangePasswordModal from "./ChangePasswordModal.jsx";
import SessionsModal from "./SessionsModal.jsx";

export default function Navbar() {
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const { canInstall, promptInstall } = useInstallPrompt();
  const navigate = useNavigate();
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showSessions, setShowSessions] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  if (!user) return null;

  const handleLogout = async () => {
    setMobileOpen(false);
    await logout();
    navigate("/login");
  };

  // Links de navegacion "primarios": van sueltos en la barra, tanto en
  // desktop como en el menu mobile. Todo lo que es cuenta/preferencias
  // (idioma, modo gamer/simple, contraseña, sesiones, logout) vive aparte
  // en el dropdown/seccion "Consola".
  const primaryItems = [
    canInstall && {
      key: "install",
      node: (cls) => (
        <button onClick={() => { promptInstall(); setMobileOpen(false); }} className={`btn-primary ${cls}`}>
          {t("nav.install")}
        </button>
      ),
    },
    {
      key: "quests",
      node: (cls) => (
        <Link to="/quests" onClick={() => setMobileOpen(false)} className={`btn-ghost ${cls}`}>
          {t("nav.quests")}
        </Link>
      ),
    },
    user.role === "admin" && {
      key: "admin",
      node: (cls) => (
        <Link to="/admin" onClick={() => setMobileOpen(false)} className={`btn-ghost ${cls}`}>
          {t("nav.admin")}
        </Link>
      ),
    },
  ].filter(Boolean);

  return (
    <header className="border-b border-ink-700 bg-ink-950/90 backdrop-blur sticky top-0 z-20">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 min-w-0">
          <img src={`${import.meta.env.BASE_URL}icons/icon-192.png`} alt="" className="w-6 h-6 rounded-md shrink-0" />
          <span
            className="font-display font-bold uppercase tracking-[0.15em] text-neon-cyan text-lg truncate"
            style={{ textShadow: "0 0 10px rgba(45,230,255,0.5)" }}
          >
            {t("appName")}
          </span>
        </Link>

        {/* Desktop: brand + links primarios + un solo dropdown de cuenta,
            en vez de un boton suelto por cada accion */}
        <nav className="hidden md:flex items-center gap-3 text-sm shrink-0">
          <span className="text-slate-400 font-mono text-xs">
            <span className="text-neon-green">●</span> {user.username}
            {user.role === "admin" && (
              <span className="badge border-neon-purple/60 text-neon-purple ml-2">admin</span>
            )}
          </span>
          {primaryItems.map((it) => (
            <React.Fragment key={it.key}>{it.node("!px-2 !py-1")}</React.Fragment>
          ))}
          <AccountMenu
            onChangePassword={() => setShowChangePassword(true)}
            onSessions={() => setShowSessions(true)}
            onLogout={handleLogout}
          />
        </nav>

        {/* Mobile/tablet: solo el botón de menú */}
        <div className="flex items-center gap-2 md:hidden shrink-0">
          <button
            onClick={() => setMobileOpen((o) => !o)}
            className="btn-ghost !px-2 !py-1 text-lg leading-none"
            aria-label={mobileOpen ? t("common.close") : t("nav.menu")}
          >
            {mobileOpen ? "✕" : "☰"}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-ink-700 px-4 py-3 space-y-3 bg-ink-950/95">
          <div className="text-slate-400 font-mono text-xs">
            <span className="text-neon-green">●</span> {user.username}
            {user.role === "admin" && (
              <span className="badge border-neon-purple/60 text-neon-purple ml-2">admin</span>
            )}
          </div>

          <div className="space-y-2">
            {primaryItems.map((it) => (
              <div key={it.key}>{it.node("w-full !justify-start")}</div>
            ))}
          </div>

          <div className="border-t border-ink-700 pt-3 space-y-2">
            <p className="text-[10px] uppercase tracking-widest text-slate-500">{t("nav.console")}</p>
            <div className="flex items-center gap-2 flex-wrap">
              <LanguageToggle />
              <StyleToggle />
              <ThemeToggle />
            </div>
            <button
              onClick={() => {
                setShowChangePassword(true);
                setMobileOpen(false);
              }}
              className="btn-ghost w-full !justify-start !px-2 !py-1.5"
            >
              {t("nav.changePassword")}
            </button>
            <button
              onClick={() => {
                setShowSessions(true);
                setMobileOpen(false);
              }}
              className="btn-ghost w-full !justify-start !px-2 !py-1.5"
            >
              {t("nav.sessions")}
            </button>
          </div>

          <div className="border-t border-ink-700 pt-3">
            <button onClick={handleLogout} className="btn-ghost w-full !justify-start !px-2 !py-1.5 text-neon-red">
              {t("nav.logout")}
            </button>
          </div>
        </div>
      )}

      {showChangePassword && <ChangePasswordModal onClose={() => setShowChangePassword(false)} />}
      {showSessions && <SessionsModal onClose={() => setShowSessions(false)} />}
    </header>
  );
}
