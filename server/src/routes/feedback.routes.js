const express = require("express");
const db = require("../db");
const { requireAuth } = require("../auth");

const router = express.Router();
router.use(requireAuth);

const CATEGORIES = ["bug", "feature", "other"];
const MAX_MESSAGE_LENGTH = 2000;

// Cualquier usuario logueado puede mandar un reporte de bug, un pedido de
// funcionalidad, o un comentario suelto -- llega al administrator, que lo
// revisa desde su Panel. No hay un límite de envíos: si alguien manda
// varios, es al administrator a quien le toca priorizar.
router.post("/", (req, res) => {
  const { category, message } = req.body || {};
  const trimmed = (message || "").trim();
  if (!trimmed) return res.status(400).json({ error: "El mensaje es obligatorio." });
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    return res.status(400).json({ error: `El mensaje es demasiado largo (máximo ${MAX_MESSAGE_LENGTH} caracteres).` });
  }
  const cat = CATEGORIES.includes(category) ? category : "other";

  db.prepare("INSERT INTO feedback (user_id, category, message) VALUES (?, ?, ?)").run(
    req.user.id,
    cat,
    trimmed
  );
  res.status(201).json({ ok: true });
});

module.exports = router;
