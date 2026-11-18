import "server-only";
import { and, eq, notInArray } from "drizzle-orm";
import { getDb } from "@/db/client";
import { bankAccounts, bankConnections, bankTransactions } from "@/db/schema";
import { mapQontoAccount, mapQontoTransaction, qontoSyncWindow, type QontoEnvironment, type QontoOrganization } from "@/domain/bank";
import { fetchQontoOrganization, fetchQontoTransactions, type QontoCredentials } from "./qonto";

type Connection = typeof bankConnections.$inferSelect;

export type BankSyncResult = {
  accounts: number;
  transactions: number;
  lastSyncedAt: string;
};

export type BankConnectResult = {
  connectionId: number;
  orgName: string;
  accounts: number;
  transactions: number;
  lastSyncedAt: string | null;
  transactionError: string;
};

function credentialsOf(connection: Connection): QontoCredentials {
  return {
    login: connection.login,
    secretKey: connection.secretKey,
    environment: connection.environment as QontoEnvironment,
    stagingToken: connection.stagingToken,
  };
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "Qonto could not be synchronized.";
}

function markConnection(
  connectionId: number,
  values: {
    status: string;
    lastError: string;
    lastSyncedAt?: string | null;
    orgId?: string;
    orgName?: string;
    orgSlug?: string;
  },
) {
  getDb().update(bankConnections).set(values).where(eq(bankConnections.id, connectionId)).run();
}

function storeAccounts(connection: Connection, organization: QontoOrganization): Map<string, number> {
  const db = getDb();
  const ids = new Map<string, number>();
  const syncedAt = new Date().toISOString();
  for (const raw of organization.bankAccounts) {
    const account = mapQontoAccount(raw);
    if (!account) continue;
    const row = db
      .insert(bankAccounts)
      .values({ connectionId: connection.id, companyId: connection.companyId, ...account, syncedAt })
      .onConflictDoUpdate({
        target: [bankAccounts.connectionId, bankAccounts.externalId],
        set: { ...account, syncedAt },
      })
      .returning({ id: bankAccounts.id })
      .get();
    if (row) ids.set(account.externalId, row.id);
  }
  // Qonto returns closed accounts too. An account that vanishes is treated as closed,
  // so its stale balance no longer counts in the total.
  const returned = [...ids.keys()];
  if (returned.length > 0) {
    db.update(bankAccounts)
      .set({ status: "closed", syncedAt })
      .where(and(eq(bankAccounts.connectionId, connection.id), notInArray(bankAccounts.externalId, returned)))
      .run();
  } else {
    db.update(bankAccounts)
      .set({ status: "closed", syncedAt })
      .where(eq(bankAccounts.connectionId, connection.id))
      .run();
  }
  return ids;
}

async function storeTransactions(
  credentials: QontoCredentials,
  companyId: number,
  accounts: Map<string, number>,
  window: { from: string; to: string },
): Promise<number> {
  const db = getDb();
  const syncedAt = new Date().toISOString();
  const rows: { accountId: number; values: ReturnType<typeof mapQontoTransaction> }[] = [];
  for (const [externalId, accountId] of accounts) {
    const transactions = await fetchQontoTransactions(credentials, externalId, window.from, window.to);
    for (const raw of transactions) {
      if (raw.bank_account_id && raw.bank_account_id !== externalId) continue;
      const values = mapQontoTransaction(raw);
      if (values) rows.push({ accountId, values });
    }
  }

  let stored = 0;
  db.transaction((tx) => {
    for (const row of rows) {
      if (!row.values) continue;
      tx.insert(bankTransactions)
        .values({ accountId: row.accountId, companyId, ...row.values, syncedAt })
        .onConflictDoUpdate({
          target: [bankTransactions.accountId, bankTransactions.externalId],
          set: { ...row.values, syncedAt },
        })
        .run();
      stored += 1;
    }
  });
  return stored;
}

async function pull(connection: Connection, organization: QontoOrganization): Promise<BankSyncResult> {
  const startedAt = new Date().toISOString();
  const window = qontoSyncWindow(connection.lastSyncedAt, new Date(startedAt));
  const accountIds = storeAccounts(connection, organization);
  let transactions = 0;
  try {
    transactions = await storeTransactions(credentialsOf(connection), connection.companyId, accountIds, window);
  } catch (error) {
    markConnection(connection.id, { status: "error", lastError: messageOf(error) });
    throw error;
  }
  markConnection(connection.id, {
    status: "ok",
    lastError: "",
    lastSyncedAt: startedAt,
    orgId: organization.id,
    orgName: organization.name,
    orgSlug: organization.slug,
  });
  return { accounts: accountIds.size, transactions, lastSyncedAt: startedAt };
}

export async function connectBank(input: {
  companyId: number;
  login: string;
  secretKey: string;
  environment: QontoEnvironment;
  stagingToken: string;
}): Promise<BankConnectResult> {
  const credentials: QontoCredentials = {
    login: input.login,
    secretKey: input.secretKey,
    environment: input.environment,
    stagingToken: input.stagingToken,
  };
  const organization = await fetchQontoOrganization(credentials);
  const db = getDb();
  const existing = db
    .select()
    .from(bankConnections)
    .where(and(eq(bankConnections.companyId, input.companyId), eq(bankConnections.provider, "qonto")))
    .get();

  const values = {
    companyId: input.companyId,
    provider: "qonto",
    label: "Qonto",
    login: input.login,
    secretKey: input.secretKey,
    environment: input.environment,
    stagingToken: input.stagingToken,
    orgId: organization.id,
    orgName: organization.name,
    orgSlug: organization.slug,
    status: "ok",
    lastError: "",
    lastSyncedAt: null,
  };

  let connectionId: number;
  if (existing) {
    db.update(bankConnections).set(values).where(eq(bankConnections.id, existing.id)).run();
    connectionId = existing.id;
    // New credentials can point at another organization or environment. Drop the old cache.
    db.delete(bankAccounts).where(eq(bankAccounts.connectionId, connectionId)).run();
  } else {
    connectionId = Number(
      db
        .insert(bankConnections)
        .values({ ...values, createdAt: new Date().toISOString() })
        .run().lastInsertRowid,
    );
  }

  const connection = db.select().from(bankConnections).where(eq(bankConnections.id, connectionId)).get();
  if (!connection) throw new Error("The Qonto connection was not found.");
  try {
    const result = await pull(connection, organization);
    return {
      connectionId,
      orgName: organization.name,
      accounts: result.accounts,
      transactions: result.transactions,
      lastSyncedAt: result.lastSyncedAt,
      transactionError: "",
    };
  } catch (error) {
    markConnection(connectionId, { status: "error", lastError: messageOf(error) });
    return {
      connectionId,
      orgName: organization.name,
      accounts: organization.bankAccounts.filter((account) => Boolean(account.id)).length,
      transactions: 0,
      lastSyncedAt: null,
      transactionError: messageOf(error),
    };
  }
}

export async function syncBankConnection(companyId: number): Promise<BankSyncResult> {
  const connection = getDb()
    .select()
    .from(bankConnections)
    .where(and(eq(bankConnections.companyId, companyId), eq(bankConnections.provider, "qonto")))
    .get();
  if (!connection) throw new Error("The Qonto connection was not found.");
  try {
    const organization = await fetchQontoOrganization(credentialsOf(connection));
    return await pull(connection, organization);
  } catch (error) {
    markConnection(connection.id, { status: "error", lastError: messageOf(error) });
    throw error;
  }
}