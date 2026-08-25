#!/usr/bin/env bash
# Restaura un backup generado por backup.sh, reemplazando los datos actuales
# (usuarios, proyectos, gastos). Detiene el servicio mientras restaura, para
# no pisar archivos que el proceso tenga abiertos. Uso:
#
#   ./deploy/restore.sh ruta/al/loot-ledger-backup-XXXXXXXX.tar.gz

set -euo pipefail
cd "$(dirname "$0")/.."

if [ -z "${1:-}" ]; then
  echo "Uso: ./deploy/restore.sh <archivo-backup.tar.gz>"
  exit 1
fi

BACKUP_FILE="$(realpath "$1")"
if [ ! -f "$BACKUP_FILE" ]; then
  echo "No se encontró el archivo: $BACKUP_FILE"
  exit 1
fi
BACKUP_DIR="$(dirname "$BACKUP_FILE")"
BACKUP_NAME="$(basename "$BACKUP_FILE")"

echo "Esto va a REEMPLAZAR los datos actuales (usuarios, proyectos, gastos)"
echo "por los del backup: $BACKUP_NAME"
read -r -p "Escribí 'si' para confirmar: " CONFIRM
if [ "$CONFIRM" != "si" ]; then
  echo "Cancelado."
  exit 1
fi

echo "Deteniendo el servicio..."
docker compose stop loot-ledger

echo "Restaurando datos..."
docker compose run --rm --no-deps \
  -v "$BACKUP_DIR:/backup" \
  loot-ledger \
  sh -c "rm -rf /app/server/data/* && tar xzf /backup/${BACKUP_NAME} -C /app/server/data"

echo "Reiniciando el servicio..."
docker compose up -d

echo "Listo. Datos restaurados desde $BACKUP_NAME"
