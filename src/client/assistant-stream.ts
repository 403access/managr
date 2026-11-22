import { mergePlan, type PlanStepView } from "@/domain/assistant-plan";
import type { ChatProtocol, Proposal, Step, StreamEvent, StreamingState } from "@/client/assistant-types";

export type StreamModel = {
  model: string;
  baseUrl: string;
  local: boolean;
  providerID?: string;
  modelID?: string;
  protocol?: ChatProtocol;
};

/** Everything one assistant turn collects while its events arrive. */
export type ReplayState = {
  content: string;
  steps: Step[];
  proposal: Proposal | null;
  plan: PlanStepView[];
  model: StreamModel | null;
  error: string;
  sawReply: boolean;
  /** Sequence behind the step keys, so a key stays stable when its step updates. */
  seq: number;
};

export function emptyReplay(): ReplayState {
  return { content: "", steps: [], proposal: null, plan: [], model: null, error: "", sawReply: false, seq: 0 };
}

/**
 * Folds one stream event into the turn. The panel and the mock replay share
 * this, so a preview of a turn behaves exactly like the live one.
 */
export function applyStreamEvent(state: ReplayState, event: StreamEvent): ReplayState {
  // A proposal only survives until the next event that is not its own answer.
  const base = state.proposal && event.type !== "model" && event.type !== "proposal" ? { ...state, proposal: null } : state;
  switch (event.type) {
    case "model":
      return {
        ...base,
        model: {
          model: event.model,
          baseUrl: event.baseUrl,
          local: Boolean(event.local),
          providerID: event.providerID,
          modelID: event.modelID,
          protocol: event.protocol,
        },
      };
    case "delta":
      return { ...base, content: base.content + event.text };
    case "reset":
      return { ...base, content: "" };
    case "tool":
      return {
        ...base,
        seq: base.seq + 1,
        steps: [...base.steps, { key: `${base.seq}`, name: event.name, input: event.input, status: "running", summary: "" }],
      };
    case "tool_result":
      return {
        ...base,
        steps: base.steps.map((step, index) =>
          index === base.steps.length - 1 ? { ...step, status: event.ok ? "ok" : "error", summary: event.summary, data: event.data } : step,
        ),
      };
    case "proposal":
      return { ...base, proposal: { id: event.id, changes: event.changes } };
    case "plan":
      return { ...base, plan: mergePlan(base.plan, event.steps) };
    case "reply":
      return { ...base, content: event.text, sawReply: true };
    case "error":
      return { ...base, error: event.message };
    default:
      return base;
  }
}

/** The shape the transcript renders while the turn is still open. */
export function streamingState(state: ReplayState): StreamingState {
  return {
    content: state.content,
    steps: state.steps,
    ...(state.proposal ? { proposal: state.proposal } : {}),
    ...(state.plan.length > 0 ? { plan: state.plan } : {}),
  };
}