/* eslint-disable @typescript-eslint/no-explicit-any */
import { ListmonkConfig } from "./config.js";
import {
  ApiResponse,
  Campaign,
  CampaignStatus,
  CreateCampaignInput,
  ListListsParams,
  MailingList,
  PaginatedResponse,
  UpdateCampaignArchiveInput,
  UpdateCampaignInput,
} from "./types.js";

const DEFAULT_BACKOFF_MS = 250;
const MAX_BACKOFF_MS = 5_000;

export class ListmonkApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: unknown,
    public readonly rawBody?: string,
  ) {
    super(message);
    this.name = "ListmonkApiError";
  }
}

export class ListmonkClient {
  private readonly baseHeaders: Record<string, string>;

  constructor(private readonly config: ListmonkConfig) {
    const token = Buffer.from(
      `${config.username}:${config.apiKey}`,
      "utf8",
    ).toString("base64");

    this.baseHeaders = {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Basic ${token}`,
    };
  }

  async listLists(
    params: ListListsParams = {},
  ): Promise<PaginatedResponse<MailingList>> {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set("page", String(params.page));
    if (params.perPage) searchParams.set("per_page", String(params.perPage));
    if (params.query) searchParams.set("query", params.query);
    if (params.tag) searchParams.set("tag", params.tag);

    const query = searchParams.toString();
    const response = await this.request<ApiResponse<PaginatedResponse<MailingList>>>(
      `/api/lists${query ? `?${query}` : ""}`,
      {
        method: "GET",
      },
    );

    return response.data;
  }

  async createCampaign(input: CreateCampaignInput): Promise<Campaign> {
    const payload = this.toCampaignPayload(input);
    const response = await this.request<ApiResponse<Campaign>>(
      "/api/campaigns",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
    return response.data;
  }

  async updateCampaign(id: number, input: UpdateCampaignInput): Promise<Campaign> {
    const payload = this.toCampaignPayload(input);
    const response = await this.request<ApiResponse<Campaign>>(
      `/api/campaigns/${id}`,
      {
        method: "PUT",
        body: JSON.stringify(payload),
      },
    );
    return response.data;
  }

  async updateCampaignStatus(
    id: number,
    status: CampaignStatus,
  ): Promise<Campaign> {
    const response = await this.request<ApiResponse<Campaign>>(
      `/api/campaigns/${id}/status`,
      {
        method: "PUT",
        body: JSON.stringify({ status }),
      },
    );

    return response.data;
  }

  async updateCampaignArchive(
    id: number,
    input: UpdateCampaignArchiveInput,
  ): Promise<boolean> {
    const payload: Record<string, unknown> = {
      archive: input.archive,
    };

    if (input.archiveTemplateId !== undefined) {
      payload.archive_template_id = input.archiveTemplateId;
    }

    if (input.archiveMeta !== undefined) {
      payload.archive_meta = input.archiveMeta;
    }

    const response = await this.request<ApiResponse<boolean>>(
      `/api/campaigns/${id}/archive`,
      {
        method: "PUT",
        body: JSON.stringify(payload),
      },
    );

    return response.data;
  }

  async deleteCampaign(id: number): Promise<void> {
    await this.request<ApiResponse<unknown>>(`/api/campaigns/${id}`, {
      method: "DELETE",
    });
  }

  async getCampaign(id: number): Promise<Campaign> {
    const response = await this.request<ApiResponse<Campaign>>(
      `/api/campaigns/${id}`,
      {
        method: "GET",
      },
    );
    return response.data;
  }

  private toCampaignPayload(
    input: CreateCampaignInput | UpdateCampaignInput,
  ): Record<string, unknown> {
    const payload: Record<string, unknown> = {};

    if (input.name !== undefined) payload.name = input.name;
    if (input.subject !== undefined) payload.subject = input.subject;
    if (input.lists !== undefined) payload.lists = input.lists;
    if (input.body !== undefined) payload.body = input.body;
    if (input.fromEmail !== undefined) payload.from_email = input.fromEmail;
    if (input.contentType !== undefined) payload.content_type = input.contentType;
    if (input.messenger !== undefined) payload.messenger = input.messenger;
    if (input.type !== undefined) payload.type = input.type;
    if (input.tags !== undefined) payload.tags = input.tags;
    if (input.templateId !== undefined) payload.template_id = input.templateId;
    if (input.sendAt !== undefined) payload.send_at = input.sendAt;

    return payload;
  }

  private async request<T>(
    path: string,
    init: RequestInit,
  ): Promise<T> {
    const attempts = Math.max(1, this.config.retryCount + 1);
    let lastError: unknown;

    for (let attempt = 0; attempt < attempts; attempt++) {
      try {
        return await this.performRequest<T>(path, init);
      } catch (error) {
        lastError = error;
        const shouldRetry =
          attempt < attempts - 1 && this.isRetriableError(error);

        if (!shouldRetry) {
          break;
        }

        const delayMs = Math.min(
          DEFAULT_BACKOFF_MS * 2 ** attempt,
          MAX_BACKOFF_MS,
        );
        await delay(delayMs);
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error("Unknown error while calling Listmonk API");
  }

  private async performRequest<T>(
    path: string,
    init: RequestInit,
  ): Promise<T> {
    const url = this.buildUrl(path).toString();
    const headers = {
      ...this.baseHeaders,
      ...(init.headers as Record<string, string> | undefined),
    };

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.config.timeoutMs,
    );

    try {
      const response = await fetch(url, {
        ...init,
        headers,
        signal: controller.signal,
      });

      const rawBody = await response.text();
      const parsedBody = parseMaybeJson(rawBody);

      if (!response.ok) {
        const message =
          extractErrorMessage(parsedBody) ||
          `${response.status} ${response.statusText}`;
        throw new ListmonkApiError(message, response.status, parsedBody, rawBody);
      }

      if (isApiMessage(parsedBody)) {
        throw new ListmonkApiError(parsedBody.message, response.status, parsedBody, rawBody);
      }

      return parsedBody as T;
    } catch (error) {
      if (error instanceof ListmonkApiError) {
        throw error;
      }

      if (error instanceof Error && error.name === "AbortError") {
        throw new ListmonkApiError("Request timed out", 0);
      }

      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  private buildUrl(path: string): URL {
    if (path.startsWith("http://") || path.startsWith("https://")) {
      return new URL(path);
    }

    const base = this.config.baseUrl.endsWith("/")
      ? this.config.baseUrl
      : `${this.config.baseUrl}/`;
    return new URL(path.replace(/^\//, ""), base);
  }

  private isRetriableError(error: unknown): boolean {
    if (error instanceof ListmonkApiError) {
      return error.status >= 500 || error.status === 0;
    }

    if (error instanceof Error) {
      return (
        error.name === "AbortError" ||
        error.name === "FetchError" ||
        error.name === "TypeError"
      );
    }

    return false;
  }
}

function parseMaybeJson(payload: string): unknown {
  if (!payload) {
    return undefined;
  }

  try {
    return JSON.parse(payload);
  } catch {
    return payload;
  }
}

function extractErrorMessage(body: unknown): string | undefined {
  if (typeof body === "string") {
    return body;
  }

  if (body !== null && typeof body === "object" && "message" in body) {
    const message = (body as Record<string, unknown>).message;
    if (typeof message === "string") {
      return message;
    }
  }

  return undefined;
}

function isApiMessage(body: unknown): body is { message: string } {
  return (
    body !== null &&
    typeof body === "object" &&
    "message" in body &&
    typeof (body as Record<string, unknown>).message === "string" &&
    !("data" in (body as Record<string, unknown>))
  );
}

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
