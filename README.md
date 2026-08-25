# Loot Ledger

Aplicacion web de triangulacion de gastos entre grupos (al estilo Tricount / Splitwise), con estetica gamer, pensada para vivir en una Raspberry Pi 3B como servidor domestico.

## Stack tecnico (elegido pensando en la RPi 3B)

La RPi 3B tiene solo 1 GB de RAM y una CPU modesta, asi que se prioriza consumo bajo:

- **Backend**: Node.js + Express + SQLite (`better-sqlite3`, sincrono y muy liviano, sin proceso de base de datos separado).
- **Frontend**: React + Vite, compilado a estaticos y **servido por el mismo proceso Node** (sin Nginx aparte, un solo proceso corriendo).
- **Autenticacion**: JWT en cookie httpOnly + `bcryptjs`.
- **Exportacion**: `exceljs`, genera `.xlsx` reales con tablas de Excel (no solo celdas sueltas).

> Nota sobre monedas: se usan los codigos ISO 4217 validos `EUR`, `USD` y `ARS` (el peso argentino es `ARS`, no `ARG`).

## Estructura del repo

```
server/   API + base de datos SQLite
client/   Frontend React (Vite)
deploy/   Ejemplo de servicio systemd
Dockerfile, docker-compose.yml
```

## Usuario administrador por defecto

- Usuario: `administrator`
- Contrasena: `11223344` (se puede sobreescribir con la variable `ADMIN_DEFAULT_PASSWORD` **antes del primer arranque**, ya que solo se usa para crear la cuenta la primera vez)

**Importante**: cambia esta contrasena apenas despliegues, desde el Panel de administracion (reseteo de contrasena) con la cuenta `administrator`.

## Opcion A: Docker (recomendado)

Requiere Docker y Docker Compose en la Raspberry Pi.

> La Raspberry Pi 3B soporta 64 bits. Se recomienda usar **Raspberry Pi OS de 64 bits (arm64)** para tener la mejor disponibilidad de imagenes oficiales de Node. Si tu SO es de 32 bits (armv7/armhf), el build de Docker igual deberia funcionar porque compila la imagen localmente en el dispositivo, pero puede ser mas lento.

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

## Opcion B: instalacion manual + systemd

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

Ajusta `User=` y las rutas dentro de `loot-ledger.service` si tu usuario o carpeta de instalacion son distintos de `pi` / `/home/pi/loot_ledger`.

## Variables de entorno (`server/.env`)

| Variable | Descripcion | Default |
|---|---|---|
| `PORT` | Puerto HTTP | `3000` |
| `JWT_SECRET` | Clave para firmar las sesiones (cambiarla en produccion) | - |
| `ADMIN_DEFAULT_PASSWORD` | Contrasena inicial de `administrator` (solo aplica en la primera creacion) | `11223344` |
| `DB_PATH` | Ruta del archivo SQLite | `./data/loot-ledger.db` |
| `CORS_ORIGIN` | Solo necesario si el frontend se sirve desde otro origen | - |

## Modelo funcional

- **Usuarios**: alta con aprobacion (usuario 4-10 caracteres, solo letras/numeros/`.`/`-`/`_`; contrasena 6-16 con las mismas reglas de caracteres). Toda cuenta nueva queda en estado "pendiente" hasta que el `administrator` global la aprueba o rechaza (individual o masivamente) desde el Panel — asi se evita que se generen cuentas duplicadas sin control. El `administrator` tambien puede crear usuarios directamente (sin pasar por aprobacion), resetearles la contrasena o renombrarlos (el nombre de usuario es solo un dato de display: internamente todo se referencia por id, asi que renombrar no afecta gastos ni balances).
- **Contrasenas**: cada usuario puede cambiar su propia contrasena (pidiendo la actual). No puede cambiar su propio nombre de usuario — eso es exclusivo del `administrator`.
- **Olvide mi contrasena**: el usuario puede pedir un restablecimiento desde el login; queda una solicitud visible para el `administrator` en el Panel, quien le define una contrasena nueva. Limitado a una solicitud cada 24hs por usuario para evitar spam.
- **Recordarme**: al iniciar sesion se puede tildar "mantener sesion iniciada" para que dure 30 dias en vez de cerrarse al salir del navegador.
- **Proyectos y roles**: cualquier usuario puede crear un proyecto propio, quedando como su **Propietario**. El Propietario puede:
  - Agregar directamente a otro usuario existente, o darle visibilidad (invitarlo) quedando pendiente hasta que acepte desde su Dashboard.
  - Quitar miembros del proyecto.
  - Otorgar o quitar el rol de **Admin** del proyecto a otros miembros (los admins de proyecto tienen los mismos permisos de gestion que el Propietario).
  - Transferir la propiedad del proyecto **solo la puede hacer el `administrator` global**, que ademas ve todos los proyectos del servidor (aunque no sea miembro) y puede cambiar el rol de cualquier usuario en cualquier proyecto.
- **Bajas de usuario**: al eliminar un usuario (por el `administrator` global) o al quitarlo de un proyecto, sus gastos y su lugar en la triangulacion **se conservan** (no rompe los balances). Si vuelve a registrarse con el mismo nombre de usuario, la cuenta se reactiva sobre el mismo registro (sin duplicados) y retoma todo su historial.
- **Ledger** (por proyecto): alta de gastos con categoria (existente o nueva; "Reembolso" viene creada por defecto para cancelar deudas entre usuarios), titulo, moneda + importe, quien pago, fecha, y a quienes se les reparte el gasto (division igualitaria entre los seleccionados).
- **Loot** (por proyecto): balance neto de cada integrante por moneda, y el detalle simplificado de quien le debe a quien.
- **Exportacion a Excel**: desde el Ledger, boton para exportar el historico completo, por mes o por ano — genera un `.xlsx` con tablas de Excel (gastos, balances y deudas).
- **Idioma**: espanol / ingles, con un toggle en la barra superior (se guarda en el navegador de cada usuario).

## Backup

Con Docker: respaldar el volumen `loot_ledger_data` (o copiar el archivo `.db` de dentro del volumen).

Con instalacion manual: copiar el archivo indicado en `DB_PATH` (por defecto `server/data/loot-ledger.db`, junto con sus archivos `-wal`/`-shm` si existen) con el servicio detenido, o usar `sqlite3 loot-ledger.db ".backup respaldo.db"` en caliente.
