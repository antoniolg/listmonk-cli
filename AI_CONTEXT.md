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

- JSON para automatizaciones:

  ```bash
  listmonk lists --query "AI Expert" --json
  ```

### Suscriptores

- Crear un suscriptor:

  ```bash
  listmonk subscribers create \
    --email "user@example.com" \
    --name "User Name" \
    --lists 19 \
    --preconfirm-subscriptions
  ```

- Listar o buscar suscriptores:

  ```bash
  listmonk subscribers list --list-id 19 --per-page 100
  listmonk subscribers list --email "user@example.com" --json
  listmonk subscribers list --name "Juan Pablo"
  ```

- Obtener un suscriptor concreto:

  ```bash
  listmonk subscribers get 7449
  listmonk subscribers get 7449 --json
  ```

- Actualizar un suscriptor:

  ```bash
  listmonk subscribers update 7449 \
    --name "Juan Pablo Vivas Reinoso" \
    --lists 19 \
    --attribs '{"cohort":"may-2026"}'
  ```

- Añadir o quitar de una lista:

  ```bash
  listmonk subscribers add-to-list 7449 --list 19
  listmonk subscribers remove-from-list 7449 --list 16
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

- Listado en JSON:

  ```bash
  listmonk campaigns list --query "AI Expert" --json
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
listmonk subscribers --help
```

Esto mostrará todas las flags disponibles y descripciones detalladas.
