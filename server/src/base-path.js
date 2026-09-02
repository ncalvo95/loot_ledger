// Prefijo bajo el que cuelga toda la app (API + estáticos) cuando convive con
// otro sitio en el mismo dominio, ej. BASE_PATH=/loot-ledger para
// www.castielo.io/loot-ledger. Vacío por defecto: la app sigue viviendo en la
// raíz del dominio, como hasta ahora (DuckDNS, IP local, etc.) — no rompe
// ningún deploy existente que no defina esta variable.
const raw = (process.env.BASE_PATH || "").trim();
const BASE_PATH = raw ? "/" + raw.replace(/^\/+|\/+$/g, "") : "";

module.exports = { BASE_PATH, MOUNT_PATH: BASE_PATH || "/" };
