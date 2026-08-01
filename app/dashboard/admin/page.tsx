"use client";
import CsvUploadModal, { CsvUploadConfig } from "@/components/CsvUploadModal";
import { AdminAgent } from "@/components/AdminAgent";
import { useState, useEffect, useCallback } from "react";
import { Users, Shield, BookOpen, CheckSquare, Sliders, List, BarChart2, Code2, ChevronRight, ChevronDown, X, Check, AlertCircle, Plus, Trash2, Edit2, RefreshCw, Upload, Package, Zap, Sparkles, Layers } from "lucide-react";

type User = { id:string; name:string; email:string; role:string; department:string|null; inviteStatus:string; jobTitle:string|null; employeeId:string|null; managerId:string|null; manager:{id:string;name:string}|null; businessUnit:string|null; costCenter:string|null; addressLine1:string|null; addressLine2:string|null; city:string|null; state:string|null; postalCode:string|null; country:string|null; userRoles:{role:{id:string;name:string}}[]; contentGroupMembers:{contentGroup:{id:string;name:string}}[]; chartOfAccountAccess:{chartOfAccount:{id:string;code:string}}[] };
type Supplier = { id:string; name:string; code:string; status:string; category:string|null; contactEmail:string|null; onboardingStage:string|null };
type RuleStep = { id:string; sequence:number; stepType:string; stepLabel:string; approverUserIds:string[]; approverMode:string };
type Rule = { id:string; name:string; module:string; priority:number; active:boolean; minAmount:number|null; maxAmount:number|null; category:string|null; department:string|null; steps:RuleStep[] };
const APPROVAL_MODULES = ["REQUISITION","INTAKE","SUPPLIER_ONBOARDING","CONTRACT"];
type Field = { id:string; entity:string; name:string; fieldKey:string; fieldType:string; required:boolean; helpText:string|null; options:string[]; categories:string[] };
type Lookup = { id:string; type:string; code:string; label:string; parentCode:string|null };
type ContentGroup = { id:string; name:string; description:string|null; color:string|null };
type WorkspaceRole = { id:string; name:string; description:string|null; isSystem:boolean; permissions:Record<string,Record<string,boolean>>; userRoles:{user:{id:string;name:string}}[] };
const PERM_MODULES = ["requisitions","approvals","purchaseOrders","suppliers","reports","admin"];
const PERM_ACTIONS = ["view","create","edit","delete","submit","approve","send","manage"];
type ApiClient = { id:string; name:string; description:string|null; clientId:string; scopes:string[]; active:boolean };
type CoaSegment = { id:string; position:number; name:string; description:string|null; linkedLookupType:string|null };
type Coa = { id:string; name:string; code:string; companyCode:string|null; currency:string; taxType:string|null; taxRegNumber:string|null; billingCity:string|null; billingCountry:string|null; segments:CoaSegment[] };
type CatalogItem = { id:string; sku:string; name:string; unitPrice:string; currency:string; category:string|null; supplierId:string|null; supplier:{name:string}|null; unit:string|null; leadDays:number|null; active:boolean };
type Catalog = { id:string; name:string; type:string; status:string; description:string|null; supplierId:string|null; supplier:{name:string}|null; punchoutUrl:string|null; cxmlFromIdentity:string|null; cxmlToIdentity:string|null; _count:{items:number} };
type ActiveSupplier = { id:string; name:string };

const TABS = [
  { id:"users", label:"Users & Invites", icon:Users },
  { id:"suppliers", label:"Pending Suppliers", icon:Shield },
  { id:"roles", label:"Roles", icon:Shield },
  { id:"content", label:"Content Groups", icon:BookOpen },
  { id:"chains", label:"Approval Chains", icon:CheckSquare },
  { id:"fields", label:"Custom Fields", icon:Sliders },
  { id:"commodities", label:"Commodities", icon:Layers },
  { id:"lookups", label:"Lookups", icon:List },
  { id:"coa", label:"Chart of Accounts", icon:BarChart2 },
  { id:"catalogs", label:"Catalogs", icon:Package },
  { id:"api", label:"API Clients", icon:Code2 },
];

const ROLES_LIST = ["ADMIN","PROCUREMENT","APPROVER","REQUESTOR","VIEWER"];
const STEP_TYPES = ["MANAGER","DIRECTOR","FINANCE","EXECUTIVE","PROCUREMENT"];
const FIELD_TYPES = ["TEXT","NUMBER","DATE","DROPDOWN","CHECKBOX","TEXTAREA"];
const MODULES = ["REQUISITION","SUPPLIER","PURCHASE_ORDER"];
const LOOKUP_TYPES = ["DEPARTMENT","COST_CENTER","CATEGORY","GL_ACCOUNT","PAYMENT_TERMS","PRIORITY","DELIVERY_ADDRESS"];

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

function StepEditor({ steps, setSteps, users }: { steps:any[]; setSteps:(fn:(s:any[])=>any[])=>void; users:{id:string;name:string}[] }) {
  return (
    <div>
      <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Approval Steps</label>
      <div className="space-y-3">
        {steps.map((step,i)=>(
          <div key={i} className="border border-gray-200 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="size-5 bg-[#1A2A52] text-white rounded-full text-[10px] flex items-center justify-center font-bold shrink-0">{i+1}</span>
              <select value={step.stepType} onChange={e=>setSteps(s=>{const n=[...s];n[i]={...n[i],stepType:e.target.value};return n;})} className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-[#1A2A52]">{STEP_TYPES.map(t=><option key={t}>{t}</option>)}</select>
              <input value={step.stepLabel} onChange={e=>setSteps(s=>{const n=[...s];n[i]={...n[i],stepLabel:e.target.value};return n;})} className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-[#1A2A52]" placeholder="Step label"/>
              {i>0&&<button onClick={()=>setSteps(s=>s.filter((_,j)=>j!==i))} className="text-gray-400 hover:text-red-500"><X className="size-3.5"/></button>}
            </div>
            <MultiSel label="Specific approvers (optional — leave empty to route by role above)" selected={step.approverUserIds} onChange={v=>setSteps(s=>{const n=[...s];n[i]={...n[i],approverUserIds:v};return n;})} options={users}/>
            {step.approverUserIds.length>1&&(
              <div className="flex items-center gap-3 mt-2">
                <label className="flex items-center gap-1.5 text-[10px] text-gray-600 cursor-pointer"><input type="radio" checked={step.approverMode==="ANY"} onChange={()=>setSteps(s=>{const n=[...s];n[i]={...n[i],approverMode:"ANY"};return n;})}/>Any one approves (parallel)</label>
                <label className="flex items-center gap-1.5 text-[10px] text-gray-600 cursor-pointer"><input type="radio" checked={step.approverMode==="ALL"} onChange={()=>setSteps(s=>{const n=[...s];n[i]={...n[i],approverMode:"ALL"};return n;})}/>All must approve (parallel)</label>
              </div>
            )}
          </div>
        ))}
      </div>
      <button onClick={()=>setSteps(s=>[...s,{sequence:s.length+1,stepType:"FINANCE",stepLabel:"Finance Sign-off",approverUserIds:[],approverMode:"ANY"}])} className="mt-2 flex items-center gap-1 text-xs text-[#1A2A52] font-semibold hover:underline"><Plus className="size-3"/>Add Step</button>
    </div>
  );
}

function PermMatrix({ value, onChange }: { value:Record<string,Record<string,boolean>>; onChange:(v:Record<string,Record<string,boolean>>)=>void }) {
  function toggle(mod:string, act:string) {
    onChange({ ...value, [mod]: { ...(value[mod]||{}), [act]: !value[mod]?.[act] } });
  }
  return (
    <div>
      <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Permissions</label>
      <div className="border border-gray-200 rounded-xl overflow-x-auto">
        <table className="w-full text-[10px]">
          <thead><tr className="bg-gray-50">
            <th className="text-left px-2 py-1.5 font-semibold text-gray-500">Module</th>
            {PERM_ACTIONS.map(a=><th key={a} className="px-1 py-1.5 font-semibold text-gray-500 capitalize">{a}</th>)}
          </tr></thead>
          <tbody>
            {PERM_MODULES.map(mod=>(
              <tr key={mod} className="border-t border-gray-100">
                <td className="px-2 py-1.5 font-medium text-gray-700">{mod.replace(/([A-Z])/g," $1")}</td>
                {PERM_ACTIONS.map(act=>(
                  <td key={act} className="text-center px-1 py-1.5"><input type="checkbox" checked={!!value[mod]?.[act]} onChange={()=>toggle(mod,act)} className="accent-[#1A2A52]"/></td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function UserSel({ label, value, onChange, users }: { label:string; value:string; onChange:(v:string)=>void; users:{id:string;name:string}[] }) {
  return (
    <div>
      <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</label>
      <select value={value} onChange={e=>onChange(e.target.value)}
        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#1A2A52]">
        <option value="">None</option>
        {users.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
      </select>
    </div>
  );
}

function MultiSel({ label, selected, onChange, options }: { label:string; selected:string[]; onChange:(v:string[])=>void; options:{id:string;name:string}[] }) {
  return (
    <div>
      <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</label>
      <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto border border-gray-200 rounded-xl p-2">
        {options.length===0?<span className="text-xs text-gray-400 px-1 py-0.5">None configured yet</span>:options.map(o=>(
          <label key={o.id} className="flex items-center gap-1.5 text-xs bg-gray-50 px-2 py-1 rounded-lg cursor-pointer">
            <input type="checkbox" checked={selected.includes(o.id)} onChange={e=>onChange(e.target.checked?[...selected,o.id]:selected.filter(x=>x!==o.id))} className="accent-[#1A2A52]"/>
            {o.name}
          </label>
        ))}
      </div>
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
  const [showLookupUpload, setShowLookupUpload] = useState(false);
  const [showUserUpload, setShowUserUpload] = useState(false);
  const [coas, setCoas] = useState<Coa[]>([]);
  const [catalogs, setCatalogs] = useState<Catalog[]>([]);
  const [catalogItems, setCatalogItems] = useState<Record<string, CatalogItem[]>>({});
  const [expandedCatalog, setExpandedCatalog] = useState<string|null>(null);
  const [showCatalogUpload, setShowCatalogUpload] = useState<string|null>(null);
  const [showCoaValueUpload, setShowCoaValueUpload] = useState<string|null>(null);
  const [showCommodityUpload, setShowCommodityUpload] = useState(false);
  const [assistantSignal, setAssistantSignal] = useState(0);
  const [activeSuppliers, setActiveSuppliers] = useState<ActiveSupplier[]>([]);
  const [catalogForm, setCatalogForm] = useState({ name:"", type:"HOSTED", description:"", punchoutUrl:"", cxmlFromDomain:"", cxmlFromIdentity:"", cxmlToDomain:"", cxmlToIdentity:"", cxmlSenderDomain:"", cxmlSenderIdentity:"", cxmlSharedSecret:"" });
  const [itemForm, setItemForm] = useState({ sku:"", name:"", unitPrice:"", currency:"INR", category:"", unit:"", leadDays:"", supplierId:"" });
  const [userForm, setUserForm] = useState({ name:"", email:"", role:"REQUESTOR", jobTitle:"", department:"", employeeId:"", managerId:"", businessUnit:"", costCenter:"", addressLine1:"", city:"", state:"", postalCode:"", country:"", contentGroupIds:[] as string[], workspaceRoleIds:[] as string[] });
  const [ruleForm, setRuleForm] = useState({ name:"", module:"REQUISITION", priority:"10", minAmount:"", maxAmount:"", category:"", department:"", steps:[{ sequence:1, stepType:"MANAGER", stepLabel:"Line Manager", approverUserIds:[] as string[], approverMode:"ANY" }] });
  const [lookupForm, setLookupForm] = useState({ type:"DEPARTMENT", code:"", label:"" });
  const [creatingNewType, setCreatingNewType] = useState(false);
  const [commodityForm, setCommodityForm] = useState({ code:"", label:"", parentCode:"" });
  const [expandedCommodity, setExpandedCommodity] = useState<string|null>(null);
  const [expandedCommodity2, setExpandedCommodity2] = useState<string|null>(null);
  const [fieldForm, setFieldForm] = useState({ entity:"REQUISITION", name:"", fieldType:"TEXT", required:false, helpText:"", options:"", categories:[] as string[] });
  const [groupForm, setGroupForm] = useState({ name:"", description:"", color:"#1A2A52" });
  const [roleForm, setRoleForm] = useState<{name:string;description:string;permissions:Record<string,Record<string,boolean>>}>({ name:"", description:"", permissions:{} });
  const [coaForm, setCoaForm] = useState({ name:"", code:"", companyCode:"", currency:"INR", taxType:"", taxRegNumber:"", billingCity:"", billingCountry:"" });
  const [segmentForm, setSegmentForm] = useState<{coaId:string;position:number;name:string;description:string;isRequired:boolean;linkedLookupType:string}>({ coaId:"", position:1, name:"", description:"", isRequired:false, linkedLookupType:"" });

  const loadAll = useCallback(async () => {
    setLoading(true); setError("");
    const [u,s,r,f,l,ro,cg,ac,co,ca,as] = await Promise.all([
      safeFetch("/api/admin/users"),
      safeFetch("/api/suppliers?status=PENDING_APPROVAL"),
      safeFetch("/api/admin/approval-rules"),
      safeFetch("/api/admin/custom-fields"),
      safeFetch("/api/admin/lookups"),
      safeFetch("/api/admin/roles"),
      safeFetch("/api/admin/content-groups"),
      safeFetch("/api/admin/api-clients"),
      safeFetch("/api/admin/coa"),
      safeFetch("/api/catalogs"),
      safeFetch("/api/suppliers?status=ACTIVE&limit=200"),
    ]);
    setUsers(u?.users ?? []);
    setSuppliers(s?.suppliers ?? []);
    setRules(r?.rules ?? []);
    setFields(f?.fields ?? []);
    setLookups(l?.lookups ?? []);
    setRoles(ro?.roles ?? []);
    setGroups(cg?.groups ?? []);
    setApiClients(ac?.clients ?? []);
    setCoas(co?.coas ?? []);
    setCatalogs(ca?.catalogs ?? []);
    setActiveSuppliers(as?.suppliers ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  async function apiCall(url: string, method: string, body?: any) {
    setSaving(true); setError("");
    try {
      const r = await fetch(url, { method, headers: {"Content-Type":"application/json"}, body: body ? JSON.stringify(body) : undefined });
      const d = await r.json();
      if (!r.ok) throw new Error(typeof d.error === "string" ? d.error : JSON.stringify(d.error) || "Failed");
      await loadAll();
      setModal(null); setEditItem(null);
    } catch (e: any) { setError(e.message); }
    setSaving(false);
  }

  async function createUser() {
    if (!userForm.email || !userForm.name) { setError("Name and email required"); return; }
    setSaving(true); setError("");
    try {
      const r = await fetch("/api/admin/users", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(userForm) });
      const d = await r.json();
      if (!r.ok) throw new Error(typeof d.error === "string" ? d.error : JSON.stringify(d.error) || "Failed");
      const newId = d.user.id;
      for (const gid of userForm.contentGroupIds) await fetch(`/api/admin/users/${newId}`, { method:"PATCH", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ addContentGroupId: gid }) });
      for (const rid of userForm.workspaceRoleIds) await fetch(`/api/admin/users/${newId}`, { method:"PATCH", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ addWorkspaceRoleId: rid }) });
      await loadAll();
      setModal(null);
    } catch (e:any) { setError(e.message); }
    setSaving(false);
    setUserForm({ name:"", email:"", role:"REQUESTOR", jobTitle:"", department:"", employeeId:"", managerId:"", businessUnit:"", costCenter:"", addressLine1:"", city:"", state:"", postalCode:"", country:"", contentGroupIds:[], workspaceRoleIds:[] });
  }
  async function createRule() {
    if (!ruleForm.name) { setError("Rule name required"); return; }
    await apiCall("/api/admin/approval-rules", "POST", { name:ruleForm.name, module:ruleForm.module, priority:parseInt(ruleForm.priority)||10, active:true, minAmount:ruleForm.minAmount?parseFloat(ruleForm.minAmount):null, maxAmount:ruleForm.maxAmount?parseFloat(ruleForm.maxAmount):null, category:ruleForm.category||null, department:ruleForm.department||null, steps:ruleForm.steps });
    setRuleForm({ name:"", module:"REQUISITION", priority:"10", minAmount:"", maxAmount:"", category:"", department:"", steps:[{ sequence:1, stepType:"MANAGER", stepLabel:"Line Manager", approverUserIds:[], approverMode:"ANY" }] });
  }
  async function createLookup() {
    if (!lookupForm.type) { setError("Type required"); return; }
    if (!lookupForm.code || !lookupForm.label) { setError("Code and label required"); return; }
    await apiCall("/api/admin/lookups", "POST", lookupForm);
    setLookupForm({ type:"DEPARTMENT", code:"", label:"" });
    setCreatingNewType(false);
  }
  async function createCommodity() {
    if (!commodityForm.code || !commodityForm.label) { setError("Code and label required"); return; }
    await apiCall("/api/admin/lookups", "POST", { type:"COMMODITY", code:commodityForm.code, label:commodityForm.label, parentCode: commodityForm.parentCode || undefined });
    setCommodityForm({ code:"", label:"", parentCode:"" });
  }
  async function createField() {
    if (!fieldForm.name) { setError("Field name required"); return; }
    await apiCall("/api/admin/custom-fields", "POST", { ...fieldForm, options: fieldForm.options ? fieldForm.options.split(",").map((s:string)=>s.trim()).filter(Boolean) : [] });
    setFieldForm({ entity:"REQUISITION", name:"", fieldType:"TEXT", required:false, helpText:"", options:"", categories:[] });
  }
  async function createGroup() {
    if (!groupForm.name) { setError("Group name required"); return; }
    await apiCall("/api/admin/content-groups", "POST", groupForm);
    setGroupForm({ name:"", description:"", color:"#1A2A52" });
  }
  async function createRole() {
    if (!roleForm.name) { setError("Role name required"); return; }
    await apiCall("/api/admin/roles", "POST", roleForm);
    setRoleForm({ name:"", description:"", permissions:{} });
  }
  async function createCoa() {
    if (!coaForm.name || !coaForm.code) { setError("COA name and code required"); return; }
    await apiCall("/api/admin/coa", "POST", { type:"coa", ...coaForm });
    setCoaForm({ name:"", code:"", companyCode:"", currency:"INR", taxType:"", taxRegNumber:"", billingCity:"", billingCountry:"" });
  }
  async function createSegment() {
    if (!segmentForm.name) { setError("Segment name required"); return; }
    await apiCall("/api/admin/coa", "POST", { type:"segment", ...segmentForm });
    setSegmentForm({ coaId:"", position:1, name:"", description:"", isRequired:false, linkedLookupType:"" });
  }
  async function createCatalog() {
    if (!catalogForm.name) { setError("Catalog name required"); return; }
    if (catalogForm.type==="HOSTED" && !catalogForm.description) { setError("Description is required for hosted catalogs"); return; }
    if (catalogForm.type==="PUNCHOUT" && !catalogForm.punchoutUrl) { setError("Punchout URL required"); return; }
    await apiCall("/api/catalogs", "POST", catalogForm);
    setCatalogForm({ name:"", type:"HOSTED", description:"", punchoutUrl:"", cxmlFromDomain:"", cxmlFromIdentity:"", cxmlToDomain:"", cxmlToIdentity:"", cxmlSenderDomain:"", cxmlSenderIdentity:"", cxmlSharedSecret:"" });
  }
  async function loadCatalogItems(catalogId: string) {
    const d = await safeFetch(`/api/catalogs/${catalogId}/items?limit=200`);
    setCatalogItems(prev => ({ ...prev, [catalogId]: d?.items ?? [] }));
  }
  function toggleCatalog(catalogId: string) {
    if (expandedCatalog === catalogId) { setExpandedCatalog(null); return; }
    setExpandedCatalog(catalogId);
    if (!catalogItems[catalogId]) loadCatalogItems(catalogId);
  }
  async function addItem(catalogId: string) {
    if (!itemForm.sku||!itemForm.name||!itemForm.unitPrice||!itemForm.category||!itemForm.unit||!itemForm.leadDays||!itemForm.supplierId) {
      setError("All item fields are required"); return;
    }
    setSaving(true); setError("");
    try {
      const r = await fetch(`/api/catalogs/${catalogId}/items`, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(itemForm) });
      const d = await r.json();
      if (!r.ok) throw new Error(typeof d.error === "string" ? d.error : JSON.stringify(d.error) || "Failed");
      setItemForm({ sku:"", name:"", unitPrice:"", currency:"INR", category:"", unit:"", leadDays:"", supplierId:"" });
      await loadCatalogItems(catalogId);
      await loadAll();
    } catch (e: any) { setError(e.message); }
    setSaving(false);
  }
  async function deleteItem(catalogId: string, itemId: string) {
    await fetch(`/api/catalogs/${catalogId}/items/${itemId}`, { method:"DELETE" });
    await loadCatalogItems(catalogId);
    await loadAll();
  }
  async function toggleCatalogStatus(c: Catalog) {
    await apiCall(`/api/catalogs/${c.id}`, "PATCH", { status: c.status==="ACTIVE"?"INACTIVE":"ACTIVE" });
  }
  async function deleteCatalog(id: string) {
    if (!confirm("Delete this catalog and all its items?")) return;
    await apiCall(`/api/catalogs/${id}`, "DELETE");
  }

  const pendingInvites = users.filter(u=>u.inviteStatus==="PENDING").length;
  const depts = [...new Set(lookups.filter(l=>l.type==="DEPARTMENT").map(l=>l.label))];

  return (
    <div className="min-h-screen bg-[#F7F8FA] flex">
      <div className="w-56 bg-white border-r border-gray-100 flex flex-col shrink-0">
        <div className="px-5 py-5 border-b border-gray-100">
          <p className="text-sm font-bold text-gray-900">Admin</p>
          <p className="text-[10px] text-gray-400 mt-0.5">Workspace configuration</p>
          <a href="/api/developer/postman?module=admin" download className="flex items-center gap-1.5 text-[10px] font-semibold text-[#1A2A52] mt-3 hover:underline"><Code2 className="size-3"/>Postman Collection</a>
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
                <div className="flex items-center gap-2">
                  <button onClick={()=>setShowUserUpload(true)} className="flex items-center gap-1.5 text-xs font-semibold text-[#1A2A52] border border-[#1A2A52]/20 px-4 py-2 rounded-xl hover:bg-[#1A2A52]/5"><Upload className="size-3.5"/>Upload CSV</button>
                  <button onClick={()=>setModal("user")} className="flex items-center gap-1.5 bg-[#1A2A52] text-white text-xs font-semibold px-4 py-2 rounded-xl hover:bg-[#243766]"><Plus className="size-3.5"/>Invite User</button>
                </div>
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
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-semibold text-gray-900">Workspace Roles <span className="text-sm font-normal text-gray-400 ml-1">{roles.length} configured</span></h2>
                <button onClick={()=>{ setRoleForm({name:"",description:"",permissions:{}}); setModal("role"); }} className="flex items-center gap-1.5 bg-[#1A2A52] text-white text-xs font-semibold px-4 py-2 rounded-xl hover:bg-[#243766]"><Plus className="size-3.5"/>Add Role</button>
              </div>
              {roles.length===0?<div className="bg-white border border-gray-100 rounded-2xl p-10 text-center text-gray-400 text-sm shadow-sm">No roles configured</div>:(
                <div className="grid grid-cols-3 gap-4">
                  {roles.map(r=>{
                    const activeModules = PERM_MODULES.filter(m=>PERM_ACTIONS.some(a=>r.permissions?.[m]?.[a]));
                    return (
                    <div key={r.id} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="size-8 bg-[#1A2A52]/8 rounded-lg flex items-center justify-center"><Shield className="size-4 text-[#1A2A52]"/></div>
                        <p className="text-sm font-semibold text-gray-900 flex-1">{r.name}</p>
                        {r.isSystem&&<span className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">System</span>}
                        <button onClick={()=>{ setEditItem({...r}); setModal("editRole"); }} className="p-1 text-gray-400 hover:text-[#1A2A52] rounded hover:bg-gray-100"><Edit2 className="size-3"/></button>
                        {!r.isSystem&&<button onClick={()=>{ if(confirm(`Delete role "${r.name}"?`)) apiCall(`/api/admin/roles/${r.id}`,"DELETE"); }} className="p-1 text-gray-400 hover:text-red-500 rounded hover:bg-red-50"><Trash2 className="size-3"/></button>}
                      </div>
                      <p className="text-xs text-gray-400 mb-3">{r.description||"—"}</p>
                      <div className="flex flex-wrap gap-1 mb-2">{activeModules.length===0?<span className="text-[9px] text-gray-300">No permissions set</span>:activeModules.map(m=><span key={m} className="text-[9px] bg-[#1A2A52]/8 text-[#1A2A52] px-1.5 py-0.5 rounded font-medium">{m}</span>)}</div>
                      <p className="text-[10px] text-gray-400">{(r.userRoles||[]).length} member{(r.userRoles||[]).length!==1?"s":""}</p>
                    </div>
                  );})}
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
              <div className="flex items-center justify-between mb-5"><h2 className="text-base font-semibold text-gray-900">Approval Chains <span className="text-sm font-normal text-gray-400 ml-1">{rules.length} rules</span></h2><button onClick={()=>{ setRuleForm({ name:"", module:"REQUISITION", priority:"10", minAmount:"", maxAmount:"", category:"", department:"", steps:[{ sequence:1, stepType:"MANAGER", stepLabel:"Line Manager", approverUserIds:[], approverMode:"ANY" }] }); setModal("rule"); }} className="flex items-center gap-1.5 bg-[#1A2A52] text-white text-xs font-semibold px-4 py-2 rounded-xl hover:bg-[#243766]"><Plus className="size-3.5"/>Add Rule</button></div>
              <p className="text-[11px] text-gray-400 mb-4">Only <b>Requisition</b> rules are enforced today — intake submissions become requisitions, so this covers both. Other modules are labeled for future use.</p>
              {rules.length===0?<div className="bg-white border border-gray-100 rounded-2xl p-10 text-center text-gray-400 text-sm shadow-sm">No approval rules</div>:(
                <div className="space-y-3">{rules.map(r=>{
                  const groups: Record<number, RuleStep[]> = {};
                  (r.steps||[]).forEach(s=>{ (groups[s.sequence] = groups[s.sequence]||[]).push(s); });
                  const seqs = Object.keys(groups).map(Number).sort((a,b)=>a-b);
                  return (
                  <div key={r.id} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`size-2 rounded-full shrink-0 ${r.active?"bg-emerald-500":"bg-gray-300"}`}/>
                      <p className="text-sm font-semibold text-gray-900 flex-1">{r.name}</p>
                      <span className="text-[9px] font-semibold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{(r.module||"REQUISITION").replace(/_/g," ")}</span>
                      <span className="text-xs text-gray-400">{r.minAmount!=null?`₹${(r.minAmount/100000).toFixed(0)}L`:""}{r.minAmount!=null&&r.maxAmount!=null?" – ":""}{r.maxAmount!=null?`₹${(r.maxAmount/100000).toFixed(0)}L`:r.minAmount!=null?"+":""}</span>
                      <button onClick={()=>{ setEditItem({...r, minAmount: r.minAmount!=null?String(r.minAmount):"", maxAmount: r.maxAmount!=null?String(r.maxAmount):"", steps: (r.steps||[]).map(s=>({...s, approverUserIds: s.approverUserIds||[], approverMode: s.approverMode||"ANY"}))}); setModal("editRule"); }} className="p-1.5 text-gray-400 hover:text-[#1A2A52] rounded-lg hover:bg-gray-100"><Edit2 className="size-3.5"/></button>
                      <button onClick={()=>{ if(confirm("Delete this rule?")) apiCall("/api/admin/approval-rules","DELETE",{id:r.id}); }} className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50"><Trash2 className="size-3.5"/></button>
                    </div>
                    {(r.category||r.department)&&<p className="text-[10px] text-gray-400 mb-2">{r.category&&`Category: ${r.category}`}{r.category&&r.department&&" · "}{r.department&&`Department: ${r.department}`}</p>}
                    <div className="flex items-center gap-2 flex-wrap">{seqs.map((seq,i)=>{
                      const grp = groups[seq];
                      const parallel = grp.length>1;
                      return (<div key={seq} className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 bg-[#1A2A52]/8 text-[#1A2A52] text-[10px] font-semibold px-2.5 py-1 rounded-lg">
                          <span className="size-4 bg-[#1A2A52] text-white rounded-full text-[8px] flex items-center justify-center font-bold">{seq}</span>
                          {parallel?`${grp[0].approverMode==="ALL"?"All of":"Any of"} ${grp.length}: ${grp.map(s=>users.find(u=>u.id===s.approverUserIds[0])?.name||s.stepLabel).join(", ")}`:grp[0].stepLabel}
                        </div>
                        {i<seqs.length-1&&<ChevronRight className="size-3 text-gray-300"/>}
                      </div>);
                    })}</div>
                  </div>
                );})}</div>
              )}
            </div>
          )}

          {tab==="fields"&&(
            <div>
              <div className="flex items-center justify-between mb-5"><h2 className="text-base font-semibold text-gray-900">Custom Fields <span className="text-sm font-normal text-gray-400 ml-1">{fields.length} fields</span></h2><button onClick={()=>setModal("field")} className="flex items-center gap-1.5 bg-[#1A2A52] text-white text-xs font-semibold px-4 py-2 rounded-xl hover:bg-[#243766]"><Plus className="size-3.5"/>Add Field</button></div>
              {fields.length===0?<div className="bg-white border border-gray-100 rounded-2xl p-10 text-center text-gray-400 text-sm shadow-sm">No custom fields</div>:(
                <div className="space-y-4">{MODULES.map(mod=>{ const mf=fields.filter(f=>f.entity===mod); if(!mf.length) return null; return (<div key={mod}><p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">{mod.replace(/_/g," ")}</p><div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">{mf.map(f=>(<div key={f.id} className="flex items-center gap-4 px-5 py-3.5 border-b border-gray-50 last:border-0 hover:bg-gray-50/40"><div className="flex-1"><p className="text-sm font-semibold text-gray-900">{f.name}</p><p className="text-[10px] text-gray-400">{f.fieldKey} · {f.fieldType}</p></div>{f.categories&&f.categories.length>0?<div className="flex gap-1 flex-wrap max-w-[160px]">{f.categories.map(c=><span key={c} className="text-[9px] bg-[#1A2A52]/8 text-[#1A2A52] px-1.5 py-0.5 rounded font-medium">{c}</span>)}</div>:<span className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">All categories</span>}{f.required&&<span className="text-[9px] bg-red-50 text-red-600 px-2 py-0.5 rounded-full font-semibold">Required</span>}{f.options&&f.options.length>0&&<div className="flex gap-1">{f.options.slice(0,3).map((o:string)=><span key={o} className="text-[9px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{o}</span>)}</div>}<button onClick={()=>{ if(confirm("Delete this field?")) apiCall("/api/admin/custom-fields","DELETE",{id:f.id}); }} className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 shrink-0"><Trash2 className="size-3.5"/></button></div>))}</div></div>); })}</div>
              )}
            </div>
          )}

          {tab==="commodities"&&(
            <div>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-semibold text-gray-900">Commodities <span className="text-sm font-normal text-gray-400 ml-1">{lookups.filter(l=>l.type==="COMMODITY").length} codes</span></h2>
                <div className="flex items-center gap-2">
                  <button onClick={()=>setShowCommodityUpload(true)} className="flex items-center gap-1.5 text-xs font-semibold text-[#1A2A52] border border-[#1A2A52]/20 px-4 py-2 rounded-xl hover:bg-[#1A2A52]/5"><Upload className="size-3.5"/>Upload CSV</button>
                  <button onClick={()=>{ setCommodityForm({code:"",label:"",parentCode:""}); setModal("commodity"); }} className="flex items-center gap-1.5 bg-[#1A2A52] text-white text-xs font-semibold px-4 py-2 rounded-xl hover:bg-[#243766]"><Plus className="size-3.5"/>Add Top-Level Commodity</button>
                </div>
              </div>
              <p className="text-[11px] text-gray-400 mb-4">Three-level hierarchy — e.g. IT Hardware → Computers → Laptops.</p>
              {(() => {
                const commodities = lookups.filter(l=>l.type==="COMMODITY");
                const level1 = commodities.filter(c=>!c.parentCode);
                if (level1.length===0) return <div className="bg-white border border-gray-100 rounded-2xl p-10 text-center text-gray-400 text-sm shadow-sm">No commodity codes yet</div>;
                return <div className="space-y-2">{level1.map(l1=>(
                  <div key={l1.id} className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                    <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50/40" onClick={()=>setExpandedCommodity(expandedCommodity===l1.code?null:l1.code)}>
                      {expandedCommodity===l1.code?<ChevronDown className="size-4 text-gray-400 shrink-0"/>:<ChevronRight className="size-4 text-gray-400 shrink-0"/>}
                      <span className="text-[10px] font-mono bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{l1.code}</span>
                      <span className="text-sm font-medium text-gray-900 flex-1">{l1.label}</span>
                      <button onClick={e=>{e.stopPropagation(); setCommodityForm({code:"",label:"",parentCode:l1.code}); setModal("commodity");}} className="text-[10px] font-semibold text-[#1A2A52] hover:underline">+ Add sub-category</button>
                      <button onClick={e=>{e.stopPropagation(); apiCall("/api/admin/lookups","DELETE",{id:l1.id});}} className="p-1 text-gray-400 hover:text-red-500 rounded hover:bg-red-50"><Trash2 className="size-3"/></button>
                    </div>
                    {expandedCommodity===l1.code&&(
                      <div className="border-t border-gray-100 px-4 py-3 bg-gray-50/40 space-y-2">
                        {commodities.filter(c=>c.parentCode===l1.code).length===0?<p className="text-[10px] text-gray-400 py-1 ml-4">No sub-categories yet</p>:commodities.filter(c=>c.parentCode===l1.code).map(l2=>(
                          <div key={l2.id} className="bg-white border border-gray-100 rounded-xl overflow-hidden ml-4">
                            <div className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50" onClick={()=>setExpandedCommodity2(expandedCommodity2===l2.code?null:l2.code)}>
                              {expandedCommodity2===l2.code?<ChevronDown className="size-3.5 text-gray-400 shrink-0"/>:<ChevronRight className="size-3.5 text-gray-400 shrink-0"/>}
                              <span className="text-[10px] font-mono bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{l2.code}</span>
                              <span className="text-xs font-medium text-gray-800 flex-1">{l2.label}</span>
                              <button onClick={e=>{e.stopPropagation(); setCommodityForm({code:"",label:"",parentCode:l2.code}); setModal("commodity");}} className="text-[10px] font-semibold text-[#1A2A52] hover:underline">+ Add item</button>
                              <button onClick={e=>{e.stopPropagation(); apiCall("/api/admin/lookups","DELETE",{id:l2.id});}} className="p-1 text-gray-400 hover:text-red-500 rounded hover:bg-red-50"><Trash2 className="size-3"/></button>
                            </div>
                            {expandedCommodity2===l2.code&&(
                              <div className="border-t border-gray-100 px-3 py-2 bg-gray-50/60 space-y-1">
                                {commodities.filter(c=>c.parentCode===l2.code).length===0?<p className="text-[10px] text-gray-400 py-1 ml-4">No items yet</p>:commodities.filter(c=>c.parentCode===l2.code).map(l3=>(
                                  <div key={l3.id} className="flex items-center gap-2 px-2 py-1.5 ml-4">
                                    <span className="text-[10px] font-mono bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{l3.code}</span>
                                    <span className="text-xs text-gray-700 flex-1">{l3.label}</span>
                                    <button onClick={()=>apiCall("/api/admin/lookups","DELETE",{id:l3.id})} className="p-1 text-gray-400 hover:text-red-500 rounded hover:bg-red-50"><Trash2 className="size-3"/></button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}</div>;
              })()}
            </div>
          )}

          {tab==="lookups"&&(
            <div>
              <div className="flex items-center justify-between mb-5"><h2 className="text-base font-semibold text-gray-900">Lookup Values <span className="text-sm font-normal text-gray-400 ml-1">{lookups.filter(l=>l.type!=="COMMODITY").length} values</span></h2><div className="flex items-center gap-2"><button onClick={()=>setShowLookupUpload(true)} className="flex items-center gap-1.5 text-xs font-semibold text-[#1A2A52] border border-[#1A2A52]/20 px-4 py-2 rounded-xl hover:bg-[#1A2A52]/5"><Upload className="size-3.5"/>Upload CSV</button><button onClick={()=>{ setCreatingNewType(true); setLookupForm({type:"",code:"",label:""}); setModal("lookup"); }} className="flex items-center gap-1.5 text-xs font-semibold text-[#1A2A52] border border-[#1A2A52]/20 px-4 py-2 rounded-xl hover:bg-[#1A2A52]/5"><Plus className="size-3.5"/>New Type</button><button onClick={()=>{ setCreatingNewType(false); setLookupForm(f=>({...f,code:"",label:"",type:[...new Set([...LOOKUP_TYPES,...lookups.filter(l=>l.type!=="COMMODITY").map(l=>l.type)])][0]||""})); setModal("lookup"); }} className="flex items-center gap-1.5 bg-[#1A2A52] text-white text-xs font-semibold px-4 py-2 rounded-xl hover:bg-[#243766]"><Plus className="size-3.5"/>Add Value</button></div></div>
              {lookups.filter(l=>l.type!=="COMMODITY").length===0?<div className="bg-white border border-gray-100 rounded-2xl p-10 text-center text-gray-400 text-sm shadow-sm">No lookups</div>:(
                <div className="space-y-4">{[...new Set(lookups.filter(l=>l.type!=="COMMODITY").map(l=>l.type))].map(type=>(<div key={type}><p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">{type.replace(/_/g," ")}</p><div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">{lookups.filter(l=>l.type===type).map(l=>(<div key={l.id} className="flex items-center gap-4 px-5 py-2.5 border-b border-gray-50 last:border-0 hover:bg-gray-50/40"><span className="text-[10px] font-mono bg-gray-100 text-gray-600 px-2 py-0.5 rounded w-20 text-center">{l.code}</span><span className="text-sm text-gray-800 flex-1">{l.label}</span><button onClick={()=>{ if(confirm("Delete this lookup?")) apiCall("/api/admin/lookups","DELETE",{id:l.id}); }} className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50"><Trash2 className="size-3"/></button></div>))}</div></div>))}</div>
              )}
            </div>
          )}

          {tab==="coa"&&(
            <div>
              <div className="flex items-center justify-between mb-5"><h2 className="text-base font-semibold text-gray-900">Chart of Accounts <span className="text-sm font-normal text-gray-400 ml-1">{coas.length} configured</span></h2><button onClick={()=>setModal("coa")} className="flex items-center gap-1.5 bg-[#1A2A52] text-white text-xs font-semibold px-4 py-2 rounded-xl hover:bg-[#243766]"><Plus className="size-3.5"/>Add COA</button></div>
              {coas.length===0?(
                <div className="bg-white border border-gray-100 rounded-2xl p-10 text-center text-gray-400 text-sm shadow-sm">No chart of accounts configured yet</div>
              ):(
                <div className="space-y-4">{coas.map(c=>(
                  <div key={c.id} className="bg-white border border-gray-100 rounded-2xl p-8 shadow-sm">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="size-12 bg-[#1A2A52]/8 rounded-xl flex items-center justify-center"><BarChart2 className="size-6 text-[#1A2A52]"/></div>
                      <div className="flex-1"><p className="text-base font-bold text-gray-900">{c.code} — {c.name}</p><p className="text-xs text-gray-400 mt-0.5">{[c.taxType, c.companyCode?`Company Code: ${c.companyCode}`:null, `Currency: ${c.currency}`].filter(Boolean).join(" · ")}</p></div>
                      {c.segments.length>0&&<button onClick={()=>setShowCoaValueUpload(c.id)} className="flex items-center gap-1 text-[10px] font-semibold text-[#1A2A52] border border-[#1A2A52]/20 px-2.5 py-1.5 rounded-lg hover:bg-[#1A2A52]/5"><Upload className="size-3"/>Upload Values</button>}
                      {c.segments.length<5&&<button onClick={()=>{ setSegmentForm({coaId:c.id,position:c.segments.length+1,name:"",description:"",isRequired:false,linkedLookupType:""}); setModal("segment"); }} className="flex items-center gap-1 text-[10px] font-semibold text-[#1A2A52] border border-[#1A2A52]/20 px-2.5 py-1.5 rounded-lg hover:bg-[#1A2A52]/5"><Plus className="size-3"/>Add Segment</button>}
                    </div>
                    {c.segments.length===0?<p className="text-xs text-gray-400">No segments configured</p>:(
                      <div className="grid grid-cols-4 gap-3">{c.segments.map(seg=>(<div key={seg.id} className="bg-gray-50 rounded-xl p-4 border border-gray-100"><div className="size-6 bg-[#1A2A52] text-white rounded-full text-xs flex items-center justify-center font-bold mb-2">{seg.position}</div><p className="text-xs font-semibold text-gray-900">{seg.name}</p><p className="text-[10px] text-gray-400 mt-0.5">{seg.linkedLookupType?`Linked to ${seg.linkedLookupType.replace(/_/g," ")}`:(seg.description||"—")}</p></div>))}</div>
                    )}
                  </div>
                ))}</div>
              )}
            </div>
          )}

          {tab==="catalogs"&&(
            <div>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-semibold text-gray-900">Catalogs <span className="text-sm font-normal text-gray-400 ml-1">{catalogs.length} configured</span></h2>
                <div className="flex items-center gap-2">
                  <a href="/api/developer/postman?module=catalogs" download className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 border border-gray-200 px-4 py-2 rounded-xl hover:bg-gray-50"><Code2 className="size-3.5"/>Postman Collection</a>
                  <button onClick={()=>setModal("catalog")} className="flex items-center gap-1.5 text-xs font-semibold text-[#1A2A52] border border-[#1A2A52]/20 px-4 py-2 rounded-xl hover:bg-[#1A2A52]/5"><Plus className="size-3.5"/>Add Catalog</button>
                  <button onClick={()=>setAssistantSignal(s=>s+1)} className="flex items-center gap-1.5 bg-[#1A2A52] text-white text-xs font-semibold px-4 py-2 rounded-xl hover:bg-[#243766]"><Sparkles className="size-3.5"/>Set up with Assistant</button>
                </div>
              </div>

              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5"><Package className="size-3.5"/>Hosted Catalogs</p>
              {catalogs.filter(c=>c.type==="HOSTED").length===0?<div className="bg-white border border-gray-100 rounded-2xl p-8 text-center text-gray-400 text-sm shadow-sm mb-6">No hosted catalogs yet</div>:(
                <div className="space-y-3 mb-6">{catalogs.filter(c=>c.type==="HOSTED").map(c=>(
                  <div key={c.id} className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                    <div className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-gray-50/40" onClick={()=>toggleCatalog(c.id)}>
                      {expandedCatalog===c.id?<ChevronDown className="size-4 text-gray-400 shrink-0"/>:<ChevronRight className="size-4 text-gray-400 shrink-0"/>}
                      <div className="size-9 bg-[#1A2A52]/8 rounded-xl flex items-center justify-center shrink-0"><Package className="size-4 text-[#1A2A52]"/></div>
                      <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-gray-900">{c.name}</p><p className="text-xs text-gray-400">{c.description||"—"} · {c._count.items} items</p></div>
                      <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${c.status==="ACTIVE"?"bg-emerald-50 text-emerald-700 border border-emerald-200":"bg-gray-100 text-gray-500"}`}>{c.status}</span>
                      <button onClick={e=>{e.stopPropagation();setEditItem({...c});setModal("editCatalog");}} className="p-1.5 text-gray-400 hover:text-[#1A2A52] rounded-lg hover:bg-gray-100"><Edit2 className="size-3.5"/></button>
                      <button onClick={e=>{e.stopPropagation();setShowCatalogUpload(c.id);}} className="flex items-center gap-1 text-[10px] font-semibold text-[#1A2A52] border border-[#1A2A52]/20 px-2.5 py-1.5 rounded-lg hover:bg-[#1A2A52]/5"><Upload className="size-3"/>Upload CSV</button>
                      <button onClick={e=>{e.stopPropagation();deleteCatalog(c.id);}} className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50"><Trash2 className="size-3.5"/></button>
                    </div>
                    {expandedCatalog===c.id&&(
                      <div className="border-t border-gray-100 px-5 py-4 bg-gray-50/40">
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{(catalogItems[c.id]??[]).length} items</p>
                          <button onClick={()=>setAssistantSignal(s=>s+1)} className="flex items-center gap-1 text-[10px] font-semibold text-[#1A2A52] hover:underline"><Sparkles className="size-3"/>Add items with Assistant</button>
                        </div>
                        <div className="grid grid-cols-9 gap-2 mb-3">
                          <input value={itemForm.sku} onChange={e=>setItemForm(f=>({...f,sku:e.target.value}))} placeholder="SKU" className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-[#1A2A52]"/>
                          <input value={itemForm.name} onChange={e=>setItemForm(f=>({...f,name:e.target.value}))} placeholder="Name" className="col-span-2 border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-[#1A2A52]"/>
                          <input value={itemForm.unitPrice} onChange={e=>setItemForm(f=>({...f,unitPrice:e.target.value}))} placeholder="Price" type="number" className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-[#1A2A52]"/>
                          <input value={itemForm.category} onChange={e=>setItemForm(f=>({...f,category:e.target.value}))} placeholder="Category" className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-[#1A2A52]"/>
                          <input value={itemForm.unit} onChange={e=>setItemForm(f=>({...f,unit:e.target.value}))} placeholder="Unit" className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-[#1A2A52]"/>
                          <input value={itemForm.leadDays} onChange={e=>setItemForm(f=>({...f,leadDays:e.target.value}))} placeholder="Lead days" type="number" className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-[#1A2A52]"/>
                          <select value={itemForm.supplierId} onChange={e=>setItemForm(f=>({...f,supplierId:e.target.value}))} className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-[#1A2A52]">
                            <option value="">Supplier...</option>
                            {activeSuppliers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                          </select>
                          <button onClick={()=>addItem(c.id)} disabled={saving} className="flex items-center justify-center gap-1 bg-[#1A2A52] text-white text-xs font-semibold rounded-lg hover:bg-[#243766] disabled:opacity-50"><Plus className="size-3"/>Add</button>
                        </div>
                        {(catalogItems[c.id]??[]).length===0?<p className="text-xs text-gray-400 text-center py-4">No items yet</p>:(
                          <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
                            {(catalogItems[c.id]??[]).map(it=>(
                              <div key={it.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-50 last:border-0">
                                <span className="text-[10px] font-mono bg-gray-100 text-gray-600 px-2 py-0.5 rounded w-24 shrink-0 truncate">{it.sku}</span>
                                <span className="text-xs text-gray-800 flex-1 truncate">{it.name}</span>
                                <span className="text-xs text-gray-500 shrink-0">{it.currency} {Number(it.unitPrice).toLocaleString()}</span>
                                <span className="text-[10px] text-gray-400 shrink-0 w-20 truncate">{it.category||"—"}</span>
                                <span className="text-[10px] text-gray-400 shrink-0 w-28 truncate">{it.supplier?.name||"—"}</span>
                                <button onClick={()=>deleteItem(c.id,it.id)} className="p-1 text-gray-400 hover:text-red-500 rounded hover:bg-red-50 shrink-0"><Trash2 className="size-3"/></button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}</div>
              )}

              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5"><Zap className="size-3.5"/>Punchout Connections</p>
              {catalogs.filter(c=>c.type==="PUNCHOUT").length===0?<div className="bg-white border border-gray-100 rounded-2xl p-8 text-center text-gray-400 text-sm shadow-sm">No punchout connections yet</div>:(
                <div className="space-y-3">{catalogs.filter(c=>c.type==="PUNCHOUT").map(c=>(
                  <div key={c.id} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="size-9 bg-[#C8A04D]/10 rounded-xl flex items-center justify-center shrink-0"><Zap className="size-4 text-[#C8A04D]"/></div>
                      <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-gray-900">{c.name}</p><p className="text-xs text-gray-400 truncate">{c.supplier?.name||c.cxmlToIdentity||"—"} · {c.punchoutUrl}</p></div>
                      <button onClick={()=>toggleCatalogStatus(c)} className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${c.status==="ACTIVE"?"bg-emerald-50 text-emerald-700 border border-emerald-200":"bg-gray-100 text-gray-500"}`}>{c.status}</button>
                      <button onClick={()=>{setEditItem({...c});setModal("editCatalog");}} className="p-1.5 text-gray-400 hover:text-[#1A2A52] rounded-lg hover:bg-gray-100"><Edit2 className="size-3.5"/></button>
                      <button onClick={()=>deleteCatalog(c.id)} className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50"><Trash2 className="size-3.5"/></button>
                    </div>
                  </div>
                ))}</div>
              )}
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

      {modal==="user"&&<Modal title="Invite New User" onClose={()=>{ setModal(null); setError(""); }}>
        <Input label="Full Name *" value={userForm.name} onChange={v=>setUserForm(f=>({...f,name:v}))} placeholder="e.g. Rajesh Kumar"/>
        <Input label="Email *" value={userForm.email} onChange={v=>setUserForm(f=>({...f,email:v}))} placeholder="rajesh@company.com" type="email"/>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Employee ID" value={userForm.employeeId} onChange={v=>setUserForm(f=>({...f,employeeId:v}))} placeholder="e.g. EMP-1042"/>
          <Input label="Job Title" value={userForm.jobTitle} onChange={v=>setUserForm(f=>({...f,jobTitle:v}))} placeholder="e.g. Procurement Manager"/>
        </div>
        <Sel label="Role *" value={userForm.role} onChange={v=>setUserForm(f=>({...f,role:v}))} options={ROLES_LIST}/>
        <div className="grid grid-cols-2 gap-3">
          <Sel label="Department" value={userForm.department} onChange={v=>setUserForm(f=>({...f,department:v}))} options={depts}/>
          <UserSel label="Line Manager" value={userForm.managerId} onChange={v=>setUserForm(f=>({...f,managerId:v}))} users={users}/>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Business Unit" value={userForm.businessUnit} onChange={v=>setUserForm(f=>({...f,businessUnit:v}))} placeholder="Optional"/>
          <Input label="Cost Center" value={userForm.costCenter} onChange={v=>setUserForm(f=>({...f,costCenter:v}))} placeholder="Optional"/>
        </div>
        <Input label="Default Address" value={userForm.addressLine1} onChange={v=>setUserForm(f=>({...f,addressLine1:v}))} placeholder="Street address (optional)"/>
        <div className="grid grid-cols-3 gap-3">
          <Input label="City" value={userForm.city} onChange={v=>setUserForm(f=>({...f,city:v}))} placeholder="Optional"/>
          <Input label="State" value={userForm.state} onChange={v=>setUserForm(f=>({...f,state:v}))} placeholder="Optional"/>
          <Input label="Postal Code" value={userForm.postalCode} onChange={v=>setUserForm(f=>({...f,postalCode:v}))} placeholder="Optional"/>
        </div>
        <Input label="Country" value={userForm.country} onChange={v=>setUserForm(f=>({...f,country:v}))} placeholder="Optional"/>
        <MultiSel label="Content Groups" selected={userForm.contentGroupIds} onChange={v=>setUserForm(f=>({...f,contentGroupIds:v}))} options={groups.map(g=>({id:g.id,name:g.name}))}/>
        <MultiSel label="Roles (permissions)" selected={userForm.workspaceRoleIds} onChange={v=>setUserForm(f=>({...f,workspaceRoleIds:v}))} options={roles.map(r=>({id:r.id,name:r.name}))}/>
        <div className="flex gap-3 pt-2"><button onClick={createUser} disabled={saving} className="flex-1 bg-[#1A2A52] text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-[#243766] disabled:opacity-50">{saving?"Saving...":"Send Invite"}</button><button onClick={()=>setModal(null)} className="px-5 py-2.5 text-sm text-gray-500 border border-gray-200 rounded-xl">Cancel</button></div>
      </Modal>}

      {modal==="editUser"&&editItem&&<Modal title="Edit User" onClose={()=>{ setModal(null); setEditItem(null); setError(""); }}>
        <Input label="Full Name" value={editItem.name||""} onChange={v=>setEditItem((p:any)=>({...p,name:v}))} placeholder="Full name"/>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Employee ID" value={editItem.employeeId||""} onChange={v=>setEditItem((p:any)=>({...p,employeeId:v}))} placeholder="e.g. EMP-1042"/>
          <Input label="Job Title" value={editItem.jobTitle||""} onChange={v=>setEditItem((p:any)=>({...p,jobTitle:v}))} placeholder="Job title"/>
        </div>
        <Sel label="Role" value={editItem.role||""} onChange={v=>setEditItem((p:any)=>({...p,role:v}))} options={ROLES_LIST}/>
        <div className="grid grid-cols-2 gap-3">
          <Sel label="Department" value={editItem.department||""} onChange={v=>setEditItem((p:any)=>({...p,department:v}))} options={depts}/>
          <UserSel label="Line Manager" value={editItem.managerId||""} onChange={v=>setEditItem((p:any)=>({...p,managerId:v}))} users={users.filter(u=>u.id!==editItem.id)}/>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Business Unit" value={editItem.businessUnit||""} onChange={v=>setEditItem((p:any)=>({...p,businessUnit:v}))} placeholder="Optional"/>
          <Input label="Cost Center" value={editItem.costCenter||""} onChange={v=>setEditItem((p:any)=>({...p,costCenter:v}))} placeholder="Optional"/>
        </div>
        <Input label="Default Address" value={editItem.addressLine1||""} onChange={v=>setEditItem((p:any)=>({...p,addressLine1:v}))} placeholder="Street address (optional)"/>
        <div className="grid grid-cols-3 gap-3">
          <Input label="City" value={editItem.city||""} onChange={v=>setEditItem((p:any)=>({...p,city:v}))} placeholder="Optional"/>
          <Input label="State" value={editItem.state||""} onChange={v=>setEditItem((p:any)=>({...p,state:v}))} placeholder="Optional"/>
          <Input label="Postal Code" value={editItem.postalCode||""} onChange={v=>setEditItem((p:any)=>({...p,postalCode:v}))} placeholder="Optional"/>
        </div>
        <Input label="Country" value={editItem.country||""} onChange={v=>setEditItem((p:any)=>({...p,country:v}))} placeholder="Optional"/>
        <Sel label="Status" value={editItem.inviteStatus||""} onChange={v=>setEditItem((p:any)=>({...p,inviteStatus:v}))} options={["ACTIVE","PENDING","INACTIVE"]}/>
        <div>
          <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Content Groups</label>
          <div className="flex flex-wrap gap-1.5">
            {(editItem.contentGroupMembers||[]).map((m:any)=>(
              <span key={m.contentGroup.id} className="flex items-center gap-1 text-[10px] bg-[#1A2A52]/8 text-[#1A2A52] px-2 py-1 rounded-lg font-medium">
                {m.contentGroup.name}
                <button onClick={async()=>{ await fetch(`/api/admin/users/${editItem.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({removeContentGroupId:m.contentGroup.id})}); const u=await (await fetch("/api/admin/users")).json(); setEditItem(u.users.find((x:any)=>x.id===editItem.id)); await loadAll(); }} className="hover:text-red-500"><X className="size-2.5"/></button>
              </span>
            ))}
          </div>
          <select onChange={async e=>{ if(!e.target.value)return; await fetch(`/api/admin/users/${editItem.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({addContentGroupId:e.target.value})}); const u=await (await fetch("/api/admin/users")).json(); setEditItem(u.users.find((x:any)=>x.id===editItem.id)); await loadAll(); e.target.value=""; }} className="mt-1.5 w-full border border-gray-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-[#1A2A52]">
            <option value="">+ Add to content group...</option>
            {groups.filter(g=>!(editItem.contentGroupMembers||[]).some((m:any)=>m.contentGroup.id===g.id)).map(g=><option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Roles (permissions)</label>
          <div className="flex flex-wrap gap-1.5">
            {(editItem.userRoles||[]).map((m:any)=>(
              <span key={m.role.id} className="flex items-center gap-1 text-[10px] bg-[#1A2A52]/8 text-[#1A2A52] px-2 py-1 rounded-lg font-medium">
                {m.role.name}
                <button onClick={async()=>{ await fetch(`/api/admin/users/${editItem.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({removeWorkspaceRoleId:m.role.id})}); const u=await (await fetch("/api/admin/users")).json(); setEditItem(u.users.find((x:any)=>x.id===editItem.id)); await loadAll(); }} className="hover:text-red-500"><X className="size-2.5"/></button>
              </span>
            ))}
          </div>
          <select onChange={async e=>{ if(!e.target.value)return; await fetch(`/api/admin/users/${editItem.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({addWorkspaceRoleId:e.target.value})}); const u=await (await fetch("/api/admin/users")).json(); setEditItem(u.users.find((x:any)=>x.id===editItem.id)); await loadAll(); e.target.value=""; }} className="mt-1.5 w-full border border-gray-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-[#1A2A52]">
            <option value="">+ Assign role...</option>
            {roles.filter(r=>!(editItem.userRoles||[]).some((m:any)=>m.role.id===r.id)).map(r=><option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
        <div className="flex gap-3 pt-2"><button onClick={()=>apiCall(`/api/admin/users/${editItem.id}`,"PATCH",editItem)} disabled={saving} className="flex-1 bg-[#1A2A52] text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-[#243766] disabled:opacity-50">{saving?"Saving...":"Save Changes"}</button><button onClick={()=>{ setModal(null); setEditItem(null); }} className="px-5 py-2.5 text-sm text-gray-500 border border-gray-200 rounded-xl">Cancel</button></div>
      </Modal>}

      {modal==="rule"&&<Modal title="Add Approval Rule" onClose={()=>{ setModal(null); setError(""); }}>
        <Input label="Rule Name *" value={ruleForm.name} onChange={v=>setRuleForm(f=>({...f,name:v}))} placeholder="e.g. Above 10 Lakh — Full Approval"/>
        <Sel label="Applies To" value={ruleForm.module} onChange={v=>setRuleForm(f=>({...f,module:v}))} options={APPROVAL_MODULES}/>
        <div className="grid grid-cols-2 gap-3">
          <Sel label="Category (optional)" value={ruleForm.category} onChange={v=>setRuleForm(f=>({...f,category:v}))} options={[...new Set(lookups.filter(l=>l.type==="CATEGORY").map(l=>l.label))]}/>
          <Sel label="Department (optional)" value={ruleForm.department} onChange={v=>setRuleForm(f=>({...f,department:v}))} options={depts}/>
        </div>
        <div className="grid grid-cols-2 gap-3"><Input label="Min Amount (Rs)" value={ruleForm.minAmount} onChange={v=>setRuleForm(f=>({...f,minAmount:v}))} placeholder="0" type="number"/><Input label="Max Amount (Rs)" value={ruleForm.maxAmount} onChange={v=>setRuleForm(f=>({...f,maxAmount:v}))} placeholder="Leave blank for no limit" type="number"/></div>
        <Input label="Priority" value={ruleForm.priority} onChange={v=>setRuleForm(f=>({...f,priority:v}))} placeholder="10" type="number"/>
        <StepEditor steps={ruleForm.steps} setSteps={fn=>setRuleForm(f=>({...f,steps:fn(f.steps)}))} users={users.map(u=>({id:u.id,name:u.name}))}/>
        <div className="flex gap-3 pt-2"><button onClick={createRule} disabled={saving} className="flex-1 bg-[#1A2A52] text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-[#243766] disabled:opacity-50">{saving?"Saving...":"Create Rule"}</button><button onClick={()=>setModal(null)} className="px-5 py-2.5 text-sm text-gray-500 border border-gray-200 rounded-xl">Cancel</button></div>
      </Modal>}

      {modal==="editRule"&&editItem&&<Modal title="Edit Approval Rule" onClose={()=>{ setModal(null); setEditItem(null); setError(""); }}>
        <Input label="Rule Name" value={editItem.name||""} onChange={v=>setEditItem((p:any)=>({...p,name:v}))} placeholder="Rule name"/>
        <Sel label="Applies To" value={editItem.module||"REQUISITION"} onChange={v=>setEditItem((p:any)=>({...p,module:v}))} options={APPROVAL_MODULES}/>
        <div className="grid grid-cols-2 gap-3">
          <Sel label="Category (optional)" value={editItem.category||""} onChange={v=>setEditItem((p:any)=>({...p,category:v}))} options={[...new Set(lookups.filter(l=>l.type==="CATEGORY").map(l=>l.label))]}/>
          <Sel label="Department (optional)" value={editItem.department||""} onChange={v=>setEditItem((p:any)=>({...p,department:v}))} options={depts}/>
        </div>
        <div className="grid grid-cols-2 gap-3"><Input label="Min Amount (Rs)" value={editItem.minAmount||""} onChange={v=>setEditItem((p:any)=>({...p,minAmount:v}))} placeholder="0" type="number"/><Input label="Max Amount (Rs)" value={editItem.maxAmount||""} onChange={v=>setEditItem((p:any)=>({...p,maxAmount:v}))} placeholder="Leave blank for no limit" type="number"/></div>
        <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={editItem.active} onChange={e=>setEditItem((p:any)=>({...p,active:e.target.checked}))} className="size-4 accent-[#1A2A52]"/><span className="text-sm text-gray-700 font-medium">Active</span></label>
        <StepEditor steps={editItem.steps||[]} setSteps={fn=>setEditItem((p:any)=>({...p,steps:fn(p.steps||[])}))} users={users.map(u=>({id:u.id,name:u.name}))}/>
        <div className="flex gap-3 pt-2"><button onClick={()=>apiCall(`/api/admin/approval-rules/${editItem.id}`,"PATCH",{name:editItem.name,module:editItem.module,category:editItem.category||null,department:editItem.department||null,active:editItem.active,minAmount:editItem.minAmount?parseFloat(editItem.minAmount):null,maxAmount:editItem.maxAmount?parseFloat(editItem.maxAmount):null,steps:(editItem.steps||[]).map((s:any,i:number)=>({sequence:i+1,stepType:s.stepType,stepLabel:s.stepLabel,approverUserIds:s.approverUserIds,approverMode:s.approverMode}))})} disabled={saving} className="flex-1 bg-[#1A2A52] text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-[#243766] disabled:opacity-50">{saving?"Saving...":"Save Changes"}</button><button onClick={()=>{ setModal(null); setEditItem(null); }} className="px-5 py-2.5 text-sm text-gray-500 border border-gray-200 rounded-xl">Cancel</button></div>
      </Modal>}

      {modal==="lookup"&&<Modal title={creatingNewType?"Create New Lookup Type":"Add Lookup Value"} onClose={()=>{ setModal(null); setError(""); }}>
        {creatingNewType?(
          <div>
            <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">New Type Name *</label>
            <input value={lookupForm.type} onChange={e=>setLookupForm(f=>({...f,type:e.target.value.toUpperCase().replace(/\s+/g,"_")}))} placeholder="e.g. SHIPPING_METHOD"
              autoFocus
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#1A2A52] focus:ring-1 focus:ring-[#1A2A52]/20"/>
            <p className="text-[10px] text-gray-400 mt-1">You'll add the first value under this type right after.</p>
          </div>
        ):(
          <div>
            <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Type *</label>
            <select value={lookupForm.type} onChange={e=>{ if(e.target.value==="__new__"){ setCreatingNewType(true); setLookupForm(f=>({...f,type:""})); } else setLookupForm(f=>({...f,type:e.target.value})); }}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#1A2A52]">
              {[...new Set([...LOOKUP_TYPES, ...lookups.filter(l=>l.type!=="COMMODITY").map(l=>l.type)])].map(t=><option key={t} value={t}>{t.replace(/_/g," ")}</option>)}
              <option value="__new__">+ Create a new type…</option>
            </select>
          </div>
        )}
        <Input label="Code *" value={lookupForm.code} onChange={v=>setLookupForm(f=>({...f,code:v.toUpperCase()}))} placeholder="e.g. ENG or 6100"/>
        <Input label="Label *" value={lookupForm.label} onChange={v=>setLookupForm(f=>({...f,label:v}))} placeholder="e.g. Engineering"/>
        <div className="flex gap-3 pt-2"><button onClick={createLookup} disabled={saving||!lookupForm.type} className="flex-1 bg-[#1A2A52] text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-[#243766] disabled:opacity-50">{saving?"Saving...":creatingNewType?"Create Type & Add Value":"Add Value"}</button><button onClick={()=>setModal(null)} className="px-5 py-2.5 text-sm text-gray-500 border border-gray-200 rounded-xl">Cancel</button></div>
      </Modal>}

      {modal==="commodity"&&<Modal title={commodityForm.parentCode?`Add under ${commodityForm.parentCode}`:"Add Top-Level Commodity"} onClose={()=>{ setModal(null); setError(""); }}>
        <Input label="Code *" value={commodityForm.code} onChange={v=>setCommodityForm(f=>({...f,code:v.toUpperCase()}))} placeholder="e.g. IT-HW"/>
        <Input label="Label *" value={commodityForm.label} onChange={v=>setCommodityForm(f=>({...f,label:v}))} placeholder="e.g. IT Hardware"/>
        <div className="flex gap-3 pt-2"><button onClick={createCommodity} disabled={saving} className="flex-1 bg-[#1A2A52] text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-[#243766] disabled:opacity-50">{saving?"Saving...":"Add"}</button><button onClick={()=>setModal(null)} className="px-5 py-2.5 text-sm text-gray-500 border border-gray-200 rounded-xl">Cancel</button></div>
      </Modal>}

      {modal==="field"&&<Modal title="Add Custom Field" onClose={()=>{ setModal(null); setError(""); }}><Sel label="Entity *" value={fieldForm.entity} onChange={v=>setFieldForm(f=>({...f,entity:v}))} options={MODULES}/><Input label="Display Name *" value={fieldForm.name} onChange={v=>setFieldForm(f=>({...f,name:v}))} placeholder="e.g. Asset Tag"/><Sel label="Field Type *" value={fieldForm.fieldType} onChange={v=>setFieldForm(f=>({...f,fieldType:v}))} options={FIELD_TYPES}/><Input label="Help text" value={fieldForm.helpText} onChange={v=>setFieldForm(f=>({...f,helpText:v}))} placeholder="Optional helper text shown under the field"/>{fieldForm.fieldType==="DROPDOWN"&&<Input label="Options (comma separated)" value={fieldForm.options} onChange={v=>setFieldForm(f=>({...f,options:v}))} placeholder="Option A, Option B, Option C"/>}{fieldForm.entity==="REQUISITION"&&<div><label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Categories (leave empty to apply to all categories)</label><div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto border border-gray-200 rounded-xl p-2">{lookups.filter(l=>l.type==="CATEGORY").length===0?<span className="text-xs text-gray-400 px-1 py-0.5">No categories configured yet — add some under Lookups first</span>:lookups.filter(l=>l.type==="CATEGORY").map(c=>(<label key={c.code} className="flex items-center gap-1.5 text-xs bg-gray-50 px-2 py-1 rounded-lg cursor-pointer"><input type="checkbox" checked={fieldForm.categories.includes(c.label)} onChange={e=>setFieldForm(f=>({...f,categories:e.target.checked?[...f.categories,c.label]:f.categories.filter(x=>x!==c.label)}))}/>{c.label}</label>))}</div></div>}<label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={fieldForm.required} onChange={e=>setFieldForm(f=>({...f,required:e.target.checked}))} className="size-4 accent-[#1A2A52]"/><span className="text-sm text-gray-700 font-medium">Required field</span></label><div className="flex gap-3 pt-2"><button onClick={createField} disabled={saving} className="flex-1 bg-[#1A2A52] text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-[#243766] disabled:opacity-50">{saving?"Saving...":"Add Field"}</button><button onClick={()=>setModal(null)} className="px-5 py-2.5 text-sm text-gray-500 border border-gray-200 rounded-xl">Cancel</button></div></Modal>}

      {modal==="group"&&<Modal title="Add Content Group" onClose={()=>{ setModal(null); setError(""); }}><Input label="Group Name *" value={groupForm.name} onChange={v=>setGroupForm(f=>({...f,name:v}))} placeholder="e.g. IT and Engineering"/><Input label="Description" value={groupForm.description} onChange={v=>setGroupForm(f=>({...f,description:v}))} placeholder="What this group covers"/><div><label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Color</label><input type="color" value={groupForm.color} onChange={e=>setGroupForm(f=>({...f,color:e.target.value}))} className="h-9 w-20 border border-gray-200 rounded-lg cursor-pointer"/></div><div className="flex gap-3 pt-2"><button onClick={createGroup} disabled={saving} className="flex-1 bg-[#1A2A52] text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-[#243766] disabled:opacity-50">{saving?"Saving...":"Create Group"}</button><button onClick={()=>setModal(null)} className="px-5 py-2.5 text-sm text-gray-500 border border-gray-200 rounded-xl">Cancel</button></div></Modal>}

      {modal==="role"&&<Modal title="Add Role" onClose={()=>{ setModal(null); setError(""); }}>
        <Input label="Role Name *" value={roleForm.name} onChange={v=>setRoleForm(f=>({...f,name:v}))} placeholder="e.g. Regional Procurement Manager"/>
        <Input label="Description" value={roleForm.description} onChange={v=>setRoleForm(f=>({...f,description:v}))} placeholder="What this role is for"/>
        <PermMatrix value={roleForm.permissions} onChange={v=>setRoleForm(f=>({...f,permissions:v}))}/>
        <div className="flex gap-3 pt-2"><button onClick={createRole} disabled={saving} className="flex-1 bg-[#1A2A52] text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-[#243766] disabled:opacity-50">{saving?"Saving...":"Create Role"}</button><button onClick={()=>setModal(null)} className="px-5 py-2.5 text-sm text-gray-500 border border-gray-200 rounded-xl">Cancel</button></div>
      </Modal>}

      {modal==="editRole"&&editItem&&<Modal title="Edit Role" onClose={()=>{ setModal(null); setEditItem(null); setError(""); }}>
        <Input label="Role Name" value={editItem.name||""} onChange={v=>setEditItem((p:any)=>({...p,name:v}))} placeholder="Role name" />
        <Input label="Description" value={editItem.description||""} onChange={v=>setEditItem((p:any)=>({...p,description:v}))} placeholder="What this role is for"/>
        <PermMatrix value={editItem.permissions||{}} onChange={v=>setEditItem((p:any)=>({...p,permissions:v}))}/>
        <div>
          <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Members</label>
          <div className="flex flex-wrap gap-1.5">
            {(editItem.userRoles||[]).map((m:any)=>(
              <span key={m.user.id} className="flex items-center gap-1 text-[10px] bg-[#1A2A52]/8 text-[#1A2A52] px-2 py-1 rounded-lg font-medium">
                {m.user.name}
                <button onClick={async()=>{ await fetch(`/api/admin/roles/${editItem.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({removeUserId:m.user.id})}); const d=await (await fetch("/api/admin/roles")).json(); setEditItem(d.roles.find((x:any)=>x.id===editItem.id)); await loadAll(); }} className="hover:text-red-500"><X className="size-2.5"/></button>
              </span>
            ))}
          </div>
          <select onChange={async e=>{ if(!e.target.value)return; await fetch(`/api/admin/roles/${editItem.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({addUserId:e.target.value})}); const d=await (await fetch("/api/admin/roles")).json(); setEditItem(d.roles.find((x:any)=>x.id===editItem.id)); await loadAll(); e.target.value=""; }} className="mt-1.5 w-full border border-gray-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-[#1A2A52]">
            <option value="">+ Add member...</option>
            {users.filter(u=>!(editItem.userRoles||[]).some((m:any)=>m.user.id===u.id)).map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
        <div className="flex gap-3 pt-2"><button onClick={()=>apiCall(`/api/admin/roles/${editItem.id}`,"PATCH",{name:editItem.name,description:editItem.description,permissions:editItem.permissions})} disabled={saving} className="flex-1 bg-[#1A2A52] text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-[#243766] disabled:opacity-50">{saving?"Saving...":"Save Changes"}</button><button onClick={()=>{ setModal(null); setEditItem(null); }} className="px-5 py-2.5 text-sm text-gray-500 border border-gray-200 rounded-xl">Cancel</button></div>
      </Modal>}

      {modal==="coa"&&<Modal title="Add Chart of Accounts" onClose={()=>{ setModal(null); setError(""); }}><Input label="Name *" value={coaForm.name} onChange={v=>setCoaForm(f=>({...f,name:v}))} placeholder="e.g. India Operations COA"/><Input label="Code *" value={coaForm.code} onChange={v=>setCoaForm(f=>({...f,code:v.toUpperCase()}))} placeholder="e.g. IN01"/><div className="grid grid-cols-2 gap-3"><Input label="Company Code" value={coaForm.companyCode} onChange={v=>setCoaForm(f=>({...f,companyCode:v}))} placeholder="e.g. ORG-IN"/><Input label="Currency" value={coaForm.currency} onChange={v=>setCoaForm(f=>({...f,currency:v.toUpperCase()}))} placeholder="INR"/></div><div className="grid grid-cols-2 gap-3"><Input label="Tax Type" value={coaForm.taxType} onChange={v=>setCoaForm(f=>({...f,taxType:v}))} placeholder="e.g. GST"/><Input label="Tax Reg. Number" value={coaForm.taxRegNumber} onChange={v=>setCoaForm(f=>({...f,taxRegNumber:v}))} placeholder="Optional"/></div><div className="grid grid-cols-2 gap-3"><Input label="Billing City" value={coaForm.billingCity} onChange={v=>setCoaForm(f=>({...f,billingCity:v}))} placeholder="Optional"/><Input label="Billing Country" value={coaForm.billingCountry} onChange={v=>setCoaForm(f=>({...f,billingCountry:v}))} placeholder="Optional"/></div><div className="flex gap-3 pt-2"><button onClick={createCoa} disabled={saving} className="flex-1 bg-[#1A2A52] text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-[#243766] disabled:opacity-50">{saving?"Saving...":"Create COA"}</button><button onClick={()=>setModal(null)} className="px-5 py-2.5 text-sm text-gray-500 border border-gray-200 rounded-xl">Cancel</button></div></Modal>}

      {modal==="segment"&&<Modal title={`Add Segment ${segmentForm.position}`} onClose={()=>{ setModal(null); setError(""); }}>
        <Input label="Segment Name *" value={segmentForm.name} onChange={v=>setSegmentForm(f=>({...f,name:v}))} placeholder="e.g. Cost Center"/>
        <Input label="Description" value={segmentForm.description} onChange={v=>setSegmentForm(f=>({...f,description:v}))} placeholder="Optional"/>
        <Sel label="Linked Lookup Type (optional)" value={segmentForm.linkedLookupType} onChange={v=>setSegmentForm(f=>({...f,linkedLookupType:v}))} options={[...new Set(lookups.filter(l=>l.type!=="COMMODITY").map(l=>l.type))]}/>
        <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={segmentForm.isRequired} onChange={e=>setSegmentForm(f=>({...f,isRequired:e.target.checked}))} className="size-4 accent-[#1A2A52]"/><span className="text-sm text-gray-700 font-medium">Required on every requisition</span></label>
        <div className="flex gap-3 pt-2"><button onClick={createSegment} disabled={saving} className="flex-1 bg-[#1A2A52] text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-[#243766] disabled:opacity-50">{saving?"Saving...":"Add Segment"}</button><button onClick={()=>setModal(null)} className="px-5 py-2.5 text-sm text-gray-500 border border-gray-200 rounded-xl">Cancel</button></div>
      </Modal>}

      {modal==="catalog"&&<Modal title="Add Catalog" onClose={()=>{ setModal(null); setError(""); }}>
        <Sel label="Type *" value={catalogForm.type} onChange={v=>setCatalogForm(f=>({...f,type:v}))} options={["HOSTED","PUNCHOUT"]}/>
        <Input label="Name *" value={catalogForm.name} onChange={v=>setCatalogForm(f=>({...f,name:v}))} placeholder={catalogForm.type==="HOSTED"?"e.g. IT Hardware Catalog":"e.g. Dell Punchout"}/>
        <Input label="Description *" value={catalogForm.description} onChange={v=>setCatalogForm(f=>({...f,description:v}))} placeholder="What this catalog covers"/>
        {catalogForm.type==="PUNCHOUT"&&(<>
          <Input label="Punchout URL *" value={catalogForm.punchoutUrl} onChange={v=>setCatalogForm(f=>({...f,punchoutUrl:v}))} placeholder="https://supplier.example.com/cxml/punchout"/>
          <div className="grid grid-cols-2 gap-3">
            <Input label="From Domain" value={catalogForm.cxmlFromDomain} onChange={v=>setCatalogForm(f=>({...f,cxmlFromDomain:v}))} placeholder="e.g. NetworkId"/>
            <Input label="From Identity" value={catalogForm.cxmlFromIdentity} onChange={v=>setCatalogForm(f=>({...f,cxmlFromIdentity:v}))} placeholder="Your buyer identity"/>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="To Domain" value={catalogForm.cxmlToDomain} onChange={v=>setCatalogForm(f=>({...f,cxmlToDomain:v}))} placeholder="e.g. NetworkId"/>
            <Input label="To Identity" value={catalogForm.cxmlToIdentity} onChange={v=>setCatalogForm(f=>({...f,cxmlToIdentity:v}))} placeholder="Supplier identity"/>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Sender Domain" value={catalogForm.cxmlSenderDomain} onChange={v=>setCatalogForm(f=>({...f,cxmlSenderDomain:v}))} placeholder="Usually same as From"/>
            <Input label="Sender Identity" value={catalogForm.cxmlSenderIdentity} onChange={v=>setCatalogForm(f=>({...f,cxmlSenderIdentity:v}))} placeholder="Usually same as From"/>
          </div>
          <Input label="Shared Secret *" value={catalogForm.cxmlSharedSecret} onChange={v=>setCatalogForm(f=>({...f,cxmlSharedSecret:v}))} placeholder="Credential provided by the supplier" type="password"/>
        </>)}
        <div className="flex gap-3 pt-2"><button onClick={createCatalog} disabled={saving} className="flex-1 bg-[#1A2A52] text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-[#243766] disabled:opacity-50">{saving?"Saving...":"Create Catalog"}</button><button onClick={()=>setModal(null)} className="px-5 py-2.5 text-sm text-gray-500 border border-gray-200 rounded-xl">Cancel</button></div>
      </Modal>}

      {modal==="editCatalog"&&editItem&&<Modal title="Edit Catalog" onClose={()=>{ setModal(null); setEditItem(null); setError(""); }}>
        <Input label="Name" value={editItem.name||""} onChange={v=>setEditItem((p:any)=>({...p,name:v}))} placeholder="Catalog name"/>
        <Input label="Description" value={editItem.description||""} onChange={v=>setEditItem((p:any)=>({...p,description:v}))} placeholder="What this catalog covers"/>
        <Sel label="Status" value={editItem.status||""} onChange={v=>setEditItem((p:any)=>({...p,status:v}))} options={["ACTIVE","INACTIVE"]}/>
        {editItem.type==="PUNCHOUT"&&<Input label="Punchout URL" value={editItem.punchoutUrl||""} onChange={v=>setEditItem((p:any)=>({...p,punchoutUrl:v}))} placeholder="https://supplier.example.com/cxml/punchout"/>}
        <div className="flex gap-3 pt-2"><button onClick={()=>apiCall(`/api/catalogs/${editItem.id}`,"PATCH",{name:editItem.name,description:editItem.description,status:editItem.status,...(editItem.type==="PUNCHOUT"?{punchoutUrl:editItem.punchoutUrl}:{})})} disabled={saving} className="flex-1 bg-[#1A2A52] text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-[#243766] disabled:opacity-50">{saving?"Saving...":"Save Changes"}</button><button onClick={()=>{ setModal(null); setEditItem(null); }} className="px-5 py-2.5 text-sm text-gray-500 border border-gray-200 rounded-xl">Cancel</button></div>
      </Modal>}

      {showLookupUpload && (
        <CsvUploadModal
          config={{
            title: "Upload Lookup Values",
            description: "Bulk import departments, GL accounts, cost centers, categories, or any new lookup type — the \"type\" column isn't restricted to a fixed list; any value creates that type if it doesn't exist yet.",
            endpoint: "/api/upload/lookups",
            templateName: "veltriance_lookups_template",
            headers: ["type","code","label","sortOrder"],
            requiredHeaders: ["type","code","label"],
            exampleRows: [
              ["DEPARTMENT","LEGAL","Legal & Compliance","9"],
              ["GL_ACCOUNT","7000","7000 — Research & Development","10"],
              ["CATEGORY","CAT-RND","Research & Development","9"],
              ["PAYMENT_TERMS","NET90","Net 90 Days","6"],
              ["SHIPPING_METHOD","AIR","Air Freight","1"],
            ],
          }}
          onClose={() => setShowLookupUpload(false)}
          onSuccess={() => { setShowLookupUpload(false); loadAll(); }}
        />
      )}
      {showUserUpload && (
        <CsvUploadModal
          config={{
            title: "Bulk Invite Users",
            description: "Upload users to invite. They will be created with PENDING status.",
            endpoint: "/api/upload/users",
            templateName: "veltriance_users_template",
            headers: ["name","email","role","department","jobTitle"],
            requiredHeaders: ["name","email"],
            exampleRows: [
              ["Rajesh Kumar","rajesh.kumar@company.com","APPROVER","Engineering","Engineering Manager"],
              ["Priya Sharma","priya.sharma@company.com","REQUESTOR","Finance","Finance Analyst"],
              ["Amit Singh","amit.singh@company.com","PROCUREMENT","IT","IT Procurement Lead"],
            ],
          }}
          onClose={() => setShowUserUpload(false)}
          onSuccess={() => { setShowUserUpload(false); loadAll(); }}
        />
      )}
      {showCatalogUpload && (
        <CsvUploadModal
          config={{
            title: "Upload Catalog Items",
            description: "Bulk import items into this hosted catalog.",
            endpoint: "/api/upload/catalog-items",
            extraBody: { catalogId: showCatalogUpload },
            templateName: "veltriance_catalog_items_template",
            headers: ["sku","name","unitPrice","currency","category","supplier","unit","leadDays","description"],
            requiredHeaders: ["name","category","unit","leadDays","supplier"],
            exampleRows: [
              ["ITEM-001","Dell XPS 15 Laptop 16GB 512GB","125000","INR","IT Hardware","Dell Technologies","Each","7","Dell XPS 15 9530 Intel Core i7"],
              ["ITEM-002","Samsung 27-inch 4K Monitor","38000","INR","IT Hardware","Samsung Electronics","Each","3","UHD 4K IPS Panel USB-C"],
            ],
          }}
          onClose={() => setShowCatalogUpload(null)}
          onSuccess={() => { const id = showCatalogUpload; setShowCatalogUpload(null); loadAll(); if (id) loadCatalogItems(id); }}
        />
      )}

      {showCoaValueUpload && (
        <CsvUploadModal
          config={{
            title: "Upload Chart of Accounts Values",
            description: "Bulk import segment values (e.g. cost centers, GL accounts) into this chart of accounts. Reference each row's segment by its position number or exact name.",
            endpoint: "/api/upload/coa-values",
            extraBody: { coaId: showCoaValueUpload },
            templateName: "veltriance_coa_values_template",
            headers: ["segment","code","description"],
            requiredHeaders: ["segment","code","description"],
            exampleRows: [
              ["1","CC-101","Engineering — Bengaluru"],
              ["1","CC-102","Sales — Mumbai"],
              ["2","4500","Office Supplies"],
            ],
          }}
          onClose={() => setShowCoaValueUpload(null)}
          onSuccess={() => { setShowCoaValueUpload(null); loadAll(); }}
        />
      )}

      {showCommodityUpload && (
        <CsvUploadModal
          config={{
            title: "Upload Commodities",
            description: "Bulk import the 3-level commodity hierarchy. Rows can be in any order — parents don't need to appear before their children.",
            endpoint: "/api/upload/commodities",
            templateName: "veltriance_commodities_template",
            headers: ["code","label","parentCode"],
            requiredHeaders: ["code","label"],
            exampleRows: [
              ["IT-HW","IT Hardware",""],
              ["IT-HW-COMP","Computers","IT-HW"],
              ["IT-HW-COMP-LAP","Laptops","IT-HW-COMP"],
            ],
          }}
          onClose={() => setShowCommodityUpload(false)}
          onSuccess={() => { setShowCommodityUpload(false); loadAll(); }}
        />
      )}

      <AdminAgent onRefresh={loadAll} openSignal={assistantSignal} />
    </div>
  );
}
