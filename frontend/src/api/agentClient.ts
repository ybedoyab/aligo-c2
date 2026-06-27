// Client for the Agent (AI orchestrator) backend on :8100.
//
// In TLS dev the browser hits the same-origin Vite proxy at `/agent`, which
// forwards to http://127.0.0.1:8100 (see frontend/vite.config.ts). In --no-tls
// dev, dev.py sets VITE_AGENT_URL=http://127.0.0.1:8100 and we call it directly.
//
// The /chat endpoint is a turn-based SSE stream over a LangGraph session keyed
// by `session_id`. Send a `message` to start a turn; if the agent proposes a
// gated action it emits `approval_request` and pauses — resume by POSTing again
// with `approval`.

import type { AgentEvent, AgentHealth } from "../types";

function agentBase(): string {
  return (import.meta.env.VITE_AGENT_URL as string | undefined) ?? "/agent";
}

export interface ChatRequest {
  session_id: string;
  message?: string;
  approval?: { approved: boolean; feedback?: string };
}

export interface ChatHandlers {
  onEvent: (evt: AgentEvent) => void;
  signal?: AbortSignal;
}

/**
 * POST to /chat and dispatch each SSE event to `onEvent`. Resolves when the
 * stream ends (after the `done` event or when the body closes).
 */
export async function streamChat(req: ChatRequest, handlers: ChatHandlers): Promise<void> {
  const res = await fetch(`${agentBase()}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify(req),
    signal: handlers.signal,
  });

  if (!res.ok || !res.body) {
    let detail = res.statusText;
    try {
      detail = JSON.stringify(await res.json());
    } catch {
      /* keep statusText */
    }
    handlers.onEvent({ event: "error", data: { detail: `${res.status}: ${detail}` } });
    handlers.onEvent({ event: "done", data: { awaiting_approval: false } });
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  // Parse a single SSE frame ("event: x\ndata: {...}") and dispatch it.
  const dispatch = (frame: string) => {
    let eventName = "message";
    const dataLines: string[] = [];
    for (const raw of frame.split("\n")) {
      const line = raw.trimEnd();
      if (line.startsWith("event:")) eventName = line.slice(6).trim();
      else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
    }
    if (dataLines.length === 0) return;
    let data: unknown;
    try {
      data = JSON.parse(dataLines.join("\n"));
    } catch {
      data = { raw: dataLines.join("\n") };
    }
    handlers.onEvent({ event: eventName, data } as AgentEvent);
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    // SSE frames are separated by a blank line.
    let sep: number;
    while ((sep = buffer.indexOf("\n\n")) !== -1) {
      const frame = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      if (frame.trim()) dispatch(frame);
    }
  }
  if (buffer.trim()) dispatch(buffer);
}

export async function agentHealth(signal?: AbortSignal): Promise<AgentHealth> {
  const res = await fetch(`${agentBase()}/health`, { signal });
  if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
  return (await res.json()) as AgentHealth;
}
