const { createSession, findValidSession, touchSession } = require("./services/sessions");

const COOKIE_NAME = "loot_ledger_token";

function setAuthCookie(res, user, remember, userAgent) {
  const { token, ttlMs } = createSession(user.id, { remember, userAgent });
  const cookieOpts = {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE !== "false",
  };
  // Sin "recordarme" se emite una cookie de sesión (sin maxAge): el navegador
  // la descarta al cerrarse, aunque la sesión en el servidor igual expira
  // sola a las 24hs.
  if (remember) cookieOpts.maxAge = ttlMs;
  res.cookie(COOKIE_NAME, token, cookieOpts);
}

function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME);
}

function requireAuth(req, res, next) {
  const token = req.cookies ? req.cookies[COOKIE_NAME] : null;
  if (!token) return res.status(401).json({ error: "No autenticado." });

  const session = findValidSession(token);
  if (!session || session.status !== "active") {
    return res.status(401).json({ error: "Sesión inválida o expirada." });
  }

  touchSession(session.id, session.last_seen_at);
  req.user = { id: session.u_id, username: session.username, role: session.role };
  req.sessionToken = token;
  req.sessionId = session.id;
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ error: "Requiere permisos de administrador." });
  }
  next();
}

module.exports = {
  COOKIE_NAME,
  setAuthCookie,
  clearAuthCookie,
  requireAuth,
  requireAdmin,
};
