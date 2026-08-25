import React, { useState } from "react";
import { api } from "../api.js";

export default function MembersPanel({ projectId, members, isOwner, onChanged }) {
  const [username, setUsername] = useState("");
  const [mode, setMode] = useState("add");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await api.post(`/projects/${projectId}/members`, { username: username.trim(), mode });
      setUsername("");
      onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const removeMember = async (userId) => {
    if (!confirm("Quitar a este jugador del proyecto? Su historial de gastos se conserva.")) return;
    await api.post(`/projects/${projectId}/members/${userId}/remove`);
    onChanged();
  };

  const statusBadge = (status) => {
    if (status === "member") return "border-neon-green/60 text-neon-green";
    if (status === "invited") return "border-neon-purple/60 text-neon-purple";
    return "border-slate-600 text-slate-500";
  };

  return (
    <div className="space-y-4">
      <div className="panel p-5">
        <h3 className="font-display uppercase tracking-widest text-slate-300 text-sm mb-3">Equipo</h3>
        <ul className="space-y-2">
          {members.map((m) => (
            <li key={m.user_id} className="flex items-center justify-between bg-ink-800/60 rounded-lg px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="text-sm">{m.username}</span>
                <span className={`badge ${statusBadge(m.status)}`}>{m.status}</span>
                {m.account_status === "removed" && (
                  <span className="badge border-neon-red/50 text-neon-red">cuenta eliminada</span>
                )}
              </div>
              {isOwner && m.status !== "removed" && (
                <button className="btn-ghost !px-2 !py-1 text-[10px]" onClick={() => removeMember(m.user_id)}>
                  Quitar
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>

      {isOwner && (
        <form onSubmit={submit} className="panel p-5 space-y-3">
          <h3 className="font-display uppercase tracking-widest text-neon-purple text-sm">Sumar jugador</h3>
          <input
            className="field"
            placeholder="Nombre de usuario"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <div className="flex gap-4 text-sm text-slate-300">
            <label className="flex items-center gap-1">
              <input type="radio" checked={mode === "add"} onChange={() => setMode("add")} /> Agregar directo
            </label>
            <label className="flex items-center gap-1">
              <input type="radio" checked={mode === "invite"} onChange={() => setMode("invite")} /> Otorgar
              visibilidad (invitar)
            </label>
          </div>
          {error && <p className="text-neon-red text-xs">{error}</p>}
          <button type="submit" disabled={busy} className="btn-primary w-full">
            {busy ? "Enviando..." : "Confirmar"}
          </button>
        </form>
      )}
    </div>
  );
}
