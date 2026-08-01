import { prisma } from "@/lib/prisma";

export type AuditAction =
  | "CREATED" | "UPDATED" | "DELETED" | "SUBMITTED" | "APPROVED"
  | "REJECTED" | "SENT" | "CANCELLED" | "UPLOADED" | "LOGIN" | "VIEWED";

export type AuditEntity =
  | "REQUISITION" | "PURCHASE_ORDER" | "SUPPLIER" | "USER"
  | "LOOKUP" | "APPROVAL_RULE" | "CUSTOM_FIELD" | "CATALOG"
  | "API_CLIENT" | "INTEGRATION" | "COA";

export interface AuditEvent {
  organizationId: string;
  userId?: string;
  userName?: string;
  action: AuditAction;
  entity: AuditEntity;
  entityId?: string;
  entityLabel?: string;
  details?: Record<string, any>;
  ipAddress?: string;
}

let auditIntegrationId: Record<string, string> = {};

// The audit trail piggybacks on the generic Integration/IntegrationLog tables
// (key="audit_log") rather than a dedicated model. Integration has no `type`/
// `provider` field and IntegrationLog has no `organizationId`/`status`/`request`/
// `response`/`duration` fields — this previously referenced columns that don't
// exist in the schema, so every logAudit() call silently no-op'd via the catch below.
async function getAuditIntegration(organizationId: string): Promise<string> {
  if (auditIntegrationId[organizationId]) return auditIntegrationId[organizationId];
  let existing = await prisma.integration.findFirst({
    where: { organizationId, key: "audit_log" },
  });
  if (!existing) {
    existing = await prisma.integration.create({
      data: { organizationId, key: "audit_log", name: "Audit Log", status: "CONNECTED" },
    });
  }
  auditIntegrationId[organizationId] = existing.id;
  return existing.id;
}

export async function logAudit(event: AuditEvent): Promise<void> {
  try {
    const integrationId = await getAuditIntegration(event.organizationId);
    await prisma.integrationLog.create({
      data: {
        integrationId,
        level: "INFO",
        event: `${event.entity}.${event.action}`,
        message: `${event.action} ${event.entity}${event.entityLabel ? `: ${event.entityLabel}` : ""}`,
        meta: {
          userId: event.userId,
          userName: event.userName,
          entity: event.entity,
          entityId: event.entityId,
          entityLabel: event.entityLabel,
          action: event.action,
          details: event.details || {},
          ipAddress: event.ipAddress,
          timestamp: new Date().toISOString(),
        },
      },
    });
  } catch (e: any) {
    // Never throw from audit — silent fail
    console.error("[audit]", e?.message);
  }
}

export async function getAuditLogs(organizationId: string, opts?: { limit?: number; entity?: string; action?: string }) {
  try {
    const integration = await prisma.integration.findFirst({ where: { organizationId, key: "audit_log" } });
    if (!integration) return [];
    const logs = await prisma.integrationLog.findMany({
      where: {
        integrationId: integration.id,
        ...(opts?.entity ? { event: { contains: opts.entity } } : {}),
        ...(opts?.action ? { event: { endsWith: opts.action } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: opts?.limit || 100,
    });
    return logs.map(l => ({ id: l.id, event: l.event, status: "SUCCESS", createdAt: l.createdAt, request: l.meta as Record<string, unknown> }));
  } catch { return []; }
}
