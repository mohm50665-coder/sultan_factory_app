import { useState, useEffect } from "react";
import { BackButton } from "@/components/back-button";
import { DateField } from "@/components/date-field";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useLanguage } from "@/lib/language-context";
import { MaterialIcons } from "@expo/vector-icons";
import { expensesService, productionService, salesService, taskService, trpcCall } from "@/lib/services/api.service";
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

function rowsInPeriod(rows: any[], kind: ReportKind, startDate: string, endDate: string): any[] {
  return rows
    .filter((row) => inReportPeriod(row, kind, startDate, endDate))
    .sort((left, right) => businessDate(left, kind).localeCompare(businessDate(right, kind)));
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

        const productionRows = rowsInPeriod(sourceRows(valueAt(0), sourceNames[0]), "production", periodStart, periodEnd);
        const production = productionMetrics(productionRows);
        const commercial = commercialReport({
          sales: [],
          legacySales: sourceRows(valueAt(1), sourceNames[1]),
          collections: [],
          legacyCollections: [],
          transactions: [],
          startDate: periodStart,
          endDate: periodEnd,
        });
        const salesRows = [...commercial.salesRows].sort((left, right) => businessDate(left, "sale").localeCompare(businessDate(right, "sale")));
        const expenseRows = rowsInPeriod(sourceRows(valueAt(2), sourceNames[2]), "general", periodStart, periodEnd);
        const periodicRows = rowsInPeriod(maintenanceRows(valueAt(3), sourceNames[3]), "general", periodStart, periodEnd);
        const emergencyRows = rowsInPeriod(maintenanceRows(valueAt(4), sourceNames[4]), "general", periodStart, periodEnd);
        const taskRows = rowsInPeriod(sourceRows(valueAt(5), sourceNames[5]), "general", periodStart, periodEnd);

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

  const hasData = Boolean(monthlyData && (
    monthlyData.totalProduction > 0 ||
    monthlyData.totalSales > 0 ||
    monthlyData.totalExpenses > 0 ||
    monthlyData.maintenanceCount > 0 ||
    monthlyData.tasksCompleted > 0 ||
    monthlyData.tasksPending > 0
  ));

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
            {isAr ? "ابدأ بإدخال البيانات في أقسام التطبيق المختلفة لعرض التقرير الشهري" : "Start entering data in the app sections to view monthly reports"}
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
              {isAr ? "ملخص الأداء الشهري" : "Monthly Performance Summary"}
            </Text>
          </View>

          {/* الإنتاج */}
          {monthlyData!.totalProduction > 0 && (
            <>
              <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "600", marginBottom: 12 }}>
                {isAr ? "الإنتاج" : "Production"}
              </Text>
              <StatCard
                label={isAr ? "إجمالي الإنتاج" : "Total Production"}
                value={monthlyData!.totalProduction.toLocaleString()}
                unit={isAr ? "درزن" : "dozen"}
                icon="factory"
                color={colors.primary}
              />
              <StatCard
                label={isAr ? "إجمالي الهدر" : "Total Waste"}
                value={monthlyData!.totalWaste.toLocaleString()}
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
          {monthlyData!.totalSales > 0 && (
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
          {monthlyData!.totalExpenses > 0 && (
            <>
              <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "600", marginBottom: 12, marginTop: 16 }}>
                {isAr ? "المصروفات" : "Expenses"}
              </Text>
              <StatCard
                label={isAr ? "إجمالي المصروفات" : "Total Expenses"}
                value={monthlyData!.totalExpenses.toLocaleString()}
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
