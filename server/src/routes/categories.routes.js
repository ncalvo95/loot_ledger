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

module.exports = router;
