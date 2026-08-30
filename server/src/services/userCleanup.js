const db = require("../db");

// Un usuario solo se puede borrar de verdad (fila entera, no soft-delete)
// si no queda ningún rastro financiero suyo en ningún proyecto: ni pagó,
// ni cargó, ni participó de un gasto, y no es dueño de ningún proyecto.
// Mientras eso no se cumpla, borrar la fila rompería la triangulación de
// cualquier otro miembro que comparta esos gastos -- por eso las FK de
// expenses/expense_splits/projects.owner_id hacia users NO tienen
// ON DELETE CASCADE a propósito: son la última red de seguridad si esta
// función tuviera un bug.
function getUserFootprint(userId) {
  const expenseCount = db
    .prepare("SELECT COUNT(*) AS n FROM expenses WHERE paid_by = ? OR created_by = ?")
    .get(userId, userId).n;
  const splitCount = db.prepare("SELECT COUNT(*) AS n FROM expense_splits WHERE user_id = ?").get(userId).n;
  const ownedProjects = db.prepare("SELECT COUNT(*) AS n FROM projects WHERE owner_id = ?").get(userId).n;
  return { expenseCount, splitCount, ownedProjects };
}

function canHardDeleteUser(userId) {
  const fp = getUserFootprint(userId);
  return fp.expenseCount === 0 && fp.splitCount === 0 && fp.ownedProjects === 0;
}

// Borra la fila de "users" entera, más todo lo administrativo que la
// referencia sin cascada (membresías, solicitudes de reset). No toca
// gastos/splits porque canHardDeleteUser ya garantizó que no existen.
const hardDeleteUser = db.transaction((userId) => {
  db.prepare("DELETE FROM project_members WHERE user_id = ?").run(userId);
  db.prepare("UPDATE project_members SET added_by = NULL WHERE added_by = ?").run(userId);
  db.prepare("DELETE FROM password_reset_requests WHERE user_id = ?").run(userId);
  db.prepare("UPDATE password_reset_requests SET resolved_by = NULL WHERE resolved_by = ?").run(userId);
  db.prepare("DELETE FROM users WHERE id = ?").run(userId); // sessions se van solas (ON DELETE CASCADE)
});

// Un proyecto solo se purga cuando TODOS los que siguen figurando en él
// (miembros o invitaciones pendientes -- no cuenta a quien ya fue quitado
// puntualmente del proyecto) tienen la CUENTA GLOBAL eliminada. Ojo: esto
// se fija en users.status, no en project_members.status -- al dueño del
// proyecto nunca se lo puede sacar del proyecto en sí (esa acción está
// bloqueada a propósito), así que la única forma de que un proyecto quede
// "abandonado" es que el admin haya eliminado la cuenta de cada uno desde
// el panel de usuarios, dueño incluido.
function canPurgeProject(projectId) {
  const blockers = db
    .prepare(
      `SELECT COUNT(*) AS n FROM project_members pm
       JOIN users u ON u.id = pm.user_id
       WHERE pm.project_id = ? AND pm.status != 'removed' AND u.status != 'removed'`
    )
    .get(projectId).n;
  return blockers === 0;
}

// Borra el proyecto (cascada: project_members, categories, entities,
// expenses -> expense_splits quedan vacíos solos por las FK ON DELETE
// CASCADE ya definidas). Después revisa a cada ex-miembro: si este
// proyecto era el único lugar donde tenían rastro financiero, ahora que
// ya no existe, de paso los purga a ellos también.
function purgeProject(projectId) {
  const tx = db.transaction(() => {
    const memberIds = db
      .prepare("SELECT DISTINCT user_id FROM project_members WHERE project_id = ?")
      .all(projectId)
      .map((r) => r.user_id);

    db.prepare("DELETE FROM projects WHERE id = ?").run(projectId);

    for (const userId of memberIds) {
      const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
      if (user && user.status === "removed" && user.username !== "administrator" && canHardDeleteUser(userId)) {
        hardDeleteUser(userId);
      }
    }
  });
  tx();
}

module.exports = { getUserFootprint, canHardDeleteUser, hardDeleteUser, canPurgeProject, purgeProject };
