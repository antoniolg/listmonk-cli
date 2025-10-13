import type { Command } from "commander";
import {
  ConfigError,
  ConfigOverrides,
  resolveConfig,
} from "./config.js";
import {
  ListmonkApiError,
  ListmonkClient,
} from "./listmonkClient.js";

type KnownError = ConfigError | ListmonkApiError;

export async function runWithClient(
  command: Command,
  handler: (client: ListmonkClient) => Promise<void>,
): Promise<void> {
  try {
    const client = buildClient(command);
    await handler(client);
  } catch (error) {
    if (!handleKnownError(error)) {
      throw error;
    }
    process.exitCode = process.exitCode ?? 1;
  }
}

export function buildClient(command: Command): ListmonkClient {
  const overrides = extractOverrides(command);
  const config = resolveConfig(overrides);
  return new ListmonkClient(config);
}

function extractOverrides(command: Command): ConfigOverrides {
  const options = command.optsWithGlobals?.() ?? command.opts();
  const overrides: ConfigOverrides = {};

  if (typeof options.baseUrl === "string") overrides.baseUrl = options.baseUrl;
  if (typeof options.username === "string") overrides.username = options.username;
  if (typeof options.apiKey === "string") overrides.apiKey = options.apiKey;
  if (typeof options.timeout === "number") overrides.timeout = options.timeout;
  if (typeof options.retryCount === "number") overrides.retryCount = options.retryCount;

  return overrides;
}

function handleKnownError(error: unknown): error is KnownError {
  if (error instanceof ConfigError) {
    console.error(`[config] ${error.message}`);
    return true;
  }

  if (error instanceof ListmonkApiError) {
    const status = error.status ? ` (status ${error.status})` : "";
    console.error(`[api] ${error.message}${status}`);
    if (error.body != null && process.env.DEBUG === "1") {
      console.error(JSON.stringify(error.body, null, 2));
    }
    return true;
  }

  return false;
}
