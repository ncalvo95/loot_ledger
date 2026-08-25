const db = require("../db");

function listExpenses(projectId, { month, year } = {}) {
  let sql = `SELECT e.*, u.username AS paid_by_username, c.name AS category_name
             FROM expenses e
             JOIN users u ON u.id = e.paid_by
             JOIN categories c ON c.id = e.category_id
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
    date: row.expense_date,
    createdBy: row.created_by,
    createdAt: row.created_at,
    participants: splitsByExpense[row.id] || [],
  }));
}

module.exports = { listExpenses };
