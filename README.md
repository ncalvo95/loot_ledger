# Loot Ledger

[🇪🇸 Español](#español) | [🇬🇧 English](#english)

---

## Español

Aplicación web de triangulación de gastos entre grupos (al estilo Tricount / Splitwise), con estética gamer (y un modo "Simple" más formal, sin neón, para quien lo prefiera).

### Por qué está pensada tan liviana

Así es como corre en producción hoy: la app vive en una **Raspberry Pi 3B** (1 GB RAM), compartiendo el mismo equipo con una web portfolio y otra aplicación del mismo estilo, cada una en su propio **contenedor Docker**, detrás de un único reverse proxy. Cada dependencia pesada se nota, así que el criterio en cada decisión técnica fue el mismo: SQLite en vez de un motor de base de datos aparte, un solo proceso Node sirviendo API y frontend, sin Redis ni ningún contenedor de soporte extra.

### Stack técnico

- **Backend**: Node.js + Express + SQLite (`better-sqlite3`, síncrono y muy liviano, sin proceso de base de datos separado).
- **Frontend**: React + Vite + Tailwind CSS, compilado a estáticos y **servido por el mismo proceso Node** (sin Nginx aparte, un solo proceso corriendo).
- **Autenticación**: sesiones con token opaco (no JWT) en cookie httpOnly, hasheadas en la base con SHA-256, más `bcryptjs` para las contraseñas.
- **Exportación**: `exceljs`, genera `.xlsx` reales con tablas de Excel (no solo celdas sueltas).
- **PWA**: instalable en el celular o la compu (manifest + service worker mínimo), con aviso propio cuando hay una versión nueva del servidor.

> Nota sobre monedas: se usan los códigos ISO 4217 válidos `EUR`, `USD` y `ARS`.

### Estructura del repo

```
server/   API + base de datos SQLite
client/   Frontend React (Vite)
deploy/   Servicio systemd + scripts de backup/restore
docs/     Guías adicionales (SSD, dominio propio, acceso remoto)
Dockerfile, docker-compose.yml
```

> Para instalar en un SSD por USB (recomendado para uso 24/7), para el
> acceso remoto (DuckDNS en un principio, luego se adiquiro dominion Cloudflare) y para hacer convivir esta
> app con otro sitio en el mismo dominio (subdominio o subpath, con la
> misma instancia de Caddy) — ver
> [`docs/deploy-ssd-domain.md`](docs/deploy-ssd-domain.md).

### Usuario administrador por defecto

- Usuario: `administrator`
- Contraseña: `1234` (se puede sobreescribir con la variable `ADMIN_DEFAULT_PASSWORD` **antes del primer arranque**, ya que solo se usa para crear la cuenta la primera vez)

**Importante**: si no seteaste una password diferente que la default, cambiá esta contraseña apenas despliegues, desde el Panel de administración (reseteo de contraseña) con la cuenta `administrator`.

### Opción A: Docker (recomendado)

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

### Opción B: instalación manual + systemd

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

Ajustá `User=` y las rutas dentro de `loot-ledger.service` si tu usuario o carpeta de instalación son distintos de `pi` / `/home/pi/loot_ledger`.

### Variables de entorno (`server/.env`)

| Variable | Descripción | Default |
|---|---|---|
| `PORT` | Puerto HTTP | `3000` |
| `JWT_SECRET` | Clave para firmar las sesiones (cambiarla en producción) | - |
| `ADMIN_DEFAULT_PASSWORD` | Contraseña inicial de `administrator` (solo aplica en la primera creación) | `11223344` |
| `DB_PATH` | Ruta del archivo SQLite | `./data/loot-ledger.db` |
| `CORS_ORIGIN` | Solo necesario si el frontend se sirve desde otro origen | - |

### Modelo funcional

- **Usuarios**: servidor por invitación — un usuario nuevo necesita un código de invitación (generado por el `administrator`, o autogenerado si crea un proyecto e invita a alguien todavía sin cuenta). Toda cuenta nueva queda "pendiente" hasta que el `administrator` la aprueba o rechaza (individual o masivamente) desde el Panel. El `administrator` también puede crear usuarios directamente, resetearles la contraseña o renombrarlos (el nombre es solo un dato de display: todo se referencia por id internamente, así que renombrar no afecta gastos ni balances).
- **Contraseñas**: cada usuario cambia la propia pidiendo la actual; no puede cambiar su propio nombre de usuario (exclusivo del `administrator`). "Olvidé mi contraseña" desde el login genera una solicitud que el `administrator` resuelve manualmente (sin envío de mails), limitada a una cada 24hs por usuario.
- **Sesiones**: "Recordarme" al loguear extiende la sesión a 30 días (si no, dura 1 día o hasta cerrar el navegador). Cada usuario puede ver todos sus dispositivos conectados, ponerles un nombre, y cerrar sesión en cualquiera de ellos a distancia (o en todos menos el actual).
- **Proyectos y roles**: cualquier usuario crea sus propios proyectos, quedando como Propietario. El Propietario (o un Admin del proyecto, mismos permisos) puede sumar o quitar miembros, e invitar gente sin cuenta todavía. Solo el `administrator` global puede transferir la propiedad de un proyecto, y ve/administra todos los proyectos del servidor aunque no sea miembro.
- **Bajas de usuario**: al eliminar una cuenta o sacarla de un proyecto, sus gastos y su lugar en la triangulación se conservan intactos. Si vuelve a registrarse con el mismo usuario, retoma el mismo historial (sin duplicar cuentas).
- **Ledger** (por proyecto): alta de gastos con categoría y entidad (ambas creables al vuelo, desde el propio formulario o desde su ventana de gestión dedicada), título, moneda + importe, quién pagó (por defecto, quien está cargando el gasto) y a quién se reparte. Se puede pagar directo desde el Fondo común del proyecto en vez de entre personas, y cargar gastos en cuotas. La lista se ve como una tabla con las etiquetas de categoría/entidad funcionando como filtro con un clic, y tocar cualquier gasto abre su detalle completo con las opciones de editar o borrar.
- **Fondo común** (por proyecto grupal): una caja compartida — todos aportan, y de ahí se pagan gastos fijos sin repartirlos persona por persona.
- **Recurrentes**: reglas de gasto o aporte al Fondo común que se repiten todos los meses en un día fijo, con soporte para pagos en cuotas.
- **Loot** (por proyecto): balance neto de cada integrante por moneda, y el detalle simplificado de quién le debe a quién.
- **Pending Quests** (global, no por proyecto): la deuda total que cada usuario tiene con cada otro jugador, sumada entre todos los proyectos que comparten y discriminada línea por línea. Un botón "Quest Complete" salda esa deuda puntual sin ir manualmente al Ledger de cada proyecto.
- **Exportación a Excel**: histórico completo, por mes o por año, con tablas de Excel reales (gastos, balances y deudas).
- **Estética Gamer / Simple**: toggle que cambia toda la interfaz entre la piel neón original y una versión formal, sin jerga ni efectos, para quien prefiera algo más "vainilla".
- **Modo claro / oscuro**: independiente del anterior, se puede combinar con cualquiera de las dos estéticas.
- **Ayuda contextual opcional**: un toggle que muestra u oculta textos explicando conceptos como el Fondo común, para quien recién empieza.
- **Instalable como app**: en el celular o la compu, con ícono propio y funcionando a pantalla completa (PWA), y un aviso cuando hay una versión nueva del servidor.
- **Idioma**: español / inglés, con un toggle en la barra superior (se guarda en el navegador de cada usuario).

### Backup y migración

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

---

## English

A web app for splitting group expenses (Tricount / Splitwise style), with a gamer-themed skin (plus a formal "Simple" look with no neon, for anyone who prefers it).

### Why it's built this lightweight

This isn't a theoretical precaution — it's how the app actually runs today: it lives on a **Raspberry Pi 3B** (1 GB of RAM), sharing the same box with a portfolio website and another app of the same kind, each in its own **Docker container**, behind a single reverse proxy. With three apps splitting 1 GB of RAM, every heavy dependency shows up on the bill, so the same rule applied to every technical choice: SQLite instead of a separate database engine, one Node process serving both the API and the static frontend, no Redis, no extra container just for support services. None of this is a limitation of the project — it's simply running comfortably, with room to spare, on the actual hardware it lives on.

### Tech stack

- **Backend**: Node.js + Express + SQLite (`better-sqlite3`, synchronous and very lightweight, no separate database process).
- **Frontend**: React + Vite + Tailwind CSS, built to static files and **served by the same Node process** (no separate Nginx, a single process running).
- **Auth**: opaque-token sessions (not JWT) in an httpOnly cookie, hashed in the database with SHA-256, plus `bcryptjs` for passwords.
- **Export**: `exceljs`, generates real `.xlsx` files with actual Excel tables (not just loose cells).
- **PWA**: installable on phone or desktop (manifest + a minimal service worker), with its own banner when a new server version is available.

> Currency note: valid ISO 4217 codes are used — `EUR`, `USD`, and `ARS` (Argentine peso).

### Repo structure

```
server/   API + SQLite database
client/   React frontend (Vite)
deploy/   systemd service + backup/restore scripts
docs/     Extra guides (SSD, custom domain, remote access)
Dockerfile, docker-compose.yml
```

> For installing on a USB SSD (recommended for 24/7 use), for remote
> access (DuckDNS or Cloudflare Tunnel), and for running this app
> alongside another site on the same domain (subdomain or subpath, same
> Caddy instance) — see
> [`docs/deploy-ssd-domain.md`](docs/deploy-ssd-domain.md).

### Default admin account

- Username: `administrator`
- Password: `11223344` (can be overridden with the `ADMIN_DEFAULT_PASSWORD` env var **before the first boot**, since it's only used to create the account the first time)

**Important**: change this password right after deploying, from the Admin panel (password reset) using the `administrator` account.

### Option A: Docker (recommended)

Requires Docker and Docker Compose on the Raspberry Pi.

> The Raspberry Pi 3B supports 64-bit. **Raspberry Pi OS 64-bit (arm64)** is recommended for the best availability of official Node images. If your OS is 32-bit (armv7/armhf), the Docker build should still work since it compiles the image locally on the device, just slower.

```bash
git clone <this-repo> loot_ledger
cd loot_ledger

# optional: set your own secrets
export JWT_SECRET="a-long-random-string"
export ADMIN_DEFAULT_PASSWORD="11223344"

docker compose up -d --build
```

The app is then available at `http://<raspberry-pi-ip>:3000`.

Data (the SQLite database) lives in the `loot_ledger_data` volume, persistent across restarts and updates.

To update after pulling new changes:

```bash
git pull
docker compose up -d --build
```

### Option B: manual install + systemd

1. Install Node.js 20 LTS on the Raspberry Pi (e.g. via `nvm` or the official ARM package).
2. Clone the repo and build the frontend:

```bash
git clone <this-repo> loot_ledger
cd loot_ledger/client
npm install
npm run build

cd ../server
npm install --omit=dev
cp .env.example .env
# edit .env: JWT_SECRET, ADMIN_DEFAULT_PASSWORD, PORT, DB_PATH
```

3. Try it in the foreground:

```bash
node src/index.js
```

4. Install as a systemd service (starts automatically on boot):

```bash
sudo cp ../deploy/loot-ledger.service /etc/systemd/system/loot-ledger.service
sudo systemctl daemon-reload
sudo systemctl enable --now loot-ledger
sudo systemctl status loot-ledger
```

Adjust `User=` and the paths inside `loot-ledger.service` if your user or install folder differ from `pi` / `/home/pi/loot_ledger`.

### Environment variables (`server/.env`)

| Variable | Description | Default |
|---|---|---|
| `PORT` | HTTP port | `3000` |
| `JWT_SECRET` | Key used to sign sessions (change it in production) | - |
| `ADMIN_DEFAULT_PASSWORD` | Initial `administrator` password (only applies on first creation) | `11223344` |
| `DB_PATH` | Path to the SQLite file | `./data/loot-ledger.db` |
| `CORS_ORIGIN` | Only needed if the frontend is served from a different origin | - |

### Feature overview

- **Users**: invite-only server — a new user needs an invite code (generated by the `administrator`, or auto-generated when a project owner invites someone without an account yet). New accounts stay "pending" until the `administrator` approves or rejects them (individually or in bulk) from the Panel. The `administrator` can also create users directly, reset their password, or rename them (the username is just a display value: everything is referenced by id internally, so renaming doesn't affect expenses or balances).
- **Passwords**: each user changes their own by providing the current one; only the `administrator` can rename a username. "Forgot my password" from the login screen creates a request the `administrator` resolves manually (no email sending), limited to one every 24h per user.
- **Sessions**: "Remember me" at login extends the session to 30 days (otherwise it lasts 1 day or until the browser closes). Each user can see every connected device, label it, and log it out remotely (or log out everywhere except the current one).
- **Projects and roles**: any user creates their own projects, becoming their Owner. The Owner (or a project Admin, same permissions) can add or remove members, and invite people who don't have an account yet. Only the global `administrator` can transfer a project's ownership, and can see/manage every project on the server even without being a member.
- **User removal**: deleting an account or removing it from a project keeps its expenses and place in the triangulation intact. Re-registering with the same username picks the same history back up (no duplicate accounts).
- **Ledger** (per project): log expenses with a category and an entity (both creatable on the fly, either from the expense form itself or from their own management window), title, currency + amount, who paid (defaults to whoever is logging the expense) and who it's split among. An expense can be paid straight from the project's shared fund instead of split between people, and can be logged in installments. The list renders as a table with category/entity tags acting as one-click filters, and tapping any expense opens its full detail with edit/delete options.
- **Shared fund** (group projects): a shared pool — everyone contributes, and fixed expenses get paid from it without splitting them person by person.
- **Recurring rules**: expense or shared-fund-contribution rules that repeat every month on a fixed day, with support for installment payments.
- **Loot** (per project): each member's net balance per currency, and the simplified breakdown of who owes whom.
- **Pending Quests** (global, not per project): the total debt each user has with every other player, summed across every project they share and broken down line by line. A "Quest Complete" button settles that specific debt without manually going to that project's Ledger.
- **Excel export**: full history, by month, or by year, with real Excel tables (expenses, balances, and debts).
- **Gamer / Simple look**: a toggle that switches the whole interface between the original neon skin and a formal version with no jargon or effects, for anyone who'd rather have something more "vanilla".
- **Light / dark mode**: independent from the above, works with either look.
- **Optional contextual help**: a toggle that shows or hides short explanations for concepts like the shared fund, aimed at first-time users.
- **Installable as an app**: on phone or desktop, with its own icon and running full-screen (PWA), plus a banner when a new server version is available.
- **Language**: Spanish / English, toggled from the top bar (saved per browser).

### Backup and migration

With Docker (recommended, included in the repo):

```bash
./deploy/backup.sh                      # produces ./backups/loot-ledger-backup-*.tar.gz
./deploy/restore.sh path/to/file.tar.gz   # restores (asks for confirmation, restarts the service)
```

These scripts don't depend on knowing the Docker volume's physical name
or the project folder's name, so they work equally well for backing up
or migrating to another disk or another Raspberry Pi — see
[`docs/deploy-ssd-domain.md`](docs/deploy-ssd-domain.md) for the full
migration flow.

With a manual install (no Docker): copy the file set in `DB_PATH` (defaults to `server/data/loot-ledger.db`, along with its `-wal`/`-shm` files if present) while the service is stopped, or use `sqlite3 loot-ledger.db ".backup backup.db"` live.
