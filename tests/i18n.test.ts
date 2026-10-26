import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { journalImbalance } from "@/domain/accounts";
import { statutoryObligations, type ObligationSettings } from "@/domain/obligations";
import { estimateContributions } from "@/domain/social";
import { timeWarnings } from "@/domain/time";
import { openDatabase } from "@/db/client";
import { localizeSample, seedIfEmpty } from "@/db/seed";
import { companies, journalEntries, tasks } from "@/db/schema";
import { parseLocale, tx } from "@/i18n";
import { eq } from "drizzle-orm";

const files: string[] = [];

afterEach(() => {
  for (const file of files.splice(0)) fs.rmSync(file, { force: true });
});

const settings: ObligationSettings[] = [
  { fiscalYearStartMonth: 1, vatPermanentExtension: false, usesTaxAdvisor: false },
  { fiscalYearStartMonth: 1, vatPermanentExtension: true, usesTaxAdvisor: false },
  { fiscalYearStartMonth: 1, vatPermanentExtension: false, usesTaxAdvisor: true },
];

describe("locale", () => {
  it("defaults to German", () => {
    expect(parseLocale(undefined)).toBe("de");
    expect(parseLocale("")).toBe("de");
    expect(parseLocale("fr")).toBe("de");
    expect(parseLocale("en")).toBe("en");
  });
});

describe("statutory phrases", () => {
  it("translates every generated obligation for 2026 and 2027", () => {
    for (const year of [2026, 2027]) {
      for (const setting of settings) {
        for (const item of statutoryObligations(year, setting)) {
          expect(tx("en", item.title)).toBe(item.title);
          expect(tx("en", item.detail)).toBe(item.detail);
          expect(tx("de", item.title)).not.toBe(item.title);
          expect(tx("de", item.detail)).not.toBe(item.detail);
        }
      }
    }
  });

  it("uses the statutory German terms", () => {
    expect(tx("de", "VAT return March 2026")).toContain("Umsatzsteuer-Voranmeldung");
    expect(tx("de", "VAT return March 2026")).toContain("März");
    const pause = timeWarnings(361, 0).find((warning) => warning.message.includes("30-minute"));
    expect(pause).toBeTruthy();
    expect(tx("de", pause?.message ?? "")).toContain("§ 4 ArbZG");
    expect(tx("de", pause?.message ?? "")).toContain("30 Minuten");
    const imbalance = journalImbalance([
      { accountCode: "1200", debitCents: 100, creditCents: 0 },
      { accountCode: "4900", debitCents: 0, creditCents: 95 },
    ]);
    expect(tx("de", imbalance ?? "")).toContain("unausgeglichen");
    const estimate = estimateContributions({
      grossMonthlyCents: 100_000,
      kind: "minijob",
      ownershipBps: 0,
      svStatus: "subject",
      stateCode: "BE",
      additionalKvBps: 290,
      childlessSurcharge: false,
      careDiscountSteps: 0,
      minijobPublicHealth: true,
      pensionOptOut: false,
      flatTax: true,
    });
    const ceiling = estimate.warnings.find((warning) => warning.includes("minijob ceiling"));
    expect(ceiling).toBeTruthy();
    expect(tx("de", ceiling ?? "")).toContain("Geringfügigkeitsgrenze");
  });
});

describe("sample copy", () => {
  it("rewrites a known English sample sentence and leaves other companies alone", () => {
    const file = path.join(os.tmpdir(), `managr-i18n-${Date.now()}.db`);
    files.push(file);
    const db = openDatabase(file);
    seedIfEmpty(db);
    const seeded = db.select().from(tasks).all();
    expect(seeded.some((task) => task.title.includes("Havel"))).toBe(true);
    expect(seeded.some((task) => task.title.startsWith("Chase"))).toBe(false);

    const entry = db.select().from(journalEntries).all()[0];
    expect(entry).toBeTruthy();
    db.update(journalEntries).set({ memo: "Studio rent" }).where(eq(journalEntries.id, entry!.id)).run();
    localizeSample(db);
    const rewritten = db.select().from(journalEntries).where(eq(journalEntries.id, entry!.id)).get();
    expect(rewritten?.memo).toBe("Studiomiete");

    db.update(companies).set({ isSample: false }).run();
    db.update(journalEntries).set({ memo: "Studio rent" }).where(eq(journalEntries.id, entry!.id)).run();
    localizeSample(db);
    const kept = db.select().from(journalEntries).where(eq(journalEntries.id, entry!.id)).get();
    expect(kept?.memo).toBe("Studio rent");
  });
});
