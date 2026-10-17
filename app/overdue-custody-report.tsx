import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { BackButton } from "@/components/back-button";
import { DateField } from "@/components/date-field";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useLanguage } from "@/lib/language-context";
import { manufacturingStageService } from "@/lib/services/data.service";
import { inReportPeriod, reportDate } from "@shared/operational-report";

const stageNames: Record<string, string> = {
  machines: "إنتاج المكائن",
  rosso: "الروسو",
  qalb: "القلب",
  kawiya: "الكاوية",
  inspection: "الفحص",
  packing: "التعبئة والتغليف",
  antislip: "مانع الانزلاق",
  storage: "التخزين",
};

type CustodyRow = Record<string, any>;
type CustodyGroup = {
  worker: string;
  stage: string;
  count: number;
  pairs: number;
  rows: CustodyRow[];
};

const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>\"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;",
} as Record<string, string>)[char] || char);

/** A custody record belongs to the report period by its confirmed receipt date. */
const custodyReceivedDate = (row: CustodyRow): string => reportDate(row?.receivedAt);

const custodyPairs = (row: CustodyRow): number => {
  const dozens = Number(row.quantityDozen || 0);
  const pairs = Number(row.quantityPair || 0);
  return (Number.isFinite(dozens) ? dozens : 0) * 12 + (Number.isFinite(pairs) ? pairs : 0);
};

const overdueHours = (row: CustodyRow): number => {
  const value = Number(row.hoursOpen);
  return Number.isFinite(value) ? value : -1;
};

/** Most overdue custody appears first; receipt date and id make ties stable. */
const sortCustodyRows = (left: CustodyRow, right: CustodyRow) => {
  const hoursDifference = overdueHours(right) - overdueHours(left);
  if (hoursDifference) return hoursDifference;
  const leftDate = custodyReceivedDate(left);
  const rightDate = custodyReceivedDate(right);
  if (leftDate !== rightDate) return leftDate.localeCompare(rightDate);
  return String(left.id ?? "").localeCompare(String(right.id ?? ""));
};

const formatExportDate = (value: unknown) => custodyReceivedDate({ receivedAt: value }) || "غير مسجل";

const downloadOverdueCustodyFile = (
  rows: CustodyRow[],
  format: "word" | "excel",
  isAr: boolean,
  startDate: string,
  endDate: string,
) => {
  if (Platform.OS !== "web" || typeof window === "undefined" || typeof document === "undefined") {
    Alert.alert(
      isAr ? "التنزيل متاح من الويب" : "Web download",
      isAr ? "افتح نسخة الويب لتنزيل التقرير" : "Open the web version to download the report",
    );
    return;
  }

  const grouped = new Map<string, { worker: string; stage: string; count: number; pairs: number }>();
  rows.forEach((row) => {
    const key = `${row.workerName || "—"}|${row.stageName || "—"}`;
    const item = grouped.get(key) || { worker: row.workerName || "—", stage: row.stageName || "—", count: 0, pairs: 0 };
    item.count += 1;
    item.pairs += custodyPairs(row);
    grouped.set(key, item);
  });

  const summaryRows = [...grouped.values()]
    .sort((left, right) => right.pairs - left.pairs || left.worker.localeCompare(right.worker) || left.stage.localeCompare(right.stage))
    .map((item, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(item.worker)}</td><td>${escapeHtml(stageNames[item.stage] || item.stage)}</td><td>${item.count}</td><td>${item.pairs}</td></tr>`)
    .join("");
  const detailRows = rows
    .map((row, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(row.productName || "—")}</td><td>${escapeHtml(row.productSize || "—")}</td><td>${escapeHtml(row.productColor || "—")}</td><td>${escapeHtml(row.workerName || "—")}</td><td>${escapeHtml(stageNames[row.stageName] || row.stageName || "—")}</td><td>${Number(row.quantityDozen || 0)} درزن + ${Number(row.quantityPair || 0)} زوج</td><td>${Math.max(0, overdueHours(row))} ساعة</td><td>${escapeHtml(formatExportDate(row.receivedAt))}</td></tr>`)
    .join("");
  const title = "تقرير العهد المتأخرة";
  const html = `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>${title}</title><style>@page{size:A4 landscape;margin:8mm}body{font-family:Arial,sans-serif;color:#17202a;line-height:1.45}h1,h2{color:#9a3412}h1{text-align:center;font-size:20px}.meta{background:#fff7ed;border:1px solid #fdba74;padding:9px;margin-bottom:12px}table{width:100%;border-collapse:collapse;margin:8px 0 18px;font-size:10px}thead{display:table-header-group}th,td{border:1px solid #cbd5e1;padding:5px;text-align:right;vertical-align:top}th{background:#9a3412;color:#fff}tr{page-break-inside:avoid}.empty{text-align:center;padding:12px;color:#64748b}</style></head><body><h1>${title}</h1><div class="meta"><strong>فترة تاريخ الاستلام:</strong> ${escapeHtml(startDate)} — ${escapeHtml(endDate)}؛ <strong>عدد العهد المتأخرة:</strong> ${rows.length}؛ <strong>إجمالي الأزواج:</strong> ${rows.reduce((sum, row) => sum + custodyPairs(row), 0)}؛ <strong>مدة التأخر:</strong> أكثر من 24 ساعة؛ <strong>تاريخ التصدير:</strong> ${escapeHtml(reportDate(new Date()))}</div><h2>ملخص حسب الموظف والمرحلة</h2><table><thead><tr><th>#</th><th>الموظف</th><th>المرحلة</th><th>عدد العهد</th><th>إجمالي الأزواج</th></tr></thead><tbody>${summaryRows || '<tr><td colspan="5" class="empty">لا توجد عهد متأخرة ضمن الفترة</td></tr>'}</tbody></table><h2>التفاصيل الكاملة</h2><table><thead><tr><th>#</th><th>المنتج</th><th>المقاس</th><th>اللون</th><th>الموظف</th><th>المرحلة</th><th>الكمية</th><th>مدة التأخر</th><th>تاريخ الاستلام</th></tr></thead><tbody>${detailRows || '<tr><td colspan="9" class="empty">لا توجد عهد متأخرة ضمن الفترة</td></tr>'}</tbody></table></body></html>`;
  const blob = new Blob(["\ufeff", html], { type: format === "word" ? "application/msword" : "application/vnd.ms-excel" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `تقرير-العهد-المتأخرة-${startDate}-${endDate}.${format === "word" ? "doc" : "xls"}`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

export default function OverdueCustodyReportScreen() {
  const colors = useColors();
  const { language } = useLanguage();
  const isAr = language === "ar";
  const today = reportDate(new Date());
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [rows, setRows] = useState<CustodyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sourceError, setSourceError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setSourceError(null);
    try {
      const sourceRows = await manufacturingStageService.overdueCustodyReport();
      if (!Array.isArray(sourceRows)) throw new Error("مصدر تقرير العهد المتأخرة أرجع بيانات غير صالحة");
      setRows(sourceRows);
    } catch (error) {
      console.error("Unable to load overdue custody report:", error);
      setRows([]);
      setSourceError(error instanceof Error && error.message ? error.message : "تعذر تحميل مصدر تقرير العهد المتأخرة");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const normalizedStartDate = reportDate(startDate);
  const normalizedEndDate = reportDate(endDate);
  const periodError = !normalizedStartDate || !normalizedEndDate
    ? (isAr ? "اختر تاريخَي بداية ونهاية صحيحين من التقويم." : "Choose valid start and end dates from the calendar.")
    : normalizedStartDate > normalizedEndDate
      ? (isAr ? "تاريخ البداية لاحق لتاريخ النهاية. صحّح الفترة قبل عرض التقرير." : "The start date is after the end date. Correct the period before viewing the report.")
      : null;

  const reportRows = useMemo(() => {
    if (periodError) return [];
    return rows
      .filter((row) => Boolean(custodyReceivedDate(row)))
      .filter((row) => inReportPeriod({ ...row, date: custodyReceivedDate(row) }, "general", normalizedStartDate, normalizedEndDate))
      .sort(sortCustodyRows);
  }, [normalizedEndDate, normalizedStartDate, periodError, rows]);

  // A missing receipt event must never be silently treated as a zero-result period or
  // substituted with an audit timestamp. It remains excluded from the bounded report.
  const undocumentedReceiptCount = useMemo(
    () => rows.filter((row) => !custodyReceivedDate(row)).length,
    [rows],
  );

  const groups = useMemo<CustodyGroup[]>(() => {
    const grouped = new Map<string, CustodyGroup>();
    reportRows.forEach((row) => {
      const key = `${row.workerName || "—"}|${row.stageName || "—"}`;
      const item: CustodyGroup = grouped.get(key) || {
        worker: row.workerName || "—",
        stage: row.stageName || "—",
        count: 0,
        pairs: 0,
        rows: [] as CustodyRow[],
      };
      item.count += 1;
      item.pairs += custodyPairs(row);
      item.rows.push(row);
      grouped.set(key, item);
    });
    return [...grouped.values()].sort((left, right) => right.pairs - left.pairs || left.worker.localeCompare(right.worker) || left.stage.localeCompare(right.stage));
  }, [reportRows]);

  const totalPairs = useMemo(() => reportRows.reduce((sum, row) => sum + custodyPairs(row), 0), [reportRows]);
  const canRenderReport = !loading && !sourceError && !periodError;
  const errorMessage = sourceError || (isAr ? "تعذر تحميل مصدر تقرير العهد المتأخرة؛ لم تُعرض أصفار بديلة." : "The overdue-custody source could not be loaded; zero substitutes are not shown.");

  return (
    <ScreenContainer style={{ backgroundColor: colors.background }}>
      <View style={styles.header}>
        <BackButton />
        <View style={styles.headerText}>
          <Text style={styles.title}>{isAr ? "تقرير العهد المتأخرة" : "Overdue Custody Report"}</Text>
          <Text style={styles.subtitle}>{isAr ? "العهد المفتوحة حاليًا التي تجاوزت 24 ساعة، حسب تاريخ الاستلام" : "Currently open custody overdue by 24+ hours, by receipt date"}</Text>
        </View>
        <MaterialIcons name="report-problem" size={28} color="#fff" />
      </View>
      <ScrollView refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />} contentContainerStyle={styles.content}>
        <View style={styles.periodCard}>
          <Text style={styles.periodTitle}>{isAr ? "فترة تاريخ الاستلام" : "Receipt-date period"}</Text>
          <View style={styles.dateRow}>
            <View style={styles.dateField}><DateField value={startDate} onChange={setStartDate} label={isAr ? "من تاريخ" : "From date"} accessibilityLabel={isAr ? "تاريخ بداية تقرير العهد المتأخرة" : "Overdue custody report start date"} isAr={isAr} /></View>
            <View style={styles.dateField}><DateField value={endDate} onChange={setEndDate} label={isAr ? "إلى تاريخ" : "To date"} accessibilityLabel={isAr ? "تاريخ نهاية تقرير العهد المتأخرة" : "Overdue custody report end date"} isAr={isAr} /></View>
          </View>
          <Text style={styles.periodHint}>{isAr ? "تقتصر النتائج على العهد المتأخرة المفتوحة الآن؛ لا يحول اختيار الفترة التقرير إلى سجل تاريخي للعهد المغلقة." : "Results remain currently open overdue custody; changing the period does not turn this into a history of closed custody."}</Text>
        </View>

        {periodError ? <View style={styles.periodError}><MaterialIcons name="date-range" size={24} color="#b91c1c" /><Text style={styles.periodErrorText}>{periodError}</Text></View> : null}

        <View style={styles.exportRow}>
          <TouchableOpacity disabled={!canRenderReport} onPress={() => downloadOverdueCustodyFile(reportRows, "word", isAr, normalizedStartDate, normalizedEndDate)} accessibilityLabel={isAr ? "تنزيل تقرير العهد المتأخرة بصيغة Word" : "Download overdue custody report as Word"} style={[styles.exportButton, { backgroundColor: canRenderReport ? "#2563eb" : "#94a3b8" }]}><MaterialIcons name="description" size={18} color="#fff" /><Text style={styles.exportText}>Word</Text></TouchableOpacity>
          <TouchableOpacity disabled={!canRenderReport} onPress={() => downloadOverdueCustodyFile(reportRows, "excel", isAr, normalizedStartDate, normalizedEndDate)} accessibilityLabel={isAr ? "تنزيل تقرير العهد المتأخرة بصيغة Excel" : "Download overdue custody report as Excel"} style={[styles.exportButton, { backgroundColor: canRenderReport ? "#15803d" : "#94a3b8" }]}><MaterialIcons name="grid-on" size={18} color="#fff" /><Text style={styles.exportText}>Excel</Text></TouchableOpacity>
        </View>

        {canRenderReport ? <View style={styles.metrics}>
          <View style={styles.metric}><Text style={styles.metricValue}>{reportRows.length}</Text><Text style={styles.metricLabel}>{isAr ? "عهدة متأخرة" : "Overdue items"}</Text></View>
          <View style={styles.metric}><Text style={styles.metricValue}>{groups.length}</Text><Text style={styles.metricLabel}>{isAr ? "موظف / مرحلة" : "Employee / stage"}</Text></View>
          <View style={styles.metric}><Text style={styles.metricValue}>{totalPairs}</Text><Text style={styles.metricLabel}>{isAr ? "إجمالي الأزواج" : "Total pairs"}</Text></View>
        </View> : null}

        {canRenderReport && undocumentedReceiptCount > 0 ? <View style={styles.dateWarning}>
          <MaterialIcons name="info-outline" size={20} color="#9a3412" />
          <Text style={styles.dateWarningText}>{isAr
            ? `استُبعدت ${undocumentedReceiptCount} عهدة من الفترة لعدم توثيق تاريخ الاستلام التشغيلي؛ لم يُستخدم تاريخ الإنشاء أو التحديث بديلًا.`
            : `${undocumentedReceiptCount} custody record(s) were excluded because the operational receipt date is undocumented; no creation or update date was used instead.`}</Text>
        </View> : null}

        {loading ? <ActivityIndicator color={colors.primary} size="large" />
          : sourceError ? <View style={styles.sourceError}><MaterialIcons name="error-outline" size={44} color="#b91c1c" /><Text style={styles.sourceErrorTitle}>{isAr ? "فشل تحميل المصدر" : "Source failed to load"}</Text><Text style={styles.sourceErrorText}>{errorMessage}</Text><TouchableOpacity onPress={() => void load()} style={styles.retryButton}><Text style={styles.retryText}>{isAr ? "إعادة المحاولة" : "Retry"}</Text></TouchableOpacity></View>
            : periodError ? null
              : groups.length === 0 ? <View style={styles.empty}><MaterialIcons name={undocumentedReceiptCount > 0 ? "info-outline" : "check-circle"} size={44} color={undocumentedReceiptCount > 0 ? "#9a3412" : "#16a34a"} /><Text style={styles.emptyTitle}>{undocumentedReceiptCount > 0 ? (isAr ? "لا توجد عهد متأخرة ذات تاريخ استلام موثق ضمن الفترة" : "No overdue custody with a documented receipt date in this period") : (isAr ? "لا توجد عهد متأخرة ضمن الفترة" : "No overdue custody in this period")}</Text></View>
                : groups.map((group) => <View key={`${group.worker}-${group.stage}`} style={styles.group}><View style={styles.groupHeader}><Text style={styles.count}>{group.count} {isAr ? "عهدة" : "items"}</Text><View><Text style={styles.worker}>{group.worker}</Text><Text style={styles.stage}>{stageNames[group.stage] || group.stage} · {group.pairs} {isAr ? "زوج" : "pairs"}</Text></View></View>{group.rows.map((row) => <View key={String(row.id)} style={styles.row}><View style={styles.overdue}><Text style={styles.overdueText}>{Math.max(0, overdueHours(row))} {isAr ? "ساعة" : "hours"}</Text></View><View style={styles.rowText}><Text style={styles.product}>{row.productName || "—"}</Text><Text style={styles.meta}>{Number(row.quantityDozen || 0)} {isAr ? "درزن" : "dozen"} + {Number(row.quantityPair || 0)} {isAr ? "زوج" : "pairs"} · {custodyReceivedDate(row) || "—"}</Text></View></View>)}</View>)}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: "#9a3412", padding: 14, flexDirection: "row", alignItems: "center", gap: 10 },
  headerText: { flex: 1, alignItems: "flex-end" },
  title: { color: "#fff", fontSize: 19, fontWeight: "900" },
  subtitle: { color: "#ffedd5", fontSize: 11, marginTop: 3, textAlign: "right" },
  content: { padding: 12, gap: 10, paddingBottom: 50 },
  periodCard: { backgroundColor: "#fff7ed", borderWidth: 1, borderColor: "#fed7aa", borderRadius: 10, padding: 10, gap: 8 },
  periodTitle: { color: "#9a3412", fontSize: 13, fontWeight: "900", textAlign: "right" },
  dateRow: { flexDirection: "row-reverse", gap: 8 },
  dateField: { flex: 1, minWidth: 0 },
  periodHint: { color: "#7c2d12", fontSize: 10, lineHeight: 15, textAlign: "right" },
  periodError: { flexDirection: "row-reverse", alignItems: "center", gap: 8, backgroundColor: "#fef2f2", borderWidth: 1, borderColor: "#fecaca", borderRadius: 9, padding: 10 },
  periodErrorText: { flex: 1, color: "#991b1b", fontSize: 12, fontWeight: "800", textAlign: "right" },
  dateWarning: { flexDirection: "row-reverse", alignItems: "flex-start", gap: 8, backgroundColor: "#fff7ed", borderWidth: 1, borderColor: "#fdba74", borderRadius: 9, padding: 10 },
  dateWarningText: { flex: 1, color: "#9a3412", fontSize: 11, fontWeight: "700", lineHeight: 16, textAlign: "right" },
  exportRow: { flexDirection: "row", gap: 8 },
  exportButton: { flex: 1, borderRadius: 8, paddingVertical: 10, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6 },
  exportText: { color: "#fff", fontWeight: "900", fontSize: 12 },
  metrics: { flexDirection: "row-reverse", gap: 7 },
  metric: { flex: 1, backgroundColor: "#fff7ed", borderWidth: 1, borderColor: "#fed7aa", borderRadius: 8, padding: 9, alignItems: "center" },
  metricValue: { color: "#c2410c", fontSize: 18, fontWeight: "900" },
  metricLabel: { color: "#9a3412", fontSize: 10, fontWeight: "800", textAlign: "center", marginTop: 3 },
  group: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#fdba74", borderRadius: 10, overflow: "hidden" },
  groupHeader: { backgroundColor: "#fff7ed", padding: 10, flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" },
  worker: { color: "#7c2d12", fontSize: 14, fontWeight: "900", textAlign: "right" },
  stage: { color: "#c2410c", fontSize: 11, textAlign: "right", marginTop: 3 },
  count: { color: "#fff", backgroundColor: "#ea580c", borderRadius: 5, paddingHorizontal: 7, paddingVertical: 5, fontSize: 10, fontWeight: "900" },
  row: { padding: 9, borderTopWidth: 1, borderTopColor: "#fed7aa", flexDirection: "row", alignItems: "center", gap: 8 },
  rowText: { flex: 1 },
  product: { color: "#0f172a", fontWeight: "800", textAlign: "right" },
  meta: { color: "#64748b", fontSize: 10, textAlign: "right", marginTop: 3 },
  overdue: { backgroundColor: "#fee2e2", borderRadius: 4, padding: 5 },
  overdueText: { color: "#b91c1c", fontSize: 10, fontWeight: "900" },
  empty: { alignItems: "center", paddingVertical: 70, gap: 8 },
  emptyTitle: { color: "#15803d", fontSize: 17, fontWeight: "900", textAlign: "center" },
  sourceError: { alignItems: "center", padding: 25, gap: 8, borderWidth: 1, borderColor: "#fecaca", backgroundColor: "#fef2f2", borderRadius: 10 },
  sourceErrorTitle: { color: "#991b1b", fontSize: 17, fontWeight: "900" },
  sourceErrorText: { color: "#991b1b", fontSize: 12, textAlign: "center" },
  retryButton: { backgroundColor: "#b91c1c", borderRadius: 7, paddingHorizontal: 14, paddingVertical: 8, marginTop: 4 },
  retryText: { color: "#fff", fontWeight: "900", fontSize: 12 },
});
