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

/** The project gives the customer the context; the activity stays the line itself. */
export function invoiceLineDescription(projectName: string, activity: string): string {
  const project = projectName.trim();
  const text = activity.trim();
  if (!project) return text;
  const combined = `${project}: ${text}`;
  // The invoice line holds at most 400 characters; the activity alone still fits.
  return combined.length <= 400 ? combined : text;
}