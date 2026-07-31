"use client";
import { useState, useRef, useCallback } from "react";
import { Upload, FileText, Building2, List, Tag, CheckCircle, AlertCircle, Download, X, ChevronDown } from "lucide-react";

type UploadResult = { created?:number; updated?:number; skipped?:number; errors?:string[]; total?:number; };
type Tab = "suppliers"|"lookups"|"catalogs";

const TEMPLATES: Record<Tab, { headers: string[]; example: string[][] }> = {
  suppliers: {
    headers: ["name","code","category","contactEmail","contactName","contactPhone","city","country","tier","paymentTerms"],
    example: [
      ["Tata Consultancy Services","SUP-201","IT Services","vendor@tcs.com","Amit Verma","+91-22-6778-9999","Mumbai","India","Tier 1","Net 30"],
      ["Infosys Limited","SUP-202","Consulting","vendor@infosys.com","Priya Sharma","+91-80-2852-0261","Bengaluru","India","Tier 1","Net 45"],
    ]
  },
  lookups: {
    headers: ["type","code","label","sortOrder"],
    example: [
      ["DEPARTMENT","LEGAL","Legal & Compliance","9"],
      ["GL_ACCOUNT","7000","7000 — Research & Development","10"],
      ["CATEGORY","CAT-R&D","Research & Development","9"],
      ["PAYMENT_TERMS","NET90","Net 90 Days","6"],
    ]
  },
  catalogs: {
    headers: ["sku","name","unitPrice","currency","category","gl","unit","leadDays","description"],
    example: [
      ["ITEM-001","Dell XPS 15 Laptop 16GB 512GB","125000","INR","IT Hardware","6100","Each","7","Dell XPS 15 9530 Intel Core i7"],
      ["ITEM-002","Samsung 27-inch 4K Monitor","38000","INR","IT Hardware","6100","Each","3","UHD 4K IPS Panel USB-C"],
    ]
  }
};

function parseCSV(text: string): Record<string,string>[] {
  const newline = String.fromCharCode(10);
  const lines = text.trim().split(newline).map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g,""));
  return lines.slice(1).map(line => {
    const vals = line.match(/(".*?"|[^,]+|(?<=,)(?=,)|^(?=,)|(?<=,)$)/g) || [];
    const obj: Record<string,string> = {};
    headers.forEach((h, i) => { obj[h] = (vals[i]||"").replace(/^"|"$/g,"").trim(); });
    return obj;
  });
}

function downloadTemplate(tab: Tab) {
  const t = TEMPLATES[tab];
  const rows = [t.headers.join(","), ...t.example.map(r => r.join(","))].join("
");
  const blob = new Blob([rows], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url;
  a.download = `veltriance_${tab}_template.csv`; a.click();
  URL.revokeObjectURL(url);
}

export default function UploadPage() {
  const [tab, setTab] = useState<Tab>("suppliers");
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File|null>(null);
  const [preview, setPreview] = useState<Record<string,string>[]>([]);
  const [result, setResult] = useState<UploadResult|null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [catalogs, setCatalogs] = useState<{id:string;name:string}[]>([]);
  const [selectedCatalog, setSelectedCatalog] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const loadCatalogs = useCallback(async () => {
    const r = await fetch("/api/catalogs?type=HOSTED_CATALOG");
    const d = await r.json();
    setCatalogs(Array.isArray(d.catalogs) ? d.catalogs.map((c:any)=>({id:c.id,name:c.name})) : []);
  }, []);

  function processFile(f: File) {
    setFile(f); setResult(null); setError("");
    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target?.result as string;
      const rows = parseCSV(text);
      setPreview(rows.slice(0, 5));
    };
    reader.readAsText(f);
    if (tab === "catalogs") loadCatalogs();
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f?.name.endsWith(".csv")) processFile(f);
  }

  async function uploadFile() {
    if (!file) return;
    setLoading(true); setError(""); setResult(null);
    try {
      const text = await file.text();
      const rows = parseCSV(text);
      if (rows.length === 0) { setError("No valid rows found in CSV"); setLoading(false); return; }

      let endpoint = "";
      let body: any = { rows };
      if (tab === "suppliers")  endpoint = "/api/upload/suppliers";
      if (tab === "lookups")    endpoint = "/api/upload/lookups";
      if (tab === "catalogs")   { endpoint = "/api/upload/catalog-items"; body = { catalogId: selectedCatalog, rows }; }

      if (tab === "catalogs" && !selectedCatalog) { setError("Please select a target catalog"); setLoading(false); return; }

      const res = await fetch(endpoint, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(body) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Upload failed");
      setResult(d);
      setFile(null); setPreview([]);
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  }

  const TABS: { id:Tab; label:string; icon:any; desc:string }[] = [
    { id:"suppliers", label:"Suppliers",     icon:Building2, desc:"Bulk onboard vendors" },
    { id:"lookups",   label:"Lookup Values", icon:List,      desc:"Departments, GL accounts, etc." },
    { id:"catalogs",  label:"Catalog Items", icon:Tag,       desc:"Add products to a catalog" },
  ];

  return (
    <div className="min-h-screen bg-[#F7F8FA]">
      <div className="bg-white border-b border-gray-100 px-8 py-5">
        <div className="flex items-center justify-between">
          <div><h1 className="text-lg font-bold text-gray-900">Bulk Upload</h1><p className="text-xs text-gray-400 mt-0.5">Import data via CSV — suppliers, lookups, catalog items</p></div>
          <button onClick={() => downloadTemplate(tab)} className="flex items-center gap-2 text-xs font-semibold text-[#1A2A52] border border-[#1A2A52]/20 px-4 py-2 rounded-xl hover:bg-[#1A2A52]/5">
            <Download className="size-3.5"/>Download Template
          </button>
        </div>
      </div>

      <div className="px-8 py-6">
        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {TABS.map(t => (
            <button key={t.id} onClick={() => { setTab(t.id); setFile(null); setPreview([]); setResult(null); setError(""); }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold border transition-all ${tab===t.id?"bg-[#1A2A52] text-white border-[#1A2A52]":"bg-white text-gray-600 border-gray-200 hover:border-gray-300"}`}>
              <t.icon className="size-3.5"/>{t.label}
              <span className={`text-[9px] ${tab===t.id?"text-white/60":"text-gray-400"}`}>{t.desc}</span>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 space-y-4">
            {/* Drop zone */}
            <div
              onDragOver={e=>{e.preventDefault();setDragging(true);}}
              onDragLeave={()=>setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${dragging?"border-[#1A2A52] bg-[#1A2A52]/5":"border-gray-200 hover:border-gray-300 bg-white"}`}>
              <Upload className={`size-10 mx-auto mb-3 ${dragging?"text-[#1A2A52]":"text-gray-300"}`}/>
              {file ? (
                <div>
                  <p className="text-sm font-semibold text-gray-900">{file.name}</p>
                  <p className="text-xs text-gray-400 mt-1">{preview.length} rows parsed (showing 5 of {preview.length})</p>
                  <button onClick={e=>{e.stopPropagation();setFile(null);setPreview([]);setResult(null);}} className="mt-2 text-xs text-red-500 hover:underline flex items-center gap-1 mx-auto"><X className="size-3"/>Remove</button>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-semibold text-gray-600">Drop your CSV here or click to browse</p>
                  <p className="text-xs text-gray-400 mt-1">Supports .csv files · Max 10,000 rows</p>
                </div>
              )}
              <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={e=>{const f=e.target.files?.[0];if(f)processFile(f);}}/>
            </div>

            {/* Catalog selector */}
            {tab==="catalogs" && file && (
              <div className="bg-white border border-gray-200 rounded-2xl p-4">
                <label className="block text-xs font-semibold text-gray-700 mb-2">Select target catalog *</label>
                <select value={selectedCatalog} onChange={e=>setSelectedCatalog(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#1A2A52]">
                  <option value="">Select catalog...</option>
                  {catalogs.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}

            {/* Preview */}
            {preview.length > 0 && (
              <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50">
                  <p className="text-xs font-semibold text-gray-700">Preview — first {preview.length} rows</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[10px]">
                    <thead><tr className="bg-gray-50 border-b border-gray-100">{Object.keys(preview[0]).map(h=><th key={h} className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wide">{h}</th>)}</tr></thead>
                    <tbody>{preview.map((row,i)=><tr key={i} className="border-b border-gray-50 last:border-0">{Object.values(row).map((v,j)=><td key={j} className="px-3 py-2 text-gray-600 truncate max-w-32">{v||"—"}</td>)}</tr>)}</tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Error */}
            {error && <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-xs px-4 py-3 rounded-xl"><AlertCircle className="size-4 shrink-0"/>{error}</div>}

            {/* Result */}
            {result && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3"><CheckCircle className="size-5 text-emerald-600"/><p className="text-sm font-bold text-emerald-800">Upload Complete</p></div>
                <div className="grid grid-cols-3 gap-3">
                  {[["Created",result.created,"text-emerald-700"],["Updated/Existing",result.updated??result.skipped,"text-amber-700"],["Errors",result.errors?.length||0,"text-red-700"]].map(([l,v,c])=>(
                    <div key={String(l)} className="bg-white rounded-xl p-3 text-center"><p className={`text-xl font-bold ${c}`}>{v}</p><p className="text-[10px] text-gray-500">{l}</p></div>
                  ))}
                </div>
                {result.errors && result.errors.length > 0 && (
                  <div className="mt-3 bg-red-50 rounded-xl p-3 max-h-32 overflow-y-auto">
                    {result.errors.map((e,i)=><p key={i} className="text-[10px] text-red-600">{e}</p>)}
                  </div>
                )}
              </div>
            )}

            {/* Upload button */}
            {file && !result && (
              <button onClick={uploadFile} disabled={loading} className="w-full bg-[#1A2A52] text-white text-sm font-semibold py-3 rounded-xl hover:bg-[#243766] disabled:opacity-50 flex items-center justify-center gap-2">
                {loading ? <><div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Processing...</> : <><Upload className="size-4"/>Upload {tab.charAt(0).toUpperCase()+tab.slice(1)}</>}
              </button>
            )}
          </div>

          {/* Instructions */}
          <div className="space-y-4">
            <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
              <p className="text-xs font-bold text-gray-700 mb-3 uppercase tracking-wide">Required Columns</p>
              <div className="space-y-1.5">
                {TEMPLATES[tab].headers.map((h,i) => (
                  <div key={h} className="flex items-center gap-2">
                    <span className={`size-4 rounded-full text-[8px] font-bold flex items-center justify-center ${i<3?"bg-[#1A2A52] text-white":"bg-gray-100 text-gray-500"}`}>{i<3?"R":"O"}</span>
                    <code className="text-[10px] font-mono text-gray-700">{h}</code>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-gray-400 mt-3"><span className="bg-[#1A2A52] text-white px-1 rounded text-[8px] font-bold">R</span> Required &nbsp;<span className="bg-gray-100 text-gray-500 px-1 rounded text-[8px] font-bold">O</span> Optional</p>
            </div>
            <div className="bg-[#1A2A52]/5 border border-[#1A2A52]/10 rounded-2xl p-4">
              <p className="text-xs font-bold text-[#1A2A52] mb-2">Tips</p>
              <ul className="space-y-1.5 text-[10px] text-gray-600">
                <li>• First row must be column headers</li>
                <li>• UTF-8 encoding recommended</li>
                <li>• Duplicate codes are skipped safely</li>
                <li>• Max 10,000 rows per upload</li>
                <li>• Download template for exact format</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
