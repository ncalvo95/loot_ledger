const { createSession, findValidSession, touchSession } = require("./services/sessions");
const { MOUNT_PATH } = require("./base-path");

const COOKIE_NAME = "loot_ledger_token";

function setAuthCookie(req, res, user, remember, userAgent) {
  const { token, ttlMs } = createSession(user.id, { remember, userAgent });
  const cookieOpts = {
    httpOnly: true,
    sameSite: "lax",
    // Une cookie a todo lo que cuelga de MOUNT_PATH ("/" en un deploy normal,
    // "/loot-ledger" cuando convive con otro sitio en el mismo dominio) --
    // tiene que coincidir con clearAuthCookie, si no el navegador no la borra.
    path: MOUNT_PATH,
    // Una cookie "Secure" solo la guarda el navegador si la conexión es
    // HTTPS real -- por eso se decide según req.secure (que con "trust
    // proxy" refleja el X-Forwarded-Proto de Caddy) y no según NODE_ENV:
    // fijarla en true siempre rompía el acceso por IP local en HTTP plano.
    secure: req.secure && process.env.COOKIE_SECURE !== "false",
  };
  // Sin "recordarme" se emite una cookie de sesión (sin maxAge): el navegador
  // la descarta al cerrarse, aunque la sesión en el servidor igual expira
  // sola a las 24hs.
  if (remember) cookieOpts.maxAge = ttlMs;
  res.cookie(COOKIE_NAME, token, cookieOpts);
}

function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, { path: MOUNT_PATH });
}

function requireAuth(req, res, next) {
  const token = req.cookies ? req.cookies[COOKIE_NAME] : null;
  if (!token) {
    console.warn(
      `[auth] sin token: header-cookie="${req.headers.cookie || ""}" secure=${req.secure} host=${req.headers.host}`
    );
    return res.status(401).json({ error: "No autenticado." });
  }

  const session = findValidSession(token);
  if (!session || session.status !== "active") {
    console.warn(
      `[auth] sesión rechazada: tokenPrefix=${token.slice(0, 8)} encontrada=${!!session} ` +
        `status=${session ? session.status : "n/a"} expira=${session ? session.expires_at : "n/a"} secure=${req.secure}`
    );
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
