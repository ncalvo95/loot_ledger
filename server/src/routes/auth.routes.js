const express = require("express");
const bcrypt = require("bcryptjs");
const db = require("../db");
const { validateUsername, validatePassword } = require("../validators");
const { setAuthCookie, clearAuthCookie, requireAuth } = require("../auth");

const router = express.Router();

function publicUser(user) {
  return { id: user.id, username: user.username, role: user.role, status: user.status };
}

router.post("/register", (req, res) => {
  const { username, password } = req.body || {};
  const usernameError = validateUsername(username);
  if (usernameError) return res.status(400).json({ error: usernameError });
  const passwordError = validatePassword(password);
  if (passwordError) return res.status(400).json({ error: passwordError });

  const existing = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
  const hash = bcrypt.hashSync(password, 10);

  if (existing) {
    if (existing.status === "active") {
      return res.status(409).json({ error: "Ese nombre de usuario ya esta en uso." });
    }
    // Usuario previamente eliminado: se reactiva conservando su historial y proyectos.
    db.prepare(
      "UPDATE users SET password_hash = ?, status = 'active', updated_at = datetime('now') WHERE id = ?"
    ).run(hash, existing.id);
    const reactivated = db.prepare("SELECT * FROM users WHERE id = ?").get(existing.id);
    setAuthCookie(res, reactivated);
    return res.status(200).json({ user: publicUser(reactivated), reactivated: true });
  }

  const info = db
    .prepare("INSERT INTO users (username, password_hash, role, status) VALUES (?, ?, 'user', 'active')")
    .run(username, hash);
  const created = db.prepare("SELECT * FROM users WHERE id = ?").get(info.lastInsertRowid);
  setAuthCookie(res, created);
  return res.status(201).json({ user: publicUser(created), reactivated: false });
});

router.post("/login", (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: "Usuario y contrasena son obligatorios." });
  }
  const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
  if (!user || user.status !== "active") {
    return res.status(401).json({ error: "Credenciales invalidas." });
  }
  const ok = bcrypt.compareSync(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: "Credenciales invalidas." });
  setAuthCookie(res, user);
  return res.json({ user: publicUser(user) });
});

router.post("/logout", (req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

router.get("/me", requireAuth, (req, res) => {
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
  if (!user || user.status !== "active") return res.status(401).json({ error: "No autenticado." });
  res.json({ user: publicUser(user) });
});

module.exports = router;
