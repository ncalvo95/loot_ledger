const express = require("express");
const { requireAuth } = require("../auth");
const { loadProject, requireProjectAccess } = require("../services/projectAccess");
const { computeProjectBalances } = require("../services/balances");

const router = express.Router({ mergeParams: true });
router.use(requireAuth, loadProject, requireProjectAccess);

router.get("/", (req, res) => {
  const balances = computeProjectBalances(req.project.id);
  res.json({ balances });
});

module.exports = router;
