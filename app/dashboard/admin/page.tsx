"use client";
import { useState, useEffect, useCallback } from "react";
import {
  Users, Shield, BookOpen, CheckSquare, Sliders,
  List, BarChart2, Code2, ChevronDown, ChevronRight,
  Plus, Edit2, Trash2, Save, X, Check, AlertCircle,
} from "lucide-react";

type User         = { id:string; name:string; email:string; role:string; department:string|null; inviteStatus:string; jobTitle:string|null };
type Supplier     = { id:string; name:string; code:string; status:string; category:string|null; contactEmail:string|null };
type Rule         = { id:string; name:string; priority:number; active:boolean; minAmount:number|null; maxAmount:number|null; steps:{id:string;sequence:number;stepType:string;stepLabel:string}[] };
type Field        = { id:string; module:string; fieldName:string; label:string; fieldType:string; required:boolean; sortOrder:number; placeholder:string|null; options:string[]|null };
type Lookup       = { id:string; type:string; code:string; label:string; sortOrder:number };
type ContentGroup = { id:string; name:string; description:string|null; color:string|null };
type WorkspaceRole= { id:string; name:string; description:string|null; isSystem:boolean; permissions:string[] };
type ApiClient    = { id:string; name:string; description:string|null; clientId:string; scopes:string[]; active:boolean; createdAt:string };

const TABS = [
  { id:"users",     label:"Users & Invites",  icon:Users       },
  { id:"suppliers", label:"Pending Suppliers", icon:Shield      },
  { id:"roles",     label:"Roles",             icon:Shield      },
  { id:"content",   label:"Content Groups",    icon:BookOpen    },
  { id:"chains",    label:"Approval Chains",   icon:CheckSquare },
  { id:"fields",    label:"Custom Fields",     icon:Sliders     },
  { id:"lookups",   label:"Lookups",           icon:List        },
  { id:"coa",       label:"Chart of Accounts", icon:BarChart2   },
  { id:"api",       label:"API Clients",       icon:Code2       },
];

async function safeFetch(url:string) {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const text = await r.text();
    if (!text || !text.trim()) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export default function AdminPage() {
  const [tab, setTab]               = useState("users");
  const [users, setUsers]           = useState<User[]>([]);
  const [suppliers, setSuppliers]   = useState<Supplier[]>([]);
  const [rules, setRules]           = useState<Rule[]>([]);
  const [fields, setFields]         = useState<Field[]>([]);
  const [lookups, setLookups]       = useState<Lookup[]>([]);
  const [roles, setRoles]           = useState<WorkspaceRole[]>([]);
  const [groups, setGroups]         = useState<ContentGroup[]>([]);
  const [apiClients, setApiClients] = useState<ApiClient[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState("");

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [u, s, r, f, l, ro, cg, ac] = await Promise.all([
        safeFetch("/api/admin/users"),
        safeFetch("/api/suppliers?status=PENDING_APPROVAL"),
        safeFetch("/api/admin/approval-rules"),
        safeFetch("/api/admin/custom-fields"),
        safeFetch("/api/admin/lookups"),
        safeFetch("/api/admin/roles"),
        safeFetch("/api/admin/content-groups"),
        safeFetch("/api/admin/api-clients"),
      ]);
      setUsers(u?.users ?? []);
      setSuppliers(s?.suppliers ?? []);
      setRules(r?.rules ?? []);
      setFields(f?.fields ?? []);
      setLookups(l?.lookups ?? []);
      setRoles(ro?.roles ?? []);
      setGroups(cg?.groups ?? []);
      setApiClients(ac?.clients ?? []);
    } catch (e) {
      setError("Failed to load some data. Please refresh.");
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const badge = (n:number, color="bg-[#1A2A52]") =>
    n > 0 ? <span className={`ml-1.5 ${color} text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full`}>{n}</span> : null;

  return (
    <div className="min-h-screen bg-[#F7F8FA] flex">
      {/* Sidebar nav */}
      <div className="w-56 bg-white border-r border-gray-100 flex flex-col shrink-0">
        <div className="px-5 py-5 border-b border-gray-100">
          <p className="text-sm font-bold text-gray-900">Admin</p>
          <p className="text-[10px] text-gray-400 mt-0.5">Workspace configuration</p>
        </div>
        <nav className="flex-1 py-3">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`w-full flex items-center gap-2.5 px-5 py-2.5 text-xs font-medium transition-colors text-left ${tab===t.id ? "bg-[#1A2A52]/8 text-[#1A2A52] font-semibold" : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"}`}>
              <t.icon className="size-3.5 shrink-0" />
              <span className="flex-1">{t.label}</span>
              {t.id==="suppliers" && badge(suppliers.length,"bg-amber-500")}
              {t.id==="users"     && badge(users.filter(u=>u.inviteStatus==="PENDING").length,"bg-blue-500")}
            </button>
          ))}
        </nav>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-auto">
        <div className="px-8 py-6">
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl mb-5">
              <AlertCircle className="size-4 shrink-0" />{error}
              <button onClick={loadAll} className="ml-auto text-xs underline">Retry</button>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="size-8 border-2 border-[#1A2A52]/20 border-t-[#1A2A52] rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* USERS */}
              {tab==="users" && (
                <div>
                  <div className="flex items-center justify-between mb-5">
                    <h2 className="text-base font-semibold text-gray-900">Users & Invites</h2>
                    <span className="text-xs text-gray-400">{users.length} users</span>
                  </div>
                  <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                    <div className="grid grid-cols-12 gap-4 px-5 py-3 bg-gray-50 border-b border-gray-100 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                      <div className="col-span-3">Name</div><div className="col-span-3">Email</div>
                      <div className="col-span-2">Role</div><div className="col-span-2">Department</div>
                      <div className="col-span-2">Status</div>
                    </div>
                    {users.length===0 ? <div className="text-center py-10 text-gray-400 text-sm">No users found</div> : users.map(u=>(
                      <div key={u.id} className="grid grid-cols-12 gap-4 px-5 py-3.5 border-b border-gray-50 last:border-0 items-center hover:bg-gray-50/40">
                        <div className="col-span-3 flex items-center gap-2.5">
                          <div className="size-8 rounded-full bg-[#1A2A52]/10 flex items-center justify-center shrink-0"><span className="text-xs font-bold text-[#1A2A52]">{u.name.charAt(0)}</span></div>
                          <div><p className="text-xs font-semibold text-gray-900">{u.name}</p>{u.jobTitle&&<p className="text-[10px] text-gray-400">{u.jobTitle}</p>}</div>
                        </div>
                        <div className="col-span-3"><p className="text-xs text-gray-600 truncate">{u.email}</p></div>
                        <div className="col-span-2"><span className="text-[10px] font-semibold bg-[#1A2A52]/8 text-[#1A2A52] px-2 py-0.5 rounded-full">{u.role}</span></div>
                        <div className="col-span-2"><p className="text-xs text-gray-500">{u.department||"—"}</p></div>
                        <div className="col-span-2">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${u.inviteStatus==="ACTIVE"?"bg-emerald-50 text-emerald-700":u.inviteStatus==="PENDING"?"bg-amber-50 text-amber-700":"bg-gray-100 text-gray-500"}`}>{u.inviteStatus}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* PENDING SUPPLIERS */}
              {tab==="suppliers" && (
                <div>
                  <div className="flex items-center justify-between mb-5">
                    <h2 className="text-base font-semibold text-gray-900">Pending Suppliers</h2>
                    <span className="text-xs text-gray-400">{suppliers.length} pending review</span>
                  </div>
                  {suppliers.length===0 ? (
                    <div className="bg-white border border-gray-100 rounded-2xl p-10 text-center shadow-sm">
                      <Check className="size-10 text-emerald-400 mx-auto mb-3" />
                      <p className="text-sm font-semibold text-gray-500">All suppliers are reviewed</p>
                    </div>
                  ) : (
                    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                      {suppliers.map(s=>(
                        <div key={s.id} className="flex items-center gap-4 px-5 py-4 border-b border-gray-50 last:border-0">
                          <div className="size-10 rounded-xl bg-amber-50 flex items-center justify-center shrink-0"><span className="text-sm font-bold text-amber-600">{s.name.charAt(0)}</span></div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900">{s.name}</p>
                            <p className="text-xs text-gray-400">{s.code} · {s.category||"—"} · {s.contactEmail||"—"}</p>
                          </div>
                          <span className="text-[10px] font-semibold bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full border border-amber-200">{s.status.replace("_"," ")}</span>
                          <div className="flex gap-2">
                            <button onClick={async()=>{ await fetch(`/api/suppliers/${s.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({status:"ACTIVE",onboardingStage:"ACTIVE"})}); loadAll(); }} className="flex items-center gap-1 text-[10px] text-emerald-600 border border-emerald-200 px-2.5 py-1.5 rounded-lg hover:bg-emerald-50"><Check className="size-3"/>Approve</button>
                            <button onClick={async()=>{ await fetch(`/api/suppliers/${s.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({status:"BLOCKED"})}); loadAll(); }} className="flex items-center gap-1 text-[10px] text-red-500 border border-red-200 px-2.5 py-1.5 rounded-lg hover:bg-red-50"><X className="size-3"/>Reject</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ROLES */}
              {tab==="roles" && (
                <div>
                  <h2 className="text-base font-semibold text-gray-900 mb-5">Workspace Roles</h2>
                  {roles.length===0 ? <div className="bg-white border border-gray-100 rounded-2xl p-10 text-center text-gray-400 text-sm shadow-sm">No roles configured</div> : (
                    <div className="grid grid-cols-3 gap-4">
                      {roles.map(r=>(
                        <div key={r.id} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                          <div className="flex items-center gap-2 mb-2"><div className="size-8 bg-[#1A2A52]/8 rounded-lg flex items-center justify-center"><Shield className="size-4 text-[#1A2A52]"/></div><p className="text-sm font-semibold text-gray-900">{r.name}</p>{r.isSystem&&<span className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">System</span>}</div>
                          <p className="text-xs text-gray-400 mb-3">{r.description||"—"}</p>
                          <div className="flex flex-wrap gap-1">{(r.permissions||[]).slice(0,4).map(perm=><span key={perm} className="text-[9px] bg-[#1A2A52]/8 text-[#1A2A52] px-1.5 py-0.5 rounded font-medium">{perm}</span>)}{(r.permissions||[]).length>4&&<span className="text-[9px] text-gray-400">+{r.permissions.length-4} more</span>}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* CONTENT GROUPS */}
              {tab==="content" && (
                <div>
                  <h2 className="text-base font-semibold text-gray-900 mb-5">Content Groups</h2>
                  {groups.length===0 ? <div className="bg-white border border-gray-100 rounded-2xl p-10 text-center text-gray-400 text-sm shadow-sm">No content groups configured</div> : (
                    <div className="grid grid-cols-3 gap-4">
                      {groups.map(g=>(
                        <div key={g.id} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                          <div className="flex items-center gap-2 mb-2"><div className="size-3 rounded-full shrink-0" style={{backgroundColor:g.color||"#1A2A52"}}/><p className="text-sm font-semibold text-gray-900">{g.name}</p></div>
                          <p className="text-xs text-gray-400">{g.description||"—"}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* APPROVAL CHAINS */}
              {tab==="chains" && (
                <div>
                  <h2 className="text-base font-semibold text-gray-900 mb-5">Approval Chains</h2>
                  {rules.length===0 ? <div className="bg-white border border-gray-100 rounded-2xl p-10 text-center text-gray-400 text-sm shadow-sm">No approval rules configured</div> : (
                    <div className="space-y-3">
                      {rules.map(r=>(
                        <div key={r.id} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                          <div className="flex items-center gap-3 mb-3">
                            <span className={`size-2 rounded-full ${r.active?"bg-emerald-500":"bg-gray-300"}`}/>
                            <p className="text-sm font-semibold text-gray-900">{r.name}</p>
                            <span className="text-xs text-gray-400 ml-auto">{r.minAmount!=null?`₹${(r.minAmount/100000).toFixed(0)}L`:""}{r.minAmount!=null&&r.maxAmount!=null?" – ":""}{r.maxAmount!=null?`₹${(r.maxAmount/100000).toFixed(0)}L`:r.minAmount!=null?"+":" Any amount"}</span>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            {(r.steps||[]).map((s,i)=>(
                              <div key={s.id} className="flex items-center gap-2">
                                <div className="flex items-center gap-1.5 bg-[#1A2A52]/8 text-[#1A2A52] text-[10px] font-semibold px-2.5 py-1 rounded-lg"><span className="size-4 bg-[#1A2A52] text-white rounded-full text-[8px] flex items-center justify-center font-bold">{s.sequence}</span>{s.stepLabel}</div>
                                {i<r.steps.length-1&&<ChevronRight className="size-3 text-gray-300"/>}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* CUSTOM FIELDS */}
              {tab==="fields" && (
                <div>
                  <h2 className="text-base font-semibold text-gray-900 mb-5">Custom Fields</h2>
                  {fields.length===0 ? <div className="bg-white border border-gray-100 rounded-2xl p-10 text-center text-gray-400 text-sm shadow-sm">No custom fields configured</div> : (
                    <div className="space-y-4">
                      {["REQUISITION","SUPPLIER","PURCHASE_ORDER"].map(mod=>{
                        const modFields = fields.filter(f=>f.module===mod);
                        if(!modFields.length) return null;
                        return (
                          <div key={mod}>
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">{mod.replace("_"," ")}</p>
                            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                              {modFields.map(f=>(
                                <div key={f.id} className="flex items-center gap-4 px-5 py-3.5 border-b border-gray-50 last:border-0">
                                  <div className="flex-1"><p className="text-sm font-semibold text-gray-900">{f.label}</p><p className="text-[10px] text-gray-400">{f.fieldName} · {f.fieldType}</p></div>
                                  {f.required&&<span className="text-[9px] bg-red-50 text-red-600 px-2 py-0.5 rounded-full font-semibold">Required</span>}
                                  {f.options&&f.options.length>0&&<div className="flex gap-1">{f.options.slice(0,3).map(o=><span key={o} className="text-[9px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{o}</span>)}</div>}
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* LOOKUPS */}
              {tab==="lookups" && (
                <div>
                  <h2 className="text-base font-semibold text-gray-900 mb-5">Lookup Values</h2>
                  {lookups.length===0 ? <div className="bg-white border border-gray-100 rounded-2xl p-10 text-center text-gray-400 text-sm shadow-sm">No lookups configured</div> : (
                    <div className="space-y-4">
                      {[...new Set(lookups.map(l=>l.type))].map(type=>(
                        <div key={type}>
                          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">{type.replace("_"," ")}</p>
                          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                            <div className="divide-y divide-gray-50">
                              {lookups.filter(l=>l.type===type).map(l=>(
                                <div key={l.id} className="flex items-center gap-4 px-5 py-2.5">
                                  <span className="text-[10px] font-mono bg-gray-100 text-gray-600 px-2 py-0.5 rounded w-16 text-center">{l.code}</span>
                                  <span className="text-sm text-gray-800">{l.label}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* COA */}
              {tab==="coa" && (
                <div>
                  <h2 className="text-base font-semibold text-gray-900 mb-5">Chart of Accounts</h2>
                  <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm text-center">
                    <BarChart2 className="size-10 text-[#1A2A52]/30 mx-auto mb-3"/>
                    <p className="text-sm font-semibold text-gray-700 mb-1">ACE-IN01 — Ace Technologies India COA</p>
                    <p className="text-xs text-gray-400">4 segments configured: Company · Business Area · Cost Centre · GL Account</p>
                  </div>
                </div>
              )}

              {/* API CLIENTS */}
              {tab==="api" && (
                <div>
                  <h2 className="text-base font-semibold text-gray-900 mb-5">API Clients</h2>
                  {apiClients.length===0 ? <div className="bg-white border border-gray-100 rounded-2xl p-10 text-center text-gray-400 text-sm shadow-sm">No API clients configured</div> : (
                    <div className="space-y-3">
                      {apiClients.map(c=>(
                        <div key={c.id} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="size-9 bg-[#1A2A52]/8 rounded-xl flex items-center justify-center"><Code2 className="size-4 text-[#1A2A52]"/></div>
                            <div className="flex-1"><p className="text-sm font-semibold text-gray-900">{c.name}</p><p className="text-xs text-gray-400">{c.description}</p></div>
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${c.active?"bg-emerald-50 text-emerald-700":"bg-gray-100 text-gray-500"}`}>{c.active?"Active":"Inactive"}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-3">
                            <span className="text-[10px] text-gray-400 font-mono bg-gray-50 px-2 py-1 rounded">{c.clientId}</span>
                            <div className="flex gap-1 ml-auto">{(c.scopes||[]).map(s=><span key={s} className="text-[9px] bg-[#1A2A52]/8 text-[#1A2A52] px-1.5 py-0.5 rounded font-medium">{s}</span>)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
