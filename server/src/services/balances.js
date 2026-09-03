const db = require("../db");

function computeProjectBalances(projectId) {
  const currencies = db
    .prepare("SELECT DISTINCT currency FROM expenses WHERE project_id = ?")
    .all(projectId)
    .map((r) => r.currency);

  const allMembers = db
    .prepare(
      `SELECT pm.user_id AS id, u.username, pm.status
       FROM project_members pm JOIN users u ON u.id = pm.user_id
       WHERE pm.project_id = ?`
    )
    .all(projectId);
  const memberMap = new Map(allMembers.map((m) => [m.id, m]));

  const result = currencies.map((currency) => {
    // Los gastos pagados desde Treasury (paid_by_treasury=1) quedan afuera:
    // salen del fondo común, no del bolsillo de quien los cargó, así que no
    // deben sumarle nada a su balance personal.
    const paid = db
      .prepare(
        `SELECT paid_by AS user_id, SUM(amount_cents) AS total
         FROM expenses WHERE project_id = ? AND currency = ? AND paid_by_treasury = 0 GROUP BY paid_by`
      )
      .all(projectId, currency);
    const owed = db
      .prepare(
        `SELECT es.user_id AS user_id, SUM(es.share_cents) AS total
         FROM expense_splits es JOIN expenses e ON e.id = es.expense_id
         WHERE e.project_id = ? AND e.currency = ?
         GROUP BY es.user_id`
      )
      .all(projectId, currency);

    const netByUser = new Map();
    for (const row of paid) {
      netByUser.set(row.user_id, (netByUser.get(row.user_id) || 0) + row.total);
    }
    for (const row of owed) {
      netByUser.set(row.user_id, (netByUser.get(row.user_id) || 0) - row.total);
    }

    // Aseguramos que todos los miembros activos aparezcan aunque su balance sea cero.
    for (const m of allMembers) {
      if (m.status === "member" && !netByUser.has(m.id)) netByUser.set(m.id, 0);
    }

    const balances = [...netByUser.entries()]
      .map(([userId, netCents]) => {
        const member = memberMap.get(userId);
        return {
          userId,
          username: member ? member.username : `usuario#${userId}`,
          accountStatus: member ? member.status : "removed",
          netCents,
          net: netCents / 100,
        };
      })
      .sort((a, b) => b.netCents - a.netCents);

    const transactions = simplifyDebts(balances);

    return { currency, balances, transactions };
  });

  return result;
}

function simplifyDebts(balances) {
  const creditors = balances
    .filter((b) => b.netCents > 0)
    .map((b) => ({ userId: b.userId, username: b.username, remaining: b.netCents }))
    .sort((a, b) => b.remaining - a.remaining);
  const debtors = balances
    .filter((b) => b.netCents < 0)
    .map((b) => ({ userId: b.userId, username: b.username, remaining: -b.netCents }))
    .sort((a, b) => b.remaining - a.remaining);

  const transactions = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];
    const amount = Math.min(debtor.remaining, creditor.remaining);
    if (amount > 0) {
      transactions.push({
        from: debtor.userId,
        fromUsername: debtor.username,
        to: creditor.userId,
        toUsername: creditor.username,
        amountCents: amount,
        amount: amount / 100,
      });
    }
    debtor.remaining -= amount;
    creditor.remaining -= amount;
    if (debtor.remaining === 0) i += 1;
    if (creditor.remaining === 0) j += 1;
  }
  return transactions;
}

module.exports = { computeProjectBalances, simplifyDebts };
