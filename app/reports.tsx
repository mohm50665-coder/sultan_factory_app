import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { BackButton } from "@/components/back-button";
import { DateField } from "@/components/date-field";
import { ScreenContainer } from "@/components/screen-container";
import { useLanguage } from "@/lib/language-context";
import { isEnglish, localize, textAlignFor, writingDirection } from "@/lib/i18n/runtime";
import { collectionService, expensesService, finishedWarehouseService, productionService, salesService } from "@/lib/services/api.service";
import { representativeService } from "@/lib/services/representative.service";
import { commercialReport, inReportPeriod, pairLabel, productionMetrics, reportRows, riyadhDate, warehousePeriod } from "@shared/operational-report";

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
    periodSummary: localize(language, "جميع المؤشرات لحركة الفترة المختارة، والمخزون الحالي معروض بوصفه رصيدًا لا حركة إنتاج جديدة.", "All indicators reflect activity in the selected period. Current inventory is shown as a balance, not as new production activity."),
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
    currentWarehouseBalance: localize(language, "رصيد المستودع الحالي", "Current warehouse balance"),
    operatingExpenses: localize(language, "المصروفات التشغيلية", "Operating expenses"),
    noRecordedWeight: localize(language, "لا تحسب — وزن غير مسجل", "Not calculated — no weight recorded"),
    closingBalanceUnverified: localize(language, "غير مؤكد — يلزم مراجعة الدفتر", "Unverified — ledger review required"),
    incompleteSources: localize(language, "لم تكتمل المصادر التالية:", "The following sources did not finish loading:"),
    notZeroActivity: localize(language, "لا تعتبرها صفر نشاط.", "Do not treat these as zero activity."),
    openComprehensiveReport: localize(language, "فتح التقرير الشامل — التفاصيل والطباعة بنفس مصادر الحساب", "Open comprehensive report — details and printing use the same calculation sources"),
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
        if (result.status === "fulfilled") data[keys[index]] = reportRows(result.value);
        else failures[keys[index]] = true;
      });
      setSources(data);
      setErrors(failures);
      setLoading(false);
    });
    return () => { active = false; };
  }, [refresh]);

  const data = useMemo(() => {
    const commercial = commercialReport({
      sales: sources.sales || [],
      legacySales: sources.legacySales || [],
      collections: sources.collections || [],
      legacyCollections: sources.legacyCollections || [],
      transactions: sources.transactions || [],
      startDate: start,
      endDate: end,
    });
    return {
      commercial,
      production: productionMetrics((sources.production || []).filter((row) => inReportPeriod(row, "production", start, end))),
      warehouse: warehousePeriod({ stock: sources.stock || [], movements: sources.movements || [], startDate: start, endDate: end }),
      expenses: (sources.expenses || []).filter((row) => inReportPeriod(row, "general", start, end)).reduce((sum, row) => sum + Number(row.amount || 0), 0),
    };
  }, [sources, start, end]);

  const { production: p, commercial: c, warehouse: w } = data;
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
    return (
      <TouchableOpacity key={label} style={s.card} onPress={() => router.push(path as never)}>
        <Text style={[s.label, alignedText]}>{label}</Text>
        <Text style={[s.value, alignedText, failed && s.error]}>{failed ? copy.sourceFailed : value}</Text>
        <Text style={[s.note, alignedText]}>{copy.openDetails}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <ScreenContainer>
      <View style={[s.header, { flexDirection: english ? "row" : "row-reverse" }]}>
        <BackButton />
        <Text style={[s.title, alignedText]}>{copy.title}</Text>
      </View>
      <ScrollView contentContainerStyle={s.content}>
        <View style={[s.range, { flexDirection: english ? "row" : "row-reverse" }]}>
          <DateField label={copy.startDate} value={start} onChange={setStart} isAr={!english} style={s.date} />
          <DateField label={copy.endDate} value={end} onChange={setEnd} isAr={!english} style={s.date} />
          <TouchableOpacity style={s.button} onPress={() => setRefresh((value) => value + 1)} accessibilityRole="button" accessibilityLabel={copy.refresh}>
            <Text style={[s.buttonText, { writingDirection: direction }]}>{copy.refresh}</Text>
          </TouchableOpacity>
        </View>
        <Text style={[s.note, alignedText]}>{copy.periodSummary}</Text>
        {loading ? (
          <View style={s.loading} accessible accessibilityLabel={copy.loading}>
            <ActivityIndicator color="#075985" />
            <Text style={[s.note, alignedText]}>{copy.loading}</Text>
          </View>
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
              {card(copy.currentWarehouseBalance, quantityLabel(w.currentPairs), ["stock"], "/finished-warehouse-inventory")}
              {card(copy.operatingExpenses, `${numberFormat(data.expenses)} ${copy.currency}`, ["expenses"], "/daily-summary")}
            </View>
            {Object.keys(errors).length ? (
              <Text accessibilityRole="alert" style={[s.error, alignedText]}>
                {copy.incompleteSources} {Object.keys(errors).map(sourceLabel).join(" · ")}. {copy.notZeroActivity}
              </Text>
            ) : null}
            <TouchableOpacity style={s.button} onPress={() => router.push("/daily-summary" as never)} accessibilityRole="button" accessibilityLabel={copy.openComprehensiveReport}>
              <Text style={[s.buttonText, { writingDirection: direction }]}>{copy.openComprehensiveReport}</Text>
            </TouchableOpacity>
          </>
        )}
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
  error: { color: "#b91c1c", fontSize: 12 },
  button: { padding: 10, borderRadius: 7, backgroundColor: "#075985", alignItems: "center", minHeight: 44 },
  buttonText: { fontWeight: "700", fontSize: 12, color: "#fff", textAlign: "center" },
  loading: { minHeight: 80, justifyContent: "center", alignItems: "center", gap: 8 },
});
