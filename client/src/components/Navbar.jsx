import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useLanguage } from "../i18n/LanguageContext.jsx";
import LanguageToggle from "./LanguageToggle.jsx";
import ChangePasswordModal from "./ChangePasswordModal.jsx";

export default function Navbar() {
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [showChangePassword, setShowChangePassword] = useState(false);

  if (!user) return null;

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <header className="border-b border-ink-700 bg-ink-950/90 backdrop-blur sticky top-0 z-20">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <span className="text-xl">🎮</span>
          <span
            className="font-display font-bold uppercase tracking-[0.2em] text-neon-cyan text-lg"
            style={{ textShadow: "0 0 10px rgba(45,230,255,0.5)" }}
          >
            {t("appName")}
          </span>
        </Link>
        <nav className="flex items-center gap-3 text-sm">
          <LanguageToggle />
          <span className="text-slate-400 font-mono text-xs hidden sm:inline">
            <span className="text-neon-green">●</span> {user.username}
            {user.role === "admin" && <span className="badge border-neon-purple/60 text-neon-purple ml-2">admin</span>}
          </span>
          <Link to="/quests" className="btn-ghost !px-2 !py-1">
            {t("nav.quests")}
          </Link>
          <button onClick={() => setShowChangePassword(true)} className="btn-ghost !px-2 !py-1">
            {t("nav.changePassword")}
          </button>
          {user.role === "admin" && (
            <Link to="/admin" className="btn-ghost !px-2 !py-1">
              {t("nav.panel")}
            </Link>
          )}
          <button onClick={handleLogout} className="btn-ghost !px-2 !py-1">
            {t("nav.logout")}
          </button>
        </nav>
      </div>
      {showChangePassword && <ChangePasswordModal onClose={() => setShowChangePassword(false)} />}
    </header>
  );
}
