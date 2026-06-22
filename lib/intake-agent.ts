/**
 * Intake Agent — rule-based NLU
 * ──────────────────────────────
 * This module understands free-text procurement requests like
 * "I need 20 laptops for new employees" and extracts structured data:
 * category, quantity, and item description. It then drives a slot-filling
 * conversation to collect whatever's still missing (supplier, delivery
 * location, cost center, required date) before handing off a complete
 * requisition draft.
 *
 * UPGRADE PATH TO A REAL LLM:
 * When you're ready to pay for OpenAI/Anthropic, replace the body of
 * `extractEntities()` below with a single API call that returns the same
 * IntakeExtraction shape (a structured-output / JSON-mode prompt works
 * well here). Nothing else in the intake flow needs to change — the chat
 * route, the slot-filling state machine, and the requisition draft creation
 * all consume this same return type regardless of how it's produced.
 */

export type IntakeExtraction = {
  category: string | null;
  quantity: number | null;
  itemDescription: string | null;
  confidence: "high" | "medium" | "low";
};

export type RequiredSlot = "category" | "quantity" | "itemDescription" | "supplier" | "deliveryLocation" | "costCenter" | "requiredDate";

export type IntakeState = {
  category: string | null;
  quantity: number | null;
  itemDescription: string | null;
  supplier: string | null;
  deliveryLocation: string | null;
  costCenter: string | null;
  requiredDate: string | null;
};

export const EMPTY_INTAKE_STATE: IntakeState = {
  category: null,
  quantity: null,
  itemDescription: null,
  supplier: null,
  deliveryLocation: null,
  costCenter: null,
  requiredDate: null,
};

// Category keyword map — extend freely as you learn what users actually ask for.
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  "IT Hardware": ["laptop", "computer", "monitor", "keyboard", "mouse", "headset", "docking station", "webcam", "printer", "server", "hard drive", "ssd"],
  "IT Software": ["software", "license", "subscription", "saas", "app", "application", "tool access"],
  "Office Supplies": ["stationery", "paper", "pen", "notebook", "desk", "chair", "furniture", "office supplies"],
  "Marketing Services": ["marketing", "advertising", "campaign", "design", "branding", "agency"],
  "Professional Services": ["consultant", "consulting", "contractor", "freelancer", "legal", "audit"],
  "Travel": ["flight", "hotel", "travel", "accommodation", "conference", "trip"],
  "Facilities": ["cleaning", "maintenance", "repair", "facilities", "hvac", "security"],
};

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  twenty: 20, thirty: 30, forty: 40, fifty: 50, hundred: 100,
};

function extractQuantity(text: string): number | null {
  const digitMatch = text.match(/\b(\d{1,5})\b/);
  if (digitMatch) return parseInt(digitMatch[1], 10);

  const lower = text.toLowerCase();
  for (const [word, value] of Object.entries(NUMBER_WORDS)) {
    if (new RegExp(`\\b${word}\\b`).test(lower)) return value;
  }
  return null;
}

function extractCategory(text: string): { category: string | null; matchedKeyword: string | null } {
  const lower = text.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const kw of keywords) {
      if (lower.includes(kw)) return { category, matchedKeyword: kw };
    }
  }
  return { category: null, matchedKeyword: null };
}

function extractItemDescription(text: string, matchedKeyword: string | null): string | null {
  if (matchedKeyword) {
    // Pull a short noun-phrase around the matched keyword for the description.
    const idx = text.toLowerCase().indexOf(matchedKeyword);
    const snippet = text.slice(Math.max(0, idx - 15), idx + matchedKeyword.length + 15).trim();
    return snippet.charAt(0).toUpperCase() + snippet.slice(1);
  }
  return null;
}

/** Parses a free-text message into structured intake fields. */
export function extractEntities(text: string): IntakeExtraction {
  const quantity = extractQuantity(text);
  const { category, matchedKeyword } = extractCategory(text);
  const itemDescription = extractItemDescription(text, matchedKeyword);

  const hits = [quantity !== null, category !== null].filter(Boolean).length;
  const confidence = hits === 2 ? "high" : hits === 1 ? "medium" : "low";

  return { category, quantity, itemDescription, confidence };
}

const SLOT_QUESTIONS: Record<RequiredSlot, string> = {
  category: "What category does this fall under? (e.g. IT Hardware, Office Supplies, Professional Services)",
  quantity: "How many do you need?",
  itemDescription: "Could you describe what you're requesting in a bit more detail?",
  supplier: "Do you have a preferred supplier in mind, or should we recommend one?",
  deliveryLocation: "Where should this be delivered?",
  costCenter: "Which cost center should this be billed to?",
  requiredDate: "When do you need this by?",
}

const SLOT_ORDER: RequiredSlot[] = ["itemDescription", "category", "quantity", "supplier", "deliveryLocation", "costCenter", "requiredDate"];

/** Returns the next unfilled slot's question, or null if the state is complete. */
export function getNextQuestion(state: IntakeState): { slot: RequiredSlot; question: string } | null {
  for (const slot of SLOT_ORDER) {
    if (!state[slot]) {
      return { slot, question: SLOT_QUESTIONS[slot] };
    }
  }
  return null;
}

export function isIntakeComplete(state: IntakeState): boolean {
  return getNextQuestion(state) === null;
}
