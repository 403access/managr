import fs from "fs";
import os from "os";
import path from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDb } from "@/db/client";
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
    const schema = toolJsonSchema(tools.find((tool) => tool.name === "record_invoice_payment")!);
    expect(schema.type).toBe("object");
    expect(Object.keys(schema.properties as Record<string, unknown>)).toEqual(["invoiceId", "amount", "paidOn"]);
    expect(schema).not.toHaveProperty("$schema");
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
      }),
    );
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

  it("refuses a second payroll for the same person and month", async () => {
    const people = data<{ people: { id: number; lastName: string }[] }>(await runTool("read_people", {}));
    const mara = people.people.find((person) => person.lastName === "Elling")!;
    const again = await runTool("post_payroll", { personId: mara.id, payrollMonth: "2027-02", wageTax: "0" });
    expect(again.ok).toBe(false);
    expect(again.ok === false ? again.error : "").toMatch(/already posted/);
  });
});