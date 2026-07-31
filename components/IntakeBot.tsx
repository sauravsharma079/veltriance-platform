"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { Sparkles, Send, Loader2, RotateCcw, ChevronRight, Search, Star } from "lucide-react";

type Supplier = { id:string; name:string; code:string; category:string|null; tier:string|null; preferred:boolean; rating:number|null; };
type Address = { code:string; label:string; };
type LineItem = { description:string; quantity:number; unit_price:number; supplier_id:string; supplier_name:string; gl_account:string; gl_label:string; };
type ReqData = { title?:string; category?:string; priority?:string; department?:string; justification?:string; required_date?:string; delivery_location?:string; line_items:LineItem[]; };
type Step = "WELCOME"|"WHAT"|"AI_SUGGEST"|"SUPPLIER_PICK"|"QUANTITY"|"PRICE"|"GL_ACCOUNT"|"MORE_ITEMS"|"CATEGORY"|"PRIORITY"|"DEPARTMENT"|"DATE"|"DELIVERY"|"JUSTIFY"|"CONFIRM"|"DONE";
type Msg = { role:"bot"|"user"|"status"; text:string; options?:{label:string;value:string}[]; search?:boolean; };

// GL_ACCOUNTS loaded from /api/admin/lookups?type=GL_ACCOUNT
const GL_ACCOUNTS: {value:string;label:string}[] = [];
// CATEGORIES loaded from /api/admin/lookups?type=CATEGORY
const CATEGORIES: string[] = [];
const PRIORITIES=[{label:"🔴 High — Urgent business need",value:"HIGH"},{label:"🟡 Medium — Standard timeline",value:"MEDIUM"},{label:"🟢 Low — Flexible timing",value:"LOW"}];
// DEPTS loaded from /api/admin/lookups?type=DEPARTMENT
const DEPTS: string[] = [];
const QUICK_ITEMS=["Laptop / Computer","Software License","Cloud Services","Office Furniture","Network Equipment","Monitor / Display","Printer / Scanner","Server / Storage","Mobile Device","Consulting Services"];

export default function IntakeBot() {
  const [step,setStep]=useState<Step>("WELCOME");
  const [msgs,setMsgs]=useState<Msg[]>([]);
  const [input,setInput]=useState("");
  const [loading,setLoading]=useState(false);
  const [suppliers,setSuppliers]=useState<Supplier[]>([]);
  const [aiSuppliers,setAiSuppliers]=useState<Supplier[]>([]);
  const [addresses,setAddresses]=useState<Address[]>([]);
  const [data,setData]=useState<ReqData>({line_items:[]});
  const [curItem,setCurItem]=useState<Partial<LineItem>>({});
  const [createdId,setCreatedId]=useState<string|null>(null);
  const [createdNum,setCreatedNum]=useState<string|null>(null);
  const [supSearch,setSupSearch]=useState("");
  const bottomRef=useRef<HTMLDivElement>(null);

  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:"smooth"});},[msgs,loading]);

  const fetchSuppliers=useCallback(async(q?:string)=>{
    try{
      const r=await fetch(`/api/suppliers?status=ACTIVE${q?`&q=${encodeURIComponent(q)}`:""}`);
      const d=await r.json();
      const list=Array.isArray(d.suppliers)?d.suppliers:[];
      setSuppliers(list);
      return list;
    }catch{setSuppliers([]);return[];}
  },[]);

  const fetchAddresses=useCallback(async()=>{
    try{
      const r=await fetch("/api/admin/lookups?type=DELIVERY_ADDRESS");
      const d=await r.json();
      setAddresses((d.lookups||[]).map((l:any)=>({code:l.code,label:l.label})));
    }catch{setAddresses([]);}
  },[]);

  const suggestSuppliers=useCallback(async(itemDesc:string,category?:string)=>{
    try{
      // AI-powered suggestion: search by item description keywords
      const keywords=itemDesc.toLowerCase();
      const catMatch=category?.toLowerCase()||"";
      const all=await fetchSuppliers("");
      // Score and sort by relevance
      const scored=all.map((s:Supplier)=>{
        let score=0;
        const sName=(s.name||"").toLowerCase();
        const sCat=(s.category||"").toLowerCase();
        // Preferred suppliers get a boost
        if(s.preferred) score+=30;
        // Category match
        if(catMatch&&sCat.includes(catMatch.split(" ")[0])) score+=40;
        if(sCat.includes("hardware")&&keywords.includes("laptop")) score+=40;
        if(sCat.includes("hardware")&&keywords.includes("computer")) score+=40;
        if(sCat.includes("software")&&keywords.includes("license")) score+=40;
        if(sCat.includes("software")&&keywords.includes("software")) score+=40;
        if(sCat.includes("cloud")&&keywords.includes("cloud")) score+=40;
        if(sCat.includes("cloud")&&keywords.includes("aws")) score+=50;
        if(sName.includes("lenovo")&&(keywords.includes("laptop")||keywords.includes("thinkpad"))) score+=60;
        if(sName.includes("hp")&&(keywords.includes("laptop")||keywords.includes("printer"))) score+=50;
        if(sName.includes("dell")&&(keywords.includes("laptop")||keywords.includes("server"))) score+=50;
        if(sName.includes("cisco")&&(keywords.includes("network")||keywords.includes("switch"))) score+=60;
        if(sName.includes("microsoft")&&(keywords.includes("office")||keywords.includes("365")||keywords.includes("azure"))) score+=60;
        if(sName.includes("adobe")&&keywords.includes("adobe")) score+=60;
        if(sName.includes("aws")&&(keywords.includes("aws")||keywords.includes("amazon")||keywords.includes("cloud"))) score+=60;
        if(sName.includes("google")&&(keywords.includes("google")||keywords.includes("gcp")||keywords.includes("cloud"))) score+=60;
        if(sName.includes("salesforce")&&(keywords.includes("salesforce")||keywords.includes("crm"))) score+=60;
        if(sName.includes("zoom")&&(keywords.includes("zoom")||keywords.includes("video")||keywords.includes("meeting"))) score+=60;
        if(s.rating&&s.rating>90) score+=10;
        return{...s,score};
      }).sort((a:any,b:any)=>b.score-a.score).slice(0,6);
      setAiSuppliers(scored);
      return scored;
    }catch{return[];}
  },[fetchSuppliers]);

  const addMsg=(role:Msg["role"],text:string,options?:Msg["options"],search?:boolean)=>
    setMsgs(m=>[...m,{role,text,options,search}]);

  useEffect(()=>{
    addMsg("bot","👋 Hi! I'm **Aria**, your AI procurement assistant.\n\nI'll help you raise a purchase request in minutes — no forms, no confusion.\n\nWhat do you need to purchase? Pick a common item or type your own:");
    addMsg("bot","",QUICK_ITEMS.map(i=>({label:i,value:i})));
    setStep("WHAT");
    fetchAddresses();
    // Fetch dynamic lookup values
    Promise.all([
      fetch("/api/admin/lookups?type=GL_ACCOUNT").then(r=>r.json()).catch(()=>({lookups:[]})),
      fetch("/api/admin/lookups?type=CATEGORY").then(r=>r.json()).catch(()=>({lookups:[]})),
      fetch("/api/admin/lookups?type=DEPARTMENT").then(r=>r.json()).catch(()=>({lookups:[]})),
    ]).then(([gl, cat, dept]) => {
      if (gl.lookups?.length) setGlAccounts(gl.lookups.map((l:any)=>({ value:l.code, label:l.label })));
      if (cat.lookups?.length) setCategories(cat.lookups.map((l:any)=>l.label));
      if (dept.lookups?.length) setDepartments(dept.lookups.map((l:any)=>l.label));
    });
  },[]);

  function restart(){
    setStep("WELCOME");setData({line_items:[]});setCurItem({});
    setCreatedId(null);setCreatedNum(null);setMsgs([]);setSupSearch("");
    setTimeout(()=>{
      addMsg("bot","Starting fresh! What do you need to purchase?");
      addMsg("bot","",QUICK_ITEMS.map(i=>({label:i,value:i})));
      setStep("WHAT");
    },100);
  }

  async function handleOption(value:string,label:string){
    addMsg("user",label);
    await advance(value,label);
  }

  async function handleSend(){
    const text=input.trim();
    if(!text||loading) return;
    setInput("");
    addMsg("user",text);
    await advance(text,text);
  }

  async function advance(value:string,label:string){
    switch(step){
      case "WHAT":{
        setData(d=>({...d,title:value}));
        setCurItem(ci=>({...ci,description:value}));
        setLoading(true);
        addMsg("status","Finding best suppliers for this...");
        const suggested=await suggestSuppliers(value);
        setLoading(false);
        if(suggested.length>0){
          addMsg("bot",`🤖 Based on your request for **${value}**, here are the best matched suppliers from your approved vendor list:`);
          addMsg("bot","Select a supplier — or search for a different one:",suggested.slice(0,6).map((s:any)=>({
            label:`${s.preferred?"⭐ ":""}${s.name} · ${s.category||""}${s.rating?` · ${s.rating}/100`:""}`,
            value:`${s.id}|${s.name}`,
          })));
        } else {
          addMsg("bot","No matched suppliers found. Search by name:");
          addMsg("bot","",undefined,true);
        }
        setStep("AI_SUGGEST");
        break;
      }
      case "AI_SUGGEST":{
        if(value.startsWith("search:")){
          const q=value.replace("search:","");
          setLoading(true);
          const list=await fetchSuppliers(q);
          setLoading(false);
          addMsg("bot","Select a supplier:",list.slice(0,8).map(s=>({
            label:`${s.preferred?"⭐ ":""}${s.name}${s.category?` · ${s.category}`:""}`,
            value:`${s.id}|${s.name}`,
          })));
          return;
        }
        const[supplierId,supplierName]=value.split("|");
        setCurItem(ci=>({...ci,supplier_id:supplierId,supplier_name:supplierName}));
        addMsg("bot",`✅ **${supplierName}** selected!\n\nHow many units do you need?`,[
          {label:"1",value:"1"},{label:"2",value:"2"},{label:"5",value:"5"},
          {label:"10",value:"10"},{label:"Other — I'll type",value:"custom"},
        ]);
        setStep("QUANTITY");
        break;
      }
      case "QUANTITY":{
        if(value==="custom"){
          addMsg("bot","Enter the exact quantity:");
          setInput("");
          return;
        }
        const qty=parseFloat(value);
        if(isNaN(qty)||qty<=0){addMsg("bot","Please enter a valid quantity:");return;}
        setCurItem(ci=>({...ci,quantity:qty}));
        addMsg("bot",`Got it — **${qty} unit${qty>1?"s":""}**.\n\nWhat is the estimated unit price in ₹?`,[
          {label:"₹10,000",value:"10000"},{label:"₹25,000",value:"25000"},
          {label:"₹50,000",value:"50000"},{label:"₹1,00,000",value:"100000"},
          {label:"₹2,50,000",value:"250000"},{label:"₹5,00,000",value:"500000"},
          {label:"Other — I'll type",value:"custom"},
        ]);
        setStep("PRICE");
        break;
      }
      case "PRICE":{
        if(value==="custom"){addMsg("bot","Enter the price in ₹ (numbers only):");return;}
        const price=parseFloat(value.replace(/[^0-9.]/g,""));
        if(isNaN(price)||price<0){addMsg("bot","Please enter a valid price:");return;}
        setCurItem(ci=>({...ci,unit_price:price}));
        addMsg("bot","Select the GL Account — this will appear on the Purchase Order:",GL_ACCOUNTS.map(g=>({label:g.label,value:`${g.value}|${g.label}`})));
        setStep("GL_ACCOUNT");
        break;
      }
      case "GL_ACCOUNT":{
        const[glCode,glLabel]=value.split("|");
        const completed:LineItem={
          description:curItem.description??data.title??"",
          quantity:curItem.quantity??1,unit_price:curItem.unit_price??0,
          supplier_id:curItem.supplier_id??"",supplier_name:curItem.supplier_name??"",
          gl_account:glCode,gl_label:glLabel??glCode,
        };
        const newItems=[...data.line_items,completed];
        setData(d=>({...d,line_items:newItems}));
        setCurItem({});
        const total=newItems.reduce((s,i)=>s+i.quantity*i.unit_price,0);
        addMsg("bot",`Added ✅  Total so far: **₹${total.toLocaleString("en-IN")}** (excl. GST)\n\nNeed to add another item?`,[
          {label:"➕ Yes, add another item",value:"yes"},
          {label:"✅ No, continue to details",value:"no"},
        ]);
        setStep("MORE_ITEMS");
        break;
      }
      case "MORE_ITEMS":{
        if(value==="yes"){addMsg("bot","What is the next item?");setCurItem({});setStep("WHAT");return;}
        addMsg("bot","What category best fits this requisition?",CATEGORIES.map(c=>({label:c,value:c})));
        setStep("CATEGORY");break;
      }
      case "CATEGORY":{
        setData(d=>({...d,category:value}));
        addMsg("bot","What priority is this request?",PRIORITIES);
        setStep("PRIORITY");break;
      }
      case "PRIORITY":{
        setData(d=>({...d,priority:value}));
        addMsg("bot","Which department is raising this?",DEPTS.map(d=>({label:d,value:d})));
        setStep("DEPARTMENT");break;
      }
      case "DEPARTMENT":{
        setData(d=>({...d,department:value}));
        addMsg("bot","When do you need delivery by?",[
          {label:"This week",value:"This week"},
          {label:"In 2 weeks",value:"In 2 weeks"},
          {label:"This month",value:"This month"},
          {label:"Next month",value:"Next month"},
          {label:"ASAP — Urgent",value:"ASAP"},
          {label:"📅 Specific date — I'll type",value:"custom"},
        ]);
        setStep("DATE");break;
      }
      case "DATE":{
        if(value==="custom"){addMsg("bot","Enter the date (e.g. 30 Sep 2025):");return;}
        setData(d=>({...d,required_date:value}));
        const addrOpts=addresses.length>0
          ?addresses.map(a=>({label:a.label,value:a.label}))
          :[
            {label:"Ace HQ — Prestige Tech Park, Bengaluru",value:"Ace HQ — Prestige Tech Park, Bengaluru"},
            {label:"Ace Delhi — DLF Cyber City, Gurugram",value:"Ace Delhi — DLF Cyber City, Gurugram"},
            {label:"Ace Mumbai — One BKC, Mumbai",value:"Ace Mumbai — One BKC, Mumbai"},
            {label:"Ace Hyderabad — HITEC City",value:"Ace Hyderabad — HITEC City"},
          ];
        addMsg("bot","📍 Select the delivery location — **required** for the purchase order:",addrOpts);
        setStep("DELIVERY");break;
      }
      case "DELIVERY":{
        if(!value.trim()){addMsg("bot","⚠️ Delivery location is required. Please select one:");return;}
        setData(d=>({...d,delivery_location:value}));
        addMsg("bot","Last step! Briefly explain why this purchase is needed:",[
          {label:"Operational requirement",value:"Required for day-to-day business operations."},
          {label:"Project requirement",value:"Required to support an active business project."},
          {label:"Replacement / upgrade",value:"Replacement for end-of-life or faulty equipment."},
          {label:"New hire / team expansion",value:"Required to onboard new team member."},
          {label:"✏️ I'll write my own",value:"custom"},
        ]);
        setStep("JUSTIFY");break;
      }
      case "JUSTIFY":{
        if(value==="custom"){addMsg("bot","Type your justification:");return;}
        const finalData={...data,justification:value};
        setData(finalData);
        const total=finalData.line_items.reduce((s,i)=>s+i.quantity*i.unit_price,0);
        const itemLines=finalData.line_items.map(li=>
          `  • ${li.description} × ${li.quantity} @ ₹${li.unit_price.toLocaleString("en-IN")}\n    Supplier: ${li.supplier_name} | GL: ${li.gl_account}`
        ).join("\n");
        addMsg("bot",
          `📋 **Requisition Summary**\n\n`+
          `Title: ${finalData.title}\nCategory: ${finalData.category}\nPriority: ${finalData.priority}\n`+
          `Department: ${finalData.department}\nDelivery: ${finalData.delivery_location}\n`+
          `Required by: ${finalData.required_date}\n\n`+
          `Line Items:\n${itemLines}\n\n`+
          `Subtotal: ₹${total.toLocaleString("en-IN")}\n`+
          `GST (18%): ₹${(total*0.18).toLocaleString("en-IN")}\n`+
          `**Grand Total: ₹${(total*1.18).toLocaleString("en-IN")}**\n\nReady to submit?`,
          [{label:"✅ Submit Requisition",value:"submit"},{label:"↩ Start Over",value:"restart"}]
        );
        setStep("CONFIRM");break;
      }
      case "CONFIRM":{
        if(value==="restart"){restart();return;}
        await submitRequisition();break;
      }
      case "DONE":{
        if(value==="view"&&createdId){window.location.href=`/dashboard/requisitions/${createdId}`;return;}
        if(value==="new"){restart();return;}
        break;
      }
    }
  }

  async function submitRequisition(){
    setLoading(true);
    addMsg("status","Submitting your requisition...");
    try{
      const payload={
        title:data.title,category:data.category??"General",
        priority:data.priority??"MEDIUM",department:data.department,
        businessJustification:data.justification,requiredDate:data.required_date,
        deliveryLocation:data.delivery_location??"",currency:"INR",intakeSource:"CHATBOT",
        lineItems:data.line_items.map(li=>({
          description:li.description,quantity:li.quantity,unitPrice:li.unit_price,
          supplierId:li.supplier_id||undefined,glAccount:li.gl_account,category:data.category,
        })),
      };
      const res=await fetch("/api/intake/submit",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
      const rd=await res.json();
      if(!res.ok) throw new Error(rd.error??"Submission failed");
      setCreatedId(rd.requisition?.id);
      setCreatedNum(rd.requisition?.requisitionNumber??"REQ-NEW");
      const total=data.line_items.reduce((s,i)=>s+i.quantity*i.unit_price,0);
      addMsg("bot",
        `🎉 **${rd.requisition?.requisitionNumber}** submitted successfully!\n\n`+
        `Total: ₹${(total*1.18).toLocaleString("en-IN")} (incl. GST)\n`+
        `GL Accounts: ${[...new Set(data.line_items.map(l=>l.gl_account))].join(", ")}\n`+
        `Delivery to: ${data.delivery_location}\n\n`+
        `Your request is now pending manager approval. You will be notified on any updates.`,
        [{label:"📄 View Requisition",value:"view"},{label:"➕ New Requisition",value:"new"}]
      );
      setStep("DONE");
    }catch(e:any){
      addMsg("bot",`❌ Submission failed: ${e.message}`,
        [{label:"🔄 Try Again",value:"submit"},{label:"↩ Start Over",value:"restart"}]
      );
      setStep("CONFIRM");
    }
    setLoading(false);
  }

  const BUTTON_STEPS:Step[]=["AI_SUGGEST","GL_ACCOUNT","MORE_ITEMS","CATEGORY","PRIORITY","DEPARTMENT","DELIVERY","CONFIRM","DONE"];
  const showInput=!BUTTON_STEPS.includes(step)||step==="QUANTITY"||step==="PRICE"||step==="DATE"||step==="JUSTIFY";

  const PROG=[
    {l:"Item",s:["WHAT","AI_SUGGEST","SUPPLIER_PICK"] as Step[]},
    {l:"Qty & Price",s:["QUANTITY","PRICE","GL_ACCOUNT","MORE_ITEMS"] as Step[]},
    {l:"Details",s:["CATEGORY","PRIORITY","DEPARTMENT"] as Step[]},
    {l:"Delivery",s:["DATE","DELIVERY"] as Step[]},
    {l:"Review",s:["JUSTIFY","CONFIRM","DONE"] as Step[]},
  ];
  const pg=PROG.findIndex(g=>(g.s as Step[]).includes(step));

  return(
    <div className="flex flex-col h-full bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#1A2A52] to-[#2D5A9B] px-5 py-4 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-white/15 flex items-center justify-center"><Sparkles className="size-5 text-[#C8A04D]"/></div>
            <div><p className="text-sm font-bold text-white">Aria — AI Procurement</p><p className="text-[10px] text-white/60">Guided · Smart Vendor Match · One-click submit</p></div>
          </div>
          <button onClick={restart} className="size-8 rounded-xl bg-white/10 flex items-center justify-center hover:bg-white/20"><RotateCcw className="size-3.5 text-white"/></button>
        </div>
        {step!=="WELCOME"&&(
          <div className="flex items-center gap-1 mt-3">
            {PROG.map((g,i)=>(
              <div key={g.l} className="flex items-center gap-1 flex-1">
                <div className="flex-1">
                  <div className={`h-1 rounded-full transition-all ${i<=pg?"bg-[#C8A04D]":"bg-white/20"}`}/>
                  <p className={`text-[8px] mt-0.5 text-center ${i<=pg?"text-white/80":"text-white/30"}`}>{g.l}</p>
                </div>
                {i<PROG.length-1&&<ChevronRight className="size-2.5 text-white/20 shrink-0 mb-3"/>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0">
        {msgs.map((m,i)=>(
          <div key={i}>
            {m.role==="status"?(
              <div className="flex justify-center"><span className="text-[10px] text-gray-400 bg-gray-50 border border-gray-100 px-3 py-1 rounded-full flex items-center gap-1.5"><Loader2 className="size-2.5 animate-spin"/>{m.text}</span></div>
            ):m.role==="user"?(
              <div className="flex justify-end"><div className="max-w-[78%] bg-[#1A2A52] text-white text-xs px-4 py-2.5 rounded-2xl rounded-br-sm leading-relaxed">{m.text}</div></div>
            ):(
              <div className="flex gap-2.5">
                {m.text&&<div className="size-7 rounded-xl bg-[#1A2A52] flex items-center justify-center shrink-0 mt-0.5"><Sparkles className="size-3.5 text-[#C8A04D]"/></div>}
                <div className="flex-1 min-w-0">
                  {m.text&&(
                    <div className="bg-white border border-gray-100 text-gray-800 text-xs px-4 py-3 rounded-2xl rounded-bl-sm shadow-sm leading-relaxed">
                      {m.text.split("\n").map((line,j)=><p key={j} className={j>0?(line?"mt-1":"h-1"):""}>{line}</p>)}
                    </div>
                  )}
                  {m.search&&(
                    <div className="flex gap-2 mt-2">
                      <div className="relative flex-1"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-gray-400"/><input value={supSearch} onChange={e=>setSupSearch(e.target.value)} placeholder="Search supplier name..." className="w-full pl-7 pr-3 py-2 text-xs border border-gray-200 rounded-xl outline-none focus:border-[#1A2A52]"/></div>
                      <button onClick={()=>handleOption(`search:${supSearch}`,`Search: ${supSearch}`)} className="bg-[#1A2A52] text-white text-xs px-3 py-2 rounded-xl">Search</button>
                    </div>
                  )}
                  {m.options&&m.options.length>0&&i===msgs.length-1&&(
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {m.options.map(opt=>(
                        <button key={opt.value} onClick={()=>handleOption(opt.value,opt.label)}
                          className="text-[11px] font-medium px-3 py-1.5 bg-white border border-gray-200 rounded-xl hover:bg-[#1A2A52] hover:text-white hover:border-[#1A2A52] transition-colors shadow-sm">
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
        {loading&&(
          <div className="flex gap-2.5">
            <div className="size-7 rounded-xl bg-[#1A2A52] flex items-center justify-center shrink-0"><Sparkles className="size-3.5 text-[#C8A04D]"/></div>
            <div className="bg-white border border-gray-100 px-4 py-3 rounded-2xl shadow-sm"><div className="flex gap-1">{[0,150,300].map(d=><div key={d} className="size-1.5 bg-[#1A2A52] rounded-full animate-bounce" style={{animationDelay:`${d}ms`}}/>)}</div></div>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>

      {/* Input */}
      {showInput&&(
        <div className="px-4 pb-4 pt-2 border-t border-gray-100 shrink-0">
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-2xl px-4 py-2.5 focus-within:border-[#1A2A52] focus-within:bg-white transition-colors">
            <input value={input} onChange={e=>setInput(e.target.value)}
              onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey&&!loading){e.preventDefault();handleSend();}}}
              placeholder={step==="WHAT"?"What do you need to purchase?":step==="QUANTITY"?"Enter quantity (e.g. 5)...":step==="PRICE"?"Enter unit price in ₹ (e.g. 50000)...":step==="DATE"?"e.g. 30 Sep 2025 or ASAP...":step==="JUSTIFY"?"Why is this purchase needed?...":"Type here..."}
              disabled={loading}
              className="flex-1 text-xs bg-transparent outline-none text-gray-800 placeholder:text-gray-400 disabled:opacity-40"/>
            <button onClick={handleSend} disabled={!input.trim()||loading}
              className="size-7 bg-[#1A2A52] rounded-xl flex items-center justify-center disabled:opacity-30 hover:bg-[#243766] transition-colors">
              {loading?<Loader2 className="size-3 text-white animate-spin"/>:<Send className="size-3 text-white"/>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
