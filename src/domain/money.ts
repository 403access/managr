export function percentOf(cents: number, bps: number): number {
  if (!Number.isInteger(cents) || !Number.isInteger(bps)) {
    throw new Error("Money and rates must be integers.");
  }
  if (cents < 0 || bps < 0) throw new Error("Money and rates cannot be negative.");
  return Math.round((cents * bps) / 10_000);
}

/**
 * Accepts 1234,56 / 1.234,56 / 1,234.56 / 49.90 / 1.000.
 * A lone dot-group of thousands (1.000) is one thousand euros, which is the German reading.
 */
export function parseEuroToCents(raw: string): number | null {
  return parseScaled(raw, 2);
}

export function parseQuantityMilli(raw: string): number | null {
  return parseScaled(raw, 3);
}

function parseScaled(raw: string, scale: number): number | null {
  const text = raw.trim().replace(/€/g, "").replace(/\s/g, "");
  if (!text || !/^[\d.,]+$/.test(text)) return null;
  const lastComma = text.lastIndexOf(",");
  const lastDot = text.lastIndexOf(".");
  let decimalSep = "";
  if (lastComma >= 0 && lastDot >= 0) {
    decimalSep = lastComma > lastDot ? "," : ".";
  } else if (lastComma >= 0) {
    decimalSep = ",";
  } else if (lastDot >= 0) {
    decimalSep = /^\d{1,3}(\.\d{3})+$/.test(text) ? "" : ".";
  }

  let whole: string;
  let frac = "";
  if (!decimalSep) {
    whole = text.replace(/[.,]/g, "");
  } else {
    const index = text.lastIndexOf(decimalSep);
    whole = text.slice(0, index).replace(/[.,]/g, "");
    frac = text.slice(index + 1);
    if (frac.length > scale) return null;
  }
  if (!/^\d+$/.test(whole) || (frac !== "" && !/^\d+$/.test(frac))) return null;
  const digits = Number(whole) * 10 ** scale + Number(frac.padEnd(scale, "0"));
  if (!Number.isSafeInteger(digits)) return null;
  return digits;
}

export function formatEuro(cents: number): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(cents / 100);
}

export function formatQuantity(milli: number): string {
  return new Intl.NumberFormat("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 3 }).format(milli / 1000);
}

export function formatPercentBps(bps: number): string {
  return `${new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(bps / 100)} %`;
}
