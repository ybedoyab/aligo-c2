"""LangGraph orchestrator: plan -> (interrupt: approve?) -> execute -> observe.

A ReAct-style loop with one twist: before any *gated* tool (the ones that execute
on nodes) runs, we fire a LangGraph `interrupt()` so the operator must explicitly
approve the specific action. Read tools and `create_mission_draft` flow straight
through. This mirrors the inherited pod-brain `interrupt()` approval pattern, much
simplified.

Routing relies only on the message list (MessagesState):
  - agent emits an AIMessage; if it has gated tool_calls -> `approval`, else if it
    has any tool_calls -> `tools`, else END.
  - `approval` calls interrupt(). On approve it returns no message, so the last
    message is still the AIMessage with tool_calls -> route to `tools` (execute).
    On reject it appends ToolMessages, so the last message is a ToolMessage ->
    route back to `agent` so it can respond without executing.
"""

from __future__ import annotations

from typing import Any, Literal

from langchain_anthropic import ChatAnthropic
from langchain_core.messages import AIMessage, SystemMessage, ToolMessage
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, MessagesState, StateGraph
from langgraph.prebuilt import ToolNode
from langgraph.types import interrupt

from app.config import settings
from app.prompts import SYSTEM_PROMPT
from app.tools import ALL_TOOLS, GATED_TOOLS

_SYSTEM = SystemMessage(content=SYSTEM_PROMPT)


def _build_llm() -> ChatAnthropic:
    # Opus 4.8: omit temperature/top_p/thinking (removed on this model). Streaming
    # is handled by the graph's astream(stream_mode="messages").
    return ChatAnthropic(
        model=settings.agent_model,
        max_tokens=settings.agent_max_tokens,
        api_key=settings.anthropic_api_key or None,
        timeout=120,
    ).bind_tools(ALL_TOOLS)


def _gated_calls(message: AIMessage) -> list[dict[str, Any]]:
    return [tc for tc in (message.tool_calls or []) if tc["name"] in GATED_TOOLS]


def build_graph() -> Any:
    llm = _build_llm()

    async def agent_node(state: MessagesState) -> dict[str, Any]:
        response = await llm.ainvoke([_SYSTEM, *state["messages"]])
        return {"messages": [response]}

    def approval_node(state: MessagesState) -> dict[str, Any]:
        last = state["messages"][-1]
        gated = _gated_calls(last)
        # Surface the exact action(s) for the operator to approve. The resume value
        # (sent back via Command(resume=...)) is whatever the operator decided.
        decision = interrupt({
            "type": "approval_request",
            "summary": "The agent wants to execute the following action(s) on nodes.",
            "actions": [{"tool": tc["name"], "args": tc["args"]} for tc in gated],
        })
        approved = decision.get("approved", False) if isinstance(decision, dict) else bool(decision)
        if approved:
            # No new message: the AIMessage with tool_calls stays last -> execute.
            return {}
        feedback = decision.get("feedback") if isinstance(decision, dict) else None
        reason = f" Operator note: {feedback}" if feedback else ""
        rejections = [
            ToolMessage(
                tool_call_id=tc["id"],
                name=tc["name"],
                content=(
                    "Operator REJECTED this action; it was NOT executed."
                    " Do not retry it unchanged — revise the plan or ask what to change."
                    + reason
                ),
            )
            for tc in gated
        ]
        return {"messages": rejections}

    def route_after_agent(state: MessagesState) -> Literal["approval", "tools", "end"]:
        last = state["messages"][-1]
        if not isinstance(last, AIMessage) or not last.tool_calls:
            return "end"
        if _gated_calls(last):
            return "approval"
        return "tools"

    def route_after_approval(state: MessagesState) -> Literal["tools", "agent"]:
        # Rejection appended ToolMessages -> back to agent. Approval left the
        # AIMessage last -> execute the gated calls.
        return "agent" if isinstance(state["messages"][-1], ToolMessage) else "tools"

    builder = StateGraph(MessagesState)
    builder.add_node("agent", agent_node)
    builder.add_node("tools", ToolNode(ALL_TOOLS))
    builder.add_node("approval", approval_node)

    builder.add_edge(START, "agent")
    builder.add_conditional_edges(
        "agent",
        route_after_agent,
        {"approval": "approval", "tools": "tools", "end": END},
    )
    builder.add_conditional_edges(
        "approval",
        route_after_approval,
        {"tools": "tools", "agent": "agent"},
    )
    builder.add_edge("tools", "agent")

    return builder.compile(checkpointer=MemorySaver())


_graph: Any | None = None


def get_graph() -> Any:
    global _graph
    if _graph is None:
        _graph = build_graph()
    return _graph
