"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Star, Mail, Phone, MapPin, BarChart3, Shield, RefreshCw, FileText, Upload, Trash2, Check, X as XIcon, Zap, ClipboardList, Pencil } from "lucide-react";
import { ActivityLog } from "@/components/ActivityLog";

type Supplier = { id:string; name:string; code:string|null; category:string|null; tier:string|null; status:string; preferred:boolean; rating:number|null; riskScore:number|null; riskLevel:string|null; city:string|null; country:string|null; addressLine1:string|null; addressLine2:string|null; state:string|null; postalCode:string|null; website:string|null; contactEmail:string|null; contactName:string|null; contactPhone:string|null; paymentTerms:string|null; currency:string|null; onTimeDelivery:number|null; qualityScore:number|null; invoiceAccuracy:number|null; responsivenessScore:number|null; onboardingStage:string|null; complianceScore:number|null; erpSyncStatus:string|null; erpSyncedAt:string|null; erpSupplierId:string|null; poTransmissionMethod:string|null; cxmlEndpoint:string|null; assignedUserId:string|null; assignedUser:{id:string;name:string}|null; contacts?:{id:string;name:string;email:string|null;phone:string|null;role:string|null}[]; };

const EDIT_FIELDS = ["name","category","tier","contactName","contactEmail","contactPhone","addressLine1","addressLine2","city","state","postalCode","country","paymentTerms","currency","poTransmissionMethod","cxmlEndpoint","assignedUserId","preferred"] as const;
type EditForm = Record<typeof EDIT_FIELDS[number], string | boolean>;

function toEditForm(s: Supplier): EditForm {
  return {
    name: s.name ?? "", category: s.category ?? "", tier: s.tier ?? "",
    contactName: s.contactName ?? "", contactEmail: s.contactEmail ?? "", contactPhone: s.contactPhone ?? "",
    addressLine1: s.addressLine1 ?? "", addressLine2: s.addressLine2 ?? "", city: s.city ?? "",
    state: s.state ?? "", postalCode: s.postalCode ?? "", country: s.country ?? "",
    paymentTerms: s.paymentTerms ?? "", currency: s.currency ?? "USD",
    poTransmissionMethod: s.poTransmissionMethod ?? "EMAIL", cxmlEndpoint: s.cxmlEndpoint ?? "",
    assignedUserId: s.assignedUserId ?? "", preferred: s.preferred,
  };
}
type RiskDomain = { domain:string; score:number; rationale:string[] };
type RiskBreakdown = { computedAt:string; riskScore:number; riskLevel:string; complianceScore:number; domains:RiskDomain[]; unscored:{domain:string;reason:string}[] };
type Doc = { id:string; type:string; name:string; status:string; expiryDate:string|null; rejectedNote:string|null };
type OnboardingProfile = { legalName:string|null; businessType:string|null; panNumber:string|null; gstNumber:string|null; completionScore:number };

const DOC_TYPES = ["PAN_CARD","GST_CERTIFICATE","INCORPORATION_CERTIFICATE","MSME_CERTIFICATE","CANCELLED_CHEQUE","BANK_STATEMENT","ISO_CERTIFICATE","NDA","MSA","OTHER"];

function Metric({label,value}:{label:string;value:number|null}){const v=value??0;const c=v>=90?"bg-emerald-500":v>=70?"bg-amber-500":"bg-red-500";return(<div><div className="flex justify-between mb-1"><span className="text-[10px] text-gray-500">{label}</span><span className="text-[10px] font-semibold text-gray-900">{value!=null?Math.round(v)+"/100":"—"}</span></div><div className="h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className={"h-full rounded-full "+c} style={{width:`${v}%`}}/></div></div>);}

const DOC_STATUS_COLOR: Record<string,string> = { PENDING:"bg-amber-50 text-amber-700 border-amber-200", VERIFIED:"bg-emerald-50 text-emerald-700 border-emerald-200", REJECTED:"bg-red-50 text-red-700 border-red-200", EXPIRED:"bg-gray-100 text-gray-500 border-gray-200" };

export default function SupplierDetailPage(){
  const{id}=useParams<{id:string}>();const router=useRouter();
  const[supplier,setSupplier]=useState<Supplier|null>(null);const[loading,setLoading]=useState(true);const[error,setError]=useState("");
  const[breakdown,setBreakdown]=useState<RiskBreakdown|null>(null);
  const[docs,setDocs]=useState<Doc[]>([]);
  const[profile,setProfile]=useState<OnboardingProfile|null>(null);
  const[busy,setBusy]=useState(false);
  const[docForm,setDocForm]=useState({type:"PAN_CARD",name:"",fileUrl:"",expiryDate:""});
  const[showAddDoc,setShowAddDoc]=useState(false);
  const[canEdit,setCanEdit]=useState(false);
  const[showEdit,setShowEdit]=useState(false);
  const[editForm,setEditForm]=useState<EditForm|null>(null);
  const[editError,setEditError]=useState("");
  const[orgUsers,setOrgUsers]=useState<{id:string;name:string}[]>([]);

  async function load(){
    setLoading(true);setError("");
    try{
      const r=await fetch(`/api/suppliers/${id}`);const txt=await r.text();if(!txt.trim())throw new Error("Empty response");const d=JSON.parse(txt);if(!r.ok)throw new Error(d?.error||"Failed");
      setSupplier(d?.supplier||null);
      setCanEdit(!!d?.canEdit);
      const [rb,dr,pr]=await Promise.all([
        fetch(`/api/suppliers/${id}/risk-assessment`).then(x=>x.ok?x.json():null).catch(()=>null),
        fetch(`/api/suppliers/${id}/documents`).then(x=>x.ok?x.json():null).catch(()=>null),
        fetch(`/api/suppliers/${id}/onboarding`).then(x=>x.ok?x.json():null).catch(()=>null),
      ]);
      setBreakdown(rb?.breakdown||null);
      setDocs(dr?.documents||[]);
      setProfile(pr?.profile||null);
    }
    catch(e:any){setError(e?.message||"Failed to load supplier");}
    finally{setLoading(false);}
  }
  useEffect(()=>{load();},[id]);
  useEffect(()=>{fetch("/api/admin/users").then(r=>r.json()).then(d=>setOrgUsers((d.users??[]).map((u:any)=>({id:u.id,name:u.name})))).catch(()=>{});},[]);

  function openEdit(){ if(!supplier)return; setEditForm(toEditForm(supplier)); setEditError(""); setShowEdit(true); }

  async function saveEdit(){
    if(!editForm)return;
    setBusy(true);setEditError("");
    try{
      const r=await fetch(`/api/suppliers/${id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(editForm)});
      const d=await r.json();
      if(!r.ok){setEditError(d?.error||"Failed to save");return;}
      setShowEdit(false);
      await load();
    } finally{setBusy(false);}
  }

  async function recomputeRisk(){
    setBusy(true);
    try{const r=await fetch(`/api/suppliers/${id}/risk-assessment`,{method:"POST"});const d=await r.json();if(r.ok)setBreakdown(d.breakdown);await load();}
    finally{setBusy(false);}
  }
  async function syncErp(){
    setBusy(true);
    try{
      const r=await fetch(`/api/suppliers/${id}/erp-sync`,{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"});
      const d=await r.json();
      setError(r.ok?"":(d.message||d.error||"ERP sync failed"));
      await load();
    } finally{setBusy(false);}
  }
  async function addDoc(){
    if(!docForm.name.trim())return;
    setBusy(true);
    try{
      await fetch(`/api/suppliers/${id}/documents`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...docForm,fileUrl:docForm.fileUrl||"#"})});
      setDocForm({type:"PAN_CARD",name:"",fileUrl:"",expiryDate:""});setShowAddDoc(false);
      await load();
    } finally{setBusy(false);}
  }
  async function setDocStatus(docId:string,status:string){
    setBusy(true);
    try{await fetch(`/api/suppliers/${id}/documents/${docId}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({status})});await load();}
    finally{setBusy(false);}
  }
  async function deleteDoc(docId:string){
    setBusy(true);
    try{await fetch(`/api/suppliers/${id}/documents/${docId}`,{method:"DELETE"});await load();}
    finally{setBusy(false);}
  }

  if(loading)return<div className="min-h-screen bg-[#F7F8FA] flex items-center justify-center"><div className="size-8 border-2 border-[#1A2A52]/20 border-t-[#1A2A52] rounded-full animate-spin"/></div>;
  if(!supplier)return<div className="min-h-screen bg-[#F7F8FA] flex flex-col items-center justify-center gap-4"><p className="text-sm text-red-600">{error||"Supplier not found"}</p><button onClick={()=>router.back()} className="flex items-center gap-2 text-sm text-[#1A2A52] border border-[#1A2A52]/20 px-4 py-2 rounded-xl hover:bg-[#1A2A52]/5"><ArrowLeft className="size-4"/>Go Back</button></div>;
  const rC={LOW:"text-emerald-600 bg-emerald-50 border-emerald-200",MEDIUM:"text-amber-600 bg-amber-50 border-amber-200",HIGH:"text-red-600 bg-red-50 border-red-200",CRITICAL:"text-red-700 bg-red-50 border-red-200"}[supplier.riskLevel||""]||"text-gray-600 bg-gray-50 border-gray-200";
  const sC={ACTIVE:"bg-emerald-50 text-emerald-700 border-emerald-200",PENDING_APPROVAL:"bg-amber-50 text-amber-700 border-amber-200",BLOCKED:"bg-red-50 text-red-700 border-red-200",INACTIVE:"bg-gray-100 text-gray-500 border-gray-200"}[supplier.status]||"bg-gray-100 text-gray-500 border-gray-200";
  return(
    <div className="min-h-screen bg-[#F7F8FA]">
      <div className="bg-white border-b border-gray-100 px-8 py-4 flex items-center gap-4">
        <button onClick={()=>router.back()} className="size-8 rounded-xl border border-gray-200 flex items-center justify-center hover:bg-gray-50"><ArrowLeft className="size-4 text-gray-500"/></button>
        <div className="flex-1"><h1 className="text-base font-bold text-gray-900 flex items-center gap-2">{supplier.name}{supplier.preferred&&<Star className="size-4 text-amber-400 fill-amber-400"/>}</h1><p className="text-xs text-gray-400">{supplier.code} · {supplier.category||"—"} {supplier.onboardingStage&&`· ${supplier.onboardingStage.replace(/_/g," ")}`}</p></div>
        <span className={`text-[10px] font-semibold px-3 py-1 rounded-full border ${sC}`}>{supplier.status==="PENDING_APPROVAL"?"Pending":supplier.status}</span>
        {canEdit&&<button onClick={openEdit} className="flex items-center gap-1.5 text-xs font-semibold text-[#1A2A52] border border-[#1A2A52]/20 px-3 py-1.5 rounded-xl hover:bg-[#1A2A52]/5"><Pencil className="size-3.5"/>Edit</button>}
        <button onClick={load} className="size-8 rounded-xl border border-gray-200 flex items-center justify-center hover:bg-gray-50"><RefreshCw className={`size-3.5 text-gray-400 ${busy?"animate-spin":""}`}/></button>
      </div>
      {error&&<div className="mx-8 mt-4 bg-red-50 border border-red-200 text-red-700 text-xs px-4 py-2.5 rounded-xl">{error}</div>}
      <div className="px-8 py-6 grid grid-cols-3 gap-5">
        <div className="col-span-2 space-y-5">
          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-4">Performance Metrics</p>
            <div className="grid grid-cols-2 gap-4">
              <Metric label="Overall Rating" value={supplier.rating}/><Metric label="On-Time Delivery" value={supplier.onTimeDelivery}/>
              <Metric label="Quality Score" value={supplier.qualityScore}/><Metric label="Invoice Accuracy" value={supplier.invoiceAccuracy}/>
              <Metric label="Responsiveness" value={supplier.responsivenessScore}/><Metric label="Compliance Score" value={supplier.complianceScore}/>
              {supplier.riskLevel&&<div><div className="flex justify-between mb-1"><span className="text-[10px] text-gray-500">Risk Level</span><span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${rC}`}>{supplier.riskLevel}</span></div><div className="h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-red-400 rounded-full" style={{width:`${supplier.riskScore??0}%`}}/></div></div>}
            </div>
          </div>

          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1.5"><BarChart3 className="size-3.5"/>Risk Assessment</p>
              <button onClick={recomputeRisk} disabled={busy} className="flex items-center gap-1 text-[10px] font-semibold text-[#1A2A52] border border-[#1A2A52]/20 px-2.5 py-1.5 rounded-lg hover:bg-[#1A2A52]/5 disabled:opacity-50"><RefreshCw className="size-3"/>Recompute</button>
            </div>
            {!breakdown?<p className="text-xs text-gray-400 text-center py-6">No risk assessment yet — click Recompute to generate one.</p>:(
              <div className="space-y-3">
                {breakdown.domains.map(dm=>(
                  <div key={dm.domain}>
                    <div className="flex justify-between mb-1"><span className="text-[10px] font-semibold text-gray-700">{dm.domain}</span><span className="text-[10px] text-gray-500">{dm.score}/100</span></div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-1"><div className={`h-full rounded-full ${dm.score>=50?"bg-red-400":dm.score>=25?"bg-amber-400":"bg-emerald-400"}`} style={{width:`${dm.score}%`}}/></div>
                    <ul className="text-[10px] text-gray-400 space-y-0.5">{dm.rationale.map((r,i)=><li key={i}>• {r}</li>)}</ul>
                  </div>
                ))}
                <p className="text-[10px] text-gray-300 pt-1">Not yet assessed: {breakdown.unscored.map(u=>u.domain).join(", ")} — needs a connected data source.</p>
                <p className="text-[9px] text-gray-300">Last computed {new Date(breakdown.computedAt).toLocaleString()}</p>
              </div>
            )}
          </div>

          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1.5"><FileText className="size-3.5"/>Documents <span className="font-normal text-gray-400">({docs.length})</span></p>
              <button onClick={()=>setShowAddDoc(v=>!v)} className="flex items-center gap-1 text-[10px] font-semibold text-[#1A2A52] border border-[#1A2A52]/20 px-2.5 py-1.5 rounded-lg hover:bg-[#1A2A52]/5"><Upload className="size-3"/>Add Document</button>
            </div>
            {showAddDoc&&(
              <div className="grid grid-cols-4 gap-2 mb-3 p-3 bg-gray-50 rounded-xl">
                <select value={docForm.type} onChange={e=>setDocForm(f=>({...f,type:e.target.value}))} className="border border-gray-200 rounded-lg px-2 py-1.5 text-[11px] outline-none">{DOC_TYPES.map(t=><option key={t} value={t}>{t.replace(/_/g," ")}</option>)}</select>
                <input value={docForm.name} onChange={e=>setDocForm(f=>({...f,name:e.target.value}))} placeholder="Document name" className="border border-gray-200 rounded-lg px-2 py-1.5 text-[11px] outline-none"/>
                <input value={docForm.expiryDate} onChange={e=>setDocForm(f=>({...f,expiryDate:e.target.value}))} type="date" placeholder="Expiry (optional)" className="border border-gray-200 rounded-lg px-2 py-1.5 text-[11px] outline-none"/>
                <button onClick={addDoc} disabled={busy||!docForm.name.trim()} className="bg-[#1A2A52] text-white text-[11px] font-semibold rounded-lg hover:bg-[#243766] disabled:opacity-50">Add</button>
              </div>
            )}
            {docs.length===0?<p className="text-xs text-gray-400 text-center py-6">No documents yet</p>:(
              <div className="space-y-2">
                {docs.map(doc=>(
                  <div key={doc.id} className="flex items-center gap-3 px-3 py-2 bg-gray-50 rounded-xl">
                    <div className="flex-1 min-w-0"><p className="text-xs font-medium text-gray-800 truncate">{doc.name}</p><p className="text-[10px] text-gray-400">{doc.type.replace(/_/g," ")}{doc.expiryDate&&` · expires ${new Date(doc.expiryDate).toLocaleDateString()}`}</p></div>
                    <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full border ${DOC_STATUS_COLOR[doc.status]||""}`}>{doc.status}</span>
                    {doc.status==="PENDING"&&<>
                      <button onClick={()=>setDocStatus(doc.id,"VERIFIED")} className="p-1 text-emerald-500 hover:bg-emerald-50 rounded"><Check className="size-3.5"/></button>
                      <button onClick={()=>setDocStatus(doc.id,"REJECTED")} className="p-1 text-red-500 hover:bg-red-50 rounded"><XIcon className="size-3.5"/></button>
                    </>}
                    <button onClick={()=>deleteDoc(doc.id)} className="p-1 text-gray-400 hover:text-red-500 rounded"><Trash2 className="size-3"/></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {(supplier.contacts?.length??0)>0&&<div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm"><p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-4">Contacts</p><div className="space-y-3">{supplier.contacts!.map(c=>(<div key={c.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl"><div className="size-8 bg-[#1A2A52]/10 rounded-full flex items-center justify-center shrink-0"><span className="text-xs font-bold text-[#1A2A52]">{(c.name||"?").charAt(0)}</span></div><div className="flex-1"><p className="text-xs font-semibold text-gray-900">{c.name}</p><p className="text-[10px] text-gray-400">{c.role||"Contact"}</p></div><div className="flex gap-3 text-[10px] text-gray-400">{c.email&&<span>{c.email}</span>}{c.phone&&<span>{c.phone}</span>}</div></div>))}</div></div>}
        </div>
        <div className="space-y-5">
          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm"><p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-4">Contact Info</p><div className="space-y-3">{supplier.contactName&&<div className="flex items-center gap-2 text-xs text-gray-700"><Shield className="size-3.5 text-gray-400"/>{supplier.contactName}</div>}{supplier.contactEmail&&<div className="flex items-center gap-2 text-xs text-gray-700"><Mail className="size-3.5 text-gray-400"/>{supplier.contactEmail}</div>}{supplier.contactPhone&&<div className="flex items-center gap-2 text-xs text-gray-700"><Phone className="size-3.5 text-gray-400"/>{supplier.contactPhone}</div>}{(supplier.city||supplier.country)&&<div className="flex items-center gap-2 text-xs text-gray-700"><MapPin className="size-3.5 text-gray-400"/>{[supplier.city,supplier.country].filter(Boolean).join(", ")}</div>}</div></div>
          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm"><p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-4">Commercial</p><div className="space-y-2.5">{[["Tier",supplier.tier],["Category",supplier.category],["Currency",supplier.currency],["Payment Terms",supplier.paymentTerms],["PO Transmission",supplier.poTransmissionMethod],["Assigned to",supplier.assignedUser?.name]].map(([l,v])=>v?(<div key={String(l)} className="flex justify-between"><span className="text-[10px] text-gray-400">{l}</span><span className="text-[10px] font-medium text-gray-900">{v}</span></div>):null)}</div></div>
          <ActivityLog entity="SUPPLIER" entityId={id} title="Activity" />

          {profile&&<div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-4 flex items-center gap-1.5"><ClipboardList className="size-3.5"/>Onboarding Profile</p>
            <div className="space-y-2.5">
              <div className="flex justify-between"><span className="text-[10px] text-gray-400">Completion</span><span className="text-[10px] font-semibold text-gray-900">{profile.completionScore}%</span></div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-1"><div className="h-full bg-[#1A2A52] rounded-full" style={{width:`${profile.completionScore}%`}}/></div>
              {[["Legal Name",profile.legalName],["Business Type",profile.businessType],["PAN",profile.panNumber],["GST",profile.gstNumber]].map(([l,v])=>v?(<div key={String(l)} className="flex justify-between"><span className="text-[10px] text-gray-400">{l}</span><span className="text-[10px] font-medium text-gray-900">{v}</span></div>):null)}
            </div>
          </div>}

          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-4 flex items-center gap-1.5"><Zap className="size-3.5"/>ERP Sync</p>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] text-gray-400">Status</span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{supplier.erpSyncStatus||"NOT_SYNCED"}</span>
            </div>
            {supplier.erpSyncedAt&&<p className="text-[10px] text-gray-400 mb-3">Last synced {new Date(supplier.erpSyncedAt).toLocaleString()}{supplier.erpSupplierId&&` · ERP ID ${supplier.erpSupplierId}`}</p>}
            <button onClick={syncErp} disabled={busy} className="w-full flex items-center justify-center gap-1.5 bg-[#1A2A52] text-white text-xs font-semibold py-2 rounded-xl hover:bg-[#243766] disabled:opacity-50">Sync to Connected ERP</button>
            <p className="text-[9px] text-gray-300 mt-2">Requires a connected ERP integration from the Integrations page.</p>
          </div>
        </div>
      </div>

      {showEdit&&editForm&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={e=>e.target===e.currentTarget&&setShowEdit(false)}>
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
            <p className="text-sm font-bold text-gray-900 mb-4">Edit supplier</p>
            {editError&&<p className="text-xs text-red-600 mb-3">{editError}</p>}
            <div className="grid grid-cols-2 gap-3">
              <EF label="Name" value={editForm.name as string} onChange={v=>setEditForm(f=>f&&({...f,name:v}))}/>
              <EF label="Category" value={editForm.category as string} onChange={v=>setEditForm(f=>f&&({...f,category:v}))}/>
              <EF label="Tier" value={editForm.tier as string} onChange={v=>setEditForm(f=>f&&({...f,tier:v}))}/>
              <EF label="Currency" value={editForm.currency as string} onChange={v=>setEditForm(f=>f&&({...f,currency:v}))}/>
              <EF label="Contact name" value={editForm.contactName as string} onChange={v=>setEditForm(f=>f&&({...f,contactName:v}))}/>
              <EF label="Contact email" value={editForm.contactEmail as string} onChange={v=>setEditForm(f=>f&&({...f,contactEmail:v}))}/>
              <EF label="Contact phone" value={editForm.contactPhone as string} onChange={v=>setEditForm(f=>f&&({...f,contactPhone:v}))}/>
              <EF label="Payment terms" value={editForm.paymentTerms as string} onChange={v=>setEditForm(f=>f&&({...f,paymentTerms:v}))}/>
              <EF label="Address line 1" value={editForm.addressLine1 as string} onChange={v=>setEditForm(f=>f&&({...f,addressLine1:v}))}/>
              <EF label="Address line 2" value={editForm.addressLine2 as string} onChange={v=>setEditForm(f=>f&&({...f,addressLine2:v}))}/>
              <EF label="City" value={editForm.city as string} onChange={v=>setEditForm(f=>f&&({...f,city:v}))}/>
              <EF label="State" value={editForm.state as string} onChange={v=>setEditForm(f=>f&&({...f,state:v}))}/>
              <EF label="Postal code" value={editForm.postalCode as string} onChange={v=>setEditForm(f=>f&&({...f,postalCode:v}))}/>
              <EF label="Country" value={editForm.country as string} onChange={v=>setEditForm(f=>f&&({...f,country:v}))}/>
            </div>

            <div className="h-px bg-gray-100 my-4"/>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-2">PO transmission</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-medium text-gray-500 mb-1">Method</label>
                <select value={editForm.poTransmissionMethod as string} onChange={e=>setEditForm(f=>f&&({...f,poTransmissionMethod:e.target.value}))} className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-xs outline-none focus:border-[#1A2A52]">
                  <option value="EMAIL">Email</option>
                  <option value="CXML">cXML</option>
                  <option value="MANUAL">Manual</option>
                </select>
              </div>
              {editForm.poTransmissionMethod==="CXML"&&<EF label="cXML endpoint URL" value={editForm.cxmlEndpoint as string} onChange={v=>setEditForm(f=>f&&({...f,cxmlEndpoint:v}))}/>}
            </div>

            <div className="h-px bg-gray-100 my-4"/>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-2">Ownership</p>
            <div>
              <label className="block text-[10px] font-medium text-gray-500 mb-1">Assigned user (can always edit this record)</label>
              <select value={editForm.assignedUserId as string} onChange={e=>setEditForm(f=>f&&({...f,assignedUserId:e.target.value}))} className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-xs outline-none focus:border-[#1A2A52]">
                <option value="">— None —</option>
                {orgUsers.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <label className="flex items-center gap-2 mt-3">
              <input type="checkbox" checked={editForm.preferred as boolean} onChange={e=>setEditForm(f=>f&&({...f,preferred:e.target.checked}))}/>
              <span className="text-xs text-gray-700">Preferred supplier</span>
            </label>

            <div className="flex gap-3 pt-5">
              <button onClick={saveEdit} disabled={busy} className="flex-1 bg-[#1A2A52] text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-[#243766] disabled:opacity-50">{busy?"Saving...":"Save changes"}</button>
              <button onClick={()=>setShowEdit(false)} className="px-5 py-2.5 text-sm text-gray-500 border border-gray-200 rounded-xl">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EF({label,value,onChange}:{label:string;value:string;onChange:(v:string)=>void}){
  return (
    <div>
      <label className="block text-[10px] font-medium text-gray-500 mb-1">{label}</label>
      <input value={value||""} onChange={e=>onChange(e.target.value)} className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-xs outline-none focus:border-[#1A2A52]"/>
    </div>
  );
}
