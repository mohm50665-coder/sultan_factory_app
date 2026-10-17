import React, { useCallback, useEffect, useMemo, useState } from "react";
import { BackButton } from "@/components/back-button";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import * as Print from "expo-print";
import { ScreenContainer } from "@/components/screen-container";
import { DateField } from "@/components/date-field";
import { useColors } from "@/hooks/use-colors";
import { useLanguage } from "@/lib/language-context";
import { MaterialIcons } from "@expo/vector-icons";
import { BarChart, PieChart, ProgressBar, StatCard } from "@/components/charts";
import { productionService } from "@/lib/services/api.service";
import { businessDate, exactPairs, inReportPeriod, productionMetrics, reportDate, reportRows, riyadhDate } from "@shared/operational-report";

type Period = "today" | "week" | "month" | "custom";

type DateRange = { startDate: string; endDate: string };

function rangeForPeriod(period: Exclude<Period, "custom">): DateRange {
  const endDate = riyadhDate();
  if (period === "today") return { startDate: endDate, endDate };
  if (period === "month") return { startDate: `${endDate.slice(0, 7)}-01`, endDate };
  const start = new Date(`${endDate}T12:00:00Z`);
  start.setUTCDate(start.getUTCDate() - 6);
  return { startDate: start.toISOString().slice(0, 10), endDate };
}

function hasReportRows(value: unknown): boolean {
  if (Array.isArray(value)) return true;
  if (!value || typeof value !== "object") return false;
  return ["items", "rows", "data", "results"].some((key) => Array.isArray((value as Record<string, unknown>)[key]));
}

function escapeReportHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (character) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[character] || character
  ));
}

export default function ReportsAnalyticsScreen() {
  const colors = useColors();
  const { language, isRtl } = useLanguage();
  const isAr = language === "ar";

  const [period, setPeriod] = useState<Period>("week");
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>(() => rangeForPeriod("week"));
  const [productionData, setProductionData] = useState<any[] | null>(null);
  const [sourceError, setSourceError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setSourceError(null);
    try {
      const source = await productionService.getAll();
      if (!hasReportRows(source)) throw new Error(isAr ? "استجابة سجلات الإنتاج غير مكتملة" : "Production records response is incomplete");
      setProductionData(reportRows(source));
    } catch (error) {
      setProductionData(null);
      setSourceError(error instanceof Error ? error.message : isAr ? "تعذر تحميل سجلات الإنتاج" : "Production records could not be loaded");
    } finally {
      setIsLoading(false);
    }
  }, [isAr]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const requestedStartDate = reportDate(dateRange.startDate);
  const requestedEndDate = reportDate(dateRange.endDate);
  const dateRangeError = !requestedStartDate || !requestedEndDate;
  const rangeIsReversed = !dateRangeError && requestedStartDate > requestedEndDate;
  const effectiveStartDate = rangeIsReversed ? requestedEndDate : requestedStartDate;
  const effectiveEndDate = rangeIsReversed ? requestedStartDate : requestedEndDate;
  const sourceRows = productionData === null ? [] : productionData;

  const productionRows = useMemo(() => {
    if (dateRangeError || productionData === null) return [];
    return productionData
      .filter((row) => inReportPeriod(row, "production", effectiveStartDate, effectiveEndDate))
      .sort((left, right) => {
        const rightDate = businessDate(right, "production");
        const leftDate = businessDate(left, "production");
        if (rightDate !== leftDate) return rightDate.localeCompare(leftDate);
        return String(left?.id ?? "").localeCompare(String(right?.id ?? ""));
      });
  }, [dateRangeError, effectiveEndDate, effectiveStartDate, productionData]);

  const undatedRows = useMemo(
    () => sourceRows.filter((row) => !businessDate(row, "production")).length,
    [sourceRows],
  );
  const metrics = useMemo(() => productionMetrics(productionRows), [productionRows]);
  const hasProductionRows = productionRows.length > 0;
  const totalProduction = Number.isFinite(metrics.totalPairs) ? metrics.totalPairs / 12 : null;
  const totalWaste = Number.isFinite(metrics.wasteThreadGrams + metrics.wasteSocksGrams)
    ? metrics.wasteThreadGrams + metrics.wasteSocksGrams
    : null;
  const totalSecondGrade = Number.isFinite(metrics.secondPairs) ? metrics.secondPairs : null;
  const totalNeedles = Number.isFinite(metrics.wasteNeedles) ? metrics.wasteNeedles : null;
  const machineCount = new Set(productionRows.map((row) => row.machineNumber).filter((machine) => machine != null && machine !== "")).size;
  const numberFormat = (value: number | null, maximumFractionDigits = 2) => value == null
    ? (isAr ? "بيانات تحتاج مراجعة" : "Data needs review")
    : value.toLocaleString(isAr ? "ar-SA" : "en-US", { maximumFractionDigits });

  const machineProduction = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const row of productionRows) {
      const pairs = exactPairs(row, "production");
      if (!Number.isFinite(pairs)) continue;
      const key = `M${row.machineNumber || "?"}`;
      totals[key] = (totals[key] ?? 0) + pairs / 12;
    }
    return totals;
  }, [productionRows]);
  const barData = Object.entries(machineProduction)
    .map(([label, value]) => ({ label, value }))
    .sort((left, right) => right.value - left.value || left.label.localeCompare(right.label))
    .slice(0, 8);
  const machineEfficiency = barData.slice(0, 5).map((item) => ({
    ...item,
    max: Math.max(...barData.map((entry) => entry.value), 1),
  }));

  const pieData = [
    { label: isAr ? "خيوط" : "Thread", value: metrics.wasteThreadGrams, color: "#3b82f6" },
    { label: isAr ? "جوارب" : "Socks", value: metrics.wasteSocksGrams, color: "#ef4444" },
    { label: isAr ? "إبر" : "Needles", value: totalNeedles ?? 0, color: "#f59e0b" },
  ];

  const PERIODS: Array<{ key: Exclude<Period, "custom">; labelAr: string; labelEn: string }> = [
    { key: "today", labelAr: "اليوم", labelEn: "Today" },
    { key: "week", labelAr: "الأسبوع", labelEn: "Week" },
    { key: "month", labelAr: "الشهر", labelEn: "Month" },
  ];

  const applyPeriod = (nextPeriod: Exclude<Period, "custom">) => {
    setPeriod(nextPeriod);
    setDateRange(rangeForPeriod(nextPeriod));
  };

  const printReport = useCallback(async () => {
    if (isLoading || sourceError) {
      Alert.alert(
        isAr ? "تعذر طباعة التقرير" : "Report cannot be printed",
        isAr ? "انتظر حتى يكتمل تحميل مصدر الإنتاج بنجاح ثم أعد المحاولة." : "Wait for the production source to load successfully, then try again.",
      );
      return;
    }
    if (dateRangeError) {
      Alert.alert(
        isAr ? "نطاق التاريخ غير صالح" : "Date range is invalid",
        isAr ? "اختر تاريخي بداية ونهاية صالحين من التقويم قبل الطباعة." : "Choose valid start and end calendar dates before printing.",
      );
      return;
    }

    const locale = isAr ? "ar-SA" : "en-US";
    const reviewText = isAr ? "تحتاج مراجعة" : "Needs review";
    const noValueText = "—";
    const printableNumber = (value: unknown, maximumFractionDigits = 2) => {
      const numeric = Number(value);
      return Number.isFinite(numeric) ? numeric.toLocaleString(locale, { maximumFractionDigits }) : reviewText;
    };
    const printablePairs = (row: any, kind: "production" | "second") => {
      const pairs = exactPairs(row, kind);
      if (!Number.isFinite(pairs)) return reviewText;
      return isAr
        ? `${Math.floor(pairs / 12).toLocaleString(locale)} درزن + ${(pairs % 12).toLocaleString(locale)} زوج`
        : `${Math.floor(pairs / 12).toLocaleString(locale)} dozen + ${(pairs % 12).toLocaleString(locale)} pairs`;
    };
    const rows = productionRows.map((row) => `<tr>
      <td>${escapeReportHtml(businessDate(row, "production"))}</td>
      <td>${escapeReportHtml(row.machineNumber ?? noValueText)}</td>
      <td>${escapeReportHtml(row.productName ?? noValueText)}</td>
      <td>${escapeReportHtml(printablePairs(row, "production"))}</td>
      <td>${escapeReportHtml(printablePairs(row, "second"))}</td>
      <td>${escapeReportHtml(row.wasteThreadGrams == null ? noValueText : printableNumber(row.wasteThreadGrams))}</td>
      <td>${escapeReportHtml(row.wasteSocksGrams == null ? noValueText : printableNumber(row.wasteSocksGrams))}</td>
      <td>${escapeReportHtml(row.wasteNeedles == null ? noValueText : printableNumber(row.wasteNeedles, 0))}</td>
    </tr>`).join("");
    const totalProductionText = hasProductionRows && totalProduction != null ? printableNumber(totalProduction) : noValueText;
    const totalWasteText = hasProductionRows && totalWaste != null ? printableNumber(totalWaste) : noValueText;
    const totalSecondGradeText = hasProductionRows && totalSecondGrade != null ? printableNumber(totalSecondGrade, 0) : noValueText;
    const html = `<!doctype html><html dir="${isAr ? "rtl" : "ltr"}"><head><meta charset="utf-8"><title>${isAr ? "تقرير تحليلات الإنتاج" : "Production Analytics Report"}</title><style>@page{size:A4 landscape;margin:8mm}body{font-family:Arial,sans-serif;color:#0f172a;direction:${isAr ? "rtl" : "ltr"};padding:16px}h1{color:#0a7ea4;margin:0 0 8px}p{margin:4px 0 14px}.summary{display:flex;gap:10px;flex-wrap:wrap;margin:12px 0 18px}.metric{border:1px solid #cbd5e1;border-radius:8px;padding:9px;min-width:135px}.metric b{display:block;color:#075985;margin-bottom:4px}table{width:100%;border-collapse:collapse;font-size:10px}th,td{border:1px solid #cbd5e1;padding:7px;text-align:${isAr ? "right" : "left"};vertical-align:top}th{background:#e0f2fe;color:#0c4a6e}tr:nth-child(even){background:#f8fafc}</style></head><body><h1>${isAr ? "تقرير تحليلات الإنتاج" : "Production Analytics Report"}</h1><p>${isAr ? "الفترة التشغيلية" : "Operational period"}: ${escapeReportHtml(effectiveStartDate)} ${isAr ? "إلى" : "through"} ${escapeReportHtml(effectiveEndDate)}${rangeIsReversed ? ` (${isAr ? "أُعيد ترتيب حدود التاريخ" : "date bounds reordered"})` : ""}</p><div class="summary"><div class="metric"><b>${isAr ? "إجمالي الإنتاج" : "Total production"}</b>${escapeReportHtml(totalProductionText)} ${isAr ? "درزن" : "dozen"}</div><div class="metric"><b>${isAr ? "إجمالي الهدر" : "Total waste"}</b>${escapeReportHtml(totalWasteText)} ${isAr ? "جرام" : "grams"}</div><div class="metric"><b>${isAr ? "النخب الثاني" : "Second grade"}</b>${escapeReportHtml(totalSecondGradeText)} ${isAr ? "زوج" : "pairs"}</div><div class="metric"><b>${isAr ? "سجلات الإنتاج" : "Production records"}</b>${escapeReportHtml(productionRows.length.toLocaleString(locale))}</div></div><table><thead><tr><th>${isAr ? "تاريخ الإنتاج التشغيلي" : "Operational production date"}</th><th>${isAr ? "المكينة" : "Machine"}</th><th>${isAr ? "الصنف" : "Product"}</th><th>${isAr ? "الإنتاج" : "Production"}</th><th>${isAr ? "النخب الثاني" : "Second grade"}</th><th>${isAr ? "هدر الخيوط (جرام)" : "Thread waste (grams)"}</th><th>${isAr ? "هدر الجوارب (جرام)" : "Socks waste (grams)"}</th><th>${isAr ? "إبر تالفة" : "Waste needles"}</th></tr></thead><tbody>${rows || `<tr><td colspan="8">${isAr ? "لا توجد سجلات إنتاج ذات تاريخ تشغيلي صالح ضمن الفترة المحددة." : "No production records with a valid operational date fall within the selected period."}</td></tr>`}</tbody></table></body></html>`;

    if (Platform.OS === "web" && typeof window !== "undefined" && typeof document !== "undefined") {
      const printWindow = window.open("", "_blank", "width=1400,height=900");
      if (!printWindow) {
        Alert.alert(isAr ? "تعذر فتح الطباعة" : "Could not open print", isAr ? "اسمح بالنوافذ المنبثقة ثم أعد المحاولة." : "Allow pop-ups, then try again.");
        return;
      }
      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
      return;
    }
    await Print.printAsync({ html });
  }, [dateRangeError, effectiveEndDate, effectiveStartDate, hasProductionRows, isAr, isLoading, productionRows, rangeIsReversed, sourceError, totalProduction, totalSecondGrade, totalWaste]);

  return (
    <ScreenContainer style={{ backgroundColor: colors.background }}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <BackButton />
        <Text style={styles.headerTitle}>
          {isAr ? "التقارير والتحليلات" : "Reports & Analytics"}
        </Text>
        <TouchableOpacity
          onPress={() => void printReport()}
          style={styles.printButton}
          accessibilityRole="button"
          accessibilityLabel={isAr ? "طباعة تقرير تحليلات الإنتاج" : "Print production analytics report"}
        >
          <MaterialIcons name="print" size={22} color="white" />
        </TouchableOpacity>
      </View>

      {/* Period Selector and calendar range */}
      <View style={styles.periodContainer}>
        {PERIODS.map((p) => (
          <TouchableOpacity
            key={p.key}
            onPress={() => applyPeriod(p.key)}
            style={[styles.periodTab, period === p.key && styles.periodTabActive]}
          >
            <Text style={[styles.periodText, period === p.key && styles.periodTextActive]}>
              {isAr ? p.labelAr : p.labelEn}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.dateRange}>
        <DateField
          label={isAr ? "تاريخ البداية" : "Start date"}
          value={dateRange.startDate}
          onChange={(startDate) => { setPeriod("custom"); setDateRange((current) => ({ ...current, startDate })); }}
          isAr={isAr}
          defaultToToday={false}
        />
        <DateField
          label={isAr ? "تاريخ النهاية" : "End date"}
          value={dateRange.endDate}
          onChange={(endDate) => { setPeriod("custom"); setDateRange((current) => ({ ...current, endDate })); }}
          isAr={isAr}
          defaultToToday={false}
        />
      </View>
      {dateRangeError ? (
        <Text accessibilityRole="alert" style={styles.dateWarning}>
          {isAr ? "أدخل تاريخي بداية ونهاية صالحين من التقويم قبل حساب التقرير." : "Choose valid start and end calendar dates before calculating the report."}
        </Text>
      ) : rangeIsReversed ? (
        <Text accessibilityRole="alert" style={styles.dateWarning}>
          {isAr
            ? `تم عكس نطاق التاريخ بوضوح للحساب: من ${effectiveStartDate} إلى ${effectiveEndDate}.`
            : `The reversed range is calculated clearly as ${effectiveStartDate} through ${effectiveEndDate}.`}
        </Text>
      ) : (
        <Text style={styles.dateNote}>
          {isAr ? `تُحسب النتائج من ${effectiveStartDate} إلى ${effectiveEndDate}.` : `Results are calculated from ${effectiveStartDate} through ${effectiveEndDate}.`}
        </Text>
      )}

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : sourceError ? (
        <View accessibilityRole="alert" style={styles.errorContainer}>
          <MaterialIcons name="error-outline" size={32} color="#b91c1c" />
          <Text style={styles.errorTitle}>{isAr ? "تعذر تحميل مصدر الإنتاج" : "Production source could not be loaded"}</Text>
          <Text style={styles.errorText}>{isAr ? "لم تُعرض النتائج كأصفار. أعد محاولة تحميل المصدر." : "Results are not shown as zeros. Retry loading the source."}</Text>
          <Text style={styles.errorText}>{sourceError}</Text>
          <TouchableOpacity onPress={() => void loadData()} style={styles.retryButton} accessibilityRole="button">
            <Text style={styles.retryButtonText}>{isAr ? "إعادة المحاولة" : "Retry"}</Text>
          </TouchableOpacity>
        </View>
      ) : dateRangeError ? (
        <View style={styles.errorContainer}>
          <MaterialIcons name="date-range" size={32} color="#b45309" />
          <Text style={styles.errorTitle}>{isAr ? "نطاق التاريخ غير صالح" : "Date range is invalid"}</Text>
          <Text style={styles.errorText}>{isAr ? "لن تُعرض نتائج صفرية حتى يكتمل نطاق التاريخ." : "Zero results are not shown until the date range is complete."}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {undatedRows > 0 ? (
            <Text accessibilityRole="alert" style={styles.dateWarning}>
              {isAr
                ? `تم استبعاد ${undatedRows} سجل إنتاج بلا تاريخ تشغيلي صالح من الفترة.`
                : `${undatedRows} production record(s) without a valid business date were excluded from the period.`}
            </Text>
          ) : null}
          {metrics.invalidQuantityCount > 0 ? (
            <Text accessibilityRole="alert" style={styles.dateWarning}>
              {isAr ? "توجد كميات إنتاج غير صالحة تحتاج مراجعة؛ لا تُحوّل إلى أصفار." : "Some production quantities need review; they are not converted to zeros."}
            </Text>
          ) : null}
          {/* Stats Row */}
          <View style={styles.statsRow}>
            <StatCard
              title={isAr ? "إجمالي الإنتاج" : "Total Production"}
              value={hasProductionRows ? numberFormat(totalProduction) : "—"}
              subtitle={isAr ? "درزن" : "dozen"}
              color="#3b82f6"
              trend={(totalProduction ?? 0) > 0 ? "up" : "neutral"}
              trendValue={(totalProduction ?? 0) > 0 ? (isAr ? "نشط" : "Active") : ""}
            />
            <StatCard
              title={isAr ? "المكائن" : "Machines"}
              value={hasProductionRows ? `${machineCount}` : "—"}
              subtitle={isAr ? "مكينة نشطة" : "active"}
              color="#10b981"
            />
          </View>

          <View style={styles.statsRow}>
            <StatCard
              title={isAr ? "إجمالي الهدر" : "Total Waste"}
              value={hasProductionRows ? numberFormat(totalWaste) : "—"}
              subtitle={isAr ? "جرام" : "grams"}
              color="#ef4444"
              trend={(totalWaste ?? 0) > 0 ? "down" : "neutral"}
              trendValue={(totalWaste ?? 0) > 0 ? (isAr ? "يحتاج مراجعة" : "Needs review") : ""}
            />
            <StatCard
              title={isAr ? "النخب الثاني" : "2nd Grade"}
              value={hasProductionRows ? numberFormat(totalSecondGrade, 0) : "—"}
              subtitle={isAr ? "زوج" : "pairs"}
              color="#f59e0b"
            />
          </View>

          {/* Bar Chart: Production per Machine */}
          {barData.length > 0 ? (
            <BarChart
              data={barData}
              title={isAr ? "الإنتاج حسب المكينة (درزن)" : "Production per Machine (dozen)"}
              height={160}
              barColor="#3b82f6"
            />
          ) : (
            <View style={styles.emptyChart}>
              <MaterialIcons name="bar-chart" size={40} color="#d1d5db" />
              <Text style={styles.emptyChartText}>
                {isAr ? "لا توجد سجلات إنتاج ذات تاريخ تشغيلي صالح ضمن الفترة المحددة" : "No production records with a valid operational date in the selected period"}
              </Text>
            </View>
          )}

          {/* Pie Chart: Waste Distribution */}
          {(totalWaste ?? 0) > 0 && (
            <PieChart
              data={pieData}
              title={isAr ? "توزيع الهدر" : "Waste Distribution"}
              size={100}
            />
          )}

          {/* Progress Bars: Machine Efficiency */}
          {machineEfficiency.length > 0 && (
            <View style={styles.chartContainer}>
              <Text style={styles.chartTitle}>
                {isAr ? "أداء المكائن (مقارنة)" : "Machine Performance (Comparison)"}
              </Text>
              {machineEfficiency.map((item, index) => (
                <ProgressBar
                  key={index}
                  label={item.label}
                  value={item.value}
                  max={item.max}
                  color={index === 0 ? "#10b981" : index === 1 ? "#3b82f6" : "#f59e0b"}
                />
              ))}
            </View>
          )}

          {/* Summary */}
          <View style={styles.summaryCard}>
            <MaterialIcons name="insights" size={24} color="#6366f1" />
            <View style={styles.summaryContent}>
              <Text style={[styles.summaryTitle, { textAlign: isRtl ? "right" : "left" }]}>
                {isAr ? "ملخص الأداء" : "Performance Summary"}
              </Text>
              <Text style={[styles.summaryText, { textAlign: isRtl ? "right" : "left" }]}>
                {hasProductionRows
                  ? isAr
                    ? `تم تسجيل ${productionRows.length} إدخال إنتاج من ${machineCount} مكينة بإجمالي ${numberFormat(totalProduction)} درزن ضمن الفترة المحددة`
                    : `${productionRows.length} entries from ${machineCount} machines totaling ${numberFormat(totalProduction)} dozen in the selected period`
                  : isAr
                  ? "لا توجد سجلات إنتاج ذات تاريخ تشغيلي صالح ضمن الفترة المحددة."
                  : "No production records with a valid operational date exist in the selected period."}
              </Text>
            </View>
          </View>
        </ScrollView>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  backBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "white",
  },
  printButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  periodContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  periodTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
  },
  periodTabActive: {
    backgroundColor: "#0a7ea4",
  },
  periodText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6b7280",
  },
  periodTextActive: {
    color: "white",
  },
  dateRange: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  dateNote: {
    color: "#475569",
    fontSize: 12,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  dateWarning: {
    color: "#9a3412",
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 18,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  errorContainer: {
    alignItems: "center",
    gap: 10,
    margin: 16,
    padding: 20,
    borderRadius: 12,
    backgroundColor: "#fff7ed",
    borderWidth: 1,
    borderColor: "#fed7aa",
  },
  errorTitle: {
    color: "#7c2d12",
    fontSize: 16,
    fontWeight: "800",
    textAlign: "center",
  },
  errorText: {
    color: "#7c2d12",
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
  retryButton: {
    backgroundColor: "#0a7ea4",
    borderRadius: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  retryButtonText: {
    color: "white",
    fontSize: 13,
    fontWeight: "700",
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  chartContainer: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  chartTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1f2937",
    marginBottom: 14,
  },
  emptyChart: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 32,
    alignItems: "center",
    marginBottom: 16,
  },
  emptyChartText: {
    fontSize: 13,
    color: "#9ca3af",
    marginTop: 8,
  },
  summaryCard: {
    flexDirection: "row",
    backgroundColor: "#f5f3ff",
    borderRadius: 14,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: "#e9e5ff",
  },
  summaryContent: {
    flex: 1,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#4c1d95",
    marginBottom: 4,
  },
  summaryText: {
    fontSize: 12,
    color: "#6b7280",
    lineHeight: 18,
  },
});
