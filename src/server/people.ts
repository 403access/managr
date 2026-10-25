import type { EmploymentKind, SocialInput, SvStatus } from "@/domain/social";

const kinds: readonly EmploymentKind[] = ["regular", "minijob", "midijob", "apprentice", "managing_director"];
const statuses: readonly SvStatus[] = ["automatic", "subject", "exempt"];

export type SocialPerson = {
  kind: string;
  svStatus: string;
  ownershipBps: number;
  additionalKvBps: number | null;
  childlessSurcharge: boolean;
  careDiscountSteps: number;
  minijobPublicHealth: boolean;
  pensionOptOut: boolean;
  flatTax: boolean;
};

export function socialInput(
  person: SocialPerson,
  company: { stateCode: string; additionalKvBps: number },
  grossMonthlyCents: number,
): SocialInput {
  if (!kinds.includes(person.kind as EmploymentKind) || !statuses.includes(person.svStatus as SvStatus)) {
    throw new Error("Employment kind or social-insurance status is not recognized.");
  }
  return {
    grossMonthlyCents,
    kind: person.kind as EmploymentKind,
    svStatus: person.svStatus as SvStatus,
    ownershipBps: person.ownershipBps,
    stateCode: company.stateCode,
    additionalKvBps: person.additionalKvBps ?? company.additionalKvBps,
    childlessSurcharge: person.childlessSurcharge,
    careDiscountSteps: person.careDiscountSteps,
    minijobPublicHealth: person.minijobPublicHealth,
    pensionOptOut: person.pensionOptOut,
    flatTax: person.flatTax,
  };
}
