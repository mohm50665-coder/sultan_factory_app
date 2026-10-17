import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import * as Print from "expo-print";

import { BackButton } from "@/components/back-button";
import { ScreenContainer } from "@/components/screen-container";
import { DateField } from "@/components/date-field";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/lib/auth-context";
import { representativeService } from "@/lib/services/representative.service";
import { businessDate, commercialReport, exactPairs, pairLabel, reportDate, riyadhDate, transactionStatusLabel, visitText, type ReportKind } from "@shared/operational-report";

const TYPE: Record<string, string> = { order: "طلب", visit: "زيارة", return: "مرتجع", custom: "تصنيع خاص", sample: "عينة" };
const STATUS: Record<string, string> = { DRAFT: "مسودة", PENDING_SALES_APPROVAL: "اعتماد التسويق", REJECTED_SALES: "مرفوض", PENDING_WAREHOUSE_INVOICE: "الفاتورة", RETURNED_TO_REPRESENTATIVE: "استلام المندوب", PENDING_PRODUCTION_APPROVAL: "اعتماد الإنتاج", PENDING_SALES_RESOLUTION: "إجراء تصحيحي", IN_PRODUCTION: "قيد التصنيع", READY_FOR_REPRESENTATIVE: "جاهز للاستلام", CLOSED: "مغلق", CLOSED_REJECTED: "مغلق بالرفض" };
const itemSummary = (items: any[] = []) => items.map((item, index) => `${index + 1}. ${item.productName || "—"} | المقاس: ${item.size || "—"} | اللون: ${item.color || "—"} | الكمية: ${pairLabel(exactPairs(item, "item"))} | النوع: ${item.productType || "—"}`).join("<br/>");
const attachmentSummary = (row: any) => (Array.isArray(row.attachments) ? row.attachments.map((file: any) => file.name || file.fileName || file.type).join("، ") : "—");

type ReportRange = { start: string; end: string; reversed: boolean };
function normalizedRange(startValue: unknown, endValue: unknown): ReportRange | null {
  const first = reportDate(startValue);
  const last = reportDate(endValue || startValue);
  if (!first || !last) return null;
  return { start: first <= last ? first : last, end: first <= last ? last : first, reversed: first > last };
}
const EVENT_DATE_FIELDS: Record<Exclude<ReportKind, "general">, string[]> = {
  production: ["productionDate", "date"], sale: ["invoiceDate", "saleDate"], collection: ["collectionDate", "receiptDate"],
  transaction: ["orderDate", "visitDate"], movement: ["movementAt", "movementDate", "deliveredAt", "receivedAt"],
};
function documentedEventDate(row: any, kind: Exclude<ReportKind, "general">): string {
  const source = { ...(row?.data && typeof row.data === "object" ? row.data : {}), ...row };
  for (const key of EVENT_DATE_FIELDS[kind]) if (source?.[key] != null && source[key] !== "") return reportDate(source[key]);
  return "";
}
function eventDateLabel(row: any, kind: ReportKind): string {
  return kind === "general" ? businessDate(row, kind) || "—" : documentedEventDate(row, kind) || "—";
}
function requiredRows(value: unknown, source: string): any[] {
  if (!Array.isArray(value)) throw new Error(`لم يُرجع مصدر ${source} قائمة سجلات صالحة؛ لم يُنشأ تقرير بأصفار بديلة.`);
  return value;
}
function requiredSummary(value: any) {
  if (!value || !Array.isArray(value.representatives) || !Array.isArray(value.weights)) throw new Error("لم يُرجع مصدر ملخص أداء المناديب بيانات صالحة؛ لم يُنشأ تقرير بأصفار بديلة.");
  return value;
}
function sortReportRows(rows: any[], kind: ReportKind): any[] {
  return [...rows].sort((left, right) => {
    const leftDate = businessDate(left, kind);
    const rightDate = businessDate(right, kind);
    if (!leftDate || !rightDate) return leftDate ? -1 : rightDate ? 1 : 0;
    const byDate = rightDate.localeCompare(leftDate);
    if (byDate) return byDate;
    return String(right.referenceCode ?? right.invoiceNumber ?? right.id ?? "").localeCompare(String(left.referenceCode ?? left.invoiceNumber ?? left.id ?? ""));
  });
}
function sortRepresentatives(rows: any[]): any[] {
  return [...rows].sort((left, right) => {
    const rightScore = Number(right?.score);
    const leftScore = Number(left?.score);
    const byScore = (Number.isFinite(rightScore) ? rightScore : Number.NEGATIVE_INFINITY) - (Number.isFinite(leftScore) ? leftScore : Number.NEGATIVE_INFINITY);
    if (byScore) return byScore;
    return String(left?.representative?.name || "").localeCompare(String(right?.representative?.name || ""));
  });
}

export default function RepresentativeReportsScreen() {
  const colors = useColors();
  const { user } = useAuth();
  const [startDate, setStartDate] = useState(() => riyadhDate());
  const [endDate, setEndDate] = useState(() => riyadhDate());
  // أداء المندوبين لا يعرض إلا سجلات الفترة المحددة في التقويم.
  const [summary, setSummary] = useState<any>({ representatives: [], weights: [] });
  const [transactions, setTransactions] = useState<any[]>([]);
  const [collections, setCollections] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [weights, setWeights] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const latestLoad = useRef(0);
  const canManage = user?.role === "admin" || user?.role === "manager" || user?.role === "supervisor";
  const dateRange = useMemo(() => normalizedRange(startDate, endDate), [startDate, endDate]);
  const periodLabel = dateRange ? `${dateRange.start} إلى ${dateRange.end}` : "تاريخ غير صالح";

  const load = useCallback(async () => {
    const request = ++latestLoad.current;
    setLoading(true);
    setErrorMessage(null);
    try {
      if (!dateRange) throw new Error("تاريخا بداية ونهاية التقرير غير صالحين. اختر تاريخين كاملين من التقويم.");
      const filters = { startDate: dateRange.start, endDate: dateRange.end };
      // The individual APIs do not all accept the same event-date aliases. Fetch their permitted
      // records, then use commercialReport below as the single final event-date filter.
      const [summarySource, transactionSource, collectionSource, salesSource] = await Promise.all([representativeService.performance.summary(filters), representativeService.transactions.list(), representativeService.collections.list(), representativeService.sales.list()]);
      const summaryData = requiredSummary(summarySource);
      const sourceRows = <T extends Exclude<ReportKind, "general">>(value: unknown, source: string, kind: T) => requiredRows(value, source).filter((row) => Boolean(documentedEventDate(row, kind)));
      const commercial = commercialReport({ sales: sourceRows(salesSource, "فواتير المبيعات", "sale"), legacySales: [], collections: sourceRows(collectionSource, "التحصيلات", "collection"), legacyCollections: [], transactions: sourceRows(transactionSource, "الطلبات والزيارات", "transaction"), startDate: dateRange.start, endDate: dateRange.end });
      if (request !== latestLoad.current) return;
      const activeRepresentativeIds = new Set([...commercial.salesRows, ...commercial.collectionRows, ...commercial.orderRows, ...commercial.visitRows, ...commercial.otherTransactionRows]
        .map((row: any) => Number(row?.representativeId))
        .filter(Number.isFinite));
      // The summary endpoint is independently scoped, but it may return active representatives
      // with zero activity. Keep only representatives evidenced by locally re-filtered event rows.
      setSummary({ ...summaryData, representatives: sortRepresentatives(summaryData.representatives.filter((row: any) => activeRepresentativeIds.has(Number(row?.representative?.id)))) });
      setWeights((summaryData?.weights || []).map((item: any) => ({ criterionKey: item.criterionKey, criterionName: item.criterionName, weight: Number(item.weight), targetValue: Number(item.targetValue || 0) })));
      setTransactions(sortReportRows([...commercial.orderRows, ...commercial.visitRows, ...commercial.otherTransactionRows], "transaction"));
      setCollections(sortReportRows(commercial.collectionRows, "collection"));
      setSales(sortReportRows(commercial.salesRows, "sale"));
    } catch (error: any) {
      if (request === latestLoad.current) { const message = error?.message || "حدث خطأ"; setErrorMessage(message); Alert.alert("تعذر إعداد التقرير", message); }
    } finally { if (request === latestLoad.current) setLoading(false); }
  }, [dateRange]);
  useEffect(() => { void load(); }, [load]);

  const setPeriod = (period: "daily" | "weekly" | "monthly") => {
    const end = new Date(`${riyadhDate()}T12:00:00+03:00`); const start = new Date(end);
    if (period === "weekly") start.setDate(end.getDate() - 6);
    if (period === "monthly") start.setMonth(end.getMonth() - 1);
    setStartDate(riyadhDate(start)); setEndDate(riyadhDate(end));
  };

  const totals = useMemo(() => ({
    transactions: transactions.length,
    closed: transactions.filter((row) => row.status === "CLOSED").length,
    overdue: transactions.filter((row) => row.isOverdue).length,
    salesValue: sales.reduce((sum, row) => sum + Number(row.amount || 0), 0),
    collectionsValue: collections.reduce((sum, row) => sum + Number(row.collectedAmount || 0), 0),
  }), [transactions, collections, sales]);
  const hasPeriodData = transactions.length > 0 || sales.length > 0 || collections.length > 0;

  const saveWeights = async () => {
    if (weights.reduce((sum, item) => sum + Number(item.weight || 0), 0) !== 100) return Alert.alert("الأوزان غير صحيحة", "مجموع أوزان التقييم يجب أن يساوي 100%");
    try { await representativeService.performance.updateWeights(weights); Alert.alert("تم الحفظ", "تم تحديث معايير تقييم المندوب"); await load(); }
    catch (error: any) { Alert.alert("تعذر الحفظ", error?.message || "حدث خطأ"); }
  };

  const print = async () => {
    if (loading || errorMessage) {
      Alert.alert("تعذر طباعة التقرير", "انتظر حتى يكتمل تحميل بيانات المصادر بنجاح ثم أعد المحاولة.");
      return;
    }
    if (!dateRange) {
      Alert.alert("تاريخ التقرير غير صالح", "اختر تاريخي بداية ونهاية كاملين من التقويم قبل الطباعة.");
      return;
    }
    if (!hasPeriodData) {
      Alert.alert("لا توجد بيانات قابلة للطباعة", "لا توجد أحداث تشغيلية مؤرخة وموثقة ضمن الفترة المحددة.");
      return;
    }
    const performanceRows = (summary.representatives || []).map((row: any) => `<tr><td>${row.representative.name}</td><td>${row.totals.orders}</td><td>${row.totals.visits}</td><td>${row.totals.custom}</td><td>${row.totals.samples}</td><td>${row.totals.salesAmount.toLocaleString("ar-SA")}</td><td>${row.totals.collectionAmount.toLocaleString("ar-SA")}</td><td>${row.totals.avgDurationMinutes} دقيقة</td><td>${row.score}%</td></tr>`).join("");
    const salesRows = sales.map((row) => `<tr><td>${row.invoiceNumber || row.referenceCode || "—"}</td><td>${row.customerName || "—"}</td><td>${eventDateLabel(row, "sale")}</td><td>${row.representativeName || row.reportSource || "—"}</td><td>${Number(row.amount || 0).toLocaleString("ar-SA")}</td><td>${attachmentSummary(row)}</td></tr>`).join("");
    const transactionRows = transactions.map((row) => `<tr><td>${row.referenceCode}</td><td>${TYPE[row.transactionType]}</td><td><b>${row.customerName}</b><br/>السجل: ${row.customer?.commercialRegister || "—"}<br/>الضريبة: ${row.customer?.taxNumber || "—"}<br/>العنوان: ${row.customer?.nationalAddress || "—"}<br/>المالك: ${row.customer?.ownerName || "—"} · ${row.customer?.ownerPhone || "—"}<br/>المسؤول: ${row.customer?.contactName || "—"} · ${row.customer?.contactPhone || "—"}</td><td>${row.representativeName}</td><td>${transactionStatusLabel(row.status, row.transactionType)}</td><td>${eventDateLabel(row, "transaction")}</td><td>${row.deliveryDate || "—"}</td><td>${row.transactionType === "visit" ? visitText(row.visitReport) : "معلومات تشغيلية — لا تحسب مبيعات"}</td><td>${itemSummary(row.items)}</td><td>${attachmentSummary(row)}</td></tr>`).join("");
    const collectionRows = collections.map((row) => `<tr><td>${row.referenceCode}</td><td>${row.customerName}</td><td>${row.representativeName}</td><td>${eventDateLabel(row, "collection")}</td><td>${Number(row.collectedAmount).toLocaleString("ar-SA")}</td><td>${Number(row.remainingAmount || 0).toLocaleString("ar-SA")}</td></tr>`).join("");
    const html = `<html dir="rtl"><head><meta charset="utf-8"><title>التقرير الشامل لأداء المندوب</title><style>body{font-family:Arial;padding:24px;color:#0f172a;direction:rtl}h1{color:#0a7ea4}h2{margin-top:24px;color:#075985}table{width:100%;border-collapse:collapse;font-size:10px;margin-bottom:18px}th,td{border:1px solid #cbd5e1;padding:7px;text-align:right;vertical-align:top}th{background:#e0f2fe}.totals{display:flex;gap:12px;flex-wrap:wrap}.total{background:#f8fafc;padding:10px;border:1px solid #e2e8f0}@page{size:A4 landscape;margin:8mm}@media print{button{display:none}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body><h1>التقرير الشامل لأداء المندوب</h1><p>الفترة: ${periodLabel}${dateRange?.reversed ? " (أُعيد ترتيب حدود البداية والنهاية)" : ""}</p><div class="totals"><div class="total">المعاملات: ${totals.transactions}</div><div class="total">المغلقة: ${totals.closed}</div><div class="total">المتأخرة: ${totals.overdue}</div><div class="total">المبيعات بالفواتير: ${totals.salesValue.toLocaleString("ar-SA")} ريال</div><div class="total">التحصيل: ${totals.collectionsValue.toLocaleString("ar-SA")} ريال</div></div><h2>تقييم المندوبين</h2><table><thead><tr><th>المندوب</th><th>الطلبات</th><th>الزيارات</th><th>التصنيع</th><th>العينات</th><th>قيمة المبيعات</th><th>التحصيل</th><th>متوسط الإنجاز</th><th>النتيجة</th></tr></thead><tbody>${performanceRows}</tbody></table><h2>تفاصيل فواتير المبيعات</h2><table><thead><tr><th>الفاتورة</th><th>العميل</th><th>التاريخ</th><th>المندوب/المصدر</th><th>المبلغ</th><th>المرفقات</th></tr></thead><tbody>${salesRows}</tbody></table><h2>تفاصيل الطلبات والمعاملات — العميل والمنتجات والمرفقات</h2><table><thead><tr><th>المرجع</th><th>النوع</th><th>بيانات العميل الكاملة</th><th>المندوب</th><th>الحالة</th><th>تاريخ الطلب</th><th>موعد التسليم</th><th>بيان الزيارة/المعاملة</th><th>جدول المنتجات</th><th>المرفقات</th></tr></thead><tbody>${transactionRows}</tbody></table><h2>تفاصيل التحصيل</h2><table><thead><tr><th>المرجع</th><th>العميل</th><th>المندوب</th><th>التاريخ</th><th>المحصل</th><th>المتبقي</th></tr></thead><tbody>${collectionRows}</tbody></table><script>window.onload=function(){window.focus();setTimeout(function(){window.print()},250)}</script></body></html>`;
    if (Platform.OS === "web" && typeof window !== "undefined" && typeof document !== "undefined") {
      const printWindow = window.open("", "_blank", "width=1400,height=900");
      if (!printWindow) {
        Alert.alert("تعذر فتح الطباعة", "اسمح للنظام بالنوافذ المنبثقة ثم اضغط زر الطباعة مرة أخرى");
        return;
      }
      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
      return;
    }
    await Print.printAsync({ html });
  };

  return <ScreenContainer style={{ backgroundColor: colors.background }}><View style={styles.header}><BackButton /><View style={{ flex: 1 }}><Text style={styles.headerTitle}>تقارير أداء المندوب</Text><Text style={styles.headerSubtitle}>يومي وأسبوعي وشهري وشامل بالتفاصيل الزمنية</Text></View><TouchableOpacity style={styles.headerButton} onPress={() => void print()} accessibilityRole="button" accessibilityLabel="طباعة التقرير"><MaterialIcons name="print" size={22} color="#fff" /></TouchableOpacity></View><ScrollView contentContainerStyle={styles.content}><View style={styles.periods}>{(["daily", "weekly", "monthly"] as const).map((period) => <TouchableOpacity key={period} style={styles.period} onPress={() => setPeriod(period)}><Text style={styles.periodText}>{period === "daily" ? "يومي" : period === "weekly" ? "أسبوعي" : period === "monthly" ? "شهري" : "شامل"}</Text></TouchableOpacity>)}</View><View style={styles.filters}><DateField value={startDate} onChange={setStartDate} label="من تاريخ" isAr style={styles.input} /><DateField value={endDate} onChange={setEndDate} label="إلى تاريخ" isAr style={styles.input} /><TouchableOpacity style={styles.refresh} onPress={() => void load()} accessibilityRole="button" accessibilityLabel="تحديث التقرير"><MaterialIcons name="search" size={21} color="#fff" /></TouchableOpacity></View><Text style={{ color: "#475569", fontSize: 11, textAlign: "right" }}>{dateRange?.reversed ? `تم عكس حدود الفترة تلقائيًا: ${periodLabel}.` : `الفترة المعتمدة: ${periodLabel}.`}</Text>{loading ? <ActivityIndicator color={colors.primary} size="large" /> : errorMessage ? <Text style={[styles.empty, { color: "#b91c1c" }]}>تعذر تحميل التقرير: {errorMessage}</Text> : !hasPeriodData ? <Text style={styles.empty}>لا توجد أحداث تشغيلية مؤرخة وموثقة ضمن الفترة المحددة. السجلات التي لا تحمل تاريخ حدث لا تُنسب إلى تاريخ إنشائها ولا تُعرض.</Text> : <><View style={styles.metrics}>{[["المعاملات", totals.transactions, "assignment"], ["المغلقة", totals.closed, "check-circle"], ["المتأخرة", totals.overdue, "warning"], ["المبيعات بالفواتير", `${totals.salesValue.toLocaleString("ar-SA")} ر.س`, "receipt-long"], ["التحصيل", `${totals.collectionsValue.toLocaleString("ar-SA")} ر.س`, "payments"]].map(([label, value, icon]) => <View key={String(label)} style={styles.metric}><MaterialIcons name={icon as any} size={21} color="#0a7ea4" /><Text style={styles.metricValue}>{String(value)}</Text><Text style={styles.metricLabel}>{String(label)}</Text></View>)}</View><Text style={styles.sectionTitle}>نتائج المندوبين</Text>{(summary.representatives || []).length === 0 ? <Text style={styles.empty}>لا تتوفر نتائج تقييم مرتبطة بسجل مندوب ضمن الفترة المحددة.</Text> : (summary.representatives || []).map((row: any) => <View key={row.representative.id} style={styles.card}><View style={styles.cardHeader}><View style={[styles.score, { backgroundColor: row.score >= 80 ? "#dcfce7" : row.score >= 60 ? "#fef3c7" : "#fee2e2" }]}><Text style={{ color: row.score >= 80 ? "#15803d" : row.score >= 60 ? "#a16207" : "#b91c1c", fontWeight: "900" }}>{row.score}%</Text></View><View style={{ flex: 1 }}><Text style={styles.cardTitle}>{row.representative.name}</Text><Text style={styles.cardMeta}>{row.representative.phone || "—"} · {row.representative.email || "—"}</Text></View></View><View style={styles.cardMetrics}>{[["طلبات", row.totals.orders], ["زيارات", row.totals.visits], ["تصنيع", row.totals.custom], ["عينات", row.totals.samples], ["فواتير", row.totals.sales], ["تحصيلات", row.totals.collections]].map(([label, value]) => <View key={String(label)} style={styles.smallMetric}><Text style={styles.smallValue}>{String(value)}</Text><Text style={styles.smallLabel}>{String(label)}</Text></View>)}</View>{row.criteria.map((criterion: any) => <View key={criterion.key} style={styles.criterion}><Text style={styles.criterionLabel}>{criterion.name} · وزن {criterion.weight}%</Text><View style={styles.progress}><View style={[styles.progressFill, { width: `${Math.min(100, criterion.achievement)}%` }]} /></View><Text style={styles.criterionValue}>{criterion.actual.toLocaleString("ar-SA")} / {criterion.target.toLocaleString("ar-SA")} · {criterion.achievement.toFixed(1)}%</Text></View>)}</View>)}<Text style={styles.sectionTitle}>تفاصيل فواتير المبيعات</Text>{sales.map((sale) => <View key={`sale-${sale.reportSource}-${sale.id ?? sale.referenceCode}`} style={styles.transactionCard}><Text style={styles.transactionTitle}>{sale.invoiceNumber || sale.referenceCode || "—"} · {sale.customerName || "—"}</Text><Text style={styles.transactionLine}>{eventDateLabel(sale, "sale")} · {Number(sale.amount || 0).toLocaleString("ar-SA")} ر.س · {sale.representativeName || sale.reportSource}</Text><Text style={styles.transactionLine}>المرفقات: {attachmentSummary(sale)}</Text></View>)}<Text style={styles.sectionTitle}>تفاصيل العملاء والمنتجات والمرفقات</Text>{transactions.map((transaction) => <View key={`detail-${transaction.id}`} style={styles.transactionCard}><Text style={styles.transactionTitle}>{transaction.referenceCode} · {TYPE[transaction.transactionType] || transaction.transactionType}</Text><Text style={styles.transactionLine}>العميل: {transaction.customerName} · السجل: {transaction.customer?.commercialRegister || "—"}</Text><Text style={styles.transactionLine}>المالك: {transaction.customer?.ownerName || "—"} · المسؤول: {transaction.customer?.contactName || "—"} · الجوال: {transaction.customer?.contactPhone || "—"}</Text><Text style={styles.transactionLine}>تاريخ الحدث: {eventDateLabel(transaction, "transaction")} · الحالة: {transactionStatusLabel(transaction.status, transaction.transactionType)}</Text>{transaction.transactionType === "visit" && <Text style={styles.transactionLine}>{visitText(transaction.visitReport)}</Text>}{(transaction.items || []).map((item: any, index: number) => <Text key={`${transaction.id}-${index}`} style={styles.productLine}>{index + 1}. {item.productName} · المقاس {item.size} · اللون {item.color} · {pairLabel(exactPairs(item, "item"))} · النوع {item.productType || "—"}</Text>)}<Text style={styles.transactionLine}>المرفقات: {attachmentSummary(transaction)}</Text></View>)}{canManage && <View style={styles.weightsBox}><Text style={styles.sectionTitle}>معايير التقييم وأوزانها</Text>{weights.map((weight, index) => <View key={weight.criterionKey} style={styles.weightRow}><View style={{ flex: 2 }}><Text style={styles.label}>{weight.criterionName}</Text><Text style={styles.code}>{weight.criterionKey}</Text></View><TextInput value={String(weight.targetValue)} onChangeText={(value) => setWeights(weights.map((item, itemIndex) => itemIndex === index ? { ...item, targetValue: Number(value || 0) } : item))} keyboardType="numeric" style={styles.numberInput} placeholder="الهدف" /><TextInput value={String(weight.weight)} onChangeText={(value) => setWeights(weights.map((item, itemIndex) => itemIndex === index ? { ...item, weight: Number(value || 0) } : item))} keyboardType="numeric" style={styles.numberInput} placeholder="الوزن" /></View>)}<Text style={styles.weightTotal}>مجموع الأوزان: {weights.reduce((sum, item) => sum + Number(item.weight || 0), 0)}%</Text><TouchableOpacity style={styles.saveWeights} onPress={() => void saveWeights()}><Text style={styles.saveWeightsText}>حفظ معايير التقييم</Text></TouchableOpacity></View>}</>}</ScrollView></ScreenContainer>;
}

const styles = StyleSheet.create({
  header: { backgroundColor: "#0a7ea4", paddingHorizontal: 16, paddingVertical: 16, flexDirection: "row", alignItems: "center", gap: 12 }, headerTitle: { color: "#fff", fontSize: 19, fontWeight: "900", textAlign: "right" }, headerSubtitle: { color: "#dbeafe", fontSize: 11, textAlign: "right", marginTop: 3 }, headerButton: { backgroundColor: "#ffffff26", borderRadius: 20, padding: 9 }, content: { padding: 14, paddingBottom: 90, gap: 12 }, periods: { flexDirection: "row-reverse", gap: 8 }, period: { flex: 1, backgroundColor: "#e0f2fe", borderRadius: 10, padding: 10, alignItems: "center" }, periodText: { color: "#0369a1", fontWeight: "900" }, filters: { flexDirection: "row-reverse", gap: 8, alignItems: "flex-end" }, field: { flex: 1, gap: 4 }, label: { color: "#334155", fontWeight: "700", fontSize: 11, textAlign: "right" }, input: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 9, padding: 9 }, refresh: { backgroundColor: "#0a7ea4", width: 42, height: 42, borderRadius: 10, alignItems: "center", justifyContent: "center" }, metrics: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 }, metric: { flexGrow: 1, minWidth: "30%", backgroundColor: "#fff", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 12, padding: 10, alignItems: "center" }, metricValue: { color: "#0f172a", fontWeight: "900", fontSize: 15, marginTop: 4 }, metricLabel: { color: "#64748b", fontSize: 10, marginTop: 2 }, sectionTitle: { color: "#0f172a", fontSize: 15, fontWeight: "900", textAlign: "right" }, empty: { color: "#64748b", textAlign: "center", padding: 30 }, card: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 14, padding: 13, gap: 10 }, transactionCard: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#bfdbfe", borderRadius: 12, padding: 12, gap: 6 }, transactionTitle: { color: "#075985", fontWeight: "900", textAlign: "right" }, transactionLine: { color: "#475569", fontSize: 11, textAlign: "right", lineHeight: 18 }, productLine: { color: "#0f766e", backgroundColor: "#f0fdfa", borderRadius: 7, padding: 6, fontSize: 11, textAlign: "right" }, cardHeader: { flexDirection: "row-reverse", gap: 9, alignItems: "center" }, score: { padding: 9, borderRadius: 10 }, cardTitle: { color: "#0f172a", fontSize: 15, fontWeight: "900", textAlign: "right" }, cardMeta: { color: "#64748b", fontSize: 10, textAlign: "right", marginTop: 2 }, cardMetrics: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 6 }, smallMetric: { flex: 1, minWidth: "17%", backgroundColor: "#f8fafc", borderRadius: 8, padding: 7, alignItems: "center" }, smallValue: { color: "#0f172a", fontWeight: "900" }, smallLabel: { color: "#64748b", fontSize: 9 }, criterion: { gap: 4 }, criterionLabel: { color: "#334155", fontSize: 11, textAlign: "right" }, progress: { height: 7, backgroundColor: "#e2e8f0", borderRadius: 4, overflow: "hidden" }, progressFill: { height: "100%", backgroundColor: "#0a7ea4" }, criterionValue: { color: "#64748b", fontSize: 9, textAlign: "right" }, weightsBox: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 14, padding: 13, gap: 9 }, weightRow: { flexDirection: "row-reverse", gap: 7, alignItems: "center" }, code: { color: "#94a3b8", fontSize: 9, textAlign: "right" }, numberInput: { width: 75, backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8, padding: 8, textAlign: "center" }, weightTotal: { color: "#0f172a", textAlign: "right", fontWeight: "900" }, saveWeights: { backgroundColor: "#0a7ea4", borderRadius: 10, padding: 12, alignItems: "center" }, saveWeightsText: { color: "#fff", fontWeight: "900" },
});
