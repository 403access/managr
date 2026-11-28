import type { ChangeAction } from "@/domain/assistant-actions";
import type { PlanStepView } from "@/domain/assistant-plan";
import type { ChatMessage, ChatStep } from "@/client/chat-history";

export type Step = ChatStep;
export type Message = ChatMessage;

export type Settings = { configured: boolean; model: string; baseUrl: string; local: boolean; web?: boolean };

export type Selection = { providerID: string; modelID: string };

/** How managr talks to a provider. */
export type ChatProtocol = "openai" | "anthropic" | "agy";

export type CatalogProvider = {
  id: string;
  name: string;
  protocol: ChatProtocol;
  local: boolean;
  modelCount: number;
};

export type CatalogModel = {
  id: string;
  providerID: string;
  modelID: string;
  name: string;
  providerName: string;
  protocol: ChatProtocol;
  local: boolean;
  context?: number;
  maxOutput?: number;
};

export type Catalog = {
  available: boolean;
  error?: string;
  providers: CatalogProvider[];
  models: CatalogModel[];
  default: Selection | null;
};

export type ProposalChange = {
  callId: string;
  name: string;
  action: ChangeAction;
  input: unknown;
  labels?: Record<string, string>;
};

export type Proposal = { id: string; changes: ProposalChange[] };

export type StreamEvent =
  | { type: "model"; model: string; baseUrl: string; local: boolean; providerID?: string; modelID?: string; protocol?: ChatProtocol }
  | { type: "delta"; text: string }
  | { type: "reset" }
  | { type: "tool"; name: string; input: unknown }
  | { type: "tool_result"; name: string; input: unknown; ok: boolean; summary: string; data?: unknown }
  | { type: "proposal"; id: string; changes: ProposalChange[] }
  | { type: "plan"; steps: import("@/domain/assistant-plan").PlanStep[] }
  | { type: "reply"; text: string }
  | { type: "error"; message: string };

export type StreamingState = {
  content: string;
  steps: Step[];
  proposal?: Proposal;
  plan?: PlanStepView[];
};

export const MCP_SERVER = "managr-mcp";