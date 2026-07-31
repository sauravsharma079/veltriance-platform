import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getCurrentOrganization } from "@/lib/tenant";

export async function POST(req: NextRequest) {
  try {
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const org = await getCurrentOrganization();
    if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { rows } = await req.json() as { rows: Record<string,string>[] };
    if (!Array.isArray(rows) || rows.length === 0)
      return NextResponse.json({ error: "No rows" }, { status: 400 });

    const results = { created: 0, skipped: 0, errors: [] as string[] };
    const VALID_ROLES = ["ADMIN","PROCUREMENT","APPROVER","REQUESTOR","VIEWER"];

    for (const row of rows) {
      try {
        const name  = (row.name  || row.Name  || "").trim();
        const email = (row.email || row.Email || "").trim().toLowerCase();
        if (!name || !email) { results.errors.push("Row skipped: name and email required"); continue; }
        if (!email.includes("@")) { results.errors.push(`"${email}" is not a valid email`); continue; }

        const existing = await prisma.user.findFirst({ where: { organizationId: org.id, email } });
        if (existing) { results.skipped++; continue; }

        const rawRole = (row.role || row.Role || "REQUESTOR").trim().toUpperCase();
        const role = VALID_ROLES.includes(rawRole) ? rawRole : "REQUESTOR";

        await prisma.user.create({
          data: {
            organizationId: org.id, name, email, role: role as any,
            inviteStatus: "PENDING",
            department: (row.department || row.Department || "").trim() || null,
            jobTitle:   (row.jobTitle   || row.job_title  || row.title || "").trim() || null,
            authId: "pending_" + email.replace(/[^a-z0-9]/g, "_") + "_" + Date.now(),
          },
        });
        results.created++;
      } catch (e: any) {
        results.errors.push(`"${row.name || row.email}": ${e.message?.split("\n")[0]}`);
      }
    }
    return NextResponse.json(results);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
