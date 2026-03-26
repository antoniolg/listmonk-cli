import { readFile } from "fs/promises";
import { Command } from "commander";
import { runWithClient } from "../commandContext.js";
import type {
  CreateSubscriberInput,
  Subscriber,
  SubscriberStatus,
  UpdateSubscriberInput,
} from "../types.js";

const ALLOWED_STATUSES: SubscriberStatus[] = ["enabled", "blocklisted"];

export function registerSubscriberCommands(program: Command): void {
  const subscribers = program
    .command("subscribers")
    .description("Manage Listmonk subscribers");

  subscribers
    .command("list")
    .description("List subscribers")
    .option("--page <page>", "Page number", parseInteger)
    .option("--per-page <size>", "Items per page", parseInteger)
    .option("--query <query>", "Raw Listmonk SQL filter expression")
    .option("--email <email>", "Filter by exact subscriber email")
    .option("--name <name>", "Filter by subscriber name (substring match)")
    .option("--status <status>", "Filter by subscriber status")
    .option("--list-id <id>", "Filter by list ID", parseInteger)
    .option("--json", "Output the raw subscriber JSON")
    .action(async (options, command) => {
      await runWithClient(command, async (client) => {
        if (options.status !== undefined) {
          assertOneOf("subscriber status", options.status, ALLOWED_STATUSES);
        }

        const response = await client.listSubscribers({
          page: options.page,
          perPage: options.perPage,
          query: buildSubscriberQuery({
            query: options.query,
            email: options.email,
            name: options.name,
            status: options.status,
          }),
          listId: options.listId,
        });

        if (options.json) {
          process.stdout.write(`${JSON.stringify(response, null, 2)}\n`);
          return;
        }

        if (response.results.length === 0) {
          console.log("No subscribers found.");
          return;
        }

        console.table(
          response.results.map((subscriber) => ({
            id: subscriber.id ?? "",
            email: subscriber.email,
            name: subscriber.name,
            status: subscriber.status,
            lists: formatSubscriberListsInline(subscriber),
          })),
        );

        const totalPages = Math.ceil(response.total / response.per_page);
        console.log(
          `Page ${response.page} / ${totalPages} • Total: ${response.total}`,
        );
      });
    });

  subscribers
    .command("get")
    .description("Fetch a subscriber and print its details")
    .argument("<id>", "Subscriber identifier", parseInteger)
    .option("--json", "Output the raw subscriber JSON")
    .action(async (id: number, options, command) => {
      await runWithClient(command, async (client) => {
        const subscriber = await client.getSubscriber(id);
        const output = formatSubscriberOutput(subscriber, {
          json: options.json,
        });
        process.stdout.write(output);
        if (!output.endsWith("\n")) process.stdout.write("\n");
      });
    });

  subscribers
    .command("create")
    .description("Create a subscriber")
    .requiredOption("--email <email>", "Subscriber email address")
    .requiredOption("--name <name>", "Subscriber name")
    .option(
      "--lists <ids...>",
      "List IDs to subscribe (space separated, e.g. --lists 1 2)",
    )
    .option(
      "--status <status>",
      "Subscriber status (enabled, blocklisted)",
      "enabled",
    )
    .option("--attribs <json>", "Subscriber attributes as JSON object")
    .option("--attribs-file <path>", "Read subscriber attributes JSON from file")
    .option(
      "--preconfirm-subscriptions",
      "Preconfirm list subscriptions (skip double opt-in)",
    )
    .option("--json", "Output the created subscriber JSON")
    .action(async (options, command) => {
      await runWithClient(command, async (client) => {
        const status = options.status as SubscriberStatus;
        assertOneOf("subscriber status", status, ALLOWED_STATUSES);

        const payload: CreateSubscriberInput = {
          email: options.email,
          name: options.name,
          status,
        };

        if (options.lists !== undefined) {
          payload.lists = parseIntegerList(options.lists, "lists");
        }

        const attribs = await resolveAttribs(options);
        if (attribs !== undefined) {
          payload.attribs = attribs;
        }

        if (options.preconfirmSubscriptions) {
          payload.preconfirmSubscriptions = true;
        }

        const subscriber = await client.createSubscriber(payload);

        if (options.json) {
          process.stdout.write(`${JSON.stringify(subscriber, null, 2)}\n`);
          return;
        }

        console.log(
          `Created subscriber ${subscriber.id ?? ""} (${subscriber.email}).`,
        );
      });
    });

  subscribers
    .command("update")
    .description("Update an existing subscriber")
    .argument("<id>", "Subscriber identifier", parseInteger)
    .option("--email <email>", "Subscriber email address")
    .option("--name <name>", "Subscriber name")
    .option("--status <status>", "Subscriber status (enabled, blocklisted)")
    .option(
      "--lists <ids...>",
      "Replace subscriber list IDs (space separated, e.g. --lists 1 2)",
    )
    .option("--clear-lists", "Remove the subscriber from all lists")
    .option("--attribs <json>", "Subscriber attributes as JSON object")
    .option("--attribs-file <path>", "Read subscriber attributes JSON from file")
    .option("--clear-attribs", "Remove all subscriber attributes")
    .option(
      "--preconfirm-subscriptions",
      "Preconfirm any updated list subscriptions",
    )
    .option("--json", "Output the updated subscriber JSON")
    .action(async (id: number, options, command) => {
      await runWithClient(command, async (client) => {
        if (options.status !== undefined) {
          assertOneOf("subscriber status", options.status, ALLOWED_STATUSES);
        }
        if (options.lists && options.clearLists) {
          throw new Error("Use either --lists or --clear-lists, not both.");
        }
        if ((options.attribs || options.attribsFile) && options.clearAttribs) {
          throw new Error(
            "Use either --attribs/--attribs-file or --clear-attribs, not both.",
          );
        }

        const current = await client.getSubscriber(id);
        const payload = await buildUpdatedSubscriberPayload(current, options);

        if (!hasSubscriberChanges(current, payload)) {
          console.log("No changes supplied. Nothing to update.");
          return;
        }

        const updated = await client.updateSubscriber(id, payload);

        if (options.json) {
          process.stdout.write(`${JSON.stringify(updated, null, 2)}\n`);
          return;
        }

        console.log(
          `Updated subscriber ${updated.id ?? id} (${updated.email}).`,
        );
      });
    });

  subscribers
    .command("add-to-list")
    .description("Add a subscriber to a list")
    .argument("<id>", "Subscriber identifier", parseInteger)
    .requiredOption("--list <id>", "List ID to add", parseInteger)
    .option(
      "--preconfirm-subscriptions",
      "Preconfirm the new list subscription",
    )
    .option("--json", "Output the updated subscriber JSON")
    .action(async (id: number, options, command) => {
      await runWithClient(command, async (client) => {
        const current = await client.getSubscriber(id);
        const currentLists = getSubscriberListIds(current);

        if (currentLists.includes(options.list)) {
          if (options.json) {
            process.stdout.write(`${JSON.stringify(current, null, 2)}\n`);
            return;
          }

          console.log(
            `Subscriber ${current.id ?? id} is already in list ${options.list}.`,
          );
          return;
        }

        const updated = await client.updateSubscriber(id, {
          email: current.email,
          name: current.name,
          status: current.status,
          attribs: current.attribs,
          lists: [...currentLists, options.list],
          preconfirmSubscriptions: options.preconfirmSubscriptions
            ? true
            : undefined,
        });

        if (options.json) {
          process.stdout.write(`${JSON.stringify(updated, null, 2)}\n`);
          return;
        }

        console.log(
          `Added subscriber ${updated.id ?? id} (${updated.email}) to list ${options.list}.`,
        );
      });
    });

  subscribers
    .command("remove-from-list")
    .description("Remove a subscriber from a list")
    .argument("<id>", "Subscriber identifier", parseInteger)
    .requiredOption("--list <id>", "List ID to remove", parseInteger)
    .option("--json", "Output the updated subscriber JSON")
    .action(async (id: number, options, command) => {
      await runWithClient(command, async (client) => {
        const current = await client.getSubscriber(id);
        const currentLists = getSubscriberListIds(current);

        if (!currentLists.includes(options.list)) {
          if (options.json) {
            process.stdout.write(`${JSON.stringify(current, null, 2)}\n`);
            return;
          }

          console.log(
            `Subscriber ${current.id ?? id} is not in list ${options.list}.`,
          );
          return;
        }

        const updated = await client.updateSubscriber(id, {
          email: current.email,
          name: current.name,
          status: current.status,
          attribs: current.attribs,
          lists: currentLists.filter((listId) => listId !== options.list),
        });

        if (options.json) {
          process.stdout.write(`${JSON.stringify(updated, null, 2)}\n`);
          return;
        }

        console.log(
          `Removed subscriber ${updated.id ?? id} (${updated.email}) from list ${options.list}.`,
        );
      });
    });
}

export function formatSubscriberOutput(
  subscriber: Subscriber,
  options: { json?: boolean } = {},
): string {
  if (options.json) {
    return `${JSON.stringify(subscriber, null, 2)}\n`;
  }

  const lines: string[] = [];
  lines.push(`ID: ${subscriber.id ?? ""}`);
  lines.push(`Name: ${subscriber.name}`);
  lines.push(`Email: ${subscriber.email}`);
  lines.push(`Status: ${subscriber.status}`);

  const lists = subscriber.lists ?? [];
  if (lists.length > 0) {
    lines.push(
      `Lists: ${lists.map((list) => `${list.id}:${list.name}`).join(", ")}`,
    );
  }

  if (subscriber.attribs && Object.keys(subscriber.attribs).length > 0) {
    lines.push(`Attribs: ${JSON.stringify(subscriber.attribs)}`);
  }

  if (subscriber.created_at) lines.push(`Created-At: ${subscriber.created_at}`);
  if (subscriber.updated_at) lines.push(`Updated-At: ${subscriber.updated_at}`);

  return `${lines.join("\n")}\n`;
}

export function buildSubscriberQuery(input: {
  query?: string;
  email?: string;
  name?: string;
  status?: string;
}): string | undefined {
  const clauses: string[] = [];

  if (input.query) {
    clauses.push(`(${input.query})`);
  }
  if (input.email) {
    clauses.push(`subscribers.email = '${escapeSqlLiteral(input.email)}'`);
  }
  if (input.name) {
    clauses.push(
      `subscribers.name ILIKE '%${escapeSqlLikeLiteral(input.name)}%'`,
    );
  }
  if (input.status) {
    clauses.push(`subscribers.status = '${escapeSqlLiteral(input.status)}'`);
  }

  if (clauses.length === 0) {
    return undefined;
  }

  return clauses.join(" AND ");
}

async function buildUpdatedSubscriberPayload(
  current: Subscriber,
  options: {
    email?: string;
    name?: string;
    status?: SubscriberStatus;
    lists?: string[];
    clearLists?: boolean;
    attribs?: string;
    attribsFile?: string;
    clearAttribs?: boolean;
    preconfirmSubscriptions?: boolean;
  },
): Promise<UpdateSubscriberInput> {
  let lists = getSubscriberListIds(current);
  if (options.clearLists) {
    lists = [];
  } else if (options.lists !== undefined) {
    lists = parseIntegerList(options.lists, "lists");
  }

  let attribs = current.attribs;
  if (options.clearAttribs) {
    attribs = {};
  } else {
    const resolvedAttribs = await resolveAttribs(options);
    if (resolvedAttribs !== undefined) {
      attribs = resolvedAttribs;
    }
  }

  return {
    email: options.email ?? current.email,
    name: options.name ?? current.name,
    status: options.status ?? current.status,
    lists,
    attribs,
    preconfirmSubscriptions: options.preconfirmSubscriptions ? true : undefined,
  };
}

function hasSubscriberChanges(
  current: Subscriber,
  next: UpdateSubscriberInput,
): boolean {
  return (
    next.email !== current.email ||
    next.name !== current.name ||
    next.status !== current.status ||
    JSON.stringify(next.attribs ?? {}) !==
      JSON.stringify(current.attribs ?? {}) ||
    JSON.stringify(next.lists ?? []) !==
      JSON.stringify(getSubscriberListIds(current))
  );
}

function getSubscriberListIds(subscriber: Subscriber): number[] {
  return (
    subscriber.lists
      ?.map((list) => list.id)
      .filter((id): id is number => typeof id === "number") ?? []
  );
}

function formatSubscriberListsInline(subscriber: Subscriber): string {
  const names = subscriber.lists?.map((list) => list.name).filter(Boolean) ?? [];
  return names.join(", ");
}

async function resolveAttribs(options: {
  attribs?: string;
  attribsFile?: string;
}): Promise<Record<string, unknown> | undefined> {
  if (options.attribs && options.attribsFile) {
    throw new Error("Provide either --attribs or --attribs-file, not both.");
  }

  const raw = options.attribsFile
    ? await readFile(options.attribsFile, "utf8")
    : options.attribs;

  if (raw === undefined) {
    return undefined;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown JSON parse error";
    throw new Error(`Failed to parse subscriber attributes JSON: ${message}.`);
  }

  if (parsed === null || Array.isArray(parsed) || typeof parsed !== "object") {
    throw new Error("Subscriber attributes must be a JSON object.");
  }

  return parsed as Record<string, unknown>;
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

function escapeSqlLiteral(value: string): string {
  return value.replace(/'/g, "''");
}

function escapeSqlLikeLiteral(value: string): string {
  return escapeSqlLiteral(value).replace(/[%_]/g, "\\$&");
}
