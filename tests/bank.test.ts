import { describe, expect, it } from "vitest";
import {
  bankPeriodSummary,
  bankTotals,
  mapQontoAccount,
  mapQontoTransaction,
  maskSecret,
  qontoAuthorization,
  qontoBaseUrl,
  qontoErrorMessage,
  qontoSyncWindow,
  qontoVatRateBps,
} from "@/domain/bank";

describe("Qonto mapping", () => {
  it("maps an account with cents and an active main flag", () => {
    const account = mapQontoAccount({
      id: "acct-1",
      name: "Geschäftskonto",
      iban: "DE02120300000000202051",
      bic: "BYLADEM1001",
      currency: "EUR",
      balance_cents: 123_456,
      authorized_balance_cents: 120_000,
      status: "active",
      main: true,
      is_external_account: false,
      updated_at: "2026-11-18T08:00:00.000Z",
    });
    expect(account).toEqual({
      externalId: "acct-1",
      name: "Geschäftskonto",
      slug: "",
      iban: "DE02120300000000202051",
      bic: "BYLADEM1001",
      currency: "EUR",
      balanceCents: 123_456,
      authorizedBalanceCents: 120_000,
      status: "active",
      main: true,
      external: false,
      updatedAt: "2026-11-18T08:00:00.000Z",
    });
  });

  it("needs an id and falls back to euro amounts", () => {
    expect(mapQontoAccount({ name: "No id" })).toBeNull();
    const account = mapQontoAccount({ id: "acct-2", name: "", slug: "bank-2", balance: 12.34 });
    expect(account?.name).toBe("bank-2");
    expect(account?.balanceCents).toBe(1_234);
    expect(account?.authorizedBalanceCents).toBe(0);
  });

  it("maps a debit to a negative amount and uses the Berlin booking date", () => {
    const transaction = mapQontoTransaction({
      id: "tx-1",
      transaction_id: "atelier-1",
      bank_account_id: "acct-1",
      amount_cents: 1_900,
      side: "debit",
      status: "completed",
      label: "LE PETIT BISTRO",
      clean_counterparty_name: "Le Petit Bistro",
      reference: "Mittagessen",
      vat_amount_cents: 300,
      vat_rate: 19,
      attachment_ids: ["file-1", null],
      card_last_digits: "4242",
      category: "restaurant_and_bar",
      cashflow_category: { name: "Bewirtung" },
      settled_at: "2026-11-17T23:30:00.000Z",
      transfer: { counterparty_account_number: "DE02120300000000202051", counterparty_bank_identifier: "BYLADEM1001" },
    });
    expect(transaction?.amountCents).toBe(-1_900);
    expect(transaction?.side).toBe("debit");
    expect(transaction?.bookedOn).toBe("2026-11-18");
    expect(transaction?.counterpartyName).toBe("Le Petit Bistro");
    expect(transaction?.cashflowCategory).toBe("Bewirtung");
    expect(transaction?.vatRateBps).toBe(1_900);
    expect(transaction?.attachmentCount).toBe(1);
    expect(transaction?.cardLastDigits).toBe("4242");
    expect(transaction?.counterpartyIban).toBe("DE02120300000000202051");
  });

  it("maps a credit as a positive amount and keeps uncategorized VAT", () => {
    const transaction = mapQontoTransaction({
      id: "tx-2",
      amount: 1_190,
      side: "credit",
      status: "pending",
      label: "Kunde",
      vat_rate: -1,
      emitted_at: "2026-03-01T10:00:00.000Z",
    });
    expect(transaction?.amountCents).toBe(119_000);
    expect(transaction?.vatRateBps).toBe(-100);
    expect(transaction?.status).toBe("pending");
    expect(transaction?.bookedOn).toBe("2026-03-01");
  });

  it("drops rows without an id or a date", () => {
    expect(mapQontoTransaction({ amount_cents: 100, side: "credit" })).toBeNull();
    expect(mapQontoTransaction({ id: "tx-3", amount_cents: 100, side: "credit" })).toBeNull();
  });
});

describe("bank summaries", () => {
  const accounts = [
    { balanceCents: 100_000, authorizedBalanceCents: 90_000, status: "active", main: true },
    { balanceCents: 5_000, authorizedBalanceCents: 5_000, status: "active", main: false },
    { balanceCents: 9_999, authorizedBalanceCents: 0, status: "closed", main: false },
  ];

  it("sums active accounts and the main account", () => {
    expect(bankTotals(accounts)).toEqual({
      balanceCents: 105_000,
      authorizedBalanceCents: 95_000,
      accountCount: 3,
      activeCount: 2,
      mainBalanceCents: 100_000,
    });
  });

  it("counts completed rows as inflow and outflow and keeps pending separate", () => {
    const summary = bankPeriodSummary([
      { amountCents: 119_000, status: "completed" },
      { amountCents: -19_000, status: "completed" },
      { amountCents: -5_000, status: "pending" },
      { amountCents: -7_000, status: "declined" },
    ]);
    expect(summary).toEqual({
      count: 4,
      completedCount: 2,
      pendingCount: 1,
      inflowCents: 119_000,
      outflowCents: 19_000,
      netCents: 100_000,
    });
  });
});

describe("Qonto API helpers", () => {
  it("builds the raw sign-in header and both base URLs", () => {
    expect(qontoAuthorization("pied-piper-7132", "secret")).toBe("pied-piper-7132:secret");
    expect(qontoBaseUrl("production")).toBe("https://thirdparty.qonto.com/v2");
    expect(qontoBaseUrl("sandbox")).toBe("https://thirdparty-sandbox.staging.qonto.co/v2");
  });

  it("uses a year for the first sync and one day of overlap afterwards", () => {
    const now = new Date("2026-11-18T12:00:00.000Z");
    const first = qontoSyncWindow(null, now);
    expect(first.from).toBe("2025-11-18T12:00:00.000Z");
    expect(first.to).toBe("2026-11-18T12:00:00.000Z");
    const next = qontoSyncWindow("2026-11-17T12:00:00.000Z", now);
    expect(next.from).toBe("2026-11-16T12:00:00.000Z");
    expect(qontoSyncWindow("not-a-date", now)).toEqual(first);
  });

  it("turns percent rates into basis points and masks the secret", () => {
    expect(qontoVatRateBps(19)).toBe(1_900);
    expect(qontoVatRateBps(7.5)).toBe(750);
    expect(qontoVatRateBps(-1)).toBe(-100);
    expect(qontoVatRateBps(null)).toBeNull();
    expect(maskSecret("1234567890")).toBe("••••7890");
    expect(maskSecret("abc")).toBe("••••");
  });

  it("names the likely cause of an HTTP error", () => {
    expect(qontoErrorMessage(401)).toContain("rejected");
    expect(qontoErrorMessage(403)).toContain("organization.read");
    expect(qontoErrorMessage(429)).toContain("limiting");
    expect(qontoErrorMessage(500, "boom")).toBe("Qonto returned HTTP 500. boom");
  });
});