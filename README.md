## Listmonk CLI

CLI en TypeScript para gestionar campañas (newsletters) y listas en Listmonk.

### Requisitos

- Node.js 18.17 o superior
- `npm` o `pnpm`
- Credenciales de la API de Listmonk (usuario y API key) con permisos para campañas y listas

### Instalación

```bash
npm install
```

Esto descarga las dependencias, incluida `typescript`. Luego compila con:

```bash
npm run build
```

El binario generado queda en `dist/index.js` y se puede ejecutar como `node dist/index.js …`.  
Para añadirlo a tu PATH puedes usar `npm link` o ejecutar el script con `npx`.

### Configuración

El CLI busca la configuración en variables de entorno o en parámetros de línea:

- `LISTMONK_BASE_URL` – URL base del servidor (`https://tu-servidor`).
- `LISTMONK_USERNAME` – Usuario API (por defecto `api`).
- `LISTMONK_API_KEY` – API key o contraseña del usuario.
- `LISTMONK_TIMEOUT` – Timeout en ms (opcional, por defecto 30000).
- `LISTMONK_RETRY_COUNT` – Reintentos ante errores transitorios (opcional, por defecto 3).

Puedes sobreescribir estos valores en cada comando:

```bash
listmonk --base-url https://tu-servidor --api-key xxx campaigns list
```

### Uso

Consulta la ayuda general:

```bash
node dist/index.js --help
```

#### Listas

```bash
node dist/index.js lists --page 1 --per-page 20
```

#### Listar campañas

```bash
node dist/index.js campaigns list --page 1 --per-page 20 --status scheduled
```

#### Crear campaña

```bash
node dist/index.js campaigns create \
  --name "Newsletter abril" \
  --subject "Novedades de abril" \
  --lists 1 2 \
  --body-file contenido.html \
  --from-email "equipo@ejemplo.com" \
  --content-type html \
  --tags mensual destacados
```

#### Actualizar campaña

```bash
node dist/index.js campaigns update 42 \
  --subject "Nueva versión del subject" \
  --send-at "2024-04-20T20:00:00Z"

Nota: si Listmonk requiere listas al actualizar `send_at`, el CLI las obtiene del
campaign automáticamente si no pasas `--lists`.
```

#### Programar/enviar campaña

```bash
node dist/index.js campaigns schedule 42 --status scheduled --send-at "2024-04-20T20:00:00Z"
```

#### Eliminar campaña

```bash
node dist/index.js campaigns delete 42
```

### Depuración

Establece `DEBUG=1` para que en errores de la API se muestre el payload completo del servidor:

```bash
DEBUG=1 node dist/index.js campaigns create …
```

### Próximos pasos sugeridos

- Añadir más comandos (suscriptores, plantillas) reutilizando el cliente HTTP.
- Incorporar pruebas automatizadas y validaciones adicionales en los comandos.
- Empaquetar el CLI como paquete npm para instalación global sencilla.
