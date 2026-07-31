"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Sparkles, X, Send, CheckCircle2, AlertCircle, Loader2, ChevronRight, Pencil, Plus } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type Msg = { role: "agent" | "user" | "success" | "error" | "loading"; text: string; options?: string[] };
type Item = { id: string; [k: string]: unknown };
type Mode = "idle" | "create" | "edit";

type CreateKind = "user" | "role" | "group" | "lookup" | "coa" | "approval" | "field" | "catalog";
type EditKind = "user" | "role" | "group" | "lookup" | "approval" | "field" | "catalog";

interface CreateState {
  mode: "create";
  kind: CreateKind;
  step: string;
  data: Record<string, string>;
  segments?: string[];
  segIdx?: number;
  steps?: string[];
  catalogId?: string;
  suppliers?: { id: string; name: string }[];
  categories?: string[];
  items?: { sku: string; name: string }[];
}

interface EditState {
  mode: "edit";
  kind: EditKind;
  step: "select" | "field" | "value";
  items: Item[];
  selected?: Item;
  field?: string;
}

type FlowState = CreateState | EditState | null;

// ─────────────────────────────────────────────────────────────────────────────
// Static config
// ─────────────────────────────────────────────────────────────────────────────

const CREATE_ACTIONS: { label: string; kind: CreateKind; desc: string }[] = [
  { label: "Create user profile",  kind: "user",     desc: "Full profile with roles, groups & COA" },
  { label: "Create a role",        kind: "role",     desc: "Custom permissions matrix" },
  { label: "Create content group", kind: "group",    desc: "Data scoping for users" },
  { label: "Create lookup type",   kind: "lookup",   desc: "Cost Center, GL Account, etc." },
  { label: "Set up a COA",         kind: "coa",      desc: "Chart of accounts with segments" },
  { label: "Build approval chain", kind: "approval", desc: "Conditions + multi-step routing" },
  { label: "Add custom field",     kind: "field",    desc: "Extend forms" },
  { label: "Create catalog or punchout", kind: "catalog", desc: "Hosted catalog with items, or a punchout connection" },
];

const EDIT_ACTIONS: { label: string; kind: EditKind; desc: string }[] = [
  { label: "Edit a user",          kind: "user",     desc: "Update profile, roles, groups & COA" },
  { label: "Edit a role",          kind: "role",     desc: "Change permissions or members" },
  { label: "Edit a content group", kind: "group",    desc: "Rename, recolor, manage members" },
  { label: "Edit a lookup type",   kind: "lookup",   desc: "Add values to an existing type" },
  { label: "Edit approval chain",  kind: "approval", desc: "Update conditions or steps" },
  { label: "Edit a custom field",  kind: "field",    desc: "Toggle active, required, or label" },
  { label: "Edit a catalog",       kind: "catalog",  desc: "Add items, toggle active, edit connection" },
];

const CREATE_FIRST_STEP: Record<CreateKind, string> = {
  user: "name", role: "name", group: "name", lookup: "type_name",
  coa: "name", approval: "name", field: "entity", catalog: "catalog_type",
};

const FALLBACK_CATEGORIES = [
  "IT Hardware", "Software & Licenses", "Cloud Services", "Consulting Services",
  "Office Supplies", "Facilities", "Logistics", "Marketing", "Professional Services", "Other",
];

// ─────────────────────────────────────────────────────────────────────────────
// Error helper
// ─────────────────────────────────────────────────────────────────────────────

function errStr(d: unknown): string {
  if (typeof d === "string") return d;
  if (d && typeof d === "object") {
    const o = d as Record<string, unknown>;
    if (typeof o.error === "string") return o.error;
    if (o.error && typeof o.error === "object") {
      const fe = o.error as Record<string, unknown>;
      if (Array.isArray(fe.formErrors) && fe.formErrors[0]) return String(fe.formErrors[0]);
      if (fe.fieldErrors) {
        const first = Object.entries(fe.fieldErrors as Record<string, unknown[]>)[0];
        if (first) return `${first[0]}: ${first[1][0]}`;
      }
    }
  }
  return "Something went wrong.";
}

// ─────────────────────────────────────────────────────────────────────────────
// Fetch list of items for editing
// ─────────────────────────────────────────────────────────────────────────────

async function fetchEditItems(kind: EditKind): Promise<Item[]> {
  const map: Record<EditKind, string> = {
    user: "/api/admin/users", role: "/api/admin/roles", group: "/api/admin/content-groups",
    lookup: "/api/admin/lookups", approval: "/api/admin/approval-rules", field: "/api/admin/custom-fields",
    catalog: "/api/catalogs",
  };
  const key: Record<EditKind, string> = {
    user: "users", role: "roles", group: "groups", lookup: "lookups", approval: "rules", field: "fields",
    catalog: "catalogs",
  };
  try {
    const d = await fetch(map[kind]).then(r => r.json());
    return d[key[kind]] ?? [];
  } catch { return []; }
}

function describeItem(kind: EditKind, item: Item, idx: number): string {
  const name = String(item.name ?? item.label ?? item.type ?? "Item");
  if (kind === "user")     return `**${idx + 1}.** ${name} — ${item.email ?? ""}`;
  if (kind === "lookup")   return `**${idx + 1}.** ${item.type} (${(item as { _count?: number })._count ?? ""})`;
  if (kind === "approval") return `**${idx + 1}.** ${name} ${item.active ? "✓ active" : "✗ inactive"}`;
  if (kind === "field")    return `**${idx + 1}.** ${name} [${item.entity ?? ""}] ${item.active ? "✓ active" : "✗ inactive"}`;
  if (kind === "catalog")  return `**${idx + 1}.** ${name} [${item.type}] — ${(item as { _count?: { items?: number } })._count?.items ?? 0} items ${item.status === "ACTIVE" ? "✓ active" : "✗ inactive"}`;
  return `**${idx + 1}.** ${name}`;
}

function fieldChoices(kind: EditKind, item: Item): { key: string; label: string; current: string }[] {
  if (kind === "user") {
    const roles  = ((item.userRoles as { role: { name: string } }[]) ?? []).map(r => r.role.name).join(", ") || "none";
    const groups = ((item.contentGroupMembers as { contentGroup: { name: string } }[]) ?? []).map(g => g.contentGroup.name).join(", ") || "none";
    const coas   = ((item.chartOfAccountAccess as { chartOfAccount: { code: string } }[]) ?? []).map(c => c.chartOfAccount.code).join(", ") || "none";
    return [
      { key: "jobTitle",   label: "Job title",  current: String(item.jobTitle ?? "—") },
      { key: "department", label: "Department", current: String(item.department ?? "—") },
      { key: "phone",      label: "Phone",       current: String(item.phone ?? "—") },
      { key: "roles",      label: "Roles",       current: roles },
      { key: "groups",     label: "Content groups", current: groups },
      { key: "coa",        label: "COA access",  current: coas },
    ];
  }
  if (kind === "role") {
    return [
      { key: "name",        label: "Name",        current: String(item.name) },
      { key: "description", label: "Description", current: String(item.description ?? "—") },
      { key: "permissions", label: "Permissions",  current: "view matrix in Roles tab" },
      { key: "add_member",    label: "Add member",    current: "" },
      { key: "remove_member", label: "Remove member", current: "" },
    ];
  }
  if (kind === "group") {
    return [
      { key: "name",        label: "Name",        current: String(item.name) },
      { key: "description", label: "Description", current: String(item.description ?? "—") },
      { key: "color",       label: "Color",        current: String(item.color ?? "#1A2A52") },
      { key: "add_member",    label: "Add member",    current: "" },
      { key: "remove_member", label: "Remove member", current: "" },
    ];
  }
  if (kind === "approval") {
    return [
      { key: "name",   label: "Name",          current: String(item.name) },
      { key: "amount", label: "Amount range",  current: `${item.minAmount ?? "any"}-${item.maxAmount ?? "any"}` },
      { key: "toggle", label: "Toggle active", current: item.active ? "active" : "inactive" },
    ];
  }
  if (kind === "field") {
    return [
      { key: "label",    label: "Label",          current: String(item.label) },
      { key: "required", label: "Required",       current: item.required ? "yes" : "no" },
      { key: "toggle",   label: "Toggle active",  current: item.active ? "active" : "inactive" },
    ];
  }
  if (kind === "catalog") {
    const choices: { key: string; label: string; current: string }[] = [];
    if (item.type === "HOSTED") choices.push({ key: "add_items", label: "Add item(s)", current: `${(item as { _count?: { items?: number } })._count?.items ?? 0} items` });
    choices.push({ key: "toggle", label: "Toggle active", current: item.status === "ACTIVE" ? "active" : "inactive" });
    choices.push({ key: "description", label: "Description", current: String(item.description ?? "—") });
    if (item.type === "PUNCHOUT") choices.push({ key: "punchoutUrl", label: "Punchout URL", current: String(item.punchoutUrl ?? "—") });
    return choices;
  }
  return [];
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH dispatchers
// ─────────────────────────────────────────────────────────────────────────────

async function applyEdit(kind: EditKind, item: Item, field: string, value: string): Promise<{ ok: boolean; error?: string }> {
  if (kind === "user") {
    if (field === "jobTitle" || field === "department" || field === "phone") {
      const res = await fetch(`/api/admin/users/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ [field]: value }) });
      const d = await res.json();
      return res.ok ? { ok: true } : { ok: false, error: errStr(d) };
    }
    if (field === "roles" || field === "groups" || field === "coa") {
      const [rolesRes, groupsRes, coasRes] = await Promise.all([
        fetch("/api/admin/roles").then(r => r.json()),
        fetch("/api/admin/content-groups").then(r => r.json()),
        fetch("/api/admin/coa").then(r => r.json()),
      ]);
      const names = value.split(",").map(s => s.trim()).filter(Boolean);
      if (field === "roles") {
        const all: Item[] = rolesRes.roles ?? [];
        const cur = ((item.userRoles as { role: { id: string } }[]) ?? []).map(r => r.role.id);
        const newIds = names.flatMap(n => all.filter(r => String(r.name).toLowerCase().includes(n.toLowerCase())).map(r => r.id));
        for (const id of newIds.filter(i => !cur.includes(i))) await fetch(`/api/admin/users/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ addWorkspaceRoleId: id }) });
        for (const id of cur.filter(i => !newIds.includes(i))) await fetch(`/api/admin/users/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ removeWorkspaceRoleId: id }) });
      } else if (field === "groups") {
        const all: Item[] = groupsRes.groups ?? [];
        const cur = ((item.contentGroupMembers as { contentGroup: { id: string } }[]) ?? []).map(g => g.contentGroup.id);
        const newIds = names.flatMap(n => all.filter(g => String(g.name).toLowerCase().includes(n.toLowerCase())).map(g => g.id));
        for (const id of newIds.filter(i => !cur.includes(i))) await fetch(`/api/admin/users/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ addContentGroupId: id }) });
        for (const id of cur.filter(i => !newIds.includes(i))) await fetch(`/api/admin/users/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ removeContentGroupId: id }) });
      } else {
        const all: Item[] = coasRes.coas ?? [];
        const cur = ((item.chartOfAccountAccess as { chartOfAccount: { id: string } }[]) ?? []).map(c => c.chartOfAccount.id);
        const newIds = names.flatMap(c => all.filter(ca => String(ca.code).toLowerCase() === c.toLowerCase()).map(ca => ca.id));
        for (const id of newIds.filter(i => !cur.includes(i))) await fetch(`/api/admin/users/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ addCoaId: id }) });
        for (const id of cur.filter(i => !newIds.includes(i))) await fetch(`/api/admin/users/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ removeCoaId: id }) });
      }
      return { ok: true };
    }
  }

  if (kind === "role") {
    if (field === "name" || field === "description") {
      const res = await fetch(`/api/admin/roles/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ [field]: value }) });
      const d = await res.json();
      return res.ok ? { ok: true } : { ok: false, error: errStr(d) };
    }
    if (field === "permissions") {
      const permissions: Record<string, Record<string, boolean>> = {};
      if (value.toLowerCase() === "all") {
        for (const mod of ["requisitions","approvals","purchaseOrders","suppliers","reports","admin"])
          permissions[mod] = { view: true, create: true, edit: true, delete: true, submit: true, approve: true, send: true, manage: true };
      } else {
        for (const line of value.split("\n").map(l => l.trim()).filter(Boolean)) {
          const [mod, acts] = line.split(":").map(s => s.trim().toLowerCase());
          if (mod && acts) permissions[mod] = Object.fromEntries(acts.split(",").map(a => [a.trim(), true]));
        }
      }
      const res = await fetch(`/api/admin/roles/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ permissions }) });
      const d = await res.json();
      return res.ok ? { ok: true } : { ok: false, error: errStr(d) };
    }
    if (field === "add_member" || field === "remove_member") {
      const users = await fetch("/api/admin/users").then(r => r.json()).then(d => d.users ?? []);
      const match = users.find((u: Item) => String(u.name).toLowerCase().includes(value.toLowerCase()) || String(u.email).toLowerCase().includes(value.toLowerCase()));
      if (!match) return { ok: false, error: `No user found matching "${value}".` };
      const payload = field === "add_member" ? { addUserId: match.id } : { removeUserId: match.id };
      const res = await fetch(`/api/admin/roles/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      return res.ok ? { ok: true } : { ok: false, error: errStr(await res.json()) };
    }
  }

  if (kind === "group") {
    const colorMap: Record<string, string> = { navy: "#1A2A52", blue: "#2563EB", teal: "#0891B2", purple: "#7C3AED", green: "#059669", red: "#DC2626", amber: "#D97706", pink: "#BE185D" };
    if (field === "name" || field === "description") {
      const res = await fetch(`/api/admin/content-groups/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ [field]: value }) });
      const d = await res.json();
      return res.ok ? { ok: true } : { ok: false, error: errStr(d) };
    }
    if (field === "color") {
      const color = colorMap[value.toLowerCase().trim()] ?? value;
      const res = await fetch(`/api/admin/content-groups/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ color }) });
      const d = await res.json();
      return res.ok ? { ok: true } : { ok: false, error: errStr(d) };
    }
    if (field === "add_member" || field === "remove_member") {
      const users = await fetch("/api/admin/users").then(r => r.json()).then(d => d.users ?? []);
      const match = users.find((u: Item) => String(u.name).toLowerCase().includes(value.toLowerCase()) || String(u.email).toLowerCase().includes(value.toLowerCase()));
      if (!match) return { ok: false, error: `No user found matching "${value}".` };
      const payload = field === "add_member" ? { addUserId: match.id } : { removeUserId: match.id };
      const res = await fetch(`/api/admin/content-groups/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      return res.ok ? { ok: true } : { ok: false, error: errStr(await res.json()) };
    }
  }

  if (kind === "approval") {
    if (field === "name") {
      const res = await fetch(`/api/admin/approval-rules/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: value }) });
      return res.ok ? { ok: true } : { ok: false, error: errStr(await res.json()) };
    }
    if (field === "amount") {
      const [a, b] = value.split("-");
      const res = await fetch(`/api/admin/approval-rules/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ minAmount: a && a !== "any" ? Number(a.replace(/\D/g,"")) : null, maxAmount: b && b !== "any" ? Number(b.replace(/\D/g,"")) : null }) });
      return res.ok ? { ok: true } : { ok: false, error: errStr(await res.json()) };
    }
    if (field === "toggle") {
      const res = await fetch(`/api/admin/approval-rules/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: !item.active }) });
      return res.ok ? { ok: true } : { ok: false, error: errStr(await res.json()) };
    }
  }

  if (kind === "field") {
    if (field === "label") {
      const res = await fetch(`/api/admin/custom-fields/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: value }) });
      return res.ok ? { ok: true } : { ok: false, error: errStr(await res.json()) };
    }
    if (field === "required") {
      const res = await fetch(`/api/admin/custom-fields/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ required: value.toLowerCase() === "yes" }) });
      return res.ok ? { ok: true } : { ok: false, error: errStr(await res.json()) };
    }
    if (field === "toggle") {
      const res = await fetch(`/api/admin/custom-fields/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: !item.active }) });
      return res.ok ? { ok: true } : { ok: false, error: errStr(await res.json()) };
    }
  }

  if (kind === "catalog") {
    if (field === "toggle") {
      const res = await fetch(`/api/catalogs/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: item.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" }) });
      return res.ok ? { ok: true } : { ok: false, error: errStr(await res.json()) };
    }
    if (field === "description" || field === "punchoutUrl") {
      const res = await fetch(`/api/catalogs/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ [field]: value }) });
      const d = await res.json();
      return res.ok ? { ok: true } : { ok: false, error: errStr(d) };
    }
  }

  return { ok: false, error: "Unsupported field." };
}

async function addLookupValues(typeName: string, raw: string): Promise<{ ok: boolean; count: number; error?: string }> {
  const lines = raw.split("\n").map(l => l.trim()).filter(l => l && l.toLowerCase() !== "done");
  if (!lines.length) return { ok: false, count: 0, error: "No values entered." };
  let count = 0;
  for (let i = 0; i < lines.length; i++) {
    const [code, ...rest] = lines[i].split(",").map(s => s.trim());
    const label = rest.join(",").trim() || code;
    const res = await fetch("/api/admin/lookups", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: typeName, code, label, sortOrder: i }) });
    if (res.ok) count++;
  }
  return { ok: count > 0, count };
}

// ─────────────────────────────────────────────────────────────────────────────
// Create dispatchers
// ─────────────────────────────────────────────────────────────────────────────

async function createUser(data: Record<string,string>, sendInvite: boolean): Promise<{ ok: boolean; error?: string }> {
  const [rolesRes, groupsRes, coasRes] = await Promise.all([
    fetch("/api/admin/roles").then(r => r.json()),
    fetch("/api/admin/content-groups").then(r => r.json()),
    fetch("/api/admin/coa").then(r => r.json()),
  ]);
  const allRoles: Item[]  = rolesRes.roles ?? [];
  const allGroups: Item[] = groupsRes.groups ?? [];
  const allCoas: Item[]   = coasRes.coas ?? [];
  const roleNames  = (data.roles  || "").split(",").map(s => s.trim()).filter(Boolean);
  const groupNames = (data.groups || "").split(",").map(s => s.trim()).filter(Boolean);
  const coaCodes   = (data.coa    || "").split(",").map(s => s.trim()).filter(Boolean);
  const workspaceRoleIds  = roleNames.flatMap(n => allRoles.filter(r => String(r.name).toLowerCase().includes(n.toLowerCase())).map(r => r.id));
  const contentGroupIds   = groupNames.flatMap(n => allGroups.filter(g => String(g.name).toLowerCase().includes(n.toLowerCase())).map(g => g.id));
  const chartOfAccountIds = coaCodes.flatMap(c => allCoas.filter(ca => String(ca.code).toLowerCase() === c.toLowerCase()).map(ca => ca.id));
  const res = await fetch("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: data.name, email: data.email, jobTitle: data.jobtitle || undefined, department: data.department || undefined, workspaceRoleIds, contentGroupIds, chartOfAccountIds, sendInvite }) });
  const d = await res.json();
  return res.ok ? { ok: true } : { ok: false, error: errStr(d) };
}

async function createRole(data: Record<string,string>, permText: string): Promise<{ ok: boolean; error?: string }> {
  const permissions: Record<string, Record<string, boolean>> = {};
  if (permText.toLowerCase() === "all") {
    for (const mod of ["requisitions","approvals","purchaseOrders","suppliers","reports","admin"])
      permissions[mod] = { view: true, create: true, edit: true, delete: true, submit: true, approve: true, send: true, manage: true };
  } else {
    for (const line of permText.split("\n").map(l => l.trim()).filter(l => l && l.toLowerCase() !== "done")) {
      const [mod, acts] = line.split(":").map(s => s.trim().toLowerCase());
      if (mod && acts) permissions[mod] = Object.fromEntries(acts.split(",").map(a => [a.trim(), true]));
    }
  }
  const res = await fetch("/api/admin/roles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: data.name, description: data.description || undefined, permissions }) });
  const d = await res.json();
  return res.ok ? { ok: true } : { ok: false, error: errStr(d) };
}

async function createGroup(data: Record<string,string>): Promise<{ ok: boolean; error?: string }> {
  const colorMap: Record<string,string> = { navy: "#1A2A52", blue: "#2563EB", teal: "#0891B2", purple: "#7C3AED", green: "#059669", red: "#DC2626", amber: "#D97706", pink: "#BE185D" };
  const res = await fetch("/api/admin/content-groups", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: data.name, description: data.description || undefined, color: colorMap[(data.color||"").toLowerCase()] ?? "#1A2A52" }) });
  const d = await res.json();
  return res.ok ? { ok: true } : { ok: false, error: errStr(d) };
}

async function createLookup(typeName: string, raw: string): Promise<{ ok: boolean; count: number; error?: string }> {
  return addLookupValues(typeName, raw);
}

async function createCoa(data: Record<string,string>, segments: string[]): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch("/api/admin/coa", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "coa", name: data.name, code: (data.code||"").toUpperCase(), companyCode: data.company || null, currency: data.currency || "INR" }) });
  const d = await res.json();
  if (!res.ok) return { ok: false, error: errStr(d) };
  const coaId = d.coa?.id;
  for (let i = 0; i < segments.length; i++) {
    if (segments[i]) await fetch("/api/admin/coa", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "segment", coaId, position: i + 1, name: segments[i] }) });
  }
  return { ok: true };
}

async function createApproval(data: Record<string,string>, steps: string[]): Promise<{ ok: boolean; error?: string }> {
  let min: number | null = null, max: number | null = null;
  if (data.amount && data.amount !== "any") {
    const [a, b] = data.amount.split("-");
    if (a && a !== "any") min = Number(a.replace(/[^\d.]/g, ""));
    if (b && b !== "any") max = Number(b.replace(/[^\d.]/g, ""));
  }
  const res = await fetch("/api/admin/approval-rules", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: data.name, priority: 10, minAmount: min, maxAmount: max, active: true, steps: steps.map((s, i) => ({ stepType: ["MANAGER","DIRECTOR","PROCUREMENT","FINANCE"].includes(s.toUpperCase()) ? s.toUpperCase() : "CUSTOM", stepLabel: ["MANAGER","DIRECTOR","PROCUREMENT","FINANCE"].includes(s.toUpperCase()) ? null : s, sequence: i + 1 })) }) });
  const d = await res.json();
  return res.ok ? { ok: true } : { ok: false, error: errStr(d) };
}

async function createField(data: Record<string,string>): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch("/api/admin/custom-fields", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fieldKey: data.label.toLowerCase().replace(/\s+/g, "_"), name: data.label, fieldType: (data.fieldtype || "TEXT").toUpperCase(), entity: (data.entity || "REQUISITION").toUpperCase(), required: (data.required || "").toLowerCase() === "yes" }) });
  const d = await res.json();
  return res.ok ? { ok: true } : { ok: false, error: errStr(d) };
}

async function createCatalogRecord(payload: Record<string, string | undefined>): Promise<{ ok: boolean; catalogId?: string; error?: string }> {
  const res = await fetch("/api/catalogs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const d = await res.json();
  return res.ok ? { ok: true, catalogId: d.catalog?.id } : { ok: false, error: errStr(d) };
}

async function createCatalogItem(catalogId: string, payload: Record<string, string>): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`/api/catalogs/${catalogId}/items`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const d = await res.json();
  return res.ok ? { ok: true } : { ok: false, error: errStr(d) };
}

async function fetchCategoryOptions(): Promise<string[]> {
  try {
    const d = await fetch("/api/admin/lookups?type=CATEGORY").then(r => r.json());
    const labels = Array.isArray(d?.lookups) ? d.lookups.map((l: { label: string }) => l.label) : [];
    return labels.length ? labels : FALLBACK_CATEGORIES;
  } catch { return FALLBACK_CATEGORIES; }
}

async function fetchSupplierOptions(): Promise<{ id: string; name: string }[]> {
  try {
    const d = await fetch("/api/suppliers?status=ACTIVE&limit=200").then(r => r.json());
    return Array.isArray(d?.suppliers) ? d.suppliers.map((s: { id: string; name: string }) => ({ id: s.id, name: s.name })) : [];
  } catch { return []; }
}

// ─────────────────────────────────────────────────────────────────────────────
// Create-flow step questions
// ─────────────────────────────────────────────────────────────────────────────

function createQuestion(state: CreateState): string {
  const { kind, step, data } = state;
  if (kind === "user") {
    if (step === "name")       return "What's the user's **full name**?";
    if (step === "email")      return `Got it — **${data.name}**. What's their **work email**?`;
    if (step === "jobtitle")   return "**Job title**? (Enter to skip)";
    if (step === "department") return "**Department**? (Enter to skip)";
    if (step === "roles")      return "**Roles** to assign? Comma-separated names, or Enter to skip.";
    if (step === "groups")     return "**Content groups**? Comma-separated names, or Enter to skip.";
    if (step === "coa")        return "**COA access**? Comma-separated codes, or Enter to skip.";
    if (step === "invite")     return `Ready to create **${data.name}** (${data.email}). Type **yes** to create & send invite, **no** to skip the invite.`;
  }
  if (kind === "role") {
    if (step === "name")        return "What should this role be called?";
    if (step === "description") return `Got it — **${data.name}**. Description? (Enter to skip)`;
    if (step === "permissions") return `Set permissions for **${data.name}**.\n\nFormat: \`module:action1,action2\` per line.\nModules: requisitions · approvals · purchaseOrders · suppliers · reports · admin\nActions: view · create · edit · delete · submit · approve · send · manage\n\nType **all** for full access, **done** to finish.`;
  }
  if (kind === "group") {
    if (step === "name")        return "What should this content group be called?";
    if (step === "description") return `Got it — **${data.name}**. Description? (Enter to skip)`;
    if (step === "color")       return "Colour? (Enter for navy)\n\nnavy · blue · teal · purple · green · red · amber · pink";
  }
  if (kind === "lookup") {
    if (step === "type_name") return "What should I name this lookup type?\n\nExamples: Cost Center · GL Account · Department";
    if (step === "values")    return `Got it — **${data.typeName}**. Add values as \`CODE, Label\` one per line. Type **done** when finished.`;
  }
  if (kind === "coa") {
    if (step === "name")     return "Chart of Accounts name?";
    if (step === "code")     return "COA code?";
    if (step === "company")  return "Company code? (Enter to skip)";
    if (step === "currency") return "Default currency? (Enter for INR)";
    if (step === "segments") return `Name Segment ${(state.segIdx ?? 0) + 1} of 5. Type **done** to finish early.`;
  }
  if (kind === "approval") {
    if (step === "name")       return "Approval chain name?";
    if (step === "amount")     return "Amount range? (e.g. \`1000-50000\` or \`any\`)";
    if (step === "steps")      return "First approval step? (MANAGER · DIRECTOR · PROCUREMENT · FINANCE · custom)";
    if (step === "more_steps") return `Add another step or type **done**.\n\nSo far: ${(state.steps ?? []).join(" → ")}`;
  }
  if (kind === "field") {
    if (step === "entity")    return "Entity? **REQUISITION** · **SUPPLIER** · **PURCHASE_ORDER**";
    if (step === "label")     return "Field label?";
    if (step === "fieldtype") return "Type? **TEXT** · **NUMBER** · **DATE** · **DROPDOWN** · **CHECKBOX** · **TEXTAREA**";
    if (step === "required")  return "Required? (**yes** / **no**)";
  }
  if (kind === "catalog") {
    if (step === "catalog_type")    return "Let's set up a **catalog**. Would you like a **Hosted Catalog** (you manage items directly) or a **Punchout Connection** (supplier's live catalog)?";
    if (step === "name")            return "What should this catalog be called?";
    if (step === "description")     return `Got it — **${data.name}**. Give it a short **description**.`;
    if (step === "item_sku")        return "Item **SKU**? (or type **done** to finish without adding items)";
    if (step === "item_name")       return "Item **name**?";
    if (step === "item_price")      return "**Unit price**?";
    if (step === "item_currency")   return "**Currency**? (Enter for INR)";
    if (step === "item_category")   return "**Category**?";
    if (step === "item_unit")       return "**Unit of measure**? (e.g. Each, Box, Kg, License, Hour)";
    if (step === "item_leaddays")   return "**Lead time** in days?";
    if (step === "item_supplier")   return "Which **supplier** provides this item?";
    if (step === "item_more")       return `Add another item or type **done**.\n\nSo far: ${(state.items ?? []).map(i => i.name).join(", ") || "none"}`;
    if (step === "p_name")          return "What should this punchout connection be called?";
    if (step === "p_supplier")      return "Which **supplier** is this punchout with? (or type **skip**)";
    if (step === "p_url")           return "**Punchout URL**? (the supplier's cXML PunchOutSetupRequest endpoint)";
    if (step === "p_from_identity") return "Your **buyer identity** (cXML From identity)?";
    if (step === "p_to_identity")   return "Supplier's **cXML To identity**?";
    if (step === "p_secret")        return "**Shared secret** provided by the supplier?";
  }
  return "";
}

function createStepOptions(state: CreateState): string[] | undefined {
  if (state.kind !== "catalog") return undefined;
  const { step } = state;
  if (step === "catalog_type")  return ["Hosted Catalog", "Punchout Connection"];
  if (step === "item_currency") return ["INR", "USD", "EUR", "GBP"];
  if (step === "item_category") return state.categories;
  if (step === "item_unit")     return ["Each", "Box", "Kg", "License", "Hour"];
  if (step === "item_supplier") return (state.suppliers ?? []).map((s, i) => `${i + 1}. ${s.name}`);
  if (step === "p_supplier")    return [...(state.suppliers ?? []).map((s, i) => `${i + 1}. ${s.name}`), "Skip"];
  return undefined;
}

const CREATE_NEXT_STEP: Record<CreateKind, Record<string, string>> = {
  user:     { name: "email", email: "jobtitle", jobtitle: "department", department: "roles", roles: "groups", groups: "coa", coa: "invite" },
  role:     { name: "description", description: "permissions" },
  group:    { name: "description", description: "color" },
  lookup:   { type_name: "values" },
  coa:      { name: "code", code: "company", company: "currency", currency: "segments" },
  approval: { name: "amount", amount: "steps", steps: "more_steps" },
  field:    { entity: "label", label: "fieldtype", fieldtype: "required" },
  catalog:  {
    catalog_type: "name", name: "description", description: "item_sku",
    item_sku: "item_name", item_name: "item_price", item_price: "item_currency",
    item_currency: "item_category", item_category: "item_unit", item_unit: "item_leaddays",
    item_leaddays: "item_supplier", item_supplier: "item_more", item_more: "item_sku",
    p_name: "p_supplier", p_supplier: "p_url", p_url: "p_from_identity",
    p_from_identity: "p_to_identity", p_to_identity: "p_secret",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function AdminAgent({ onRefresh, openSignal }: { onRefresh: () => void; openSignal?: number }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("idle");
  const [panelTab, setPanelTab] = useState<"create" | "edit">("create");
  const [messages, setMessages] = useState<Msg[]>([
    { role: "agent", text: "Hi! I can **create** or **edit** any admin configuration — users, roles, content groups, lookups, charts of accounts, approval chains, custom fields, and catalogs/punchout connections. Choose Create or Edit below." },
  ]);
  const [flow, setFlow] = useState<FlowState>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const openSignalRef = useRef(openSignal);

  useEffect(() => {
    if (open) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      inputRef.current?.focus();
    }
  }, [messages, open]);

  useEffect(() => {
    if (openSignal !== undefined && openSignal !== openSignalRef.current) {
      openSignalRef.current = openSignal;
      setOpen(true);
    }
  }, [openSignal]);

  const addMsg = useCallback((m: Msg[]) => setMessages(p => [...p, ...m]), []);

  function resetToIdle(message?: string) {
    setFlow(null);
    setMode("idle");
    if (message) addMsg([{ role: "agent", text: message }]);
  }

  // ── Start a create flow ─────────────────────────────────────────────────
  function startCreate(kind: CreateKind) {
    const step = CREATE_FIRST_STEP[kind];
    const state: CreateState = { mode: "create", kind, step, data: {}, segments: [], segIdx: 0, steps: [] };
    setFlow(state);
    setMode("create");
    addMsg([{ role: "agent", text: createQuestion(state), options: createStepOptions(state) }]);
  }

  function handleOption(opt: string) {
    if (busy) return;
    addMsg([{ role: "user", text: opt }]);
    handleSend(opt);
  }

  // ── Start an edit flow ──────────────────────────────────────────────────
  async function startEdit(kind: EditKind) {
    addMsg([{ role: "loading", text: "Loading…" }]);
    const items = await fetchEditItems(kind);
    setMessages(p => p.filter(m => m.role !== "loading"));
    if (items.length === 0) {
      addMsg([{ role: "agent", text: `No ${kind}s found yet. Create one first using the Create tab.` }]);
      return;
    }
    const state: EditState = { mode: "edit", kind, step: "select", items };
    setFlow(state);
    setMode("edit");
    const listText = items.map((it, i) => describeItem(kind, it, i)).join("\n");
    addMsg([{ role: "agent", text: `Which ${kind} would you like to edit?\n\n${listText}\n\nType the number.` }]);
  }

  async function handleSend(raw?: string) {
    const text = (raw ?? input).trim();
    if (!text || busy) return;
    setInput("");
    setBusy(true);
    if (!raw) addMsg([{ role: "user", text }]);

    // ── No active flow: only typed free text triggers fallback message ──
    if (!flow) {
      addMsg([{ role: "agent", text: "Please choose **Create** or **Edit** above, then pick what you'd like to work on." }]);
      setBusy(false);
      return;
    }

    // ════════════════════════ EDIT FLOW ════════════════════════════════════
    if (flow.mode === "edit") {
      const ef = flow;

      if (ef.step === "select") {
        const idx = parseInt(text) - 1;
        if (isNaN(idx) || idx < 0 || idx >= ef.items.length) {
          addMsg([{ role: "agent", text: `Please enter a number between 1 and ${ef.items.length}.` }]);
          setBusy(false); return;
        }
        const selected = ef.items[idx];
        const choices = fieldChoices(ef.kind, selected);
        const name = String(selected.name ?? selected.label ?? selected.type ?? "this item");
        const lines = choices.map((c, i) => `**${i + 1}.** ${c.label}${c.current ? ` — currently: ${c.current}` : ""}`).join("\n");

        if (ef.kind === "lookup") {
          const nextState: EditState = { ...ef, step: "value", selected, field: "add_values" };
          setFlow(nextState);
          addMsg([{ role: "agent", text: `Adding values to **${selected.type}**.\n\nEnter as \`CODE, Label\` one per line. Type **done** when finished.` }]);
        } else {
          const nextState: EditState = { ...ef, step: "field", selected };
          setFlow(nextState);
          addMsg([{ role: "agent", text: `Editing **${name}**. What would you like to change?\n\n${lines}\n\nType the number.` }]);
        }

      } else if (ef.step === "field") {
        const selected = ef.selected!;
        const choices = fieldChoices(ef.kind, selected);
        const idx = parseInt(text) - 1;
        if (isNaN(idx) || idx < 0 || idx >= choices.length) {
          addMsg([{ role: "agent", text: `Please enter a number between 1 and ${choices.length}.` }]);
          setBusy(false); return;
        }
        const field = choices[idx].key;

        if (field === "toggle") {
          addMsg([{ role: "loading", text: "Updating…" }]);
          const result = await applyEdit(ef.kind, selected, field, "");
          setMessages(p => p.filter(m => m.role !== "loading"));
          if (result.ok) {
            addMsg([{ role: "success", text: `✓ Toggled successfully. Edit something else on this item, or type **done** to finish.` }]);
            const refreshed = await fetchEditItems(ef.kind);
            const updated = refreshed.find(it => it.id === selected.id) ?? selected;
            setFlow({ ...ef, step: "field", selected: updated, items: refreshed });
            onRefresh();
          } else {
            addMsg([{ role: "error", text: result.error ?? "Update failed." }]);
            resetToIdle();
          }
        } else if (field === "add_items") {
          const catState: CreateState = { mode: "create", kind: "catalog", step: "item_sku", data: { name: String(selected.name) }, catalogId: String(selected.id), items: [] };
          setFlow(catState);
          setMode("create");
          addMsg([{ role: "agent", text: `Adding items to **${selected.name}**. ${createQuestion(catState)}` }]);
        } else {
          const nextState: EditState = { ...ef, step: "value", field };
          setFlow(nextState);
          const prompts: Record<string, string> = {
            jobTitle: "New job title?", department: "New department?", phone: "New phone?",
            roles: "New roles (comma-separated, replaces current — leave blank to clear):",
            groups: "New content groups (comma-separated, replaces current — leave blank to clear):",
            coa: "New COA access (comma-separated codes, replaces current — leave blank to clear):",
            name: "New name?", description: "New description?",
            permissions: "New permissions (\`module:actions\` per line, or **all**):",
            color: "New colour? (navy/blue/teal/purple/green/red/amber/pink)",
            amount: "New amount range? (e.g. 1000-50000 or any)",
            label: "New label?", required: "Required? (yes/no)",
            add_member: "Name or email of user to add?",
            remove_member: "Name or email of user to remove?",
          };
          addMsg([{ role: "agent", text: prompts[field] ?? "New value?" }]);
        }

      } else if (ef.step === "value") {
        const selected = ef.selected!;

        if (ef.field === "add_values") {
          if (text.toLowerCase() === "done") { resetToIdle("Done. What else would you like to do?"); setBusy(false); return; }
          addMsg([{ role: "loading", text: "Adding values…" }]);
          const result = await addLookupValues(String(selected.type), text);
          setMessages(p => p.filter(m => m.role !== "loading"));
          if (result.ok) {
            addMsg([{ role: "success", text: `✓ Added ${result.count} value${result.count !== 1 ? "s" : ""}. Add more or type **done**.` }]);
            onRefresh();
          } else {
            addMsg([{ role: "error", text: result.error ?? "Failed." }]);
          }
        } else {
          addMsg([{ role: "loading", text: "Saving…" }]);
          const result = await applyEdit(ef.kind, selected, ef.field!, text);
          setMessages(p => p.filter(m => m.role !== "loading"));
          if (result.ok) {
            const name = String(selected.name ?? selected.label ?? "");
            addMsg([{ role: "success", text: `✓ Updated **${name}**. Edit something else, or type **done** to finish.` }]);
            const refreshed = await fetchEditItems(ef.kind);
            const updated = refreshed.find(it => it.id === selected.id) ?? selected;
            setFlow({ ...ef, step: "field", selected: updated, items: refreshed, field: undefined });
            onRefresh();
          } else {
            addMsg([{ role: "error", text: result.error ?? "Failed to save." }]);
            resetToIdle();
          }
        }
      }
    }

    // ════════════════════════ CREATE FLOW ══════════════════════════════════
    else if (flow.mode === "create") {
      const cf = flow;
      const { kind, step, data } = cf;

      // ── USER ──
      if (kind === "user") {
        if (step === "name") advanceCreate(cf, "email", { ...data, name: text });
        else if (step === "email") {
          if (!text.includes("@")) { addMsg([{ role: "agent", text: "That doesn't look like a valid email." }]); setBusy(false); return; }
          advanceCreate(cf, "jobtitle", { ...data, email: text });
        }
        else if (step === "jobtitle")   advanceCreate(cf, "department", { ...data, jobtitle: text });
        else if (step === "department") advanceCreate(cf, "roles", { ...data, department: text });
        else if (step === "roles")      advanceCreate(cf, "groups", { ...data, roles: text });
        else if (step === "groups")     advanceCreate(cf, "coa", { ...data, groups: text });
        else if (step === "coa")        advanceCreate(cf, "invite", { ...data, coa: text });
        else if (step === "invite") {
          const sendInvite = text.toLowerCase().startsWith("y");
          addMsg([{ role: "loading", text: `Creating user **${data.name}**…` }]);
          const result = await createUser(data, sendInvite);
          setMessages(p => p.filter(m => m.role !== "loading"));
          if (result.ok) { addMsg([{ role: "success", text: `✓ **${data.name}** created${sendInvite ? " — invite sent!" : "."}` }]); onRefresh(); resetToIdle(); }
          else { addMsg([{ role: "error", text: result.error ?? "Failed." }]); resetToIdle(); }
        }
      }

      // ── ROLE ──
      else if (kind === "role") {
        if (step === "name") advanceCreate(cf, "description", { ...data, name: text });
        else if (step === "description") advanceCreate(cf, "permissions", { ...data, description: text });
        else if (step === "permissions") {
          addMsg([{ role: "loading", text: `Creating role **${data.name}**…` }]);
          const result = await createRole(data, text);
          setMessages(p => p.filter(m => m.role !== "loading"));
          if (result.ok) { addMsg([{ role: "success", text: `✓ Role **${data.name}** created.` }]); onRefresh(); resetToIdle(); }
          else { addMsg([{ role: "error", text: result.error ?? "Failed." }]); resetToIdle(); }
        }
      }

      // ── GROUP ──
      else if (kind === "group") {
        if (step === "name") advanceCreate(cf, "description", { ...data, name: text });
        else if (step === "description") advanceCreate(cf, "color", { ...data, description: text });
        else if (step === "color") {
          addMsg([{ role: "loading", text: `Creating group **${data.name}**…` }]);
          const result = await createGroup({ ...data, color: text });
          setMessages(p => p.filter(m => m.role !== "loading"));
          if (result.ok) { addMsg([{ role: "success", text: `✓ Group **${data.name}** created.` }]); onRefresh(); resetToIdle(); }
          else { addMsg([{ role: "error", text: result.error ?? "Failed." }]); resetToIdle(); }
        }
      }

      // ── LOOKUP ──
      else if (kind === "lookup") {
        if (step === "type_name") advanceCreate(cf, "values", { ...data, typeName: text });
        else if (step === "values") {
          if (text.toLowerCase() === "done") { resetToIdle("Done. What else?"); setBusy(false); return; }
          addMsg([{ role: "loading", text: "Creating values…" }]);
          const result = await createLookup(data.typeName, text);
          setMessages(p => p.filter(m => m.role !== "loading"));
          if (result.ok) { addMsg([{ role: "success", text: `✓ Created **${data.typeName}** with ${result.count} value${result.count !== 1 ? "s" : ""}. Add more or type **done**.` }]); onRefresh(); }
          else { addMsg([{ role: "error", text: result.error ?? "Failed." }]); }
        }
      }

      // ── COA ──
      else if (kind === "coa") {
        if (step === "name") advanceCreate(cf, "code", { ...data, name: text });
        else if (step === "code") advanceCreate(cf, "company", { ...data, code: text });
        else if (step === "company") advanceCreate(cf, "currency", { ...data, company: text });
        else if (step === "currency") {
          const nextState: CreateState = { ...cf, step: "segments", data: { ...data, currency: text || "INR" }, segIdx: 0, segments: [] };
          setFlow(nextState); addMsg([{ role: "agent", text: createQuestion(nextState) }]);
        }
        else if (step === "segments") {
          const isDone = text.toLowerCase() === "done";
          const segs = isDone ? (cf.segments ?? []) : [...(cf.segments ?? []), text];
          if (isDone || segs.length >= 5) {
            addMsg([{ role: "loading", text: `Creating COA **${data.name}**…` }]);
            const result = await createCoa(data, segs);
            setMessages(p => p.filter(m => m.role !== "loading"));
            if (result.ok) { addMsg([{ role: "success", text: `✓ COA **${data.name}** created with ${segs.filter(Boolean).length} segments.` }]); onRefresh(); resetToIdle(); }
            else { addMsg([{ role: "error", text: result.error ?? "Failed." }]); resetToIdle(); }
          } else {
            const nextState: CreateState = { ...cf, segments: segs, segIdx: (cf.segIdx ?? 0) + 1 };
            setFlow(nextState); addMsg([{ role: "agent", text: createQuestion(nextState) }]);
          }
        }
      }

      // ── APPROVAL ──
      else if (kind === "approval") {
        if (step === "name") advanceCreate(cf, "amount", { ...data, name: text });
        else if (step === "amount") advanceCreate(cf, "steps", { ...data, amount: text });
        else if (step === "steps") {
          const nextState: CreateState = { ...cf, step: "more_steps", steps: [text] };
          setFlow(nextState); addMsg([{ role: "agent", text: createQuestion(nextState) }]);
        }
        else if (step === "more_steps") {
          if (text.toLowerCase() === "done") {
            addMsg([{ role: "loading", text: `Creating chain **${data.name}**…` }]);
            const result = await createApproval(data, cf.steps ?? []);
            setMessages(p => p.filter(m => m.role !== "loading"));
            if (result.ok) { addMsg([{ role: "success", text: `✓ Chain **${data.name}** created: ${(cf.steps ?? []).join(" → ")}` }]); onRefresh(); resetToIdle(); }
            else { addMsg([{ role: "error", text: result.error ?? "Failed." }]); resetToIdle(); }
          } else {
            const nextState: CreateState = { ...cf, steps: [...(cf.steps ?? []), text] };
            setFlow(nextState); addMsg([{ role: "agent", text: createQuestion(nextState) }]);
          }
        }
      }

      // ── FIELD ──
      else if (kind === "field") {
        if (step === "entity") advanceCreate(cf, "label", { ...data, entity: text });
        else if (step === "label") advanceCreate(cf, "fieldtype", { ...data, label: text });
        else if (step === "fieldtype") advanceCreate(cf, "required", { ...data, fieldtype: text });
        else if (step === "required") {
          addMsg([{ role: "loading", text: `Creating field **${data.label}**…` }]);
          const result = await createField({ ...data, required: text });
          setMessages(p => p.filter(m => m.role !== "loading"));
          if (result.ok) { addMsg([{ role: "success", text: `✓ Field **${data.label}** created.` }]); onRefresh(); resetToIdle(); }
          else { addMsg([{ role: "error", text: result.error ?? "Failed." }]); resetToIdle(); }
        }
      }

      // ── CATALOG / PUNCHOUT ──
      else if (kind === "catalog") {
        if (step === "catalog_type") {
          const isPunchout = text.toLowerCase().includes("punch");
          const nextState: CreateState = { ...cf, step: isPunchout ? "p_name" : "name", data: { ...data, type: isPunchout ? "PUNCHOUT" : "HOSTED" } };
          setFlow(nextState);
          addMsg([{ role: "agent", text: createQuestion(nextState), options: createStepOptions(nextState) }]);
        }

        // Hosted branch
        else if (step === "name") advanceCreate(cf, "description", { ...data, name: text });
        else if (step === "description") {
          if (!text.trim()) { addMsg([{ role: "agent", text: "Description is required for a hosted catalog." }]); setBusy(false); return; }
          addMsg([{ role: "loading", text: `Creating catalog **${data.name}**…` }]);
          const result = await createCatalogRecord({ name: data.name, type: "HOSTED", description: text.trim() });
          setMessages(p => p.filter(m => m.role !== "loading"));
          if (!result.ok) { addMsg([{ role: "error", text: result.error ?? "Failed to create catalog." }]); resetToIdle(); }
          else {
            const nextState: CreateState = { ...cf, step: "item_sku", data: { ...data, description: text.trim() }, catalogId: result.catalogId, items: [] };
            setFlow(nextState);
            addMsg([{ role: "success", text: `✓ Catalog **${data.name}** created.` }]);
            addMsg([{ role: "agent", text: createQuestion(nextState) }]);
          }
        }
        else if (step === "item_sku") {
          if (text.toLowerCase() === "done") finishCatalogFlow(cf);
          else if (!text.trim()) { addMsg([{ role: "agent", text: "SKU is required (or type done)." }]); setBusy(false); return; }
          else advanceCreate(cf, "item_name", { ...data, sku: text.trim() });
        }
        else if (step === "item_name") {
          if (!text.trim()) { addMsg([{ role: "agent", text: "Item name is required." }]); setBusy(false); return; }
          advanceCreate(cf, "item_price", { ...data, itemName: text.trim() });
        }
        else if (step === "item_price") {
          const price = parseFloat(text);
          if (isNaN(price) || price < 0) { addMsg([{ role: "agent", text: "Please enter a valid price." }]); setBusy(false); return; }
          advanceCreate(cf, "item_currency", { ...data, price: text });
        }
        else if (step === "item_currency") {
          const currency = (text.trim() || "INR").toUpperCase();
          let categories = cf.categories;
          if (!categories) {
            addMsg([{ role: "loading", text: "Loading categories…" }]);
            categories = await fetchCategoryOptions();
            setMessages(p => p.filter(m => m.role !== "loading"));
          }
          const nextState: CreateState = { ...cf, step: "item_category", data: { ...data, currency }, categories };
          setFlow(nextState);
          addMsg([{ role: "agent", text: createQuestion(nextState), options: categories }]);
        }
        else if (step === "item_category") {
          if (!text.trim()) { addMsg([{ role: "agent", text: "Category is required." }]); setBusy(false); return; }
          advanceCreate(cf, "item_unit", { ...data, category: text.trim() });
        }
        else if (step === "item_unit") {
          if (!text.trim()) { addMsg([{ role: "agent", text: "Unit is required." }]); setBusy(false); return; }
          advanceCreate(cf, "item_leaddays", { ...data, unit: text.trim() });
        }
        else if (step === "item_leaddays") {
          const days = parseInt(text);
          if (isNaN(days) || days < 0) { addMsg([{ role: "agent", text: "Please enter a valid number of days." }]); setBusy(false); return; }
          let suppliers = cf.suppliers;
          if (!suppliers) {
            addMsg([{ role: "loading", text: "Loading suppliers…" }]);
            suppliers = await fetchSupplierOptions();
            setMessages(p => p.filter(m => m.role !== "loading"));
          }
          if (suppliers.length === 0) {
            addMsg([{ role: "error", text: "No active suppliers found. Add a supplier first, then resume this catalog from Edit → Add item(s)." }]);
            resetToIdle();
            setBusy(false); return;
          }
          const nextState: CreateState = { ...cf, step: "item_supplier", data: { ...data, leaddays: text }, suppliers };
          setFlow(nextState);
          addMsg([{ role: "agent", text: createQuestion(nextState), options: suppliers.map((s, i) => `${i + 1}. ${s.name}`) }]);
        }
        else if (step === "item_supplier") {
          const suppliers = cf.suppliers ?? [];
          const num = parseInt(text);
          const match = !isNaN(num) ? suppliers[num - 1] : suppliers.find(s => s.name.toLowerCase().includes(text.toLowerCase()));
          if (!match) {
            addMsg([{ role: "agent", text: `Please pick a supplier from the list (1-${suppliers.length}).`, options: suppliers.map((s, i) => `${i + 1}. ${s.name}`) }]);
            setBusy(false); return;
          }
          addMsg([{ role: "loading", text: `Adding item **${data.itemName}**…` }]);
          const result = await createCatalogItem(cf.catalogId!, {
            sku: data.sku, name: data.itemName, unitPrice: data.price, currency: data.currency || "INR",
            category: data.category, unit: data.unit, leadDays: data.leaddays, supplierId: match.id,
          });
          setMessages(p => p.filter(m => m.role !== "loading"));
          if (!result.ok) { addMsg([{ role: "error", text: result.error ?? "Failed to add item." }]); setBusy(false); return; }
          const newItems = [...(cf.items ?? []), { sku: data.sku, name: data.itemName }];
          const nextState: CreateState = { ...cf, step: "item_more", items: newItems, data: { ...data, supplier: match.name } };
          setFlow(nextState);
          onRefresh();
          addMsg([{ role: "success", text: `✓ Added **${data.itemName}** (${data.sku}). ${newItems.length} item${newItems.length !== 1 ? "s" : ""} so far.` }]);
          addMsg([{ role: "agent", text: createQuestion(nextState) }]);
        }
        else if (step === "item_more") {
          if (text.toLowerCase() === "done") finishCatalogFlow(cf);
          else {
            const nextState: CreateState = { ...cf, step: "item_sku", data: { ...data, sku: "", itemName: "", price: "", currency: "", category: "", unit: "", leaddays: "", supplier: "" } };
            setFlow(nextState);
            addMsg([{ role: "agent", text: createQuestion(nextState) }]);
          }
        }

        // Punchout branch
        else if (step === "p_name") {
          let suppliers = cf.suppliers;
          if (!suppliers) {
            addMsg([{ role: "loading", text: "Loading suppliers…" }]);
            suppliers = await fetchSupplierOptions();
            setMessages(p => p.filter(m => m.role !== "loading"));
          }
          const nextState: CreateState = { ...cf, step: "p_supplier", data: { ...data, name: text }, suppliers };
          setFlow(nextState);
          addMsg([{ role: "agent", text: createQuestion(nextState), options: createStepOptions(nextState) }]);
        }
        else if (step === "p_supplier") {
          const suppliers = cf.suppliers ?? [];
          let supplierId = "";
          let supplierName = "";
          if (text.toLowerCase() !== "skip") {
            const num = parseInt(text);
            const match = !isNaN(num) ? suppliers[num - 1] : suppliers.find(s => s.name.toLowerCase().includes(text.toLowerCase()));
            if (!match) {
              addMsg([{ role: "agent", text: "Please pick a supplier from the list, or type skip.", options: createStepOptions(cf) }]);
              setBusy(false); return;
            }
            supplierId = match.id; supplierName = match.name;
          }
          advanceCreate(cf, "p_url", { ...data, supplierId, supplierName });
        }
        else if (step === "p_url") {
          if (!/^https?:\/\//i.test(text.trim())) { addMsg([{ role: "agent", text: "Please enter a valid URL starting with http(s)://" }]); setBusy(false); return; }
          advanceCreate(cf, "p_from_identity", { ...data, url: text.trim() });
        }
        else if (step === "p_from_identity") {
          if (!text.trim()) { addMsg([{ role: "agent", text: "Buyer identity is required." }]); setBusy(false); return; }
          advanceCreate(cf, "p_to_identity", { ...data, fromIdentity: text.trim() });
        }
        else if (step === "p_to_identity") {
          if (!text.trim()) { addMsg([{ role: "agent", text: "Supplier identity is required." }]); setBusy(false); return; }
          advanceCreate(cf, "p_secret", { ...data, toIdentity: text.trim() });
        }
        else if (step === "p_secret") {
          if (!text.trim()) { addMsg([{ role: "agent", text: "Shared secret is required." }]); setBusy(false); return; }
          addMsg([{ role: "loading", text: `Creating punchout connection **${data.name}**…` }]);
          const result = await createCatalogRecord({
            name: data.name, type: "PUNCHOUT",
            supplierId: data.supplierId || undefined,
            punchoutUrl: data.url, cxmlFromIdentity: data.fromIdentity, cxmlToIdentity: data.toIdentity,
            cxmlSharedSecret: text.trim(),
          });
          setMessages(p => p.filter(m => m.role !== "loading"));
          if (result.ok) { addMsg([{ role: "success", text: `✓ Punchout connection **${data.name}** created.` }]); onRefresh(); resetToIdle(); }
          else { addMsg([{ role: "error", text: result.error ?? "Failed." }]); resetToIdle(); }
        }
      }
    }

    setBusy(false);
  }

  function advanceCreate(cf: CreateState, nextStep: string, newData: Record<string, string>) {
    const nextState: CreateState = { ...cf, step: nextStep, data: newData };
    setFlow(nextState);
    addMsg([{ role: "agent", text: createQuestion(nextState), options: createStepOptions(nextState) }]);
  }

  function finishCatalogFlow(cf: CreateState) {
    const count = (cf.items ?? []).length;
    onRefresh();
    resetToIdle(`✓ Catalog **${cf.data.name}** is ready${count > 0 ? ` with ${count} item${count !== 1 ? "s" : ""}` : ""}. What else would you like to do?`);
  }

  function renderText(text: string) {
    return String(text ?? "").split("\n").map((line, i) => {
      const parts = line.split(/\*\*([^*]+)\*\*/g);
      return (
        <p key={i} className={i > 0 ? "mt-0.5" : ""}>
          {parts.map((p, j) => (j % 2 === 1 ? <strong key={j} className="font-semibold">{p}</strong> : <span key={j}>{p}</span>))}
        </p>
      );
    });
  }

  const headerLabel = mode === "idle"
    ? "Create or edit any configuration"
    : flow?.mode === "edit" ? `Editing ${flow.kind}` : flow?.mode === "create" ? `Creating ${flow.kind}` : "";

  return (
    <>
      <button
        onClick={() => setOpen(v => !v)}
        className={`fixed bottom-6 right-6 z-50 rounded-full shadow-xl flex items-center justify-center transition-all ${open ? "bg-gray-700" : "bg-gradient-to-br from-[#1A2A52] to-[#2D5A9B] hover:scale-105"}`}
        style={{ width: 52, height: 52 }}
      >
        {open ? <X className="size-5 text-white" /> : <Sparkles className="size-5 text-white" />}
        {!open && <span className="absolute inset-0 rounded-full ring-4 ring-[#1A2A52]/30 animate-ping" style={{ animationDuration: "2.5s" }} />}
      </button>

      {open && (
        <div
          className="fixed bottom-24 right-6 z-50 w-96 bg-white rounded-2xl shadow-2xl border border-gray-100 flex flex-col overflow-hidden"
          style={{ maxHeight: "min(660px, calc(100vh - 120px))" }}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-[#1A2A52] to-[#2D5A9B] px-4 py-3 flex items-center gap-3 shrink-0">
            <div className="size-8 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
              <Sparkles className="size-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">Admin Assistant</p>
              <p className="text-[10px] text-white/60 truncate">{headerLabel}</p>
            </div>
            {mode !== "idle" && (
              <button
                onClick={() => resetToIdle("Cancelled. Choose Create or Edit to continue.")}
                className="text-white/50 hover:text-white text-[10px] mr-1 shrink-0"
              >
                Cancel
              </button>
            )}
            <button onClick={() => setOpen(false)} className="text-white/50 hover:text-white shrink-0">
              <X className="size-4" />
            </button>
          </div>

          {/* Mode switcher — ALWAYS visible when idle */}
          {mode === "idle" && (
            <div className="shrink-0 border-b border-gray-100">
              <div className="flex border-b border-gray-100">
                <button
                  onClick={() => setPanelTab("create")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-semibold transition-colors ${
                    panelTab === "create" ? "text-[#1A2A52] border-b-2 border-[#1A2A52] bg-[#1A2A52]/5" : "text-gray-400 hover:text-gray-600"
                  }`}
                >
                  <Plus className="size-3.5" /> Create
                </button>
                <button
                  onClick={() => setPanelTab("edit")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-semibold transition-colors ${
                    panelTab === "edit" ? "text-[#1A2A52] border-b-2 border-[#1A2A52] bg-[#1A2A52]/5" : "text-gray-400 hover:text-gray-600"
                  }`}
                >
                  <Pencil className="size-3.5" /> Edit
                </button>
              </div>

              <div className="px-3 py-2 space-y-0.5 max-h-64 overflow-y-auto">
                {panelTab === "create"
                  ? CREATE_ACTIONS.map((a, i) => (
                      <button
                        key={i}
                        onClick={() => startCreate(a.kind)}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-[#1A2A52]/5 transition-colors group text-left"
                      >
                        <div>
                          <p className="text-xs font-medium text-gray-800 group-hover:text-[#1A2A52]">{a.label}</p>
                          <p className="text-[10px] text-gray-400">{a.desc}</p>
                        </div>
                        <ChevronRight className="size-3.5 text-gray-300 group-hover:text-[#1A2A52] shrink-0" />
                      </button>
                    ))
                  : EDIT_ACTIONS.map((a, i) => (
                      <button
                        key={i}
                        onClick={() => startEdit(a.kind)}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-[#1A2A52]/5 transition-colors group text-left"
                      >
                        <div>
                          <p className="text-xs font-medium text-gray-800 group-hover:text-[#1A2A52]">{a.label}</p>
                          <p className="text-[10px] text-gray-400">{a.desc}</p>
                        </div>
                        <ChevronRight className="size-3.5 text-gray-300 group-hover:text-[#1A2A52] shrink-0" />
                      </button>
                    ))}
              </div>
            </div>
          )}

          {/* Active flow indicator */}
          {mode !== "idle" && (
            <div className="px-4 py-2 bg-[#1A2A52]/5 border-b border-gray-100 shrink-0 flex items-center gap-2">
              <div className="size-1.5 rounded-full bg-[#1A2A52] animate-pulse" />
              <p className="text-[10px] text-[#1A2A52] font-medium">{headerLabel}…</p>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 min-h-0">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} items-end gap-1.5`}>
                {(msg.role === "agent" || msg.role === "success" || msg.role === "error") && (
                  <div
                    className={`size-6 rounded-full flex items-center justify-center shrink-0 mb-0.5 ${
                      msg.role === "success" ? "bg-green-500" : msg.role === "error" ? "bg-red-500" : "bg-gradient-to-br from-[#1A2A52] to-[#2D5A9B]"
                    }`}
                  >
                    {msg.role === "success" ? (
                      <CheckCircle2 className="size-3.5 text-white" />
                    ) : msg.role === "error" ? (
                      <AlertCircle className="size-3.5 text-white" />
                    ) : (
                      <Sparkles className="size-3 text-white" />
                    )}
                  </div>
                )}
                {msg.role === "loading" ? (
                  <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-2xl text-xs text-gray-500">
                    <Loader2 className="size-3 animate-spin shrink-0" />
                    <span>{String(msg.text ?? "").replace(/\*\*([^*]+)\*\*/g, "$1")}</span>
                  </div>
                ) : (
                  <div className="max-w-[85%] min-w-0">
                    <div
                      className={`px-3 py-2.5 rounded-2xl text-xs leading-relaxed ${
                        msg.role === "user"
                          ? "bg-[#1A2A52] text-white rounded-br-sm"
                          : msg.role === "success"
                          ? "bg-green-50 border border-green-200 text-green-800 rounded-bl-sm"
                          : msg.role === "error"
                          ? "bg-red-50 border border-red-200 text-red-700 rounded-bl-sm"
                          : "bg-gray-100 text-gray-800 rounded-bl-sm"
                      }`}
                    >
                      {renderText(msg.text)}
                    </div>
                    {msg.options && msg.options.length > 0 && (
                      <div className="mt-1.5 space-y-1">
                        {msg.options.map((opt, oi) => (
                          <button
                            key={oi}
                            onClick={() => handleOption(opt)}
                            disabled={busy}
                            className="flex items-center gap-1.5 w-full text-left text-[11px] font-medium bg-white border border-gray-200 hover:border-[#1A2A52] hover:bg-[#1A2A52]/5 text-gray-700 hover:text-[#1A2A52] px-2.5 py-1.5 rounded-lg transition-all disabled:opacity-50"
                          >
                            <ChevronRight className="size-3 text-[#1A2A52]/50 shrink-0" />
                            <span className="truncate">{opt}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="px-3 pb-3 pt-2 border-t border-gray-100 shrink-0">
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 focus-within:border-[#1A2A52] focus-within:ring-1 focus-within:ring-[#1A2A52]/20 transition-all">
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={mode !== "idle" ? "Type your answer…" : "Choose Create or Edit above"}
                disabled={busy || mode === "idle"}
                className="flex-1 text-xs bg-transparent outline-none text-gray-700 placeholder:text-gray-400 disabled:opacity-50"
              />
              <button
                onClick={() => handleSend()}
                disabled={!input.trim() || busy || mode === "idle"}
                className="size-6 rounded-lg bg-[#1A2A52] flex items-center justify-center disabled:opacity-30 shrink-0"
              >
                {busy ? <Loader2 className="size-3 text-white animate-spin" /> : <Send className="size-3 text-white" />}
              </button>
            </div>
            {mode !== "idle" && <p className="text-[10px] text-gray-400 mt-1.5 px-1">Press Enter to submit</p>}
          </div>
        </div>
      )}
    </>
  );
}
