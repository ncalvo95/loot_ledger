import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useLanguage } from "../i18n/LanguageContext.jsx";

const PROJECT_EMOJIS = [
  "🗺️", "🎮", "🏆", "💰", "🛡️", "⚔️", "🔥", "💎", "🍕", "🏕️",
  "✈️", "🚗", "🏠", "🎉", "🍺", "☕", "🎸", "🐉", "👾", "🎲",
  "🧭", "⛺", "🏔️", "🚀", "🛒", "📦", "🎯", "🍔", "🎬", "⚡",
];

export default function Dashboard() {
  const { user } = useAuth();
  const { t, tError } = useLanguage();
  const [active, setActive] = useState([]);
  const [invited, setInvited] = useState([]);
  const [newName, setNewName] = useState("");
  const [newEmoji, setNewEmoji] = useState(PROJECT_EMOJIS[0]);
  const [newType, setNewType] = useState("shared");
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
      await api.post("/projects", { name: newName.trim(), emoji: newEmoji, type: newType });
      setNewName("");
      setNewEmoji(PROJECT_EMOJIS[0]);
      setNewType("shared");
      await load();
    } catch (err) {
      setError(tError(err));
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
        <h1 className="title-glow text-3xl">{t("dashboard.title")}</h1>
        <p className="text-slate-400 mt-1">{t("dashboard.subtitle")}</p>
      </div>

      {invited.length > 0 && (
        <section className="panel p-5 border-neon-purple/40">
          <h2 className="font-display uppercase tracking-widest text-neon-purple text-sm mb-3">
            {t("dashboard.pendingInvites")}
          </h2>
          <ul className="space-y-3">
            {invited.map((p) => (
              <li key={p.id} className="flex items-center justify-between bg-ink-800/70 rounded-lg px-4 py-3">
                <div>
                  <p className="font-semibold">{p.name}</p>
                  <p className="text-xs text-slate-400">
                    {t("dashboard.createdBy")} {p.owner_username}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button className="btn-primary !px-3 !py-1.5" onClick={() => respond(p.id, true)}>
                    {t("dashboard.join")}
                  </button>
                  <button className="btn-ghost !px-3 !py-1.5" onClick={() => respond(p.id, false)}>
                    {t("dashboard.decline")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="grid md:grid-cols-3 gap-5">
        <div className="md:col-span-2">
          <h2 className="font-display uppercase tracking-widest text-slate-400 text-sm mb-3">
            {user.role === "admin" ? t("dashboard.allProjects") : t("dashboard.yourProjects")}
          </h2>
          {loading ? (
            <p className="text-slate-500 text-sm">{t("common.loading")}</p>
          ) : active.length === 0 ? (
            <p className="text-slate-500 text-sm">{t("dashboard.noProjects")}</p>
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
                    <span className="text-2xl">{p.emoji || "🗺️"}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    {t("dashboard.owner")}: {p.owner_username}
                  </p>
                  <p className="text-xs text-slate-500">
                    {p.member_count} {t("dashboard.members")}
                  </p>
                  {p.type === "individual" && (
                    <span className="badge border-neon-gold/50 text-neon-gold mt-2 inline-block mr-2">
                      {t("dashboard.typeIndividual")}
                    </span>
                  )}
                  {!p.is_member && (
                    <span className="badge border-neon-purple/50 text-neon-purple mt-2 inline-block">
                      {t("dashboard.viewOnly")}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>

        <div>
          <h2 className="font-display uppercase tracking-widest text-slate-400 text-sm mb-3">
            {t("dashboard.newProject")}
          </h2>
          <form onSubmit={createProject} className="panel p-5 space-y-3">
            <div>
              <label className="label">{t("dashboard.projectName")}</label>
              <input
                className="field"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={t("dashboard.projectNamePlaceholder")}
              />
            </div>
            <div>
              <label className="label">
                {t("dashboard.projectEmoji")} {newEmoji}
              </label>
              <div className="flex flex-wrap gap-1.5">
                {PROJECT_EMOJIS.map((em) => (
                  <button
                    key={em}
                    type="button"
                    onClick={() => setNewEmoji(em)}
                    className={`text-lg w-8 h-8 flex items-center justify-center rounded-md border ${
                      em === newEmoji
                        ? "border-neon-cyan/70 bg-neon-cyan/10"
                        : "border-ink-600 hover:border-slate-400"
                    }`}
                  >
                    {em}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="label">{t("dashboard.projectType")}</label>
              <div className="flex gap-4 text-sm text-slate-300">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="radio" checked={newType === "shared"} onChange={() => setNewType("shared")} />
                  {t("dashboard.typeShared")}
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    checked={newType === "individual"}
                    onChange={() => setNewType("individual")}
                  />
                  {t("dashboard.typeIndividual")}
                </label>
              </div>
            </div>
            {error && <p className="text-neon-red text-xs">{error}</p>}
            <button type="submit" disabled={busy} className="btn-primary w-full">
              {busy ? t("common.creating") : t("dashboard.createProject")}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
