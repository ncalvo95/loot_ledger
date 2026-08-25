import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(username, password);
      navigate("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="panel w-full max-w-sm p-8 shadow-neon">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🕹️</div>
          <h1 className="title-glow text-2xl">Loot Ledger</h1>
          <p className="text-slate-400 text-sm mt-1">Iniciar sesion</p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="label">Usuario</label>
            <input
              className="field"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </div>
          <div>
            <label className="label">Contrasena</label>
            <input
              type="password"
              className="field"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          {error && <p className="text-neon-red text-sm">{error}</p>}
          <button type="submit" disabled={busy} className="btn-primary w-full">
            {busy ? "Entrando..." : "Entrar"}
          </button>
        </form>
        <p className="text-center text-sm text-slate-400 mt-6">
          No tenes cuenta?{" "}
          <Link to="/register" className="text-neon-cyan hover:underline">
            Crear personaje
          </Link>
        </p>
      </div>
    </div>
  );
}
