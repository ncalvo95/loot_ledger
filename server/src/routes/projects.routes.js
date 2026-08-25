const express = require("express");
const db = require("../db");
const { requireAuth } = require("../auth");
const {
  getMembership,
  isProjectOwner,
  canManageProject,
  loadProject,
  requireProjectAccess,
} = require("../services/projectAccess");

const router = express.Router();
router.use(requireAuth);

router.get("/", (req, res) => {
  const userId = req.user.id;
  const active = db
    .prepare(
      `SELECT p.*, u.username AS owner_username,
        (SELECT COUNT(*) FROM project_members pm2 WHERE pm2.project_id = p.id AND pm2.status = 'member') AS member_count
       FROM projects p
       JOIN project_members pm ON pm.project_id = p.id
       JOIN users u ON u.id = p.owner_id
       WHERE pm.user_id = ? AND pm.status = 'member'
       ORDER BY p.created_at DESC`
    )
    .all(userId);
  const invited = db
    .prepare(
      `SELECT p.*, u.username AS owner_username
       FROM projects p
       JOIN project_members pm ON pm.project_id = p.id
       JOIN users u ON u.id = p.owner_id
       WHERE pm.user_id = ? AND pm.status = 'invited'
       ORDER BY p.created_at DESC`
    )
    .all(userId);
  res.json({ active, invited });
});

router.post("/", (req, res) => {
  const { name } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: "El nombre del proyecto es obligatorio." });

  const insertProject = db.transaction(() => {
    const info = db
      .prepare("INSERT INTO projects (name, owner_id) VALUES (?, ?)")
      .run(name.trim(), req.user.id);
    const projectId = info.lastInsertRowid;
    db.prepare(
      "INSERT INTO project_members (project_id, user_id, status, added_by) VALUES (?, ?, 'member', ?)"
    ).run(projectId, req.user.id, req.user.id);
    db.prepare(
      "INSERT INTO categories (project_id, name, is_default) VALUES (?, 'Reembolso', 1)"
    ).run(projectId);
    return projectId;
  });

  const projectId = insertProject();
  const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(projectId);
  res.status(201).json({ project });
});

router.get("/:id", loadProject, requireProjectAccess, (req, res) => {
  const members = db
    .prepare(
      `SELECT pm.user_id, pm.status, u.username, u.status AS account_status
       FROM project_members pm
       JOIN users u ON u.id = pm.user_id
       WHERE pm.project_id = ?
       ORDER BY pm.status ASC, u.username ASC`
    )
    .all(req.project.id);
  const categories = db
    .prepare("SELECT * FROM categories WHERE project_id = ? ORDER BY is_default DESC, name ASC")
    .all(req.project.id);
  res.json({
    project: req.project,
    members,
    categories,
    isOwner: isProjectOwner(req.project, req.user.id) || req.user.role === "admin",
  });
});

router.post("/:id/members", loadProject, (req, res) => {
  if (!canManageProject(req.project, req)) {
    return res.status(403).json({ error: "Solo el administrador del proyecto puede agregar miembros." });
  }
  const { username, mode } = req.body || {};
  if (!username) return res.status(400).json({ error: "Indica el nombre de usuario." });
  const targetStatus = mode === "invite" ? "invited" : "member";

  const user = db.prepare("SELECT * FROM users WHERE username = ? AND status = 'active'").get(username);
  if (!user) return res.status(404).json({ error: "No existe un usuario activo con ese nombre." });

  const existing = getMembership(req.project.id, user.id);
  if (existing) {
    if (existing.status === "member") {
      return res.status(409).json({ error: "Ese usuario ya es miembro del proyecto." });
    }
    db.prepare(
      "UPDATE project_members SET status = ?, added_by = ?, joined_at = datetime('now') WHERE id = ?"
    ).run(targetStatus, req.user.id, existing.id);
  } else {
    db.prepare(
      "INSERT INTO project_members (project_id, user_id, status, added_by) VALUES (?, ?, ?, ?)"
    ).run(req.project.id, user.id, targetStatus, req.user.id);
  }
  res.status(201).json({ ok: true, status: targetStatus });
});

router.post("/:id/accept", loadProject, (req, res) => {
  const membership = getMembership(req.project.id, req.user.id);
  if (!membership || membership.status !== "invited") {
    return res.status(400).json({ error: "No tenes una invitacion pendiente para este proyecto." });
  }
  db.prepare("UPDATE project_members SET status = 'member' WHERE id = ?").run(membership.id);
  res.json({ ok: true });
});

router.post("/:id/decline", loadProject, (req, res) => {
  const membership = getMembership(req.project.id, req.user.id);
  if (!membership || membership.status !== "invited") {
    return res.status(400).json({ error: "No tenes una invitacion pendiente para este proyecto." });
  }
  db.prepare("UPDATE project_members SET status = 'removed' WHERE id = ?").run(membership.id);
  res.json({ ok: true });
});

router.post("/:id/members/:userId/remove", loadProject, (req, res) => {
  if (!canManageProject(req.project, req)) {
    return res.status(403).json({ error: "Solo el administrador del proyecto puede quitar miembros." });
  }
  const targetUserId = Number(req.params.userId);
  if (targetUserId === req.project.owner_id) {
    return res.status(400).json({ error: "No se puede quitar al dueno del proyecto." });
  }
  const membership = getMembership(req.project.id, targetUserId);
  if (!membership) return res.status(404).json({ error: "Ese usuario no pertenece al proyecto." });
  // Se mantiene el registro en estado 'removed' para no romper la triangulacion de gastos historicos.
  db.prepare("UPDATE project_members SET status = 'removed' WHERE id = ?").run(membership.id);
  res.json({ ok: true });
});

module.exports = router;
