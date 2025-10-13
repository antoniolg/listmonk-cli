import { readFile } from "fs/promises";
import { Command } from "commander";
import { runWithClient } from "../commandContext.js";
import type {
  CampaignStatus,
  CampaignType,
  ContentType,
  CreateCampaignInput,
  UpdateCampaignInput,
} from "../types.js";

const ALLOWED_STATUSES: CampaignStatus[] = [
  "draft",
  "scheduled",
  "running",
  "paused",
  "finished",
  "cancelled",
];

const ALLOWED_CONTENT_TYPES: ContentType[] = [
  "richtext",
  "html",
  "markdown",
  "plain",
];

const ALLOWED_CAMPAIGN_TYPES: CampaignType[] = ["regular", "optin"];

export function registerCampaignCommands(program: Command): void {
  const campaigns = program
    .command("campaigns")
    .description("Manage Listmonk campaigns (newsletters)");

  campaigns
    .command("create")
    .description("Create a new campaign")
    .requiredOption("--name <name>", "Campaign name")
    .requiredOption("--subject <subject>", "Email subject")
    .requiredOption(
      "--lists <ids...>",
      "List IDs to target (space separated, e.g. --lists 1 2)",
    )
    .option("--body <body>", "Campaign body content")
    .option("--body-file <path>", "Read body content from file")
    .option("--from-email <email>", "Sender email address")
    .option("--content-type <type>", "Content type (richtext, html, markdown, plain)")
    .option("--messenger <messenger>", "Messenger (default: email)")
    .option("--type <type>", "Campaign type (regular, optin)")
    .option("--tags <tags...>", "Tags to assign to the campaign")
    .option("--template-id <id>", "Template ID", parseInteger)
    .option("--send-at <iso>", "Schedule timestamp in ISO-8601 format")
    .action(async (options, command) => {
      await runWithClient(command, async (client) => {
        const lists = parseIntegerList(options.lists, "lists");
        const tags = parseStringList(options.tags);
        const body = await resolveBody(options);

        if (options.contentType) {
          assertOneOf(
            "content type",
            options.contentType,
            ALLOWED_CONTENT_TYPES,
          );
        }

        if (options.type) {
          assertOneOf("campaign type", options.type, ALLOWED_CAMPAIGN_TYPES);
        }

        const payload: CreateCampaignInput = {
          name: options.name,
          subject: options.subject,
          lists,
          body,
          fromEmail: options.fromEmail,
          contentType: options.contentType,
          messenger: options.messenger,
          type: options.type,
          tags,
          templateId: options.templateId,
          sendAt: options.sendAt,
        };

        const campaign = await client.createCampaign(payload);
        console.log(
          `Created campaign ${campaign.id} (${campaign.name}) with status ${campaign.status ?? "draft"}.`,
        );
      });
    });

  campaigns
    .command("update")
    .description("Update an existing campaign")
    .argument("<id>", "Campaign identifier", parseInteger)
    .option("--name <name>", "Campaign name")
    .option("--subject <subject>", "Email subject")
    .option("--lists <ids...>", "List IDs to target (space separated)")
    .option("--body <body>", "Campaign body content")
    .option("--body-file <path>", "Read body content from file")
    .option("--from-email <email>", "Sender email address")
    .option("--content-type <type>", "Content type (richtext, html, markdown, plain)")
    .option("--messenger <messenger>", "Messenger (default: email)")
    .option("--type <type>", "Campaign type (regular, optin)")
    .option("--tags <tags...>", "Tags to assign to the campaign")
    .option("--template-id <id>", "Template ID", parseInteger)
    .option("--send-at <iso>", "Schedule timestamp in ISO-8601 format")
    .action(async (id: number, options, command) => {
      await runWithClient(command, async (client) => {
        const payload: UpdateCampaignInput = {};

        if (options.name !== undefined) payload.name = options.name;
        if (options.subject !== undefined) payload.subject = options.subject;
        if (options.lists !== undefined) {
          payload.lists = parseIntegerList(options.lists, "lists");
        }
        if (options.fromEmail !== undefined) {
          payload.fromEmail = options.fromEmail;
        }
        if (options.contentType !== undefined) {
          payload.contentType = options.contentType;
          assertOneOf(
            "content type",
            options.contentType,
            ALLOWED_CONTENT_TYPES,
          );
        }
        if (options.messenger !== undefined) {
          payload.messenger = options.messenger;
        }
        if (options.type !== undefined) {
          payload.type = options.type;
          assertOneOf("campaign type", options.type, ALLOWED_CAMPAIGN_TYPES);
        }
        if (options.tags !== undefined) {
          payload.tags = parseStringList(options.tags);
        }
        if (options.templateId !== undefined) {
          payload.templateId = options.templateId;
        }
        if (options.sendAt !== undefined) {
          payload.sendAt = options.sendAt;
        }

        const body = await resolveBody(options);
        if (body !== undefined) {
          payload.body = body;
        }

        if (Object.keys(payload).length === 0) {
          console.log("No changes supplied. Nothing to update.");
          return;
        }

        const updated = await client.updateCampaign(id, payload);
        console.log(
          `Updated campaign ${updated.id} (${updated.name}). Current status: ${updated.status ?? "unknown"}.`,
        );
      });
    });

  campaigns
    .command("schedule")
    .description("Schedule or change the status of a campaign")
    .argument("<id>", "Campaign identifier", parseInteger)
    .option("--status <status>", "Target status (default: scheduled)")
    .option("--send-at <iso>", "Schedule timestamp in ISO-8601 format")
    .action(async (id: number, options, command) => {
      await runWithClient(command, async (client) => {
        const status: CampaignStatus = options.status ?? "scheduled";
        if (!ALLOWED_STATUSES.includes(status)) {
          throw new Error(
            `Invalid status "${status}". Allowed values: ${ALLOWED_STATUSES.join(", ")}`,
          );
        }

        if (options.sendAt) {
          await client.updateCampaign(id, { sendAt: options.sendAt });
        }

        const updated = await client.updateCampaignStatus(id, status);
        console.log(
          `Campaign ${updated.id} now has status ${updated.status}.`,
        );
      });
    });

  campaigns
    .command("delete")
    .description("Delete a campaign")
    .argument("<id>", "Campaign identifier", parseInteger)
    .action(async (id: number, options, command) => {
      await runWithClient(command, async (client) => {
        await client.deleteCampaign(id);
        console.log(`Deleted campaign ${id}.`);
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

function parseIntegerList(value: unknown, label: string): number[] {
  if (!Array.isArray(value) && typeof value !== "string") {
    throw new Error(`Expected ${label} to be provided.`);
  }

  const items = Array.isArray(value) ? value : value.split(",");
  const numbers = items
    .map((item) => {
      const trimmed = String(item).trim();
      if (!trimmed) {
        return undefined;
      }
      const parsed = Number.parseInt(trimmed, 10);
      if (Number.isNaN(parsed)) {
        throw new Error(`Invalid number "${item}" in ${label}.`);
      }
      return parsed;
    })
    .filter((item): item is number => item !== undefined);

  if (numbers.length === 0) {
    throw new Error(`At least one value is required for ${label}.`);
  }

  return numbers;
}

function parseStringList(value: unknown): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (Array.isArray(value)) {
    return value.map((item) => String(item));
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  throw new Error("Expected a list of strings.");
}

async function resolveBody(options: {
  body?: string;
  bodyFile?: string;
}): Promise<string | undefined> {
  if (options.body && options.bodyFile) {
    throw new Error("Provide either --body or --body-file, not both.");
  }

  if (options.bodyFile) {
    const fileContents = await readFile(options.bodyFile, "utf8");
    return fileContents;
  }

  if (options.body !== undefined) {
    return options.body;
  }

  return undefined;
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
