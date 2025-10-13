export interface ApiResponse<T> {
  data: T;
}

export interface PaginatedResponse<T> {
  results: T[];
  query?: string | null;
  total: number;
  per_page: number;
  page: number;
}

export interface MailingList {
  id: number;
  uuid?: string;
  name: string;
  type?: ListType;
  optin?: OptinType;
  tags?: string[];
  description?: string | null;
  subscriber_count?: number;
  created_at?: string;
  updated_at?: string;
}

export type ListType = "public" | "private";
export type OptinType = "single" | "double";

export interface Campaign {
  id: number;
  uuid?: string;
  name: string;
  subject: string;
  from_email?: string;
  body?: string | null;
  status?: CampaignStatus;
  lists?: MailingList[];
  tags?: string[];
  template_id?: number | null;
  messenger?: string;
  type?: CampaignType;
  content_type?: ContentType;
  send_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export type CampaignStatus =
  | "draft"
  | "scheduled"
  | "running"
  | "paused"
  | "finished"
  | "cancelled";

export type CampaignType = "regular" | "optin";
export type ContentType = "richtext" | "html" | "markdown" | "plain";

export interface CreateCampaignInput {
  name: string;
  subject: string;
  lists: number[];
  body?: string;
  fromEmail?: string;
  contentType?: ContentType;
  messenger?: string;
  type?: CampaignType;
  tags?: string[];
  templateId?: number;
  sendAt?: string;
}

export type UpdateCampaignInput = Partial<CreateCampaignInput>;

export interface UpdateCampaignStatusRequest {
  status: CampaignStatus;
}

export interface UpdateCampaignArchiveInput {
  archive: boolean;
  archiveTemplateId?: number;
  archiveMeta?: Record<string, unknown>;
}

export interface ListListsParams {
  page?: number;
  perPage?: number;
  query?: string;
  tag?: string;
}
