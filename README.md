## Listmonk CLI

TypeScript CLI to manage Listmonk campaigns (newsletters) and lists.

### Requirements

- Node.js 18.17 or newer
- `npm` or `pnpm`
- Listmonk API credentials (username + API key) with campaign and list permissions

### Installation

```bash
npm install
```

This installs dependencies, including `typescript`. Then build:

```bash
npm run build
```

The compiled binary lives at `dist/index.js` and can be run as `node dist/index.js …`.  
To add it to your PATH, use `npm link` or run it via `npx`.

### Configuration

The CLI reads configuration from environment variables or CLI flags:

- `LISTMONK_BASE_URL` – Base URL (`https://your-server`).
- `LISTMONK_USERNAME` – API username (default: `api`).
- `LISTMONK_API_KEY` – API key or password.
- `LISTMONK_TIMEOUT` – Timeout in ms (optional, default 30000).
- `LISTMONK_RETRY_COUNT` – Retry count for transient errors (optional, default 3).

You can override these per command:

```bash
listmonk --base-url https://your-server --api-key xxx campaigns list
```

### Usage

General help:

```bash
node dist/index.js --help
```

#### Lists

```bash
node dist/index.js lists --page 1 --per-page 20
```

#### Templates

```bash
node dist/index.js templates list
```

Filter by type or name:

```bash
node dist/index.js templates list --type tx --query welcome
```

#### Subscribers

```bash
node dist/index.js subscribers create \\
  --email "user@example.com" \\
  --name "User Name" \\
  --lists 1 2 \\
  --preconfirm-subscriptions
```

#### List campaigns

```bash
node dist/index.js campaigns list --page 1 --per-page 20 --status scheduled
```

#### Create campaign

```bash
node dist/index.js campaigns create \
  --name "April newsletter" \
  --subject "April updates" \
  --lists 1 2 \
  --body-file content.html \
  --from-email "team@example.com" \
  --content-type html \
  --tags monthly highlights
```

#### Update campaign

```bash
node dist/index.js campaigns update 42 \
  --subject "Updated subject" \
  --send-at "2024-04-20T20:00:00Z"

Note: if Listmonk requires `lists` when updating `send_at`, the CLI auto-fills
them from the existing campaign unless you pass `--lists`.
```

#### Schedule/send campaign

```bash
node dist/index.js campaigns schedule 42 --status scheduled --send-at "2024-04-20T20:00:00Z"
```

#### Delete campaign

```bash
node dist/index.js campaigns delete 42
```

#### Send transactional email

```bash
node dist/index.js tx send \
  --subscriber-email "user@example.com" \
  --template-id 12 \
  --data '{"name":"Antonio","topic":"Arquitectura"}'
```

You can also use `--subscriber-id`, `--template-name`, `--data-file`, and
optionally set `--headers` (JSON array), `--headers-file`, `--messenger`, or
`--content-type`.

### Debugging

Set `DEBUG=1` to show full API payloads on errors:

```bash
DEBUG=1 node dist/index.js campaigns create …
```

### Suggested next steps

- Add more commands (subscribers, templates) using the HTTP client.
- Add automated tests and validation.
- Package the CLI as an npm package for global install.
