import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "../api.js";
import { useLanguage } from "../i18n/LanguageContext.jsx";

function formatDate(value) {
  if (!value) return "";
  return new Date(value.replace(" ", "T") + "Z").toLocaleString();
}

export default function SessionsModal({ onClose }) {
  const { t, tError } = useLanguage();
  const [sessions, setSessions] = useState(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [busyAll, setBusyAll] = useState(false);
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState("");

  const load = async () => {
    const data = await api.get("/auth/sessions");
    setSessions(data.sessions);
  };

  useEffect(() => {
    load().catch((err) => setError(tError(err)));
  }, []);

  const revoke = async (id) => {
    setError("");
    setBusyId(id);
    try {
      await api.post(`/auth/sessions/${id}/revoke`);
      await load();
    } catch (err) {
      setError(tError(err));
    } finally {
      setBusyId(null);
    }
  };

  const startRename = (s) => {
    setError("");
    setRenamingId(s.id);
    setRenameValue(s.customLabel || "");
  };

  const saveRename = async (id) => {
    setError("");
    setBusyId(id);
    try {
      await api.post(`/auth/sessions/${id}/rename`, { label: renameValue });
      setRenamingId(null);
      await load();
    } catch (err) {
      setError(tError(err));
    } finally {
      setBusyId(null);
    }
  };

  const revokeOthers = async () => {
    if (!confirm(t("sessions.confirmRevokeOthers"))) return;
    setError("");
    setBusyAll(true);
    try {
      await api.post("/auth/sessions/revoke-others");
      await load();
    } catch (err) {
      setError(tError(err));
    } finally {
      setBusyAll(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/70 flex items-start justify-center overflow-y-auto px-4 py-8 z-30">
      <div className="panel p-6 w-full max-w-lg space-y-4 shadow-neon">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-display uppercase tracking-widest text-neon-cyan text-sm">
            {t("sessions.title")}
          </h3>
          <button className="btn-secondary !px-2 !py-1 text-[10px]" onClick={onClose}>
            {t("common.close")}
          </button>
        </div>

        {error && <p className="text-neon-red text-xs">{error}</p>}

        {!sessions ? (
          <p className="text-slate-500 text-sm">{t("common.loading")}</p>
        ) : (
          <>
            <div className="space-y-2">
              {sessions.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-3 bg-ink-800/40 rounded-lg px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    {renamingId === s.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          className="field !py-1 text-sm"
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          placeholder={s.autoLabel}
                          maxLength={60}
                          autoFocus
                        />
                        <button
                          className="btn-primary !px-2 !py-1 text-[10px] shrink-0"
                          disabled={busyId === s.id}
                          onClick={() => saveRename(s.id)}
                        >
                          {t("common.save")}
                        </button>
                        <button
                          className="btn-secondary !px-2 !py-1 text-[10px] shrink-0"
                          onClick={() => setRenamingId(null)}
                        >
                          {t("common.cancel")}
                        </button>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm text-slate-200 flex items-center gap-2 flex-wrap">
                          {s.label}
                          {s.current && (
                            <span className="badge border-neon-green/60 text-neon-green">
                              {t("sessions.thisDevice")}
                            </span>
                          )}
                          {!!s.remember && (
                            <span className="badge border-neon-purple/50 text-neon-purple">
                              {t("sessions.remembered")}
                            </span>
                          )}
                          <button
                            className="text-slate-500 hover:text-neon-cyan text-[10px] underline"
                            onClick={() => startRename(s)}
                          >
                            {t("sessions.rename")}
                          </button>
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {t("sessions.lastSeen")} {formatDate(s.last_seen_at)}
                        </p>
                      </>
                    )}
                  </div>
                  {!s.current && renamingId !== s.id && (
                    <button
                      className="btn-danger !px-2 !py-1 text-[10px] shrink-0"
                      disabled={busyId === s.id}
                      onClick={() => revoke(s.id)}
                    >
                      {busyId === s.id ? t("common.saving") : t("sessions.revoke")}
                    </button>
                  )}
                </div>
              ))}
            </div>

            {sessions.length > 1 && (
              <button className="btn-secondary w-full" disabled={busyAll} onClick={revokeOthers}>
                {busyAll ? t("common.saving") : t("sessions.revokeOthers")}
              </button>
            )}
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
