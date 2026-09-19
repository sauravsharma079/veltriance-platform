import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { defineTool, type AgentDef } from "@/lib/agents/runtime";

const AGENT_NAME = "Veltriance Agent";
const COOLDOWN_DAYS = 7;   // never message the same supplier more often than this
const WINDOW_DAYS = 30;    // "expiring soon" horizon

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);
const daysAhead = (n: number) => new Date(Date.now() + n * 86_400_000);

const listExpiringDocuments = defineTool({
  name: "list_documents_needing_attention",
  description: `Lists supplier compliance documents that have expired, expire within ${WINDOW_DAYS} days, or were rejected — for suppliers not already chased in the last ${COOLDOWN_DAYS} days. Returns at most 20.`,
  risk: "read",
  input: z.object({}),
  async run(ctx) {
    // A message already waiting for approval counts as "being chased" — otherwise
    // every daily run would queue another copy until someone approves the first.
    const pending = await prisma.agentAction.findMany({
      where: { organizationId: ctx.organizationId, agentKey: "document-chaser", tool: "send_supplier_message", status: "PENDING" },
      select: { input: true },
    });
    const alreadyQueued = pending.map(p => (p.input as { supplierId?: string })?.supplierId).filter((id): id is string => !!id);

    const docs = await prisma.supplierDocument.findMany({
      where: {
        supplier: {
          organizationId: ctx.organizationId,
          id: { notIn: alreadyQueued },
          status: { in: ["ACTIVE", "PENDING_APPROVAL"] },
          messages: { none: { fromPortal: false, senderName: AGENT_NAME, createdAt: { gte: daysAgo(COOLDOWN_DAYS) } } },
        },
        OR: [{ expiryDate: { lte: daysAhead(WINDOW_DAYS) } }, { status: "REJECTED" }],
      },
      select: { id: true, type: true, name: true, status: true, expiryDate: true, rejectedNote: true, supplier: { select: { id: true, name: true, contactName: true, contactEmail: true } } },
      orderBy: { expiryDate: "asc" },
      take: 20,
    });
    return {
      count: docs.length,
      documents: docs.map(d => ({
        supplierId: d.supplier.id, supplierName: d.supplier.name, contactName: d.supplier.contactName,
        documentType: d.type, documentName: d.name, status: d.status,
        expiryDate: d.expiryDate?.toISOString().slice(0, 10) ?? null,
        daysUntilExpiry: d.expiryDate ? Math.ceil((d.expiryDate.getTime() - Date.now()) / 86_400_000) : null,
        rejectedNote: d.rejectedNote,
      })),
    };
  },
});

const sendSupplierMessage = defineTool({
  name: "send_supplier_message",
  description: "Sends one message to a supplier in their portal thread asking them to renew or resubmit documents. Send ONE message per supplier covering all of that supplier's documents. Be polite, specific (name each document and its date/issue) and brief.",
  risk: "write",
  input: z.object({
    supplierId: z.string().min(1),
    subject: z.string().min(3).max(150),
    body: z.string().min(20).max(2000),
  }),
  async run(ctx, input) {
    // These checks are the real safety net, whatever the model decides.
    const supplier = await prisma.supplier.findFirst({
      where: { id: input.supplierId, organizationId: ctx.organizationId },
      select: { id: true, name: true, status: true },
    });
    if (!supplier) throw new Error("Supplier not found");
    if (supplier.status === "BLOCKED" || supplier.status === "INACTIVE") throw new Error(`${supplier.name} is ${supplier.status.toLowerCase()} — not contacting`);
    const recent = await prisma.supplierMessage.findFirst({
      where: { supplierId: supplier.id, fromPortal: false, senderName: AGENT_NAME, createdAt: { gte: daysAgo(COOLDOWN_DAYS) } },
    });
    if (recent) throw new Error(`${supplier.name} was already contacted in the last ${COOLDOWN_DAYS} days`);

    const message = await prisma.supplierMessage.create({
      data: { supplierId: supplier.id, fromPortal: false, senderName: AGENT_NAME, subject: input.subject, body: input.body },
    });
    return { messageId: message.id, supplier: supplier.name };
  },
});

export const documentChaser: AgentDef = {
  key: "document-chaser",
  title: "Supplier Document Chaser",
  description: "Finds supplier compliance documents that are expired, expiring soon or rejected, and asks the supplier to renew or resubmit.",
  module: "SUPPLIER_RISK",
  schedule: "daily",
  maxSteps: 12,
  instructions: `Your job is to keep supplier compliance documents current. Look up documents needing attention, then send each affected supplier ONE message covering all of its documents. Mention the exact document and its expiry date or rejection reason, say what is needed (a renewed certificate or a corrected upload), and ask them to upload it through the supplier portal. Do not threaten or mention blocking. Do not message a supplier twice.`,
  kickoff: () => "Check which supplier documents need attention and chase the suppliers.",
  tools: [listExpiringDocuments, sendSupplierMessage],
};
