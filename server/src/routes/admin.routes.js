const express = require("express");
const bcrypt = require("bcryptjs");
const db = require("../db");
const { validateUsername, validatePassword } = require("../validators");
const { requireAuth, requireAdmin } = require("../auth");

const router = express.Router();
router.use(requireAuth, requireAdmin);

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    status: user.status,
    created_at: user.created_at,
  };
}

router.get("/users", (req, res) => {
  const users = db.prepare("SELECT * FROM users ORDER BY status ASC, username ASC").all();
  res.json({ users: users.map(publicUser) });
});

// El administrador crea una cuenta directamente, sin pasar por aprobacion.
router.post("/users", (req, res) => {
  const { username, password } = req.body || {};
  const usernameError = validateUsername(username);
  if (usernameError) return res.status(400).json({ error: usernameError });
  const passwordError = validatePassword(password);
  if (passwordError) return res.status(400).json({ error: passwordError });

  const existing = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
  const hash = bcrypt.hashSync(password, 10);

  if (existing) {
    if (existing.status === "active" || existing.status === "pending") {
      return res.status(409).json({ error: "Ese nombre de usuario ya esta en uso." });
    }
    db.prepare(
      "UPDATE users SET password_hash = ?, status = 'active', updated_at = datetime('now') WHERE id = ?"
    ).run(hash, existing.id);
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(existing.id);
    return res.status(201).json({ user: publicUser(user) });
  }

  const info = db
    .prepare("INSERT INTO users (username, password_hash, role, status) VALUES (?, ?, 'user', 'active')")
    .run(username, hash);
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(info.lastInsertRowid);
  res.status(201).json({ user: publicUser(user) });
});

router.post("/users/:id/rename", (req, res) => {
  const { newUsername } = req.body || {};
  const usernameError = validateUsername(newUsername);
  if (usernameError) return res.status(400).json({ error: usernameError });

  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.id);
  if (!user) return res.status(404).json({ error: "Usuario no encontrado." });

  const clash = db.prepare("SELECT id FROM users WHERE username = ? AND id != ?").get(newUsername, user.id);
  if (clash) return res.status(409).json({ error: "Ese nombre de usuario ya esta en uso." });

  // Renombrar es seguro para los calculos: expenses/expense_splits/project_members
  // referencian usuarios por id, nunca por username.
  db.prepare("UPDATE users SET username = ?, updated_at = datetime('now') WHERE id = ?").run(
    newUsername,
    user.id
  );
  res.json({ ok: true });
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

function bulkUpdateStatus(ids, fromStatus, toStatus) {
  const stmt = db.prepare("UPDATE users SET status = ?, updated_at = datetime('now') WHERE id = ? AND status = ?");
  const tx = db.transaction((idList) => {
    for (const id of idList) stmt.run(toStatus, id, fromStatus);
  });
  tx(ids);
}

router.post("/users/approve", (req, res) => {
  const { ids } = req.body || {};
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "Indica al menos un usuario a aprobar." });
  }
  bulkUpdateStatus(ids, "pending", "active");
  res.json({ ok: true });
});

router.post("/users/reject", (req, res) => {
  const { ids } = req.body || {};
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "Indica al menos un usuario a rechazar." });
  }
  bulkUpdateStatus(ids, "pending", "rejected");
  res.json({ ok: true });
});

router.get("/password-reset-requests", (req, res) => {
  const requests = db
    .prepare(
      `SELECT prr.id, prr.user_id, prr.status, prr.requested_at, u.username
       FROM password_reset_requests prr
       JOIN users u ON u.id = prr.user_id
       WHERE prr.status = 'pending'
       ORDER BY prr.requested_at ASC`
    )
    .all();
  res.json({ requests });
});

router.post("/password-reset-requests/:id/resolve", (req, res) => {
  const { newPassword } = req.body || {};
  const passwordError = validatePassword(newPassword);
  if (passwordError) return res.status(400).json({ error: passwordError });

  const request = db.prepare("SELECT * FROM password_reset_requests WHERE id = ?").get(req.params.id);
  if (!request) return res.status(404).json({ error: "Solicitud no encontrada." });
  if (request.status === "resolved") return res.status(400).json({ error: "Esa solicitud ya fue resuelta." });

  const hash = bcrypt.hashSync(newPassword, 10);
  const tx = db.transaction(() => {
    db.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?").run(
      hash,
      request.user_id
    );
    db.prepare(
      "UPDATE password_reset_requests SET status = 'resolved', resolved_at = datetime('now'), resolved_by = ? WHERE id = ?"
    ).run(req.user.id, request.id);
  });
  tx();
  res.json({ ok: true });
});

module.exports = router;
