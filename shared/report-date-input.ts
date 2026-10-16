/** Dates committed by calendar fields; partial typing must never reach report calculations. */
export function normalizeReportDateInput(value: unknown): string {
  if (typeof value !== "string") return "";
  const text = value.replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, "")
    .replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 0x660))
    .replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - 0x6f0)).trim();
  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  const local = text.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
  const parts = iso ? [iso[1], iso[2], iso[3]] : local ? [local[3], local[2], local[1]] : null;
  if (!parts) return "";
  const day = `${parts[0]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`;
  const date = new Date(`${day}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === day ? day : "";
}
export function calendarDateKey(date: Date): string {
  if (!Number.isFinite(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
/** null means keep the last complete value; optional fields may deliberately be cleared. */
export function dateFieldCommit(value: unknown, required = true): string | null {
  if (value === "" && !required) return "";
  return normalizeReportDateInput(value) || null;
}
