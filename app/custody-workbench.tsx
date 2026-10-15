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
  BusyLabel,
  CUSTODY_STAGES,
  formatPairs,
  formatRiyadh,
  MessageBanner,
  qualityLabel,
  selectWorkbenchCounts,
  selectWorkbenchRows,
  stageLabel,
  statusLabel,
  StatusPill,
  type WorkbenchRow,
} from "@/components/custody-ui";
import { useAuth } from "@/lib/auth-context";
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
import { CUSTODY_QUALITY_LABELS, CUSTODY_STAGE_LABELS } from "@shared/custody-contract";

type Notice = { tone: "info" | "success" | "error"; message: string } | null;
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

const STATUS_FILTERS = [
  ["", "كل الحالات"],
  ["pending", "بانتظار استلامي"],
  ["received", "مستلم"],
  ["working", "قيد العمل"],
  ["paused", "متوقف مؤقتًا"],
  ["completed", "مكتمل"],
  ["sent", "مرسل بانتظار التأكيد"],
  ["disputed", "اختلاف كمية"],
] as const;

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

function rowTitle(row: WorkbenchRow): string {
  if (row.kind === "lot") return `عهدة لديّ · ${stageLabel(row.lot.stage)}`;
  if (row.kind === "incoming") return `نقل وارد من ${row.transfer.fromName}`;
  return `نقل صادر إلى ${row.transfer.toName}`;
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

function actionLabel(action: ActionKind): string {
  return ({
    receive: "تأكيد الاستلام بعد العد",
    dispute: "تسجيل اختلاف كمية",
    reject: "رفض النقل",
    start: "بدء العمل",
    pause: "إيقاف مؤقت",
    resume: "استئناف العمل",
    progress: "تسجيل تقدم تراكمي",
    complete: "إكمال العمل بالكامل",
    send: "تسليم كامل العهدة",
    store: "اعتماد الإدخال النهائي",
    approve_disposal: "اعتماد محضر الإتلاف",
    execute_disposal: "تنفيذ الإتلاف",
    deliver_sample: "توثيق تسليم العينة",
    resolve: "حل الاختلاف",
    rework: "إحالة لإعادة المعالجة",
  } satisfies Record<ActionKind, string>)[action];
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

function HeaderMetric({ label, value, tone = "blue" }: { label: string; value: number | string; tone?: "blue" | "green" | "amber" | "red" | "violet" }) {
  return <View style={[styles.metric, styles[`metric_${tone}`]]}><Text style={[styles.metricValue, styles[`metricValue_${tone}`]]}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>;
}

function TinyButton({
  label,
  onPress,
  tone = "primary",
  disabled,
  icon,
}: {
  label: string;
  onPress: () => void;
  tone?: "primary" | "secondary" | "danger";
  disabled?: boolean;
  icon?: React.ComponentProps<typeof MaterialIcons>["name"];
}) {
  const palette = tone === "danger" ? { background: "#fff1f2", border: "#fecdd3", text: "#be123c" } : tone === "secondary" ? { background: "#fff", border: "#cbd5e1", text: "#334155" } : { background: "#075985", border: "#075985", text: "#fff" };
  return <TouchableOpacity disabled={disabled} onPress={onPress} style={[styles.tinyButton, { backgroundColor: palette.background, borderColor: palette.border }, disabled && styles.disabledButton]}><Text style={[styles.tinyButtonText, { color: palette.text }]}>{label}</Text>{icon ? <MaterialIcons name={icon} size={15} color={palette.text} /> : null}</TouchableOpacity>;
}

function ReadonlyField({ label, value }: { label: string; value: React.ReactNode }) {
  return <View style={styles.readonlyField}><Text style={styles.readonlyLabel}>{label}</Text><Text style={styles.readonlyValue}>{value}</Text></View>;
}

export default function CustodyWorkbenchScreen() {
  const colors = useColors();
  const router = useRouter();
  const { user } = useAuth();
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
      setNotice({ tone: "error", message: error instanceof Error ? error.message : "تعذر تحميل العهد. حاول إعادة التحميل." });
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
      setNotice({ tone: "error", message: error instanceof Error ? error.message : "تعذر تحميل المستلمين المفعّلين." });
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
      if (actualPairs === undefined) return setNotice({ tone: "error", message: "أدخل العدد الفعلي كاملاً بعد العد." });
      if (actualPairs !== expectedPairs) return setNotice({ tone: "error", message: `العدد الفعلي ${formatPairs(actualPairs)} لا يطابق النقل ${formatPairs(expectedPairs)}. استخدم «تسجيل اختلاف كمية».` });
      actionInput = { batchId: batch.id, transferId: transfer?.id, action: "receive", actualPairs };
    } else if (action === "dispute") {
      const actualPairs = numberOrUndefined(form.actualPairs);
      if (actualPairs === undefined || !form.reason.trim()) return setNotice({ tone: "error", message: "أدخل العدد الفعلي وسبب الاختلاف لإيقاف الحركة للمراجعة." });
      actionInput = { batchId: batch.id, transferId: transfer?.id, custodyId: lot?.id, action: "dispute", actualPairs, reason: form.reason.trim(), attachments };
    } else if (action === "reject") {
      if (!form.reason.trim()) return setNotice({ tone: "error", message: "سبب الرفض مطلوب قبل إعادة النقل للمراجعة." });
      actionInput = { batchId: batch.id, transferId: transfer?.id, action: "reject", reason: form.reason.trim(), attachments };
    } else if (action === "pause") {
      if (!form.reason.trim()) return setNotice({ tone: "error", message: "حدد سبب الإيقاف المؤقت." });
      actionInput = { batchId: batch.id, custodyId: lot?.id, action: "pause", reason: form.reason.trim() };
    } else if (action === "progress") {
      const pairs = numberOrUndefined(form.pairs);
      if (pairs === undefined || !lot || pairs > lot.pairs || pairs < lot.progressPairs) return setNotice({ tone: "error", message: `أدخل إنجازًا تراكميًا بين ${formatPairs(lot?.progressPairs ?? 0)} و${formatPairs(lot?.pairs ?? 0)}.` });
      actionInput = { batchId: batch.id, custodyId: lot.id, action: "progress", pairs };
    } else if (action === "complete") {
      if (!lot || lot.progressPairs !== lot.pairs) return setNotice({ tone: "error", message: `لا يمكن الإكمال قبل أن يساوي الإنجاز التراكمي كامل العهدة: ${formatPairs(lot?.pairs)}.` });
      actionInput = { batchId: batch.id, custodyId: lot.id, action: "complete", pairs: lot.pairs };
    } else if (action === "send") {
      if (!lot) return;
      if (batch.purpose === "sale" && (lot.stage === "antislip" || lot.stage === "inspection")) {
        const validation = validateFullAllocations(lot.stage, lot.pairs, allocations);
        if (!validation.valid) return setNotice({ tone: "error", message: validation.message || "توزيع الجودة غير مكتمل." });
        if (allocations.some((allocation) => allocation.toUserId === user.id)) return setNotice({ tone: "error", message: "لا يمكن تسليم العهدة إلى الحساب نفسه." });
        if (allocations.some(a => a.quality !== lot.quality) && !form.reason.trim()) return setNotice({tone:"error",message:"سبب تغيير تصنيف الجودة إلزامي"});
        if (allocations.some(a => ["suspected", "damaged"].includes(a.quality)) && !form.defectType.trim()) return setNotice({tone:"error",message:"حدد نوع العيب أو الاشتباه"});
        actionInput = { batchId: batch.id, custodyId: lot.id, action: "send", pairs: lot.pairs, allocations, reason: form.reason.trim() || undefined, defectType: form.defectType.trim() || undefined, defectCause: form.defectCause.trim() || undefined, attachments };
      } else {
        const destination = nextCustodyStage(lot.stage, batch.product.antiSlip, batch.purpose);
        const receiver = accountById(directory[destination || lot.stage] || [], form.receiverId);
        if (!destination || !receiver) return setNotice({ tone: "error", message: "اختر مستلمًا مفعّلًا من القسم التالي." });
        if (receiver.id === user.id) return setNotice({ tone: "error", message: "لا يمكن تسليم العهدة إلى الحساب نفسه." });
        actionInput = { batchId: batch.id, custodyId: lot.id, action: "send", pairs: lot.pairs, allocations: [{ toStage: destination, toUserId: receiver.id, quality: lot.quality, pairs: lot.pairs }] };
      }
    } else if (action === "store") {
      const packagePairs = numberOrUndefined(form.packagePairs);
      if (!lot || batch.purpose !== "sale" || (lot.quality !== "first" && lot.quality !== "second")) return setNotice({ tone: "error", message: "الإدخال النهائي متاح فقط لنخب البيع الأول أو الثاني." });
      if (!form.barcode.trim() || packagePairs === undefined || packagePairs <= 0) return setNotice({ tone: "error", message: "أدخل الباركود وعدد الأزواج الصحيح داخل العبوة قبل الاعتماد النهائي." });
      actionInput = { batchId: batch.id, custodyId: lot.id, action: "store", barcode: form.barcode.trim(), packagePairs, pairs: lot.pairs, attachments };
    } else if (action === "approve_disposal") {
      if (!lot || !form.reason.trim()) return setNotice({ tone: "error", message: "سبب اعتماد محضر الإتلاف مطلوب." });
      actionInput = { batchId: batch.id, custodyId: lot.id, action: "approve_disposal", pairs: lot.pairs, reason: form.reason.trim(), attachments };
    } else if (action === "execute_disposal") {
      if (!lot || !form.reason.trim() || !form.method.trim() || attachments.length === 0) return setNotice({ tone: "error", message: "يتطلب التنفيذ السبب وطريقة التخلص وإثباتًا مرفقًا بعد الاعتماد المسجل." });
      actionInput = { batchId: batch.id, custodyId: lot.id, action: "execute_disposal", pairs: lot.pairs, reason: form.reason.trim(), method: form.method.trim(), attachments };
    } else if (action === "deliver_sample") {
      if (!lot || !form.receiver.trim() || !form.method.trim() || !form.proof.trim()) return setNotice({ tone: "error", message: "أدخل المستلم وطريقة التسليم والإثبات لتوثيق تسليم العينة." });
      actionInput = { batchId: batch.id, custodyId: lot.id, action: "deliver_sample", pairs: lot.pairs, receiver: form.receiver.trim(), method: form.method.trim(), proof: form.proof.trim(), attachments };
    } else if (action === "rework") {
      if (!lot || !form.reason.trim() || !form.receiverId) return setNotice({tone:"error",message:"حدد سبب القرار والقسم والمستلم لإعادة معالجة كامل العهدة"});
      actionInput = {batchId:batch.id,custodyId:lot.id,action,reason:form.reason.trim(),attachments,allocations:[{toStage:form.reworkStage,toUserId:Number(form.receiverId),quality:lot.quality,pairs:lot.pairs}]};
    } else if (action === "resolve") {
      if (!form.reason.trim()) return setNotice({ tone: "error", message: "السبب والتوثيق مطلوبان قبل هذا الإجراء الإشرافي." });
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
      setNotice({ tone: "success", message: result.replayed ? result.message || "تم تنفيذ الإجراء مسبقًا دون تكرار." : "تم تأكيد الإجراء من الخادم وتحديث سجل العهد." });
      setActionTarget(null); setSelected(null); setForm(EMPTY_FORM); setAttachments([]); setAllocations([]);
      await load(true);
    } catch (error) {
      setNotice({ tone: "error", message: error instanceof Error ? error.message : "لم يؤكد الخادم تنفيذ الإجراء. يمكنك المحاولة بالمفتاح نفسه." });
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
      setNotice({ tone: "success", message: "تم تأكيد حفظ إعدادات العهد من الخادم." });
    } catch (error) {
      setNotice({ tone: "error", message: error instanceof Error ? error.message : "تعذر حفظ الإعدادات." });
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
    if (!actions.length) return <Text style={styles.noAction}>لا يوجد إجراء متاح</Text>;
    return <View style={[styles.actionRow, compact && styles.actionRowCompact]}>{actions.map((action) => <TinyButton key={action} label={actionLabel(action)} icon={actionIcon(action)} tone={["dispute", "reject", "execute_disposal"].includes(action) ? "danger" : "primary"} onPress={() => void openAction(row, action)} disabled={!!busyOperation} />)}</View>;
  };

  const renderCard = ({ item }: { item: WorkbenchRow }) => {
    const batch = item.batch;
    const isIncoming = item.kind === "incoming";
    const isOutgoing = item.kind === "outgoing";
    const lot = rowLot(item);
    const transfer = rowTransfer(item);
    return <TouchableOpacity activeOpacity={0.8} onPress={() => setSelected(item)} style={styles.card}>
      <View style={styles.cardTop}><View style={styles.cardBadges}><StatusPill status={rowStatus(item)} /><Text style={[styles.flowPill, isIncoming ? styles.incomingPill : isOutgoing ? styles.outgoingPill : styles.ownerPill]}>{isIncoming ? "وارد" : isOutgoing ? "مسؤوليتي حتى التأكيد" : "عهدتي"}</Text></View><View style={styles.cardTitleWrap}><Text style={styles.cardTitle} numberOfLines={1}>{batch.product.name}</Text><Text style={styles.cardTracking}>{batch.trackingNumber} · {batch.product.code}</Text></View></View>
      <View style={styles.cardGrid}>
        <ReadonlyField label="القسم" value={stageLabel(rowStage(item))} />
        <ReadonlyField label="الكمية" value={formatPairs(rowPairs(item))} />
        <ReadonlyField label="المقاس / اللون" value={`${batch.product.size} · ${batch.product.color}`} />
        <ReadonlyField label="النخب" value={qualityLabel(lot?.quality || transfer?.quality)} />
      </View>
      <View style={styles.cardFooter}><Text style={styles.cardTime}>{isIncoming ? `أُرسل: ${formatRiyadh(transfer?.sentAt)}` : lot?.receivedAt ? `استُلم: ${formatRiyadh(lot.receivedAt)}` : `أُرسل: ${formatRiyadh(transfer?.sentAt)}`}</Text>{renderActions(item, true)}</View>
    </TouchableOpacity>;
  };

  const renderWideTable = () => <ScrollView horizontal contentContainerStyle={styles.tableScroll}><View style={styles.table}>
    <View style={[styles.tableHeader, Platform.OS === "web" ? ({ position: "sticky", top: 0, zIndex: 2 } as any) : undefined]}>
      {[["الدفعة", 150], ["الصنف", 190], ["القسم / المسار", 160], ["النخب", 105], ["الكمية", 115], ["الوقت", 165], ["الحالة", 145], ["الإجراء", 260]].map(([label, minWidth]) => <Text key={String(label)} style={[styles.th, { minWidth: Number(minWidth) }]}>{label}</Text>)}
    </View>
    {rows.map((row) => {
      const lot = rowLot(row); const transfer = rowTransfer(row);
      return <TouchableOpacity key={row.id} onPress={() => setSelected(row)} style={styles.tableRow}>
        <Text style={[styles.td, { minWidth: 150 }]}>{row.batch.trackingNumber}</Text>
        <View style={[styles.tdWrap, { minWidth: 190 }]}><Text style={styles.tdStrong}>{row.batch.product.name}</Text><Text style={styles.tdMuted}>{row.batch.product.code} · {row.batch.product.size}/{row.batch.product.color}</Text></View>
        <View style={[styles.tdWrap, { minWidth: 160 }]}><Text style={styles.tdStrong}>{stageLabel(rowStage(row))}</Text><Text style={styles.tdMuted}>{rowTitle(row)}</Text></View>
        <Text style={[styles.td, { minWidth: 105 }]}>{qualityLabel(lot?.quality || transfer?.quality)}</Text>
        <Text style={[styles.td, { minWidth: 115 }]}>{formatPairs(rowPairs(row))}</Text>
        <Text style={[styles.td, { minWidth: 165 }]}>{formatRiyadh(lot?.receivedAt || transfer?.sentAt)}</Text>
        <View style={[styles.tdWrap, { minWidth: 145 }]}><StatusPill status={rowStatus(row)} /></View>
        <View style={[styles.tdWrap, { minWidth: 260 }]}>{renderActions(row, true)}</View>
      </TouchableOpacity>;
    })}
  </View></ScrollView>;

  return <ScreenContainer edges={["top", "bottom", "left", "right"]} style={{ backgroundColor: colors.background }}>
    <View style={styles.root}>
      <View style={styles.topBar}>
        <View style={styles.topBarActions}>
          <BackButton />
          <TouchableOpacity onPress={() => void load(true)} disabled={refreshing || loading} style={styles.iconButton} accessibilityLabel="إعادة تحميل العهد"><MaterialIcons name="refresh" size={20} color="#fff" /></TouchableOpacity>
        </View>
        <View style={styles.titleBlock}><Text style={styles.title}>منضدة العهد</Text><Text style={styles.titleSub}>متابعة الاستلام والعمل والتسليم بكميات صحيحة</Text></View>
        <View style={styles.profileBlock}><Text style={styles.profileName}>{user?.name || "الحساب غير معروف"} · {user?.username || "—"}</Text><Text style={styles.profileSub}>{user?.department || "القسم غير مسجل"} · الورديات: {[...new Set(batches.filter(batch=>batch.custodies.some(lot=>lot.ownerId===Number(user?.id)&&!["closed","stored","destroyed"].includes(lot.status))).map(batch=>batch.shift).filter(Boolean))].join(" / ") || "غير مسجلة"}</Text></View>
      </View>

      <View style={styles.navigationRow}>
        {canCreate ? <TinyButton label="دفعة جديدة" icon="add-box" tone="secondary" onPress={() => router.push("/custody-batch-entry" as never)} /> : null}
        <TinyButton label="تقارير العهد" icon="analytics" tone="secondary" onPress={() => router.push("/custody-reports" as never)} />
        {user?.role === "admin" ? <TinyButton label="مراجعة العهد السابقة" icon="history" tone="secondary" onPress={() => router.push("/custody-legacy-review" as never)} /> : null}
        {canConfigure ? <TinyButton label="إعدادات العهد" icon="tune" tone="secondary" onPress={openSettings} /> : null}
      </View>

      <View style={styles.legacyNotice}>
        <View style={styles.legacyNoticeText}><Text style={styles.legacyNoticeTitle}>الدورة الجديدة للدفعات المسجلة بعد التحديث</Text><Text style={styles.legacyNoticeBody}>العهد السابقة محفوظة في السجل التاريخي، ولا تنتقل تلقائيًا.</Text></View>
        <View style={styles.legacyNoticeActions}>
          <TinyButton label="السجل السابق" icon="history" tone="secondary" onPress={() => router.push("/my-custody?legacy=1" as never)} />
          <TinyButton label="المراحل السابقة" icon="account-tree" tone="secondary" onPress={() => router.push("/manufacturing?legacy=1" as never)} />
          {canConfigure ? <TinyButton label="ترحيل افتتاحي" icon="published-with-changes" tone="secondary" onPress={() => router.push("/custody-legacy-import" as never)} /> : null}
        </View>
      </View>

      <View style={styles.metricsWrap}>
        <HeaderMetric label="بانتظار استلامي" value={loading ? "—" : counts.pendingReceive} tone="blue" />
        <HeaderMetric label="مستلمة لديّ" value={loading ? "—" : counts.held} tone="violet" />
        <HeaderMetric label="قيد العمل" value={loading ? "—" : counts.working} tone="green" />
        <HeaderMetric label="مكتملة بانتظار التسليم" value={loading ? "—" : counts.completed} tone="amber" />
        <HeaderMetric label="مرسلة بانتظار التأكيد" value={loading ? "—" : counts.sent} tone="blue" />
        <HeaderMetric label="متأخرة بسياسة مضبوطة" value={loading ? "—" : counts.overdue} tone="red" />
        <HeaderMetric label="اختلافات" value={loading ? "—" : counts.disputed} tone="red" />
      </View>

      <View style={styles.content}>
        <MessageBanner tone={notice?.tone} message={notice?.message} onDismiss={() => setNotice(null)} />
        <View style={styles.filters}><View style={styles.searchWrap}><MaterialIcons name="search" size={19} color="#64748b" /><TextInput value={search} onChangeText={setSearch} placeholder="ابحث برقم الدفعة أو الصنف" placeholderTextColor="#64748b" style={styles.searchInput} textAlign="right" returnKeyType="search" /></View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChips}>{STATUS_FILTERS.map(([value, label]) => <TouchableOpacity key={value} onPress={() => setStatusFilter(value)} style={[styles.filterChip, statusFilter === value && styles.filterChipActive]}><Text style={[styles.filterChipText, statusFilter === value && styles.filterChipTextActive]}>{label}</Text></TouchableOpacity>)}</ScrollView></View>

        {loading ? <View style={styles.loadingState}><ActivityIndicator size="large" color="#075985" /><Text style={styles.loadingText}>جارٍ تحميل سجل العهد من الخادم…</Text></View> : rows.length === 0 ? <View style={styles.emptyState}><MaterialIcons name="inventory-2" size={36} color="#0f766e" /><Text style={styles.emptyTitle}>لا توجد عهد أو تحويلات مطابقة</Text><Text style={styles.emptyText}>لا نعتمد أرقامًا افتراضية. أعد التحميل عند وصول حركة جديدة أو غيّر التصفية.</Text></View> : isWide ? renderWideTable() : <FlatList data={rows} renderItem={renderCard} keyExtractor={(item) => item.id} contentContainerStyle={styles.cardsList} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />} />}
      </View>
    </View>

    <DetailModal selected={selected} userRole={user?.role} onClose={() => setSelected(null)} onAction={(action) => selected && void openAction(selected, action)} />
    <ActionModal
      notice={notice}
      target={actionTarget}
      userId={user?.id}
      directory={directory}
      directoryLoading={directoryLoading}
      form={form}
      attachments={attachments}
      allocations={allocations}
      busy={actionBusy}
      onChangeForm={(patch) => setForm((previous) => ({ ...previous, ...patch }))}
      onChangeAttachments={setAttachments}
      onChangeAllocation={updateAllocation}
      onAddAllocation={() => {
        const lot = actionTarget ? rowLot(actionTarget.row) : undefined;
        if (!lot) return;
        const toStage = lot.stage === "antislip" ? "kawiya" : "packing";
        setAllocations((previous) => [...previous, { toStage, quality: lot.quality === "second" || lot.quality === "suspected" ? "second" : "first", toUserId: 0, pairs: 0 }]);
      }}
      onRemoveAllocation={(index) => setAllocations((previous) => previous.filter((_, allocationIndex) => allocationIndex !== index))}
      onClose={closeAction}
      onSubmit={() => void executeAction()}
    />
    <SettingsModal draft={settingsDraft} visible={settingsOpen} busy={busyOperation === "settings"} onClose={() => setSettingsOpen(false)} onToggleEnabled={(enabled) => setSettingsDraft((previous) => previous ? { ...previous, enabled } : previous)} onChangeLimit={updateStageLimit} onSave={() => void saveSettings()} />
  </ScreenContainer>;
}

function DetailModal({ selected, userRole, onClose, onAction }: { selected: WorkbenchRow | null; userRole?: string; onClose: () => void; onAction: (action: ActionKind) => void }) {
  if (!selected) return null;
  const batch = selected.batch;
  const lot = rowLot(selected);
  const transfer = rowTransfer(selected);
  const relevantCustodyId = lot?.id || transfer?.destinationCustodyId || transfer?.sourceCustodyId;
  const actions = permittedActions(selected, userRole);
  return <Modal visible transparent animationType="slide" onRequestClose={onClose}><View style={styles.modalOverlay}><View style={styles.detailPanel}>
    <View style={styles.modalHeader}><TouchableOpacity onPress={onClose} style={styles.closeButton}><MaterialIcons name="close" size={20} color="#334155" /></TouchableOpacity><View style={styles.modalTitleWrap}><Text style={styles.modalTitle}>{rowTitle(selected)}</Text><Text style={styles.modalSubtitle}>{batch.trackingNumber} · {formatPairs(rowPairs(selected))}</Text></View></View>
    <ScrollView contentContainerStyle={styles.modalBody}>
      <Text style={styles.sectionTitle}>بيانات المنتج — للقراءة فقط</Text>
      <View style={styles.productGrid}><ReadonlyField label="رمز الصنف" value={batch.product.code} /><ReadonlyField label="الصنف" value={batch.product.name} /><ReadonlyField label="المقاس / اللون" value={`${batch.product.size} · ${batch.product.color}`} /><ReadonlyField label="مانع الانزلاق" value={batch.product.antiSlip ? "نعم" : "لا"} /><ReadonlyField label="الغرض" value={batch.purpose === "sale" ? "بيع" : "عينة"} /><ReadonlyField label="الإنتاج" value={`${batch.productionDate} · ${batch.machineNumber}`} /></View>
      <Text style={styles.yarnText}>الخيوط: {batch.product.yarns.length ? batch.product.yarns.map((yarn) => `${yarn.name} ${yarn.percentage}%`).join("، ") : "غير مسجلة"} · وزن الخيط {batch.product.yarnWeightGrams}غ · وزن الزوج {batch.product.pairWeightGrams}غ</Text>

      <Text style={styles.sectionTitle}>النقل والمسؤولية</Text>
      {batch.transfers.filter((item) => item.sourceCustodyId === relevantCustodyId || item.destinationCustodyId === relevantCustodyId || item.id === transfer?.id).length ? batch.transfers.filter((item) => item.sourceCustodyId === relevantCustodyId || item.destinationCustodyId === relevantCustodyId || item.id === transfer?.id).map((item) => <View key={item.id} style={styles.timelineRow}><StatusPill status={item.status} /><View style={styles.timelineText}><Text style={styles.timelineStrong}>{item.fromName} ← {item.toName}</Text><Text style={styles.timelineSub}>{stageLabel(item.fromStage)} ← {stageLabel(item.toStage)} · {formatPairs(item.pairs)} · أرسل {formatRiyadh(item.sentAt)}</Text>{item.reason ? <Text style={styles.reasonText}>السبب: {item.reason}</Text> : null}</View></View>) : <Text style={styles.mutedText}>لا توجد حركة مرتبطة بهذه العهدة بعد.</Text>}

      <Text style={styles.sectionTitle}>جلسات العمل والتقدم</Text>
      {lot ? <View style={styles.progressSummary}><ReadonlyField label="الإنجاز التراكمي" value={`${formatPairs(lot.progressPairs)} من ${formatPairs(lot.pairs)}`} /><ReadonlyField label="وقت الاستلام" value={formatRiyadh(lot.receivedAt)} /><ReadonlyField label="بدأ العمل" value={formatRiyadh(lot.startedAt)} /><ReadonlyField label="اكتمل" value={formatRiyadh(lot.completedAt)} /></View> : null}
      {batch.sessions.filter((session) => session.custodyId === relevantCustodyId).map((session) => <View key={session.id} style={styles.eventRow}><Text style={styles.eventBadge}>{session.kind === "work" ? "عمل" : "توقف"}</Text><Text style={styles.eventText}>{formatRiyadh(session.startedAt)} {session.endedAt ? `— ${formatRiyadh(session.endedAt)}` : "— مستمرة"}{session.reason ? ` · ${session.reason}` : ""}</Text></View>)}
      {batch.progress.filter((item) => item.custodyId === relevantCustodyId).map((item) => <View key={item.id} style={styles.eventRow}><Text style={styles.eventBadge}>تقدم</Text><Text style={styles.eventText}>{formatPairs(item.pairs)} · {formatRiyadh(item.recordedAt)}</Text></View>)}
      {!batch.sessions.some((session) => session.custodyId === relevantCustodyId) && !batch.progress.some((item) => item.custodyId === relevantCustodyId) ? <Text style={styles.mutedText}>لا توجد جلسات أو قراءات تقدم مسجلة.</Text> : null}

      <Text style={styles.sectionTitle}>سجل المراجعة</Text>
      {batch.events.filter((event) => !relevantCustodyId || event.custodyId === relevantCustodyId).slice().reverse().map((event) => <View key={event.id} style={styles.eventRow}><Text style={styles.eventBadge}>{event.action}</Text><Text style={styles.eventText}>{event.actorName} · {formatRiyadh(event.at)}{event.pairs !== undefined ? ` · ${formatPairs(event.pairs)}` : ""}{event.reason ? ` · ${event.reason}` : ""}</Text></View>)}

      {actions.length ? <><Text style={styles.sectionTitle}>الإجراءات المسموحة</Text><View style={styles.detailActions}>{actions.map((action) => <TinyButton key={action} label={actionLabel(action)} icon={actionIcon(action)} tone={["dispute", "reject", "execute_disposal"].includes(action) ? "danger" : "primary"} onPress={() => { onClose(); onAction(action); }} />)}</View></> : null}
    </ScrollView>
  </View></View></Modal>;
}

function ActionModal({
  notice,
  target,
  userId,
  directory,
  directoryLoading,
  form,
  attachments,
  allocations,
  busy,
  onChangeForm,
  onChangeAttachments,
  onChangeAllocation,
  onAddAllocation,
  onRemoveAllocation,
  onClose,
  onSubmit,
}: {
  notice: Notice;
  target: ActionTarget | null;
  userId?: number;
  directory: Partial<Record<CustodyStage, CustodyAccount[]>>;
  directoryLoading: boolean;
  form: FormState;
  attachments: AttachmentFile[];
  allocations: CustodyAllocation[];
  busy: boolean;
  onChangeForm: (patch: Partial<FormState>) => void;
  onChangeAttachments: (items: AttachmentFile[]) => void;
  onChangeAllocation: (index: number, patch: Partial<CustodyAllocation>) => void;
  onAddAllocation: () => void;
  onRemoveAllocation: (index: number) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  if (!target) return null;
  const { row, action } = target;
  const lot = rowLot(row);
  const transfer = rowTransfer(row);
  const fullPairs = rowPairs(row);
  const requiresReason = ["pause", "dispute", "reject", "approve_disposal", "execute_disposal", "resolve", "rework"].includes(action) || (action === "send" && row.batch.purpose === "sale" && !!lot && ["inspection", "antislip"].includes(lot.stage));
  const splitAllocation = action === "send" && row.batch.purpose === "sale" && !!lot && (lot.stage === "antislip" || lot.stage === "inspection");
  const simpleDestination = action === "send" && lot && !splitAllocation ? nextCustodyStage(lot.stage, row.batch.product.antiSlip, row.batch.purpose) : undefined;
  const accounts = simpleDestination ? directory[simpleDestination] || [] : [];
  const allocationTotal = allocations.reduce((sum, allocation) => sum + (Number.isInteger(allocation.pairs) ? allocation.pairs : 0), 0);
  const title = actionLabel(action);
  return <Modal visible transparent animationType="slide" onRequestClose={onClose}><View style={styles.modalOverlay}><View style={styles.actionPanel}>
    <View style={styles.modalHeader}><TouchableOpacity onPress={onClose} disabled={busy} style={styles.closeButton}><MaterialIcons name="close" size={20} color="#334155" /></TouchableOpacity><View style={styles.modalTitleWrap}><Text style={styles.modalTitle}>{title}</Text><Text style={styles.modalSubtitle}>{row.batch.trackingNumber} · الكمية الكاملة {formatPairs(fullPairs)}</Text></View></View>
    <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
      <MessageBanner tone={notice?.tone} message={notice?.message} />
      {action === "receive" ? <><Text style={styles.actionHint}>بعد عد كامل النقل، أدخل العدد الفعلي. عند التطابق فقط يتم تأكيد الاستلام.</Text><Input label="العدد الفعلي بالأزواج" value={form.actualPairs} onChangeText={(actualPairs) => onChangeForm({ actualPairs })} keyboardType="numeric" placeholder={`المتوقع ${fullPairs}`} /></> : null}
      {action === "dispute" || action === "reject" ? <><Text style={styles.actionHint}>سيُجمّد النقل للمراجعة، ولا يُعدّل رصيدًا أو كمية إنتاج تلقائيًا.</Text><Input label="العدد الفعلي بالأزواج" value={form.actualPairs} onChangeText={(actualPairs) => onChangeForm({ actualPairs })} keyboardType="numeric" placeholder={`المنقول ${fullPairs}`} /></> : null}
      {action === "progress" ? <><Text style={styles.actionHint}>هذا تسجيل تراكمي للإنجاز ولا ينقل أي جزء من العهدة.</Text><Input label="الإنجاز التراكمي بالأزواج" value={form.pairs} onChangeText={(pairs) => onChangeForm({ pairs })} keyboardType="numeric" placeholder={`من 0 إلى ${fullPairs}`} /></> : null}
      {action === "complete" ? <Text style={styles.actionHint}>لا يؤكد الخادم الإكمال إلا إذا كان التقدم المسجل يساوي كامل العهدة: {formatPairs(fullPairs)}.</Text> : null}
      {action === "start" || action === "resume" ? <Text style={styles.actionHint}>سيُسجل وقت الخادم عند بدء/استئناف العمل. لا تُنشأ أي أوقات من الجهاز.</Text> : null}
      {action === "send" && simpleDestination ? <><Text style={styles.actionHint}>التسليم كامل فقط إلى {stageLabel(simpleDestination)}. تبقى المسؤولية على المرسل حتى يؤكد المستلم الاستلام.</Text>{directoryLoading ? <ActivityIndicator color="#075985" /> : <AccountChooser accounts={accounts} selectedId={form.receiverId} onSelect={(receiverId) => onChangeForm({ receiverId })} empty="لا توجد حسابات مفعّلة ظاهرة في هذا القسم." />}</> : null}
      {splitAllocation ? <><Text style={styles.actionHint}>يجب أن يساوي مجموع توزيعات الجودة كامل العهدة قبل الإرسال. لا يتم حفظ أي جزء منفردًا.</Text><View style={styles.allocationSum}><Text style={styles.allocationSumText}>مجموع التوزيع: {formatPairs(allocationTotal)} من {formatPairs(fullPairs)}</Text><Text style={[styles.allocationSumText, allocationTotal === fullPairs ? styles.validText : styles.invalidText]}>{allocationTotal === fullPairs ? "مكتمل" : "غير مكتمل"}</Text></View>{allocations.map((allocation, index) => <AllocationEditor key={`${index}:${allocation.toStage}:${allocation.quality}`} sourceStage={lot!.stage} sourceQuality={lot!.quality} allocation={allocation} index={index} accounts={directory[allocation.toStage] || []} currentUserId={userId} onChange={onChangeAllocation} onRemove={() => onRemoveAllocation(index)} />)}<TinyButton label="إضافة توزيع" tone="secondary" icon="add" onPress={onAddAllocation} /></> : null}
      {splitAllocation && allocations.some(a => ["suspected", "damaged"].includes(a.quality)) ? <><Input label="نوع العيب أو الاشتباه" value={form.defectType} onChangeText={defectType => onChangeForm({defectType})}/><Input label="السبب المحتمل — لا يحدد مسؤولية الموظف تلقائيًا" value={form.defectCause} onChangeText={defectCause => onChangeForm({defectCause})}/></> : null}
      {action === "rework" ? <><View style={styles.choiceRow}>{(["inspection","production"] as CustodyStage[]).map(reworkStage => <TinyButton key={reworkStage} label={stageLabel(reworkStage)} onPress={() => onChangeForm({reworkStage,receiverId:""})}/>)}</View><AccountChooser accounts={directory[form.reworkStage] || []} selectedId={form.receiverId} onSelect={receiverId => onChangeForm({receiverId})} empty="لا يوجد مستلم مفعّل في القسم"/></> : null}
      {action === "store" ? <><Text style={styles.actionHint}>الاستلام في المخازن لا يزيد المخزون. الاعتماد النهائي هو الذي يطلب الباركود وعدد أزواج العبوة للنخب المسموح بها للبيع.</Text><Input label="باركود المخزون" value={form.barcode} onChangeText={(barcode) => onChangeForm({ barcode })} placeholder="امسح أو أدخل الباركود" /><Input label="عدد الأزواج داخل العبوة" value={form.packagePairs} onChangeText={(packagePairs) => onChangeForm({ packagePairs })} keyboardType="numeric" placeholder="0" /></> : null}
      {action === "deliver_sample" ? <><Text style={styles.actionHint}>توثيق التسليم لا يدخل العينة تلقائيًا في مخزون البيع.</Text><Input label="اسم مستلم العينة" value={form.receiver} onChangeText={(receiver) => onChangeForm({ receiver })} placeholder="الاسم أو الجهة" /><Input label="طريقة التسليم" value={form.method} onChangeText={(method) => onChangeForm({ method })} placeholder="يدوي، شحن، رابط موثق…" /><Input label="الإثبات" value={form.proof} onChangeText={(proof) => onChangeForm({ proof })} placeholder="رقم إيصال أو وصف إثبات التسليم" /></> : null}
      {action === "execute_disposal" ? <Input label="طريقة التخلص" value={form.method} onChangeText={(method) => onChangeForm({ method })} placeholder="مثال: إتلاف معتمد" /> : null}
      {requiresReason ? <Input label={action === "pause" ? "سبب الإيقاف" : "السبب والتوثيق"} value={form.reason} onChangeText={(reason) => onChangeForm({ reason })} multiline placeholder="اكتب سببًا واضحًا" /> : null}
      {["dispute", "reject", "approve_disposal", "execute_disposal", "deliver_sample", "resolve", "rework", "store", "send"].includes(action) ? <AttachmentPicker attachments={attachments} onAttachmentsChange={onChangeAttachments} language="ar" /> : null}
      {action === "approve_disposal" ? <Text style={styles.actionHint}>بعد الاعتماد لا يعد الإتلاف منفذًا؛ يلزم إجراء تنفيذ مستقل مع الطريقة والإثبات.</Text> : null}
      <TouchableOpacity onPress={onSubmit} disabled={busy || directoryLoading} style={[styles.submitButton, (busy || directoryLoading) && styles.disabledButton]}>{busy ? <BusyLabel /> : <><MaterialIcons name={actionIcon(action)} color="#fff" size={19} /><Text style={styles.submitText}>{title}</Text></>}</TouchableOpacity>
    </ScrollView>
  </View></View></Modal>;
}

function AllocationEditor({ sourceStage, sourceQuality, allocation, index, accounts, currentUserId, onChange, onRemove }: { sourceStage: CustodyStage; sourceQuality: string; allocation: CustodyAllocation; index: number; accounts: CustodyAccount[]; currentUserId?: number; onChange: (index: number, patch: Partial<CustodyAllocation>) => void; onRemove: () => void }) {
  const allOptions = sourceStage === "antislip"
    ? [{ quality: "first" as const, toStage: "kawiya" as const }, { quality: "second" as const, toStage: "kawiya" as const }, { quality: "suspected" as const, toStage: "inspection" as const }]
    : [{ quality: "first" as const, toStage: "packing" as const }, { quality: "second" as const, toStage: "packing" as const }, { quality: "damaged" as const, toStage: "followup" as const }];
  const options = allOptions.filter(o => sourceStage === "antislip" ? o.quality === sourceQuality || o.quality === "suspected" : sourceQuality === "suspected" ? o.quality !== "first" : true);
  return <View style={styles.allocationCard}><View style={styles.allocationHeader}><TouchableOpacity onPress={onRemove} style={styles.removeAllocation}><MaterialIcons name="close" size={17} color="#be123c" /></TouchableOpacity><Text style={styles.allocationTitle}>توزيع {index + 1}</Text></View><Text style={styles.inputLabel}>الجودة والوجهة</Text><View style={styles.choiceRow}>{options.map((option) => <TouchableOpacity key={option.quality} onPress={() => onChange(index, { quality: option.quality, toStage: option.toStage, toUserId: 0 })} style={[styles.choice, allocation.quality === option.quality && allocation.toStage === option.toStage && styles.choiceActive]}><Text style={[styles.choiceText, allocation.quality === option.quality && styles.choiceTextActive]}>{CUSTODY_QUALITY_LABELS[option.quality]} → {CUSTODY_STAGE_LABELS[option.toStage]}</Text></TouchableOpacity>)}</View><Input label="الكمية بالأزواج" value={allocation.pairs ? String(allocation.pairs) : ""} onChangeText={(value) => onChange(index, { pairs: Number.isInteger(Number(value)) ? Number(value) : 0 })} keyboardType="numeric" placeholder="0" compact /><Text style={styles.inputLabel}>المستلم المفعّل — {stageLabel(allocation.toStage)}</Text><AccountChooser accounts={accounts.filter((account) => account.id !== currentUserId)} selectedId={allocation.toUserId ? String(allocation.toUserId) : ""} onSelect={(value) => onChange(index, { toUserId: Number(value) })} empty="حمّل القسم أو لا يوجد مستلم متاح." />{!isAllocationAllowed(sourceStage, allocation) ? <Text style={styles.validationText}>هذه الوجهة غير مسموحة لهذا التصنيف.</Text> : null}</View>;
}

function AccountChooser({ accounts, selectedId, onSelect, empty }: { accounts: CustodyAccount[]; selectedId: string; onSelect: (id: string) => void; empty: string }) {
  if (!accounts.length) return <Text style={styles.mutedText}>{empty}</Text>;
  return <View style={styles.accountList}>{accounts.map((account) => <TouchableOpacity key={account.id} onPress={() => onSelect(String(account.id))} style={[styles.accountChoice, selectedId === String(account.id) && styles.accountChoiceActive]}><Text style={[styles.accountChoiceText, selectedId === String(account.id) && styles.accountChoiceTextActive]}>{account.name} · {account.department}</Text><Text style={[styles.accountRole, selectedId === String(account.id) && styles.accountChoiceTextActive]}>{account.role}</Text></TouchableOpacity>)}</View>;
}

function Input({ label, value, onChangeText, placeholder, keyboardType, multiline, compact }: { label: string; value: string; onChangeText: (value: string) => void; placeholder?: string; keyboardType?: "default" | "numeric"; multiline?: boolean; compact?: boolean }) {
  return <View style={[styles.inputBlock, compact && styles.inputBlockCompact]}><Text style={styles.inputLabel}>{label}</Text><TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#94a3b8" keyboardType={keyboardType} multiline={multiline} textAlign="right" style={[styles.input, multiline && styles.textarea]} /></View>;
}

function SettingsModal({ draft, visible, busy, onClose, onToggleEnabled, onChangeLimit, onSave }: { draft: CustodySettings | null; visible: boolean; busy: boolean; onClose: () => void; onToggleEnabled: (enabled: boolean) => void; onChangeLimit: (stage: CustodyStage, field: "workHours" | "confirmationHours", value: string) => void; onSave: () => void }) {
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}><View style={styles.modalOverlay}><View style={styles.settingsPanel}>
    <View style={styles.modalHeader}><TouchableOpacity disabled={busy} onPress={onClose} style={styles.closeButton}><MaterialIcons name="close" size={20} color="#334155" /></TouchableOpacity><View style={styles.modalTitleWrap}><Text style={styles.modalTitle}>إعدادات العهد</Text><Text style={styles.modalSubtitle}>حدود التأخر من سياسة الخادم — لا تُفترض أوقات ورديات</Text></View></View>
    {draft ? <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
      <View style={styles.settingsEnabled}><View><Text style={styles.settingsEnabledTitle}>تمكين تنبيهات التأخير بعد النشر</Text><Text style={styles.mutedText}>يتطلب النشر وربط المجدول؛ إيقافه لا يحذف أي حركة.</Text></View><Switch value={draft.enabled} onValueChange={onToggleEnabled} disabled={busy} trackColor={{ false: "#cbd5e1", true: "#7dd3fc" }} thumbColor={draft.enabled ? "#075985" : "#f8fafc"} /></View>
      <Text style={styles.actionHint}>يظهر المتأخر فقط حين يُدخل حد عمل أو حد تأكيد موجب لهذه المرحلة. الوردية والإجازات تبقى كما أعادها الخادم.</Text>
      {CUSTODY_STAGES.map((stage) => { const limit = draft.stageLimits[stage]; return <View key={stage} style={styles.stageLimitRow}><Text style={styles.stageLimitLabel}>{stageLabel(stage)}</Text><View style={styles.limitInputs}><View style={styles.limitBlock}><Text style={styles.limitLabel}>عمل / ساعة</Text><TextInput defaultValue={limit?.workHours !== undefined ? String(limit.workHours) : ""} onChangeText={(value) => onChangeLimit(stage, "workHours", value)} keyboardType="numeric" placeholder="غير مضبوطة" placeholderTextColor="#94a3b8" textAlign="right" style={styles.limitInput} /></View><View style={styles.limitBlock}><Text style={styles.limitLabel}>تأكيد / ساعة</Text><TextInput defaultValue={limit?.confirmationHours !== undefined ? String(limit.confirmationHours) : ""} onChangeText={(value) => onChangeLimit(stage, "confirmationHours", value)} keyboardType="numeric" placeholder="غير مضبوطة" placeholderTextColor="#94a3b8" textAlign="right" style={styles.limitInput} /></View></View></View>; })}
      <TouchableOpacity onPress={onSave} disabled={busy} style={[styles.submitButton, busy && styles.disabledButton]}>{busy ? <BusyLabel label="جارٍ حفظ الإعدادات…" /> : <><MaterialIcons name="save" color="#fff" size={19} /><Text style={styles.submitText}>حفظ الإعدادات</Text></>}</TouchableOpacity>
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
