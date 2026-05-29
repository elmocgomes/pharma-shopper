export interface PersonaProfile {
  name: string;
  ageRange: string | null;
  gender: string | null;
  occupation: string | null;
  communicationStyle: "formal" | "casual" | "anxious";
  scenarioTemplates: string[];
}

export interface ConversationContext {
  pharmacyName: string;
  pharmacyCity?: string | null;
  pharmacyState?: string | null;
  productNames: string[];
  previousMessages?: { role: "user" | "assistant"; content: string }[];
}

export type MessageType = "greeting" | "inquiry" | "follow_up" | "thank_you";

export interface GeneratedMessage {
  text: string;
  messageType: MessageType;
}

export interface ParsedPrice {
  productName: string;
  brand: string | null;
  price: number | null;
  availability: "in_stock" | "out_of_stock" | "on_order" | "unknown";
  isGeneric: boolean | null;
  notes: string | null;
}

export interface ParseResult {
  prices: ParsedPrice[];
  needsFollowUp: boolean;
  followUpReason: string | null;
  rawAnalysis: string;
}
