import "server-only";
import { parseXRechnungReport, type CheckResult } from "./validator-report";

const DEFAULT_URL = "http://127.0.0.1:8090";

export function validatorUrl(): string {
  return (process.env.VALIDATOR_URL ?? DEFAULT_URL).replace(/\/+$/, "");
}

export async function checkXRechnungXml(xml: string, filename: string): Promise<CheckResult> {
  let response: Response;
  try {
    response = await fetch(`${validatorUrl()}/${encodeURIComponent(filename)}`, {
      method: "POST",
      headers: { "Content-Type": "application/xml; charset=utf-8" },
      body: xml,
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    return { state: "unavailable" };
  }
  if (response.status !== 200 && response.status !== 406) return { state: "unavailable" };
  return parseXRechnungReport(await response.text());
}
