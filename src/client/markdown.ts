/**
 * A small Markdown reader for the assistant answer. It covers what a chat model
 * writes in practice - bold, italics, inline code, links, lists, quotes, code
 * blocks, and headings - and returns plain objects so the panel can render them
 * as React. Raw HTML is never produced, and a marker without its pair stays
 * visible, which keeps a half-streamed answer readable.
 */

export type InlineNode =
  | { type: "text"; text: string }
  | { type: "strong"; children: InlineNode[] }
  | { type: "emphasis"; children: InlineNode[] }
  | { type: "code"; text: string }
  | { type: "link"; href: string; children: InlineNode[] };

export type MarkdownBlock =
  | { type: "paragraph"; children: InlineNode[] }
  | { type: "heading"; level: number; children: InlineNode[] }
  | { type: "list"; ordered: boolean; start: number; items: InlineNode[][] }
  | { type: "code"; language: string; text: string }
  | { type: "quote"; children: InlineNode[] }
  | { type: "rule" };

type InlineMatch = {
  kind: "code" | "link" | "strong" | "emphasis" | "autolink";
  index: number;
  length: number;
  text?: string;
  href?: string;
  inner?: string;
};

const INLINE_PATTERNS: { kind: InlineMatch["kind"]; pattern: RegExp }[] = [
  { kind: "code", pattern: /`([^`\n]+)`/g },
  { kind: "link", pattern: /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]*)\)/g },
  { kind: "strong", pattern: /\*\*(?=\S)([\s\S]*?[^\s*])\*\*/g },
  { kind: "strong", pattern: /__(?=\S)([\s\S]*?[^\s_])__/g },
  { kind: "emphasis", pattern: /(?<![*\w])\*(?=\S)([^*\n]*?[^\s*])\*(?![*\w])/g },
  { kind: "emphasis", pattern: /(?<![_\w])_(?=\S)([^_\n]*?[^\s_])_(?![_\w])/g },
  { kind: "autolink", pattern: /(?<!["'(])https?:\/\/[^\s<>]+/g },
];

function matchFrom(text: string, offset: number): InlineMatch | null {
  let best: InlineMatch | null = null;
  for (const { kind, pattern } of INLINE_PATTERNS) {
    pattern.lastIndex = offset;
    const match = pattern.exec(text);
    if (!match) continue;
    const candidate: InlineMatch = { kind, index: match.index, length: match[0].length };
    if (kind === "code") candidate.text = match[1];
    else if (kind === "link") {
      candidate.text = match[1];
      candidate.href = match[2];
    } else if (kind === "autolink") {
      candidate.href = trimUrl(match[0]);
      candidate.length = candidate.href.length;
    } else candidate.inner = match[1];
    // The first marker wins; at the same index the earlier pattern (strong before
    // emphasis) wins, so **bold** is never read as two italics.
    if (!best || candidate.index < best.index) best = candidate;
  }
  return best;
}

/** A URL at the end of a sentence keeps the punctuation outside the link. */
function trimUrl(url: string): string {
  let next = url.replace(/[.,;:!?]+$/, "");
  while (next.endsWith(")")) {
    const close = (next.match(/\)/g) ?? []).length;
    const open = (next.match(/\(/g) ?? []).length;
    if (close <= open) break;
    next = next.slice(0, -1);
  }
  return next;
}

function pushText(nodes: InlineNode[], text: string): void {
  if (!text) return;
  const last = nodes[nodes.length - 1];
  if (last?.type === "text") last.text += text;
  else nodes.push({ type: "text", text });
}

export function parseInline(text: string): InlineNode[] {
  const nodes: InlineNode[] = [];
  let cursor = 0;
  for (;;) {
    const match = matchFrom(text, cursor);
    if (!match) break;
    pushText(nodes, text.slice(cursor, match.index));
    if (match.kind === "code") {
      nodes.push({ type: "code", text: match.text ?? "" });
    } else if (match.kind === "link") {
      nodes.push({ type: "link", href: match.href ?? "", children: parseInline(match.text ?? "") });
    } else if (match.kind === "autolink") {
      const href = match.href ?? "";
      nodes.push({ type: "link", href, children: [{ type: "text", text: href }] });
    } else if (match.kind === "strong") {
      nodes.push({ type: "strong", children: parseInline(match.inner ?? "") });
    } else {
      nodes.push({ type: "emphasis", children: parseInline(match.inner ?? "") });
    }
    cursor = match.index + match.length;
  }
  pushText(nodes, text.slice(cursor));
  return nodes;
}

const FENCE = /^\s*(```+|~~~+)\s*([\w+#.-]*)\s*$/;
const HEADING = /^(#{1,6})\s+(.*)$/;
const RULE = /^\s*([-*_])(?:\s*\1){2,}\s*$/;
const BULLET = /^\s*[-*+]\s+(.*)$/;
const NUMBERED = /^\s*(\d{1,3})[.)]\s+(.*)$/;
const QUOTE = /^\s*>\s?(.*)$/;

function isBlockStart(line: string): boolean {
  return FENCE.test(line) || HEADING.test(line) || RULE.test(line) || BULLET.test(line) || NUMBERED.test(line) || QUOTE.test(line);
}

export function parseMarkdown(source: string): MarkdownBlock[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks: MarkdownBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }

    const fence = FENCE.exec(line);
    if (fence) {
      const marker = fence[1][0];
      const size = fence[1].length;
      const closing = new RegExp(`^\\s*${marker}{${size},}\\s*$`);
      const body: string[] = [];
      index += 1;
      while (index < lines.length && !closing.test(lines[index])) {
        body.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      blocks.push({ type: "code", language: fence[2] ?? "", text: body.join("\n") });
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      blocks.push({ type: "heading", level: heading[1].length, children: parseInline(heading[2].trim()) });
      index += 1;
      continue;
    }

    if (RULE.test(line)) {
      blocks.push({ type: "rule" });
      index += 1;
      continue;
    }

    if (QUOTE.test(line)) {
      const body: string[] = [];
      while (index < lines.length) {
        const quoted = QUOTE.exec(lines[index]);
        if (!quoted) break;
        body.push(quoted[1]);
        index += 1;
      }
      blocks.push({ type: "quote", children: parseInline(body.join("\n")) });
      continue;
    }

    const bullet = BULLET.exec(line);
    const numbered = NUMBERED.exec(line);
    if (bullet || numbered) {
      const ordered = Boolean(numbered);
      const start = numbered ? Number(numbered[1]) : 1;
      const items: InlineNode[][] = [];
      while (index < lines.length) {
        const current = lines[index];
        const item = ordered ? NUMBERED.exec(current) : BULLET.exec(current);
        if (item) {
          items.push(parseInline(item[ordered ? 2 : 1]));
          index += 1;
          continue;
        }
        // A plain, indented line continues the item it follows.
        if (current.trim() && !isBlockStart(current)) {
          const previous = items[items.length - 1];
          if (previous) pushText(previous, ` ${current.trim()}`);
          index += 1;
          continue;
        }
        break;
      }
      blocks.push({ type: "list", ordered, start, items });
      continue;
    }

    const paragraph: string[] = [];
    while (index < lines.length && lines[index].trim() && !isBlockStart(lines[index])) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    if (paragraph.length > 0) blocks.push({ type: "paragraph", children: parseInline(paragraph.join("\n")) });
  }

  return blocks;
}