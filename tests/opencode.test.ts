import { describe, expect, it } from "vitest";
import {
  buildOpencodeCatalog,
  credentialFor,
  isLocalBaseUrl,
  resolveOpencodeModel,
  type OpencodeCredential,
  type OpencodeModel,
  type OpencodeProvider,
} from "@/server/opencode";

const providers: OpencodeProvider[] = [
  {
    id: "ollama",
    name: "Ollama (Local)",
    package: "@opencode/ai/providers/openai-compatible",
    settings: { baseURL: "http://127.0.0.1:11434/v1", apiKey: "ollama" },
  },
  {
    id: "qwen",
    name: "Qwen Cloud",
    integrationID: "qwen",
    package: "@opencode/ai/providers/openai-compatible",
    settings: { baseURL: "https://token-plan.example/v1" },
  },
  {
    id: "google",
    name: "Google",
    package: "@opencode/ai/providers/google",
    settings: { baseURL: "https://generativelanguage.googleapis.com/v1beta" },
  },
  {
    id: "go",
    name: "OpenCode Go",
    integrationID: "opencode",
    package: "@opencode/ai/providers/openai-compatible",
    settings: { baseURL: "https://opencode.ai/inference/go/openai/v1" },
    headers: { "x-opencode-org-id": "org" },
  },
];

const models: OpencodeModel[] = [
  {
    modelID: "qwen2.5-coder-32k",
    providerID: "ollama",
    name: "Qwen Coder",
    type: "chat",
    package: "@opencode/ai/providers/openai-compatible",
    capabilities: { tools: true },
    status: "active",
    enabled: true,
    limit: { context: 32768 },
  },
  {
    modelID: "qwen-max",
    providerID: "qwen",
    name: "Qwen Max",
    package: "@opencode/ai/providers/openai-compatible",
    capabilities: { tools: true },
    status: "active",
    enabled: true,
    limit: { context: 32768 },
  },
  {
    modelID: "qwen-max",
    providerID: "qwen",
    name: "Qwen Max",
    type: "chat",
    package: "@opencode/ai/providers/openai-compatible",
    capabilities: { tools: true },
    status: "active",
    enabled: true,
  },
  {
    modelID: "gemini-4",
    providerID: "google",
    name: "Gemini 4",
    type: "chat",
    package: "@opencode/ai/providers/google",
    capabilities: { tools: true },
    status: "active",
    enabled: true,
  },
  {
    modelID: "claude-haiku",
    providerID: "go",
    name: "Claude Haiku",
    type: "chat",
    package: "@opencode/ai/providers/anthropic",
    capabilities: { tools: true },
    status: "active",
    enabled: true,
    headers: { "x-extra": "1" },
  },
  {
    modelID: "no-tools",
    providerID: "qwen",
    name: "No tools",
    type: "chat",
    package: "@opencode/ai/providers/openai-compatible",
    capabilities: { tools: false },
    status: "active",
    enabled: true,
  },
  {
    modelID: "deprecated",
    providerID: "qwen",
    name: "Deprecated",
    type: "chat",
    package: "@opencode/ai/providers/openai-compatible",
    capabilities: { tools: true },
    status: "deprecated",
    enabled: true,
  },
  {
    modelID: "disabled",
    providerID: "qwen",
    name: "Disabled",
    type: "chat",
    package: "@opencode/ai/providers/openai-compatible",
    capabilities: { tools: true },
    status: "active",
    enabled: false,
  },
  {
    modelID: "embedding",
    providerID: "qwen",
    name: "Embedding",
    type: "embedding",
    package: "@opencode/ai/providers/openai-compatible",
    capabilities: { tools: true },
    status: "active",
    enabled: true,
  },
];

const credentials: OpencodeCredential[] = [
  { integrationID: "qwen", active: true, value: { type: "key", key: "qwen-secret" } },
  { integrationID: "opencode", active: true, value: { type: "oauth", access: "oauth-token" } },
];

describe("opencode catalog", () => {
  it("keeps only chat models with tool support on an OpenAI-compatible endpoint", () => {
    const catalog = buildOpencodeCatalog(models, providers, models[1]);

    expect(catalog.available).toBe(true);
    expect(catalog.models.map((model) => model.modelID)).toEqual(["claude-haiku", "qwen2.5-coder-32k", "qwen-max"]);
    expect(catalog.providers.map((provider) => provider.id)).toEqual(["ollama", "go", "qwen"]);
    expect(catalog.default).toEqual({ providerID: "qwen", modelID: "qwen-max" });
    expect(catalog.models.find((model) => model.modelID === "qwen2.5-coder-32k")?.context).toBe(32768);
  });

  it("falls back to the first runnable model when opencode has a different default", () => {
    const catalog = buildOpencodeCatalog(models, providers, { modelID: "gemini-4", providerID: "google" });
    expect(catalog.default).toEqual({ providerID: "go", modelID: "claude-haiku" });
  });

  it("marks a loopback endpoint as local and a cloud endpoint as remote", () => {
    const catalog = buildOpencodeCatalog(models, providers);
    expect(catalog.models.find((model) => model.providerID === "ollama")?.local).toBe(true);
    expect(catalog.models.find((model) => model.providerID === "qwen")?.local).toBe(false);
  });
});

describe("opencode model resolution", () => {
  it("uses the provider base URL and its API key", () => {
    const resolved = resolveOpencodeModel(models, providers, credentials, { providerID: "qwen", modelID: "qwen-max" });
    expect(resolved).toMatchObject({ modelID: "qwen-max", baseUrl: "https://token-plan.example/v1", apiKey: "qwen-secret", local: false });
  });

  it("uses the OpenAI-compatible provider route for a native-package model", () => {
    const resolved = resolveOpencodeModel(models, providers, credentials, { providerID: "go", modelID: "claude-haiku" });
    expect(resolved).toMatchObject({
      baseUrl: "https://opencode.ai/inference/go/openai/v1",
      apiKey: "oauth-token",
      headers: { "x-opencode-org-id": "org", "x-extra": "1" },
    });
  });

  it("keeps the configured key for a local provider", () => {
    const resolved = resolveOpencodeModel(models, providers, credentials, { providerID: "ollama", modelID: "qwen2.5-coder-32k" });
    expect(resolved?.apiKey).toBe("ollama");
    expect(resolved?.local).toBe(true);
  });

  it("refuses a provider that has no OpenAI-compatible route", () => {
    expect(resolveOpencodeModel(models, providers, credentials, { providerID: "google", modelID: "gemini-4" })).toBeNull();
    expect(resolveOpencodeModel(models, providers, credentials, { providerID: "qwen", modelID: "missing" })).toBeNull();
  });

  it("prefers the active credential and falls back to a key", () => {
    expect(credentialFor(providers[1], credentials)).toBe("qwen-secret");
    expect(
      credentialFor(providers[1], [
        { integrationID: "qwen", active: false, value: { type: "key", key: "old" } },
        { integrationID: "qwen", active: true, value: { type: "key", key: "new" } },
      ]),
    ).toBe("new");
  });
});

describe("opencode endpoints", () => {
  it("detects loopback hosts", () => {
    expect(isLocalBaseUrl("http://127.0.0.1:11434/v1")).toBe(true);
    expect(isLocalBaseUrl("http://localhost:11434/v1")).toBe(true);
    expect(isLocalBaseUrl("https://api.example.com/v1")).toBe(false);
    expect(isLocalBaseUrl("not a url")).toBe(false);
  });
});