const arabicDigits = "٠١٢٣٤٥٦٧٨٩";
const easternArabicDigits = "۰۱۲۳۴۵۶۷۸۹";

function latinDigits(value: unknown): string {
  return String(value ?? "")
    .trim()
    .replace(/[٠-٩]/g, (digit) => String(arabicDigits.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String(easternArabicDigits.indexOf(digit)));
}

export type ProductionWindowInput = {
  productionDate: string;
  productionEndDate?: string;
  workStartTime?: string;
  workEndTime?: string;
};

export type ProductionWindow = {
  productionDate: string;
  productionEndDate: string;
  workStartTime: string;
  workEndTime: string;
  totalMinutes: number;
  productionHours: number;
  productionMinutes: number;
};

export function normalizeCalendarDate(value: unknown, label = "التاريخ"): string {
  const date = latinDigits(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`${label} يجب أن يكون بصيغة YYYY-MM-DD`);
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) throw new Error(`${label} غير صالح`);
  return date;
}

export function normalizeClockTime(value: unknown, label = "الوقت"): string {
  const time = latinDigits(value);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error(`${label} يجب أن يكون بصيغة HH:MM`);
  return time;
}

/**
 * A production window is optional for legacy API callers. Once one of its fields
 * is supplied, all four fields are required so the system never stores a guessed
 * duration. It uses the Riyadh UTC+03:00 offset; no client clock is trusted.
 */
export function normalizeProductionWindow(input: ProductionWindowInput): ProductionWindow | undefined {
  const productionDate = normalizeCalendarDate(input.productionDate, "تاريخ بداية الإنتاج");
  const supplied = [input.productionEndDate, input.workStartTime, input.workEndTime]
    .some((value) => String(value ?? "").trim().length > 0);
  if (!supplied) return undefined;

  const productionEndDate = normalizeCalendarDate(input.productionEndDate, "تاريخ نهاية الإنتاج");
  const workStartTime = normalizeClockTime(input.workStartTime, "وقت بداية العمل");
  const workEndTime = normalizeClockTime(input.workEndTime, "وقت نهاية العمل");
  const start = Date.parse(`${productionDate}T${workStartTime}:00+03:00`);
  const end = Date.parse(`${productionEndDate}T${workEndTime}:00+03:00`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    throw new Error("يجب أن يكون تاريخ ووقت نهاية العمل بعد تاريخ ووقت البداية");
  }
  const totalMinutes = Math.round((end - start) / 60_000);
  return {
    productionDate,
    productionEndDate,
    workStartTime,
    workEndTime,
    totalMinutes,
    productionHours: Math.floor(totalMinutes / 60),
    productionMinutes: totalMinutes % 60,
  };
}
