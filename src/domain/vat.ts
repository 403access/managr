import { REDUCED_VAT_BPS, STANDARD_VAT_BPS } from "./rates-2026";
import { percentOf } from "./money";

export function isSupportedVat(bps: number): boolean {
  return bps === 0 || bps === REDUCED_VAT_BPS || bps === STANDARD_VAT_BPS;
}

export function lineNetCents(quantityMilli: number, unitNetCents: number): number {
  if (!Number.isInteger(quantityMilli) || !Number.isInteger(unitNetCents)) {
    throw new Error("Quantity and price must be integers.");
  }
  if (quantityMilli <= 0 || unitNetCents < 0) throw new Error("Quantity must be positive and price cannot be negative.");
  return Math.round((quantityMilli * unitNetCents) / 1000);
}

export type VatBreakdown = {
  vatBps: number;
  netCents: number;
  vatCents: number;
};

export function summarizeVat(
  lines: { netCents: number; vatBps: number }[],
  kleinunternehmer: boolean,
): { netCents: number; vatCents: number; grossCents: number; byRate: VatBreakdown[] } {
  const nets = new Map<number, number>();
  for (const line of lines) {
    if (!isSupportedVat(line.vatBps)) throw new Error("Unsupported VAT rate.");
    if (!Number.isInteger(line.netCents) || line.netCents < 0) throw new Error("Net amount must be whole cents.");
    if (kleinunternehmer && line.vatBps !== 0) throw new Error("A Kleinunternehmer invoice uses a 0% rate.");
    nets.set(line.vatBps, (nets.get(line.vatBps) ?? 0) + line.netCents);
  }
  const byRate = [...nets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([vatBps, netCents]) => ({
      vatBps,
      netCents,
      vatCents: kleinunternehmer ? 0 : percentOf(netCents, vatBps),
    }));
  const netCents = byRate.reduce((sum, rate) => sum + rate.netCents, 0);
  const vatCents = byRate.reduce((sum, rate) => sum + rate.vatCents, 0);
  return { netCents, vatCents, grossCents: netCents + vatCents, byRate };
}
