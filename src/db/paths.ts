import path from "path";

export function databasePath(): string {
  return path.join(process.cwd(), "data", "managr.db");
}

export function uploadsDir(): string {
  return path.join(process.cwd(), "data", "uploads");
}
