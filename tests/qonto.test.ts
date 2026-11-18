import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchQontoOrganization, fetchQontoTransactions } from "@/server/qonto";

type Call = { url: string; init?: RequestInit };

function stubFetch(handler: (call: Call) => Response | Promise<Response>) {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const call = { url, init };
      calls.push(call);
      return handler(call);
    }),
  );
  return calls;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

const credentials = { login: "pied-piper-7132", secretKey: "secret", environment: "production" as const, stagingToken: "" };

describe("Qonto HTTP client", () => {
  it("reads the organization with the raw sign-in header", async () => {
    const calls = stubFetch(() =>
      json({
        organization: {
          id: "org-1",
          name: "Atelier Nordlicht",
          slug: "atelier-nordlicht-1234",
          legal_name: "Atelier Nordlicht UG (haftungsbeschränkt)",
          bank_accounts: [{ id: "acct-1", name: "Geschäftskonto", balance_cents: 100 }],
        },
      }),
    );

    const organization = await fetchQontoOrganization(credentials);
    expect(organization.name).toBe("Atelier Nordlicht");
    expect(organization.bankAccounts).toHaveLength(1);
    expect(calls[0]?.url).toBe("https://thirdparty.qonto.com/v2/organization");
    expect((calls[0]?.init?.headers as Record<string, string>).Authorization).toBe("pied-piper-7132:secret");
  });

  it("adds the sandbox token and does not base64 the header", async () => {
    const calls = stubFetch(() => json({ organization: { id: "org-1", bank_accounts: [] } }));
    await fetchQontoOrganization({ ...credentials, environment: "sandbox", stagingToken: "stage-token" });
    expect(calls[0]?.url).toBe("https://thirdparty-sandbox.staging.qonto.co/v2/organization");
    const headers = calls[0]?.init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("pied-piper-7132:secret");
    expect(headers["X-Qonto-Staging-Token"]).toBe("stage-token");
  });

  it("paginates transactions, asks for every status, and stops at the last page", async () => {
    const calls = stubFetch((call) => {
      const page = new URL(call.url).searchParams.get("page");
      if (page === "1") {
        return json({ transactions: [{ id: "tx-1", amount_cents: 100 }], meta: { next_page: 2 } });
      }
      return json({ transactions: [{ id: "tx-2", amount_cents: 200 }], meta: { next_page: null } });
    });

    const rows = await fetchQontoTransactions(
      credentials,
      "acct-1",
      "2025-11-01T00:00:00.000Z",
      "2026-11-01T00:00:00.000Z",
    );
    expect(rows.map((row) => row.id)).toEqual(["tx-1", "tx-2"]);
    expect(calls).toHaveLength(2);
    const params = new URL(calls[0]!.url).searchParams;
    expect(params.get("bank_account_id")).toBe("acct-1");
    expect(params.getAll("status[]")).toEqual(["completed", "pending", "declined", "reversed"]);
    expect(params.get("updated_at_from")).toBe("2025-11-01T00:00:00.000Z");
  });

  it("turns a rejected key into a readable error", async () => {
    stubFetch(() => json({ errors: [{ code: "unauthorized", detail: "invalid" }] }, 401));
    await expect(fetchQontoOrganization(credentials)).rejects.toThrow("Qonto rejected the sign-in or secret key.");
  });

  it("requires a sandbox token before calling Qonto", async () => {
    await expect(fetchQontoOrganization({ ...credentials, environment: "sandbox" })).rejects.toThrow(
      "A sandbox token is required for the Qonto sandbox.",
    );
  });
});