import { useState, useEffect } from "react";
import { BackButton } from "@/components/back-button";
import { DateField } from "@/components/date-field";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useLanguage } from "@/lib/language-context";
import { MaterialIcons } from "@expo/vector-icons";
import { expensesService, productionService, salesService, taskService, trpcCall } from "@/lib/services/api.service";
import { exportReportAsPDF, type PDFReportData } from "@/lib/services/pdf-export.service";
import { businessDate, commercialReport, inReportPeriod, productionMetrics, reportDate, reportRows, riyadhDate, type ReportKind } from "@shared/operational-report";

interface MonthlyData {
  period: string;
  totalProduction: number;
  totalWaste: number;
  wastePercentage: number | null;
  totalSales: number;
  totalExpenses: number;
  maintenanceCount: number;
  tasksCompleted: number;
  tasksPending: number;
  productionEntries: number;
  salesEntries: number;
  expenseEntries: number;
  documentedOperations: number;
}

const sourceNames = ["الإنتاج", "المبيعات", "المصروفات", "الصيانة الدورية", "صيانة الطوارئ", "المهام"];

function sourceRows(value: unknown, sourceName: string): any[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") {
    const source = value as Record<string, unknown>;
    if (["items", "rows", "data", "results"].some((key) => Array.isArray(source[key]))) return reportRows(value);
  }
  throw new Error(`تعذر قراءة بيانات مصدر ${sourceName} بصورة صالحة.`);
}

function maintenanceRows(value: unknown, sourceName: string): any[] {
  return sourceRows(value, sourceName).map((row) => {
    if (typeof row?.data !== "string") return row;
    try {
      return { ...row, data: JSON.parse(row.data) };
    } catch {
      throw new Error(`تعذر قراءة بيانات مصدر ${sourceName} بصورة صالحة.`);
    }
  });
}

/**
 * The API response can include audit dates, but a bounded report may only use the
 * documented business-event fields supplied by the source. Keep the final period
 * comparison in the shared policy so Riyadh/date-only normalization stays uniform.
 */
function operationalEventDate(row: any, fields: readonly string[]): string {
  const source = { ...(row?.data && typeof row.data === "object" ? row.data : {}), ...row };
  for (const field of fields) {
    const date = reportDate(source?.[field]);
    if (date) return date;
  }
  return "";
}

function rowsInPeriod(rows: any[], kind: ReportKind, startDate: string, endDate: string, eventFields?: readonly string[]): any[] {
  return rows
    .filter((row) => {
      if (!eventFields) return inReportPeriod(row, kind, startDate, endDate);
      const eventDate = operationalEventDate(row, eventFields);
      // Project the documented event date into the shared date contract. This avoids
      // a generic/source audit field taking precedence over this screen's event date.
      return Boolean(eventDate) && inReportPeriod({ [eventFields[0]]: eventDate }, kind, startDate, endDate);
    })
    .sort((left, right) => {
      if (eventFields) return operationalEventDate(left, eventFields).localeCompare(operationalEventDate(right, eventFields));
      return businessDate(left, kind).localeCompare(businessDate(right, kind));
    });
}

export default function MonthlyReportsScreen() {
  const colors = useColors();
  const { language } = useLanguage();
  const isAr = language === "ar";
  const today = riyadhDate();
  const [startDate, setStartDate] = useState(`${today.slice(0, 7)}-01`);
  const [endDate, setEndDate] = useState(today);
  const [isLoading, setIsLoading] = useState(true);
  const [monthlyData, setMonthlyData] = useState<MonthlyData | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [isExporting, setIsExporting] = useState(false);

  const rawStartDate = reportDate(startDate);
  const rawEndDate = reportDate(endDate);
  const hasValidPeriod = Boolean(rawStartDate && rawEndDate);
  const periodIsReversed = hasValidPeriod && rawStartDate > rawEndDate;
  const periodStart = hasValidPeriod ? (periodIsReversed ? rawEndDate : rawStartDate) : "";
  const periodEnd = hasValidPeriod ? (periodIsReversed ? rawStartDate : rawEndDate) : "";

  useEffect(() => {
    let active = true;
    const loadRealData = async () => {
      if (!hasValidPeriod) {
        setMonthlyData(null);
        setReportError(isAr ? "أدخل تاريخي بداية ونهاية صالحين من التقويم." : "Choose valid start and end dates from the calendar.");
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setReportError(null);
      try {
        const results = await Promise.allSettled([
          productionService.getAll(),
          salesService.getAll(),
          expensesService.getAll(),
          trpcCall("maintenanceEntries.getBySection", { section: "periodic" }, "query"),
          trpcCall("maintenanceEntries.getBySection", { section: "emergency" }, "query"),
          taskService.getAll(),
        ]);
        const failedSources = results.flatMap((result, index) => result.status === "rejected" ? [sourceNames[index]] : []);
        if (failedSources.length) throw new Error(`${isAr ? "تعذر تحميل المصادر التالية" : "Could not load the following sources"}: ${failedSources.join("، ")}`);
        const valueAt = (index: number): unknown => {
          const result = results[index];
          if (result.status !== "fulfilled") throw new Error(`${isAr ? "تعذر تحميل المصدر" : "Source could not be loaded"}: ${sourceNames[index]}`);
          return result.value;
        };

        const productionRows = rowsInPeriod(sourceRows(valueAt(0), sourceNames[0]), "production", periodStart, periodEnd, ["productionDate", "date"]);
        const production = productionMetrics(productionRows);
        const salesRowsForPeriod = rowsInPeriod(sourceRows(valueAt(1), sourceNames[1]), "sale", periodStart, periodEnd, ["invoiceDate", "saleDate"]);
        const commercial = commercialReport({
          sales: [],
          legacySales: salesRowsForPeriod,
          collections: [],
          legacyCollections: [],
          transactions: [],
          startDate: periodStart,
          endDate: periodEnd,
        });
        const salesRows = [...commercial.salesRows].sort((left, right) => businessDate(left, "sale").localeCompare(businessDate(right, "sale")));
        const expenseRows = rowsInPeriod(sourceRows(valueAt(2), sourceNames[2]), "general", periodStart, periodEnd, ["expenseDate"]);
        const periodicRows = rowsInPeriod(maintenanceRows(valueAt(3), sourceNames[3]), "general", periodStart, periodEnd, ["maintenanceDate", "date", "entryDate", "actionDate"]);
        const emergencyRows = rowsInPeriod(maintenanceRows(valueAt(4), sourceNames[4]), "general", periodStart, periodEnd, ["maintenanceDate", "date", "entryDate", "actionDate"]);
        // Planned/assignment dates do not prove that a task was done. A task may be
        // counted only when its completed work has a documented completion/action date.
        const taskRows = rowsInPeriod(sourceRows(valueAt(5), sourceNames[5]), "general", periodStart, periodEnd, ["completedDate", "actionDate"])
          .filter((task: any) => task.result === "completed");

        if (!active) return;
        setMonthlyData({
          period: periodStart === periodEnd ? periodStart : `${periodStart} — ${periodEnd}`,
          totalProduction: production.totalPairs / 12,
          totalWaste: production.wasteThreadGrams + production.wasteSocksGrams,
          wastePercentage: production.wastePercent,
          totalSales: salesRows.length,
          totalExpenses: expenseRows.reduce((sum: number, entry: any) => sum + (Number(entry.amount) || 0), 0),
          maintenanceCount: periodicRows.length + emergencyRows.length,
          tasksCompleted: taskRows.filter((task: any) => task.result === "completed").length,
          tasksPending: taskRows.filter((task: any) => !task.result || task.result === "pending").length,
          productionEntries: productionRows.length,
          salesEntries: salesRows.length,
          expenseEntries: expenseRows.length,
          documentedOperations: productionRows.length + salesRows.length + expenseRows.length + periodicRows.length + emergencyRows.length + taskRows.length,
        });
      } catch (error) {
        if (!active) return;
        setMonthlyData(null);
        setReportError(error instanceof Error && error.message
          ? error.message
          : (isAr ? "تعذر تحميل بيانات التقرير. لا تُعرض أصفار بديلة." : "Could not load report data. Zero substitutes are not shown."));
      } finally {
        if (active) setIsLoading(false);
      }
    };
    void loadRealData();
    return () => { active = false; };
  }, [hasValidPeriod, isAr, periodEnd, periodStart, reloadKey]);

  const StatCard = ({
    label,
    value,
    unit,
    icon,
    color,
  }: {
    label: string;
    value: number | string;
    unit?: string;
    icon: string;
    color: string;
  }) => (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderLeftWidth: 4,
        borderLeftColor: color,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 4 }}>
          {label}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "baseline" }}>
          <Text
            style={{
              color: colors.foreground,
              fontSize: 20,
              fontWeight: "bold",
            }}
          >
            {value}
          </Text>
          {unit && (
            <Text style={{ color: colors.muted, fontSize: 12, marginLeft: 4 }}>
              {unit}
            </Text>
          )}
        </View>
      </View>
      <View
        style={{
          width: 50,
          height: 50,
          borderRadius: 25,
          backgroundColor: `${color}20`,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <MaterialIcons name={icon as any} size={24} color={color} />
      </View>
    </View>
  );

  const hasData = Boolean(monthlyData && monthlyData.documentedOperations > 0);
  const formatMetric = (value: number) => Number.isFinite(value)
    ? value.toLocaleString(isAr ? "ar-SA" : "en-US")
    : (isAr ? "غير صالح — يحتاج مراجعة" : "Invalid — needs review");

  const handleExportPDF = async () => {
    if (!monthlyData || monthlyData.documentedOperations === 0 || isExporting) return;
    setIsExporting(true);
    try {
      const sections: PDFReportData["sections"] = [];
      if (monthlyData.productionEntries > 0) {
        sections.push({
          title: isAr ? "الإنتاج" : "Production",
          type: "summary",
          data: [
            { label: isAr ? "إجمالي الإنتاج" : "Total production", value: `${formatMetric(monthlyData.totalProduction)} ${isAr ? "درزن" : "dozen"}` },
            { label: isAr ? "إجمالي الهدر" : "Total waste", value: `${formatMetric(monthlyData.totalWaste)} ${isAr ? "جرام" : "g"}` },
            { label: isAr ? "نسبة الهدر" : "Waste rate", value: monthlyData.wastePercentage == null ? (isAr ? "غير متاح" : "Unavailable") : `${monthlyData.wastePercentage.toFixed(1)}%` },
          ],
        });
      }
      if (monthlyData.salesEntries > 0) sections.push({
        title: isAr ? "المبيعات" : "Sales",
        type: "summary",
        data: [{ label: isAr ? "عمليات البيع" : "Sales operations", value: monthlyData.totalSales }],
      });
      if (monthlyData.expenseEntries > 0) sections.push({
        title: isAr ? "المصروفات" : "Expenses",
        type: "summary",
        data: [{ label: isAr ? "إجمالي المصروفات" : "Total expenses", value: `${formatMetric(monthlyData.totalExpenses)} ${isAr ? "ريال" : "SAR"}` }],
      });
      if (monthlyData.maintenanceCount > 0) sections.push({
        title: isAr ? "الصيانة" : "Maintenance",
        type: "summary",
        data: [{ label: isAr ? "عمليات الصيانة" : "Maintenance operations", value: monthlyData.maintenanceCount }],
      });
      if (monthlyData.tasksCompleted > 0) sections.push({
        title: isAr ? "المهام" : "Tasks",
        type: "summary",
        data: [{ label: isAr ? "مهام مكتملة بتاريخ إنجاز موثق" : "Tasks completed with a documented completion date", value: monthlyData.tasksCompleted }],
      });

      await exportReportAsPDF({
        title: isAr ? "التقرير الشهري" : "Monthly Report",
        subtitle: `${isAr ? "الفترة التشغيلية" : "Operational period"}: ${monthlyData.period}`,
        date: monthlyData.period,
        footer: isAr ? "يقتصر هذا التقرير على العمليات ذات تاريخ حدث موثق ضمن الفترة المحددة." : "This report is limited to operations with a documented event date in the selected period.",
        sections,
      });
      Alert.alert(isAr ? "تم التصدير" : "Exported", isAr ? "تم فتح التقرير للطباعة أو الحفظ بصيغة PDF." : "The report was opened for printing or saving as PDF.");
    } catch (error) {
      Alert.alert(
        isAr ? "تعذر التصدير" : "Export failed",
        error instanceof Error && error.message ? error.message : (isAr ? "تعذر إنشاء التقرير للطباعة." : "The printable report could not be created."),
      );
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <ScreenContainer style={{ backgroundColor: colors.background }}>
      {/* Header */}
      <View style={{ backgroundColor: colors.primary, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 16 }}>
        <BackButton />
        <Text style={{ fontSize: 18, fontWeight: "bold", color: "white" }}>
          {isAr ? "التقارير الشهرية" : "Monthly Reports"}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={{ backgroundColor: colors.surface, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <View style={{ flexDirection: isAr ? "row-reverse" : "row", gap: 12, flexWrap: "wrap" }}>
          <View style={{ flex: 1, minWidth: 150 }}>
            <DateField label={isAr ? "من تاريخ" : "Start date"} value={startDate} onChange={setStartDate} isAr={isAr} />
          </View>
          <View style={{ flex: 1, minWidth: 150 }}>
            <DateField label={isAr ? "إلى تاريخ" : "End date"} value={endDate} onChange={setEndDate} isAr={isAr} />
          </View>
        </View>
        <TouchableOpacity
          onPress={() => setReloadKey((value) => value + 1)}
          accessibilityRole="button"
          accessibilityLabel={isAr ? "تحديث التقرير الشهري" : "Refresh monthly report"}
          style={{ alignSelf: isAr ? "flex-start" : "flex-end", marginTop: 10, backgroundColor: colors.primary, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 9 }}
        >
          <Text style={{ color: "white", fontWeight: "700" }}>{isAr ? "تحديث التقرير" : "Refresh report"}</Text>
        </TouchableOpacity>
        {periodIsReversed && (
          <Text accessibilityRole="alert" style={{ color: "#b45309", fontSize: 12, marginTop: 8, textAlign: isAr ? "right" : "left" }}>
            {isAr
              ? `تم عكس نطاق التاريخ تلقائيًا: يعرض التقرير من ${periodStart} إلى ${periodEnd}.`
              : `The reversed date range was normalized: reporting from ${periodStart} to ${periodEnd}.`}
          </Text>
        )}
      </View>

      {isLoading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ color: colors.muted, marginTop: 12 }}>
            {isAr ? "جارٍ تحميل البيانات..." : "Loading data..."}
          </Text>
        </View>
      ) : reportError ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 32 }} accessibilityRole="alert">
          <MaterialIcons name="error-outline" size={64} color="#dc2626" />
          <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: "bold", marginTop: 16, textAlign: "center" }}>
            {isAr ? "تعذر إعداد التقرير" : "Could not prepare the report"}
          </Text>
          <Text style={{ color: "#b91c1c", fontSize: 14, marginTop: 8, textAlign: "center" }}>{reportError}</Text>
          <Text style={{ color: colors.muted, fontSize: 13, marginTop: 8, textAlign: "center" }}>
            {isAr ? "لا تُعرض أصفار بديلة عند تعذر تحميل مصدر بيانات." : "Zero substitutes are not shown when a data source fails to load."}
          </Text>
        </View>
      ) : !hasData ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 32 }}>
          <MaterialIcons name="analytics" size={64} color="#d1d5db" />
          <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: "bold", marginTop: 16, textAlign: "center" }}>
            {isAr ? "لا توجد بيانات بعد" : "No data available yet"}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 14, marginTop: 8, textAlign: "center" }}>
            {isAr ? "لا توجد عمليات ذات تاريخ حدث تشغيلي موثق ضمن الفترة المحددة. السجلات بلا تاريخ حدث لا تدخل التقرير." : "No operations with a documented business-event date fall within the selected period. Records without an event date are excluded."}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 16 }}>
          {/* عنوان الشهر */}
          <View style={{ backgroundColor: `${colors.primary}15`, borderRadius: 12, padding: 16, marginBottom: 20, alignItems: "center" }}>
            <Text style={{ color: colors.primary, fontSize: 16, fontWeight: "bold" }}>
              {monthlyData!.period}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
              {isAr ? "ملخص العمليات ذات تاريخ حدث موثق ضمن الفترة" : "Summary of operations with a documented event date in the period"}
            </Text>
            <TouchableOpacity
              onPress={() => void handleExportPDF()}
              disabled={isExporting}
              accessibilityRole="button"
              accessibilityLabel={isAr ? "تصدير التقرير الشهري للطباعة أو PDF" : "Export monthly report for print or PDF"}
              style={{ flexDirection: isAr ? "row-reverse" : "row", alignItems: "center", gap: 6, marginTop: 12, backgroundColor: colors.primary, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 9, opacity: isExporting ? 0.7 : 1 }}
            >
              {isExporting ? <ActivityIndicator size="small" color="white" /> : <MaterialIcons name="picture-as-pdf" size={18} color="white" />}
              <Text style={{ color: "white", fontWeight: "700" }}>{isExporting ? (isAr ? "جارٍ تجهيز التصدير..." : "Preparing export...") : (isAr ? "طباعة / حفظ PDF" : "Print / Save PDF")}</Text>
            </TouchableOpacity>
          </View>

          {/* الإنتاج */}
          {monthlyData!.productionEntries > 0 && (
            <>
              <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "600", marginBottom: 12 }}>
                {isAr ? "الإنتاج" : "Production"}
              </Text>
              <StatCard
                label={isAr ? "إجمالي الإنتاج" : "Total Production"}
                value={formatMetric(monthlyData!.totalProduction)}
                unit={isAr ? "درزن" : "dozen"}
                icon="factory"
                color={colors.primary}
              />
              <StatCard
                label={isAr ? "إجمالي الهدر" : "Total Waste"}
                value={formatMetric(monthlyData!.totalWaste)}
                unit={isAr ? "جرام" : "g"}
                icon="warning"
                color="#FF9800"
              />
              <StatCard
                label={isAr ? "نسبة الهدر" : "Waste %"}
                value={monthlyData!.wastePercentage == null ? (isAr ? "غير متاح" : "Unavailable") : monthlyData!.wastePercentage.toFixed(1)}
                unit="%"
                icon="pie-chart"
                color="#ef4444"
              />
            </>
          )}

          {/* المبيعات */}
          {monthlyData!.salesEntries > 0 && (
            <>
              <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "600", marginBottom: 12, marginTop: 16 }}>
                {isAr ? "المبيعات" : "Sales"}
              </Text>
              <StatCard
                label={isAr ? "عمليات البيع" : "Sales Operations"}
                value={monthlyData!.totalSales}
                icon="shopping-cart"
                color="#10b981"
              />
            </>
          )}

          {/* المصروفات */}
          {monthlyData!.expenseEntries > 0 && (
            <>
              <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "600", marginBottom: 12, marginTop: 16 }}>
                {isAr ? "المصروفات" : "Expenses"}
              </Text>
              <StatCard
                label={isAr ? "إجمالي المصروفات" : "Total Expenses"}
                value={formatMetric(monthlyData!.totalExpenses)}
                unit={isAr ? "ريال" : "SAR"}
                icon="payments"
                color="#6366f1"
              />
            </>
          )}

          {/* الصيانة */}
          {monthlyData!.maintenanceCount > 0 && (
            <>
              <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "600", marginBottom: 12, marginTop: 16 }}>
                {isAr ? "الصيانة" : "Maintenance"}
              </Text>
              <StatCard
                label={isAr ? "عمليات الصيانة" : "Maintenance Ops"}
                value={monthlyData!.maintenanceCount}
                icon="build"
                color="#ef4444"
              />
            </>
          )}

          {/* المهام */}
          {(monthlyData!.tasksCompleted > 0 || monthlyData!.tasksPending > 0) && (
            <>
              <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "600", marginBottom: 12, marginTop: 16 }}>
                {isAr ? "المهام" : "Tasks"}
              </Text>
              <StatCard
                label={isAr ? "مهام مكتملة" : "Completed Tasks"}
                value={monthlyData!.tasksCompleted}
                icon="check-circle"
                color="#10b981"
              />
              <StatCard
                label={isAr ? "مهام معلقة" : "Pending Tasks"}
                value={monthlyData!.tasksPending}
                icon="pending"
                color="#f59e0b"
              />
            </>
          )}
        </ScrollView>
      )}
    </ScreenContainer>
  );
}
