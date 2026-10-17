import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Alert,
  Platform,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { DateField } from "@/components/date-field";
import { useColors } from "@/hooks/use-colors";
import { useLanguage } from "@/lib/language-context";
import { BackButton } from "@/components/back-button";
import { productionCostsLocalService, productionService, savedProductCostsService } from "@/lib/services/api.service";
import { businessDate, exactPairs, inReportPeriod, reportDate } from "@shared/operational-report";
import { LineChart } from "react-native-chart-kit";
import { MaterialIcons } from "@expo/vector-icons";
import * as Print from "expo-print";

interface MonthlyComparison {
  month: string;
  expectedCost: number | null;
  actualCost: number | null;
  variance: number | null;
  variancePercent: number | null;
  productionPairs: number | null;
  costPerUnit: number | null;
}

interface Aggregation {
  months: Map<string, number>;
  invalidDateRows: number;
  invalidValueRows: number;
}

type LoadedRows = { rows: any[] | null; error: string | null };

function finiteValue(value: unknown): number | null {
  if (value == null || value === "" || typeof value === "boolean") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

function aggregateRows(
  rows: any[],
  kind: "general" | "production",
  startDate: string,
  endDate: string,
  valueFor: (row: any) => number | null,
): Aggregation {
  const months = new Map<string, number>();
  let invalidDateRows = 0;
  let invalidValueRows = 0;

  for (const row of rows) {
    const date = businessDate(row, kind);
    if (!date) {
      invalidDateRows++;
      continue;
    }
    if (!inReportPeriod(row, kind, startDate, endDate)) continue;

    const value = valueFor(row);
    if (value == null) {
      invalidValueRows++;
      continue;
    }
    const month = date.slice(0, 7);
    months.set(month, (months.get(month) ?? 0) + value);
  }

  return { months, invalidDateRows, invalidValueRows };
}

function buildComparisons(
  expected: Aggregation,
  actual: Aggregation,
  production: Aggregation,
): MonthlyComparison[] {
  const months = new Set([
    ...expected.months.keys(),
    ...actual.months.keys(),
    ...production.months.keys(),
  ]);

  return Array.from(months)
    .map((month) => {
      const expectedCost = expected.months.get(month) ?? null;
      const actualCost = actual.months.get(month) ?? null;
      const productionPairs = production.months.get(month) ?? null;
      const variance = expectedCost == null || actualCost == null ? null : expectedCost - actualCost;
      const variancePercent = variance == null || expectedCost == null || expectedCost === 0
        ? null
        : (variance / expectedCost) * 100;
      const costPerUnit = actualCost == null || productionPairs == null || productionPairs <= 0
        ? null
        : actualCost / productionPairs;

      return {
        month,
        expectedCost,
        actualCost,
        variance,
        variancePercent,
        productionPairs,
        costPerUnit,
      };
    })
    .sort((a, b) => a.month.localeCompare(b.month));
}

function loadRows(result: PromiseSettledResult<unknown>): LoadedRows {
  if (result.status === "rejected") {
    return { rows: null, error: result.reason instanceof Error ? result.reason.message : String(result.reason) };
  }
  if (!Array.isArray(result.value)) {
    return { rows: null, error: "The source returned an invalid response." };
  }
  return { rows: result.value, error: null };
}

function sourceDiagnostics(label: string, aggregation: Aggregation, isAr: boolean): string[] {
  const messages: string[] = [];
  if (aggregation.invalidDateRows > 0) {
    messages.push(isAr
      ? `${label}: استُبعدت ${aggregation.invalidDateRows} سجلات بلا تاريخ تقرير صالح.`
      : `${label}: ${aggregation.invalidDateRows} row(s) without a valid report date were excluded.`);
  }
  if (aggregation.invalidValueRows > 0) {
    messages.push(isAr
      ? `${label}: استُبعدت ${aggregation.invalidValueRows} سجلات بقيمة غير صالحة.`
      : `${label}: ${aggregation.invalidValueRows} row(s) with an invalid value were excluded.`);
  }
  return messages;
}

export default function CostComparisonReportScreen() {
  const colors = useColors();
  const { language, isRtl } = useLanguage();
  const isAr = language === "ar";
  const latestLoad = useRef(0);
  const [comparisons, setComparisons] = useState<MonthlyComparison[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(() => reportDate(new Date()));
  const [endDate, setEndDate] = useState(() => reportDate(new Date()));
  const [dataMessages, setDataMessages] = useState<string[]>([]);

  const normalizedStart = reportDate(startDate);
  const normalizedEnd = reportDate(endDate);
  const invalidPeriod = !normalizedStart || !normalizedEnd;
  const reversedPeriod = !invalidPeriod && normalizedStart > normalizedEnd;
  const periodStart = reversedPeriod ? normalizedEnd : normalizedStart;
  const periodEnd = reversedPeriod ? normalizedStart : normalizedEnd;

  const loadComparisons = async () => {
    const loadId = ++latestLoad.current;
    if (!periodStart || !periodEnd) {
      if (loadId === latestLoad.current) {
        setComparisons([]);
        setDataMessages([isAr ? "تاريخا الفترة غير صالحين؛ اختر التاريخين من التقويم." : "The report dates are invalid; choose both dates from the calendar."]);
        setIsLoading(false);
      }
      return;
    }

    setIsLoading(true);
    setSelectedMonth(null);
    const messages: string[] = reversedPeriod
      ? [isAr
        ? `تم عكس حدود الفترة تلقائياً للعرض: ${periodStart} إلى ${periodEnd}.`
        : `The reversed date bounds are displayed in chronological order: ${periodStart} to ${periodEnd}.`]
      : [];

    const [actualResult, expectedResult, productionResult] = await Promise.allSettled([
      Promise.resolve().then(() => productionCostsLocalService.list()),
      Promise.resolve().then(() => savedProductCostsService.list()),
      Promise.resolve().then(() => productionService.getAll()),
    ]);

    const actualRows = loadRows(actualResult);
    const expectedRows = loadRows(expectedResult);
    const productionRows = loadRows(productionResult);
    const sources = [
      {
        label: isAr ? "مصدر التكاليف الفعلية" : "Actual-cost source",
        result: actualRows,
        // Cost rows represent production work. Limit their period date strictly to
        // productionDate/date; never use generic, audit, or record-save timestamps.
        kind: "production" as const,
        valueFor: (row: any) => finiteValue(row.amount),
      },
      {
        label: isAr ? "مصدر التكلفة التقديرية" : "Estimated-cost source",
        result: expectedRows,
        // The saved estimate's explicit date is its documented production-cost date.
        kind: "production" as const,
        valueFor: (row: any) => finiteValue(row.totalCost),
      },
      {
        label: isAr ? "مصدر الإنتاج" : "Production source",
        result: productionRows,
        kind: "production" as const,
        valueFor: (row: any) => {
          const pairs = exactPairs(row, "production");
          return Number.isFinite(pairs) ? pairs : null;
        },
      },
    ];

    const aggregations = sources.map((source) => {
      if (!source.result.rows) {
        messages.push(isAr
          ? `${source.label} تعذر تحميله: ${source.result.error}. لم يُستبدل بأصفار.`
          : `${source.label} failed to load: ${source.result.error}. It was not replaced with zeroes.`);
        return { months: new Map<string, number>(), invalidDateRows: 0, invalidValueRows: 0 };
      }
      const aggregation = aggregateRows(source.result.rows, source.kind, periodStart, periodEnd, source.valueFor);
      messages.push(...sourceDiagnostics(source.label, aggregation, isAr));
      return aggregation;
    });

    if (loadId !== latestLoad.current) return;
    setComparisons(buildComparisons(aggregations[1], aggregations[0], aggregations[2]));
    setDataMessages(messages);
    setIsLoading(false);
  };

  useEffect(() => {
    void loadComparisons();
  }, [startDate, endDate]);

  const chartRows = comparisons.filter((comparison): comparison is MonthlyComparison & { expectedCost: number; actualCost: number } =>
    comparison.expectedCost != null && comparison.actualCost != null,
  );
  const chartData = chartRows.length >= 2 ? {
    labels: chartRows.map((row) => row.month),
    datasets: [
      {
        data: chartRows.map((row) => row.expectedCost / 1000),
        color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
        strokeWidth: 2,
      },
      {
        data: chartRows.map((row) => row.actualCost / 1000),
        color: (opacity = 1) => `rgba(34, 197, 94, ${opacity})`,
        strokeWidth: 2,
      },
    ],
    legend: [isAr ? "التقديرية" : "Estimated", isAr ? "الفعلية" : "Actual"],
  } : null;

  const sumAvailable = (field: "expectedCost" | "actualCost" | "productionPairs"): number | null => {
    const values = comparisons.map((comparison) => comparison[field]).filter((value): value is number => value != null);
    return values.length ? values.reduce((sum, value) => sum + value, 0) : null;
  };
  const totalExpected = sumAvailable("expectedCost");
  const totalActual = sumAvailable("actualCost");
  const totalProduction = sumAvailable("productionPairs");
  const totalVariance = totalExpected == null || totalActual == null ? null : totalExpected - totalActual;
  const totalCostPerUnit = totalActual == null || totalProduction == null || totalProduction <= 0
    ? null
    : totalActual / totalProduction;
  const numberLocale = isAr ? "ar-SA" : "en-US";
  const unavailable = isAr ? "غير متاح" : "Unavailable";
  const formatNumber = (value: number | null, fractionDigits = 0) => value == null
    ? unavailable
    : value.toLocaleString(numberLocale, { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits });
  const formatPercent = (value: number | null) => value == null ? unavailable : `${formatNumber(value, 1)}%`;
  const screenWidth = Dimensions.get("window").width;

  const handlePrint = async () => {
    if (!periodStart || !periodEnd) {
      Alert.alert(
        isAr ? "تاريخ التقرير غير صالح" : "Invalid report dates",
        isAr ? "اختر تاريخي بداية ونهاية صالحين من التقويم قبل الطباعة." : "Choose valid start and end dates from the calendar before printing.",
      );
      return;
    }

    const summaryRows = [
      [isAr ? "إجمالي التكلفة التقديرية" : "Total estimated cost", formatNumber(totalExpected, 2)],
      [isAr ? "إجمالي التكلفة الفعلية" : "Total actual cost", formatNumber(totalActual, 2)],
      [isAr ? "التباين (التقديرية − الفعلية)" : "Variance (estimated − actual)", formatNumber(totalVariance, 2)],
      [isAr ? "إنتاج مسجل (زوج)" : "Recorded production (pairs)", formatNumber(totalProduction)],
      [isAr ? "التكلفة الفعلية للزوج" : "Actual cost per pair", formatNumber(totalCostPerUnit, 2)],
    ];
    const detailRows = comparisons.map((comparison) => `<tr>
      <td>${escapeHtml(comparison.month)}</td>
      <td>${escapeHtml(formatNumber(comparison.expectedCost, 2))}</td>
      <td>${escapeHtml(formatNumber(comparison.actualCost, 2))}</td>
      <td>${escapeHtml(formatNumber(comparison.variance, 2))}</td>
      <td>${escapeHtml(formatPercent(comparison.variancePercent))}</td>
      <td>${escapeHtml(formatNumber(comparison.productionPairs))}</td>
      <td>${escapeHtml(formatNumber(comparison.costPerUnit, 2))}</td>
    </tr>`).join("");
    const notes = dataMessages.length
      ? `<section class="notes"><strong>${escapeHtml(isAr ? "ملاحظات سلامة بيانات التقرير" : "Report data integrity notes")}</strong><ul>${dataMessages.map((message) => `<li>${escapeHtml(message)}</li>`).join("")}</ul></section>`
      : "";
    const html = `<!doctype html><html dir="${isRtl ? "rtl" : "ltr"}" lang="${isAr ? "ar" : "en"}"><head><meta charset="utf-8"><title>${escapeHtml(isAr ? "تقرير مقارنة التكاليف" : "Cost Comparison Report")}</title><style>@page{size:A4 landscape;margin:10mm}body{font-family:Tahoma,Arial,sans-serif;color:#172033;margin:0;font-size:12px}h1{font-size:20px;margin:0 0 6px}h2{font-size:15px;margin:20px 0 8px;color:#075985}p{margin:0 0 12px;color:#475569}.summary{width:100%;border-collapse:separate;border-spacing:7px}.summary td{border:1px solid #cbd5e1;border-radius:6px;padding:9px;width:50%}.summary strong{display:block;margin-top:4px;color:#0f172a}table{width:100%;border-collapse:collapse}th,td{border:1px solid #cbd5e1;padding:7px;text-align:${isRtl ? "right" : "left"};vertical-align:top}th{background:#e0f2fe}.notes{background:#fef3c7;border:1px solid #f59e0b;border-radius:6px;padding:10px;line-height:1.6}.notes ul{margin:5px 0 0;padding-inline-start:20px}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body><h1>${escapeHtml(isAr ? "تقرير مقارنة التكاليف" : "Cost Comparison Report")}</h1><p>${escapeHtml(isAr ? "الفترة المعتمدة" : "Applied period")}: ${escapeHtml(periodStart)} ${escapeHtml(isAr ? "إلى" : "to")} ${escapeHtml(periodEnd)}${reversedPeriod ? escapeHtml(isAr ? " (أُعيد ترتيب حدود التاريخ المدخلة)" : " (entered date bounds were reordered)") : ""}</p><h2>${escapeHtml(isAr ? "ملخص الفترة" : "Period summary")}</h2><table class="summary"><tbody><tr>${summaryRows.slice(0, 2).map(([label, value]) => `<td>${escapeHtml(label)}<strong>${escapeHtml(value)}</strong></td>`).join("")}</tr><tr>${summaryRows.slice(2, 4).map(([label, value]) => `<td>${escapeHtml(label)}<strong>${escapeHtml(value)}</strong></td>`).join("")}</tr><tr><td>${escapeHtml(summaryRows[4][0])}<strong>${escapeHtml(summaryRows[4][1])}</strong></td><td></td></tr></tbody></table>${notes}<h2>${escapeHtml(isAr ? "التفاصيل الشهرية" : "Monthly details")}</h2><table><thead><tr><th>${escapeHtml(isAr ? "الشهر" : "Month")}</th><th>${escapeHtml(isAr ? "التقديرية" : "Estimated")}</th><th>${escapeHtml(isAr ? "الفعلية" : "Actual")}</th><th>${escapeHtml(isAr ? "التباين" : "Variance")}</th><th>${escapeHtml(isAr ? "نسبة التباين" : "Variance %")}</th><th>${escapeHtml(isAr ? "الإنتاج (زوج)" : "Production (pairs)")}</th><th>${escapeHtml(isAr ? "الفعلية للزوج" : "Actual per pair")}</th></tr></thead><tbody>${detailRows || `<tr><td colspan="7">${escapeHtml(isAr ? "لا توجد سجلات قابلة للتقرير ضمن الفترة المحددة." : "There are no reportable records in the selected period.")}</td></tr>`}</tbody></table></body></html>`;

    try {
      if (Platform.OS === "web" && typeof window !== "undefined" && typeof document !== "undefined") {
        const printWindow = window.open("", "_blank", "width=1200,height=850");
        if (!printWindow) throw new Error("PRINT_WINDOW_BLOCKED");
        printWindow.document.open();
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        window.setTimeout(() => printWindow.print(), 250);
      } else {
        await Print.printAsync({ html, orientation: Print.Orientation.landscape });
      }
    } catch {
      Alert.alert(
        isAr ? "تعذر فتح الطباعة" : "Unable to print",
        isAr ? "تعذر فتح نافذة الطباعة. اسمح بالنوافذ المنبثقة ثم حاول مرة أخرى." : "Unable to open printing. Allow pop-ups and try again.",
      );
    }
  };

  if (isLoading) {
    return (
      <ScreenContainer>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <BackButton />
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 16 }}>
        <Text
          style={{
            fontSize: 24,
            fontWeight: "bold",
            color: colors.foreground,
            marginBottom: 16,
            textAlign: isRtl ? "right" : "left",
          }}
        >
          {isAr ? "تقرير مقارنة التكاليف" : "Cost Comparison Report"}
        </Text>

        <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: colors.border }}>
          <Text style={{ fontSize: 16, fontWeight: "bold", color: colors.foreground, marginBottom: 12, textAlign: isRtl ? "right" : "left" }}>
            {isAr ? "فترة التقرير" : "Report period"}
          </Text>
          <DateField
            value={startDate}
            onChange={setStartDate}
            label={isAr ? "تاريخ البداية" : "Start date"}
            accessibilityLabel={isAr ? "اختيار تاريخ بداية تقرير مقارنة التكاليف" : "Choose cost comparison report start date"}
            isAr={isAr}
            style={{ marginBottom: 8 }}
          />
          <DateField
            value={endDate}
            onChange={setEndDate}
            label={isAr ? "تاريخ النهاية" : "End date"}
            accessibilityLabel={isAr ? "اختيار تاريخ نهاية تقرير مقارنة التكاليف" : "Choose cost comparison report end date"}
            isAr={isAr}
          />
          {reversedPeriod ? (
            <Text style={{ color: "#b45309", fontSize: 12, marginTop: 10, textAlign: isRtl ? "right" : "left" }}>
              {isAr ? `النطاق المدخل معكوس؛ تُفلتر السجلات من ${periodStart} إلى ${periodEnd}.` : `The entered range is reversed; rows are filtered from ${periodStart} to ${periodEnd}.`}
            </Text>
          ) : null}
          {invalidPeriod ? (
            <Text style={{ color: "#dc2626", fontSize: 12, marginTop: 10, textAlign: isRtl ? "right" : "left" }}>
              {isAr ? "اختر تاريخين صالحين من التقويم قبل احتساب التقرير." : "Choose two valid calendar dates before calculating the report."}
            </Text>
          ) : null}
          <Text style={{ color: colors.muted, fontSize: 11, marginTop: 10, textAlign: isRtl ? "right" : "left" }}>
            {isAr
              ? "تُجمع التكلفة التقديرية من تقديرات تكلفة المنتج المحفوظة، والفعلية من سجل تكاليف الإنتاج، والإنتاج من سجل الإنتاج. لا يدخل أي سجل إلا بتاريخ الإنتاج الموثق فيه؛ السجل بلا تاريخ لا يُنسب لتاريخ إنشائه. غياب السجل يعرض كغير متاح وليس صفراً."
              : "Estimated cost comes from saved product-cost estimates, actual cost from production-cost records, and volume from production records. A row is included only by its documented production date, never its creation date. A missing record is shown as unavailable, not zero."}
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => void handlePrint()}
          accessibilityRole="button"
          accessibilityLabel={isAr ? "طباعة تقرير مقارنة التكاليف للفترة المحددة" : "Print cost comparison report for the selected period"}
          style={{ flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 16, marginBottom: 16 }}
        >
          <MaterialIcons name="print" size={20} color="#fff" />
          <Text style={{ color: "#fff", fontWeight: "bold" }}>{isAr ? "طباعة / حفظ PDF" : "Print / Save PDF"}</Text>
        </TouchableOpacity>

        {dataMessages.length > 0 ? (
          <View style={{ backgroundColor: "#fef3c7", borderColor: "#f59e0b", borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 16 }}>
            <Text style={{ color: "#92400e", fontWeight: "800", marginBottom: 6, textAlign: isRtl ? "right" : "left" }}>
              {isAr ? "ملاحظات سلامة بيانات التقرير" : "Report data integrity notes"}
            </Text>
            {dataMessages.map((message, index) => (
              <Text key={`${message}-${index}`} style={{ color: "#92400e", fontSize: 12, marginTop: 3, textAlign: isRtl ? "right" : "left" }}>
                • {message}
              </Text>
            ))}
          </View>
        ) : null}

        {chartData ? (
          <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ fontSize: 16, fontWeight: "bold", color: colors.foreground, marginBottom: 12 }}>
              {isAr ? "اتجاه التكاليف الشهرية القابلة للمقارنة" : "Comparable monthly cost trend"}
            </Text>
            <LineChart
              data={chartData}
              width={screenWidth - 64}
              height={220}
              chartConfig={{
                backgroundColor: colors.surface,
                backgroundGradientFrom: colors.surface,
                backgroundGradientTo: colors.surface,
                decimalPlaces: 0,
                color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                labelColor: () => colors.foreground,
                style: { borderRadius: 16 },
                propsForDots: { r: "6", strokeWidth: "2", stroke: colors.primary },
              }}
              bezier
              yAxisLabel=""
              yAxisSuffix=""
            />
          </View>
        ) : comparisons.length > 0 ? (
          <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ color: colors.muted, fontSize: 12, textAlign: isRtl ? "right" : "left" }}>
              {isAr ? "يظهر الرسم عند توفر شهرين على الأقل بهما تكلفة تقديرية وفعلية؛ لا تُملأ القيم الناقصة بصفر." : "The chart appears when at least two months have both estimated and actual cost; missing values are never filled with zero."}
            </Text>
          </View>
        ) : null}

        <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: colors.border }}>
          <Text style={{ fontSize: 16, fontWeight: "bold", color: colors.foreground, marginBottom: 12, textAlign: isRtl ? "right" : "left" }}>
            {isAr ? "ملخص الفترة" : "Period summary"}
          </Text>
          <View style={{ gap: 8 }}>
            {[
              [isAr ? "إجمالي التكلفة التقديرية" : "Total estimated cost", formatNumber(totalExpected, 2)],
              [isAr ? "إجمالي التكلفة الفعلية" : "Total actual cost", formatNumber(totalActual, 2)],
              [isAr ? "التباين (التقديرية − الفعلية)" : "Variance (estimated − actual)", formatNumber(totalVariance, 2)],
              [isAr ? "إنتاج مسجل (زوج)" : "Recorded production (pairs)", formatNumber(totalProduction)],
              [isAr ? "التكلفة الفعلية للزوج" : "Actual cost per pair", formatNumber(totalCostPerUnit, 2)],
            ].map(([label, value], index) => (
              <View key={String(label)} style={{ flexDirection: "row", justifyContent: "space-between", paddingBottom: index < 4 ? 8 : 0, borderBottomWidth: index < 4 ? 1 : 0, borderBottomColor: colors.border }}>
                <Text style={{ color: colors.muted }}>{label}</Text>
                <Text style={{ color: colors.foreground, fontWeight: "bold" }}>{value}</Text>
              </View>
            ))}
          </View>
        </View>

        <Text style={{ fontSize: 16, fontWeight: "bold", color: colors.foreground, marginBottom: 12, textAlign: isRtl ? "right" : "left" }}>
          {isAr ? "التفاصيل الشهرية — مرتبة من الأقدم إلى الأحدث" : "Monthly details — oldest to newest"}
        </Text>

        {comparisons.length === 0 ? (
          <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ color: colors.muted, textAlign: isRtl ? "right" : "left" }}>
              {isAr ? "لا توجد سجلات قابلة للتقرير ضمن الفترة المحددة." : "There are no reportable records in the selected period."}
            </Text>
          </View>
        ) : comparisons.map((comparison) => {
          const varianceColor = comparison.variance == null ? colors.muted : comparison.variance >= 0 ? "#22c55e" : "#ef4444";
          return (
            <TouchableOpacity
              key={comparison.month}
              onPress={() => setSelectedMonth(selectedMonth === comparison.month ? null : comparison.month)}
              style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.border }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View>
                  <Text style={{ fontSize: 14, fontWeight: "bold", color: colors.foreground }}>{comparison.month}</Text>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>
                    {isAr ? "إنتاج مسجل: " : "Recorded production: "}{formatNumber(comparison.productionPairs)} {isAr ? "زوج" : "pairs"}
                  </Text>
                </View>
                <View style={{ alignItems: isRtl ? "flex-start" : "flex-end" }}>
                  <Text style={{ color: varianceColor, fontWeight: "bold" }}>
                    {comparison.variance != null && comparison.variance >= 0 ? "+" : ""}{formatNumber(comparison.variance, 2)} ({formatPercent(comparison.variancePercent)})
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>{isAr ? "التباين" : "Variance"}</Text>
                </View>
              </View>

              {selectedMonth === comparison.month ? (
                <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border, gap: 8 }}>
                  {[
                    [isAr ? "التكلفة التقديرية" : "Estimated cost", formatNumber(comparison.expectedCost, 2)],
                    [isAr ? "التكلفة الفعلية" : "Actual cost", formatNumber(comparison.actualCost, 2)],
                    [isAr ? "التباين (التقديرية − الفعلية)" : "Variance (estimated − actual)", formatNumber(comparison.variance, 2)],
                    [isAr ? "إنتاج مسجل" : "Recorded production", `${formatNumber(comparison.productionPairs)} ${isAr ? "زوج" : "pairs"}`],
                    [isAr ? "التكلفة الفعلية للزوج" : "Actual cost per pair", formatNumber(comparison.costPerUnit, 2)],
                  ].map(([label, value]) => (
                    <View key={String(label)} style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <Text style={{ color: colors.muted }}>{label}</Text>
                      <Text style={{ color: colors.foreground, fontWeight: "bold" }}>{value}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </ScreenContainer>
  );
}
