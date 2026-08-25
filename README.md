# Loot Ledger

Aplicación web de triangulación de gastos entre grupos (al estilo Tricount / Splitwise), con estética gamer, pensada para vivir en una Raspberry Pi 3B como servidor doméstico.

## Stack técnico (elegido pensando en la RPi 3B)

La RPi 3B tiene solo 1 GB de RAM y una CPU modesta, así que se prioriza consumo bajo:

- **Backend**: Node.js + Express + SQLite (`better-sqlite3`, síncrono y muy liviano, sin proceso de base de datos separado).
- **Frontend**: React + Vite, compilado a estáticos y **servido por el mismo proceso Node** (sin Nginx aparte, un solo proceso corriendo).
- **Autenticación**: JWT en cookie httpOnly + `bcryptjs`.
- **Exportación**: `exceljs`, genera `.xlsx` reales con tablas de Excel (no solo celdas sueltas).

> Nota sobre monedas: se usan los códigos ISO 4217 válidos `EUR`, `USD` y `ARS` (el peso argentino es `ARS`, no `ARG`).

## Estructura del repo

```
server/   API + base de datos SQLite
client/   Frontend React (Vite)
deploy/   Servicio systemd + scripts de backup/restore
docs/     Guias adicionales (SSD, dominio propio, acceso remoto)
Dockerfile, docker-compose.yml
```

> Para instalar en un SSD por USB (recomendado para uso 24/7) y exponer la
> app en internet con tu propio dominio (ej. `www.loot-ledger.io`) sin abrir
> puertos en el router, ver
> [`docs/deploy-ssd-domain.md`](docs/deploy-ssd-domain.md).

## Usuario administrador por defecto

- Usuario: `administrator`
- Contraseña: `11223344` (se puede sobreescribir con la variable `ADMIN_DEFAULT_PASSWORD` **antes del primer arranque**, ya que solo se usa para crear la cuenta la primera vez)

**Importante**: cambia esta contraseña apenas despliegues, desde el Panel de administración (reseteo de contraseña) con la cuenta `administrator`.

## Opción A: Docker (recomendado)

Requiere Docker y Docker Compose en la Raspberry Pi.

> La Raspberry Pi 3B soporta 64 bits. Se recomienda usar **Raspberry Pi OS de 64 bits (arm64)** para tener la mejor disponibilidad de imágenes oficiales de Node. Si tu SO es de 32 bits (armv7/armhf), el build de Docker igual debería funcionar porque compila la imagen localmente en el dispositivo, pero puede ser más lento.

```bash
git clone <este-repo> loot_ledger
cd loot_ledger

# opcional: definir secretos propios
export JWT_SECRET="una-clave-larga-y-aleatoria"
export ADMIN_DEFAULT_PASSWORD="11223344"

docker compose up -d --build
```

La app queda disponible en `http://<ip-de-la-raspberry>:3000`.

Los datos (base SQLite) quedan en el volumen `loot_ledger_data`, persistente entre reinicios y actualizaciones.

Para actualizar tras bajar cambios nuevos:

```bash
git pull
docker compose up -d --build
```

## Opción B: instalación manual + systemd

1. Instalar Node.js 20 LTS en la Raspberry (por ejemplo con `nvm` o el paquete oficial para ARM).
2. Clonar el repo y construir el frontend:

```bash
git clone <este-repo> loot_ledger
cd loot_ledger/client
npm install
npm run build

cd ../server
npm install --omit=dev
cp .env.example .env
# editar .env: JWT_SECRET, ADMIN_DEFAULT_PASSWORD, PORT, DB_PATH
```

3. Probar en primer plano:

```bash
node src/index.js
```

4. Instalar como servicio systemd (arranca solo al bootear la Pi):

```bash
sudo cp ../deploy/loot-ledger.service /etc/systemd/system/loot-ledger.service
sudo systemctl daemon-reload
sudo systemctl enable --now loot-ledger
sudo systemctl status loot-ledger
```

Ajusta `User=` y las rutas dentro de `loot-ledger.service` si tu usuario o carpeta de instalación son distintos de `pi` / `/home/pi/loot_ledger`.

## Variables de entorno (`server/.env`)

| Variable | Descripción | Default |
|---|---|---|
| `PORT` | Puerto HTTP | `3000` |
| `JWT_SECRET` | Clave para firmar las sesiones (cambiarla en producción) | - |
| `ADMIN_DEFAULT_PASSWORD` | Contraseña inicial de `administrator` (solo aplica en la primera creación) | `11223344` |
| `DB_PATH` | Ruta del archivo SQLite | `./data/loot-ledger.db` |
| `CORS_ORIGIN` | Solo necesario si el frontend se sirve desde otro origen | - |

## Modelo funcional

- **Usuarios**: alta con aprobación (usuario 4-10 caracteres, solo letras/números/`.`/`-`/`_`; contraseña 6-16 con las mismas reglas de caracteres). Toda cuenta nueva queda en estado "pendiente" hasta que el `administrator` global la aprueba o rechaza (individual o masivamente) desde el Panel — así se evita que se generen cuentas duplicadas sin control. El `administrator` también puede crear usuarios directamente (sin pasar por aprobación), resetearles la contraseña o renombrarlos (el nombre de usuario es solo un dato de display: internamente todo se referencia por id, así que renombrar no afecta gastos ni balances).
- **Contraseñas**: cada usuario puede cambiar su propia contraseña (pidiendo la actual). No puede cambiar su propio nombre de usuario — eso es exclusivo del `administrator`.
- **Olvidé mi contraseña**: el usuario puede pedir un restablecimiento desde el login; queda una solicitud visible para el `administrator` en el Panel, quien le define una contraseña nueva. Limitado a una solicitud cada 24hs por usuario para evitar spam.
- **Recordarme**: al iniciar sesión se puede tildar "mantener sesión iniciada" para que dure 30 días en vez de cerrarse al salir del navegador.
- **Proyectos y roles**: cualquier usuario puede crear un proyecto propio, quedando como su **Propietario**. El Propietario puede:
  - Agregar directamente a otro usuario existente, o darle visibilidad (invitarlo) quedando pendiente hasta que acepte desde su Dashboard.
  - Quitar miembros del proyecto.
  - Otorgar o quitar el rol de **Admin** del proyecto a otros miembros (los admins de proyecto tienen los mismos permisos de gestión que el Propietario).
  - Transferir la propiedad del proyecto **solo la puede hacer el `administrator` global**, que además ve todos los proyectos del servidor (aunque no sea miembro) y puede cambiar el rol de cualquier usuario en cualquier proyecto.
- **Bajas de usuario**: al eliminar un usuario (por el `administrator` global) o al quitarlo de un proyecto, sus gastos y su lugar en la triangulación **se conservan** (no rompe los balances). Si vuelve a registrarse con el mismo nombre de usuario, la cuenta se reactiva sobre el mismo registro (sin duplicados) y retoma todo su historial.
- **Ledger** (por proyecto): alta de gastos con categoría (existente o nueva; "Reembolso" viene creada por defecto para cancelar deudas entre usuarios), título, moneda + importe, quién pagó, fecha, y a quienes se les reparte el gasto (división igualitaria entre los seleccionados).
- **Loot** (por proyecto): balance neto de cada integrante por moneda, y el detalle simplificado de quién le debe a quién.
- **Pending Quests** (global, no por proyecto): cada usuario tiene su propia pestaña con la deuda total que tiene con cada otro jugador, sumada entre todos los proyectos que comparten (separada por moneda, ya que no se pueden mezclar) y discriminada línea por línea de qué proyecto aporta cuánto. Cada línea tiene un botón "Quest Complete" que crea automáticamente el gasto de "Reembolso" correspondiente en ese proyecto puntual, saldando esa deuda específica sin tener que ir manualmente al Ledger de cada proyecto.
- **Exportación a Excel**: desde el Ledger, botón para exportar el histórico completo, por mes o por año — genera un `.xlsx` con tablas de Excel (gastos, balances y deudas).
- **Idioma**: español / inglés, con un toggle en la barra superior (se guarda en el navegador de cada usuario).

## Backup y migración

Con Docker (recomendado, incluido en el repo):

```bash
./deploy/backup.sh                      # genera ./backups/loot-ledger-backup-*.tar.gz
./deploy/restore.sh ruta/al/archivo.tar.gz   # restaura (pide confirmación, reinicia el servicio)
```

Estos scripts no dependen de conocer el nombre físico del volumen de Docker
ni del nombre de la carpeta del proyecto, así que sirven igual para
respaldar como para migrar a otro disco o a otra Raspberry Pi — ver
[`docs/deploy-ssd-domain.md`](docs/deploy-ssd-domain.md) para el flujo
completo de migración.

Con instalación manual (sin Docker): copiar el archivo indicado en `DB_PATH` (por defecto `server/data/loot-ledger.db`, junto con sus archivos `-wal`/`-shm` si existen) con el servicio detenido, o usar `sqlite3 loot-ledger.db ".backup respaldo.db"` en caliente.
