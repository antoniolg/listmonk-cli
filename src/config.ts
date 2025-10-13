import dotenv from "dotenv";

dotenv.config();

export interface ConfigOverrides {
  baseUrl?: string;
  username?: string;
  apiKey?: string;
  timeout?: number;
  retryCount?: number;
}

export interface ListmonkConfig {
  baseUrl: string;
  username: string;
  apiKey: string;
  timeoutMs: number;
  retryCount: number;
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

const DEFAULT_TIMEOUT = 30_000;
const DEFAULT_RETRY_COUNT = 3;

export function resolveConfig(overrides: ConfigOverrides = {}): ListmonkConfig {
  const rawBaseUrl = overrides.baseUrl ?? process.env.LISTMONK_BASE_URL;
  const username =
    overrides.username ?? process.env.LISTMONK_USERNAME ?? "api";
  const apiKey = overrides.apiKey ?? process.env.LISTMONK_API_KEY;
  const timeoutRaw = overrides.timeout ?? readNumberEnv("LISTMONK_TIMEOUT");
  const retryRaw =
    overrides.retryCount ?? readNumberEnv("LISTMONK_RETRY_COUNT");

  if (!rawBaseUrl || !rawBaseUrl.trim()) {
    throw new ConfigError(
      "Base URL is required. Provide --base-url or set LISTMONK_BASE_URL.",
    );
  }

  const normalizedBaseUrl = normalizeBaseUrl(rawBaseUrl);

  if (!username || !username.trim()) {
    throw new ConfigError(
      "Username is required. Provide --username or set LISTMONK_USERNAME.",
    );
  }

  if (!apiKey || !apiKey.trim()) {
    throw new ConfigError(
      "API key is required. Provide --api-key or set LISTMONK_API_KEY.",
    );
  }

  const timeoutMs =
    typeof timeoutRaw === "number" && !Number.isNaN(timeoutRaw)
      ? timeoutRaw
      : DEFAULT_TIMEOUT;

  const retryCount =
    typeof retryRaw === "number" && !Number.isNaN(retryRaw)
      ? retryRaw
      : DEFAULT_RETRY_COUNT;

  if (timeoutMs <= 0) {
    throw new ConfigError("Timeout must be a positive number.");
  }

  if (retryCount < 0) {
    throw new ConfigError("Retry count cannot be negative.");
  }

  return {
    baseUrl: normalizedBaseUrl,
    username: username.trim(),
    apiKey: apiKey.trim(),
    timeoutMs,
    retryCount,
  };
}

function normalizeBaseUrl(value: string): string {
  try {
    const url = new URL(value);
    url.pathname = url.pathname.replace(/\/+$/, "");
    const formatted = url.toString().replace(/\/+$/, "");
    return formatted;
  } catch {
    throw new ConfigError(
      `Base URL "${value}" is not valid. Include the protocol, e.g. https://example.com.`,
    );
  }
}

function readNumberEnv(envName: string): number | undefined {
  const raw = process.env[envName];
  if (!raw) {
    return undefined;
  }

  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}
