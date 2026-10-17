import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import * as Print from "expo-print";
import { useRouter } from "expo-router";
import { BackButton } from "@/components/back-button";
import { DateField } from "@/components/date-field";
import { ScreenContainer } from "@/components/screen-container";
import { useLanguage } from "@/lib/language-context";
import { isEnglish, localize, textAlignFor, writingDirection } from "@/lib/i18n/runtime";
import { collectionService, expensesService, finishedWarehouseService, productionService, salesService } from "@/lib/services/api.service";
import { representativeService } from "@/lib/services/representative.service";
import { businessDate, commercialReport, inReportPeriod, pairLabel, productionMetrics, reportDate, reportRows, riyadhDate, warehousePeriod, type ReportKind } from "@shared/operational-report";

const sourceKinds: Record<string, ReportKind> = {
  production: "production",
  legacySales: "sale",
  sales: "sale",
  collections: "collection",
  legacyCollections: "collection",
  transactions: "transaction",
  expenses: "general",
  movements: "movement",
};

function hasReportRows(value: unknown): boolean {
  if (Array.isArray(value)) return true;
  if (!value || typeof value !== "object") return false;
  return ["items", "rows", "data", "results"].some((key) => Array.isArray((value as Record<string, unknown>)[key]));
}

function sortRowsByBusinessDate(rows: any[], kind: ReportKind): any[] {
  return [...rows].sort((left, right) => {
    const leftDate = businessDate(left, kind);
    const rightDate = businessDate(right, kind);
    if (!leftDate && !rightDate) return String(left?.id ?? left?.referenceCode ?? "").localeCompare(String(right?.id ?? right?.referenceCode ?? ""));
    if (!leftDate) return 1;
    if (!rightDate) return -1;
    return leftDate.localeCompare(rightDate) || String(left?.id ?? left?.referenceCode ?? "").localeCompare(String(right?.id ?? right?.referenceCode ?? ""));
  });
}

export default function ReportsScreen() {
  const router = useRouter();
  const { language } = useLanguage();
  const english = isEnglish(language);
  const direction = writingDirection(language);
  const textAlign = textAlignFor(language);
  const today = riyadhDate();
  const [start, setStart] = useState(`${today.slice(0, 7)}-01`);
  const [end, setEnd] = useState(today);
  const [sources, setSources] = useState<Record<string, any[]>>({});
  const [errors, setErrors] = useState<Record<string, true>>({});
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);

  const copy = {
    title: localize(language, "التقارير والإحصائيات", "Reports & Analytics"),
    startDate: localize(language, "من تاريخ", "Start date"),
    endDate: localize(language, "إلى تاريخ", "End date"),
    refresh: localize(language, "تحديث البيانات", "Refresh data"),
    periodSummary: localize(language, "جميع المؤشرات لحركة الفترة المختارة. أرصدة المستودع تعاد من دفتر الحركات حتى نهاية الفترة، ولا يُعرض رصيد حالي خارجها.", "All indicators reflect activity in the selected period. Warehouse balances are reconstructed from the movement ledger through the period end; no current balance outside the period is shown."),
    loading: localize(language, "جارٍ تحميل بيانات التقرير...", "Loading report data..."),
    sourceFailed: localize(language, "تعذر تحميل المصدر", "Source could not be loaded"),
    openDetails: localize(language, "فتح التفاصيل", "Open details"),
    totalProduction: localize(language, "الإنتاج الإجمالي", "Total production"),
    firstGrade: localize(language, "النخب الأول", "First grade"),
    secondGrade: localize(language, "النخب الثاني", "Second grade"),
    salesInvoices: localize(language, "المبيعات — الفواتير", "Sales — invoices"),
    collections: localize(language, "التحصيل", "Collections"),
    ordersAndVisits: localize(language, "الطلبات والزيارات", "Orders & visits"),
    yarnUsed: localize(language, "الخيوط المستخدمة", "Yarn used"),
    yarnAndSockWaste: localize(language, "هدر الخيوط والجوارب", "Yarn & sock waste"),
    totalWasteRate: localize(language, "نسبة الهدر الإجمالي", "Total waste rate"),
    needlesUsedAndDamaged: localize(language, "الإبر المستخدمة والتالفة", "Needles used & damaged"),
    finishedGoodsReceipts: localize(language, "التخزين والمستودعات — وارد إنتاج تام", "Storage & warehouses — finished-goods receipts"),
    finishedGoodsIssues: localize(language, "صادر الإنتاج التام", "Finished-goods issues"),
    closingBalance: localize(language, "رصيد نهاية الفترة", "Closing balance"),
    openingBalance: localize(language, "رصيد افتتاح الفترة", "Opening balance"),
    operatingExpenses: localize(language, "المصروفات التشغيلية", "Operating expenses"),
    noRecordedWeight: localize(language, "لا تحسب — وزن غير مسجل", "Not calculated — no weight recorded"),
    closingBalanceUnverified: localize(language, "غير مؤكد — يلزم مراجعة الدفتر", "Unverified — ledger review required"),
    incompleteSources: localize(language, "لم تكتمل المصادر التالية:", "The following sources did not finish loading:"),
    notZeroActivity: localize(language, "لا تعتبرها صفر نشاط.", "Do not treat these as zero activity."),
    missingOperationalDate: localize(language, "توجد سجلات بلا تاريخ حدث تشغيلي موثق؛ استُبعدت من الفترة:", "The following sources contain records without a documented operational-event date; those records were excluded from the period:"),
    sourceNeedsDateReview: localize(language, "بيانات الفترة غير مكتملة — راجع تاريخ الحدث التشغيلي", "Period data incomplete — review operational-event dates"),
    reversedPeriod: localize(language, "تم اختيار تاريخ البداية بعد تاريخ النهاية؛ سيعرض التقرير النطاق بعد ترتيبه:", "The start date is after the end date; the report uses this normalized range:"),
    invalidPeriod: localize(language, "أدخل تاريخ بداية ونهاية صالحين من التقويم قبل عرض النتائج.", "Enter valid calendar start and end dates before viewing results."),
    openComprehensiveReport: localize(language, "فتح التقرير الشامل — التفاصيل والطباعة بنفس مصادر الحساب", "Open comprehensive report — details and printing use the same calculation sources"),
    print: localize(language, "طباعة التقرير", "Print report"),
    printUnavailable: localize(language, "تعذر طباعة التقرير", "Unable to print report"),
    printWait: localize(language, "انتظر حتى تكتمل جميع مصادر التقرير وتوثق تواريخ الأحداث التشغيلية ثم أعد المحاولة.", "Wait for all report sources to finish and for operational-event dates to be documented, then try again."),
    printInvalidPeriod: localize(language, "اختر تاريخ بداية ونهاية صالحين من التقويم قبل الطباعة.", "Choose valid start and end dates from the calendar before printing."),
    invalidQuantity: localize(language, "كمية غير صالحة — تحتاج مراجعة", "Invalid quantity — review required"),
    currency: localize(language, "ريال", "SAR"),
    invoice: localize(language, "فاتورة", "invoice"),
    receipt: localize(language, "سند", "receipt"),
    order: localize(language, "طلب", "order"),
    visit: localize(language, "زيارة", "visit"),
    gram: localize(language, "جم", "g"),
    yarn: localize(language, "خيوط", "yarn"),
    socks: localize(language, "جوارب", "socks"),
    used: localize(language, "مستخدمة", "used"),
    damaged: localize(language, "تالفة", "damaged"),
  };

  const sourceLabel = (source: string) => {
    const labels: Record<string, string> = {
      production: localize(language, "الإنتاج", "Production"),
      legacySales: localize(language, "سجل المبيعات السابق", "Legacy sales records"),
      sales: localize(language, "مبيعات المندوبين", "Representative sales"),
      collections: localize(language, "تحصيلات المندوبين", "Representative collections"),
      legacyCollections: localize(language, "سجل التحصيل السابق", "Legacy collection records"),
      transactions: localize(language, "طلبات وزيارات المندوبين", "Representative orders & visits"),
      expenses: localize(language, "المصروفات", "Expenses"),
      stock: localize(language, "المخزون", "Inventory"),
      movements: localize(language, "حركات المستودع", "Warehouse movements"),
    };
    return labels[source] || localize(language, "مصدر بيانات", "Data source");
  };

  const period = useMemo(() => {
    const requestedStart = reportDate(start);
    const requestedEnd = reportDate(end || start);
    const valid = Boolean(requestedStart && requestedEnd);
    const reversed = valid && requestedStart > requestedEnd;
    return {
      valid,
      reversed,
      startDate: reversed ? requestedEnd : requestedStart,
      endDate: reversed ? requestedStart : requestedEnd,
    };
  }, [start, end]);

  const commitStartDate = (value: string) => {
    const normalized = reportDate(value);
    if (normalized) setStart(normalized);
  };
  const commitEndDate = (value: string) => {
    const normalized = reportDate(value);
    if (normalized) setEnd(normalized);
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    const calls = {
      production: productionService.getAll(),
      legacySales: salesService.getAll(),
      sales: representativeService.sales.list(),
      collections: representativeService.collections.list(),
      legacyCollections: collectionService.getAll(),
      transactions: representativeService.transactions.list(),
      expenses: expensesService.getAll(),
      stock: finishedWarehouseService.list(),
      movements: finishedWarehouseService.movements(),
    };
    const keys = Object.keys(calls);
    Promise.allSettled(Object.values(calls)).then((results) => {
      if (!active) return;
      const data: Record<string, any[]> = {};
      const failures: Record<string, true> = {};
      results.forEach((result, index) => {
        const key = keys[index];
        if (result.status === "fulfilled" && hasReportRows(result.value)) {
          data[key] = sortRowsByBusinessDate(reportRows(result.value), sourceKinds[key] || "general");
        } else failures[key] = true;
      });
      setSources(data);
      setErrors(failures);
      setLoading(false);
    });
    return () => { active = false; };
  }, [refresh]);

  const data = useMemo(() => {
    const commercialData = commercialReport({
      sales: sources.sales || [],
      legacySales: sources.legacySales || [],
      collections: sources.collections || [],
      legacyCollections: sources.legacyCollections || [],
      transactions: sources.transactions || [],
      startDate: period.startDate,
      endDate: period.endDate,
    });
    const commercial = {
      ...commercialData,
      salesRows: sortRowsByBusinessDate(commercialData.salesRows, "sale"),
      collectionRows: sortRowsByBusinessDate(commercialData.collectionRows, "collection"),
      orderRows: sortRowsByBusinessDate(commercialData.orderRows, "transaction"),
      visitRows: sortRowsByBusinessDate(commercialData.visitRows, "transaction"),
      otherTransactionRows: sortRowsByBusinessDate(commercialData.otherTransactionRows, "transaction"),
    };
    const productionRows = (sources.production || [])
      .filter((row) => inReportPeriod(row, "production", period.startDate, period.endDate));
    const expenseRows = (sources.expenses || [])
      .filter((row) => inReportPeriod(row, "general", period.startDate, period.endDate));
    return {
      commercial,
      production: productionMetrics(productionRows),
      warehouse: warehousePeriod({ stock: sources.stock || [], movements: sources.movements || [], startDate: period.startDate, endDate: period.endDate }),
      expenses: expenseRows.reduce((sum, row) => sum + Number(row.amount || 0), 0),
    };
  }, [sources, period.startDate, period.endDate]);

  const { production: p, commercial: c, warehouse: w } = data;
  // السجل بلا تاريخ حدث تشغيلي لا يدخل الحساب. نبقي تنبيهًا ظاهرًا حتى لا يفسر
  // الصفر الناتج من استبعاده على أنه غياب مؤكد للنشاط.
  const undatedSourceKeys = useMemo(() => Object.entries(sources)
    .filter(([source, rows]) => {
      const kind = sourceKinds[source];
      return Boolean(kind && rows.some((row) => !businessDate(row, kind)));
    })
    .map(([source]) => source), [sources]);
  const numberFormat = (value: number) => value.toLocaleString(english ? "en-US" : "ar-SA");
  const decimalFormat = (value: number) => value.toLocaleString(english ? "en-US" : "ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const quantityLabel = (pairs: number) => {
    if (!english) return pairLabel(pairs);
    if (!Number.isSafeInteger(pairs)) return copy.invalidQuantity;
    const sign = pairs < 0 ? "−" : "";
    const value = Math.abs(pairs);
    return `${sign}${Math.floor(value / 12).toLocaleString("en-US")} dozen + ${value % 12} pairs`;
  };
  const alignedText = { textAlign, writingDirection: direction };
  const card = (label: string, value: string, keys: string[], path: string) => {
    const failed = keys.some((key) => errors[key]);
    const hasUndatedRows = keys.some((key) => undatedSourceKeys.includes(key));
    return (
      <TouchableOpacity key={label} style={s.card} onPress={() => router.push(path as never)}>
        <Text style={[s.label, alignedText]}>{label}</Text>
        <Text style={[s.value, alignedText, failed && s.error]}>{failed ? copy.sourceFailed : value}</Text>
        <Text style={[s.note, alignedText, hasUndatedRows && s.warning]}>{hasUndatedRows ? copy.sourceNeedsDateReview : copy.openDetails}</Text>
      </TouchableOpacity>
    );
  };

  const printReport = async () => {
    if (!period.valid) {
      Alert.alert(copy.printUnavailable, copy.printInvalidPeriod);
      return;
    }
    if (loading || Object.keys(errors).length) {
      Alert.alert(copy.printUnavailable, copy.printWait);
      return;
    }
    const rows = [
      [copy.totalProduction, quantityLabel(p.totalPairs)],
      [copy.firstGrade, quantityLabel(p.firstPairs)],
      [copy.secondGrade, quantityLabel(p.secondPairs)],
      [copy.salesInvoices, `${numberFormat(c.salesAmount)} ${copy.currency} · ${numberFormat(c.salesRows.length)} ${copy.invoice}`],
      [copy.collections, `${numberFormat(c.collectionAmount)} ${copy.currency} · ${numberFormat(c.collectionRows.length)} ${copy.receipt}`],
      [copy.ordersAndVisits, `${numberFormat(c.orderRows.length)} ${copy.order} · ${numberFormat(c.visitRows.length)} ${copy.visit}`],
      [copy.yarnUsed, `${decimalFormat(p.yarnGrams)} ${copy.gram}`],
      [copy.yarnAndSockWaste, `${numberFormat(p.wasteThreadGrams)} ${copy.gram} ${copy.yarn} · ${numberFormat(p.wasteSocksGrams)} ${copy.gram} ${copy.socks}`],
      [copy.totalWasteRate, p.wastePercent == null ? copy.noRecordedWeight : `${decimalFormat(p.wastePercent)}%`],
      [copy.needlesUsedAndDamaged, `${numberFormat(p.needlesUsed)} ${copy.used} · ${numberFormat(p.wasteNeedles)} ${copy.damaged}`],
      [copy.finishedGoodsReceipts, quantityLabel(w.receiptPairs)],
      [copy.finishedGoodsIssues, quantityLabel(w.issuePairs)],
      [copy.openingBalance, w.openingPairs == null ? copy.closingBalanceUnverified : quantityLabel(w.openingPairs)],
      [copy.closingBalance, w.closingPairs == null ? copy.closingBalanceUnverified : quantityLabel(w.closingPairs)],
      [copy.operatingExpenses, `${numberFormat(data.expenses)} ${copy.currency}`],
    ];
    const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character] || character));
    const undatedNotice = undatedSourceKeys.length
      ? `<p class="warning">${escapeHtml(copy.missingOperationalDate)} ${escapeHtml(undatedSourceKeys.map(sourceLabel).join(" · "))}.</p>`
      : "";
    const tableRows = rows.map(([label, value]) => `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`).join("");
    const html = `<html dir="${english ? "ltr" : "rtl"}"><head><meta charset="utf-8"><title>${escapeHtml(copy.title)}</title><style>@page{size:A4;margin:12mm}body{font-family:Arial,sans-serif;color:#0f172a;padding:12px;direction:${english ? "ltr" : "rtl"}}h1{color:#075985;font-size:20px}p{color:#475569}table{width:100%;border-collapse:collapse;margin-top:16px}th,td{border:1px solid #cbd5e1;padding:9px;text-align:${english ? "left" : "right"};vertical-align:top}th{width:54%;background:#e0f2fe;color:#0f172a}.warning{color:#92400e;background:#fffbeb;border:1px solid #fcd34d;padding:9px}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body><h1>${escapeHtml(copy.title)}</h1><p>${escapeHtml(copy.startDate)}: ${escapeHtml(period.startDate)} — ${escapeHtml(copy.endDate)}: ${escapeHtml(period.endDate)}</p>${undatedNotice}<table><tbody>${tableRows}</tbody></table><script>window.onload=function(){window.focus();setTimeout(function(){window.print()},250)}</script></body></html>`;
    if (Platform.OS === "web" && typeof window !== "undefined" && typeof document !== "undefined") {
      const printWindow = window.open("", "_blank", "width=1000,height=800");
      if (!printWindow) {
        Alert.alert(copy.printUnavailable, copy.printWait);
        return;
      }
      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
      return;
    }
    await Print.printAsync({ html });
  };

  return (
    <ScreenContainer>
      <View style={[s.header, { flexDirection: english ? "row" : "row-reverse" }]}>
        <BackButton />
        <Text style={[s.title, alignedText]}>{copy.title}</Text>
      </View>
      <ScrollView contentContainerStyle={s.content}>
        <View style={[s.range, { flexDirection: english ? "row" : "row-reverse" }]}>
          <DateField label={copy.startDate} value={start} onChange={commitStartDate} isAr={!english} style={s.date} />
          <DateField label={copy.endDate} value={end} onChange={commitEndDate} isAr={!english} style={s.date} />
          <TouchableOpacity style={s.button} onPress={() => setRefresh((value) => value + 1)} accessibilityRole="button" accessibilityLabel={copy.refresh}>
            <Text style={[s.buttonText, { writingDirection: direction }]}>{copy.refresh}</Text>
          </TouchableOpacity>
        </View>
        <Text style={[s.note, alignedText]}>{copy.periodSummary}</Text>
        {period.reversed ? <Text accessibilityRole="alert" style={[s.error, alignedText]}>{copy.reversedPeriod} {period.startDate} — {period.endDate}</Text> : null}
        {loading ? (
          <View style={s.loading} accessible accessibilityLabel={copy.loading}>
            <ActivityIndicator color="#075985" />
            <Text style={[s.note, alignedText]}>{copy.loading}</Text>
          </View>
        ) : !period.valid ? (
          <Text accessibilityRole="alert" style={[s.error, alignedText]}>{copy.invalidPeriod}</Text>
        ) : (
          <>
            <View style={[s.grid, { flexDirection: english ? "row" : "row-reverse" }]}>
              {card(copy.totalProduction, quantityLabel(p.totalPairs), ["production"], "/production-totals")}
              {card(copy.firstGrade, quantityLabel(p.firstPairs), ["production"], "/production-totals")}
              {card(copy.secondGrade, quantityLabel(p.secondPairs), ["production"], "/production-totals")}
              {card(copy.salesInvoices, `${numberFormat(c.salesAmount)} ${copy.currency} · ${numberFormat(c.salesRows.length)} ${copy.invoice}`, ["sales", "legacySales"], "/representative-reports")}
              {card(copy.collections, `${numberFormat(c.collectionAmount)} ${copy.currency} · ${numberFormat(c.collectionRows.length)} ${copy.receipt}`, ["collections", "legacyCollections"], "/representative-reports")}
              {card(copy.ordersAndVisits, `${numberFormat(c.orderRows.length)} ${copy.order} · ${numberFormat(c.visitRows.length)} ${copy.visit}`, ["transactions"], "/representative-reports")}
              {card(copy.yarnUsed, `${decimalFormat(p.yarnGrams)} ${copy.gram}`, ["production"], "/production-totals")}
              {card(copy.yarnAndSockWaste, `${numberFormat(p.wasteThreadGrams)} ${copy.gram} ${copy.yarn} · ${numberFormat(p.wasteSocksGrams)} ${copy.gram} ${copy.socks}`, ["production"], "/production-totals")}
              {card(copy.totalWasteRate, p.wastePercent == null ? copy.noRecordedWeight : `${decimalFormat(p.wastePercent)}%`, ["production"], "/production-totals")}
              {card(copy.needlesUsedAndDamaged, `${numberFormat(p.needlesUsed)} ${copy.used} · ${numberFormat(p.wasteNeedles)} ${copy.damaged}`, ["production"], "/production-totals")}
              {card(copy.finishedGoodsReceipts, quantityLabel(w.receiptPairs), ["movements"], "/finished-warehouse-inventory")}
              {card(copy.finishedGoodsIssues, quantityLabel(w.issuePairs), ["movements"], "/finished-warehouse-inventory")}
              {card(copy.closingBalance, w.closingPairs == null ? copy.closingBalanceUnverified : quantityLabel(w.closingPairs), ["stock", "movements"], "/finished-warehouse-inventory")}
              {card(copy.operatingExpenses, `${numberFormat(data.expenses)} ${copy.currency}`, ["expenses"], "/daily-summary")}
            </View>
            <TouchableOpacity style={s.button} onPress={() => router.push("/daily-summary" as never)} accessibilityRole="button" accessibilityLabel={copy.openComprehensiveReport}>
              <Text style={[s.buttonText, { writingDirection: direction }]}>{copy.openComprehensiveReport}</Text>
            </TouchableOpacity>
          </>
        )}
        {!loading && Object.keys(errors).length ? (
          <Text accessibilityRole="alert" style={[s.error, alignedText]}>
            {copy.incompleteSources} {Object.keys(errors).map(sourceLabel).join(" · ")}. {copy.notZeroActivity}
          </Text>
        ) : null}
      </ScrollView>
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  header: { backgroundColor: "#075985", padding: 10, alignItems: "center", gap: 10 },
  title: { flex: 1, fontSize: 18, fontWeight: "800", color: "#fff" },
  content: { padding: 12, gap: 10, maxWidth: 1180, width: "100%", alignSelf: "center" },
  range: { flexWrap: "wrap", gap: 8, alignItems: "center" },
  date: { flex: 1, minWidth: 150 },
  grid: { flexWrap: "wrap", gap: 8 },
  card: { flexGrow: 1, flexBasis: 250, borderWidth: 1, borderColor: "#d7e4ec", backgroundColor: "#fff", borderRadius: 8, padding: 10, gap: 5 },
  label: { fontWeight: "700", fontSize: 12, color: "#334155" },
  value: { fontWeight: "800", fontSize: 17, color: "#075985" },
  note: { fontSize: 11, lineHeight: 17, color: "#64748b" },
  warning: { color: "#92400e" },
  error: { color: "#b91c1c", fontSize: 12 },
  button: { padding: 10, borderRadius: 7, backgroundColor: "#075985", alignItems: "center", minHeight: 44 },
  buttonText: { fontWeight: "700", fontSize: 12, color: "#fff", textAlign: "center" },
  loading: { minHeight: 80, justifyContent: "center", alignItems: "center", gap: 8 },
});
