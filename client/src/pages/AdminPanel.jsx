import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";

const PASSWORD_RULE = /^[A-Za-z0-9._-]{6,16}$/;

export default function AdminPanel() {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState("");
  const [resetTarget, setResetTarget] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const data = await api.get("/admin/users");
    setUsers(data.users);
  };

  useEffect(() => {
    load();
  }, []);

  const doResetPassword = async (e) => {
    e.preventDefault();
    setError("");
    if (!PASSWORD_RULE.test(newPassword)) {
      setError("La contrasena debe tener 6 a 16 caracteres validos.");
      return;
    }
    setBusy(true);
    try {
      await api.post(`/admin/users/${resetTarget.id}/reset-password`, { newPassword });
      setResetTarget(null);
      setNewPassword("");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const removeUser = async (u) => {
    if (!confirm(`Eliminar a ${u.username}? Se mantiene en los proyectos existentes para no romper los balances.`))
      return;
    try {
      await api.post(`/admin/users/${u.id}/remove`);
      await load();
    } catch (err) {
      alert(err.message);
    }
  };

  const reactivateUser = async (u) => {
    await api.post(`/admin/users/${u.id}/reactivate`);
    await load();
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">
      <div>
        <Link to="/" className="text-xs text-slate-500 hover:text-neon-cyan">
          ← Dashboard
        </Link>
        <h1 className="title-glow text-3xl mt-1">Panel de administracion</h1>
        <p className="text-slate-400 text-sm mt-1">Gestion global de usuarios del servidor.</p>
      </div>

      <div className="panel divide-y divide-ink-700">
        {users.map((u) => (
          <div key={u.id} className="p-4 flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="font-semibold flex items-center gap-2">
                {u.username}
                {u.role === "admin" && <span className="badge border-neon-purple/60 text-neon-purple">admin</span>}
                <span
                  className={`badge ${
                    u.status === "active" ? "border-neon-green/60 text-neon-green" : "border-neon-red/60 text-neon-red"
                  }`}
                >
                  {u.status === "active" ? "activo" : "eliminado"}
                </span>
              </p>
              <p className="text-xs text-slate-500">Alta: {u.created_at}</p>
            </div>
            <div className="flex gap-2">
              <button
                className="btn-secondary !px-3 !py-1.5"
                onClick={() => {
                  setResetTarget(u);
                  setNewPassword("");
                  setError("");
                }}
              >
                Resetear contrasena
              </button>
              {u.status === "active" ? (
                <button className="btn-danger !px-3 !py-1.5" onClick={() => removeUser(u)}>
                  Eliminar
                </button>
              ) : (
                <button className="btn-primary !px-3 !py-1.5" onClick={() => reactivateUser(u)}>
                  Reactivar
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {resetTarget && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center px-4 z-30">
          <form onSubmit={doResetPassword} className="panel p-6 w-full max-w-sm space-y-4 shadow-neon">
            <h3 className="font-display uppercase tracking-widest text-neon-cyan text-sm">
              Nueva contrasena para {resetTarget.username}
            </h3>
            <input
              type="password"
              className="field"
              placeholder="6-16 caracteres"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoFocus
            />
            {error && <p className="text-neon-red text-xs">{error}</p>}
            <div className="flex gap-3">
              <button type="submit" disabled={busy} className="btn-primary">
                Guardar
              </button>
              <button type="button" className="btn-secondary" onClick={() => setResetTarget(null)}>
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
