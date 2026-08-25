const express = require("express");
const db = require("../db");
const { requireAuth } = require("../auth");
const { validateCurrency } = require("../validators");
const {
  loadProject,
  requireProjectAccess,
  canManageProject,
  getActiveMembers,
} = require("../services/projectAccess");
const { listExpenses } = require("../services/expenses");

const router = express.Router({ mergeParams: true });
router.use(requireAuth, loadProject, requireProjectAccess);

function toCents(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

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

router.get("/", (req, res) => {
  const { month, year } = req.query;
  const expenses = listExpenses(req.project.id, { month, year });
  res.json({ expenses });
});

router.post("/", (req, res) => {
  const { title, currency, amount, paidBy, date, categoryId, categoryName, participantIds } = req.body || {};

  const trimmedTitle = (title || "").trim();
  if (!trimmedTitle) return res.status(400).json({ error: "El título del gasto es obligatorio." });
  if (!validateCurrency(currency)) return res.status(400).json({ error: "Moneda inválida." });
  const amountCents = toCents(amount);
  if (amountCents === null) return res.status(400).json({ error: "El importe debe ser un número mayor a cero." });
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: "Fecha inválida." });
  if (!Array.isArray(participantIds) || participantIds.length === 0) {
    return res.status(400).json({ error: "Seleccioná al menos una persona en 'Para'." });
  }

  const activeMembers = getActiveMembers(req.project.id);
  const activeIds = new Set(activeMembers.map((m) => m.id));

  if (!activeIds.has(Number(paidBy))) {
    return res.status(400).json({ error: "El pagador debe ser un miembro activo del proyecto." });
  }
  const participants = participantIds.map(Number);
  const invalidParticipant = participants.find((id) => !activeIds.has(id));
  if (invalidParticipant) {
    return res.status(400).json({ error: "Todos los seleccionados en 'Para' deben ser miembros activos." });
  }

  let category;
  if (categoryId) {
    category = db.prepare("SELECT * FROM categories WHERE id = ? AND project_id = ?").get(categoryId, req.project.id);
    if (!category) return res.status(400).json({ error: "Categoría inválida." });
  } else if (categoryName && categoryName.trim()) {
    const trimmedCat = categoryName.trim();
    category = db.prepare("SELECT * FROM categories WHERE project_id = ? AND name = ?").get(req.project.id, trimmedCat);
    if (!category) {
      const info = db
        .prepare("INSERT INTO categories (project_id, name, is_default) VALUES (?, ?, 0)")
        .run(req.project.id, trimmedCat);
      category = db.prepare("SELECT * FROM categories WHERE id = ?").get(info.lastInsertRowid);
    }
  } else {
    return res.status(400).json({ error: "Seleccioná o creá una categoría." });
  }

  const splits = splitCents(amountCents, participants);

  const createExpense = db.transaction(() => {
    const info = db
      .prepare(
        `INSERT INTO expenses (project_id, category_id, title, currency, amount_cents, paid_by, expense_date, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(req.project.id, category.id, trimmedTitle, currency, amountCents, Number(paidBy), date, req.user.id);
    const expenseId = info.lastInsertRowid;
    const insertSplit = db.prepare(
      "INSERT INTO expense_splits (expense_id, user_id, share_cents) VALUES (?, ?, ?)"
    );
    for (const s of splits) insertSplit.run(expenseId, s.userId, s.shareCents);
    return expenseId;
  });

  const expenseId = createExpense();
  res.status(201).json({ id: expenseId });
});

router.delete("/:expenseId", (req, res) => {
  const expense = db
    .prepare("SELECT * FROM expenses WHERE id = ? AND project_id = ?")
    .get(req.params.expenseId, req.project.id);
  if (!expense) return res.status(404).json({ error: "Gasto no encontrado." });

  const canDelete =
    req.user.role === "admin" || canManageProject(req.project, req) || expense.created_by === req.user.id;
  if (!canDelete) return res.status(403).json({ error: "No podes eliminar este gasto." });

  db.prepare("DELETE FROM expenses WHERE id = ?").run(expense.id);
  res.json({ ok: true });
});

module.exports = router;
