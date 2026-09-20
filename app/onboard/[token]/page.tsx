"use client";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type Field = { key: string; label: string; placeholder?: string; helpText?: string };
type Item = { key: string; label: string; group: string; status: "done" | "missing" | "invalid"; detail?: string };
type Doc = { id: string; type: string; label: string; name: string; status: string; rejectedNote: string | null; uploadedAt: string };
type Q = { fieldKey: string; name: string; fieldType: string; required: boolean; options: string[]; helpText: string | null; value: string };
type Data = {
  organization: string;
  supplier: { name: string; country: string; status: string; canEdit: boolean; submittedAt: string | null };
  countries: string[];
  requirements: { taxFields: Field[]; bankFields: Field[]; docs: { type: string; label: string; required: boolean }[] };
  profile: Record<string, string | boolean>;
  documents: Doc[];
  declarations: { defs: { key: string; label: string; negative?: boolean }[]; values: Record<string, boolean | null> };
  questions: Q[];
  checklist: { items: Item[]; percent: number; missing: Item[]; readyForReview: boolean };
};
const input = "w-full text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white disabled:bg-gray-50";
const btn = "text-sm px-4 py-2 rounded-lg disabled:opacity-50";
const card = "bg-white border border-gray-300 rounded-xl p-6 space-y-4";

export default function OnboardPage() {
  const { token } = useParams<{ token: string }>();
  const [d, setD] = useState<Data | null>(null);
  const [gone, setGone] = useState(false);
  const [form, setForm] = useState<Record<string, string | boolean>>({});
  const [country, setCountry] = useState("");
  const [decl, setDecl] = useState<Record<string, boolean | null>>({});
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [inited, setInited] = useState(false);

  const load = useCallback(async (reset = false) => {
    const res = await fetch(`/api/public/onboarding/${token}`);
    if (!res.ok) { setGone(true); return; }
    const data: Data = await res.json();
    setD(data);
    if (!inited || reset) { setForm(data.profile); setCountry(data.supplier.country); setDecl(data.declarations.values); setAnswers(Object.fromEntries(data.questions.map(q => [q.fieldKey, String(q.value ?? "")]))); setInited(true); }
  }, [token, inited]);
  useEffect(() => { load(); }, [load]);

  async function post(key: string, payload: object, okText: string) {
    setBusy(key); setMsg(null);
    const res = await fetch(`/api/public/onboarding/${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const r = await res.json().catch(() => null);
    setBusy(null);
    if (!res.ok) { setMsg({ ok: false, text: r?.error ?? "That didn't work" }); return false; }
    setMsg({ ok: true, text: okText }); await load(); return true;
  }
  async function upload(type: string, file: File, expiry: string) {
    setBusy(`up-${type}`); setMsg(null);
    const fd = new FormData(); fd.append("file", file); fd.append("type", type); if (expiry) fd.append("expiryDate", expiry);
    const res = await fetch(`/api/public/onboarding/${token}/documents`, { method: "POST", body: fd });
    const r = await res.json().catch(() => null);
    setBusy(null);
    if (!res.ok) { setMsg({ ok: false, text: r?.error ?? "The upload failed" }); return; }
    setMsg({ ok: true, text: r?.scan?.passed === false ? `Uploaded, but our automated check flagged it: ${r.scan.notes.join(" ")}` : "Document uploaded." }); await load();
  }

  if (gone) return <Shell><h1 className="text-lg font-semibold text-gray-900">This link isn&apos;t valid any more</h1><p className="text-sm text-gray-500 mt-2">It may have been replaced by a newer one. Please use the most recent email you received, or ask the sender for a fresh link.</p></Shell>;
  if (!d) return <Shell><p className="text-sm text-gray-400">Loading…</p></Shell>;

  const edit = d.supplier.canEdit;
  const { checklist: cl, requirements: rq } = d;
  const str = (k: string) => String(form[k] ?? "");
  const setF = (k: string, v: string | boolean) => setForm(f => ({ ...f, [k]: v }));
  // A plain function returning JSX, not a component: a component defined here would be re-created on every
  // keystroke, remounting the input and dropping focus after each character typed.
  const fieldEl = (f: Field) => <label key={f.key} className="block text-xs text-gray-500">{f.label}<input disabled={!edit} value={str(f.key)} placeholder={f.placeholder} onChange={e => setF(f.key, e.target.value)} className={input} />{f.helpText && <span className="text-[11px] text-gray-400">{f.helpText}</span>}</label>;
  const fieldStatus = (key: string) => cl.items.find(i => i.key === key);
  const detailsPayload = { action: "save_details", country, fields: form };

  return (
    <Shell>
      <p className="text-xs text-gray-400">{d.organization}</p>
      <h1 className="text-xl font-semibold text-gray-900">Supplier onboarding — {d.supplier.name}</h1>
      <p className="text-sm text-gray-500 mt-1">Please complete the sections below. You can save and come back any time using this same link.</p>

      <div className="mt-5 bg-white border border-gray-300 rounded-xl p-4">
        <div className="flex items-center justify-between text-xs text-gray-500"><span>{cl.percent}% complete</span><span>{cl.missing.length === 0 ? "Everything required is in" : `${cl.missing.length} item${cl.missing.length > 1 ? "s" : ""} left`}</span></div>
        <div className="h-2 bg-gray-100 rounded-full mt-2 overflow-hidden"><div className="h-full bg-[#1A2A52] transition-all" style={{ width: `${cl.percent}%` }} /></div>
        {cl.missing.length > 0 && <ul className="mt-3 text-xs text-gray-600 grid sm:grid-cols-2 gap-x-6 gap-y-1">{cl.missing.map(m => <li key={m.key}><span className={m.status === "invalid" ? "text-red-600" : "text-amber-600"}>●</span> {m.label}{m.detail ? <span className="text-gray-400"> — {m.detail}</span> : ""}</li>)}</ul>}
      </div>

      {d.supplier.status === "ACTIVE" && <div className="mt-4 text-sm px-4 py-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800">You&apos;re approved as a supplier — thank you. There&apos;s nothing more to complete.</div>}
      {edit && d.supplier.submittedAt && <div className="mt-4 text-sm px-4 py-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-800">Submitted on {new Date(d.supplier.submittedAt).toLocaleDateString()} — {d.organization} is reviewing it. You can still make changes if they ask.</div>}
      {msg && <div className={`mt-4 text-sm px-4 py-3 rounded-lg border ${msg.ok ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-red-50 border-red-200 text-red-700"}`}>{msg.text}</div>}

      <div className="mt-6 space-y-5">
        <section className={card}>
          <h2 className="text-sm font-semibold text-gray-900">1. Company, tax &amp; bank details</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block text-xs text-gray-500">Country of registration<select disabled={!edit} value={country} onChange={e => setCountry(e.target.value)} className={input}>{d.countries.map(c => <option key={c}>{c}</option>)}</select><span className="text-[11px] text-gray-400">Save after changing — the tax and document requirements depend on it.</span></label>
            <label className="block text-xs text-gray-500">Legal company name<input disabled={!edit} value={str("legalName")} onChange={e => setF("legalName", e.target.value)} className={input} /></label>
            <label className="block text-xs text-gray-500">Type of business<select disabled={!edit} value={str("businessType")} onChange={e => setF("businessType", e.target.value)} className={input}><option value="">Select…</option>{["Private Limited Company", "Public Limited Company", "Partnership / LLP", "Sole Proprietorship", "Other"].map(t => <option key={t}>{t}</option>)}</select></label>
            {rq.taxFields.map(fieldEl)}
          </div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide pt-2">Bank</h3>
          <div className="grid sm:grid-cols-2 gap-3">{rq.bankFields.map(fieldEl)}{fieldEl({ key: "beneficiaryName", label: "Account holder name" })}</div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide pt-2">Registered address</h3>
          <div className="grid sm:grid-cols-2 gap-3">{fieldEl({ key: "regAddressLine1", label: "Address" })}{fieldEl({ key: "regCity", label: "City" })}{fieldEl({ key: "regState", label: "State / region" })}{fieldEl({ key: "regPostal", label: "Postal code" })}</div>
          <div className="flex flex-wrap gap-4 text-xs text-gray-600 pt-1">{[["womenOwned", "Women-owned"], ["minorityOwned", "Minority-owned"], ["smallBusiness", "Small business"]].map(([k, l]) => <label key={k} className="flex items-center gap-1.5"><input disabled={!edit} type="checkbox" checked={!!form[k]} onChange={e => setF(k, e.target.checked)} />{l}</label>)}</div>
          {edit && <button disabled={!!busy} onClick={() => post("details", detailsPayload, "Details saved.")} className={`${btn} bg-[#1A2A52] text-white`}>{busy === "details" ? "Saving…" : "Save details"}</button>}
        </section>

        <section className={card}>
          <h2 className="text-sm font-semibold text-gray-900">2. Documents</h2>
          <p className="text-xs text-gray-500">PDF, JPG or PNG, up to 10&nbsp;MB each.</p>
          <div className="divide-y divide-gray-100">
            {rq.docs.map(doc => {
              const mine = d.documents.filter(x => x.type === doc.type);
              const it = fieldStatus(`doc:${doc.type}`);
              return (
                <div key={doc.type} className="py-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-gray-900">{doc.label} {doc.required ? <span className="text-[10px] text-red-500">required</span> : <span className="text-[10px] text-gray-400">optional</span>}</p>
                    {mine.map(x => <p key={x.id} className="text-xs text-gray-500">{x.name} · <span className={x.status === "REJECTED" ? "text-red-600" : x.status === "VERIFIED" ? "text-emerald-600" : "text-gray-500"}>{x.status.toLowerCase()}</span>{x.rejectedNote ? ` — ${x.rejectedNote}` : ""}</p>)}
                    {it?.status === "invalid" && it.detail && <p className="text-xs text-red-600">{it.detail}</p>}
                  </div>
                  {edit && <UploadButton busy={busy === `up-${doc.type}`} label={mine.length ? "Upload another" : "Upload"} onFile={(f, exp) => upload(doc.type, f, exp)} />}
                </div>
              );
            })}
          </div>
        </section>

        <section className={card}>
          <h2 className="text-sm font-semibold text-gray-900">3. Risk &amp; compliance declarations</h2>
          {d.declarations.defs.map(x => (
            <div key={x.key} className="flex items-center justify-between gap-4 text-sm text-gray-700">
              <span>{x.label}</span>
              <span className="flex gap-4 shrink-0">{[true, false].map(v => <label key={String(v)} className="flex items-center gap-1"><input disabled={!edit} type="radio" name={x.key} checked={decl[x.key] === v} onChange={() => setDecl({ ...decl, [x.key]: v })} />{v ? "Yes" : "No"}</label>)}</span>
            </div>
          ))}
          <p className="text-[11px] text-gray-400">These are your own statements and may be checked. Please answer honestly.</p>
          {edit && <button disabled={!!busy || Object.values(decl).some(v => v === null)} onClick={() => post("decl", { action: "save_declarations", values: Object.fromEntries(Object.entries(decl).filter(([, v]) => v !== null)) }, "Declarations saved.")} className={`${btn} bg-[#1A2A52] text-white`}>{busy === "decl" ? "Saving…" : "Save declarations"}</button>}
        </section>

        {d.questions.length > 0 && (
          <section className={card}>
            <h2 className="text-sm font-semibold text-gray-900">4. Additional questions</h2>
            {d.questions.map(q => (
              <label key={q.fieldKey} className="block text-xs text-gray-600">{q.name}{q.required && <span className="text-red-500"> *</span>}
                {q.options?.length ? <select disabled={!edit} value={answers[q.fieldKey] ?? ""} onChange={e => setAnswers({ ...answers, [q.fieldKey]: e.target.value })} className={input}><option value="">Select…</option>{q.options.map(o => <option key={o}>{o}</option>)}</select>
                  : <input disabled={!edit} value={answers[q.fieldKey] ?? ""} onChange={e => setAnswers({ ...answers, [q.fieldKey]: e.target.value })} className={input} />}
                {q.helpText && <span className="text-[11px] text-gray-400">{q.helpText}</span>}</label>
            ))}
            {edit && <button disabled={!!busy} onClick={() => post("ans", { action: "save_answers", answers }, "Answers saved.")} className={`${btn} bg-[#1A2A52] text-white`}>{busy === "ans" ? "Saving…" : "Save answers"}</button>}
          </section>
        )}

        {edit && (
          <section className={card}>
            <h2 className="text-sm font-semibold text-gray-900">Submit for review</h2>
            <p className="text-xs text-gray-500">{cl.readyForReview ? "Everything required is in. Submit so the team can review it." : "Complete the items listed at the top first."}</p>
            <button disabled={!!busy || !cl.readyForReview || !!d.supplier.submittedAt} onClick={() => post("submit", { action: "submit" }, "Thank you — your onboarding has been submitted for review.")} className={`${btn} bg-emerald-700 text-white`}>{d.supplier.submittedAt ? "Submitted" : busy === "submit" ? "Submitting…" : "Submit onboarding"}</button>
          </section>
        )}
      </div>
    </Shell>
  );
}

function UploadButton({ label, busy, onFile }: { label: string; busy: boolean; onFile: (f: File, expiry: string) => void }) {
  const [expiry, setExpiry] = useState("");
  return (
    <div className="flex items-center gap-2">
      <input type="date" value={expiry} onChange={e => setExpiry(e.target.value)} title="Expiry date, if the document has one" className="text-xs border border-gray-300 rounded-lg px-2 py-1.5" />
      <label className={`text-xs px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 cursor-pointer hover:bg-gray-50 ${busy ? "opacity-50 pointer-events-none" : ""}`}>{busy ? "Uploading…" : label}
        <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f, expiry); e.target.value = ""; }} /></label>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-[#F7F8FA]"><div className="max-w-3xl mx-auto px-5 py-10">{children}<p className="mt-10 text-[11px] text-gray-300">Secured by Veltriance</p></div></div>;
}
