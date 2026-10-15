import { accountBelongsToStage } from "./custody-policy";
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
  source: "custody" | "transfer" | "session" | "progress" | "disposal" | "audit";
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
  counterparty?: string;
  counterpartyDepartment?: string;
  reason?: string;
  product: string;
  productCode: string;
  productSize: string;
  productColor: string;
  incomplete?: boolean;
  /** Historical timing remains intentionally non-measurable until explicitly replaced by a new custody record. */
  legacyTiming?: boolean;
  legacySourceId?: number;
  progress?: { cumulativePairs: number; deltaPairs: number; intervalStartAt?: string; intervalEndAt: string };
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
  departments: DepartmentReport[];
  timelines: BatchTimeline[];
  originalProductionPairs: number;
  quality: { firstPairs: number; secondPairs: number; suspectedPairs: number; damagedPairs: number };
  disposal: { receivedPairs: number; approvedPairs: number; executedPairs: number };
  warehouseFinalStockPairs: number;
  samplesWithDeliveryProof: number;
  legacy: { openingBatchCount: number; openingPairs: number; linkedLegacySourceCount: number };
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
};

type IndexedBatch = { batch: CustodyBatch; custodyById: Map<string, CustodyLot> };
type LegacyAwareBatch = CustodyBatch & {
  openingBalance?: boolean;
  legacySource?: { id: number; productionId?: number; quantityPairs: number };
};

const isoDay = /^\d{4}-\d{2}-\d{2}$/;
const timeOfDay = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

function numberOrZero(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
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
  if (!Number.isFinite(parsed.getTime())) throw new Error(`Invalid Riyadh date: ${day}`);
  parsed.setUTCDate(parsed.getUTCDate() + 1);
  return parsed.toISOString().slice(0, 10);
}

/** Half-open [start, end) in Riyadh. endDate is included completely. */
export function riyadhRange(startDate: string, endDate: string): ReportRange {
  if (!isoDay.test(startDate) || !isoDay.test(endDate)) throw new Error("التاريخ يجب أن يكون بصيغة YYYY-MM-DD");
  if (endDate < startDate) throw new Error("تاريخ النهاية يجب ألا يسبق تاريخ البداية");
  // Saudi Arabia is UTC+03 without DST; explicit offsets avoid the device timezone entirely.
  const start = new Date(`${startDate}T00:00:00.000+03:00`);
  const end = new Date(`${dayAfter(endDate)}T00:00:00.000+03:00`);
  return { start, end, startDate, endDate };
}

export function isInReportRange(at: string | undefined, range: ReportRange): boolean {
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

export function formatPairs(pairs: number): string {
  const whole = numberOrZero(pairs);
  const dozen = whole >= 0 ? Math.floor(whole / 12) : Math.ceil(whole / 12);
  const remaining = Math.abs(whole - dozen * 12);
  return `${whole.toLocaleString("ar-SA")} زوج (${dozen.toLocaleString("ar-SA")} درزن و${remaining.toLocaleString("ar-SA")} زوج)`;
}

export function formatDuration(milliseconds: number | null): string {
  if (milliseconds === null || !Number.isFinite(milliseconds)) return "بيانات وقت غير مكتملة";
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
    transfer_disputed: "اختلاف كمية", transfer_rejected: "رفض الحركة", transfer_resolved_to_pending: "تسوية موثقة للاختلاف",
    stock_stored: "إدخال نهائي للمخزون", sample_delivered: "تسليم عينة مثبت", batch_correction_recorded: "تصحيح إصدار موثق", rework_override_sent: "قرار إعادة معالجة",
  };
  return labels[action] || action || "حركة";
}

export function arabicDepartment(department: string): string {
  const stage = (Object.keys(CUSTODY_STAGE_LABELS) as CustodyStage[]).find(stage=>accountBelongsToStage(department,stage));
  return stage ? CUSTODY_STAGE_LABELS[stage] : department;
}
function accountMaps(accounts: CustodyAccount[]) {
  accounts = accounts.map(account=>({...account,department:arabicDepartment(account.department)}));
  const byId = new Map(accounts.map((account) => [account.id, account]));
  return {
    byId,
    nameFor: (id: number | undefined, fallback = "غير محدد") => byId.get(id ?? -1)?.name || fallback,
    departmentFor: (id: number | undefined, fallback = "غير محدد") => byId.get(id ?? -1)?.department || fallback,
  };
}

function stageDepartment(stage?: CustodyStage): string {
  return stage ? CUSTODY_STAGE_LABELS[stage] : "غير محدد";
}

function intersectMs(start: Date, end: Date, range: ReportRange): number {
  const left = Math.max(start.getTime(), range.start.getTime());
  const right = Math.min(end.getTime(), range.end.getTime());
  return Math.max(0, right - left);
}

function validSettings(settings?: CustodySettings): { available: boolean; issues: string[] } {
  if (!settings) return { available: false, issues: ["إعدادات الورديات غير متاحة؛ لا يمكن حساب زمن الدوام."] };
  const issues: string[] = [];
  if (!Array.isArray(settings.shifts) || settings.shifts.length === 0) issues.push("لم تُضبط ورديات العمل؛ لا يمكن حساب زمن الدوام.");
  for (const shift of settings.shifts || []) {
    if (!shift.name?.trim() || !timeOfDay.test(shift.start) || !timeOfDay.test(shift.end) || shift.start === shift.end) {
      issues.push(`إعداد وردية غير صحيح: ${shift.name || "بدون اسم"}.`);
    }
    if (!Array.isArray(shift.days) || shift.days.length === 0 || shift.days.some((day) => !Number.isInteger(day) || day < 0 || day > 6)) {
      issues.push(`أيام وردية غير صحيحة: ${shift.name || "بدون اسم"}.`);
    }
  }
  for (const [stage, limit] of Object.entries(settings.stageLimits || {})) {
    if (!limit || !Number.isFinite(limit.workHours) || !Number.isFinite(limit.confirmationHours) || limit.workHours < 0 || limit.confirmationHours < 0) {
      issues.push(`حدود المرحلة غير صحيحة: ${CUSTODY_STAGE_LABELS[stage as CustodyStage] || stage}.`);
    }
  }
  if ((settings.holidays || []).some((holiday) => !isoDay.test(holiday))) issues.push("توجد عطلات بصيغة تاريخ غير صحيحة.");
  return { available: issues.length === 0, issues };
}

function riyadhWeekday(day: string): number {
  return new Date(`${day}T12:00:00Z`).getUTCDay();
}

function timeOnDay(day: string, value: string): Date {
  return new Date(`${day}T${value}:00.000+03:00`);
}

/** Intersects a real recorded interval with configured shifts. It never creates synthetic hourly work. */
export function businessMilliseconds(startAt: string | undefined, endAt: string | undefined, settings?: CustodySettings): TimingValue {
  const start = validDate(startAt); const end = validDate(endAt);
  if (!start || !end || end < start) return {calendarMs:null,businessMs:null,state:"incomplete",note:"وقت البداية أو النهاية غير مكتمل."};
  const settingCheck=validSettings(settings); const calendarMs=end.getTime()-start.getTime();
  if (!settingCheck.available) return {calendarMs,businessMs:null,state:"unavailable",note:settingCheck.issues.join(" ")};
  const dayKey=(at:Date) => {const parts=new Intl.DateTimeFormat("en-CA",{timeZone:RIYADH_TIME_ZONE,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(at);return `${parts.find(p=>p.type==="year")!.value}-${parts.find(p=>p.type==="month")!.value}-${parts.find(p=>p.type==="day")!.value}`;};
  // Include the previous day: its overnight shift can intersect the beginning of this interval.
  let day=dayKey(new Date(start.getTime()-86400000)); const lastDay=dayKey(end);
  const holidays=new Set(settings?.holidays||[]); const intervals:ExactInterval[]=[];
  while(day<=lastDay){
    if(!holidays.has(day)) for(const shift of settings?.shifts||[]){
      if(!shift.days.includes(riyadhWeekday(day)))continue;
      const left=timeOnDay(day,shift.start);let right=timeOnDay(day,shift.end);
      if(right<=left)right=timeOnDay(dayAfter(day),shift.end);
      // Split across midnight so holidays never contribute working minutes.
      const midnight=timeOnDay(dayAfter(day),"00:00");
      const segments=right>midnight ? [{day,start:left,end:midnight},{day:dayAfter(day),start:midnight,end:right}] : [{day,start:left,end:right}];
      for(const segment of segments){if(holidays.has(segment.day))continue;const a=Math.max(start.getTime(),segment.start.getTime()), b=Math.min(end.getTime(),segment.end.getTime());if(b>a)intervals.push({start:a,end:b});}
    }
    day=dayAfter(day);
  }
  return {calendarMs,businessMs:mergedIntervalMilliseconds(intervals),state:"available"};
}

function timing(start?: string, end?: string, settings?: CustodySettings): TimingValue {
  return businessMilliseconds(start, end, settings);
}

function lotTiming(batch: CustodyBatch, lot: CustodyLot, settings?: CustodySettings): CustodyReportEvent["timing"] {
  if (lot.legacyTiming) {
    const unavailable: TimingValue = { calendarMs: null, businessMs: null, state: "incomplete", note: "توقيت عهدة مرحّلة تاريخياً غير مكتمل؛ لا تُقاس الإنتاجية." };
    return { custodyDuration: unavailable, awaitingConfirmation: unavailable, waitForStart: unavailable, waitForCompletion: unavailable, manualWork: unavailable, pause: unavailable };
  }
  const outgoing = batch.transfers.filter(item => item.sourceCustodyId === lot.id);
  const confirmedAt = outgoing.length && outgoing.every(item => item.status === "confirmed" && item.receivedAt) ? outgoing.map(item => item.receivedAt!).sort().at(-1) : undefined;
  const sessions = batch.sessions.filter((session) => session.custodyId === lot.id);
  const completeWork = sessions.filter((session) => session.kind === "work" && session.endedAt);
  const completePause = sessions.filter((session) => session.kind === "pause" && session.endedAt);
  const workMs = completeWork.reduce((sum, session) => sum + Math.max(0, new Date(session.endedAt!).getTime() - new Date(session.startedAt).getTime()), 0);
  const pauseMs = completePause.reduce((sum, session) => sum + Math.max(0, new Date(session.endedAt!).getTime() - new Date(session.startedAt).getTime()), 0);
  const unfinished = sessions.some((session) => !session.endedAt || !validDate(session.startedAt));
  const aggregate = (milliseconds: number, incomplete: boolean): TimingValue => ({
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
  return batches.map((batch) => ({ batch, custodyById: new Map(batch.custodies.map((custody) => [custody.id, custody])) }));
}

function isRootCustody(index: IndexedBatch, lot: CustodyLot): boolean {
  // A destination custody is the same confirmed movement represented in a child record, never a second inbound balance.
  return !index.batch.transfers.some((transfer) => transfer.destinationCustodyId === lot.id);
}

function makeEvent(input: Omit<CustodyReportEvent, "actionLabel">): CustodyReportEvent {
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
    const base = { shift: batch.shift, machineNumber:batch.machineNumber, batchId: batch.id, trackingNumber: batch.trackingNumber, product, productCode: batch.product.code, productSize: batch.product.size, productColor: batch.product.color, legacySourceId: legacy.openingBalance ? legacy.legacySource?.id : undefined };
    const lotById = index.custodyById;
    for (const lot of batch.custodies) {
      const actorId = lot.ownerId;
      const actorName = lot.ownerName || maps.nameFor(actorId);
      const department = maps.departmentFor(actorId, stageDepartment(lot.stage));
      const common = { ...base, custodyId: lot.id, parentCustodyId: lot.parentCustodyId, actorId, actorName, department, stage: lot.stage, pairs: lot.pairs, quality: lot.quality, status: lot.status, timing: lotTiming(batch, lot, settings), legacyTiming: lot.legacyTiming };
      const inboundTransfer = batch.transfers.find((transfer) => transfer.destinationCustodyId === lot.id && transfer.receivedAt);
      const outboundTransfer = batch.transfers.find((transfer) => transfer.sourceCustodyId === lot.id);
      // Transfer facts are the authority for an inter-employee receipt/send. Avoid
      // rendering the identical custody timestamp as a second apparent movement.
      if (!inboundTransfer) rows.push(makeEvent({ id: `custody:${lot.id}:received`, source: "custody", ...common, action: "received", at: lot.receivedAt }));
      if (lot.startedAt && !batch.sessions.some(session => session.custodyId === lot.id && session.kind === "work")) rows.push(makeEvent({ id: `custody:${lot.id}:started`, source: "custody", ...common, action: "start", at: lot.startedAt }));
      if (lot.completedAt) rows.push(makeEvent({ id: `custody:${lot.id}:completed`, source: "custody", ...common, action: "complete", at: lot.completedAt }));
      if (lot.sentAt && !outboundTransfer) rows.push(makeEvent({ id: `custody:${lot.id}:sent`, source: "custody", ...common, action: "sent", at: lot.sentAt }));
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
      rows.push(makeEvent({ id: `session:${session.id}:start`, source: "session", ...common, action: session.kind === "pause" ? "pause" : session.startedAt === lot?.startedAt ? "start" : "resume", at: session.startedAt, incomplete: !session.endedAt }));
      // End timestamps stay on the recorded session, never masquerade as a second pause/start.

    }
    const progressByCustody = new Map<string, typeof batch.progress>();
    for (const progress of batch.progress) {
      progressByCustody.set(progress.custodyId, [...(progressByCustody.get(progress.custodyId) || []), progress]);
    }
    for (const custodyProgress of progressByCustody.values()) {
      custodyProgress.sort((left, right) => (validDate(left.recordedAt)?.getTime() || 0) - (validDate(right.recordedAt)?.getTime() || 0));
      let previousPairs = 0;
      let previousRecordedAt: string | undefined;
      for (const progress of custodyProgress) {
      const lot = lotById.get(progress.custodyId);
      // Progress is cumulative at the source. Each reported reading therefore represents
      // only its exact change since the prior real reading (including any pre-range baseline).
      // A negative delta is deliberately preserved as a discrepancy, never hidden or clamped.
      const delta = progress.pairs - previousPairs;
      previousPairs = progress.pairs;
      rows.push(makeEvent({
        id: `progress:${progress.id}`,
        source: "progress",
        ...base,
        custodyId: progress.custodyId,
        parentCustodyId: lot?.parentCustodyId,
        actorId: progress.userId,
        actorName: maps.nameFor(progress.userId, lot?.ownerName || "غير محدد"),
        department: maps.departmentFor(progress.userId, stageDepartment(lot?.stage)),
        stage: lot?.stage,
        action: "progress",
        at: progress.recordedAt,
        pairs: delta,
        quality: lot?.quality,
        status: lot?.status,
        reason: `قراءة تراكمية: ${progress.pairs} زوج؛ التغير عن القراءة السابقة: ${delta} زوج.`,
        progress: { cumulativePairs: progress.pairs, deltaPairs: delta, intervalStartAt: previousRecordedAt, intervalEndAt: progress.recordedAt },
      }));
      previousRecordedAt = progress.recordedAt;
      }
    }
    for (const transfer of batch.transfers) {
      const sourceLot = lotById.get(transfer.sourceCustodyId);
      const destinationLot = transfer.destinationCustodyId ? lotById.get(transfer.destinationCustodyId) : undefined;
      rows.push(makeEvent({
        id: `transfer:${transfer.id}:sent`, source: "transfer", ...base, custodyId: transfer.sourceCustodyId, parentCustodyId: sourceLot?.parentCustodyId,
        actorId: transfer.fromUserId, actorName: transfer.fromName || maps.nameFor(transfer.fromUserId), department: maps.departmentFor(transfer.fromUserId, stageDepartment(transfer.fromStage)),
        stage: transfer.fromStage, action: "send", at: transfer.sentAt, pairs: transfer.pairs, quality: transfer.quality, status: transfer.status,
        counterparty: transfer.toName || maps.nameFor(transfer.toUserId), counterpartyDepartment: maps.departmentFor(transfer.toUserId, stageDepartment(transfer.toStage)), reason: transfer.reason,
      }));
      if (transfer.receivedAt) rows.push(makeEvent({
        id: `transfer:${transfer.id}:received`, source: "transfer", ...base, custodyId: transfer.destinationCustodyId, parentCustodyId: destinationLot?.parentCustodyId,
        actorId: transfer.toUserId, actorName: transfer.toName || maps.nameFor(transfer.toUserId), department: maps.departmentFor(transfer.toUserId, stageDepartment(transfer.toStage)),
        stage: transfer.toStage, action: transfer.status === "confirmed" ? "confirmed" : transfer.status, at: transfer.receivedAt, pairs: transfer.actualPairs ?? transfer.pairs,
        quality: transfer.quality, status: transfer.status, counterparty: transfer.fromName || maps.nameFor(transfer.fromUserId), counterpartyDepartment: maps.departmentFor(transfer.fromUserId, stageDepartment(transfer.fromStage)), reason: transfer.reason,
      }));
    }
    for (const disposal of batch.disposals) {
      const lot = lotById.get(disposal.custodyId);
      const common = { ...base, custodyId: disposal.custodyId, parentCustodyId: lot?.parentCustodyId, actorName: lot?.ownerName || "غير محدد", department: stageDepartment(lot?.stage), stage: lot?.stage, pairs: disposal.pairs, quality: "damaged" as const, status: disposal.status, reason: disposal.reason };
      rows.push(makeEvent({ id: `disposal:${disposal.id}:received`, source: "disposal", ...common, action: "receive", at: lot?.receivedAt, actorId: lot?.ownerId, incomplete: !lot?.receivedAt }));
      if (disposal.approvedAt) rows.push(makeEvent({ id: `disposal:${disposal.id}:approved`, source: "disposal", ...common, action: "approve_disposal", at: disposal.approvedAt, actorId: disposal.approvedBy, actorName: maps.nameFor(disposal.approvedBy, "غير محدد") }));
      if (disposal.executedAt) rows.push(makeEvent({ id: `disposal:${disposal.id}:executed`, source: "disposal", ...common, action: "execute_disposal", at: disposal.executedAt, actorId: disposal.executedBy, actorName: maps.nameFor(disposal.executedBy, "غير محدد") }));
    }
    const represented = new Set(["transfer_sent","transfer_received","work_started","work_resumed","work_paused","work_completed","progress_recorded","disposal_received","disposal_approved","disposal_executed","batch_created"]);
    for (const event of batch.events) {
      if (represented.has(event.action)) continue; // Full before/after audit remains in batch.events; operational rows render once.
      const lot = event.custodyId ? lotById.get(event.custodyId) : undefined;
      // Audit records are retained separately: corrections/rework and any server action remain visible rather than silently discarded.
      rows.push(makeEvent({
        id: `audit:${event.id}`, source: "audit", ...base, custodyId: event.custodyId, parentCustodyId: lot?.parentCustodyId,
        actorId: event.actorId, actorName: event.actorName || maps.nameFor(event.actorId), department: maps.departmentFor(event.actorId, stageDepartment(event.stage || lot?.stage)),
        stage: event.stage || lot?.stage, action: event.action, at: event.at, pairs: event.pairs ?? lot?.pairs, quality: lot?.quality, status: lot?.status, reason: event.reason,
      }));
    }
  }
  return rows.sort((left, right) => (validDate(left.at)?.getTime() || Number.MAX_SAFE_INTEGER) - (validDate(right.at)?.getTime() || Number.MAX_SAFE_INTEGER) || left.id.localeCompare(right.id));
}

function batchMatches(batch: CustodyBatch, filters: CustodyReportFilters): boolean {
  const productNeedle = filters.product?.trim().toLocaleLowerCase("ar") || "";
  const batchNeedle = filters.batch?.trim().toLocaleLowerCase("ar") || "";
  const productText = `${batch.product.code} ${batch.product.name} ${batch.product.size} ${batch.product.color}`.toLocaleLowerCase("ar");
  const batchText = `${batch.id} ${batch.trackingNumber}`.toLocaleLowerCase("ar");
  return (!productNeedle || productText.includes(productNeedle)) && (!batchNeedle || batchText.includes(batchNeedle));
}

function eventMatches(event: CustodyReportEvent, filters: CustodyReportFilters): boolean {
  return (!filters.department || event.department === filters.department) &&
    (!filters.accountId || event.actorId === filters.accountId) &&
    (!filters.quality || event.quality === filters.quality) &&
    (!filters.status || event.status === filters.status) &&
    isInReportRange(event.at, riyadhRange(filters.startDate, filters.endDate));
}

function addToMap(map: Map<string, EmployeeReport>, account: CustodyAccount | undefined, fallbackId: number, fallbackName: string, department: string): EmployeeReport {
  const id = account?.id ?? fallbackId;
  const key=`${id}:${department}`;
  const existing = map.get(key);
  if (existing) return existing;
  const next: EmployeeReport = {
    employeeId: id, employeeName: account?.name || fallbackName || "غير محدد", department: department || account?.department || "غير محدد", events: [],
    totals: { receivedPairs: 0, completedPairs: 0, goodCompletedPairs:0, damagedCompletedPairs:0, suspectedCompletedPairs:0, reworkCompletedPairs:0, sampleCompletedPairs:0, goodWorkMs:0, workMinutesPerGoodPair:null, confirmedOutboundPairs: 0, pendingOutboundPairs: 0, openCustodyPairs: 0, manualWorkMs: 0, pauseMs: 0, productivityPairsPerHour: null, timeIncomplete: false },
    balance: { openingPairs: 0, confirmedInboundPairs: 0, confirmedOutboundPairs: 0, pendingOutboundPairs: 0, endingLiabilityPairs: 0 },
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
  const ordered = [...intervals].filter((interval) => interval.end >= interval.start).sort((left, right) => left.start - right.start || left.end - right.end);
  let total = 0;
  let current = ordered[0];
  for (const interval of ordered.slice(1)) {
    if (interval.start <= current.end) current = { start: current.start, end: Math.max(current.end, interval.end) };
    else { total += current.end - current.start; current = interval; }
  }
  return total + current.end - current.start;
}

function reworkedLot(index:IndexedBatch,lot:CustodyLot):boolean {
  const seen=new Set<string>();let current:CustodyLot|undefined=lot;
  while(current&&!seen.has(current.id)){seen.add(current.id);if(current.sourceStage==="followup")return true;current=current.parentCustodyId?index.custodyById.get(current.parentCustodyId):undefined;}return false;
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
  const exactIntervals = new Map<string, { work: ExactInterval[]; pause: ExactInterval[]; good: ExactInterval[] }>();
  const relevantBatchIds = new Set(indexed.filter(({ batch }) => batchMatches(batch, filters)).map(({ batch }) => batch.id));
  const obtain = (id: number, name: string, department: string) => addToMap(employees, maps.byId.get(id), id, name, department);
  const move = (employee: EmployeeReport, when: string | undefined, direction: 1 | -1, pairs: number) => {
    if (inBefore(when, range)) employee.balance.openingPairs += direction * pairs;
    if (isInReportRange(when, range)) {
      if (direction > 0) employee.balance.confirmedInboundPairs += pairs;
      else employee.balance.confirmedOutboundPairs += pairs;
    }
    if (inThroughEnd(when, range)) employee.balance.endingLiabilityPairs += direction * pairs;
  };

  for (const index of indexed) {
    if (!relevantBatchIds.has(index.batch.id)) continue;
    for (const lot of index.batch.custodies) {
      if (!isRootCustody(index, lot)) continue;
      const employee = obtain(lot.ownerId, lot.ownerName, stageDepartment(lot.stage));
      move(employee, lot.receivedAt, 1, lot.pairs);
    }
    for (const transfer of index.batch.transfers) {
      if (transfer.status !== "confirmed" || !transfer.receivedAt) continue;
      const source = obtain(transfer.fromUserId, transfer.fromName, stageDepartment(transfer.fromStage));
      const destination = obtain(transfer.toUserId, transfer.toName, stageDepartment(transfer.toStage));
      move(source, transfer.receivedAt, -1, transfer.pairs);
      move(destination, transfer.receivedAt, 1, transfer.actualPairs ?? transfer.pairs);
    }
    for (const transfer of index.batch.transfers) {
      if (!inThroughEnd(transfer.sentAt, range) || inThroughEnd(transfer.receivedAt, range)) continue;
      const source = obtain(transfer.fromUserId, transfer.fromName, stageDepartment(transfer.fromStage));
      source.balance.pendingOutboundPairs += transfer.pairs;
    }
    for (const event of index.batch.events) {
      if (!["stock_stored", "disposal_executed", "sample_delivered"].includes(event.action) || !event.custodyId) continue;
      const lot=index.custodyById.get(event.custodyId); if(!lot)continue;
      move(obtain(lot.ownerId,lot.ownerName,stageDepartment(lot.stage)),event.at,-1,event.pairs ?? lot.pairs);
    }
  }

  for (const event of events) {
    if (!relevantBatchIds.has(event.batchId) || !eventMatches(event, filters) || !event.actorId) continue;
    const employee = obtain(event.actorId, event.actorName, event.department);
    employee.events.push(event);
  }

  for (const index of indexed) {
    if (!relevantBatchIds.has(index.batch.id)) continue;
    for (const transfer of index.batch.transfers) {
      if (transfer.status === "confirmed" && isInReportRange(transfer.receivedAt, range)) {
        obtain(transfer.toUserId, transfer.toName, stageDepartment(transfer.toStage)).totals.receivedPairs += transfer.actualPairs ?? transfer.pairs;
        obtain(transfer.fromUserId, transfer.fromName, stageDepartment(transfer.fromStage)).totals.confirmedOutboundPairs += transfer.pairs;
      }
      if (inThroughEnd(transfer.sentAt, range) && !inThroughEnd(transfer.receivedAt, range)) obtain(transfer.fromUserId, transfer.fromName, stageDepartment(transfer.fromStage)).totals.pendingOutboundPairs += transfer.pairs;
    }
    for (const lot of index.batch.custodies) {
      if (isRootCustody(index, lot) && isInReportRange(lot.receivedAt, range)) obtain(lot.ownerId, lot.ownerName, stageDepartment(lot.stage)).totals.receivedPairs += lot.pairs;
      const progress=index.batch.progress.filter(p=>p.custodyId===lot.id).sort((a,b)=>a.recordedAt.localeCompare(b.recordedAt));
      if(progress.length){let previous=0;for(const reading of progress){const delta=reading.pairs-previous;previous=reading.pairs;if(isInReportRange(reading.recordedAt,range)){
        const totals=obtain(lot.ownerId,lot.ownerName,stageDepartment(lot.stage)).totals;totals.completedPairs+=delta;
        if(index.batch.purpose==="sample")totals.sampleCompletedPairs+=delta;
        else if(reworkedLot(index,lot))totals.reworkCompletedPairs+=delta;
        else if(lot.quality==="damaged")totals.damagedCompletedPairs+=delta;
        else if(lot.quality==="suspected")totals.suspectedCompletedPairs+=delta;
        else totals.goodCompletedPairs+=delta;
      }}}
      // A completion date without progress is not silently invented as hourly/day production.
    }
    for (const session of index.batch.sessions) {
      const lot = index.custodyById.get(session.custodyId);
      const employee = obtain(session.userId, lot?.ownerName || maps.nameFor(session.userId), stageDepartment(lot?.stage));
      const started = validDate(session.startedAt);
      const ended = validDate(session.endedAt);
      if (lot?.legacyTiming || !started || !ended || ended < started) {
        if (!started || (started < range.end && (!ended || ended > range.start))) employee.totals.timeIncomplete = true;
        continue;
      }
      const start = Math.max(started.getTime(), range.start.getTime());
      const end = Math.min(ended.getTime(), range.end.getTime());
      if (end <= start) continue;
      const employeeKey=`${employee.employeeId}:${employee.department}`;
      const employeeIntervals = exactIntervals.get(employeeKey) || { work: [], pause: [], good: [] };
      employeeIntervals[session.kind].push({ start, end });
      if(session.kind==="work"&&index.batch.purpose==="sale"&&lot&&["first","second"].includes(lot.quality)&&!reworkedLot(index,lot))employeeIntervals.good.push({start,end});
      exactIntervals.set(employeeKey, employeeIntervals);
    }
  }

  for (const employee of employees.values()) {
    employee.totals.openCustodyPairs = employee.balance.endingLiabilityPairs;
    const intervals = exactIntervals.get(`${employee.employeeId}:${employee.department}`);
    employee.totals.manualWorkMs = mergedIntervalMilliseconds(intervals?.work || []);
    employee.totals.pauseMs = mergedIntervalMilliseconds(intervals?.pause || []);
    employee.totals.goodWorkMs=mergedIntervalMilliseconds(intervals?.good||[]);
    if (employee.totals.timeIncomplete || !employee.totals.goodWorkMs) employee.totals.productivityPairsPerHour = null;
    else employee.totals.productivityPairsPerHour = employee.totals.goodCompletedPairs / (employee.totals.goodWorkMs / 3_600_000);
    employee.totals.workMinutesPerGoodPair=!employee.totals.timeIncomplete&&employee.totals.goodCompletedPairs>0&&employee.totals.goodWorkMs>0?employee.totals.goodWorkMs/60000/employee.totals.goodCompletedPairs:null;
    employee.events.sort((left, right) => (validDate(left.at)?.getTime() || 0) - (validDate(right.at)?.getTime() || 0));
  }
  return [...employees.values()]
    .filter((employee) => (!filters.department || employee.department === filters.department) && (!filters.accountId || employee.employeeId === filters.accountId))
    .sort((a, b) => a.department.localeCompare(b.department, "ar") || a.employeeName.localeCompare(b.employeeName, "ar"));
}

function buildTimeline(batch: CustodyBatch): BatchTimeline {
  const byId = new Map<string, BatchTimelineNode>();
  const root: BatchTimelineNode[] = [];
  const issues: string[] = [];
  for (const lot of batch.custodies) {
    const node: BatchTimelineNode = {
      id: lot.id, parentId: lot.parentCustodyId, kind: "custody", stage: lot.stage, stageLabel: CUSTODY_STAGE_LABELS[lot.stage], quality: lot.quality, qualityLabel: CUSTODY_QUALITY_LABELS[lot.quality], pairs: lot.pairs,
      status: lot.status, statusLabel: CUSTODY_STATUS_LABELS[lot.status], at: lot.receivedAt, owner: lot.ownerName, children: [],
    };
    byId.set(node.id, node);
  }
  for (const node of byId.values()) {
    if (node.parentId && byId.has(node.parentId)) byId.get(node.parentId)!.children.push(node);
    else root.push(node);
  }
  for (const transfer of batch.transfers) {
    const parent = byId.get(transfer.sourceCustodyId);
    const node: BatchTimelineNode = {
      id: `transfer:${transfer.id}`, parentId: transfer.sourceCustodyId, kind: "transfer", stage: transfer.toStage, stageLabel: `${CUSTODY_STAGE_LABELS[transfer.fromStage]} ← ${CUSTODY_STAGE_LABELS[transfer.toStage]}`,
      quality: transfer.quality, qualityLabel: CUSTODY_QUALITY_LABELS[transfer.quality], pairs: transfer.actualPairs ?? transfer.pairs, status: transfer.status,
      statusLabel: transfer.status === "confirmed" ? "مؤكد" : transfer.status === "pending" ? "بانتظار التأكيد" : transfer.status, at: transfer.receivedAt || transfer.sentAt,
      owner: `${transfer.fromName} ← ${transfer.toName}`, detail: transfer.reason, children: [],
    };
    if (parent) parent.children.push(node); else { root.push(node); issues.push(`تحويل ${transfer.id} لا يرتبط بعهدة مصدر موجودة.`); }
  }
  for (const disposal of batch.disposals) {
    const parent = byId.get(disposal.custodyId);
    const node: BatchTimelineNode = {
      id: `disposal:${disposal.id}`, parentId: disposal.custodyId, kind: "disposal", stage: parent?.stage, stageLabel: "محضر إتلاف", quality: "damaged", qualityLabel: CUSTODY_QUALITY_LABELS.damaged,
      pairs: disposal.pairs, status: disposal.status, statusLabel: disposal.status === "executed" ? "إتلاف منفذ" : disposal.status === "approved" ? "محضر معتمد" : "مستلم لدى المتابعة",
      at: disposal.executedAt || disposal.approvedAt, detail: disposal.reason, children: [],
    };
    if (parent) parent.children.push(node); else { root.push(node); issues.push(`محضر الإتلاف ${disposal.id} لا يرتبط بعهدة موجودة.`); }
  }
  const sortNode = (node: BatchTimelineNode) => { node.children.sort((a, b) => (validDate(a.at)?.getTime() || 0) - (validDate(b.at)?.getTime() || 0)); node.children.forEach(sortNode); };
  root.sort((a, b) => (validDate(a.at)?.getTime() || 0) - (validDate(b.at)?.getTime() || 0)).forEach(sortNode);
  return {
    batchId: batch.id, trackingNumber: batch.trackingNumber, product: batch.product.name || batch.product.code, originalProductionPairs: batch.totalPairs,
    firstPairs: batch.firstPairs, secondPairs: batch.secondPairs, executedDestroyedPairs: batch.disposals.filter((item) => item.status === "executed").reduce((sum, item) => sum + item.pairs, 0), nodes: root, issues,
  };
}

export function buildCustodyReport(input: { batches: CustodyBatch[]; accounts: CustodyAccount[]; settings?: CustodySettings; filters: CustodyReportFilters }): CustodyReport {
  input = {...input, filters:{...input.filters,department:input.filters.department?arabicDepartment(input.filters.department):undefined}};
  const range = riyadhRange(input.filters.startDate, input.filters.endDate);
  const eligibleBatches = input.batches.filter((batch) => batchMatches(batch, input.filters));
  const allEvents = buildReportEvents(eligibleBatches, input.accounts, input.settings);
  const events = allEvents.filter((event) => eventMatches(event, input.filters));
  const employees = calculateEmployees(indexedBatches(eligibleBatches), allEvents, input.accounts, range, input.filters);
  const byDepartment = new Map<string, EmployeeReport[]>();
  for (const employee of employees) byDepartment.set(employee.department, [...(byDepartment.get(employee.department) || []), employee]);
  // Production is a batch fact. It is deliberately dated by production, not by the
  // creation/audit timestamp, and is never re-added for any downstream stage.
  const legacyBatches = eligibleBatches.filter((batch) => (batch as LegacyAwareBatch).openingBalance === true);
  const periodBatches = eligibleBatches.filter((batch) => batch.purpose === "sale" && (batch as LegacyAwareBatch).openingBalance !== true && isInReportRange(batch.productionDate || batch.createdAt, range));
  const quality = {firstPairs:0,secondPairs:0,suspectedPairs:0,damagedPairs:0};
  // Snapshot at range end: only confirmed transfers move grade liability; pending branches do not double-count.
  for(const batch of eligibleBatches){if(batch.purpose!=="sale")continue;for(const lot of batch.custodies){
    if(!inThroughEnd(lot.receivedAt,range))continue;
    const out=batch.transfers.filter(t=>t.sourceCustodyId===lot.id&&t.status==="confirmed"&&inThroughEnd(t.receivedAt,range)).reduce((n,t)=>n+t.pairs,0);
    const balance=lot.pairs-out;
    if(!input.filters.quality||input.filters.quality===lot.quality)quality[`${lot.quality}Pairs` as keyof typeof quality]+=balance;
  }}
  const disposal = {receivedPairs:0,approvedPairs:0,executedPairs:0};
  for(const batch of eligibleBatches)for(const item of batch.disposals){
    const lot=batch.custodies.find(l=>l.id===item.custodyId);
    if(isInReportRange(lot?.receivedAt,range))disposal.receivedPairs+=item.pairs;
    if(isInReportRange(item.approvedAt,range))disposal.approvedPairs+=item.pairs;
    if(isInReportRange(item.executedAt,range))disposal.executedPairs+=item.pairs;
  }
  const warehouseFinalStockPairs=eligibleBatches.reduce((sum,batch)=>sum+batch.events.filter(e=>e.action==="stock_stored"&&isInReportRange(e.at,range)).reduce((n,e)=>n+(e.pairs??0),0),0);
  const samplesWithDeliveryProof=eligibleBatches.filter(batch=>batch.purpose==="sample"&&!!batch.sampleDelivery?.proof?.trim()&&isInReportRange(batch.sampleDelivery.at,range)).length;
  const settingCheck = validSettings(input.settings);
  const warnings = [
    ...settingCheck.issues,
    ...events.filter((event) => event.incomplete).map((event) => `بيانات وقت غير مكتملة: ${event.trackingNumber} — ${event.actionLabel}.`),
  ];
  const legacy = {
    openingBatchCount: legacyBatches.length,
    openingPairs: legacyBatches.reduce((sum, batch) => sum + batch.totalPairs, 0),
    linkedLegacySourceCount: legacyBatches.filter((batch) => !!(batch as LegacyAwareBatch).legacySource?.id).length,
  };
  return {
    range, events,
    departments: [...byDepartment.entries()].map(([department, employees]) => ({ department, employees })),
    timelines: eligibleBatches.filter((batch) => !input.filters.batch || `${batch.id} ${batch.trackingNumber}`.toLocaleLowerCase("ar").includes(input.filters.batch!.toLocaleLowerCase("ar"))).map(buildTimeline),
    originalProductionPairs: periodBatches.reduce((sum, batch) => sum + batch.totalPairs, 0),
    quality, disposal, warehouseFinalStockPairs, samplesWithDeliveryProof, legacy, warnings, businessTime: settingCheck,
  };
}

/** Use this in daily-summary or dashboards after calling buildCustodyReport with the same visibility/filter scope. */
export function custodyReportSummary(report: CustodyReport): CustodyReportSummary {
  const employees = report.departments.flatMap((department) => department.employees);
  return {
    originalProductionPairs: report.originalProductionPairs,
    receivedPairs: employees.reduce((sum, employee) => sum + employee.totals.receivedPairs, 0),
    completedPairs: employees.reduce((sum, employee) => sum + employee.totals.completedPairs, 0),
    confirmedOutboundPairs: employees.reduce((sum, employee) => sum + employee.totals.confirmedOutboundPairs, 0),
    pendingOutboundPairs: employees.reduce((sum, employee) => sum + employee.totals.pendingOutboundPairs, 0),
    openCustodyPairs: employees.reduce((sum, employee) => sum + employee.totals.openCustodyPairs, 0),
    warehouseFinalStockPairs: report.warehouseFinalStockPairs,
    executedDestroyedPairs: report.disposal.executedPairs,
    legacyOpeningPairs: report.legacy.openingPairs,
    legacyOpeningBatchCount: report.legacy.openingBatchCount,
    employeesWithIncompleteTiming: employees.filter((employee) => employee.totals.timeIncomplete).length,
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
    "القسم": spreadsheetSafe(event.department) as string,
    "الموظف": spreadsheetSafe(event.actorName) as string,
    "رقم الدفعة": spreadsheetSafe(event.trackingNumber) as string,
    "الوردية": spreadsheetSafe(event.shift || "غير مسجلة") as string,
    "الماكينة": spreadsheetSafe(event.machineNumber || "غير مسجلة") as string,
    "الصنف": spreadsheetSafe(event.product) as string,
    "المقاس": spreadsheetSafe(event.productSize) as string,
    "اللون": spreadsheetSafe(event.productColor) as string,
    "النخب": spreadsheetSafe(event.quality ? CUSTODY_QUALITY_LABELS[event.quality] : "") as string,
    "نوع الحركة": spreadsheetSafe(event.actionLabel) as string,
    "الطرف المقابل": spreadsheetSafe(event.counterparty || "") as string,
    "الكمية (زوج)": event.pairs ?? null,
    "الوقت (الرياض)": spreadsheetSafe(formatRiyadh(event.at)) as string,
    "الحالة": spreadsheetSafe(event.status || "") as string,
    "ملاحظة": spreadsheetSafe(event.reason || (event.incomplete ? "بيانات وقت غير مكتملة" : "")) as string,
    "مصدر افتتاحي قديم": event.legacySourceId ?? null,
  }));
}

function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] || character);
}

/** Native browser/Expo print HTML. All values are escaped and remain selectable Arabic text. */
export function reportPrintHtml(report: CustodyReport): string {
  const head="<tr><th>الدفعة</th><th>الصنف / المقاس / اللون</th><th>النخب</th><th>الحركة</th><th>الطرف المقابل</th><th>الكمية</th><th>وقت الرياض</th><th>الحالة</th><th>الأوقات والملاحظات</th></tr>";
  const rows=(events:CustodyReportEvent[])=>events.map(event=>`<tr><td>${escapeHtml(event.trackingNumber)}</td><td>${escapeHtml(`${event.product} / ${event.productSize} / ${event.productColor}`)}</td><td>${escapeHtml(event.quality?CUSTODY_QUALITY_LABELS[event.quality]:"—")}</td><td>${escapeHtml(event.actionLabel)}</td><td>${escapeHtml(event.counterparty||"—")}</td><td>${escapeHtml(event.pairs==null?"—":formatPairs(event.pairs))}</td><td>${escapeHtml(formatRiyadh(event.at))}</td><td>${escapeHtml(CUSTODY_STATUS_LABELS[event.status as CustodyStatus]||event.status||"—")}</td><td>${escapeHtml(event.reason||"")}${event.timing?`<br>عمل: ${escapeHtml(formatDuration(event.timing.manualWork.calendarMs))} · توقف: ${escapeHtml(formatDuration(event.timing.pause.calendarMs))} · عهدة: ${escapeHtml(formatDuration(event.timing.custodyDuration.calendarMs))}`:""}</td></tr>`).join("");
  const groups=report.departments.map(department=>`<section><h2>${escapeHtml(department.department)}</h2>${department.employees.map(employee=>`<h3>الموظف: ${escapeHtml(employee.employeeName)} — الورديات: ${escapeHtml([...new Set(employee.events.map(event=>event.shift).filter(Boolean))].join(" / ") || "غير مسجلة")}</h3><table><thead>${head}</thead><tbody>${rows(employee.events)||'<tr><td colspan="9">لا توجد حركات للفترة؛ الرصيد موضح أدناه.</td></tr>'}</tbody></table><p class="totals">مستلم ${escapeHtml(formatPairs(employee.totals.receivedPairs))} | منجز فعلي ${escapeHtml(formatPairs(employee.totals.completedPairs))} | صادر مؤكد ${escapeHtml(formatPairs(employee.totals.confirmedOutboundPairs))} | مرسل معلق ${escapeHtml(formatPairs(employee.totals.pendingOutboundPairs))}<br>سليم ${escapeHtml(formatPairs(employee.totals.goodCompletedPairs))} | مشتبه ${escapeHtml(formatPairs(employee.totals.suspectedCompletedPairs))} | تالف ${escapeHtml(formatPairs(employee.totals.damagedCompletedPairs))} | إعادة عمل ${escapeHtml(formatPairs(employee.totals.reworkCompletedPairs))} | عينات ${escapeHtml(formatPairs(employee.totals.sampleCompletedPairs))}<br>رصيد البداية ${escapeHtml(formatPairs(employee.balance.openingPairs))} | مسؤولية النهاية ${escapeHtml(formatPairs(employee.balance.endingLiabilityPairs))} | عمل ${escapeHtml(formatDuration(employee.totals.timeIncomplete?null:employee.totals.manualWorkMs))} | توقف ${escapeHtml(formatDuration(employee.totals.timeIncomplete?null:employee.totals.pauseMs))} | إنتاجية السليم ${employee.totals.productivityPairsPerHour===null?"بيانات وقت غير مكتملة":escapeHtml(employee.totals.productivityPairsPerHour.toFixed(2)+" زوج/ساعة")}</p>`).join("")}</section>`).join("");
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>تقرير الاستلام والتسليم والعهد</title><style>@page{size:A4 landscape;margin:8mm}body{font-family:Arial,sans-serif;color:#172033;margin:12px;direction:rtl}h1{margin:0;font-size:20px;color:#075985}h2{font-size:14px;margin:12px 0 3px;border-bottom:1px solid #94a3b8}h3{font-size:12px;margin:6px 0 3px}p{font-size:10px;margin:4px 0}table{border-collapse:collapse;width:100%;font-size:9px;margin:3px 0;table-layout:fixed}thead{display:table-header-group}th{background:#075985;color:white}th,td{border:1px solid #cbd5e1;padding:4px;text-align:right;vertical-align:top;overflow-wrap:anywhere}.totals{background:#f0f9ff;padding:6px}.note{color:#92400e;background:#fffbeb;padding:6px}@media print{body{margin:0}tr{break-inside:avoid}h2,h3{break-after:avoid}.toolbar{display:none}}</style></head><body><button class="toolbar" onclick="window.print()">طباعة / حفظ PDF</button><h1>تقرير الاستلام والتسليم والعهد</h1><p>الفترة ${escapeHtml(report.range.startDate)} إلى ${escapeHtml(report.range.endDate)} — اليوم كاملًا بتوقيت الرياض</p><p>إنتاج أصلي للفترة: ${escapeHtml(formatPairs(report.originalProductionPairs))} | وارد مخزني معتمد: ${escapeHtml(formatPairs(report.warehouseFinalStockPairs))} | إتلاف منفذ: ${escapeHtml(formatPairs(report.disposal.executedPairs))} | عينات ذات إثبات تسليم: ${report.samplesWithDeliveryProof}</p>${report.warnings.length?`<p class="note">${escapeHtml(report.warnings.join(" | "))}</p>`:""}${groups||"<p>لا توجد حركات ضمن الفترة والفلاتر المختارة.</p>"}</body></html>`;
}

export function reportCsv(report: CustodyReport): string {
  const rows = reportExportRows(report);
  const headers = rows.length ? Object.keys(rows[0]) : ["القسم", "الموظف", "رقم الدفعة"];
  const quote = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  return `\uFEFF${headers.map(quote).join(",")}\r\n${rows.map((row) => headers.map((header) => quote(row[header])).join(",")).join("\r\n")}`;
}
