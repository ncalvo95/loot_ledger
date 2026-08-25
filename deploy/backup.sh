#!/usr/bin/env bash
# Empaqueta los datos de Loot Ledger (usuarios, proyectos, gastos) en un
# .tar.gz, sin necesidad de conocer el nombre físico del volumen de Docker
# ni bajar la app. Uso:
#
#   ./deploy/backup.sh [carpeta-destino]
#
# Por defecto guarda en ./backups dentro del repo.

set -euo pipefail
cd "$(dirname "$0")/.."

BACKUP_DIR="$(realpath "${1:-./backups}")"
mkdir -p "$BACKUP_DIR"

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
FILENAME="loot-ledger-backup-${TIMESTAMP}.tar.gz"

echo "Empaquetando datos de Loot Ledger..."
docker compose run --rm --no-deps \
  -v "$BACKUP_DIR:/backup" \
  loot-ledger \
  sh -c "tar czf /backup/${FILENAME} -C /app/server/data ."

echo "Listo: ${BACKUP_DIR}/${FILENAME}"
echo "Guarda este archivo en otro lugar (no solo en la misma Pi/SSD)."
