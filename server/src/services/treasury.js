const db = require("../db");

function listTreasuryCategories(projectId) {
  return db.prepare("SELECT * FROM treasury_categories WHERE project_id = ? ORDER BY name ASC").all(projectId);
}

function resolveTreasuryCategory(projectId, { categoryId, categoryName }) {
  if (categoryId) {
    const category = db
      .prepare("SELECT * FROM treasury_categories WHERE id = ? AND project_id = ?")
      .get(categoryId, projectId);
    return category || null;
  }
  if (categoryName && categoryName.trim()) {
    const trimmed = categoryName.trim();
    let category = db
      .prepare("SELECT * FROM treasury_categories WHERE project_id = ? AND name = ?")
      .get(projectId, trimmed);
    if (!category) {
      const info = db
        .prepare("INSERT INTO treasury_categories (project_id, name) VALUES (?, ?)")
        .run(projectId, trimmed);
      category = db.prepare("SELECT * FROM treasury_categories WHERE id = ?").get(info.lastInsertRowid);
    }
    return category;
  }
  return null;
}

// Balance actual del fondo por moneda: aportes menos gastos pagados desde
// Treasury. Puede dar negativo (se gastó más de lo que había) a propósito.
function computeTreasuryBalance(projectId) {
  const contribByCurrency = db
    .prepare(
      `SELECT currency, SUM(amount_cents) AS total FROM treasury_contributions
       WHERE project_id = ? GROUP BY currency`
    )
    .all(projectId);
  const spentByCurrency = db
    .prepare(
      `SELECT currency, SUM(amount_cents) AS total FROM expenses
       WHERE project_id = ? AND paid_by_treasury = 1 GROUP BY currency`
    )
    .all(projectId);

  const totals = new Map();
  for (const row of contribByCurrency) totals.set(row.currency, (totals.get(row.currency) || 0) + row.total);
  for (const row of spentByCurrency) totals.set(row.currency, (totals.get(row.currency) || 0) - row.total);

  return [...totals.entries()]
    .map(([currency, balanceCents]) => ({ currency, balanceCents, balance: balanceCents / 100 }))
    .sort((a, b) => a.currency.localeCompare(b.currency));
}

// Feed unificado de movimientos del fondo (aportes + gastos pagados desde
// Treasury), para mostrar como un solo extracto ordenado por fecha.
function listTreasuryMovements(projectId, { month, year } = {}) {
  let dateFilter = "";
  const params = [projectId];
  if (year) {
    dateFilter += " AND strftime('%Y', DATE_COL) = ?";
    params.push(String(year).padStart(4, "0"));
  }
  if (month) {
    dateFilter += " AND strftime('%m', DATE_COL) = ?";
    params.push(String(month).padStart(2, "0"));
  }

  const contributions = db
    .prepare(
      `SELECT tc.id, tc.concept, tc.currency, tc.amount_cents, tc.contribution_date AS date,
              u.username, cat.name AS category_name
       FROM treasury_contributions tc
       JOIN users u ON u.id = tc.contributed_by
       LEFT JOIN treasury_categories cat ON cat.id = tc.category_id
       WHERE tc.project_id = ?${dateFilter.replace(/DATE_COL/g, "tc.contribution_date")}
       ORDER BY tc.contribution_date DESC, tc.id DESC`
    )
    .all(...params);

  const expenses = db
    .prepare(
      `SELECT e.id, e.title AS concept, e.currency, e.amount_cents, e.expense_date AS date,
              u.username, cat.name AS category_name
       FROM expenses e
       JOIN users u ON u.id = e.paid_by
       LEFT JOIN categories cat ON cat.id = e.category_id
       WHERE e.project_id = ? AND e.paid_by_treasury = 1${dateFilter.replace(/DATE_COL/g, "e.expense_date")}
       ORDER BY e.expense_date DESC, e.id DESC`
    )
    .all(...params);

  const movements = [
    ...contributions.map((c) => ({
      id: c.id,
      kind: "contribution",
      date: c.date,
      concept: c.concept,
      categoryName: c.category_name,
      currency: c.currency,
      amount: c.amount_cents / 100,
      username: c.username,
    })),
    ...expenses.map((e) => ({
      id: e.id,
      kind: "expense",
      date: e.date,
      concept: e.concept,
      categoryName: e.category_name,
      currency: e.currency,
      amount: e.amount_cents / 100,
      username: e.username,
    })),
  ];

  movements.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id));
  return movements;
}

function createContribution({ projectId, category, concept, currency, amountCents, contributedBy, date, createdBy }) {
  const info = db
    .prepare(
      `INSERT INTO treasury_contributions
        (project_id, category_id, concept, currency, amount_cents, contributed_by, contribution_date, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(projectId, category ? category.id : null, concept, currency, amountCents, contributedBy, date, createdBy);
  return info.lastInsertRowid;
}

module.exports = {
  listTreasuryCategories,
  resolveTreasuryCategory,
  computeTreasuryBalance,
  listTreasuryMovements,
  createContribution,
};
