import React, { useState } from "react";
import { createPortal } from "react-dom";
import { api } from "../api.js";
import { useLanguage } from "../i18n/LanguageContext.jsx";
import { useToast } from "../context/ToastContext.jsx";

const CATEGORIES = ["bug", "feature", "other"];

export default function FeedbackModal({ onClose }) {
  const { t, tError } = useLanguage();
  const showError = useToast();
  const [category, setCategory] = useState("bug");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!message.trim()) return;
    setBusy(true);
    try {
      await api.post("/feedback", { category, message: message.trim() });
      setSent(true);
    } catch (err) {
      showError(tError(err));
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/70 flex items-start justify-center overflow-y-auto px-4 py-8 z-30">
      <div className="panel p-6 w-full max-w-md space-y-4 shadow-neon">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-display uppercase tracking-widest text-neon-cyan text-sm">
            {t("feedback.title")}
          </h3>
          <button className="btn-secondary !px-2 !py-1 text-[10px]" onClick={onClose}>
            {t("common.close")}
          </button>
        </div>

        {sent ? (
          <>
            <p className="text-neon-green text-sm">{t("feedback.sent")}</p>
            <button className="btn-secondary" onClick={onClose}>
              {t("common.close")}
            </button>
          </>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <p className="text-sm text-slate-400">{t("feedback.subtitle")}</p>
            <div>
              <label className="label">{t("feedback.categoryLabel")}</label>
              <div className="flex gap-2 flex-wrap">
                {CATEGORIES.map((c) => (
                  <button
                    type="button"
                    key={c}
                    onClick={() => setCategory(c)}
                    className={category === c ? "btn-primary !px-3 !py-1.5 text-xs" : "btn-secondary !px-3 !py-1.5 text-xs"}
                  >
                    {t(`feedback.category.${c}`)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="label">{t("feedback.message")}</label>
              <textarea
                className="field min-h-[120px]"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t("feedback.messagePlaceholder")}
                maxLength={2000}
                required
                autoFocus
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={busy || !message.trim()} className="btn-primary">
                {busy ? t("common.sending") : t("feedback.send")}
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
