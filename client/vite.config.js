import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// BASE_PATH permite que el build cuelgue de un subpath (ej. "/loot-ledger"
// para www.castielo.io/loot-ledger) en vez de la raíz del dominio. Vacío por
// defecto: mismo comportamiento de siempre. Tiene que coincidir con el
// BASE_PATH que lee el server (server/src/base-path.js) -- una sola variable
// en el .env de la raíz del repo controla ambos lados.
const rawBase = (process.env.BASE_PATH || "").trim();
const base = rawBase ? `/${rawBase.replace(/^\/+|\/+$/g, "")}/` : "/";

export default defineConfig({
  base,
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
  },
});
