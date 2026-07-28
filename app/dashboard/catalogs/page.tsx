"use client";
import { useState, useEffect, useCallback } from "react";
import { Search, Plus, ShoppingCart, ExternalLink, Package, Zap, ChevronRight, X, Check, Building2, Tag, Layers, Star, Filter } from "lucide-react";

type CatalogItem = { sku:string; name:string; unitPrice:number; currency:string; category:string; gl:string; unit:string; leadDays:number; description:string; };
type Catalog = { id:string; name:string; type:string; status:string; provider:string; config:{ description:string; supplierId:string|null; supplierName:string; punchoutUrl:string|null; protocol:string; items:CatalogItem[]; }; };
type CartItem = CatalogItem & { catalogId:string; catalogName:string; supplierName:string; quantity:number; };

const CATS = ["All","IT Hardware","Software & Licenses","Cloud Services","Facilities & Infra","Office Supplies"];
const GL_MAP: Record<string,string> = {"IT Hardware":"6100","Software & Licenses":"6200","Cloud Services":"6300","Professional Services":"6400","Facilities & Infra":"6500","Office Supplies":"6600"};

export default function CatalogsPage() {
  const [catalogs, setCatalogs] = useState<Catalog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Catalog|null>(null);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ name:"", type:"HOSTED_CATALOG", supplierId:"", supplierName:"", description:"", punchoutUrl:"", protocol:"cXML" });
  const [suppliers, setSuppliers] = useState<{id:string;name:string}[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [reqSuccess, setReqSuccess] = useState("");
  const [quantities, setQuantities] = useState<Record<string,number>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cr, sr] = await Promise.all([fetch("/api/catalogs"), fetch("/api/suppliers?status=ACTIVE")]);
      const cd = await cr.json(); const sd = await sr.json();
      setCatalogs(Array.isArray(cd.catalogs) ? cd.catalogs : []);
      setSuppliers(Array.isArray(sd.suppliers) ? sd.suppliers : []);
    } catch { setCatalogs([]); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const hosted = catalogs.filter(c => c.type === "HOSTED_CATALOG");
  const punchouts = catalogs.filter(c => c.type === "PUNCHOUT");

  const filteredItems = (catalog: Catalog) => {
    return (catalog.config?.items || []).filter(item => {
      const matchSearch = !search || item.name.toLowerCase().includes(search.toLowerCase()) || item.sku?.toLowerCase().includes(search.toLowerCase()) || item.description?.toLowerCase().includes(search.toLowerCase());
      const matchCat = catFilter === "All" || item.category === catFilter;
      return matchSearch && matchCat;
    });
  };

  function addToCart(item: CatalogItem, catalog: Catalog) {
    const qty = quantities[item.sku] || 1;
    setCart(c => {
      const ex = c.findIndex(i => i.sku === item.sku && i.catalogId === catalog.id);
      if (ex >= 0) { const n=[...c]; n[ex].quantity+=qty; return n; }
      return [...c, { ...item, catalogId: catalog.id, catalogName: catalog.name, supplierName: catalog.config?.supplierName||"", quantity: qty }];
    });
    setQuantities(q => ({ ...q, [item.sku]: 1 }));
  }

  async function createRequisition() {
    if (!cart.length) return;
    setSubmitting(true);
    try {
      const payload = {
        title: cart.length === 1 ? cart[0].name : `Catalog Order — ${cart.length} items`,
        category: cart[0].category,
        priority: "MEDIUM", department: "Engineering",
        businessJustification: "Items selected from approved supplier catalogs.",
        deliveryLocation: "Ace HQ — Bengaluru",
        currency: "INR", intakeSource: "CATALOG",
        lineItems: cart.map(ci => ({
          description: `${ci.name} [${ci.sku}]`,
          quantity: ci.quantity, unitPrice: ci.unitPrice,
          supplierId: catalogs.find(c=>c.id===ci.catalogId)?.config?.supplierId || undefined,
          glAccount: ci.gl || GL_MAP[ci.category] || "6100",
          category: ci.category,
        })),
      };
      const res = await fetch("/api/intake/submit", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(payload) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed");
      setReqSuccess(d.requisition?.requisitionNumber || "REQ-NEW");
      setCart([]); setShowCart(false);
    } catch (e: any) { alert("Failed: " + e.message); }
    setSubmitting(false);
  }

  async function createCatalog() {
    if (!addForm.name) return;
    setSubmitting(true);
    try {
      const sup = suppliers.find(s => s.id === addForm.supplierId);
      const res = await fetch("/api/catalogs", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ ...addForm, supplierName: sup?.name || addForm.supplierName, items:[] }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setShowAdd(false); setAddForm({ name:"", type:"HOSTED_CATALOG", supplierId:"", supplierName:"", description:"", punchoutUrl:"", protocol:"cXML" });
      load();
    } catch (e: any) { alert(e.message); }
    setSubmitting(false);
  }

  const totalCart = cart.reduce((s,i) => s+i.unitPrice*i.quantity, 0);

  return (
    <div className="min-h-screen bg-[#F7F8FA]">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-8 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Catalogs & Punchout</h1>
            <p className="text-xs text-gray-400 mt-0.5">Browse hosted catalogs and punchout-enabled suppliers</p>
          </div>
          <div className="flex items-center gap-3">
            {cart.length > 0 && (
              <button onClick={() => setShowCart(true)} className="flex items-center gap-2 bg-[#C8A04D] text-white text-xs font-semibold px-4 py-2 rounded-xl hover:bg-[#b8903d] relative">
                <ShoppingCart className="size-3.5"/>Cart
                <span className="absolute -top-1.5 -right-1.5 size-5 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">{cart.reduce((s,i)=>s+i.quantity,0)}</span>
              </button>
            )}
            <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 bg-[#1A2A52] text-white text-xs font-semibold px-4 py-2 rounded-xl hover:bg-[#243766]">
              <Plus className="size-3.5"/>Add Catalog
            </button>
          </div>
        </div>
      </div>

      {reqSuccess && (
        <div className="mx-8 mt-4 flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs px-4 py-3 rounded-xl">
          <Check className="size-4 shrink-0"/>
          Requisition <strong>{reqSuccess}</strong> created successfully! <a href="/dashboard/requisitions" className="underline ml-1">View it →</a>
          <button onClick={() => setReqSuccess("")} className="ml-auto"><X className="size-3.5"/></button>
        </div>
      )}

      <div className="px-8 py-6">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label:"Hosted Catalogs", value:hosted.length, icon:Layers, color:"bg-[#1A2A52]" },
            { label:"Punchout Suppliers", value:punchouts.length, icon:Zap, color:"bg-[#C8A04D]" },
            { label:"Total Products", value:hosted.reduce((s,c)=>s+(c.config?.items?.length||0),0), icon:Package, color:"bg-emerald-600" },
            { label:"Items in Cart", value:cart.reduce((s,i)=>s+i.quantity,0), icon:ShoppingCart, color:"bg-purple-600" },
          ].map(s => (
            <div key={s.label} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm flex items-center gap-3">
              <div className={`size-10 ${s.color} rounded-xl flex items-center justify-center`}><s.icon className="size-5 text-white"/></div>
              <div><p className="text-xl font-bold text-gray-900">{s.value}</p><p className="text-[10px] text-gray-400">{s.label}</p></div>
            </div>
          ))}
        </div>

        {/* Punchout Suppliers */}
        {punchouts.length > 0 && (
          <div className="mb-6">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2"><Zap className="size-3.5 text-[#C8A04D]"/>Punchout-Enabled Suppliers</p>
            <div className="grid grid-cols-3 gap-3">
              {punchouts.map(po => (
                <div key={po.id} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex items-center gap-3">
                  <div className="size-10 bg-[#C8A04D]/10 rounded-xl flex items-center justify-center shrink-0">
                    <span className="text-sm font-bold text-[#C8A04D]">{po.config?.supplierName?.charAt(0)||"?"}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-900 truncate">{po.config?.supplierName}</p>
                    <p className="text-[10px] text-gray-400">{po.provider} · Punchout</p>
                    <p className="text-[10px] text-gray-300 truncate">{po.config?.punchoutUrl}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">Active</span>
                    <button
                      onClick={() => { const url = po.config?.punchoutUrl; if(url) { window.open(url, "_blank"); } else { alert("Punchout URL not configured for " + po.config?.supplierName); } }}
                      className="text-[10px] font-semibold text-[#1A2A52] flex items-center gap-1 hover:underline">
                      Launch <ExternalLink className="size-2.5"/>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Hosted Catalog Browser */}
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center gap-2"><Layers className="size-3.5"/>Hosted Catalogs</p>
          <div className="flex gap-2">
            <div className="relative"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-gray-400"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search products..." className="pl-7 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg outline-none focus:border-[#1A2A52] w-48"/></div>
            <select value={catFilter} onChange={e=>setCatFilter(e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-[#1A2A52]">
              {CATS.map(c=><option key={c}>{c}</option>)}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20"><div className="size-8 border-2 border-[#1A2A52]/20 border-t-[#1A2A52] rounded-full animate-spin"/></div>
        ) : hosted.length === 0 ? (
          <div className="bg-white border border-gray-100 rounded-2xl p-16 text-center shadow-sm">
            <Layers className="size-10 text-gray-200 mx-auto mb-3"/>
            <p className="text-sm text-gray-400 font-medium">No hosted catalogs yet</p>
            <button onClick={() => setShowAdd(true)} className="mt-3 text-xs text-[#1A2A52] font-semibold hover:underline">Add your first catalog →</button>
          </div>
        ) : (
          <div className="space-y-4">
            {hosted.map(cat => {
              const items = filteredItems(cat);
              if (!items.length && (search || catFilter !== "All")) return null;
              return (
                <div key={cat.id} className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-50 bg-gray-50/50">
                    <div className="flex items-center gap-3">
                      <div className="size-9 bg-[#1A2A52]/8 rounded-xl flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-[#1A2A52]">{cat.config?.supplierName?.charAt(0)||"?"}</span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{cat.name}</p>
                        <p className="text-[10px] text-gray-400">{cat.config?.supplierName} · {cat.config?.items?.length||0} products</p>
                      </div>
                    </div>
                    <span className="text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full">Active</span>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {(search || catFilter !== "All" ? items : cat.config?.items||[]).slice(0,10).map(item => (
                      <div key={item.sku} className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50/40 transition-colors">
                        <div className="size-8 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
                          <Package className="size-4 text-gray-400"/>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-900 truncate">{item.name}</p>
                          <p className="text-[10px] text-gray-400">{item.sku} · {item.category} · GL: {item.gl} · {item.leadDays}d lead time</p>
                          {item.description && <p className="text-[10px] text-gray-300 truncate">{item.description}</p>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] font-medium text-gray-500">{item.unit}</span>
                          <p className="text-sm font-bold text-gray-900 w-24 text-right">₹{Number(item.unitPrice).toLocaleString("en-IN")}</p>
                          <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                            <button onClick={() => setQuantities(q=>({...q,[item.sku]:Math.max(1,(q[item.sku]||1)-1)})) } className="px-2 py-1 text-xs text-gray-500 hover:bg-gray-50 border-r border-gray-200">−</button>
                            <span className="px-2 py-1 text-xs font-semibold text-gray-900 w-8 text-center">{quantities[item.sku]||1}</span>
                            <button onClick={() => setQuantities(q=>({...q,[item.sku]:(q[item.sku]||1)+1}))} className="px-2 py-1 text-xs text-gray-500 hover:bg-gray-50 border-l border-gray-200">+</button>
                          </div>
                          <button onClick={() => addToCart(item, cat)} className="flex items-center gap-1 text-[11px] font-semibold bg-[#1A2A52] text-white px-3 py-1.5 rounded-lg hover:bg-[#243766]">
                            <ShoppingCart className="size-3"/>Add
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Cart Panel */}
      {showCart && (
        <div className="fixed inset-0 z-50 flex" onClick={e=>{if(e.target===e.currentTarget)setShowCart(false)}}>
          <div className="ml-auto w-[480px] bg-white shadow-2xl flex flex-col h-full">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-[#1A2A52]">
              <div className="flex items-center gap-2"><ShoppingCart className="size-5 text-white"/><p className="text-sm font-bold text-white">Cart ({cart.reduce((s,i)=>s+i.quantity,0)} items)</p></div>
              <button onClick={() => setShowCart(false)} className="text-white/60 hover:text-white"><X className="size-5"/></button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
              {cart.map((item, idx) => (
                <div key={idx} className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-900">{item.name}</p>
                    <p className="text-[10px] text-gray-400">{item.sku} · {item.supplierName}</p>
                    <p className="text-[10px] text-gray-400">GL: {item.gl} · {item.category}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden bg-white">
                      <button onClick={() => setCart(c=>{const n=[...c];if(n[idx].quantity<=1){n.splice(idx,1);}else{n[idx].quantity--;}return n;})} className="px-2 py-1 text-xs hover:bg-gray-50">−</button>
                      <span className="px-2 py-1 text-xs font-semibold w-6 text-center">{item.quantity}</span>
                      <button onClick={() => setCart(c=>{const n=[...c];n[idx].quantity++;return n;})} className="px-2 py-1 text-xs hover:bg-gray-50">+</button>
                    </div>
                    <p className="text-xs font-bold text-gray-900 w-20 text-right">₹{(item.unitPrice*item.quantity).toLocaleString("en-IN")}</p>
                    <button onClick={() => setCart(c=>c.filter((_,i)=>i!==idx))} className="text-gray-300 hover:text-red-400"><X className="size-3.5"/></button>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-gray-100 px-6 py-5">
              <div className="flex justify-between mb-1 text-xs text-gray-500"><span>Subtotal</span><span>₹{totalCart.toLocaleString("en-IN")}</span></div>
              <div className="flex justify-between mb-4 text-xs text-gray-500"><span>GST (18%)</span><span>₹{(totalCart*0.18).toLocaleString("en-IN")}</span></div>
              <div className="flex justify-between mb-5 text-sm font-bold text-gray-900"><span>Total</span><span>₹{(totalCart*1.18).toLocaleString("en-IN")}</span></div>
              <button onClick={createRequisition} disabled={submitting || !cart.length} className="w-full bg-[#1A2A52] text-white text-sm font-semibold py-3 rounded-xl hover:bg-[#243766] disabled:opacity-50">
                {submitting ? "Creating Requisition..." : "Create Requisition →"}
              </button>
              <p className="text-[10px] text-gray-400 text-center mt-2">Items will be submitted for manager approval</p>
            </div>
          </div>
        </div>
      )}

      {/* Add Catalog Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-[520px]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-900">Add Catalog or Punchout</h3>
              <button onClick={() => setShowAdd(false)} className="text-gray-400 hover:text-gray-600"><X className="size-4"/></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Type *</label>
                <div className="grid grid-cols-2 gap-2">
                  {[["HOSTED_CATALOG","Hosted Catalog","Upload product list"],["PUNCHOUT","Punchout","Redirect to supplier"]].map(([val,label,desc]) => (
                    <button key={val} onClick={() => setAddForm(f=>({...f,type:val}))} className={`p-3 rounded-xl border-2 text-left transition-all ${addForm.type===val?"border-[#1A2A52] bg-[#1A2A52]/5":"border-gray-200 hover:border-gray-300"}`}>
                      <p className="text-xs font-semibold text-gray-900">{label}</p>
                      <p className="text-[10px] text-gray-400">{desc}</p>
                    </button>
                  ))}
                </div>
              </div>
              <div><label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Catalog Name *</label><input value={addForm.name} onChange={e=>setAddForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Lenovo IT Hardware Catalog" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#1A2A52]"/></div>
              <div><label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Supplier</label>
                <select value={addForm.supplierId} onChange={e=>{const s=suppliers.find(x=>x.id===e.target.value);setAddForm(f=>({...f,supplierId:e.target.value,supplierName:s?.name||""}));}} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#1A2A52]">
                  <option value="">Select supplier...</option>
                  {suppliers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div><label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Description</label><input value={addForm.description} onChange={e=>setAddForm(f=>({...f,description:e.target.value}))} placeholder="Brief description of this catalog" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#1A2A52]"/></div>
              {addForm.type==="PUNCHOUT" && (<>
                <div><label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Punchout URL *</label><input value={addForm.punchoutUrl} onChange={e=>setAddForm(f=>({...f,punchoutUrl:e.target.value}))} placeholder="https://supplier.com/cxml/punchout" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#1A2A52]"/></div>
                <div><label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Protocol</label>
                  <select value={addForm.protocol} onChange={e=>setAddForm(f=>({...f,protocol:e.target.value}))} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#1A2A52]">
                    <option>cXML</option><option>OCI</option><option>REST</option>
                  </select>
                </div>
              </>)}
            </div>
            <div className="flex gap-3 px-6 pb-5">
              <button onClick={createCatalog} disabled={submitting||!addForm.name} className="flex-1 bg-[#1A2A52] text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-[#243766] disabled:opacity-50">{submitting?"Creating...":"Create"}</button>
              <button onClick={() => setShowAdd(false)} className="px-5 py-2.5 text-sm text-gray-500 border border-gray-200 rounded-xl">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
