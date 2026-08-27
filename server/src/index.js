require("dotenv").config();
const path = require("path");
const fs = require("fs");
const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");

require("./db"); // inicializa la base de datos y crea el usuario administrator por defecto

const authRoutes = require("./routes/auth.routes");
const adminRoutes = require("./routes/admin.routes");
const projectsRoutes = require("./routes/projects.routes");
const categoriesRoutes = require("./routes/categories.routes");
const expensesRoutes = require("./routes/expenses.routes");
const balancesRoutes = require("./routes/balances.routes");
const exportRoutes = require("./routes/export.routes");
const questsRoutes = require("./routes/quests.routes");

const app = express();
app.disable("x-powered-by");
// Necesario para que req.secure refleje la conexión real del cliente (HTTP
// directo por IP vs HTTPS a través de Caddy), leyendo X-Forwarded-Proto en
// vez de mirar la conexión interna Caddy->Node (que siempre es HTTP plano).
app.set("trust proxy", true);
app.use(express.json());
app.use(cookieParser());

if (process.env.CORS_ORIGIN) {
  app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }));
}

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/projects", projectsRoutes);
app.use("/api/projects/:id/categories", categoriesRoutes);
app.use("/api/projects/:id/expenses", expensesRoutes);
app.use("/api/projects/:id/balances", balancesRoutes);
app.use("/api/projects/:id/export", exportRoutes);
app.use("/api/quests", questsRoutes);

app.get("/api/health", (req, res) => res.json({ ok: true }));

const clientDist = path.join(__dirname, "..", "..", "client", "dist");
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Error interno del servidor." });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Loot Ledger escuchando en http://localhost:${PORT}`);
});
