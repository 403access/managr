import { describe, expect, it } from "vitest";
import { POST as approve } from "@/app/api/assistant/approve/route";
import { changeAction, createApprovalGate, decideProposal } from "@/server/approvals";
import { needsApproval } from "@/server/tools";

describe("approval classification", () => {
  it("turns tool names into add, update, and delete", () => {
    expect(changeAction("add_time", {})).toBe("add");
    expect(changeAction("post_expense", {})).toBe("add");
    expect(changeAction("record_invoice_payment", {})).toBe("add");
    expect(changeAction("update_person", {})).toBe("update");
    expect(changeAction("set_task_status", {})).toBe("update");
    expect(changeAction("issue_invoice", {})).toBe("update");
    expect(changeAction("delete_time", {})).toBe("delete");
    expect(changeAction("void_invoice", {})).toBe("update");
  });

  it("treats save_* with the entity's id as an update and without one as an add", () => {
    expect(changeAction("save_customer", { customerId: 4, name: "IT Works" })).toBe("update");
    expect(changeAction("save_customer", { name: "IT Works" })).toBe("add");
    expect(changeAction("save_project", { projectId: 3, name: "KI" })).toBe("update");
    expect(changeAction("save_project", { name: "KI" })).toBe("add");
    expect(changeAction("save_milestone", { milestoneId: 0 })).toBe("add");
    expect(changeAction("save_resolution", { title: "Beschluss", body: "Text" })).toBe("add");
  });

  it("asks for confirmation on writes but not on reads and briefings", () => {
    expect(needsApproval("read_desk")).toBe(false);
    expect(needsApproval("read_customers")).toBe(false);
    expect(needsApproval("web_search")).toBe(false);
    expect(needsApproval("daily_briefing")).toBe(false);
    expect(needsApproval("monthly_close_checklist")).toBe(false);
    expect(needsApproval("add_time")).toBe(true);
    expect(needsApproval("delete_time")).toBe(true);
    expect(needsApproval("switch_company")).toBe(true);
  });
});

describe("approval gate", () => {
  const changes = [
    { callId: "call-a", name: "add_time", action: "add" as const, input: {} },
    { callId: "call-b", name: "delete_time", action: "delete" as const, input: {} },
  ];

  it("returns only the approved call ids and cannot be resolved twice", async () => {
    const { id, decision } = createApprovalGate().open(changes);

    expect(decideProposal("missing", ["call-a"])).toBe(false);
    expect(decideProposal(id, ["call-a", "call-x"])).toBe(true);

    await expect(decision).resolves.toEqual(new Set(["call-a"]));
    expect(decideProposal(id, ["call-b"])).toBe(false);
  });

  it("rejects every call when the request is aborted", async () => {
    const controller = new AbortController();
    const { decision } = createApprovalGate(controller.signal).open(changes);

    controller.abort();

    await expect(decision).resolves.toEqual(new Set());
  });

  it("resolves a proposal through the approve route", async () => {
    const { id, decision } = createApprovalGate().open(changes);
    const response = await approve(
      new Request("http://localhost/api/assistant/approve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, approved: ["call-b"] }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(decision).resolves.toEqual(new Set(["call-b"]));
  });

  it("refuses a malformed body and an unknown proposal", async () => {
    const malformed = await approve(
      new Request("http://localhost/api/assistant/approve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ approved: [] }),
      }),
    );
    expect(malformed.status).toBe(400);

    const unknown = await approve(
      new Request("http://localhost/api/assistant/approve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: "missing", approved: [] }),
      }),
    );
    expect(unknown.status).toBe(404);
  });
});