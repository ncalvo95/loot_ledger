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

function canEditExpense(req, expense) {
  return req.user.role === "admin" || canManageProject(req.project, req) || expense.created_by === req.user.id;
}

function validateExpenseInput(req, body) {
  const { title, currency, amount, paidBy, date, categoryId, categoryName, entityId, entityName, participantIds } =
    body || {};

  const trimmedTitle = (title || "").trim();
  if (!trimmedTitle) return { error: "El título del gasto es obligatorio." };
  if (!validateCurrency(currency)) return { error: "Moneda inválida." };
  const amountCents = toCents(amount);
  if (amountCents === null) return { error: "El importe debe ser un número mayor a cero." };
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Fecha inválida." };
  if (!Array.isArray(participantIds) || participantIds.length === 0) {
    return { error: "Seleccioná al menos una persona en 'Para'." };
  }

  const activeMembers = getActiveMembers(req.project.id);
  const activeIds = new Set(activeMembers.map((m) => m.id));

  if (!activeIds.has(Number(paidBy))) {
    return { error: "El pagador debe ser un miembro activo del proyecto." };
  }
  const participants = participantIds.map(Number);
  const invalidParticipant = participants.find((id) => !activeIds.has(id));
  if (invalidParticipant) {
    return { error: "Todos los seleccionados en 'Para' deben ser miembros activos." };
  }

  let category;
  if (categoryId) {
    category = db.prepare("SELECT * FROM categories WHERE id = ? AND project_id = ?").get(categoryId, req.project.id);
    if (!category) return { error: "Categoría inválida." };
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
    return { error: "Seleccioná o creá una categoría." };
  }

  // La entidad es opcional -- a diferencia de la categoría, un gasto no
  // necesita tener una asignada.
  let entity = null;
  if (entityId) {
    entity = db.prepare("SELECT * FROM entities WHERE id = ? AND project_id = ?").get(entityId, req.project.id);
    if (!entity) return { error: "Entidad inválida." };
  } else if (entityName && entityName.trim()) {
    const trimmedEnt = entityName.trim();
    entity = db.prepare("SELECT * FROM entities WHERE project_id = ? AND name = ?").get(req.project.id, trimmedEnt);
    if (!entity) {
      const info = db
        .prepare("INSERT INTO entities (project_id, name) VALUES (?, ?)")
        .run(req.project.id, trimmedEnt);
      entity = db.prepare("SELECT * FROM entities WHERE id = ?").get(info.lastInsertRowid);
    }
  }

  return {
    trimmedTitle,
    currency,
    amountCents,
    paidBy: Number(paidBy),
    date,
    category,
    entity,
    participants,
  };
}

router.get("/", (req, res) => {
  const { month, year } = req.query;
  const expenses = listExpenses(req.project.id, { month, year });
  res.json({ expenses });
});

router.post("/", (req, res) => {
  const result = validateExpenseInput(req, req.body);
  if (result.error) return res.status(400).json({ error: result.error });
  const { trimmedTitle, currency, amountCents, paidBy, date, category, entity, participants } = result;

  const splits = splitCents(amountCents, participants);

  const createExpense = db.transaction(() => {
    const info = db
      .prepare(
        `INSERT INTO expenses (project_id, category_id, entity_id, title, currency, amount_cents, paid_by, expense_date, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(req.project.id, category.id, entity ? entity.id : null, trimmedTitle, currency, amountCents, paidBy, date, req.user.id);
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

router.put("/:expenseId", (req, res) => {
  const expense = db
    .prepare("SELECT * FROM expenses WHERE id = ? AND project_id = ?")
    .get(req.params.expenseId, req.project.id);
  if (!expense) return res.status(404).json({ error: "Gasto no encontrado." });
  if (!canEditExpense(req, expense)) return res.status(403).json({ error: "No podés editar este gasto." });

  const result = validateExpenseInput(req, req.body);
  if (result.error) return res.status(400).json({ error: result.error });
  const { trimmedTitle, currency, amountCents, paidBy, date, category, entity, participants } = result;

  const splits = splitCents(amountCents, participants);

  const updateExpense = db.transaction(() => {
    db.prepare(
      `UPDATE expenses SET category_id = ?, entity_id = ?, title = ?, currency = ?, amount_cents = ?, paid_by = ?, expense_date = ?
       WHERE id = ?`
    ).run(category.id, entity ? entity.id : null, trimmedTitle, currency, amountCents, paidBy, date, expense.id);
    db.prepare("DELETE FROM expense_splits WHERE expense_id = ?").run(expense.id);
    const insertSplit = db.prepare(
      "INSERT INTO expense_splits (expense_id, user_id, share_cents) VALUES (?, ?, ?)"
    );
    for (const s of splits) insertSplit.run(expense.id, s.userId, s.shareCents);
  });

  updateExpense();
  res.json({ ok: true });
});

router.delete("/:expenseId", (req, res) => {
  const expense = db
    .prepare("SELECT * FROM expenses WHERE id = ? AND project_id = ?")
    .get(req.params.expenseId, req.project.id);
  if (!expense) return res.status(404).json({ error: "Gasto no encontrado." });
  if (!canEditExpense(req, expense)) return res.status(403).json({ error: "No podés eliminar este gasto." });

  db.prepare("DELETE FROM expenses WHERE id = ?").run(expense.id);
  res.json({ ok: true });
});

module.exports = router;
