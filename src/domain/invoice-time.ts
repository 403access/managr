/**
 * Time activities become invoice lines. An entry's duration belongs to all of
 * its activities together, so the quantity is split evenly across them. The
 * cumulative rounding keeps the entry's total quantity exact to the milli-hour.
 */
export function activityQuantityMilli(minutes: number, activityCount: number): number[] {
  if (!Number.isInteger(minutes) || minutes <= 0 || !Number.isInteger(activityCount) || activityCount <= 0) return [];
  const total = Math.round((minutes * 1000) / 60);
  let previous = 0;
  return Array.from({ length: activityCount }, (_, index) => {
    const next = Math.round((total * (index + 1)) / activityCount);
    const quantity = next - previous;
    previous = next;
    return quantity;
  });
}

/** The customer and project give the activity its context; the activity stays the line itself. */
export function invoiceLineDescription(input: {
  customerName: string;
  projectName: string;
  activity: string;
  showCustomer: boolean;
  showProject: boolean;
}): string {
  const text = input.activity.trim();
  const customer = input.showCustomer ? input.customerName.trim() : "";
  const project = input.showProject ? input.projectName.trim() : "";
  const context = [customer, project].filter(Boolean).join(" – ");
  if (!context) return text;
  const combined = `${context}: ${text}`;
  // The invoice line holds at most 400 characters; the activity alone still fits.
  return combined.length <= 400 ? combined : text;
}