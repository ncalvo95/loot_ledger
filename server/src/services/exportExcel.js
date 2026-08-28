const ExcelJS = require("exceljs");

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function buildExportWorkbook({ project, expenses, balances, filterLabel }) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Loot Ledger";
  workbook.created = new Date();

  const expensesSheet = workbook.addWorksheet("Gastos");
  expensesSheet.columns = [
    { width: 12 },
    { width: 28 },
    { width: 18 },
    { width: 18 },
    { width: 10 },
    { width: 14 },
    { width: 18 },
    { width: 40 },
  ];
  expensesSheet.getCell("A1").value = `Loot Ledger - ${project.name}`;
  expensesSheet.getCell("A1").font = { bold: true, size: 14 };
  expensesSheet.getCell("A2").value = filterLabel;
  expensesSheet.getCell("A2").font = { italic: true, color: { argb: "FF666666" } };

  const expenseRows = expenses.map((e) => [
    e.date,
    e.title,
    e.categoryName,
    e.entityName || "",
    e.currency,
    e.amount,
    e.paidByUsername,
    e.participants.map((p) => `${p.username} (${p.amount.toFixed(2)})`).join(", "),
  ]);

  expensesSheet.addTable({
    name: "TablaGastos",
    ref: "A4",
    headerRow: true,
    totalsRow: false,
    style: { theme: "TableStyleMedium9", showRowStripes: true },
    columns: [
      { name: "Fecha" },
      { name: "Título" },
      { name: "Categoría" },
      { name: "Entidad" },
      { name: "Moneda" },
      { name: "Importe", filterButton: true },
      { name: "Pagado por" },
      { name: "Para (participante y monto)" },
    ],
    rows: expenseRows.length ? expenseRows : [["", "", "", "", "", "", "", ""]],
  });

  const balancesSheet = workbook.addWorksheet("Balances");
  balancesSheet.columns = [{ width: 22 }, { width: 12 }, { width: 16 }];
  balancesSheet.getCell("A1").value = `Balances - ${project.name}`;
  balancesSheet.getCell("A1").font = { bold: true, size: 14 };

  const balanceRows = [];
  balances.forEach((group) => {
    group.balances.forEach((b) => {
      balanceRows.push([b.username, group.currency, b.net]);
    });
  });

  balancesSheet.addTable({
    name: "TablaBalances",
    ref: "A3",
    headerRow: true,
    style: { theme: "TableStyleMedium9", showRowStripes: true },
    columns: [{ name: "Usuario" }, { name: "Moneda" }, { name: "Balance neto" }],
    rows: balanceRows.length ? balanceRows : [["", "", ""]],
  });

  const transactionsSheet = workbook.addWorksheet("Deudas");
  transactionsSheet.columns = [{ width: 20 }, { width: 20 }, { width: 12 }, { width: 14 }];
  transactionsSheet.getCell("A1").value = `Quién le debe a quién - ${project.name}`;
  transactionsSheet.getCell("A1").font = { bold: true, size: 14 };

  const txRows = [];
  balances.forEach((group) => {
    group.transactions.forEach((t) => {
      txRows.push([t.fromUsername, t.toUsername, group.currency, t.amount]);
    });
  });

  transactionsSheet.addTable({
    name: "TablaDeudas",
    ref: "A3",
    headerRow: true,
    style: { theme: "TableStyleMedium9", showRowStripes: true },
    columns: [{ name: "Debe" }, { name: "A" }, { name: "Moneda" }, { name: "Monto" }],
    rows: txRows.length ? txRows : [["", "", "", ""]],
  });

  return workbook;
}

function buildFilterLabel({ scope, month, year }) {
  if (scope === "month" && month && year) {
    return `Período: ${MONTH_NAMES[Number(month) - 1] || month} ${year}`;
  }
  if (scope === "year" && year) {
    return `Período: Año ${year}`;
  }
  return "Período: Histórico completo";
}

module.exports = { buildExportWorkbook, buildFilterLabel };
