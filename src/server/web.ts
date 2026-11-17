import "server-only";
import { lookup } from "node:dns/promises";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36";
const MAX_BYTES = 2_000_000;
const MAX_TEXT = 12_000;
const MAX_RESULTS = 10;
const SEARCH_TTL = 5 * 60_000;
const FETCH_TTL = 5 * 60_000;

export type WebResult = { title: string; url: string; snippet: string };
export type WebSearchResult = {
  query: string;
  engine: "custom" | "duckduckgo" | "bing";
  results: WebResult[];
};
export type WebPage = {
  url: string;
  title: string;
  text: string;
  truncated: boolean;
  emails: string[];
};

export function webEnabled(): boolean {
  const flag = process.env.MANAGR_WEB?.trim().toLowerCase();
  return flag !== "0" && flag !== "off" && flag !== "false";
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : "unknown error";
}

function collapse(value: string): string {
  return value
    .replace(/\r/g, "\n")
    .replace(/[ \t\f\v\u00a0]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const entities: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  auml: "ä",
  ouml: "ö",
  uuml: "ü",
  Auml: "Ä",
  Ouml: "Ö",
  Uuml: "Ü",
  szlig: "ß",
  euro: "€",
  copy: "©",
  reg: "®",
  trade: "™",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  laquo: "«",
  raquo: "»",
  bdquo: "„",
  ldquo: "“",
  rdquo: "”",
  lsquo: "‘",
  rsquo: "’",
  middot: "·",
  bull: "•",
  deg: "°",
  plusmn: "±",
  times: "×",
  divide: "÷",
};

export function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => {
      try {
        return String.fromCodePoint(Number.parseInt(hex, 16));
      } catch {
        return "";
      }
    })
    .replace(/&#(\d+);/g, (_, decimal: string) => {
      try {
        return String.fromCodePoint(Number.parseInt(decimal, 10));
      } catch {
        return "";
      }
    })
    .replace(/&([a-zA-Z][a-zA-Z0-9]+);/g, (whole, name: string) => entities[name] ?? whole);
}

function stripTags(value: string): string {
  return collapse(decodeHtmlEntities(value.replace(/<[^>]*>/g, " ")));
}

/** Turn a downloaded HTML page into the text a model can read. */
export function htmlToText(html: string): { title: string; text: string } {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "";
  const description =
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)?.[1] ??
    html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i)?.[1] ??
    "";
  const body = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|template)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h[1-6]|section|article|header|footer|nav|main|aside|td|th|blockquote|pre)>/gi, "\n")
    .replace(/<[^>]*>/g, " ");
  const text = collapse(
    [decodeHtmlEntities(description), collapse(decodeHtmlEntities(body))].filter((part) => part.trim()).join("\n\n"),
  );
  return { title: stripTags(title), text };
}

function searchEngineUrl(value: string): boolean {
  try {
    const host = new URL(value).hostname.toLowerCase();
    return host === "duckduckgo.com" || host.endsWith(".duckduckgo.com") || host === "bing.com" || host.endsWith(".bing.com");
  } catch {
    return true;
  }
}

function decodeDuckDuckGoUrl(href: string): string | null {
  try {
    const url = new URL(href.startsWith("//") ? `https:${href}` : href, "https://duckduckgo.com");
    if (url.hostname.endsWith("duckduckgo.com") && url.pathname.startsWith("/l/")) {
      return url.searchParams.get("uddg");
    }
    return /^https?:$/.test(url.protocol) && !searchEngineUrl(url.toString()) ? url.toString() : null;
  } catch {
    return null;
  }
}

function decodeBingUrl(href: string): string | null {
  try {
    const url = new URL(href, "https://www.bing.com");
    const encoded = url.searchParams.get("u");
    if (encoded?.startsWith("a1")) {
      const base64 = encoded.slice(2).replace(/-/g, "+").replace(/_/g, "/");
      const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
      const decoded = Buffer.from(padded, "base64").toString("utf8");
      return /^https?:\/\//.test(decoded) && !searchEngineUrl(decoded) ? decoded : null;
    }
    return /^https?:$/.test(url.protocol) && !searchEngineUrl(url.toString()) ? url.toString() : null;
  } catch {
    return null;
  }
}

function dedupe(results: WebResult[]): WebResult[] {
  const seen = new Set<string>();
  return results.filter((result) => {
    const key = result.url.replace(/\/+$/, "").toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Parse the server-rendered DuckDuckGo result page. */
export function parseDuckDuckGoResults(html: string): WebResult[] {
  const results: WebResult[] = [];
  for (const match of html.matchAll(/<a\b[^>]*class=["']result-link["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = match[0].match(/href=["']([^"']+)["']/i)?.[1];
    const title = stripTags(match[1]);
    if (!href || !title) continue;
    const url = decodeDuckDuckGoUrl(decodeHtmlEntities(href));
    if (!url) continue;
    const after = html.slice(match.index ?? 0, (match.index ?? 0) + 8_000);
    const snippet = after.match(/class=["']result-snippet["'][^>]*>([\s\S]*?)<\/td>/i)?.[1] ?? "";
    results.push({ title, url, snippet: stripTags(snippet).slice(0, 320) });
  }
  return dedupe(results);
}

/** Parse the server-rendered Bing result page. */
export function parseBingResults(html: string): WebResult[] {
  const results: WebResult[] = [];
  for (const block of html.split(/<li[^>]*class=["'][^"']*b_algo[^"']*["'][^>]*>/i).slice(1)) {
    const titleMatch = block.match(/<h2[^>]*>[\s\S]*?<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
    if (!titleMatch) continue;
    const title = stripTags(titleMatch[2]);
    const url = decodeBingUrl(decodeHtmlEntities(titleMatch[1]));
    if (!title || !url) continue;
    const snippet =
      block.match(/<p[^>]*class=["'][^"']*b_lineclamp[^"']*["'][^>]*>([\s\S]*?)<\/p>/i)?.[1] ??
      block.match(/<p[^>]*>([\s\S]*?)<\/p>/i)?.[1] ??
      "";
    results.push({ title, url, snippet: stripTags(snippet).slice(0, 320) });
  }
  return dedupe(results);
}

function emailsIn(text: string): string[] {
  const found = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [];
  return [...new Set(found.map((email) => email.toLowerCase()))].slice(0, 10);
}

function isPrivateAddress(value: string): boolean {
  const address = value.toLowerCase();
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(address);
  if (mapped) return isPrivateAddress(mapped[1]);
  if (address === "::" || address === "::1" || address === "0.0.0.0") return true;
  if (/^127\./.test(address) || /^10\./.test(address) || /^192\.168\./.test(address) || /^169\.254\./.test(address)) return true;
  const second = /^172\.(\d{1,3})\./.exec(address);
  if (second && Number(second[1]) >= 16 && Number(second[1]) <= 31) return true;
  return /^(fc|fd|fe80:)/i.test(address);
}

async function assertPublicHost(hostname: string): Promise<void> {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new Error("Local and private addresses cannot be read.");
  }
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host) || host.includes(":")) {
    if (isPrivateAddress(host)) throw new Error("Local and private addresses cannot be read.");
    return;
  }
  const addresses = await lookup(host, { all: true }).catch(() => []);
  if (addresses.some((entry) => isPrivateAddress(entry.address))) {
    throw new Error("Local and private addresses cannot be read.");
  }
}

type PageResponse = { response: Response; text: string };

async function requestPage(raw: string): Promise<PageResponse> {
  let current = raw;
  for (let hop = 0; hop < 5; hop += 1) {
    const url = new URL(current);
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Only http and https URLs can be read.");
    await assertPublicHost(url.hostname);
    const response = await fetch(url.toString(), {
      redirect: "manual",
      headers: {
        "user-agent": USER_AGENT,
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.5",
        "accept-language": "de-DE,de;q=0.9,en;q=0.8",
      },
      signal: AbortSignal.timeout(20_000),
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      await response.body?.cancel().catch(() => undefined);
      if (!location) throw new Error(`The page redirected with ${response.status} but gave no target.`);
      current = new URL(location, url).toString();
      continue;
    }
    if (!response.ok) throw new Error(`The page answered ${response.status}.`);
    const bytes = response.body ? await readCapped(response.body) : new Uint8Array();
    const contentType = response.headers.get("content-type") ?? "";
    return { response, text: decodeBody(bytes, contentType) };
  }
  throw new Error("The page redirected too often.");
}

async function readCapped(body: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > MAX_BYTES) {
        chunks.push(value.subarray(0, Math.max(0, MAX_BYTES - (total - value.byteLength))));
        await reader.cancel().catch(() => undefined);
        break;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
}

function decodeBody(bytes: Uint8Array, contentType: string): string {
  const declared = /charset=([^;]+)/i.exec(contentType)?.[1]?.trim().replace(/^["']|["']$/g, "");
  const head = new TextDecoder("utf-8").decode(bytes.subarray(0, 1_024));
  const meta = /<meta[^>]+charset=["']?([a-zA-Z0-9_-]+)/i.exec(head)?.[1];
  const charset = (declared ?? meta ?? "utf-8").toLowerCase();
  try {
    return new TextDecoder(charset, { fatal: false }).decode(bytes);
  } catch {
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  }
}

async function searchRequest(url: string): Promise<Response> {
  const response = await fetch(url, {
    headers: {
      "user-agent": USER_AGENT,
      accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
      "accept-language": "de-DE,de;q=0.9,en;q=0.8",
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`The search engine answered ${response.status}.`);
  return response;
}

const searchCache = new Map<string, { at: number; value: WebSearchResult }>();
const pageCache = new Map<string, { at: number; value: WebPage }>();

function remembered<T>(cache: Map<string, { at: number; value: T }>, key: string, value: T): T {
  cache.set(key, { at: Date.now(), value });
  return value;
}

function cached<T>(cache: Map<string, { at: number; value: T }>, key: string, ttl: number): T | null {
  const hit = cache.get(key);
  return hit && Date.now() - hit.at < ttl ? hit.value : null;
}

export async function webSearch(query: string, count = 5): Promise<WebSearchResult> {
  if (!webEnabled()) throw new Error("Web search is turned off. Set MANAGR_WEB=1 to use it.");
  const text = query.trim().slice(0, 200);
  if (!text) throw new Error("The search query is empty.");
  const limit = Math.min(Math.max(Math.trunc(count), 1), MAX_RESULTS);
  const key = `${limit}:${text.toLocaleLowerCase()}`;
  const hit = cached(searchCache, key, SEARCH_TTL);
  if (hit) return hit;

  const errors: string[] = [];
  const custom = process.env.MANAGR_WEB_SEARCH_URL?.trim();
  if (custom) {
    try {
      const url = new URL(custom);
      if (url.pathname === "/" || url.pathname === "") url.pathname = "/search";
      url.searchParams.set("q", text);
      url.searchParams.set("format", "json");
      url.searchParams.set("language", "de");
      const payload = (await (await searchRequest(url.toString())).json()) as {
        results?: { title?: string; url?: string; content?: string }[];
      };
      const results = dedupe(
        (payload.results ?? []).flatMap((item) =>
          item.url && item.title ? [{ title: item.title, url: item.url, snippet: item.content ?? "" }] : [],
        ),
      ).slice(0, limit);
      if (results.length) return remembered(searchCache, key, { query: text, engine: "custom", results });
      errors.push("The configured search endpoint returned no results.");
    } catch (error) {
      errors.push(message(error));
    }
  }

  try {
    const html = await (await searchRequest(`https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(text)}`)).text();
    const results = parseDuckDuckGoResults(html).slice(0, limit);
    if (results.length) return remembered(searchCache, key, { query: text, engine: "duckduckgo", results });
    errors.push("DuckDuckGo returned no results.");
  } catch (error) {
    errors.push(message(error));
  }

  try {
    const html = await (
      await searchRequest(`https://www.bing.com/search?q=${encodeURIComponent(text)}&setlang=de&cc=DE`)
    ).text();
    const results = parseBingResults(html).slice(0, limit);
    if (results.length) return remembered(searchCache, key, { query: text, engine: "bing", results });
    errors.push("Bing returned no results.");
  } catch (error) {
    errors.push(message(error));
  }

  throw new Error(`The web search failed. ${errors.join(" ")}`.trim());
}

export async function webFetch(rawUrl: string): Promise<WebPage> {
  if (!webEnabled()) throw new Error("Web access is turned off. Set MANAGR_WEB=1 to use it.");
  const url = rawUrl.trim().slice(0, 2_000);
  const hit = cached(pageCache, url, FETCH_TTL);
  if (hit) return hit;

  const { response, text } = await requestPage(url);
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType && !/text\/|html|xml|json/i.test(contentType)) {
    throw new Error(`The page is ${contentType.split(";")[0]}, not readable text.`);
  }
  const isHtml = /html|xml/i.test(contentType) || /<html[\s>]/i.test(text.slice(0, 1_000));
  const extracted = isHtml ? htmlToText(text) : { title: "", text: collapse(text) };
  const readable = extracted.text.slice(0, MAX_TEXT) || "The page did not contain readable text.";
  const emails = [...new Set([...emailsIn(text), ...emailsIn(readable)])].slice(0, 10);
  return remembered(pageCache, url, {
    url: response.url || url,
    title: extracted.title,
    text: readable,
    truncated: extracted.text.length > MAX_TEXT,
    emails,
  });
}