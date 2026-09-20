import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createVersion } from "@/lib/contract-versions";
import { defineTool, type AgentDef } from "@/lib/agents/runtime";
import { llmText } from "@/lib/agents/llm";

const AGENT_NAME = "Veltriance Agent";
const MAX_BODY = 15_000; // characters of contract text shown to the model per call

const getContract = defineTool({
  name: "get_contract",
  description: "Loads a contract: its details, current text, recent shared comments and version history.",
  risk: "read",
  input: z.object({ contractId: z.string().min(1) }),
  async run(ctx, input) {
    const c = await prisma.contract.findFirst({
      where: { id: input.contractId, organizationId: ctx.organizationId },
      include: {
        supplier: { select: { name: true, country: true } },
        versions: { select: { versionNumber: true, source: true, changeNote: true, createdAt: true }, orderBy: { versionNumber: "desc" }, take: 5 },
        comments: { where: { internal: false }, orderBy: { createdAt: "desc" }, take: 8, select: { authorType: true, authorName: true, body: true } },
      },
    });
    if (!c) throw new Error("Contract not found");
    const v = await prisma.contractVersion.findUnique({ where: { contractId_versionNumber: { contractId: c.id, versionNumber: c.currentVersion } }, select: { body: true } });
    const text = v?.body ?? "";
    return {
      contractId: c.id, number: c.contractNumber, title: c.title, type: c.type, status: c.status,
      supplier: c.supplier?.name ?? null, supplierCountry: c.supplier?.country ?? null,
      value: c.value ? Number(c.value) : null, currency: c.currency,
      startDate: c.startDate?.toISOString().slice(0, 10) ?? null, endDate: c.endDate?.toISOString().slice(0, 10) ?? null,
      currentVersion: c.currentVersion, recentVersions: c.versions,
      recentComments: c.comments.reverse(),
      textTruncated: text.length > MAX_BODY, text: text.slice(0, MAX_BODY),
    };
  },
});

const listPlaybook = defineTool({
  name: "list_playbook_clauses",
  description: "Lists the organisation's clause playbook: standard wording, approved fallback wording, whether the clause is required, and guidance on when to concede.",
  risk: "read",
  input: z.object({}),
  async run(ctx) {
    const clauses = await prisma.contractClause.findMany({ where: { organizationId: ctx.organizationId, active: true }, orderBy: [{ required: "desc" }, { category: "asc" }], take: 40 });
    return {
      count: clauses.length,
      clauses: clauses.map(c => ({ title: c.title, category: c.category, required: c.required, standardWording: c.body.slice(0, 1500), fallbackWording: c.fallbackBody?.slice(0, 1500) ?? null, guidance: c.guidance })),
    };
  },
});

const execSchema = z.object({ contractId: z.string().min(1), body: z.string().min(50).max(60_000), changeNote: z.string().min(5).max(300), guidance: z.string().max(2500).optional() });

const proposeRevision = defineTool({
  name: "propose_revision",
  description: "Produces a new version of the contract. Do NOT write the contract text yourself: describe what to change in `guidance` (which clauses to add, restore or adjust, and key facts to keep) and a separate step writes the complete text from your instructions. Only works while the contract is a draft or in negotiation.",
  risk: "write",
  input: z.object({
    contractId: z.string().min(1),
    changeNote: z.string().min(5).max(300),
    guidance: z.string().min(10).max(2500),
  }),
  execInput: execSchema,
  // Writes the full document in a plain-text call (see llmText) BEFORE it is queued,
  // so what a human approves is the real text, not just a description of it.
  async prepare(ctx, input) {
    const c = await prisma.contract.findFirst({
      where: { id: input.contractId, organizationId: ctx.organizationId },
      include: { supplier: { select: { name: true, country: true } }, comments: { where: { internal: false }, orderBy: { createdAt: "desc" }, take: 6, select: { authorType: true, body: true } } },
    });
    if (!c) throw new Error("Contract not found");
    if (!["DRAFT", "NEGOTIATION"].includes(c.status)) throw new Error(`The text is locked while the contract is ${c.status.toLowerCase().replace("_", " ")}`);
    const [v, clauses] = await Promise.all([
      prisma.contractVersion.findUnique({ where: { contractId_versionNumber: { contractId: c.id, versionNumber: c.currentVersion } }, select: { body: true } }),
      prisma.contractClause.findMany({ where: { organizationId: ctx.organizationId, active: true }, orderBy: [{ required: "desc" }, { category: "asc" }], take: 40 }),
    ]);
    const current = v?.body ?? "";
    const body = await llmText({
      maxTokens: 6000,
      system: `You are a careful commercial contracts drafter. Output ONLY the complete contract text, ready to save: plain text with numbered clauses and short headings, no markdown fences, no preamble, no commentary.
Be thorough: a real agreement for this type of contract, typically 1,500–3,000 words (an NDA can be shorter), with parties, definitions, scope, term and termination, fees and payment, confidentiality, IP, warranties, liability, data protection, dispute resolution, governing law and signature blocks as appropriate.
Rules: use the organisation's standard clause wording where provided; never invent commercial facts (prices, dates, quantities, legal names, addresses) — use bracketed placeholders like [SUPPLIER LEGAL ADDRESS] for anything not supplied; when revising, change only what the instructions require and keep every other clause exactly as it is.`,
      user: `CONTRACT DETAILS
Title: ${c.title}
Type: ${c.type}
Supplier: ${c.supplier?.name ?? "[SUPPLIER NAME]"}${c.supplier?.country ? ` (${c.supplier.country})` : ""}
Value: ${c.value ? `${c.currency} ${Number(c.value)}` : "[CONTRACT VALUE]"}
Term: ${c.startDate?.toISOString().slice(0, 10) ?? "[START DATE]"} to ${c.endDate?.toISOString().slice(0, 10) ?? "[END DATE]"}${c.description ? `\nPurpose: ${c.description}` : ""}

CLAUSE PLAYBOOK
${clauses.map(k => `- ${k.title} [${k.category}]${k.required ? " (REQUIRED)" : ""}: ${k.body}${k.fallbackBody ? ` | Approved fallback: ${k.fallbackBody}` : ""}${k.guidance ? ` | Guidance: ${k.guidance}` : ""}`).join("\n") || "(none defined)"}

${current.trim() ? `CURRENT TEXT\n${current.slice(0, 20_000)}` : "CURRENT TEXT\n(empty — write a complete first draft)"}

RECENT SHARED COMMENTS
${c.comments.map(m => `${m.authorType}: ${m.body}`).join("\n") || "(none)"}

INSTRUCTIONS FOR THIS REVISION
${input.guidance}

Now write the complete contract text.`,
    });
    if (body.length < 200) throw new Error("The generated contract was too short to use");
    return { contractId: c.id, body, changeNote: input.changeNote, guidance: input.guidance };
  },
  async run(ctx, input) {
    const v = await createVersion({ contractId: input.contractId, organizationId: ctx.organizationId, body: input.body, changeNote: input.changeNote, source: "AGENT", by: { name: AGENT_NAME } });
    // The legal-review warning and the reasoning are recorded here, deterministically, so they
    // exist whatever the model does next (it can run out of time before writing its own note).
    const placeholders = Array.from(new Set(input.body.match(/\[[A-Z][A-Z0-9 _/&-]{2,60}\]/g) ?? [])).slice(0, 15);
    await prisma.contractComment.create({
      data: {
        contractId: input.contractId, authorType: "AGENT", authorName: AGENT_NAME, internal: true, versionNumber: v.versionNumber,
        body: `Version ${v.versionNumber} was prepared by the assistant: ${input.changeNote}.${input.guidance ? `\n\nChanges requested: ${input.guidance}` : ""}${placeholders.length ? `\n\nOpen placeholders to fill in: ${placeholders.join(", ")}.` : ""}\n\nThis is not legal advice — have counsel review it before it is shared or signed.`,
      },
    });
    return { versionNumber: v.versionNumber };
  },
});

const addComment = defineTool({
  name: "add_comment",
  description: "Adds a comment to the contract's negotiation thread. internal=true is visible only to our team (use it for analysis and risk notes); internal=false is shown to the supplier.",
  risk: "write",
  input: z.object({ contractId: z.string().min(1), body: z.string().min(5).max(4000), internal: z.boolean() }),
  async run(ctx, input) {
    const c = await prisma.contract.findFirst({ where: { id: input.contractId, organizationId: ctx.organizationId }, select: { id: true, currentVersion: true, status: true } });
    if (!c) throw new Error("Contract not found");
    if (["CANCELLED", "TERMINATED", "EXPIRED"].includes(c.status)) throw new Error("This contract is closed");
    const comment = await prisma.contractComment.create({ data: { contractId: c.id, authorType: "AGENT", authorName: AGENT_NAME, body: input.body, internal: input.internal, versionNumber: c.currentVersion } });
    return { commentId: comment.id };
  },
});

export const contractNegotiator: AgentDef = {
  key: "contract-negotiator",
  title: "Contract Negotiation Assistant",
  description: "Drafts a contract, or reviews the current draft (including supplier counter-proposals) against your clause playbook and proposes a revised version.",
  module: "CONTRACTS",
  schedule: null,
  maxSteps: 8,
  requireWriteBeforeFinish: true,
  timeBudgetMs: 150_000, // writing a whole contract takes a while, especially on free tiers
  inputSchema: z.object({ contractId: z.string().min(1), instruction: z.string().max(1000).optional() }),
  instructions: `You help procurement teams draft and negotiate contracts. Work from the contract and the organisation's clause playbook.

To REVIEW an existing draft: load the contract and the playbook. Find required clauses that are missing or weakened, and terms that conflict with the playbook (payment terms, liability caps, termination, confidentiality, governing law, etc). Where the supplier has pushed back on a clause, use the playbook's fallback wording only if its guidance permits conceding; otherwise restore the standard wording. Call propose_revision ONCE with a "guidance" that lists precisely which clauses to add, restore or change and the key facts to preserve (a separate step writes the full text), then add ONE internal comment listing each deviation you found, what you changed and why, and anything a human must decide.

To DRAFT from scratch (the contract text is empty or the instruction asks for a first draft): call propose_revision ONCE with a "guidance" describing the agreement to be written (structure, which playbook clauses to include, key facts from the contract details), and add ONE internal comment noting what to check.

Hard rules:
- Never invent commercial facts (prices, dates, quantities, legal entity names or addresses). Where a fact is not in the contract details, write a bracketed placeholder such as [SUPPLIER LEGAL ADDRESS].
- You are not a lawyer: your internal comment must say the draft needs human legal review.
- Do not weaken a required clause. If the supplier insists, flag it in the internal comment for a human instead.
- If the text already fully complies, do not save a new version; just add the internal comment saying so.
- You have NOT done the job until you have called propose_revision and/or add_comment. Never finish (or claim a revision is pending) without having called them.`,
  kickoff: input => `Contract ID: ${input?.contractId}. ${input?.instruction ? `Instruction: ${input.instruction}` : "Review the current draft against the playbook."}`,
  tools: [getContract, listPlaybook, proposeRevision, addComment],
};
