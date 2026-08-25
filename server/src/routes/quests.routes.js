const express = require("express");
const db = require("../db");
const { requireAuth } = require("../auth");
const { computeUserQuests } = require("../services/quests");
const { computeProjectBalances } = require("../services/balances");
const { createReimbursementExpense } = require("../services/expenses");
const { validateCurrency } = require("../validators");

const router = express.Router();
router.use(requireAuth);

router.get("/", (req, res) => {
  const quests = computeUserQuests(req.user.id);
  res.json({ quests });
});

router.post("/settle", (req, res) => {
  const { projectId, counterpartId, currency } = req.body || {};
  const pid = Number(projectId);
  const cid = Number(counterpartId);
  if (!pid || !cid || !validateCurrency(currency)) {
    return res.status(400).json({ error: "Faltan datos para saldar la deuda." });
  }

  const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(pid);
  if (!project) return res.status(404).json({ error: "Proyecto no encontrado." });

  const membership = db
    .prepare("SELECT * FROM project_members WHERE project_id = ? AND user_id = ?")
    .get(pid, req.user.id);
  if (!membership || membership.status !== "member") {
    return res.status(403).json({ error: "No sos miembro activo de ese proyecto." });
  }
  const counterpartMembership = db
    .prepare("SELECT * FROM project_members WHERE project_id = ? AND user_id = ?")
    .get(pid, cid);
  if (!counterpartMembership || counterpartMembership.status !== "member") {
    return res.status(400).json({ error: "Ese jugador ya no es miembro activo de ese proyecto." });
  }

  // Recalculamos la deuda real en el servidor (nunca confiamos en el monto que
  // pudiera mandar el cliente) para evitar reembolsos desactualizados o manipulados.
  const balances = computeProjectBalances(pid);
  const group = balances.find((g) => g.currency === currency);
  const tx = group && group.transactions.find((t) => (t.from === req.user.id && t.to === cid) || (t.from === cid && t.to === req.user.id));
  if (!tx) {
    return res.status(400).json({ error: "No hay deuda pendiente con ese usuario en ese proyecto y moneda." });
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
