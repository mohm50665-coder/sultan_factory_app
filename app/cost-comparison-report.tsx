import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { DateField } from "@/components/date-field";
import { useColors } from "@/hooks/use-colors";
import { useLanguage } from "@/lib/language-context";
import { BackButton } from "@/components/back-button";
import { productionCostsLocalService, productionService, savedProductCostsService } from "@/lib/services/api.service";
import { businessDate, exactPairs, inReportPeriod, reportDate } from "@shared/operational-report";
import { LineChart } from "react-native-chart-kit";

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
    if (!periodStart || !periodEnd) {
      setComparisons([]);
      setDataMessages([isAr ? "تاريخا الفترة غير صالحين؛ اختر التاريخين من التقويم." : "The report dates are invalid; choose both dates from the calendar."]);
      setIsLoading(false);
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
        kind: "general" as const,
        valueFor: (row: any) => finiteValue(row.amount),
      },
      {
        label: isAr ? "مصدر التكلفة التقديرية" : "Estimated-cost source",
        result: expectedRows,
        kind: "general" as const,
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
              ? "تُجمع التكلفة التقديرية من تقديرات تكلفة المنتج المحفوظة، والفعلية من سجل تكاليف الإنتاج، والإنتاج من سجل الإنتاج. غياب السجل يعرض كغير متاح وليس صفراً."
              : "Estimated cost comes from saved product-cost estimates, actual cost from production-cost records, and volume from production records. A missing record is shown as unavailable, not zero."}
          </Text>
        </View>

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
