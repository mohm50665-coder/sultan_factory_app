import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { BackButton } from "@/components/back-button";
import { AttachmentPicker } from "@/components/attachment-picker";
import { ScreenContainer } from "@/components/screen-container";
import {
  CUSTODY_STAGES,
  formatPairs,
  formatRiyadh,
  selectWorkbenchCounts,
  selectWorkbenchRows,
  type WorkbenchRow,
} from "@/components/custody-ui";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";
import { custodyQualityEnglish, custodyStageEnglish, custodyStatusEnglish, departmentEnglish, isEnglish, localize, textAlignFor, writingDirection } from "@/lib/i18n/runtime";
import { useColors } from "@/hooks/use-colors";
import { type AttachmentFile } from "@/lib/services/attachment.service";
import {
  createCustodyOperationKey,
  custodyService,
  isAllocationAllowed,
  nextCustodyStage,
  validateFullAllocations,
} from "@/lib/services/custody.service";
import type {
  CustodyAccount,
  CustodyActionInput,
  CustodyAllocation,
  CustodyBatch,
  CustodyLot,
  CustodySettings,
  CustodyStage,
  CustodyTransfer,
} from "@shared/custody-contract";
import { accountBelongsToStage } from "@shared/custody-policy";
import { CUSTODY_QUALITY_LABELS, CUSTODY_STAGE_LABELS, CUSTODY_STATUS_LABELS } from "@shared/custody-contract";

type Notice = { tone: "info" | "success" | "error"; arabic: string; english: string } | null;
type ActionKind = "receive" | "dispute" | "reject" | "start" | "pause" | "resume" | "progress" | "complete" | "send" | "store" | "approve_disposal" | "execute_disposal" | "deliver_sample" | "resolve" | "rework";
type ActionTarget = { row: WorkbenchRow; action: ActionKind };
type FormState = {
  actualPairs: string;
  pairs: string;
  reason: string;
  receiverId: string;
  barcode: string;
  packagePairs: string;
  method: string;
  receiver: string;
  proof: string;
  defectType: string;
  defectCause: string;
  reworkStage: CustodyStage;
};

const EMPTY_FORM: FormState = {
  actualPairs: "",
  pairs: "",
  reason: "",
  receiverId: "",
  barcode: "",
  packagePairs: "",
  method: "",
  receiver: "",
  proof: "",
  defectType: "",
  defectCause: "",
  reworkStage: "inspection",
};

const makeNotice = (tone: NonNullable<Notice>["tone"], arabic: string, english: string): NonNullable<Notice> => ({ tone, arabic, english });
const textStyleFor = (language: "ar" | "en") => ({ textAlign: textAlignFor(language), writingDirection: writingDirection(language) } as const);
const rowStyleFor = (language: "ar" | "en") => ({ flexDirection: isEnglish(language) ? "row" : "row-reverse" } as const);
const alignStyleFor = (language: "ar" | "en") => ({ alignItems: isEnglish(language) ? "flex-start" : "flex-end" } as const);

function formatPairsFor(language: "ar" | "en", pairs: number | undefined | null): string {
  if (!isEnglish(language)) return formatPairs(pairs);
  const safePairs = Math.max(0, Math.trunc(Number(pairs) || 0));
  const dozens = Math.floor(safePairs / 12);
  const remainder = safePairs % 12;
  return `${dozens} dozen${dozens === 1 ? "" : "s"} + ${remainder} pair${remainder === 1 ? "" : "s"}`;
}

function formatRiyadhFor(language: "ar" | "en", iso?: string): string {
  if (!isEnglish(language)) return formatRiyadh(iso);
  if (!iso || Number.isNaN(new Date(iso).getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Riyadh" }).format(new Date(iso));
}

function stageLabelFor(language: "ar" | "en", stage?: CustodyStage): string {
  if (!stage) return "—";
  return isEnglish(language) ? custodyStageEnglish[stage] || stage : CUSTODY_STAGE_LABELS[stage];
}

function statusLabelFor(language: "ar" | "en", status?: string): string {
  if (!status) return "—";
  return isEnglish(language) ? custodyStatusEnglish[status] || status : CUSTODY_STATUS_LABELS[status as keyof typeof CUSTODY_STATUS_LABELS] || status;
}

function qualityLabelFor(language: "ar" | "en", quality?: string): string {
  if (!quality) return "—";
  return isEnglish(language) ? custodyQualityEnglish[quality] || quality : CUSTODY_QUALITY_LABELS[quality as keyof typeof CUSTODY_QUALITY_LABELS] || quality;
}

function departmentLabelFor(language: "ar" | "en", department?: string | null): string {
  if (!department) return localize(language, "القسم غير مسجل", "Department not recorded");
  return isEnglish(language) ? departmentEnglish[department] || department : department;
}

function rowLot(row: WorkbenchRow): CustodyLot | undefined {
  return row.kind === "lot" ? row.lot : undefined;
}

function rowTransfer(row: WorkbenchRow): CustodyTransfer | undefined {
  return row.kind === "lot" ? undefined : row.transfer;
}

function rowStage(row: WorkbenchRow): CustodyStage {
  if (row.kind === "lot") return row.lot.stage;
  return row.kind === "incoming" ? row.transfer.toStage : row.transfer.fromStage;
}

function rowPairs(row: WorkbenchRow): number {
  return row.kind === "lot" ? row.lot.pairs : row.transfer.pairs;
}

function rowStatus(row: WorkbenchRow): string {
  return row.kind === "lot" ? row.lot.status : row.transfer.status;
}

function rowTitle(row: WorkbenchRow, language: "ar" | "en"): string {
  if (row.kind === "lot") return localize(language, `عهدة لديّ · ${stageLabelFor(language, row.lot.stage)}`, `My custody · ${stageLabelFor(language, row.lot.stage)}`);
  if (row.kind === "incoming") return localize(language, `نقل وارد من ${row.transfer.fromName}`, `Incoming transfer from ${row.transfer.fromName}`);
  return localize(language, `نقل صادر إلى ${row.transfer.toName}`, `Outgoing transfer to ${row.transfer.toName}`);
}

function numberOrUndefined(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined;
}

function accountById(accounts: CustodyAccount[], id: string) {
  const numericId = Number(id);
  return accounts.find((account) => account.id === numericId);
}

function accountMatchesStage(account: CustodyAccount, stage: CustodyStage): boolean {
  return accountBelongsToStage(account.department, stage);
}

function permittedActions(row: WorkbenchRow, role: string | undefined): ActionKind[] {
  const lot = rowLot(row); const transfer = rowTransfer(row);
  const supervisor = role === "supervisor" || role === "admin";
  if (transfer) return row.kind === "incoming" && transfer.status === "pending" ? ["receive", "dispute", "reject"] : supervisor && ["disputed", "rejected"].includes(transfer.status) ? ["resolve"] : [];
  if (!lot || ["closed", "stored", "destroyed", "sent", "disputed"].includes(lot.status)) return [];
  if (lot.stage === "followup" && lot.quality === "damaged") {
    const disposal = row.batch.disposals.find(item => item.custodyId === lot.id);
    if (disposal?.status === "executed") return [];
    if (disposal?.status === "approved") return ["execute_disposal"];
    return [...(role === "manager" || supervisor ? ["approve_disposal" as const] : []), ...(supervisor ? ["rework" as const] : [])];
  }
  if (lot.stage === "customer_service" && row.batch.purpose === "sample" && lot.status === "received") return ["deliver_sample"];
  if (lot.stage === "storage" && row.batch.purpose === "sale" && ["received", "completed"].includes(lot.status)) return ["store"];
  if (lot.status === "received") return ["start"];
  if (lot.status === "working") return ["progress", "pause", "complete"];
  if (lot.status === "paused") return ["resume"];
  if (lot.status === "completed") return ["send"];
  return [];
}

function actionLabel(action: ActionKind, language: "ar" | "en"): string {
  const labels: Record<ActionKind, [string, string]> = {
    receive: ["تأكيد الاستلام بعد العد", "Confirm receipt after counting"],
    dispute: ["تسجيل اختلاف كمية", "Record quantity discrepancy"],
    reject: ["رفض النقل", "Reject transfer"],
    start: ["بدء العمل", "Start work"],
    pause: ["إيقاف مؤقت", "Pause"],
    resume: ["استئناف العمل", "Resume work"],
    progress: ["تسجيل تقدم تراكمي", "Record cumulative progress"],
    complete: ["إكمال العمل بالكامل", "Complete all work"],
    send: ["تسليم كامل العهدة", "Hand over full custody"],
    store: ["اعتماد الإدخال النهائي", "Approve final entry"],
    approve_disposal: ["اعتماد محضر الإتلاف", "Approve disposal record"],
    execute_disposal: ["تنفيذ الإتلاف", "Execute disposal"],
    deliver_sample: ["توثيق تسليم العينة", "Document sample delivery"],
    resolve: ["حل الاختلاف", "Resolve discrepancy"],
    rework: ["إحالة لإعادة المعالجة", "Send for rework"],
  };
  const label = labels[action];
  return label ? localize(language, ...label) : action;
}

function statusFilters(language: "ar" | "en") {
  return [
    ["", localize(language, "كل الحالات", "All statuses")],
    ["pending", localize(language, "بانتظار استلامي", "Awaiting my receipt")],
    ["received", localize(language, "مستلم", "Received")],
    ["working", localize(language, "قيد العمل", "In progress")],
    ["paused", localize(language, "متوقف مؤقتًا", "Paused")],
    ["completed", localize(language, "مكتمل", "Completed")],
    ["sent", localize(language, "مرسل بانتظار التأكيد", "Sent — awaiting confirmation")],
    ["disputed", localize(language, "اختلاف كمية", "Quantity discrepancy")],
  ] as const;
}

function actionIcon(action: ActionKind): React.ComponentProps<typeof MaterialIcons>["name"] {
  return ({
    receive: "fact-check",
    dispute: "report-problem",
    reject: "undo",
    start: "play-arrow",
    pause: "pause",
    resume: "play-arrow",
    progress: "trending-up",
    complete: "task-alt",
    send: "send",
    store: "inventory",
    approve_disposal: "verified",
    execute_disposal: "delete-forever",
    deliver_sample: "local-shipping",
    resolve: "gavel",
    rework: "restart-alt",
  } satisfies Record<ActionKind, React.ComponentProps<typeof MaterialIcons>["name"]>)[action];
}

function HeaderMetric({ label, value, tone = "blue", language }: { label: string; value: number | string; tone?: "blue" | "green" | "amber" | "red" | "violet"; language: "ar" | "en" }) {
  return <View style={[styles.metric, styles[`metric_${tone}`]]}><Text style={[styles.metricValue, styles[`metricValue_${tone}`], textStyleFor(language)]}>{value}</Text><Text style={[styles.metricLabel, textStyleFor(language)]}>{label}</Text></View>;
}

function TinyButton({
  label,
  onPress,
  tone = "primary",
  disabled,
  icon,
  language,
}: {
  label: string;
  onPress: () => void;
  tone?: "primary" | "secondary" | "danger";
  disabled?: boolean;
  icon?: React.ComponentProps<typeof MaterialIcons>["name"];
  language: "ar" | "en";
}) {
  const palette = tone === "danger" ? { background: "#fff1f2", border: "#fecdd3", text: "#be123c" } : tone === "secondary" ? { background: "#fff", border: "#cbd5e1", text: "#334155" } : { background: "#075985", border: "#075985", text: "#fff" };
  return <TouchableOpacity disabled={disabled} onPress={onPress} style={[styles.tinyButton, rowStyleFor(language), { backgroundColor: palette.background, borderColor: palette.border }, disabled && styles.disabledButton]}><Text style={[styles.tinyButtonText, textStyleFor(language), { color: palette.text }]}>{label}</Text>{icon ? <MaterialIcons name={icon} size={15} color={palette.text} /> : null}</TouchableOpacity>;
}

function ReadonlyField({ label, value, language }: { label: string; value: React.ReactNode; language: "ar" | "en" }) {
  return <View style={styles.readonlyField}><Text style={[styles.readonlyLabel, textStyleFor(language)]}>{label}</Text><Text style={[styles.readonlyValue, textStyleFor(language)]}>{value}</Text></View>;
}

function WorkbenchStatusPill({ status, language }: { status: string; language: "ar" | "en" }) {
  const colors = ({ pending: ["#dbeafe", "#1d4ed8"], received: ["#e0f2fe", "#075985"], working: ["#dcfce7", "#166534"], paused: ["#fef3c7", "#92400e"], completed: ["#ede9fe", "#5b21b6"], sent: ["#dbeafe", "#1d4ed8"], disputed: ["#fee2e2", "#b91c1c"], rejected: ["#fee2e2", "#b91c1c"] } as Record<string, [string, string]>)[status] || ["#f1f5f9", "#475569"];
  return <View style={{ alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: colors[0] }}><Text style={[{ color: colors[1], fontSize: 11, fontWeight: "800" }, textStyleFor(language)]}>{statusLabelFor(language, status)}</Text></View>;
}

function WorkbenchMessageBanner({ notice: currentNotice, language, onDismiss }: { notice: Notice; language: "ar" | "en"; onDismiss?: () => void }) {
  if (!currentNotice) return null;
  const palette = { info: { background: "#eff6ff", border: "#bfdbfe", color: "#1e3a8a" }, success: { background: "#ecfdf5", border: "#a7f3d0", color: "#065f46" }, error: { background: "#fef2f2", border: "#fecaca", color: "#991b1b" } }[currentNotice.tone];
  return <View accessibilityRole="alert" style={[{ paddingHorizontal: 11, paddingVertical: 9, borderWidth: 1, borderRadius: 10, gap: 10, alignItems: "center" }, rowStyleFor(language), { backgroundColor: palette.background, borderColor: palette.border }]}><Text style={[{ flex: 1, color: palette.color, fontSize: 12, fontWeight: "600", lineHeight: 18 }, textStyleFor(language)]}>{localize(language, currentNotice.arabic, currentNotice.english)}</Text>{onDismiss ? <Text onPress={onDismiss} style={[{ color: palette.color, fontSize: 11, fontWeight: "800" }, textStyleFor(language)]}>{localize(language, "إخفاء", "Dismiss")}</Text> : null}</View>;
}

function WorkbenchBusyLabel({ language, label }: { language: "ar" | "en"; label?: string }) {
  return <View style={[{ alignItems: "center", justifyContent: "center", gap: 7 }, rowStyleFor(language)]}><ActivityIndicator size="small" color="#fff" /><Text style={[{ color: "#fff", fontWeight: "800", fontSize: 12 }, textStyleFor(language)]}>{label || localize(language, "جارٍ التنفيذ…", "Working…")}</Text></View>;
}

export default function CustodyWorkbenchScreen() {
  const colors = useColors();
  const router = useRouter();
  const { user } = useAuth();
  const { language } = useLanguage();
  const { width } = useWindowDimensions();
  const isWide = Platform.OS === "web" && width >= 860;
  const canConfigure = user?.role === "admin";
  const canCreate = canConfigure || (["manager", "supervisor"].includes(String(user?.role)) && accountBelongsToStage(user?.department, "production"));
  const [batches, setBatches] = useState<CustodyBatch[]>([]);
  const [settings, setSettings] = useState<CustodySettings | undefined>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selected, setSelected] = useState<WorkbenchRow | null>(null);
  const [actionTarget, setActionTarget] = useState<ActionTarget | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);
  const [allocations, setAllocations] = useState<CustodyAllocation[]>([]);
  const [directory, setDirectory] = useState<Partial<Record<CustodyStage, CustodyAccount[]>>>({});
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [busyOperation, setBusyOperation] = useState<string | null>(null);
  const [operationKeys, setOperationKeys] = useState<Record<string, string>>({});
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState<CustodySettings | null>(null);

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true); else setLoading(true);
    try {
      const [nextBatches, nextSettings] = await Promise.all([custodyService.list(), custodyService.settings()]);
      setBatches(nextBatches);
      setSettings(nextSettings);
      setNotice((previous) => previous?.tone === "error" ? previous : null);
    } catch (error) {
      setNotice(makeNotice("error", "تعذر تحميل العهد. حاول إعادة التحميل.", "Unable to load custody records. Please try again."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const rows = useMemo(() => selectWorkbenchRows(batches, user?.id, { search, status: statusFilter }), [batches, user?.id, search, statusFilter]);
  const counts = useMemo(() => selectWorkbenchCounts(batches, user?.id, settings), [batches, user?.id, settings]);
  const openAction = useCallback(async (row: WorkbenchRow, action: ActionKind) => {
    setNotice(null);
    setActionTarget({ row, action });
    setForm(EMPTY_FORM);
    setAttachments([]);
    const lot = rowLot(row);
    if (action === "send" && row.batch.purpose === "sale" && lot && (lot.stage === "antislip" || lot.stage === "inspection")) {
      const defaultStage = lot.stage === "antislip" ? "kawiya" : "packing";
      const defaultQuality = lot.quality === "second" || lot.quality === "suspected" ? "second" : "first";
      setAllocations([{ toStage: defaultStage, quality: defaultQuality, toUserId: 0, pairs: lot.pairs }]);
      await loadDirectory(lot.stage === "antislip" ? ["kawiya", "inspection"] : ["packing", "followup"]);
      return;
    }
    setAllocations([]);
    if (action === "rework") await loadDirectory(["production", "inspection"]);
    if (action === "send" && lot) {
      const destination = nextCustodyStage(lot.stage, row.batch.product.antiSlip, row.batch.purpose);
      if (destination) await loadDirectory([destination]);
    }
  }, [directory, user?.id]);

  const closeAction = () => {
    if (busyOperation) return;
    setActionTarget(null);
    setForm(EMPTY_FORM);
    setAttachments([]);
    setAllocations([]);
  };

  const loadDirectory = async (stages: CustodyStage[]) => {
    const missing = stages.filter((stage) => !directory[stage]);
    if (!missing.length) return;
    setDirectoryLoading(true);
    try {
      const accounts = await custodyService.accounts.list();
      setDirectory((previous) => {
        const next = { ...previous };
        for (const stage of missing) {
          next[stage] = accounts.filter((account) => account.id !== user?.id && accountMatchesStage(account, stage));
        }
        return next;
      });
    } catch (error) {
      setNotice(makeNotice("error", "تعذر تحميل المستلمين المفعّلين.", "Unable to load active recipients."));
    } finally {
      setDirectoryLoading(false);
    }
  };

  const executeAction = async () => {
    if (!actionTarget || !user?.id) return;
    const { row, action } = actionTarget;
    const batch = row.batch;
    const lot = rowLot(row);
    const transfer = rowTransfer(row);
    const expectedPairs = rowPairs(row);
    let actionInput: Omit<CustodyActionInput, "operationKey">;

    if (action === "receive") {
      const actualPairs = numberOrUndefined(form.actualPairs);
      if (actualPairs === undefined) return setNotice(makeNotice("error", "أدخل العدد الفعلي كاملاً بعد العد.", "Enter the complete actual count after counting."));
      if (actualPairs !== expectedPairs) return setNotice(makeNotice("error", `العدد الفعلي ${formatPairsFor(language, actualPairs)} لا يطابق النقل ${formatPairsFor(language, expectedPairs)}. استخدم «تسجيل اختلاف كمية».`, `The actual count of ${formatPairsFor(language, actualPairs)} does not match the transfer of ${formatPairsFor(language, expectedPairs)}. Use “Record quantity discrepancy”.`));
      actionInput = { batchId: batch.id, transferId: transfer?.id, action: "receive", actualPairs };
    } else if (action === "dispute") {
      const actualPairs = numberOrUndefined(form.actualPairs);
      if (actualPairs === undefined || !form.reason.trim()) return setNotice(makeNotice("error", "أدخل العدد الفعلي وسبب الاختلاف لإيقاف الحركة للمراجعة.", "Enter the actual count and discrepancy reason to stop the movement for review."));
      actionInput = { batchId: batch.id, transferId: transfer?.id, custodyId: lot?.id, action: "dispute", actualPairs, reason: form.reason.trim(), attachments };
    } else if (action === "reject") {
      if (!form.reason.trim()) return setNotice(makeNotice("error", "سبب الرفض مطلوب قبل إعادة النقل للمراجعة.", "A rejection reason is required before returning the transfer for review."));
      actionInput = { batchId: batch.id, transferId: transfer?.id, action: "reject", reason: form.reason.trim(), attachments };
    } else if (action === "pause") {
      if (!form.reason.trim()) return setNotice(makeNotice("error", "حدد سبب الإيقاف المؤقت.", "Specify the reason for the pause."));
      actionInput = { batchId: batch.id, custodyId: lot?.id, action: "pause", reason: form.reason.trim() };
    } else if (action === "progress") {
      const pairs = numberOrUndefined(form.pairs);
      if (pairs === undefined || !lot || pairs > lot.pairs || pairs < lot.progressPairs) return setNotice(makeNotice("error", `أدخل إنجازًا تراكميًا بين ${formatPairsFor(language, lot?.progressPairs ?? 0)} و${formatPairsFor(language, lot?.pairs ?? 0)}.`, `Enter cumulative progress between ${formatPairsFor(language, lot?.progressPairs ?? 0)} and ${formatPairsFor(language, lot?.pairs ?? 0)}.`));
      actionInput = { batchId: batch.id, custodyId: lot.id, action: "progress", pairs };
    } else if (action === "complete") {
      if (!lot || lot.progressPairs !== lot.pairs) return setNotice(makeNotice("error", `لا يمكن الإكمال قبل أن يساوي الإنجاز التراكمي كامل العهدة: ${formatPairsFor(language, lot?.pairs)}.`, `Completion is unavailable until cumulative progress equals the full custody: ${formatPairsFor(language, lot?.pairs)}.`));
      actionInput = { batchId: batch.id, custodyId: lot.id, action: "complete", pairs: lot.pairs };
    } else if (action === "send") {
      if (!lot) return;
      if (batch.purpose === "sale" && (lot.stage === "antislip" || lot.stage === "inspection")) {
        const validation = validateFullAllocations(lot.stage, lot.pairs, allocations);
        if (!validation.valid) return setNotice(makeNotice("error", validation.message || "توزيع الجودة غير مكتمل.", "The quality allocation is incomplete."));
        if (allocations.some((allocation) => allocation.toUserId === user.id)) return setNotice(makeNotice("error", "لا يمكن تسليم العهدة إلى الحساب نفسه.", "Custody cannot be handed over to the same account."));
        if (allocations.some(a => a.quality !== lot.quality) && !form.reason.trim()) return setNotice(makeNotice("error", "سبب تغيير تصنيف الجودة إلزامي", "A reason is required when changing the quality classification."));
        if (allocations.some(a => ["suspected", "damaged"].includes(a.quality)) && !form.defectType.trim()) return setNotice(makeNotice("error", "حدد نوع العيب أو الاشتباه", "Specify the defect or suspected issue type."));
        actionInput = { batchId: batch.id, custodyId: lot.id, action: "send", pairs: lot.pairs, allocations, reason: form.reason.trim() || undefined, defectType: form.defectType.trim() || undefined, defectCause: form.defectCause.trim() || undefined, attachments };
      } else {
        const destination = nextCustodyStage(lot.stage, batch.product.antiSlip, batch.purpose);
        const receiver = accountById(directory[destination || lot.stage] || [], form.receiverId);
        if (!destination || !receiver) return setNotice(makeNotice("error", "اختر مستلمًا مفعّلًا من القسم التالي.", "Select an active recipient from the next department."));
        if (receiver.id === user.id) return setNotice(makeNotice("error", "لا يمكن تسليم العهدة إلى الحساب نفسه.", "Custody cannot be handed over to the same account."));
        actionInput = { batchId: batch.id, custodyId: lot.id, action: "send", pairs: lot.pairs, allocations: [{ toStage: destination, toUserId: receiver.id, quality: lot.quality, pairs: lot.pairs }] };
      }
    } else if (action === "store") {
      const packagePairs = numberOrUndefined(form.packagePairs);
      if (!lot || batch.purpose !== "sale" || (lot.quality !== "first" && lot.quality !== "second")) return setNotice(makeNotice("error", "الإدخال النهائي متاح فقط لنخب البيع الأول أو الثاني.", "Final entry is available only for first- or second-grade sale lots."));
      if (!form.barcode.trim() || packagePairs === undefined || packagePairs <= 0) return setNotice(makeNotice("error", "أدخل الباركود وعدد الأزواج الصحيح داخل العبوة قبل الاعتماد النهائي.", "Enter the barcode and valid pairs per package before final approval."));
      actionInput = { batchId: batch.id, custodyId: lot.id, action: "store", barcode: form.barcode.trim(), packagePairs, pairs: lot.pairs, attachments };
    } else if (action === "approve_disposal") {
      if (!lot || !form.reason.trim()) return setNotice(makeNotice("error", "سبب اعتماد محضر الإتلاف مطلوب.", "A reason is required to approve the disposal record."));
      actionInput = { batchId: batch.id, custodyId: lot.id, action: "approve_disposal", pairs: lot.pairs, reason: form.reason.trim(), attachments };
    } else if (action === "execute_disposal") {
      if (!lot || !form.reason.trim() || !form.method.trim() || attachments.length === 0) return setNotice(makeNotice("error", "يتطلب التنفيذ السبب وطريقة التخلص وإثباتًا مرفقًا بعد الاعتماد المسجل.", "Execution requires a reason, disposal method, and attached proof after approval is recorded."));
      actionInput = { batchId: batch.id, custodyId: lot.id, action: "execute_disposal", pairs: lot.pairs, reason: form.reason.trim(), method: form.method.trim(), attachments };
    } else if (action === "deliver_sample") {
      if (!lot || !form.receiver.trim() || !form.method.trim() || !form.proof.trim()) return setNotice(makeNotice("error", "أدخل المستلم وطريقة التسليم والإثبات لتوثيق تسليم العينة.", "Enter the recipient, delivery method, and proof to document sample delivery."));
      actionInput = { batchId: batch.id, custodyId: lot.id, action: "deliver_sample", pairs: lot.pairs, receiver: form.receiver.trim(), method: form.method.trim(), proof: form.proof.trim(), attachments };
    } else if (action === "rework") {
      if (!lot || !form.reason.trim() || !form.receiverId) return setNotice(makeNotice("error", "حدد سبب القرار والقسم والمستلم لإعادة معالجة كامل العهدة", "Specify the decision reason, department, and recipient to rework the full custody."));
      actionInput = {batchId:batch.id,custodyId:lot.id,action,reason:form.reason.trim(),attachments,allocations:[{toStage:form.reworkStage,toUserId:Number(form.receiverId),quality:lot.quality,pairs:lot.pairs}]};
    } else if (action === "resolve") {
      if (!form.reason.trim()) return setNotice(makeNotice("error", "السبب والتوثيق مطلوبان قبل هذا الإجراء الإشرافي.", "Reason and documentation are required before this supervisory action."));
      actionInput = { batchId: batch.id, custodyId: lot?.id, transferId: transfer?.id, action, reason: form.reason.trim(), attachments };
    } else {
      actionInput = { batchId: batch.id, custodyId: lot?.id, action };
    }

    const scopeId = `${user.id}:${action}:${batch.id}:${lot?.id || transfer?.id || "batch"}`;
    const operationKey = operationKeys[scopeId] || createCustodyOperationKey();
    if (!operationKeys[scopeId]) setOperationKeys((previous) => ({ ...previous, [scopeId]: operationKey }));
    setBusyOperation(scopeId);
    try {
      const result = await custodyService.act({ ...actionInput, operationKey });
      setOperationKeys((previous) => {
        const next = { ...previous };
        delete next[scopeId];
        return next;
      });
      setNotice(result.replayed ? makeNotice("success", "تم تنفيذ الإجراء مسبقًا دون تكرار.", "The action was already completed without duplication.") : makeNotice("success", "تم تأكيد الإجراء من الخادم وتحديث سجل العهد.", "The server confirmed the action and updated the custody record."));
      setActionTarget(null); setSelected(null); setForm(EMPTY_FORM); setAttachments([]); setAllocations([]);
      await load(true);
    } catch (error) {
      setNotice(makeNotice("error", "لم يؤكد الخادم تنفيذ الإجراء. يمكنك المحاولة بالمفتاح نفسه.", "The server did not confirm the action. You can retry with the same key."));
    } finally {
      setBusyOperation(null);
    }
  };

  const openSettings = () => {
    if (!settings) return;
    setSettingsDraft({
      ...settings,
      stageLimits: { ...settings.stageLimits },
      shifts: [...settings.shifts],
      holidays: [...settings.holidays],
    });
    setSettingsOpen(true);
  };

  const saveSettings = async () => {
    if (!settingsDraft) return;
    setBusyOperation("settings");
    try {
      await custodyService.saveSettings(settingsDraft);
      setSettings(settingsDraft);
      setSettingsOpen(false);
      setNotice(makeNotice("success", "تم تأكيد حفظ إعدادات العهد من الخادم.", "The server confirmed that custody settings were saved."));
    } catch (error) {
      setNotice(makeNotice("error", "تعذر حفظ الإعدادات.", "Unable to save settings."));
    } finally {
      setBusyOperation(null);
    }
  };

  const updateStageLimit = (stage: CustodyStage, field: "workHours" | "confirmationHours", value: string) => {
    setSettingsDraft((previous) => {
      if (!previous) return previous;
      const parsed = value.trim() === "" ? undefined : Number(value);
      const current = previous.stageLimits[stage] || { workHours: 0, confirmationHours: 0 };
      const nextLimit = { ...current, [field]: Number.isFinite(parsed) && (parsed ?? 0) >= 0 ? parsed : current[field] };
      return { ...previous, stageLimits: { ...previous.stageLimits, [stage]: nextLimit } };
    });
  };

  const updateAllocation = (index: number, patch: Partial<CustodyAllocation>) => {
    setAllocations((previous) => previous.map((allocation, allocationIndex) => allocationIndex === index ? { ...allocation, ...patch } : allocation));
  };

  const actionBusy = !!actionTarget && !!busyOperation;
  const renderActions = (row: WorkbenchRow, compact = false) => {
    const actions = permittedActions(row, user?.role);
    if (!actions.length) return <Text style={[styles.noAction, textStyleFor(language)]}>{localize(language, "لا يوجد إجراء متاح", "No action available")}</Text>;
    return <View style={[styles.actionRow, rowStyleFor(language), compact && styles.actionRowCompact]}>{actions.map((action) => <TinyButton key={action} language={language} label={actionLabel(action, language)} icon={actionIcon(action)} tone={["dispute", "reject", "execute_disposal"].includes(action) ? "danger" : "primary"} onPress={() => void openAction(row, action)} disabled={!!busyOperation} />)}</View>;
  };

  const renderCard = ({ item }: { item: WorkbenchRow }) => {
    const batch = item.batch;
    const isIncoming = item.kind === "incoming";
    const isOutgoing = item.kind === "outgoing";
    const lot = rowLot(item);
    const transfer = rowTransfer(item);
    const flow = isIncoming ? localize(language, "وارد", "Incoming") : isOutgoing ? localize(language, "مسؤوليتي حتى التأكيد", "My responsibility until confirmation") : localize(language, "عهدتي", "My custody");
    const time = isIncoming ? localize(language, `أُرسل: ${formatRiyadhFor(language, transfer?.sentAt)}`, `Sent: ${formatRiyadhFor(language, transfer?.sentAt)}`) : lot?.receivedAt ? localize(language, `استُلم: ${formatRiyadhFor(language, lot.receivedAt)}`, `Received: ${formatRiyadhFor(language, lot.receivedAt)}`) : localize(language, `أُرسل: ${formatRiyadhFor(language, transfer?.sentAt)}`, `Sent: ${formatRiyadhFor(language, transfer?.sentAt)}`);
    return <TouchableOpacity activeOpacity={0.8} onPress={() => setSelected(item)} style={styles.card}>
      <View style={[styles.cardTop, rowStyleFor(language)]}><View style={[styles.cardBadges, rowStyleFor(language)]}><WorkbenchStatusPill status={rowStatus(item)} language={language} /><Text style={[styles.flowPill, isIncoming ? styles.incomingPill : isOutgoing ? styles.outgoingPill : styles.ownerPill, textStyleFor(language)]}>{flow}</Text></View><View style={[styles.cardTitleWrap, alignStyleFor(language)]}><Text style={[styles.cardTitle, textStyleFor(language)]} numberOfLines={1}>{batch.product.name}</Text><Text style={[styles.cardTracking, textStyleFor(language)]}>{batch.trackingNumber} · {batch.product.code}</Text></View></View>
      <View style={[styles.cardGrid, rowStyleFor(language)]}>
        <ReadonlyField language={language} label={localize(language, "القسم", "Department")} value={stageLabelFor(language, rowStage(item))} />
        <ReadonlyField language={language} label={localize(language, "الكمية", "Quantity")} value={formatPairsFor(language, rowPairs(item))} />
        <ReadonlyField language={language} label={localize(language, "المقاس / اللون", "Size / color")} value={`${batch.product.size} · ${batch.product.color}`} />
        <ReadonlyField language={language} label={localize(language, "النخب", "Quality")} value={qualityLabelFor(language, lot?.quality || transfer?.quality)} />
      </View>
      <View style={styles.cardFooter}><Text style={[styles.cardTime, textStyleFor(language)]}>{time}</Text>{renderActions(item, true)}</View>
    </TouchableOpacity>;
  };

  const renderWideTable = () => {
    const headings: [string, number][] = [
      [localize(language, "الدفعة", "Batch"), 150], [localize(language, "الصنف", "Item"), 190], [localize(language, "القسم / المسار", "Department / route"), 160], [localize(language, "النخب", "Quality"), 105], [localize(language, "الكمية", "Quantity"), 115], [localize(language, "الوقت", "Time"), 165], [localize(language, "الحالة", "Status"), 145], [localize(language, "الإجراء", "Action"), 260],
    ];
    return <ScrollView horizontal contentContainerStyle={styles.tableScroll}><View style={styles.table}>
      <View style={[styles.tableHeader, rowStyleFor(language), Platform.OS === "web" ? ({ position: "sticky", top: 0, zIndex: 2 } as any) : undefined]}>{headings.map(([label, minWidth]) => <Text key={label} style={[styles.th, textStyleFor(language), { minWidth }]}>{label}</Text>)}</View>
      {rows.map((row) => {
        const lot = rowLot(row); const transfer = rowTransfer(row);
        return <TouchableOpacity key={row.id} onPress={() => setSelected(row)} style={[styles.tableRow, rowStyleFor(language)]}>
          <Text style={[styles.td, textStyleFor(language), { minWidth: 150 }]}>{row.batch.trackingNumber}</Text>
          <View style={[styles.tdWrap, alignStyleFor(language), { minWidth: 190 }]}><Text style={[styles.tdStrong, textStyleFor(language)]}>{row.batch.product.name}</Text><Text style={[styles.tdMuted, textStyleFor(language)]}>{row.batch.product.code} · {row.batch.product.size}/{row.batch.product.color}</Text></View>
          <View style={[styles.tdWrap, alignStyleFor(language), { minWidth: 160 }]}><Text style={[styles.tdStrong, textStyleFor(language)]}>{stageLabelFor(language, rowStage(row))}</Text><Text style={[styles.tdMuted, textStyleFor(language)]}>{rowTitle(row, language)}</Text></View>
          <Text style={[styles.td, textStyleFor(language), { minWidth: 105 }]}>{qualityLabelFor(language, lot?.quality || transfer?.quality)}</Text>
          <Text style={[styles.td, textStyleFor(language), { minWidth: 115 }]}>{formatPairsFor(language, rowPairs(row))}</Text>
          <Text style={[styles.td, textStyleFor(language), { minWidth: 165 }]}>{formatRiyadhFor(language, lot?.receivedAt || transfer?.sentAt)}</Text>
          <View style={[styles.tdWrap, alignStyleFor(language), { minWidth: 145 }]}><WorkbenchStatusPill status={rowStatus(row)} language={language} /></View>
          <View style={[styles.tdWrap, alignStyleFor(language), { minWidth: 260 }]}>{renderActions(row, true)}</View>
        </TouchableOpacity>;
      })}
    </View></ScrollView>;
  };

  const shifts = [...new Set(batches.filter(batch => batch.custodies.some(lot => lot.ownerId === Number(user?.id) && !["closed", "stored", "destroyed"].includes(lot.status))).map(batch => batch.shift).filter(Boolean))].join(" / ") || localize(language, "غير مسجلة", "Not recorded");
  return <ScreenContainer edges={["top", "bottom", "left", "right"]} style={{ backgroundColor: colors.background }}>
    <View style={[styles.root, { direction: writingDirection(language) } as any]}>
      <View style={[styles.topBar, rowStyleFor(language)]}>
        <View style={styles.topBarActions}>
          <BackButton />
          <TouchableOpacity onPress={() => void load(true)} disabled={refreshing || loading} style={styles.iconButton} accessibilityLabel={localize(language, "إعادة تحميل العهد", "Reload custody records")}><MaterialIcons name="refresh" size={20} color="#fff" /></TouchableOpacity>
        </View>
        <View style={[styles.titleBlock, alignStyleFor(language)]}><Text style={[styles.title, textStyleFor(language)]}>{localize(language, "منضدة العهد", "Custody Workbench")}</Text><Text style={[styles.titleSub, textStyleFor(language)]}>{localize(language, "متابعة الاستلام والعمل والتسليم بكميات صحيحة", "Track receipt, work, and handover with accurate quantities")}</Text></View>
        <View style={[styles.profileBlock, alignStyleFor(language)]}><Text style={[styles.profileName, textStyleFor(language)]}>{user?.name || localize(language, "الحساب غير معروف", "Unknown account")} · {user?.username || "—"}</Text><Text style={[styles.profileSub, textStyleFor(language)]}>{departmentLabelFor(language, user?.department)} · {localize(language, "الورديات", "Shifts")}: {shifts}</Text></View>
      </View>

      <View style={[styles.navigationRow, rowStyleFor(language)]}>
        {canCreate ? <TinyButton language={language} label={localize(language, "دفعة جديدة", "New batch")} icon="add-box" tone="secondary" onPress={() => router.push("/custody-batch-entry" as never)} /> : null}
        <TinyButton language={language} label={localize(language, "تقارير العهد", "Custody reports")} icon="analytics" tone="secondary" onPress={() => router.push("/custody-reports" as never)} />
        {user?.role === "admin" ? <TinyButton language={language} label={localize(language, "مراجعة العهد السابقة", "Review legacy custody")} icon="history" tone="secondary" onPress={() => router.push("/custody-legacy-review" as never)} /> : null}
        {canConfigure ? <TinyButton language={language} label={localize(language, "إعدادات العهد", "Custody settings")} icon="tune" tone="secondary" onPress={openSettings} /> : null}
      </View>

      <View style={[styles.legacyNotice, rowStyleFor(language)]}>
        <View style={[styles.legacyNoticeText, alignStyleFor(language)]}><Text style={[styles.legacyNoticeTitle, textStyleFor(language)]}>{localize(language, "الدورة الجديدة للدفعات المسجلة بعد التحديث", "New workflow for batches registered after the update")}</Text><Text style={[styles.legacyNoticeBody, textStyleFor(language)]}>{localize(language, "العهد السابقة محفوظة في السجل التاريخي، ولا تنتقل تلقائيًا.", "Previous custody records are preserved in the historical register and are not migrated automatically.")}</Text></View>
        <View style={[styles.legacyNoticeActions, rowStyleFor(language)]}>
          <TinyButton language={language} label={localize(language, "السجل السابق", "Legacy register")} icon="history" tone="secondary" onPress={() => router.push("/my-custody?legacy=1" as never)} />
          <TinyButton language={language} label={localize(language, "المراحل السابقة", "Legacy stages")} icon="account-tree" tone="secondary" onPress={() => router.push("/manufacturing?legacy=1" as never)} />
          {canConfigure ? <TinyButton language={language} label={localize(language, "ترحيل افتتاحي", "Opening migration")} icon="published-with-changes" tone="secondary" onPress={() => router.push("/custody-legacy-import" as never)} /> : null}
        </View>
      </View>

      <View style={[styles.metricsWrap, rowStyleFor(language)]}>
        <HeaderMetric language={language} label={localize(language, "بانتظار استلامي", "Awaiting my receipt")} value={loading ? "—" : counts.pendingReceive} tone="blue" />
        <HeaderMetric language={language} label={localize(language, "مستلمة لديّ", "Held by me")} value={loading ? "—" : counts.held} tone="violet" />
        <HeaderMetric language={language} label={localize(language, "قيد العمل", "In progress")} value={loading ? "—" : counts.working} tone="green" />
        <HeaderMetric language={language} label={localize(language, "مكتملة بانتظار التسليم", "Completed — awaiting handover")} value={loading ? "—" : counts.completed} tone="amber" />
        <HeaderMetric language={language} label={localize(language, "مرسلة بانتظار التأكيد", "Sent — awaiting confirmation")} value={loading ? "—" : counts.sent} tone="blue" />
        <HeaderMetric language={language} label={localize(language, "متأخرة بسياسة مضبوطة", "Overdue under configured policy")} value={loading ? "—" : counts.overdue} tone="red" />
        <HeaderMetric language={language} label={localize(language, "اختلافات", "Discrepancies")} value={loading ? "—" : counts.disputed} tone="red" />
      </View>

      <View style={styles.content}>
        <WorkbenchMessageBanner notice={notice} language={language} onDismiss={() => setNotice(null)} />
        <View style={styles.filters}><View style={[styles.searchWrap, rowStyleFor(language)]}><MaterialIcons name="search" size={19} color="#64748b" /><TextInput value={search} onChangeText={setSearch} placeholder={localize(language, "ابحث برقم الدفعة أو الصنف", "Search by batch number or item")} placeholderTextColor="#64748b" style={[styles.searchInput, textStyleFor(language)]} textAlign={textAlignFor(language)} returnKeyType="search" /></View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.filterChips, rowStyleFor(language)]}>{statusFilters(language).map(([value, label]) => <TouchableOpacity key={value} onPress={() => setStatusFilter(value)} style={[styles.filterChip, statusFilter === value && styles.filterChipActive]}><Text style={[styles.filterChipText, textStyleFor(language), statusFilter === value && styles.filterChipTextActive]}>{label}</Text></TouchableOpacity>)}</ScrollView></View>

        {loading ? <View style={styles.loadingState}><ActivityIndicator size="large" color="#075985" /><Text style={[styles.loadingText, textStyleFor(language)]}>{localize(language, "جارٍ تحميل سجل العهد من الخادم…", "Loading custody records from the server…")}</Text></View> : rows.length === 0 ? <View style={styles.emptyState}><MaterialIcons name="inventory-2" size={36} color="#0f766e" /><Text style={[styles.emptyTitle, textStyleFor(language)]}>{localize(language, "لا توجد عهد أو تحويلات مطابقة", "No matching custody records or transfers")}</Text><Text style={[styles.emptyText, textStyleFor(language)]}>{localize(language, "لا نعتمد أرقامًا افتراضية. أعد التحميل عند وصول حركة جديدة أو غيّر التصفية.", "We do not use default numbers. Reload when a new movement arrives or change the filter.")}</Text></View> : isWide ? renderWideTable() : <FlatList data={rows} renderItem={renderCard} keyExtractor={(item) => item.id} contentContainerStyle={styles.cardsList} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />} />}
      </View>
    </View>

    <DetailModal language={language} selected={selected} userRole={user?.role} onClose={() => setSelected(null)} onAction={(action) => selected && void openAction(selected, action)} />
    <ActionModal language={language} notice={notice} target={actionTarget} userId={user?.id} directory={directory} directoryLoading={directoryLoading} form={form} attachments={attachments} allocations={allocations} busy={actionBusy} onChangeForm={(patch) => setForm((previous) => ({ ...previous, ...patch }))} onChangeAttachments={setAttachments} onChangeAllocation={updateAllocation} onAddAllocation={() => { const lot = actionTarget ? rowLot(actionTarget.row) : undefined; if (!lot) return; const toStage = lot.stage === "antislip" ? "kawiya" : "packing"; setAllocations((previous) => [...previous, { toStage, quality: lot.quality === "second" || lot.quality === "suspected" ? "second" : "first", toUserId: 0, pairs: 0 }]); }} onRemoveAllocation={(index) => setAllocations((previous) => previous.filter((_, allocationIndex) => allocationIndex !== index))} onClose={closeAction} onSubmit={() => void executeAction()} />
    <SettingsModal language={language} draft={settingsDraft} visible={settingsOpen} busy={busyOperation === "settings"} onClose={() => setSettingsOpen(false)} onToggleEnabled={(enabled) => setSettingsDraft((previous) => previous ? { ...previous, enabled } : previous)} onChangeLimit={updateStageLimit} onSave={() => void saveSettings()} />
  </ScreenContainer>;
}

function DetailModal({ language, selected, userRole, onClose, onAction }: { language: "ar" | "en"; selected: WorkbenchRow | null; userRole?: string; onClose: () => void; onAction: (action: ActionKind) => void }) {
  if (!selected) return null;
  const batch = selected.batch;
  const lot = rowLot(selected);
  const transfer = rowTransfer(selected);
  const relevantCustodyId = lot?.id || transfer?.destinationCustodyId || transfer?.sourceCustodyId;
  const actions = permittedActions(selected, userRole);
  const transferItems = batch.transfers.filter((item) => item.sourceCustodyId === relevantCustodyId || item.destinationCustodyId === relevantCustodyId || item.id === transfer?.id);
  const sessionItems = batch.sessions.filter((session) => session.custodyId === relevantCustodyId);
  const progressItems = batch.progress.filter((item) => item.custodyId === relevantCustodyId);
  return <Modal visible transparent animationType="slide" onRequestClose={onClose}><View style={styles.modalOverlay}><View style={styles.detailPanel}>
    <View style={[styles.modalHeader, rowStyleFor(language)]}><TouchableOpacity onPress={onClose} style={styles.closeButton}><MaterialIcons name="close" size={20} color="#334155" /></TouchableOpacity><View style={[styles.modalTitleWrap, alignStyleFor(language)]}><Text style={[styles.modalTitle, textStyleFor(language)]}>{rowTitle(selected, language)}</Text><Text style={[styles.modalSubtitle, textStyleFor(language)]}>{batch.trackingNumber} · {formatPairsFor(language, rowPairs(selected))}</Text></View></View>
    <ScrollView contentContainerStyle={styles.modalBody}>
      <Text style={[styles.sectionTitle, textStyleFor(language)]}>{localize(language, "بيانات المنتج — للقراءة فقط", "Product data — read only")}</Text>
      <View style={[styles.productGrid, rowStyleFor(language)]}><ReadonlyField language={language} label={localize(language, "رمز الصنف", "Item code")} value={batch.product.code} /><ReadonlyField language={language} label={localize(language, "الصنف", "Item")} value={batch.product.name} /><ReadonlyField language={language} label={localize(language, "المقاس / اللون", "Size / color")} value={`${batch.product.size} · ${batch.product.color}`} /><ReadonlyField language={language} label={localize(language, "مانع الانزلاق", "Anti-slip")} value={batch.product.antiSlip ? localize(language, "نعم", "Yes") : localize(language, "لا", "No")} /><ReadonlyField language={language} label={localize(language, "الغرض", "Purpose")} value={batch.purpose === "sale" ? localize(language, "بيع", "Sale") : localize(language, "عينة", "Sample")} /><ReadonlyField language={language} label={localize(language, "الإنتاج", "Production")} value={`${batch.productionDate} · ${batch.machineNumber}`} /></View>
      <Text style={[styles.yarnText, textStyleFor(language)]}>{localize(language, "الخيوط", "Yarns")}: {batch.product.yarns.length ? batch.product.yarns.map((yarn) => `${yarn.name} ${yarn.percentage}%`).join(localize(language, "، ", ", ")) : localize(language, "غير مسجلة", "Not recorded")} · {localize(language, "وزن الخيط", "Yarn weight")} {batch.product.yarnWeightGrams}{localize(language, "غ", " g")} · {localize(language, "وزن الزوج", "Pair weight")} {batch.product.pairWeightGrams}{localize(language, "غ", " g")}</Text>

      <Text style={[styles.sectionTitle, textStyleFor(language)]}>{localize(language, "النقل والمسؤولية", "Transfer and responsibility")}</Text>
      {transferItems.length ? transferItems.map((item) => <View key={item.id} style={[styles.timelineRow, rowStyleFor(language)]}><WorkbenchStatusPill status={item.status} language={language} /><View style={[styles.timelineText, alignStyleFor(language)]}><Text style={[styles.timelineStrong, textStyleFor(language)]}>{item.fromName} {isEnglish(language) ? "→" : "←"} {item.toName}</Text><Text style={[styles.timelineSub, textStyleFor(language)]}>{stageLabelFor(language, item.fromStage)} {isEnglish(language) ? "→" : "←"} {stageLabelFor(language, item.toStage)} · {formatPairsFor(language, item.pairs)} · {localize(language, "أرسل", "Sent")} {formatRiyadhFor(language, item.sentAt)}</Text>{item.reason ? <Text style={[styles.reasonText, textStyleFor(language)]}>{localize(language, "السبب", "Reason")}: {item.reason}</Text> : null}</View></View>) : <Text style={[styles.mutedText, textStyleFor(language)]}>{localize(language, "لا توجد حركة مرتبطة بهذه العهدة بعد.", "There is no movement associated with this custody yet.")}</Text>}

      <Text style={[styles.sectionTitle, textStyleFor(language)]}>{localize(language, "جلسات العمل والتقدم", "Work sessions and progress")}</Text>
      {lot ? <View style={[styles.progressSummary, rowStyleFor(language)]}><ReadonlyField language={language} label={localize(language, "الإنجاز التراكمي", "Cumulative progress")} value={`${formatPairsFor(language, lot.progressPairs)} ${localize(language, "من", "of")} ${formatPairsFor(language, lot.pairs)}`} /><ReadonlyField language={language} label={localize(language, "وقت الاستلام", "Receipt time")} value={formatRiyadhFor(language, lot.receivedAt)} /><ReadonlyField language={language} label={localize(language, "بدأ العمل", "Work started")} value={formatRiyadhFor(language, lot.startedAt)} /><ReadonlyField language={language} label={localize(language, "اكتمل", "Completed")} value={formatRiyadhFor(language, lot.completedAt)} /></View> : null}
      {sessionItems.map((session) => <View key={session.id} style={[styles.eventRow, rowStyleFor(language)]}><Text style={[styles.eventBadge, textStyleFor(language)]}>{session.kind === "work" ? localize(language, "عمل", "Work") : localize(language, "توقف", "Pause")}</Text><Text style={[styles.eventText, textStyleFor(language)]}>{formatRiyadhFor(language, session.startedAt)} {session.endedAt ? `— ${formatRiyadhFor(language, session.endedAt)}` : localize(language, "— مستمرة", "— Ongoing")}{session.reason ? ` · ${session.reason}` : ""}</Text></View>)}
      {progressItems.map((item) => <View key={item.id} style={[styles.eventRow, rowStyleFor(language)]}><Text style={[styles.eventBadge, textStyleFor(language)]}>{localize(language, "تقدم", "Progress")}</Text><Text style={[styles.eventText, textStyleFor(language)]}>{formatPairsFor(language, item.pairs)} · {formatRiyadhFor(language, item.recordedAt)}</Text></View>)}
      {!sessionItems.length && !progressItems.length ? <Text style={[styles.mutedText, textStyleFor(language)]}>{localize(language, "لا توجد جلسات أو قراءات تقدم مسجلة.", "No work sessions or progress readings are recorded.")}</Text> : null}

      <Text style={[styles.sectionTitle, textStyleFor(language)]}>{localize(language, "سجل المراجعة", "Audit log")}</Text>
      {batch.events.filter((event) => !relevantCustodyId || event.custodyId === relevantCustodyId).slice().reverse().map((event) => <View key={event.id} style={[styles.eventRow, rowStyleFor(language)]}><Text style={[styles.eventBadge, textStyleFor(language)]}>{actionLabel(event.action as ActionKind, language)}</Text><Text style={[styles.eventText, textStyleFor(language)]}>{event.actorName} · {formatRiyadhFor(language, event.at)}{event.pairs !== undefined ? ` · ${formatPairsFor(language, event.pairs)}` : ""}{event.reason ? ` · ${event.reason}` : ""}</Text></View>)}

      {actions.length ? <><Text style={[styles.sectionTitle, textStyleFor(language)]}>{localize(language, "الإجراءات المسموحة", "Allowed actions")}</Text><View style={[styles.detailActions, rowStyleFor(language)]}>{actions.map((action) => <TinyButton key={action} language={language} label={actionLabel(action, language)} icon={actionIcon(action)} tone={["dispute", "reject", "execute_disposal"].includes(action) ? "danger" : "primary"} onPress={() => { onClose(); onAction(action); }} />)}</View></> : null}
    </ScrollView>
  </View></View></Modal>;
}

function ActionModal({ language, notice: currentNotice, target, userId, directory, directoryLoading, form, attachments, allocations, busy, onChangeForm, onChangeAttachments, onChangeAllocation, onAddAllocation, onRemoveAllocation, onClose, onSubmit }: { language: "ar" | "en"; notice: Notice; target: ActionTarget | null; userId?: number; directory: Partial<Record<CustodyStage, CustodyAccount[]>>; directoryLoading: boolean; form: FormState; attachments: AttachmentFile[]; allocations: CustodyAllocation[]; busy: boolean; onChangeForm: (patch: Partial<FormState>) => void; onChangeAttachments: (items: AttachmentFile[]) => void; onChangeAllocation: (index: number, patch: Partial<CustodyAllocation>) => void; onAddAllocation: () => void; onRemoveAllocation: (index: number) => void; onClose: () => void; onSubmit: () => void }) {
  if (!target) return null;
  const { row, action } = target;
  const lot = rowLot(row);
  const fullPairs = rowPairs(row);
  const requiresReason = ["pause", "dispute", "reject", "approve_disposal", "execute_disposal", "resolve", "rework"].includes(action) || (action === "send" && row.batch.purpose === "sale" && !!lot && ["inspection", "antislip"].includes(lot.stage));
  const splitAllocation = action === "send" && row.batch.purpose === "sale" && !!lot && (lot.stage === "antislip" || lot.stage === "inspection");
  const simpleDestination = action === "send" && lot && !splitAllocation ? nextCustodyStage(lot.stage, row.batch.product.antiSlip, row.batch.purpose) : undefined;
  const accounts = simpleDestination ? directory[simpleDestination] || [] : [];
  const allocationTotal = allocations.reduce((sum, allocation) => sum + (Number.isInteger(allocation.pairs) ? allocation.pairs : 0), 0);
  const title = actionLabel(action, language);
  return <Modal visible transparent animationType="slide" onRequestClose={onClose}><View style={styles.modalOverlay}><View style={styles.actionPanel}>
    <View style={[styles.modalHeader, rowStyleFor(language)]}><TouchableOpacity onPress={onClose} disabled={busy} style={styles.closeButton}><MaterialIcons name="close" size={20} color="#334155" /></TouchableOpacity><View style={[styles.modalTitleWrap, alignStyleFor(language)]}><Text style={[styles.modalTitle, textStyleFor(language)]}>{title}</Text><Text style={[styles.modalSubtitle, textStyleFor(language)]}>{row.batch.trackingNumber} · {localize(language, "الكمية الكاملة", "Full quantity")} {formatPairsFor(language, fullPairs)}</Text></View></View>
    <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
      <WorkbenchMessageBanner notice={currentNotice} language={language} />
      {action === "receive" ? <><Text style={[styles.actionHint, textStyleFor(language)]}>{localize(language, "بعد عد كامل النقل، أدخل العدد الفعلي. عند التطابق فقط يتم تأكيد الاستلام.", "After counting the full transfer, enter the actual quantity. Receipt is confirmed only when they match.")}</Text><Input language={language} label={localize(language, "العدد الفعلي بالأزواج", "Actual count in pairs")} value={form.actualPairs} onChangeText={(actualPairs) => onChangeForm({ actualPairs })} keyboardType="numeric" placeholder={localize(language, `المتوقع ${fullPairs}`, `Expected ${fullPairs}`)} /></> : null}
      {action === "dispute" || action === "reject" ? <><Text style={[styles.actionHint, textStyleFor(language)]}>{localize(language, "سيُجمّد النقل للمراجعة، ولا يُعدّل رصيدًا أو كمية إنتاج تلقائيًا.", "The transfer will be frozen for review and will not automatically change balances or production quantity.")}</Text><Input language={language} label={localize(language, "العدد الفعلي بالأزواج", "Actual count in pairs")} value={form.actualPairs} onChangeText={(actualPairs) => onChangeForm({ actualPairs })} keyboardType="numeric" placeholder={localize(language, `المنقول ${fullPairs}`, `Transferred ${fullPairs}`)} /></> : null}
      {action === "progress" ? <><Text style={[styles.actionHint, textStyleFor(language)]}>{localize(language, "هذا تسجيل تراكمي للإنجاز ولا ينقل أي جزء من العهدة.", "This records cumulative progress and does not transfer any part of the custody.")}</Text><Input language={language} label={localize(language, "الإنجاز التراكمي بالأزواج", "Cumulative progress in pairs")} value={form.pairs} onChangeText={(pairs) => onChangeForm({ pairs })} keyboardType="numeric" placeholder={localize(language, `من 0 إلى ${fullPairs}`, `From 0 to ${fullPairs}`)} /></> : null}
      {action === "complete" ? <Text style={[styles.actionHint, textStyleFor(language)]}>{localize(language, `لا يؤكد الخادم الإكمال إلا إذا كان التقدم المسجل يساوي كامل العهدة: ${formatPairsFor(language, fullPairs)}.`, `The server confirms completion only when recorded progress equals the full custody: ${formatPairsFor(language, fullPairs)}.`)}</Text> : null}
      {action === "start" || action === "resume" ? <Text style={[styles.actionHint, textStyleFor(language)]}>{localize(language, "سيُسجل وقت الخادم عند بدء/استئناف العمل. لا تُنشأ أي أوقات من الجهاز.", "The server time is recorded when work starts or resumes. No device times are created.")}</Text> : null}
      {action === "send" && simpleDestination ? <><Text style={[styles.actionHint, textStyleFor(language)]}>{localize(language, `التسليم كامل فقط إلى ${stageLabelFor(language, simpleDestination)}. تبقى المسؤولية على المرسل حتى يؤكد المستلم الاستلام.`, `The full custody can only be handed over to ${stageLabelFor(language, simpleDestination)}. Responsibility remains with the sender until the recipient confirms receipt.`)}</Text>{directoryLoading ? <ActivityIndicator color="#075985" /> : <AccountChooser language={language} accounts={accounts} selectedId={form.receiverId} onSelect={(receiverId) => onChangeForm({ receiverId })} empty={localize(language, "لا توجد حسابات مفعّلة ظاهرة في هذا القسم.", "No active accounts are visible in this department.")} />}</> : null}
      {splitAllocation ? <><Text style={[styles.actionHint, textStyleFor(language)]}>{localize(language, "يجب أن يساوي مجموع توزيعات الجودة كامل العهدة قبل الإرسال. لا يتم حفظ أي جزء منفردًا.", "The sum of quality allocations must equal the full custody before sending. No separate part is saved.")}</Text><View style={[styles.allocationSum, rowStyleFor(language)]}><Text style={[styles.allocationSumText, textStyleFor(language)]}>{localize(language, "مجموع التوزيع", "Allocation total")}: {formatPairsFor(language, allocationTotal)} {localize(language, "من", "of")} {formatPairsFor(language, fullPairs)}</Text><Text style={[styles.allocationSumText, textStyleFor(language), allocationTotal === fullPairs ? styles.validText : styles.invalidText]}>{allocationTotal === fullPairs ? localize(language, "مكتمل", "Complete") : localize(language, "غير مكتمل", "Incomplete")}</Text></View>{allocations.map((allocation, index) => <AllocationEditor language={language} key={`${index}:${allocation.toStage}:${allocation.quality}`} sourceStage={lot!.stage} sourceQuality={lot!.quality} allocation={allocation} index={index} accounts={directory[allocation.toStage] || []} currentUserId={userId} onChange={onChangeAllocation} onRemove={() => onRemoveAllocation(index)} />)}<TinyButton language={language} label={localize(language, "إضافة توزيع", "Add allocation")} tone="secondary" icon="add" onPress={onAddAllocation} /></> : null}
      {splitAllocation && allocations.some(a => ["suspected", "damaged"].includes(a.quality)) ? <><Input language={language} label={localize(language, "نوع العيب أو الاشتباه", "Defect or suspected issue type")} value={form.defectType} onChangeText={defectType => onChangeForm({ defectType })}/><Input language={language} label={localize(language, "السبب المحتمل — لا يحدد مسؤولية الموظف تلقائيًا", "Possible cause — does not automatically assign employee responsibility")} value={form.defectCause} onChangeText={defectCause => onChangeForm({ defectCause })}/></> : null}
      {action === "rework" ? <><View style={[styles.choiceRow, rowStyleFor(language)]}>{(["inspection", "production"] as CustodyStage[]).map(reworkStage => <TinyButton language={language} key={reworkStage} label={stageLabelFor(language, reworkStage)} onPress={() => onChangeForm({ reworkStage, receiverId: "" })}/>)}</View><AccountChooser language={language} accounts={directory[form.reworkStage] || []} selectedId={form.receiverId} onSelect={receiverId => onChangeForm({ receiverId })} empty={localize(language, "لا يوجد مستلم مفعّل في القسم", "No active recipient is available in the department")} /></> : null}
      {action === "store" ? <><Text style={[styles.actionHint, textStyleFor(language)]}>{localize(language, "الاستلام في المخازن لا يزيد المخزون. الاعتماد النهائي هو الذي يطلب الباركود وعدد أزواج العبوة للنخب المسموح بها للبيع.", "Receipt in storage does not increase inventory. Final approval requires a barcode and pairs per package for quality grades allowed for sale.")}</Text><Input language={language} label={localize(language, "باركود المخزون", "Inventory barcode")} value={form.barcode} onChangeText={(barcode) => onChangeForm({ barcode })} placeholder={localize(language, "امسح أو أدخل الباركود", "Scan or enter the barcode")} /><Input language={language} label={localize(language, "عدد الأزواج داخل العبوة", "Pairs per package")} value={form.packagePairs} onChangeText={(packagePairs) => onChangeForm({ packagePairs })} keyboardType="numeric" placeholder="0" /></> : null}
      {action === "deliver_sample" ? <><Text style={[styles.actionHint, textStyleFor(language)]}>{localize(language, "توثيق التسليم لا يدخل العينة تلقائيًا في مخزون البيع.", "Documenting delivery does not automatically add the sample to sale inventory.")}</Text><Input language={language} label={localize(language, "اسم مستلم العينة", "Sample recipient name")} value={form.receiver} onChangeText={(receiver) => onChangeForm({ receiver })} placeholder={localize(language, "الاسم أو الجهة", "Name or organization")} /><Input language={language} label={localize(language, "طريقة التسليم", "Delivery method")} value={form.method} onChangeText={(method) => onChangeForm({ method })} placeholder={localize(language, "يدوي، شحن، رابط موثق…", "Hand delivery, shipping, documented link…")} /><Input language={language} label={localize(language, "الإثبات", "Proof")} value={form.proof} onChangeText={(proof) => onChangeForm({ proof })} placeholder={localize(language, "رقم إيصال أو وصف إثبات التسليم", "Receipt number or delivery-proof description")} /></> : null}
      {action === "execute_disposal" ? <Input language={language} label={localize(language, "طريقة التخلص", "Disposal method")} value={form.method} onChangeText={(method) => onChangeForm({ method })} placeholder={localize(language, "مثال: إتلاف معتمد", "Example: approved destruction")} /> : null}
      {requiresReason ? <Input language={language} label={action === "pause" ? localize(language, "سبب الإيقاف", "Pause reason") : localize(language, "السبب والتوثيق", "Reason and documentation")} value={form.reason} onChangeText={(reason) => onChangeForm({ reason })} multiline placeholder={localize(language, "اكتب سببًا واضحًا", "Write a clear reason")} /> : null}
      {["dispute", "reject", "approve_disposal", "execute_disposal", "deliver_sample", "resolve", "rework", "store", "send"].includes(action) ? <AttachmentPicker attachments={attachments} onAttachmentsChange={onChangeAttachments} language={language} /> : null}
      {action === "approve_disposal" ? <Text style={[styles.actionHint, textStyleFor(language)]}>{localize(language, "بعد الاعتماد لا يعد الإتلاف منفذًا؛ يلزم إجراء تنفيذ مستقل مع الطريقة والإثبات.", "After approval, disposal is not considered executed; a separate execution action with method and proof is required.")}</Text> : null}
      <TouchableOpacity onPress={onSubmit} disabled={busy || directoryLoading} style={[styles.submitButton, rowStyleFor(language), (busy || directoryLoading) && styles.disabledButton]}>{busy ? <WorkbenchBusyLabel language={language} /> : <><MaterialIcons name={actionIcon(action)} color="#fff" size={19} /><Text style={[styles.submitText, textStyleFor(language)]}>{title}</Text></>}</TouchableOpacity>
    </ScrollView>
  </View></View></Modal>;
}

function AllocationEditor({ language, sourceStage, sourceQuality, allocation, index, accounts, currentUserId, onChange, onRemove }: { language: "ar" | "en"; sourceStage: CustodyStage; sourceQuality: string; allocation: CustodyAllocation; index: number; accounts: CustodyAccount[]; currentUserId?: number; onChange: (index: number, patch: Partial<CustodyAllocation>) => void; onRemove: () => void }) {
  const allOptions = sourceStage === "antislip" ? [{ quality: "first" as const, toStage: "kawiya" as const }, { quality: "second" as const, toStage: "kawiya" as const }, { quality: "suspected" as const, toStage: "inspection" as const }] : [{ quality: "first" as const, toStage: "packing" as const }, { quality: "second" as const, toStage: "packing" as const }, { quality: "damaged" as const, toStage: "followup" as const }];
  const options = allOptions.filter(o => sourceStage === "antislip" ? o.quality === sourceQuality || o.quality === "suspected" : sourceQuality === "suspected" ? o.quality !== "first" : true);
  return <View style={styles.allocationCard}><View style={[styles.allocationHeader, rowStyleFor(language)]}><TouchableOpacity onPress={onRemove} style={styles.removeAllocation}><MaterialIcons name="close" size={17} color="#be123c" /></TouchableOpacity><Text style={[styles.allocationTitle, textStyleFor(language)]}>{localize(language, "توزيع", "Allocation")} {index + 1}</Text></View><Text style={[styles.inputLabel, textStyleFor(language)]}>{localize(language, "الجودة والوجهة", "Quality and destination")}</Text><View style={[styles.choiceRow, rowStyleFor(language)]}>{options.map((option) => <TouchableOpacity key={option.quality} onPress={() => onChange(index, { quality: option.quality, toStage: option.toStage, toUserId: 0 })} style={[styles.choice, allocation.quality === option.quality && allocation.toStage === option.toStage && styles.choiceActive]}><Text style={[styles.choiceText, textStyleFor(language), allocation.quality === option.quality && styles.choiceTextActive]}>{qualityLabelFor(language, option.quality)} {isEnglish(language) ? "→" : "←"} {stageLabelFor(language, option.toStage)}</Text></TouchableOpacity>)}</View><Input language={language} label={localize(language, "الكمية بالأزواج", "Quantity in pairs")} value={allocation.pairs ? String(allocation.pairs) : ""} onChangeText={(value) => onChange(index, { pairs: Number.isInteger(Number(value)) ? Number(value) : 0 })} keyboardType="numeric" placeholder="0" compact /><Text style={[styles.inputLabel, textStyleFor(language)]}>{localize(language, "المستلم المفعّل", "Active recipient")} — {stageLabelFor(language, allocation.toStage)}</Text><AccountChooser language={language} accounts={accounts.filter((account) => account.id !== currentUserId)} selectedId={allocation.toUserId ? String(allocation.toUserId) : ""} onSelect={(value) => onChange(index, { toUserId: Number(value) })} empty={localize(language, "حمّل القسم أو لا يوجد مستلم متاح.", "Load the department or no recipient is available.")} />{!isAllocationAllowed(sourceStage, allocation) ? <Text style={[styles.validationText, textStyleFor(language)]}>{localize(language, "هذه الوجهة غير مسموحة لهذا التصنيف.", "This destination is not allowed for this classification.")}</Text> : null}</View>;
}

function AccountChooser({ language, accounts, selectedId, onSelect, empty }: { language: "ar" | "en"; accounts: CustodyAccount[]; selectedId: string; onSelect: (id: string) => void; empty: string }) {
  if (!accounts.length) return <Text style={[styles.mutedText, textStyleFor(language)]}>{empty}</Text>;
  return <View style={styles.accountList}>{accounts.map((account) => <TouchableOpacity key={account.id} onPress={() => onSelect(String(account.id))} style={[styles.accountChoice, rowStyleFor(language), selectedId === String(account.id) && styles.accountChoiceActive]}><Text style={[styles.accountChoiceText, textStyleFor(language), selectedId === String(account.id) && styles.accountChoiceTextActive]}>{account.name} · {departmentLabelFor(language, account.department)}</Text><Text style={[styles.accountRole, textStyleFor(language), selectedId === String(account.id) && styles.accountChoiceTextActive]}>{account.role}</Text></TouchableOpacity>)}</View>;
}

function Input({ language, label, value, onChangeText, placeholder, keyboardType, multiline, compact }: { language: "ar" | "en"; label: string; value: string; onChangeText: (value: string) => void; placeholder?: string; keyboardType?: "default" | "numeric"; multiline?: boolean; compact?: boolean }) {
  return <View style={[styles.inputBlock, compact && styles.inputBlockCompact]}><Text style={[styles.inputLabel, textStyleFor(language)]}>{label}</Text><TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#94a3b8" keyboardType={keyboardType} multiline={multiline} textAlign={textAlignFor(language)} style={[styles.input, textStyleFor(language), multiline && styles.textarea]} /></View>;
}

function SettingsModal({ language, draft, visible, busy, onClose, onToggleEnabled, onChangeLimit, onSave }: { language: "ar" | "en"; draft: CustodySettings | null; visible: boolean; busy: boolean; onClose: () => void; onToggleEnabled: (enabled: boolean) => void; onChangeLimit: (stage: CustodyStage, field: "workHours" | "confirmationHours", value: string) => void; onSave: () => void }) {
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}><View style={styles.modalOverlay}><View style={styles.settingsPanel}>
    <View style={[styles.modalHeader, rowStyleFor(language)]}><TouchableOpacity disabled={busy} onPress={onClose} style={styles.closeButton}><MaterialIcons name="close" size={20} color="#334155" /></TouchableOpacity><View style={[styles.modalTitleWrap, alignStyleFor(language)]}><Text style={[styles.modalTitle, textStyleFor(language)]}>{localize(language, "إعدادات العهد", "Custody settings")}</Text><Text style={[styles.modalSubtitle, textStyleFor(language)]}>{localize(language, "حدود التأخر من سياسة الخادم — لا تُفترض أوقات ورديات", "Overdue limits come from server policy — no shift times are assumed")}</Text></View></View>
    {draft ? <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
      <View style={[styles.settingsEnabled, rowStyleFor(language)]}><View><Text style={[styles.settingsEnabledTitle, textStyleFor(language)]}>{localize(language, "تمكين تنبيهات التأخير بعد النشر", "Enable overdue alerts after publishing")}</Text><Text style={[styles.mutedText, textStyleFor(language)]}>{localize(language, "يتطلب النشر وربط المجدول؛ إيقافه لا يحذف أي حركة.", "Publishing and scheduler wiring are required; turning it off does not delete any movement.")}</Text></View><Switch value={draft.enabled} onValueChange={onToggleEnabled} disabled={busy} trackColor={{ false: "#cbd5e1", true: "#7dd3fc" }} thumbColor={draft.enabled ? "#075985" : "#f8fafc"} /></View>
      <Text style={[styles.actionHint, textStyleFor(language)]}>{localize(language, "يظهر المتأخر فقط حين يُدخل حد عمل أو حد تأكيد موجب لهذه المرحلة. الوردية والإجازات تبقى كما أعادها الخادم.", "An item is overdue only when a positive work or confirmation limit is entered for its stage. Shifts and holidays remain as returned by the server.")}</Text>
      {CUSTODY_STAGES.map((stage) => { const limit = draft.stageLimits[stage]; return <View key={stage} style={styles.stageLimitRow}><Text style={[styles.stageLimitLabel, textStyleFor(language)]}>{stageLabelFor(language, stage)}</Text><View style={[styles.limitInputs, rowStyleFor(language)]}><View style={styles.limitBlock}><Text style={[styles.limitLabel, textStyleFor(language)]}>{localize(language, "عمل / ساعة", "Work / hours")}</Text><TextInput defaultValue={limit?.workHours !== undefined ? String(limit.workHours) : ""} onChangeText={(value) => onChangeLimit(stage, "workHours", value)} keyboardType="numeric" placeholder={localize(language, "غير مضبوطة", "Not configured")} placeholderTextColor="#94a3b8" textAlign={textAlignFor(language)} style={[styles.limitInput, textStyleFor(language)]} /></View><View style={styles.limitBlock}><Text style={[styles.limitLabel, textStyleFor(language)]}>{localize(language, "تأكيد / ساعة", "Confirmation / hours")}</Text><TextInput defaultValue={limit?.confirmationHours !== undefined ? String(limit.confirmationHours) : ""} onChangeText={(value) => onChangeLimit(stage, "confirmationHours", value)} keyboardType="numeric" placeholder={localize(language, "غير مضبوطة", "Not configured")} placeholderTextColor="#94a3b8" textAlign={textAlignFor(language)} style={[styles.limitInput, textStyleFor(language)]} /></View></View></View>; })}
      <TouchableOpacity onPress={onSave} disabled={busy} style={[styles.submitButton, rowStyleFor(language), busy && styles.disabledButton]}>{busy ? <WorkbenchBusyLabel language={language} label={localize(language, "جارٍ حفظ الإعدادات…", "Saving settings…")} /> : <><MaterialIcons name="save" color="#fff" size={19} /><Text style={[styles.submitText, textStyleFor(language)]}>{localize(language, "حفظ الإعدادات", "Save settings")}</Text></>}</TouchableOpacity>
    </ScrollView> : <View style={styles.loadingState}><ActivityIndicator color="#075985" /></View>}
  </View></View></Modal>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f8fafc" },
  topBar: { backgroundColor: "#073b5c", paddingHorizontal: 14, paddingVertical: 12, flexDirection: "row-reverse", alignItems: "center", flexWrap: "wrap", gap: 12, borderBottomWidth: 3, borderBottomColor: "#f59e0b" },
  topBarActions: { flexDirection: "row", alignItems: "center", gap: 7 },
  iconButton: { borderWidth: 1, borderColor: "#4b7b96", borderRadius: 8, padding: 7 },
  titleBlock: { flex: 1, alignItems: "flex-end" },
  title: { color: "#fff", fontSize: 20, fontWeight: "900", textAlign: "right" },
  titleSub: { color: "#cbd5e1", fontSize: 11, marginTop: 2, textAlign: "right" },
  profileBlock: { maxWidth: 230, alignItems: "flex-end" },
  profileName: { color: "#fff", fontSize: 12, fontWeight: "800", textAlign: "right" },
  profileSub: { color: "#bae6fd", fontSize: 10, marginTop: 2, textAlign: "right" },
  navigationRow: { flexDirection: "row-reverse", flexWrap: "wrap", alignItems: "center", justifyContent: "flex-start", gap: 7, paddingHorizontal: 12, paddingTop: 10 },
  legacyNotice: { flexDirection: "row-reverse", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8, marginHorizontal: 12, marginTop: 9, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: "#fff7ed", borderWidth: 1, borderColor: "#fed7aa", borderRadius: 9 },
  legacyNoticeText: { flex: 1, minWidth: 220, alignItems: "flex-end" },
  legacyNoticeTitle: { color: "#9a3412", fontSize: 11, fontWeight: "900", textAlign: "right" },
  legacyNoticeBody: { color: "#9a3412", fontSize: 10, lineHeight: 15, marginTop: 1, textAlign: "right" },
  legacyNoticeActions: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 5 },
  metricsWrap: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 7, padding: 12, paddingBottom: 10 },
  metric: { minWidth: 104, flexGrow: 1, flexBasis: 112, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 8, borderWidth: 1 },
  metric_blue: { backgroundColor: "#eff6ff", borderColor: "#bfdbfe" }, metric_green: { backgroundColor: "#f0fdf4", borderColor: "#bbf7d0" }, metric_amber: { backgroundColor: "#fffbeb", borderColor: "#fde68a" }, metric_red: { backgroundColor: "#fff1f2", borderColor: "#fecdd3" }, metric_violet: { backgroundColor: "#f5f3ff", borderColor: "#ddd6fe" },
  metricValue: { fontSize: 20, fontWeight: "900", textAlign: "right" }, metricValue_blue: { color: "#1d4ed8" }, metricValue_green: { color: "#15803d" }, metricValue_amber: { color: "#b45309" }, metricValue_red: { color: "#be123c" }, metricValue_violet: { color: "#6d28d9" },
  metricLabel: { color: "#475569", fontSize: 10, fontWeight: "700", marginTop: 1, textAlign: "right" },
  content: { flex: 1, paddingHorizontal: 12, gap: 9 },
  filters: { gap: 8 },
  searchWrap: { flexDirection: "row-reverse", alignItems: "center", backgroundColor: "#fff", borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 9, paddingHorizontal: 10, minHeight: 42 },
  searchInput: { flex: 1, color: "#0f172a", fontSize: 13, paddingVertical: 8, paddingHorizontal: 8 },
  filterChips: { flexDirection: "row-reverse", gap: 6, paddingVertical: 1 },
  filterChip: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  filterChipActive: { backgroundColor: "#075985", borderColor: "#075985" },
  filterChipText: { color: "#475569", fontSize: 11, fontWeight: "800" },
  filterChipTextActive: { color: "#fff" },
  loadingState: { flex: 1, minHeight: 160, alignItems: "center", justifyContent: "center", gap: 10, padding: 25 },
  loadingText: { color: "#475569", fontSize: 12, fontWeight: "700" },
  emptyState: { alignItems: "center", justifyContent: "center", gap: 8, minHeight: 170, borderWidth: 1, borderColor: "#ccfbf1", backgroundColor: "#f0fdfa", borderRadius: 12, padding: 18 },
  emptyTitle: { color: "#134e4a", fontSize: 15, fontWeight: "900", textAlign: "center" },
  emptyText: { maxWidth: 360, color: "#475569", fontSize: 12, lineHeight: 18, textAlign: "center" },
  cardsList: { gap: 9, paddingBottom: 20 },
  card: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#dbe4ee", borderRadius: 11, padding: 11, gap: 9, elevation: 1 },
  cardTop: { flexDirection: "row-reverse", alignItems: "flex-start", justifyContent: "space-between", gap: 8 },
  cardBadges: { flexDirection: "row", flexWrap: "wrap", gap: 5, justifyContent: "flex-end", maxWidth: "48%" },
  cardTitleWrap: { flex: 1, alignItems: "flex-end" },
  cardTitle: { color: "#0f172a", fontSize: 15, fontWeight: "900", textAlign: "right" },
  cardTracking: { color: "#64748b", fontSize: 10, fontWeight: "700", marginTop: 2, textAlign: "right" },
  flowPill: { overflow: "hidden", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, fontSize: 10, fontWeight: "900", color: "#334155" },
  incomingPill: { color: "#1d4ed8", backgroundColor: "#dbeafe" }, outgoingPill: { color: "#9a3412", backgroundColor: "#ffedd5" }, ownerPill: { color: "#5b21b6", backgroundColor: "#ede9fe" },
  cardGrid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 6 },
  readonlyField: { flexBasis: 130, flexGrow: 1, backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 7, paddingHorizontal: 8, paddingVertical: 6 },
  readonlyLabel: { color: "#64748b", fontSize: 9, fontWeight: "800", textAlign: "right" },
  readonlyValue: { color: "#1e293b", fontSize: 11, fontWeight: "800", marginTop: 2, textAlign: "right" },
  cardFooter: { borderTopWidth: 1, borderTopColor: "#eef2f7", paddingTop: 8, gap: 7 },
  cardTime: { color: "#64748b", fontSize: 10, textAlign: "right" },
  actionRow: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 6, justifyContent: "flex-start" }, actionRowCompact: { gap: 5 },
  tinyButton: { minHeight: 31, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 4, borderWidth: 1, borderRadius: 7, paddingHorizontal: 8, paddingVertical: 6 },
  tinyButtonText: { fontSize: 10, fontWeight: "900", textAlign: "center" },
  disabledButton: { opacity: 0.58 }, noAction: { color: "#94a3b8", fontSize: 10, fontWeight: "700", textAlign: "right" },
  tableScroll: { paddingBottom: 18 }, table: { minWidth: 1285, flex: 1, backgroundColor: "#fff", borderWidth: 1, borderColor: "#dbe4ee", borderRadius: 10, overflow: "hidden" },
  tableHeader: { flexDirection: "row-reverse", backgroundColor: "#073b5c", borderBottomWidth: 1, borderBottomColor: "#0f4c6f" }, th: { color: "#e0f2fe", paddingHorizontal: 10, paddingVertical: 10, fontSize: 11, fontWeight: "900", textAlign: "right" },
  tableRow: { flexDirection: "row-reverse", alignItems: "center", borderBottomWidth: 1, borderBottomColor: "#edf2f7", backgroundColor: "#fff", minHeight: 64 }, td: { color: "#334155", paddingHorizontal: 10, paddingVertical: 8, fontSize: 11, fontWeight: "700", textAlign: "right" }, tdWrap: { paddingHorizontal: 10, paddingVertical: 8, gap: 2 }, tdStrong: { color: "#0f172a", fontSize: 11, fontWeight: "900", textAlign: "right" }, tdMuted: { color: "#64748b", fontSize: 10, textAlign: "right" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(15,23,42,0.48)", justifyContent: "flex-end" },
  detailPanel: { height: "88%", maxHeight: 760, backgroundColor: "#fff", borderTopLeftRadius: 18, borderTopRightRadius: 18, overflow: "hidden" },
  actionPanel: { maxHeight: "91%", backgroundColor: "#fff", borderTopLeftRadius: 18, borderTopRightRadius: 18, overflow: "hidden" }, settingsPanel: { maxHeight: "92%", backgroundColor: "#fff", borderTopLeftRadius: 18, borderTopRightRadius: 18, overflow: "hidden" },
  modalHeader: { flexDirection: "row-reverse", alignItems: "center", gap: 10, borderBottomWidth: 1, borderBottomColor: "#e2e8f0", paddingHorizontal: 14, paddingVertical: 12 }, closeButton: { backgroundColor: "#f1f5f9", borderRadius: 8, padding: 7 }, modalTitleWrap: { flex: 1, alignItems: "flex-end" }, modalTitle: { color: "#0f172a", fontSize: 16, fontWeight: "900", textAlign: "right" }, modalSubtitle: { color: "#64748b", fontSize: 11, marginTop: 2, textAlign: "right" },
  modalBody: { gap: 10, padding: 14, paddingBottom: 32 }, sectionTitle: { color: "#075985", fontSize: 13, fontWeight: "900", textAlign: "right", marginTop: 3 }, productGrid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 6 }, yarnText: { color: "#475569", backgroundColor: "#f8fafc", borderRadius: 7, padding: 9, fontSize: 11, lineHeight: 17, textAlign: "right" },
  timelineRow: { flexDirection: "row-reverse", alignItems: "flex-start", gap: 8, padding: 9, borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 8 }, timelineText: { flex: 1, alignItems: "flex-end" }, timelineStrong: { color: "#1e293b", fontSize: 11, fontWeight: "900", textAlign: "right" }, timelineSub: { color: "#64748b", fontSize: 10, lineHeight: 16, textAlign: "right" }, reasonText: { color: "#92400e", fontSize: 10, marginTop: 2, textAlign: "right" },
  progressSummary: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 6 }, eventRow: { flexDirection: "row-reverse", gap: 8, alignItems: "center", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" }, eventBadge: { backgroundColor: "#e0f2fe", color: "#075985", borderRadius: 5, overflow: "hidden", paddingHorizontal: 6, paddingVertical: 3, fontSize: 10, fontWeight: "900" }, eventText: { flex: 1, color: "#475569", fontSize: 10, lineHeight: 16, textAlign: "right" }, mutedText: { color: "#64748b", fontSize: 11, lineHeight: 17, textAlign: "right" }, detailActions: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 7 },
  actionHint: { backgroundColor: "#eff6ff", borderWidth: 1, borderColor: "#bfdbfe", borderRadius: 8, color: "#1e3a8a", padding: 9, fontSize: 11, fontWeight: "600", lineHeight: 17, textAlign: "right" }, inputBlock: { gap: 5 }, inputBlockCompact: { marginTop: 2 }, inputLabel: { color: "#334155", fontSize: 11, fontWeight: "900", textAlign: "right" }, input: { minHeight: 42, backgroundColor: "#fff", borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8, color: "#0f172a", fontSize: 13, paddingHorizontal: 10, paddingVertical: 8 }, textarea: { minHeight: 78, textAlignVertical: "top" },
  submitButton: { minHeight: 46, marginTop: 5, backgroundColor: "#075985", borderRadius: 9, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 7, paddingHorizontal: 12, paddingVertical: 10 }, submitText: { color: "#fff", fontSize: 13, fontWeight: "900" },
  accountList: { gap: 6 }, accountChoice: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", backgroundColor: "#fff", borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8, paddingHorizontal: 9, paddingVertical: 8 }, accountChoiceActive: { backgroundColor: "#e0f2fe", borderColor: "#0284c7" }, accountChoiceText: { flex: 1, color: "#334155", fontSize: 11, fontWeight: "800", textAlign: "right" }, accountChoiceTextActive: { color: "#075985" }, accountRole: { color: "#64748b", fontSize: 10, marginRight: 8 },
  allocationSum: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", gap: 8, backgroundColor: "#f8fafc", borderRadius: 8, padding: 9 }, allocationSumText: { color: "#334155", fontSize: 11, fontWeight: "900", textAlign: "right" }, validText: { color: "#15803d" }, invalidText: { color: "#be123c" }, allocationCard: { gap: 7, backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#dbe4ee", borderRadius: 9, padding: 9 }, allocationHeader: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" }, allocationTitle: { color: "#0f172a", fontSize: 12, fontWeight: "900" }, removeAllocation: { padding: 3, backgroundColor: "#fff1f2", borderRadius: 6 }, choiceRow: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 5 }, choice: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 5 }, choiceActive: { backgroundColor: "#e0f2fe", borderColor: "#0284c7" }, choiceText: { color: "#475569", fontSize: 10, fontWeight: "800" }, choiceTextActive: { color: "#075985" }, validationText: { color: "#be123c", fontSize: 10, fontWeight: "800", textAlign: "right" },
  settingsEnabled: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", gap: 12, backgroundColor: "#f8fafc", borderRadius: 9, padding: 10 }, settingsEnabledTitle: { color: "#0f172a", fontSize: 13, fontWeight: "900", textAlign: "right" }, stageLimitRow: { gap: 8, borderBottomWidth: 1, borderBottomColor: "#e2e8f0", paddingVertical: 10 }, stageLimitLabel: { color: "#0f172a", fontSize: 12, fontWeight: "900", textAlign: "right" }, limitInputs: { flexDirection: "row-reverse", gap: 7 }, limitBlock: { flex: 1, gap: 4 }, limitLabel: { color: "#64748b", fontSize: 10, fontWeight: "800", textAlign: "right" }, limitInput: { minHeight: 38, backgroundColor: "#fff", borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 7, color: "#0f172a", fontSize: 12, paddingHorizontal: 8, paddingVertical: 6 },
});
