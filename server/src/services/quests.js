const db = require("../db");
const { computeProjectBalances } = require("./balances");

// Deuda global de un usuario con cada contraparte, sumada entre todos los
// proyectos donde ambos comparten gastos, discriminada por proyecto y moneda.
function computeUserQuests(userId) {
  const projects = db
    .prepare(
      `SELECT p.id, p.name FROM projects p
       JOIN project_members pm ON pm.project_id = p.id
       WHERE pm.user_id = ? AND pm.status = 'member'`
    )
    .all(userId);

  const counterparts = new Map();

  for (const project of projects) {
    const balances = computeProjectBalances(project.id);
    for (const group of balances) {
      for (const tx of group.transactions) {
        if (tx.from !== userId && tx.to !== userId) continue;

        const counterpartId = tx.from === userId ? tx.to : tx.from;
        const counterpartUsername = tx.from === userId ? tx.toUsername : tx.fromUsername;
        const direction = tx.from === userId ? "youOwe" : "owesYou";
        const signedCents = tx.from === userId ? -tx.amountCents : tx.amountCents;

        if (!counterparts.has(counterpartId)) {
          counterparts.set(counterpartId, {
            counterpartId,
            username: counterpartUsername,
            currencies: new Map(),
          });
        }
        const counterpart = counterparts.get(counterpartId);

        if (!counterpart.currencies.has(group.currency)) {
          counterpart.currencies.set(group.currency, { currency: group.currency, netCents: 0, lines: [] });
        }
        const currencyBlock = counterpart.currencies.get(group.currency);
        currencyBlock.netCents += signedCents;

        const counterpartMembership = db
          .prepare("SELECT status FROM project_members WHERE project_id = ? AND user_id = ?")
          .get(project.id, counterpartId);
        const canSettle = !!counterpartMembership && counterpartMembership.status === "member";

        currencyBlock.lines.push({
          projectId: project.id,
          projectName: project.name,
          direction,
          amountCents: tx.amountCents,
          amount: tx.amountCents / 100,
          canSettle,
        });
      }
    }
  }

  return [...counterparts.values()].map((cp) => ({
    counterpartId: cp.counterpartId,
    username: cp.username,
    currencies: [...cp.currencies.values()]
      .map((c) => ({
        currency: c.currency,
        netCents: c.netCents,
        net: c.netCents / 100,
        lines: c.lines,
      }))
      .sort((a, b) => a.currency.localeCompare(b.currency)),
  }));
}

module.exports = { computeUserQuests };
