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
const entitiesRoutes = require("./routes/entities.routes");
const expensesRoutes = require("./routes/expenses.routes");
const balancesRoutes = require("./routes/balances.routes");
const treasuryRoutes = require("./routes/treasury.routes");
const exportRoutes = require("./routes/export.routes");
const questsRoutes = require("./routes/quests.routes");
const { MOUNT_PATH } = require("./base-path");

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

// Todo (API + estáticos) cuelga de un router montado en MOUNT_PATH, para
// poder convivir con otro sitio bajo el mismo dominio (ver base-path.js). En
// un deploy normal MOUNT_PATH es "/" y esto se comporta exactamente igual
// que antes.
const router = express.Router();

router.use("/api/auth", authRoutes);
router.use("/api/admin", adminRoutes);
router.use("/api/projects", projectsRoutes);
router.use("/api/projects/:id/categories", categoriesRoutes);
router.use("/api/projects/:id/entities", entitiesRoutes);
router.use("/api/projects/:id/expenses", expensesRoutes);
router.use("/api/projects/:id/balances", balancesRoutes);
router.use("/api/projects/:id/treasury", treasuryRoutes);
router.use("/api/projects/:id/export", exportRoutes);
router.use("/api/quests", questsRoutes);

router.get("/api/health", (req, res) => res.json({ ok: true }));

// Cambia cada vez que se reinicia el proceso (o sea, en cada "docker compose
// up -d --build"). El frontend lo compara contra el valor que tenía al
// cargar la página para avisar si alguien la dejó abierta de fondo mientras
// se desplegaba una versión nueva.
const BOOT_ID = String(Date.now());
router.get("/api/version", (req, res) => res.json({ version: BOOT_ID }));

const clientDist = path.join(__dirname, "..", "..", "client", "dist");
if (fs.existsSync(clientDist)) {
  router.use(express.static(clientDist));
  router.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

app.use(MOUNT_PATH, router);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Error interno del servidor." });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Loot Ledger escuchando en http://localhost:${PORT}`);
});
