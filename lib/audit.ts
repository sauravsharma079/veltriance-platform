import { prisma } from "@/lib/prisma";

export type AuditAction =
  | "CREATED" | "UPDATED" | "DELETED" | "SUBMITTED" | "APPROVED"
  | "REJECTED" | "SENT" | "CANCELLED" | "UPLOADED" | "LOGIN" | "VIEWED";

export type AuditEntity =
  | "REQUISITION" | "PURCHASE_ORDER" | "SUPPLIER" | "USER"
  | "LOOKUP" | "APPROVAL_RULE" | "CUSTOM_FIELD" | "CATALOG"
  | "API_CLIENT" | "INTEGRATION";

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

async function getAuditIntegration(organizationId: string): Promise<string> {
  if (auditIntegrationId[organizationId]) return auditIntegrationId[organizationId];
  let existing = await prisma.integration.findFirst({
    where: { organizationId, type: "AUDIT_LOG" },
  });
  if (!existing) {
    existing = await (prisma.integration.create as any)({
      data: { organizationId, name: "Audit Log", type: "AUDIT_LOG", status: "ACTIVE", provider: "INTERNAL", config: {} },
    });
  }
  auditIntegrationId[organizationId] = existing.id;
  return existing.id;
}

export async function logAudit(event: AuditEvent): Promise<void> {
  try {
    const integrationId = await getAuditIntegration(event.organizationId);
    await (prisma.integrationLog.create as any)({
      data: {
        integrationId,
        organizationId: event.organizationId,
        event: `${event.entity}.${event.action}`,
        status: "SUCCESS",
        request: {
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
        response: {},
        duration: 0,
      },
    });
  } catch (e: any) {
    // Never throw from audit — silent fail
    console.error("[audit]", e?.message);
  }
}

export async function getAuditLogs(organizationId: string, opts?: { limit?: number; entity?: string; action?: string }) {
  try {
    const integration = await prisma.integration.findFirst({ where: { organizationId, type: "AUDIT_LOG" } });
    if (!integration) return [];
    const logs = await (prisma.integrationLog.findMany as any)({
      where: {
        integrationId: integration.id,
        organizationId,
        ...(opts?.entity ? { event: { contains: opts.entity } } : {}),
        ...(opts?.action ? { event: { endsWith: opts.action } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: opts?.limit || 100,
    });
    return logs;
  } catch { return []; }
}
