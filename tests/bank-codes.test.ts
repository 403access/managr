import { describe, expect, it } from "vitest";
import { lookupGermanBank } from "@/domain/bank-codes";
import { germanBankCode, isValidIban } from "@/domain/iban";

describe("German bank code lookup", () => {
  it("reads the Bankleitzahl from a German IBAN", () => {
    expect(germanBankCode("DE89370400440532013000")).toBe("37040044");
    expect(germanBankCode("de89 3704 0044 0532 0130 00")).toBe("37040044");
    expect(germanBankCode("AT611904300234573201")).toBeNull();
    expect(germanBankCode("DE8937040044053201")).toBeNull();
  });

  it("fills the BIC and bank name from a valid German IBAN", () => {
    expect(lookupGermanBank("DE89370400440532013000")).toEqual({
      bic: "COBADEFFXXX",
      name: "Commerzbank",
    });
    expect(lookupGermanBank("de89 3704 0044 0532 0130 00")?.bic).toBe("COBADEFFXXX");
    expect(lookupGermanBank("DE02120300000000202051")?.name).toBe("Deutsche Kreditbank Berlin");
  });

  it("does not guess for a bad checksum, a foreign IBAN, or an unknown bank code", () => {
    expect(isValidIban("DE89370400440532013001")).toBe(false);
    expect(lookupGermanBank("DE89370400440532013001")).toBeNull();
    expect(lookupGermanBank("AT611904300234573201")).toBeNull();
    expect(lookupGermanBank("DE93999999990000000001")).toBeNull();
    expect(lookupGermanBank("")).toBeNull();
  });
});