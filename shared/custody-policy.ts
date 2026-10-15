import type {
  CustodyBatch,
  CustodyLot,
  CustodyProduct,
  CustodySession,
  CustodySettings,
  CustodyStage,
} from "./custody-contract.js";

export const CUSTODY_STAGES = [
  "production", "rosso", "qalb", "antislip", "kawiya", "inspection", "packing", "storage", "followup", "customer_service",
] as const satisfies readonly CustodyStage[];

export const STAGE_DEPARTMENT_ALIASES: Record<CustodyStage, readonly string[]> = {
  production: ["production", "الإنتاج", "قسم الإنتاج"],
  rosso: ["rosso", "الروسو", "مرحلة الروسو"],
  qalb: ["qalb", "القلب", "مرحلة القلب"],
  antislip: ["antislip", "مانع الانزلاق", "مرحلة مانع الانزلاق"],
  kawiya: ["kawiya", "الكاوية", "مرحلة الكاوية"],
  inspection: ["inspection", "الفحص", "مرحلة الفحص"],
  packing: ["packing", "التغليف", "التعبئة والتغليف", "مرحلة التغليف"],
  storage: ["storage", "warehouse", "المخازن", "التخزين", "المستودع", "المستودعات"],
  followup: ["followup", "مدير المتابعة", "المتابعة"],
  customer_service: ["customer_service", "customer service", "خدمة العملاء"],
};

export type QuantityCheck = { ok: true } | { ok: false; message: string };

export function normalizeDepartment(value: unknown): string {
  return String(value ?? "").normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("ar");
}

export function accountBelongsToStage(department: unknown, stage: CustodyStage): boolean {
  const normalized = normalizeDepartment(department);
  return STAGE_DEPARTMENT_ALIASES[stage].some((alias) => normalizeDepartment(alias) === normalized);
}

export function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

export function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

/** Retains the additional pairs; this is only a display conversion. */
export function pairsAsDozenAndPairs(pairs: number): { dozen: number; pairs: number; label: string } {
  const dozen = Math.floor(pairs / 12);
  const extraPairs = pairs % 12;
  return { dozen, pairs: extraPairs, label: `${dozen} درزن و${extraPairs} زوج` };
}

export function exactQuantityError(expected: number, actual: number): QuantityCheck {
  if (actual === expected) return { ok: true };
  const difference = Math.abs(expected - actual);
  const differenceLabel = pairsAsDozenAndPairs(difference).label;
  if (actual < expected) {
    return {
      ok: false,
      message: `لا يمكن اعتماد التسليم. الكمية المستلمة ${expected} زوجًا، والمدخلة ${actual} زوجًا. يجب إكمال وتسوية ${difference} أزواج (${differenceLabel})`,
    };
  }
  return {
    ok: false,
    message: `لا يمكن اعتماد التسليم. الكمية تزيد على العهدة بمقدار ${difference} أزواج (${differenceLabel})`,
  };
}

/**
 * Sale stock has one fixed route except the two controlled allocation stages.
 * Samples intentionally have a separate route and never fall into sale stock.
 */
export function allowedDestinationStages(
  batch: Pick<CustodyBatch, "purpose" | "product">,
  sourceStage: CustodyStage,
  quality?: string,
): CustodyStage[] {
  if (batch.purpose === "sample") {
    if (sourceStage === "production") return [batch.product.antiSlip ? "antislip" : "customer_service"];
    if (sourceStage === "antislip") return ["customer_service"];
    return [];
  }

  switch (sourceStage) {
    case "production": return ["rosso"];
    case "rosso": return ["qalb"];
    case "qalb": return [batch.product.antiSlip ? "antislip" : "kawiya"];
    case "antislip": return quality === "suspected" ? ["inspection"] : ["kawiya"];
    case "kawiya": return ["inspection"];
    case "inspection": return quality === "damaged" ? ["followup"] : ["packing"];
    case "packing": return ["storage"];
    default: return [];
  }
}

export function assertRoute(
  batch: Pick<CustodyBatch, "purpose" | "product">,
  sourceStage: CustodyStage,
  targetStage: CustodyStage,
  quality: string,
): void {
  if (!allowedDestinationStages(batch, sourceStage, quality).includes(targetStage)) {
    throw new Error("مسار غير مسموح لهذه العهدة أو تصنيف الجودة");
  }
}

export function validateProductSnapshot(product: CustodyProduct): void {
  const requiredText: Array<[string, string]> = [
    [product.code, "رمز الصنف"], [product.name, "اسم الصنف"], [product.size, "المقاس"], [product.color, "اللون"],
  ];
  for (const [value, label] of requiredText) {
    if (!String(value ?? "").trim()) throw new Error(`${label} إلزامي`);
  }
  if (!Number.isFinite(product.yarnWeightGrams) || product.yarnWeightGrams < 0) throw new Error("وزن الخيوط بالجرام غير صالح");
  if (!Number.isFinite(product.pairWeightGrams) || product.pairWeightGrams <= 0) throw new Error("وزن الزوج بالجرام يجب أن يكون أكبر من صفر");
  if (!Array.isArray(product.yarns) || product.yarns.length === 0) throw new Error("أدخل نوع خيط واحد على الأقل");
  let percentage = 0;
  for (const yarn of product.yarns) {
    if (!String(yarn?.name ?? "").trim() || !Number.isFinite(yarn?.percentage) || yarn.percentage <= 0) {
      throw new Error("بيانات الخيوط أو نسبها غير صالحة");
    }
    percentage += yarn.percentage;
  }
  // Decimal blends are allowed, but accidental 90/100 data must not become a snapshot.
  if (Math.abs(percentage - 100) > 0.001) throw new Error("يجب أن يساوي مجموع نسب الخيوط 100%");
}

export type TimingMetrics = {
  custodyDurationMinutes: number | null;
  waitingToStartMinutes: number | null;
  activeWorkMinutes: number | null;
  pausedMinutes: number | null;
  waitingToSendMinutes: number | null;
  waitingForConfirmationMinutes: number | null;
  productivityPairsPerHour: number | null;
  minutesPerPair: number | null;
  timingComplete: boolean;
};

function durationMinutes(start?: string, end?: string, now = new Date()): number | null {
  if (!start) return null;
  const startMs = Date.parse(start);
  const endMs = end ? Date.parse(end) : now.getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) return null;
  return Math.floor((endMs - startMs) / 60_000);
}

/** Computes only observed sessions. No shift schedule is invented when settings are empty. */
export function computeTimingMetrics(lot: CustodyLot, sessions: CustodySession[], now = new Date()): TimingMetrics {
  const related = sessions.filter((session) => session.custodyId === lot.id);
  const work = related.filter((session) => session.kind === "work");
  const pauses = related.filter((session) => session.kind === "pause");
  const activeWorkMinutes = work.length
    ? work.reduce<number | null>((sum, session) => {
      const minutes = durationMinutes(session.startedAt, session.endedAt, now);
      return sum === null || minutes === null ? null : sum + minutes;
    }, 0)
    : null;
  const pausedMinutes = pauses.length
    ? pauses.reduce<number | null>((sum, session) => {
      const minutes = durationMinutes(session.startedAt, session.endedAt, now);
      return sum === null || minutes === null ? null : sum + minutes;
    }, 0)
    : null;
  const firstStartedAt = work.map((session) => session.startedAt).sort()[0];
  const productivityPairsPerHour = activeWorkMinutes && activeWorkMinutes > 0 && lot.completedAt && lot.progressPairs > 0
    ? (lot.progressPairs * 60) / activeWorkMinutes
    : null;
  const minutesPerPair = activeWorkMinutes && activeWorkMinutes > 0 && lot.completedAt && lot.progressPairs > 0
    ? activeWorkMinutes / lot.progressPairs
    : null;
  return {
    custodyDurationMinutes: lot.sentAt ? durationMinutes(lot.receivedAt, lot.sentAt, now) : null,
    waitingToStartMinutes: firstStartedAt ? durationMinutes(lot.receivedAt, firstStartedAt, now) : null,
    activeWorkMinutes,
    pausedMinutes,
    waitingToSendMinutes: lot.completedAt && lot.sentAt ? durationMinutes(lot.completedAt, lot.sentAt, now) : null,
    waitingForConfirmationMinutes: lot.sentAt ? durationMinutes(lot.sentAt, undefined, now) : null,
    productivityPairsPerHour,
    minutesPerPair,
    timingComplete: Boolean(lot.receivedAt && firstStartedAt && lot.completedAt && lot.sentAt && activeWorkMinutes !== null),
  };
}

/** Returns null without configured shifts, rather than manufacturing a shift-time KPI. */
export function isWithinConfiguredShift(iso: string, settings: Pick<CustodySettings, "shifts" | "holidays">): boolean | null {
  if (!settings.shifts.length) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const riyadh = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const part = (type: string) => riyadh.find((item) => item.type === type)?.value ?? "";
  const dayKey = `${part("year")}-${part("month")}-${part("day")}`;
  if (settings.holidays.includes(dayKey)) return false;
  const weekdayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const weekday = weekdayNames.indexOf(part("weekday"));
  const minutes = Number(part("hour")) * 60 + Number(part("minute"));
  return settings.shifts.some((shift) => {
    if (!shift.days.includes(weekday)) return false;
    const parseTime = (time: string) => {
      const [hour, minute] = time.split(":").map(Number);
      return hour * 60 + minute;
    };
    const start = parseTime(shift.start);
    const end = parseTime(shift.end);
    return end >= start ? minutes >= start && minutes < end : minutes >= start || minutes < end;
  });
}

export function batchProductIdentity(product: CustodyProduct): string {
  return [product.code, product.size, product.color].map((part) => String(part).trim().toLocaleLowerCase("ar")).join("|");
}
