import { NextRequest, NextResponse } from "next/server";
import {
  extractEntities,
  getNextQuestion,
  isIntakeComplete,
  EMPTY_INTAKE_STATE,
  type IntakeState,
  type RequiredSlot,
} from "@/lib/intake-agent";

type ChatBody = {
  message: string;
  state: IntakeState;
  /** Which slot the previous question was asking about, if any */
  pendingSlot: RequiredSlot | null;
};

export async function POST(req: NextRequest) {
  const { message, state, pendingSlot } = (await req.json()) as ChatBody;
  const nextState: IntakeState = { ...EMPTY_INTAKE_STATE, ...state };

  // If we were waiting on a specific slot, take the raw message as that slot's value
  // unless it's better handled by entity extraction (quantity / category).
  if (pendingSlot === "quantity") {
    const extraction = extractEntities(message);
    const parsed = Number.isNaN(parseInt(message, 10)) ? null : parseInt(message, 10);
    nextState.quantity = extraction.quantity ?? parsed;
  } else if (pendingSlot === "category") {
    nextState.category = message.trim();
  } else if (pendingSlot) {
    nextState[pendingSlot] = message.trim();
  } else {
    // First message — run full entity extraction across the free-text request.
    const extraction = extractEntities(message);
    if (extraction.category) nextState.category = extraction.category;
    if (extraction.quantity) nextState.quantity = extraction.quantity;
    if (extraction.itemDescription) nextState.itemDescription = extraction.itemDescription;
    if (!extraction.itemDescription) nextState.itemDescription = message.trim();
  }

  const next = getNextQuestion(nextState);

  if (!next) {
    return NextResponse.json({
      state: nextState,
      reply: "Got it — that's everything I need. Here's a summary of your request before I create the draft requisition.",
      done: true,
      pendingSlot: null,
    });
  }

  return NextResponse.json({
    state: nextState,
    reply: next.question,
    done: false,
    pendingSlot: next.slot,
  });
}
