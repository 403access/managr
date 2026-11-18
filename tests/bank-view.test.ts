import fs from "fs";
import os from "os";
import path from "path";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { bankAccounts, bankConnections, bankTransactions } from "@/db/schema";
import { connectBank, syncBankConnection } from "@/server/bank";
import { bankView } from "@/server/views";

const repo = process.cwd();
let dir = "";
let transactionFroms: string[] = [];

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "managr-bank-"));
  fs.cpSync(path.join(repo, "src/db/migrations"), path.join(dir, "src/db/migrations"), { recursive: true });
  process.chdir(dir);
  getDb();
});

afterAll(() => {
  process.chdir(repo);
  fs.rmSync(dir, { recursive: true, force: true });
});

afterEach(() => {
  vi.unstubAllGlobals();
  transactionFroms = [];
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function stubQonto(organization: unknown, transactions: Record<string, unknown[]>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request) => {
      const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url);
      if (url.pathname.endsWith("/organization")) return json({ organization });
      if (url.pathname.endsWith("/transactions")) {
        const id = url.searchParams.get("bank_account_id") ?? "";
        transactionFroms.push(url.searchParams.get("updated_at_from") ?? "");
        return json({ transactions: transactions[id] ?? [], meta: { next_page: null } });
      }
      return json({ errors: [{ detail: "unexpected path" }] }, 500);
    }),
  );
}

const organization = {
  id: "org-1",
  name: "Atelier Nordlicht",
  slug: "atelier-nordlicht-1234",
  legal_name: "Atelier Nordlicht UG (haftungsbeschränkt)",
  bank_accounts: [
    {
      id: "acct-1",
      name: "Geschäftskonto",
      iban: "DE02120300000000202051",
      bic: "BYLADEM1001",
      balance_cents: 100_000,
      authorized_balance_cents: 95_000,
      status: "active",
      main: true,
    },
    {
      id: "acct-2",
      name: "Rücklage",
      iban: "DE02120300000000202052",
      balance_cents: 5_000,
      authorized_balance_cents: 5_000,
      status: "active",
      main: false,
    },
  ],
};

const firstTransactions = {
  "acct-1": [
    {
      id: "tx-1",
      bank_account_id: "acct-1",
      amount_cents: 119_000,
      side: "credit",
      status: "completed",
      label: "Kundin",
      reference: "RE-2026-0001",
      settled_at: "2026-11-10T10:00:00.000Z",
    },
    {
      id: "tx-2",
      bank_account_id: "acct-1",
      amount_cents: 5_000,
      side: "debit",
      status: "pending",
      label: "Bahn",
      emitted_at: "2026-11-18T08:00:00.000Z",
    },
  ],
  "acct-2": [
    {
      id: "tx-3",
      bank_account_id: "acct-2",
      amount_cents: 1_900,
      side: "debit",
      status: "completed",
      label: "Büro",
      settled_at: "2025-12-31T10:00:00.000Z",
    },
  ],
};

describe("Qonto sync and view", () => {
  it("stores a connection, its accounts, and the transactions without exposing the secret", async () => {
    stubQonto(organization, firstTransactions);
    const result = await connectBank({
      companyId: 1,
      login: "pied-piper-7132",
      secretKey: "0123456789",
      environment: "production",
      stagingToken: "",
    });

    expect(result).toMatchObject({ orgName: "Atelier Nordlicht", accounts: 2, transactions: 3, transactionError: "" });
    const db = getDb();
    const connection = db.select().from(bankConnections).get();
    expect(connection?.login).toBe("pied-piper-7132");
    expect(connection?.orgSlug).toBe("atelier-nordlicht-1234");
    expect(connection?.status).toBe("ok");
    expect(connection?.lastSyncedAt).toBeTruthy();
    expect(db.select().from(bankAccounts).all()).toHaveLength(2);
    expect(db.select().from(bankTransactions).all()).toHaveLength(3);

    const view = bankView(2026, false);
    expect(view.transactions).toHaveLength(2);
    expect(view.summary).toMatchObject({
      completedCount: 1,
      pendingCount: 1,
      inflowCents: 119_000,
      outflowCents: 0,
      netCents: 119_000,
    });
    expect(view.totals).toMatchObject({ balanceCents: 105_000, accountCount: 2, activeCount: 2 });
    expect(view.connection?.secretHint).toBe("••••6789");
    expect(JSON.stringify(view)).not.toContain("0123456789");

    const all = bankView(2026, true);
    expect(all.transactions).toHaveLength(3);
    expect(all.years).toContain(2025);
  });

  it("syncs with an overlapping window and updates the stored transaction", async () => {
    const db = getDb();
    const before = db.select().from(bankConnections).get();
    stubQonto(
      {
        ...organization,
        bank_accounts: [{ ...organization.bank_accounts[0], balance_cents: 200_000 }],
      },
      {
        "acct-1": [
          {
            id: "tx-1",
            bank_account_id: "acct-1",
            amount_cents: 119_000,
            side: "credit",
            status: "completed",
            label: "Kundin",
            settled_at: "2026-11-10T10:00:00.000Z",
          },
          {
            id: "tx-4",
            bank_account_id: "acct-1",
            amount_cents: 2_500,
            side: "debit",
            status: "completed",
            label: "Hosting",
            settled_at: "2026-11-18T09:00:00.000Z",
          },
        ],
      },
    );

    const result = await syncBankConnection(1);
    expect(result.transactions).toBe(2);
    expect(db.select().from(bankTransactions).all()).toHaveLength(4);

    const after = db.select().from(bankConnections).get();
    expect(after?.status).toBe("ok");
    expect(after?.lastSyncedAt).not.toBe(before?.lastSyncedAt);
    expect(transactionFroms.every((from) => from !== "")).toBe(true);
    expect(transactionFroms.some((from) => from > "2025-11-20")).toBe(true);
    expect(db.select().from(bankAccounts).where(eq(bankAccounts.externalId, "acct-1")).get()?.balanceCents).toBe(200_000);
    expect(db.select().from(bankAccounts).where(eq(bankAccounts.externalId, "acct-2")).get()?.status).toBe("closed");
  });

  it("marks the connection when Qonto rejects the key", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ errors: [{ detail: "invalid" }] }, 401)));
    await expect(syncBankConnection(1)).rejects.toThrow("Qonto rejected the sign-in or secret key.");
    const connection = getDb().select().from(bankConnections).get();
    expect(connection?.status).toBe("error");
    expect(connection?.lastError).toContain("rejected");
  });
});