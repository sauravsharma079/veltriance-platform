"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { Search, ShoppingCart, ExternalLink, Package, Zap, X, Check, Layers, AlertCircle } from "lucide-react";

type CatalogItem = { id:string; sku:string; name:string; unitPrice:string; currency:string; category:string|null; supplierId:string|null; supplier:{name:string}|null; unit:string|null; leadDays:number|null; description:string|null; };
type Catalog = { id:string; name:string; type:string; status:string; description:string|null; supplier:{name:string}|null; punchoutUrl:string|null; items?:CatalogItem[]; _count:{items:number}; };
type CartItem = CatalogItem & { catalogId:string; catalogName:string };

export default function CatalogsPage() {
  const [hosted, setHosted] = useState<Catalog[]>([]);
  const [punchouts, setPunchouts] = useState<Catalog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("All");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [launching, setLaunching] = useState<string|null>(null);
  const [reqSuccess, setReqSuccess] = useState("");
  const [error, setError] = useState("");
  const [quantities, setQuantities] = useState<Record<string,number>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [hr, pr] = await Promise.all([
        fetch("/api/catalogs?type=HOSTED&status=ACTIVE&includeItems=true"),
        fetch("/api/catalogs?type=PUNCHOUT&status=ACTIVE"),
      ]);
      const hd = await hr.json(); const pd = await pr.json();
      setHosted(Array.isArray(hd.catalogs) ? hd.catalogs : []);
      setPunchouts(Array.isArray(pd.catalogs) ? pd.catalogs : []);
    } catch { setHosted([]); setPunchouts([]); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get("punchoutError");
    if (err) setError(`Punchout session failed: ${err}`);
  }, []);

  const categories = useMemo(() => {
    const set = new Set<string>();
    hosted.forEach(c => (c.items ?? []).forEach(i => { if (i.category) set.add(i.category); }));
    return ["All", ...Array.from(set).sort()];
  }, [hosted]);

  const filteredItems = (catalog: Catalog) => (catalog.items ?? []).filter(item => {
    const matchSearch = !search || item.name.toLowerCase().includes(search.toLowerCase()) || item.sku.toLowerCase().includes(search.toLowerCase());
    const matchCat = catFilter === "All" || item.category === catFilter;
    return matchSearch && matchCat;
  });

  function addToCart(item: CatalogItem, catalog: Catalog) {
    setCart(c => c.some(i => i.id === item.id) ? c : [...c, { ...item, catalogId: catalog.id, catalogName: catalog.name }]);
  }

  async function createRequisition() {
    if (!cart.length) return;
    setSubmitting(true); setError("");
    try {
      const payload = {
        title: cart.length === 1 ? cart[0].name : `Catalog Order — ${cart.length} items`,
        category: cart[0].category || "General",
        priority: "MEDIUM",
        businessJustification: "Items selected from an approved hosted catalog.",
        currency: cart[0].currency || "INR",
        intakeSource: "FORM",
        lineItems: cart.map(ci => ({
          description: `${ci.name} [${ci.sku}]`,
          quantity: quantities[ci.id] || 1,
          unitPrice: Number(ci.unitPrice),
          supplierId: ci.supplierId || undefined,
          category: ci.category || undefined,
        })),
      };
      const res = await fetch("/api/intake/submit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed");
      setReqSuccess(d.requisition?.requisitionNumber || "");
      setCart([]); setShowCart(false);
    } catch (e: any) { setError(e.message); }
    setSubmitting(false);
  }

  async function launchPunchout(catalogId: string) {
    setLaunching(catalogId); setError("");
    try {
      const res = await fetch(`/api/punchout/${catalogId}/setup`, { method: "POST" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Could not start punchout session");
      window.location.href = d.redirectUrl;
    } catch (e: any) { setError(e.message); setLaunching(null); }
  }

  const cartCount = cart.reduce((s, i) => s + (quantities[i.id] || 1), 0);
  const totalCart = cart.reduce((s, i) => s + Number(i.unitPrice) * (quantities[i.id] || 1), 0);

  return (
    <div className="min-h-screen bg-[#F7F8FA]">
      <div className="bg-white border-b border-gray-100 px-8 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Catalogs & Punchout</h1>
            <p className="text-xs text-gray-400 mt-0.5">Browse hosted catalogs and launch punchout-enabled suppliers</p>
          </div>
          {cart.length > 0 && (
            <button onClick={() => setShowCart(true)} className="flex items-center gap-2 bg-[#C8A04D] text-white text-xs font-semibold px-4 py-2 rounded-xl hover:bg-[#b8903d] relative">
              <ShoppingCart className="size-3.5"/>Cart
              <span className="absolute -top-1.5 -right-1.5 size-5 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">{cartCount}</span>
            </button>
          )}
        </div>
      </div>

      {reqSuccess && (
        <div className="mx-8 mt-4 flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs px-4 py-3 rounded-xl">
          <Check className="size-4 shrink-0"/>
          Requisition <strong>{reqSuccess}</strong> created successfully! <a href="/dashboard/requisitions" className="underline ml-1">View it →</a>
          <button onClick={() => setReqSuccess("")} className="ml-auto"><X className="size-3.5"/></button>
        </div>
      )}
      {error && (
        <div className="mx-8 mt-4 flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-xs px-4 py-3 rounded-xl">
          <AlertCircle className="size-4 shrink-0"/>{error}
          <button onClick={() => setError("")} className="ml-auto"><X className="size-3.5"/></button>
        </div>
      )}

      <div className="px-8 py-6">
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label:"Hosted Catalogs", value:hosted.length, icon:Layers, color:"bg-[#1A2A52]" },
            { label:"Punchout Suppliers", value:punchouts.length, icon:Zap, color:"bg-[#C8A04D]" },
            { label:"Total Products", value:hosted.reduce((s,c)=>s+(c.items?.length||0),0), icon:Package, color:"bg-emerald-600" },
            { label:"Items in Cart", value:cartCount, icon:ShoppingCart, color:"bg-purple-600" },
          ].map(s => (
            <div key={s.label} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm flex items-center gap-3">
              <div className={`size-10 ${s.color} rounded-xl flex items-center justify-center`}><s.icon className="size-5 text-white"/></div>
              <div><p className="text-xl font-bold text-gray-900">{s.value}</p><p className="text-[10px] text-gray-400">{s.label}</p></div>
            </div>
          ))}
        </div>

        {punchouts.length > 0 && (
          <div className="mb-6">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2"><Zap className="size-3.5 text-[#C8A04D]"/>Punchout-Enabled Suppliers</p>
            <div className="grid grid-cols-3 gap-3">
              {punchouts.map(po => (
                <div key={po.id} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex items-center gap-3">
                  <div className="size-10 bg-[#C8A04D]/10 rounded-xl flex items-center justify-center shrink-0">
                    <span className="text-sm font-bold text-[#C8A04D]">{(po.supplier?.name || po.name).charAt(0)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-900 truncate">{po.name}</p>
                    <p className="text-[10px] text-gray-400">{po.supplier?.name || "—"} · cXML Punchout</p>
                  </div>
                  <button onClick={() => launchPunchout(po.id)} disabled={launching === po.id}
                    className="text-[10px] font-semibold text-[#1A2A52] flex items-center gap-1 hover:underline shrink-0 disabled:opacity-50">
                    {launching === po.id ? "Launching…" : "Launch"} <ExternalLink className="size-2.5"/>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center gap-2"><Layers className="size-3.5"/>Hosted Catalogs</p>
          <div className="flex gap-2">
            <div className="relative"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-gray-400"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search products..." className="pl-7 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg outline-none focus:border-[#1A2A52] w-48"/></div>
            <select value={catFilter} onChange={e=>setCatFilter(e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-[#1A2A52]">
              {categories.map(c=><option key={c}>{c}</option>)}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20"><div className="size-8 border-2 border-[#1A2A52]/20 border-t-[#1A2A52] rounded-full animate-spin"/></div>
        ) : hosted.length === 0 ? (
          <div className="bg-white border border-gray-100 rounded-2xl p-16 text-center shadow-sm">
            <Layers className="size-10 text-gray-200 mx-auto mb-3"/>
            <p className="text-sm text-gray-400 font-medium">No hosted catalogs yet</p>
            <p className="text-xs text-gray-400 mt-1">Ask an admin to add one under Admin → Catalogs</p>
          </div>
        ) : (
          <div className="space-y-4">
            {hosted.map(cat => {
              const items = filteredItems(cat);
              if (!items.length && (search || catFilter !== "All")) return null;
              const displayItems = search || catFilter !== "All" ? items : (cat.items ?? []);
              return (
                <div key={cat.id} className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-50 bg-gray-50/50">
                    <div className="flex items-center gap-3">
                      <div className="size-9 bg-[#1A2A52]/8 rounded-xl flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-[#1A2A52]">{(cat.supplier?.name || cat.name).charAt(0)}</span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{cat.name}</p>
                        <p className="text-[10px] text-gray-400">{cat.supplier?.name || cat.description || "—"} · {cat._count.items} products</p>
                      </div>
                    </div>
                    <span className="text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full">Active</span>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {displayItems.slice(0, 10).map(item => (
                      <div key={item.id} className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50/40 transition-colors">
                        <div className="size-8 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
                          <Package className="size-4 text-gray-400"/>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-900 truncate">{item.name}</p>
                          <p className="text-[10px] text-gray-400">{item.sku}{item.category ? ` · ${item.category}` : ""}{item.supplier ? ` · ${item.supplier.name}` : ""}{item.leadDays != null ? ` · ${item.leadDays}d lead time` : ""}</p>
                          {item.description && <p className="text-[10px] text-gray-300 truncate">{item.description}</p>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {item.unit && <span className="text-[10px] font-medium text-gray-500">{item.unit}</span>}
                          <p className="text-sm font-bold text-gray-900 w-28 text-right">{item.currency} {Number(item.unitPrice).toLocaleString()}</p>
                          <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                            <button onClick={() => setQuantities(q=>({...q,[item.id]:Math.max(1,(q[item.id]||1)-1)}))} className="px-2 py-1 text-xs text-gray-500 hover:bg-gray-50 border-r border-gray-200">−</button>
                            <span className="px-2 py-1 text-xs font-semibold text-gray-900 w-8 text-center">{quantities[item.id]||1}</span>
                            <button onClick={() => setQuantities(q=>({...q,[item.id]:(q[item.id]||1)+1}))} className="px-2 py-1 text-xs text-gray-500 hover:bg-gray-50 border-l border-gray-200">+</button>
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

      {showCart && (
        <div className="fixed inset-0 z-50 flex" onClick={e=>{if(e.target===e.currentTarget)setShowCart(false)}}>
          <div className="ml-auto w-[480px] bg-white shadow-2xl flex flex-col h-full">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-[#1A2A52]">
              <div className="flex items-center gap-2"><ShoppingCart className="size-5 text-white"/><p className="text-sm font-bold text-white">Cart ({cartCount} items)</p></div>
              <button onClick={() => setShowCart(false)} className="text-white/60 hover:text-white"><X className="size-5"/></button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
              {cart.map((item) => (
                <div key={item.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-900">{item.name}</p>
                    <p className="text-[10px] text-gray-400">{item.sku} · {item.catalogName}</p>
                    {item.supplier && <p className="text-[10px] text-gray-400">{item.supplier.name}{item.category ? ` · ${item.category}` : ""}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden bg-white">
                      <button onClick={() => setQuantities(q=>{const n=(q[item.id]||1)-1; if(n<=0){setCart(c=>c.filter(i=>i.id!==item.id));const {[item.id]:_,...rest}=q;return rest;} return {...q,[item.id]:n};})} className="px-2 py-1 text-xs hover:bg-gray-50">−</button>
                      <span className="px-2 py-1 text-xs font-semibold w-6 text-center">{quantities[item.id]||1}</span>
                      <button onClick={() => setQuantities(q=>({...q,[item.id]:(q[item.id]||1)+1}))} className="px-2 py-1 text-xs hover:bg-gray-50">+</button>
                    </div>
                    <p className="text-xs font-bold text-gray-900 w-20 text-right">{item.currency} {(Number(item.unitPrice)*(quantities[item.id]||1)).toLocaleString()}</p>
                    <button onClick={() => setCart(c=>c.filter(i=>i.id!==item.id))} className="text-gray-300 hover:text-red-400"><X className="size-3.5"/></button>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-gray-100 px-6 py-5">
              <div className="flex justify-between mb-4 text-sm font-bold text-gray-900"><span>Total</span><span>{cart[0]?.currency || "INR"} {totalCart.toLocaleString()}</span></div>
              <button onClick={createRequisition} disabled={submitting || !cart.length} className="w-full bg-[#1A2A52] text-white text-sm font-semibold py-3 rounded-xl hover:bg-[#243766] disabled:opacity-50">
                {submitting ? "Creating Requisition..." : "Create Requisition →"}
              </button>
              <p className="text-[10px] text-gray-400 text-center mt-2">Items will be submitted as a draft requisition</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
