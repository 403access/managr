import "server-only";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

/** The parts of `GET /api/model` that the assistant needs. */
export type OpencodeModel = {
  id?: string;
  modelID: string;
  providerID: string;
  name?: string;
  type?: string;
  package?: string;
  settings?: { baseURL?: string; apiKey?: string };
  headers?: Record<string, string>;
  capabilities?: { tools?: boolean };
  status?: string;
  enabled?: boolean;
  limit?: { context?: number; output?: number };
};

/** The parts of `GET /api/provider` that the assistant needs. */
export type OpencodeProvider = {
  id: string;
  name?: string;
  integrationID?: string;
  package?: string;
  settings?: { baseURL?: string; apiKey?: string };
  headers?: Record<string, string>;
};

/** The active credential for a provider. OAuth values are used as a bearer token. */
export type OpencodeCredential = {
  integrationID?: string;
  active?: boolean;
  value?: { type?: string; key?: string; access?: string; expires?: number };
};

/** How managr talks to a provider. All protocols carry the same desk tools. */
export type ChatProtocol = "openai" | "anthropic" | "agy";

export type AssistantProvider = {
  id: string;
  name: string;
  /** The wire protocol the provider's endpoint speaks. */
  protocol: ChatProtocol;
  /** A loopback endpoint keeps the conversation on this computer. */
  local: boolean;
  /** How many offered models this provider has. */
  modelCount: number;
};

export type AssistantModel = {
  id: string;
  providerID: string;
  modelID: string;
  name: string;
  providerName: string;
  protocol: ChatProtocol;
  local: boolean;
  context?: number;
  /** Upper bound for one answer, used by the Anthropic protocol. */
  maxOutput?: number;
};

export type AssistantSelection = { providerID: string; modelID: string };

export type AssistantCatalog = {
  available: boolean;
  error?: string;
  providers: AssistantProvider[];
  models: AssistantModel[];
  default: AssistantSelection | null;
};

export type ResolvedOpencodeModel = {
  providerID: string;
  modelID: string;
  name: string;
  providerName: string;
  protocol: ChatProtocol;
  baseUrl: string;
  apiKey?: string;
  headers: Record<string, string>;
  local: boolean;
  maxOutput?: number;
};

/** Provider packages that speak the OpenAI chat-completions protocol. */
const OPENAI_PACKAGE = /(^|\/)(openai-compatible|openrouter|openai)$/;
/** Provider packages that speak the Anthropic messages protocol. */
const ANTHROPIC_PACKAGE = /(^|\/)(anthropic|anthropic-compatible)$/;

const DEFAULT_ANTHROPIC_OUTPUT = 8192;

export function isLocalBaseUrl(value: string): boolean {
  try {
    const host = new URL(value).hostname.toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]" || host.endsWith(".localhost");
  } catch {
    return false;
  }
}

/**
 * The protocol comes from the provider package that opencode resolved, not from
 * the model: a user-defined provider in opencode.json names its protocol once
 * and every model below it inherits that. The model package is only a fallback.
 */
export function chatProtocol(model: OpencodeModel, provider: OpencodeProvider): ChatProtocol | undefined {
  for (const candidate of [provider.package, model.package]) {
    if (!candidate) continue;
    if (ANTHROPIC_PACKAGE.test(candidate)) return "anthropic";
    if (OPENAI_PACKAGE.test(candidate)) return "openai";
  }
  return undefined;
}

function providerChatBaseUrl(model: OpencodeModel, provider: OpencodeProvider): string | undefined {
  // A provider-level endpoint wins: it is where the user pointed the provider.
  return provider.settings?.baseURL || model.settings?.baseURL;
}

function isChatModel(model: OpencodeModel, provider: OpencodeProvider): boolean {
  // User-defined models in opencode.json carry no type; the API only lists chat models for them.
  if (model.type && model.type !== "chat") return false;
  if (model.enabled === false || model.status === "deprecated") return false;
  if (model.capabilities?.tools !== true) return false;
  return Boolean(chatProtocol(model, provider) && providerChatBaseUrl(model, provider));
}

export function credentialFor(provider: OpencodeProvider, credentials: OpencodeCredential[]): string | undefined {
  const ids = [provider.integrationID, provider.id].filter((id): id is string => Boolean(id));
  const matches = credentials.filter((credential) => credential.integrationID && ids.includes(credential.integrationID));
  const active = matches.find((credential) => credential.active) ?? matches[0];
  const value = active?.value;
  if (value?.type === "key" && value.key) return value.key;
  if (value?.type === "oauth" && value.access) return value.access;
  return undefined;
}

/** Turn the opencode catalog into the small list the panel can offer. */
export function buildOpencodeCatalog(
  models: OpencodeModel[],
  providers: OpencodeProvider[],
  defaultModel?: OpencodeModel | null,
): AssistantCatalog {
  const providerById = new Map(providers.map((provider) => [provider.id, provider]));
  const seen = new Set<string>();
  const catalogModels: AssistantModel[] = [];

  for (const model of models) {
    const provider = providerById.get(model.providerID);
    if (!provider || !isChatModel(model, provider)) continue;
    const key = `${model.providerID}/${model.modelID}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const protocol = chatProtocol(model, provider);
    if (!protocol) continue;
    const baseUrl = providerChatBaseUrl(model, provider) ?? "";
    catalogModels.push({
      id: key,
      providerID: model.providerID,
      modelID: model.modelID,
      name: model.name?.trim() || model.modelID,
      providerName: provider.name?.trim() || provider.id,
      protocol,
      local: isLocalBaseUrl(baseUrl),
      context: model.limit?.context,
      maxOutput: model.limit?.output,
    });
  }

  catalogModels.sort((left, right) => left.name.localeCompare(right.name) || left.providerName.localeCompare(right.providerName));

  // A provider stays in the list even when none of its models is offered, so the
  // panel can say why instead of silently dropping the entry the user configured.
  const catalogProviders: AssistantProvider[] = providers
    .filter((provider) => provider.id !== "env")
    .map((provider) => {
      const owned = catalogModels.filter((model) => model.providerID === provider.id);
      const fallbackProtocol = chatProtocol({ modelID: "", providerID: provider.id }, provider) ?? "openai";
      const local = owned.length > 0 ? owned[0].local : isLocalBaseUrl(provider.settings?.baseURL ?? "");
      return {
        id: provider.id,
        name: provider.name?.trim() || provider.id,
        protocol: owned[0]?.protocol ?? fallbackProtocol,
        local,
        modelCount: owned.length,
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));

  const defaultSelection =
    defaultModel && seen.has(`${defaultModel.providerID}/${defaultModel.modelID}`)
      ? { providerID: defaultModel.providerID, modelID: defaultModel.modelID }
      : catalogModels[0]
        ? { providerID: catalogModels[0].providerID, modelID: catalogModels[0].modelID }
        : null;

  return { available: true, providers: catalogProviders, models: catalogModels, default: defaultSelection };
}

/** Resolve a selection to a chat endpoint and its credential. */
export function resolveOpencodeModel(
  models: OpencodeModel[],
  providers: OpencodeProvider[],
  credentials: OpencodeCredential[],
  selection: AssistantSelection,
): ResolvedOpencodeModel | null {
  const provider = providers.find((candidate) => candidate.id === selection.providerID);
  const model = models.find((candidate) => candidate.providerID === selection.providerID && candidate.modelID === selection.modelID);
  if (!provider || !model || !isChatModel(model, provider)) return null;
  const protocol = chatProtocol(model, provider);
  if (!protocol) return null;
  const baseUrl = providerChatBaseUrl(model, provider);
  if (!baseUrl) return null;
  return {
    providerID: provider.id,
    modelID: model.modelID,
    name: model.name?.trim() || model.modelID,
    providerName: provider.name?.trim() || provider.id,
    protocol,
    baseUrl: baseUrl.replace(/\/+$/, ""),
    apiKey: credentialFor(provider, credentials) ?? provider.settings?.apiKey ?? model.settings?.apiKey,
    headers: { ...(provider.headers ?? {}), ...(model.headers ?? {}) },
    local: isLocalBaseUrl(baseUrl),
    maxOutput: model.limit?.output,
  };
}

/** Anthropic requires a positive max_tokens; a provider may not publish a limit. */
export function anthropicMaxTokens(model: { maxOutput?: number }): number {
  const published = model.maxOutput ?? 0;
  return published > 0 ? published : DEFAULT_ANTHROPIC_OUTPUT;
}

type Snapshot = {
  at: number;
  available: boolean;
  error?: string;
  models: OpencodeModel[];
  providers: OpencodeProvider[];
  credentials: OpencodeCredential[];
  defaultModel: OpencodeModel | null;
  catalog: AssistantCatalog;
};

let snapshot: Snapshot | null = null;
let inflight: Promise<Snapshot> | null = null;

const SUCCESS_TTL = 60_000;
const FAILURE_TTL = 10_000;

export function opencodeEnabled(): boolean {
  const flag = process.env.MANAGR_OPENCODE?.trim().toLowerCase();
  return flag !== "0" && flag !== "off" && flag !== "false";
}

async function opencodeApi(path: string): Promise<unknown> {
  const binary = process.env.MANAGR_OPENCODE_BIN?.trim() || "opencode";
  const { stdout } = await run(binary, ["api", "get", path], {
    timeout: 15_000,
    maxBuffer: 32 * 1024 * 1024,
    windowsHide: true,
  });
  if (!stdout.trim()) throw new Error(`${path} returned no data.`);
  return JSON.parse(stdout);
}

function dataOf<T>(payload: unknown): T | null {
  if (payload && typeof payload === "object" && "data" in payload) return (payload as { data: T }).data;
  return null;
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function failure(error: unknown): Snapshot {
  const message = error instanceof Error ? error.message.split("\n")[0].slice(0, 200) : "opencode could not be read.";
  return {
    at: Date.now(),
    available: false,
    error: message,
    models: [],
    providers: [],
    credentials: [],
    defaultModel: null,
    catalog: { available: false, error: message, providers: [], models: [], default: null },
  };
}

async function readOpencode(): Promise<Snapshot> {
  if (!opencodeEnabled()) return failure(new Error("opencode discovery is turned off. Set MANAGR_OPENCODE=1 to use it."));
  try {
    const [modelPayload, providerPayload, credentialPayload, defaultPayload] = await Promise.all([
      opencodeApi("/api/model"),
      opencodeApi("/api/provider"),
      opencodeApi("/api/credential").catch(() => null),
      opencodeApi("/api/model/default").catch(() => null),
    ]);
    const models = asArray<OpencodeModel>(dataOf(modelPayload)).filter(
      (model) => typeof model?.modelID === "string" && typeof model?.providerID === "string",
    );
    const providers = asArray<OpencodeProvider>(dataOf(providerPayload)).filter((provider) => typeof provider?.id === "string");
    const credentials = asArray<OpencodeCredential>(dataOf(credentialPayload));
    const defaultModel = dataOf<OpencodeModel | null>(defaultPayload) ?? null;
    return {
      at: Date.now(),
      available: true,
      models,
      providers,
      credentials,
      defaultModel,
      catalog: buildOpencodeCatalog(models, providers, defaultModel),
    };
  } catch (error) {
    return failure(error);
  }
}

export async function opencodeSnapshot(): Promise<Snapshot> {
  const age = snapshot ? Date.now() - snapshot.at : Number.POSITIVE_INFINITY;
  if (snapshot && age < (snapshot.available ? SUCCESS_TTL : FAILURE_TTL)) return snapshot;
  if (inflight) return inflight;
  inflight = readOpencode()
    .then((next) => {
      snapshot = next;
      return next;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}