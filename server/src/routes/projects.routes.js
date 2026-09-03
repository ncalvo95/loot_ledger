const express = require("express");
const db = require("../db");
const { requireAuth } = require("../auth");
const {
  getMembership,
  getMemberRole,
  isProjectOwner,
  canManageProject,
  loadProject,
  requireProjectAccess,
} = require("../services/projectAccess");

const router = express.Router();
router.use(requireAuth);

router.get("/", (req, res) => {
  const userId = req.user.id;

  // El administrador global ve todos los proyectos del servidor, sea o no miembro.
  const active =
    req.user.role === "admin"
      ? db
          .prepare(
            `SELECT p.*, u.username AS owner_username,
              (SELECT COUNT(*) FROM project_members pm2 WHERE pm2.project_id = p.id AND pm2.status = 'member') AS member_count,
              EXISTS(
                SELECT 1 FROM project_members pm3
                WHERE pm3.project_id = p.id AND pm3.user_id = ? AND pm3.status = 'member'
              ) AS is_member
             FROM projects p
             JOIN users u ON u.id = p.owner_id
             ORDER BY p.created_at DESC`
          )
          .all(userId)
      : db
          .prepare(
            `SELECT p.*, u.username AS owner_username,
              (SELECT COUNT(*) FROM project_members pm2 WHERE pm2.project_id = p.id AND pm2.status = 'member') AS member_count,
              1 AS is_member
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
  const { name, emoji, type } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: "El nombre del proyecto es obligatorio." });
  const trimmedEmoji = (emoji || "").trim() || null;
  const projectType = type === "individual" ? "individual" : "shared";

  const insertProject = db.transaction(() => {
    const info = db
      .prepare("INSERT INTO projects (name, emoji, type, owner_id) VALUES (?, ?, ?, ?)")
      .run(name.trim(), trimmedEmoji, projectType, req.user.id);
    const projectId = info.lastInsertRowid;
    db.prepare(
      "INSERT INTO project_members (project_id, user_id, status, role, added_by) VALUES (?, ?, 'member', 'owner', ?)"
    ).run(projectId, req.user.id, req.user.id);
    return projectId;
  });

  const projectId = insertProject();
  const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(projectId);
  res.status(201).json({ project });
});

router.get("/:id", loadProject, requireProjectAccess, (req, res) => {
  const members = db
    .prepare(
      `SELECT pm.user_id, pm.status, pm.role, u.username, u.status AS account_status
       FROM project_members pm
       JOIN users u ON u.id = pm.user_id
       WHERE pm.project_id = ?
       ORDER BY pm.status ASC, u.username ASC`
    )
    .all(req.project.id);
  const categories = db
    .prepare("SELECT * FROM categories WHERE project_id = ? ORDER BY name ASC")
    .all(req.project.id);
  const entities = db.prepare("SELECT * FROM entities WHERE project_id = ? ORDER BY name ASC").all(req.project.id);
  const myRole = getMemberRole(req.project.id, req.user.id);
  res.json({
    project: req.project,
    members,
    categories,
    entities,
    isOwner: isProjectOwner(req.project, req.user.id) || req.user.role === "admin",
    canManage: canManageProject(req.project, req),
    myRole,
    isGlobalAdmin: req.user.role === "admin",
  });
});

// Clona un proyecto individual como uno nuevo, grupal: copia categorías y
// entidades siempre, y gastos solo si se pide -- en ese caso quedan todos
// con el mismo "pagado por" (el único miembro que tenía el individual, que
// sigue siendo el dueño del clon) hasta que alguien los reasigne a mano.
router.post("/:id/clone", loadProject, requireProjectAccess, (req, res) => {
  if (req.project.type !== "individual") {
    return res.status(400).json({ error: "Solo se pueden clonar proyectos individuales." });
  }
  if (!canManageProject(req.project, req)) {
    return res.status(403).json({ error: "No podés clonar este proyecto." });
  }
  const withExpenses = !!(req.body || {}).withExpenses;

  const clone = db.transaction(() => {
    const info = db
      .prepare("INSERT INTO projects (name, emoji, type, owner_id) VALUES (?, ?, 'shared', ?)")
      .run(req.project.name, req.project.emoji, req.project.owner_id);
    const newProjectId = info.lastInsertRowid;
    db.prepare(
      "INSERT INTO project_members (project_id, user_id, status, role, added_by) VALUES (?, ?, 'member', 'owner', ?)"
    ).run(newProjectId, req.project.owner_id, req.user.id);

    const categoryMap = new Map();
    for (const c of db.prepare("SELECT * FROM categories WHERE project_id = ?").all(req.project.id)) {
      const r = db.prepare("INSERT INTO categories (project_id, name) VALUES (?, ?)").run(newProjectId, c.name);
      categoryMap.set(c.id, r.lastInsertRowid);
    }
    const entityMap = new Map();
    for (const e of db.prepare("SELECT * FROM entities WHERE project_id = ?").all(req.project.id)) {
      const r = db.prepare("INSERT INTO entities (project_id, name) VALUES (?, ?)").run(newProjectId, e.name);
      entityMap.set(e.id, r.lastInsertRowid);
    }

    if (withExpenses) {
      const insertExpense = db.prepare(
        `INSERT INTO expenses (project_id, category_id, entity_id, title, currency, amount_cents, paid_by, expense_date, created_by, is_reimbursement)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      const insertSplit = db.prepare(
        "INSERT INTO expense_splits (expense_id, user_id, share_cents) VALUES (?, ?, ?)"
      );
      for (const e of db.prepare("SELECT * FROM expenses WHERE project_id = ?").all(req.project.id)) {
        const newCategoryId = e.category_id ? categoryMap.get(e.category_id) || null : null;
        const newEntityId = e.entity_id ? entityMap.get(e.entity_id) || null : null;
        const r = insertExpense.run(
          newProjectId, newCategoryId, newEntityId, e.title, e.currency, e.amount_cents,
          e.paid_by, e.expense_date, req.user.id, e.is_reimbursement
        );
        const newExpenseId = r.lastInsertRowid;
        for (const s of db.prepare("SELECT * FROM expense_splits WHERE expense_id = ?").all(e.id)) {
          insertSplit.run(newExpenseId, s.user_id, s.share_cents);
        }
      }
    }
    return newProjectId;
  });

  const newProjectId = clone();
  const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(newProjectId);
  res.status(201).json({ project });
});

router.post("/:id/members", loadProject, (req, res) => {
  if (!canManageProject(req.project, req)) {
    return res.status(403).json({ error: "Solo el administrador del proyecto puede agregar miembros." });
  }
  if (req.project.type === "individual") {
    return res.status(400).json({ error: "Los proyectos individuales no admiten invitar a otros jugadores." });
  }
  const { username } = req.body || {};
  if (!username) return res.status(400).json({ error: "Indicá el nombre de usuario." });
  // Todo ingreso a un proyecto pasa siempre por invitación: la otra persona
  // tiene que aceptarla desde su Dashboard antes de quedar como miembro.
  const targetStatus = "invited";

  const user = db.prepare("SELECT * FROM users WHERE username = ? AND status = 'active'").get(username);
  if (!user) return res.status(404).json({ error: "No existe un usuario activo con ese nombre." });

  const existing = getMembership(req.project.id, user.id);
  if (existing) {
    if (existing.status === "member") {
      return res.status(409).json({ error: "Ese usuario ya es miembro del proyecto." });
    }
    // Si volvía a sumarse alguien que tenía el rol 'owner' de una etapa anterior
    // pero ya no es el dueño actual del proyecto (projects.owner_id cambió
    // mientras estaba afuera), lo bajamos a 'admin' para no tener dos owners.
    const role = existing.role === "owner" && user.id !== req.project.owner_id ? "admin" : existing.role;
    db.prepare(
      "UPDATE project_members SET status = ?, role = ?, added_by = ?, joined_at = datetime('now') WHERE id = ?"
    ).run(targetStatus, role, req.user.id, existing.id);
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
    return res.status(400).json({ error: "No tenés una invitación pendiente para este proyecto." });
  }
  db.prepare("UPDATE project_members SET status = 'member' WHERE id = ?").run(membership.id);
  res.json({ ok: true });
});

router.post("/:id/decline", loadProject, (req, res) => {
  const membership = getMembership(req.project.id, req.user.id);
  if (!membership || membership.status !== "invited") {
    return res.status(400).json({ error: "No tenés una invitación pendiente para este proyecto." });
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
    return res.status(400).json({ error: "No se puede quitar al dueño del proyecto." });
  }
  const membership = getMembership(req.project.id, targetUserId);
  if (!membership) return res.status(404).json({ error: "Ese usuario no pertenece al proyecto." });
  // Se mantiene el registro en estado 'removed' para no romper la triangulación de gastos históricos.
  db.prepare("UPDATE project_members SET status = 'removed' WHERE id = ?").run(membership.id);
  res.json({ ok: true });
});

router.post("/:id/members/:userId/role", loadProject, (req, res) => {
  const { role } = req.body || {};
  if (!["owner", "admin", "member"].includes(role)) {
    return res.status(400).json({ error: "Rol inválido." });
  }

  const targetUserId = Number(req.params.userId);
  const membership = getMembership(req.project.id, targetUserId);
  if (!membership || membership.status === "removed") {
    return res.status(404).json({ error: "Ese usuario no pertenece al proyecto." });
  }

  const requesterIsGlobalAdmin = req.user.role === "admin";
  const requesterRole = getMemberRole(req.project.id, req.user.id);
  const requesterIsOwner = requesterRole === "owner";

  if (role === "owner") {
    // Transferir la propiedad del proyecto: solo el administrador global puede hacerlo.
    if (!requesterIsGlobalAdmin) {
      return res.status(403).json({ error: "Solo el administrador global puede transferir la propiedad del proyecto." });
    }
    if (targetUserId === req.project.owner_id) {
      return res.json({ ok: true });
    }
    const transfer = db.transaction(() => {
      db.prepare("UPDATE project_members SET role = 'admin' WHERE project_id = ? AND role = 'owner'").run(
        req.project.id
      );
      db.prepare("UPDATE project_members SET role = 'owner' WHERE id = ?").run(membership.id);
      db.prepare("UPDATE projects SET owner_id = ? WHERE id = ?").run(targetUserId, req.project.id);
    });
    transfer();
    return res.json({ ok: true });
  }

  // role === 'admin' | 'member': otorgar o quitar permisos de administrador del proyecto.
  if (!requesterIsGlobalAdmin && !requesterIsOwner) {
    return res.status(403).json({ error: "Solo el propietario del proyecto puede cambiar permisos de administrador." });
  }
  if (membership.role === "owner") {
    return res.status(400).json({
      error: "No se puede quitarle el rol al propietario sin transferir la propiedad primero.",
    });
  }

  db.prepare("UPDATE project_members SET role = ? WHERE id = ?").run(role, membership.id);
  res.json({ ok: true });
});

module.exports = router;
