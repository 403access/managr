/** IBAN and BIC checks shared by the e-invoice and the bank detail lookup. */

export function compactIban(value: string): string {
  return value.replace(/\s/g, "").toUpperCase();
}

export function isValidIban(value: string): boolean {
  const compact = compactIban(value);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(compact) || compact.length > 34) return false;
  const rearranged = compact.slice(4) + compact.slice(0, 4);
  let remainder = 0;
  for (const char of rearranged) {
    const chunk = char >= "A" && char <= "Z" ? String(char.charCodeAt(0) - 55) : char;
    for (const digit of chunk) remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder === 1;
}

export function isValidBic(value: string): boolean {
  return /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(value.replace(/\s/g, "").toUpperCase());
}

/** The eight-digit Bankleitzahl inside a German IBAN. */
export function germanBankCode(value: string): string | null {
  const compact = compactIban(value);
  return compact.startsWith("DE") && compact.length === 22 ? compact.slice(4, 12) : null;
}