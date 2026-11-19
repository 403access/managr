import { BANK_CODES } from "./bank-codes.data";
import { germanBankCode, isValidIban } from "./iban";

/** The BIC and bank name of a German Bankleitzahl. */
export type GermanBank = {
  bic: string;
  name: string;
};

let table: Map<string, GermanBank> | null = null;

function banks(): Map<string, GermanBank> {
  if (table) return table;
  table = new Map();
  for (const line of BANK_CODES.split("\n")) {
    const [code, bic, name] = line.split("\t");
    if (code && bic) table.set(code, { bic, name: name ?? "" });
  }
  return table;
}

/**
 * Resolve the BIC and bank name from a checksum-valid German IBAN. The table
 * is the Deutsche Bundesbank Bankleitzahlendatei, refreshed by
 * `scripts/build-bank-codes.ts`. Other countries return null.
 */
export function lookupGermanBank(iban: string): GermanBank | null {
  if (!isValidIban(iban)) return null;
  const code = germanBankCode(iban);
  return code ? banks().get(code) ?? null : null;
}