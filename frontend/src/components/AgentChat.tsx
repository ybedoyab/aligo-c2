import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { agentHealth, streamChat } from "../api/agentClient";
import { useC2 } from "../store";
import type {
  AgentApprovalRequest,
  AgentEvent,
  AgentHealth,
  AgentToolActivity,
  AgentTurn,
} from "../types";

function uid(): string {
  return (
    (globalThis.crypto?.randomUUID?.() as string | undefined) ??
    `${Date.now()}-${Math.random().toString(16).slice(2)}`
  );
}

export function AgentChat() {
  const { refreshAll } = useC2();
  const sessionId = useMemo(() => uid(), []);
  const [turns, setTurns] = useState<AgentTurn[]>([]);
  const [activity, setActivity] = useState<AgentToolActivity[]>([]);
  const [pending, setPending] = useState<AgentApprovalRequest | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<AgentHealth | null>(null);
  const [showActivity, setShowActivity] = useState(true);
  const [rejectNote, setRejectNote] = useState("");

  const streamRef = useRef<HTMLDivElement>(null);
  // id of the agent turn currently being streamed into
  const liveTurnId = useRef<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    agentHealth(ctrl.signal)
      .then(setHealth)
      .catch(() => setHealth(null));
    return () => ctrl.abort();
  }, []);

  useEffect(() => {
    streamRef.current?.scrollTo({ top: streamRef.current.scrollHeight });
  }, [turns, activity, pending]);

  const appendAgentText = useCallback((text: string) => {
    setTurns((prev) => {
      const id = liveTurnId.current;
      if (id) {
        return prev.map((t) => (t.id === id ? { ...t, text: t.text + text } : t));
      }
      const newId = uid();
      liveTurnId.current = newId;
      return [...prev, { id: newId, role: "agent", text }];
    });
  }, []);

  const handleEvent = useCallback(
    (evt: AgentEvent) => {
      switch (evt.event) {
        case "token":
          appendAgentText(evt.data.text);
          break;
        case "tool_call":
          setActivity((a) => [
            ...a,
            { id: uid(), tool: evt.data.tool, args: evt.data.args },
          ]);
          break;
        case "tool_result":
          setActivity((a) => {
            // attach the result to the most recent matching tool_call without one
            for (let i = a.length - 1; i >= 0; i--) {
              if (a[i].tool === evt.data.tool && a[i].result === undefined) {
                const copy = a.slice();
                copy[i] = { ...copy[i], result: evt.data.content };
                return copy;
              }
            }
            return [...a, { id: uid(), tool: evt.data.tool, result: evt.data.content }];
          });
          break;
        case "approval_request":
          setPending(evt.data);
          break;
        case "error":
          setError(evt.data.detail);
          break;
        case "done":
          // turn finished; the next token starts a fresh agent bubble
          liveTurnId.current = null;
          break;
      }
    },
    [appendAgentText]
  );

  const run = useCallback(
    async (payload: { message?: string; approval?: { approved: boolean; feedback?: string } }) => {
      setBusy(true);
      setError(null);
      liveTurnId.current = null;
      try {
        await streamChat({ session_id: sessionId, ...payload }, { onEvent: handleEvent });
        // An approved/executed turn may have changed C2 state — refresh the
        // dashboard data so manual history/nodes/ledger reflect it.
        refreshAll();
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [handleEvent, refreshAll, sessionId]
  );

  const send = useCallback(() => {
    const msg = input.trim();
    if (!msg || busy) return;
    setTurns((prev) => [...prev, { id: uid(), role: "operator", text: msg }]);
    setInput("");
    void run({ message: msg });
  }, [busy, input, run]);

  const resolve = useCallback(
    (approved: boolean) => {
      const feedback = approved ? undefined : rejectNote.trim() || undefined;
      setPending(null);
      setRejectNote("");
      setActivity((a) => [
        ...a,
        {
          id: uid(),
          tool: approved ? "operator: APPROVED" : "operator: REJECTED",
          result: feedback,
        },
      ]);
      void run({ approval: { approved, feedback } });
    },
    [rejectNote, run]
  );

  const keyMissing = health && !health.anthropic_key_configured;

  return (
    <div className="card flex flex-col h-full min-h-[520px]">
      <div className="px-4 py-3 border-b border-soc-border flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-white">Ask AI</div>
          <div className="text-xs text-soc-muted">
            Agent orchestrator · drafts &amp; runs allowlisted missions after your approval
          </div>
        </div>
        <span
          className={`h-2 w-2 rounded-full ${
            health?.c2_reachable ? "bg-soc-ok" : "bg-soc-err"
          }`}
          title={health ? `agent ${health.version} · ${health.model}` : "agent unreachable"}
        />
      </div>

      {keyMissing && (
        <div className="px-4 py-2 text-xs text-soc-warn border-b border-soc-border bg-soc-warn/5">
          ANTHROPIC_API_KEY not configured — add it to <code>.env</code> and restart to enable chat.
        </div>
      )}

      <div ref={streamRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {turns.length === 0 && !busy && (
          <div className="text-xs text-soc-muted">
            Try: <em>“Which nodes are online?”</em> or{" "}
            <em>“Run a health check on every online node.”</em>
          </div>
        )}
        {turns.map((t) => (
          <div
            key={t.id}
            className={
              t.role === "operator"
                ? "ml-8 rounded-lg bg-soc-accent/10 px-3 py-2 text-sm text-white"
                : "mr-4 text-sm text-slate-200 whitespace-pre-wrap"
            }
          >
            {t.role === "agent" && (
              <span className="text-xs text-soc-accent font-semibold block mb-0.5">agent</span>
            )}
            {t.text}
          </div>
        ))}

        {pending && (
          <div className="rounded-lg border border-soc-warn/40 bg-soc-warn/5 p-3 space-y-2">
            <div className="text-xs font-semibold text-soc-warn">
              {pending.summary ?? "The agent wants to execute the following action(s)."}
            </div>
            <ul className="space-y-1">
              {pending.actions.map((a, i) => (
                <li key={i} className="font-mono text-xs text-white">
                  {a.tool}
                  <span className="text-soc-muted"> {JSON.stringify(a.args)}</span>
                </li>
              ))}
            </ul>
            <input
              className="input w-full text-xs"
              placeholder="optional note (sent on reject)"
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
            />
            <div className="flex gap-2">
              <button className="btn-primary py-1 text-xs" onClick={() => resolve(true)} disabled={busy}>
                Approve &amp; run
              </button>
              <button className="btn-ghost py-1 text-xs" onClick={() => resolve(false)} disabled={busy}>
                Reject
              </button>
            </div>
          </div>
        )}

        {busy && !pending && <div className="text-xs text-soc-muted animate-pulse">thinking…</div>}
        {error && <div className="text-xs text-soc-err">{error}</div>}
      </div>

      {activity.length > 0 && (
        <div className="border-t border-soc-border">
          <button
            className="w-full px-4 py-2 text-left text-xs text-soc-muted hover:text-white"
            onClick={() => setShowActivity((s) => !s)}
          >
            {showActivity ? "▾" : "▸"} Tool activity ({activity.length})
          </button>
          {showActivity && (
            <div className="max-h-40 overflow-y-auto px-4 pb-3 space-y-1">
              {activity.map((a) => (
                <div key={a.id} className="font-mono text-[11px] leading-tight">
                  <span className="text-soc-accent">{a.tool}</span>
                  {a.args && <span className="text-soc-muted"> {JSON.stringify(a.args)}</span>}
                  {a.result && (
                    <div className="text-soc-muted truncate" title={a.result}>
                      → {a.result}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="p-3 border-t border-soc-border flex gap-2">
        <input
          className="input flex-1 text-sm"
          placeholder="Ask the agent…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), send())}
          disabled={busy && !pending}
        />
        <button className="btn-primary" onClick={send} disabled={busy || !input.trim()}>
          Send
        </button>
      </div>
    </div>
  );
}
