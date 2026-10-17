import { normalizeReportDateInput } from "./report-date-input";
import { accountBelongsToStage, CUSTODY_STAGES } from "./custody-policy";
import {
  CUSTODY_QUALITY_LABELS,
  CUSTODY_STAGE_LABELS,
  CUSTODY_STATUS_LABELS,
  type CustodyAccount,
  type CustodyBatch,
  type CustodyLot,
  type CustodyQuality,
  type CustodySettings,
  type CustodyStage,
  type CustodyStatus,
} from "./custody-contract";

/** Reporting is read-only. All timestamps are UTC ISO values and display/range rules use Asia/Riyadh. */
export const RIYADH_TIME_ZONE = "Asia/Riyadh";

export type ReportPeriod = "daily" | "weekly" | "monthly" | "custom";

export type CustodyReportFilters = {
  startDate: string;
  endDate: string;
  period?: ReportPeriod;
  department?: string;
  accountId?: number;
  product?: string;
  batch?: string;
  quality?: CustodyQuality;
  status?: CustodyStatus | "pending" | "confirmed" | "disputed" | "rejected";
};

export type ReportRange = {
  start: Date;
  end: Date;
  startDate: string;
  endDate: string;
};

export type TimingValue = {
  calendarMs: number | null;
  businessMs: number | null;
  state: "available" | "incomplete" | "unavailable";
  note?: string;
};

export type CustodyReportEvent = {
  shift?: string;
  machineNumber?: string;
  id: string;
  source:
    | "custody"
    | "transfer"
    | "session"
    | "progress"
    | "disposal"
    | "audit";
  batchId: string;
  trackingNumber: string;
  custodyId?: string;
  parentCustodyId?: string;
  actorId?: number;
  actorName: string;
  department: string;
  stage?: CustodyStage;
  action: string;
  actionLabel: string;
  at?: string;
  pairs?: number;
  quality?: CustodyQuality;
  status?: string;
  /** Counterparty fields keep the other end visible without creating a second transfer row. */
  counterparty?: string;
  counterpartyId?: number;
  counterpartyDepartment?: string;
  sourceName?: string;
  sourceUserId?: number;
  sourceStage?: CustodyStage;
  sourceDepartment?: string;
  destinationName?: string;
  destinationUserId?: number;
  destinationStage?: CustodyStage;
  destinationDepartment?: string;
  /** Immutable transfer snapshot: requested quantity, counted quantity, and their signed difference (actual - requested). */
  expectedPairs?: number;
  actualPairs?: number;
  quantityDifferencePairs?: number;
  sentAt?: string;
  receivedAt?: string;
  handoverDuration?: TimingValue;
  reason?: string;
  product: string;
  productCode: string;
  productSize: string;
  productColor: string;
  incomplete?: boolean;
  /** Historical timing remains intentionally non-measurable until explicitly replaced by a new custody record. */
  legacyTiming?: boolean;
  legacySourceId?: number;
  progress?: {
    cumulativePairs: number;
    deltaPairs: number;
    intervalStartAt?: string;
    intervalEndAt: string;
  };
  timing?: {
    custodyDuration: TimingValue;
    awaitingConfirmation: TimingValue;
    waitForStart: TimingValue;
    waitForCompletion: TimingValue;
    manualWork: TimingValue;
    pause: TimingValue;
  };
};

export type EmployeeReport = {
  employeeId: number;
  employeeName: string;
  department: string;
  events: CustodyReportEvent[];
  totals: {
    receivedPairs: number;
    completedPairs: number;
    goodCompletedPairs: number;
    damagedCompletedPairs: number;
    suspectedCompletedPairs: number;
    reworkCompletedPairs: number;
    sampleCompletedPairs: number;
    goodWorkMs: number;
    workMinutesPerGoodPair: number | null;
    confirmedOutboundPairs: number;
    pendingOutboundPairs: number;
    openCustodyPairs: number;
    manualWorkMs: number | null;
    pauseMs: number | null;
    productivityPairsPerHour: number | null;
    timeIncomplete: boolean;
  };
  balance: {
    openingPairs: number;
    confirmedInboundPairs: number;
    confirmedOutboundPairs: number;
    pendingOutboundPairs: number;
    endingLiabilityPairs: number;
  };
};

export type DepartmentReport = {
  department: string;
  employees: EmployeeReport[];
};

/** A stage-level custody ledger. Values are signed where needed and are deliberately never clamped. */
export type CustodyStageTotal = {
  stage: CustodyStage;
  stageLabel: string;
  openingPairs: number;
  confirmedInboundPairs: number;
  confirmedOutboundPairs: number;
  pendingOutboundPairs: number;
  /** Final approved exits (stock_stored, executed disposal, or evidenced sample delivery). */
  releasedPairs: number;
  remainingPairs: number;
  invalidQuantityCount: number;
};

export type BatchTimelineNode = {
  id: string;
  parentId?: string;
  kind: "custody" | "transfer" | "disposal" | "event";
  stage?: CustodyStage;
  stageLabel: string;
  quality?: CustodyQuality;
  qualityLabel?: string;
  pairs: number;
  status: string;
  statusLabel: string;
  at?: string;
  owner?: string;
  detail?: string;
  children: BatchTimelineNode[];
};

export type BatchTimeline = {
  batchId: string;
  trackingNumber: string;
  product: string;
  originalProductionPairs: number;
  firstPairs: number;
  secondPairs: number;
  executedDestroyedPairs: number;
  nodes: BatchTimelineNode[];
  issues: string[];
};

export type CustodyReport = {
  range: ReportRange;
  events: CustodyReportEvent[];
  /** One immutable-snapshot row per transfer, including pending transfers that affect the ending responsibility. */
  transfers: CustodyReportEvent[];
  stageTotals: CustodyStageTotal[];
  departments: DepartmentReport[];
  timelines: BatchTimeline[];
  originalProductionPairs: number;
  quality: {
    firstPairs: number;
    secondPairs: number;
    suspectedPairs: number;
    damagedPairs: number;
  };
  disposal: {
    receivedPairs: number;
    approvedPairs: number;
    executedPairs: number;
  };
  warehouseFinalStockPairs: number;
  samplesWithDeliveryProof: number;
  legacy: {
    openingBatchCount: number;
    openingPairs: number;
    linkedLegacySourceCount: number;
  };
  warnings: string[];
  businessTime: { available: boolean; issues: string[] };
};

/** Compact fact-only aggregate intended for daily-summary embeds; it does not manufacture rates for incomplete timing. */
export type CustodyReportSummary = {
  originalProductionPairs: number;
  receivedPairs: number;
  completedPairs: number;
  confirmedOutboundPairs: number;
  pendingOutboundPairs: number;
  openCustodyPairs: number;
  warehouseFinalStockPairs: number;
  executedDestroyedPairs: number;
  legacyOpeningPairs: number;
  legacyOpeningBatchCount: number;
  employeesWithIncompleteTiming: number;
  stageTotals: CustodyStageTotal[];
};

type IndexedBatch = {
  batch: CustodyBatch;
  custodyById: Map<string, CustodyLot>;
};
type LegacyAwareBatch = CustodyBatch & {
  openingBalance?: boolean;
  legacySource?: { id: number; productionId?: number; quantityPairs: number };
};

const isoDay = /^\d{4}-\d{2}-\d{2}$/;
const timeOfDay = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

function finiteNumber(value: unknown): number | null {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function validDate(value: unknown): Date | null {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isFinite(date.getTime()) ? date : null;
}

function isoAt(value: Date): string {
  return value.toISOString();
}

function dayAfter(day: string): string {
  const parsed = new Date(`${day}T12:00:00Z`);
  if (!Number.isFinite(parsed.getTime()))
    throw new Error(`Invalid Riyadh date: ${day}`);
  parsed.setUTCDate(parsed.getUTCDate() + 1);
  return parsed.toISOString().slice(0, 10);
}

/** Half-open [start, end) in Riyadh. endDate is included completely. */
export function riyadhRange(startDate: string, endDate: string): ReportRange {
  const normalizedStart = normalizeReportDateInput(startDate);
  const normalizedEnd = normalizeReportDateInput(endDate);
  if (!normalizedStart || !normalizedEnd)
    throw new Error("اختر تاريخ بداية ونهاية صحيحين من التقويم");
  startDate = normalizedStart;
  endDate = normalizedEnd;
  if (endDate < startDate)
    throw new Error("تاريخ النهاية يجب ألا يسبق تاريخ البداية");
  // Saudi Arabia is UTC+03 without DST; explicit offsets avoid the device timezone entirely.
  const start = new Date(`${startDate}T00:00:00.000+03:00`);
  const end = new Date(`${dayAfter(endDate)}T00:00:00.000+03:00`);
  return { start, end, startDate, endDate };
}

export function isInReportRange(
  at: string | undefined,
  range: ReportRange,
): boolean {
  const parsed = validDate(at);
  return !!parsed && parsed >= range.start && parsed < range.end;
}

export function formatRiyadh(at?: string, withSeconds = true): string {
  const value = validDate(at);
  if (!value) return "وقت غير مكتمل";
  return new Intl.DateTimeFormat("ar-SA", {
    timeZone: RIYADH_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    ...(withSeconds ? { second: "2-digit" } : {}),
    hourCycle: "h23",
  }).format(value);
}

export function formatPairs(pairs: number | null | undefined): string {
  const whole = finiteNumber(pairs);
  if (whole === null) return "كمية غير صالحة — تحتاج مراجعة";
  const dozen = whole >= 0 ? Math.floor(whole / 12) : Math.ceil(whole / 12);
  const remaining = Math.abs(whole - dozen * 12);
  return `${whole.toLocaleString("ar-SA")} زوج (${dozen.toLocaleString("ar-SA")} درزن و${remaining.toLocaleString("ar-SA")} زوج)`;
}

export function formatDuration(milliseconds: number | null): string {
  if (milliseconds === null || !Number.isFinite(milliseconds))
    return "بيانات وقت غير مكتملة";
  const minutes = Math.round(milliseconds / 60_000);
  const hours = Math.floor(minutes / 60);
  return `${hours.toLocaleString("ar-SA")} ساعة و${(minutes % 60).toLocaleString("ar-SA")} دقيقة`;
}

function actionLabel(action: string): string {
  const labels: Record<string, string> = {
    receive: "تأكيد الاستلام",
    received: "استلام",
    start: "بدء العمل",
    pause: "إيقاف مؤقت",
    resume: "استئناف العمل",
    progress: "تسجيل تقدم",
    complete: "اكتمال العمل",
    send: "تسليم / إرسال",
    sent: "تسليم / إرسال",
    confirm: "تأكيد استلام الطرف التالي",
    confirmed: "تأكيد استلام الطرف التالي",
    dispute: "تسجيل اختلاف كمية",
    rejected: "رفض الحركة",
    resolve: "تسوية الاختلاف",
    store: "إدخال نهائي للمخزون",
    approve_disposal: "اعتماد محضر الإتلاف",
    execute_disposal: "تنفيذ الإتلاف",
    deliver_sample: "توثيق تسليم العينة",
    correct: "تصحيح موثق",
    rework: "إعادة معالجة",
    transfer: "تحويل عهدة — تسليم واستلام",
    transfer_disputed: "اختلاف كمية",
    transfer_rejected: "رفض الحركة",
    transfer_resolved_to_pending: "تسوية موثقة للاختلاف",
    stock_stored: "إدخال نهائي للمخزون",
    sample_delivered: "تسليم عينة مثبت",
    batch_correction_recorded: "تصحيح إصدار موثق",
    rework_override_sent: "قرار إعادة معالجة",
  };
  return labels[action] || action || "حركة";
}

/** Report-only storage wording makes clear that this is the one approved finished-goods stock view. */
export function custodyStageLabel(stage?: CustodyStage): string {
  if (!stage) return "غير محدد";
  return stage === "storage"
    ? "التخزين والمستودعات — إنتاج تام"
    : CUSTODY_STAGE_LABELS[stage];
}

export function arabicDepartment(department: string): string {
  const stage = (Object.keys(CUSTODY_STAGE_LABELS) as CustodyStage[]).find(
    (stage) => accountBelongsToStage(department, stage),
  );
  return stage ? custodyStageLabel(stage) : department;
}
function accountMaps(accounts: CustodyAccount[]) {
  accounts = accounts.map((account) => ({
    ...account,
    department: arabicDepartment(account.department),
  }));
  const byId = new Map(accounts.map((account) => [account.id, account]));
  return {
    byId,
    nameFor: (id: number | undefined, fallback = "غير محدد") =>
      byId.get(id ?? -1)?.name || fallback,
    departmentFor: (id: number | undefined, fallback = "غير محدد") =>
      byId.get(id ?? -1)?.department || fallback,
  };
}

function stageDepartment(stage?: CustodyStage): string {
  return custodyStageLabel(stage);
}

function intersectMs(start: Date, end: Date, range: ReportRange): number {
  const left = Math.max(start.getTime(), range.start.getTime());
  const right = Math.min(end.getTime(), range.end.getTime());
  return Math.max(0, right - left);
}

function validSettings(settings?: CustodySettings): {
  available: boolean;
  issues: string[];
} {
  if (!settings)
    return {
      available: false,
      issues: ["إعدادات الورديات غير متاحة؛ لا يمكن حساب زمن الدوام."],
    };
  const issues: string[] = [];
  if (!Array.isArray(settings.shifts) || settings.shifts.length === 0)
    issues.push("لم تُضبط ورديات العمل؛ لا يمكن حساب زمن الدوام.");
  for (const shift of settings.shifts || []) {
    if (
      !shift.name?.trim() ||
      !timeOfDay.test(shift.start) ||
      !timeOfDay.test(shift.end) ||
      shift.start === shift.end
    ) {
      issues.push(`إعداد وردية غير صحيح: ${shift.name || "بدون اسم"}.`);
    }
    if (
      !Array.isArray(shift.days) ||
      shift.days.length === 0 ||
      shift.days.some((day) => !Number.isInteger(day) || day < 0 || day > 6)
    ) {
      issues.push(`أيام وردية غير صحيحة: ${shift.name || "بدون اسم"}.`);
    }
  }
  for (const [stage, limit] of Object.entries(settings.stageLimits || {})) {
    if (
      !limit ||
      !Number.isFinite(limit.workHours) ||
      !Number.isFinite(limit.confirmationHours) ||
      limit.workHours < 0 ||
      limit.confirmationHours < 0
    ) {
      issues.push(
        `حدود المرحلة غير صحيحة: ${CUSTODY_STAGE_LABELS[stage as CustodyStage] || stage}.`,
      );
    }
  }
  if ((settings.holidays || []).some((holiday) => !isoDay.test(holiday)))
    issues.push("توجد عطلات بصيغة تاريخ غير صحيحة.");
  return { available: issues.length === 0, issues };
}

function riyadhWeekday(day: string): number {
  return new Date(`${day}T12:00:00Z`).getUTCDay();
}

function timeOnDay(day: string, value: string): Date {
  return new Date(`${day}T${value}:00.000+03:00`);
}

/** Intersects a real recorded interval with configured shifts. It never creates synthetic hourly work. */
export function businessMilliseconds(
  startAt: string | undefined,
  endAt: string | undefined,
  settings?: CustodySettings,
): TimingValue {
  const start = validDate(startAt);
  const end = validDate(endAt);
  if (!start || !end || end < start)
    return {
      calendarMs: null,
      businessMs: null,
      state: "incomplete",
      note: "وقت البداية أو النهاية غير مكتمل.",
    };
  const settingCheck = validSettings(settings);
  const calendarMs = end.getTime() - start.getTime();
  if (!settingCheck.available)
    return {
      calendarMs,
      businessMs: null,
      state: "unavailable",
      note: settingCheck.issues.join(" "),
    };
  const dayKey = (at: Date) => {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: RIYADH_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(at);
    return `${parts.find((p) => p.type === "year")!.value}-${parts.find((p) => p.type === "month")!.value}-${parts.find((p) => p.type === "day")!.value}`;
  };
  // Include the previous day: its overnight shift can intersect the beginning of this interval.
  let day = dayKey(new Date(start.getTime() - 86400000));
  const lastDay = dayKey(end);
  const holidays = new Set(settings?.holidays || []);
  const intervals: ExactInterval[] = [];
  while (day <= lastDay) {
    if (!holidays.has(day))
      for (const shift of settings?.shifts || []) {
        if (!shift.days.includes(riyadhWeekday(day))) continue;
        const left = timeOnDay(day, shift.start);
        let right = timeOnDay(day, shift.end);
        if (right <= left) right = timeOnDay(dayAfter(day), shift.end);
        // Split across midnight so holidays never contribute working minutes.
        const midnight = timeOnDay(dayAfter(day), "00:00");
        const segments =
          right > midnight
            ? [
                { day, start: left, end: midnight },
                { day: dayAfter(day), start: midnight, end: right },
              ]
            : [{ day, start: left, end: right }];
        for (const segment of segments) {
          if (holidays.has(segment.day)) continue;
          const a = Math.max(start.getTime(), segment.start.getTime()),
            b = Math.min(end.getTime(), segment.end.getTime());
          if (b > a) intervals.push({ start: a, end: b });
        }
      }
    day = dayAfter(day);
  }
  return {
    calendarMs,
    businessMs: mergedIntervalMilliseconds(intervals),
    state: "available",
  };
}

function timing(
  start?: string,
  end?: string,
  settings?: CustodySettings,
): TimingValue {
  return businessMilliseconds(start, end, settings);
}

function lotTiming(
  batch: CustodyBatch,
  lot: CustodyLot,
  settings?: CustodySettings,
): CustodyReportEvent["timing"] {
  if (lot.legacyTiming) {
    const unavailable: TimingValue = {
      calendarMs: null,
      businessMs: null,
      state: "incomplete",
      note: "توقيت عهدة مرحّلة تاريخياً غير مكتمل؛ لا تُقاس الإنتاجية.",
    };
    return {
      custodyDuration: unavailable,
      awaitingConfirmation: unavailable,
      waitForStart: unavailable,
      waitForCompletion: unavailable,
      manualWork: unavailable,
      pause: unavailable,
    };
  }
  const outgoing = batch.transfers.filter(
    (item) => item.sourceCustodyId === lot.id,
  );
  const confirmedAt =
    outgoing.length &&
    outgoing.every((item) => item.status === "confirmed" && item.receivedAt)
      ? outgoing
          .map((item) => item.receivedAt!)
          .sort()
          .at(-1)
      : undefined;
  const sessions = batch.sessions.filter(
    (session) => session.custodyId === lot.id,
  );
  const completeWork = sessions.filter(
    (session) => session.kind === "work" && session.endedAt,
  );
  const completePause = sessions.filter(
    (session) => session.kind === "pause" && session.endedAt,
  );
  const workMs = completeWork.reduce(
    (sum, session) =>
      sum +
      Math.max(
        0,
        new Date(session.endedAt!).getTime() -
          new Date(session.startedAt).getTime(),
      ),
    0,
  );
  const pauseMs = completePause.reduce(
    (sum, session) =>
      sum +
      Math.max(
        0,
        new Date(session.endedAt!).getTime() -
          new Date(session.startedAt).getTime(),
      ),
    0,
  );
  const unfinished = sessions.some(
    (session) => !session.endedAt || !validDate(session.startedAt),
  );
  const aggregate = (
    milliseconds: number,
    incomplete: boolean,
  ): TimingValue => ({
    calendarMs: incomplete ? null : milliseconds,
    businessMs: null,
    state: incomplete ? "incomplete" : "available",
    ...(incomplete ? { note: "توجد جلسة غير مكتملة." } : {}),
  });
  return {
    custodyDuration: timing(lot.receivedAt, lot.sentAt, settings),
    awaitingConfirmation: timing(lot.sentAt, confirmedAt, settings),
    waitForStart: timing(lot.receivedAt, lot.startedAt, settings),
    waitForCompletion: timing(lot.completedAt, lot.sentAt, settings),
    manualWork: aggregate(workMs, unfinished),
    pause: aggregate(pauseMs, unfinished),
  };
}

function indexedBatches(batches: CustodyBatch[]): IndexedBatch[] {
  return batches.map((batch) => ({
    batch,
    custodyById: new Map(
      batch.custodies.map((custody) => [custody.id, custody]),
    ),
  }));
}

function isRootCustody(index: IndexedBatch, lot: CustodyLot): boolean {
  // A destination custody is the same confirmed movement represented in a child record, never a second inbound balance.
  return !index.batch.transfers.some(
    (transfer) => transfer.destinationCustodyId === lot.id,
  );
}

function makeEvent(
  input: Omit<CustodyReportEvent, "actionLabel">,
): CustodyReportEvent {
  return { ...input, actionLabel: actionLabel(input.action) };
}

/** Produces one display record for every contract fact; no arbitrary caps or quantity clamping. */
export function buildReportEvents(
  batches: CustodyBatch[],
  accounts: CustodyAccount[],
  settings?: CustodySettings,
): CustodyReportEvent[] {
  const maps = accountMaps(accounts);
  const rows: CustodyReportEvent[] = [];
  for (const index of indexedBatches(batches)) {
    const { batch } = index;
    const product = batch.product.name || batch.product.code;
    const legacy = batch as LegacyAwareBatch;
    const base = {
      shift: batch.shift,
      machineNumber: batch.machineNumber,
      batchId: batch.id,
      trackingNumber: batch.trackingNumber,
      product,
      productCode: batch.product.code,
      productSize: batch.product.size,
      productColor: batch.product.color,
      legacySourceId: legacy.openingBalance
        ? legacy.legacySource?.id
        : undefined,
    };
    const lotById = index.custodyById;
    for (const lot of batch.custodies) {
      const actorId = lot.ownerId;
      const actorName = lot.ownerName || maps.nameFor(actorId);
      const department = maps.departmentFor(
        actorId,
        stageDepartment(lot.stage),
      );
      const common = {
        ...base,
        custodyId: lot.id,
        parentCustodyId: lot.parentCustodyId,
        actorId,
        actorName,
        department,
        stage: lot.stage,
        pairs: lot.pairs,
        quality: lot.quality,
        status: lot.status,
        timing: lotTiming(batch, lot, settings),
        legacyTiming: lot.legacyTiming,
      };
      const inboundTransfer = batch.transfers.find(
        (transfer) =>
          transfer.destinationCustodyId === lot.id && transfer.receivedAt,
      );
      const outboundTransfer = batch.transfers.find(
        (transfer) => transfer.sourceCustodyId === lot.id,
      );
      // Transfer facts are the authority for an inter-employee receipt/send. Avoid
      // rendering the identical custody timestamp as a second apparent movement.
      if (!inboundTransfer)
        rows.push(
          makeEvent({
            id: `custody:${lot.id}:received`,
            source: "custody",
            ...common,
            action: "received",
            at: lot.receivedAt,
          }),
        );
      if (
        lot.startedAt &&
        !batch.sessions.some(
          (session) => session.custodyId === lot.id && session.kind === "work",
        )
      )
        rows.push(
          makeEvent({
            id: `custody:${lot.id}:started`,
            source: "custody",
            ...common,
            action: "start",
            at: lot.startedAt,
          }),
        );
      if (lot.completedAt)
        rows.push(
          makeEvent({
            id: `custody:${lot.id}:completed`,
            source: "custody",
            ...common,
            action: "complete",
            at: lot.completedAt,
          }),
        );
      if (lot.sentAt && !outboundTransfer)
        rows.push(
          makeEvent({
            id: `custody:${lot.id}:sent`,
            source: "custody",
            ...common,
            action: "sent",
            at: lot.sentAt,
          }),
        );
    }
    for (const session of batch.sessions) {
      const lot = lotById.get(session.custodyId);
      const actorId = session.userId;
      const stage = lot?.stage;
      const common = {
        ...base,
        custodyId: session.custodyId,
        parentCustodyId: lot?.parentCustodyId,
        actorId,
        actorName: maps.nameFor(actorId, lot?.ownerName || "غير محدد"),
        department: maps.departmentFor(actorId, stageDepartment(stage)),
        stage,
        pairs: lot?.pairs,
        quality: lot?.quality,
        status: lot?.status,
        reason: session.reason,
      };
      rows.push(
        makeEvent({
          id: `session:${session.id}:start`,
          source: "session",
          ...common,
          action:
            session.kind === "pause"
              ? "pause"
              : session.startedAt === lot?.startedAt
                ? "start"
                : "resume",
          at: session.startedAt,
          incomplete: !session.endedAt,
        }),
      );
      // End timestamps stay on the recorded session, never masquerade as a second pause/start.
    }
    const progressByCustody = new Map<string, typeof batch.progress>();
    for (const progress of batch.progress) {
      progressByCustody.set(progress.custodyId, [
        ...(progressByCustody.get(progress.custodyId) || []),
        progress,
      ]);
    }
    for (const custodyProgress of progressByCustody.values()) {
      custodyProgress.sort(
        (left, right) =>
          (validDate(left.recordedAt)?.getTime() || 0) -
          (validDate(right.recordedAt)?.getTime() || 0),
      );
      let previousPairs = 0;
      let previousRecordedAt: string | undefined;
      for (const progress of custodyProgress) {
        const lot = lotById.get(progress.custodyId);
        // Progress is cumulative at the source. Each reported reading therefore represents
        // only its exact change since the prior real reading (including any pre-range baseline).
        // A negative delta is deliberately preserved as a discrepancy, never hidden or clamped.
        const delta = progress.pairs - previousPairs;
        previousPairs = progress.pairs;
        rows.push(
          makeEvent({
            id: `progress:${progress.id}`,
            source: "progress",
            ...base,
            custodyId: progress.custodyId,
            parentCustodyId: lot?.parentCustodyId,
            actorId: progress.userId,
            actorName: maps.nameFor(
              progress.userId,
              lot?.ownerName || "غير محدد",
            ),
            department: maps.departmentFor(
              progress.userId,
              stageDepartment(lot?.stage),
            ),
            stage: lot?.stage,
            action: "progress",
            at: progress.recordedAt,
            pairs: delta,
            quality: lot?.quality,
            status: lot?.status,
            reason: `قراءة تراكمية: ${progress.pairs} زوج؛ التغير عن القراءة السابقة: ${delta} زوج.`,
            progress: {
              cumulativePairs: progress.pairs,
              deltaPairs: delta,
              intervalStartAt: previousRecordedAt,
              intervalEndAt: progress.recordedAt,
            },
          }),
        );
        previousRecordedAt = progress.recordedAt;
      }
    }
    for (const transfer of batch.transfers) {
      const sourceLot = lotById.get(transfer.sourceCustodyId);
      const destinationLot = transfer.destinationCustodyId
        ? lotById.get(transfer.destinationCustodyId)
        : undefined;
      const sourceName = transfer.fromName || maps.nameFor(transfer.fromUserId);
      const destinationName =
        transfer.toName || maps.nameFor(transfer.toUserId);
      const sourceDepartment = stageDepartment(transfer.fromStage);
      const destinationDepartment = stageDepartment(transfer.toStage);
      const actualPairs =
        transfer.actualPairs ??
        (transfer.status === "confirmed" ? transfer.pairs : undefined);
      // A transfer is one immutable-snapshot movement. Its receipt is represented as fields on
      // this same row, never as a second received row that makes stages look double-counted.
      rows.push(
        makeEvent({
          id: `transfer:${transfer.id}`,
          source: "transfer",
          ...base,
          custodyId: transfer.sourceCustodyId,
          parentCustodyId: sourceLot?.parentCustodyId,
          actorId: transfer.fromUserId,
          actorName: sourceName,
          department: sourceDepartment,
          stage: transfer.fromStage,
          action: "transfer",
          at: transfer.receivedAt || transfer.sentAt,
          pairs: transfer.pairs,
          expectedPairs: transfer.pairs,
          actualPairs,
          quantityDifferencePairs:
            actualPairs === undefined
              ? undefined
              : actualPairs - transfer.pairs,
          quality: transfer.quality,
          status: transfer.status,
          counterparty: destinationName,
          counterpartyId: transfer.toUserId,
          counterpartyDepartment: destinationDepartment,
          sourceName,
          sourceUserId: transfer.fromUserId,
          sourceStage: transfer.fromStage,
          sourceDepartment,
          destinationName,
          destinationUserId: transfer.toUserId,
          destinationStage: transfer.toStage,
          destinationDepartment,
          sentAt: transfer.sentAt,
          receivedAt: transfer.receivedAt,
          handoverDuration: timing(
            transfer.sentAt,
            transfer.receivedAt,
            settings,
          ),
          reason: transfer.reason,
          // Keep the immutable destination linkage available to audit readers without making it another fact row.
          ...(destinationLot
            ? { parentCustodyId: sourceLot?.parentCustodyId }
            : {}),
        }),
      );
    }
    for (const disposal of batch.disposals) {
      const lot = lotById.get(disposal.custodyId);
      const common = {
        ...base,
        custodyId: disposal.custodyId,
        parentCustodyId: lot?.parentCustodyId,
        actorName: lot?.ownerName || "غير محدد",
        department: stageDepartment(lot?.stage),
        stage: lot?.stage,
        pairs: disposal.pairs,
        quality: "damaged" as const,
        status: disposal.status,
        reason: disposal.reason,
      };
      rows.push(
        makeEvent({
          id: `disposal:${disposal.id}:received`,
          source: "disposal",
          ...common,
          action: "receive",
          at: lot?.receivedAt,
          actorId: lot?.ownerId,
          incomplete: !lot?.receivedAt,
        }),
      );
      if (disposal.approvedAt)
        rows.push(
          makeEvent({
            id: `disposal:${disposal.id}:approved`,
            source: "disposal",
            ...common,
            action: "approve_disposal",
            at: disposal.approvedAt,
            actorId: disposal.approvedBy,
            actorName: maps.nameFor(disposal.approvedBy, "غير محدد"),
          }),
        );
      if (disposal.executedAt)
        rows.push(
          makeEvent({
            id: `disposal:${disposal.id}:executed`,
            source: "disposal",
            ...common,
            action: "execute_disposal",
            at: disposal.executedAt,
            actorId: disposal.executedBy,
            actorName: maps.nameFor(disposal.executedBy, "غير محدد"),
          }),
        );
    }
    const represented = new Set([
      "transfer_sent",
      "transfer_received",
      "work_started",
      "work_resumed",
      "work_paused",
      "work_completed",
      "progress_recorded",
      "disposal_received",
      "disposal_approved",
      "disposal_executed",
      "batch_created",
    ]);
    for (const event of batch.events) {
      if (represented.has(event.action)) continue; // Full before/after audit remains in batch.events; operational rows render once.
      const lot = event.custodyId ? lotById.get(event.custodyId) : undefined;
      // Audit records are retained separately: corrections/rework and any server action remain visible rather than silently discarded.
      rows.push(
        makeEvent({
          id: `audit:${event.id}`,
          source: "audit",
          ...base,
          custodyId: event.custodyId,
          parentCustodyId: lot?.parentCustodyId,
          actorId: event.actorId,
          actorName: event.actorName || maps.nameFor(event.actorId),
          department: maps.departmentFor(
            event.actorId,
            stageDepartment(event.stage || lot?.stage),
          ),
          stage: event.stage || lot?.stage,
          action: event.action,
          at: event.at,
          pairs: event.pairs ?? lot?.pairs,
          quality: lot?.quality,
          status: lot?.status,
          reason: event.reason,
        }),
      );
    }
  }
  return rows.sort(
    (left, right) =>
      (validDate(left.at)?.getTime() || Number.MAX_SAFE_INTEGER) -
        (validDate(right.at)?.getTime() || Number.MAX_SAFE_INTEGER) ||
      left.id.localeCompare(right.id),
  );
}

function batchMatches(
  batch: CustodyBatch,
  filters: CustodyReportFilters,
): boolean {
  const productNeedle = filters.product?.trim().toLocaleLowerCase("ar") || "";
  const batchNeedle = filters.batch?.trim().toLocaleLowerCase("ar") || "";
  const productText =
    `${batch.product.code} ${batch.product.name} ${batch.product.size} ${batch.product.color}`.toLocaleLowerCase(
      "ar",
    );
  const batchText = `${batch.id} ${batch.trackingNumber}`.toLocaleLowerCase(
    "ar",
  );
  return (
    (!productNeedle || productText.includes(productNeedle)) &&
    (!batchNeedle || batchText.includes(batchNeedle))
  );
}

function eventMatchesFilters(
  event: CustodyReportEvent,
  filters: CustodyReportFilters,
): boolean {
  const departments = [
    event.department,
    event.sourceDepartment,
    event.destinationDepartment,
    event.counterpartyDepartment,
  ].filter(Boolean);
  const people = [
    event.actorId,
    event.sourceUserId,
    event.destinationUserId,
    event.counterpartyId,
  ].filter((id): id is number => typeof id === "number");
  return (
    (!filters.department || departments.includes(filters.department)) &&
    (!filters.accountId || people.includes(filters.accountId)) &&
    (!filters.quality || event.quality === filters.quality) &&
    (!filters.status || event.status === filters.status)
  );
}

function eventMatches(
  event: CustodyReportEvent,
  filters: CustodyReportFilters,
): boolean {
  return (
    eventMatchesFilters(event, filters) &&
    isInReportRange(event.at, riyadhRange(filters.startDate, filters.endDate))
  );
}

/** A pending transfer sent before the period can still be a real ending responsibility, so retain one row for it. */
function transferAffectsReportPeriod(
  event: CustodyReportEvent,
  range: ReportRange,
): boolean {
  if (
    isInReportRange(event.sentAt, range) ||
    isInReportRange(event.receivedAt, range)
  )
    return true;
  return (
    !!event.sentAt &&
    inThroughEnd(event.sentAt, range) &&
    !inThroughEnd(event.receivedAt, range)
  );
}

function addToMap(
  map: Map<string, EmployeeReport>,
  account: CustodyAccount | undefined,
  fallbackId: number,
  fallbackName: string,
  department: string,
): EmployeeReport {
  const id = account?.id ?? fallbackId;
  const key = `${id}:${department}`;
  const existing = map.get(key);
  if (existing) return existing;
  const next: EmployeeReport = {
    employeeId: id,
    employeeName: account?.name || fallbackName || "غير محدد",
    department: department || account?.department || "غير محدد",
    events: [],
    totals: {
      receivedPairs: 0,
      completedPairs: 0,
      goodCompletedPairs: 0,
      damagedCompletedPairs: 0,
      suspectedCompletedPairs: 0,
      reworkCompletedPairs: 0,
      sampleCompletedPairs: 0,
      goodWorkMs: 0,
      workMinutesPerGoodPair: null,
      confirmedOutboundPairs: 0,
      pendingOutboundPairs: 0,
      openCustodyPairs: 0,
      manualWorkMs: 0,
      pauseMs: 0,
      productivityPairsPerHour: null,
      timeIncomplete: false,
    },
    balance: {
      openingPairs: 0,
      confirmedInboundPairs: 0,
      confirmedOutboundPairs: 0,
      pendingOutboundPairs: 0,
      endingLiabilityPairs: 0,
    },
  };
  map.set(key, next);
  return next;
}

function inBefore(at: string | undefined, range: ReportRange): boolean {
  const parsed = validDate(at);
  return !!parsed && parsed < range.start;
}
function inThroughEnd(at: string | undefined, range: ReportRange): boolean {
  const parsed = validDate(at);
  return !!parsed && parsed < range.end;
}

type ExactInterval = { start: number; end: number };

/** Union, rather than sum, recorded intervals so concurrent custodies cannot inflate manual time. */
function mergedIntervalMilliseconds(intervals: ExactInterval[]): number {
  if (!intervals.length) return 0;
  const ordered = [...intervals]
    .filter((interval) => interval.end >= interval.start)
    .sort((left, right) => left.start - right.start || left.end - right.end);
  let total = 0;
  let current = ordered[0];
  for (const interval of ordered.slice(1)) {
    if (interval.start <= current.end)
      current = {
        start: current.start,
        end: Math.max(current.end, interval.end),
      };
    else {
      total += current.end - current.start;
      current = interval;
    }
  }
  return total + current.end - current.start;
}

function reworkedLot(index: IndexedBatch, lot: CustodyLot): boolean {
  const seen = new Set<string>();
  let current: CustodyLot | undefined = lot;
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    if (current.sourceStage === "followup") return true;
    current = current.parentCustodyId
      ? index.custodyById.get(current.parentCustodyId)
      : undefined;
  }
  return false;
}
/** Employee liability uses roots + confirmed transfers only; destination child custodies never add a second inbound balance. */
function calculateEmployees(
  indexed: IndexedBatch[],
  events: CustodyReportEvent[],
  accounts: CustodyAccount[],
  range: ReportRange,
  filters: CustodyReportFilters,
): EmployeeReport[] {
  const maps = accountMaps(accounts);
  const employees = new Map<string, EmployeeReport>();
  const exactIntervals = new Map<
    string,
    { work: ExactInterval[]; pause: ExactInterval[]; good: ExactInterval[] }
  >();
  const relevantBatchIds = new Set(
    indexed
      .filter(({ batch }) => batchMatches(batch, filters))
      .map(({ batch }) => batch.id),
  );
  const obtain = (id: number, name: string, department: string) =>
    addToMap(employees, maps.byId.get(id), id, name, department);
  const move = (
    employee: EmployeeReport,
    when: string | undefined,
    direction: 1 | -1,
    pairs: number,
  ) => {
    if (inBefore(when, range))
      employee.balance.openingPairs += direction * pairs;
    if (isInReportRange(when, range)) {
      if (direction > 0) employee.balance.confirmedInboundPairs += pairs;
      else employee.balance.confirmedOutboundPairs += pairs;
    }
    if (inThroughEnd(when, range))
      employee.balance.endingLiabilityPairs += direction * pairs;
  };

  for (const index of indexed) {
    if (!relevantBatchIds.has(index.batch.id)) continue;
    for (const lot of index.batch.custodies) {
      if (!isRootCustody(index, lot)) continue;
      const employee = obtain(
        lot.ownerId,
        lot.ownerName,
        stageDepartment(lot.stage),
      );
      move(employee, lot.receivedAt, 1, lot.pairs);
    }
    for (const transfer of index.batch.transfers) {
      if (transfer.status !== "confirmed" || !transfer.receivedAt) continue;
      const source = obtain(
        transfer.fromUserId,
        transfer.fromName,
        stageDepartment(transfer.fromStage),
      );
      const destination = obtain(
        transfer.toUserId,
        transfer.toName,
        stageDepartment(transfer.toStage),
      );
      move(source, transfer.receivedAt, -1, transfer.pairs);
      move(
        destination,
        transfer.receivedAt,
        1,
        transfer.actualPairs ?? transfer.pairs,
      );
    }
    for (const transfer of index.batch.transfers) {
      if (
        !inThroughEnd(transfer.sentAt, range) ||
        inThroughEnd(transfer.receivedAt, range)
      )
        continue;
      const source = obtain(
        transfer.fromUserId,
        transfer.fromName,
        stageDepartment(transfer.fromStage),
      );
      source.balance.pendingOutboundPairs += transfer.pairs;
    }
    for (const event of index.batch.events) {
      if (
        !["stock_stored", "disposal_executed", "sample_delivered"].includes(
          event.action,
        ) ||
        !event.custodyId
      )
        continue;
      const lot = index.custodyById.get(event.custodyId);
      if (!lot) continue;
      move(
        obtain(lot.ownerId, lot.ownerName, stageDepartment(lot.stage)),
        event.at,
        -1,
        event.pairs ?? lot.pairs,
      );
    }
  }

  for (const event of events) {
    if (
      !relevantBatchIds.has(event.batchId) ||
      !eventMatches(event, filters) ||
      !event.actorId
    )
      continue;
    const employee = obtain(event.actorId, event.actorName, event.department);
    employee.events.push(event);
  }

  for (const index of indexed) {
    if (!relevantBatchIds.has(index.batch.id)) continue;
    for (const transfer of index.batch.transfers) {
      if (
        transfer.status === "confirmed" &&
        isInReportRange(transfer.receivedAt, range)
      ) {
        obtain(
          transfer.toUserId,
          transfer.toName,
          stageDepartment(transfer.toStage),
        ).totals.receivedPairs += transfer.actualPairs ?? transfer.pairs;
        obtain(
          transfer.fromUserId,
          transfer.fromName,
          stageDepartment(transfer.fromStage),
        ).totals.confirmedOutboundPairs += transfer.pairs;
      }
      if (
        inThroughEnd(transfer.sentAt, range) &&
        !inThroughEnd(transfer.receivedAt, range)
      )
        obtain(
          transfer.fromUserId,
          transfer.fromName,
          stageDepartment(transfer.fromStage),
        ).totals.pendingOutboundPairs += transfer.pairs;
    }
    for (const lot of index.batch.custodies) {
      if (isRootCustody(index, lot) && isInReportRange(lot.receivedAt, range))
        obtain(
          lot.ownerId,
          lot.ownerName,
          stageDepartment(lot.stage),
        ).totals.receivedPairs += lot.pairs;
      const progress = index.batch.progress
        .filter((p) => p.custodyId === lot.id)
        .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
      if (progress.length) {
        let previous = 0;
        for (const reading of progress) {
          const delta = reading.pairs - previous;
          previous = reading.pairs;
          if (isInReportRange(reading.recordedAt, range)) {
            const totals = obtain(
              lot.ownerId,
              lot.ownerName,
              stageDepartment(lot.stage),
            ).totals;
            totals.completedPairs += delta;
            if (index.batch.purpose === "sample")
              totals.sampleCompletedPairs += delta;
            else if (reworkedLot(index, lot))
              totals.reworkCompletedPairs += delta;
            else if (lot.quality === "damaged")
              totals.damagedCompletedPairs += delta;
            else if (lot.quality === "suspected")
              totals.suspectedCompletedPairs += delta;
            else totals.goodCompletedPairs += delta;
          }
        }
      }
      // A completion date without progress is not silently invented as hourly/day production.
    }
    for (const session of index.batch.sessions) {
      const lot = index.custodyById.get(session.custodyId);
      const employee = obtain(
        session.userId,
        lot?.ownerName || maps.nameFor(session.userId),
        stageDepartment(lot?.stage),
      );
      const started = validDate(session.startedAt);
      const ended = validDate(session.endedAt);
      if (lot?.legacyTiming || !started || !ended || ended < started) {
        if (
          !started ||
          (started < range.end && (!ended || ended > range.start))
        )
          employee.totals.timeIncomplete = true;
        continue;
      }
      const start = Math.max(started.getTime(), range.start.getTime());
      const end = Math.min(ended.getTime(), range.end.getTime());
      if (end <= start) continue;
      const employeeKey = `${employee.employeeId}:${employee.department}`;
      const employeeIntervals = exactIntervals.get(employeeKey) || {
        work: [],
        pause: [],
        good: [],
      };
      employeeIntervals[session.kind].push({ start, end });
      if (
        session.kind === "work" &&
        index.batch.purpose === "sale" &&
        lot &&
        ["first", "second"].includes(lot.quality) &&
        !reworkedLot(index, lot)
      )
        employeeIntervals.good.push({ start, end });
      exactIntervals.set(employeeKey, employeeIntervals);
    }
  }

  for (const employee of employees.values()) {
    employee.totals.openCustodyPairs = employee.balance.endingLiabilityPairs;
    const intervals = exactIntervals.get(
      `${employee.employeeId}:${employee.department}`,
    );
    employee.totals.manualWorkMs = mergedIntervalMilliseconds(
      intervals?.work || [],
    );
    employee.totals.pauseMs = mergedIntervalMilliseconds(
      intervals?.pause || [],
    );
    employee.totals.goodWorkMs = mergedIntervalMilliseconds(
      intervals?.good || [],
    );
    if (employee.totals.timeIncomplete || !employee.totals.goodWorkMs)
      employee.totals.productivityPairsPerHour = null;
    else
      employee.totals.productivityPairsPerHour =
        employee.totals.goodCompletedPairs /
        (employee.totals.goodWorkMs / 3_600_000);
    employee.totals.workMinutesPerGoodPair =
      !employee.totals.timeIncomplete &&
      employee.totals.goodCompletedPairs > 0 &&
      employee.totals.goodWorkMs > 0
        ? employee.totals.goodWorkMs /
          60000 /
          employee.totals.goodCompletedPairs
        : null;
    employee.events.sort(
      (left, right) =>
        (validDate(left.at)?.getTime() || 0) -
        (validDate(right.at)?.getTime() || 0),
    );
  }
  return [...employees.values()]
    .filter(
      (employee) =>
        (!filters.department || employee.department === filters.department) &&
        (!filters.accountId || employee.employeeId === filters.accountId),
    )
    .sort(
      (a, b) =>
        a.department.localeCompare(b.department, "ar") ||
        a.employeeName.localeCompare(b.employeeName, "ar"),
    );
}

function buildTimeline(batch: CustodyBatch): BatchTimeline {
  const byId = new Map<string, BatchTimelineNode>();
  const root: BatchTimelineNode[] = [];
  const issues: string[] = [];
  for (const lot of batch.custodies) {
    const node: BatchTimelineNode = {
      id: lot.id,
      parentId: lot.parentCustodyId,
      kind: "custody",
      stage: lot.stage,
      stageLabel: stageDepartment(lot.stage),
      quality: lot.quality,
      qualityLabel: CUSTODY_QUALITY_LABELS[lot.quality],
      pairs: lot.pairs,
      status: lot.status,
      statusLabel: CUSTODY_STATUS_LABELS[lot.status],
      at: lot.receivedAt,
      owner: lot.ownerName,
      children: [],
    };
    byId.set(node.id, node);
  }
  for (const node of byId.values()) {
    if (node.parentId && byId.has(node.parentId))
      byId.get(node.parentId)!.children.push(node);
    else root.push(node);
  }
  for (const transfer of batch.transfers) {
    const parent = byId.get(transfer.sourceCustodyId);
    const node: BatchTimelineNode = {
      id: `transfer:${transfer.id}`,
      parentId: transfer.sourceCustodyId,
      kind: "transfer",
      stage: transfer.toStage,
      stageLabel: `${stageDepartment(transfer.fromStage)} ← ${stageDepartment(transfer.toStage)}`,
      quality: transfer.quality,
      qualityLabel: CUSTODY_QUALITY_LABELS[transfer.quality],
      pairs: transfer.actualPairs ?? transfer.pairs,
      status: transfer.status,
      statusLabel:
        transfer.status === "confirmed"
          ? "مؤكد"
          : transfer.status === "pending"
            ? "بانتظار التأكيد"
            : transfer.status,
      at: transfer.receivedAt || transfer.sentAt,
      owner: `${transfer.fromName} ← ${transfer.toName}`,
      detail: transfer.reason,
      children: [],
    };
    if (parent) parent.children.push(node);
    else {
      root.push(node);
      issues.push(`تحويل ${transfer.id} لا يرتبط بعهدة مصدر موجودة.`);
    }
  }
  for (const disposal of batch.disposals) {
    const parent = byId.get(disposal.custodyId);
    const node: BatchTimelineNode = {
      id: `disposal:${disposal.id}`,
      parentId: disposal.custodyId,
      kind: "disposal",
      stage: parent?.stage,
      stageLabel: "محضر إتلاف",
      quality: "damaged",
      qualityLabel: CUSTODY_QUALITY_LABELS.damaged,
      pairs: disposal.pairs,
      status: disposal.status,
      statusLabel:
        disposal.status === "executed"
          ? "إتلاف منفذ"
          : disposal.status === "approved"
            ? "محضر معتمد"
            : "مستلم لدى المتابعة",
      at: disposal.executedAt || disposal.approvedAt,
      detail: disposal.reason,
      children: [],
    };
    if (parent) parent.children.push(node);
    else {
      root.push(node);
      issues.push(`محضر الإتلاف ${disposal.id} لا يرتبط بعهدة موجودة.`);
    }
  }
  const sortNode = (node: BatchTimelineNode) => {
    node.children.sort(
      (a, b) =>
        (validDate(a.at)?.getTime() || 0) - (validDate(b.at)?.getTime() || 0),
    );
    node.children.forEach(sortNode);
  };
  root
    .sort(
      (a, b) =>
        (validDate(a.at)?.getTime() || 0) - (validDate(b.at)?.getTime() || 0),
    )
    .forEach(sortNode);
  return {
    batchId: batch.id,
    trackingNumber: batch.trackingNumber,
    product: batch.product.name || batch.product.code,
    originalProductionPairs: batch.totalPairs,
    firstPairs: batch.firstPairs,
    secondPairs: batch.secondPairs,
    executedDestroyedPairs: batch.disposals
      .filter((item) => item.status === "executed")
      .reduce((sum, item) => sum + item.pairs, 0),
    nodes: root,
    issues,
  };
}

function buildStageTotals(
  batches: CustodyBatch[],
  range: ReportRange,
  filters: CustodyReportFilters,
): CustodyStageTotal[] {
  const totals = new Map<CustodyStage, CustodyStageTotal>(
    CUSTODY_STAGES.map((stage) => [
      stage,
      {
        stage,
        stageLabel: stageDepartment(stage),
        openingPairs: 0,
        confirmedInboundPairs: 0,
        confirmedOutboundPairs: 0,
        pendingOutboundPairs: 0,
        releasedPairs: 0,
        remainingPairs: 0,
        invalidQuantityCount: 0,
      },
    ]),
  );
  const matchesStage = (stage: CustodyStage, userId?: number) =>
    (!filters.department || stageDepartment(stage) === filters.department) &&
    (!filters.accountId || userId === filters.accountId);
  const add = (
    stage: CustodyStage,
    field: keyof Pick<
      CustodyStageTotal,
      | "openingPairs"
      | "confirmedInboundPairs"
      | "confirmedOutboundPairs"
      | "pendingOutboundPairs"
      | "releasedPairs"
      | "remainingPairs"
    >,
    pairs: unknown,
    userId?: number,
  ) => {
    if (!matchesStage(stage, userId)) return;
    const target = totals.get(stage)!;
    const quantity = finiteNumber(pairs);
    if (quantity === null) {
      target.invalidQuantityCount += 1;
      target[field] = Number.NaN;
      return;
    }
    target[field] += quantity;
  };
  const applyConfirmed = (
    stage: CustodyStage,
    direction: 1 | -1,
    at: string | undefined,
    pairs: unknown,
    userId: number | undefined,
    periodField:
      | "confirmedInboundPairs"
      | "confirmedOutboundPairs"
      | "releasedPairs",
  ) => {
    if (inBefore(at, range))
      add(stage, "openingPairs", direction * Number(pairs), userId);
    if (isInReportRange(at, range))
      add(stage, periodField, Math.abs(Number(pairs)), userId);
    if (inThroughEnd(at, range))
      add(stage, "remainingPairs", direction * Number(pairs), userId);
  };

  for (const index of indexedBatches(batches)) {
    const { batch } = index;
    for (const lot of batch.custodies) {
      if (!filters.quality || lot.quality === filters.quality) {
        if (isRootCustody(index, lot))
          applyConfirmed(
            lot.stage,
            1,
            lot.receivedAt,
            lot.pairs,
            lot.ownerId,
            "confirmedInboundPairs",
          );
      }
    }
    for (const transfer of batch.transfers) {
      if (filters.quality && transfer.quality !== filters.quality) continue;
      if (transfer.status === "confirmed" && transfer.receivedAt) {
        // Receipt confirmation is the sole movement instant for both stages. The source uses the
        // immutable sent quantity; the target uses the recorded actual count, exposing any legacy mismatch.
        applyConfirmed(
          transfer.fromStage,
          -1,
          transfer.receivedAt,
          transfer.pairs,
          transfer.fromUserId,
          "confirmedOutboundPairs",
        );
        applyConfirmed(
          transfer.toStage,
          1,
          transfer.receivedAt,
          transfer.actualPairs ?? transfer.pairs,
          transfer.toUserId,
          "confirmedInboundPairs",
        );
      }
      if (
        inThroughEnd(transfer.sentAt, range) &&
        !inThroughEnd(transfer.receivedAt, range)
      ) {
        add(
          transfer.fromStage,
          "pendingOutboundPairs",
          transfer.pairs,
          transfer.fromUserId,
        );
      }
    }
    for (const event of batch.events) {
      if (
        !event.custodyId ||
        !["stock_stored", "disposal_executed", "sample_delivered"].includes(
          event.action,
        )
      )
        continue;
      const lot = index.custodyById.get(event.custodyId);
      const stage = event.stage || lot?.stage;
      const quality = lot?.quality;
      if (!stage || (filters.quality && quality !== filters.quality)) continue;
      // Stock becomes available only through this already-approved immutable event. Receiving a
      // storage custody never increments warehouse stock and does not disappear from responsibility.
      applyConfirmed(
        stage,
        -1,
        event.at,
        event.pairs ?? lot?.pairs,
        lot?.ownerId ?? event.actorId,
        "releasedPairs",
      );
    }
  }
  return CUSTODY_STAGES.map((stage) => totals.get(stage)!).filter(
    (item) => !filters.department || item.stageLabel === filters.department,
  );
}

export function buildCustodyReport(input: {
  batches: CustodyBatch[];
  accounts: CustodyAccount[];
  settings?: CustodySettings;
  filters: CustodyReportFilters;
}): CustodyReport {
  input = {
    ...input,
    filters: {
      ...input.filters,
      department: input.filters.department
        ? arabicDepartment(input.filters.department)
        : undefined,
    },
  };
  const range = riyadhRange(input.filters.startDate, input.filters.endDate);
  const eligibleBatches = input.batches.filter((batch) =>
    batchMatches(batch, input.filters),
  );
  const allEvents = buildReportEvents(
    eligibleBatches,
    input.accounts,
    input.settings,
  );
  const events = allEvents.filter((event) =>
    eventMatches(event, input.filters),
  );
  const transfers = allEvents.filter(
    (event) =>
      event.source === "transfer" &&
      eventMatchesFilters(event, input.filters) &&
      transferAffectsReportPeriod(event, range),
  );
  const stageTotals = buildStageTotals(eligibleBatches, range, input.filters);
  const employees = calculateEmployees(
    indexedBatches(eligibleBatches),
    allEvents,
    input.accounts,
    range,
    input.filters,
  );
  const byDepartment = new Map<string, EmployeeReport[]>();
  for (const employee of employees)
    byDepartment.set(employee.department, [
      ...(byDepartment.get(employee.department) || []),
      employee,
    ]);
  // Production is a batch fact. It is deliberately dated by production, not by the
  // creation/audit timestamp, and is never re-added for any downstream stage.
  const legacyBatches = eligibleBatches.filter(
    (batch) => (batch as LegacyAwareBatch).openingBalance === true,
  );
  const periodBatches = eligibleBatches.filter(
    (batch) =>
      batch.purpose === "sale" &&
      (batch as LegacyAwareBatch).openingBalance !== true &&
      // تاريخ الإنتاج الفعلي فقط. تاريخ إنشاء الدفعة تدقيقي ولا يحوّل إنتاج يوم آخر
      // إلى الفترة التي أُدخلت فيها البيانات.
      isInReportRange(batch.productionDate, range),
  );
  const quality = {
    firstPairs: 0,
    secondPairs: 0,
    suspectedPairs: 0,
    damagedPairs: 0,
  };
  // Snapshot at range end: only confirmed transfers move grade liability; pending branches do not double-count.
  for (const batch of eligibleBatches) {
    if (batch.purpose !== "sale") continue;
    for (const lot of batch.custodies) {
      if (!inThroughEnd(lot.receivedAt, range)) continue;
      const out = batch.transfers
        .filter(
          (t) =>
            t.sourceCustodyId === lot.id &&
            t.status === "confirmed" &&
            inThroughEnd(t.receivedAt, range),
        )
        .reduce((n, t) => n + t.pairs, 0);
      const balance = lot.pairs - out;
      if (!input.filters.quality || input.filters.quality === lot.quality)
        quality[`${lot.quality}Pairs` as keyof typeof quality] += balance;
    }
  }
  const disposal = { receivedPairs: 0, approvedPairs: 0, executedPairs: 0 };
  for (const batch of eligibleBatches)
    for (const item of batch.disposals) {
      const lot = batch.custodies.find((l) => l.id === item.custodyId);
      if (isInReportRange(lot?.receivedAt, range))
        disposal.receivedPairs += item.pairs;
      if (isInReportRange(item.approvedAt, range))
        disposal.approvedPairs += item.pairs;
      if (isInReportRange(item.executedAt, range))
        disposal.executedPairs += item.pairs;
    }
  const warehouseFinalStockPairs = eligibleBatches.reduce(
    (sum, batch) =>
      sum +
      batch.events
        .filter(
          (e) => e.action === "stock_stored" && isInReportRange(e.at, range),
        )
        .reduce((n, e) => n + (e.pairs ?? 0), 0),
    0,
  );
  const samplesWithDeliveryProof = eligibleBatches.filter(
    (batch) =>
      batch.purpose === "sample" &&
      !!batch.sampleDelivery?.proof?.trim() &&
      isInReportRange(batch.sampleDelivery.at, range),
  ).length;
  const settingCheck = validSettings(input.settings);
  const warnings = [
    ...settingCheck.issues,
    ...events
      .filter((event) => event.incomplete)
      .map(
        (event) =>
          `بيانات وقت غير مكتملة: ${event.trackingNumber} — ${event.actionLabel}.`,
      ),
  ];
  const legacy = {
    openingBatchCount: legacyBatches.length,
    openingPairs: legacyBatches.reduce(
      (sum, batch) => sum + batch.totalPairs,
      0,
    ),
    linkedLegacySourceCount: legacyBatches.filter(
      (batch) => !!(batch as LegacyAwareBatch).legacySource?.id,
    ).length,
  };
  return {
    range,
    events,
    transfers,
    stageTotals,
    departments: [...byDepartment.entries()].map(([department, employees]) => ({
      department,
      employees,
    })),
    timelines: eligibleBatches
      .filter(
        (batch) =>
          !input.filters.batch ||
          `${batch.id} ${batch.trackingNumber}`
            .toLocaleLowerCase("ar")
            .includes(input.filters.batch!.toLocaleLowerCase("ar")),
      )
      .map(buildTimeline),
    originalProductionPairs: periodBatches.reduce(
      (sum, batch) => sum + batch.totalPairs,
      0,
    ),
    quality,
    disposal,
    warehouseFinalStockPairs,
    samplesWithDeliveryProof,
    legacy,
    warnings,
    businessTime: settingCheck,
  };
}

/** Use this in daily-summary or dashboards after calling buildCustodyReport with the same visibility/filter scope. */
export function custodyReportSummary(
  report: CustodyReport,
): CustodyReportSummary {
  const employees = report.departments.flatMap(
    (department) => department.employees,
  );
  return {
    originalProductionPairs: report.originalProductionPairs,
    receivedPairs: employees.reduce(
      (sum, employee) => sum + employee.totals.receivedPairs,
      0,
    ),
    completedPairs: employees.reduce(
      (sum, employee) => sum + employee.totals.completedPairs,
      0,
    ),
    confirmedOutboundPairs: employees.reduce(
      (sum, employee) => sum + employee.totals.confirmedOutboundPairs,
      0,
    ),
    pendingOutboundPairs: employees.reduce(
      (sum, employee) => sum + employee.totals.pendingOutboundPairs,
      0,
    ),
    openCustodyPairs: employees.reduce(
      (sum, employee) => sum + employee.totals.openCustodyPairs,
      0,
    ),
    warehouseFinalStockPairs: report.warehouseFinalStockPairs,
    executedDestroyedPairs: report.disposal.executedPairs,
    legacyOpeningPairs: report.legacy.openingPairs,
    legacyOpeningBatchCount: report.legacy.openingBatchCount,
    employeesWithIncompleteTiming: employees.filter(
      (employee) => employee.totals.timeIncomplete,
    ).length,
    stageTotals: report.stageTotals,
  };
}

export type ExportRow = Record<string, string | number | null>;

/** Values are prefix-escaped for spreadsheet formula safety. */
export function spreadsheetSafe(value: unknown): string | number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value;
  const text = String(value);
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

export function reportExportRows(report: CustodyReport): ExportRow[] {
  return report.events.map((event) => ({
    "القسم / المرحلة": spreadsheetSafe(event.department) as string,
    "الموظف / المسؤول": spreadsheetSafe(event.actorName) as string,
    "قسم المرسل": spreadsheetSafe(
      event.sourceDepartment || event.department,
    ) as string,
    "اسم المرسل": spreadsheetSafe(
      event.sourceName || event.actorName,
    ) as string,
    "قسم المستلم": spreadsheetSafe(
      event.destinationDepartment || event.counterpartyDepartment || "",
    ) as string,
    "اسم المستلم": spreadsheetSafe(
      event.destinationName || event.counterparty || "",
    ) as string,
    "رقم الدفعة": spreadsheetSafe(event.trackingNumber) as string,
    الوردية: spreadsheetSafe(event.shift || "غير مسجلة") as string,
    الماكينة: spreadsheetSafe(event.machineNumber || "غير مسجلة") as string,
    الصنف: spreadsheetSafe(event.product) as string,
    المقاس: spreadsheetSafe(event.productSize) as string,
    اللون: spreadsheetSafe(event.productColor) as string,
    النخب: spreadsheetSafe(
      event.quality ? CUSTODY_QUALITY_LABELS[event.quality] : "",
    ) as string,
    "نوع الحركة": spreadsheetSafe(event.actionLabel) as string,
    "الكمية المرسلة (زوج)": event.expectedPairs ?? event.pairs ?? null,
    "الكمية الفعلية (زوج)": event.actualPairs ?? null,
    "الفرق الفعلي - المرسل (زوج)": event.quantityDifferencePairs ?? null,
    "وقت الإرسال (الرياض)": spreadsheetSafe(
      event.sentAt ? formatRiyadh(event.sentAt) : "",
    ) as string,
    "وقت الاستلام (الرياض)": spreadsheetSafe(
      event.receivedAt ? formatRiyadh(event.receivedAt) : "",
    ) as string,
    "مدة التحويل": spreadsheetSafe(
      event.handoverDuration
        ? formatDuration(event.handoverDuration.calendarMs)
        : "",
    ) as string,
    "وقت الحركة (الرياض)": spreadsheetSafe(formatRiyadh(event.at)) as string,
    الحالة: spreadsheetSafe(event.status || "") as string,
    ملاحظة: spreadsheetSafe(
      event.reason || (event.incomplete ? "بيانات وقت غير مكتملة" : ""),
    ) as string,
    "مصدر افتتاحي قديم": event.legacySourceId ?? null,
  }));
}

/** The canonical one-row-per-transfer export used by both print/PDF and XLSX. */
export function reportTransferRows(report: CustodyReport): ExportRow[] {
  return report.transfers.map((event) => ({
    "رقم التحويل": spreadsheetSafe(
      event.id.replace(/^transfer:/, ""),
    ) as string,
    "رقم الدفعة": spreadsheetSafe(event.trackingNumber) as string,
    "قسم المرسل": spreadsheetSafe(
      event.sourceDepartment || event.department,
    ) as string,
    "اسم المرسل": spreadsheetSafe(
      event.sourceName || event.actorName,
    ) as string,
    "قسم المستلم": spreadsheetSafe(
      event.destinationDepartment || event.counterpartyDepartment || "",
    ) as string,
    "اسم المستلم": spreadsheetSafe(
      event.destinationName || event.counterparty || "",
    ) as string,
    الصنف: spreadsheetSafe(event.product) as string,
    المقاس: spreadsheetSafe(event.productSize) as string,
    اللون: spreadsheetSafe(event.productColor) as string,
    النخب: spreadsheetSafe(
      event.quality ? CUSTODY_QUALITY_LABELS[event.quality] : "",
    ) as string,
    الوردية: spreadsheetSafe(event.shift || "غير مسجلة") as string,
    الماكينة: spreadsheetSafe(event.machineNumber || "غير مسجلة") as string,
    "المرسل (زوج)": event.expectedPairs ?? event.pairs ?? null,
    "الفعلي (زوج)": event.actualPairs ?? null,
    "الفرق الفعلي - المرسل (زوج)": event.quantityDifferencePairs ?? null,
    "وقت الإرسال (الرياض)": spreadsheetSafe(
      formatRiyadh(event.sentAt),
    ) as string,
    "وقت الاستلام (الرياض)": spreadsheetSafe(
      event.receivedAt ? formatRiyadh(event.receivedAt) : "بانتظار الاستلام",
    ) as string,
    المدة: spreadsheetSafe(
      formatDuration(event.handoverDuration?.calendarMs ?? null),
    ) as string,
    الحالة: spreadsheetSafe(event.status || "") as string,
    "سبب/ملاحظة": spreadsheetSafe(event.reason || "") as string,
  }));
}

export function reportStageTotalRows(report: CustodyReport): ExportRow[] {
  return report.stageTotals.map((total) => ({
    المرحلة: total.stageLabel,
    "رصيد البداية (زوج)": total.openingPairs,
    "وارد مؤكد (زوج)": total.confirmedInboundPairs,
    "صادر مؤكد (زوج)": total.confirmedOutboundPairs,
    "مرسل معلق (زوج)": total.pendingOutboundPairs,
    "إغلاق موثق (زوج)": total.releasedPairs,
    "المتبقي / المسؤولية (زوج)": total.remainingPairs,
    "كميات غير صالحة": total.invalidQuantityCount,
  }));
}

function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(
    /[&<>'"]/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[
        character
      ] || character,
  );
}

function transferStatusLabel(status?: string): string {
  if (status === "pending") return "بانتظار الاستلام";
  if (status === "confirmed") return "مؤكد بعد العد الفعلي";
  if (status === "disputed") return "اختلاف قيد المراجعة";
  if (status === "rejected") return "مرفوض";
  return CUSTODY_STATUS_LABELS[status as CustodyStatus] || status || "—";
}

/** Native browser/Expo print HTML. Stage totals and transfers derive from the same report facts as XLSX. */
export function reportPrintHtml(report: CustodyReport): string {
  const stageRows = report.stageTotals
    .map(
      (total) =>
        `<tr><td>${escapeHtml(total.stageLabel)}</td><td>${escapeHtml(formatPairs(total.openingPairs))}</td><td>${escapeHtml(formatPairs(total.confirmedInboundPairs))}</td><td>${escapeHtml(formatPairs(total.confirmedOutboundPairs))}</td><td>${escapeHtml(formatPairs(total.pendingOutboundPairs))}</td><td>${escapeHtml(formatPairs(total.releasedPairs))}</td><td>${escapeHtml(formatPairs(total.remainingPairs))}</td><td>${escapeHtml(total.invalidQuantityCount || "—")}</td></tr>`,
    )
    .join("");
  const transferRows = report.transfers
    .map(
      (event) =>
        `<tr><td>${escapeHtml(event.trackingNumber)}</td><td>${escapeHtml(`${event.sourceDepartment || event.department} — ${event.sourceName || event.actorName}`)}</td><td>${escapeHtml(`${event.destinationDepartment || event.counterpartyDepartment || "—"} — ${event.destinationName || event.counterparty || "—"}`)}</td><td>${escapeHtml(`${event.product} / ${event.productSize} / ${event.productColor}`)}</td><td>${escapeHtml(event.quality ? CUSTODY_QUALITY_LABELS[event.quality] : "—")}</td><td>${escapeHtml(formatPairs(event.expectedPairs ?? event.pairs))}</td><td>${escapeHtml(event.actualPairs === undefined ? "—" : formatPairs(event.actualPairs))}</td><td>${escapeHtml(event.quantityDifferencePairs === undefined ? "—" : formatPairs(event.quantityDifferencePairs))}</td><td>${escapeHtml(formatRiyadh(event.sentAt))}<br>${escapeHtml(event.receivedAt ? formatRiyadh(event.receivedAt) : "بانتظار الاستلام")}<br>${escapeHtml(formatDuration(event.handoverDuration?.calendarMs ?? null))}</td><td>${escapeHtml(transferStatusLabel(event.status))}<br>${escapeHtml(event.reason || "")}</td></tr>`,
    )
    .join("");
  const eventRows = (events: CustodyReportEvent[]) =>
    events
      .filter((event) => event.source !== "transfer")
      .map(
        (event) =>
          `<tr><td>${escapeHtml(event.trackingNumber)}</td><td>${escapeHtml(`${event.product} / ${event.productSize} / ${event.productColor}`)}</td><td>${escapeHtml(event.actionLabel)}</td><td>${escapeHtml(event.pairs == null ? "—" : formatPairs(event.pairs))}</td><td>${escapeHtml(formatRiyadh(event.at))}</td><td>${escapeHtml(event.reason || "")}</td></tr>`,
      )
      .join("");
  const groups = report.departments
    .map(
      (department) =>
        `<section><h2>${escapeHtml(department.department)}</h2>${department.employees.map((employee) => `<h3>الموظف: ${escapeHtml(employee.employeeName)}</h3><p class="totals">مستلم ${escapeHtml(formatPairs(employee.totals.receivedPairs))} | منجز فعلي ${escapeHtml(formatPairs(employee.totals.completedPairs))} | صادر مؤكد ${escapeHtml(formatPairs(employee.totals.confirmedOutboundPairs))} | مرسل معلق ${escapeHtml(formatPairs(employee.totals.pendingOutboundPairs))}<br>رصيد البداية ${escapeHtml(formatPairs(employee.balance.openingPairs))} + وارد مؤكد ${escapeHtml(formatPairs(employee.balance.confirmedInboundPairs))} − صادر مؤكد ${escapeHtml(formatPairs(employee.balance.confirmedOutboundPairs))} = مسؤولية النهاية ${escapeHtml(formatPairs(employee.balance.endingLiabilityPairs))}</p><table><thead><tr><th>الدفعة</th><th>الصنف</th><th>الحدث الداعم</th><th>الكمية</th><th>وقت الرياض</th><th>ملاحظة</th></tr></thead><tbody>${eventRows(employee.events) || '<tr><td colspan="6">لا توجد أحداث داعمة داخل الفترة.</td></tr>'}</tbody></table>`).join("")}</section>`,
    )
    .join("");
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>تقرير الاستلام والتسليم والعهد</title><style>@page{size:A4 landscape;margin:8mm}body{font-family:Arial,sans-serif;color:#172033;margin:12px;direction:rtl}h1{margin:0;font-size:20px;color:#075985}h2{font-size:14px;margin:14px 0 4px;border-bottom:1px solid #94a3b8}h3{font-size:12px;margin:7px 0 3px}p{font-size:10px;margin:4px 0}table{border-collapse:collapse;width:100%;font-size:8px;margin:4px 0;table-layout:fixed}thead{display:table-header-group}th{background:#075985;color:white}th,td{border:1px solid #cbd5e1;padding:4px;text-align:right;vertical-align:top;overflow-wrap:anywhere}.totals{background:#f0f9ff;padding:6px}.note{color:#92400e;background:#fffbeb;padding:6px}@media print{body{margin:0}tr{break-inside:avoid}h2,h3{break-after:avoid}.toolbar{display:none}}</style></head><body><button class="toolbar" onclick="window.print()">طباعة / حفظ PDF</button><h1>تقرير الاستلام والتسليم والعهد</h1><p>الفترة ${escapeHtml(report.range.startDate)} إلى ${escapeHtml(report.range.endDate)} — اليوم كاملًا بتوقيت الرياض</p><p>إنتاج أصلي للفترة: ${escapeHtml(formatPairs(report.originalProductionPairs))} | وارد مخزني معتمد: ${escapeHtml(formatPairs(report.warehouseFinalStockPairs))} | إتلاف منفذ: ${escapeHtml(formatPairs(report.disposal.executedPairs))}</p><h2>إجماليات المراحل — عهدة وحركة وليست إنتاجاً جديداً</h2><table><thead><tr><th>المرحلة</th><th>رصيد البداية</th><th>وارد مؤكد</th><th>صادر مؤكد</th><th>مرسل معلق</th><th>إغلاق موثق</th><th>المتبقي</th><th>تنبيه كمية</th></tr></thead><tbody>${stageRows || '<tr><td colspan="8">لا توجد مراحل ضمن النطاق.</td></tr>'}</tbody></table><h2>جدول التحويلات الموحد — صف واحد لكل معرف تحويل</h2><table><thead><tr><th>الدفعة</th><th>المسلّم</th><th>المستلم</th><th>الصنف/المقاس/اللون</th><th>النخب</th><th>المرسل</th><th>الفعلي</th><th>الفرق</th><th>إرسال / استلام / مدة</th><th>الحالة والملاحظة</th></tr></thead><tbody>${transferRows || '<tr><td colspan="10">لا توجد تحويلات تؤثر في الفترة.</td></tr>'}</tbody></table>${report.warnings.length ? `<p class="note">${escapeHtml(report.warnings.join(" | "))}</p>` : ""}${groups || "<p>لا توجد حركات ضمن الفترة والفلاتر المختارة.</p>"}</body></html>`;
}

export function reportCsv(report: CustodyReport): string {
  const rows = reportExportRows(report);
  const headers = rows.length
    ? Object.keys(rows[0])
    : ["القسم", "الموظف", "رقم الدفعة"];
  const quote = (value: unknown) =>
    `"${String(value ?? "").replace(/"/g, '""')}"`;
  return `\uFEFF${headers.map(quote).join(",")}\r\n${rows.map((row) => headers.map((header) => quote(row[header])).join(",")).join("\r\n")}`;
}
