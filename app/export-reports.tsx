import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { MaterialIcons } from "@expo/vector-icons";
import {
  exportReportAsPDF,
  type PDFReportData,
  type PDFSection,
} from "@/lib/services/pdf-export.service";
import { reportsService } from "@/lib/services/server-data.service";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLanguage } from "@/lib/language-context";
import { DateField } from "@/components/date-field";
import {
  businessDate,
  exactPairs,
  inReportPeriod,
  pairLabel,
  reportDate,
  reportRows,
  type ReportKind,
} from "@shared/operational-report";
import {
  collectionService,
  expensesService,
  finishedWarehouseService,
  manufacturingService,
  productionCostsLocalService,
  productionService,
  salesService,
  taskService,
} from "@/lib/services/api.service";

interface ReportOption {
  id: string;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  icon: string;
  color: string;
  type: "production" | "cost" | "sales" | "performance" | "quality" | "maintenance";
}

const REPORT_OPTIONS: ReportOption[] = [
  {
    id: "comprehensive",
    titleAr: "التقرير الشامل",
    titleEn: "Comprehensive Report",
    descriptionAr: "ملخص شامل لجميع أقسام المصنع (إنتاج، مبيعات، تكاليف، مهام)",
    descriptionEn: "Comprehensive summary of all factory departments (production, sales, costs, tasks)",
    icon: "assessment",
    color: "#3B82F6",
    type: "performance",
  },
  {
    id: "production",
    titleAr: "تقرير الإنتاج",
    titleEn: "Production Report",
    descriptionAr: "تفاصيل الإنتاج اليومي والهدر ومؤشرات الأداء",
    descriptionEn: "Daily production details, waste, and performance indicators",
    icon: "precision-manufacturing",
    color: "#10B981",
    type: "production",
  },
  {
    id: "costs",
    titleAr: "تقرير التكاليف",
    titleEn: "Costs Report",
    descriptionAr: "تحليل تكاليف المواد الخام والعمالة والصيانة",
    descriptionEn: "Analysis of raw materials, labor, and maintenance costs",
    icon: "calculate",
    color: "#F59E0B",
    type: "cost",
  },
  {
    id: "sales",
    titleAr: "تقرير المبيعات",
    titleEn: "Sales Report",
    descriptionAr: "ملخص المبيعات والتحصيل وحالة العملاء",
    descriptionEn: "Summary of sales, collections, and customer status",
    icon: "point-of-sale",
    color: "#8B5CF6",
    type: "sales",
  },
  {
    id: "maintenance",
    titleAr: "تقرير الصيانة",
    titleEn: "Maintenance Report",
    descriptionAr: "حالة المعدات والتوصيات والأعطال",
    descriptionEn: "Equipment status, recommendations, and breakdowns",
    icon: "build",
    color: "#EF4444",
    type: "maintenance",
  },
];

type ReportSource = {
  key: string;
  titleAr: string;
  titleEn: string;
  eventLabelAr: string;
  eventLabelEn: string;
  kind: ReportKind;
  load: () => Promise<unknown>;
  eventRow: (row: any) => any;
};

type SourcePeriodResult = {
  source: ReportSource;
  rows: any[];
  loadedRows: number;
  undatedRows: number;
  outsidePeriodRows: number;
  error?: string;
};

const reportSources: ReportSource[] = [
  {
    key: "production",
    titleAr: "الإنتاج",
    titleEn: "Production",
    eventLabelAr: "تاريخ الإنتاج",
    eventLabelEn: "Production date",
    kind: "production",
    load: () => productionService.getAll(),
    eventRow: (row) => row,
  },
  {
    key: "manufacturing",
    titleAr: "استلام وتسليم مراحل التصنيع",
    titleEn: "Manufacturing receipts and deliveries",
    eventLabelAr: "وقت الحركة أو التسليم/الاستلام",
    eventLabelEn: "Movement, delivery, or receipt time",
    kind: "movement",
    load: () => manufacturingService.getAll(),
    // The record's original batch date is not a handover event. The shared movement
    // contract accepts only movementAt/movementDate/deliveredAt/receivedAt here.
    eventRow: (row) => row,
  },
  {
    key: "warehouse",
    titleAr: "حركات مستودع الإنتاج التام",
    titleEn: "Finished-goods warehouse movements",
    eventLabelAr: "وقت الحركة أو التسليم/الاستلام",
    eventLabelEn: "Movement, delivery, or receipt time",
    kind: "movement",
    load: () => finishedWarehouseService.movements(),
    eventRow: (row) => row,
  },
  {
    key: "sales",
    titleAr: "المبيعات",
    titleEn: "Sales",
    eventLabelAr: "تاريخ الفاتورة أو البيع",
    eventLabelEn: "Invoice or sale date",
    kind: "sale",
    load: () => salesService.getAll(),
    eventRow: (row) => row,
  },
  {
    key: "collections",
    titleAr: "التحصيل",
    titleEn: "Collections",
    eventLabelAr: "تاريخ التحصيل أو الإيصال",
    eventLabelEn: "Collection or receipt date",
    kind: "collection",
    load: () => collectionService.getAll(),
    eventRow: (row) => row,
  },
  {
    key: "expenses",
    titleAr: "المصروفات",
    titleEn: "Expenses",
    eventLabelAr: "تاريخ المصروف",
    eventLabelEn: "Expense date",
    kind: "general",
    load: () => expensesService.getAll(),
    // Restrict the general helper to the documented expense event date; it must not
    // choose another field for this source.
    eventRow: (row) => ({ date: row?.expenseDate }),
  },
  {
    key: "costs",
    titleAr: "تكاليف الإنتاج",
    titleEn: "Production costs",
    eventLabelAr: "تاريخ تكلفة الإنتاج",
    eventLabelEn: "Production-cost date",
    kind: "production",
    load: () => productionCostsLocalService.list(),
    eventRow: (row) => ({ date: costRecordDate(row) }),
  },
  {
    key: "completedTasks",
    titleAr: "المهام المكتملة",
    titleEn: "Completed tasks",
    eventLabelAr: "تاريخ الإكمال الموثق",
    eventLabelEn: "Documented completion date",
    kind: "general",
    load: () => taskService.getAll(),
    // A task is counted only when it is completed and carries an actual completion
    // event date. Assignment/start dates do not prove that its work was completed.
    eventRow: (row) => ({
      date: row?.result === "completed" ? row?.completedDate ?? row?.completedAt : "",
    }),
  },
];

function costRecordDate(row: any): unknown {
  const rawDetails = row?.notes ?? row?.details;
  if (rawDetails && typeof rawDetails === "object") return rawDetails.date ?? row?.date;
  if (typeof rawDetails === "string") {
    try {
      const details = JSON.parse(rawDetails);
      return details?.date ?? row?.date;
    } catch {
      return row?.date;
    }
  }
  return row?.date;
}

function responseRows(value: unknown, source: string): any[] {
  const recognizedObject = value && typeof value === "object" && ["items", "rows", "data", "results"].some((key) => Array.isArray((value as any)[key]));
  if (Array.isArray(value) || recognizedObject) return reportRows(value);
  throw new Error(`لم يُرجع مصدر ${source} سجلات صالحة؛ لم يُستبدل بفترة أو أصفار افتراضية.`);
}

function filterSourceForPeriod(source: ReportSource, allRows: any[], startDate: string, endDate: string): SourcePeriodResult {
  let undatedRows = 0;
  let outsidePeriodRows = 0;
  const rows = allRows.filter((row) => {
    const event = source.eventRow(row);
    if (!businessDate(event, source.kind)) {
      undatedRows += 1;
      return false;
    }
    if (!inReportPeriod(event, source.kind, startDate, endDate)) {
      outsidePeriodRows += 1;
      return false;
    }
    return true;
  });
  return { source, rows, loadedRows: allRows.length, undatedRows, outsidePeriodRows };
}

function documentedTotal(rows: any[], valueFor: (row: any) => unknown) {
  let valueRows = 0;
  let invalidValueRows = 0;
  let total = 0;
  for (const row of rows) {
    const value = Number(valueFor(row));
    if (!Number.isFinite(value)) {
      invalidValueRows += 1;
      continue;
    }
    valueRows += 1;
    total += value;
  }
  return { total: valueRows ? total : null, valueRows, invalidValueRows };
}

function sourceByKey(results: SourcePeriodResult[], key: string) {
  return results.find((result) => result.source.key === key);
}

function reportPeriodLabel(startDate: unknown, endDate: unknown, isAr: boolean) {
  const start = reportDate(startDate);
  const end = reportDate(endDate);
  if (!start || !end) return isAr ? "فترة الحدث غير موثقة" : "Operational period not recorded";
  return start === end ? start : `${start} — ${end}`;
}

function buildOperationalComprehensiveReport(results: SourcePeriodResult[], startDate: string, endDate: string, isAr: boolean): PDFReportData {
  const production = sourceByKey(results, "production");
  const manufacturing = sourceByKey(results, "manufacturing");
  const warehouse = sourceByKey(results, "warehouse");
  const sales = sourceByKey(results, "sales");
  const collections = sourceByKey(results, "collections");
  const expenses = sourceByKey(results, "expenses");
  const costs = sourceByKey(results, "costs");
  const completedTasks = sourceByKey(results, "completedTasks");

  const productionPairs = documentedTotal(production?.rows || [], (row) => exactPairs(row, "production"));
  const salesAmount = documentedTotal(sales?.rows || [], (row) => row?.amount);
  const collectionAmount = documentedTotal(collections?.rows || [], (row) => row?.collectedAmount ?? row?.amount);
  const expenseAmount = documentedTotal(expenses?.rows || [], (row) => row?.amount);
  const costsAmount = documentedTotal(costs?.rows || [], (row) => row?.amount ?? row?.totalCost);

  const summary = [
    production && { label: isAr ? "سجلات الإنتاج" : "Production records", value: production.rows.length },
    productionPairs.total !== null && { label: isAr ? "إنتاج موثق" : "Documented production", value: pairLabel(productionPairs.total) },
    sales && { label: isAr ? "فواتير/مبيعات ضمن الفترة" : "Invoices/sales in period", value: sales.rows.length },
    salesAmount.total !== null && { label: isAr ? "مبيعات موثقة" : "Documented sales", value: `${salesAmount.total.toLocaleString(isAr ? "ar-SA" : "en-US")} ${isAr ? "ريال" : "SAR"}` },
    collections && { label: isAr ? "تحصيلات ضمن الفترة" : "Collections in period", value: collections.rows.length },
    collectionAmount.total !== null && { label: isAr ? "تحصيل موثق" : "Documented collections", value: `${collectionAmount.total.toLocaleString(isAr ? "ar-SA" : "en-US")} ${isAr ? "ريال" : "SAR"}` },
    manufacturing && { label: isAr ? "حركات مراحل التصنيع" : "Manufacturing movements", value: manufacturing.rows.length },
    warehouse && { label: isAr ? "حركات المستودع" : "Warehouse movements", value: warehouse.rows.length },
    expenses && { label: isAr ? "مصروفات موثقة" : "Documented expenses", value: expenseAmount.total === null ? (isAr ? "قيمة غير موثقة" : "Value not documented") : `${expenseAmount.total.toLocaleString(isAr ? "ar-SA" : "en-US")} ${isAr ? "ريال" : "SAR"}` },
    costs && { label: isAr ? "تكاليف إنتاج موثقة" : "Documented production costs", value: costsAmount.total === null ? (isAr ? "قيمة غير موثقة" : "Value not documented") : `${costsAmount.total.toLocaleString(isAr ? "ar-SA" : "en-US")} ${isAr ? "ريال" : "SAR"}` },
    completedTasks && { label: isAr ? "مهام مكتملة بتاريخ موثق" : "Completed tasks with documented date", value: completedTasks.rows.length },
  ].filter(Boolean) as { label: string; value: string | number }[];

  const diagnostics = results.flatMap((result) => {
    const label = isAr ? result.source.titleAr : result.source.titleEn;
    if (result.error) return [isAr ? `${label}: تعذر تحميل المصدر (${result.error}) ولم يُعرض كصفر.` : `${label}: source unavailable (${result.error}); it was not shown as zero.`];
    const notices: string[] = [];
    if (result.undatedRows) notices.push(isAr ? `${label}: استُبعدت ${result.undatedRows} سجلات بلا ${result.source.eventLabelAr}.` : `${label}: ${result.undatedRows} record(s) without ${result.source.eventLabelEn} were excluded.`);
    if (result.outsidePeriodRows) notices.push(isAr ? `${label}: استُبعدت ${result.outsidePeriodRows} سجلات بتاريخ حدث خارج الفترة.` : `${label}: ${result.outsidePeriodRows} record(s) have an event date outside the period.`);
    return notices;
  });
  const invalidValues = [
    [isAr ? "الإنتاج" : "Production", productionPairs.invalidValueRows],
    [isAr ? "المبيعات" : "Sales", salesAmount.invalidValueRows],
    [isAr ? "التحصيل" : "Collections", collectionAmount.invalidValueRows],
    [isAr ? "المصروفات" : "Expenses", expenseAmount.invalidValueRows],
    [isAr ? "التكاليف" : "Costs", costsAmount.invalidValueRows],
  ].filter(([, count]) => Number(count) > 0).map(([label, count]) => isAr ? `${label}: استُبعدت ${count} قيم غير صالحة من الإجمالي.` : `${label}: ${count} invalid value(s) were excluded from the total.`);

  const sections: PDFSection[] = [
    {
      title: isAr ? "قاعدة الفترة" : "Period rule",
      type: "text",
      data: isAr
        ? `الفترة المعتمدة: ${startDate} إلى ${endDate}. لا يُدرج أي سجل إلا بتاريخ حدث تشغيلي موثق داخل الفترة؛ لا تُستخدم تواريخ حفظ أو تحديث السجل.`
        : `Approved period: ${startDate} to ${endDate}. A record is included only when its documented operational event date falls inside this period; record-save and update timestamps are not used.`,
    },
    {
      title: isAr ? "الملخص الموثق" : "Documented summary",
      type: "summary",
      data: summary,
    },
    {
      title: isAr ? "تتبع مصادر الفترة" : "Period source trace",
      type: "table",
      data: {
        headers: isAr ? ["المصدر", "تاريخ الحدث المعتمد", "السجلات المحملة", "ضمن الفترة", "بلا تاريخ حدث"] : ["Source", "Accepted event date", "Loaded", "In period", "No event date"],
        rows: results.map((result) => [
          isAr ? result.source.titleAr : result.source.titleEn,
          isAr ? result.source.eventLabelAr : result.source.eventLabelEn,
          result.error ? "—" : String(result.loadedRows),
          result.error ? (isAr ? "المصدر غير متاح" : "Source unavailable") : String(result.rows.length),
          result.error ? "—" : String(result.undatedRows),
        ]),
      },
    },
    {
      title: isAr ? "ملاحظات سلامة البيانات" : "Data-integrity notes",
      type: "text",
      data: [...diagnostics, ...invalidValues].join("<br/>") || (isAr ? "كل المصادر المحملة تحمل تواريخ أحداث موثقة، ولم تُستبدل أي بيانات مفقودة بأصفار." : "Every loaded source has documented event dates, and no missing data was replaced with zeroes."),
    },
  ];

  return {
    title: isAr ? "التقرير الشامل" : "Comprehensive Report",
    subtitle: isAr ? `ملخص تشغيلي موثق من ${startDate} إلى ${endDate}` : `Documented operational summary from ${startDate} to ${endDate}`,
    date: startDate === endDate ? startDate : `${startDate} إلى ${endDate}`,
    sections,
  };
}

export default function ExportReports() {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const router = useRouter();
  const colors = useColors();
  const [generating, setGenerating] = useState<string | null>(null);
  const [userId, setUserId] = useState<number>(0);
  const [recentReports, setRecentReports] = useState<any[]>([]);
  const [startDate, setStartDate] = useState(getRiyadhDate());
  const [endDate, setEndDate] = useState(getRiyadhDate());

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const userStr = await AsyncStorage.getItem("sultan_current_user");
      if (userStr) {
        const user = JSON.parse(userStr);
        setUserId(user.id);
      }
      const reports = await reportsService.getAll();
      setRecentReports(reports.slice(0, 5));
    } catch (error) {
      console.error("Error loading data:", error);
    }
  };

  const handleGenerateReport = async (option: ReportOption) => {
    let selectedStartDate = startDate;
    let selectedEndDate = endDate;
    if (option.id === "comprehensive") {
      const normalizedStart = reportDate(startDate);
      const normalizedEnd = reportDate(endDate);
      if (!normalizedStart || !normalizedEnd || normalizedStart > normalizedEnd) {
        Alert.alert(isAr ? "التاريخ غير صحيح" : "Invalid date", isAr ? "اختر تاريخ البداية وتاريخ النهاية من التقويم، وتأكد أن البداية لا تتجاوز النهاية." : "Choose the start and end dates from the calendar, and ensure the start is not after the end.");
        return;
      }
      setStartDate(normalizedStart);
      setEndDate(normalizedEnd);
      selectedStartDate = normalizedStart;
      selectedEndDate = normalizedEnd;
    }
    setGenerating(option.id);
    try {
      const today = getRiyadhDate();
      const thirtyDaysAgo = getRiyadhDate(-30);

      if (option.id === "comprehensive") {
        // Build the export from the same documented operational-event dates shown
        // in reports. A missing source is described in the export, never replaced
        // by an old aggregate or by a zero value.
        const loadedSources = await Promise.allSettled(
          reportSources.map((source) => source.load()),
        );
        const periodSources: SourcePeriodResult[] = loadedSources.map(
          (result, index) => {
            const source = reportSources[index]!;
            if (result.status === "rejected")
              return {
                source,
                rows: [],
                loadedRows: 0,
                undatedRows: 0,
                outsidePeriodRows: 0,
                error:
                  result.reason instanceof Error
                    ? result.reason.message
                    : String(result.reason || "Unknown source error"),
              };
            try {
              return filterSourceForPeriod(
                source,
                responseRows(result.value, isAr ? source.titleAr : source.titleEn),
                selectedStartDate,
                selectedEndDate,
              );
            } catch (sourceError) {
              return {
                source,
                rows: [],
                loadedRows: 0,
                undatedRows: 0,
                outsidePeriodRows: 0,
                error:
                  sourceError instanceof Error
                    ? sourceError.message
                    : String(sourceError || "Unknown source error"),
              };
            }
          },
        );
        const pdfData = buildOperationalComprehensiveReport(
          periodSources,
          selectedStartDate,
          selectedEndDate,
          isAr,
        );
        await exportReportAsPDF(pdfData);
        Alert.alert(isAr ? "تم" : "Done", isAr ? "تم تصدير التقرير الشامل بنجاح" : "Comprehensive report exported successfully");
      } else if (option.id === "production") {
        router.push({ pathname: "/production-totals", params: { startDate: selectedStartDate, endDate: selectedEndDate } } as never);
        return;
      } else if (option.id === "costs") {
        router.push({ pathname: "/cost-comparison-report", params: { startDate: selectedStartDate, endDate: selectedEndDate } } as never);
        return;
      } else if (option.id === "sales") {
        router.push({ pathname: "/representative-reports", params: { startDate: selectedStartDate, endDate: selectedEndDate } } as never);
        return;
      } else if (option.id === "maintenance") {
        router.push({ pathname: "/section-reports", params: { startDate: selectedStartDate, endDate: selectedEndDate, section: "maintenance" } } as never);
        return;
      } else {
        // Generic report
        await reportsService.create({
          reportName: isAr ? option.titleAr : option.titleEn,
          reportType: option.type,
          startDate: thirtyDaysAgo,
          endDate: today,
          generatedBy: userId,
        });
        Alert.alert(isAr ? "تم" : "Done", isAr ? `تم إنشاء ${option.titleAr} بنجاح` : `${option.titleEn} created successfully`);
      }

      await loadData();
    } catch (error: any) {
      Alert.alert(isAr ? "خطأ" : "Error", error.message || (isAr ? "فشل في إنشاء التقرير" : "Failed to generate report"));
    } finally {
      setGenerating(null);
    }
  };

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header */}
        <View style={[styles.header, { flexDirection: isAr ? "row" : "row-reverse" }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <MaterialIcons name={isAr ? "arrow-forward" : "arrow-back"} size={24} color={colors.foreground} />
          </TouchableOpacity>
          <View style={[styles.headerContent, { alignItems: isAr ? "flex-start" : "flex-end" }]}>
            <Text style={[styles.headerTitle, { color: colors.foreground, textAlign: isAr ? "right" : "left" }]}>{isAr ? "تصدير التقارير" : "Export Reports"}</Text>
            <Text style={[styles.headerSubtitle, { color: colors.muted, textAlign: isAr ? "right" : "left" }]}>{isAr ? "إنشاء وتصدير تقارير PDF" : "Generate and export PDF reports"}</Text>
          </View>
          <MaterialIcons name="picture-as-pdf" size={28} color="#EF4444" />
        </View>

        {/* Comprehensive report date range */}
        <View style={[styles.dateCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.dateTitle, { color: colors.foreground, textAlign: isAr ? "right" : "left" }]}>{isAr ? "تاريخ التقرير الشامل" : "Comprehensive report dates"}</Text>
          <Text style={[styles.dateHint, { color: colors.muted, textAlign: isAr ? "right" : "left" }]}>{isAr ? "اختر يوماً واحداً أو فترة. هذا الفلتر خاص بالتقرير الشامل ولا يغيّر ملخص اليوم." : "Choose one day or a range. This filter belongs to the comprehensive report and does not change Daily Summary."}</Text>
          <View style={styles.dateRow}>
            <View style={styles.dateField}>
              <Text style={[styles.dateLabel, { color: colors.muted, textAlign: isAr ? "right" : "left" }]}>{isAr ? "من تاريخ" : "From"}</Text>
              <DateField value={startDate} onChange={setStartDate} isAr={isAr} accessibilityLabel={isAr ? "تاريخ بداية التقرير الشامل" : "Comprehensive report start date"} style={[styles.dateInput, { color: colors.foreground, borderColor: colors.border }]} />
            </View>
            <View style={styles.dateField}>
              <Text style={[styles.dateLabel, { color: colors.muted, textAlign: isAr ? "right" : "left" }]}>{isAr ? "إلى تاريخ" : "To"}</Text>
              <DateField value={endDate} onChange={setEndDate} isAr={isAr} accessibilityLabel={isAr ? "تاريخ نهاية التقرير الشامل" : "Comprehensive report end date"} style={[styles.dateInput, { color: colors.foreground, borderColor: colors.border }]} />
            </View>
          </View>
          <TouchableOpacity onPress={() => { setStartDate(getRiyadhDate()); setEndDate(getRiyadhDate()); }} style={[styles.todayButton, { borderColor: colors.primary }]}>
            <Text style={{ color: colors.primary, fontWeight: "700", textAlign: "center" }}>{isAr ? "اليوم حسب توقيت الرياض" : "Today — Riyadh time"}</Text>
          </TouchableOpacity>
        </View>

        {/* Report Options */}
        <Text style={[styles.sectionTitle, { color: colors.foreground, textAlign: isAr ? "right" : "left" }]}>{isAr ? "اختر نوع التقرير" : "Select Report Type"}</Text>
        {REPORT_OPTIONS.map((option) => (
          <TouchableOpacity
            key={option.id}
            style={[styles.reportCard, { backgroundColor: colors.surface, borderColor: colors.border, flexDirection: isAr ? "row" : "row-reverse" }]}
            onPress={() => handleGenerateReport(option)}
            disabled={generating !== null}
          >
            <View style={[styles.reportIcon, { backgroundColor: option.color + "20" }]}>
              {generating === option.id ? (
                <ActivityIndicator size="small" color={option.color} />
              ) : (
                <MaterialIcons name={option.icon as any} size={28} color={option.color} />
              )}
            </View>
            <View style={[styles.reportContent, { alignItems: isAr ? "flex-start" : "flex-end" }]}>
              <Text style={[styles.reportTitle, { color: colors.foreground, textAlign: isAr ? "right" : "left" }]}>{isAr ? option.titleAr : option.titleEn}</Text>
              <Text style={[styles.reportDesc, { color: colors.muted, textAlign: isAr ? "right" : "left" }]}>{isAr ? option.descriptionAr : option.descriptionEn}</Text>
            </View>
            <MaterialIcons name="file-download" size={24} color={option.color} />
          </TouchableOpacity>
        ))}

        {/* Recent Reports */}
        {recentReports.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.foreground, marginTop: 24, textAlign: isAr ? "right" : "left" }]}>{isAr ? "التقارير الأخيرة" : "Recent Reports"}</Text>
            {recentReports.map((report, index) => (
              <View key={report.id || index} style={[styles.recentCard, { backgroundColor: colors.surface, borderColor: colors.border, flexDirection: isAr ? "row" : "row-reverse" }]}>
                <MaterialIcons name="description" size={20} color={colors.primary} />
                <View style={[styles.recentContent, { alignItems: isAr ? "flex-start" : "flex-end" }]}>
                  <Text style={[styles.recentTitle, { color: colors.foreground, textAlign: isAr ? "right" : "left" }]}>{report.reportName}</Text>
                  <Text style={[styles.recentDate, { color: colors.muted, textAlign: isAr ? "right" : "left" }]}>
                    {report.createdAt ? new Date(report.createdAt).toLocaleString(isAr ? "ar-SA" : "en-US") : ""}
                  </Text>
                </View>
                <View style={[styles.typeBadge, { backgroundColor: colors.primary + "20" }]}>
                  <Text style={[styles.typeBadgeText, { color: colors.primary }]}>{report.reportType}</Text>
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

function getRiyadhDate(offsetDays = 0) {
  const now = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000);
  return reportDate(now);
}

const styles = StyleSheet.create({
  container: { paddingBottom: 100 },
  header: { alignItems: "center", padding: 16, gap: 12 },
  backBtn: { padding: 8 },
  headerContent: { flex: 1 },
  headerTitle: { fontSize: 22, fontWeight: "bold" },
  headerSubtitle: { fontSize: 13, marginTop: 2 },
  sectionTitle: { fontSize: 18, fontWeight: "bold", paddingHorizontal: 16, marginBottom: 12 },
  dateCard: { marginHorizontal: 16, marginBottom: 18, padding: 14, borderRadius: 12, borderWidth: 1 },
  dateTitle: { fontSize: 16, fontWeight: "800" },
  dateHint: { fontSize: 11, lineHeight: 17, marginTop: 5 },
  dateRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  dateField: { flex: 1 },
  dateLabel: { fontSize: 11, marginBottom: 5 },
  dateInput: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 8, fontSize: 13, textAlign: "center" },
  todayButton: { borderWidth: 1, borderRadius: 8, paddingVertical: 8, marginTop: 10 },
  reportCard: { alignItems: "center", marginHorizontal: 16, marginBottom: 12, padding: 16, borderRadius: 12, borderWidth: 1, gap: 12 },
  reportIcon: { width: 52, height: 52, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  reportContent: { flex: 1 },
  reportTitle: { fontSize: 16, fontWeight: "bold" },
  reportDesc: { fontSize: 12, marginTop: 4, lineHeight: 18 },
  recentCard: { alignItems: "center", marginHorizontal: 16, marginBottom: 8, padding: 12, borderRadius: 10, borderWidth: 1, gap: 10 },
  recentContent: { flex: 1 },
  recentTitle: { fontSize: 14, fontWeight: "600" },
  recentDate: { fontSize: 11, marginTop: 2 },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  typeBadgeText: { fontSize: 11, fontWeight: "600" },
});
