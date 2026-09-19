"use client";
import { useCallback, useEffect, useState } from "react";
import { Bot, Play, Check, X, ChevronDown, ChevronRight, AlertCircle, Loader2 } from "lucide-react";

type AgentInfo = { key: string; title: string; description: string; schedule: string | null; licensed: boolean; lastRun: { status: string; summary: string | null; startedAt: string } | null };
type Action = { id: string; agentKey: string; tool: string; input: Record<string, unknown>; rationale: string | null; status: string; createdAt: string; result?: unknown; error?: string | null };
type Step = { thought: string; tool?: string; input?: unknown; result?: unknown; finished?: boolean };
type Run = { id: string; agentKey: string; trigger: string; status: string; summary: string | null; error: string | null; steps: Step[] | null; llmCalls: number; startedAt: string };

const AUTONOMY = [
  { value: "SUGGEST",    label: "Ask me first",         desc: "Agents queue every action below for your approval." },
  { value: "ACT_NOTIFY", label: "Act, then tell me",     desc: "Agents act on their own; each action still shows here for review." },
  { value: "AUTO",       label: "Fully automatic",       desc: "Agents act on their own; see the run history and Activity log." },
] as const;

const STATUS_STYLE: Record<string, string> = {
  COMPLETED: "bg-emerald-50 text-emerald-700", WAITING_HUMAN: "bg-amber-50 text-amber-700",
  RUNNING: "bg-blue-50 text-blue-700", FAILED: "bg-red-50 text-red-700",
};

export default function AgentsPage() {
  const [loading, setLoading] = useState(true);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [autonomy, setAutonomy] = useState<string>("SUGGEST");
  const [canConfigure, setCanConfigure] = useState(false);
  const [llm, setLlm] = useState<{ configured: boolean; provider: string | null }>({ configured: true, provider: null });
  const [actions, setActions] = useState<Action[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [running, setRunning] = useState<string | null>(null);
  const [deciding, setDeciding] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/agents");
    if (!res.ok) {
      const d = await res.json().catch(() => null);
      setBlocked(d?.error ?? "Agents aren't available for your account.");
      setLoading(false);
      return;
    }
    const d = await res.json();
    setAgents(d.agents); setAutonomy(d.autonomy); setCanConfigure(d.canConfigure); setLlm(d.llm);
    const [a, r] = await Promise.all([fetch("/api/agents/actions").then(x => x.json()), fetch("/api/agents/runs").then(x => x.json())]);
    setActions(a.actions ?? []); setRuns(r.runs ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function runNow(key: string) {
    setRunning(key); setError(null);
    const res = await fetch(`/api/agents/${key}/run`, { method: "POST" });
    if (!res.ok) setError((await res.json().catch(() => null))?.error ?? "The agent could not run");
    setRunning(null);
    load();
  }

  async function decide(id: string, decision: "approve" | "reject") {
    setDeciding(id); setError(null);
    const res = await fetch(`/api/agents/actions/${id}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision }),
    });
    if (!res.ok) setError((await res.json().catch(() => null))?.error ?? "Could not record your decision");
    setDeciding(null);
    load();
  }

  async function changeAutonomy(value: string) {
    setError(null);
    const res = await fetch("/api/agents/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ autonomy: value }) });
    if (res.ok) setAutonomy(value); else setError((await res.json().catch(() => null))?.error ?? "Could not change the setting");
  }

  const titleOf = (key: string) => agents.find(a => a.key === key)?.title ?? key;

  if (loading) return <div className="p-8 text-sm text-gray-400">Loading…</div>;
  if (blocked) return (
    <div className="p-8 max-w-xl">
      <h1 className="text-xl font-semibold text-gray-900">Agents</h1>
      <p className="text-sm text-gray-500 mt-2">{blocked}</p>
    </div>
  );

  return (
    <div className="p-8 max-w-5xl space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2"><Bot className="size-5" /> Agents</h1>
        <p className="text-sm text-gray-500 mt-1">Agents do routine procurement work for you and only come to you when a decision is needed.</p>
      </div>

      {!llm.configured && (
        <div className="flex gap-2 bg-amber-50 border border-amber-200 text-amber-800 text-xs px-4 py-3 rounded-xl">
          <AlertCircle className="size-4 shrink-0 mt-0.5" />
          <span>No AI model is configured on the server, so agents can&apos;t run. Add a free <code>GROQ_API_KEY</code> or <code>GEMINI_API_KEY</code> to the environment.</span>
        </div>
      )}
      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-4 py-3 rounded-xl">{error}</div>}

      {/* Autonomy */}
      <section>
        <h2 className="text-sm font-semibold text-gray-900 mb-2">How much freedom do agents have?</h2>
        <div className="grid sm:grid-cols-3 gap-3">
          {AUTONOMY.map(o => (
            <button key={o.value} disabled={!canConfigure} onClick={() => changeAutonomy(o.value)}
              className={`text-left p-4 rounded-xl border transition-colors ${autonomy === o.value ? "border-[#1A2A52] bg-[#1A2A52]/5" : "border-gray-200 bg-white hover:bg-gray-50"} ${!canConfigure ? "cursor-default" : ""}`}>
              <p className="text-sm font-medium text-gray-900">{o.label}</p>
              <p className="text-xs text-gray-500 mt-1">{o.desc}</p>
            </button>
          ))}
        </div>
        {!canConfigure && <p className="text-[11px] text-gray-400 mt-2">Only an admin can change this.</p>}
      </section>

      {/* Approvals inbox */}
      <section>
        <h2 className="text-sm font-semibold text-gray-900 mb-2">Waiting for your approval {actions.length > 0 && <span className="ml-1 text-xs bg-amber-100 text-amber-700 rounded-full px-2 py-0.5">{actions.length}</span>}</h2>
        {actions.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl px-5 py-8 text-center text-sm text-gray-400">Nothing waiting on you.</div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
            {actions.map(a => (
              <div key={a.id} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs text-gray-400">{titleOf(a.agentKey)} · {new Date(a.createdAt).toLocaleString()}</p>
                    {typeof a.input.subject === "string" ? (
                      <>
                        <p className="text-sm font-medium text-gray-900 mt-1">{a.input.subject}</p>
                        <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{String(a.input.body ?? "")}</p>
                      </>
                    ) : (
                      <pre className="text-xs text-gray-600 mt-1 whitespace-pre-wrap">{a.tool}: {JSON.stringify(a.input, null, 2)}</pre>
                    )}
                    {a.rationale && <p className="text-xs text-gray-400 mt-2 italic">Why: {a.rationale}</p>}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button disabled={deciding === a.id} onClick={() => decide(a.id, "reject")}
                      className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50"><X className="size-3.5" />Reject</button>
                    <button disabled={deciding === a.id} onClick={() => decide(a.id, "approve")}
                      className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-[#1A2A52] text-white hover:bg-[#14203f] disabled:opacity-50"><Check className="size-3.5" />Approve &amp; send</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Agents */}
      <section>
        <h2 className="text-sm font-semibold text-gray-900 mb-2">Your agents</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {agents.map(a => (
            <div key={a.key} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{a.title}</p>
                  <p className="text-xs text-gray-500 mt-1">{a.description}</p>
                  {a.schedule && <p className="text-[11px] text-gray-400 mt-2">Runs automatically {a.schedule}</p>}
                </div>
                <button disabled={!a.licensed || !llm.configured || running === a.key} onClick={() => runNow(a.key)}
                  title={!a.licensed ? "Not included in your license" : undefined}
                  className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-[#1A2A52] text-white hover:bg-[#14203f] disabled:opacity-40 shrink-0">
                  {running === a.key ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}Run now
                </button>
              </div>
              {a.lastRun && <p className="text-[11px] text-gray-400 mt-3">Last run {new Date(a.lastRun.startedAt).toLocaleString()} — {a.lastRun.status.replace("_", " ").toLowerCase()}</p>}
            </div>
          ))}
        </div>
      </section>

      {/* History */}
      <section>
        <h2 className="text-sm font-semibold text-gray-900 mb-2">Recent runs</h2>
        {runs.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl px-5 py-8 text-center text-sm text-gray-400">No runs yet.</div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
            {runs.map(r => (
              <div key={r.id}>
                <button onClick={() => setOpen(open === r.id ? null : r.id)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50/60">
                  {open === r.id ? <ChevronDown className="size-4 text-gray-400" /> : <ChevronRight className="size-4 text-gray-400" />}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-900">{titleOf(r.agentKey)} <span className="text-xs text-gray-400">· {r.trigger.toLowerCase()} · {new Date(r.startedAt).toLocaleString()}</span></p>
                    <p className="text-xs text-gray-500 truncate">{r.error ?? r.summary ?? "…"}</p>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[r.status] ?? "bg-gray-100 text-gray-600"}`}>{r.status.replace("_", " ")}</span>
                </button>
                {open === r.id && (
                  <div className="px-11 pb-4 space-y-2">
                    {(r.steps ?? []).map((s, i) => (
                      <div key={i} className="text-xs text-gray-600">
                        <p><span className="text-gray-400">{i + 1}.</span> {s.thought}</p>
                        {s.tool && <p className="text-gray-400 font-mono mt-0.5">→ {s.tool}({JSON.stringify(s.input)})</p>}
                      </div>
                    ))}
                    <p className="text-[11px] text-gray-400">{r.llmCalls} model call{r.llmCalls === 1 ? "" : "s"}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
