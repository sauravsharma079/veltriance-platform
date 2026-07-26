"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Star, Mail, Phone, MapPin, BarChart3, Shield, RefreshCw } from "lucide-react";
type Supplier = { id:string; name:string; code:string|null; category:string|null; tier:string|null; status:string; preferred:boolean; rating:number|null; riskScore:number|null; riskLevel:string|null; city:string|null; country:string|null; website:string|null; contactEmail:string|null; contactName:string|null; contactPhone:string|null; paymentTerms:string|null; currency:string|null; onTimeDelivery:number|null; qualityScore:number|null; invoiceAccuracy:number|null; responsivenessScore:number|null; contacts?:{id:string;name:string;email:string|null;phone:string|null;role:string|null}[]; };
function Metric({label,value}:{label:string;value:number|null}){const v=value??0;const c=v>=90?"bg-emerald-500":v>=70?"bg-amber-500":"bg-red-500";return(<div><div className="flex justify-between mb-1"><span className="text-[10px] text-gray-500">{label}</span><span className="text-[10px] font-semibold text-gray-900">{value!=null?Math.round(v)+"/100":"—"}</span></div><div className="h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className={"h-full rounded-full "+c} style={{width:`${v}%`}}/></div></div>);}
export default function SupplierDetailPage(){
  const{id}=useParams<{id:string}>();const router=useRouter();
  const[supplier,setSupplier]=useState<Supplier|null>(null);const[loading,setLoading]=useState(true);const[error,setError]=useState("");
  async function load(){
    setLoading(true);setError("");
    try{const r=await fetch(`/api/suppliers/${id}`);const txt=await r.text();if(!txt.trim())throw new Error("Empty response");const d=JSON.parse(txt);if(!r.ok)throw new Error(d?.error||"Failed");setSupplier(d?.supplier||null);}
    catch(e:any){setError(e?.message||"Failed to load supplier");}
    finally{setLoading(false);}
  }
  useEffect(()=>{load();},[id]);
  if(loading)return<div className="min-h-screen bg-[#F7F8FA] flex items-center justify-center"><div className="size-8 border-2 border-[#1A2A52]/20 border-t-[#1A2A52] rounded-full animate-spin"/></div>;
  if(error||!supplier)return<div className="min-h-screen bg-[#F7F8FA] flex flex-col items-center justify-center gap-4"><p className="text-sm text-red-600">{error||"Supplier not found"}</p><button onClick={()=>router.back()} className="flex items-center gap-2 text-sm text-[#1A2A52] border border-[#1A2A52]/20 px-4 py-2 rounded-xl hover:bg-[#1A2A52]/5"><ArrowLeft className="size-4"/>Go Back</button></div>;
  const rC={LOW:"text-emerald-600 bg-emerald-50 border-emerald-200",MEDIUM:"text-amber-600 bg-amber-50 border-amber-200",HIGH:"text-red-600 bg-red-50 border-red-200",CRITICAL:"text-red-700 bg-red-50 border-red-200"}[supplier.riskLevel||""]||"text-gray-600 bg-gray-50 border-gray-200";
  const sC={ACTIVE:"bg-emerald-50 text-emerald-700 border-emerald-200",PENDING_APPROVAL:"bg-amber-50 text-amber-700 border-amber-200",BLOCKED:"bg-red-50 text-red-700 border-red-200",INACTIVE:"bg-gray-100 text-gray-500 border-gray-200"}[supplier.status]||"bg-gray-100 text-gray-500 border-gray-200";
  return(
    <div className="min-h-screen bg-[#F7F8FA]">
      <div className="bg-white border-b border-gray-100 px-8 py-4 flex items-center gap-4">
        <button onClick={()=>router.back()} className="size-8 rounded-xl border border-gray-200 flex items-center justify-center hover:bg-gray-50"><ArrowLeft className="size-4 text-gray-500"/></button>
        <div className="flex-1"><h1 className="text-base font-bold text-gray-900 flex items-center gap-2">{supplier.name}{supplier.preferred&&<Star className="size-4 text-amber-400 fill-amber-400"/>}</h1><p className="text-xs text-gray-400">{supplier.code} · {supplier.category||"—"}</p></div>
        <span className={`text-[10px] font-semibold px-3 py-1 rounded-full border ${sC}`}>{supplier.status==="PENDING_APPROVAL"?"Pending":supplier.status}</span>
        <button onClick={load} className="size-8 rounded-xl border border-gray-200 flex items-center justify-center hover:bg-gray-50"><RefreshCw className="size-3.5 text-gray-400"/></button>
      </div>
      <div className="px-8 py-6 grid grid-cols-3 gap-5">
        <div className="col-span-2 space-y-5">
          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-4">Performance Metrics</p>
            <div className="grid grid-cols-2 gap-4">
              <Metric label="Overall Rating" value={supplier.rating}/><Metric label="On-Time Delivery" value={supplier.onTimeDelivery}/>
              <Metric label="Quality Score" value={supplier.qualityScore}/><Metric label="Invoice Accuracy" value={supplier.invoiceAccuracy}/>
              <Metric label="Responsiveness" value={supplier.responsivenessScore}/>
              {supplier.riskLevel&&<div><div className="flex justify-between mb-1"><span className="text-[10px] text-gray-500">Risk Level</span><span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${rC}`}>{supplier.riskLevel}</span></div><div className="h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-red-400 rounded-full" style={{width:`${supplier.riskScore??0}%`}}/></div></div>}
            </div>
          </div>
          {(supplier.contacts?.length??0)>0&&<div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm"><p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-4">Contacts</p><div className="space-y-3">{supplier.contacts!.map(c=>(<div key={c.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl"><div className="size-8 bg-[#1A2A52]/10 rounded-full flex items-center justify-center shrink-0"><span className="text-xs font-bold text-[#1A2A52]">{(c.name||"?").charAt(0)}</span></div><div className="flex-1"><p className="text-xs font-semibold text-gray-900">{c.name}</p><p className="text-[10px] text-gray-400">{c.role||"Contact"}</p></div><div className="flex gap-3 text-[10px] text-gray-400">{c.email&&<span>{c.email}</span>}{c.phone&&<span>{c.phone}</span>}</div></div>))}</div></div>}
        </div>
        <div className="space-y-5">
          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm"><p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-4">Contact Info</p><div className="space-y-3">{supplier.contactName&&<div className="flex items-center gap-2 text-xs text-gray-700"><Shield className="size-3.5 text-gray-400"/>{supplier.contactName}</div>}{supplier.contactEmail&&<div className="flex items-center gap-2 text-xs text-gray-700"><Mail className="size-3.5 text-gray-400"/>{supplier.contactEmail}</div>}{supplier.contactPhone&&<div className="flex items-center gap-2 text-xs text-gray-700"><Phone className="size-3.5 text-gray-400"/>{supplier.contactPhone}</div>}{(supplier.city||supplier.country)&&<div className="flex items-center gap-2 text-xs text-gray-700"><MapPin className="size-3.5 text-gray-400"/>{[supplier.city,supplier.country].filter(Boolean).join(", ")}</div>}</div></div>
          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm"><p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-4">Commercial</p><div className="space-y-2.5">{[["Tier",supplier.tier],["Category",supplier.category],["Currency",supplier.currency],["Payment Terms",supplier.paymentTerms]].map(([l,v])=>v?(<div key={String(l)} className="flex justify-between"><span className="text-[10px] text-gray-400">{l}</span><span className="text-[10px] font-medium text-gray-900">{v}</span></div>):null)}</div></div>
        </div>
      </div>
    </div>
  );
}
