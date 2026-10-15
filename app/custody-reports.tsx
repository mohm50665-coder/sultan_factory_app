import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import * as Print from "expo-print";
import { useRouter } from "expo-router";

import { BackButton } from "@/components/back-button";
import { DateField } from "@/components/date-field";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/lib/auth-context";
import { custodyService } from "@/lib/services/custody.service";
import {
  CUSTODY_QUALITY_LABELS,
  CUSTODY_STAGE_LABELS,
  CUSTODY_STATUS_LABELS,
  type CustodyAccount,
  type CustodyBatch,
  type CustodyQuality,
  type CustodySettings,
  type CustodyStage,
  type CustodyStatus,
} from "@shared/custody-contract";
import {
  buildCustodyReport,
  formatDuration,
  arabicDepartment,
  formatPairs,
  formatRiyadh,
  reportCsv,
  reportPrintHtml,
  type CustodyReport,
  type CustodyReportEvent,
  type CustodyReportFilters,
  type ReportPeriod,
} from "@shared/custody-reporting";

const STAGES = Object.entries(CUSTODY_STAGE_LABELS) as [CustodyStage, string][];
const QUALITIES = Object.entries(CUSTODY_QUALITY_LABELS) as [CustodyQuality, string][];
const STATUSES = Object.entries(CUSTODY_STATUS_LABELS) as [CustodyStatus, string][];
const EMPTY_SETTINGS: CustodySettings = { enabled: false, scheduleCronTaskUid: null, stageLimits: {}, shifts: [], holidays: [] };

type DrillMetric = "received" | "completed" | "confirmed" | "pending" | "open" | null;

function riyadhToday(): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(new Date())
    .reduce((acc, part) => ({ ...acc, [part.type]: part.value }), {} as Record<string, string>);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function addDays(day: string, amount: number): string {
  const parsed = new Date(`${day}T12:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + amount);
  return parsed.toISOString().slice(0, 10);
}

function firstOfMonth(day: string): string { return `${day.slice(0, 7)}-01`; }

function statusLabel(status?: string): string {
  if (!status) return "—";
  if (status === "pending") return "بانتظار التأكيد";
  if (status === "confirmed") return "مؤكد";
  if (status === "rejected") return "مرفوض";
  if (status === "disputed") return "اختلاف قيد المراجعة";
  return CUSTODY_STATUS_LABELS[status as CustodyStatus] || status;
}

function showMessage(title: string, message: string) {
  if (Platform.OS === "web" && typeof window !== "undefined") window.alert(`${title}\n\n${message}`);
  else Alert.alert(title, message);
}

function downloadCsv(csv: string, fileName: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function SelectButtons<T extends string>({ value, onChange, options, label, allowAll = false }: {
  value: T | "";
  onChange: (value: T | "") => void;
  options: readonly (readonly [T, string])[];
  label: string;
  allowAll?: boolean;
}) {
  return (
    <View style={styles.filterBlock}>
      <Text style={styles.filterLabel}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll} style={styles.horizontalScroll}>
        {allowAll ? <TouchableOpacity onPress={() => onChange("")} style={[styles.chip, !value && styles.chipActive]}><Text style={[styles.chipText, !value && styles.chipTextActive]}>الكل</Text></TouchableOpacity> : null}
        {options.map(([id, text]) => <TouchableOpacity key={id} onPress={() => onChange(id)} style={[styles.chip, value === id && styles.chipActive]}><Text style={[styles.chipText, value === id && styles.chipTextActive]}>{text}</Text></TouchableOpacity>)}
      </ScrollView>
    </View>
  );
}

function MetricCard({ label, value, onPress, selected, tone = "blue" }: { label: string; value: string; onPress?: () => void; selected?: boolean; tone?: "blue" | "green" | "amber" | "red" }) {
  const content = <><Text style={[styles.metricValue, tone === "green" && styles.greenText, tone === "amber" && styles.amberText, tone === "red" && styles.redText]}>{value}</Text><Text style={styles.metricLabel}>{label}</Text>{onPress ? <Text style={styles.drillHint}>اضغط للتفاصيل</Text> : null}</>;
  return onPress ? <TouchableOpacity onPress={onPress} style={[styles.metric, selected && styles.metricSelected]}>{content}</TouchableOpacity> : <View style={styles.metric}>{content}</View>;
}

function EventTable({events,title}:{events:CustodyReportEvent[];title?:string}) {
  const columns=["الحركة / الوقت","الدفعة والصنف","الكمية / النخب","الطرف المقابل / الحالة","الوقت والملاحظات"];
  return <View style={styles.tableCard}>
    {title?<Text style={styles.tableTitle}>{title}</Text>:null}
    <View style={styles.compactHeading}>{columns.map(label=><Text key={label} style={styles.compactHeadCell}>{label}</Text>)}</View>
    {!events.length?<Text style={styles.emptyText}>لا توجد حركات مطابقة.</Text>:events.map(event=><View key={event.id} style={styles.compactRow}>
      <View style={styles.compactCell}><Text style={styles.eventAction}>{event.actionLabel}</Text><Text style={styles.eventTime}>{formatRiyadh(event.at)}</Text></View>
      <View style={styles.compactCell}><Text style={styles.eventBatch}>{event.product} · {event.productSize} · {event.productColor}</Text><Text style={styles.eventInfo}>{event.trackingNumber} · ماكينة {event.machineNumber||"—"} · {event.shift||"الوردية غير مسجلة"}</Text></View>
      <View style={styles.compactCell}><Text style={styles.eventBatch}>{event.pairs==null?"—":formatPairs(event.pairs)}</Text><Text style={styles.eventInfo}>{event.quality?CUSTODY_QUALITY_LABELS[event.quality]:"—"}</Text></View>
      <View style={styles.compactCell}><Text style={styles.eventInfo}>{event.counterparty||"—"}{event.counterpartyDepartment?` · ${arabicDepartment(event.counterpartyDepartment)}`:""}</Text><Text style={styles.eventInfo}>{statusLabel(event.status)}</Text></View>
      <View style={styles.compactCell}>{event.reason?<Text style={styles.eventWarning}>{event.reason}</Text>:null}
        {event.progress?<Text style={styles.eventInfo}>قراءة تراكمية {event.progress.cumulativePairs} زوج؛ الفرق {event.progress.deltaPairs} زوج منذ {event.progress.intervalStartAt?formatRiyadh(event.progress.intervalStartAt):"أول قراءة"}</Text>:null}
        {event.timing?<Text style={styles.eventInfo}>العهدة {formatDuration(event.timing.custodyDuration.calendarMs)} · انتظار التأكيد {formatDuration(event.timing.awaitingConfirmation.calendarMs)} · العمل {formatDuration(event.timing.manualWork.calendarMs)} · التوقف {formatDuration(event.timing.pause.calendarMs)}</Text>:null}
        {event.legacySourceId?<Text style={styles.eventWarning}>افتتاحي تاريخي #{event.legacySourceId} — لا تقاس إنتاجيته</Text>:null}
        {event.incomplete?<Text style={styles.eventWarning}>بيانات وقت غير مكتملة</Text>:null}
      </View>
    </View>)}
  </View>;
}

function SettingsPanel({ settings, onChange, onSave, saving }: { settings: CustodySettings; onChange: (settings: CustodySettings) => void; onSave: () => void; saving: boolean }) {
  const updateLimit = (stage: CustodyStage, field: "workHours" | "confirmationHours", raw: string) => {
    const numeric = Number(raw);
    const current = settings.stageLimits[stage] || { workHours: 0, confirmationHours: 0 };
    onChange({ ...settings, stageLimits: { ...settings.stageLimits, [stage]: { ...current, [field]: Number.isFinite(numeric) ? numeric : 0 } } });
  };
  const updateShift = (index: number, field: "name" | "start" | "end" | "days", raw: string) => {
    const shifts = settings.shifts.map((shift, current) => current !== index ? shift : {
      ...shift,
      [field]: field === "days" ? raw.split(",").map((item) => Number(item.trim())).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6) : raw,
    });
    onChange({ ...settings, shifts });
  };
  return <View style={styles.settingsCard}>
    <Text style={styles.sectionTitle}>إعدادات قياس الوقت</Text>
    <Text style={styles.settingNotice}>لا تُفترض ورديات أو عطلات. الزمن ضمن الدوام لا يظهر إلا من الإعدادات الصحيحة المحفوظة.</Text>
    <TouchableOpacity style={styles.outlineButton} onPress={()=>onChange({...settings,enabled:!settings.enabled})}><Text style={styles.outlineText}>{settings.enabled ? "سياسة التنبيهات مفعلة — اضغط للإيقاف" : "سياسة التنبيهات متوقفة — اضغط للتفعيل"}</Text></TouchableOpacity><Text style={styles.schedulePending}>تنبيهات الخلفية تتطلب نشر النسخة وربط المجدول؛ حفظ الحدود وحده لا يفعّل التنبيهات.</Text>
    <Text style={styles.subheading}>حدود كل مرحلة (ساعات العمل / تأكيد الاستلام)</Text>
    {STAGES.map(([stage, label]) => {
      const limit = settings.stageLimits[stage] || { workHours: 0, confirmationHours: 0 };
      return <View key={stage} style={styles.settingRow}><Text style={styles.settingStage}>{label}</Text><TextInput keyboardType="decimal-pad" value={String(limit.workHours)} onChangeText={(text) => updateLimit(stage, "workHours", text)} style={styles.smallInput} placeholder="عمل"/><TextInput keyboardType="decimal-pad" value={String(limit.confirmationHours)} onChangeText={(text) => updateLimit(stage, "confirmationHours", text)} style={styles.smallInput} placeholder="تأكيد"/></View>;
    })}
    <Text style={styles.subheading}>الورديات (الأيام: 0 الأحد إلى 6 السبت)</Text>
    {settings.shifts.map((shift, index) => <View style={styles.shiftBox} key={`${shift.name}-${index}`}><View style={styles.shiftLine}><TextInput value={shift.name} onChangeText={(text) => updateShift(index, "name", text)} style={styles.shiftName} placeholder="اسم الوردية"/><TouchableOpacity onPress={() => onChange({ ...settings, shifts: settings.shifts.filter((_, current) => current !== index) })}><MaterialIcons name="delete-outline" size={20} color="#b91c1c" /></TouchableOpacity></View><View style={styles.shiftLine}><TextInput value={shift.start} onChangeText={(text) => updateShift(index, "start", text)} style={styles.smallInput} placeholder="08:00"/><TextInput value={shift.end} onChangeText={(text) => updateShift(index, "end", text)} style={styles.smallInput} placeholder="16:00"/><TextInput value={shift.days.join(",")} onChangeText={(text) => updateShift(index, "days", text)} style={styles.daysInput} placeholder="0,1,2,3,4"/></View></View>)}
    <TouchableOpacity onPress={() => onChange({ ...settings, shifts: [...settings.shifts, { name: "", start: "", end: "", days: [] }] })} style={styles.outlineButton}><MaterialIcons name="add" size={18} color="#075985"/><Text style={styles.outlineText}>إضافة وردية</Text></TouchableOpacity>
    <Text style={styles.subheading}>العطلات (YYYY-MM-DD، مفصولة بفاصلة)</Text>
    <TextInput value={settings.holidays.join(",")} onChangeText={(text) => onChange({ ...settings, holidays: text.split(",").map((value) => value.trim()).filter(Boolean) })} style={styles.fullInput} placeholder="2026-06-15, 2026-06-16"/>
    <TouchableOpacity disabled={saving} onPress={onSave} style={[styles.primaryButton, saving && styles.disabled]}>{saving ? <ActivityIndicator color="#fff"/> : <><MaterialIcons name="save" size={19} color="#fff"/><Text style={styles.primaryButtonText}>حفظ الإعدادات بعد تأكيد الخادم</Text></>}</TouchableOpacity>
  </View>;
}

export default function CustodyReportsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const today = useMemo(riyadhToday, []);
  const [period, setPeriod] = useState<ReportPeriod>("daily");
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [department, setDepartment] = useState("");
  const [accountId, setAccountId] = useState<number | undefined>();
  const [product, setProduct] = useState("");
  const [batch, setBatch] = useState("");
  const [quality, setQuality] = useState<CustodyQuality | "">("");
  const [status, setStatus] = useState<CustodyStatus | "pending" | "confirmed" | "disputed" | "rejected" | "">("");
  const [batches, setBatches] = useState<CustodyBatch[]>([]);
  const [accounts, setAccounts] = useState<CustodyAccount[]>([]);
  const [settings, setSettings] = useState<CustodySettings>(EMPTY_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [error, setError] = useState("");
  const [drill, setDrill] = useState<DrillMetric>(null);
  const [exporting,setExporting]=useState(false);
  const supervisor = user?.role === "admin";

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [nextBatches, nextAccounts, nextSettings] = await Promise.all([custodyService.list(), custodyService.accounts.list(), custodyService.settings()]);
      setBatches(nextBatches); setAccounts(nextAccounts); setSettings(nextSettings);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "تعذر تحميل تقرير العهد.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filters = useMemo<CustodyReportFilters>(() => ({ startDate, endDate, period, department: department || undefined, accountId, product, batch, quality: quality || undefined, status: status || undefined }), [startDate, endDate, period, department, accountId, product, batch, quality, status]);
  const reportResult = useMemo<{ report: CustodyReport | null; calculationError: string }>(() => {
    try { return { report: buildCustodyReport({ batches, accounts, settings, filters }), calculationError: "" }; }
    catch (reportError) { return { report: null, calculationError: reportError instanceof Error ? reportError.message : "تعذر احتساب التقرير." }; }
  }, [batches, accounts, settings, filters]);
  const report = reportResult.report;

  const applyPeriod = (next: ReportPeriod) => {
    setPeriod(next);
    if (next === "daily") { setStartDate(today); setEndDate(today); }
    if (next === "weekly") { setStartDate(addDays(today, -6)); setEndDate(today); }
    if (next === "monthly") { setStartDate(firstOfMonth(today)); setEndDate(today); }
  };

  const selectDrill = (next: DrillMetric) => setDrill((current) => current === next ? null : next);
  const drilledEvents = useMemo(() => {
    if (!report || !drill) return [];
    if (drill === "received") return report.events.filter((event) => event.action === "received" || event.action === "confirmed");
    if (drill === "completed") return report.events.filter((event) => event.action === "complete");
    if (drill === "confirmed") return report.events.filter((event) => event.source === "transfer" && event.action === "send" && event.status === "confirmed");
    if (drill === "pending") return report.events.filter((event) => event.source === "transfer" && event.action === "send" && event.status === "pending");
    return report.events.filter((event) => ["received", "working", "paused", "completed", "sent", "disputed"].includes(event.status || ""));
  }, [drill, report]);

  const saveSettings = async () => {
    setSavingSettings(true);
    try { await custodyService.saveSettings(settings); showMessage("تم الحفظ", "أكد الخادم حفظ إعدادات الوقت."); await load(); }
    catch (saveError) { showMessage("تعذر الحفظ", saveError instanceof Error ? saveError.message : "لم يؤكد الخادم الحفظ."); }
    finally { setSavingSettings(false); }
  };

  const printReport = async () => {
    if (!report) return;
    try {
      const html = reportPrintHtml(report);
      if (Platform.OS === "web" && typeof window !== "undefined") {
        const printWindow = window.open("", "_blank", "width=1200,height=900");
        if (!printWindow) throw new Error("تعذر فتح نافذة الطباعة. اسمح بالنوافذ المنبثقة ثم حاول مرة أخرى.");
        printWindow.opener = null; printWindow.document.open(); printWindow.document.write(html); printWindow.document.close(); printWindow.focus(); window.setTimeout(() => printWindow.print(), 250);
      } else await Print.printAsync({ html, orientation: Print.Orientation.landscape });
    } catch (printError) { showMessage("تعذر إنشاء PDF", printError instanceof Error ? printError.message : "فشلت الطباعة."); }
  };

  const exportExcel = async () => {
    if (!report || exporting) return;setExporting(true);
    try {
      const result=await custodyService.exportExcel(filters);
      if(Platform.OS === "web"){
        const bytes=Uint8Array.from(atob(result.base64),character=>character.charCodeAt(0));
        const url=URL.createObjectURL(new Blob([bytes],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}));
        const anchor=document.createElement("a");anchor.href=url;anchor.download=result.name;document.body.appendChild(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
      }else{
        const fs=await import("expo-file-system/legacy"); const sharing=await import("expo-sharing");
        const uri=`${fs.cacheDirectory}${result.name}`;await fs.writeAsStringAsync(uri,result.base64,{encoding:fs.EncodingType.Base64});
        if(await sharing.isAvailableAsync())await sharing.shareAsync(uri,{mimeType:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",dialogTitle:"تقرير العهد"});
        else throw new Error("المشاركة غير متاحة على هذا الجهاز");
      }
    }catch(error){showMessage("تعذر التصدير",error instanceof Error?error.message:"تعذر إنشاء ملف Excel");}
    finally{setExporting(false);}
  };

  const totals = useMemo(() => report?.departments.flatMap((group) => group.employees).reduce((acc, employee) => ({
    received: acc.received + employee.totals.receivedPairs, completed: acc.completed + employee.totals.completedPairs, confirmed: acc.confirmed + employee.totals.confirmedOutboundPairs,
    pending: acc.pending + employee.totals.pendingOutboundPairs, open: acc.open + employee.totals.openCustodyPairs,
  }), { received: 0, completed: 0, confirmed: 0, pending: 0, open: 0 }), [report]);

  const departments = useMemo(() => [...new Set(accounts.map((account) => arabicDepartment(account.department)).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ar")), [accounts]);

  return <ScreenContainer containerClassName="bg-background" edges={["top", "left", "right", "bottom"]}>
    <View style={styles.header}><BackButton onPress={() => router.back()} /><View style={styles.headerText}><Text style={styles.headerTitle}>التقارير الشاملة للعهد</Text><Text style={styles.headerSubtitle}>السجلات الفعلية فقط — توقيت الرياض</Text></View><TouchableOpacity onPress={() => void load()} style={styles.headerIcon} accessibilityLabel="تحديث"><MaterialIcons name="refresh" size={22} color="#fff"/></TouchableOpacity></View>
    <ScrollView style={styles.page} contentContainerStyle={[styles.pageContent,{maxWidth:1440,width:"100%",alignSelf:"center"}]} keyboardShouldPersistTaps="handled">
      <View style={styles.periodCard}><Text style={styles.sectionTitle}>الفترة المرجعية للحركة</Text><View style={styles.periodRow}>{(["daily", "weekly", "monthly", "custom"] as ReportPeriod[]).map((item) => <TouchableOpacity key={item} onPress={() => applyPeriod(item)} style={[styles.periodButton, period === item && styles.periodButtonActive]}><Text style={[styles.periodText, period === item && styles.periodTextActive]}>{({ daily: "يومي", weekly: "أسبوعي", monthly: "شهري", custom: "مخصص" })[item]}</Text></TouchableOpacity>)}</View><View style={styles.dateRow}><DateField value={startDate} onChange={(value) => { setPeriod("custom"); setStartDate(value); }} label="من" isAr/><DateField value={endDate} onChange={(value) => { setPeriod("custom"); setEndDate(value); }} label="إلى (شامل اليوم)" isAr/></View><Text style={styles.boundaryNote}>يشمل التقرير اليوم المختار كاملاً: [00:00، 00:00 اليوم التالي) بتوقيت الرياض.</Text></View>

      <View style={styles.filterCard}><Text style={styles.sectionTitle}>التصفية الدقيقة</Text><SelectButtons label="القسم" value={department} onChange={(value)=>{setDepartment(value);setAccountId(undefined);}} allowAll options={departments.map((name) => [name, name] as const)} /><SelectButtons label="الموظف / الحساب" value={accountId ? String(accountId) : ""} onChange={(value) => setAccountId(value ? Number(value) : undefined)} allowAll options={accounts.filter(account=>!department||arabicDepartment(account.department)===department).map((account) => [String(account.id), `${account.name} — ${arabicDepartment(account.department)}`] as const)} /><SelectButtons label="النخب" value={quality} onChange={(value) => setQuality(value as CustodyQuality | "")} allowAll options={QUALITIES} /><SelectButtons label="الحالة" value={status} onChange={(value) => setStatus(value as typeof status)} allowAll options={[...STATUSES, ["pending", "بانتظار التأكيد"], ["confirmed", "مؤكد"], ["disputed", "اختلاف"], ["rejected", "مرفوض"]] as [typeof status, string][]} /><TextInput value={product} onChangeText={setProduct} style={styles.fullInput} placeholder="بحث بالصنف أو الرمز أو المقاس أو اللون" textAlign="right"/><TextInput value={batch} onChangeText={setBatch} style={styles.fullInput} placeholder="بحث برقم الدفعة أو رقم التتبع" textAlign="right"/></View>

      {loading ? <View style={styles.loading}><ActivityIndicator size="large" color="#075985"/><Text style={styles.muted}>جارٍ تحميل السجلات من الخادم…</Text></View> : null}
      {error || reportResult.calculationError ? <View style={styles.errorBox}><MaterialIcons name="error-outline" size={21} color="#b91c1c"/><Text style={styles.errorText}>{error || reportResult.calculationError}</Text></View> : null}
      {report && !loading ? <>
        <View style={styles.actionRow}><TouchableOpacity onPress={() => void printReport()} style={styles.printButton}><MaterialIcons name="print" size={20} color="#fff"/><Text style={styles.primaryButtonText}>طباعة / PDF</Text></TouchableOpacity><TouchableOpacity disabled={exporting} onPress={() => void exportExcel()} style={styles.csvButton}><MaterialIcons name="file-download" size={20} color="#075985"/><Text style={styles.csvText}>{exporting ? "جارٍ إنشاء Excel…" : "Excel (XLSX)"}</Text></TouchableOpacity></View>
        <Text style={styles.referenceNote}>الإنتاج الأصلي للفترة: {formatPairs(report.originalProductionPairs)} — يُحسب مرة واحدة لكل دفعة، وليس عبر المراحل.</Text>
        {report.legacy.openingBatchCount ? <Text style={styles.legacyNote}>عهد افتتاحية/مرحّلة مرتبطة: {report.legacy.openingBatchCount.toLocaleString("ar-SA")} ({formatPairs(report.legacy.openingPairs)})؛ ليست إنتاجاً جديداً ولا تُنشئ إنتاجية تاريخية. روابط المصدر القديمة: {report.legacy.linkedLegacySourceCount.toLocaleString("ar-SA")}.</Text> : null}
        <View style={styles.metricsGrid}><MetricCard label="الوارد المؤكد" value={formatPairs(totals?.received || 0)} selected={drill === "received"} onPress={() => selectDrill("received")}/><MetricCard label="المنجز" value={formatPairs(totals?.completed || 0)} selected={drill === "completed"} onPress={() => selectDrill("completed")} tone="green"/><MetricCard label="الصادر المؤكد" value={formatPairs(totals?.confirmed || 0)} selected={drill === "confirmed"} onPress={() => selectDrill("confirmed")} tone="green"/><MetricCard label="مرسل معلّق" value={formatPairs(totals?.pending || 0)} selected={drill === "pending"} onPress={() => selectDrill("pending")} tone="amber"/><MetricCard label="عهد مفتوحة" value={formatPairs(totals?.open || 0)} selected={drill === "open"} onPress={() => selectDrill("open")} tone="red"/></View>
        {drill ? <EventTable title="تفاصيل الرقم المحدد — حركات فعلية" events={drilledEvents} /> : null}
        <View style={styles.analyticsCard}><Text style={styles.sectionTitle}>الجودة، الإتلاف، المخزون والعينات</Text><Text style={styles.analyticsText}>نخب أول: {formatPairs(report.quality.firstPairs)} | نخب ثانٍ: {formatPairs(report.quality.secondPairs)} | مشتبه: {formatPairs(report.quality.suspectedPairs)} | تالف مصنّف: {formatPairs(report.quality.damagedPairs)}</Text><Text style={styles.analyticsText}>الإتلاف: مستلم {formatPairs(report.disposal.receivedPairs)} | معتمد {formatPairs(report.disposal.approvedPairs)} | منفذ فقط {formatPairs(report.disposal.executedPairs)}. لا يُحسب تالفاً نهائياً قبل التنفيذ.</Text><Text style={styles.analyticsText}>وارد نهائي خلال الفترة: {formatPairs(report.warehouseFinalStockPairs)} (إدخال مخزني نهائي فقط) | عينات ذات إثبات تسليم: {report.samplesWithDeliveryProof.toLocaleString("ar-SA")}</Text></View>
        {report.warnings.length ? <View style={styles.warningBox}><Text style={styles.warningTitle}>تنبيهات سلامة القياس</Text>{report.warnings.map((warning, index) => <Text style={styles.warningText} key={`${warning}-${index}`}>• {warning}</Text>)}</View> : null}
        <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>التقرير الشامل حسب القسم ثم الموظف</Text><Text style={styles.muted}>الحركات أسفل اسم الموظف كما هي في السجل</Text></View>
        {report.departments.length === 0 ? <Text style={styles.emptyText}>لا توجد بيانات ضمن الفلاتر الحالية.</Text> : report.departments.map((group) => <View key={group.department} style={styles.departmentCard}><Text style={styles.departmentTitle}>{group.department}</Text>{group.employees.map((employee) => <View key={employee.employeeId} style={styles.employeeBlock}><Text style={styles.employeeName}>الموظف: {employee.employeeName}</Text><Text style={styles.employeeTotals}>مستلم {formatPairs(employee.totals.receivedPairs)} | منجز {formatPairs(employee.totals.completedPairs)} | صادر مؤكد {formatPairs(employee.totals.confirmedOutboundPairs)}</Text><Text style={styles.employeeTotals}>مرسل معلّق {formatPairs(employee.totals.pendingOutboundPairs)} | عهد مفتوحة {formatPairs(employee.totals.openCustodyPairs)}</Text><Text style={styles.employeeTotals}>عمل فعلي: {employee.totals.timeIncomplete ? "بيانات وقت غير مكتملة" : formatDuration(employee.totals.manualWorkMs)} | توقف: {employee.totals.timeIncomplete ? "بيانات وقت غير مكتملة" : formatDuration(employee.totals.pauseMs)} | إنتاجية السليم: {employee.totals.productivityPairsPerHour === null ? "بيانات وقت غير مكتملة" : `${employee.totals.productivityPairsPerHour.toLocaleString("ar-SA", { maximumFractionDigits: 2 })} زوج/ساعة`}</Text><Text style={styles.balanceLine}>رصيد البداية {formatPairs(employee.balance.openingPairs)} + وارد مؤكد {formatPairs(employee.balance.confirmedInboundPairs)} − صادر مؤكد {formatPairs(employee.balance.confirmedOutboundPairs)} = مسؤولية النهاية {formatPairs(employee.balance.endingLiabilityPairs)}؛ المرسل المعلق {formatPairs(employee.balance.pendingOutboundPairs)} لا يُخصم مرتين.</Text><Text style={styles.employeeTotals}>سليم {formatPairs(employee.totals.goodCompletedPairs)} | مشتبه {formatPairs(employee.totals.suspectedCompletedPairs)} | تالف {formatPairs(employee.totals.damagedCompletedPairs)} | إعادة عمل {formatPairs(employee.totals.reworkCompletedPairs)} | عينات {formatPairs(employee.totals.sampleCompletedPairs)} | دقائق العمل للزوج السليم {employee.totals.workMinutesPerGoodPair?.toFixed(2)??"غير محسوبة"}</Text><EventTable events={employee.events}/></View>)}</View>)}
        <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>تتبع الدفعات والفروع</Text><Text style={styles.muted}>يظهر الأصل والفروع للنخب/الضرر، دون دمجها.</Text></View>
        {report.timelines.map((timeline) => <View key={timeline.batchId} style={styles.timelineCard}><Text style={styles.timelineTitle}>{timeline.trackingNumber} — {timeline.product}</Text><Text style={styles.timelineSummary}>الإنتاج الأصلي: {formatPairs(timeline.originalProductionPairs)} | أول: {formatPairs(timeline.firstPairs)} | ثانٍ: {formatPairs(timeline.secondPairs)} | إتلاف منفذ: {formatPairs(timeline.executedDestroyedPairs)}</Text>{timeline.nodes.map((node) => <TimelineNode key={node.id} node={node} depth={0}/>) }{timeline.issues.map((issue) => <Text style={styles.eventWarning} key={issue}>{issue}</Text>)}</View>)}
        {supervisor ? <SettingsPanel settings={settings} onChange={setSettings} onSave={() => void saveSettings()} saving={savingSettings}/> : <View style={styles.settingNoticeBox}><Text style={styles.settingNotice}>إعدادات الورديات وحدود الوقت مخصصة للأدمن فقط.</Text></View>}
      </> : null}
    </ScrollView>
  </ScreenContainer>;
}

function TimelineNode({ node, depth }: { node: CustodyReport["timelines"][number]["nodes"][number]; depth: number }) {
  return <View style={[styles.timelineNode, { marginRight: Math.min(depth, 5) * 8 }]}><Text style={styles.nodeTitle}>{node.stageLabel} — {node.qualityLabel || ""} — {formatPairs(node.pairs)}</Text><Text style={styles.nodeMeta}>{node.statusLabel} | {node.owner || "—"} | {formatRiyadh(node.at)}</Text>{node.detail ? <Text style={styles.eventWarning}>{node.detail}</Text> : null}{node.children.map((child) => <TimelineNode key={child.id} node={child} depth={depth + 1}/>)}</View>;
}

const styles = StyleSheet.create({
  compactHeading:{flexDirection:"row-reverse",flexWrap:"wrap",backgroundColor:"#e0f2fe",padding:6,gap:6},
  compactHeadCell:{flex:1,minWidth:115,color:"#075985",fontWeight:"800",fontSize:10,textAlign:"right"},
  compactRow:{flexDirection:"row-reverse",flexWrap:"wrap",padding:8,gap:6,borderBottomWidth:1,borderBottomColor:"#e2e8f0"},
  compactCell:{flexGrow:1,flexBasis:170,minWidth:120,gap:3},
  header: { backgroundColor: "#075985", flexDirection: "row-reverse", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 13 },
  headerText: { flex: 1, alignItems: "flex-end" }, headerTitle: { color: "#fff", fontWeight: "900", fontSize: 18 }, headerSubtitle: { color: "#dbeafe", fontSize: 11, marginTop: 2 }, headerIcon: { padding: 8, borderRadius: 18, backgroundColor: "#ffffff28" },
  page: { flex: 1, backgroundColor: "#f8fafc" }, pageContent: { padding: 12, paddingBottom: 34, gap: 12, direction: "rtl" },
  periodCard: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#dbe4ee", borderRadius: 12, padding: 12 }, filterCard: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#dbe4ee", borderRadius: 12, padding: 12, gap: 8 },
  sectionTitle: { color: "#172033", fontWeight: "900", fontSize: 15, textAlign: "right" }, subheading: { color: "#334155", fontWeight: "800", fontSize: 12, marginTop: 10, textAlign: "right" }, muted: { color: "#64748b", fontSize: 11, textAlign: "right" },
  periodRow: { flexDirection: "row-reverse", gap: 6, marginTop: 10, flexWrap: "wrap" }, periodButton: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8, paddingVertical: 7, paddingHorizontal: 12 }, periodButtonActive: { backgroundColor: "#075985", borderColor: "#075985" }, periodText: { color: "#475569", fontWeight: "800", fontSize: 12 }, periodTextActive: { color: "#fff" }, dateRow: { flexDirection: "row-reverse", gap: 10, marginTop: 10 }, boundaryNote: { color: "#64748b", fontSize: 11, textAlign: "right", marginTop: 8 },
  filterBlock: { gap: 4 }, filterLabel: { color: "#475569", fontSize: 12, fontWeight: "800", textAlign: "right" }, horizontalScroll: { flexGrow: 0 }, chipScroll: { flexDirection: "row-reverse", gap: 6 }, chip: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }, chipActive: { backgroundColor: "#e0f2fe", borderColor: "#0284c7" }, chipText: { color: "#475569", fontSize: 11 }, chipTextActive: { color: "#075985", fontWeight: "900" },
  fullInput: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 9, minHeight: 40, color: "#172033", writingDirection: "rtl" },
  loading: { padding: 30, alignItems: "center", gap: 10 }, errorBox: { backgroundColor: "#fef2f2", borderColor: "#fecaca", borderWidth: 1, borderRadius: 10, padding: 10, flexDirection: "row-reverse", gap: 8, alignItems: "center" }, errorText: { flex: 1, textAlign: "right", color: "#991b1b", fontSize: 12 },
  actionRow: { flexDirection: "row-reverse", gap: 8 }, printButton: { flex: 1, borderRadius: 9, backgroundColor: "#15803d", paddingVertical: 11, alignItems: "center", justifyContent: "center", flexDirection: "row-reverse", gap: 6 }, csvButton: { flex: 1.15, borderRadius: 9, borderWidth: 1, borderColor: "#075985", backgroundColor: "#fff", paddingVertical: 11, alignItems: "center", justifyContent: "center", flexDirection: "row-reverse", gap: 6 }, primaryButtonText: { color: "#fff", fontWeight: "900", fontSize: 12 }, csvText: { color: "#075985", fontWeight: "900", fontSize: 12 }, referenceNote: { color: "#075985", backgroundColor: "#e0f2fe", borderRadius: 8, padding: 9, textAlign: "right", fontSize: 12 }, legacyNote: { color: "#7c2d12", backgroundColor: "#fff7ed", borderColor: "#fed7aa", borderWidth: 1, borderRadius: 8, padding: 9, textAlign: "right", fontSize: 11, lineHeight: 17 },
  metricsGrid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 }, metric: { width: "31.8%", minWidth: 102, flexGrow: 1, backgroundColor: "#fff", borderWidth: 1, borderColor: "#dbe4ee", borderRadius: 10, padding: 9, alignItems: "flex-end" }, metricSelected: { borderWidth: 2, borderColor: "#075985", backgroundColor: "#f0f9ff" }, metricValue: { color: "#075985", fontSize: 13, fontWeight: "900", textAlign: "right" }, greenText: { color: "#15803d" }, amberText: { color: "#b45309" }, redText: { color: "#b91c1c" }, metricLabel: { fontSize: 10, color: "#475569", textAlign: "right", marginTop: 3 }, drillHint: { fontSize: 9, color: "#64748b", marginTop: 3 },
  analyticsCard: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#dbe4ee", borderRadius: 12, padding: 12, gap: 7 }, analyticsText: { color: "#334155", fontSize: 12, lineHeight: 19, textAlign: "right" }, warningBox: { backgroundColor: "#fffbeb", borderColor: "#fde68a", borderWidth: 1, padding: 11, borderRadius: 10 }, warningTitle: { textAlign: "right", color: "#92400e", fontWeight: "900", marginBottom: 4 }, warningText: { textAlign: "right", color: "#92400e", fontSize: 11, lineHeight: 17 },
  sectionHeader: { gap: 2, marginTop: 4 }, departmentCard: { backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#cbd5e1", overflow: "hidden" }, departmentTitle: { backgroundColor: "#e0f2fe", color: "#075985", fontWeight: "900", padding: 10, textAlign: "right" }, employeeBlock: { padding: 10, borderTopWidth: 1, borderTopColor: "#e2e8f0", gap: 4 }, employeeName: { color: "#172033", fontWeight: "900", fontSize: 14, textAlign: "right" }, employeeTotals: { color: "#334155", fontSize: 11, textAlign: "right", lineHeight: 17 }, balanceLine: { color: "#075985", backgroundColor: "#f0f9ff", padding: 7, borderRadius: 7, fontSize: 10, textAlign: "right", lineHeight: 16 },
  tableCard: { marginTop: 6, borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 8, overflow: "hidden" }, tableTitle: { backgroundColor: "#f1f5f9", color: "#172033", fontWeight: "900", padding: 8, textAlign: "right", fontSize: 12 }, emptyText: { textAlign: "right", color: "#64748b", padding: 15 }, eventRow: { padding: 9, borderBottomWidth: 1, borderBottomColor: "#e2e8f0", gap: 3 }, eventTop: { flexDirection: "row-reverse", justifyContent: "space-between", gap: 8 }, eventAction: { color: "#075985", fontWeight: "900", fontSize: 12, flex: 1, textAlign: "right" }, eventTime: { color: "#64748b", fontSize: 10, textAlign: "left" }, eventBatch: { color: "#172033", fontWeight: "700", fontSize: 11, textAlign: "right" }, eventInfo: { color: "#475569", fontSize: 10, textAlign: "right", lineHeight: 15 }, eventWarning: { color: "#b45309", fontSize: 10, textAlign: "right" },
  timelineCard: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#dbe4ee", borderRadius: 12, padding: 11, gap: 5 }, timelineTitle: { color: "#172033", fontWeight: "900", textAlign: "right" }, timelineSummary: { color: "#475569", fontSize: 11, lineHeight: 17, textAlign: "right" }, timelineNode: { borderRightWidth: 2, borderRightColor: "#7dd3fc", paddingRight: 8, paddingVertical: 5, marginTop: 3 }, nodeTitle: { color: "#075985", fontSize: 11, fontWeight: "800", textAlign: "right" }, nodeMeta: { color: "#64748b", fontSize: 10, textAlign: "right" },
  settingsCard: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#bfdbfe", borderRadius: 12, padding: 12, marginTop: 4 }, settingNoticeBox: { padding: 11, borderRadius: 10, backgroundColor: "#f1f5f9" }, settingNotice: { color: "#475569", fontSize: 11, lineHeight: 17, textAlign: "right", marginTop: 6 }, schedulePending: { color: "#92400e", backgroundColor: "#fffbeb", padding: 7, borderRadius: 6, fontSize: 11, textAlign: "right", marginTop: 6 }, settingRow: { flexDirection: "row-reverse", alignItems: "center", gap: 6, paddingVertical: 5, borderBottomWidth: 1, borderColor: "#f1f5f9" }, settingStage: { flex: 1, color: "#334155", fontSize: 12, textAlign: "right" }, smallInput: { width: 67, borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 7, paddingVertical: 6, paddingHorizontal: 6, fontSize: 11, color: "#172033", textAlign: "center" }, shiftBox: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 8, padding: 7, marginTop: 6, gap: 6 }, shiftLine: { flexDirection: "row-reverse", alignItems: "center", gap: 7 }, shiftName: { flex: 1, borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 7, paddingVertical: 6, paddingHorizontal: 8, fontSize: 11, textAlign: "right" }, daysInput: { flex: 1, borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 7, paddingVertical: 6, paddingHorizontal: 8, fontSize: 11, textAlign: "center" }, outlineButton: { alignSelf: "flex-end", marginTop: 8, flexDirection: "row-reverse", alignItems: "center", gap: 4, borderWidth: 1, borderColor: "#075985", borderRadius: 7, paddingVertical: 7, paddingHorizontal: 10 }, outlineText: { color: "#075985", fontWeight: "800", fontSize: 11 }, primaryButton: { marginTop: 12, borderRadius: 8, paddingVertical: 11, backgroundColor: "#075985", flexDirection: "row-reverse", gap: 6, alignItems: "center", justifyContent: "center" }, disabled: { opacity: 0.55 },
});
