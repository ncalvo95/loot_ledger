# Build del frontend (React + Vite)
FROM node:20-bookworm-slim AS client-build
WORKDIR /app/client
COPY client/package.json client/package-lock.json* ./
RUN npm install
COPY client/ ./
RUN npm run build

# Instalacion de dependencias del backend (compila better-sqlite3 para la arquitectura destino).
# Se incluyen herramientas de build por si no hay binario prebuilt para el arch/version de Node exactos.
FROM node:20-bookworm-slim AS server-deps
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app/server
COPY server/package.json server/package-lock.json* ./
RUN npm install --omit=dev

# Imagen final: un unico proceso Node sirviendo API + estaticos (liviano para Raspberry Pi 3B)
FROM node:20-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app

COPY --from=server-deps /app/server/node_modules ./server/node_modules
COPY server/ ./server/
COPY --from=client-build /app/client/dist ./client/dist

RUN mkdir -p /app/server/data
VOLUME ["/app/server/data"]

EXPOSE 3000
WORKDIR /app/server
CMD ["node", "src/index.js"]
