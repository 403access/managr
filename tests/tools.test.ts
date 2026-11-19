import fs from "fs";
import os from "os";
import path from "path";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDb } from "@/db/client";
import { timeEntries } from "@/db/schema";
import { runTool, toolJsonSchema, tools } from "@/server/tools";

const repo = process.cwd();
let dir = "";

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "managr-tools-"));
  fs.cpSync(path.join(repo, "src/db/migrations"), path.join(dir, "src/db/migrations"), { recursive: true });
  process.chdir(dir);
  getDb();
});

afterAll(() => {
  process.chdir(repo);
  fs.rmSync(dir, { recursive: true, force: true });
});

function data<T = Record<string, unknown>>(result: Awaited<ReturnType<typeof runTool>>): T {
  if (!result.ok) throw new Error(result.error);
  return result.data as T;
}

describe("tool registry", () => {
  it("exposes read, write, and briefing tools with a JSON schema", () => {
    expect(tools.length).toBeGreaterThan(30);
    expect(tools.some((tool) => tool.name === "create_invoice")).toBe(true);
    expect(tools.some((tool) => tool.name === "daily_briefing")).toBe(true);
    expect(tools.some((tool) => tool.name === "read_org")).toBe(true);
    expect(tools.some((tool) => tool.name === "read_guides")).toBe(true);
    expect(tools.some((tool) => tool.name === "read_sources")).toBe(true);
    const schema = toolJsonSchema(tools.find((tool) => tool.name === "record_invoice_payment")!);
    expect(schema.type).toBe("object");
    expect(Object.keys(schema.properties as Record<string, unknown>)).toEqual(["invoiceId", "amount", "paidOn"]);
    expect(schema).not.toHaveProperty("$schema");
    const guides = toolJsonSchema(tools.find((tool) => tool.name === "read_guides")!);
    expect(guides.type).toBe("object");
    expect(Object.keys(guides.properties as Record<string, unknown>)).toEqual(["topic", "locale"]);
  });

  it("updates a time entry in place instead of deleting and recreating it", async () => {
    const added = data<{ id: number }>(
      await runTool("add_time", {
        entryDate: "2026-10-23",
        startedAt: "11:30",
        endedAt: "13:30",
        memo: "Update me",
      }),
    );
    const projects = data<{ projects: { id: number; name: string }[] }>(await runTool("read_projects", {}));
    const target = projects.projects[0];
    expect(target).toBeTruthy();

    const updated = data<{ id: number; projectId: number | null }>(
      await runTool("update_time", { id: added.id, projectId: target.id }),
    );
    expect(updated.projectId).toBe(target.id);
    const row = getDb().select().from(timeEntries).where(eq(timeEntries.id, added.id)).get();
    expect(row?.projectId).toBe(target.id);
    expect(row?.memo).toBe("Update me");
    expect(row?.startedAt).toBe("11:30");

    const cleared = data<{ projectId: number | null }>(await runTool("update_time", { id: added.id, projectId: null }));
    expect(cleared.projectId).toBeNull();
    expect(getDb().select().from(timeEntries).where(eq(timeEntries.id, added.id)).get()?.projectId).toBeNull();
  });

  it("refuses an unknown tool and a malformed input", async () => {
    expect((await runTool("nope", {})).ok).toBe(false);
    const bad = await runTool("record_invoice_payment", { invoiceId: 1 });
    expect(bad.ok).toBe(false);
    expect(bad.ok === false ? bad.error : "").toMatch(/amount/);
  });

  it("reads the seeded desk", async () => {
    const desk = data<{ legalName: string; invoices: unknown[] }>(await runTool("read_desk", {}));
    expect(desk.legalName).toContain("UG");
    const people = data<{ people: { lastName: string }[] }>(await runTool("read_people", {}));
    expect(people.people.map((person) => person.lastName)).toContain("Elling");
    const briefing = data<{ overdueInvoices: unknown[]; company: { legalName: string } }>(await runTool("daily_briefing", {}));
    expect(briefing.company.legalName).toContain("UG");
    expect(briefing.overdueInvoices.length).toBeGreaterThan(0);
    const projects = data<{ projects: { name: string }[] }>(await runTool("read_projects", {}));
    expect(projects.projects.map((project) => project.name)).toContain("Markenauftritt Lichtfeld");
    const analytics = data<{ totals: { minutes: number }; typeRows: unknown[] }>(await runTool("read_analytics", {}));
    expect(analytics.totals.minutes).toBeGreaterThan(0);
    expect(analytics.typeRows.length).toBeGreaterThan(0);
    const bank = data<{ connection: unknown; accounts: unknown[] }>(await runTool("read_bank", {}));
    expect(bank.connection).toBeNull();
    expect(bank.accounts).toEqual([]);
    const org = data<{ roots: { firstName: string }[]; total: number }>(await runTool("read_org", {}));
    expect(org.total).toBeGreaterThan(0);
    expect(org.roots.length).toBeGreaterThan(0);
    const guide = data<{ sections: unknown[]; sources: { url: string }[] }>(await runTool("read_guides", { topic: "invoice" }));
    expect(guide.sections.length).toBeGreaterThan(0);
    expect(guide.sources.every((source) => source.url.startsWith("https://"))).toBe(true);
    const register = data<{ total: number; groups: { domain: string }[] }>(await runTool("read_sources", {}));
    expect(register.total).toBeGreaterThan(0);
    expect(register.groups.length).toBeGreaterThan(0);
    const cited = data<{ total: number }>(await runTool("read_sources", { topic: "invoice" }));
    expect(cited.total).toBe(guide.sources.length);
  });
});

describe("invoice operations", () => {
  it("creates a draft, issues it, takes a payment, and voids it", async () => {
    const customer = data<{ id: number }>(
      await runTool("save_customer", {
        name: "Muster & Töchter GmbH",
        street: "Teststraße 4",
        postalCode: "10115",
        city: "Berlin",
        website: "https://muster-toechter.example",
      }),
    );
    const register = data<{ customers: { id: number; website: string }[] }>(await runTool("read_customers", {}));
    expect(register.customers.find((row) => row.id === customer.id)?.website).toBe("https://muster-toechter.example");
    const draft = data<{ invoiceId: number; grossCents: number; review: { blockers: string[] } }>(
      await runTool("create_invoice", {
        customerId: customer.id,
        issueDate: "2026-11-02",
        serviceDate: "2026-11-02",
        dueDate: "2026-11-16",
        lines: [{ description: "Workshop", quantity: "2", unitNet: "500,00", vatBps: 1900 }],
      }),
    );
    expect(draft.grossCents).toBe(119_000);
    expect(draft.review.blockers).toEqual([]);

    const issued = data<{ number: string; grossCents: number }>(await runTool("issue_invoice", { invoiceId: draft.invoiceId }));
    expect(issued.number).toMatch(/^RE-\d{4}-\d{4}$/);

    const paid = data<{ amountCents: number }>(await runTool("record_invoice_payment", { invoiceId: draft.invoiceId, amount: "1190,00", paidOn: "2026-11-10" }));
    expect(paid.amountCents).toBe(119_000);
    const read = data<{ displayStatus: string; openCents: number }>(await runTool("read_invoice", { invoiceId: draft.invoiceId }));
    expect(read.displayStatus).toBe("paid");
    expect(read.openCents).toBe(0);

    const voided = data<{ void: boolean }>(await runTool("void_invoice", { invoiceId: draft.invoiceId }));
    expect(voided.void).toBe(true);
    const after = data<{ displayStatus: string }>(await runTool("read_invoice", { invoiceId: draft.invoiceId }));
    expect(after.displayStatus).toBe("void");
  });

  it("drafts a German reminder for an overdue seeded invoice", async () => {
    const invoices = data<{ id: number; status: string; displayStatus: string; number: string | null }[]>(await runTool("read_invoices", { status: "overdue" }));
    const overdue = invoices.find((invoice) => invoice.status === "issued" || invoice.displayStatus === "overdue");
    expect(overdue).toBeTruthy();
    const letter = data<{ draft: boolean; subject: string; body: string }>(await runTool("draft_dunning_letter", { invoiceId: overdue!.id }));
    expect(letter.draft).toBe(true);
    expect(letter.subject).toContain("Zahlungserinnerung");
    expect(letter.body).toContain("IBAN");
  });
});

describe("books", () => {
  it("posts an expense, a prepayment, and refuses an unbalanced journal", async () => {
    expect((await runTool("post_expense", { accountCode: "4210", net: "500,00", vatBps: 1900, memo: "Testmiete", paidNow: true })).ok).toBe(true);
    expect((await runTool("post_vat_prepayment", { amount: "250,00", memo: "Test" })).ok).toBe(true);
    const unbalanced = await runTool("post_journal_entry", {
      memo: "Unbalanced",
      lines: [
        { accountCode: "1200", debit: "100,00" },
        { accountCode: "8400", credit: "90,00" },
      ],
    });
    expect(unbalanced.ok).toBe(false);
    expect(unbalanced.ok === false ? unbalanced.error : "").toMatch(/out of balance/);
    expect((await runTool("post_journal_entry", { memo: "Balanced", lines: [{ accountCode: "1200", debit: "10,00" }, { accountCode: "8400", credit: "10,00" }] })).ok).toBe(true);
  });
});

describe("briefings", () => {
  it("sums output VAT, input VAT, and the payable amount", async () => {
    const vat = data<{ outputVatCents: number; inputVatCents: number; payableCents: number }>(await runTool("vat_overview", {}));
    expect(vat.outputVatCents).toBeGreaterThan(0);
    expect(vat.inputVatCents).toBeGreaterThan(0);
    expect(typeof vat.payableCents).toBe("number");
  });

  it("names the people whose payroll month is not posted", async () => {
    const close = data<{ month: string; ready: boolean; checks: { key: string; ok: boolean; detail: string }[] }>(
      await runTool("monthly_close_checklist", { month: "2027-03" }),
    );
    expect(close.month).toBe("2027-03");
    const payroll = close.checks.find((check) => check.key === "payroll");
    expect(payroll?.ok).toBe(false);
    expect(payroll?.detail).toContain("Elling");
    expect(close.ready).toBe(false);
  });
});

describe("payroll and the shareholder director", () => {
  it("uses the salary schedule for the month and moves the director's net pay to the shareholder liability", async () => {
    const people = data<{ people: { id: number; lastName: string }[] }>(await runTool("read_people", {}));
    const jonas = people.people.find((person) => person.lastName === "Rehberg")!;
    const mara = people.people.find((person) => person.lastName === "Elling")!;

    expect((await runTool("add_salary_change", { personId: jonas.id, validFrom: "2027-01-01", grossMonthly: "1700,00" })).ok).toBe(true);
    const jonasPay = data<{ grossCents: number; netCents: number }>(
      await runTool("post_payroll", { personId: jonas.id, payrollMonth: "2027-01", wageTax: "0", payNow: false }),
    );
    expect(jonasPay.grossCents).toBe(170_000);

    const director = data<{ grossCents: number; netCents: number; shareholderLiability: boolean }>(
      await runTool("post_payroll", { personId: mara.id, payrollMonth: "2027-02", wageTax: "500,00" }),
    );
    expect(director.grossCents).toBe(320_000);
    expect(director.netCents).toBe(270_000);
    expect(director.shareholderLiability).toBe(true);

    const paid = data<{ amountCents: number }>(await runTool("pay_shareholder", { personId: mara.id, amount: "2700,00", paidOn: "2027-02-28" }));
    expect(paid.amountCents).toBe(270_000);
    const person = data<{ shareholderPayableCents: number }>(await runTool("read_person", { personId: mara.id }));
    expect(person.shareholderPayableCents).toBe(0);
  });

  it("removes a scheduled salary change", async () => {
    const people = data<{ people: { id: number; lastName: string }[] }>(await runTool("read_people", {}));
    const jonas = people.people.find((person) => person.lastName === "Rehberg")!;
    const change = data<{ id: number }>(
      await runTool("add_salary_change", { personId: jonas.id, validFrom: "2028-01-01", grossMonthly: "1900,00" }),
    );
    const removed = data<{ removed: boolean }>(await runTool("delete_salary_change", { personId: jonas.id, salaryChangeId: change.id }));
    expect(removed.removed).toBe(true);
    const person = data<{ salaryPeriods: { id: number }[] }>(await runTool("read_person", { personId: jonas.id }));
    expect(person.salaryPeriods.some((period) => period.id === change.id)).toBe(false);
  });

  it("refuses a second payroll for the same person and month", async () => {
    const people = data<{ people: { id: number; lastName: string }[] }>(await runTool("read_people", {}));
    const mara = people.people.find((person) => person.lastName === "Elling")!;
    const again = await runTool("post_payroll", { personId: mara.id, payrollMonth: "2027-02", wageTax: "0" });
    expect(again.ok).toBe(false);
    expect(again.ok === false ? again.error : "").toMatch(/already posted/);
  });
});

describe("shareholder loans", () => {
  it("records a loan, a repayment, and interest without changing the books' balance", async () => {
    const company = data<{ holders: { id: number; name: string }[] }>(await runTool("read_company", {}));
    const holder = company.holders[0]!;
    const created = data<{ loanId: number; amountCents: number }>(
      await runTool("add_shareholder_loan", {
        shareholderId: holder.id,
        amount: "5000,00",
        openedOn: "2027-03-01",
        interestBps: 200,
        label: "Testdarlehen",
        notes: "Liquiditätsbrücke",
      }),
    );
    expect(created.amountCents).toBe(500_000);

    const afterDraw = data<{ loans: { id: number; outstandingCents: number; movements: unknown[] }[]; totalOutstandingCents: number }>(
      await runTool("read_shareholder_loans", {}),
    );
    expect(afterDraw.totalOutstandingCents).toBe(500_000);
    expect(afterDraw.loans.find((loan) => loan.id === created.loanId)?.movements).toHaveLength(1);

    const repaid = data<{ amountCents: number }>(
      await runTool("record_shareholder_loan_movement", { loanId: created.loanId, kind: "repayment", amount: "1000,00", movedOn: "2027-04-01" }),
    );
    expect(repaid.amountCents).toBe(100_000);

    const interest = data<{ amountCents: number }>(
      await runTool("record_shareholder_loan_movement", { loanId: created.loanId, kind: "interest", movedOn: "2027-04-30", paidNow: true }),
    );
    expect(interest.amountCents).toBe(8_000);

    const after = data<{ loans: { id: number; outstandingCents: number }[] }>(await runTool("read_shareholder_loans", {}));
    expect(after.loans.find((loan) => loan.id === created.loanId)?.outstandingCents).toBe(400_000);

    const tooMuch = await runTool("record_shareholder_loan_movement", { loanId: created.loanId, kind: "repayment", amount: "5000,00" });
    expect(tooMuch.ok).toBe(false);
    expect(tooMuch.ok === false ? tooMuch.error : "").toMatch(/larger than the outstanding loan/);
  });
});

describe("founder health cover", () => {
  it("saves the cover and its status procedure on a managing director", async () => {
    const people = data<{ people: { id: number; lastName: string; kind: string }[] }>(await runTool("read_people", {}));
    const mara = people.people.find((person) => person.lastName === "Elling")!;
    const jonas = people.people.find((person) => person.lastName === "Rehberg")!;

    const saved = data<{ id: number; personId: number; saved: boolean }>(
      await runTool("save_founder_health", {
        personId: mara.id,
        kind: "voluntary_statutory",
        provider: "Testkasse",
        monthlyPremium: "520,00",
        startsOn: "2024-03-15",
        statusProcedure: "completed",
        statusOn: "2024-04-01",
        statusOutcome: "not_socially_insured",
      }),
    );
    expect(saved.saved).toBe(true);

    const person = data<{ founderHealth: { kind: string; monthlyPremiumCents: number; statusProcedure: string }; healthReview: { warnings: string[] } }>(
      await runTool("read_person", { personId: mara.id }),
    );
    expect(person.founderHealth.kind).toBe("voluntary_statutory");
    expect(person.founderHealth.monthlyPremiumCents).toBe(52_000);
    expect(person.founderHealth.statusProcedure).toBe("completed");

    const wrongPerson = await runTool("save_founder_health", {
      personId: jonas.id,
      kind: "private",
      startsOn: "2024-03-15",
    });
    expect(wrongPerson.ok).toBe(false);
    expect(wrongPerson.ok === false ? wrongPerson.error : "").toMatch(/managing director/);
  });
});

describe("director contract", () => {
  it("records a prospective contract and refuses a retroactive one", async () => {
    const people = data<{ people: { id: number; lastName: string }[] }>(await runTool("read_people", {}));
    const mara = people.people.find((person) => person.lastName === "Elling")!;

    const saved = data<{ id: number }>(
      await runTool("save_director_contract", {
        personId: mara.id,
        signedOn: "2027-03-01",
        validFrom: "2027-03-01",
        grossMonthly: "3200,00",
        notes: "Testvertrag",
      }),
    );
    expect(saved.id).toBeGreaterThan(0);

    const person = data<{ contracts: { grossMonthlyCents: number }[]; contractReview: { warnings: string[] } }>(
      await runTool("read_person", { personId: mara.id }),
    );
    expect(person.contracts.some((contract) => contract.grossMonthlyCents === 320_000)).toBe(true);

    const bad = await runTool("save_director_contract", {
      personId: mara.id,
      signedOn: "2027-05-01",
      validFrom: "2027-04-01",
      grossMonthly: "3200,00",
    });
    expect(bad.ok).toBe(false);
    expect(bad.ok === false ? bad.error : "").toMatch(/before it is signed/);
  });
});