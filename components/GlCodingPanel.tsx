"use client";

import { useEffect, useState } from "react";
import { Link2 } from "lucide-react";

type CoaSegmentValue = { id: string; code: string; description: string };
type CoaSegmentDef = {
  id: string; position: number; name: string; isRequired: boolean;
  linkedLookupType: string | null;
  values: CoaSegmentValue[];
};
type Coa = { id: string; name: string; code: string; companyCode: string | null; currency: string; segments: CoaSegmentDef[] };
type LookupValue = { type: string; code: string; label: string };
type GlCoding = Record<string, string>;

type Props = {
  chartOfAccountId: string;
  glCoding: GlCoding;
  // currency is passed alongside the id so callers can adopt the COA's own
  // currency (e.g. an India entity's COA is INR) instead of a fixed default.
  onCoaChange: (coaId: string, currency?: string) => void;
  onCodingChange: (coding: GlCoding) => void;
  compact?: boolean;
};

export function GlCodingPanel({ chartOfAccountId, glCoding, onCoaChange, onCodingChange, compact }: Props) {
  const [coas, setCoas] = useState<Coa[]>([]);
  const [lookupValues, setLookupValues] = useState<LookupValue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/coa")
      .then(r => r.json())
      .then(d => {
        setCoas(d.coas ?? []);
        setLookupValues(d.lookupValues ?? []);
        setLoading(false);
      });
  }, []);

  const selected = coas.find(c => c.id === chartOfAccountId);

  // Build the account string preview
  const accountParts = selected?.segments.map(s => glCoding[String(s.position)] ?? null).filter(Boolean) ?? [];
  const accountString = accountParts.join(" - ");

  if (loading) return <p className="text-xs text-gray-400">Loading chart of accounts…</p>;
  if (coas.length === 0) return (
    <p className="text-xs text-gray-400 italic">
      No charts of accounts configured. Ask your admin to set one up under Admin → Chart of accounts.
    </p>
  );

  return (
    <div className="space-y-3">
      {/* COA selector */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Chart of accounts</label>
        <select
          value={chartOfAccountId}
          onChange={e => { onCoaChange(e.target.value, coas.find(c => c.id === e.target.value)?.currency); onCodingChange({}); }}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#1A2A52]"
        >
          <option value="">— Select COA —</option>
          {coas.map(c => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.code}){c.companyCode ? ` · ${c.companyCode}` : ""}
            </option>
          ))}
        </select>
      </div>

      {/* Segment dropdowns */}
      {selected && selected.segments.length > 0 && (
        <div className={compact ? "grid grid-cols-2 gap-2" : "grid sm:grid-cols-3 gap-3"}>
          {selected.segments.map(seg => {
            // Decide where values come from: linked lookup or own CoaSegmentValues
            const options: { code: string; label: string }[] = seg.linkedLookupType
              ? lookupValues
                  .filter(l => l.type === seg.linkedLookupType)
                  .map(l => ({ code: l.code, label: `${l.code} — ${l.label}` }))
              : seg.values.map(v => ({ code: v.code, label: `${v.code} — ${v.description}` }));

            return (
              <div key={seg.id}>
                <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
                  {seg.name}
                  {seg.linkedLookupType && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] text-[#0D9488] bg-teal-50 px-1.5 rounded-full">
                      <Link2 className="size-2.5" /> {seg.linkedLookupType}
                    </span>
                  )}
                  {seg.isRequired && <span className="text-red-500">*</span>}
                </label>
                <select
                  value={glCoding[String(seg.position)] ?? ""}
                  onChange={e => onCodingChange({ ...glCoding, [String(seg.position)]: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#1A2A52]"
                >
                  <option value="">— Select —</option>
                  {options.map(o => (
                    <option key={o.code} value={o.code}>{o.label}</option>
                  ))}
                  {options.length === 0 && (
                    <option disabled value="">No values — add them in Admin → {seg.linkedLookupType ? "Lookups" : "COA"}</option>
                  )}
                </select>
              </div>
            );
          })}
        </div>
      )}

      {/* Account string preview */}
      {accountString && (
        <div className="bg-[#1A2A52]/5 border border-[#1A2A52]/15 rounded-lg px-3 py-2">
          <p className="text-[10px] text-gray-500 mb-0.5">Account string</p>
          <p className="font-mono text-sm font-semibold text-[#1A2A52]">{accountString}</p>
        </div>
      )}
    </div>
  );
}
