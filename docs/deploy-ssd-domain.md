# Instalar Loot Ledger en el SSD + acceso remoto con dominio propio

Guía paso a paso para: (1) instalar todo en el SSD por USB en vez de la SD,
(2) acceder desde dentro de casa y desde afuera, y (3) que se pueda entrar
por `www.loot-ledger.io` en vez de una IP.

**Resumen de la recomendación**: bootear la Raspberry Pi *directo desde el
SSD* (no desde la SD — para uso 24/7 el SSD es mucho más durable ante
escritura constante que una SD, que es la causa típica de que una Pi "se
muera" en proyectos que corren todo el día).

Para el acceso remoto, esta guía cubre dos caminos:

- **Ahora, para probar** (gratis, sin comprar dominio): **DuckDNS + Caddy**.
  Necesita que tu conexión de casa tenga IP pública real (sin CGNAT) y abrir
  los puertos 80/443 en el router.
- **Más adelante, si comprás `www.loot-ledger.io`** (o si tu conexión tiene
  CGNAT y DuckDNS no te funciona): **Cloudflare Tunnel**. Gratis también, no
  requiere abrir puertos en el router, funciona aunque tu ISP no te dé IP
  pública, y maneja el certificado HTTPS solo.

Pasar de uno a otro más adelante es cambiar una variable en `server/.env` y
correr el perfil de Docker Compose correspondiente — no hay que tocar nada
más.

No hace falta tocar nada del código de la app para que funcione con un
dominio propio — las URLs del frontend son todas relativas y la cookie de
sesión ya se pone en modo seguro automáticamente al correr en producción
sobre HTTPS. Todo lo de acá es configuración de infraestructura (DNS,
Docker, el túnel), no cambios en `client/` ni `server/`.

---

## 0. Qué vas a necesitar

- La Raspberry Pi 3B, el SSD por USB, una PC para flashear la imagen.
- Para probar ahora: una cuenta gratuita en
  [DuckDNS](https://www.duckdns.org) (podés entrar directo con GitHub o
  Google, no hace falta registrarte aparte).
- Para más adelante, cuando compres el dominio: `loot-ledger.io` en algún
  registrador (Namecheap, Cloudflare Registrar, etc. — los `.io` rondan USD
  35-60/año) y una cuenta gratuita en
  [Cloudflare](https://dash.cloudflare.com/sign-up). Nada de esto hace falta
  todavía si vas a arrancar con DuckDNS.
- **Importante, antes de todo**: confirmá que tu conexión de casa no está
  detrás de CGNAT (ver el aviso al principio de la sección 6). Si lo está,
  saltate DuckDNS y andá directo a la sección de Cloudflare Tunnel.

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

## 6. Acceso desde afuera

### Paso 0 (obligatorio): ¿tu conexión tiene IP pública real, o CGNAT?

Desde el celular conectado al WiFi de casa, abrí
`https://api.ipify.org` y anotá la IP que te muestra. Después entrá al panel
de administración del router (normalmente `192.168.0.1` o `192.168.1.1`) y
fijate la IP que muestra en la página de estado de Internet/WAN.

- **Si son la misma IP**: tenés IP pública real, DuckDNS + Caddy (sección
  6a) va a funcionar.
- **Si son distintas** (o el router muestra un rango raro tipo
  `100.64.x.x`–`100.127.x.x`): tu ISP usa CGNAT, y ningún port-forwarding va
  a funcionar nunca, sea con DuckDNS o cualquier otro nombre. Saltá directo
  a la sección 6b (Cloudflare Tunnel), que no depende de esto.

### 6a. Ahora, para probar: DuckDNS + Caddy (gratis, sin comprar dominio)

Esto usa el método clásico: DuckDNS le pone un nombre fijo a tu IP pública
de casa (y la actualiza sola si cambia), forwardeás dos puertos en el
router, y Caddy (un proxy chiquito que ya viene armado en el
`docker-compose.yml`) le pide solo el certificado HTTPS a Let's Encrypt y
reenvía todo a la app.

1. Entrá a [duckdns.org](https://www.duckdns.org) y logueate con GitHub,
   Google, etc.
2. En "sub domain" escribí algo como `loot-ledger` → click **add domain**.
   Te queda `loot-ledger.duckdns.org`.
3. Arriba de la página vas a ver tu **token** (un código largo tipo
   `a1b2c3d4-...`). Copialo.
4. En la Pi, agregá esto a `server/.env`:
   ```bash
   cat >> server/.env << 'EOF'
   DUCKDNS_SUBDOMAIN=loot-ledger
   DUCKDNS_TOKEN=<el-token-que-copiaste>
   PUBLIC_DOMAIN=loot-ledger.duckdns.org
   EOF
   ```
5. En tu **router**, forwardeá estos dos puertos hacia la IP local de la Pi
   (la fija que le asignaste en el paso 5):
   - Puerto externo `80` → Pi, puerto `80`
   - Puerto externo `443` → Pi, puerto `443`
   
   (Esto varía de router en router — buscá "port forwarding" o "NAT" en el
   panel de administración.)
6. Levantá los dos servicios nuevos:
   ```bash
   docker compose --profile duckdns up -d
   ```
7. Esperá 1-2 minutos (Caddy tiene que pedirle el certificado a Let's
   Encrypt la primera vez) y entrá desde el celular con **datos móviles**
   (no WiFi de casa, para probar que es de verdad desde afuera) a:
   `https://loot-ledger.duckdns.org`

Si no carga: revisá que el port-forwarding esté bien apuntado a la IP local
correcta de la Pi, y mirá los logs con `docker compose logs caddy`.

### 6b. Más adelante, con `www.loot-ledger.io`: Cloudflare Tunnel

Cuando compres el dominio (o si en el paso 0 te dio que tenés CGNAT), este
es el método recomendado: la Pi abre una conexión **saliente** hacia
Cloudflare (eso funciona siempre, incluso con CGNAT), y Cloudflare rutea el
tráfico público hacia adentro sin que tengas que tocar el router para nada.
El certificado HTTPS también lo maneja Cloudflare solo.

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
6. Si tenías levantado el perfil `duckdns`, bajalo primero (los dos métodos
   no hace falta correrlos juntos):
   ```bash
   docker compose --profile duckdns down
   ```
7. Levantá el túnel (además de la app, que ya está corriendo):
   ```bash
   docker compose --profile tunnel up -d
   ```
8. Volvé al dashboard de Cloudflare, en la misma pantalla del túnel andá a
   **Public Hostname** → **Add a public hostname**:
   - Subdomain: `www`
   - Domain: `loot-ledger.io`
   - Service Type: `HTTP`
   - URL: `loot-ledger:3000` (el nombre del servicio en `docker-compose.yml`,
     **no** `localhost` — el contenedor de Cloudflare se comunica con el de
     la app por la red interna de Docker, usando el nombre del servicio).
9. (Recomendado) agregá un segundo Public Hostname igual pero con Subdomain
   vacío, para que `loot-ledger.io` sin el `www` también entre.
10. Listo — `https://www.loot-ledger.io` ya apunta a tu Pi. Sin puertos
    abiertos en el router, sin IP fija, con HTTPS automático. Si habías
    forwardeado los puertos 80/443 para DuckDNS, ya los podés cerrar en el
    router — con este método no hace falta ningún puerto abierto.

### Puertos, resumen

| Método | Puertos que abrís en el router | Puerto 3000 |
|---|---|---|
| DuckDNS + Caddy | `80` y `443` hacia la Pi | Nunca expuesto a internet directo (Caddy es el único público) |
| Cloudflare Tunnel | Ninguno | Nunca expuesto — ni siquiera el 80/443 |

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

# En el medio nuevo, después de clonar el repo y antes o después de
# "docker compose up -d --build"
./deploy/restore.sh ruta/al/loot-ledger-backup-XXXXXXXX.tar.gz
```

No hace falta clonar el disco entero ni reinstalar la app manualmente: el
script arma un contenedor descartable que comparte el volumen de datos,
así que funciona sin importar el nombre del proyecto/carpeta ni el tamaño
del disco nuevo.

## 9. Checklist — fase de pruebas (DuckDNS)

- [ ] La Pi bootea del SSD (`df -h /` muestra el SSD, no la SD)
- [ ] `docker compose up -d --build` corriendo sin errores
- [ ] Accesible por IP local desde el celular/PC en la misma red
- [ ] Confirmaste que tu conexión NO tiene CGNAT (paso 0 de la sección 6)
- [ ] Subdominio creado en DuckDNS, token copiado a `server/.env`
- [ ] Puertos 80 y 443 forwardeados en el router hacia la Pi
- [ ] `docker compose --profile duckdns up -d` corriendo
- [ ] `https://loot-ledger.duckdns.org` responde desde datos móviles
- [ ] Contraseña de `administrator` cambiada
- [ ] Un backup hecho y guardado en otro lugar (no solo en la Pi)

## 10. Checklist — cuando compres `www.loot-ledger.io`

- [ ] Dominio comprado y nameservers apuntando a Cloudflare (estado
      "Active" en el dashboard)
- [ ] `CLOUDFLARE_TUNNEL_TOKEN` en `server/.env`
- [ ] `docker compose --profile duckdns down` (si veías corriendo DuckDNS)
- [ ] `docker compose --profile tunnel up -d` corriendo
- [ ] Public Hostname configurado en Cloudflare (`www` → `loot-ledger:3000`)
- [ ] `https://www.loot-ledger.io` responde desde datos móviles
- [ ] Puertos 80/443 cerrados de nuevo en el router (ya no hacen falta)
