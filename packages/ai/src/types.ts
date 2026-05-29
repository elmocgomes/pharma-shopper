export interface PersonaProfile {
  name: string;
  ageRange: string | null;
  gender: string | null;
  occupation: string | null;
  communicationStyle: "formal" | "casual" | "anxious";
  scenarioTemplates: string[];
}

export interface ProductInfo {
  name: string;
  activeIngredient?: string | null;
  presentation?: string | null;
}

export interface ConversationContext {
  pharmacyName: string;
  pharmacyCity?: string | null;
  pharmacyState?: string | null;
  products: ProductInfo[];
  /** @deprecated use products instead */
  productNames?: string[];
  previousMessages?: { role: "user" | "assistant"; content: string }[];
  /** Current conversation phase */
  phase: ConversationPhase;
  /** Whether the pharmacy spontaneously offered alternatives in phase 1 */
  spontaneousSubstitution?: boolean | null;
}

export type ConversationPhase = "phase1_branded" | "phase2_alternatives";

export type MessageType =
  | "greeting"
  | "inquiry"
  | "follow_up"
  | "phase2_probe"
  | "thank_you";

export interface GeneratedMessage {
  text: string;
  messageType: MessageType;
}

// --- Substitution behavior tracking ---

export type SubstitutionType =
  | "requested"      // the product we asked about (the branded one)
  | "spontaneous"    // pharmacy offered this alternative without being asked
  | "prompted"       // pharmacy offered this after we asked "tem genérico?"
  | "not_offered";   // no alternative was offered

// --- Enhanced parsed data ---

export interface ParsedProduct {
  /** Product name as mentioned by the pharmacy */
  productName: string;
  /** Brand name if mentioned */
  brand: string | null;
  /** Price in BRL (e.g. 25.90) */
  price: number | null;
  /** Stock status */
  availability: "in_stock" | "out_of_stock" | "on_order" | "unknown";
  /** Whether it's a generic version */
  isGeneric: boolean | null;
  /** How this product appeared in the conversation */
  substitutionType: SubstitutionType;
  /** Dosage info (e.g. "50mg", "500mg/5ml") */
  dosage: string | null;
  /** Quantity (e.g. "30 comprimidos", "1 frasco 120ml") */
  quantity: string | null;
  /** Presentation form (e.g. "comprimido", "cápsula", "suspensão", "pomada") */
  presentation: string | null;
  /** Active ingredient if mentioned */
  activeIngredient: string | null;
  /** Additional notes */
  notes: string | null;
}

export interface ParseResult {
  products: ParsedProduct[];
  /** Whether the pharmacy spontaneously offered generic/alternative products */
  spontaneousSubstitution: boolean;
  /** Details about what was spontaneously offered */
  spontaneousDetails: string | null;
  /** Whether more info is needed via follow-up */
  needsFollowUp: boolean;
  followUpReason: string | null;
  /** Brief analysis of the pharmacy's response */
  rawAnalysis: string;
}

// Keep backward compat
export type ParsedPrice = ParsedProduct;
