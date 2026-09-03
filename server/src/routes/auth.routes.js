const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const db = require("../db");
const { validateUsername, validatePassword, validateCurrency } = require("../validators");
const { setAuthCookie, clearAuthCookie, requireAuth, COOKIE_NAME } = require("../auth");
const { parseSqliteUTC } = require("../utils");
const {
  listSessions,
  renameSession,
  revokeSession,
  revokeOtherSessions,
  revokeSessionByToken,
} = require("../services/sessions");
const { validateInviteCode, claimInvite } = require("../services/invites");

const router = express.Router();

const RESET_REQUEST_COOLDOWN_HOURS = 24;

// Los códigos de invitación se validan/reclaman desde afuera del dominio de
// Loot Ledger (ej. la card del proyecto en un portfolio), asi que estas dos
// rutas puntuales necesitan CORS habilitado -- a diferencia del resto de la
// API, que es same-origin. Sin "credentials" (no usan cookies, son públicas).
const inviteCors = cors({ origin: process.env.INVITE_CORS_ORIGIN || "https://castielo.duckdns.org" });

// Rate limit básico en memoria (proceso único, sin dependencias nuevas) para
// que no se puedan probar códigos por fuerza bruta. Es generoso a propósito:
// no debería notarlo un uso normal, pero frena un loop automatizado.
const INVITE_RATE_LIMIT = 20;
const INVITE_RATE_WINDOW_MS = 10 * 60 * 1000;
const inviteAttempts = new Map(); // ip -> { count, windowStart }

function inviteRateLimit(req, res, next) {
  const ip = req.ip || "unknown";
  const now = Date.now();
  const entry = inviteAttempts.get(ip);
  if (!entry || now - entry.windowStart > INVITE_RATE_WINDOW_MS) {
    inviteAttempts.set(ip, { count: 1, windowStart: now });
    return next();
  }
  entry.count += 1;
  if (entry.count > INVITE_RATE_LIMIT) {
    return res.status(429).json({ error: "Demasiados intentos. Probá de nuevo en un rato." });
  }
  next();
}

// Limpieza periódica para no acumular entradas de IPs que ya no vuelven.
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of inviteAttempts) {
    if (now - entry.windowStart > INVITE_RATE_WINDOW_MS) inviteAttempts.delete(ip);
  }
}, 60 * 60 * 1000).unref();

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    status: user.status,
    defaultCurrency: user.default_currency || null,
  };
}

router.post("/register", (req, res) => {
  const { username, password, code } = req.body || {};
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
    if (existing.status === "invited") {
      // Placeholder de una invitación sin reclamar: NO se puede tomar por acá
      // adivinando el username -- solo se reclama con /auth/claim-invite y su
      // código. Devolvemos el mismo 409 que "nombre en uso" para no filtrar
      // que ese username en particular es un placeholder de invitación.
      return res.status(409).json({ error: "Ese nombre de usuario ya está en uso.", code: "USERNAME_TAKEN" });
    }
    // status === 'rejected': se reenvía como nueva solicitud pendiente de aprobación.
    db.prepare(
      "UPDATE users SET password_hash = ?, status = 'pending', updated_at = datetime('now') WHERE id = ?"
    ).run(hash, existing.id);
    return res.status(202).json({ status: "pending" });
  }

  // Usuario totalmente nuevo (nunca visto antes): este servidor es por
  // invitación, ya no hay alta libre. Requiere el mismo código de invitación
  // que /auth/claim-invite y reusa exactamente la misma lógica -- esta ruta
  // es simplemente la variante same-origin de esa (la pantalla de "Crear
  // personaje" pega acá, el botón embebido en el portfolio pega directo a
  // /auth/claim-invite por el tema de CORS).
  if (!code || typeof code !== "string") {
    return res.status(403).json({
      error: "Este servidor es por invitación. Pedile un código de invitación al administrador.",
      code: "INVITE_REQUIRED",
    });
  }
  try {
    claimInvite(code, username, password);
  } catch (err) {
    if (err.code === "INVALID_INVITE") {
      return res.status(404).json({ error: err.message, code: "INVALID_INVITE" });
    }
    if (err.code === "USERNAME_TAKEN") {
      return res.status(409).json({ error: err.message, code: "USERNAME_TAKEN" });
    }
    throw err;
  }
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
  if (user.status === "invited") {
    return res.status(403).json({
      error: "Esta es una invitación sin reclamar. Usá el código de invitación para crear tu cuenta.",
      code: "INVITE_UNCLAIMED",
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

router.post("/sessions/:sessionId/rename", requireAuth, (req, res) => {
  const sessionId = Number(req.params.sessionId);
  const { label } = req.body || {};
  if (typeof label !== "string") {
    return res.status(400).json({ error: "Falta el nombre." });
  }
  if (label.trim().length > 60) {
    return res.status(400).json({ error: "El nombre es demasiado largo (máximo 60 caracteres)." });
  }
  const renamed = renameSession(req.user.id, sessionId, label);
  if (!renamed) return res.status(404).json({ error: "Sesión no encontrada." });
  res.json({ ok: true });
});

router.post("/sessions/revoke-others", requireAuth, (req, res) => {
  const count = revokeOtherSessions(req.user.id, req.sessionId);
  res.json({ ok: true, revoked: count });
});

// Valida un código sin consumirlo -- no requiere login, es la primera
// consulta que hace quien llega con una invitación (desde acá o desde afuera).
router.options("/invite/:code", inviteCors);
router.get("/invite/:code", inviteCors, inviteRateLimit, (req, res) => {
  const result = validateInviteCode(req.params.code);
  if (!result) {
    return res.status(404).json({ valid: false, error: "Código de invitación inválido o ya usado.", code: "INVALID_INVITE" });
  }
  res.json({ valid: true, mode: result.mode });
});

// Reclama un placeholder (Caso A): pisa usuario/contraseña y la cuenta pasa
// a 'pending', mismo flujo de aprobación que un registro común. No inicia
// sesión sola a propósito -- el admin todavía tiene que aprobarla.
router.options("/claim-invite", inviteCors);
router.post("/claim-invite", inviteCors, inviteRateLimit, (req, res) => {
  const { code, username, password } = req.body || {};
  if (!code || typeof code !== "string") {
    return res.status(400).json({ error: "Falta el código de invitación." });
  }
  const usernameError = validateUsername(username);
  if (usernameError) return res.status(400).json({ error: usernameError });
  const passwordError = validatePassword(password);
  if (passwordError) return res.status(400).json({ error: passwordError });

  try {
    claimInvite(code, username, password);
  } catch (err) {
    if (err.code === "INVALID_INVITE") {
      return res.status(404).json({ error: err.message, code: "INVALID_INVITE" });
    }
    if (err.code === "USERNAME_TAKEN") {
      return res.status(409).json({ error: err.message, code: "USERNAME_TAKEN" });
    }
    throw err;
  }
  return res.status(202).json({ status: "pending" });
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

router.post("/default-currency", requireAuth, (req, res) => {
  const { currency } = req.body || {};
  if (!validateCurrency(currency)) return res.status(400).json({ error: "Moneda inválida." });
  db.prepare("UPDATE users SET default_currency = ?, updated_at = datetime('now') WHERE id = ?").run(
    currency,
    req.user.id
  );
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
