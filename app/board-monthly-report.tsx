import { DateField as CalendarDateField } from "@/components/date-field";
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
import { isEnglish, localize, textAlignFor, writingDirection } from "@/lib/i18n/runtime";
import type { Language } from "@/lib/i18n";
import { MaterialIcons } from "@expo/vector-icons";
import { productionService, manufacturingService, salesService, collectionService, expensesService, taskService, productManufacturingRequestService, finishedWarehouseService } from "@/lib/services/api.service";
import { maintenanceEntriesService } from "@/lib/services/data.service";
import { representativeService } from "@/lib/services/representative.service";
import { exportReportAsPDF, type PDFReportData } from "@/lib/services/pdf-export.service";
import { businessDate, commercialReport, exactPairs, inReportPeriod, productionMetrics, reportDate, reportRows, warehousePeriod, type ReportKind } from "@shared/operational-report";

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
    totalWaste: number;
    yarnWeight: number;
    wasteNeedles: number;
    secondGrade: number;
    firstGrade: number;
    totalWastePercentage: number | null;
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
  /** Historic manufacturing-stage ledger; shown separately from the V2 custody cycle. */
  legacyStageRows: any[];
  manufacturingRequests: ManufacturingRequestsSummary;
  previousManufacturingRequests: ManufacturingRequestsSummary;
}

type ReportPeriod = "daily" | "twoDays" | "weekly" | "monthly" | "custom";

interface ManufacturingRequestsSummary {
  total: number;
  produced: number;
  notProduced: number;
  pending: number;
  producedDozen: number;
  notProducedDozen: number;
  failureReasons: { reason: string; count: number; quantityDozen: number }[];
}

interface ReportRange {
  start: string;
  end: string;
  label: string;
  isValid: boolean;
  wasReversed: boolean;
}

const reportCalendarDay = (year: number, month: number, day: number) =>
  reportDate(new Date(Date.UTC(year, month, day, 12)));

const addReportDays = (day: string, days: number) => {
  const normalized = reportDate(day);
  if (!normalized) return "";
  const date = new Date(`${normalized}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return reportDate(date);
};

function periodRange(period: ReportPeriod, month: number, year: number, customStart?: string, customEnd?: string): ReportRange {
  if (period === "custom" && customStart && customEnd) {
    const rawStart = reportDate(customStart);
    const rawEnd = reportDate(customEnd);
    if (!rawStart || !rawEnd) return { start: "", end: "", label: "", isValid: false, wasReversed: false };
    const wasReversed = rawStart > rawEnd;
    const start = wasReversed ? rawEnd : rawStart;
    const end = wasReversed ? rawStart : rawEnd;
    return { start, end, label: `${start} — ${end}`, isValid: true, wasReversed };
  }
  if (period === "custom") return { start: "", end: "", label: "", isValid: false, wasReversed: false };

  const today = reportDate(new Date());
  if (!today) return { start: "", end: "", label: "", isValid: false, wasReversed: false };
  let start: string;
  let end: string;
  if (period === "monthly") {
    start = reportCalendarDay(year, month, 1);
    end = reportCalendarDay(year, month + 1, 0);
  } else if (period === "daily") {
    start = today;
    end = today;
  } else if (period === "twoDays") {
    end = today;
    start = addReportDays(end, -1);
  } else {
    // أسبوع العمل يبدأ السبت وينتهي الخميس، والجمعة خارج نطاق التشغيل.
    const day = new Date(`${today}T12:00:00Z`).getUTCDay();
    const daysFromSaturday = (day + 1) % 7;
    start = addReportDays(today, -daysFromSaturday);
    end = addReportDays(start, 5);
  }
  return { start, end, label: `${start} — ${end}`, isValid: Boolean(start && end), wasReversed: false };
}

function previousPeriodRange(start: string, end: string): Pick<ReportRange, "start" | "end"> {
  const normalizedStart = reportDate(start);
  const normalizedEnd = reportDate(end);
  if (!normalizedStart || !normalizedEnd) return { start: "", end: "" };
  const first = new Date(`${normalizedStart}T12:00:00Z`);
  const last = new Date(`${normalizedEnd}T12:00:00Z`);
  const days = Math.round((last.getTime() - first.getTime()) / 86_400_000) + 1;
  return { start: addReportDays(normalizedStart, -days), end: addReportDays(normalizedEnd, -days) };
}

function sortReportRows(rows: any[], kind: ReportKind): any[] {
  return rows
    .map((row, index) => ({ row, index, date: businessDate(row, kind) }))
    .sort((a, b) => b.date.localeCompare(a.date) || a.index - b.index)
    .map(({ row }) => row);
}

function manufacturingRequestsSummary(rows: any[]): ManufacturingRequestsSummary {
  const failureReasons = new Map<string, { reason: string; count: number; quantityDozen: number }>();
  const summary: ManufacturingRequestsSummary = { total: rows.length, produced: 0, notProduced: 0, pending: 0, producedDozen: 0, notProducedDozen: 0, failureReasons: [] };
  for (const row of rows) {
    const status = String(row.productionStatus || "pending");
    const quantityDozen = Number(row.quantityDozen || 0);
    if (status === "produced") {
      summary.produced += 1;
      summary.producedDozen += quantityDozen;
    } else if (status === "not_produced") {
      summary.notProduced += 1;
      summary.notProducedDozen += quantityDozen;
      const reason = String(row.productionFailureReason || "غير محدد").trim() || "غير محدد";
      const current = failureReasons.get(reason) || { reason, count: 0, quantityDozen: 0 };
      current.count += 1;
      current.quantityDozen += quantityDozen;
      failureReasons.set(reason, current);
    } else {
      summary.pending += 1;
    }
  }
  summary.failureReasons = Array.from(failureReasons.values()).sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason));
  return summary;
}

function DateField({ value, onChange, label, colors, isAr }: { value: string; onChange: (value: string) => void; label: string; colors: any; isAr: boolean }) {
  return <CalendarDateField value={value} onChange={onChange} accessibilityLabel={label} isAr={isAr} style={{ color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }} />;
}

const formatNumber = (language: Language, value: number, options: Intl.NumberFormatOptions = {}) =>
  value.toLocaleString(isEnglish(language) ? "en-US" : "ar-SA", options);

const formatAmount = (language: Language, value: number) =>
  formatNumber(language, value, { maximumFractionDigits: 2 });

const formatRate = (language: Language, value: number | null, digits = 1) =>
  value == null ? localize(language, "غير محسوبة", "Not calculated") : `${value.toFixed(digits)}%`;

/**
 * A zero waste value is meaningful only when the selected period includes a production row.
 * With no production activity, never let a visual zero imply that waste was measured.
 */
const formatRecordedGrams = (language: Language, value: number, hasProduction: boolean) =>
  hasProduction
    ? formatNumber(language, value)
    : localize(language, "غير مسجل", "Not recorded");

const formatRecordedYarnGrams = (language: Language, value: number) =>
  value > 0
    ? formatNumber(language, value, { maximumFractionDigits: 2 })
    : localize(language, "غير مسجل", "Not recorded");

const formatPairs = (language: Language, pairs: number) => {
  if (!Number.isSafeInteger(pairs)) return localize(language, "كمية غير صالحة — تحتاج مراجعة", "Invalid quantity — needs review");
  const sign = pairs < 0 ? "−" : "";
  const value = Math.abs(pairs);
  const dozens = formatNumber(language, Math.floor(value / 12));
  const remainder = formatNumber(language, value % 12);
  return localize(language, `${sign}${dozens} درزن + ${remainder} زوج`, `${sign}${dozens} dozen + ${remainder} pairs`);
};

const itemQuantity = (language: Language, item: any) => formatPairs(language, exactPairs(item, "item"));

const transactionTypeLabel = (language: Language, type: unknown) => {
  const normalized = String(type || "").toLowerCase();
  if (["visit", "زيارة"].includes(normalized)) return localize(language, "زيارة", "Visit");
  if (["order", "طلب"].includes(normalized)) return localize(language, "طلب", "Order");
  return localize(language, "معاملة", "Transaction");
};

const transactionStatus = (language: Language, status: unknown, type?: unknown) => {
  if (["visit", "زيارة"].includes(String(type || "").toLowerCase())) return localize(language, "زيارة مسجلة — معلومات فقط", "Visit recorded — information only");
  const labels: Record<string, [string, string]> = {
    DRAFT: ["مسودة", "Draft"], RECORDED: ["مسجل", "Recorded"], PENDING_SALES_APPROVAL: ["بانتظار اعتماد مدير التسويق", "Awaiting sales manager approval"],
    REJECTED_SALES: ["مرفوض من التسويق", "Rejected by sales"], PENDING_WAREHOUSE_ISSUE: ["معتمد — بانتظار المستودعات", "Approved — awaiting warehouse"],
    WAREHOUSE_EXECUTED: ["تم التنفيذ", "Executed"], WAREHOUSE_PARTIAL: ["تم التنفيذ الجزئي", "Partially executed"], WAREHOUSE_NOT_EXECUTED: ["لم يتم التنفيذ", "Not executed"],
    WAREHOUSE_NOT_AVAILABLE: ["غير متاح", "Unavailable"], PENDING_REPRESENTATIVE_REPLY: ["بانتظار رد المندوب", "Awaiting representative response"],
    REPRESENTATIVE_REPLIED: ["رد المندوب — بانتظار التنفيذ", "Representative replied — awaiting execution"], REPRESENTATIVE_CLOSED: ["أغلقه المندوب", "Closed by representative"],
    CLOSED: ["مغلق", "Closed"], CLOSED_REJECTED: ["مغلق — مرفوض", "Closed — rejected"],
  };
  const label = labels[String(status || "")];
  return label ? localize(language, label[0], label[1]) : String(status || localize(language, "لم تسجل الحالة", "No status recorded"));
};

const localizedVisitText = (language: Language, value: unknown): string => {
  if (value == null || value === "") return "—";
  let data: any = value;
  if (typeof value === "string") {
    try { data = JSON.parse(value); } catch { return value; }
  }
  if (data && typeof data === "object") {
    const actionLabels: Record<string, [string, string]> = {
      follow_up: ["متابعة", "Follow-up"], product_presentation: ["عرض منتج", "Product presentation"], product_offer: ["عرض منتج", "Product presentation"], presentation: ["عرض منتج", "Product presentation"],
    };
    const action = actionLabels[data.action] ? localize(language, actionLabels[data.action][0], actionLabels[data.action][1]) : data.action || "";
    const notes = data.notes ?? data.report ?? data.observations;
    return [action, notes].filter(Boolean).join(" — ") || "—";
  }
  return String(value);
};

const localizedReportSource = (language: Language, source: unknown) => {
  const labels: Record<string, [string, string]> = {
    "مبيعات أداء المندوب": ["مبيعات أداء المندوب", "Representative performance sales"],
    "سجل المبيعات السابق": ["سجل المبيعات السابق", "Legacy sales register"],
    "تحصيل أداء المندوب": ["تحصيل أداء المندوب", "Representative performance collections"],
    "سجل التحصيل السابق": ["سجل التحصيل السابق", "Legacy collection register"],
    "طلبات وزيارات أداء المندوب": ["طلبات وزيارات أداء المندوب", "Representative performance orders and visits"],
    "الطلبات والزيارات السابقة": ["الطلبات والزيارات السابقة", "Legacy orders and visits"],
  };
  const label = labels[String(source || "")];
  return label ? localize(language, label[0], label[1]) : String(source || "—");
};

export default function BoardMonthlyReport() {
  const router = useRouter();
  const colors = useColors();
  const { language } = useLanguage();
  const isEn = isEnglish(language);
  const isAr = !isEn;
  const direction = writingDirection(language);
  const textAlign = textAlignFor(language);
  const rowDirection = isEn ? "row" as const : "row-reverse" as const;
  const copy = (arabic: string, english: string) => localize(language, arabic, english);
  const directionalText = { textAlign, writingDirection: direction };

  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [period, setPeriod] = useState<ReportPeriod>("monthly");
  const reportToday = reportDate(new Date());
  const currentMonthStart = reportToday ? `${reportToday.slice(0, 7)}-01` : "";
  const currentMonthEnd = reportToday ? reportCalendarDay(Number(reportToday.slice(0, 4)), Number(reportToday.slice(5, 7)), 0) : "";
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
    setPeriod(value);
    if (value === "custom") return;
    const nextRange = periodRange(value, selectedMonth, selectedYear);
    if (nextRange.isValid) {
      setCustomStart(nextRange.start);
      setCustomEnd(nextRange.end);
    }
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
    if (!range.isValid) {
      setIsLoading(false);
      setReportData(null);
      setReportError(copy("أدخل تاريخ بداية ونهاية صحيحين من التقويم.", "Choose valid start and end dates from the calendar."));
      return;
    }
    setIsLoading(true);
    setReportError(null);
    try {
      const results = await Promise.allSettled([
        productionService.getAll(), manufacturingService.getAll(), salesService.getAll(), collectionService.getAll(),
        representativeService.sales.list(), representativeService.collections.list(), representativeService.transactions.list(),
        expensesService.getAll(), taskService.getAll(), maintenanceEntriesService.getBySection("periodic"), maintenanceEntriesService.getBySection("emergency"), maintenanceEntriesService.getBySection("stopped"),
        finishedWarehouseService.movements(), finishedWarehouseService.list(),
        productManufacturingRequestService.list(),
      ]);
      const failed = results.find((result): result is PromiseRejectedResult => result.status === "rejected");
      if (failed) throw failed.reason;
      const values = results.map((result) => (result as PromiseFulfilledResult<unknown>).value);
      const [productionRaw, manufacturingRaw, legacySalesRaw, legacyCollectionsRaw, salesRaw, collectionsRaw, transactionsRaw, expensesRaw, tasksRaw, periodicRaw, emergencyRaw, stoppedRaw, movementsRaw, stockRaw, manufacturingRequestsRaw] = values;
      const productionRows = sortReportRows(reportRows(productionRaw).filter((row) => inReportPeriod(row, "production", range.start, range.end)), "production");
      const production = productionMetrics(productionRows);
      const commercial = commercialReport({
        sales: reportRows(salesRaw), legacySales: reportRows(legacySalesRaw),
        collections: reportRows(collectionsRaw), legacyCollections: reportRows(legacyCollectionsRaw),
        transactions: reportRows(transactionsRaw), startDate: range.start, endDate: range.end,
      });
      const warehouse = warehousePeriod({ movements: reportRows(movementsRaw), stock: reportRows(stockRaw), startDate: range.start, endDate: range.end });
      const expenseRows = reportRows(expensesRaw).filter((row) => inReportPeriod(row, "general", range.start, range.end));
      const taskRows = reportRows(tasksRaw).filter((row) => inReportPeriod(row, "general", range.start, range.end));
      const maintenanceRows = {
        periodic: reportRows(periodicRaw).filter((row) => inReportPeriod(row, "general", range.start, range.end)),
        emergency: reportRows(emergencyRaw).filter((row) => inReportPeriod(row, "general", range.start, range.end)),
        stopped: reportRows(stoppedRaw).filter((row) => inReportPeriod(row, "general", range.start, range.end)),
      };
      const previousRange = previousPeriodRange(range.start, range.end);
      const manufacturingRequestRows = reportRows(manufacturingRequestsRaw);
      const manufacturingRequests = manufacturingRequestsSummary(manufacturingRequestRows.filter((row) => inReportPeriod(row, "general", range.start, range.end)));
      const previousManufacturingRequests = manufacturingRequestsSummary(manufacturingRequestRows.filter((row) => inReportPeriod(row, "general", previousRange.start, previousRange.end)));
      const expCategories: Record<string, number> = {};
      const expenseTotal = expenseRows.reduce((sum, row: any) => {
        const amount = Number(row.amount || 0);
        const category = row.category || row.description || (copy("أخرى", "Other"));
        expCategories[category] = (expCategories[category] || 0) + amount;
        return sum + amount;
      }, 0);
      const completed = taskRows.filter((row: any) => row.result === "completed").length;
      const pending = taskRows.filter((row: any) => !row.result || row.result === "pending").length;
      const overdue = taskRows.filter((row: any) => row.result === "overdue" || row.status === "overdue").length;
      if (requestId !== latestReportRequest.current) return;
      setReportData({
        production: { totalDozen: production.totalPairs / 12, totalPairs: production.totalPairs, totalEntries: productionRows.length, wasteThread: production.wasteThreadGrams, wasteSocks: production.wasteSocksGrams, totalWaste: production.totalWasteGrams, yarnWeight: production.yarnGrams, wasteNeedles: production.wasteNeedles, secondGrade: production.secondPairs, firstGrade: production.firstPairs, totalWastePercentage: production.wastePercent, threadWastePercentage: production.threadWastePercent },
        sales: { totalEntries: commercial.salesRows.length, totalAmount: commercial.salesAmount },
        expenses: { totalAmount: expenseTotal, categories: Object.entries(expCategories).map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount).slice(0, 5) },
        maintenance: { periodicCount: maintenanceRows.periodic.length, emergencyCount: maintenanceRows.emergency.length, stoppedMachines: maintenanceRows.stopped.length },
        tasks: { total: taskRows.length, completed, pending, overdue, completionRate: taskRows.length ? completed / taskRows.length * 100 : 0 },
        collection: { totalAmount: commercial.collectionAmount, totalEntries: commercial.collectionRows.length, collectionRate: commercial.salesAmount ? commercial.collectionAmount / commercial.salesAmount * 100 : 0 },
        warehouse: { movementCount: warehouse.movements.length, receiptPairs: warehouse.receiptPairs, issuePairs: warehouse.issuePairs, adjustmentPairs: warehouse.adjustmentPairs, currentPairs: warehouse.currentPairs, openingPairs: warehouse.openingPairs, closingPairs: warehouse.closingPairs, invalidQuantityCount: warehouse.invalidQuantityCount },
        commercial: {
          salesRows: sortReportRows(commercial.salesRows, "sale"),
          orderRows: sortReportRows(commercial.orderRows, "transaction"),
          visitRows: sortReportRows(commercial.visitRows, "transaction"),
          otherTransactionRows: sortReportRows(commercial.otherTransactionRows, "transaction"),
          collectionRows: sortReportRows(commercial.collectionRows, "collection"),
        },
        // Use the business `date` stored with each historical stage row. Filtering happens again
        // in the read-only legacy bridge so no later receipt/save timestamp leaks into this period.
        legacyStageRows: reportRows(manufacturingRaw),
        manufacturingRequests,
        previousManufacturingRequests,
      });
    } catch (error: any) {
      if (requestId === latestReportRequest.current) {
        console.error("Error loading report data:", error);
        setReportData(null);
        setReportError(error?.message || copy("تعذر تحميل بيانات التقرير. لا يمكن عرض أصفار بديلة.", "Could not load report data; zero substitutes are not shown."));
      }
    } finally {
      if (requestId === latestReportRequest.current) setIsLoading(false);
    }
  };

  const handleExportPDF = async () => {
    if (!reportData) return;
    setIsExporting(true);
    try {
      const monthLabel = `${period === "monthly" ? `${monthNames[selectedMonth]} ${selectedYear}` : period === "weekly" ? (copy("الأسبوع الحالي", "Current week")) : (copy("اليوم", "Today"))} (${range.label})`;
      const pdfData: PDFReportData = {
        title: copy("التقرير الشهري لمجلس الإدارة", "Monthly Board Report"),
        subtitle: monthLabel,
        date: new Date().toLocaleDateString(copy("ar-SA", "en-US")),
        footer: copy("مصنع السلطان - تقرير سري وخاص بمجلس الإدارة", "Sultan Factory - Confidential Board Report"),
        sections: [
          {
            title: copy("ملخص الأداء العام", "Overall Performance Summary"),
            type: "summary",
            data: [
              { label: copy("إجمالي الإنتاج", "Total Production"), value: formatPairs(language, reportData.production.totalPairs) },
              { label: copy("إجمالي المبيعات", "Total Sales"), value: `${formatAmount(language, reportData.sales.totalAmount)} ${copy("ريال", "SAR")}` },
              { label: copy("إجمالي المصروفات", "Total Expenses"), value: `${formatAmount(language, reportData.expenses.totalAmount)} ${copy("ريال", "SAR")}` },
              { label: copy("إجمالي التحصيل", "Total Collection"), value: `${formatAmount(language, reportData.collection.totalAmount)} ${copy("ريال", "SAR")}` },
              { label: copy("هدر الخيوط", "Yarn Waste"), value: `${formatRecordedGrams(language, reportData.production.wasteThread, reportData.production.totalEntries > 0)} ${copy("جرام", "g")}` },
              { label: copy("هدر الجوارب", "Sock Waste"), value: `${formatRecordedGrams(language, reportData.production.wasteSocks, reportData.production.totalEntries > 0)} ${copy("جرام", "g")}` },
              { label: copy("نسبة هدر الخيوط", "Yarn Waste Rate"), value: formatRate(language, reportData.production.threadWastePercentage) },
              { label: copy("نسبة الهدر الإجمالي", "Total Waste Rate"), value: formatRate(language, reportData.production.totalWastePercentage) },
              { label: copy("المهام المكتملة", "Tasks Completed"), value: `${reportData.tasks.completed}/${reportData.tasks.total}` },
            ],
          },
          {
            title: copy("مؤشرات الأداء الرئيسية", "Key Performance Indicators"),
            type: "kpi",
            data: [
              {
                title: copy("نسبة الهدر الإجمالي", "Total Waste Rate"),
                value: formatRate(language, reportData.production.totalWastePercentage),
                target: copy("أقل من 5%", "Below 5%"),
                status: reportData.production.totalWastePercentage == null ? "warning" : reportData.production.totalWastePercentage <= 5 ? "good" : reportData.production.totalWastePercentage <= 10 ? "warning" : "bad",
              },
              {
                title: copy("نسبة إنجاز المهام", "Task Completion Rate"),
                value: `${reportData.tasks.completionRate.toFixed(0)}%`,
                target: "100%",
                status: reportData.tasks.completionRate >= 80 ? "good" : reportData.tasks.completionRate >= 60 ? "warning" : "bad",
              },
              {
                title: copy("نسبة التحصيل", "Collection Rate"),
                value: `${reportData.collection.collectionRate.toFixed(0)}%`,
                target: "100%",
                status: reportData.collection.collectionRate >= 80 ? "good" : reportData.collection.collectionRate >= 60 ? "warning" : "bad",
              },
            ],
          },
          {
            title: copy("تفاصيل الإنتاج", "Production Details"),
            type: "table",
            data: {
              headers: [
                copy("البند", "Item"),
                copy("القيمة", "Value"),
              ],
              rows: [
                [copy("إجمالي الإنتاج", "Total Production"), formatPairs(language, reportData.production.totalPairs)],
                [copy("الفرز الأول", "First grade"), formatPairs(language, reportData.production.firstGrade)],
                [copy("عدد الإدخالات", "Total Entries"), `${reportData.production.totalEntries}`],
                [copy("هدر الخيوط (جرام)", "Yarn Waste (g)"), formatRecordedGrams(language, reportData.production.wasteThread, reportData.production.totalEntries > 0)],
                [copy("هدر الجوارب (جرام)", "Sock Waste (g)"), formatRecordedGrams(language, reportData.production.wasteSocks, reportData.production.totalEntries > 0)],
                [copy("إجمالي الهدر (خيوط + جوارب) — جرام", "Total Waste (Yarn + Socks) — g"), formatRecordedGrams(language, reportData.production.totalWaste, reportData.production.totalEntries > 0)],
                [copy("وزن الخيوط المستخدم (جرام)", "Yarn Used (g)"), formatRecordedYarnGrams(language, reportData.production.yarnWeight)],
                [copy("نسبة هدر الخيوط", "Yarn Waste Rate"), formatRate(language, reportData.production.threadWastePercentage)],
                [copy("نسبة الهدر الإجمالي", "Total Waste Rate"), formatRate(language, reportData.production.totalWastePercentage)],
                [copy("هدر الإبر (حبة)", "Needle Waste (pcs)"), `${reportData.production.wasteNeedles}`],
                [copy("النخب الثاني (أزواج)", "Second Grade (Pairs)"), `${reportData.production.secondGrade}`],
              ],
            },
          },
          {
            title: copy("تفاصيل المبيعات", "Sales Details"),
            type: "table",
            data: {
              headers: [
                copy("البند", "Item"),
                copy("القيمة", "Value"),
              ],
              rows: [
                [copy("عدد الفواتير", "Invoice count"), `${reportData.sales.totalEntries}`],
                [copy("إجمالي المبيعات", "Total Sales"), `${formatAmount(language, reportData.sales.totalAmount)} ${copy("ريال", "SAR")}`],
                [copy("عدد التحصيلات", "Collection count"), `${reportData.collection.totalEntries}`],
                [copy("إجمالي التحصيل", "Total Collection"), `${formatAmount(language, reportData.collection.totalAmount)} ${copy("ريال", "SAR")}`],
                [copy("نسبة التحصيل", "Collection Rate"), `${reportData.collection.collectionRate.toFixed(1)}%`],
              ],
            },
          },
          {
            title: copy("تفاصيل فواتير المبيعات", "Sales invoice details"),
            type: "table",
            data: {
              headers: [copy("الفاتورة", "Invoice"), copy("العميل", "Customer"), copy("التاريخ", "Date"), copy("المندوب/المصدر", "Representative/source"), copy("المبلغ", "Amount"), copy("المرفقات", "Attachments")],
              rows: reportData.commercial.salesRows.map((row) => [row.invoiceNumber || row.referenceCode || row.id || "—", row.customerName || "—", businessDate(row, "sale") || "—", row.representativeName || row.sellerName || localizedReportSource(language, row.reportSource), `${formatAmount(language, Number(row.amount || 0))} ${copy("ر.س", "SAR")}`, Array.isArray(row.attachments) ? row.attachments.map((file: any) => file.name || file.fileName || file.type).join(copy("، ", ", ")) || "—" : "—"]),
            },
          },
          {
            title: copy("تفاصيل التحصيل", "Collection details"),
            type: "table",
            data: {
              headers: [copy("السند", "Receipt"), copy("العميل", "Customer"), copy("التاريخ", "Date"), copy("المندوب/المصدر", "Representative/source"), copy("المبلغ", "Amount"), copy("المرفقات", "Attachments")],
              rows: reportData.commercial.collectionRows.map((row) => [row.receiptNumber || row.referenceCode || row.id || "—", row.customerName || "—", businessDate(row, "collection") || "—", row.representativeName || row.collectorName || localizedReportSource(language, row.reportSource), `${formatAmount(language, Number(row.collectedAmount ?? row.amount ?? 0))} ${copy("ر.س", "SAR")}`, Array.isArray(row.attachments) ? row.attachments.map((file: any) => file.name || file.fileName || file.type).join(copy("، ", ", ")) || "—" : "—"]),
            },
          },
          {
            title: copy("تفاصيل المصروفات", "Expenses Details"),
            type: "table",
            data: {
              headers: [
                copy("البند", "Category"),
                copy("المبلغ", "Amount"),
              ],
              rows: [
                [copy("إجمالي المصروفات", "Total Expenses"), `${formatNumber(language, reportData.expenses.totalAmount)} ${copy("ريال", "SAR")}`],
                ...reportData.expenses.categories.map(cat => [cat.name, `${formatNumber(language, cat.amount)} ${copy("ريال", "SAR")}`]),
              ],
            },
          },
          {
            title: copy("الصيانة", "Maintenance"),
            type: "summary",
            data: [
              { label: copy("الصيانة الدورية", "Periodic Maintenance"), value: `${reportData.maintenance.periodicCount}` },
              { label: copy("صيانة الطوارئ", "Emergency Maintenance"), value: `${reportData.maintenance.emergencyCount}` },
              { label: copy("أجهزة متوقفة", "Stopped Machines"), value: `${reportData.maintenance.stoppedMachines}` },
            ],
          },
          {
            title: copy("المهام", "Tasks"),
            type: "summary",
            data: [
              { label: copy("إجمالي المهام", "Total Tasks"), value: `${reportData.tasks.total}` },
              { label: copy("مكتملة", "Completed"), value: `${reportData.tasks.completed}` },
              { label: copy("معلقة", "Pending"), value: `${reportData.tasks.pending}` },
              { label: copy("متأخرة", "Overdue"), value: `${reportData.tasks.overdue}` },
              { label: copy("نسبة الإنجاز", "Completion Rate"), value: `${reportData.tasks.completionRate.toFixed(0)}%` },
            ],
          },
          {
            title: copy("طلبات التصنيع وأسباب التعثر", "Manufacturing Requests & Failure Reasons"),
            type: "table",
            data: {
              headers: [copy("البند", "Item"), copy("القيمة", "Value"), copy("النسبة", "Rate")],
              rows: [
                [copy("إجمالي الطلبات", "Total Requests"), `${reportData.manufacturingRequests.total}`, "100%"],
                [copy("تم الإنتاج", "Produced"), `${reportData.manufacturingRequests.produced} / ${reportData.manufacturingRequests.producedDozen} ${copy("درزن", "dozen")}`, `${reportData.manufacturingRequests.total ? (reportData.manufacturingRequests.produced / reportData.manufacturingRequests.total * 100).toFixed(1) : 0}%`],
                [copy("لم يتم الإنتاج", "Not Produced"), `${reportData.manufacturingRequests.notProduced} / ${reportData.manufacturingRequests.notProducedDozen} ${copy("درزن", "dozen")}`, `${reportData.manufacturingRequests.total ? (reportData.manufacturingRequests.notProduced / reportData.manufacturingRequests.total * 100).toFixed(1) : 0}%`],
                [copy("لم تسجل النتيجة", "Pending Result"), `${reportData.manufacturingRequests.pending}`, `${reportData.manufacturingRequests.total ? (reportData.manufacturingRequests.pending / reportData.manufacturingRequests.total * 100).toFixed(1) : 0}%`],
                [copy("تغير الإنتاج عن الفترة المكافئة السابقة", "Production change vs preceding equivalent period"), `${reportData.manufacturingRequests.produced - reportData.previousManufacturingRequests.produced} ${copy("طلب", "requests")}`, `${reportData.previousManufacturingRequests.produced ? ((reportData.manufacturingRequests.produced - reportData.previousManufacturingRequests.produced) / reportData.previousManufacturingRequests.produced * 100).toFixed(1) : 0}%`],
                [copy("تغير التعثر عن الفترة المكافئة السابقة", "Failure change vs preceding equivalent period"), `${reportData.manufacturingRequests.notProduced - reportData.previousManufacturingRequests.notProduced} ${copy("طلب", "requests")}`, `${reportData.previousManufacturingRequests.notProduced ? ((reportData.manufacturingRequests.notProduced - reportData.previousManufacturingRequests.notProduced) / reportData.previousManufacturingRequests.notProduced * 100).toFixed(1) : 0}%`],
                ...reportData.manufacturingRequests.failureReasons.map((item) => [item.reason, `${item.count} / ${item.quantityDozen} ${copy("درزن", "dozen")}`, `${reportData.manufacturingRequests.notProduced ? (item.count / reportData.manufacturingRequests.notProduced * 100).toFixed(1) : 0}%`]),
              ],
            },
          },
          {
            title: copy("التوصيات", "Recommendations"),
            type: "text",
            data: generateRecommendations(reportData),
          },
        ],
      };

      await exportReportAsPDF(pdfData);
      Alert.alert(
        copy("تم التصدير", "Exported"),
        copy("تم تصدير التقرير الشهري بنجاح", "Monthly report exported successfully")
      );
    } catch (error: any) {
      Alert.alert(
        copy("خطأ", "Error"),
        isEn ? copy("فشل في تصدير التقرير", "Failed to export report") : error.message || copy("فشل في تصدير التقرير", "Failed to export report")
      );
    } finally {
      setIsExporting(false);
    }
  };

  const generateRecommendations = (data: ReportData): string => {
    const recommendations: string[] = [];
    if (data.production.totalWastePercentage != null && data.production.totalWastePercentage > 5) {
      recommendations.push(copy(`• نسبة الهدر الإجمالي (${data.production.totalWastePercentage.toFixed(1)}%) تتجاوز الحد المقبول (5%). يُوصى بمراجعة خطوط الإنتاج وتدريب العمال.`, `• Total waste rate (${data.production.totalWastePercentage.toFixed(1)}%) exceeds acceptable limit (5%). Review production lines and train workers.`));
    }
    if (data.tasks.completionRate < 80) {
      recommendations.push(copy(`• نسبة إنجاز المهام (${data.tasks.completionRate.toFixed(0)}%) أقل من المطلوب. يُوصى بمتابعة المهام المتأخرة وتوزيع الأعباء.`, `• Task completion rate (${data.tasks.completionRate.toFixed(0)}%) is below target. Follow up on overdue tasks.`));
    }
    if (data.collection.collectionRate < 80) {
      recommendations.push(copy(`• نسبة التحصيل (${data.collection.collectionRate.toFixed(0)}%) منخفضة. يُوصى بتكثيف جهود التحصيل ومتابعة العملاء المتأخرين.`, `• Collection rate (${data.collection.collectionRate.toFixed(0)}%) is low. Intensify collection efforts.`));
    }
    if (data.maintenance.emergencyCount > 3) {
      recommendations.push(copy(`• عدد حالات الطوارئ (${data.maintenance.emergencyCount}) مرتفع. يُوصى بتعزيز الصيانة الوقائية.`, `• Emergency maintenance cases (${data.maintenance.emergencyCount}) are high. Strengthen preventive maintenance.`));
    }
    if (data.sales.totalAmount > 0 && data.expenses.totalAmount > data.sales.totalAmount) {
      recommendations.push(copy(`• المصروفات تتجاوز المبيعات. يُوصى بمراجعة بنود الصرف وتقليل التكاليف غير الضرورية.`, `• Expenses exceed sales. Review spending items and reduce unnecessary costs.`));
    }
    if (recommendations.length === 0) {
      recommendations.push(copy("• الأداء العام جيد. يُوصى بالاستمرار في المتابعة والتحسين المستمر.", "• Overall performance is good. Continue monitoring and continuous improvement."));
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
      <ScrollView contentContainerStyle={[styles.container, { direction }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.surface, borderColor: colors.border, flexDirection: rowDirection }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <MaterialIcons name={isEn ? "arrow-back" : "arrow-forward"} size={24} color={colors.foreground} />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={[styles.headerTitle, directionalText, { color: colors.foreground }]}>
              {copy("التقرير الموحد لمجلس الإدارة", "Unified Board Report")}
            </Text>
            <Text style={[styles.headerSubtitle, directionalText, { color: colors.muted }]}>
              {copy("ملخص تشغيلي واضح حسب الفترة", "Clear operating summary by period")}
            </Text>
          </View>
          <View style={[styles.headerIcon, { backgroundColor: "#7C3AED20" }]}>
            <MaterialIcons name="summarize" size={24} color="#7C3AED" />
          </View>
        </View>

        {/* Period Selector */}
        <View style={[styles.periodSelector, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.monthLabel, directionalText, { color: colors.muted }]}>{copy("الفترة:", "Period:")}</Text>
          <View style={[styles.periodButtons, { flexDirection: rowDirection }]}>
            {([
              ["daily", copy("يومي", "Daily")],
              ["twoDays", copy("يومان", "2 days")],
              ["weekly", copy("أسبوعي", "Weekly")],
              ["monthly", copy("شهري", "Monthly")],
              ["custom", copy("نطاق مخصص", "Custom range")],
            ] as const).map(([value, label]) => <TouchableOpacity key={value} onPress={() => selectPeriod(value)} style={[styles.periodButton, period === value && { backgroundColor: colors.primary }]}><Text style={[styles.periodButtonText, { color: period === value ? "#fff" : colors.foreground }]}>{label}</Text></TouchableOpacity>)}
          </View>
          <Text style={[styles.rangeText, directionalText, { color: colors.foreground }]}>{copy("من — إلى:", "From — To:")} {range.label}</Text>
          {range.wasReversed && <Text accessibilityRole="alert" style={[styles.rangeNotice, directionalText, { color: "#92400E" }]}>{copy("تم عكس تاريخ البداية والنهاية تلقائيًا لعرض الفترة بترتيبها الزمني الصحيح.", "Start and end dates were reversed; the report uses their chronological order.")}</Text>}
        </View>
        <View style={[styles.customDateRow, { backgroundColor: colors.surface, borderColor: colors.border, flexDirection: rowDirection }]}>
          <View style={styles.customDateField}>
            <Text style={[styles.customDateLabel, directionalText, { color: colors.muted }]}>{copy("من تاريخ", "From date")}</Text>
            <DateField value={customStart} onChange={(value) => { setCustomStart(value); setPeriod("custom"); }} label={copy("من تاريخ", "From date")} colors={colors} isAr={isAr} />
          </View>
          <View style={styles.customDateField}>
            <Text style={[styles.customDateLabel, directionalText, { color: colors.muted }]}>{copy("إلى تاريخ", "To date")}</Text>
            <DateField value={customEnd} onChange={(value) => { setCustomEnd(value); setPeriod("custom"); }} label={copy("إلى تاريخ", "To date")} colors={colors} isAr={isAr} />
          </View>
        </View>

        {/* Month Selector (used for monthly comparison) */}
        {period === "monthly" && <><View style={[styles.monthSelector, { backgroundColor: colors.surface, borderColor: colors.border, flexDirection: rowDirection }]}>
          <Text style={[styles.monthLabel, directionalText, { color: colors.muted }]}>
            {copy("اختر الشهر:", "Select Month:")}
          </Text>
          <TouchableOpacity
            style={[styles.monthButton, { backgroundColor: colors.background, borderColor: colors.border, flexDirection: rowDirection }]}
            onPress={() => setShowMonthPicker(!showMonthPicker)}
          >
            <MaterialIcons name="calendar-today" size={18} color={colors.primary} />
            <Text style={[styles.monthButtonText, directionalText, { color: colors.foreground }]}>
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
                  { flexDirection: rowDirection },
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
                  directionalText,
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
            <Text style={[styles.loadingText, directionalText, { color: colors.muted }]}>
              {copy("جاري تحميل البيانات...", "Loading data...")}
            </Text>
          </View>
        )}

        {!isLoading && reportError && (
          <View style={[styles.emptyState, { marginHorizontal: 8, borderWidth: 1, borderColor: "#FCA5A5", borderRadius: 10, backgroundColor: "#FEF2F2" }]}>
            <MaterialIcons name="error-outline" size={38} color="#DC2626" />
            <Text style={[styles.emptyText, { color: "#991B1B", textAlign: "center", writingDirection: direction }]}>{reportError}</Text>
            <TouchableOpacity style={[styles.retryButton, { borderColor: colors.primary }]} onPress={loadReportData}><Text style={[styles.retryText, { color: colors.primary }]}>{copy("إعادة المحاولة", "Retry")}</Text></TouchableOpacity>
          </View>
        )}

        {/* Report Preview */}
        {!isLoading && reportData && (
          <>
            {/* Summary Cards */}
            <View style={styles.summaryGrid}>
              <View style={[styles.summaryCard, { backgroundColor: "#EFF6FF", borderColor: "#BFDBFE" }]}>
                <MaterialIcons name="precision-manufacturing" size={22} color="#2563EB" />
                <Text style={[styles.summaryValue, { color: "#2563EB" }]}>{formatPairs(language, reportData.production.totalPairs)}</Text>
                <Text style={styles.summaryLabel}>{reportData.production.totalEntries ? copy("إنتاج مسجل", "Recorded production") : copy("لا يوجد نشاط إنتاجي", "No production activity")}</Text>
              </View>
              <View style={[styles.summaryCard, { backgroundColor: "#F0FDF4", borderColor: "#BBF7D0" }]}>
                <MaterialIcons name="point-of-sale" size={22} color="#16A34A" />
                <Text style={[styles.summaryValue, { color: "#16A34A" }]}>{formatAmount(language, reportData.sales.totalAmount)}</Text>
                <Text style={styles.summaryLabel}>{`${reportData.sales.totalEntries} ${copy("فاتورة مبيعات", "sales invoices")}`}</Text>
              </View>
              <View style={[styles.summaryCard, { backgroundColor: "#FEF2F2", borderColor: "#FECACA" }]}>
                <MaterialIcons name="money-off" size={22} color="#DC2626" />
                <Text style={[styles.summaryValue, { color: "#DC2626" }]}>{formatNumber(language, reportData.expenses.totalAmount)}</Text>
                <Text style={styles.summaryLabel}>{copy("ريال مصروفات", "SAR Expenses")}</Text>
              </View>
              <View style={[styles.summaryCard, { backgroundColor: "#FFF7ED", borderColor: "#FED7AA" }]}>
                <MaterialIcons name="inventory-2" size={22} color="#C2410C" />
                <Text style={[styles.summaryValue, { color: "#C2410C" }]}>{formatPairs(language, reportData.warehouse.currentPairs)}</Text>
                <Text style={styles.summaryLabel}>{`${copy("إنتاج تام حاليًا", "Current finished goods")} — ${reportData.warehouse.movementCount} ${copy("حركة", "movements")}`}</Text>
              </View>
              <View style={[styles.summaryCard, { backgroundColor: "#FFF7ED", borderColor: "#FED7AA" }]}>
                <MaterialIcons name="scale" size={22} color="#C2410C" />
                <Text style={[styles.summaryValue, { color: "#C2410C" }]}>{formatRecordedGrams(language, reportData.production.wasteThread, reportData.production.totalEntries > 0)}</Text>
                <Text style={styles.summaryLabel}>{copy("هدر الخيوط — جرام", "Yarn waste — grams")}</Text>
              </View>
              <View style={[styles.summaryCard, { backgroundColor: reportData.production.threadWastePercentage != null && reportData.production.threadWastePercentage <= 5 ? "#F0FDF4" : "#FEF2F2", borderColor: reportData.production.threadWastePercentage != null && reportData.production.threadWastePercentage <= 5 ? "#BBF7D0" : "#FECACA" }]}>
                <MaterialIcons name="percent" size={22} color={reportData.production.threadWastePercentage != null && reportData.production.threadWastePercentage <= 5 ? "#16A34A" : "#DC2626"} />
                <Text style={[styles.summaryValue, { color: reportData.production.threadWastePercentage != null && reportData.production.threadWastePercentage <= 5 ? "#16A34A" : "#DC2626" }]}>{formatRate(language, reportData.production.threadWastePercentage)}</Text>
                <Text style={styles.summaryLabel}>{copy("نسبة هدر الخيوط", "Yarn waste rate")}</Text>
              </View>
              <View style={[styles.summaryCard, { backgroundColor: "#FEF2F2", borderColor: "#FECACA" }]}>
                <MaterialIcons name="delete-outline" size={22} color="#DC2626" />
                <Text style={[styles.summaryValue, { color: "#DC2626" }]}>{formatRecordedGrams(language, reportData.production.wasteSocks, reportData.production.totalEntries > 0)}</Text>
                <Text style={styles.summaryLabel}>{copy("هدر الجوارب — جرام", "Sock waste — grams")}</Text>
              </View>
              <View style={[styles.summaryCard, { backgroundColor: reportData.production.totalWastePercentage != null && reportData.production.totalWastePercentage <= 5 ? "#F0FDF4" : "#FEF2F2", borderColor: reportData.production.totalWastePercentage != null && reportData.production.totalWastePercentage <= 5 ? "#BBF7D0" : "#FECACA" }]}>
                <MaterialIcons name="percent" size={22} color={reportData.production.totalWastePercentage != null && reportData.production.totalWastePercentage <= 5 ? "#16A34A" : "#DC2626"} />
                <Text style={[styles.summaryValue, { color: reportData.production.totalWastePercentage != null && reportData.production.totalWastePercentage <= 5 ? "#16A34A" : "#DC2626" }]}>{formatRate(language, reportData.production.totalWastePercentage)}</Text>
                <Text style={styles.summaryLabel}>{copy("نسبة الهدر الإجمالي (خيوط + جوارب)", "Total waste rate (yarn + socks)")}</Text>
              </View>
            </View>

            {/* KPI Indicators */}
            <Text style={[styles.sectionTitle, directionalText, { color: colors.foreground }]}>
              {copy("مؤشرات الأداء", "Performance Indicators")}
            </Text>
            <View style={styles.kpiGrid}>
              <View style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={[styles.kpiIndicator, { backgroundColor: reportData.production.totalWastePercentage == null ? "#94A3B8" : getStatusColor(100 - reportData.production.totalWastePercentage, 95, 90) }]} />
                <Text style={[styles.kpiTitle, { color: colors.muted }]}>{copy("نسبة الهدر الإجمالي", "Total waste rate")}</Text>
                <Text style={[styles.kpiValue, { color: reportData.production.totalWastePercentage == null ? "#64748B" : getStatusColor(100 - reportData.production.totalWastePercentage, 95, 90) }]}>
                  {formatRate(language, reportData.production.totalWastePercentage)}
                </Text>
              </View>
              <View style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={[styles.kpiIndicator, { backgroundColor: getStatusColor(reportData.tasks.completionRate, 80, 60) }]} />
                <Text style={[styles.kpiTitle, { color: colors.muted }]}>{copy("إنجاز المهام", "Task Completion")}</Text>
                <Text style={[styles.kpiValue, { color: getStatusColor(reportData.tasks.completionRate, 80, 60) }]}>
                  {reportData.tasks.completionRate.toFixed(0)}%
                </Text>
              </View>
              <View style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={[styles.kpiIndicator, { backgroundColor: getStatusColor(reportData.collection.collectionRate, 80, 60) }]} />
                <Text style={[styles.kpiTitle, { color: colors.muted }]}>{copy("نسبة التحصيل", "Collection Rate")}</Text>
                <Text style={[styles.kpiValue, { color: getStatusColor(reportData.collection.collectionRate, 80, 60) }]}>
                  {reportData.collection.collectionRate.toFixed(0)}%
                </Text>
              </View>
              <View style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={[styles.kpiIndicator, { backgroundColor: reportData.maintenance.emergencyCount <= 3 ? "#22C55E" : "#EF4444" }]} />
                <Text style={[styles.kpiTitle, { color: colors.muted }]}>{copy("طوارئ الصيانة", "Emergency Maint.")}</Text>
                <Text style={[styles.kpiValue, { color: reportData.maintenance.emergencyCount <= 3 ? "#22C55E" : "#EF4444" }]}>
                  {reportData.maintenance.emergencyCount}
                </Text>
              </View>
            </View>

            {/* Detailed Sections */}
            <Text style={[styles.sectionTitle, directionalText, { color: colors.foreground }]}>
              {copy("تفاصيل الأقسام", "Section Details")}
            </Text>

            <View style={[styles.detailCard, { backgroundColor: colors.surface, borderColor: colors.border }] }>
              <View style={[styles.detailHeader, { flexDirection: rowDirection }]}><MaterialIcons name="assignment-late" size={20} color="#DC2626" /><Text style={[styles.detailTitle, directionalText, { color: colors.foreground }]}>{copy("طلبات التصنيع وأسباب التعثر", "Manufacturing Requests")}</Text></View>
              <View style={[styles.detailRow, { flexDirection: rowDirection }]}><Text style={[styles.detailLabel, directionalText, { color: colors.muted }]}>{copy("تم الإنتاج", "Produced")}</Text><Text style={[styles.detailValue, directionalText, { color: "#15803D" }]}>{reportData.manufacturingRequests.produced} ({reportData.manufacturingRequests.total ? (reportData.manufacturingRequests.produced / reportData.manufacturingRequests.total * 100).toFixed(1) : 0}%)</Text></View>
              <View style={[styles.detailRow, { flexDirection: rowDirection }]}><Text style={[styles.detailLabel, directionalText, { color: colors.muted }]}>{copy("لم يتم الإنتاج", "Not produced")}</Text><Text style={[styles.detailValue, directionalText, { color: "#DC2626" }]}>{reportData.manufacturingRequests.notProduced} ({reportData.manufacturingRequests.total ? (reportData.manufacturingRequests.notProduced / reportData.manufacturingRequests.total * 100).toFixed(1) : 0}%)</Text></View>
              <View style={[styles.detailRow, { flexDirection: rowDirection }]}><Text style={[styles.detailLabel, directionalText, { color: colors.muted }]}>{copy("لم تسجل النتيجة", "Pending")}</Text><Text style={[styles.detailValue, directionalText, { color: "#B45309" }]}>{reportData.manufacturingRequests.pending} ({reportData.manufacturingRequests.total ? (reportData.manufacturingRequests.pending / reportData.manufacturingRequests.total * 100).toFixed(1) : 0}%)</Text></View>
              {reportData.manufacturingRequests.failureReasons.slice(0, 5).map((item) => <View key={item.reason} style={[styles.detailRow, { flexDirection: rowDirection }]}><Text style={[styles.detailLabel, directionalText, { color: colors.muted }]}>{item.reason}</Text><Text style={[styles.detailValue, directionalText, { color: "#7C3AED" }]}>{item.count} ({reportData.manufacturingRequests.notProduced ? (item.count / reportData.manufacturingRequests.notProduced * 100).toFixed(1) : 0}%)</Text></View>)}
              <Text style={[directionalText, { color: colors.foreground, fontWeight: "900", marginTop: 8 }]}>{copy("مقارنة بالفترة المكافئة السابقة", "Compared with preceding equivalent period")}</Text>
              <View style={[styles.detailRow, { flexDirection: rowDirection }]}><Text style={[styles.detailLabel, directionalText, { color: colors.muted }]}>{copy("تغير تم الإنتاج", "Produced change")}</Text><Text style={[styles.detailValue, { color: reportData.manufacturingRequests.produced >= reportData.previousManufacturingRequests.produced ? "#15803D" : "#DC2626" }]}>{reportData.manufacturingRequests.produced - reportData.previousManufacturingRequests.produced} {copy("طلب", "requests")}</Text></View>
              <View style={[styles.detailRow, { flexDirection: rowDirection }]}><Text style={[styles.detailLabel, directionalText, { color: colors.muted }]}>{copy("تغير لم يتم الإنتاج", "Not-produced change")}</Text><Text style={[styles.detailValue, { color: reportData.manufacturingRequests.notProduced <= reportData.previousManufacturingRequests.notProduced ? "#15803D" : "#DC2626" }]}>{reportData.manufacturingRequests.notProduced - reportData.previousManufacturingRequests.notProduced} {copy("طلب", "requests")}</Text></View>
            </View>

            {/* Production Details */}
            <View style={[styles.detailCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.detailHeader, { flexDirection: rowDirection }]}>
                <MaterialIcons name="precision-manufacturing" size={20} color="#2563EB" />
                <Text style={[styles.detailTitle, directionalText, { color: colors.foreground }]}>
                  {copy("الإنتاج", "Production")}
                </Text>
              </View>
              <View style={[styles.detailRow, { flexDirection: rowDirection }]}>
                <Text style={[styles.detailLabel, directionalText, { color: colors.muted }]}>{copy("إجمالي الإنتاج", "Total production")}</Text>
                <Text style={[styles.detailValue, directionalText, { color: colors.foreground }]}>{formatPairs(language, reportData.production.totalPairs)}</Text>
              </View>
              <View style={[styles.detailRow, { flexDirection: rowDirection }]}>
                <Text style={[styles.detailLabel, directionalText, { color: colors.muted }]}>{copy("هدر الخيوط", "Thread Waste")}</Text>
                <Text style={[styles.detailValue, directionalText, { color: colors.foreground }]}>{formatRecordedGrams(language, reportData.production.wasteThread, reportData.production.totalEntries > 0)} {copy("جرام", "g")}</Text>
              </View>
              <View style={[styles.detailRow, { flexDirection: rowDirection }]}>
                <Text style={[styles.detailLabel, directionalText, { color: colors.muted }]}>{copy("نسبة هدر الخيوط", "Yarn Waste Rate")}</Text>
                <Text style={[styles.detailValue, directionalText, { color: colors.foreground }]}>{formatRate(language, reportData.production.threadWastePercentage)}</Text>
              </View>
              <View style={[styles.detailRow, { flexDirection: rowDirection }]}>
                <Text style={[styles.detailLabel, directionalText, { color: colors.muted }]}>{copy("هدر الجوارب", "Sock Waste")}</Text>
                <Text style={[styles.detailValue, directionalText, { color: colors.foreground }]}>{formatRecordedGrams(language, reportData.production.wasteSocks, reportData.production.totalEntries > 0)} {copy("جرام", "g")}</Text>
              </View>
              <View style={[styles.detailRow, { flexDirection: rowDirection }]}>
                <Text style={[styles.detailLabel, directionalText, { color: colors.muted }]}>{copy("إجمالي الهدر (خيوط + جوارب)", "Total Waste (Yarn + Socks)")}</Text>
                <Text style={[styles.detailValue, directionalText, { color: colors.foreground }]}>{formatRecordedGrams(language, reportData.production.totalWaste, reportData.production.totalEntries > 0)} {copy("جرام", "g")}</Text>
              </View>
              <View style={[styles.detailRow, { flexDirection: rowDirection }]}>
                <Text style={[styles.detailLabel, directionalText, { color: colors.muted }]}>{copy("نسبة الهدر الإجمالي", "Total Waste Rate")}</Text>
                <Text style={[styles.detailValue, directionalText, { color: colors.foreground }]}>{formatRate(language, reportData.production.totalWastePercentage)}</Text>
              </View>
              <View style={[styles.detailRow, { flexDirection: rowDirection }]}>
                <Text style={[styles.detailLabel, directionalText, { color: colors.muted }]}>{copy("النخب الثاني", "Second Grade")}</Text>
                <Text style={[styles.detailValue, directionalText, { color: colors.foreground }]}>{formatPairs(language, reportData.production.secondGrade)}</Text>
              </View>
            </View>

            {/* Sales Details */}
            <View style={[styles.detailCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.detailHeader, { flexDirection: rowDirection }]}>
                <MaterialIcons name="point-of-sale" size={20} color="#16A34A" />
                <Text style={[styles.detailTitle, directionalText, { color: colors.foreground }]}>
                  {copy("إدارة التسويق والمبيعات", "Marketing & Sales Management")}
                </Text>
              </View>
              <View style={[styles.detailRow, { flexDirection: rowDirection }]}>
                <Text style={[styles.detailLabel, directionalText, { color: colors.muted }]}>{copy("إجمالي المبيعات", "Total Sales")}</Text>
                <Text style={[styles.detailValue, directionalText, { color: colors.foreground }]}>{formatAmount(language, reportData.sales.totalAmount)} {copy("ر.س", "SAR")}</Text>
              </View>
              <View style={[styles.detailRow, { flexDirection: rowDirection }]}>
                <Text style={[styles.detailLabel, directionalText, { color: colors.muted }]}>{copy("عدد الفواتير", "Invoice count")}</Text>
                <Text style={[styles.detailValue, directionalText, { color: colors.foreground }]}>{reportData.sales.totalEntries}</Text>
              </View>
              <View style={[styles.detailRow, { flexDirection: rowDirection }]}>
                <Text style={[styles.detailLabel, directionalText, { color: colors.muted }]}>{copy("عدد التحصيلات", "Collection count")}</Text>
                <Text style={[styles.detailValue, directionalText, { color: colors.foreground }]}>{reportData.collection.totalEntries}</Text>
              </View>
              <View style={[styles.detailRow, { flexDirection: rowDirection }]}>
                <Text style={[styles.detailLabel, directionalText, { color: colors.muted }]}>{copy("المحصّل", "Collected")}</Text>
                <Text style={[styles.detailValue, directionalText, { color: colors.foreground }]}>{formatAmount(language, reportData.collection.totalAmount)} {copy("ر.س", "SAR")}</Text>
              </View>
            </View>

            <View style={[styles.detailCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.detailHeader, { flexDirection: rowDirection }]}><MaterialIcons name="receipt-long" size={20} color="#16A34A" /><Text style={[styles.detailTitle, directionalText, { color: colors.foreground }]}>{copy("تفاصيل فواتير المبيعات", "Sales invoice details")}</Text></View>
              {reportData.commercial.salesRows.length === 0 ? <Text style={[styles.detailLabel, directionalText, { color: colors.muted }]}>{copy("لا توجد فواتير مبيعات في الفترة", "No sales invoices in this period")}</Text> : reportData.commercial.salesRows.map((row: any) => <View key={`sale-${row.reportSource}-${row.id ?? row.referenceCode}`} style={styles.detailListRow}>
                <Text style={[styles.detailValue, directionalText, { color: colors.foreground }]}>{row.invoiceNumber || row.referenceCode || "—"} · {row.customerName || "—"}</Text>
                <Text style={[styles.detailLabel, directionalText, { color: colors.muted }]}>{businessDate(row, "sale") || "—"} · {formatAmount(language, Number(row.amount || 0))} {copy("ر.س", "SAR")} · {row.representativeName || row.sellerName || localizedReportSource(language, row.reportSource)}</Text>
                {Array.isArray(row.attachments) && row.attachments.length > 0 && <Text style={[styles.detailLabel, directionalText, { color: colors.muted }]}>{copy("المرفقات: ", "Attachments: ")}{row.attachments.map((file: any) => file.name || file.fileName || file.type).join(copy("، ", ", "))}</Text>}
              </View>)}
            </View>

            <View style={[styles.detailCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.detailHeader, { flexDirection: rowDirection }]}><MaterialIcons name="payments" size={20} color="#0284C7" /><Text style={[styles.detailTitle, directionalText, { color: colors.foreground }]}>{copy("تفاصيل التحصيل", "Collection details")}</Text></View>
              {reportData.commercial.collectionRows.length === 0 ? <Text style={[styles.detailLabel, directionalText, { color: colors.muted }]}>{copy("لا توجد تحصيلات في الفترة", "No collections in this period")}</Text> : reportData.commercial.collectionRows.map((row: any) => <View key={`collection-${row.reportSource}-${row.id ?? row.referenceCode}`} style={styles.detailListRow}>
                <Text style={[styles.detailValue, directionalText, { color: colors.foreground }]}>{row.receiptNumber || row.referenceCode || "—"} · {row.customerName || "—"}</Text>
                <Text style={[styles.detailLabel, directionalText, { color: colors.muted }]}>{businessDate(row, "collection") || "—"} · {formatAmount(language, Number(row.collectedAmount ?? row.amount ?? 0))} {copy("ر.س", "SAR")} · {row.representativeName || row.collectorName || localizedReportSource(language, row.reportSource)}</Text>
                {Array.isArray(row.attachments) && row.attachments.length > 0 && <Text style={[styles.detailLabel, directionalText, { color: colors.muted }]}>{copy("المرفقات: ", "Attachments: ")}{row.attachments.map((file: any) => file.name || file.fileName || file.type).join(copy("، ", ", "))}</Text>}
              </View>)}
            </View>

            <View style={[styles.detailCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.detailHeader, { flexDirection: rowDirection }]}><MaterialIcons name="assignment" size={20} color="#7C3AED" /><Text style={[styles.detailTitle, directionalText, { color: colors.foreground }]}>{copy("تفاصيل الطلبات والزيارات", "Order and visit details")}</Text></View>
              {sortReportRows([...reportData.commercial.orderRows, ...reportData.commercial.visitRows, ...reportData.commercial.otherTransactionRows], "transaction").map((row: any) => <View key={`transaction-${row.reportSource}-${row.id ?? row.referenceCode}`} style={styles.detailListRow}>
                <Text style={[styles.detailValue, directionalText, { color: colors.foreground }]}>{row.referenceCode || "—"} · {row.customerName || "—"} · {transactionTypeLabel(language, row.transactionType)}</Text>
                <Text style={[styles.detailLabel, directionalText, { color: colors.muted }]}>{businessDate(row, "transaction") || "—"} · {transactionStatus(language, row.status, row.transactionType)} · {row.representativeName || "—"}</Text>
                {row.transactionType === "visit" ? <Text style={[styles.detailLabel, directionalText, { color: colors.muted }]}>{localizedVisitText(language, row.visitReport)}</Text> : Array.isArray(row.items) && row.items.map((item: any, index: number) => <Text key={`${row.id}-${index}`} style={[styles.detailLabel, directionalText, { color: colors.muted }]}>{item.productName || "—"} · {itemQuantity(language, item)} · {item.size || "—"} · {item.color || "—"}</Text>)}
                {Array.isArray(row.attachments) && row.attachments.length > 0 && <Text style={[styles.detailLabel, directionalText, { color: colors.muted }]}>{copy("المرفقات: ", "Attachments: ")}{row.attachments.map((file: any) => file.name || file.fileName || file.type).join(copy("، ", ", "))}</Text>}
              </View>)}
            </View>

            <View style={[styles.detailCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.detailHeader, { flexDirection: rowDirection }]}><MaterialIcons name="inventory-2" size={20} color="#C2410C" /><Text style={[styles.detailTitle, directionalText, { color: colors.foreground }]}>{copy("التخزين والمستودعات — إنتاج تام", "Storage & warehouses — finished goods")}</Text></View>
              <View style={[styles.detailRow, { flexDirection: rowDirection }]}><Text style={[styles.detailLabel, directionalText, { color: colors.muted }]}>{copy("رصيد البداية", "Opening balance")}</Text><Text style={[styles.detailValue, directionalText, { color: colors.foreground }]}>{reportData.warehouse.openingPairs == null ? (copy("غير متاح — يحتاج مراجعة", "Unavailable — needs review")) : formatPairs(language, reportData.warehouse.openingPairs)}</Text></View>
              <View style={[styles.detailRow, { flexDirection: rowDirection }]}><Text style={[styles.detailLabel, directionalText, { color: colors.muted }]}>{copy("وارد الفترة", "Period receipts")}</Text><Text style={[styles.detailValue, directionalText, { color: colors.foreground }]}>{formatPairs(language, reportData.warehouse.receiptPairs)}</Text></View>
              <View style={[styles.detailRow, { flexDirection: rowDirection }]}><Text style={[styles.detailLabel, directionalText, { color: colors.muted }]}>{copy("صادر الفترة", "Period issues")}</Text><Text style={[styles.detailValue, directionalText, { color: colors.foreground }]}>{formatPairs(language, reportData.warehouse.issuePairs)}</Text></View>
              <View style={[styles.detailRow, { flexDirection: rowDirection }]}><Text style={[styles.detailLabel, directionalText, { color: colors.muted }]}>{copy("رصيد النهاية للفترة", "Period closing balance")}</Text><Text style={[styles.detailValue, directionalText, { color: colors.foreground }]}>{reportData.warehouse.closingPairs == null ? (copy("غير متاح — يحتاج مراجعة", "Unavailable — needs review")) : formatPairs(language, reportData.warehouse.closingPairs)}</Text></View>
              <View style={[styles.detailRow, { flexDirection: rowDirection }]}><Text style={[styles.detailLabel, directionalText, { color: colors.muted }]}>{copy("الرصيد الحالي", "Current balance")}</Text><Text style={[styles.detailValue, directionalText, { color: colors.foreground }]}>{formatPairs(language, reportData.warehouse.currentPairs)}</Text></View>
            </View>

            {/* Maintenance Details */}
            <View style={[styles.detailCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.detailHeader, { flexDirection: rowDirection }]}>
                <MaterialIcons name="build" size={20} color="#F59E0B" />
                <Text style={[styles.detailTitle, directionalText, { color: colors.foreground }]}>
                  {copy("الصيانة", "Maintenance")}
                </Text>
              </View>
              <View style={[styles.detailRow, { flexDirection: rowDirection }]}>
                <Text style={[styles.detailLabel, directionalText, { color: colors.muted }]}>{copy("صيانة دورية", "Periodic")}</Text>
                <Text style={[styles.detailValue, directionalText, { color: colors.foreground }]}>{reportData.maintenance.periodicCount}</Text>
              </View>
              <View style={[styles.detailRow, { flexDirection: rowDirection }]}>
                <Text style={[styles.detailLabel, directionalText, { color: colors.muted }]}>{copy("طوارئ", "Emergency")}</Text>
                <Text style={[styles.detailValue, directionalText, { color: colors.foreground }]}>{reportData.maintenance.emergencyCount}</Text>
              </View>
              <View style={[styles.detailRow, { flexDirection: rowDirection }]}>
                <Text style={[styles.detailLabel, directionalText, { color: colors.muted }]}>{copy("أجهزة متوقفة", "Stopped")}</Text>
                <Text style={[styles.detailValue, directionalText, { color: colors.foreground }]}>{reportData.maintenance.stoppedMachines}</Text>
              </View>
            </View>

            <Text style={[styles.sectionTitle, directionalText, { color: colors.foreground }]}>
              {copy("دورة العهد الجديدة المستقلة — لا تعني صفراً للإنتاج العام", "Independent new custody cycle — does not mean total production is zero")}
            </Text>
            <CustodySummaryPanel
              startDate={range.start}
              endDate={range.end}
              legacyStageRows={reportData.legacyStageRows}
            />

            {/* Export Button */}
            <TouchableOpacity
              style={[styles.exportButton, { flexDirection: rowDirection }, isExporting && styles.exportButtonDisabled]}
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
                  ? (copy("جاري التصدير...", "Exporting..."))
                  : (copy("تصدير التقرير PDF", "Export Report PDF"))}
              </Text>
            </TouchableOpacity>

            {/* Print Note */}
            <View style={[styles.noteCard, { backgroundColor: "#FFFBEB", borderColor: "#FDE68A", flexDirection: rowDirection }]}>
              <MaterialIcons name="info-outline" size={18} color="#D97706" />
              <Text style={[styles.noteText, directionalText, { color: "#92400E" }]}>
                {copy("التقرير المُصدّر بصيغة HTML يمكن طباعته مباشرة من المتصفح كـ PDF عبر خيار الطباعة (Ctrl+P)", "The exported HTML report can be printed directly from browser as PDF via Print option (Ctrl+P)")}
              </Text>
            </View>
          </>
        )}

        {/* Empty State */}
        {!isLoading && !reportData && (
          <View style={styles.emptyState}>
            <MaterialIcons name="insert-chart-outlined" size={64} color={colors.muted} />
            <Text style={[styles.emptyText, directionalText, { color: colors.muted }]}>
              {copy("لا توجد بيانات متاحة لهذا الشهر", "No data available for this month")}
            </Text>
            <TouchableOpacity
              style={[styles.retryButton, { borderColor: colors.primary }]}
              onPress={loadReportData}
            >
              <Text style={[styles.retryText, { color: colors.primary }]}>
                {copy("إعادة المحاولة", "Retry")}
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
  rangeNotice: { fontSize: 11, fontWeight: "700", lineHeight: 17 },
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
