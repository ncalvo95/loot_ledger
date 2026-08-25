const express = require("express");
const bcrypt = require("bcryptjs");
const db = require("../db");
const { validatePassword } = require("../validators");
const { requireAuth, requireAdmin } = require("../auth");

const router = express.Router();
router.use(requireAuth, requireAdmin);

function publicUser(user) {
  return { id: user.id, username: user.username, role: user.role, status: user.status, created_at: user.created_at };
}

router.get("/users", (req, res) => {
  const users = db.prepare("SELECT * FROM users ORDER BY status ASC, username ASC").all();
  res.json({ users: users.map(publicUser) });
});

router.post("/users/:id/reset-password", (req, res) => {
  const { newPassword } = req.body || {};
  const passwordError = validatePassword(newPassword);
  if (passwordError) return res.status(400).json({ error: passwordError });

  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.id);
  if (!user) return res.status(404).json({ error: "Usuario no encontrado." });

  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?").run(hash, user.id);
  res.json({ ok: true });
});

router.post("/users/:id/remove", (req, res) => {
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.id);
  if (!user) return res.status(404).json({ error: "Usuario no encontrado." });
  if (user.username === "administrator") {
    return res.status(400).json({ error: "No se puede eliminar al administrador principal." });
  }
  if (user.id === req.user.id) {
    return res.status(400).json({ error: "No podes eliminar tu propia cuenta desde el panel." });
  }
  db.prepare("UPDATE users SET status = 'removed', updated_at = datetime('now') WHERE id = ?").run(user.id);
  res.json({ ok: true });
});

router.post("/users/:id/reactivate", (req, res) => {
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.id);
  if (!user) return res.status(404).json({ error: "Usuario no encontrado." });
  db.prepare("UPDATE users SET status = 'active', updated_at = datetime('now') WHERE id = ?").run(user.id);
  res.json({ ok: true });
});

module.exports = router;
