export type ValidationLevel = "error" | "warning" | "information";

export type ValidationMessage = {
  code: string;
  level: ValidationLevel;
  text: string;
};

export type CheckResult =
  | { state: "checked"; valid: boolean; accepted: boolean; messages: ValidationMessage[] }
  | { state: "blocked"; blockers: string[] }
  | { state: "unavailable" };

function attribute(attrs: string, name: string): string {
  return new RegExp(`\\b${name}="([^"]*)"`).exec(attrs)?.[1] ?? "";
}

function decodeEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function plainText(xml: string): string {
  return decodeEntities(xml.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

export function parseXRechnungReport(report: string): Extract<CheckResult, { state: "checked" }> {
  const valid = /<rep:report\b[^>]*\bvalid="true"/.test(report);
  const accepted = /<rep:accept[\s/>]/.test(report);
  const messages: ValidationMessage[] = [];
  for (const match of report.matchAll(/<rep:message\b([^>]*)>([\s\S]*?)<\/rep:message>/g)) {
    const attrs = match[1];
    const level = attribute(attrs, "level");
    const text = plainText(match[2]);
    if (!text) continue;
    messages.push({
      code: attribute(attrs, "code"),
      level: level === "error" || level === "warning" ? level : "information",
      text,
    });
  }
  return { state: "checked", valid, accepted, messages };
}
