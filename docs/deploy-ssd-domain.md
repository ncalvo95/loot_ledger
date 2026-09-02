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

Pasar de uno a otro más adelante es cambiar una variable en el `.env` de la
raíz del repo y correr el perfil de Docker Compose correspondiente — no hay
que tocar nada más.

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
  detrás de CGNAT (ver el aviso al principio de la sección 5). Si lo está,
  saltate DuckDNS y andá directo a la sección de Cloudflare Tunnel.

---

## 1. Vas a flashear DOS tarjetas/discos, no una sola

Esto es lo que más confusión suele generar, así que aclarémoslo antes de
tocar nada: al final de esta sección vas a tener **dos medios flasheados**,
con roles totalmente distintos:

| Medio | Para qué sirve | Cuánto dura en uso |
|---|---|---|
| **SD** (la de 32GB) | Arrancar la Pi *una sola vez*, solo para decirle "de ahora en más, arrancá por USB" | 5 minutos. Después se saca y no se vuelve a usar (ni siquiera queda conectada) |
| **SSD** (el de 240GB) | Donde vive el sistema operativo y la app **para siempre**, una vez que la Pi arranca de ahí | Para siempre — es el disco definitivo |

La razón de este paso extra es pura limitación de la Raspberry Pi 3B: de
fábrica, **solo** sabe arrancar desde la SD. Para que arranque desde un SSD
por USB hay que decírselo explícitamente una vez, y para eso necesitás que
la Pi ya esté corriendo desde *algún* lado — ahí entra la SD, como
herramienta descartable, no como el lugar final de nada.

### 1.1. Flashear el SSD (el disco definitivo)

1. Conectá el SSD por USB **a tu PC** (no a la Pi todavía).
2. Instalá [Raspberry Pi Imager](https://www.raspberrypi.com/software/).
3. Elegí OS → "Raspberry Pi OS Lite (64-bit)".
4. Elegí Storage → **tu SSD** (fijate bien de no elegir la SD por error acá).
5. Antes de escribir, apretá el ícono de engranaje (opciones avanzadas) y
   configurá: hostname (ej. `loot-ledger`), habilitar SSH, usuario y
   contraseña, y WiFi si la Pi no va por cable. Así no necesitás conectarle
   teclado y monitor a la Pi en ningún momento.
6. Escribí la imagen y esperá a que termine. **Desconectá el SSD de la PC
   pero todavía no lo conectes a la Pi.**

### 1.2. Flashear la SD (la herramienta descartable de este paso)

Repetí exactamente lo mismo con la SD de 32GB:

1. Conectala a la PC, abrí Raspberry Pi Imager de nuevo.
2. Mismo OS: "Raspberry Pi OS Lite (64-bit)".
3. Storage → **tu SD** esta vez.
4. Mismas opciones avanzadas (hostname, SSH, usuario/contraseña, WiFi) —
   podés poner el mismo hostname `loot-ledger`, no importa, porque nunca va
   a estar prendida al mismo tiempo que el SSD.
5. Escribí la imagen.

### 1.3. Habilitar el arranque por USB (usando la SD, una sola vez)

La Raspberry Pi 3B (a diferencia de la 3B+/4) **no tiene** la EEPROM
regrabable que usan `rpi-eeprom-update` y el menú **Advanced Options → Boot
Order** de `raspi-config` — si esa opción no te aparece, es normal, no es
que algo esté mal en tu instalación. En la 3B el arranque por USB se
habilita con un bit especial ("OTP", One-Time Programmable: se graba una
sola vez de forma permanente y no se puede deshacer) que se activa desde
`config.txt`.

1. Poné **solo la SD** en la Pi (el SSD todavía no va conectado) y prendé.
   Va a arrancar de la SD normalmente — esto es esperado y correcto.
2. Conectate por SSH (`ssh <usuario>@loot-ledger.local`, o por la IP que le
   haya dado tu router) y confirmá primero dónde vive `config.txt` en tu
   versión de Raspberry Pi OS — **esto es importante**: desde Bookworm (la
   que te indiqué instalar) el archivo se movió a `/boot/firmware/`, y ya
   no está en `/boot/` a secas:
   ```bash
   ls /boot/firmware/config.txt 2>/dev/null && echo "-> usá /boot/firmware/config.txt"
   ls /boot/config.txt 2>/dev/null && echo "-> usá /boot/config.txt"
   ```
   Anotá cuál de los dos te devolvió una ruta real (no "No such file or
   directory") — es el que vas a usar en el paso siguiente. Si editás el
   que no corresponde, el bootloader nunca lee el cambio y por más que
   reinicies mil veces no va a pasar nada (este es el error más común acá).
3. Agregá la línea, con la ruta correcta del paso anterior:
   ```bash
   echo "program_usb_boot_mode=1" | sudo tee -a /boot/firmware/config.txt
   ```
4. Apagá del todo y **cortá la alimentación de verdad** — no alcanza con
   `sudo reboot`: tiene que ser un apagado completo y volver a enchufar,
   para que el bootloader arranque de cero y grabe el bit:
   ```bash
   sudo poweroff
   # esperá a que se apaguen las luces, desenchufá la alimentación,
   # contá 5 segundos, volvé a enchufar
   ```
5. Ya de nuevo en la SD, verificá que el bit haya quedado grabado:
   ```bash
   vcgencmd otp_dump | grep 17:
   ```
   Fijate la fila `17:`. Si el segundo dígito después de los dos puntos es
   un `3` (por ejemplo `17:3020000a`), el USB boot quedó habilitado; si
   sigue en `1` (`17:1020000a`), no se grabó — repetí el paso 3 verificando
   bien la ruta del archivo. Si no estás seguro de cómo leerlo, pegame el
   valor completo y lo confirmamos juntos.
6. Apagá del todo, **sacá la SD**, **conectá el SSD** en su lugar, y
   prendé.

Si arrancó bien: estás corriendo desde el SSD, y la SD ya cumplió su
función — guardala para otro uso, no hace falta que vuelva a esta Pi.

### Si no arranca del SSD

- **Volvé a chequear el paso 1.3 completo**: el error más común es haber
  editado `/boot/config.txt` en un sistema Bookworm, cuando el archivo real
  es `/boot/firmware/config.txt` (`tee` no avisa si el archivo no existía:
  simplemente crea uno nuevo en un lugar que nadie lee). El segundo más
  común es reiniciar con `sudo reboot` en vez de cortar la alimentación de
  verdad. Confirmá con `vcgencmd otp_dump | grep 17:` (paso 5) antes de
  seguir probando.
- **El bit ya está en `3` y sigue sin arrancar**: puede ser el adaptador
  USB-SATA del gabinete del SSD (algunos genéricos no son compatibles con
  el boot de la Pi, aunque sí funcionan para leer/escribir datos una vez
  arrancada de otro lado), o que la SSD esté tomando más corriente de la
  que da el puerto USB de la Pi — probá con un hub USB alimentado en el
  medio, o alimentación externa si el gabinete lo permite.
- **Plan B si nada de esto funciona**: bootear siempre de la SD, y usar el
  SSD solo como disco de datos. Ver la sección siguiente — es un camino
  totalmente soportado, no una solución a medias.

### Plan B: bootear de la SD, SSD solo como disco de datos

Si después de lo anterior preferís no seguir peleando con el boot por USB,
esta alternativa te deja igual de bien parado: la SD solo carga el sistema
operativo y Docker, pero **todos los datos de la app** (y de paso, todas
las imágenes y contenedores de Docker) viven en el SSD. La SD deja de sufrir
la escritura pesada de la base de datos y de las imágenes, así que igual
ganás la durabilidad que buscabas — solo que el arranque en sí sigue
siendo desde la SD.

No hace falta formatear el SSD desde Windows antes de nada — Windows no
sabe crear el formato que necesitamos (`ext4`, nativo de Linux), y además
el SSD todavía tiene la instalación de Raspberry Pi OS que le grabaste
antes, así que hay que borrarla igual. Todo esto se hace **desde la propia
Pi**, ya booteada por SD, con el SSD conectado:

1. Identificá el SSD (¡con cuidado de no confundirlo con la SD, que
   aparece como `mmcblk0`!):
   ```bash
   lsblk
   ```
   El SSD va a aparecer como `sda` (o similar), sin el prefijo `mmcblk`.
   Los pasos siguientes asumen `/dev/sda` — ajustá si el tuyo es distinto.
2. Borrá la tabla de particiones vieja y creá una sola partición nueva
   ocupando todo el disco:
   ```bash
   sudo parted /dev/sda --script mklabel gpt mkpart primary ext4 0% 100%
   ```
3. Formateala como `ext4`:
   ```bash
   sudo mkfs.ext4 -L lootledger-ssd /dev/sda1
   ```
4. Anotá su UUID (lo vas a necesitar para el paso siguiente):
   ```bash
   sudo blkid /dev/sda1
   ```
5. Creá el punto de montaje y agregalo a `/etc/fstab` con ese UUID (nunca
   con `/dev/sda1` directo: el nombre puede cambiar entre reinicios si
   conectás otro disco USB; `nofail` evita que la Pi no arranque si algún
   día el SSD no está conectado):
   ```bash
   sudo mkdir -p /mnt/lootledger-ssd
   echo "UUID=$(sudo blkid -s UUID -o value /dev/sda1)  /mnt/lootledger-ssd  ext4  defaults,nofail  0  2" | sudo tee -a /etc/fstab
   sudo mount -a
   df -h /mnt/lootledger-ssd   # confirmá que aparece montado
   ```
6. Mudá **todo** el almacenamiento de Docker (imágenes, contenedores, y el
   volumen con la base de datos de la app) al SSD, cambiando su
   `data-root`. Es el cambio más simple posible: no requiere tocar
   `docker-compose.yml` ni nada del código, porque Docker sigue viendo el
   volumen `loot_ledger_data` igual que siempre, solo que ahora sus
   archivos físicos están en el SSD:
   ```bash
   sudo systemctl stop docker
   sudo mkdir -p /mnt/lootledger-ssd/docker
   sudo rsync -axHAX /var/lib/docker/ /mnt/lootledger-ssd/docker/
   echo '{ "data-root": "/mnt/lootledger-ssd/docker" }' | sudo tee /etc/docker/daemon.json
   sudo mv /var/lib/docker /var/lib/docker.bak   # queda de respaldo, no lo borres todavía
   sudo systemctl start docker
   docker info | grep "Docker Root Dir"   # tiene que mostrar /mnt/lootledger-ssd/docker
   ```
7. Levantá la app de nuevo (va a recrear el contenedor apuntando al nuevo
   `data-root`, con los mismos datos que ya tenía):
   ```bash
   cd ~/loot_ledger
   docker compose up -d --build
   ```
   Una vez que confirmes que todo funciona bien (entrá a la app, fijate
   que tus proyectos y gastos sigan ahí), podés borrar el respaldo:
   `sudo rm -rf /var/lib/docker.bak`.

Con esto: la SD solo tiene el sistema operativo y el motor de Docker (poca
escritura, así que dura mucho más), y el SSD tiene todo lo pesado. Los
scripts `backup.sh`/`restore.sh` funcionan exactamente igual que antes, sin
ningún cambio — no les importa dónde vive físicamente el volumen.

## 2. Instalar Docker

Ya conectado por SSH a la Pi (bootenado desde el SSD):

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# cerrá la sesión SSH y volvé a entrar para que tome el grupo nuevo
sudo apt install -y docker-compose-plugin
```

## 3. Clonar el repo y levantar la app

```bash
git clone https://github.com/ncalvo95/loot_ledger.git
cd loot_ledger
git checkout claude/loot-ledger-expense-app-knqvqz   # o main si ya se mergeo
```

**Importante — con Docker las variables van en un `.env` en la raíz del
repo, no en `server/.env`**: `server/.env` es el que usa la instalación
manual sin Docker (Opción B del README); Docker Compose solo lee
automáticamente un archivo llamado `.env` que esté **al lado de
`docker-compose.yml`** (o sea, en `~/loot_ledger/.env`, la carpeta donde
estás parado ahora). Si editás `server/.env` con Docker, esos valores
nunca le llegan al contenedor y no vas a notar ningún error — simplemente
arranca con los valores por defecto, como te pasó con la contraseña.

```bash
cat > .env <<'EOF'
JWT_SECRET=cambiame-por-una-clave-larga-y-aleatoria
ADMIN_DEFAULT_PASSWORD=cambiame-tambien
EOF
nano .env   # revisá/editá los valores antes de levantar la app
```

Generá el `JWT_SECRET` con `openssl rand -hex 32` y pegalo ahí en vez del
placeholder.

**`ADMIN_DEFAULT_PASSWORD` solo aplica la primera vez** que la app crea la
cuenta `administrator` (la primera vez que corre `docker compose up`, si
todavía no existe ningún dato). Si ya la levantaste antes y la cuenta
`administrator` ya está creada en la base, cambiar esta variable después
**no** le cambia la contraseña — para eso hay que usar el Panel (ver el
Paso 6, "Cambiar la contraseña del admin").

```bash
docker compose up -d --build
curl http://localhost:3000/api/health   # {"ok":true} si arrancó bien
```

## 4. Acceso dentro de tu red de casa + IP fija

Ya andás en `http://<ip-local-de-la-pi>:3000` desde cualquier dispositivo
conectado al mismo WiFi. Pero esa IP se la asigna el router por DHCP y
puede cambiar (por ejemplo, si reiniciás el router) — y en el paso 5a vas a
necesitar apuntar el port-forwarding a una IP que **no cambie nunca**. Fijá
la IP local **antes** de configurar el port-forwarding, por cualquiera de
estos dos caminos:

### Opción A (recomendada): reserva de IP en el router

No se toca nada en la Pi — el router le asigna siempre la misma IP a partir
de su dirección MAC. Sobrevive a reinstalaciones del sistema operativo.

1. En la Pi, conseguí la MAC de la interfaz que estés usando:
   ```bash
   ip link show eth0    # si va por cable
   ip link show wlan0   # si va por WiFi
   ```
   Buscá la línea `link/ether xx:xx:xx:xx:xx:xx` — esa es la MAC.
2. Entrá al panel del router (normalmente `192.168.1.1` en tu red) y buscá
   la sección de DHCP — suele llamarse "DHCP Reservation", "Static Leases"
   o "Address Reservation" (el nombre exacto varía según la marca).
3. Buscá la Pi en la lista de dispositivos conectados (por MAC, o por el
   hostname `loot-ledger` si lo configuraste al flashear) y asignale
   `192.168.1.194` de forma fija.
4. Reiniciá la Pi (`sudo reboot`) para que tome la IP reservada.

### Opción B: IP estática configurada directo en la Pi

Útil si tu router no tiene esa opción. Raspberry Pi OS (Bookworm en
adelante) usa NetworkManager:

```bash
nmcli connection show    # para ver el nombre exacto de la conexión activa

sudo nmcli connection modify "Wired connection 1" \
  ipv4.addresses 192.168.1.194/24 \
  ipv4.gateway 192.168.1.1 \
  ipv4.dns "192.168.1.1 8.8.8.8" \
  ipv4.method manual

sudo nmcli connection up "Wired connection 1"
```

Cambiá `"Wired connection 1"` por el nombre real que te haya mostrado
`nmcli connection show` (si es WiFi, va a ser el nombre de tu red). Ojo con
esta opción: `192.168.1.194` tiene que quedar **fuera del rango de DHCP**
del router (revisalo en la misma sección de DHCP del panel), o el router le
podría asignar esa misma IP a otro dispositivo más adelante y quedarían dos
aparatos peleando por la misma IP.

### Verificar

```bash
ip addr show | grep 192.168.1.194   # deberia aparecer
curl http://192.168.1.194:3000/api/health   # {"ok":true}
```

- Opcional, para no acordarte la IP puertas adentro: si le pusiste hostname
  `loot-ledger` al flashear, Raspberry Pi OS trae mDNS instalado, así que
  probablemente ya podés entrar por `http://loot-ledger.local:3000` desde
  la mayoría de los dispositivos de tu casa (funciona nativo en Mac/iOS;
  en Windows 10+ y Android es más variable). Esto **solo funciona dentro**
  de tu red, no sirve para acceder desde afuera.

## 5. Acceso desde afuera

### Paso 0 (obligatorio): ¿tu conexión tiene IP pública real, o CGNAT?

Desde el celular conectado al WiFi de casa, abrí
`https://api.ipify.org` y anotá la IP que te muestra. Después entrá al panel
de administración del router (normalmente `192.168.0.1` o `192.168.1.1`) y
fijate la IP que muestra en la página de estado de Internet/WAN.

- **Si son la misma IP**: tenés IP pública real, DuckDNS + Caddy (sección
  5a) va a funcionar.
- **Si son distintas** (o el router muestra un rango raro tipo
  `100.64.x.x`–`100.127.x.x`): tu ISP usa CGNAT, y ningún port-forwarding va
  a funcionar nunca, sea con DuckDNS o cualquier otro nombre. Saltá directo
  a la sección 5b (Cloudflare Tunnel), que no depende de esto.

### 5a. Ahora, para probar: DuckDNS + Caddy (gratis, sin comprar dominio)

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
4. En la Pi, agregá esto al `.env` de la **raíz del repo** (el mismo que
   creaste en el paso 3, al lado de `docker-compose.yml` — no
   `server/.env`, ver la nota del paso 3 sobre por qué):
   ```bash
   cat >> .env << 'EOF'
   DUCKDNS_SUBDOMAIN=loot-ledger
   DUCKDNS_TOKEN=<el-token-que-copiaste>
   PUBLIC_DOMAIN=loot-ledger.duckdns.org
   EOF
   ```
5. En tu **router**, forwardeá estos dos puertos hacia la IP local fija de
   la Pi de la sección 4 (en esta guía, `192.168.1.194`):
   - Puerto externo `80` → `192.168.1.194`, puerto `80`
   - Puerto externo `443` → `192.168.1.194`, puerto `443`

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

#### Opcional: servir otro sitio (ej. el portfolio) desde esta misma Caddy

Esta misma Pi puede servir un segundo sitio corriendo en **otro** repo/
compose (ej. `castielo-web`), sin abrir más puertos ni levantar otra
instancia de Caddy: Caddy ya sabe pedir un certificado HTTPS por cada
dominio que le pases, y los reenvía cada uno a su contenedor por una red
Docker compartida (`edge`).

1. Creá la red compartida una sola vez (no la crea ningún compose, es
   independiente de los dos):
   ```bash
   docker network create edge
   ```
2. En el `.env` de la raíz de **este** repo, agregá el dominio del otro
   sitio (si no lo agregás, Caddy sigue sirviendo solo Loot Ledger normal):
   ```bash
   echo "PORTFOLIO_DOMAIN=castielo.duckdns.org" >> .env
   ```
3. Si ese segundo dominio es un subdominio nuevo de la **misma** cuenta de
   DuckDNS (mismo token), sumalo separado por coma en `DUCKDNS_SUBDOMAIN`
   para que el mismo contenedor de DuckDNS renueve los dos:
   ```
   DUCKDNS_SUBDOMAIN=loot-ledger,castielo
   ```
4. En el compose del **otro** repo, el servicio tiene que unirse a la
   misma red `edge` (sin publicar puerto al host — Caddy le llega por
   nombre de contenedor) y tener un `container_name` que coincida con el
   que espera `deploy/Caddyfile` (hoy, `castielo-web`).
5. Recreá Caddy para que tome las variables nuevas y levantá el otro
   compose:
   ```bash
   docker compose --profile duckdns up -d --build
   cd ~/castielo-web && docker compose up -d --build
   ```

### 5b. Más adelante, con `www.loot-ledger.io`: Cloudflare Tunnel

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
5. En la Pi, agregalo al `.env` de la raíz del repo (no `server/.env` — ver
   la nota del paso 3):
   ```bash
   echo "CLOUDFLARE_TUNNEL_TOKEN=<el-token-que-copiaste>" >> .env
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

#### Opcional: convivir con otro sitio bajo el mismo dominio, por subpath

Igual que la sección 5a tiene una variante para servir un segundo sitio por
un segundo *hostname* (`castielo.duckdns.org` además de
`loot-ledger.duckdns.org`), acá va la variante para cuando los dos sitios
comparten un único dominio propio y se separan por *path* — ej.
`www.castielo.io/` para el portfolio (`castielo-web`) y
`www.castielo.io/loot-ledger` para esta app, con un solo túnel de
Cloudflare.

A diferencia de la variante por hostname, acá Loot Ledger **sí** necesita
saber que no vive en la raíz: tanto el frontend (assets del build) como el
backend (rutas de la API y la cookie de sesión) tienen que colgar de
`/loot-ledger`. Esto ya está resuelto en el código con una única variable,
`BASE_PATH` (ver `server/src/base-path.js` y `client/vite.config.js`) — no
hace falta tocar nada más.

1. En el `.env` de la raíz del repo, agregá:
   ```bash
   echo "BASE_PATH=/loot-ledger" >> .env
   ```
2. Reconstruí la imagen (no alcanza con reiniciar el contenedor: el
   subpath queda horneado en los assets del build del cliente):
   ```bash
   docker compose up -d --build loot-ledger
   ```
3. Sumá `loot-ledger` a la red compartida `edge` (la misma que usa la
   variante por hostname — creala una sola vez si todavía no existe):
   ```bash
   docker network create edge   # si todavía no la creaste
   ```
   El servicio `cloudflared` de este compose ya está declarado en
   `[default, edge]`, así que después de levantarlo va a poder llegar
   tanto a `loot-ledger:3000` (por `default`) como a `castielo-web:3000`
   (por `edge`, si ese otro compose también se unió a `edge` con ese
   `container_name` — mismo requisito que en la variante por hostname).
4. Rutear por path en el túnel. Dos formas, elegí la que te resulte más
   cómoda:
   - **Desde el dashboard** (más simple si tu plan/versión de Cloudflare
     lo permite): en **Zero Trust → Networks → Tunnels →** tu túnel →
     **Public Hostname**, al editar/crear la entrada para
     `www.castielo.io` fijate si aparece un campo **Path** (además de
     Subdomain/Domain/Service) — ahí va `loot-ledger` (o `loot-ledger/*`
     según la versión del dashboard), apuntando a `loot-ledger:3000`. Con
     eso alcanza una segunda entrada, sin Path, apuntando a
     `castielo-web:3000` para todo lo demás — el orden importa: la entrada
     con Path más específico tiene que evaluarse antes que el catch-all.
   - **Con `config.yml`** (si el dashboard no te deja poner Path, o
     preferís tenerlo versionado): armá un archivo tipo
     ```yaml
     tunnel: <tu-tunnel-id>
     credentials-file: /etc/cloudflared/creds.json
     ingress:
       - hostname: www.castielo.io
         path: ^/loot-ledger(/.*)?$
         service: http://loot-ledger:3000
       - hostname: www.castielo.io
         service: http://castielo-web:3000
       - service: http_status:404
     ```
     y montalo en el servicio `cloudflared` (`volumes:` con ese
     `config.yml` y el archivo de credenciales del túnel), cambiando
     `command: tunnel run` por `command: tunnel --config
     /etc/cloudflared/config.yml run` — en ese modo el túnel deja de leer
     la config del dashboard, así que las reglas de Public Hostname que
     hayas puesto ahí quedan sin efecto mientras uses `config.yml`.
5. Esperá la propagación y probá desde datos móviles:
   - `https://www.castielo.io/` → el portfolio.
   - `https://www.castielo.io/loot-ledger` → Loot Ledger. Probá también
     refrescar la página estando ya adentro (no solo entrar por el link) y
     loguearte, para confirmar que la cookie de sesión y los assets
     cargan bien desde el subpath.
6. Si veías el perfil `duckdns` corriendo (sección 5a) y ya no lo
   necesitás porque este dominio propio reemplaza esa prueba, bajalo:
   ```bash
   docker compose --profile duckdns down
   ```

Para volver a servir Loot Ledger en la raíz de su propio dominio más
adelante (dejar de convivir bajo `/loot-ledger`), alcanza con sacar
`BASE_PATH` del `.env` y reconstruir de nuevo.

### Puertos, resumen

| Método | Puertos que abrís en el router | Puerto 3000 |
|---|---|---|
| DuckDNS + Caddy | `80` y `443` hacia la Pi | Nunca expuesto a internet directo (Caddy es el único público) |
| Cloudflare Tunnel | Ninguno | Nunca expuesto — ni siquiera el 80/443 |

## 6. Cambiar la contraseña del admin

Si no la cambiaste en el `.env` antes del primer arranque, entrá con
`administrator` / `11223344` y cambiala desde **Panel → Usuarios → Resetear
contraseña** apenas tengas acceso.

## 7. Migrar los datos (de la SD vieja, o a futuro entre discos)

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

## 8. Checklist — fase de pruebas (DuckDNS)

- [ ] La Pi bootea del SSD (`df -h /` muestra el SSD, no la SD)
- [ ] `docker compose up -d --build` corriendo sin errores
- [ ] Accesible por IP local desde el celular/PC en la misma red
- [ ] IP local fija asignada a la Pi (reserva en el router o estática) y
      verificada con `curl http://<esa-ip>:3000/api/health`
- [ ] Confirmaste que tu conexión NO tiene CGNAT (paso 0 de la sección 5)
- [ ] Subdominio creado en DuckDNS, token copiado al `.env` de la raíz del
      repo (no `server/.env`)
- [ ] Puertos 80 y 443 forwardeados en el router hacia la Pi
- [ ] `docker compose --profile duckdns up -d` corriendo
- [ ] `https://loot-ledger.duckdns.org` responde desde datos móviles
- [ ] Contraseña de `administrator` cambiada
- [ ] Un backup hecho y guardado en otro lugar (no solo en la Pi)

## 9. Checklist — cuando compres `www.loot-ledger.io`

- [ ] Dominio comprado y nameservers apuntando a Cloudflare (estado
      "Active" en el dashboard)
- [ ] `CLOUDFLARE_TUNNEL_TOKEN` en el `.env` de la raíz del repo (no
      `server/.env`)
- [ ] `docker compose --profile duckdns down` (si veías corriendo DuckDNS)
- [ ] `docker compose --profile tunnel up -d` corriendo
- [ ] Public Hostname configurado en Cloudflare (`www` → `loot-ledger:3000`)
- [ ] `https://www.loot-ledger.io` responde desde datos móviles
- [ ] Puertos 80/443 cerrados de nuevo en el router (ya no hacen falta)
