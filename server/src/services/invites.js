const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const db = require("../db");

// Placeholder de 10 caracteres ("inv_" + 6 hex) para que entre dentro del
// mismo USERNAME_REGEX (4-10 caracteres) que cualquier usuario real -- se
// pisa por completo apenas alguien reclama la invitación.
function generatePlaceholderUsername() {
  for (let i = 0; i < 20; i++) {
    const candidate = `inv_${crypto.randomBytes(3).toString("hex")}`;
    const clash = db.prepare("SELECT 1 FROM users WHERE username = ?").get(candidate);
    if (!clash) return candidate;
  }
  throw new Error("No se pudo generar un nombre de usuario placeholder único.");
}

// 20 caracteres hex (80 bits) -- de sobra para no ser adivinable, y solo
// caracteres sin ambigüedad para copiar/pegar o tipear a mano.
function generateInviteCode() {
  for (let i = 0; i < 20; i++) {
    const candidate = crypto.randomBytes(10).toString("hex");
    const clash = db.prepare("SELECT 1 FROM users WHERE invite_code = ?").get(candidate);
    if (!clash) return candidate;
  }
  throw new Error("No se pudo generar un código de invitación único.");
}

// Caso A: crea una cuenta placeholder con un código de invitación de un
// solo uso. La persona invitada la "reclama" (elige su propio usuario y
// contraseña) y ahí pasa a 'pending', igual que un auto-registro común.
function createInvitePlaceholder() {
  const username = generatePlaceholderUsername();
  const code = generateInviteCode();
  const randomPassword = crypto.randomBytes(24).toString("hex");
  const hash = bcrypt.hashSync(randomPassword, 10);
  const info = db
    .prepare("INSERT INTO users (username, password_hash, role, status, invite_code) VALUES (?, ?, 'user', 'invited', ?)")
    .run(username, hash, code);
  return { id: info.lastInsertRowid, username, code };
}

// Caso B: le asigna (o reasigna) un código de invitación a una cuenta que
// ya existe -- no toca username/password/sesiones, solo agrega el código.
// También sirve para regenerar el código de un placeholder sin reclamar
// (por si el admin lo perdió antes de compartirlo).
function assignInviteCodeToUser(userId) {
  const code = generateInviteCode();
  db.prepare("UPDATE users SET invite_code = ?, updated_at = datetime('now') WHERE id = ?").run(code, userId);
  return code;
}

// Valida un código sin consumirlo. 'claim' = placeholder sin reclamar
// (Caso A, falta el formulario de usuario/contraseña). 'gate' = cuenta ya
// activa (Caso B, solo confirma que el código es válido y manda a login).
// Cualquier otro estado (pending/rejected/removed) se trata como código
// inválido, para no filtrar en qué estado quedó la cuenta.
function validateInviteCode(code) {
  if (!code) return null;
  const user = db.prepare("SELECT status FROM users WHERE invite_code = ?").get(code);
  if (!user) return null;
  if (user.status === "invited") return { mode: "claim" };
  if (user.status === "active") return { mode: "gate" };
  return null;
}

// Reclama un placeholder: pisa usuario/contraseña, pasa a 'pending' (mismo
// flujo de aprobación del admin que ya existe) y consume el código.
function claimInvite(code, username, password) {
  const user = db.prepare("SELECT * FROM users WHERE invite_code = ? AND status = 'invited'").get(code);
  if (!user) {
    const err = new Error("Código de invitación inválido o ya usado.");
    err.code = "INVALID_INVITE";
    throw err;
  }
  const clash = db.prepare("SELECT id FROM users WHERE username = ? AND id != ?").get(username, user.id);
  if (clash) {
    const err = new Error("Ese nombre de usuario ya está en uso.");
    err.code = "USERNAME_TAKEN";
    throw err;
  }
  const hash = bcrypt.hashSync(password, 10);
  db.prepare(
    `UPDATE users
     SET username = ?, password_hash = ?, status = 'pending',
         invite_code = NULL, invite_code_claimed_at = datetime('now'), updated_at = datetime('now')
     WHERE id = ?`
  ).run(username, hash, user.id);
}

module.exports = {
  generatePlaceholderUsername,
  generateInviteCode,
  createInvitePlaceholder,
  assignInviteCodeToUser,
  validateInviteCode,
  claimInvite,
};
