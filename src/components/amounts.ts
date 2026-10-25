export function euroInput(cents: number): string {
  return new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents / 100);
}

export function quantityInput(milli: number): string {
  return new Intl.NumberFormat("de-DE", { maximumFractionDigits: 3 }).format(milli / 1000);
}

export function percentInput(bps: number): string {
  return new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(bps / 100);
}

export function hoursInput(minutes: number): string {
  return new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 }).format(minutes / 60);
}

export function formatDuration(minutes: number): string {
  const hours = Math.floor(Math.abs(minutes) / 60);
  const rest = Math.abs(minutes) % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}
