import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { useLanguage } from "../i18n/LanguageContext.jsx";
import { useConfirm } from "../context/ConfirmContext.jsx";
import PasswordInput from "../components/PasswordInput.jsx";
import PurgeConfirmModal from "../components/PurgeConfirmModal.jsx";
import InviteCodeModal from "../components/InviteCodeModal.jsx";

const PASSWORD_RULE = /^[A-Za-z0-9._-]{6,16}$/;
const USERNAME_RULE = /^[A-Za-z0-9._-]{4,10}$/;

function StatusBadge({ status, t }) {
  const map = {
    active: "border-neon-green/60 text-neon-green",
    invited: "border-neon-cyan/60 text-neon-cyan",
    pending: "border-neon-purple/60 text-neon-purple",
    rejected: "border-neon-red/60 text-neon-red",
    removed: "border-slate-600 text-slate-500",
  };
  const labelMap = {
    active: t("admin.active"),
    invited: t("admin.invitedStatus"),
    pending: t("admin.pending"),
    rejected: t("admin.rejected"),
    removed: t("admin.removedStatus"),
  };
  return <span className={`badge ${map[status] || ""}`}>{labelMap[status] || status}</span>;
}

export default function AdminPanel() {
  const { t, tError } = useLanguage();
  const confirmAction = useConfirm();
  const [tab, setTab] = useState("pending");
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [resetRequests, setResetRequests] = useState([]);
  const [purgeUserTarget, setPurgeUserTarget] = useState(null);
  const [purgeProjectTarget, setPurgeProjectTarget] = useState(null);
  const [inviteCodeModal, setInviteCodeModal] = useState(null); // { title, code }
  const [inviteBusy, setInviteBusy] = useState(false);
  const [selectedPending, setSelectedPending] = useState(new Set());
  const [error, setError] = useState("");

  const [resetTarget, setResetTarget] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [renameTarget, setRenameTarget] = useState(null);
  const [newUsername, setNewUsername] = useState("");
  const [newUserForm, setNewUserForm] = useState({ username: "", password: "" });
  const [resolveTarget, setResolveTarget] = useState(null);
  const [resolvePassword, setResolvePassword] = useState("");
  const [busy, setBusy] = useState(false);

  const loadUsers = async () => {
    const data = await api.get("/admin/users");
    setUsers(data.users);
  };
  const loadResetRequests = async () => {
    const data = await api.get("/admin/password-reset-requests");
    setResetRequests(data.requests);
  };
  const loadProjects = async () => {
    const data = await api.get("/projects");
    setProjects(data.active);
  };

  const refreshAll = () => {
    loadUsers();
    loadResetRequests();
    loadProjects();
  };

  useEffect(() => {
    refreshAll();
    const interval = setInterval(refreshAll, 15000);
    return () => clearInterval(interval);
  }, []);

  const pendingUsers = users.filter((u) => u.status === "pending");

  const togglePending = (id) => {
    setSelectedPending((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllPending = () => {
    setSelectedPending((prev) =>
      prev.size === pendingUsers.length ? new Set() : new Set(pendingUsers.map((u) => u.id))
    );
  };

  const approve = async (ids) => {
    setError("");
    try {
      await api.post("/admin/users/approve", { ids });
      setSelectedPending(new Set());
      await loadUsers();
    } catch (err) {
      setError(tError(err));
    }
  };

  const reject = async (ids) => {
    setError("");
    try {
      await api.post("/admin/users/reject", { ids });
      setSelectedPending(new Set());
      await loadUsers();
    } catch (err) {
      setError(tError(err));
    }
  };

  const createUser = async (e) => {
    e.preventDefault();
    setError("");
    if (!USERNAME_RULE.test(newUserForm.username) || !PASSWORD_RULE.test(newUserForm.password)) {
      setError(t("auth.usernameRule"));
      return;
    }
    setBusy(true);
    try {
      await api.post("/admin/users", newUserForm);
      setNewUserForm({ username: "", password: "" });
      await loadUsers();
    } catch (err) {
      setError(tError(err));
    } finally {
      setBusy(false);
    }
  };

  const doRename = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await api.post(`/admin/users/${renameTarget.id}/rename`, { newUsername });
      setRenameTarget(null);
      setNewUsername("");
      await loadUsers();
    } catch (err) {
      setError(tError(err));
    } finally {
      setBusy(false);
    }
  };

  const doResetPassword = async (e) => {
    e.preventDefault();
    setError("");
    if (!PASSWORD_RULE.test(newPassword)) {
      setError(t("auth.passwordRule"));
      return;
    }
    setBusy(true);
    try {
      await api.post(`/admin/users/${resetTarget.id}/reset-password`, { newPassword });
      setResetTarget(null);
      setNewPassword("");
    } catch (err) {
      setError(tError(err));
    } finally {
      setBusy(false);
    }
  };

  const removeUser = async (u) => {
    if (!(await confirmAction(`${t("admin.confirmRemoveUser")} "${u.username}"?`, { confirmLabel: t("common.remove") }))) return;
    try {
      await api.post(`/admin/users/${u.id}/remove`);
      await loadUsers();
    } catch (err) {
      alert(tError(err));
    }
  };

  const reactivateUser = async (u) => {
    await api.post(`/admin/users/${u.id}/reactivate`);
    await loadUsers();
  };

  const generateInvite = async () => {
    setError("");
    setInviteBusy(true);
    try {
      const data = await api.post("/admin/invites");
      setInviteCodeModal({ title: t("admin.inviteCodeGenerated"), code: data.code });
      await loadUsers();
    } catch (err) {
      setError(tError(err));
    } finally {
      setInviteBusy(false);
    }
  };

  const assignInviteCode = async (u, { regenerate = false } = {}) => {
    setError("");
    setInviteBusy(true);
    try {
      const data = await api.post(`/admin/users/${u.id}/invite-code`, { regenerate });
      setInviteCodeModal({ title: `${t("admin.inviteCodeGenerated")} — ${u.username}`, code: data.code });
      await loadUsers();
    } catch (err) {
      setError(tError(err));
    } finally {
      setInviteBusy(false);
    }
  };

  const doResolveRequest = async (e) => {
    e.preventDefault();
    setError("");
    if (!PASSWORD_RULE.test(resolvePassword)) {
      setError(t("auth.passwordRule"));
      return;
    }
    setBusy(true);
    try {
      await api.post(`/admin/password-reset-requests/${resolveTarget.id}/resolve`, {
        newPassword: resolvePassword,
      });
      setResolveTarget(null);
      setResolvePassword("");
      await loadResetRequests();
    } catch (err) {
      setError(tError(err));
    } finally {
      setBusy(false);
    }
  };

  const TABS = [
    { key: "pending", label: t("admin.tabs.pending"), badge: pendingUsers.length },
    { key: "users", label: t("admin.tabs.users") },
    { key: "projects", label: t("admin.tabs.projects") },
    { key: "resets", label: t("admin.tabs.resets"), badge: resetRequests.length },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">
      <div>
        <Link to="/" className="text-xs text-slate-500 hover:text-neon-cyan">
          ← {t("project.dashboard")}
        </Link>
        <h1 className="title-glow text-3xl mt-1">{t("admin.title")}</h1>
        <p className="text-slate-400 text-sm mt-1">{t("admin.subtitle")}</p>
      </div>

      <nav className="flex gap-2 flex-wrap items-center">
        {TABS.map((tb) => (
          <button
            key={tb.key}
            onClick={() => setTab(tb.key)}
            className={`btn ${
              tab === tb.key
                ? "bg-neon-cyan/15 text-neon-cyan border border-neon-cyan/60 shadow-neon"
                : "bg-ink-800 text-slate-400 border border-ink-600 hover:text-slate-100"
            }`}
          >
            {tb.label}
            {!!tb.badge && <span className="ml-1.5 text-neon-gold">{tb.badge}</span>}
          </button>
        ))}
        <button className="btn-ghost ml-auto" onClick={refreshAll}>
          ↻ {t("common.refresh")}
        </button>
      </nav>

      {error && <p className="text-neon-red text-sm">{error}</p>}

      {tab === "pending" && (
        <div className="panel p-5 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="font-display uppercase tracking-widest text-slate-300 text-sm">
              {t("admin.pendingUsers")}
            </h2>
            {pendingUsers.length > 0 && (
              <div className="flex gap-2">
                <button
                  className="btn-primary !px-3 !py-1.5"
                  disabled={selectedPending.size === 0}
                  onClick={() => approve([...selectedPending])}
                >
                  {t("admin.approveSelected")} ({selectedPending.size})
                </button>
                <button
                  className="btn-danger !px-3 !py-1.5"
                  disabled={selectedPending.size === 0}
                  onClick={() => reject([...selectedPending])}
                >
                  {t("admin.rejectSelected")} ({selectedPending.size})
                </button>
              </div>
            )}
          </div>

          {pendingUsers.length === 0 ? (
            <p className="text-slate-500 text-sm">{t("admin.noPending")}</p>
          ) : (
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-xs text-slate-400">
                <input
                  type="checkbox"
                  checked={selectedPending.size === pendingUsers.length}
                  onChange={toggleSelectAllPending}
                />
                {t("common.selectAll")}
              </label>
              {pendingUsers.map((u) => (
                <div key={u.id} className="flex items-center justify-between bg-ink-800/60 rounded-lg px-3 py-2">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedPending.has(u.id)}
                      onChange={() => togglePending(u.id)}
                    />
                    <span className="text-sm">{u.username}</span>
                    <span className="text-[10px] text-slate-500">{u.created_at}</span>
                  </label>
                  <div className="flex gap-2">
                    <button className="btn-primary !px-2 !py-1 text-[10px]" onClick={() => approve([u.id])}>
                      {t("admin.approve")}
                    </button>
                    <button className="btn-danger !px-2 !py-1 text-[10px]" onClick={() => reject([u.id])}>
                      {t("admin.reject")}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "users" && (
        <div className="space-y-5">
          <form onSubmit={createUser} className="panel p-5 space-y-3">
            <h2 className="font-display uppercase tracking-widest text-neon-green text-sm">
              {t("admin.createUser")}
            </h2>
            <div className="grid sm:grid-cols-2 gap-3">
              <input
                className="field"
                placeholder={t("common.username")}
                value={newUserForm.username}
                onChange={(e) => setNewUserForm((f) => ({ ...f, username: e.target.value }))}
              />
              <PasswordInput
                className="field"
                placeholder={t("common.password")}
                value={newUserForm.password}
                onChange={(e) => setNewUserForm((f) => ({ ...f, password: e.target.value }))}
              />
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <button type="submit" disabled={busy} className="btn-primary">
                {busy ? t("common.creating") : t("admin.createUser")}
              </button>
              <button
                type="button"
                disabled={inviteBusy}
                onClick={generateInvite}
                className="btn-secondary"
              >
                {inviteBusy ? t("common.creating") : t("admin.generateInvite")}
              </button>
            </div>
          </form>

          <div className="panel divide-y divide-ink-700">
            {users.map((u) => (
              <div key={u.id} className="p-4 flex items-center justify-between flex-wrap gap-3">
                <div>
                  <p className="font-semibold flex items-center gap-2">
                    {u.username}
                    {u.role === "admin" && (
                      <span className="badge border-neon-purple/60 text-neon-purple">admin</span>
                    )}
                    <StatusBadge status={u.status} t={t} />
                  </p>
                  <p className="text-xs text-slate-500">
                    {t("admin.signupDate")}: {u.created_at}
                  </p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {u.status === "invited" ? (
                    <>
                      <button
                        className="btn-secondary !px-3 !py-1.5"
                        disabled={inviteBusy}
                        onClick={() => assignInviteCode(u, { regenerate: true })}
                      >
                        {t("admin.regenerateInviteCode")}
                      </button>
                      <button className="btn-danger !px-3 !py-1.5" onClick={() => removeUser(u)}>
                        {t("admin.cancelInvite")}
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className="btn-secondary !px-3 !py-1.5"
                        onClick={() => {
                          setRenameTarget(u);
                          setNewUsername(u.username);
                          setError("");
                        }}
                      >
                        {t("admin.rename")}
                      </button>
                      <button
                        className="btn-secondary !px-3 !py-1.5"
                        onClick={() => {
                          setResetTarget(u);
                          setNewPassword("");
                          setError("");
                        }}
                      >
                        {t("admin.resetPassword")}
                      </button>
                      {u.status === "active" && u.username !== "administrator" && (
                        <button
                          className="btn-secondary !px-3 !py-1.5"
                          disabled={inviteBusy}
                          onClick={() => assignInviteCode(u)}
                        >
                          {t("admin.assignInviteCode")}
                        </button>
                      )}
                      {u.status === "active" || u.status === "pending" || u.status === "rejected" ? (
                        <button className="btn-danger !px-3 !py-1.5" onClick={() => removeUser(u)}>
                          {t("common.remove")}
                        </button>
                      ) : (
                        <>
                          <button className="btn-primary !px-3 !py-1.5" onClick={() => reactivateUser(u)}>
                            {t("admin.reactivate")}
                          </button>
                          <button
                            className="btn-danger !px-3 !py-1.5 border-neon-red/80"
                            onClick={() => setPurgeUserTarget(u)}
                          >
                            {t("admin.purge")}
                          </button>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "projects" && (
        <div className="panel divide-y divide-ink-700">
          {projects.length === 0 ? (
            <p className="text-slate-500 text-sm p-5">{t("admin.noProjects")}</p>
          ) : (
            projects.map((p) => (
              <div key={p.id} className="p-4 flex items-center justify-between flex-wrap gap-3">
                <div>
                  <p className="font-semibold">{p.name}</p>
                  <p className="text-xs text-slate-500">
                    {t("admin.projectOwner")}: {p.owner_username} · {t("admin.projectMembers")}: {p.member_count}
                  </p>
                </div>
                <button className="btn-danger !px-3 !py-1.5" onClick={() => setPurgeProjectTarget(p)}>
                  {t("admin.purge")}
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {tab === "resets" && (
        <div className="panel p-5 space-y-3">
          <h2 className="font-display uppercase tracking-widest text-slate-300 text-sm">
            {t("admin.resetRequests")}
          </h2>
          {resetRequests.length === 0 ? (
            <p className="text-slate-500 text-sm">{t("admin.noResetRequests")}</p>
          ) : (
            resetRequests.map((r) => (
              <div key={r.id} className="flex items-center justify-between bg-ink-800/60 rounded-lg px-3 py-2">
                <div>
                  <span className="text-sm">{r.username}</span>
                  <p className="text-[10px] text-slate-500">
                    {t("admin.requestedAt")}: {r.requested_at}
                  </p>
                </div>
                <button
                  className="btn-primary !px-3 !py-1.5"
                  onClick={() => {
                    setResolveTarget(r);
                    setResolvePassword("");
                    setError("");
                  }}
                >
                  {t("admin.resolve")}
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {resetTarget && (
        <div className="fixed inset-0 bg-black/70 flex items-start justify-center overflow-y-auto px-4 py-8 z-30">
          <form onSubmit={doResetPassword} className="panel p-6 w-full max-w-sm space-y-4 shadow-neon">
            <h3 className="font-display uppercase tracking-widest text-neon-cyan text-sm">
              {t("admin.resetPassword")} — {resetTarget.username}
            </h3>
            <PasswordInput
              className="field"
              placeholder={t("auth.passwordHint")}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoFocus
            />
            {error && <p className="text-neon-red text-xs">{error}</p>}
            <div className="flex gap-3">
              <button type="submit" disabled={busy} className="btn-primary">
                {t("common.save")}
              </button>
              <button type="button" className="btn-secondary" onClick={() => setResetTarget(null)}>
                {t("common.cancel")}
              </button>
            </div>
          </form>
        </div>
      )}

      {renameTarget && (
        <div className="fixed inset-0 bg-black/70 flex items-start justify-center overflow-y-auto px-4 py-8 z-30">
          <form onSubmit={doRename} className="panel p-6 w-full max-w-sm space-y-4 shadow-neon">
            <h3 className="font-display uppercase tracking-widest text-neon-cyan text-sm">
              {t("admin.rename")} — {renameTarget.username}
            </h3>
            <input
              className="field"
              placeholder={t("admin.newUsername")}
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              autoFocus
            />
            {error && <p className="text-neon-red text-xs">{error}</p>}
            <div className="flex gap-3">
              <button type="submit" disabled={busy} className="btn-primary">
                {t("common.save")}
              </button>
              <button type="button" className="btn-secondary" onClick={() => setRenameTarget(null)}>
                {t("common.cancel")}
              </button>
            </div>
          </form>
        </div>
      )}

      {resolveTarget && (
        <div className="fixed inset-0 bg-black/70 flex items-start justify-center overflow-y-auto px-4 py-8 z-30">
          <form onSubmit={doResolveRequest} className="panel p-6 w-full max-w-sm space-y-4 shadow-neon">
            <h3 className="font-display uppercase tracking-widest text-neon-cyan text-sm">
              {t("admin.resetPassword")} — {resolveTarget.username}
            </h3>
            <PasswordInput
              className="field"
              placeholder={t("auth.passwordHint")}
              value={resolvePassword}
              onChange={(e) => setResolvePassword(e.target.value)}
              autoFocus
            />
            {error && <p className="text-neon-red text-xs">{error}</p>}
            <div className="flex gap-3">
              <button type="submit" disabled={busy} className="btn-primary">
                {t("admin.resolve")}
              </button>
              <button type="button" className="btn-secondary" onClick={() => setResolveTarget(null)}>
                {t("common.cancel")}
              </button>
            </div>
          </form>
        </div>
      )}

      {purgeUserTarget && (
        <PurgeConfirmModal
          title={`${t("admin.purge")} — ${purgeUserTarget.username}`}
          description={t("admin.purgeUserWarning")}
          confirmWord={purgeUserTarget.username}
          onClose={() => setPurgeUserTarget(null)}
          onConfirm={async () => {
            await api.post(`/admin/users/${purgeUserTarget.id}/purge`);
            await loadUsers();
          }}
        />
      )}

      {purgeProjectTarget && (
        <PurgeConfirmModal
          title={`${t("admin.purge")} — ${purgeProjectTarget.name}`}
          description={t("admin.purgeProjectWarning")}
          confirmWord={purgeProjectTarget.name}
          onClose={() => setPurgeProjectTarget(null)}
          onConfirm={async () => {
            await api.post(`/admin/projects/${purgeProjectTarget.id}/purge`);
            await loadProjects();
          }}
        />
      )}

      {inviteCodeModal && (
        <InviteCodeModal
          title={inviteCodeModal.title}
          code={inviteCodeModal.code}
          onClose={() => setInviteCodeModal(null)}
        />
      )}
    </div>
  );
}
