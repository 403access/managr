import { describe, expect, it } from "vitest";
import { activityQuantityMilli, invoiceLineDescription } from "@/domain/invoice-time";

describe("invoice time activities", () => {
  it("splits an entry's duration across its activities without losing a milli-hour", () => {
    expect(activityQuantityMilli(45, 2)).toEqual([375, 375]);
    expect(activityQuantityMilli(45, 1)).toEqual([750]);
    const parts = activityQuantityMilli(10, 3);
    expect(parts).toHaveLength(3);
    expect(parts.reduce((sum, part) => sum + part, 0)).toBe(167);
  });

  it("returns no quantities for unusable input", () => {
    expect(activityQuantityMilli(0, 2)).toEqual([]);
    expect(activityQuantityMilli(30, 0)).toEqual([]);
    expect(activityQuantityMilli(-5, 1)).toEqual([]);
  });

  it("puts the chosen customer and project in front of the activity", () => {
    const input = {
      customerName: "Lichtfeld GmbH",
      projectName: "IPR - KI Infrastruktur",
      activity: " Onboarding ",
      showCustomer: true,
      showProject: true,
    };
    expect(invoiceLineDescription(input)).toBe("Lichtfeld GmbH – IPR - KI Infrastruktur: Onboarding");
    expect(invoiceLineDescription({ ...input, showCustomer: false })).toBe("IPR - KI Infrastruktur: Onboarding");
    expect(invoiceLineDescription({ ...input, showProject: false })).toBe("Lichtfeld GmbH: Onboarding");
    expect(invoiceLineDescription({ ...input, showCustomer: false, showProject: false })).toBe("Onboarding");
    expect(invoiceLineDescription({ ...input, customerName: " ", projectName: " " })).toBe("Onboarding");
    expect(invoiceLineDescription({ ...input, activity: "x".repeat(400) })).toBe("x".repeat(400));
  });
});