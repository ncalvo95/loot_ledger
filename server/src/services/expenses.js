const db = require("../db");

function listExpenses(projectId, { month, year } = {}) {
  let sql = `SELECT e.*, u.username AS paid_by_username, c.name AS category_name, ent.name AS entity_name
             FROM expenses e
             JOIN users u ON u.id = e.paid_by
             LEFT JOIN categories c ON c.id = e.category_id
             LEFT JOIN entities ent ON ent.id = e.entity_id
             WHERE e.project_id = ?`;
  const params = [projectId];
  if (year) {
    sql += " AND strftime('%Y', e.expense_date) = ?";
    params.push(String(year).padStart(4, "0"));
  }
  if (month) {
    sql += " AND strftime('%m', e.expense_date) = ?";
    params.push(String(month).padStart(2, "0"));
  }
  sql += " ORDER BY e.expense_date DESC, e.id DESC";
  const rows = db.prepare(sql).all(...params);

  const expenseIds = rows.map((r) => r.id);
  let splitsByExpense = {};
  if (expenseIds.length) {
    const placeholders = expenseIds.map(() => "?").join(",");
    const splits = db
      .prepare(
        `SELECT es.expense_id, es.user_id, es.share_cents, u.username
         FROM expense_splits es JOIN users u ON u.id = es.user_id
         WHERE es.expense_id IN (${placeholders})`
      )
      .all(...expenseIds);
    splitsByExpense = splits.reduce((acc, s) => {
      (acc[s.expense_id] = acc[s.expense_id] || []).push({
        userId: s.user_id,
        username: s.username,
        amount: s.share_cents / 100,
      });
      return acc;
    }, {});
  }

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    currency: row.currency,
    amount: row.amount_cents / 100,
    paidBy: row.paid_by,
    paidByUsername: row.paid_by_username,
    categoryId: row.category_id,
    categoryName: row.category_name,
    entityId: row.entity_id,
    entityName: row.entity_name,
    date: row.expense_date,
    createdBy: row.created_by,
    createdAt: row.created_at,
    isReimbursement: !!row.is_reimbursement,
    isTreasury: !!row.paid_by_treasury,
    participants: splitsByExpense[row.id] || [],
  }));
}

// Crea un movimiento de reembolso que cancela una deuda puntual entre dos
// miembros de un proyecto: el que paga cubre el total y se lo asigna entero
// al que lo recibe, saldando esa deuda en la triangulación. Se marca con
// is_reimbursement en vez de con una categoría especial, para que nunca
// aparezca como opción seleccionable en el desplegable de categorías.
function createReimbursementExpense({ projectId, payerId, recipientId, amountCents, currency, createdBy }) {
  const insert = db.transaction(() => {
    const info = db
      .prepare(
        `INSERT INTO expenses (project_id, title, currency, amount_cents, paid_by, expense_date, created_by, is_reimbursement)
         VALUES (?, 'Reembolso', ?, ?, ?, date('now'), ?, 1)`
      )
      .run(projectId, currency, amountCents, payerId, createdBy);
    const expenseId = info.lastInsertRowid;
    db.prepare("INSERT INTO expense_splits (expense_id, user_id, share_cents) VALUES (?, ?, ?)").run(
      expenseId,
      recipientId,
      amountCents
    );
    return expenseId;
  });

  return insert();
}

module.exports = { listExpenses, createReimbursementExpense };
