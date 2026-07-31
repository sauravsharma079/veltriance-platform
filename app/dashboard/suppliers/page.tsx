"use client";
import CsvUploadModal, { CsvUploadConfig } from "@/components/CsvUploadModal";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Search, Plus, Star, AlertTriangle, CheckCircle, BarChart3, Building2, RefreshCw, X, Upload, Code2 } from "lucide-react";
import type { ComponentType } from "react";

type Supplier = { id:string; name:string; code:string|null; category:string|null; tier:string|null; status:string; preferred:boolean; rating:number|null; riskScore:number|null; riskLevel:string|null; onboardingStage:string|null; city:string|null; country:string|null; contactEmail:string|null; contactName:string|null; };

const ST:Record<string,string>={ACTIVE:"bg-emerald-50 text-emerald-700 border border-emerald-200",PENDING_APPROVAL:"bg-amber-50 text-amber-700 border border-amber-200",BLOCKED:"bg-red-50 text-red-700 border border-red-200",INACTIVE:"bg-gray-100 text-gray-500 border border-gray-200"};

const STAGES = ["REGISTRATION","VALIDATION","RISK_ASSESSMENT","COMPLIANCE_REVIEW","PROCUREMENT_APPROVAL","ACTIVE"] as const;
const STAGE_LABELS: Record<string,string> = { REGISTRATION:"Registration", VALIDATION:"Validation", RISK_ASSESSMENT:"Risk Assessment", COMPLIANCE_REVIEW:"Compliance Review", PROCUREMENT_APPROVAL:"Procurement Approval", ACTIVE:"Active" };
const STAGE_COLORS: Record<string,string> = { REGISTRATION:"bg-gray-100 text-gray-600 border-gray-200", VALIDATION:"bg-blue-50 text-blue-700 border-blue-200", RISK_ASSESSMENT:"bg-purple-50 text-purple-700 border-purple-200", COMPLIANCE_REVIEW:"bg-amber-50 text-amber-700 border-amber-200", PROCUREMENT_APPROVAL:"bg-indigo-50 text-indigo-700 border-indigo-200", ACTIVE:"bg-emerald-50 text-emerald-700 border-emerald-200" };

function Bar({v}:{v:number|null}){if(v==null)return<span className="text-gray-300 text-xs">—</span>;const c=v>=90?"bg-emerald-500":v>=70?"bg-amber-500":"bg-red-500";return<div className="flex items-center gap-2"><div className="w-14 h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className={"h-full "+c} style={{width:`${v}%`}}/></div><span className="text-xs text-gray-600">{Math.round(v)}</span></div>;}

type StatCard = { label:string; value:number|string; Icon:ComponentType<{className?:string}>; tc:string; bg:string };

export default function SuppliersPage(){
  const[list,setList]=useState<Supplier[]>([]);const[loading,setLoading]=useState(true);const[err,setErr]=useState("");const[q,setQ]=useState("");const[st,setSt]=useState("");const[stage,setStage]=useState("");const[showUpload,setShowUpload]=useState(false);
  const load=useCallback(async()=>{
    setLoading(true);setErr("");
    try{const p=new URLSearchParams();if(q)p.set("q",q);if(st)p.set("status",st);if(stage)p.set("stage",stage);const r=await fetch("/api/suppliers?"+p.toString());const txt=await r.text();if(!txt.trim()){setList([]);return;}const d=JSON.parse(txt);setList(Array.isArray(d?.suppliers)?d.suppliers:[]);}
    catch(e:any){setErr(e?.message||"Failed");setList([]);}
    finally{setLoading(false);}
  },[q,st,stage]);
  useEffect(()=>{load();},[load]);

  const active=list.filter(s=>s.status==="ACTIVE").length,pref=list.filter(s=>s.preferred).length,hi=list.filter(s=>s.riskLevel==="HIGH"||s.riskLevel==="CRITICAL").length,avg=list.length?Math.round(list.reduce((a,s)=>a+(s.rating??0),0)/list.length):0;
  const stageCounts = Object.fromEntries(STAGES.map(s=>[s, list.filter(x=>x.onboardingStage===s).length]));

  const stats: StatCard[] = [
    { label:"Active", value:active, Icon:CheckCircle, tc:"text-emerald-600", bg:"bg-emerald-50" },
    { label:"Preferred", value:pref, Icon:Star, tc:"text-amber-600", bg:"bg-amber-50" },
    { label:"High Risk", value:hi, Icon:AlertTriangle, tc:"text-red-600", bg:"bg-red-50" },
    { label:"Avg Rating", value:avg||"—", Icon:BarChart3, tc:"text-[#1A2A52]", bg:"bg-[#1A2A52]/8" },
  ];

  return(
    <div className="min-h-screen bg-[#F7F8FA]">
      {showUpload && (
        <CsvUploadModal
          config={{
            title: "Bulk Upload Suppliers",
            description: "Import vendors from CSV. Duplicates (by code, tax ID, or name) are skipped safely.",
            endpoint: "/api/upload/suppliers",
            templateName: "veltriance_suppliers_template",
            headers: ["name","code","taxId","category","contactEmail","contactName","contactPhone","city","country","tier","paymentTerms"],
            requiredHeaders: ["name"],
            exampleRows: [
              ["Tata Consultancy Services","SUP-201","AAACT2727Q","IT Services","vendor@tcs.com","Amit Verma","+91-22-6778-9999","Mumbai","India","Tier 1","Net 30"],
              ["Infosys Limited","SUP-202","AAACI4741P","Consulting","vendor@infosys.com","Priya Sharma","+91-80-2852-0261","Bengaluru","India","Tier 1","Net 45"],
            ],
          }}
          onClose={() => setShowUpload(false)}
          onSuccess={() => { setShowUpload(false); load(); }}
        />
      )}
      <div className="bg-white border-b border-gray-100 px-8 py-5 flex items-center justify-between">
        <div><h1 className="text-lg font-bold text-gray-900">Suppliers</h1><p className="text-xs text-gray-400">Full lifecycle — request, onboard, assess risk, activate</p></div>
        <div className="flex items-center gap-2">
          <a href="/api/developer/postman?module=suppliers" download className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 border border-gray-200 px-4 py-2 rounded-xl hover:bg-gray-50"><Code2 className="size-3.5"/>Postman Collection</a>
          <button onClick={()=>setShowUpload(true)} className="flex items-center gap-1.5 text-xs font-semibold text-[#1A2A52] border border-[#1A2A52]/20 px-4 py-2 rounded-xl hover:bg-[#1A2A52]/5"><Upload className="size-3.5"/>Upload CSV</button>
          <button onClick={()=>window.dispatchEvent(new Event("veltriance:onboard-supplier"))} className="flex items-center gap-2 bg-[#1A2A52] text-white text-xs font-semibold px-4 py-2 rounded-xl hover:bg-[#243766]"><Plus className="size-3.5"/>Onboard Supplier</button>
        </div>
      </div>
      <div className="px-8 py-6">
        <div className="grid grid-cols-4 gap-4 mb-5">
          {stats.map(({label,value,Icon,tc,bg})=>(
            <div key={label} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm flex items-center gap-3"><div className={`size-10 ${bg} rounded-xl flex items-center justify-center`}><Icon className={`size-5 ${tc}`}/></div><div><p className="text-xl font-bold text-gray-900">{String(value)}</p><p className="text-[10px] text-gray-400">{label}</p></div></div>
          ))}
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5 mb-5">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-3">Onboarding Pipeline</p>
          <div className="grid grid-cols-6 gap-3">
            {STAGES.map((s,i)=>(
              <button key={s} onClick={()=>setStage(stage===s?"":s)} className={`text-left p-3 rounded-xl border transition-colors ${stage===s?"border-[#1A2A52] bg-[#1A2A52]/5":"border-gray-100 hover:bg-gray-50"}`}>
                <div className="flex items-center gap-1.5 mb-1.5"><span className="size-4 rounded-full bg-[#1A2A52] text-white text-[9px] font-bold flex items-center justify-center shrink-0">{i+1}</span><span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full border ${STAGE_COLORS[s]}`}>{STAGE_LABELS[s]}</span></div>
                <p className="text-lg font-bold text-gray-900">{stageCounts[s]}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3 mb-5">
          <div className="relative flex-1 max-w-xs"><Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-gray-400"/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search suppliers..." className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl outline-none focus:border-[#1A2A52]"/></div>
          <select value={st} onChange={e=>setSt(e.target.value)} className="text-xs border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-[#1A2A52]"><option value="">All Statuses</option><option value="ACTIVE">Active</option><option value="PENDING_APPROVAL">Pending</option><option value="BLOCKED">Blocked</option><option value="INACTIVE">Inactive</option></select>
          <select value={stage} onChange={e=>setStage(e.target.value)} className="text-xs border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-[#1A2A52]"><option value="">All Stages</option>{STAGES.map(s=><option key={s} value={s}>{STAGE_LABELS[s]}</option>)}</select>
          <button onClick={load} className="flex items-center gap-1.5 text-xs text-gray-500 border border-gray-200 px-3 py-2 rounded-xl hover:bg-gray-50"><RefreshCw className="size-3"/>Refresh</button>
        </div>
        {err&&<div className="bg-red-50 border border-red-200 text-red-700 text-xs px-4 py-3 rounded-xl mb-4 flex items-center gap-2"><X className="size-3.5"/>{err}</div>}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="grid grid-cols-12 gap-3 px-5 py-3 bg-gray-50 border-b text-[10px] font-semibold text-gray-400 uppercase tracking-wide"><div className="col-span-3">Supplier</div><div className="col-span-2">Category</div><div className="col-span-2">Stage</div><div className="col-span-1">Status</div><div className="col-span-2">Rating</div><div className="col-span-2">Risk</div></div>
          {loading?<div className="flex items-center justify-center py-16"><div className="size-8 border-2 border-[#1A2A52]/20 border-t-[#1A2A52] rounded-full animate-spin"/></div>
          :list.length===0?<div className="text-center py-16"><Building2 className="size-10 text-gray-200 mx-auto mb-3"/><p className="text-sm text-gray-400">No suppliers found</p></div>
          :list.map(s=>(
            <Link key={s.id} href={`/dashboard/suppliers/${s.id}`} className="grid grid-cols-12 gap-3 px-5 py-3.5 border-b border-gray-50 last:border-0 items-center hover:bg-gray-50/60 transition-colors">
              <div className="col-span-3 flex items-center gap-2.5"><div className="size-9 rounded-xl bg-[#1A2A52]/8 flex items-center justify-center shrink-0"><span className="text-xs font-bold text-[#1A2A52]">{(s.name||"?").charAt(0)}</span></div><div className="min-w-0"><p className="text-xs font-semibold text-gray-900 truncate">{s.name}</p><p className="text-[10px] text-gray-400">{s.code} · {s.city||s.country||"—"}</p></div>{s.preferred&&<Star className="size-3 text-amber-400 fill-amber-400 shrink-0"/>}</div>
              <div className="col-span-2"><p className="text-xs text-gray-600 truncate">{s.category||"—"}</p></div>
              <div className="col-span-2">{s.onboardingStage?<span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${STAGE_COLORS[s.onboardingStage]||""}`}>{STAGE_LABELS[s.onboardingStage]||s.onboardingStage}</span>:<span className="text-gray-300 text-xs">—</span>}</div>
              <div className="col-span-1"><span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${ST[s.status]||"bg-gray-100 text-gray-500"}`}>{s.status==="PENDING_APPROVAL"?"Pending":s.status}</span></div>
              <div className="col-span-2"><Bar v={s.rating}/></div>
              <div className="col-span-2">{s.riskLevel?<div className="flex items-center gap-1.5"><div className={`size-1.5 rounded-full ${s.riskLevel==="LOW"?"bg-emerald-500":s.riskLevel==="MEDIUM"?"bg-amber-500":"bg-red-500"}`}/><span className="text-xs font-medium text-gray-600">{s.riskLevel}</span>{s.riskScore!=null&&<span className="text-[10px] text-gray-400">({s.riskScore})</span>}</div>:<span className="text-gray-300 text-xs">—</span>}</div>
            </Link>
          ))}
        </div>
        {!loading&&list.length>0&&<p className="text-xs text-gray-400 mt-3 text-center">{list.length} suppliers</p>}
      </div>
    </div>
  );
}
