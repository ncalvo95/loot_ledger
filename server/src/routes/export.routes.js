const express = require("express");
const { requireAuth } = require("../auth");
const { loadProject, requireProjectAccess } = require("../services/projectAccess");
const { listExpenses } = require("../services/expenses");
const { computeProjectBalances } = require("../services/balances");
const { buildExportWorkbook, buildFilterLabel } = require("../services/exportExcel");

const router = express.Router({ mergeParams: true });
router.use(requireAuth, loadProject, requireProjectAccess);

router.get("/", async (req, res) => {
  const { scope = "all", month, year } = req.query;

  if (scope === "month" && (!month || !year)) {
    return res.status(400).json({ error: "Indicá mes y año para exportar por período." });
  }
  if (scope === "year" && !year) {
    return res.status(400).json({ error: "Indicá el año para exportar." });
  }

  const filters = {};
  if (scope === "month") {
    filters.month = month;
    filters.year = year;
  } else if (scope === "year") {
    filters.year = year;
  }

  const expenses = listExpenses(req.project.id, filters);
  const balances = computeProjectBalances(req.project.id);
  const filterLabel = buildFilterLabel({ scope, month, year });

  const workbook = buildExportWorkbook({ project: req.project, expenses, balances, filterLabel });

  const safeName = req.project.name.replace(/[^a-zA-Z0-9-_]+/g, "_");
  const suffix = scope === "month" ? `_${year}-${String(month).padStart(2, "0")}` : scope === "year" ? `_${year}` : "_historico";
  const filename = `LootLedger_${safeName}${suffix}.xlsx`;

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  await workbook.xlsx.write(res);
  res.end();
});

module.exports = router;
