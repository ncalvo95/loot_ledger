const db = require("../db");

function getMembership(projectId, userId) {
  return db
    .prepare("SELECT * FROM project_members WHERE project_id = ? AND user_id = ?")
    .get(projectId, userId);
}

function getMemberRole(projectId, userId) {
  const m = getMembership(projectId, userId);
  return m ? m.role : null;
}

function isProjectOwner(project, userId) {
  return project.owner_id === userId;
}

// Dueños y administradores de proyecto (o el administrador global) pueden
// gestionar miembros, categorías y gastos ajenos.
function canManageProject(project, req) {
  if (req.user.role === "admin") return true;
  const role = getMemberRole(project.id, req.user.id);
  return role === "owner" || role === "admin";
}

function loadProject(req, res, next) {
  const projectId = req.params.id || req.params.projectId;
  const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(projectId);
  if (!project) return res.status(404).json({ error: "Proyecto no encontrado." });
  req.project = project;
  next();
}

function requireProjectAccess(req, res, next) {
  if (req.user.role === "admin") return next();
  const membership = getMembership(req.project.id, req.user.id);
  if (!membership || membership.status === "removed") {
    return res.status(403).json({ error: "No tenés acceso a este proyecto." });
  }
  req.membership = membership;
  next();
}

// Miembros activos ('member'), usados para asignar pagos y participantes de nuevos gastos.
function getActiveMembers(projectId) {
  return db
    .prepare(
      `SELECT u.id, u.username FROM project_members pm
       JOIN users u ON u.id = pm.user_id
       WHERE pm.project_id = ? AND pm.status = 'member'
       ORDER BY u.username ASC`
    )
    .all(projectId);
}

module.exports = {
  getMembership,
  getMemberRole,
  isProjectOwner,
  canManageProject,
  loadProject,
  requireProjectAccess,
  getActiveMembers,
};
