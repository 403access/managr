"use server";

import { loadCompany, loadInvoice } from "./queries";import { checkXRechnungXml } from "./validator";
import type { CheckResult } from "./validator-report";
import { xrechnungFile } from "./xrechnung";

export async function checkInvoiceXRechnung(invoiceId: number): Promise<CheckResult> {
  const loaded = loadInvoice(invoiceId);
  if (!loaded) return { state: "unavailable" };
  const file = xrechnungFile(loaded.company, loaded);
  if ("blockers" in file) return { state: "blocked", blockers: file.blockers };
  return checkXRechnungXml(file.xml, file.filename);
}
