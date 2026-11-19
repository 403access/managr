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
      case "strike":
        return (
          <del key={key} className="line-through">
            {inline(node.children, key)}
          </del>
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

const TABLE_ALIGN = { left: "text-left", center: "text-center", right: "text-right" } as const;

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
      const hasTasks = Boolean(node.checked?.length);
      const items = node.items.map((item, index) => {
        if (!hasTasks) {
          return (
            <li key={`${key}-${index}`} className="whitespace-pre-wrap">
              {inline(item, `${key}-${index}`)}
            </li>
          );
        }
        const state = node.checked?.[index];
        return (
          <li key={`${key}-${index}`} className="flex items-start gap-2 whitespace-pre-wrap">
            {state === undefined ? (
              <span className="mt-1 size-4 shrink-0" aria-hidden="true" />
            ) : (
              <input type="checkbox" checked={state} readOnly disabled className="mt-0.5 size-4 shrink-0 accent-pine" />
            )}
            <span className="min-w-0 flex-1">{inline(item, `${key}-${index}`)}</span>
          </li>
        );
      });
      if (node.ordered) {
        return (
          <ol key={key} start={node.start} className={`grid gap-1 leading-relaxed ${hasTasks ? "" : "list-decimal pl-5"}`}>
            {items}
          </ol>
        );
      }
      return (
        <ul key={key} className={`grid gap-1 leading-relaxed ${hasTasks ? "" : "list-disc pl-5"}`}>
          {items}
        </ul>
      );
    }
    case "table":
      return (
        <div key={key} className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-[12px] leading-relaxed">
            <thead>
              <tr className="border-b border-line">
                {node.header.map((cell, column) => (
                  <th
                    key={`${key}-h-${column}`}
                    className={`px-2 py-1 font-semibold ${TABLE_ALIGN[node.align[column] ?? "left"]}`}
                  >
                    {inline(cell, `${key}-h-${column}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {node.rows.map((row, rowIndex) => (
                <tr key={`${key}-r-${rowIndex}`} className="border-b border-line/60 last:border-0">
                  {row.map((cell, column) => (
                    <td
                      key={`${key}-r-${rowIndex}-c-${column}`}
                      className={`px-2 py-1 align-top ${TABLE_ALIGN[node.align[column] ?? "left"]}`}
                    >
                      {inline(cell, `${key}-r-${rowIndex}-c-${column}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
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