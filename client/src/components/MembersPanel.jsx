import React, { useState } from "react";
import { api } from "../api.js";
import { useLanguage } from "../i18n/LanguageContext.jsx";
import { useConfirm } from "../context/ConfirmContext.jsx";

export default function MembersPanel({ projectId, members, isOwner, canManage, isGlobalAdmin, onChanged }) {
  const { t, tError } = useLanguage();
  const confirmAction = useConfirm();
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await api.post(`/projects/${projectId}/members`, { username: username.trim() });
      setUsername("");
      onChanged();
    } catch (err) {
      setError(tError(err));
    } finally {
      setBusy(false);
    }
  };

  const removeMember = async (userId) => {
    if (!(await confirmAction(t("team.confirmRemove"), { confirmLabel: t("common.remove") }))) return;
    await api.post(`/projects/${projectId}/members/${userId}/remove`);
    onChanged();
  };

  const changeRole = async (userId, role) => {
    try {
      await api.post(`/projects/${projectId}/members/${userId}/role`, { role });
      onChanged();
    } catch (err) {
      alert(tError(err));
    }
  };

  const statusBadge = (status) => {
    if (status === "member") return "border-neon-green/60 text-neon-green";
    if (status === "invited") return "border-neon-purple/60 text-neon-purple";
    return "border-slate-600 text-slate-500";
  };

  const roleBadge = (role) => {
    if (role === "owner") return "border-neon-gold/60 text-neon-gold";
    if (role === "admin") return "border-neon-purple/60 text-neon-purple";
    return "border-ink-600 text-slate-400";
  };

  return (
    <div className="space-y-4">
      <div className="panel p-5">
        <h3 className="font-display uppercase tracking-widest text-slate-300 text-sm mb-3">{t("team.title")}</h3>
        <ul className="space-y-2">
          {members.map((m) => {
            const canChangeThisRole =
              m.status !== "removed" && m.role !== "owner" && (isGlobalAdmin || isOwner);
            return (
              <li
                key={m.user_id}
                className="flex items-center justify-between bg-ink-800/60 rounded-lg px-3 py-2 flex-wrap gap-2"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm">{m.username}</span>
                  <span className={`badge ${roleBadge(m.role)}`}>{t(`team.role.${m.role}`)}</span>
                  <span className={`badge ${statusBadge(m.status)}`}>{t(`team.status.${m.status}`)}</span>
                  {m.account_status === "removed" && (
                    <span className="badge border-neon-red/50 text-neon-red">{t("team.accountRemoved")}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {canChangeThisRole && (
                    <select
                      className="field !w-auto !py-1 !text-xs"
                      value={m.role}
                      onChange={(e) => changeRole(m.user_id, e.target.value)}
                    >
                      <option value="member">{t("team.role.member")}</option>
                      <option value="admin">{t("team.role.admin")}</option>
                      {isGlobalAdmin && <option value="owner">{t("team.role.owner")}</option>}
                    </select>
                  )}
                  {canManage && m.status !== "removed" && m.role !== "owner" && (
                    <button className="btn-ghost !px-2 !py-1 text-[10px]" onClick={() => removeMember(m.user_id)}>
                      {t("common.remove")}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {canManage && (
        <form onSubmit={submit} className="panel p-5 space-y-3">
          <h3 className="font-display uppercase tracking-widest text-neon-purple text-sm">{t("team.addPlayer")}</h3>
          <input
            className="field"
            placeholder={t("team.usernamePlaceholder")}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          {error && <p className="text-neon-red text-xs">{error}</p>}
          <button type="submit" disabled={busy} className="btn-primary w-full">
            {busy ? t("common.sending") : t("team.inviteCta")}
          </button>
        </form>
      )}
    </div>
  );
}
