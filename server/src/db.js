const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");

const DB_PATH = process.env.DB_PATH
  ? path.resolve(process.cwd(), process.env.DB_PATH)
  : path.resolve(__dirname, "..", "data", "loot-ledger.db");

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

function tableExists(name) {
  return !!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name);
}

// Migra instalaciones existentes: users.status pasa a admitir 'pending'/'rejected'
// (antes solo 'active'/'removed'), preservando todas las filas y sus ids.
function migrateUsersStatusEnum() {
  if (!tableExists("users")) return;
  const row = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'").get();
  if (row.sql.includes("'pending'")) return;

  // PRAGMA foreign_keys es un no-op dentro de una transaccion, hay que
  // desactivarlo antes de abrir el BEGIN/COMMIT que envuelve db.transaction().
  //
  // Importante: NO renombramos la tabla "users" original. Un ALTER TABLE RENAME
  // hace que SQLite reescriba automaticamente las referencias FK de otras tablas
  // (projects.owner_id, project_members.user_id, etc.) para que sigan al nuevo
  // nombre, dejandolas apuntando a una tabla temporal que despues se borra. En
  // cambio creamos la tabla nueva con otro nombre, copiamos los datos, borramos
  // la vieja y recien ahi renombramos la nueva a "users": como las otras tablas
  // nunca dejaron de decir "REFERENCES users(id)", vuelven a resolver bien solas.
  db.pragma("foreign_keys = OFF");
  const migrate = db.transaction(() => {
    db.exec(`
      CREATE TABLE users_new_v2 (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin','user')),
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('active','pending','rejected','removed')),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    db.exec(`
      INSERT INTO users_new_v2 (id, username, password_hash, role, status, created_at, updated_at)
      SELECT id, username, password_hash, role, status, created_at, updated_at FROM users
    `);
    db.exec("DROP TABLE users");
    db.exec("ALTER TABLE users_new_v2 RENAME TO users");
    db.exec(
      "UPDATE sqlite_sequence SET seq = (SELECT COALESCE(MAX(id),0) FROM users) WHERE name = 'users'"
    );
    const violations = db.pragma("foreign_key_check");
    if (violations.length) {
      throw new Error("Migración de users dejó referencias FK rotas: " + JSON.stringify(violations));
    }
  });
  migrate();
  db.pragma("foreign_keys = ON");
}

// Migra instalaciones existentes: agrega project_members.role (owner/admin/member),
// reconstruyendo el rol de 'owner' a partir de projects.owner_id.
function migrateProjectMembersRole() {
  if (!tableExists("project_members")) return;
  const cols = db.prepare("PRAGMA table_info(project_members)").all();
  if (cols.some((c) => c.name === "role")) return;

  const migrate = db.transaction(() => {
    db.exec("ALTER TABLE project_members ADD COLUMN role TEXT NOT NULL DEFAULT 'member'");
    db.exec(`
      UPDATE project_members SET role = 'owner'
      WHERE user_id = (SELECT owner_id FROM projects WHERE projects.id = project_members.project_id)
    `);
  });
  migrate();
}

migrateUsersStatusEnum();
migrateProjectMembersRole();

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin','user')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('active','pending','rejected','removed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  owner_id INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS project_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'member' CHECK (status IN ('member','invited','removed')),
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner','admin','member')),
  added_by INTEGER REFERENCES users(id),
  joined_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(project_id, user_id)
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(project_id, name)
);

CREATE TABLE IF NOT EXISTS entities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(project_id, name)
);

CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES categories(id),
  entity_id INTEGER REFERENCES entities(id),
  title TEXT NOT NULL,
  currency TEXT NOT NULL CHECK (currency IN ('EUR','USD','ARS')),
  amount_cents INTEGER NOT NULL,
  paid_by INTEGER NOT NULL REFERENCES users(id),
  expense_date TEXT NOT NULL,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS expense_splits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  expense_id INTEGER NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  share_cents INTEGER NOT NULL,
  UNIQUE(expense_id, user_id)
);

CREATE TABLE IF NOT EXISTS password_reset_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','resolved')),
  requested_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT,
  resolved_by INTEGER REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  user_agent TEXT,
  label TEXT,
  remember INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_expenses_project ON expenses(project_id);
CREATE INDEX IF NOT EXISTS idx_expense_splits_expense ON expense_splits(expense_id);
CREATE INDEX IF NOT EXISTS idx_project_members_project ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_requests_user ON password_reset_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
`);

// Migra instalaciones existentes: la tabla "expenses" ya existía sin la
// columna "entity_id" (CREATE TABLE IF NOT EXISTS de arriba no la agrega
// sola en una base que ya tiene la tabla). ALTER TABLE ADD COLUMN con
// REFERENCES sí está permitido en SQLite mientras no tenga un DEFAULT
// no constante, así que alcanza con esto (a diferencia del caso de
// "users", acá no hace falta reconstruir la tabla entera).
function migrateAddEntityToExpenses() {
  if (!tableExists("expenses")) return;
  const row = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='expenses'").get();
  if (row.sql.includes("entity_id")) return;
  db.exec("ALTER TABLE expenses ADD COLUMN entity_id INTEGER REFERENCES entities(id)");
}

migrateAddEntityToExpenses();

// Igual que arriba, pero para "sessions": las bases ya desplegadas no
// tienen la columna "label" (nombre personalizado que el usuario le pone
// a una sesion/dispositivo). Sin DEFAULT no constante, ALTER TABLE ADD
// COLUMN alcanza.
function migrateAddLabelToSessions() {
  if (!tableExists("sessions")) return;
  const row = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='sessions'").get();
  if (row.sql.includes("label")) return;
  db.exec("ALTER TABLE sessions ADD COLUMN label TEXT");
}

migrateAddLabelToSessions();

function seedAdmin() {
  const existing = db.prepare("SELECT id FROM users WHERE username = ?").get("administrator");
  if (existing) return;
  const defaultPassword = process.env.ADMIN_DEFAULT_PASSWORD || "11223344";
  const hash = bcrypt.hashSync(defaultPassword, 10);
  db.prepare(
    "INSERT INTO users (username, password_hash, role, status) VALUES (?, ?, 'admin', 'active')"
  ).run("administrator", hash);
}

seedAdmin();

module.exports = db;
