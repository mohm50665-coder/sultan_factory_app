import { CustodySummaryPanel } from "@/components/custody-summary-panel";
import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useLanguage } from "@/lib/language-context";
import { MaterialIcons } from "@expo/vector-icons";
import { productionService, salesService, collectionService, expensesService, taskService, productManufacturingRequestService, finishedWarehouseService } from "@/lib/services/api.service";
import { maintenanceEntriesService } from "@/lib/services/data.service";
import { representativeService } from "@/lib/services/representative.service";
import { exportReportAsPDF, type PDFReportData } from "@/lib/services/pdf-export.service";
import { TextInput } from "react-native";
import { commercialReport, exactPairs, inReportPeriod, pairLabel, productionMetrics, reportRows, transactionStatusLabel, visitText, warehousePeriod } from "@shared/operational-report";

interface MonthOption {
  label: string;
  value: number; // month index 0-11
  year: number;
}

interface ReportData {
  production: {
    totalDozen: number;
    totalPairs: number;
    totalEntries: number;
    wasteThread: number;
    wasteSocks: number;
    yarnWeight: number;
    wasteNeedles: number;
    secondGrade: number;
    firstGrade: number;
    wastePercentage: number | null;
    threadWastePercentage: number | null;
  };
  sales: {
    totalEntries: number;
    totalAmount: number;
  };
  expenses: {
    totalAmount: number;
    categories: { name: string; amount: number }[];
  };
  maintenance: {
    periodicCount: number;
    emergencyCount: number;
    stoppedMachines: number;
  };
  tasks: {
    total: number;
    completed: number;
    pending: number;
    overdue: number;
    completionRate: number;
  };
  collection: {
    totalAmount: number;
    totalEntries: number;
    collectionRate: number;
  };
  warehouse: {
    movementCount: number;
    receiptPairs: number;
    issuePairs: number;
    adjustmentPairs: number;
    currentPairs: number;
    openingPairs: number | null;
    closingPairs: number | null;
    invalidQuantityCount: number;
  };
  commercial: {
    salesRows: any[];
    orderRows: any[];
    visitRows: any[];
    otherTransactionRows: any[];
    collectionRows: any[];
  };
  manufacturingRequests: {
    total: number;
    produced: number;
    notProduced: number;
    pending: number;
    producedDozen: number;
    notProducedDozen: number;
    failureReasons: { reason: string; count: number; quantityDozen: number }[];
  };
  previousManufacturingRequests: ReportData["manufacturingRequests"];
}

type ReportPeriod = "daily" | "twoDays" | "weekly" | "monthly" | "custom";

function periodRange(period: ReportPeriod, month: number, year: number, customStart?: string, customEnd?: string): { start: string; end: string; label: string } {
  if (period === "custom" && customStart && customEnd && /^\d{4}-\d{2}-\d{2}$/.test(customStart) && /^\d{4}-\d{2}-\d{2}$/.test(customEnd)) {
    return { start: customStart, end: customEnd, label: `${customStart} — ${customEnd}` };
  }
  const today = new Date();
  let start: Date;
  let end: Date;
  if (period === "monthly") {
    start = new Date(year, month, 1);
    end = new Date(year, month + 1, 0);
  } else if (period === "daily") {
    start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    end = new Date(start);
  } else if (period === "twoDays") {
    end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    start = new Date(end);
    start.setDate(end.getDate() - 1);
  } else {
    // أسبوع العمل يبدأ السبت وينتهي الخميس، والجمعة خارج نطاق التشغيل.
    const day = today.getDay();
    const daysFromSaturday = (day + 1) % 7;
    start = new Date(today);
    start.setDate(today.getDate() - daysFromSaturday);
    end = new Date(start);
    end.setDate(start.getDate() + 5);
  }
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { start: iso(start), end: iso(end), label: `${iso(start)} — ${iso(end)}` };
}

function DateField({ value, onChange, label, colors }: { value: string; onChange: (value: string) => void; label: string; colors: any }) {
  const inputStyle = { height: 40, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, textAlign: "right" as const, fontSize: 14, color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background };
  if (Platform.OS === "web") {
    return React.createElement("input", { type: "date", value, onChange: (event: any) => onChange(event.currentTarget.value), "aria-label": label, style: inputStyle });
  }
  return <TextInput value={value} onChangeText={onChange} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" accessibilityLabel={label} style={inputStyle} />;
}

const rateLabel = (value: number | null, digits = 1) => value == null ? "غير متاح" : `${value.toFixed(digits)}%`;
const amount = (value: number) => value.toLocaleString("ar-SA", { maximumFractionDigits: 2 });
const itemQuantity = (item: any) => pairLabel(exactPairs(item, "item"));

export default function BoardMonthlyReport() {
  const router = useRouter();
  const colors = useColors();
  const { language } = useLanguage();
  const isAr = language === "ar";

  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [period, setPeriod] = useState<ReportPeriod>("monthly");
  const currentMonthStart = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-01`;
  const currentMonthEnd = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-${String(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()).padStart(2, "0")}`;
  const [customStart, setCustomStart] = useState(currentMonthStart);
  const [customEnd, setCustomEnd] = useState(currentMonthEnd);
  const range = periodRange(period, selectedMonth, selectedYear, customStart, customEnd);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const latestReportRequest = useRef(0);

  const monthNamesAr = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
  const monthNamesEn = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const monthNames = isAr ? monthNamesAr : monthNamesEn;

  const selectPeriod = (value: ReportPeriod) => {
    const now = new Date();
    const iso = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    let start = new Date(now);
    let end = new Date(now);
    if (value === "monthly") {
      start = new Date(selectedYear, selectedMonth, 1);
      end = new Date(selectedYear, selectedMonth + 1, 0);
    } else if (value === "daily") {
      start = new Date(now);
      end = new Date(now);
    } else if (value === "twoDays") {
      end = new Date(now);
      start = new Date(now);
      start.setDate(now.getDate() - 1);
    } else if (value === "weekly") {
      const daysFromSaturday = (now.getDay() + 1) % 7;
      start.setDate(now.getDate() - daysFromSaturday);
      end = new Date(start);
      end.setDate(start.getDate() + 5);
    }
    setPeriod(value);
    setCustomStart(iso(start));
    setCustomEnd(iso(end));
  };

  // Generate last 12 months options
  const monthOptions: MonthOption[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    monthOptions.push({
      label: `${monthNames[d.getMonth()]} ${d.getFullYear()}`,
      value: d.getMonth(),
      year: d.getFullYear(),
    });
  }

  useEffect(() => {
    loadReportData();
  }, [selectedMonth, selectedYear, period, customStart, customEnd]);

  const loadReportData = async () => {
    const requestId = ++latestReportRequest.current;
    setIsLoading(true);
    setReportError(null);
    try {
      const filters = { startDate: range.start, endDate: range.end };
      const results = await Promise.allSettled([
        productionService.getAll(), salesService.getAll(), collectionService.getAll(),
        representativeService.sales.list(), representativeService.collections.list(), representativeService.transactions.list(),
        expensesService.getAll(), taskService.getAll(), maintenanceEntriesService.getBySection("periodic"), maintenanceEntriesService.getBySection("emergency"), maintenanceEntriesService.getBySection("stopped"),
        finishedWarehouseService.movements(), finishedWarehouseService.list(),
      ]);
      const failed = results.find((result): result is PromiseRejectedResult => result.status === "rejected");
      if (failed) throw failed.reason;
      const values = results.map((result) => (result as PromiseFulfilledResult<unknown>).value);
      const [productionRaw, legacySalesRaw, legacyCollectionsRaw, salesRaw, collectionsRaw, transactionsRaw, expensesRaw, tasksRaw, periodicRaw, emergencyRaw, stoppedRaw, movementsRaw, stockRaw] = values;
      const productionRows = reportRows(productionRaw).filter((row) => inReportPeriod(row, "production", range.start, range.end));
      const production = productionMetrics(productionRows);
      const commercial = commercialReport({
        sales: reportRows(salesRaw), legacySales: reportRows(legacySalesRaw),
        collections: reportRows(collectionsRaw), legacyCollections: reportRows(legacyCollectionsRaw),
        transactions: reportRows(transactionsRaw), startDate: range.start, endDate: range.end,
      });
      const warehouse = warehousePeriod({ movements: reportRows(movementsRaw), stock: reportRows(stockRaw), startDate: range.start, endDate: range.end });
      const expenseRows = reportRows(expensesRaw).filter((row) => inReportPeriod(row, "general", range.start, range.end));
      const taskRows = reportRows(tasksRaw).filter((row) => inReportPeriod(row, "general", range.start, range.end));
      const expCategories: Record<string, number> = {};
      const expenseTotal = expenseRows.reduce((sum, row: any) => {
        const amount = Number(row.amount || 0);
        const category = row.category || row.description || (isAr ? "أخرى" : "Other");
        expCategories[category] = (expCategories[category] || 0) + amount;
        return sum + amount;
      }, 0);
      const completed = taskRows.filter((row: any) => row.result === "completed").length;
      const pending = taskRows.filter((row: any) => !row.result || row.result === "pending").length;
      const overdue = taskRows.filter((row: any) => row.result === "overdue" || row.status === "overdue").length;
      const reportMonth = period === "custom" ? range.start.slice(0, 7) : `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}`;
      const prior = new Date(Number(reportMonth.slice(0, 4)), Number(reportMonth.slice(5, 7)) - 2, 1);
      const priorMonth = `${prior.getFullYear()}-${String(prior.getMonth() + 1).padStart(2, "0")}`;
      const emptyManufacturingReport = { total: 0, produced: 0, notProduced: 0, pending: 0, producedDozen: 0, notProducedDozen: 0, failureReasons: [] as { reason: string; count: number; quantityDozen: number }[] };
      const [manufacturingRequests, previousManufacturingRequests] = await Promise.all([
        productManufacturingRequestService.monthlyReport(reportMonth), productManufacturingRequestService.monthlyReport(priorMonth),
      ]);
      if (requestId !== latestReportRequest.current) return;
      setReportData({
        production: { totalDozen: production.totalPairs / 12, totalPairs: production.totalPairs, totalEntries: productionRows.length, wasteThread: production.wasteThreadGrams, wasteSocks: production.wasteSocksGrams, yarnWeight: production.yarnGrams, wasteNeedles: production.wasteNeedles, secondGrade: production.secondPairs, firstGrade: production.firstPairs, wastePercentage: production.wastePercent, threadWastePercentage: production.threadWastePercent },
        sales: { totalEntries: commercial.salesRows.length, totalAmount: commercial.salesAmount },
        expenses: { totalAmount: expenseTotal, categories: Object.entries(expCategories).map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount).slice(0, 5) },
        maintenance: { periodicCount: reportRows(periodicRaw).length, emergencyCount: reportRows(emergencyRaw).length, stoppedMachines: reportRows(stoppedRaw).length },
        tasks: { total: taskRows.length, completed, pending, overdue, completionRate: taskRows.length ? completed / taskRows.length * 100 : 0 },
        collection: { totalAmount: commercial.collectionAmount, totalEntries: commercial.collectionRows.length, collectionRate: commercial.salesAmount ? commercial.collectionAmount / commercial.salesAmount * 100 : 0 },
        warehouse: { movementCount: warehouse.movements.length, receiptPairs: warehouse.receiptPairs, issuePairs: warehouse.issuePairs, adjustmentPairs: warehouse.adjustmentPairs, currentPairs: warehouse.currentPairs, openingPairs: warehouse.openingPairs, closingPairs: warehouse.closingPairs, invalidQuantityCount: warehouse.invalidQuantityCount },
        commercial: { salesRows: commercial.salesRows, orderRows: commercial.orderRows, visitRows: commercial.visitRows, otherTransactionRows: commercial.otherTransactionRows, collectionRows: commercial.collectionRows },
        manufacturingRequests: manufacturingRequests || emptyManufacturingReport,
        previousManufacturingRequests: previousManufacturingRequests || emptyManufacturingReport,
      });
    } catch (error: any) {
      if (requestId === latestReportRequest.current) {
        console.error("Error loading report data:", error);
        setReportData(null);
        setReportError(error?.message || (isAr ? "تعذر تحميل بيانات التقرير. لا يمكن عرض أصفار بديلة." : "Could not load report data; zero substitutes are not shown."));
      }
    } finally {
      if (requestId === latestReportRequest.current) setIsLoading(false);
    }
  };

  const handleExportPDF = async () => {
    if (!reportData) return;
    setIsExporting(true);
    try {
      const monthLabel = `${period === "monthly" ? `${monthNames[selectedMonth]} ${selectedYear}` : period === "weekly" ? (isAr ? "الأسبوع الحالي" : "Current week") : (isAr ? "اليوم" : "Today")} (${range.label})`;
      const pdfData: PDFReportData = {
        title: isAr ? "التقرير الشهري لمجلس الإدارة" : "Monthly Board Report",
        subtitle: monthLabel,
        date: new Date().toLocaleDateString(isAr ? "ar-SA" : "en-US"),
        footer: isAr ? "مصنع السلطان - تقرير سري وخاص بمجلس الإدارة" : "Sultan Factory - Confidential Board Report",
        sections: [
          {
            title: isAr ? "ملخص الأداء العام" : "Overall Performance Summary",
            type: "summary",
            data: [
              { label: isAr ? "إجمالي الإنتاج" : "Total Production", value: pairLabel(reportData.production.totalPairs) },
              { label: isAr ? "إجمالي المبيعات" : "Total Sales", value: `${amount(reportData.sales.totalAmount)} ${isAr ? "ريال" : "SAR"}` },
              { label: isAr ? "إجمالي المصروفات" : "Total Expenses", value: `${amount(reportData.expenses.totalAmount)} ${isAr ? "ريال" : "SAR"}` },
              { label: isAr ? "إجمالي التحصيل" : "Total Collection", value: `${amount(reportData.collection.totalAmount)} ${isAr ? "ريال" : "SAR"}` },
              { label: isAr ? "هدر الخيوط" : "Yarn Waste", value: `${reportData.production.wasteThread.toLocaleString()} ${isAr ? "جرام" : "g"}` },
              { label: isAr ? "نسبة الهدر" : "Waste Rate", value: rateLabel(reportData.production.wastePercentage) },
              { label: isAr ? "المهام المكتملة" : "Tasks Completed", value: `${reportData.tasks.completed}/${reportData.tasks.total}` },
            ],
          },
          {
            title: isAr ? "مؤشرات الأداء الرئيسية" : "Key Performance Indicators",
            type: "kpi",
            data: [
              {
                title: isAr ? "نسبة الهدر" : "Waste Rate",
                value: rateLabel(reportData.production.wastePercentage),
                target: isAr ? "أقل من 5%" : "Below 5%",
                status: reportData.production.wastePercentage == null ? "warning" : reportData.production.wastePercentage <= 5 ? "good" : reportData.production.wastePercentage <= 10 ? "warning" : "bad",
              },
              {
                title: isAr ? "نسبة إنجاز المهام" : "Task Completion Rate",
                value: `${reportData.tasks.completionRate.toFixed(0)}%`,
                target: "100%",
                status: reportData.tasks.completionRate >= 80 ? "good" : reportData.tasks.completionRate >= 60 ? "warning" : "bad",
              },
              {
                title: isAr ? "نسبة التحصيل" : "Collection Rate",
                value: `${reportData.collection.collectionRate.toFixed(0)}%`,
                target: "100%",
                status: reportData.collection.collectionRate >= 80 ? "good" : reportData.collection.collectionRate >= 60 ? "warning" : "bad",
              },
            ],
          },
          {
            title: isAr ? "تفاصيل الإنتاج" : "Production Details",
            type: "table",
            data: {
              headers: [
                isAr ? "البند" : "Item",
                isAr ? "القيمة" : "Value",
              ],
              rows: [
                [isAr ? "إجمالي الإنتاج" : "Total Production", pairLabel(reportData.production.totalPairs)],
                [isAr ? "الفرز الأول" : "First grade", pairLabel(reportData.production.firstGrade)],
                [isAr ? "عدد الإدخالات" : "Total Entries", `${reportData.production.totalEntries}`],
                [isAr ? "هدر الخيوط (جرام)" : "Thread Waste (g)", `${reportData.production.wasteThread}`],
                [isAr ? "هدر الجوارب (جرام)" : "Socks Waste (g)", `${reportData.production.wasteSocks}`],
                [isAr ? "وزن الخيوط المستخدم (جرام)" : "Yarn Used (g)", `${reportData.production.yarnWeight.toFixed(2)}`],
                [isAr ? "نسبة الهدر" : "Waste Rate", rateLabel(reportData.production.wastePercentage)],
                [isAr ? "هدر الإبر (حبة)" : "Needle Waste (pcs)", `${reportData.production.wasteNeedles}`],
                [isAr ? "النخب الثاني (أزواج)" : "Second Grade (Pairs)", `${reportData.production.secondGrade}`],
              ],
            },
          },
          {
            title: isAr ? "تفاصيل المبيعات" : "Sales Details",
            type: "table",
            data: {
              headers: [
                isAr ? "البند" : "Item",
                isAr ? "القيمة" : "Value",
              ],
              rows: [
                [isAr ? "عدد الفواتير" : "Invoice count", `${reportData.sales.totalEntries}`],
                [isAr ? "إجمالي المبيعات" : "Total Sales", `${amount(reportData.sales.totalAmount)} ${isAr ? "ريال" : "SAR"}`],
                [isAr ? "عدد التحصيلات" : "Collection count", `${reportData.collection.totalEntries}`],
                [isAr ? "إجمالي التحصيل" : "Total Collection", `${amount(reportData.collection.totalAmount)} ${isAr ? "ريال" : "SAR"}`],
                [isAr ? "نسبة التحصيل" : "Collection Rate", `${reportData.collection.collectionRate.toFixed(1)}%`],
              ],
            },
          },
          {
            title: isAr ? "تفاصيل فواتير المبيعات" : "Sales invoice details",
            type: "table",
            data: {
              headers: [isAr ? "الفاتورة" : "Invoice", isAr ? "العميل" : "Customer", isAr ? "التاريخ" : "Date", isAr ? "المندوب/المصدر" : "Representative/source", isAr ? "المبلغ" : "Amount", isAr ? "المرفقات" : "Attachments"],
              rows: reportData.commercial.salesRows.map((row) => [row.invoiceNumber || row.referenceCode || row.id || "—", row.customerName || "—", row.invoiceDate || "—", row.representativeName || row.sellerName || row.reportSource || "—", `${amount(Number(row.amount || 0))} ${isAr ? "ر.س" : "SAR"}`, Array.isArray(row.attachments) ? row.attachments.map((file: any) => file.name || file.fileName || file.type).join("، ") || "—" : "—"]),
            },
          },
          {
            title: isAr ? "تفاصيل التحصيل" : "Collection details",
            type: "table",
            data: {
              headers: [isAr ? "السند" : "Receipt", isAr ? "العميل" : "Customer", isAr ? "التاريخ" : "Date", isAr ? "المندوب/المصدر" : "Representative/source", isAr ? "المبلغ" : "Amount", isAr ? "المرفقات" : "Attachments"],
              rows: reportData.commercial.collectionRows.map((row) => [row.receiptNumber || row.referenceCode || row.id || "—", row.customerName || "—", row.collectionDate || row.receiptDate || "—", row.representativeName || row.collectorName || row.reportSource || "—", `${amount(Number(row.collectedAmount ?? row.amount ?? 0))} ${isAr ? "ر.س" : "SAR"}`, Array.isArray(row.attachments) ? row.attachments.map((file: any) => file.name || file.fileName || file.type).join("، ") || "—" : "—"]),
            },
          },
          {
            title: isAr ? "تفاصيل المصروفات" : "Expenses Details",
            type: "table",
            data: {
              headers: [
                isAr ? "البند" : "Category",
                isAr ? "المبلغ" : "Amount",
              ],
              rows: [
                [isAr ? "إجمالي المصروفات" : "Total Expenses", `${reportData.expenses.totalAmount.toLocaleString()} ${isAr ? "ريال" : "SAR"}`],
                ...reportData.expenses.categories.map(cat => [cat.name, `${cat.amount.toLocaleString()} ${isAr ? "ريال" : "SAR"}`]),
              ],
            },
          },
          {
            title: isAr ? "الصيانة" : "Maintenance",
            type: "summary",
            data: [
              { label: isAr ? "الصيانة الدورية" : "Periodic Maintenance", value: `${reportData.maintenance.periodicCount}` },
              { label: isAr ? "صيانة الطوارئ" : "Emergency Maintenance", value: `${reportData.maintenance.emergencyCount}` },
              { label: isAr ? "أجهزة متوقفة" : "Stopped Machines", value: `${reportData.maintenance.stoppedMachines}` },
            ],
          },
          {
            title: isAr ? "المهام" : "Tasks",
            type: "summary",
            data: [
              { label: isAr ? "إجمالي المهام" : "Total Tasks", value: `${reportData.tasks.total}` },
              { label: isAr ? "مكتملة" : "Completed", value: `${reportData.tasks.completed}` },
              { label: isAr ? "معلقة" : "Pending", value: `${reportData.tasks.pending}` },
              { label: isAr ? "متأخرة" : "Overdue", value: `${reportData.tasks.overdue}` },
              { label: isAr ? "نسبة الإنجاز" : "Completion Rate", value: `${reportData.tasks.completionRate.toFixed(0)}%` },
            ],
          },
          {
            title: isAr ? "طلبات التصنيع وأسباب التعثر" : "Manufacturing Requests & Failure Reasons",
            type: "table",
            data: {
              headers: [isAr ? "البند" : "Item", isAr ? "القيمة" : "Value", isAr ? "النسبة" : "Rate"],
              rows: [
                [isAr ? "إجمالي الطلبات" : "Total Requests", `${reportData.manufacturingRequests.total}`, "100%"],
                [isAr ? "تم الإنتاج" : "Produced", `${reportData.manufacturingRequests.produced} / ${reportData.manufacturingRequests.producedDozen} درزن`, `${reportData.manufacturingRequests.total ? (reportData.manufacturingRequests.produced / reportData.manufacturingRequests.total * 100).toFixed(1) : 0}%`],
                [isAr ? "لم يتم الإنتاج" : "Not Produced", `${reportData.manufacturingRequests.notProduced} / ${reportData.manufacturingRequests.notProducedDozen} درزن`, `${reportData.manufacturingRequests.total ? (reportData.manufacturingRequests.notProduced / reportData.manufacturingRequests.total * 100).toFixed(1) : 0}%`],
                [isAr ? "لم تسجل النتيجة" : "Pending Result", `${reportData.manufacturingRequests.pending}`, `${reportData.manufacturingRequests.total ? (reportData.manufacturingRequests.pending / reportData.manufacturingRequests.total * 100).toFixed(1) : 0}%`],
                [isAr ? "تغير الإنتاج عن الشهر السابق" : "Production change vs prior month", `${reportData.manufacturingRequests.produced - reportData.previousManufacturingRequests.produced} طلب`, `${reportData.previousManufacturingRequests.produced ? ((reportData.manufacturingRequests.produced - reportData.previousManufacturingRequests.produced) / reportData.previousManufacturingRequests.produced * 100).toFixed(1) : 0}%`],
                [isAr ? "تغير التعثر عن الشهر السابق" : "Failure change vs prior month", `${reportData.manufacturingRequests.notProduced - reportData.previousManufacturingRequests.notProduced} طلب`, `${reportData.previousManufacturingRequests.notProduced ? ((reportData.manufacturingRequests.notProduced - reportData.previousManufacturingRequests.notProduced) / reportData.previousManufacturingRequests.notProduced * 100).toFixed(1) : 0}%`],
                ...reportData.manufacturingRequests.failureReasons.map((item) => [item.reason, `${item.count} / ${item.quantityDozen} درزن`, `${reportData.manufacturingRequests.notProduced ? (item.count / reportData.manufacturingRequests.notProduced * 100).toFixed(1) : 0}%`]),
              ],
            },
          },
          {
            title: isAr ? "التوصيات" : "Recommendations",
            type: "text",
            data: generateRecommendations(reportData),
          },
        ],
      };

      await exportReportAsPDF(pdfData);
      Alert.alert(
        isAr ? "تم التصدير" : "Exported",
        isAr ? "تم تصدير التقرير الشهري بنجاح" : "Monthly report exported successfully"
      );
    } catch (error: any) {
      Alert.alert(
        isAr ? "خطأ" : "Error",
        error.message || (isAr ? "فشل في تصدير التقرير" : "Failed to export report")
      );
    } finally {
      setIsExporting(false);
    }
  };

  const generateRecommendations = (data: ReportData): string => {
    const recommendations: string[] = [];
    if (data.production.wastePercentage != null && data.production.wastePercentage > 5) {
      recommendations.push(isAr
        ? `• نسبة الهدر (${data.production.wastePercentage.toFixed(1)}%) تتجاوز الحد المقبول (5%). يُوصى بمراجعة خطوط الإنتاج وتدريب العمال.`
        : `• Waste rate (${data.production.wastePercentage.toFixed(1)}%) exceeds acceptable limit (5%). Review production lines and train workers.`
      );
    }
    if (data.tasks.completionRate < 80) {
      recommendations.push(isAr
        ? `• نسبة إنجاز المهام (${data.tasks.completionRate.toFixed(0)}%) أقل من المطلوب. يُوصى بمتابعة المهام المتأخرة وتوزيع الأعباء.`
        : `• Task completion rate (${data.tasks.completionRate.toFixed(0)}%) is below target. Follow up on overdue tasks.`
      );
    }
    if (data.collection.collectionRate < 80) {
      recommendations.push(isAr
        ? `• نسبة التحصيل (${data.collection.collectionRate.toFixed(0)}%) منخفضة. يُوصى بتكثيف جهود التحصيل ومتابعة العملاء المتأخرين.`
        : `• Collection rate (${data.collection.collectionRate.toFixed(0)}%) is low. Intensify collection efforts.`
      );
    }
    if (data.maintenance.emergencyCount > 3) {
      recommendations.push(isAr
        ? `• عدد حالات الطوارئ (${data.maintenance.emergencyCount}) مرتفع. يُوصى بتعزيز الصيانة الوقائية.`
        : `• Emergency maintenance cases (${data.maintenance.emergencyCount}) are high. Strengthen preventive maintenance.`
      );
    }
    if (data.sales.totalAmount > 0 && data.expenses.totalAmount > data.sales.totalAmount) {
      recommendations.push(isAr
        ? `• المصروفات تتجاوز المبيعات. يُوصى بمراجعة بنود الصرف وتقليل التكاليف غير الضرورية.`
        : `• Expenses exceed sales. Review spending items and reduce unnecessary costs.`
      );
    }
    if (recommendations.length === 0) {
      recommendations.push(isAr
        ? "• الأداء العام جيد. يُوصى بالاستمرار في المتابعة والتحسين المستمر."
        : "• Overall performance is good. Continue monitoring and continuous improvement."
      );
    }
    return recommendations.join("\n\n");
  };

  const getStatusColor = (value: number, goodThreshold: number, warningThreshold: number) => {
    if (value >= goodThreshold) return "#22C55E";
    if (value >= warningThreshold) return "#F59E0B";
    return "#EF4444";
  };

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <MaterialIcons name="arrow-forward" size={24} color={colors.foreground} />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>
              {isAr ? "التقرير الموحد لمجلس الإدارة" : "Unified Board Report"}
            </Text>
            <Text style={[styles.headerSubtitle, { color: colors.muted }]}>
              {isAr ? "ملخص تشغيلي واضح حسب الفترة" : "Clear operating summary by period"}
            </Text>
          </View>
          <View style={[styles.headerIcon, { backgroundColor: "#7C3AED20" }]}>
            <MaterialIcons name="summarize" size={24} color="#7C3AED" />
          </View>
        </View>

        {/* Period Selector */}
        <View style={[styles.periodSelector, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.monthLabel, { color: colors.muted }]}>{isAr ? "الفترة:" : "Period:"}</Text>
          <View style={styles.periodButtons}>
            {([
              ["daily", isAr ? "يومي" : "Daily"],
              ["twoDays", isAr ? "يومان" : "2 days"],
              ["weekly", isAr ? "أسبوعي" : "Weekly"],
              ["monthly", isAr ? "شهري" : "Monthly"],
              ["custom", isAr ? "نطاق مخصص" : "Custom range"],
            ] as const).map(([value, label]) => <TouchableOpacity key={value} onPress={() => selectPeriod(value)} style={[styles.periodButton, period === value && { backgroundColor: colors.primary }]}><Text style={[styles.periodButtonText, { color: period === value ? "#fff" : colors.foreground }]}>{label}</Text></TouchableOpacity>)}
          </View>
          <Text style={[styles.rangeText, { color: colors.foreground }]}>{isAr ? "من — إلى:" : "From — To:"} {range.label}</Text>
        </View>
        <View style={[styles.customDateRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.customDateField}>
            <Text style={[styles.customDateLabel, { color: colors.muted }]}>{isAr ? "من تاريخ" : "From date"}</Text>
            <DateField value={customStart} onChange={(value) => { setCustomStart(value); setPeriod("custom"); }} label={isAr ? "من تاريخ" : "From date"} colors={colors} />
          </View>
          <View style={styles.customDateField}>
            <Text style={[styles.customDateLabel, { color: colors.muted }]}>{isAr ? "إلى تاريخ" : "To date"}</Text>
            <DateField value={customEnd} onChange={(value) => { setCustomEnd(value); setPeriod("custom"); }} label={isAr ? "إلى تاريخ" : "To date"} colors={colors} />
          </View>
        </View>

        {/* Month Selector (used for monthly comparison) */}
        {period === "monthly" && <><View style={[styles.monthSelector, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.monthLabel, { color: colors.muted }]}>
            {isAr ? "اختر الشهر:" : "Select Month:"}
          </Text>
          <TouchableOpacity
            style={[styles.monthButton, { backgroundColor: colors.background, borderColor: colors.border }]}
            onPress={() => setShowMonthPicker(!showMonthPicker)}
          >
            <MaterialIcons name="calendar-today" size={18} color={colors.primary} />
            <Text style={[styles.monthButtonText, { color: colors.foreground }]}>
              {`${monthNames[selectedMonth]} ${selectedYear}`}
            </Text>
            <MaterialIcons name={showMonthPicker ? "expand-less" : "expand-more"} size={20} color={colors.muted} />
          </TouchableOpacity>
        </View>

        {/* Month Picker Dropdown */}
        {showMonthPicker && (
          <View style={[styles.monthDropdown, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {monthOptions.map((option, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.monthOption,
                  option.value === selectedMonth && option.year === selectedYear && { backgroundColor: colors.primary + "20" },
                ]}
                onPress={() => {
                  setSelectedMonth(option.value);
                  setSelectedYear(option.year);
                  setShowMonthPicker(false);
                }}
              >
                <Text style={[
                  styles.monthOptionText,
                  { color: option.value === selectedMonth && option.year === selectedYear ? colors.primary : colors.foreground },
                ]}>
                  {option.label}
                </Text>
                {option.value === selectedMonth && option.year === selectedYear && (
                  <MaterialIcons name="check" size={18} color={colors.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
        </>}

        {/* Loading State */}
        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.muted }]}>
              {isAr ? "جاري تحميل البيانات..." : "Loading data..."}
            </Text>
          </View>
        )}

        <CustodySummaryPanel startDate={range.start} endDate={range.end}/>

        {!isLoading && reportError && (
          <View style={[styles.emptyState, { marginHorizontal: 8, borderWidth: 1, borderColor: "#FCA5A5", borderRadius: 10, backgroundColor: "#FEF2F2" }]}>
            <MaterialIcons name="error-outline" size={38} color="#DC2626" />
            <Text style={[styles.emptyText, { color: "#991B1B", textAlign: "center" }]}>{reportError}</Text>
            <TouchableOpacity style={[styles.retryButton, { borderColor: colors.primary }]} onPress={loadReportData}><Text style={[styles.retryText, { color: colors.primary }]}>{isAr ? "إعادة المحاولة" : "Retry"}</Text></TouchableOpacity>
          </View>
        )}

        {/* Report Preview */}
        {!isLoading && reportData && (
          <>
            {/* Summary Cards */}
            <View style={styles.summaryGrid}>
              <View style={[styles.summaryCard, { backgroundColor: "#EFF6FF", borderColor: "#BFDBFE" }]}>
                <MaterialIcons name="precision-manufacturing" size={22} color="#2563EB" />
                <Text style={[styles.summaryValue, { color: "#2563EB" }]}>{pairLabel(reportData.production.totalPairs)}</Text>
                <Text style={styles.summaryLabel}>{isAr ? (reportData.production.totalEntries ? "إنتاج مسجل" : "لا يوجد نشاط إنتاجي") : (reportData.production.totalEntries ? "Recorded production" : "No production activity")}</Text>
              </View>
              <View style={[styles.summaryCard, { backgroundColor: "#F0FDF4", borderColor: "#BBF7D0" }]}>
                <MaterialIcons name="point-of-sale" size={22} color="#16A34A" />
                <Text style={[styles.summaryValue, { color: "#16A34A" }]}>{amount(reportData.sales.totalAmount)}</Text>
                <Text style={styles.summaryLabel}>{isAr ? `${reportData.sales.totalEntries} فاتورة مبيعات` : `${reportData.sales.totalEntries} sales invoices`}</Text>
              </View>
              <View style={[styles.summaryCard, { backgroundColor: "#FEF2F2", borderColor: "#FECACA" }]}>
                <MaterialIcons name="money-off" size={22} color="#DC2626" />
                <Text style={[styles.summaryValue, { color: "#DC2626" }]}>{reportData.expenses.totalAmount.toLocaleString()}</Text>
                <Text style={styles.summaryLabel}>{isAr ? "ريال مصروفات" : "SAR Expenses"}</Text>
              </View>
              <View style={[styles.summaryCard, { backgroundColor: "#FFF7ED", borderColor: "#FED7AA" }]}>
                <MaterialIcons name="inventory-2" size={22} color="#C2410C" />
                <Text style={[styles.summaryValue, { color: "#C2410C" }]}>{pairLabel(reportData.warehouse.currentPairs)}</Text>
                <Text style={styles.summaryLabel}>{isAr ? `إنتاج تام حاليًا — ${reportData.warehouse.movementCount} حركة` : `Current finished goods — ${reportData.warehouse.movementCount} movements`}</Text>
              </View>
              <View style={[styles.summaryCard, { backgroundColor: "#FFF7ED", borderColor: "#FED7AA" }]}>
                <MaterialIcons name="scale" size={22} color="#C2410C" />
                <Text style={[styles.summaryValue, { color: "#C2410C" }]}>{reportData.production.wasteThread.toLocaleString()}</Text>
                <Text style={styles.summaryLabel}>{isAr ? "هدر الخيوط — جرام" : "Yarn waste — grams"}</Text>
              </View>
              <View style={[styles.summaryCard, { backgroundColor: reportData.production.wastePercentage != null && reportData.production.wastePercentage <= 5 ? "#F0FDF4" : "#FEF2F2", borderColor: reportData.production.wastePercentage != null && reportData.production.wastePercentage <= 5 ? "#BBF7D0" : "#FECACA" }]}>
                <MaterialIcons name="percent" size={22} color={reportData.production.wastePercentage != null && reportData.production.wastePercentage <= 5 ? "#16A34A" : "#DC2626"} />
                <Text style={[styles.summaryValue, { color: reportData.production.wastePercentage != null && reportData.production.wastePercentage <= 5 ? "#16A34A" : "#DC2626" }]}>{rateLabel(reportData.production.wastePercentage)}</Text>
                <Text style={styles.summaryLabel}>{isAr ? "نسبة هدر الخيوط" : "Yarn waste rate"}</Text>
              </View>
            </View>

            {/* KPI Indicators */}
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              {isAr ? "مؤشرات الأداء" : "Performance Indicators"}
            </Text>
            <View style={styles.kpiGrid}>
              <View style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={[styles.kpiIndicator, { backgroundColor: reportData.production.wastePercentage == null ? "#94A3B8" : getStatusColor(100 - reportData.production.wastePercentage, 95, 90) }]} />
                <Text style={[styles.kpiTitle, { color: colors.muted }]}>{isAr ? "نسبة الهدر" : "Waste Rate"}</Text>
                <Text style={[styles.kpiValue, { color: reportData.production.wastePercentage == null ? "#64748B" : getStatusColor(100 - reportData.production.wastePercentage, 95, 90) }]}>
                  {rateLabel(reportData.production.wastePercentage)}
                </Text>
              </View>
              <View style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={[styles.kpiIndicator, { backgroundColor: getStatusColor(reportData.tasks.completionRate, 80, 60) }]} />
                <Text style={[styles.kpiTitle, { color: colors.muted }]}>{isAr ? "إنجاز المهام" : "Task Completion"}</Text>
                <Text style={[styles.kpiValue, { color: getStatusColor(reportData.tasks.completionRate, 80, 60) }]}>
                  {reportData.tasks.completionRate.toFixed(0)}%
                </Text>
              </View>
              <View style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={[styles.kpiIndicator, { backgroundColor: getStatusColor(reportData.collection.collectionRate, 80, 60) }]} />
                <Text style={[styles.kpiTitle, { color: colors.muted }]}>{isAr ? "نسبة التحصيل" : "Collection Rate"}</Text>
                <Text style={[styles.kpiValue, { color: getStatusColor(reportData.collection.collectionRate, 80, 60) }]}>
                  {reportData.collection.collectionRate.toFixed(0)}%
                </Text>
              </View>
              <View style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={[styles.kpiIndicator, { backgroundColor: reportData.maintenance.emergencyCount <= 3 ? "#22C55E" : "#EF4444" }]} />
                <Text style={[styles.kpiTitle, { color: colors.muted }]}>{isAr ? "طوارئ الصيانة" : "Emergency Maint."}</Text>
                <Text style={[styles.kpiValue, { color: reportData.maintenance.emergencyCount <= 3 ? "#22C55E" : "#EF4444" }]}>
                  {reportData.maintenance.emergencyCount}
                </Text>
              </View>
            </View>

            {/* Detailed Sections */}
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              {isAr ? "تفاصيل الأقسام" : "Section Details"}
            </Text>

            <View style={[styles.detailCard, { backgroundColor: colors.surface, borderColor: colors.border }] }>
              <View style={styles.detailHeader}><MaterialIcons name="assignment-late" size={20} color="#DC2626" /><Text style={[styles.detailTitle, { color: colors.foreground }]}>{isAr ? "طلبات التصنيع وأسباب التعثر" : "Manufacturing Requests"}</Text></View>
              <View style={styles.detailRow}><Text style={[styles.detailLabel, { color: colors.muted }]}>{isAr ? "تم الإنتاج" : "Produced"}</Text><Text style={[styles.detailValue, { color: "#15803D" }]}>{reportData.manufacturingRequests.produced} ({reportData.manufacturingRequests.total ? (reportData.manufacturingRequests.produced / reportData.manufacturingRequests.total * 100).toFixed(1) : 0}%)</Text></View>
              <View style={styles.detailRow}><Text style={[styles.detailLabel, { color: colors.muted }]}>{isAr ? "لم يتم الإنتاج" : "Not produced"}</Text><Text style={[styles.detailValue, { color: "#DC2626" }]}>{reportData.manufacturingRequests.notProduced} ({reportData.manufacturingRequests.total ? (reportData.manufacturingRequests.notProduced / reportData.manufacturingRequests.total * 100).toFixed(1) : 0}%)</Text></View>
              <View style={styles.detailRow}><Text style={[styles.detailLabel, { color: colors.muted }]}>{isAr ? "لم تسجل النتيجة" : "Pending"}</Text><Text style={[styles.detailValue, { color: "#B45309" }]}>{reportData.manufacturingRequests.pending} ({reportData.manufacturingRequests.total ? (reportData.manufacturingRequests.pending / reportData.manufacturingRequests.total * 100).toFixed(1) : 0}%)</Text></View>
              {reportData.manufacturingRequests.failureReasons.slice(0, 5).map((item) => <View key={item.reason} style={styles.detailRow}><Text style={[styles.detailLabel, { color: colors.muted }]}>{item.reason}</Text><Text style={[styles.detailValue, { color: "#7C3AED" }]}>{item.count} ({reportData.manufacturingRequests.notProduced ? (item.count / reportData.manufacturingRequests.notProduced * 100).toFixed(1) : 0}%)</Text></View>)}
              <Text style={{ color: colors.foreground, textAlign: "right", fontWeight: "900", marginTop: 8 }}>مقارنة بالشهر السابق</Text>
              <View style={styles.detailRow}><Text style={[styles.detailLabel, { color: colors.muted }]}>تغير تم الإنتاج</Text><Text style={[styles.detailValue, { color: reportData.manufacturingRequests.produced >= reportData.previousManufacturingRequests.produced ? "#15803D" : "#DC2626" }]}>{reportData.manufacturingRequests.produced - reportData.previousManufacturingRequests.produced} طلب</Text></View>
              <View style={styles.detailRow}><Text style={[styles.detailLabel, { color: colors.muted }]}>تغير لم يتم الإنتاج</Text><Text style={[styles.detailValue, { color: reportData.manufacturingRequests.notProduced <= reportData.previousManufacturingRequests.notProduced ? "#15803D" : "#DC2626" }]}>{reportData.manufacturingRequests.notProduced - reportData.previousManufacturingRequests.notProduced} طلب</Text></View>
            </View>

            {/* Production Details */}
            <View style={[styles.detailCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.detailHeader}>
                <MaterialIcons name="precision-manufacturing" size={20} color="#2563EB" />
                <Text style={[styles.detailTitle, { color: colors.foreground }]}>
                  {isAr ? "الإنتاج" : "Production"}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: colors.muted }]}>{isAr ? "إجمالي الإنتاج" : "Total production"}</Text>
                <Text style={[styles.detailValue, { color: colors.foreground }]}>{pairLabel(reportData.production.totalPairs)}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: colors.muted }]}>{isAr ? "هدر الخيوط" : "Thread Waste"}</Text>
                <Text style={[styles.detailValue, { color: colors.foreground }]}>{reportData.production.wasteThread} {isAr ? "جرام" : "g"}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: colors.muted }]}>{isAr ? "النخب الثاني" : "Second Grade"}</Text>
                <Text style={[styles.detailValue, { color: colors.foreground }]}>{pairLabel(reportData.production.secondGrade)}</Text>
              </View>
            </View>

            {/* Sales Details */}
            <View style={[styles.detailCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.detailHeader}>
                <MaterialIcons name="point-of-sale" size={20} color="#16A34A" />
                <Text style={[styles.detailTitle, { color: colors.foreground }]}>
                  {isAr ? "إدارة التسويق والمبيعات" : "Marketing & Sales Management"}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: colors.muted }]}>{isAr ? "إجمالي المبيعات" : "Total Sales"}</Text>
                <Text style={[styles.detailValue, { color: colors.foreground }]}>{amount(reportData.sales.totalAmount)} {isAr ? "ر.س" : "SAR"}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: colors.muted }]}>{isAr ? "عدد الفواتير" : "Invoice count"}</Text>
                <Text style={[styles.detailValue, { color: colors.foreground }]}>{reportData.sales.totalEntries}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: colors.muted }]}>{isAr ? "عدد التحصيلات" : "Collection count"}</Text>
                <Text style={[styles.detailValue, { color: colors.foreground }]}>{reportData.collection.totalEntries}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: colors.muted }]}>{isAr ? "المحصّل" : "Collected"}</Text>
                <Text style={[styles.detailValue, { color: colors.foreground }]}>{amount(reportData.collection.totalAmount)} {isAr ? "ر.س" : "SAR"}</Text>
              </View>
            </View>

            <View style={[styles.detailCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.detailHeader}><MaterialIcons name="receipt-long" size={20} color="#16A34A" /><Text style={[styles.detailTitle, { color: colors.foreground }]}>{isAr ? "تفاصيل فواتير المبيعات" : "Sales invoice details"}</Text></View>
              {reportData.commercial.salesRows.length === 0 ? <Text style={[styles.detailLabel, { color: colors.muted }]}>{isAr ? "لا توجد فواتير مبيعات في الفترة" : "No sales invoices in this period"}</Text> : reportData.commercial.salesRows.map((row: any) => <View key={`sale-${row.reportSource}-${row.id ?? row.referenceCode}`} style={styles.detailListRow}>
                <Text style={[styles.detailValue, { color: colors.foreground }]}>{row.invoiceNumber || row.referenceCode || "—"} · {row.customerName || "—"}</Text>
                <Text style={[styles.detailLabel, { color: colors.muted }]}>{row.invoiceDate || "—"} · {amount(Number(row.amount || 0))} ر.س · {row.representativeName || row.sellerName || row.reportSource}</Text>
                {Array.isArray(row.attachments) && row.attachments.length > 0 && <Text style={[styles.detailLabel, { color: colors.muted }]}>{isAr ? "المرفقات: " : "Attachments: "}{row.attachments.map((file: any) => file.name || file.fileName || file.type).join("، ")}</Text>}
              </View>)}
            </View>

            <View style={[styles.detailCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.detailHeader}><MaterialIcons name="payments" size={20} color="#0284C7" /><Text style={[styles.detailTitle, { color: colors.foreground }]}>{isAr ? "تفاصيل التحصيل" : "Collection details"}</Text></View>
              {reportData.commercial.collectionRows.length === 0 ? <Text style={[styles.detailLabel, { color: colors.muted }]}>{isAr ? "لا توجد تحصيلات في الفترة" : "No collections in this period"}</Text> : reportData.commercial.collectionRows.map((row: any) => <View key={`collection-${row.reportSource}-${row.id ?? row.referenceCode}`} style={styles.detailListRow}>
                <Text style={[styles.detailValue, { color: colors.foreground }]}>{row.receiptNumber || row.referenceCode || "—"} · {row.customerName || "—"}</Text>
                <Text style={[styles.detailLabel, { color: colors.muted }]}>{row.collectionDate || row.receiptDate || "—"} · {amount(Number(row.collectedAmount ?? row.amount ?? 0))} ر.س · {row.representativeName || row.collectorName || row.reportSource}</Text>
                {Array.isArray(row.attachments) && row.attachments.length > 0 && <Text style={[styles.detailLabel, { color: colors.muted }]}>{isAr ? "المرفقات: " : "Attachments: "}{row.attachments.map((file: any) => file.name || file.fileName || file.type).join("، ")}</Text>}
              </View>)}
            </View>

            <View style={[styles.detailCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.detailHeader}><MaterialIcons name="assignment" size={20} color="#7C3AED" /><Text style={[styles.detailTitle, { color: colors.foreground }]}>{isAr ? "تفاصيل الطلبات والزيارات" : "Order and visit details"}</Text></View>
              {[...reportData.commercial.orderRows, ...reportData.commercial.visitRows, ...reportData.commercial.otherTransactionRows].map((row: any) => <View key={`transaction-${row.reportSource}-${row.id ?? row.referenceCode}`} style={styles.detailListRow}>
                <Text style={[styles.detailValue, { color: colors.foreground }]}>{row.referenceCode || "—"} · {row.customerName || "—"} · {row.transactionType === "visit" ? "زيارة" : row.transactionType === "order" ? "طلب" : row.transactionType || "معاملة"}</Text>
                <Text style={[styles.detailLabel, { color: colors.muted }]}>{row.orderDate || "—"} · {transactionStatusLabel(row.status, row.transactionType)} · {row.representativeName || "—"}</Text>
                {row.transactionType === "visit" ? <Text style={[styles.detailLabel, { color: colors.muted }]}>{visitText(row.visitReport)}</Text> : Array.isArray(row.items) && row.items.map((item: any, index: number) => <Text key={`${row.id}-${index}`} style={[styles.detailLabel, { color: colors.muted }]}>{item.productName || "—"} · {itemQuantity(item)} · {item.size || "—"} · {item.color || "—"}</Text>)}
                {Array.isArray(row.attachments) && row.attachments.length > 0 && <Text style={[styles.detailLabel, { color: colors.muted }]}>{isAr ? "المرفقات: " : "Attachments: "}{row.attachments.map((file: any) => file.name || file.fileName || file.type).join("، ")}</Text>}
              </View>)}
            </View>

            <View style={[styles.detailCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.detailHeader}><MaterialIcons name="inventory-2" size={20} color="#C2410C" /><Text style={[styles.detailTitle, { color: colors.foreground }]}>{isAr ? "التخزين والمستودعات — إنتاج تام" : "Storage & warehouses — finished goods"}</Text></View>
              <View style={styles.detailRow}><Text style={[styles.detailLabel, { color: colors.muted }]}>{isAr ? "رصيد البداية" : "Opening balance"}</Text><Text style={[styles.detailValue, { color: colors.foreground }]}>{reportData.warehouse.openingPairs == null ? (isAr ? "غير متاح — يحتاج مراجعة" : "Unavailable — needs review") : pairLabel(reportData.warehouse.openingPairs)}</Text></View>
              <View style={styles.detailRow}><Text style={[styles.detailLabel, { color: colors.muted }]}>{isAr ? "وارد الفترة" : "Period receipts"}</Text><Text style={[styles.detailValue, { color: colors.foreground }]}>{pairLabel(reportData.warehouse.receiptPairs)}</Text></View>
              <View style={styles.detailRow}><Text style={[styles.detailLabel, { color: colors.muted }]}>{isAr ? "صادر الفترة" : "Period issues"}</Text><Text style={[styles.detailValue, { color: colors.foreground }]}>{pairLabel(reportData.warehouse.issuePairs)}</Text></View>
              <View style={styles.detailRow}><Text style={[styles.detailLabel, { color: colors.muted }]}>{isAr ? "رصيد النهاية للفترة" : "Period closing balance"}</Text><Text style={[styles.detailValue, { color: colors.foreground }]}>{reportData.warehouse.closingPairs == null ? (isAr ? "غير متاح — يحتاج مراجعة" : "Unavailable — needs review") : pairLabel(reportData.warehouse.closingPairs)}</Text></View>
              <View style={styles.detailRow}><Text style={[styles.detailLabel, { color: colors.muted }]}>{isAr ? "الرصيد الحالي" : "Current balance"}</Text><Text style={[styles.detailValue, { color: colors.foreground }]}>{pairLabel(reportData.warehouse.currentPairs)}</Text></View>
            </View>

            {/* Maintenance Details */}
            <View style={[styles.detailCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.detailHeader}>
                <MaterialIcons name="build" size={20} color="#F59E0B" />
                <Text style={[styles.detailTitle, { color: colors.foreground }]}>
                  {isAr ? "الصيانة" : "Maintenance"}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: colors.muted }]}>{isAr ? "صيانة دورية" : "Periodic"}</Text>
                <Text style={[styles.detailValue, { color: colors.foreground }]}>{reportData.maintenance.periodicCount}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: colors.muted }]}>{isAr ? "طوارئ" : "Emergency"}</Text>
                <Text style={[styles.detailValue, { color: colors.foreground }]}>{reportData.maintenance.emergencyCount}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: colors.muted }]}>{isAr ? "أجهزة متوقفة" : "Stopped"}</Text>
                <Text style={[styles.detailValue, { color: colors.foreground }]}>{reportData.maintenance.stoppedMachines}</Text>
              </View>
            </View>

            {/* Export Button */}
            <TouchableOpacity
              style={[styles.exportButton, isExporting && styles.exportButtonDisabled]}
              onPress={handleExportPDF}
              disabled={isExporting}
            >
              {isExporting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <MaterialIcons name="picture-as-pdf" size={22} color="#fff" />
              )}
              <Text style={styles.exportButtonText}>
                {isExporting
                  ? (isAr ? "جاري التصدير..." : "Exporting...")
                  : (isAr ? "تصدير التقرير PDF" : "Export Report PDF")}
              </Text>
            </TouchableOpacity>

            {/* Print Note */}
            <View style={[styles.noteCard, { backgroundColor: "#FFFBEB", borderColor: "#FDE68A" }]}>
              <MaterialIcons name="info-outline" size={18} color="#D97706" />
              <Text style={[styles.noteText, { color: "#92400E" }]}>
                {isAr
                  ? "التقرير المُصدّر بصيغة HTML يمكن طباعته مباشرة من المتصفح كـ PDF عبر خيار الطباعة (Ctrl+P)"
                  : "The exported HTML report can be printed directly from browser as PDF via Print option (Ctrl+P)"}
              </Text>
            </View>
          </>
        )}

        {/* Empty State */}
        {!isLoading && !reportData && (
          <View style={styles.emptyState}>
            <MaterialIcons name="insert-chart-outlined" size={64} color={colors.muted} />
            <Text style={[styles.emptyText, { color: colors.muted }]}>
              {isAr ? "لا توجد بيانات متاحة لهذا الشهر" : "No data available for this month"}
            </Text>
            <TouchableOpacity
              style={[styles.retryButton, { borderColor: colors.primary }]}
              onPress={loadReportData}
            >
              <Text style={[styles.retryText, { color: colors.primary }]}>
                {isAr ? "إعادة المحاولة" : "Retry"}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: 24 },
  header: { flexDirection: "row", alignItems: "center", margin: 6, padding: 8, borderRadius: 10, borderWidth: 1, gap: 7 },
  backBtn: { padding: 4 },
  headerContent: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: "bold" },
  headerSubtitle: { fontSize: 12, marginTop: 2 },
  headerIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  monthSelector: { flexDirection: "row", alignItems: "center", marginHorizontal: 8, marginBottom: 8, padding: 9, borderRadius: 10, borderWidth: 1, gap: 8 },
  periodSelector: { marginHorizontal: 8, marginBottom: 8, padding: 8, borderRadius: 9, borderWidth: 1, gap: 6 },
  periodButtons: { flexDirection: "row-reverse", gap: 4 },
  periodButton: { flex: 1, alignItems: "center", paddingVertical: 6, borderRadius: 7, backgroundColor: "#E5E7EB" },
  periodButtonText: { fontSize: 12, fontWeight: "800" },
  rangeText: { textAlign: "right", fontSize: 11, fontWeight: "700" },
  customDateRow: { flexDirection: "row-reverse", gap: 8, marginHorizontal: 8, marginBottom: 8, padding: 8, borderRadius: 9, borderWidth: 1 },
  customDateField: { flex: 1, gap: 4 },
  customDateLabel: { textAlign: "right", fontSize: 12, fontWeight: "800" },
  customDateInput: { height: 36, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, textAlign: "right", fontSize: 14 },

  monthLabel: { fontSize: 14, fontWeight: "600" },
  monthButton: { flex: 1, flexDirection: "row", alignItems: "center", padding: 10, borderRadius: 8, borderWidth: 1, gap: 8 },
  monthButtonText: { flex: 1, fontSize: 14, fontWeight: "600" },
  monthDropdown: { marginHorizontal: 8, marginBottom: 8, borderRadius: 10, borderWidth: 1, overflow: "hidden" },
  monthOption: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: "#E5E7EB" },
  monthOptionText: { fontSize: 14 },
  loadingContainer: { alignItems: "center", justifyContent: "center", paddingVertical: 32 },
  loadingText: { marginTop: 12, fontSize: 14 },
  summaryGrid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 6, marginBottom: 8 },
  summaryCard: { width: "48%", margin: "1%", padding: 7, borderRadius: 8, borderWidth: 1, alignItems: "center", gap: 2 },
  summaryValue: { fontSize: 16, fontWeight: "bold" },
  summaryLabel: { fontSize: 11, color: "#6B7280", textAlign: "center" },
  sectionTitle: { fontSize: 15, fontWeight: "bold", paddingHorizontal: 10, marginBottom: 6, marginTop: 5 },
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 6, marginBottom: 8 },
  kpiCard: { width: "48%", margin: "1%", padding: 7, borderRadius: 8, borderWidth: 1, alignItems: "center", gap: 2 },
  kpiIndicator: { width: 8, height: 8, borderRadius: 4, position: "absolute", top: 10, right: 10 },
  kpiTitle: { fontSize: 11, textAlign: "center" },
  kpiValue: { fontSize: 20, fontWeight: "bold" },
  detailCard: { marginHorizontal: 8, marginBottom: 6, padding: 8, borderRadius: 8, borderWidth: 1 },
  detailHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 7, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: "#E5E7EB" },
  detailTitle: { fontSize: 15, fontWeight: "bold" },
  detailRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 4 },
  detailListRow: { paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: "#E5E7EB", gap: 3 },
  detailLabel: { fontSize: 13 },
  detailValue: { fontSize: 14, fontWeight: "600" },
  exportButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginHorizontal: 8, marginTop: 12, marginBottom: 8, padding: 11, borderRadius: 12, backgroundColor: "#7C3AED", gap: 10 },
  exportButtonDisabled: { opacity: 0.6 },
  exportButtonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  noteCard: { flexDirection: "row", alignItems: "flex-start", marginHorizontal: 8, marginBottom: 10, padding: 9, borderRadius: 10, borderWidth: 1, gap: 8 },
  noteText: { flex: 1, fontSize: 12, lineHeight: 18 },
  emptyState: { alignItems: "center", paddingVertical: 32, gap: 8 },
  emptyText: { fontSize: 15 },
  retryButton: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  retryText: { fontSize: 14, fontWeight: "600" },
});
