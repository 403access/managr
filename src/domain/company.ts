/** Legal forms the desk can keep books for. The code is stored, the label is shown. */
export const LEGAL_FORMS = ["ug", "gmbh", "ag", "kg", "ohg", "gbr", "einzelunternehmen", "ek", "partg"] as const;

export type LegalForm = (typeof LEGAL_FORMS)[number];

export const DEFAULT_LEGAL_FORM: LegalForm = "ug";

export function isLegalForm(value: string): value is LegalForm {
  return (LEGAL_FORMS as readonly string[]).includes(value);
}

/** Corporations need the register entry and the managing director on business letters. */
export function isCorporation(form: string): boolean {
  return form === "ug" || form === "gmbh" || form === "ag";
}

/** A registered merchant (Kaufmann) has a register number, but it is not a GmbH-style officer line. */
export function isRegisteredMerchant(form: string): boolean {
  return form === "ohg" || form === "kg" || form === "ek";
}

export function legalFormLabel(form: string): string {
  switch (form) {
    case "ug":
      return "UG (haftungsbeschränkt)";
    case "gmbh":
      return "GmbH";
    case "ag":
      return "AG";
    case "kg":
      return "KG";
    case "ohg":
      return "OHG";
    case "gbr":
      return "GbR";
    case "einzelunternehmen":
      return "Einzelunternehmen";
    case "ek":
      return "e.K.";
    case "partg":
      return "PartG";
    default:
      return form;
  }
}

/** The name check differs by form. A personal name is fine for an Einzelunternehmen. */
export function legalNameMatchesForm(name: string, form: string): boolean {
  if (form === "ug") return /unternehmergesellschaft|\(haftungsbeschränkt\)|\bug\b/i.test(name);
  if (form === "gmbh") return /gmbh|gesellschaft mit beschränkter haftung/i.test(name);
  if (form === "ag") return /\bag\b|aktiengesellschaft/i.test(name);
  return Boolean(name.trim());
}
