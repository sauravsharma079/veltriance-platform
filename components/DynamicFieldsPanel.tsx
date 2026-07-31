"use client";

import { useEffect, useState } from "react";

export type CustomFieldDef = {
  id: string;
  fieldKey: string;
  name: string;
  fieldType: "TEXT" | "NUMBER" | "DATE" | "DROPDOWN" | "CHECKBOX" | "TEXTAREA";
  required: boolean;
  options: string[];
  helpText: string | null;
};

export type FieldAnswers = Record<string, string | number | boolean>;

type Props = {
  entity: "REQUISITION" | "SUPPLIER" | "PURCHASE_ORDER";
  category: string;
  answers: FieldAnswers;
  onChange: (answers: FieldAnswers) => void;
  onFieldsLoaded?: (fields: CustomFieldDef[]) => void;
};

export function DynamicFieldsPanel({ entity, category, answers, onChange, onFieldsLoaded }: Props) {
  const [fields, setFields] = useState<CustomFieldDef[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!category) { setFields([]); onFieldsLoaded?.([]); return; }
    setLoading(true);
    fetch(`/api/admin/custom-fields?entity=${entity}&category=${encodeURIComponent(category)}&active=true`)
      .then(r => r.json())
      .then(d => {
        const loaded = d.fields ?? [];
        setFields(loaded);
        onFieldsLoaded?.(loaded);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity, category]);

  if (!category) return null;
  if (loading) return <p className="text-xs text-gray-400">Loading additional fields…</p>;
  if (fields.length === 0) return null;

  function set(key: string, value: string | number | boolean) {
    onChange({ ...answers, [key]: value });
  }

  return (
    <div className="grid sm:grid-cols-2 gap-4">
      {fields.map(f => (
        <div key={f.id} className={f.fieldType === "TEXTAREA" ? "sm:col-span-2" : ""}>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            {f.name} {f.required && <span className="text-red-500">*</span>}
          </label>
          {f.fieldType === "TEXT" && (
            <input className="input" value={String(answers[f.fieldKey] ?? "")} onChange={e => set(f.fieldKey, e.target.value)} />
          )}
          {f.fieldType === "NUMBER" && (
            <input type="number" className="input" value={String(answers[f.fieldKey] ?? "")}
              onChange={e => set(f.fieldKey, e.target.value === "" ? "" : Number(e.target.value))} />
          )}
          {f.fieldType === "DATE" && (
            <input type="date" className="input" value={String(answers[f.fieldKey] ?? "")} onChange={e => set(f.fieldKey, e.target.value)} />
          )}
          {f.fieldType === "TEXTAREA" && (
            <textarea rows={3} className="input resize-none" value={String(answers[f.fieldKey] ?? "")} onChange={e => set(f.fieldKey, e.target.value)} />
          )}
          {f.fieldType === "DROPDOWN" && (
            <select className="input" value={String(answers[f.fieldKey] ?? "")} onChange={e => set(f.fieldKey, e.target.value)}>
              <option value="">— Select —</option>
              {f.options.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          )}
          {f.fieldType === "CHECKBOX" && (
            <label className="flex items-center gap-2 cursor-pointer h-[38px]">
              <input type="checkbox" checked={Boolean(answers[f.fieldKey])} onChange={e => set(f.fieldKey, e.target.checked)} />
              {f.helpText && <span className="text-xs text-gray-500">{f.helpText}</span>}
            </label>
          )}
          {f.fieldType !== "CHECKBOX" && f.helpText && (
            <p className="text-[10px] text-gray-400 mt-1">{f.helpText}</p>
          )}
        </div>
      ))}
    </div>
  );
}
