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
    kind: row.kind || "expense",
    title: row.title,
    categoryId: row.category_id,
    treasuryCategoryId: row.treasury_category_id,
    entityId: row.entity_id,
    currency: row.currency,
    amount: row.amount_cents / 100,
    paidBy: row.paid_by,
    isTreasury: !!row.paid_by_treasury,
    participantIds: JSON.parse(row.participant_ids || "[]"),
    dayOfMonth: row.day_of_month,
    active: !!row.active,
    lastRunMonth: row.last_run_month,
    installmentCurrent: row.installment_current,
    installmentTotal: row.installment_total,
  };
}

function listRecurringRules(projectId) {
  return db
    .prepare(
      `SELECT r.*, c.name AS category_name, ent.name AS entity_name, u.username AS paid_by_username,
              tc.name AS treasury_category_name
       FROM recurring_expenses r
       LEFT JOIN categories c ON c.id = r.category_id
       LEFT JOIN entities ent ON ent.id = r.entity_id
       LEFT JOIN treasury_categories tc ON tc.id = r.treasury_category_id
       JOIN users u ON u.id = r.paid_by
       WHERE r.project_id = ? ORDER BY r.day_of_month ASC, r.id ASC`
    )
    .all(projectId)
    .map((row) => ({
      ...mapRule(row),
      categoryName: row.category_name,
      entityName: row.entity_name,
      paidByUsername: row.paid_by_username,
      treasuryCategoryName: row.treasury_category_name,
    }));
}

function createRecurringRule({
  projectId, kind, title, categoryId, entityId, treasuryCategoryId, currency, amountCents,
  paidBy, isTreasury, participantIds, dayOfMonth, createdBy, installmentCurrent, installmentTotal,
}) {
  const isContribution = kind === "contribution";
  const info = db
    .prepare(
      `INSERT INTO recurring_expenses
        (project_id, kind, title, category_id, entity_id, treasury_category_id, currency, amount_cents, paid_by, paid_by_treasury, participant_ids, day_of_month, created_by, installment_current, installment_total)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      projectId,
      isContribution ? "contribution" : "expense",
      title,
      isContribution ? null : categoryId || null,
      isContribution ? null : entityId || null,
      isContribution ? treasuryCategoryId || null : null,
      currency,
      amountCents,
      paidBy,
      isContribution ? 0 : isTreasury ? 1 : 0,
      JSON.stringify(isContribution ? [] : participantIds || []),
      dayOfMonth,
      createdBy,
      isContribution ? null : installmentCurrent || null,
      isContribution ? null : installmentTotal || null
    );
  return info.lastInsertRowid;
}

function updateRecurringRule(id, fields) {
  const rule = db.prepare("SELECT * FROM recurring_expenses WHERE id = ?").get(id);
  if (!rule) return null;

  const nextKind = fields.kind !== undefined ? fields.kind : rule.kind || "expense";
  const isContribution = nextKind === "contribution";

  const next = {
    kind: nextKind,
    title: fields.title !== undefined ? fields.title : rule.title,
    category_id: isContribution ? null : fields.categoryId !== undefined ? fields.categoryId : rule.category_id,
    entity_id: isContribution ? null : fields.entityId !== undefined ? fields.entityId : rule.entity_id,
    treasury_category_id: isContribution
      ? fields.treasuryCategoryId !== undefined
        ? fields.treasuryCategoryId
        : rule.treasury_category_id
      : null,
    currency: fields.currency !== undefined ? fields.currency : rule.currency,
    amount_cents: fields.amountCents !== undefined ? fields.amountCents : rule.amount_cents,
    paid_by: fields.paidBy !== undefined ? fields.paidBy : rule.paid_by,
    paid_by_treasury: isContribution
      ? 0
      : fields.isTreasury !== undefined
      ? fields.isTreasury
        ? 1
        : 0
      : rule.paid_by_treasury,
    participant_ids: isContribution
      ? "[]"
      : fields.participantIds !== undefined
      ? JSON.stringify(fields.participantIds)
      : rule.participant_ids,
    day_of_month: fields.dayOfMonth !== undefined ? fields.dayOfMonth : rule.day_of_month,
    active: fields.active !== undefined ? (fields.active ? 1 : 0) : rule.active,
    installment_current: isContribution
      ? null
      : fields.installmentCurrent !== undefined
      ? fields.installmentCurrent
      : rule.installment_current,
    installment_total: isContribution
      ? null
      : fields.installmentTotal !== undefined
      ? fields.installmentTotal
      : rule.installment_total,
  };

  db.prepare(
    `UPDATE recurring_expenses SET
      kind = ?, title = ?, category_id = ?, entity_id = ?, treasury_category_id = ?, currency = ?, amount_cents = ?,
      paid_by = ?, paid_by_treasury = ?, participant_ids = ?, day_of_month = ?, active = ?,
      installment_current = ?, installment_total = ?
     WHERE id = ?`
  ).run(
    next.kind, next.title, next.category_id, next.entity_id, next.treasury_category_id, next.currency,
    next.amount_cents, next.paid_by, next.paid_by_treasury, next.participant_ids, next.day_of_month, next.active,
    next.installment_current, next.installment_total, id
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

    const runDate = targetDateForMonth(year, month, rule.day_of_month);

    if (rule.kind === "contribution") {
      const run = db.transaction(() => {
        db.prepare(
          `INSERT INTO treasury_contributions
            (project_id, category_id, concept, currency, amount_cents, contributed_by, contribution_date, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          rule.project_id, rule.treasury_category_id, rule.title, rule.currency,
          rule.amount_cents, rule.paid_by, runDate, rule.created_by
        );
        db.prepare("UPDATE recurring_expenses SET last_run_month = ? WHERE id = ?").run(currentMonthKey, rule.id);
      });
      run();
      generated += 1;
      continue;
    }

    const participantIds = JSON.parse(rule.participant_ids || "[]");
    const splits = rule.paid_by_treasury ? [] : splitCents(rule.amount_cents, participantIds);
    const isLastInstallment = rule.installment_total && rule.installment_current >= rule.installment_total;

    const run = db.transaction(() => {
      const info = db
        .prepare(
          `INSERT INTO expenses (project_id, category_id, entity_id, title, currency, amount_cents, paid_by, expense_date, created_by, paid_by_treasury, installment_current, installment_total)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          rule.project_id, rule.category_id, rule.entity_id, rule.title, rule.currency,
          rule.amount_cents, rule.paid_by, runDate, rule.created_by, rule.paid_by_treasury,
          rule.installment_total ? rule.installment_current : null,
          rule.installment_total ? rule.installment_total : null
        );
      const expenseId = info.lastInsertRowid;
      const insertSplit = db.prepare(
        "INSERT INTO expense_splits (expense_id, user_id, share_cents) VALUES (?, ?, ?)"
      );
      for (const s of splits) insertSplit.run(expenseId, s.userId, s.shareCents);

      // Después de generar la última cuota, la regla se borra sola de
      // Respawn (ya cumplió su propósito) -- si no, sigue como cualquier
      // regla y solo avanza el contador de cuota.
      if (isLastInstallment) {
        db.prepare("DELETE FROM recurring_expenses WHERE id = ?").run(rule.id);
      } else {
        db.prepare(
          "UPDATE recurring_expenses SET last_run_month = ?, installment_current = ? WHERE id = ?"
        ).run(currentMonthKey, rule.installment_total ? rule.installment_current + 1 : null, rule.id);
      }
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
