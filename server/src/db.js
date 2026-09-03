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

// Igual que migrateUsersStatusEnum, pero para sumar 'invited' (placeholder de
// una invitación sin reclamar todavía) al CHECK de status, y de paso las
// columnas invite_code/invite_code_claimed_at -- se hace todo en el mismo
// rebuild para no depender del orden entre dos migraciones separadas.
function migrateUsersInviteSupport() {
  if (!tableExists("users")) return;
  const row = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'").get();
  if (row.sql.includes("'invited'")) return;

  db.pragma("foreign_keys = OFF");
  const migrate = db.transaction(() => {
    db.exec(`
      CREATE TABLE users_new_v3 (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin','user')),
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('active','pending','rejected','removed','invited')),
        invite_code TEXT,
        invite_code_claimed_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    db.exec(`
      INSERT INTO users_new_v3 (id, username, password_hash, role, status, created_at, updated_at)
      SELECT id, username, password_hash, role, status, created_at, updated_at FROM users
    `);
    db.exec("DROP TABLE users");
    db.exec("ALTER TABLE users_new_v3 RENAME TO users");
    db.exec(
      "UPDATE sqlite_sequence SET seq = (SELECT COALESCE(MAX(id),0) FROM users) WHERE name = 'users'"
    );
    const violations = db.pragma("foreign_key_check");
    if (violations.length) {
      throw new Error("Migración de users (invites) dejó referencias FK rotas: " + JSON.stringify(violations));
    }
  });
  migrate();
  db.pragma("foreign_keys = ON");
}

migrateUsersInviteSupport();

// Reconstruye "expenses" para que category_id sea opcional (igual que
// entity_id) y suma "is_reimbursement": los saldos de deuda (antes
// modelados como un gasto en una categoría especial "Reembolso") pasan a
// ser un flag propio, en vez de depender de una categoría mágica. Las filas
// que ya usaban esa categoría quedan con category_id NULL e
// is_reimbursement=1, preservando el resto de sus datos (fecha, montos,
// splits) tal cual.
function migrateExpensesReimbursement() {
  if (!tableExists("expenses")) return;
  const row = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='expenses'").get();
  if (row.sql.includes("is_reimbursement")) return;

  db.pragma("foreign_keys = OFF");
  const migrate = db.transaction(() => {
    db.exec(`
      CREATE TABLE expenses_new_v2 (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        category_id INTEGER REFERENCES categories(id),
        entity_id INTEGER REFERENCES entities(id),
        title TEXT NOT NULL,
        currency TEXT NOT NULL CHECK (currency IN ('EUR','USD','ARS')),
        amount_cents INTEGER NOT NULL,
        paid_by INTEGER NOT NULL REFERENCES users(id),
        expense_date TEXT NOT NULL,
        created_by INTEGER NOT NULL REFERENCES users(id),
        is_reimbursement INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    db.exec(`
      INSERT INTO expenses_new_v2
        (id, project_id, category_id, entity_id, title, currency, amount_cents, paid_by, expense_date, created_by, is_reimbursement, created_at)
      SELECT
        e.id, e.project_id,
        CASE WHEN c.name = 'Reembolso' THEN NULL ELSE e.category_id END,
        e.entity_id, e.title, e.currency, e.amount_cents, e.paid_by, e.expense_date, e.created_by,
        CASE WHEN c.name = 'Reembolso' THEN 1 ELSE 0 END,
        e.created_at
      FROM expenses e LEFT JOIN categories c ON c.id = e.category_id
    `);
    db.exec("DROP TABLE expenses");
    db.exec("ALTER TABLE expenses_new_v2 RENAME TO expenses");
    db.exec(
      "UPDATE sqlite_sequence SET seq = (SELECT COALESCE(MAX(id),0) FROM expenses) WHERE name = 'expenses'"
    );
    const violations = db.pragma("foreign_key_check");
    if (violations.length) {
      throw new Error("Migración de expenses (reembolso) dejó referencias FK rotas: " + JSON.stringify(violations));
    }
  });
  migrate();
  db.pragma("foreign_keys = ON");
}

migrateExpensesReimbursement();

// Ahora que el reembolso ya no depende de una categoría, la categoría
// "Reembolso" que se auto-creaba por proyecto queda huérfana: se borra, y
// con ella el concepto de "categoría protegida" (is_default) deja de tener
// ningún uso -- se saca la columna entera.
function migrateCategoriesDropIsDefault() {
  if (!tableExists("categories")) return;
  const cols = db.prepare("PRAGMA table_info(categories)").all();
  if (!cols.some((c) => c.name === "is_default")) return;

  db.exec("DELETE FROM categories WHERE is_default = 1");
  db.exec("ALTER TABLE categories DROP COLUMN is_default");
}

migrateCategoriesDropIsDefault();

// ALTER TABLE ADD COLUMN sin DEFAULT no constante alcanza para "emoji": es
// puramente decorativo, nunca hace falta reconstruir la tabla por esto.
function migrateProjectsEmoji() {
  if (!tableExists("projects")) return;
  const row = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='projects'").get();
  if (row.sql.includes("emoji")) return;
  db.exec("ALTER TABLE projects ADD COLUMN emoji TEXT");
}

migrateProjectsEmoji();

// Reconstruye "projects" para sumar "type" ('shared'/'individual'), con su
// CHECK -- a diferencia de "emoji", ALTER TABLE ADD COLUMN no alcanza acá
// porque SQLite no permite agregar una columna con CHECK así nomás. Mismo
// cuidado de siempre: no renombrar la tabla original directamente, para no
// romper las referencias FK de project_members/categories/entities/expenses.
function migrateProjectsType() {
  if (!tableExists("projects")) return;
  const row = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='projects'").get();
  if (row.sql.includes("type TEXT")) return;

  db.pragma("foreign_keys = OFF");
  const migrate = db.transaction(() => {
    db.exec(`
      CREATE TABLE projects_new_v2 (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        emoji TEXT,
        type TEXT NOT NULL DEFAULT 'shared' CHECK (type IN ('shared','individual')),
        owner_id INTEGER NOT NULL REFERENCES users(id),
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    db.exec(`
      INSERT INTO projects_new_v2 (id, name, emoji, owner_id, created_at)
      SELECT id, name, emoji, owner_id, created_at FROM projects
    `);
    db.exec("DROP TABLE projects");
    db.exec("ALTER TABLE projects_new_v2 RENAME TO projects");
    db.exec(
      "UPDATE sqlite_sequence SET seq = (SELECT COALESCE(MAX(id),0) FROM projects) WHERE name = 'projects'"
    );
    const violations = db.pragma("foreign_key_check");
    if (violations.length) {
      throw new Error("Migración de projects (type) dejó referencias FK rotas: " + JSON.stringify(violations));
    }
  });
  migrate();
  db.pragma("foreign_keys = ON");
}

migrateProjectsType();

// ALTER TABLE ADD COLUMN sin DEFAULT no constante alcanza: "paid_by_treasury"
// marca un gasto como pagado desde el fondo común del proyecto en vez de por
// un miembro -- en ese caso no genera expense_splits y queda afuera del
// cálculo de balances entre personas (ver services/balances.js).
function migrateExpensesTreasury() {
  if (!tableExists("expenses")) return;
  const row = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='expenses'").get();
  if (row.sql.includes("paid_by_treasury")) return;
  db.exec("ALTER TABLE expenses ADD COLUMN paid_by_treasury INTEGER NOT NULL DEFAULT 0");
}

migrateExpensesTreasury();

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin','user')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('active','pending','rejected','removed','invited')),
  invite_code TEXT,
  invite_code_claimed_at TEXT,
  default_currency TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  emoji TEXT,
  type TEXT NOT NULL DEFAULT 'shared' CHECK (type IN ('shared','individual')),
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
  category_id INTEGER REFERENCES categories(id),
  entity_id INTEGER REFERENCES entities(id),
  title TEXT NOT NULL,
  currency TEXT NOT NULL CHECK (currency IN ('EUR','USD','ARS')),
  amount_cents INTEGER NOT NULL,
  paid_by INTEGER NOT NULL REFERENCES users(id),
  expense_date TEXT NOT NULL,
  created_by INTEGER NOT NULL REFERENCES users(id),
  is_reimbursement INTEGER NOT NULL DEFAULT 0,
  paid_by_treasury INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Reglas de gastos recurrentes ("Respawn"): se generan solas como un gasto
-- normal de "expenses" cada mes, en day_of_month (o el último día del mes
-- si ese día no existe, ej. 31 en febrero). last_run_month evita generar
-- dos veces en el mismo mes. participant_ids va como JSON (array de ids) en
-- vez de una tabla de join aparte -- nunca se consulta por usuario
-- individual, solo se lee entera al generar el gasto.
CREATE TABLE IF NOT EXISTS recurring_expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category_id INTEGER REFERENCES categories(id),
  entity_id INTEGER REFERENCES entities(id),
  currency TEXT NOT NULL CHECK (currency IN ('EUR','USD','ARS')),
  amount_cents INTEGER NOT NULL,
  paid_by INTEGER NOT NULL REFERENCES users(id),
  paid_by_treasury INTEGER NOT NULL DEFAULT 0,
  participant_ids TEXT NOT NULL DEFAULT '[]',
  day_of_month INTEGER NOT NULL DEFAULT 1 CHECK (day_of_month BETWEEN 1 AND 31),
  active INTEGER NOT NULL DEFAULT 1,
  last_run_month TEXT,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS treasury_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(project_id, name)
);

-- Aportes al fondo común (Treasury) de un proyecto. Los gastos pagados
-- *desde* Treasury viven en "expenses" (con paid_by_treasury=1) -- siguen
-- siendo gastos como cualquier otro, solo que no se reparten entre
-- miembros. Los aportes en cambio no son un gasto de nadie, así que tienen
-- su propia tabla.
CREATE TABLE IF NOT EXISTS treasury_contributions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  category_id INTEGER REFERENCES treasury_categories(id),
  concept TEXT NOT NULL,
  currency TEXT NOT NULL CHECK (currency IN ('EUR','USD','ARS')),
  amount_cents INTEGER NOT NULL,
  contributed_by INTEGER NOT NULL REFERENCES users(id),
  contribution_date TEXT NOT NULL,
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
CREATE INDEX IF NOT EXISTS idx_treasury_contributions_project ON treasury_contributions(project_id);
CREATE INDEX IF NOT EXISTS idx_recurring_expenses_project ON recurring_expenses(project_id);
CREATE INDEX IF NOT EXISTS idx_recurring_expenses_active ON recurring_expenses(active);
CREATE INDEX IF NOT EXISTS idx_expense_splits_expense ON expense_splits(expense_id);
CREATE INDEX IF NOT EXISTS idx_project_members_project ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_requests_user ON password_reset_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_invite_code ON users(invite_code);
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

// Moneda que el usuario eligió como default, para no tener que cambiarla
// cada vez en los formularios (gastos, Treasury, Respawn). NULL = todavía
// no eligió ninguna, y la app cae al default histórico (EUR).
function migrateAddDefaultCurrencyToUsers() {
  if (!tableExists("users")) return;
  const row = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'").get();
  if (row.sql.includes("default_currency")) return;
  db.exec("ALTER TABLE users ADD COLUMN default_currency TEXT");
}

migrateAddDefaultCurrencyToUsers();

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
