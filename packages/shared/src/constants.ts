export const CAMPAIGN_STATUS = {
  DRAFT: "draft",
  SCHEDULED: "scheduled",
  RUNNING: "running",
  PAUSED: "paused",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
} as const;
export type CampaignStatus =
  (typeof CAMPAIGN_STATUS)[keyof typeof CAMPAIGN_STATUS];

export const CONVERSATION_STATUS = {
  PENDING: "pending",
  INITIAL: "initial",
  AWAITING_RESPONSE: "awaiting_response",
  PARSING: "parsing",
  FOLLOW_UP: "follow_up",
  COMPLETED: "completed",
  FAILED: "failed",
  TIMEOUT: "timeout",
} as const;
export type ConversationStatus =
  (typeof CONVERSATION_STATUS)[keyof typeof CONVERSATION_STATUS];

export const WA_SESSION_STATUS = {
  DISCONNECTED: "disconnected",
  QR_PENDING: "qr_pending",
  CONNECTED: "connected",
  BANNED: "banned",
} as const;
export type WaSessionStatus =
  (typeof WA_SESSION_STATUS)[keyof typeof WA_SESSION_STATUS];

export const MESSAGE_DIRECTION = {
  OUTBOUND: "outbound",
  INBOUND: "inbound",
} as const;
export type MessageDirection =
  (typeof MESSAGE_DIRECTION)[keyof typeof MESSAGE_DIRECTION];

export const MESSAGE_CONTENT_TYPE = {
  TEXT: "text",
  IMAGE: "image",
  AUDIO: "audio",
  DOCUMENT: "document",
  VIDEO: "video",
} as const;
export type MessageContentType =
  (typeof MESSAGE_CONTENT_TYPE)[keyof typeof MESSAGE_CONTENT_TYPE];

export const AVAILABILITY = {
  IN_STOCK: "in_stock",
  OUT_OF_STOCK: "out_of_stock",
  ON_ORDER: "on_order",
  UNKNOWN: "unknown",
} as const;
export type Availability =
  (typeof AVAILABILITY)[keyof typeof AVAILABILITY];

export const PERSONA_STYLE = {
  FORMAL: "formal",
  CASUAL: "casual",
  ANXIOUS: "anxious",
} as const;
export type PersonaStyle =
  (typeof PERSONA_STYLE)[keyof typeof PERSONA_STYLE];

export const TEMPLATE_CATEGORY = {
  GREETING: "greeting",
  INQUIRY: "inquiry",
  FOLLOW_UP: "follow_up",
  THANK_YOU: "thank_you",
} as const;
export type TemplateCategory =
  (typeof TEMPLATE_CATEGORY)[keyof typeof TEMPLATE_CATEGORY];

export const BR_STATES = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO",
  "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI",
  "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;
export type BRState = (typeof BR_STATES)[number];
