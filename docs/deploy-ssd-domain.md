# Instalar Loot Ledger en el SSD + acceso remoto con dominio propio

Guía paso a paso para: (1) instalar todo en el SSD por USB en vez de la SD,
(2) acceder desde dentro de casa y desde afuera, y (3) que se pueda entrar
por `www.loot-ledger.io` en vez de una IP.

**Resumen de la recomendación**: bootear la Raspberry Pi *directo desde el
SSD* (no desde la SD — para uso 24/7 el SSD es mucho más durable ante
escritura constante que una SD, que es la causa típica de que una Pi "se
muera" en proyectos que corren todo el día). Para el acceso remoto con
dominio propio, la opción recomendada es **Cloudflare Tunnel**: es gratis, no
requiere abrir puertos en el router, funciona aunque tu ISP no te dé IP
pública (CGNAT, muy común en Argentina), y maneja el certificado HTTPS solo.

No hace falta tocar nada del código de la app para que funcione con un
dominio propio — las URLs del frontend son todas relativas y la cookie de
sesión ya se pone en modo seguro automáticamente al correr en producción
sobre HTTPS. Todo lo de acá es configuración de infraestructura (DNS,
Docker, el túnel), no cambios en `client/` ni `server/`.

---

## 0. Qué vas a necesitar

- La Raspberry Pi 3B, el SSD por USB, una PC para flashear la imagen.
- El dominio `loot-ledger.io` **comprado** en algún registrador (Namecheap,
  Cloudflare Registrar, etc.) — si todavía no lo compraste, es el primer
  paso. Los `.io` rondan USD 35-60/año, más caros que un `.com`.
- Una cuenta gratuita en [Cloudflare](https://dash.cloudflare.com/sign-up).

---

## 1. Flashear el sistema operativo en el SSD

1. Conectá el SSD por USB **a tu PC** (no a la Pi todavía).
2. Instalá [Raspberry Pi Imager](https://www.raspberrypi.com/software/).
3. Elegí OS → "Raspberry Pi OS Lite (64-bit)" (no hace falta el escritorio,
   solo consume RAM que no vas a usar).
4. Elegí Storage → tu SSD.
5. Antes de escribir, apretá el ícono de engranaje (opciones avanzadas) y
   configurá ahí mismo: hostname (ej. `loot-ledger`), habilitar SSH, usuario
   y contraseña, y WiFi si la Pi no va por cable. Así no necesitás conectarle
   teclado y monitor a la Pi en ningún momento.
6. Escribí la imagen y esperá a que termine.

## 2. Habilitar el arranque por USB (una sola vez)

La Raspberry Pi 3B por defecto intenta bootear primero desde la SD. Para que
arranque directo del SSD:

1. Si la Pi **ya bootea** desde alguna SD con Raspberry Pi OS actualizado:
   conectate por SSH y corré:
   ```bash
   sudo rpi-eeprom-update -a
   sudo reboot
   sudo raspi-config
   # Advanced Options → Boot Order → USB Boot → Sí
   sudo reboot
   ```
2. Apagá la Pi, sacá la SD, dejá solo el SSD conectado, prendé de nuevo.
   Debería bootear del SSD sin problema.
3. Si nunca tuviste una SD funcionando en esta Pi: usá temporalmente
   cualquier SD vieja con Raspberry Pi OS solo para hacer el paso 1, después
   la sacás y no la volvés a necesitar.

> Si el SSD no bootea (pasa con algunos adaptadores USB-SATA muy genéricos):
> como plan B, bootea desde la SD de 32GB y montá el SSD en
> `/home/pi/loot_ledger` vía `/etc/fstab` — la escritura pesada (la base de
> datos) sigue cayendo en el SSD igual, solo que el sistema arranca de la SD.

## 3. Instalar Docker

Ya conectado por SSH a la Pi (bootenado desde el SSD):

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# cerrá la sesión SSH y volvé a entrar para que tome el grupo nuevo
sudo apt install -y docker-compose-plugin
```

## 4. Clonar el repo y levantar la app

```bash
git clone https://github.com/ncalvo95/loot_ledger.git
cd loot_ledger
git checkout claude/loot-ledger-expense-app-knqvqz   # o main si ya se mergeo

cp server/.env.example server/.env
nano server/.env
```

En `server/.env` como mínimo cambiá:

- `JWT_SECRET`: una clave larga y aleatoria (por ejemplo, generala con
  `openssl rand -hex 32`).
- `ADMIN_DEFAULT_PASSWORD`: si querés arrancar con otra contraseña para
  `administrator` que no sea `11223344` (si ya la vas a cambiar desde el
  panel apenas entres, esto es opcional).

```bash
docker compose up -d --build
curl http://localhost:3000/api/health   # {"ok":true} si arrancó bien
```

## 5. Acceso dentro de tu red de casa

Ya andás en `http://<ip-local-de-la-pi>:3000` desde cualquier dispositivo
conectado al mismo WiFi.

- Recomendado: en tu router, asignale una **IP fija (DHCP reservation)** a
  la Pi para que no le cambie la IP local con el tiempo.
- Opcional, para no acordarte la IP puertas adentro: si le pusiste hostname
  `loot-ledger` al flashear, Raspberry Pi OS trae mDNS instalado, así que
  probablemente ya podés entrar por `http://loot-ledger.local:3000` desde
  la mayoría de los dispositivos de tu casa (funciona nativo en Mac/iOS;
  en Windows 10+ y Android es más variable). Esto **solo funciona dentro**
  de tu red, no sirve para acceder desde afuera.

## 6. Acceso desde afuera + `www.loot-ledger.io`

### Por qué Cloudflare Tunnel y no el port-forwarding clásico

El método clásico (abrir los puertos 80/443 en el router hacia la Pi) tiene
dos problemas para este caso: necesita que tu conexión tenga IP pública real
(muchos ISPs en Argentina usan CGNAT, donde varios clientes comparten una
IP pública y el port-forwarding directamente no funciona salvo que pidas
"IP pública" como servicio adicional), y además tenés que manejar vos el
certificado HTTPS (Let's Encrypt con renovación automática, típicamente con
un proxy como Caddy). Cloudflare Tunnel evita las dos cosas: la Pi abre una
conexión **saliente** hacia Cloudflare (eso funciona siempre, incluso detrás
de CGNAT) y Cloudflare rutea el tráfico público hacia adentro. El
certificado HTTPS lo maneja Cloudflare automáticamente.

### Pasos

1. Anda a Cloudflare → **Add a site** → escribí `loot-ledger.io`. Elegí el
   plan Free.
2. Cloudflare te va a dar 2 *nameservers* (algo como `xxx.ns.cloudflare.com`).
   Andá al panel del registrador donde compraste el dominio y reemplazá los
   nameservers actuales por esos dos. Puede tardar de minutos a un par de
   horas en propagar (Cloudflare te avisa por mail cuando está activo).
3. En el dashboard de Cloudflare: **Zero Trust** → **Networks** → **Tunnels**
   → **Create a tunnel** → tipo "Cloudflared" → nombre, por ejemplo
   `loot-ledger-pi`.
4. Te va a mostrar un comando de instalación con un **token** largo (empieza
   con `eyJ...`). Copiá solo el token.
5. En la Pi, agregalo a `server/.env`:
   ```bash
   echo "CLOUDFLARE_TUNNEL_TOKEN=<el-token-que-copiaste>" >> server/.env
   ```
6. Levantá el túnel (además de la app, que ya está corriendo):
   ```bash
   docker compose --profile tunnel up -d
   ```
7. Volvé al dashboard de Cloudflare, en la misma pantalla del túnel andá a
   **Public Hostname** → **Add a public hostname**:
   - Subdomain: `www`
   - Domain: `loot-ledger.io`
   - Service Type: `HTTP`
   - URL: `loot-ledger:3000` (el nombre del servicio en `docker-compose.yml`,
     **no** `localhost` — el contenedor de Cloudflare se comunica con el de
     la app por la red interna de Docker, usando el nombre del servicio).
8. (Recomendado) agregá un segundo Public Hostname igual pero con Subdomain
   vacío, para que `loot-ledger.io` sin el `www` también entre.
9. Listo — `https://www.loot-ledger.io` ya apunta a tu Pi. Sin puertos
   abiertos en el router, sin IP fija, con HTTPS automático.

### Puertos

Con este método **no tenés que tocar el firewall/NAT del router en
absoluto**. Ni siquiera el puerto 3000 queda expuesto a internet — el único
tráfico es la conexión saliente que la Pi abre hacia Cloudflare. El puerto
3000 sigue existiendo solo puertas adentro (entre el contenedor de la app y
el del túnel).

### Alternativa clásica (si preferís no depender de Cloudflare)

Solo como referencia, sin entrar en el detalle: necesitarías (a) IP pública
real o un servicio de DNS dinámico (DuckDNS, No-IP) si tu IP cambia, (b)
forwardear los puertos 80 y 443 del router hacia la Pi, y (c) un reverse
proxy como [Caddy](https://caddyserver.com/) delante de la app para manejar
Let's Encrypt automáticamente (nunca expongas el puerto 3000 sin HTTPS
directo a internet — la app maneja contraseñas). Es más frágil y más trabajo
de mantener que el túnel, y no funciona si tu conexión tiene CGNAT.

## 7. Cambiar la contraseña del admin

Si no la cambiaste en el `.env` antes del primer arranque, entrá con
`administrator` / `11223344` y cambiala desde **Panel → Usuarios → Resetear
contraseña** apenas tengas acceso.

## 8. Migrar los datos (de la SD vieja, o a futuro entre discos)

Con los scripts `deploy/backup.sh` y `deploy/restore.sh` (ver
`README.md` → sección Backup para el detalle). En resumen:

```bash
# En el medio viejo
./deploy/backup.sh
# Copiá el .tar.gz generado en ./backups al medio nuevo (scp, pendrive, etc.)

# En el medio nuevo, despues de clonar el repo y antes o despues de
# "docker compose up -d --build"
./deploy/restore.sh ruta/al/loot-ledger-backup-XXXXXXXX.tar.gz
```

No hace falta clonar el disco entero ni reinstalar la app manualmente: el
script arma un contenedor descartable que comparte el volumen de datos,
así que funciona sin importar el nombre del proyecto/carpeta ni el tamaño
del disco nuevo.

## 9. Checklist final

- [ ] La Pi bootea del SSD (`df -h /` muestra el SSD, no la SD)
- [ ] `docker compose up -d --build` corriendo sin errores
- [ ] Accesible por IP local desde el celular/PC en la misma red
- [ ] Nameservers del dominio apuntando a Cloudflare (verificado en el
      dashboard de Cloudflare, estado "Active")
- [ ] `docker compose --profile tunnel up -d` corriendo
- [ ] `https://www.loot-ledger.io` responde desde una red distinta (datos
      móviles, por ejemplo, para probar que es de verdad "desde afuera")
- [ ] Contraseña de `administrator` cambiada
- [ ] Un backup hecho y guardado en otro lugar (no solo en la Pi)
