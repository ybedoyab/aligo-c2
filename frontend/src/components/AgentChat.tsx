import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { agentHealth, streamChat } from "../api/agentClient";
import { useI18n } from "../i18n";
import { useC2 } from "../store";
import { AgentIcon, ChevronDownIcon, CloseIcon, CompletedTasksIcon, SendIcon } from "./icons";
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
  const { t } = useI18n();
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
          tool: approved ? t("console.agentApproved") : t("console.agentRejected"),
          result: feedback,
        },
      ]);
      void run({ approval: { approved, feedback } });
    },
    [rejectNote, run, t]
  );

  const keyMissing = health && !health.anthropic_key_configured;

  return (
    <section className="agent-card card flex h-full min-h-[360px] animate-slide-up flex-col lg:min-h-0">
      <div className="relative flex items-center justify-between gap-3 overflow-hidden border-b border-soc-border px-4 py-3">
        <span className="agent-header-scan pointer-events-none absolute inset-y-0 w-24 bg-gradient-to-r from-transparent via-soc-accent2/15 to-transparent" aria-hidden="true" />
        <div className="flex min-w-0 items-center gap-3">
          <div className="agent-icon-glow relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-soc-accent2/40 bg-soc-accent2/10 text-soc-accent2">
            <AgentIcon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-white">{t("console.agentTitle")}</h2>
            <p className="text-xs text-soc-muted">{t("console.agentDescription")}</p>
          </div>
        </div>
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${health?.c2_reachable ? "bg-soc-ok animate-pulse-soft" : "bg-soc-err"}`}
          title={health ? `agent ${health.version} · ${health.model}` : t("console.agentUnavailable")}
        />
      </div>

      {keyMissing ? (
        <div className="border-b border-soc-border bg-soc-warn/5 px-4 py-2 text-xs text-soc-warn">
          {t("console.agentKeyMissing")} <code>.env</code>
        </div>
      ) : null}

      <div ref={streamRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {turns.length === 0 && !busy ? (
          <div className="rounded-lg border border-dashed border-soc-borderSubtle bg-soc-bg/30 p-3 text-xs text-soc-muted">
            {t("console.agentTry")}
          </div>
        ) : null}
        {turns.map((turn) => (
          <div
            key={turn.id}
            className={
              turn.role === "operator"
                ? "ml-8 animate-slide-up rounded-lg bg-soc-accent/10 px-3 py-2 text-sm text-white"
                : "mr-4 animate-fade-in whitespace-pre-wrap text-sm text-slate-200"
            }
          >
            {turn.role === "agent" ? (
              <span className="mb-0.5 block text-xs font-semibold text-soc-accent">
                {t("console.agentLabel")}
              </span>
            ) : null}
            {turn.text}
          </div>
        ))}

        {pending ? (
          <div className="animate-slide-up space-y-2 rounded-lg border border-soc-warn/40 bg-soc-warn/5 p-3">
            <div className="text-xs font-semibold text-soc-warn">
              {pending.summary ?? t("console.agentApprovalSummary")}
            </div>
            <ul className="space-y-1">
              {pending.actions.map((action) => (
                <li
                  key={`${action.tool}-${JSON.stringify(action.args)}`}
                  className="font-mono text-xs text-white"
                >
                  {action.tool}
                  <span className="text-soc-muted"> {JSON.stringify(action.args)}</span>
                </li>
              ))}
            </ul>
            <input
              className="input w-full text-xs"
              placeholder={t("console.agentRejectPlaceholder")}
              value={rejectNote}
              onChange={(event) => setRejectNote(event.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-primary py-1 text-xs"
                onClick={() => resolve(true)}
                disabled={busy}
              >
                <CompletedTasksIcon className="h-3.5 w-3.5" />
                {t("console.agentApprove")}
              </button>
              <button
                type="button"
                className="btn-ghost py-1 text-xs"
                onClick={() => resolve(false)}
                disabled={busy}
              >
                <CloseIcon className="h-3.5 w-3.5" />
                {t("console.agentReject")}
              </button>
            </div>
          </div>
        ) : null}

        {busy && !pending ? (
          <div className="animate-pulse text-xs text-soc-muted">{t("console.agentThinking")}</div>
        ) : null}
        {error ? <div className="text-xs text-soc-err">{error}</div> : null}
      </div>

      {activity.length > 0 ? (
        <div className="border-t border-soc-border">
          <button
            type="button"
            className="w-full px-4 py-2 text-left text-xs text-soc-muted hover:text-white"
            onClick={() => setShowActivity((current) => !current)}
          >
            <ChevronDownIcon
              className={`mr-1 inline h-3.5 w-3.5 transition-transform ${showActivity ? "rotate-180" : ""}`}
            />
            {t("console.agentActivity", { count: activity.length })}
          </button>
          {showActivity ? (
            <div className="max-h-40 space-y-1 overflow-y-auto px-4 pb-3">
              {activity.map((item) => (
                <div key={item.id} className="font-mono text-[11px] leading-tight">
                  <span className="text-soc-accent">{item.tool}</span>
                  {item.args ? (
                    <span className="text-soc-muted"> {JSON.stringify(item.args)}</span>
                  ) : null}
                  {item.result ? (
                    <div className="truncate text-soc-muted" title={item.result}>
                      → {item.result}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex gap-2 border-t border-soc-border p-3">
        <input
          className="input min-w-0 flex-1 text-sm"
          placeholder={t("console.agentPlaceholder")}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter" || event.shiftKey) return;
            event.preventDefault();
            send();
          }}
          disabled={busy && !pending}
        />
        <button
          type="button"
          className="btn-primary shrink-0"
          onClick={send}
          disabled={busy || !input.trim()}
        >
          <SendIcon className="h-4 w-4" />
          <span className="hidden sm:inline">{t("console.agentSend")}</span>
        </button>
      </div>
    </section>
  );
}
