const express = require("express");
const db = require("../db");
const { requireAuth } = require("../auth");
const { computeUserQuests } = require("../services/quests");
const { computeProjectBalances } = require("../services/balances");
const { createReimbursementExpense } = require("../services/expenses");
const { validateCurrency } = require("../validators");
const { canManageProject } = require("../services/projectAccess");

const router = express.Router();
router.use(requireAuth);

router.get("/", (req, res) => {
  const quests = computeUserQuests(req.user.id);
  res.json({ quests });
});

router.post("/settle", (req, res) => {
  const { projectId, fromUserId, toUserId, currency } = req.body || {};
  const pid = Number(projectId);
  const fromId = Number(fromUserId);
  const toId = Number(toUserId);
  if (!pid || !fromId || !toId || fromId === toId || !validateCurrency(currency)) {
    return res.status(400).json({ error: "Faltan datos para saldar la deuda." });
  }

  const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(pid);
  if (!project) return res.status(404).json({ error: "Proyecto no encontrado." });

  // Puede saldarla cualquiera de los dos involucrados, o quien administre el
  // proyecto (para reconciliar una deuda entre otros dos miembros, una vez
  // que la plata cambió de manos fuera de la app).
  const isParty = req.user.id === fromId || req.user.id === toId;
  if (!isParty && !canManageProject(project, req)) {
    return res.status(403).json({ error: "No podés saldar esta deuda." });
  }

  for (const uid of [fromId, toId]) {
    const membership = db
      .prepare("SELECT * FROM project_members WHERE project_id = ? AND user_id = ?")
      .get(pid, uid);
    if (!membership || membership.status !== "member") {
      return res.status(400).json({ error: "Ambos jugadores tienen que ser miembros activos de ese proyecto." });
    }
  }

  // Recalculamos la deuda real en el servidor (nunca confiamos en el monto que
  // pudiera mandar el cliente) para evitar reembolsos desactualizados o manipulados.
  const balances = computeProjectBalances(pid);
  const group = balances.find((g) => g.currency === currency);
  const tx = group && group.transactions.find((t) => t.from === fromId && t.to === toId);
  if (!tx) {
    return res.status(400).json({ error: "No hay esa deuda pendiente en ese proyecto y moneda." });
  }

  createReimbursementExpense({
    projectId: pid,
    payerId: tx.from,
    recipientId: tx.to,
    amountCents: tx.amountCents,
    currency,
    createdBy: req.user.id,
  });

  res.json({ ok: true });
});

module.exports = router;
