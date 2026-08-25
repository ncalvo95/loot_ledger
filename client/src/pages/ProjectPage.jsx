import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";
import ExpenseForm from "../components/ExpenseForm.jsx";
import ExpenseList from "../components/ExpenseList.jsx";
import BalanceView from "../components/BalanceView.jsx";
import MembersPanel from "../components/MembersPanel.jsx";
import ExportPanel from "../components/ExportPanel.jsx";
import { Loading } from "../components/ProtectedRoute.jsx";

const TABS = [
  { key: "ledger", label: "Ledger" },
  { key: "loot", label: "Loot" },
  { key: "team", label: "Equipo" },
];

export default function ProjectPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [detail, setDetail] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [balances, setBalances] = useState([]);
  const [tab, setTab] = useState("ledger");
  const [showForm, setShowForm] = useState(false);
  const [filterMonth, setFilterMonth] = useState("");
  const [filterYear, setFilterYear] = useState("");
  const [error, setError] = useState("");

  const loadDetail = async () => {
    const data = await api.get(`/projects/${id}`);
    setDetail(data);
  };

  const loadExpenses = async () => {
    const params = new URLSearchParams();
    if (filterMonth) params.set("month", filterMonth);
    if (filterYear) params.set("year", filterYear);
    const data = await api.get(`/projects/${id}/expenses?${params.toString()}`);
    setExpenses(data.expenses);
  };

  const loadBalances = async () => {
    const data = await api.get(`/projects/${id}/balances`);
    setBalances(data.balances);
  };

  useEffect(() => {
    setError("");
    loadDetail().catch((err) => setError(err.message));
  }, [id]);

  useEffect(() => {
    if (!detail) return;
    loadExpenses().catch((err) => setError(err.message));
    loadBalances().catch((err) => setError(err.message));
  }, [detail, filterMonth, filterYear]);

  if (error) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <p className="text-neon-red">{error}</p>
        <Link to="/" className="btn-secondary inline-flex mt-4">
          Volver
        </Link>
      </div>
    );
  }

  if (!detail) return <Loading />;

  const activeMembers = detail.members.filter((m) => m.status === "member");
  const memberOptions = activeMembers.map((m) => ({ id: m.user_id, username: m.username }));

  const refreshAll = async () => {
    await Promise.all([loadExpenses(), loadBalances()]);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <Link to="/" className="text-xs text-slate-500 hover:text-neon-cyan">
            ← Dashboard
          </Link>
          <h1 className="title-glow text-3xl mt-1">{detail.project.name}</h1>
        </div>
        <nav className="flex gap-2">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`btn ${
                tab === t.key
                  ? "bg-neon-cyan/15 text-neon-cyan border border-neon-cyan/60 shadow-neon"
                  : "bg-ink-800 text-slate-400 border border-ink-600 hover:text-slate-100"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {tab === "ledger" && (
        <div className="space-y-5">
          <ExportPanel projectId={id} />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <input
                type="number"
                placeholder="Mes (1-12)"
                className="field !w-32 !py-1.5"
                value={filterMonth}
                onChange={(e) => setFilterMonth(e.target.value)}
                min="1"
                max="12"
              />
              <input
                type="number"
                placeholder="Ano"
                className="field !w-24 !py-1.5"
                value={filterYear}
                onChange={(e) => setFilterYear(e.target.value)}
              />
              {(filterMonth || filterYear) && (
                <button
                  className="btn-ghost !px-2 !py-1"
                  onClick={() => {
                    setFilterMonth("");
                    setFilterYear("");
                  }}
                >
                  Limpiar
                </button>
              )}
            </div>
            {!showForm && (
              <button className="btn-primary" onClick={() => setShowForm(true)}>
                + Anadir Gasto
              </button>
            )}
          </div>

          {showForm && (
            <ExpenseForm
              projectId={id}
              members={memberOptions}
              categories={detail.categories}
              onCreated={async () => {
                setShowForm(false);
                await Promise.all([refreshAll(), loadDetail()]);
              }}
              onCancel={() => setShowForm(false)}
            />
          )}

          <ExpenseList
            projectId={id}
            expenses={expenses}
            canManage={detail.isOwner}
            currentUserId={user.id}
            onChanged={refreshAll}
          />
        </div>
      )}

      {tab === "loot" && <BalanceView balances={balances} />}

      {tab === "team" && (
        <MembersPanel
          projectId={id}
          members={detail.members}
          isOwner={detail.isOwner}
          onChanged={loadDetail}
        />
      )}
    </div>
  );
}
