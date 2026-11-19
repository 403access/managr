import "server-only";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  absences,
  companies,
  customDeadlines,
  customers,
  employees,
  invoices,
  milestones,
  policies,
  projects,
  shareholders,
  tasks,
  timeEntries,
  timeEntryActivities,
} from "@/db/schema";

/**
 * Names for the ids in a proposed change, so the confirmation card can say
 * "IT Works" instead of "Kunde #1". A missing row is simply left out.
 */
export function changeLabels(name: string, input: unknown): Record<string, string> {
  if (typeof input !== "object" || input === null) return {};
  const values = input as Record<string, unknown>;
  const labels: Record<string, string> = {};
  const idOf = (key: string): number | null =>
    typeof values[key] === "number" && Number.isFinite(values[key]) ? (values[key] as number) : null;

  try {
    const db = getDb();
    const customerId = idOf("customerId");
    if (customerId) {
      const row = db.select({ name: customers.name }).from(customers).where(eq(customers.id, customerId)).get();
      if (row) labels.customerId = row.name;
    }
    const projectId = idOf("projectId");
    if (projectId) {
      const row = db.select({ name: projects.name }).from(projects).where(eq(projects.id, projectId)).get();
      if (row) labels.projectId = row.name;
    }
    const personId = idOf("personId");
    if (personId) {
      const row = db
        .select({ firstName: employees.firstName, lastName: employees.lastName })
        .from(employees)
        .where(eq(employees.id, personId))
        .get();
      if (row) labels.personId = `${row.firstName} ${row.lastName}`.trim();
    }
    const taskId = idOf("taskId");
    if (taskId) {
      const row = db.select({ title: tasks.title }).from(tasks).where(eq(tasks.id, taskId)).get();
      if (row) labels.taskId = row.title;
    }
    const invoiceId = idOf("invoiceId");
    if (invoiceId) {
      const row = db.select({ number: invoices.number }).from(invoices).where(eq(invoices.id, invoiceId)).get();
      if (row) labels.invoiceId = row.number ? `#${row.number}` : `#${invoiceId}`;
    }
    const shareholderId = idOf("shareholderId");
    if (shareholderId) {
      const row = db.select({ name: shareholders.name }).from(shareholders).where(eq(shareholders.id, shareholderId)).get();
      if (row) labels.shareholderId = row.name;
    }
    const companyId = idOf("companyId");
    if (companyId) {
      const row = db.select({ name: companies.legalName }).from(companies).where(eq(companies.id, companyId)).get();
      if (row) labels.companyId = row.name;
    }

    const entityId = idOf("id");
    if (entityId) {
      if (name === "delete_shareholder") {
        const row = db.select({ name: shareholders.name }).from(shareholders).where(eq(shareholders.id, entityId)).get();
        if (row) labels.id = row.name;
      } else if (name === "delete_project") {
        const row = db.select({ name: projects.name }).from(projects).where(eq(projects.id, entityId)).get();
        if (row) labels.id = row.name;
      } else if (name === "delete_task") {
        const row = db.select({ title: tasks.title }).from(tasks).where(eq(tasks.id, entityId)).get();
        if (row) labels.id = row.title;
      } else if (name === "delete_milestone") {
        const row = db.select({ title: milestones.title }).from(milestones).where(eq(milestones.id, entityId)).get();
        if (row) labels.id = row.title;
      } else if (name === "delete_policy") {
        const row = db.select({ label: policies.label }).from(policies).where(eq(policies.id, entityId)).get();
        if (row) labels.id = row.label;
      } else if (name === "delete_deadline") {
        const row = db.select({ title: customDeadlines.title }).from(customDeadlines).where(eq(customDeadlines.id, entityId)).get();
        if (row) labels.id = row.title;
      } else if (name === "delete_time" || name === "update_time") {
        const row = db
          .select({ entryDate: timeEntries.entryDate, startedAt: timeEntries.startedAt, endedAt: timeEntries.endedAt })
          .from(timeEntries)
          .where(eq(timeEntries.id, entityId))
          .get();
        if (row) {
          const activities = db
            .select({ description: timeEntryActivities.description })
            .from(timeEntryActivities)
            .where(eq(timeEntryActivities.timeEntryId, entityId))
            .orderBy(asc(timeEntryActivities.position))
            .all()
            .map((activity) => activity.description);
          labels.id = `${row.entryDate} ${row.startedAt}–${row.endedAt}${activities.length > 0 ? ` · ${activities.join(" · ")}` : ""}`;
        }
      } else if (name === "delete_absence") {
        const row = db
          .select({ kind: absences.kind, startDate: absences.startDate, endDate: absences.endDate })
          .from(absences)
          .where(eq(absences.id, entityId))
          .get();
        if (row) labels.id = `${row.kind} ${row.startDate}–${row.endDate}`;
      }
    }
  } catch {
    // A proposal must still render when a lookup fails.
  }
  return labels;
}