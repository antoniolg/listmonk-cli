import { readFile } from "fs/promises";
import { Command } from "commander";
import { runWithClient } from "../commandContext.js";
import type {
  CampaignStatus,
  CampaignType,
  ContentType,
  Campaign,
  CreateCampaignInput,
  UpdateCampaignInput,
  UpdateCampaignArchiveInput,
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
    .command("list")
    .description("List campaigns")
    .option("--page <page>", "Page number", parseInteger)
    .option("--per-page <size>", "Items per page", parseInteger)
    .option("--status <status>", "Filter by status")
    .option("--type <type>", "Filter by campaign type (regular, optin)")
    .option("--name <name>", "Filter by campaign name (substring match)")
    .option("--query <query>", "Filter by name or subject (substring match)")
    .action(async (options, command) => {
      await runWithClient(command, async (client) => {
        const response = await client.listCampaigns({
          page: options.page,
          perPage: options.perPage,
        });

        let results = response.results;

        if (options.status) {
          const status = options.status as CampaignStatus;
          if (!ALLOWED_STATUSES.includes(status)) {
            throw new Error(
              `Invalid status "${options.status}". Allowed values: ${ALLOWED_STATUSES.join(", ")}`,
            );
          }
          results = results.filter((campaign) => campaign.status === status);
        }

        if (options.type) {
          const type = options.type as CampaignType;
          assertOneOf("campaign type", type, ALLOWED_CAMPAIGN_TYPES);
          results = results.filter((campaign) => campaign.type === type);
        }

        if (options.name) {
          const needle = String(options.name).toLowerCase();
          results = results.filter((campaign) =>
            campaign.name.toLowerCase().includes(needle),
          );
        }

        if (options.query) {
          const needle = String(options.query).toLowerCase();
          results = results.filter((campaign) => {
            const name = campaign.name.toLowerCase();
            const subject = campaign.subject?.toLowerCase() ?? "";
            return name.includes(needle) || subject.includes(needle);
          });
        }

        if (results.length === 0) {
          console.log("No campaigns found.");
          return;
        }

        console.table(
          results.map((campaign) => ({
            id: campaign.id,
            name: campaign.name,
            status: campaign.status ?? "",
            type: campaign.type ?? "",
            send_at: campaign.send_at ?? "",
            lists: campaign.lists?.length ?? 0,
          })),
        );

        const totalPages = Math.ceil(response.total / response.per_page);
        console.log(
          `Page ${response.page} / ${totalPages} • Total: ${response.total} • Showing: ${results.length}`,
        );
      });
    });

  campaigns
    .command("get")
    .description("Fetch a campaign and print its content")
    .argument("<id>", "Campaign identifier", parseInteger)
    .option("--json", "Output the raw campaign JSON")
    .option("--body-only", "Print only the campaign body (for piping)")
    .action(async (id: number, options, command) => {
      await runWithClient(command, async (client) => {
        if (options.json && options.bodyOnly) {
          throw new Error("Use either --json or --body-only, not both.");
        }

        const campaign = await client.getCampaign(id);

        if (options.bodyOnly) {
          process.stdout.write(campaign.body ?? "");
          return;
        }

        const output = formatCampaignOutput(campaign, { json: options.json });
        process.stdout.write(output);
        if (!output.endsWith("\n")) process.stdout.write("\n");
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
    .option(
      "--send-at <iso>",
      "Schedule timestamp in ISO-8601 format (auto-fills lists if omitted)",
    )
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

        if (payload.sendAt !== undefined && payload.lists === undefined) {
          const campaign = await client.getCampaign(id);
          const listIds =
            campaign.lists?.map((list) => list.id).filter(Boolean) ?? [];
          if (listIds.length === 0) {
            throw new Error(
              "Campaign has no lists assigned; please pass --lists explicitly.",
            );
          }
          payload.lists = listIds;
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
    .option(
      "--send-at <iso>",
      "Schedule timestamp in ISO-8601 format (auto-fills lists if omitted)",
    )
    .action(async (id: number, options, command) => {
      await runWithClient(command, async (client) => {
        const status: CampaignStatus = options.status ?? "scheduled";
        if (!ALLOWED_STATUSES.includes(status)) {
          throw new Error(
            `Invalid status "${status}". Allowed values: ${ALLOWED_STATUSES.join(", ")}`,
          );
        }

        if (options.sendAt) {
          const campaign = await client.getCampaign(id);
          const listIds =
            campaign.lists?.map((list) => list.id).filter(Boolean) ?? [];
          if (listIds.length === 0) {
            throw new Error(
              "Campaign has no lists assigned; please pass --lists via update before scheduling.",
            );
          }
          await client.updateCampaign(id, {
            sendAt: options.sendAt,
            lists: listIds,
          });
        }

        const updated = await client.updateCampaignStatus(id, status);
        console.log(
          `Campaign ${updated.id} now has status ${updated.status}.`,
        );
      });
    });

  campaigns
    .command("archive")
    .description("Manage public archive settings for a campaign")
    .argument("<id>", "Campaign identifier", parseInteger)
    .option("--enable", "Enable public archive for the campaign")
    .option("--disable", "Disable public archive for the campaign")
    .option("--template-id <id>", "Archive template ID", parseInteger)
    .option("--meta <json>", "Archive metadata as JSON")
    .option("--meta-file <path>", "Read archive metadata JSON from file")
    .action(async (id: number, options, command) => {
      await runWithClient(command, async (client) => {
        if (options.enable && options.disable) {
          throw new Error("Use either --enable or --disable, not both.");
        }

        const archiveState =
          options.enable === true ? true : options.disable === true ? false : undefined;

        if (archiveState === undefined) {
          throw new Error("Specify --enable or --disable to set the archive state.");
        }

        const archiveMeta = await resolveArchiveMeta(options);

        const payload: UpdateCampaignArchiveInput = {
          archive: archiveState,
        };

        if (options.templateId !== undefined) {
          payload.archiveTemplateId = options.templateId;
        }

        if (archiveMeta !== undefined) {
          payload.archiveMeta = archiveMeta;
        }

        await client.updateCampaignArchive(id, payload);

        console.log(
          `Campaign ${id} archive ${archiveState ? "enabled" : "disabled"}.`,
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

export function formatCampaignOutput(
  campaign: Campaign,
  options: { json?: boolean } = {},
): string {
  if (options.json) {
    return `${JSON.stringify(campaign, null, 2)}\n`;
  }

  const listIds =
    campaign.lists?.map((list) => list.id).filter((id) => typeof id === "number") ??
    [];

  const lines: string[] = [];
  lines.push(`ID: ${campaign.id}`);
  lines.push(`Name: ${campaign.name}`);
  lines.push(`Subject: ${campaign.subject}`);
  if (campaign.status) lines.push(`Status: ${campaign.status}`);
  if (campaign.type) lines.push(`Type: ${campaign.type}`);
  if (campaign.messenger) lines.push(`Messenger: ${campaign.messenger}`);
  if (campaign.content_type) lines.push(`Content-Type: ${campaign.content_type}`);
  if (campaign.from_email) lines.push(`From: ${campaign.from_email}`);
  if (campaign.send_at) lines.push(`Send-At: ${campaign.send_at}`);
  if (listIds.length > 0) lines.push(`Lists: ${listIds.join(", ")}`);
  if (campaign.tags && campaign.tags.length > 0) {
    lines.push(`Tags: ${campaign.tags.join(", ")}`);
  }

  lines.push("");
  lines.push("--- BODY ---");
  lines.push(campaign.body ?? "");

  return `${lines.join("\n")}\n`;
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

async function resolveArchiveMeta(options: {
  meta?: string;
  metaFile?: string;
}): Promise<Record<string, unknown> | undefined> {
  if (options.meta && options.metaFile) {
    throw new Error("Provide either --meta or --meta-file, not both.");
  }

  const raw = options.metaFile
    ? await readFile(options.metaFile, "utf8")
    : options.meta;

  if (raw === undefined) {
    return undefined;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown JSON parse error";
    throw new Error(`Failed to parse archive metadata JSON: ${message}.`);
  }

  if (parsed === null || Array.isArray(parsed) || typeof parsed !== "object") {
    throw new Error("Archive metadata must be a JSON object.");
  }

  return parsed as Record<string, unknown>;
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
