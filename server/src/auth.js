const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const COOKIE_NAME = "loot_ledger_token";
const REMEMBER_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 días
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 1 día

function signToken(user, ttlMs) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: Math.floor(ttlMs / 1000) }
  );
}

function setAuthCookie(res, user, remember) {
  const ttlMs = remember ? REMEMBER_TTL_MS : SESSION_TTL_MS;
  const token = signToken(user, ttlMs);
  const cookieOpts = {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE !== "false",
  };
  // Sin "recordarme" se emite una cookie de sesión (sin maxAge): el navegador
  // la descarta al cerrarse, aunque el JWT igual expira solo a las 24hs.
  if (remember) cookieOpts.maxAge = ttlMs;
  res.cookie(COOKIE_NAME, token, cookieOpts);
}

function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME);
}

function requireAuth(req, res, next) {
  const token = req.cookies ? req.cookies[COOKIE_NAME] : null;
  if (!token) return res.status(401).json({ error: "No autenticado." });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Sesión inválida o expirada." });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ error: "Requiere permisos de administrador." });
  }
  next();
}

module.exports = {
  COOKIE_NAME,
  signToken,
  setAuthCookie,
  clearAuthCookie,
  requireAuth,
  requireAdmin,
};
