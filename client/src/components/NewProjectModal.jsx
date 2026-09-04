import React, { useState } from "react";
import { createPortal } from "react-dom";
import { api } from "../api.js";
import { useLanguage } from "../i18n/LanguageContext.jsx";
import { useToast } from "../context/ToastContext.jsx";

const PROJECT_EMOJIS = [
  "🗺️", "🎮", "🏆", "💰", "🛡️", "⚔️", "🔥", "💎", "🍕", "🏕️",
  "✈️", "🚗", "🏠", "🎉", "🍺", "☕", "🎸", "🐉", "👾", "🎲",
  "🧭", "⛺", "🏔️", "🚀", "🛒", "📦", "🎯", "🍔", "🎬", "⚡",
];

export default function NewProjectModal({ onCreated, onClose }) {
  const { t, tError } = useLanguage();
  const showError = useToast();
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState(PROJECT_EMOJIS[0]);
  const [type, setType] = useState("shared");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      const { project } = await api.post("/projects", { name: name.trim(), emoji, type });
      await onCreated(project);
    } catch (err) {
      showError(tError(err));
      setBusy(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/70 flex items-start justify-center overflow-y-auto px-4 py-8 z-30">
      <form onSubmit={submit} className="panel p-6 w-full max-w-sm space-y-4 shadow-neon">
        <h3 className="font-display uppercase tracking-widest text-neon-cyan text-sm">
          {t("dashboard.newProject")}
        </h3>

        <div>
          <label className="label">{t("dashboard.projectName")}</label>
          <input
            className="field"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("dashboard.projectNamePlaceholder")}
            autoFocus
            required
          />
        </div>

        <div>
          <label className="label">{t("dashboard.projectEmoji")}</label>
          <select className="field text-lg" value={emoji} onChange={(e) => setEmoji(e.target.value)}>
            {PROJECT_EMOJIS.map((em) => (
              <option key={em} value={em}>
                {em}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">{t("dashboard.projectType")}</label>
          <div className="flex gap-4 text-sm text-slate-300">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="radio" checked={type === "shared"} onChange={() => setType("shared")} />
              {t("dashboard.typeShared")}
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="radio" checked={type === "individual"} onChange={() => setType("individual")} />
              {t("dashboard.typeIndividual")}
            </label>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={busy} className="btn-primary">
            {busy ? t("common.creating") : t("dashboard.createProject")}
          </button>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>
            {t("common.cancel")}
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
}
