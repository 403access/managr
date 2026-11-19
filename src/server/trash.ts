import "server-only";
import { and, asc, desc, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  absences,
  customers,
  customDeadlines,
  directorContracts,
  documents,
  employees,
  founderHealth,
  invoices,
  milestones,
  policies,
  projects,
  salaryPeriods,
  shareholders,
  tasks,
  timeEntries,
  timeEntryActivities,
} from "@/db/schema";
import { formatEuro } from "@/domain/money";
import { TRASH_KINDS, type TrashEntry, type TrashKind } from "@/domain/trash";
import { loadCompany } from "./queries";

export type { TrashEntry, TrashKind } from "@/domain/trash";
export { TRASH_KINDS } from "@/domain/trash";

function listKind(kind: TrashKind): TrashEntry[] {
  const db = getDb();
  const companyId = loadCompany().id;
  switch (kind) {
    case "shareholder":
      return db
        .select()
        .from(shareholders)
        .where(and(eq(shareholders.companyId, companyId), isNotNull(shareholders.deletedAt)))
        .all()
        .map((row) => ({
          kind,
          id: row.id,
          label: row.name,
          detail: `${row.city}${row.city ? " · " : ""}${row.shareBps / 100} %`,
          deletedAt: row.deletedAt!,
        }));
    case "policy":
      return db
        .select()
        .from(policies)
        .where(and(eq(policies.companyId, companyId), isNotNull(policies.deletedAt)))
        .all()
        .map((row) => ({
          kind,
          id: row.id,
          label: row.label,
          detail: [row.provider, row.kind].filter(Boolean).join(" · "),
          deletedAt: row.deletedAt!,
        }));
    case "invoice":
      return db
        .select({
          id: invoices.id,
          number: invoices.number,
          issueDate: invoices.issueDate,
          customerName: customers.name,
          deletedAt: invoices.deletedAt,
        })
        .from(invoices)
        .innerJoin(customers, eq(customers.id, invoices.customerId))
        .where(and(eq(invoices.companyId, companyId), isNotNull(invoices.deletedAt)))
        .all()
        .map((row) => ({
          kind,
          id: row.id,
          label: row.number ?? `#${row.id}`,
          detail: `${row.customerName} · ${row.issueDate}`,
          deletedAt: row.deletedAt!,
        }));
    case "salary_change":
      return db
        .select({
          id: salaryPeriods.id,
          validFrom: salaryPeriods.validFrom,
          grossMonthlyCents: salaryPeriods.grossMonthlyCents,
          deletedAt: salaryPeriods.deletedAt,
          firstName: employees.firstName,
          lastName: employees.lastName,
        })
        .from(salaryPeriods)
        .innerJoin(employees, eq(employees.id, salaryPeriods.employeeId))
        .where(and(eq(employees.companyId, companyId), isNotNull(salaryPeriods.deletedAt)))
        .all()
        .map((row) => ({
          kind,
          id: row.id,
          label: `${row.firstName} ${row.lastName}`.trim(),
          detail: `${row.validFrom} · ${formatEuro(row.grossMonthlyCents)}`,
          deletedAt: row.deletedAt!,
        }));
    case "absence":
      return db
        .select({
          id: absences.id,
          startDate: absences.startDate,
          endDate: absences.endDate,
          absenceKind: absences.kind,
          deletedAt: absences.deletedAt,
          firstName: employees.firstName,
          lastName: employees.lastName,
        })
        .from(absences)
        .innerJoin(employees, eq(employees.id, absences.employeeId))
        .where(and(eq(employees.companyId, companyId), isNotNull(absences.deletedAt)))
        .all()
        .map((row) => ({
          kind,
          id: row.id,
          label: `${row.firstName} ${row.lastName}`.trim(),
          detail: `${row.startDate}–${row.endDate} · ${row.absenceKind}`,
          deletedAt: row.deletedAt!,
        }));
    case "project":
      return db
        .select()
        .from(projects)
        .where(and(eq(projects.companyId, companyId), isNotNull(projects.deletedAt)))
        .all()
        .map((row) => ({
          kind,
          id: row.id,
          label: row.name,
          detail: `${row.status} · ${row.startedOn}`,
          deletedAt: row.deletedAt!,
        }));
    case "milestone":
      return db
        .select()
        .from(milestones)
        .where(isNotNull(milestones.deletedAt))
        .all()
        .map((row) => ({
          kind,
          id: row.id,
          label: row.title,
          detail: `${row.status} · ${row.targetDate}`,
          deletedAt: row.deletedAt!,
        }));
    case "task":
      return db
        .select()
        .from(tasks)
        .where(and(eq(tasks.companyId, companyId), isNotNull(tasks.deletedAt)))
        .all()
        .map((row) => ({
          kind,
          id: row.id,
          label: row.title,
          detail: [row.status, row.dueDate].filter(Boolean).join(" · "),
          deletedAt: row.deletedAt!,
        }));
    case "time": {
      const entries = db
        .select()
        .from(timeEntries)
        .where(and(eq(timeEntries.companyId, companyId), isNotNull(timeEntries.deletedAt)))
        .all();
      const activitiesByEntry = new Map<number, string[]>();
      const activityRows = entries.length === 0 ? [] : db
        .select()
        .from(timeEntryActivities)
        .where(inArray(timeEntryActivities.timeEntryId, entries.map((entry) => entry.id)))
        .orderBy(asc(timeEntryActivities.timeEntryId), asc(timeEntryActivities.position))
        .all();
      for (const activity of activityRows) {
        const list = activitiesByEntry.get(activity.timeEntryId);
        if (list) list.push(activity.description);
        else activitiesByEntry.set(activity.timeEntryId, [activity.description]);
      }
      return entries.map((row) => ({
        kind,
        id: row.id,
        label: `${row.entryDate} · ${row.startedAt}–${row.endedAt}`,
        detail: activitiesByEntry.get(row.id)?.join(" · ") || row.memo,
        deletedAt: row.deletedAt!,
      }));
    }
    case "deadline":
      return db
        .select()
        .from(customDeadlines)
        .where(and(eq(customDeadlines.companyId, companyId), isNotNull(customDeadlines.deletedAt)))
        .all()
        .map((row) => ({
          kind,
          id: row.id,
          label: row.title,
          detail: `${row.status} · ${row.dueDate}`,
          deletedAt: row.deletedAt!,
        }));
    case "document":
      return db
        .select()
        .from(documents)
        .where(and(eq(documents.companyId, companyId), isNotNull(documents.deletedAt)))
        .all()
        .map((row) => ({
          kind,
          id: row.id,
          label: row.title,
          detail: row.fileName,
          deletedAt: row.deletedAt!,
        }));
    case "director_contract":
      return db
        .select({
          id: directorContracts.id,
          validFrom: directorContracts.validFrom,
          deletedAt: directorContracts.deletedAt,
          firstName: employees.firstName,
          lastName: employees.lastName,
        })
        .from(directorContracts)
        .innerJoin(employees, eq(employees.id, directorContracts.employeeId))
        .where(and(eq(directorContracts.companyId, companyId), isNotNull(directorContracts.deletedAt)))
        .all()
        .map((row) => ({
          kind,
          id: row.id,
          label: `${row.firstName} ${row.lastName}`.trim(),
          detail: row.validFrom,
          deletedAt: row.deletedAt!,
        }));
    case "founder_health":
      return db
        .select({
          id: founderHealth.id,
          coverKind: founderHealth.kind,
          provider: founderHealth.provider,
          deletedAt: founderHealth.deletedAt,
          firstName: employees.firstName,
          lastName: employees.lastName,
        })
        .from(founderHealth)
        .innerJoin(employees, eq(employees.id, founderHealth.employeeId))
        .where(and(eq(founderHealth.companyId, companyId), isNotNull(founderHealth.deletedAt)))
        .all()
        .map((row) => ({
          kind,
          id: row.id,
          label: `${row.firstName} ${row.lastName}`.trim(),
          detail: [row.coverKind, row.provider].filter(Boolean).join(" · "),
          deletedAt: row.deletedAt!,
        }));
  }
}

export function trashView(): TrashEntry[] {
  return TRASH_KINDS.flatMap(listKind).sort((left, right) => right.deletedAt.localeCompare(left.deletedAt));
}

export function trashEntry(kind: TrashKind, id: number): TrashEntry | null {
  return listKind(kind).find((entry) => entry.id === id) ?? null;
}

export type RestoreResult = { ok: true } | { ok: false; error: string };

/** Bring one deleted record back. The caller revalidates the pages. */
export function restoreDeleted(kind: TrashKind, id: number): RestoreResult {
  const db = getDb();
  const companyId = loadCompany().id;
  try {
    switch (kind) {
      case "shareholder":
        db.update(shareholders).set({ deletedAt: null }).where(and(eq(shareholders.id, id), eq(shareholders.companyId, companyId))).run();
        break;
      case "policy":
        db.update(policies).set({ deletedAt: null }).where(and(eq(policies.id, id), eq(policies.companyId, companyId))).run();
        break;
      case "invoice":
        db.update(invoices).set({ deletedAt: null }).where(and(eq(invoices.id, id), eq(invoices.companyId, companyId))).run();
        break;
      case "salary_change": {
        const row = db.select().from(salaryPeriods).where(eq(salaryPeriods.id, id)).get();
        if (!row) return { ok: false, error: "That entry was not found." };
        const clash = db
          .select()
          .from(salaryPeriods)
          .where(
            and(
              eq(salaryPeriods.employeeId, row.employeeId),
              eq(salaryPeriods.validFrom, row.validFrom),
              isNull(salaryPeriods.deletedAt),
            ),
          )
          .get();
        if (clash) return { ok: false, error: "An active salary change already exists on that date." };
        db.update(salaryPeriods).set({ deletedAt: null }).where(eq(salaryPeriods.id, id)).run();
        break;
      }
      case "absence":
        db.update(absences).set({ deletedAt: null }).where(eq(absences.id, id)).run();
        break;
      case "project":
        db.update(projects).set({ deletedAt: null }).where(and(eq(projects.id, id), eq(projects.companyId, companyId))).run();
        break;
      case "milestone":
        db.update(milestones).set({ deletedAt: null }).where(eq(milestones.id, id)).run();
        break;
      case "task":
        db.update(tasks).set({ deletedAt: null }).where(and(eq(tasks.id, id), eq(tasks.companyId, companyId))).run();
        break;
      case "time":
        db.update(timeEntries).set({ deletedAt: null }).where(and(eq(timeEntries.id, id), eq(timeEntries.companyId, companyId))).run();
        break;
      case "deadline":
        db.update(customDeadlines).set({ deletedAt: null }).where(and(eq(customDeadlines.id, id), eq(customDeadlines.companyId, companyId))).run();
        break;
      case "document":
        db.update(documents).set({ deletedAt: null }).where(and(eq(documents.id, id), eq(documents.companyId, companyId))).run();
        break;
      case "director_contract":
        db.update(directorContracts).set({ deletedAt: null }).where(and(eq(directorContracts.id, id), eq(directorContracts.companyId, companyId))).run();
        break;
      case "founder_health": {
        const row = db.select().from(founderHealth).where(eq(founderHealth.id, id)).get();
        if (!row) return { ok: false, error: "That entry was not found." };
        const clash = db
          .select()
          .from(founderHealth)
          .where(
            and(
              eq(founderHealth.employeeId, row.employeeId),
              eq(founderHealth.companyId, row.companyId),
              isNull(founderHealth.deletedAt),
            ),
          )
          .get();
        if (clash) return { ok: false, error: "An active health cover already exists for that person." };
        db.update(founderHealth).set({ deletedAt: null }).where(eq(founderHealth.id, id)).run();
        break;
      }
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "The entry could not be restored." };
  }
}

export function isTrashKind(value: string): value is TrashKind {
  return (TRASH_KINDS as string[]).includes(value);
}