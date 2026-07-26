
"use client";
import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Star, Shield, CheckCircle2, XCircle, Clock, FileText, MessageSquare, TrendingUp, Award, Package, Phone, Mail, Globe, MapPin, Edit3, Save, X, ChevronRight, BadgeCheck, Plus, Send, AlertCircle } from "lucide-react";

type Supplier = {
  id:string;name:string;code:string;status:string;onboardingStage:string|null;category:string|null;
  contactName:string|null;contactEmail:string|null;contactPhone:string|null;website:string|null;
  city:string|null;country:string|null;tier:string|null;preferred:boolean;
  rating:number|null;riskLevel:string|null;riskScore:number|null;
  onTimeDelivery:number|null;qualityScore:number|null;responsivenessScore:number|null;invoiceAccuracy:number|null;
  notes:string|null;
  contacts:{id:string;name:string;title:string|null;email:string;phone:string|null;isPrimary:boolean}[];
  documents:{id:string;type:string;name:string;fileUrl:string;status:string;createdAt:string;rejectedNote:string|null}[];
  onboardingProfile:{legalName:string|null;tradeName:string|null;businessType:string|null;panNumber:string|null;gstNumber:string|null;msmeNumber:string|null;bankName:string|null;accountNumber:string|null;ifscCode:string|null;beneficiaryName:string|null;accountType:string|null;regAddressLine1:string|null;regCity:string|null;regState:string|null;regPostal:string|null;womenOwned:boolean;minorityOwned:boolean;smallBusiness:boolean;completionScore:number;submittedAt:string|null}|null;
  certifications_v2:{id:string;name:string;issuingBody:string|null;expiresAt:string|null;status:string}[];
  performanceReviews:{id:string;reviewPeriod:string;onTimeDelivery:number;qualityScore:number;responsiveness:number;overallScore:number;comments:string|null}[];
  messages:{id:string;fromPortal:boolean;senderName:string;subject:string;body:string;createdAt:string}[];
  purchaseOrders:{id:string;poNumber:string;status:string;totalAmount:number;issuedAt:string|null}[];
};

const STAGE_ORDER=["REGISTRATION","VALIDATION","RISK_ASSESSMENT","COMPLIANCE_REVIEW","PROCUREMENT_APPROVAL","ACTIVE"];
const STAGE_LABELS:Record<string,string>={REGISTRATION:"Registration",VALIDATION:"Validation",RISK_ASSESSMENT:"Risk Assessment",COMPLIANCE_REVIEW:"Compliance Review",PROCUREMENT_APPROVAL:"Procurement Approval",ACTIVE:"Active"};
const DOC_LABELS:Record<string,string>={PAN_CARD:"PAN Card",GST_CERTIFICATE:"GST Certificate",INCORPORATION_CERTIFICATE:"Certificate of Incorporation",MSME_CERTIFICATE:"MSME Certificate",CANCELLED_CHEQUE:"Cancelled Cheque",BANK_STATEMENT:"Bank Statement",ISO_CERTIFICATE:"ISO Certificate",QUALITY_CERTIFICATE:"Quality Certificate",INSURANCE_CERTIFICATE:"Insurance Certificate",ANNUAL_REPORT:"Annual Report",NDA:"NDA",MSA:"MSA",OTHER:"Other"};
const REQUIRED_DOCS=["PAN_CARD","GST_CERTIFICATE","INCORPORATION_CERTIFICATE","CANCELLED_CHEQUE"];

function fmt(n:number|null){if(n===null)return"—";if(n>=10000000)return`₹${(n/10000000).toFixed(1)} Cr`;if(n>=100000)return`₹${(n/100000).toFixed(1)} L`;return`₹${n.toLocaleString("en-IN")}`;}

function ScoreBar({label,value}:{label:string;value:number|null}){
  if(value===null)return null;
  const c=value>=90?"bg-emerald-500":value>=70?"bg-amber-400":"bg-red-400";
  return(<div className="flex items-center gap-3"><span className="text-xs text-gray-500 w-32 shrink-0">{label}</span><div className="flex-1 h-2 bg-gray-100 rounded-full"><div className={`h-2 rounded-full ${c}`} style={{width:`${value}%`}}/></div><span className={`text-xs font-bold w-10 text-right ${value>=90?"text-emerald-700":value>=70?"text-amber-700":"text-red-700"}`}>{value}%</span></div>);
}

export default function SupplierDetailPage({params}:{params:Promise<{id:string}>}){
  const {id}=use(params);
  const router=useRouter();
  const [supplier,setSupplier]=useState<Supplier|null>(null);
  const [loading,setLoading]=useState(true);
  const [tab,setTab]=useState<"overview"|"onboarding"|"documents"|"performance"|"orders"|"messages">("overview");
  const [saving,setSaving]=useState(false);
  const [editingProfile,setEditingProfile]=useState(false);
  const [profileForm,setProfileForm]=useState<Record<string,unknown>>({});
  const [msgForm,setMsgForm]=useState({subject:"",body:""});
  const [sendingMsg,setSendingMsg]=useState(false);
  const [addingDoc,setAddingDoc]=useState(false);
  const [docForm,setDocForm]=useState({type:"PAN_CARD",name:""});

  const load=useCallback(async()=>{
    setLoading(true);
    const res=await fetch(`/api/suppliers/${id}`);
    if(res.ok){const d=await res.json();setSupplier(d.supplier);if(d.supplier.onboardingProfile)setProfileForm(d.supplier.onboardingProfile);}
    setLoading(false);
  },[id]);
  useEffect(()=>{load();},[load]);

  async function updateStatus(status:string){setSaving(true);await fetch(`/api/suppliers/${id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({status})});setSaving(false);load();}
  async function advanceStage(){if(!supplier?.onboardingStage)return;const idx=STAGE_ORDER.indexOf(supplier.onboardingStage);const next=STAGE_ORDER[idx+1];if(!next)return;await fetch(`/api/suppliers/${id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({onboardingStage:next,...(next==="ACTIVE"?{status:"ACTIVE"}:{})})});load();}
  async function saveProfile(){setSaving(true);await fetch(`/api/suppliers/${id}/onboarding`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(profileForm)});setSaving(false);setEditingProfile(false);load();}
  async function verifyDoc(docId:string,status:string){await fetch(`/api/suppliers/${id}/documents/${docId}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({status})});load();}
  async function addDoc(){if(!docForm.name)return;await fetch(`/api/suppliers/${id}/documents`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...docForm,fileUrl:"#"})});setAddingDoc(false);setDocForm({type:"PAN_CARD",name:""});load();}
  async function sendMessage(){if(!msgForm.subject||!msgForm.body)return;setSendingMsg(true);await fetch(`/api/suppliers/${id}/messages`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(msgForm)});setSendingMsg(false);setMsgForm({subject:"",body:""});load();}

  if(loading)return<div className="flex items-center justify-center h-screen bg-[#F7F8FA]"><div className="size-8 border-2 border-[#1A2A52]/20 border-t-[#1A2A52] rounded-full animate-spin"/></div>;
  if(!supplier)return<div className="flex flex-col items-center justify-center h-screen"><p className="text-gray-500">Not found</p><button onClick={()=>router.push("/dashboard/suppliers")} className="mt-4 text-sm text-[#1A2A52]">Back</button></div>;

  const stageIdx=STAGE_ORDER.indexOf(supplier.onboardingStage??"REGISTRATION");
  const profile=supplier.onboardingProfile;
  const verifiedDocs=supplier.documents.filter(d=>d.status==="VERIFIED").length;
  const pendingDocs=supplier.documents.filter(d=>d.status==="PENDING").length;

  const TABS=[
    {id:"overview" as const,label:"Overview"},
    {id:"onboarding" as const,label:"Onboarding",badge:profile?`${profile.completionScore}%`:null},
    {id:"documents" as const,label:"Documents",badge:pendingDocs>0?String(pendingDocs):null},
    {id:"performance" as const,label:"Performance"},
    {id:"orders" as const,label:"Purchase Orders",badge:supplier.purchaseOrders.length>0?String(supplier.purchaseOrders.length):null},
    {id:"messages" as const,label:"Messages"},
  ];

  return(
    <div className="min-h-screen bg-[#F7F8FA]">
      <div className="bg-white border-b border-gray-100">
        <div className="px-8 py-5">
          <button onClick={()=>router.push("/dashboard/suppliers")} className="flex items-center gap-2 text-xs text-gray-400 hover:text-[#1A2A52] mb-3"><ArrowLeft className="size-3.5"/>Suppliers</button>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="size-14 rounded-2xl bg-gradient-to-br from-[#1A2A52] to-[#2D4A8A] flex items-center justify-center shadow-sm"><span className="text-xl font-black text-white">{supplier.name.charAt(0)}</span></div>
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-xl font-bold text-gray-900">{supplier.name}</h1>
                  {supplier.preferred&&<Star className="size-5 text-[#C8A04D] fill-[#C8A04D]"/>}
                  <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${supplier.status==="ACTIVE"?"bg-emerald-50 border-emerald-200 text-emerald-700":supplier.status==="PENDING_APPROVAL"?"bg-amber-50 border-amber-200 text-amber-700":supplier.status==="BLOCKED"?"bg-red-50 border-red-200 text-red-700":"bg-gray-100 border-gray-200 text-gray-500"}`}>{supplier.status.replace("_"," ")}</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-400">
                  <span>{supplier.code}</span>
                  {supplier.category&&<span>· {supplier.category}</span>}
                  {supplier.city&&<span className="flex items-center gap-1"><MapPin className="size-3"/>{supplier.city}, {supplier.country}</span>}
                  {supplier.tier&&<span className="bg-[#1A2A52]/8 text-[#1A2A52] px-2 py-0.5 rounded-full font-medium">{supplier.tier}</span>}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {supplier.status==="PENDING_APPROVAL"&&<><button onClick={()=>updateStatus("ACTIVE")} disabled={saving} className="flex items-center gap-2 bg-emerald-600 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-emerald-700 disabled:opacity-50"><CheckCircle2 className="size-4"/>Approve</button><button onClick={()=>updateStatus("BLOCKED")} disabled={saving} className="flex items-center gap-2 border border-red-200 text-red-600 text-sm font-medium px-4 py-2 rounded-xl hover:bg-red-50"><XCircle className="size-4"/>Reject</button></>}
              {supplier.status==="ACTIVE"&&supplier.onboardingStage!=="ACTIVE"&&<button onClick={advanceStage} className="flex items-center gap-2 border border-[#1A2A52]/20 text-[#1A2A52] text-sm font-medium px-4 py-2 rounded-xl hover:bg-[#1A2A52]/5"><ChevronRight className="size-4"/>Advance Stage</button>}
              {supplier.status==="ACTIVE"&&<button onClick={()=>updateStatus("BLOCKED")} className="flex items-center gap-2 border border-gray-200 text-gray-500 text-sm font-medium px-4 py-2 rounded-xl hover:bg-gray-50">Block</button>}
            </div>
          </div>
          {/* Stage progress */}
          {supplier.onboardingStage&&(
            <div className="mt-5 pt-4 border-t border-gray-100">
              <div className="flex items-start">
                {STAGE_ORDER.map((s,i)=>(
                  <div key={s} className={`flex flex-col items-center ${i<STAGE_ORDER.length-1?"flex-1":""}`}>
                    <div className={`size-7 rounded-full flex items-center justify-center text-xs font-bold border-2 mb-1 ${i<stageIdx?"bg-emerald-500 border-emerald-500 text-white":i===stageIdx?"bg-[#1A2A52] border-[#1A2A52] text-white shadow-md":"bg-white border-gray-200 text-gray-400"}`}>
                      {i<stageIdx?<CheckCircle2 className="size-3.5"/>:i+1}
                    </div>
                    <p className={`text-[9px] font-semibold text-center ${i===stageIdx?"text-[#1A2A52]":i<stageIdx?"text-emerald-600":"text-gray-400"}`}>{STAGE_LABELS[s]}</p>
                    {i<STAGE_ORDER.length-1&&<div className={`h-0.5 w-full mt-3.5 absolute`} style={{display:"none"}}/>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        {/* Tabs */}
        <div className="px-8 flex gap-0">
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} className={`flex items-center gap-2 py-3.5 px-1 mr-6 text-sm font-semibold border-b-2 -mb-px ${tab===t.id?"border-[#1A2A52] text-[#1A2A52]":"border-transparent text-gray-400 hover:text-gray-600"}`}>
              {t.label}{t.badge&&<span className="bg-[#1A2A52] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">{t.badge}</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="px-8 py-6 max-w-6xl">

        {/* OVERVIEW */}
        {tab==="overview"&&(
          <div className="grid grid-cols-3 gap-5">
            <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Contact Information</p>
              <div className="space-y-3">
                {supplier.contactName&&<div className="flex items-center gap-3"><div className="size-7 bg-[#1A2A52]/8 rounded-lg flex items-center justify-center"><Mail className="size-3.5 text-[#1A2A52]"/></div><div><p className="text-xs font-semibold text-gray-900">{supplier.contactName}</p><p className="text-[10px] text-gray-400">Primary contact</p></div></div>}
                {supplier.contactEmail&&<div className="flex items-center gap-3"><div className="size-7 bg-[#1A2A52]/8 rounded-lg flex items-center justify-center"><Mail className="size-3.5 text-[#1A2A52]"/></div><a href={`mailto:${supplier.contactEmail}`} className="text-xs text-[#1A2A52] hover:underline">{supplier.contactEmail}</a></div>}
                {supplier.contactPhone&&<div className="flex items-center gap-3"><div className="size-7 bg-[#1A2A52]/8 rounded-lg flex items-center justify-center"><Phone className="size-3.5 text-[#1A2A52]"/></div><p className="text-xs text-gray-700">{supplier.contactPhone}</p></div>}
                {supplier.website&&<div className="flex items-center gap-3"><div className="size-7 bg-[#1A2A52]/8 rounded-lg flex items-center justify-center"><Globe className="size-3.5 text-[#1A2A52]"/></div><a href={supplier.website} target="_blank" rel="noopener" className="text-xs text-[#1A2A52] hover:underline truncate">{supplier.website}</a></div>}
              </div>
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Business Profile</p>
              {profile?(
                <div className="space-y-2.5">
                  {([["Legal Name",profile.legalName],["Business Type",profile.businessType?.replace("_"," ")],["PAN",profile.panNumber],["GST Number",profile.gstNumber],["Bank",profile.bankName],["IFSC",profile.ifscCode]] as [string,string|null|undefined][]).map(([l,v])=>v?<div key={l} className="flex justify-between"><span className="text-[10px] text-gray-400">{l}</span><span className="text-xs font-medium text-gray-900">{v}</span></div>:null)}
                  <div className="pt-3 border-t border-gray-100">
                    <div className="flex justify-between items-center mb-1"><span className="text-[10px] text-gray-400">Completion</span><span className="text-xs font-bold text-[#1A2A52]">{profile.completionScore}%</span></div>
                    <div className="h-2 bg-gray-100 rounded-full"><div className={`h-2 rounded-full ${profile.completionScore>=80?"bg-emerald-500":profile.completionScore>=50?"bg-amber-400":"bg-[#1A2A52]"}`} style={{width:`${profile.completionScore}%`}}/></div>
                  </div>
                </div>
              ):(
                <div className="text-center py-6"><AlertCircle className="size-8 text-amber-400 mx-auto mb-2"/><p className="text-xs text-gray-500 mb-3">Profile not submitted</p><button onClick={()=>setTab("onboarding")} className="text-xs text-[#1A2A52] font-semibold hover:underline">Complete onboarding →</button></div>
              )}
            </div>
            <div className="space-y-4">
              <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Risk & Documents</p>
                <div className="flex items-center gap-3 mb-3">
                  <div className={`size-10 rounded-xl flex items-center justify-center ${supplier.riskLevel==="LOW"?"bg-emerald-50":supplier.riskLevel==="MEDIUM"?"bg-amber-50":supplier.riskLevel==="HIGH"?"bg-red-50":"bg-gray-50"}`}>
                    <Shield className={`size-5 ${supplier.riskLevel==="LOW"?"text-emerald-600":supplier.riskLevel==="MEDIUM"?"text-amber-600":supplier.riskLevel==="HIGH"?"text-red-600":"text-gray-400"}`}/>
                  </div>
                  <div><p className="text-sm font-bold text-gray-900">{supplier.riskLevel??"Not assessed"}</p><p className="text-xs text-gray-400">Score: {supplier.riskScore??"—"}/100</p></div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-gray-50 rounded-xl p-2"><p className="text-base font-bold text-gray-900">{supplier.documents.length}</p><p className="text-[9px] text-gray-400 uppercase">Total</p></div>
                  <div className="bg-emerald-50 rounded-xl p-2"><p className="text-base font-bold text-emerald-700">{verifiedDocs}</p><p className="text-[9px] text-emerald-600 uppercase">Verified</p></div>
                  <div className={`rounded-xl p-2 ${pendingDocs>0?"bg-amber-50":"bg-gray-50"}`}><p className={`text-base font-bold ${pendingDocs>0?"text-amber-700":"text-gray-400"}`}>{pendingDocs}</p><p className={`text-[9px] uppercase ${pendingDocs>0?"text-amber-600":"text-gray-400"}`}>Pending</p></div>
                </div>
                <button onClick={()=>setTab("documents")} className="w-full mt-3 text-xs text-[#1A2A52] font-semibold hover:underline">Manage documents →</button>
              </div>
              {supplier.certifications_v2.length>0&&(
                <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Certifications</p>
                  <div className="space-y-2">{supplier.certifications_v2.slice(0,4).map(c=><div key={c.id} className="flex items-center gap-2"><Award className="size-3.5 text-[#C8A04D] shrink-0"/><p className="text-xs text-gray-800 flex-1 truncate">{c.name}</p><span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${c.status==="ACTIVE"?"bg-emerald-50 text-emerald-700":"bg-gray-100 text-gray-500"}`}>{c.status}</span></div>)}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ONBOARDING */}
        {tab==="onboarding"&&(
          <div className="max-w-3xl">
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <div><p className="text-sm font-semibold text-gray-900">Supplier Onboarding Profile</p><p className="text-xs text-gray-400 mt-0.5">Complete all sections to advance through the pipeline</p></div>
                <div className="flex items-center gap-2">
                  {profile&&<span className="text-sm font-bold text-[#1A2A52]">{profile.completionScore}% complete</span>}
                  {editingProfile?<><button onClick={saveProfile} disabled={saving} className="flex items-center gap-1.5 bg-[#1A2A52] text-white text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50"><Save className="size-3"/>{saving?"Saving…":"Save"}</button><button onClick={()=>setEditingProfile(false)} className="flex items-center gap-1.5 border border-gray-200 text-gray-500 text-xs px-3 py-1.5 rounded-lg"><X className="size-3"/>Cancel</button></>
                  :<button onClick={()=>setEditingProfile(true)} className="flex items-center gap-1.5 border border-[#1A2A52]/20 text-[#1A2A52] text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-[#1A2A52]/5"><Edit3 className="size-3"/>Edit</button>}
                </div>
              </div>
              <div className="p-6 space-y-6">
                {[
                  {title:"Business Details",icon:BadgeCheck,fields:[{k:"legalName",l:"Legal Name"},{k:"tradeName",l:"Trade Name"},{k:"businessType",l:"Business Type",select:["PRIVATE_LIMITED","LLP","PARTNERSHIP","PROPRIETORSHIP","PUBLIC_LIMITED"]},{k:"panNumber",l:"PAN Number"},{k:"gstNumber",l:"GST Number"},{k:"msmeNumber",l:"MSME No."}]},
                  {title:"Banking Details",icon:BadgeCheck,fields:[{k:"beneficiaryName",l:"Beneficiary Name"},{k:"bankName",l:"Bank Name"},{k:"accountNumber",l:"Account Number"},{k:"ifscCode",l:"IFSC Code"},{k:"accountType",l:"Account Type",select:["SAVINGS","CURRENT"]}]},
                ].map(section=>(
                  <section key={section.title}>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">{section.title}</p>
                    <div className="grid grid-cols-2 gap-3">
                      {section.fields.map(f=>(
                        <div key={f.k}>
                          <label className="block text-[10px] font-semibold text-gray-500 mb-1">{f.l}</label>
                          {editingProfile?(
                            (f as {select?:string[]}).select?(
                              <select value={(profileForm[f.k]??""  ) as string} onChange={e=>setProfileForm(p=>({...p,[f.k]:e.target.value}))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#1A2A52]"><option value="">Select…</option>{(f as {select?:string[]}).select!.map(o=><option key={o}>{o}</option>)}</select>
                            ):(
                              <input value={(profileForm[f.k]??"") as string} onChange={e=>setProfileForm(p=>({...p,[f.k]:e.target.value}))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#1A2A52]"/>
                            )
                          ):(
                            <p className="text-sm text-gray-900 py-1 font-mono">{(profile as Record<string,unknown>|null)?.[f.k] as string|undefined ?? <span className="text-gray-300 font-sans">Not provided</span>}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
                <section className="border-t border-gray-100 pt-5">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Diversity Classification</p>
                  <div className="grid grid-cols-3 gap-3">
                    {[{k:"womenOwned",l:"Women-Owned"},{k:"minorityOwned",l:"Minority-Owned"},{k:"smallBusiness",l:"Small Business"}].map(f=>(
                      <label key={f.k} className="flex items-center gap-2.5 p-3 border border-gray-200 rounded-xl cursor-pointer">
                        <input type="checkbox" disabled={!editingProfile} checked={(editingProfile?profileForm:profile)?.[f.k as keyof typeof profile] as boolean??false} onChange={e=>editingProfile&&setProfileForm(p=>({...p,[f.k]:e.target.checked}))} className="size-4 accent-[#1A2A52]"/>
                        <span className="text-xs font-medium text-gray-700">{f.l}</span>
                      </label>
                    ))}
                  </div>
                </section>
              </div>
            </div>
          </div>
        )}

        {/* DOCUMENTS */}
        {tab==="documents"&&(
          <div className="max-w-3xl space-y-4">
            <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-semibold text-gray-900">Required Documents</p>
                <button onClick={()=>setAddingDoc(true)} className="flex items-center gap-1.5 text-xs text-[#1A2A52] border border-[#1A2A52]/20 px-3 py-1.5 rounded-lg hover:bg-[#1A2A52]/5 font-semibold"><Plus className="size-3"/>Add Document</button>
              </div>
              <div className="grid grid-cols-2 gap-2 mb-4">
                {REQUIRED_DOCS.map(dt=>{
                  const up=supplier.documents.find(d=>d.type===dt);
                  return(
                    <div key={dt} className={`flex items-center gap-3 p-3 rounded-xl border ${up?(up.status==="VERIFIED"?"bg-emerald-50 border-emerald-200":"bg-amber-50 border-amber-200"):"bg-gray-50 border-dashed border-gray-300"}`}>
                      {up?(up.status==="VERIFIED"?<CheckCircle2 className="size-4 text-emerald-600 shrink-0"/>:<Clock className="size-4 text-amber-600 shrink-0"/>):<AlertCircle className="size-4 text-gray-400 shrink-0"/>}
                      <div><p className={`text-xs font-semibold ${up?"text-gray-900":"text-gray-500"}`}>{DOC_LABELS[dt]}</p><p className={`text-[9px] ${up?(up.status==="VERIFIED"?"text-emerald-600":"text-amber-600"):"text-gray-400"}`}>{up?up.status:"Not uploaded"}</p></div>
                    </div>
                  );
                })}
              </div>
            </div>
            {addingDoc&&(
              <div className="bg-[#1A2A52]/5 border border-[#1A2A52]/20 rounded-2xl p-5">
                <p className="text-sm font-semibold text-gray-900 mb-3">Add Document Record</p>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div><label className="block text-[10px] font-semibold text-gray-500 mb-1">Type</label><select value={docForm.type} onChange={e=>setDocForm(f=>({...f,type:e.target.value}))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#1A2A52]">{Object.entries(DOC_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></div>
                  <div><label className="block text-[10px] font-semibold text-gray-500 mb-1">Document name</label><input value={docForm.name} onChange={e=>setDocForm(f=>({...f,name:e.target.value}))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#1A2A52]" placeholder="e.g. PAN Card - Company Name"/></div>
                </div>
                <div className="flex gap-2"><button onClick={addDoc} className="bg-[#1A2A52] text-white text-xs font-semibold px-4 py-2 rounded-lg">Add Record</button><button onClick={()=>setAddingDoc(false)} className="text-xs text-gray-500 px-4 py-2">Cancel</button></div>
              </div>
            )}
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3 border-b border-gray-100">All Documents ({supplier.documents.length})</p>
              {supplier.documents.length===0?<div className="text-center py-10 text-gray-300"><FileText className="size-8 mx-auto mb-2"/><p className="text-xs text-gray-400">No documents uploaded</p></div>:(
                <div className="divide-y divide-gray-50">
                  {supplier.documents.map(doc=>(
                    <div key={doc.id} className="flex items-center gap-4 px-5 py-3.5">
                      <div className={`size-9 rounded-xl flex items-center justify-center shrink-0 ${doc.status==="VERIFIED"?"bg-emerald-50":doc.status==="REJECTED"?"bg-red-50":"bg-amber-50"}`}><FileText className={`size-4 ${doc.status==="VERIFIED"?"text-emerald-600":doc.status==="REJECTED"?"text-red-500":"text-amber-600"}`}/></div>
                      <div className="flex-1 min-w-0"><p className="text-sm font-medium text-gray-900 truncate">{doc.name}</p><p className="text-[10px] text-gray-400">{DOC_LABELS[doc.type]} · {new Date(doc.createdAt).toLocaleDateString("en-IN")}</p>{doc.rejectedNote&&<p className="text-[10px] text-red-600 mt-0.5">{doc.rejectedNote}</p>}</div>
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${doc.status==="VERIFIED"?"bg-emerald-50 text-emerald-700":doc.status==="REJECTED"?"bg-red-50 text-red-700":"bg-amber-50 text-amber-700"}`}>{doc.status}</span>
                      {doc.status==="PENDING"&&<div className="flex gap-1.5 shrink-0"><button onClick={()=>verifyDoc(doc.id,"VERIFIED")} className="flex items-center gap-1 text-[10px] text-emerald-600 border border-emerald-200 px-2 py-1 rounded-lg hover:bg-emerald-50"><CheckCircle2 className="size-3"/>Verify</button><button onClick={()=>verifyDoc(doc.id,"REJECTED")} className="flex items-center gap-1 text-[10px] text-red-500 border border-red-200 px-2 py-1 rounded-lg hover:bg-red-50"><XCircle className="size-3"/>Reject</button></div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* PERFORMANCE */}
        {tab==="performance"&&(
          <div className="max-w-3xl space-y-5">
            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
              <p className="text-sm font-semibold text-gray-900 mb-5">Performance Scorecard</p>
              <div className="grid grid-cols-4 gap-4 mb-6">
                {([["Overall",supplier.rating],["\u23f1\u00a0On-time",supplier.onTimeDelivery],["Quality",supplier.qualityScore],["Invoice",supplier.invoiceAccuracy]] as [string,number|null][]).map(([l,v])=>(
                  <div key={l} className={`rounded-xl p-4 text-center ${v!==null&&v>=90?"bg-emerald-50":v!==null&&v>=70?"bg-amber-50":"bg-gray-50"}`}>
                    <p className={`text-2xl font-black mb-0.5 ${v!==null&&v>=90?"text-emerald-700":v!==null&&v>=70?"text-amber-700":v!==null?"text-red-600":"text-gray-400"}`}>{v!==null?`${v}%`:"—"}</p>
                    <p className="text-[10px] text-gray-500 font-medium">{l}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-3">
                <ScoreBar label="On-time Delivery" value={supplier.onTimeDelivery}/>
                <ScoreBar label="Quality Score" value={supplier.qualityScore}/>
                <ScoreBar label="Responsiveness" value={supplier.responsivenessScore}/>
                <ScoreBar label="Invoice Accuracy" value={supplier.invoiceAccuracy}/>
              </div>
            </div>
            {supplier.performanceReviews.length>0&&(
              <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                <p className="text-sm font-semibold text-gray-900 mb-4">Review History</p>
                <div className="space-y-3">{supplier.performanceReviews.map(r=>(
                  <div key={r.id} className="border border-gray-100 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2"><p className="text-xs font-semibold text-gray-900">{r.reviewPeriod}</p><span className={`text-sm font-black ${r.overallScore>=90?"text-emerald-600":r.overallScore>=70?"text-amber-600":"text-red-600"}`}>{r.overallScore}%</span></div>
                    <div className="grid grid-cols-3 gap-2 text-xs text-gray-500"><span>Delivery: {r.onTimeDelivery}%</span><span>Quality: {r.qualityScore}%</span><span>Response: {r.responsiveness}%</span></div>
                    {r.comments&&<p className="text-xs text-gray-500 mt-2 italic">"{r.comments}"</p>}
                  </div>
                ))}</div>
              </div>
            )}
          </div>
        )}

        {/* ORDERS */}
        {tab==="orders"&&(
          <div className="max-w-3xl">
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3 border-b border-gray-100">Purchase Orders ({supplier.purchaseOrders.length})</p>
              {supplier.purchaseOrders.length===0?<div className="text-center py-10"><Package className="size-8 text-gray-200 mx-auto mb-2"/><p className="text-xs text-gray-400">No purchase orders yet</p></div>:(
                <div className="divide-y divide-gray-50">{supplier.purchaseOrders.map(po=>(
                  <div key={po.id} className="flex items-center gap-4 px-5 py-4">
                    <Package className="size-5 text-gray-300 shrink-0"/>
                    <div className="flex-1"><p className="text-sm font-semibold text-gray-900">{po.poNumber}</p><p className="text-xs text-gray-400">{po.issuedAt?new Date(po.issuedAt).toLocaleDateString("en-IN"):"Not issued"}</p></div>
                    <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${po.status==="ACKNOWLEDGED"?"bg-emerald-50 text-emerald-700":po.status==="SENT"?"bg-blue-50 text-blue-700":"bg-gray-100 text-gray-500"}`}>{po.status}</span>
                    <p className="text-sm font-bold text-gray-900">{fmt(po.totalAmount)}</p>
                  </div>
                ))}</div>
              )}
            </div>
          </div>
        )}

        {/* MESSAGES */}
        {tab==="messages"&&(
          <div className="max-w-3xl space-y-4">
            <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
              <p className="text-sm font-semibold text-gray-900 mb-4">Send Message to Supplier</p>
              <div className="space-y-3">
                <input value={msgForm.subject} onChange={e=>setMsgForm(f=>({...f,subject:e.target.value}))} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#1A2A52]" placeholder="Subject"/>
                <textarea value={msgForm.body} onChange={e=>setMsgForm(f=>({...f,body:e.target.value}))} rows={4} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#1A2A52] resize-none" placeholder="Message to supplier…"/>
                <button onClick={sendMessage} disabled={sendingMsg||!msgForm.subject||!msgForm.body} className="flex items-center gap-2 bg-[#1A2A52] text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-[#243766] disabled:opacity-50"><Send className="size-4"/>{sendingMsg?"Sending…":"Send Message"}</button>
              </div>
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3 border-b border-gray-100">Message History</p>
              {supplier.messages.length===0?<div className="text-center py-10"><MessageSquare className="size-8 text-gray-200 mx-auto mb-2"/><p className="text-xs text-gray-400">No messages yet</p></div>:(
                <div className="divide-y divide-gray-50">{supplier.messages.map(m=>(
                  <div key={m.id} className={`px-5 py-4 ${m.fromPortal?"bg-blue-50/30":""}`}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2"><span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${m.fromPortal?"bg-blue-100 text-blue-700":"bg-[#1A2A52]/8 text-[#1A2A52]"}`}>{m.fromPortal?"SUPPLIER":"INTERNAL"}</span><p className="text-xs font-semibold text-gray-900">{m.subject}</p></div>
                      <time className="text-[10px] text-gray-400">{new Date(m.createdAt).toLocaleDateString("en-IN")}</time>
                    </div>
                    <p className="text-xs text-gray-600 leading-relaxed">{m.body}</p>
                    <p className="text-[10px] text-gray-400 mt-1.5">From: {m.senderName}</p>
                  </div>
                ))}</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
