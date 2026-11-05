import { describe, expect, it } from "vitest";
import { parseXRechnungReport } from "@/server/validator-report";

function report(options: { valid: boolean; accept: boolean; messages?: string }): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<rep:report xmlns:rep="http://www.xoev.de/de/validator/varl/1" valid="${options.valid}">
  <rep:scenarioMatched>${options.messages ?? ""}</rep:scenarioMatched>
  <rep:assessment>${options.accept ? "<rep:accept><rep:explanation/></rep:accept>" : "<rep:reject><rep:explanation/></rep:reject>"}</rep:assessment>
</rep:report>`;
}

describe("XRechnung report", () => {
  it("reads conformance and acceptance", () => {
    expect(parseXRechnungReport(report({ valid: true, accept: true }))).toMatchObject({ valid: true, accepted: true });
    expect(parseXRechnungReport(report({ valid: false, accept: false }))).toMatchObject({ valid: false, accepted: false });
  });

  it("keeps the verdict when the report has no messages", () => {
    expect(parseXRechnungReport(report({ valid: false, accept: false })).messages).toEqual([]);
  });

  it("collects rule code, level, and text and decodes entities", () => {
    const parsed = parseXRechnungReport(
      report({
        valid: false,
        accept: false,
        messages: `
          <rep:message id="a" level="error" code="BR-DE-1">&lt;Fehler&gt; &amp; Grund</rep:message>
          <rep:message id="b" level="warning" code="BR-DE-2">Warnung</rep:message>
          <rep:message id="c" level="information" code="BR-DE-3">Hinweis</rep:message>
          <rep:message id="d" level="unknown" code="BR-DE-4">Unbekannt</rep:message>
          <rep:message id="e" level="error" code="BR-DE-5">   </rep:message>`,
      }),
    );
    expect(parsed.messages).toEqual([
      { code: "BR-DE-1", level: "error", text: "<Fehler> & Grund" },
      { code: "BR-DE-2", level: "warning", text: "Warnung" },
      { code: "BR-DE-3", level: "information", text: "Hinweis" },
      { code: "BR-DE-4", level: "information", text: "Unbekannt" },
    ]);
  });

  it("drops nested markup from the message text", () => {
    const parsed = parseXRechnungReport(
      report({
        valid: false,
        accept: false,
        messages: `<rep:message level="error" code="BR-DE-6">Text <html:b>fett</html:b> Ende</rep:message>`,
      }),
    );
    expect(parsed.messages[0]?.text).toBe("Text fett Ende");
  });
});
