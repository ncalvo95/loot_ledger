const db = require("../db");
const express = require("express");
const { requireAuth } = require("../auth");
const { validateCurrency } = require("../validators");
const { loadProject, requireProjectAccess, canManageProject, getActiveMembers } = require("../services/projectAccess");
const { listRecurringRules, createRecurringRule, updateRecurringRule, deleteRecurringRule } = require("../services/recurring");
const { resolveTreasuryCategory } = require("../services/treasury");

const router = express.Router({ mergeParams: true });
router.use(requireAuth, loadProject, requireProjectAccess);

function toCents(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

function requireManage(req, res, next) {
  if (!canManageProject(req.project, req)) {
    return res.status(403).json({ error: "Solo el administrador del proyecto puede gestionar Respawn." });
  }
  next();
}

// Valida y arma los campos comunes a crear/editar una regla. Reutiliza el
// mismo criterio que un gasto normal: categoría/entidad opcionales, y o
// bien Treasury o bien una lista de participantes (nunca las dos), salvo en
// un proyecto individual donde ninguna de las dos aplica -- ahí el único
// miembro activo es siempre el participante.
//
// Si kind === "contribution" es un aporte recurrente al fondo común (ej. el
// sueldo mensual): no aplica categoría/entidad/participantes/Treasury de
// gasto, solo título (concepto), monto, día del mes y opcionalmente una
// categoría de Treasury. Solo válido en proyectos compartidos (el fondo
// común no existe en proyectos individuales).
function validateRuleInput(req, body) {
  const {
    title, currency, amount, paidBy, categoryId, categoryName, entityId, entityName,
    dayOfMonth, participantIds, paidByTreasury, kind, treasuryCategoryId, treasuryCategoryName,
  } = body || {};
  const isIndividual = req.project.type === "individual";
  const isContribution = !isIndividual && kind === "contribution";
  const isTreasury = !isIndividual && !isContribution && !!paidByTreasury;

  const trimmedTitle = (title || "").trim();
  if (!trimmedTitle) return { error: "El título es obligatorio." };
  if (!validateCurrency(currency)) return { error: "Moneda inválida." };
  const amountCents = toCents(amount);
  if (amountCents === null) return { error: "El importe debe ser un número mayor a cero." };
  const day = Number(dayOfMonth);
  if (!Number.isInteger(day) || day < 1 || day > 31) return { error: "El día del mes debe ser entre 1 y 31." };

  const activeMembers = getActiveMembers(req.project.id);
  const activeIds = new Set(activeMembers.map((m) => m.id));
  if (!activeIds.has(Number(paidBy))) {
    return { error: "El pagador debe ser un miembro activo del proyecto." };
  }

  if (isContribution) {
    const treasuryCategory = resolveTreasuryCategory(req.project.id, { categoryId: treasuryCategoryId, categoryName: treasuryCategoryName });
    return {
      kind: "contribution",
      trimmedTitle, currency, amountCents, paidBy: Number(paidBy),
      category: null, entity: null, participants: [], isTreasury: false, dayOfMonth: day,
      treasuryCategory,
    };
  }

  let participants;
  if (isIndividual) {
    participants = [Number(paidBy)];
  } else if (isTreasury) {
    participants = [];
  } else {
    if (!Array.isArray(participantIds) || participantIds.length === 0) {
      return { error: "Seleccioná al menos una persona en 'Para'." };
    }
    participants = participantIds.map(Number);
    const invalidParticipant = participants.find((id) => !activeIds.has(id));
    if (invalidParticipant) return { error: "Todos los seleccionados en 'Para' deben ser miembros activos." };
  }

  let category = null;
  if (categoryId) {
    category = db.prepare("SELECT * FROM categories WHERE id = ? AND project_id = ?").get(categoryId, req.project.id);
    if (!category) return { error: "Categoría inválida." };
  } else if (categoryName && categoryName.trim()) {
    const trimmedCat = categoryName.trim();
    category = db.prepare("SELECT * FROM categories WHERE project_id = ? AND name = ?").get(req.project.id, trimmedCat);
    if (!category) {
      const info = db.prepare("INSERT INTO categories (project_id, name) VALUES (?, ?)").run(req.project.id, trimmedCat);
      category = db.prepare("SELECT * FROM categories WHERE id = ?").get(info.lastInsertRowid);
    }
  }

  let entity = null;
  if (entityId) {
    entity = db.prepare("SELECT * FROM entities WHERE id = ? AND project_id = ?").get(entityId, req.project.id);
    if (!entity) return { error: "Entidad inválida." };
  } else if (entityName && entityName.trim()) {
    const trimmedEnt = entityName.trim();
    entity = db.prepare("SELECT * FROM entities WHERE project_id = ? AND name = ?").get(req.project.id, trimmedEnt);
    if (!entity) {
      const info = db.prepare("INSERT INTO entities (project_id, name) VALUES (?, ?)").run(req.project.id, trimmedEnt);
      entity = db.prepare("SELECT * FROM entities WHERE id = ?").get(info.lastInsertRowid);
    }
  }

  return {
    kind: "expense",
    trimmedTitle, currency, amountCents, paidBy: Number(paidBy),
    category, entity, participants, isTreasury, dayOfMonth: day,
  };
}

router.get("/", (req, res) => {
  res.json({ rules: listRecurringRules(req.project.id) });
});

router.post("/", requireManage, (req, res) => {
  const result = validateRuleInput(req, req.body);
  if (result.error) return res.status(400).json({ error: result.error });

  const id = createRecurringRule({
    projectId: req.project.id,
    kind: result.kind,
    title: result.trimmedTitle,
    categoryId: result.category ? result.category.id : null,
    entityId: result.entity ? result.entity.id : null,
    treasuryCategoryId: result.treasuryCategory ? result.treasuryCategory.id : null,
    currency: result.currency,
    amountCents: result.amountCents,
    paidBy: result.paidBy,
    isTreasury: result.isTreasury,
    participantIds: result.participants,
    dayOfMonth: result.dayOfMonth,
    createdBy: req.user.id,
  });
  res.status(201).json({ id });
});

router.patch("/:ruleId", requireManage, (req, res) => {
  const rule = db
    .prepare("SELECT * FROM recurring_expenses WHERE id = ? AND project_id = ?")
    .get(req.params.ruleId, req.project.id);
  if (!rule) return res.status(404).json({ error: "Regla no encontrada." });

  // Toggle de pausa: no valida el resto de los campos, solo activa/desactiva.
  if (Object.keys(req.body || {}).length === 1 && "active" in (req.body || {})) {
    const updated = updateRecurringRule(rule.id, { active: !!req.body.active });
    return res.json({ ok: true, rule: updated });
  }

  const result = validateRuleInput(req, { ...req.body, dayOfMonth: req.body.dayOfMonth ?? rule.day_of_month });
  if (result.error) return res.status(400).json({ error: result.error });

  const updated = updateRecurringRule(rule.id, {
    kind: result.kind,
    title: result.trimmedTitle,
    categoryId: result.category ? result.category.id : null,
    entityId: result.entity ? result.entity.id : null,
    treasuryCategoryId: result.treasuryCategory ? result.treasuryCategory.id : null,
    currency: result.currency,
    amountCents: result.amountCents,
    paidBy: result.paidBy,
    isTreasury: result.isTreasury,
    participantIds: result.participants,
    dayOfMonth: result.dayOfMonth,
    active: req.body.active !== undefined ? !!req.body.active : !!rule.active,
  });
  res.json({ ok: true, rule: updated });
});

router.delete("/:ruleId", requireManage, (req, res) => {
  const rule = db
    .prepare("SELECT * FROM recurring_expenses WHERE id = ? AND project_id = ?")
    .get(req.params.ruleId, req.project.id);
  if (!rule) return res.status(404).json({ error: "Regla no encontrada." });
  deleteRecurringRule(rule.id);
  res.json({ ok: true });
});

module.exports = router;
