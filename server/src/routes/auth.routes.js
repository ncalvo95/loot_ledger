const express = require("express");
const bcrypt = require("bcryptjs");
const db = require("../db");
const { validateUsername, validatePassword } = require("../validators");
const { setAuthCookie, clearAuthCookie, requireAuth, COOKIE_NAME } = require("../auth");
const { parseSqliteUTC } = require("../utils");
const {
  listSessions,
  revokeSession,
  revokeOtherSessions,
  revokeSessionByToken,
} = require("../services/sessions");

const router = express.Router();

const RESET_REQUEST_COOLDOWN_HOURS = 24;

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
    if (existing.status === "active" || existing.status === "pending") {
      return res.status(409).json({
        error:
          existing.status === "pending"
            ? "Ya existe una solicitud pendiente con ese nombre de usuario."
            : "Ese nombre de usuario ya está en uso.",
        code: existing.status === "pending" ? "ALREADY_PENDING" : "USERNAME_TAKEN",
      });
    }
    if (existing.status === "removed") {
      // Usuario previamente eliminado: se reactiva de inmediato, conservando su
      // historial y proyectos (ya fue una cuenta aprobada, no hace falta re-aprobarla).
      db.prepare(
        "UPDATE users SET password_hash = ?, status = 'active', updated_at = datetime('now') WHERE id = ?"
      ).run(hash, existing.id);
      const reactivated = db.prepare("SELECT * FROM users WHERE id = ?").get(existing.id);
      setAuthCookie(req, res, reactivated, false, req.get("user-agent"));
      return res.status(200).json({ user: publicUser(reactivated), status: "active", reactivated: true });
    }
    // status === 'rejected': se reenvía como nueva solicitud pendiente de aprobación.
    db.prepare(
      "UPDATE users SET password_hash = ?, status = 'pending', updated_at = datetime('now') WHERE id = ?"
    ).run(hash, existing.id);
    return res.status(202).json({ status: "pending" });
  }

  db.prepare(
    "INSERT INTO users (username, password_hash, role, status) VALUES (?, ?, 'user', 'pending')"
  ).run(username, hash);
  return res.status(202).json({ status: "pending" });
});

router.post("/login", (req, res) => {
  const { username, password, remember } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: "Usuario y contraseña son obligatorios." });
  }
  const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: "Credenciales inválidas.", code: "INVALID_CREDENTIALS" });
  }

  if (user.status === "pending") {
    return res.status(403).json({
      error: "Tu cuenta está pendiente de aprobación del administrador.",
      code: "PENDING_APPROVAL",
    });
  }
  if (user.status === "rejected") {
    return res.status(403).json({
      error: "Tu solicitud de cuenta fue rechazada. Contactá al administrador.",
      code: "REJECTED",
    });
  }
  if (user.status === "removed") {
    return res.status(403).json({
      error: "Esta cuenta fue eliminada. Podés volver a registrarte con el mismo usuario.",
      code: "REMOVED",
    });
  }

  setAuthCookie(req, res, user, !!remember, req.get("user-agent"));
  return res.json({ user: publicUser(user) });
});

router.post("/logout", (req, res) => {
  const token = req.cookies ? req.cookies[COOKIE_NAME] : null;
  revokeSessionByToken(token);
  clearAuthCookie(res);
  res.json({ ok: true });
});

router.get("/sessions", requireAuth, (req, res) => {
  const sessions = listSessions(req.user.id).map((s) => ({ ...s, current: s.id === req.sessionId }));
  res.json({ sessions });
});

router.post("/sessions/:sessionId/revoke", requireAuth, (req, res) => {
  const sessionId = Number(req.params.sessionId);
  if (sessionId === req.sessionId) {
    return res.status(400).json({ error: "Para cerrar tu sesión actual usá 'Salir'." });
  }
  const revoked = revokeSession(req.user.id, sessionId);
  if (!revoked) return res.status(404).json({ error: "Sesión no encontrada." });
  res.json({ ok: true });
});

router.post("/sessions/revoke-others", requireAuth, (req, res) => {
  const count = revokeOtherSessions(req.user.id, req.sessionId);
  res.json({ ok: true, revoked: count });
});

router.get("/me", requireAuth, (req, res) => {
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
  if (!user || user.status !== "active") return res.status(401).json({ error: "No autenticado." });
  res.json({ user: publicUser(user) });
});

router.post("/change-password", requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  const passwordError = validatePassword(newPassword);
  if (passwordError) return res.status(400).json({ error: passwordError });

  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
  if (!user || user.status !== "active") return res.status(401).json({ error: "No autenticado." });
  if (!bcrypt.compareSync(currentPassword || "", user.password_hash)) {
    return res.status(400).json({ error: "La contraseña actual no es correcta.", code: "WRONG_CURRENT_PASSWORD" });
  }

  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?").run(hash, user.id);
  revokeOtherSessions(user.id, req.sessionId);
  res.json({ ok: true });
});

router.post("/forgot-password", (req, res) => {
  const { username } = req.body || {};
  if (!username) return res.status(400).json({ error: "Indicá tu nombre de usuario." });

  const user = db.prepare("SELECT * FROM users WHERE username = ? AND status = 'active'").get(username);
  if (user) {
    const last = db
      .prepare("SELECT * FROM password_reset_requests WHERE user_id = ? ORDER BY requested_at DESC LIMIT 1")
      .get(user.id);
    if (last) {
      const hoursSince = (Date.now() - parseSqliteUTC(last.requested_at).getTime()) / 3600000;
      if (hoursSince < RESET_REQUEST_COOLDOWN_HOURS) {
        const hoursLeft = Math.ceil(RESET_REQUEST_COOLDOWN_HOURS - hoursSince);
        return res.status(429).json({
          error: `Ya solicitaste un restablecimiento de contraseña. Volvé a intentar en ${hoursLeft}hs.`,
          code: "RATE_LIMITED",
        });
      }
    }
    db.prepare(
      "INSERT INTO password_reset_requests (user_id, status, requested_at) VALUES (?, 'pending', datetime('now'))"
    ).run(user.id);
  }

  // Respuesta genérica: no confirmamos si el usuario existe o no.
  res.json({ ok: true });
});

module.exports = router;
