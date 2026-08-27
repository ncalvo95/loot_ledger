import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useLanguage } from "../i18n/LanguageContext.jsx";
import { useInstallPrompt } from "../context/InstallPromptContext.jsx";
import LanguageToggle from "./LanguageToggle.jsx";
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
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 min-w-0">
          <span className="text-xl shrink-0">🎮</span>
          <span
            className="font-display font-bold uppercase tracking-[0.15em] text-neon-cyan text-lg truncate"
            style={{ textShadow: "0 0 10px rgba(45,230,255,0.5)" }}
          >
            {t("appName")}
          </span>
        </Link>

        {/* Desktop: todo en una fila */}
        <nav className="hidden md:flex items-center gap-3 text-sm shrink-0">
          <LanguageToggle />
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

        {/* Mobile: solo el toggle de idioma + botón de menú */}
        <div className="flex items-center gap-2 md:hidden shrink-0">
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
        <div className="md:hidden border-t border-ink-700 px-4 py-3 space-y-2 bg-ink-950/95">
          <div className="text-slate-400 font-mono text-xs pb-1">
            <span className="text-neon-green">●</span> {user.username}
            {user.role === "admin" && (
              <span className="badge border-neon-purple/60 text-neon-purple ml-2">admin</span>
            )}
          </div>
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
