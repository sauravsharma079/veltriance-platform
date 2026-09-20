import type { AgentDef } from "@/lib/agents/runtime";
import { documentChaser } from "@/lib/agents/definitions/document-chaser";
import { contractNegotiator } from "@/lib/agents/definitions/contract-negotiator";
import { contractRenewalWatch } from "@/lib/agents/definitions/contract-renewal-watch";

// Every agent the platform ships. Add new ones here; the cron job, run API,
// approval inbox and dashboard all pick them up from this list.
export const AGENTS: AgentDef[] = [documentChaser, contractNegotiator, contractRenewalWatch];

export function getAgent(key: string): AgentDef | undefined {
  return AGENTS.find(a => a.key === key);
}
