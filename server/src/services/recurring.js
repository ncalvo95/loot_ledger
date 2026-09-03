const db = require("../db");

function splitCents(totalCents, participantIds) {
  const sorted = [...participantIds].sort((a, b) => a - b);
  const n = sorted.length;
  const base = Math.floor(totalCents / n);
  const remainder = totalCents - base * n;
  return sorted.map((userId, idx) => ({
    userId,
    shareCents: base + (idx < remainder ? 1 : 0),
  }));
}

function mapRule(row) {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    categoryId: row.category_id,
    entityId: row.entity_id,
    currency: row.currency,
    amount: row.amount_cents / 100,
    paidBy: row.paid_by,
    isTreasury: !!row.paid_by_treasury,
    participantIds: JSON.parse(row.participant_ids || "[]"),
    dayOfMonth: row.day_of_month,
    active: !!row.active,
    lastRunMonth: row.last_run_month,
  };
}

function listRecurringRules(projectId) {
  return db
    .prepare(
      `SELECT r.*, c.name AS category_name, ent.name AS entity_name, u.username AS paid_by_username
       FROM recurring_expenses r
       LEFT JOIN categories c ON c.id = r.category_id
       LEFT JOIN entities ent ON ent.id = r.entity_id
       JOIN users u ON u.id = r.paid_by
       WHERE r.project_id = ? ORDER BY r.day_of_month ASC, r.id ASC`
    )
    .all(projectId)
    .map((row) => ({
      ...mapRule(row),
      categoryName: row.category_name,
      entityName: row.entity_name,
      paidByUsername: row.paid_by_username,
    }));
}

function createRecurringRule({
  projectId, title, categoryId, entityId, currency, amountCents,
  paidBy, isTreasury, participantIds, dayOfMonth, createdBy,
}) {
  const info = db
    .prepare(
      `INSERT INTO recurring_expenses
        (project_id, title, category_id, entity_id, currency, amount_cents, paid_by, paid_by_treasury, participant_ids, day_of_month, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      projectId, title, categoryId || null, entityId || null, currency, amountCents,
      paidBy, isTreasury ? 1 : 0, JSON.stringify(participantIds || []), dayOfMonth, createdBy
    );
  return info.lastInsertRowid;
}

function updateRecurringRule(id, fields) {
  const rule = db.prepare("SELECT * FROM recurring_expenses WHERE id = ?").get(id);
  if (!rule) return null;

  const next = {
    title: fields.title !== undefined ? fields.title : rule.title,
    category_id: fields.categoryId !== undefined ? fields.categoryId : rule.category_id,
    entity_id: fields.entityId !== undefined ? fields.entityId : rule.entity_id,
    currency: fields.currency !== undefined ? fields.currency : rule.currency,
    amount_cents: fields.amountCents !== undefined ? fields.amountCents : rule.amount_cents,
    paid_by: fields.paidBy !== undefined ? fields.paidBy : rule.paid_by,
    paid_by_treasury: fields.isTreasury !== undefined ? (fields.isTreasury ? 1 : 0) : rule.paid_by_treasury,
    participant_ids:
      fields.participantIds !== undefined ? JSON.stringify(fields.participantIds) : rule.participant_ids,
    day_of_month: fields.dayOfMonth !== undefined ? fields.dayOfMonth : rule.day_of_month,
    active: fields.active !== undefined ? (fields.active ? 1 : 0) : rule.active,
  };

  db.prepare(
    `UPDATE recurring_expenses SET
      title = ?, category_id = ?, entity_id = ?, currency = ?, amount_cents = ?,
      paid_by = ?, paid_by_treasury = ?, participant_ids = ?, day_of_month = ?, active = ?
     WHERE id = ?`
  ).run(
    next.title, next.category_id, next.entity_id, next.currency, next.amount_cents,
    next.paid_by, next.paid_by_treasury, next.participant_ids, next.day_of_month, next.active, id
  );
  return db.prepare("SELECT * FROM recurring_expenses WHERE id = ?").get(id);
}

function deleteRecurringRule(id) {
  db.prepare("DELETE FROM recurring_expenses WHERE id = ?").run(id);
}

function lastDayOfMonth(year, month) {
  // month: 1-12. Día 0 del mes siguiente = último día de este mes.
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function targetDateForMonth(year, month, dayOfMonth) {
  const day = Math.min(dayOfMonth, lastDayOfMonth(year, month));
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// Recorre TODAS las reglas activas de TODOS los proyectos y genera el gasto
// del mes actual para las que todavía no lo generaron (last_run_month !=
// mes actual) y ya llegaron a su día -- se llama al bootear el servidor y
// después cada una hora, así que alcanza con mirar "hoy" contra el día de
// la regla, sin necesidad de un cron real.
function runDueRecurringRules() {
  const today = db.prepare("SELECT date('now') AS d").get().d; // 'YYYY-MM-DD', UTC
  const [year, month, day] = today.split("-").map(Number);
  const currentMonthKey = `${year}-${String(month).padStart(2, "0")}`;

  const rules = db.prepare("SELECT * FROM recurring_expenses WHERE active = 1").all();
  let generated = 0;

  for (const rule of rules) {
    if (rule.last_run_month === currentMonthKey) continue;
    const targetDay = Math.min(rule.day_of_month, lastDayOfMonth(year, month));
    if (day < targetDay) continue;

    const expenseDate = targetDateForMonth(year, month, rule.day_of_month);
    const participantIds = JSON.parse(rule.participant_ids || "[]");
    const splits = rule.paid_by_treasury ? [] : splitCents(rule.amount_cents, participantIds);

    const run = db.transaction(() => {
      const info = db
        .prepare(
          `INSERT INTO expenses (project_id, category_id, entity_id, title, currency, amount_cents, paid_by, expense_date, created_by, paid_by_treasury)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          rule.project_id, rule.category_id, rule.entity_id, rule.title, rule.currency,
          rule.amount_cents, rule.paid_by, expenseDate, rule.created_by, rule.paid_by_treasury
        );
      const expenseId = info.lastInsertRowid;
      const insertSplit = db.prepare(
        "INSERT INTO expense_splits (expense_id, user_id, share_cents) VALUES (?, ?, ?)"
      );
      for (const s of splits) insertSplit.run(expenseId, s.userId, s.shareCents);
      db.prepare("UPDATE recurring_expenses SET last_run_month = ? WHERE id = ?").run(currentMonthKey, rule.id);
    });
    run();
    generated += 1;
  }

  return generated;
}

module.exports = {
  listRecurringRules,
  createRecurringRule,
  updateRecurringRule,
  deleteRecurringRule,
  runDueRecurringRules,
};
