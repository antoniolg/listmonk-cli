#!/usr/bin/env node
import { Command } from "commander";
import { registerCampaignCommands } from "./commands/campaigns.js";
import { registerListCommands } from "./commands/lists.js";
import { ConfigError } from "./config.js";
import { ListmonkApiError } from "./listmonkClient.js";

const program = new Command();

program
  .name("listmonk")
  .description("Command-line interface for Listmonk campaigns and lists")
  .version("0.1.0")
  .option("--base-url <url>", "Listmonk base URL")
  .option("--username <username>", "API username (default: api)")
  .option("--api-key <key>", "API key/token for Listmonk")
  .option(
    "--timeout <ms>",
    "Request timeout in milliseconds (default: 30000)",
    parseIntegerOption,
  )
  .option(
    "--retry-count <count>",
    "Number of retries for transient errors (default: 3)",
    parseIntegerOption,
  );

registerListCommands(program);
registerCampaignCommands(program);

void program.parseAsync(process.argv).catch((error) => {
  if (handleKnownTopLevelError(error)) {
    process.exitCode = process.exitCode ?? 1;
    return;
  }

  console.error(error);
  process.exit(1);
});

function parseIntegerOption(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`Expected a number but received "${value}".`);
  }
  return parsed;
}

function handleKnownTopLevelError(error: unknown): boolean {
  if (error instanceof ConfigError) {
    console.error(`[config] ${error.message}`);
    return true;
  }

  if (error instanceof ListmonkApiError) {
    console.error(
      `[api] ${error.message}${
        error.status ? ` (status ${error.status})` : ""
      }`,
    );
    return true;
  }

  if (error instanceof Error) {
    console.error(error.message);
    return true;
  }

  return false;
}
