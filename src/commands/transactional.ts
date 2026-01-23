import { readFile } from "fs/promises";
import { Command } from "commander";
import { runWithClient } from "../commandContext.js";
import type { ContentType, TransactionalMessageInput } from "../types.js";

const ALLOWED_CONTENT_TYPES: ContentType[] = [
  "richtext",
  "html",
  "markdown",
  "plain",
];

export function registerTransactionalCommands(program: Command): void {
  const tx = program
    .command("tx")
    .description("Send transactional emails");

  tx
    .command("send")
    .description("Send a transactional email")
    .option("--subscriber-email <email>", "Subscriber email address")
    .option("--subscriber-id <id>", "Subscriber ID", parseInteger)
    .option("--template-id <id>", "Template ID", parseInteger)
    .option("--template-name <name>", "Template name")
    .option("--data <json>", "Template data as JSON")
    .option("--data-file <path>", "Read template data JSON from file")
    .option("--headers <json>", "Custom headers as JSON array")
    .option("--headers-file <path>", "Read headers JSON from file")
    .option("--messenger <messenger>", "Messenger (default: email)")
    .option(
      "--content-type <type>",
      "Content type (richtext, html, markdown, plain)",
    )
    .action(async (options, command) => {
      await runWithClient(command, async (client) => {
        const subscriberEmail = normalizeString(options.subscriberEmail);
        const subscriberId = options.subscriberId as number | undefined;
        const templateId = options.templateId as number | undefined;
        const templateName = normalizeString(options.templateName);

        if (!subscriberEmail && subscriberId === undefined) {
          throw new Error("Provide --subscriber-email or --subscriber-id.");
        }

        if (templateId === undefined && !templateName) {
          throw new Error("Provide --template-id or --template-name.");
        }

        if (options.contentType) {
          assertOneOf(
            "content type",
            options.contentType,
            ALLOWED_CONTENT_TYPES,
          );
        }

        const data = await resolveJsonObject(
          options.data,
          options.dataFile,
          "data",
        );
        const headers = await resolveHeaders(options.headers, options.headersFile);

        const payload: TransactionalMessageInput = {
          subscriberEmail: subscriberEmail ?? undefined,
          subscriberId,
          templateId,
          templateName: templateName ?? undefined,
          data: data ?? undefined,
          headers: headers ?? undefined,
          messenger: normalizeString(options.messenger) ?? undefined,
          contentType: options.contentType,
        };

        await client.sendTransactionalEmail(payload);

        const target = subscriberEmail ?? `subscriber ${subscriberId}`;
        console.log(`Transactional email sent to ${target}.`);
      });
    });
}

function parseInteger(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`Expected a number but received "${value}".`);
  }
  return parsed;
}

function normalizeString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

async function resolveJsonObject(
  inline: string | undefined,
  filePath: string | undefined,
  label: string,
): Promise<Record<string, unknown> | undefined> {
  if (inline && filePath) {
    throw new Error(`Provide either --${label} or --${label}-file, not both.`);
  }

  const raw = filePath ? await readFile(filePath, "utf8") : inline;
  if (raw === undefined) {
    return undefined;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown JSON parse error";
    throw new Error(`Failed to parse ${label} JSON: ${message}.`);
  }

  if (parsed === null || Array.isArray(parsed) || typeof parsed !== "object") {
    throw new Error(`${label} must be a JSON object.`);
  }

  return parsed as Record<string, unknown>;
}

async function resolveHeaders(
  inline: string | undefined,
  filePath: string | undefined,
): Promise<Array<Record<string, string>> | undefined> {
  if (inline && filePath) {
    throw new Error("Provide either --headers or --headers-file, not both.");
  }

  const raw = filePath ? await readFile(filePath, "utf8") : inline;
  if (raw === undefined) {
    return undefined;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown JSON parse error";
    throw new Error(`Failed to parse headers JSON: ${message}.`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error("Headers must be a JSON array.");
  }

  const headers = parsed.map((entry, index) => {
    if (entry === null || Array.isArray(entry) || typeof entry !== "object") {
      throw new Error(`Header entry at index ${index} must be an object.`);
    }

    const record: Record<string, string> = {};
    for (const [key, value] of Object.entries(entry as Record<string, unknown>)) {
      if (typeof value !== "string") {
        throw new Error(
          `Header value for "${key}" at index ${index} must be a string.`,
        );
      }
      record[key] = value;
    }

    return record;
  });

  return headers;
}

function assertOneOf<T extends string>(
  label: string,
  value: string,
  allowed: readonly T[],
): asserts value is T {
  if (!allowed.includes(value as T)) {
    throw new Error(
      `Invalid ${label} "${value}". Allowed values: ${allowed.join(", ")}`,
    );
  }
}
