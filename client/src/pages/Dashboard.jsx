import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";

export default function Dashboard() {
  const [active, setActive] = useState([]);
  const [invited, setInvited] = useState([]);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const data = await api.get("/projects");
    setActive(data.active);
    setInvited(data.invited);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const createProject = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setBusy(true);
    setError("");
    try {
      await api.post("/projects", { name: newName.trim() });
      setNewName("");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const respond = async (projectId, accept) => {
    await api.post(`/projects/${projectId}/${accept ? "accept" : "decline"}`);
    await load();
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-10 space-y-10">
      <div>
        <h1 className="title-glow text-3xl">Tus mazmorras de gastos</h1>
        <p className="text-slate-400 mt-1">Elegi un proyecto para ver el Ledger y el Loot, o forja uno nuevo.</p>
      </div>

      {invited.length > 0 && (
        <section className="panel p-5 border-neon-purple/40">
          <h2 className="font-display uppercase tracking-widest text-neon-purple text-sm mb-3">
            Invitaciones pendientes
          </h2>
          <ul className="space-y-3">
            {invited.map((p) => (
              <li key={p.id} className="flex items-center justify-between bg-ink-800/70 rounded-lg px-4 py-3">
                <div>
                  <p className="font-semibold">{p.name}</p>
                  <p className="text-xs text-slate-400">Creado por {p.owner_username}</p>
                </div>
                <div className="flex gap-2">
                  <button className="btn-primary !px-3 !py-1.5" onClick={() => respond(p.id, true)}>
                    Unirse
                  </button>
                  <button className="btn-ghost !px-3 !py-1.5" onClick={() => respond(p.id, false)}>
                    Rechazar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="grid md:grid-cols-3 gap-5">
        <div className="md:col-span-2">
          <h2 className="font-display uppercase tracking-widest text-slate-400 text-sm mb-3">Tus proyectos</h2>
          {loading ? (
            <p className="text-slate-500 text-sm">Cargando...</p>
          ) : active.length === 0 ? (
            <p className="text-slate-500 text-sm">Todavia no formas parte de ningun proyecto.</p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {active.map((p) => (
                <Link
                  key={p.id}
                  to={`/projects/${p.id}`}
                  className="panel p-5 hover:border-neon-cyan/60 hover:shadow-neon transition-all group"
                >
                  <div className="flex items-start justify-between">
                    <h3 className="font-display font-bold text-lg text-slate-100 group-hover:text-neon-cyan">
                      {p.name}
                    </h3>
                    <span className="text-2xl">🗺️</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">Dueno: {p.owner_username}</p>
                  <p className="text-xs text-slate-500">{p.member_count} miembro(s)</p>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div>
          <h2 className="font-display uppercase tracking-widest text-slate-400 text-sm mb-3">Nuevo proyecto</h2>
          <form onSubmit={createProject} className="panel p-5 space-y-3">
            <div>
              <label className="label">Nombre</label>
              <input
                className="field"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ej: Viaje a la Costa"
              />
            </div>
            {error && <p className="text-neon-red text-xs">{error}</p>}
            <button type="submit" disabled={busy} className="btn-primary w-full">
              {busy ? "Creando..." : "+ Crear proyecto"}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
