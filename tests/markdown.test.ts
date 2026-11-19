import { describe, expect, it } from "vitest";
import { parseInline, parseMarkdown } from "@/client/markdown";

describe("markdown inline", () => {
  it("reads bold, italic, code, and a link", () => {
    expect(parseInline("Adresse von **IT Works** ist _neu_ und `1.234,56` €.")).toEqual([
      { type: "text", text: "Adresse von " },
      { type: "strong", children: [{ type: "text", text: "IT Works" }] },
      { type: "text", text: " ist " },
      { type: "emphasis", children: [{ type: "text", text: "neu" }] },
      { type: "text", text: " und " },
      { type: "code", text: "1.234,56" },
      { type: "text", text: " €." },
    ]);
    expect(parseInline("Siehe [§ 14 UStG](https://www.gesetze-im-internet.de/ustg_1980/__14.html).")).toEqual([
      { type: "text", text: "Siehe " },
      {
        type: "link",
        href: "https://www.gesetze-im-internet.de/ustg_1980/__14.html",
        children: [{ type: "text", text: "§ 14 UStG" }],
      },
      { type: "text", text: "." },
    ]);
  });

  it("keeps an unpaired marker and a half-typed bold visible", () => {
    expect(parseInline("**IT Works")).toEqual([{ type: "text", text: "**IT Works" }]);
    expect(parseInline("**IT Works** und **Süd")).toEqual([
      { type: "strong", children: [{ type: "text", text: "IT Works" }] },
      { type: "text", text: " und **Süd" },
    ]);
  });

  it("turns a bare URL into a link without the sentence period", () => {
    expect(parseInline("Quelle: https://example.com/register.")).toEqual([
      { type: "text", text: "Quelle: " },
      { type: "link", href: "https://example.com/register", children: [{ type: "text", text: "https://example.com/register" }] },
      { type: "text", text: "." },
    ]);
  });

  it("does not treat a multiplication star as emphasis", () => {
    expect(parseInline("3 * 4 = 12")).toEqual([{ type: "text", text: "3 * 4 = 12" }]);
  });

  it("reads strikethrough", () => {
    expect(parseInline("alt ~~gelöscht~~ neu")).toEqual([
      { type: "text", text: "alt " },
      { type: "strike", children: [{ type: "text", text: "gelöscht" }] },
      { type: "text", text: " neu" },
    ]);
  });
});

describe("markdown blocks", () => {
  it("groups the IT Works answer into a lead and a bullet list", () => {
    expect(parseMarkdown("Adresse von **IT Works** aktualisiert (Kunde Nr. 1):\n\n- **Südstraße 65, 74072 Heilbronn, Deutschland**\n\nEine Telefonnummer kann ich nicht speichern.")).toEqual([
      {
        type: "paragraph",
        children: [
          { type: "text", text: "Adresse von " },
          { type: "strong", children: [{ type: "text", text: "IT Works" }] },
          { type: "text", text: " aktualisiert (Kunde Nr. 1):" },
        ],
      },
      {
        type: "list",
        ordered: false,
        start: 1,
        items: [
          [
            {
              type: "strong",
              children: [{ type: "text", text: "Südstraße 65, 74072 Heilbronn, Deutschland" }],
            },
          ],
        ],
      },
      {
        type: "paragraph",
        children: [{ type: "text", text: "Eine Telefonnummer kann ich nicht speichern." }],
      },
    ]);
  });

  it("keeps a numbered list's start and a continuation line", () => {
    expect(parseMarkdown("1. Prüfen\n   mit dem Register\n2. Buchen")).toEqual([
      {
        type: "list",
        ordered: true,
        start: 1,
        items: [
          [{ type: "text", text: "Prüfen mit dem Register" }],
          [{ type: "text", text: "Buchen" }],
        ],
      },
    ]);
  });

  it("renders a fenced block as code and an unfinished fence as its remainder", () => {
    expect(parseMarkdown("```ts\nconst x = 1;\n```")).toEqual([{ type: "code", language: "ts", text: "const x = 1;" }]);
    expect(parseMarkdown("```\nnot closed yet")).toEqual([{ type: "code", language: "", text: "not closed yet" }]);
  });

  it("reads headings, a quote, and a rule", () => {
    expect(parseMarkdown("## Adresse\n> Zitiert\n---")).toEqual([
      { type: "heading", level: 2, children: [{ type: "text", text: "Adresse" }] },
      { type: "quote", children: [{ type: "text", text: "Zitiert" }] },
      { type: "rule" },
    ]);
  });

  it("reads a task list with checked and open items", () => {
    expect(parseMarkdown("- [x] Rechnung prüfen\n- [ ] Zeit buchen\n- normal")).toEqual([
      {
        type: "list",
        ordered: false,
        start: 1,
        items: [
          [{ type: "text", text: "Rechnung prüfen" }],
          [{ type: "text", text: "Zeit buchen" }],
          [{ type: "text", text: "normal" }],
        ],
        checked: [true, false, undefined],
      },
    ]);
  });

  it("reads a table with alignment and inline formatting", () => {
    expect(parseMarkdown("| **Tag** | Stunden | Betrag |\n| :--- | :---: | ---: |\n| Montag | 2 | **190,00 €** |\n| Dienstag | 3 | 285,00 € |")).toEqual([
      {
        type: "table",
        align: ["left", "center", "right"],
        header: [
          [{ type: "strong", children: [{ type: "text", text: "Tag" }] }],
          [{ type: "text", text: "Stunden" }],
          [{ type: "text", text: "Betrag" }],
        ],
        rows: [
          [
            [{ type: "text", text: "Montag" }],
            [{ type: "text", text: "2" }],
            [{ type: "strong", children: [{ type: "text", text: "190,00 €" }] }],
          ],
          [
            [{ type: "text", text: "Dienstag" }],
            [{ type: "text", text: "3" }],
            [{ type: "text", text: "285,00 €" }],
          ],
        ],
      },
    ]);
  });

  it("reads a table without outer pipes and keeps a broken table as text", () => {
    expect(parseMarkdown("Tag | Stunden\n--- | ---\nMontag | 2")).toEqual([
      {
        type: "table",
        align: [null, null],
        header: [
          [{ type: "text", text: "Tag" }],
          [{ type: "text", text: "Stunden" }],
        ],
        rows: [[[{ type: "text", text: "Montag" }], [{ type: "text", text: "2" }]]],
      },
    ]);
    expect(parseMarkdown("Tag | Stunden\nMontag | 2")).toEqual([
      { type: "paragraph", children: [{ type: "text", text: "Tag | Stunden\nMontag | 2" }] },
    ]);
  });
});