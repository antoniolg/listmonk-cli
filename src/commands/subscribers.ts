import { Command } from "commander";
import { runWithClient } from "../commandContext.js";
import type {
  CreateSubscriberInput,
  SubscriberStatus,
} from "../types.js";

const ALLOWED_STATUSES: SubscriberStatus[] = ["enabled", "blocklisted"];

export function registerSubscriberCommands(program: Command): void {
  const subscribers = program
    .command("subscribers")
    .description("Manage Listmonk subscribers");

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
    .option(
      "--preconfirm-subscriptions",
      "Preconfirm list subscriptions (skip double opt-in)",
    )
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

        if (options.preconfirmSubscriptions) {
          payload.preconfirmSubscriptions = true;
        }

        const subscriber = await client.createSubscriber(payload);
        console.log(
          `Created subscriber ${subscriber.id ?? ""} (${subscriber.email}).`,
        );
      });
    });
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
