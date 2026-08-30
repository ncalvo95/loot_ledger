const crypto = require("crypto");
const db = require("../db");
const { parseSqliteUTC } = require("../utils");

const REMEMBER_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 días
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 1 día
const TOUCH_THROTTLE_MS = 5 * 60 * 1000; // no reescribir last_seen_at en cada request
const MAX_SESSIONS_PER_USER = 5;

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function labelUserAgent(ua) {
  if (!ua) return "Dispositivo desconocido";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\//.test(ua)
    ? "Opera"
    : /Chrome\//.test(ua)
    ? "Chrome"
    : /Firefox\//.test(ua)
    ? "Firefox"
    : /Safari\//.test(ua)
    ? "Safari"
    : "Navegador";
  const os = /Windows/.test(ua)
    ? "Windows"
    : /Android/.test(ua)
    ? "Android"
    : /iPhone|iPad/.test(ua)
    ? "iOS"
    : /Mac OS X/.test(ua)
    ? "macOS"
    : /Linux/.test(ua)
    ? "Linux"
    : "";
  return os ? `${browser} en ${os}` : browser;
}

function createSession(userId, { remember, userAgent }) {
  db.prepare("DELETE FROM sessions WHERE user_id = ? AND expires_at <= datetime('now')").run(userId);

  // Limite de sesiones activas por usuario: si ya esta en el limite, se
  // cierra(n) la(s) mas vieja(s) segun ultima actividad para hacerle
  // lugar a la nueva -- rota sola, no bloquea el login.
  const activeCount = db.prepare("SELECT COUNT(*) AS n FROM sessions WHERE user_id = ?").get(userId).n;
  if (activeCount >= MAX_SESSIONS_PER_USER) {
    const toEvict = activeCount - MAX_SESSIONS_PER_USER + 1;
    const oldest = db
      .prepare("SELECT id FROM sessions WHERE user_id = ? ORDER BY last_seen_at ASC LIMIT ?")
      .all(userId, toEvict);
    const del = db.prepare("DELETE FROM sessions WHERE id = ?");
    for (const row of oldest) del.run(row.id);
  }

  const token = crypto.randomBytes(32).toString("hex");
  const ttlMs = remember ? REMEMBER_TTL_MS : SESSION_TTL_MS;
  const expiresAt = new Date(Date.now() + ttlMs).toISOString();

  const info = db
    .prepare(
      `INSERT INTO sessions (user_id, token_hash, user_agent, remember, expires_at)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(userId, hashToken(token), (userAgent || "").slice(0, 300), remember ? 1 : 0, expiresAt);

  return { token, sessionId: info.lastInsertRowid, ttlMs };
}

function findValidSession(token) {
  if (!token) return null;
  const row = db
    .prepare(
      `SELECT s.*, u.id AS u_id, u.username, u.role, u.status
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.expires_at > datetime('now')`
    )
    .get(hashToken(token));
  return row || null;
}

function touchSession(sessionId, lastSeenAt) {
  const ageMs = Date.now() - parseSqliteUTC(lastSeenAt).getTime();
  if (ageMs < TOUCH_THROTTLE_MS) return;
  db.prepare("UPDATE sessions SET last_seen_at = datetime('now') WHERE id = ?").run(sessionId);
}

function listSessions(userId) {
  return db
    .prepare(
      `SELECT id, user_agent, label, remember, created_at, last_seen_at, expires_at
       FROM sessions WHERE user_id = ? AND expires_at > datetime('now')
       ORDER BY last_seen_at DESC`
    )
    .all(userId)
    .map((s) => ({
      ...s,
      autoLabel: labelUserAgent(s.user_agent),
      label: s.label || labelUserAgent(s.user_agent),
      customLabel: s.label || null,
    }));
}

// Nombre personalizado para distinguir sesiones que de otra forma se ven
// identicas (ej. 3 PCs con Windows + Chrome). String vacio o null borra
// el nombre y vuelve a mostrar el detectado automaticamente del user-agent.
function renameSession(userId, sessionId, label) {
  const trimmed = (label || "").trim().slice(0, 60);
  return (
    db.prepare("UPDATE sessions SET label = ? WHERE id = ? AND user_id = ?").run(trimmed || null, sessionId, userId)
      .changes > 0
  );
}

function revokeSession(userId, sessionId) {
  return db.prepare("DELETE FROM sessions WHERE id = ? AND user_id = ?").run(sessionId, userId).changes > 0;
}

function revokeSessionByToken(token) {
  if (!token) return;
  db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(hashToken(token));
}

function revokeOtherSessions(userId, exceptSessionId) {
  return db
    .prepare("DELETE FROM sessions WHERE user_id = ? AND id != ?")
    .run(userId, exceptSessionId).changes;
}

function revokeAllSessionsForUser(userId) {
  return db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId).changes;
}

module.exports = {
  createSession,
  findValidSession,
  touchSession,
  listSessions,
  renameSession,
  revokeSession,
  revokeSessionByToken,
  revokeOtherSessions,
  revokeAllSessionsForUser,
};
