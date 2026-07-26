"use client";
import { useState, useEffect, useCallback } from "react";
import { Users, Shield, BookOpen, CheckSquare, Sliders, List, BarChart2, Code2, ChevronRight, X, Check, AlertCircle, Plus, Trash2, Edit2, RefreshCw } from "lucide-react";

type User = { id:string; name:string; email:string; role:string; department:string|null; inviteStatus:string; jobTitle:string|null };
type Supplier = { id:string; name:string; code:string; status:string; category:string|null; contactEmail:string|null; onboardingStage:string|null };
type RuleStep = { id:string; sequence:number; stepType:string; stepLabel:string };
type Rule = { id:string; name:string; priority:number; active:boolean; minAmount:number|null; maxAmount:number|null; steps:RuleStep[] };
type Field = { id:string; module:string; fieldName:string; label:string; fieldType:string; required:boolean; placeholder:string|null; options:string[]|null };
type Lookup = { id:string; type:string; code:string; label:string };
type ContentGroup = { id:string; name:string; description:string|null; color:string|null };
type WorkspaceRole = { id:string; name:string; description:string|null; isSystem:boolean; permissions:string[] };
type ApiClient = { id:string; name:string; description:string|null; clientId:string; scopes:string[]; active:boolean };

const TABS = [
  { id:"users", label:"Users & Invites", icon:Users },
  { id:"suppliers", label:"Pending Suppliers", icon:Shield },
  { id:"roles", label:"Roles", icon:Shield },
  { id:"content", label:"Content Groups", icon:BookOpen },
  { id:"chains", label:"Approval Chains", icon:CheckSquare },
  { id:"fields", label:"Custom Fields", icon:Sliders },
  { id:"lookups", label:"Lookups", icon:List },
  { id:"coa", label:"Chart of Accounts", icon:BarChart2 },
  { id:"api", label:"API Clients", icon:Code2 },
];

const ROLES_LIST = ["ADMIN","PROCUREMENT","APPROVER","REQUESTOR","VIEWER"];
const DEPTS = ["Engineering","Finance","IT","Operations","HR","Marketing","Sales","Product","Legal","Executive"];
const STEP_TYPES = ["MANAGER","DIRECTOR","FINANCE","EXECUTIVE","PROCUREMENT"];
const FIELD_TYPES = ["TEXT","NUMBER","SELECT","BOOLEAN","DATE","TEXTAREA"];
const MODULES = ["REQUISITION","SUPPLIER","PURCHASE_ORDER"];
const LOOKUP_TYPES = ["DEPARTMENT","COST_CENTER","CATEGORY","GL_ACCOUNT","PAYMENT_TERMS","PRIORITY"];

async function safeFetch(url: string) {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const text = await r.text();
    if (!text?.trim()) return null;
    return JSON.parse(text);
  } catch { return null; }
}

function Input({ label, value, onChange, placeholder, type="text" }: { label:string; value:string; onChange:(v:string)=>void; placeholder?:string; type?:string }) {
  return (
    <div>
      <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</label>
      <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#1A2A52] focus:ring-1 focus:ring-[#1A2A52]/20" />
    </div>
  );
}

function Sel({ label, value, onChange, options }: { label:string; value:string; onChange:(v:string)=>void; options:string[] }) {
  return (
    <div>
      <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</label>
      <select value={value} onChange={e=>onChange(e.target.value)}
        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#1A2A52]">
        <option value="">Select...</option>
        {options.map(o=><option key={o}>{o}</option>)}
      </select>
    </div>
  );
}

function Modal({ title, onClose, children }: { title:string; onClose:()=>void; children:React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-[520px] max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-sm font-bold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="size-4"/></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-3">{children}</div>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [tab, setTab] = useState("users");
  const [users, setUsers] = useState<User[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [lookups, setLookups] = useState<Lookup[]>([]);
  const [roles, setRoles] = useState<WorkspaceRole[]>([]);
  const [groups, setGroups] = useState<ContentGroup[]>([]);
  const [apiClients, setApiClients] = useState<ApiClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [modal, setModal] = useState<string|null>(null);
  const [editItem, setEditItem] = useState<any>(null);
  const [userForm, setUserForm] = useState({ name:"", email:"", role:"REQUESTOR", jobTitle:"", department:"" });
  const [ruleForm, setRuleForm] = useState({ name:"", priority:"10", minAmount:"", maxAmount:"", steps:[{ sequence:1, stepType:"MANAGER", stepLabel:"Line Manager" }] });
  const [lookupForm, setLookupForm] = useState({ type:"DEPARTMENT", code:"", label:"" });
  const [fieldForm, setFieldForm] = useState({ module:"REQUISITION", fieldName:"", label:"", fieldType:"TEXT", required:false, placeholder:"", options:"" });
  const [groupForm, setGroupForm] = useState({ name:"", description:"", color:"#1A2A52" });

  const loadAll = useCallback(async () => {
    setLoading(true); setError("");
    const [u,s,r,f,l,ro,cg,ac] = await Promise.all([
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
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  async function apiCall(url: string, method: string, body?: any) {
    setSaving(true); setError("");
    try {
      const r = await fetch(url, { method, headers: {"Content-Type":"application/json"}, body: body ? JSON.stringify(body) : undefined });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed");
      await loadAll();
      setModal(null); setEditItem(null);
    } catch (e: any) { setError(e.message); }
    setSaving(false);
  }

  async function createUser() {
    if (!userForm.email || !userForm.name) { setError("Name and email required"); return; }
    await apiCall("/api/admin/users", "POST", userForm);
    setUserForm({ name:"", email:"", role:"REQUESTOR", jobTitle:"", department:"" });
  }
  async function createRule() {
    if (!ruleForm.name) { setError("Rule name required"); return; }
    await apiCall("/api/admin/approval-rules", "POST", { name:ruleForm.name, priority:parseInt(ruleForm.priority)||10, active:true, minAmount:ruleForm.minAmount?parseFloat(ruleForm.minAmount):null, maxAmount:ruleForm.maxAmount?parseFloat(ruleForm.maxAmount):null, steps:ruleForm.steps });
    setRuleForm({ name:"", priority:"10", minAmount:"", maxAmount:"", steps:[{ sequence:1, stepType:"MANAGER", stepLabel:"Line Manager" }] });
  }
  async function createLookup() {
    if (!lookupForm.code || !lookupForm.label) { setError("Code and label required"); return; }
    await apiCall("/api/admin/lookups", "POST", lookupForm);
    setLookupForm({ type:"DEPARTMENT", code:"", label:"" });
  }
  async function createField() {
    if (!fieldForm.fieldName || !fieldForm.label) { setError("Field name and label required"); return; }
    await apiCall("/api/admin/custom-fields", "POST", { ...fieldForm, options: fieldForm.options ? fieldForm.options.split(",").map((s:string)=>s.trim()).filter(Boolean) : [] });
    setFieldForm({ module:"REQUISITION", fieldName:"", label:"", fieldType:"TEXT", required:false, placeholder:"", options:"" });
  }
  async function createGroup() {
    if (!groupForm.name) { setError("Group name required"); return; }
    await apiCall("/api/admin/content-groups", "POST", groupForm);
    setGroupForm({ name:"", description:"", color:"#1A2A52" });
  }

  const pendingInvites = users.filter(u=>u.inviteStatus==="PENDING").length;

  return (
    <div className="min-h-screen bg-[#F7F8FA] flex">
      <div className="w-56 bg-white border-r border-gray-100 flex flex-col shrink-0">
        <div className="px-5 py-5 border-b border-gray-100">
          <p className="text-sm font-bold text-gray-900">Admin</p>
          <p className="text-[10px] text-gray-400 mt-0.5">Workspace configuration</p>
        </div>
        <nav className="flex-1 py-3">
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>{ setTab(t.id); setError(""); }}
              className={`w-full flex items-center gap-2.5 px-5 py-2.5 text-xs font-medium transition-colors text-left ${tab===t.id?"bg-[#1A2A52]/8 text-[#1A2A52] font-semibold":"text-gray-500 hover:bg-gray-50"}`}>
              <t.icon className="size-3.5 shrink-0"/>
              <span className="flex-1">{t.label}</span>
              {t.id==="suppliers"&&suppliers.length>0&&<span className="bg-amber-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">{suppliers.length}</span>}
              {t.id==="users"&&pendingInvites>0&&<span className="bg-blue-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">{pendingInvites}</span>}
            </button>
          ))}
        </nav>
      </div>

      <div className="flex-1 overflow-auto px-8 py-6">
        {error&&<div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-xs px-4 py-3 rounded-xl mb-4"><AlertCircle className="size-4 shrink-0"/>{error}<button onClick={()=>setError("")} className="ml-auto"><X className="size-3"/></button></div>}

        {loading ? <div className="flex items-center justify-center h-64"><div className="size-8 border-2 border-[#1A2A52]/20 border-t-[#1A2A52] rounded-full animate-spin"/></div> : <>

          {tab==="users"&&(
            <div>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-semibold text-gray-900">Users & Invites <span className="text-sm font-normal text-gray-400 ml-1">{users.length} total</span></h2>
                <button onClick={()=>setModal("user")} className="flex items-center gap-1.5 bg-[#1A2A52] text-white text-xs font-semibold px-4 py-2 rounded-xl hover:bg-[#243766]"><Plus className="size-3.5"/>Invite User</button>
              </div>
              <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                <div className="grid grid-cols-12 gap-3 px-5 py-3 bg-gray-50 border-b border-gray-100 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                  <div className="col-span-3">Name</div><div className="col-span-3">Email</div><div className="col-span-2">Role</div><div className="col-span-2">Department</div><div className="col-span-1">Status</div><div className="col-span-1"></div>
                </div>
                {users.length===0?<div className="text-center py-10 text-gray-400 text-sm">No users</div>:users.map(u=>(
                  <div key={u.id} className="grid grid-cols-12 gap-3 px-5 py-3.5 border-b border-gray-50 last:border-0 items-center hover:bg-gray-50/40">
                    <div className="col-span-3 flex items-center gap-2"><div className="size-8 rounded-full bg-[#1A2A52]/10 flex items-center justify-center shrink-0"><span className="text-xs font-bold text-[#1A2A52]">{u.name.charAt(0)}</span></div><div><p className="text-xs font-semibold text-gray-900">{u.name}</p>{u.jobTitle&&<p className="text-[10px] text-gray-400">{u.jobTitle}</p>}</div></div>
                    <div className="col-span-3"><p className="text-xs text-gray-600 truncate">{u.email}</p></div>
                    <div className="col-span-2"><span className="text-[10px] font-semibold bg-[#1A2A52]/8 text-[#1A2A52] px-2 py-0.5 rounded-full">{u.role}</span></div>
                    <div className="col-span-2"><p className="text-xs text-gray-500">{u.department||"—"}</p></div>
                    <div className="col-span-1"><span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${u.inviteStatus==="ACTIVE"?"bg-emerald-50 text-emerald-700":u.inviteStatus==="PENDING"?"bg-amber-50 text-amber-700":"bg-gray-100 text-gray-500"}`}>{u.inviteStatus}</span></div>
                    <div className="col-span-1 flex items-center gap-1 justify-end">
                      <button onClick={()=>{ setEditItem({...u}); setModal("editUser"); }} className="p-1.5 text-gray-400 hover:text-[#1A2A52] rounded-lg hover:bg-gray-100"><Edit2 className="size-3"/></button>
                      <button onClick={()=>{ if(confirm("Delete this user?")) apiCall(`/api/admin/users/${u.id}`,"DELETE"); }} className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50"><Trash2 className="size-3"/></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab==="suppliers"&&(
            <div>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-semibold text-gray-900">Pending Suppliers <span className="text-sm font-normal text-gray-400 ml-1">{suppliers.length} awaiting</span></h2>
                <button onClick={loadAll} className="flex items-center gap-1.5 text-xs text-gray-500 border border-gray-200 px-3 py-2 rounded-xl hover:bg-gray-50"><RefreshCw className="size-3"/>Refresh</button>
              </div>
              {suppliers.length===0?(
                <div className="bg-white border border-gray-100 rounded-2xl p-12 text-center shadow-sm"><Check className="size-10 text-emerald-400 mx-auto mb-3"/><p className="text-sm font-semibold text-gray-500">All suppliers reviewed</p></div>
              ):(
                <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                  {suppliers.map(s=>(
                    <div key={s.id} className="flex items-center gap-4 px-5 py-4 border-b border-gray-50 last:border-0 hover:bg-gray-50/40">
                      <div className="size-10 rounded-xl bg-amber-50 flex items-center justify-center shrink-0"><span className="text-sm font-bold text-amber-600">{s.name.charAt(0)}</span></div>
                      <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-gray-900">{s.name}</p><p className="text-xs text-gray-400">{s.code} · {s.category||"—"} · {s.contactEmail||"—"}</p></div>
                      <div className="flex gap-2">
                        <button onClick={()=>apiCall(`/api/suppliers/${s.id}`,"PATCH",{status:"ACTIVE",onboardingStage:"ACTIVE"})} className="flex items-center gap-1 text-[10px] text-emerald-600 border border-emerald-200 px-3 py-1.5 rounded-lg hover:bg-emerald-50 font-semibold"><Check className="size-3"/>Approve</button>
                        <button onClick={()=>apiCall(`/api/suppliers/${s.id}`,"PATCH",{status:"BLOCKED"})} className="flex items-center gap-1 text-[10px] text-red-500 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50 font-semibold"><X className="size-3"/>Reject</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab==="roles"&&(
            <div>
              <h2 className="text-base font-semibold text-gray-900 mb-5">Workspace Roles</h2>
              {roles.length===0?<div className="bg-white border border-gray-100 rounded-2xl p-10 text-center text-gray-400 text-sm shadow-sm">No roles configured</div>:(
                <div className="grid grid-cols-3 gap-4">
                  {roles.map(r=>(
                    <div key={r.id} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                      <div className="flex items-center gap-2 mb-2"><div className="size-8 bg-[#1A2A52]/8 rounded-lg flex items-center justify-center"><Shield className="size-4 text-[#1A2A52]"/></div><p className="text-sm font-semibold text-gray-900 flex-1">{r.name}</p>{r.isSystem&&<span className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">System</span>}</div>
                      <p className="text-xs text-gray-400 mb-3">{r.description||"—"}</p>
                      <div className="flex flex-wrap gap-1">{(r.permissions||[]).slice(0,3).map(perm=><span key={perm} className="text-[9px] bg-[#1A2A52]/8 text-[#1A2A52] px-1.5 py-0.5 rounded font-medium">{perm}</span>)}{(r.permissions||[]).length>3&&<span className="text-[9px] text-gray-400">+{(r.permissions||[]).length-3} more</span>}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab==="content"&&(
            <div>
              <div className="flex items-center justify-between mb-5"><h2 className="text-base font-semibold text-gray-900">Content Groups</h2><button onClick={()=>setModal("group")} className="flex items-center gap-1.5 bg-[#1A2A52] text-white text-xs font-semibold px-4 py-2 rounded-xl hover:bg-[#243766]"><Plus className="size-3.5"/>Add Group</button></div>
              {groups.length===0?<div className="bg-white border border-gray-100 rounded-2xl p-10 text-center text-gray-400 text-sm shadow-sm">No content groups</div>:(
                <div className="grid grid-cols-3 gap-4">{groups.map(g=>(<div key={g.id} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm"><div className="flex items-center gap-2 mb-2"><div className="size-3 rounded-full shrink-0" style={{backgroundColor:g.color||"#1A2A52"}}/><p className="text-sm font-semibold text-gray-900">{g.name}</p></div><p className="text-xs text-gray-400">{g.description||"—"}</p></div>))}</div>
              )}
            </div>
          )}

          {tab==="chains"&&(
            <div>
              <div className="flex items-center justify-between mb-5"><h2 className="text-base font-semibold text-gray-900">Approval Chains <span className="text-sm font-normal text-gray-400 ml-1">{rules.length} rules</span></h2><button onClick={()=>setModal("rule")} className="flex items-center gap-1.5 bg-[#1A2A52] text-white text-xs font-semibold px-4 py-2 rounded-xl hover:bg-[#243766]"><Plus className="size-3.5"/>Add Rule</button></div>
              {rules.length===0?<div className="bg-white border border-gray-100 rounded-2xl p-10 text-center text-gray-400 text-sm shadow-sm">No approval rules</div>:(
                <div className="space-y-3">{rules.map(r=>(
                  <div key={r.id} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                    <div className="flex items-center gap-3 mb-3"><span className={`size-2 rounded-full shrink-0 ${r.active?"bg-emerald-500":"bg-gray-300"}`}/><p className="text-sm font-semibold text-gray-900 flex-1">{r.name}</p><span className="text-xs text-gray-400">{r.minAmount!=null?`₹${(r.minAmount/100000).toFixed(0)}L`:""}{r.minAmount!=null&&r.maxAmount!=null?" – ":""}{r.maxAmount!=null?`₹${(r.maxAmount/100000).toFixed(0)}L`:r.minAmount!=null?"+":""}</span><button onClick={()=>{ if(confirm("Delete this rule?")) apiCall("/api/admin/approval-rules","DELETE",{id:r.id}); }} className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50"><Trash2 className="size-3.5"/></button></div>
                    <div className="flex items-center gap-2 flex-wrap">{(r.steps||[]).map((s,i)=>(<div key={s.id} className="flex items-center gap-2"><div className="flex items-center gap-1.5 bg-[#1A2A52]/8 text-[#1A2A52] text-[10px] font-semibold px-2.5 py-1 rounded-lg"><span className="size-4 bg-[#1A2A52] text-white rounded-full text-[8px] flex items-center justify-center font-bold">{s.sequence}</span>{s.stepLabel}</div>{i<(r.steps||[]).length-1&&<ChevronRight className="size-3 text-gray-300"/>}</div>))}</div>
                  </div>
                ))}</div>
              )}
            </div>
          )}

          {tab==="fields"&&(
            <div>
              <div className="flex items-center justify-between mb-5"><h2 className="text-base font-semibold text-gray-900">Custom Fields <span className="text-sm font-normal text-gray-400 ml-1">{fields.length} fields</span></h2><button onClick={()=>setModal("field")} className="flex items-center gap-1.5 bg-[#1A2A52] text-white text-xs font-semibold px-4 py-2 rounded-xl hover:bg-[#243766]"><Plus className="size-3.5"/>Add Field</button></div>
              {fields.length===0?<div className="bg-white border border-gray-100 rounded-2xl p-10 text-center text-gray-400 text-sm shadow-sm">No custom fields</div>:(
                <div className="space-y-4">{MODULES.map(mod=>{ const mf=fields.filter(f=>f.module===mod); if(!mf.length) return null; return (<div key={mod}><p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">{mod.replace(/_/g," ")}</p><div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">{mf.map(f=>(<div key={f.id} className="flex items-center gap-4 px-5 py-3.5 border-b border-gray-50 last:border-0 hover:bg-gray-50/40"><div className="flex-1"><p className="text-sm font-semibold text-gray-900">{f.label}</p><p className="text-[10px] text-gray-400">{f.fieldName} · {f.fieldType}</p></div>{f.required&&<span className="text-[9px] bg-red-50 text-red-600 px-2 py-0.5 rounded-full font-semibold">Required</span>}{f.options&&f.options.length>0&&<div className="flex gap-1">{f.options.slice(0,3).map((o:string)=><span key={o} className="text-[9px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{o}</span>)}</div>}<button onClick={()=>{ if(confirm("Delete this field?")) apiCall("/api/admin/custom-fields","DELETE",{id:f.id}); }} className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 shrink-0"><Trash2 className="size-3.5"/></button></div>))}</div></div>); })}</div>
              )}
            </div>
          )}

          {tab==="lookups"&&(
            <div>
              <div className="flex items-center justify-between mb-5"><h2 className="text-base font-semibold text-gray-900">Lookup Values <span className="text-sm font-normal text-gray-400 ml-1">{lookups.length} values</span></h2><button onClick={()=>setModal("lookup")} className="flex items-center gap-1.5 bg-[#1A2A52] text-white text-xs font-semibold px-4 py-2 rounded-xl hover:bg-[#243766]"><Plus className="size-3.5"/>Add Value</button></div>
              {lookups.length===0?<div className="bg-white border border-gray-100 rounded-2xl p-10 text-center text-gray-400 text-sm shadow-sm">No lookups</div>:(
                <div className="space-y-4">{[...new Set(lookups.map(l=>l.type))].map(type=>(<div key={type}><p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">{type.replace(/_/g," ")}</p><div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">{lookups.filter(l=>l.type===type).map(l=>(<div key={l.id} className="flex items-center gap-4 px-5 py-2.5 border-b border-gray-50 last:border-0 hover:bg-gray-50/40"><span className="text-[10px] font-mono bg-gray-100 text-gray-600 px-2 py-0.5 rounded w-20 text-center">{l.code}</span><span className="text-sm text-gray-800 flex-1">{l.label}</span><button onClick={()=>{ if(confirm("Delete this lookup?")) apiCall("/api/admin/lookups","DELETE",{id:l.id}); }} className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50"><Trash2 className="size-3"/></button></div>))}</div></div>))}</div>
              )}
            </div>
          )}

          {tab==="coa"&&(
            <div>
              <h2 className="text-base font-semibold text-gray-900 mb-5">Chart of Accounts</h2>
              <div className="bg-white border border-gray-100 rounded-2xl p-8 shadow-sm">
                <div className="flex items-center gap-4 mb-6"><div className="size-12 bg-[#1A2A52]/8 rounded-xl flex items-center justify-center"><BarChart2 className="size-6 text-[#1A2A52]"/></div><div><p className="text-base font-bold text-gray-900">ACE-IN01 — Ace Technologies India COA</p><p className="text-xs text-gray-400 mt-0.5">GST · Company Code: ACETEC-IN · Currency: INR</p></div></div>
                <div className="grid grid-cols-4 gap-3">{[["1","Company","Entity identifier"],["2","Business Area","Linked to Department"],["3","Cost Centre","Linked to Cost Center"],["4","GL Account","Linked to GL Account"]].map(([pos,name,desc])=>(<div key={pos} className="bg-gray-50 rounded-xl p-4 border border-gray-100"><div className="size-6 bg-[#1A2A52] text-white rounded-full text-xs flex items-center justify-center font-bold mb-2">{pos}</div><p className="text-xs font-semibold text-gray-900">{name}</p><p className="text-[10px] text-gray-400 mt-0.5">{desc}</p></div>))}</div>
              </div>
            </div>
          )}

          {tab==="api"&&(
            <div>
              <h2 className="text-base font-semibold text-gray-900 mb-5">API Clients</h2>
              {apiClients.length===0?<div className="bg-white border border-gray-100 rounded-2xl p-10 text-center text-gray-400 text-sm shadow-sm">No API clients</div>:(
                <div className="space-y-3">{apiClients.map(c=>(<div key={c.id} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm"><div className="flex items-center gap-3 mb-3"><div className="size-9 bg-[#1A2A52]/8 rounded-xl flex items-center justify-center"><Code2 className="size-4 text-[#1A2A52]"/></div><div className="flex-1"><p className="text-sm font-semibold text-gray-900">{c.name}</p><p className="text-xs text-gray-400">{c.description}</p></div><span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${c.active?"bg-emerald-50 text-emerald-700 border border-emerald-200":"bg-gray-100 text-gray-500"}`}>{c.active?"Active":"Inactive"}</span></div><div className="flex items-center gap-2"><span className="text-[10px] text-gray-400 font-mono bg-gray-50 border border-gray-100 px-3 py-1.5 rounded-lg">{c.clientId}</span><div className="flex gap-1 ml-auto">{(c.scopes||[]).map(s=><span key={s} className="text-[9px] bg-[#1A2A52]/8 text-[#1A2A52] px-1.5 py-0.5 rounded font-medium">{s}</span>)}</div></div></div>))}</div>
              )}
            </div>
          )}

        </>}
      </div>

      {modal==="user"&&<Modal title="Invite New User" onClose={()=>{ setModal(null); setError(""); }}><Input label="Full Name *" value={userForm.name} onChange={v=>setUserForm(f=>({...f,name:v}))} placeholder="e.g. Rajesh Kumar"/><Input label="Email *" value={userForm.email} onChange={v=>setUserForm(f=>({...f,email:v}))} placeholder="rajesh@company.com" type="email"/><Sel label="Role *" value={userForm.role} onChange={v=>setUserForm(f=>({...f,role:v}))} options={ROLES_LIST}/><Sel label="Department" value={userForm.department} onChange={v=>setUserForm(f=>({...f,department:v}))} options={DEPTS}/><Input label="Job Title" value={userForm.jobTitle} onChange={v=>setUserForm(f=>({...f,jobTitle:v}))} placeholder="e.g. Procurement Manager"/><div className="flex gap-3 pt-2"><button onClick={createUser} disabled={saving} className="flex-1 bg-[#1A2A52] text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-[#243766] disabled:opacity-50">{saving?"Saving...":"Send Invite"}</button><button onClick={()=>setModal(null)} className="px-5 py-2.5 text-sm text-gray-500 border border-gray-200 rounded-xl">Cancel</button></div></Modal>}

      {modal==="editUser"&&editItem&&<Modal title="Edit User" onClose={()=>{ setModal(null); setEditItem(null); setError(""); }}><Input label="Full Name" value={editItem.name||""} onChange={v=>setEditItem((p:any)=>({...p,name:v}))} placeholder="Full name"/><Sel label="Role" value={editItem.role||""} onChange={v=>setEditItem((p:any)=>({...p,role:v}))} options={ROLES_LIST}/><Sel label="Department" value={editItem.department||""} onChange={v=>setEditItem((p:any)=>({...p,department:v}))} options={DEPTS}/><Input label="Job Title" value={editItem.jobTitle||""} onChange={v=>setEditItem((p:any)=>({...p,jobTitle:v}))} placeholder="Job title"/><Sel label="Status" value={editItem.inviteStatus||""} onChange={v=>setEditItem((p:any)=>({...p,inviteStatus:v}))} options={["ACTIVE","PENDING","INACTIVE"]}/><div className="flex gap-3 pt-2"><button onClick={()=>apiCall(`/api/admin/users/${editItem.id}`,"PATCH",editItem)} disabled={saving} className="flex-1 bg-[#1A2A52] text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-[#243766] disabled:opacity-50">{saving?"Saving...":"Save Changes"}</button><button onClick={()=>{ setModal(null); setEditItem(null); }} className="px-5 py-2.5 text-sm text-gray-500 border border-gray-200 rounded-xl">Cancel</button></div></Modal>}

      {modal==="rule"&&<Modal title="Add Approval Rule" onClose={()=>{ setModal(null); setError(""); }}><Input label="Rule Name *" value={ruleForm.name} onChange={v=>setRuleForm(f=>({...f,name:v}))} placeholder="e.g. Above 10 Lakh — Full Approval"/><div className="grid grid-cols-2 gap-3"><Input label="Min Amount (Rs)" value={ruleForm.minAmount} onChange={v=>setRuleForm(f=>({...f,minAmount:v}))} placeholder="0" type="number"/><Input label="Max Amount (Rs)" value={ruleForm.maxAmount} onChange={v=>setRuleForm(f=>({...f,maxAmount:v}))} placeholder="Leave blank for no limit" type="number"/></div><Input label="Priority" value={ruleForm.priority} onChange={v=>setRuleForm(f=>({...f,priority:v}))} placeholder="10" type="number"/><div><label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Approval Steps</label><div className="space-y-2">{ruleForm.steps.map((step,i)=>(<div key={i} className="flex items-center gap-2"><span className="size-5 bg-[#1A2A52] text-white rounded-full text-[10px] flex items-center justify-center font-bold shrink-0">{i+1}</span><select value={step.stepType} onChange={e=>{ const s=[...ruleForm.steps]; s[i]={...s[i],stepType:e.target.value}; setRuleForm(f=>({...f,steps:s})); }} className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-[#1A2A52]">{STEP_TYPES.map(t=><option key={t}>{t}</option>)}</select><input value={step.stepLabel} onChange={e=>{ const s=[...ruleForm.steps]; s[i]={...s[i],stepLabel:e.target.value}; setRuleForm(f=>({...f,steps:s})); }} className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-[#1A2A52]" placeholder="Step label"/>{i>0&&<button onClick={()=>setRuleForm(f=>({...f,steps:f.steps.filter((_:any,j:number)=>j!==i)}))} className="text-gray-400 hover:text-red-500"><X className="size-3.5"/></button>}</div>))}</div><button onClick={()=>setRuleForm(f=>({...f,steps:[...f.steps,{sequence:f.steps.length+1,stepType:"FINANCE",stepLabel:"Finance Sign-off"}]}))} className="mt-2 flex items-center gap-1 text-xs text-[#1A2A52] font-semibold hover:underline"><Plus className="size-3"/>Add Step</button></div><div className="flex gap-3 pt-2"><button onClick={createRule} disabled={saving} className="flex-1 bg-[#1A2A52] text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-[#243766] disabled:opacity-50">{saving?"Saving...":"Create Rule"}</button><button onClick={()=>setModal(null)} className="px-5 py-2.5 text-sm text-gray-500 border border-gray-200 rounded-xl">Cancel</button></div></Modal>}

      {modal==="lookup"&&<Modal title="Add Lookup Value" onClose={()=>{ setModal(null); setError(""); }}><Sel label="Type *" value={lookupForm.type} onChange={v=>setLookupForm(f=>({...f,type:v}))} options={LOOKUP_TYPES}/><Input label="Code *" value={lookupForm.code} onChange={v=>setLookupForm(f=>({...f,code:v.toUpperCase()}))} placeholder="e.g. ENG or 6100"/><Input label="Label *" value={lookupForm.label} onChange={v=>setLookupForm(f=>({...f,label:v}))} placeholder="e.g. Engineering"/><div className="flex gap-3 pt-2"><button onClick={createLookup} disabled={saving} className="flex-1 bg-[#1A2A52] text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-[#243766] disabled:opacity-50">{saving?"Saving...":"Add Value"}</button><button onClick={()=>setModal(null)} className="px-5 py-2.5 text-sm text-gray-500 border border-gray-200 rounded-xl">Cancel</button></div></Modal>}

      {modal==="field"&&<Modal title="Add Custom Field" onClose={()=>{ setModal(null); setError(""); }}><Sel label="Module *" value={fieldForm.module} onChange={v=>setFieldForm(f=>({...f,module:v}))} options={MODULES}/><div className="grid grid-cols-2 gap-3"><Input label="Field Name *" value={fieldForm.fieldName} onChange={v=>setFieldForm(f=>({...f,fieldName:v.toLowerCase().replace(/\s+/g,"_")}))} placeholder="e.g. project_code"/><Input label="Display Label *" value={fieldForm.label} onChange={v=>setFieldForm(f=>({...f,label:v}))} placeholder="e.g. Project Code"/></div><Sel label="Field Type *" value={fieldForm.fieldType} onChange={v=>setFieldForm(f=>({...f,fieldType:v}))} options={FIELD_TYPES}/><Input label="Placeholder" value={fieldForm.placeholder} onChange={v=>setFieldForm(f=>({...f,placeholder:v}))} placeholder="Helper text"/>{fieldForm.fieldType==="SELECT"&&<Input label="Options (comma separated)" value={fieldForm.options} onChange={v=>setFieldForm(f=>({...f,options:v}))} placeholder="Option A, Option B, Option C"/>}<label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={fieldForm.required} onChange={e=>setFieldForm(f=>({...f,required:e.target.checked}))} className="size-4 accent-[#1A2A52]"/><span className="text-sm text-gray-700 font-medium">Required field</span></label><div className="flex gap-3 pt-2"><button onClick={createField} disabled={saving} className="flex-1 bg-[#1A2A52] text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-[#243766] disabled:opacity-50">{saving?"Saving...":"Add Field"}</button><button onClick={()=>setModal(null)} className="px-5 py-2.5 text-sm text-gray-500 border border-gray-200 rounded-xl">Cancel</button></div></Modal>}

      {modal==="group"&&<Modal title="Add Content Group" onClose={()=>{ setModal(null); setError(""); }}><Input label="Group Name *" value={groupForm.name} onChange={v=>setGroupForm(f=>({...f,name:v}))} placeholder="e.g. IT and Engineering"/><Input label="Description" value={groupForm.description} onChange={v=>setGroupForm(f=>({...f,description:v}))} placeholder="What this group covers"/><div><label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Color</label><input type="color" value={groupForm.color} onChange={e=>setGroupForm(f=>({...f,color:e.target.value}))} className="h-9 w-20 border border-gray-200 rounded-lg cursor-pointer"/></div><div className="flex gap-3 pt-2"><button onClick={createGroup} disabled={saving} className="flex-1 bg-[#1A2A52] text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-[#243766] disabled:opacity-50">{saving?"Saving...":"Create Group"}</button><button onClick={()=>setModal(null)} className="px-5 py-2.5 text-sm text-gray-500 border border-gray-200 rounded-xl">Cancel</button></div></Modal>}

    </div>
  );
}
