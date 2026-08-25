import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

const USERNAME_RULE = /^[A-Za-z0-9._-]{4,10}$/;
const PASSWORD_RULE = /^[A-Za-z0-9._-]{6,16}$/;

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!USERNAME_RULE.test(username)) {
      setError("Usuario: 4 a 10 caracteres, solo letras, numeros, puntos, guion o guion bajo.");
      return;
    }
    if (!PASSWORD_RULE.test(password)) {
      setError("Contrasena: 6 a 16 caracteres, solo letras, numeros, puntos, guion o guion bajo.");
      return;
    }
    if (password !== confirm) {
      setError("Las contrasenas no coinciden.");
      return;
    }
    setBusy(true);
    try {
      const data = await register(username, password);
      navigate("/", { state: { reactivated: data.reactivated } });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="panel w-full max-w-sm p-8 shadow-neon-purple">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🎲</div>
          <h1 className="title-glow text-2xl">Crear personaje</h1>
          <p className="text-slate-400 text-sm mt-1">Registro de nuevo usuario</p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="label">Usuario</label>
            <input
              className="field"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="4-10 caracteres"
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
              placeholder="6-16 caracteres"
              autoComplete="new-password"
              required
            />
          </div>
          <div>
            <label className="label">Confirmar contrasena</label>
            <input
              type="password"
              className="field"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              required
            />
          </div>
          {error && <p className="text-neon-red text-sm">{error}</p>}
          <button type="submit" disabled={busy} className="btn-primary w-full">
            {busy ? "Creando..." : "Crear cuenta"}
          </button>
        </form>
        <p className="text-center text-sm text-slate-400 mt-6">
          Ya tenes cuenta?{" "}
          <Link to="/login" className="text-neon-cyan hover:underline">
            Iniciar sesion
          </Link>
        </p>
      </div>
    </div>
  );
}
