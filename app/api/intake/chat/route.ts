import { NextRequest, NextResponse } from "next/server";
import {
  extractEntities,
  getNextQuestion,
  EMPTY_INTAKE_STATE,
  type IntakeState,
  type RequiredSlot,
} from "@/lib/intake-agent";

type ChatBody = {
  message: string;
  state: IntakeState;
  pendingSlot: RequiredSlot | null;
};

export async function POST(req: NextRequest) {
  const { message, state, pendingSlot } = (await req.json()) as ChatBody;
  const nextState: IntakeState = { ...EMPTY_INTAKE_STATE, ...state };

  if (pendingSlot === "quantity") {
    const extraction = extractEntities(message);
    const parsed = Number.isNaN(parseInt(message, 10)) ? null : parseInt(message, 10);
    nextState.quantity = extraction.quantity ?? parsed;
  } else if (pendingSlot === "unitPrice") {
    const clean = message.replace(/[$,\s]/g, "");
    const parsed = parseFloat(clean);
    nextState.unitPrice = isNaN(parsed) ? 0 : parsed;
  } else if (pendingSlot === "category") {
    nextState.category = message.trim();
  } else if (pendingSlot) {
    nextState[pendingSlot] = message.trim() as never;
  } else {
    // First message — run full entity extraction
    const extraction = extractEntities(message);
    if (extraction.category) nextState.category = extraction.category;
    if (extraction.quantity) nextState.quantity = extraction.quantity;
    if (extraction.itemDescription) nextState.itemDescription = extraction.itemDescription;
    if (!extraction.itemDescription) nextState.itemDescription = message.trim();
  }

  const next = getNextQuestion(nextState);
  return NextResponse.json({
    state: nextState,
    reply: next
      ? next.question
      : "Got it — that's everything I need. Here's a summary of your request before I create the draft.",
    done: !next,
    pendingSlot: next?.slot ?? null,
  });
}
