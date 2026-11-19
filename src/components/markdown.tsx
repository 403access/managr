import Link from "next/link";
import type { ReactNode } from "react";
import { parseMarkdown, type InlineNode, type MarkdownBlock } from "@/client/markdown";

function inline(nodes: InlineNode[], prefix: string): ReactNode[] {
  return nodes.map((node, index) => {
    const key = `${prefix}-${index}`;
    switch (node.type) {
      case "text":
        return node.text;
      case "code":
        return (
          <code key={key} className="rounded bg-ink/10 px-1 py-0.5 font-mono text-[0.9em]">
            {node.text}
          </code>
        );
      case "strong":
        return (
          <strong key={key} className="font-semibold">
            {inline(node.children, key)}
          </strong>
        );
      case "emphasis":
        return (
          <em key={key} className="italic">
            {inline(node.children, key)}
          </em>
        );
      case "link": {
        const className = "text-pine underline underline-offset-2 hover:text-pine-deep";
        const children = inline(node.children, key);
        return node.href.startsWith("/") && !node.href.startsWith("//") ? (
          <Link key={key} href={node.href} className={className}>
            {children}
          </Link>
        ) : (
          <a key={key} href={node.href} target="_blank" rel="noreferrer" className={className}>
            {children}
          </a>
        );
      }
    }
  });
}

const HEADING_CLASS: Record<number, string> = {
  1: "font-display text-base font-semibold",
  2: "font-display text-sm font-semibold",
  3: "font-display text-sm font-medium",
  4: "font-sans text-sm font-semibold",
  5: "font-sans text-sm font-medium",
  6: "font-sans text-xs font-semibold tracking-wide uppercase",
};

function block(node: MarkdownBlock, key: string): ReactNode {
  switch (node.type) {
    case "paragraph":
      return (
        <p key={key} className="whitespace-pre-wrap leading-relaxed">
          {inline(node.children, key)}
        </p>
      );
    case "heading": {
      const Tag = (node.level <= 3 ? "h3" : node.level === 4 ? "h4" : node.level === 5 ? "h5" : "h6") as "h3" | "h4" | "h5" | "h6";
      return (
        <Tag key={key} className={HEADING_CLASS[node.level] ?? HEADING_CLASS[6]}>
          {inline(node.children, key)}
        </Tag>
      );
    }
    case "list": {
      const items = node.items.map((item, index) => (
        <li key={`${key}-${index}`} className="whitespace-pre-wrap">
          {inline(item, `${key}-${index}`)}
        </li>
      ));
      return node.ordered ? (
        <ol key={key} start={node.start} className="grid list-decimal gap-1 pl-5 leading-relaxed">
          {items}
        </ol>
      ) : (
        <ul key={key} className="grid list-disc gap-1 pl-5 leading-relaxed">
          {items}
        </ul>
      );
    }
    case "code":
      return (
        <pre key={key} className="overflow-x-auto rounded-lg bg-ink/5 p-2 font-mono text-[11px] leading-relaxed">
          <code>{node.text}</code>
        </pre>
      );
    case "quote":
      return (
        <blockquote key={key} className="whitespace-pre-wrap border-l-2 border-line pl-3 text-muted">
          {inline(node.children, key)}
        </blockquote>
      );
    case "rule":
      return <hr key={key} className="border-line" />;
  }
}

/**
 * Renders an assistant answer as formatted text. Inline HTML in the model's
 * output is shown as text, never executed; a link only points at http(s) or at
 * a path inside the desk.
 */
export function Markdown({ text, className = "" }: { text: string; className?: string }) {
  const blocks = parseMarkdown(text);
  return <div className={`grid gap-2 ${className}`}>{blocks.map((node, index) => block(node, `block-${index}`))}</div>;
}