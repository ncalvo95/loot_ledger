const express = require("express");
const db = require("../db");
const { requireAuth } = require("../auth");
const { loadProject, requireProjectAccess } = require("../services/projectAccess");

const router = express.Router({ mergeParams: true });
router.use(requireAuth, loadProject, requireProjectAccess);

router.get("/", (req, res) => {
  const entities = db
    .prepare("SELECT * FROM entities WHERE project_id = ? ORDER BY name ASC")
    .all(req.project.id);
  res.json({ entities });
});

router.post("/", (req, res) => {
  const { name } = req.body || {};
  const trimmed = (name || "").trim();
  if (!trimmed) return res.status(400).json({ error: "El nombre de la entidad es obligatorio." });
  if (trimmed.length > 40) return res.status(400).json({ error: "El nombre de la entidad es demasiado largo." });

  const existing = db
    .prepare("SELECT * FROM entities WHERE project_id = ? AND name = ?")
    .get(req.project.id, trimmed);
  if (existing) return res.status(200).json({ entity: existing });

  const info = db
    .prepare("INSERT INTO entities (project_id, name) VALUES (?, ?)")
    .run(req.project.id, trimmed);
  const entity = db.prepare("SELECT * FROM entities WHERE id = ?").get(info.lastInsertRowid);
  res.status(201).json({ entity });
});

router.patch("/:entityId", (req, res) => {
  const entity = db
    .prepare("SELECT * FROM entities WHERE id = ? AND project_id = ?")
    .get(req.params.entityId, req.project.id);
  if (!entity) return res.status(404).json({ error: "Entidad no encontrada." });

  const trimmed = ((req.body || {}).name || "").trim();
  if (!trimmed) return res.status(400).json({ error: "El nombre de la entidad es obligatorio." });
  if (trimmed.length > 40) return res.status(400).json({ error: "El nombre de la entidad es demasiado largo." });

  const clash = db
    .prepare("SELECT * FROM entities WHERE project_id = ? AND name = ? AND id != ?")
    .get(req.project.id, trimmed, entity.id);
  if (clash) return res.status(409).json({ error: "Ya existe una entidad con ese nombre." });

  db.prepare("UPDATE entities SET name = ? WHERE id = ?").run(trimmed, entity.id);
  const updated = db.prepare("SELECT * FROM entities WHERE id = ?").get(entity.id);
  res.json({ entity: updated });
});

router.delete("/:entityId", (req, res) => {
  const entity = db
    .prepare("SELECT * FROM entities WHERE id = ? AND project_id = ?")
    .get(req.params.entityId, req.project.id);
  if (!entity) return res.status(404).json({ error: "Entidad no encontrada." });

  const inUse = db.prepare("SELECT COUNT(*) AS n FROM expenses WHERE entity_id = ?").get(entity.id).n;
  if (inUse > 0) {
    return res.status(400).json({
      error: "No se puede eliminar: hay gastos que usan esta entidad. Reasigná esos gastos primero.",
    });
  }

  db.prepare("DELETE FROM entities WHERE id = ?").run(entity.id);
  res.json({ ok: true });
});

module.exports = router;
