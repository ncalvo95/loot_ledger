import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useLanguage } from "../i18n/LanguageContext.jsx";
import { useInstallPrompt } from "../context/InstallPromptContext.jsx";
import LanguageToggle from "./LanguageToggle.jsx";
import StyleToggle from "./StyleToggle.jsx";
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

  const items = [
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
    {
      key: "changePassword",
      node: (cls) => (
        <button
          onClick={() => {
            setShowChangePassword(true);
            setMobileOpen(false);
          }}
          className={`btn-ghost ${cls}`}
        >
          {t("nav.changePassword")}
        </button>
      ),
    },
    {
      key: "sessions",
      node: (cls) => (
        <button
          onClick={() => {
            setShowSessions(true);
            setMobileOpen(false);
          }}
          className={`btn-ghost ${cls}`}
        >
          {t("nav.sessions")}
        </button>
      ),
    },
    user.role === "admin" && {
      key: "panel",
      node: (cls) => (
        <Link to="/admin" onClick={() => setMobileOpen(false)} className={`btn-ghost ${cls}`}>
          {t("nav.panel")}
        </Link>
      ),
    },
    {
      key: "logout",
      node: (cls) => (
        <button onClick={handleLogout} className={`btn-ghost ${cls}`}>
          {t("nav.logout")}
        </button>
      ),
    },
  ].filter(Boolean);

  return (
    <header className="border-b border-ink-700 bg-ink-950/90 backdrop-blur sticky top-0 z-20">
      {/* Barra completa, sin max-w como el resto de la app: con el toggle de
          idioma + el de estilo + todos los botones del admin (+ etiquetas
          largas en modo Simple, como "Pending balances"), un contenedor con
          techo fijo se queda sin margen -- mejor que la fila crezca con la
          pantalla y listo. */}
      <div className="px-4 py-3 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 min-w-0">
          <img src="/icons/icon-192.png" alt="" className="w-6 h-6 rounded-md shrink-0" />
          <span
            className="font-display font-bold uppercase tracking-[0.15em] text-neon-cyan text-lg truncate"
            style={{ textShadow: "0 0 10px rgba(45,230,255,0.5)" }}
          >
            {t("appName")}
          </span>
        </Link>

        {/* Desktop: todo en una fila (a partir de 2xl, con margen real
            incluso con las etiquetas mas largas del modo Simple) */}
        <nav className="hidden 2xl:flex items-center gap-3 text-sm shrink-0">
          <LanguageToggle />
          <StyleToggle />
          <span className="text-slate-400 font-mono text-xs">
            <span className="text-neon-green">●</span> {user.username}
            {user.role === "admin" && (
              <span className="badge border-neon-purple/60 text-neon-purple ml-2">admin</span>
            )}
          </span>
          {items.map((it) => (
            <React.Fragment key={it.key}>{it.node("!px-2 !py-1")}</React.Fragment>
          ))}
        </nav>

        {/* Mobile/tablet: solo el toggle de idioma + botón de menú */}
        <div className="flex items-center gap-2 2xl:hidden shrink-0">
          <LanguageToggle />
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
        <div className="2xl:hidden border-t border-ink-700 px-4 py-3 space-y-2 bg-ink-950/95">
          <div className="text-slate-400 font-mono text-xs pb-1">
            <span className="text-neon-green">●</span> {user.username}
            {user.role === "admin" && (
              <span className="badge border-neon-purple/60 text-neon-purple ml-2">admin</span>
            )}
          </div>
          <StyleToggle className="mb-1" />
          {items.map((it) => (
            <div key={it.key}>{it.node("w-full !justify-start")}</div>
          ))}
        </div>
      )}

      {showChangePassword && <ChangePasswordModal onClose={() => setShowChangePassword(false)} />}
      {showSessions && <SessionsModal onClose={() => setShowSessions(false)} />}
    </header>
  );
}
