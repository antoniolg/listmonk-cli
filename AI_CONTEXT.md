# Contexto para IAs: Listmonk CLI

Este archivo ofrece un resumen rápido para agentes e IAs que necesiten operar el CLI `listmonk`. No se requiere conocimiento previo del proyecto; basta con seguir estas instrucciones.

## Configuración básica

El CLI acepta variables de entorno o flags globales para apuntar al servidor y autenticarse:

- `LISTMONK_BASE_URL` (o `--base-url`) – URL base del servidor, e.g. `https://correo.ejemplo.com`.
- `LISTMONK_USERNAME` (o `--username`) – Usuario API; por defecto `api`.
- `LISTMONK_API_KEY` (o `--api-key`) – Token o contraseña del usuario API.
- `LISTMONK_TIMEOUT` / `--timeout` – Timeout en ms (opcional, por defecto 30000).
- `LISTMONK_RETRY_COUNT` / `--retry-count` – Reintentos ante errores transitorios (opcional, por defecto 3).

Ejemplo rápido de exportación:

```bash
export LISTMONK_BASE_URL="https://correo.ejemplo.com"
export LISTMONK_API_KEY="token-secreto"
```

## Ejemplos de uso

Invocación genérica:

```bash
listmonk <comando> [opciones]
```

### Listas

- Listar listas paginadas:

  ```bash
  listmonk lists --page 1 --per-page 25
  ```

- Filtrar por texto o tag:

  ```bash
  listmonk lists --query "weekly" --tag "marketing"
  ```

### Campañas

- Crear una campaña apuntando a listas 1 y 2:

  ```bash
  listmonk campaigns create \
    --name "Boletín semanal" \
    --subject "Resumen de novedades" \
    --lists 1 2 \
    --body-file ./contenido.html \
    --from-email "equipo@ejemplo.com" \
    --content-type html \
    --tags newsletter semana
  ```

- Actualizar el subject y programar envío:

  ```bash
  listmonk campaigns update 42 --subject "Nuevo subject" --send-at "2024-05-01T09:00:00Z"
  ```

- Cambiar estado a `scheduled` (y opcionalmente ajustar `send_at`):

  ```bash
  listmonk campaigns schedule 42 --status scheduled --send-at "2024-05-01T09:00:00Z"
  ```

- Eliminar campaña:

  ```bash
  listmonk campaigns delete 42
  ```

## Ayuda adicional

Si se necesita más información sobre cualquier comando, invocar la ayuda general o específica:

```bash
listmonk --help
listmonk campaigns --help
listmonk campaigns create --help
```

Esto mostrará todas las flags disponibles y descripciones detalladas.
