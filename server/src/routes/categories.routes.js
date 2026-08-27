const express = require("express");
const db = require("../db");
const { requireAuth } = require("../auth");
const { loadProject, requireProjectAccess } = require("../services/projectAccess");

const router = express.Router({ mergeParams: true });
router.use(requireAuth, loadProject, requireProjectAccess);

router.get("/", (req, res) => {
  const categories = db
    .prepare("SELECT * FROM categories WHERE project_id = ? ORDER BY is_default DESC, name ASC")
    .all(req.project.id);
  res.json({ categories });
});

router.post("/", (req, res) => {
  const { name } = req.body || {};
  const trimmed = (name || "").trim();
  if (!trimmed) return res.status(400).json({ error: "El nombre de la categoría es obligatorio." });
  if (trimmed.length > 40) return res.status(400).json({ error: "El nombre de la categoría es demasiado largo." });

  const existing = db
    .prepare("SELECT * FROM categories WHERE project_id = ? AND name = ?")
    .get(req.project.id, trimmed);
  if (existing) return res.status(200).json({ category: existing });

  const info = db
    .prepare("INSERT INTO categories (project_id, name, is_default) VALUES (?, ?, 0)")
    .run(req.project.id, trimmed);
  const category = db.prepare("SELECT * FROM categories WHERE id = ?").get(info.lastInsertRowid);
  res.status(201).json({ category });
});

router.patch("/:categoryId", (req, res) => {
  const category = db
    .prepare("SELECT * FROM categories WHERE id = ? AND project_id = ?")
    .get(req.params.categoryId, req.project.id);
  if (!category) return res.status(404).json({ error: "Categoría no encontrada." });
  if (category.is_default) {
    return res.status(400).json({ error: "No se puede renombrar la categoría 'Reembolso'." });
  }

  const trimmed = ((req.body || {}).name || "").trim();
  if (!trimmed) return res.status(400).json({ error: "El nombre de la categoría es obligatorio." });
  if (trimmed.length > 40) return res.status(400).json({ error: "El nombre de la categoría es demasiado largo." });

  const clash = db
    .prepare("SELECT * FROM categories WHERE project_id = ? AND name = ? AND id != ?")
    .get(req.project.id, trimmed, category.id);
  if (clash) return res.status(409).json({ error: "Ya existe una categoría con ese nombre." });

  db.prepare("UPDATE categories SET name = ? WHERE id = ?").run(trimmed, category.id);
  const updated = db.prepare("SELECT * FROM categories WHERE id = ?").get(category.id);
  res.json({ category: updated });
});

router.delete("/:categoryId", (req, res) => {
  const category = db
    .prepare("SELECT * FROM categories WHERE id = ? AND project_id = ?")
    .get(req.params.categoryId, req.project.id);
  if (!category) return res.status(404).json({ error: "Categoría no encontrada." });
  if (category.is_default) {
    return res.status(400).json({ error: "No se puede eliminar la categoría 'Reembolso'." });
  }

  const inUse = db.prepare("SELECT COUNT(*) AS n FROM expenses WHERE category_id = ?").get(category.id).n;
  if (inUse > 0) {
    return res.status(400).json({
      error: "No se puede eliminar: hay gastos que usan esta categoría. Reasigná esos gastos primero.",
    });
  }

  db.prepare("DELETE FROM categories WHERE id = ?").run(category.id);
  res.json({ ok: true });
});

module.exports = router;
