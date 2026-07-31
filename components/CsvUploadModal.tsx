"use client";
import { useState, useRef, useCallback } from "react";
import { Upload, X, CheckCircle, AlertCircle, Download, FileText } from "lucide-react";

export type CsvUploadConfig = {
  title: string;
  description: string;
  endpoint: string;
  extraBody?: Record<string, any>;
  headers: string[];
  requiredHeaders: string[];
  exampleRows: string[][];
  templateName: string;
};

type Result = { created?:number; updated?:number; skipped?:number; errors?:string[]; total?:number; message?:string; };

function parseCSV(text: string): Record<string,string>[] {
  const NL = String.fromCharCode(10);
  const CR = String.fromCharCode(13);
  const cleaned = text.replace(new RegExp(CR + NL, "g"), NL).replace(new RegExp(CR, "g"), NL);
  const lines = cleaned.trim().split(NL).map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.replace(/^"|"$/g, "").trim());
  return lines.slice(1).map(line => {
    const cols: string[] = [];
    let cur = "", inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQ = !inQ; continue; }
      if (ch === "," && !inQ) { cols.push(cur); cur = ""; continue; }
      cur += ch;
    }
    cols.push(cur);
    const obj: Record<string,string> = {};
    headers.forEach((h, i) => { obj[h] = (cols[i] ?? "").trim(); });
    return obj;
  });
}

export default function CsvUploadModal({
  config,
  onClose,
  onSuccess,
}: {
  config: CsvUploadConfig;
  onClose: () => void;
  onSuccess?: (result: Result) => void;
}) {
  const [file, setFile] = useState<File|null>(null);
  const [preview, setPreview] = useState<Record<string,string>[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [result, setResult] = useState<Result|null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  function processFile(f: File) {
    setFile(f); setResult(null); setError("");
    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target?.result as string;
      const rows = parseCSV(text);
      setTotalRows(rows.length);
      setPreview(rows.slice(0, 3));
    };
    reader.readAsText(f);
  }

  function downloadTemplate() {
    const NL = String.fromCharCode(10);
    const rows = [
      config.headers.join(","),
      ...config.exampleRows.map(r => r.map(v => v.includes(",") ? `"${v}"` : v).join(",")),
    ].join(NL);
    const blob = new Blob([rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = config.templateName + ".csv"; a.click();
    URL.revokeObjectURL(url);
  }

  async function upload() {
    if (!file) return;
    setLoading(true); setError(""); setResult(null);
    try {
      const text = await file.text();
      const rows = parseCSV(text);
      if (rows.length === 0) { setError("No valid rows found. Check CSV format."); setLoading(false); return; }
      const res = await fetch(config.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows, ...config.extraBody }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Upload failed");
      setResult(d);
      onSuccess?.(d);
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  }

  const allHeaders = config.headers;
  const previewHeaders = preview.length > 0 ? Object.keys(preview[0]).slice(0, 6) : allHeaders.slice(0, 6);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-[680px] max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h3 className="text-sm font-bold text-gray-900">{config.title}</h3>
            <p className="text-[11px] text-gray-400 mt-0.5">{config.description}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={downloadTemplate}
              className="flex items-center gap-1.5 text-xs font-medium text-[#1A2A52] border border-[#1A2A52]/20 px-3 py-1.5 rounded-lg hover:bg-[#1A2A52]/5">
              <Download className="size-3.5"/>Template
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="size-5"/></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 min-h-0">
          {/* Required columns */}
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-2">
              Required columns <span className="text-red-500">*</span>
            </p>
            <div className="flex flex-wrap gap-1.5">
              {config.requiredHeaders.map(h => (
                <code key={h} className="text-[10px] bg-red-50 text-red-700 border border-red-100 px-2 py-0.5 rounded font-mono">{h}</code>
              ))}
              {config.headers.filter(h => !config.requiredHeaders.includes(h)).map(h => (
                <code key={h} className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-mono">{h}</code>
              ))}
            </div>
          </div>

          {/* Drop zone */}
          {!result && (
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) processFile(f); }}
              onClick={() => ref.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${dragging ? "border-[#1A2A52] bg-[#1A2A52]/5" : "border-gray-200 hover:border-gray-300"}`}>
              <Upload className={`size-8 mx-auto mb-2 ${dragging ? "text-[#1A2A52]" : "text-gray-300"}`}/>
              {file ? (
                <div>
                  <p className="text-sm font-semibold text-gray-900 flex items-center justify-center gap-2">
                    <FileText className="size-4 text-emerald-500"/>{file.name}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">{totalRows} rows found · showing first 3</p>
                  <button onClick={e => { e.stopPropagation(); setFile(null); setPreview([]); setTotalRows(0); }}
                    className="mt-2 text-xs text-red-400 hover:underline">Remove file</button>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-semibold text-gray-500">Drop CSV here or click to browse</p>
                  <p className="text-xs text-gray-400 mt-1">UTF-8 encoded CSV · Max 10,000 rows</p>
                </div>
              )}
              <input ref={ref} type="file" accept=".csv,.txt" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f); e.target.value = ""; }}/>
            </div>
          )}

          {/* Preview */}
          {preview.length > 0 && !result && (
            <div className="border border-gray-100 rounded-xl overflow-hidden">
              <p className="px-4 py-2 bg-gray-50 text-[10px] font-bold text-gray-500 uppercase tracking-wide border-b border-gray-100">
                Preview — first {preview.length} of {totalRows} rows
              </p>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead><tr className="border-b border-gray-100">
                    {previewHeaders.map(h => (
                      <th key={h} className="px-3 py-2 text-left text-[9px] font-bold text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {preview.map((row, i) => (
                      <tr key={i} className="border-b border-gray-50 last:border-0">
                        {previewHeaders.map(h => (
                          <td key={h} className="px-3 py-2 text-[11px] text-gray-700 truncate max-w-[120px]">{row[h] || "—"}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-xs px-4 py-3 rounded-xl">
              <AlertCircle className="size-4 shrink-0 mt-0.5"/><span>{error}</span>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle className="size-5 text-emerald-600"/>
                <p className="text-sm font-bold text-emerald-800">Upload Complete!</p>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-3">
                {[
                  ["Created",   result.created  ?? 0, "text-emerald-700 bg-white"],
                  ["Updated",   result.updated  ?? result.skipped ?? 0, "text-amber-700 bg-white"],
                  ["Errors",    result.errors?.length ?? 0, "text-red-700 bg-white"],
                ].map(([l, v, cls]) => (
                  <div key={String(l)} className={`rounded-xl p-3 text-center border border-white/50 ${cls}`}>
                    <p className="text-2xl font-bold">{String(v)}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">{l}</p>
                  </div>
                ))}
              </div>
              {result.errors && result.errors.length > 0 && (
                <div className="max-h-28 overflow-y-auto bg-red-50 rounded-lg p-3 space-y-0.5">
                  {result.errors.slice(0, 10).map((e, i) => (
                    <p key={i} className="text-[10px] text-red-600">{e}</p>
                  ))}
                  {result.errors.length > 10 && (
                    <p className="text-[10px] text-red-400">...and {result.errors.length - 10} more</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 shrink-0">
          {!result ? (
            <>
              <button onClick={upload} disabled={!file || loading}
                className="flex-1 bg-[#1A2A52] text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-[#243766] disabled:opacity-40 flex items-center justify-center gap-2">
                {loading
                  ? <><div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Processing {totalRows} rows...</>
                  : <><Upload className="size-4"/>Upload {totalRows > 0 ? `${totalRows} rows` : "CSV"}</>}
              </button>
              <button onClick={onClose} className="px-5 py-2.5 text-sm text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50">Cancel</button>
            </>
          ) : (
            <div className="flex gap-3 w-full">
              <button onClick={() => { setFile(null); setPreview([]); setResult(null); setTotalRows(0); }}
                className="flex-1 bg-[#1A2A52] text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-[#243766]">
                Upload Another File
              </button>
              <button onClick={onClose} className="px-5 py-2.5 text-sm font-semibold text-gray-700 border border-gray-200 rounded-xl hover:bg-gray-50">Done</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
