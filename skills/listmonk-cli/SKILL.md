---
name: listmonk-cli
description: Use the `listmonk` CLI to inspect lists/templates/campaigns, create or update newsletter campaigns, and send transactional emails. Use when the user asks about Listmonk newsletters, mailing lists, campaign drafts, scheduling, or subscriber operations that may need CLI first and API fallback.
---

# Listmonk CLI

Use this skill to operate Listmonk from terminal via the `listmonk` command.

Important:
- The executable is `listmonk`, not `listmonk-cli`.
- Prefer the CLI first.
- If the task needs subscriber search, subscriber update, moving a subscriber between lists, or an exact live member count for a list, fall back to the Listmonk HTTP API because the current CLI does not expose those operations.

## Requirements

- Assume `listmonk` is already installed and on `PATH`.
- Assume auth is already available through `LISTMONK_BASE_URL`, `LISTMONK_USERNAME`, and `LISTMONK_API_KEY`.
- Do not hunt for credentials up front.
- If the CLI fails for missing config, surface exactly what is missing.

Quick check:

```bash
listmonk --help
listmonk --version
```

## What The CLI Supports

Verified from `listmonk --help` in this environment:
- `lists`
- `campaigns create|list|get|update|schedule|archive|delete`
- `subscribers create`
- `templates list`
- `tx send`

Current CLI version seen here: `0.1.0`

## Safe Workflow

1. List lists/templates/campaigns first. Do not assume IDs from memory.
2. For newsletter work, create or inspect the campaign via CLI.
3. Require explicit authorization for these destructive or external actions. Reuse approval already given for the same payload, destination, and schedule; reconfirm only after a material change or an explicit fresh-approval requirement. This applies before:
   - scheduling a campaign
   - deleting a campaign
   - sending a transactional email
4. For subscriber mutations beyond `create`, use the API fallback below.

## Core Commands

List mailing lists:

```bash
listmonk lists --per-page 200
listmonk lists --query "AI Expert"
```

List campaigns:

```bash
listmonk campaigns list --per-page 20
listmonk campaigns list --status scheduled --per-page 20
listmonk campaigns list --query "AI Expert" --per-page 20
```

Inspect one campaign:

```bash
listmonk campaigns get 169
listmonk campaigns get 169 --json
listmonk campaigns get 169 --body-only
```

List templates:

```bash
listmonk templates list
listmonk templates list --type tx
listmonk templates list --query "AI Expert"
```

Create a newsletter draft:

```bash
listmonk campaigns create \
  --name "Newsletter semanal - 26 marzo 2026" \
  --subject "Asunto" \
  --lists 3 \
  --template-id 1 \
  --content-type markdown \
  --body-file /tmp/newsletter-2026-03-26.md
```

Update a draft:

```bash
listmonk campaigns update 169 \
  --subject "Asunto actualizado" \
  --body-file /tmp/newsletter-2026-03-26.md
```

Enable public archive:

```bash
listmonk campaigns archive 169 --enable
```

Schedule a campaign:

```bash
listmonk campaigns schedule 169 \
  --send-at "2026-03-28T10:30:00+01:00"
```

Create a subscriber:

```bash
listmonk subscribers create \
  --email "user@example.com" \
  --name "User Example" \
  --lists 19 \
  --preconfirm-subscriptions
```

Send a transactional email:

```bash
listmonk tx send \
  --subscriber-email "user@example.com" \
  --template-name "Compra AI Expert" \
  --data '{"name":"Antonio"}'
```

## API Fallbacks The CLI Does Not Cover Well

Use the HTTP API directly when the CLI is not enough.

Find a subscriber by email:

```bash
QUERY=$(python3 - <<'PY'
import urllib.parse
print(urllib.parse.quote("subscribers.email = 'user@example.com'"))
PY
)

curl -s -u "$LISTMONK_USERNAME:$LISTMONK_API_KEY" \
  "$LISTMONK_BASE_URL/api/subscribers?query=$QUERY&per_page=10" | jq .
```

Read one subscriber:

```bash
curl -s -u "$LISTMONK_USERNAME:$LISTMONK_API_KEY" \
  "$LISTMONK_BASE_URL/api/subscribers/7449" | jq '.data'
```

Move a subscriber to a different list by replacing `lists`:

```bash
curl -s -u "$LISTMONK_USERNAME:$LISTMONK_API_KEY" \
  -X PUT "$LISTMONK_BASE_URL/api/subscribers/7449" \
  -H 'Content-Type: application/json' \
  --data '{"email":"user@example.com","name":"User Example","status":"enabled","attribs":{},"lists":[19],"preconfirm_subscriptions":true}' | jq '.data'
```

Get the real current member count of a list:

```bash
curl -s -u "$LISTMONK_USERNAME:$LISTMONK_API_KEY" \
  "$LISTMONK_BASE_URL/api/subscribers?list_id=19&per_page=500" | jq '.data.total'
```

Important:
- Do not trust `subscriber_count` from `listmonk lists` as the exact live size of a cohort list. It can drift from the direct subscribers query.
- For AI Expert cohort counts, prefer `/api/subscribers?list_id=<id>` and read `.data.total`.

## Antonio-Specific Notes

- For AI Expert and similar cohort work, always list lists first and confirm the target cohort ID before mutating anything.
- `weekly-newsletter` should use this skill as the operational reference for Listmonk commands.
- Base URL can also be checked in `~/.config/skills/config.json` if you need to open the admin UI after creating a campaign.

## References

- For quick CLI context: [AI_CONTEXT.md](../../AI_CONTEXT.md)
- For implementation details or missing commands: inspect `src/commands/*.ts`
