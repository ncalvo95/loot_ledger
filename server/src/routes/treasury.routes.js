const express = require("express");
const db = require("../db");
const { requireAuth } = require("../auth");
const { validateCurrency } = require("../validators");
const { loadProject, requireProjectAccess, canManageProject } = require("../services/projectAccess");
const {
  listTreasuryCategories,
  resolveTreasuryCategory,
  computeTreasuryBalance,
  listTreasuryMovements,
  createContribution,
} = require("../services/treasury");

const router = express.Router({ mergeParams: true });
router.use(requireAuth, loadProject, requireProjectAccess);

function toCents(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

function requireShared(req, res, next) {
  if (req.project.type === "individual") {
    return res.status(400).json({ error: "Los proyectos individuales no tienen Treasury." });
  }
  next();
}

router.get("/", requireShared, (req, res) => {
  const { month, year } = req.query;
  res.json({
    balance: computeTreasuryBalance(req.project.id),
    movements: listTreasuryMovements(req.project.id, { month, year }),
    categories: listTreasuryCategories(req.project.id),
  });
});

router.post("/contributions", requireShared, (req, res) => {
  const { concept, currency, amount, date, categoryId, categoryName } = req.body || {};
  const trimmedConcept = (concept || "").trim();
  if (!trimmedConcept) return res.status(400).json({ error: "El concepto es obligatorio." });
  if (!validateCurrency(currency)) return res.status(400).json({ error: "Moneda inválida." });
  const amountCents = toCents(amount);
  if (amountCents === null) return res.status(400).json({ error: "El importe debe ser un número mayor a cero." });
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: "Fecha inválida." });

  const category = resolveTreasuryCategory(req.project.id, { categoryId, categoryName });

  const id = createContribution({
    projectId: req.project.id,
    category,
    concept: trimmedConcept,
    currency,
    amountCents,
    contributedBy: req.user.id,
    date,
    createdBy: req.user.id,
  });
  res.status(201).json({ id });
});

router.delete("/contributions/:contributionId", requireShared, (req, res) => {
  const contribution = db
    .prepare("SELECT * FROM treasury_contributions WHERE id = ? AND project_id = ?")
    .get(req.params.contributionId, req.project.id);
  if (!contribution) return res.status(404).json({ error: "Aporte no encontrado." });
  if (contribution.created_by !== req.user.id && !canManageProject(req.project, req)) {
    return res.status(403).json({ error: "No podés eliminar este aporte." });
  }
  db.prepare("DELETE FROM treasury_contributions WHERE id = ?").run(contribution.id);
  res.json({ ok: true });
});

module.exports = router;
