import { CustodySummaryPanel } from "@/components/custody-summary-panel";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { DateField } from "@/components/date-field";
import { BackButton } from "@/components/back-button";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useLanguage } from "@/lib/language-context";
import {
  isEnglish,
  localize,
  textAlignFor,
  writingDirection,
} from "@/lib/i18n/runtime";
import { useAuth } from "@/lib/auth-context";
import { maintenanceEntriesService } from "@/lib/services/data.service";
import { representativeService } from "@/lib/services/representative.service";
import { custodyService } from "@/lib/services/custody.service";
import {
  buildCustodyReport,
  reportPrintHtml,
  type CustodyReport,
} from "@shared/custody-reporting";
import {
  businessDate,
  commercialReport,
  exactPairs,
  inReportPeriod,
  pairLabel,
  productionMetrics,
  reportDate as normalizeReportDate,
  riyadhDate,
  transactionStatusLabel,
  visitText,
  warehousePeriod,
  type ReportKind,
} from "@shared/operational-report";
import {
  adminService,
  administrativeService,
  boardDataService,
  collectionService,
  expensesService,
  financialReportsService,
  finishedWarehouseService,
  governmentTendersService,
  maintenanceService,
  manufacturingService,
  meetingsService,
  meetingOutputsService,
  productTrackingService,
  productionCostsLocalService,
  productionService,
  productsService,
  reportsService,
  salesService,
  savedProductCostsService,
  taskService,
  warehouseService,
} from "@/lib/services/api.service";

const REPORT_TIME_ZONE = "Asia/Riyadh";
const today = () => riyadhDate();
const numberValue = (value: unknown) => Number(value || 0) || 0;
// بعض مسارات التقارير تعيد مصفوفة مباشرة، وبعضها يعيد {items}/{rows}/{data}.
// يجب توحيدها قبل الفلترة حتى لا يتحول مصدر صحيح إلى صفر صامتاً.
const rowsFromResponse = (value: any): any[] => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.rows)) return value.rows;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.results)) return value.results;
  return [];
};
const rowPairs = (row: any) => exactPairs(row, "production");
const handoverPairs = (row: any) => exactPairs(row, "handover");
const shortagePairs = (row: any) => {
  const dozen = Number(row?.shortageDozen ?? 0);
  const pairs = Number(row?.shortagePairs ?? row?.shortagePair ?? 0);
  return Number.isFinite(dozen) && Number.isFinite(pairs)
    ? dozen * 12 + pairs
    : Number.NaN;
};
// نعرض فرق التسليم كما سُجل؛ لا نخفضه إلى الاستلام أو إلى الصفر.
const deliveredHandoverPairs = (row: any) =>
  handoverPairs(row) - shortagePairs(row);
const quantityLabel = (pairs: number, isAr = true) => {
  if (!Number.isFinite(pairs))
    return isAr
      ? "كمية غير صالحة — تحتاج مراجعة"
      : "Invalid quantity — review required";
  if (isAr) return pairLabel(pairs);
  const sign = pairs < 0 ? "−" : "";
  const absolute = Math.abs(Math.trunc(pairs));
  return `${sign}${Math.floor(absolute / 12)} dozen + ${absolute % 12} pairs`;
};
const signedQuantityLabel = (pairs: number, isAr = true) => {
  const sign = pairs > 0 ? "+" : pairs < 0 ? "−" : "±";
  return `${sign}${quantityLabel(Math.abs(pairs), isAr)}`;
};
const rowYarnTotalBy = (row: any, key: string) =>
  Number.isFinite(rowPairs(row))
    ? numberValue(row[key]) * rowPairs(row)
    : Number.NaN;
const rowYarnTotal = (row: any) =>
  [
    "yarnRubber",
    "yarnSpandex",
    "yarnNylon",
    "yarnCotton",
    "yarnBamboo",
    "yarnSpan",
  ].reduce(
    (sum, key) =>
      sum +
      (Number.isFinite(rowYarnTotalBy(row, key))
        ? rowYarnTotalBy(row, key)
        : 0),
    0,
  );
const rowWastePercent = (row: any) => {
  const used = rowYarnTotal(row);
  return used > 0
    ? (
        ((numberValue(row.wasteThreadGrams) +
          numberValue(row.wasteSocksGrams)) /
          used) *
        100
      ).toFixed(2)
    : null;
};
/** Tracking has its own business day; expose it as the general-report date. */
const rowForReportPeriod = (row: any, kind: ReportKind) => {
  if (kind !== "general") return row;
  const trackingBusinessDate = normalizeReportDate(
    row?.trackingDate ?? row?.handoverDate,
  );
  return trackingBusinessDate ? { ...row, date: trackingBusinessDate } : row;
};
const handoverBusinessDate = (row: any) =>
  normalizeReportDate(row?.trackingDate ?? row?.handoverDate) ||
  businessDate(row, "general");
const rowBusinessDate = (row: any, kind: ReportKind) =>
  businessDate(rowForReportPeriod(row, kind), kind);
/** Newest business-date first; undated records remain visible after dated rows. */
const sortReportRows = (rows: any[], kind: ReportKind) =>
  [...rows].sort((left, right) => {
    const leftDate = rowBusinessDate(left, kind);
    const rightDate = rowBusinessDate(right, kind);
    if (leftDate !== rightDate) {
      if (!leftDate) return 1;
      if (!rightDate) return -1;
      return rightDate.localeCompare(leftDate);
    }
    return String(right?.id ?? right?.referenceCode ?? "").localeCompare(
      String(left?.id ?? left?.referenceCode ?? ""),
      "en",
    );
  });
const displayTime = (value: unknown, isAr = true) => {
  if (!value) return isAr ? "غير مسجل" : "Not recorded";
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text))
    return isAr ? "غير مسجل" : "Not recorded";
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime())
    ? isAr
      ? "غير مسجل"
      : "Not recorded"
    : parsed.toLocaleString(isAr ? "ar-SA" : "en-US", {
        timeZone: REPORT_TIME_ZONE,
        dateStyle: "short",
        timeStyle: "short",
      });
};
const elapsedLabel = (minutes: number | null, isAr = true) => {
  if (minutes === null || !Number.isFinite(minutes))
    return isAr ? "غير محسوبة" : "Not calculated";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours ? `${hours} ${isAr ? "ساعة" : "hour(s)"} ` : ""}${mins} ${isAr ? "دقيقة" : "minute(s)"}`;
};
const escapeHtml = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>\"']/g,
    (c) =>
      (
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#039;",
        }) as Record<string, string>
      )[c] || c,
  );
const attachmentLabel = (attachments: unknown, isAr = true) => {
  const files = Array.isArray(attachments) ? attachments : [];
  return files.length
    ? files
        .map(
          (file: any) =>
            file.name ||
            file.fileName ||
            file.type ||
            (isAr ? "مرفق" : "Attachment"),
        )
        .join(isAr ? "، " : ", ")
    : "—";
};
const transactionItemsLabel = (items: unknown, isAr = true) => {
  const rows = Array.isArray(items) ? items : [];
  if (!rows.length) return isAr ? "لا توجد أصناف — زيارة" : "No items — visit";
  return rows
    .map((item: any, index: number) => {
      const pairs = exactPairs(item, "item");
      return `${index + 1}. ${item.productName || item.name || "—"} | ${isAr ? "المقاس" : "Size"}: ${item.size || item.productSize || "—"} | ${isAr ? "اللون" : "Color"}: ${item.color || item.productColor || "—"} | ${quantityLabel(pairs, isAr)}`;
    })
    .join(isAr ? "؛ " : "; ");
};
const customerTypeLabel = (value: unknown, isAr = true) => {
  const raw = String(value ?? "").trim();
  if (!raw) return isAr ? "غير محدد" : "Not specified";
  const labels: Record<string, [string, string]> = {
    individual: ["فرد", "Individual"],
    retail: ["تجزئة", "Retail"],
    wholesale: ["جملة", "Wholesale"],
    distributor: ["موزع", "Distributor"],
    company: ["شركة", "Company"],
    factory: ["مصنع", "Factory"],
    customer: ["عميل", "Customer"],
  };
  if (labels[raw.toLowerCase()]) return labels[raw.toLowerCase()][isAr ? 0 : 1];
  return /[\u0600-\u06FF]/.test(raw)
    ? raw
    : isAr
      ? "غير محدد"
      : "Not specified";
};
const customerDetail = (row: any, isAr = true) =>
  `${row.customerName || "—"} | ${customerTypeLabel(row.customerType || row.customer?.customerType, isAr)} | ${isAr ? "المسؤول" : "Contact"}: ${row.contactName || row.customer?.contactName || "—"} | ${isAr ? "الجوال" : "Phone"}: ${row.contactPhone || row.customer?.contactPhone || "—"}`;
const handoverIdentity = (row: any) => {
  const productIdentity =
    row.productionId ??
    row.productBarcode ??
    `${row.productName}|${row.productSize}|${row.productColor}`;
  const machineIdentity = Array.isArray(row.machineNumbers)
    ? row.machineNumbers.join(",")
    : String(row.machineNumbers || row.machineNumber || "");
  return [
    productIdentity,
    row.previousStage || "",
    row.currentStage || row.receiverStage || "",
    handoverBusinessDate(row),
    numberValue(row.quantityDozen),
    numberValue(row.quantityPairs ?? row.quantityPair),
    machineIdentity,
  ].join("|");
};
const canonicalizeHandovers = (rows: any[]) => {
  const grouped = new Map<string, any>();
  rows.forEach((row) => {
    const key = handoverIdentity(row);
    const current = grouped.get(key);
    if (!current) {
      grouped.set(key, {
        ...row,
        _hasDelivered: Boolean(
          row.deliveredBy ||
          row.deliveredAt ||
          row.handoverStatus === "delivered",
        ),
        _hasReceived: Boolean(
          row.receivedBy || row.receivedAt || row.handoverStatus === "received",
        ),
        _deliveredBy: row.deliveredBy,
        _receivedBy: row.receivedBy,
        _deliveredAt: row.deliveredAt,
        _receivedAt: row.receivedAt,
      });
      return;
    }
    current._hasDelivered ||= Boolean(
      row.deliveredBy || row.deliveredAt || row.handoverStatus === "delivered",
    );
    current._hasReceived ||= Boolean(
      row.receivedBy || row.receivedAt || row.handoverStatus === "received",
    );
    current._deliveredBy ||= row.deliveredBy;
    current._receivedBy ||= row.receivedBy;
    current._deliveredAt ||= row.deliveredAt;
    current._receivedAt ||= row.receivedAt;
    current.shortageDozen = Math.max(
      numberValue(current.shortageDozen),
      numberValue(row.shortageDozen),
    );
    current.shortagePairs = Math.max(
      numberValue(current.shortagePairs),
      numberValue(row.shortagePairs),
    );
  });
  return sortReportRows(
    Array.from(grouped.values()).map((row) => ({
      ...row,
      deliveredBy: row._deliveredBy,
      receivedBy: row._receivedBy,
      deliveredAt: row._deliveredAt,
      receivedAt: row._receivedAt,
    })),
    "general",
  );
};

export default function DailySummaryScreen() {
  const router = useRouter();
  const colors = useColors();
  const { language } = useLanguage();
  const { user } = useAuth();
  const english = isEnglish(language);
  const isAr = language === "ar";
  const textAlign = textAlignFor(language);
  const direction = writingDirection(language);
  const rowDirection = english ? "row" : "row-reverse";
  const contentAlignment = english ? "flex-start" : "flex-end";
  const copy = useCallback(
    (arabic: string, englishCopy: string) =>
      localize(language, arabic, englishCopy),
    [language],
  );
  const canExportPdf = user?.role === "admin";
  const canManageMarketingDaily =
    user?.role === "admin" ||
    ["sales", "marketing", "sales_manager"].includes(
      String(user?.department || "").toLowerCase(),
    );
  const currentDate = today();
  const currentMonthStart = `${currentDate.slice(0, 7)}-01`;
  const [reportDate, setReportDate] = useState(currentMonthStart);
  const [reportEndDate, setReportEndDate] = useState(today());
  // كل قسم في التقرير الشامل يلتزم حصراً بتاريخ البداية والنهاية المختارين.
  // لا يوجد وضع يعرض سجلات خارج الفترة.
  const normalizedReportDate = normalizeReportDate(reportDate);
  const normalizedReportEndDate = normalizeReportDate(reportEndDate);
  const reportRangeIsReversed =
    !!normalizedReportDate &&
    !!normalizedReportEndDate &&
    normalizedReportDate > normalizedReportEndDate;
  const reportPeriodStart = reportRangeIsReversed
    ? normalizedReportEndDate
    : normalizedReportDate;
  const reportPeriodEnd = reportRangeIsReversed
    ? normalizedReportDate
    : normalizedReportEndDate;
  const applyDatePreset = useCallback(
    (preset: "day" | "twoDays" | "week" | "month") => {
      const end = today();
      const endDate = new Date(`${end}T12:00:00`);
      const startDate = new Date(endDate);
      if (preset === "twoDays") startDate.setDate(startDate.getDate() - 1);
      if (preset === "week") startDate.setDate(startDate.getDate() - 6);
      if (preset === "month") startDate.setDate(1);
      const iso = (value: Date) =>
        `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
      setReportDate(iso(startDate));
      setReportEndDate(end);
    },
    [],
  );
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Record<string, any[]>>({
    production: [],
    manufacturing: [],
    tracking: [],
    sales: [],
    collection: [],
    ordersVisits: [],
    customManufacturing: [],
    expenses: [],
    maintenance: [],
    tasks: [],
    warehouse: [],
    warehouseMovements: [],
    warehouseStock: [],
    administrative: [],
    products: [],
    meetings: [],
    meetingOutputs: [],
    financialReports: [],
    localCosts: [],
    savedProductCosts: [],
    tenders: [],
    boardData: [],
  });
  const [users, setUsers] = useState<any[]>([]);
  const [marketingNotes, setMarketingNotes] = useState("");
  const [savingMarketingReport, setSavingMarketingReport] = useState(false);
  const [savedMarketingReports, setSavedMarketingReports] = useState<any[]>([]);
  const [differenceFilter, setDifferenceFilter] = useState<
    "all" | "positive" | "negative"
  >("all");
  const [sourceErrors, setSourceErrors] = useState<Record<string, string>>({});
  const [custodySource, setCustodySource] = useState<{
    batches: any[];
    accounts: any[];
    settings: any;
  } | null>(null);
  const [custodyError, setCustodyError] = useState("");
  const [representativeReport, setRepresentativeReport] = useState<{
    summary: any;
    transactions: any[];
    collections: any[];
    sales: any[];
  }>({
    summary: { representatives: [] },
    transactions: [],
    collections: [],
    sales: [],
  });

  const loadVersion = useRef(0);
  const load = useCallback(async () => {
    const version = ++loadVersion.current;
    setLoading(true);
    const results = await Promise.allSettled([
      productionService.getAll(),
      manufacturingService.getAll(),
      productTrackingService.list(),
      salesService.getAll(),
      collectionService.getAll(),
      maintenanceEntriesService.getBySection("orders_visits"),
      maintenanceEntriesService.getBySection("custom_manufacturing"),
      expensesService.getAll(),
      Promise.allSettled([
        maintenanceService.getMaintained(),
        maintenanceService.getStopped(),
        maintenanceService.getRecommendations(),
      ]),
      taskService.getAll(),
      Promise.allSettled([
        warehouseService.getRawMaterials(),
        warehouseService.getConsumption(),
        warehouseService.getIncoming(),
        finishedWarehouseService.movements(),
        finishedWarehouseService.list(),
      ]),
      administrativeService.getAll(),
      productsService.list(),
      meetingsService.list(),
      meetingOutputsService.list(),
      financialReportsService.list(),
      productionCostsLocalService.list(),
      savedProductCostsService.list(),
      governmentTendersService.list(),
      boardDataService.getAll(),
    ]);
    const keys = [
      "production",
      "manufacturing",
      "tracking",
      "sales",
      "collection",
      "ordersVisits",
      "customManufacturing",
      "expenses",
      "maintenance",
      "tasks",
      "warehouse",
      "administrative",
      "products",
      "meetings",
      "meetingOutputs",
      "financialReports",
      "localCosts",
      "savedProductCosts",
      "tenders",
      "boardData",
    ];
    const next: Record<string, any[]> = {};
    keys.forEach((key, index) => {
      const result = results[index];
      const value = result.status === "fulfilled" ? result.value : [];
      if (key === "maintenance") {
        next[key] = rowsFromResponse(value).flatMap((part: any) =>
          part?.status === "fulfilled"
            ? rowsFromResponse(part.value)
            : rowsFromResponse(part),
        );
      } else if (key === "warehouse") {
        const movementLabels = [
          copy("مواد خام", "Raw materials"),
          copy("صرف مواد", "Materials issued"),
          copy("مواد واردة", "Incoming materials"),
          copy("دخول إنتاج تام", "Finished-goods receipt"),
          copy("رصيد مستودع حالي", "Current warehouse balance"),
        ];
        next[key] = rowsFromResponse(value).flatMap(
          (part: any, partIndex: number) => {
            const rows =
              part?.status === "fulfilled"
                ? rowsFromResponse(part.value)
                : rowsFromResponse(part);
            return rows.map((row: any) => ({
              ...row,
              movementType:
                movementLabels[partIndex] ||
                copy("حركة مستودع", "Warehouse movement"),
              materialName:
                row.materialName || row.productName || row.barcode || "—",
              quantity: row.quantity ?? row.quantityDozen,
              unit:
                row.unit || (partIndex === 3 ? copy("درزن", "dozen") : "—"),
              source:
                partIndex === 3
                  ? row.sourceType === "manufacturing_storage"
                    ? copy("مرحلة التخزين", "Storage stage")
                    : row.sourceType
                  : undefined,
              _isWarehouseSnapshot: partIndex === 4,
              createdAt: row.createdAt || row.lastMovementAt,
            }));
          },
        );
      } else next[key] = rowsFromResponse(value);
      if (key === "warehouse") {
        const parts = rowsFromResponse(value);
        const movementPart = parts[3];
        next.warehouseMovements =
          movementPart?.status === "fulfilled"
            ? rowsFromResponse(movementPart.value).map((row: any) => ({
                ...row,
                movementType:
                  row.movementType ||
                  copy("دخول إنتاج تام", "Finished-goods receipt"),
                materialName:
                  row.materialName || row.productName || row.barcode || "—",
                quantity: row.quantity ?? row.quantityDozen,
                unit: row.unit || copy("درزن", "dozen"),
                source:
                  row.sourceType === "manufacturing_storage"
                    ? copy("مرحلة التخزين", "Storage stage")
                    : row.sourceType,
                _isWarehouseSnapshot: false,
                createdAt: row.createdAt || row.lastMovementAt,
              }))
            : [];
        const stockPart = parts[4];
        next.warehouseStock =
          stockPart?.status === "fulfilled"
            ? rowsFromResponse(stockPart.value)
            : [];
      }
    });
    if (version !== loadVersion.current) return;
    setData(next);
    const representativeResults = await Promise.allSettled([
      representativeService.performance.summary({}),
      representativeService.transactions.list({}),
      representativeService.collections.list({}),
      representativeService.sales.list({}),
    ]);
    if (version !== loadVersion.current) return;
    setRepresentativeReport({
      summary:
        representativeResults[0]?.status === "fulfilled"
          ? representativeResults[0].value || { representatives: [] }
          : { representatives: [] },
      transactions:
        representativeResults[1]?.status === "fulfilled"
          ? rowsFromResponse(representativeResults[1].value)
          : [],
      collections:
        representativeResults[2]?.status === "fulfilled"
          ? rowsFromResponse(representativeResults[2].value)
          : [],
      sales:
        representativeResults[3]?.status === "fulfilled"
          ? rowsFromResponse(representativeResults[3].value)
          : [],
    });
    const failures: Record<string, string> = {};
    keys.forEach((key, index) => {
      if (results[index]?.status === "rejected")
        failures[key] = isAr
          ? "تعذر تحميل المصدر"
          : "Source could not be loaded";
    });
    if (representativeResults[0]?.status === "rejected")
      failures.representativeSummary = isAr
        ? "تعذر تحميل ملخص أداء المندوبين"
        : "Representative performance summary could not be loaded";
    if (representativeResults[1]?.status === "rejected")
      failures.representativeTransactions = isAr
        ? "تعذر تحميل طلبات وزيارات المندوبين"
        : "Representative activities could not be loaded";
    if (representativeResults[2]?.status === "rejected")
      failures.representativeCollections = isAr
        ? "تعذر تحميل تحصيلات المندوبين"
        : "Representative collections could not be loaded";
    if (representativeResults[3]?.status === "rejected")
      failures.representativeSales = isAr
        ? "تعذر تحميل فواتير مبيعات المندوبين"
        : "Representative invoices could not be loaded";
    for (const [key, outerIndex, labels] of [
      [
        "maintenance",
        8,
        [
          copy("صيانة", "Maintenance"),
          copy("مكائن متوقفة", "Stopped machines"),
          copy("توصيات", "Recommendations"),
        ],
      ],
      [
        "warehouse",
        10,
        [
          copy("مواد خام", "Raw materials"),
          copy("صرف مواد", "Materials issued"),
          copy("وارد مواد", "Incoming materials"),
          copy("حركة إنتاج تام", "Finished-goods movement"),
          copy("رصيد إنتاج تام", "Finished-goods balance"),
        ],
      ],
    ] as const) {
      const outer = results[outerIndex];
      if (outer?.status === "fulfilled" && Array.isArray(outer.value)) {
        const missing = outer.value.flatMap((part: any, i: number) =>
          part?.status === "rejected" ? [labels[i] || key] : [],
        );
        if (missing.length)
          failures[key] = `${copy("تعذر تحميل", "Could not load")}: ${missing.join(isAr ? "، " : ", ")}`;
      }
    }
    setSourceErrors(failures);
    const custodyResults = await Promise.allSettled([
      custodyService.list(),
      custodyService.accounts.list(),
      custodyService.settings(),
    ]);
    if (version !== loadVersion.current) return;
    if (custodyResults.every((entry) => entry.status === "fulfilled")) {
      setCustodySource({
        batches: (custodyResults[0] as PromiseFulfilledResult<any[]>).value,
        accounts: (custodyResults[1] as PromiseFulfilledResult<any[]>).value,
        settings: (custodyResults[2] as PromiseFulfilledResult<any>).value,
      });
      setCustodyError("");
    } else {
      setCustodySource(null);
      setCustodyError(
        isAr
          ? "تعذر تحميل مصدر العهد؛ لم يُستبدل بصفر."
          : "Custody source could not be loaded; it was not replaced with zero.",
      );
    }
    setLoading(false);
  }, [copy, isAr]);
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    adminService
      .getAllUsers()
      .then((rows) => setUsers(Array.isArray(rows) ? rows : []))
      .catch(() => setUsers([]));
    reportsService
      .list()
      .then((rows: any[]) =>
        setSavedMarketingReports(
          Array.isArray(rows)
            ? rows.filter(
                (row) =>
                  row.reportType === "sales" &&
                  row.data?.template === "marketing_daily",
              )
            : [],
        ),
      )
      .catch(() => setSavedMarketingReports([]));
  }, []);

  const reportRangeLabel =
    normalizedReportDate === normalizedReportEndDate
      ? normalizedReportDate
      : `${reportPeriodStart} — ${reportPeriodEnd}`;
  // لكل مصدر تاريخ عمل واحد؛ لا يسمح createdAt/updatedAt/deliveryDate بتسريب السجلات للفترة.
  const rowMatchesDate = (
    row: any,
    kind:
      | "production"
      | "sale"
      | "collection"
      | "transaction"
      | "movement"
      | "general" = "general",
  ) =>
    inReportPeriod(
      rowForReportPeriod(row, kind),
      kind,
      reportPeriodStart,
      reportPeriodEnd,
    );
  const reportKindByDataKey: Record<
    string,
    | "production"
    | "sale"
    | "collection"
    | "transaction"
    | "movement"
    | "general"
  > = {
    production: "production",
    sales: "sale",
    collection: "collection",
    ordersVisits: "transaction",
    tracking: "general",
    warehouseMovements: "movement",
    warehouseStock: "general",
  };
  const filtered = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(data).map(([key, rows]) => [
          key,
          sortReportRows(
            rows.filter((row) =>
              rowMatchesDate(row, reportKindByDataKey[key] || "general"),
            ),
            reportKindByDataKey[key] || "general",
          ),
        ]),
      ),
    [data, reportPeriodStart, reportPeriodEnd],
  );
  const userById = useMemo(
    () => new Map(users.map((item) => [String(item.id), item])),
    [users],
  );
  const recordedBy = (row: any) => {
    const userId = row?.userId ?? row?.createdBy ?? row?.enteredBy;
    const account =
      userId !== undefined && userId !== null
        ? userById.get(String(userId))
        : undefined;
    if (account)
      return `${isAr ? "الاسم" : "Name"}: ${account.name || "—"} | ${isAr ? "الرقم" : "ID"}: ${account.id}${account.phone ? ` | ${isAr ? "الجوال" : "Phone"}: ${account.phone}` : ""} | ${isAr ? "الوظيفة" : "Job"}: ${account.position || account.department || (isAr ? "غير محددة" : "Not specified")}`;
    if (
      row?.dataEnteredBy ||
      row?.workerName ||
      row?.sellerName ||
      row?.collectorName
    )
      return String(
        row.dataEnteredBy ||
          row.workerName ||
          row.sellerName ||
          row.collectorName,
      );
    return userId !== undefined && userId !== null
      ? `${isAr ? "رقم المستخدم" : "User ID"}: ${userId} | ${isAr ? "الاسم والوظيفة غير متاحين" : "Name and job unavailable"}`
      : isAr
        ? "غير محدد"
        : "Not specified";
  };
  const stageLabel = (value: unknown) => {
    const raw = String(value || copy("مرحلة غير محددة", "Unspecified stage"));
    if (isAr) return raw;
    const labels: Record<string, string> = {
      الإنتاج: "Production",
      المكائن: "Machines",
      الروسو: "Rosso",
      القلب: "Qalb",
      الكاوية: "Ironing",
      الفحص: "Inspection",
      "مانع الانزلاق": "Anti-slip",
      التغليف: "Packing",
      التخزين: "Storage",
      "التخزين والمستودعات — إنتاج تام":
        "Storage and warehouses — finished goods",
      "مرحلة غير محددة": "Unspecified stage",
    };
    return labels[raw] || raw;
  };
  const reportSourceLabel = (value: unknown) => {
    const raw = String(value || "");
    if (isAr) return raw;
    return (
      {
        "مبيعات أداء المندوب": "Representative performance sales",
        "سجل المبيعات السابق": "Legacy sales register",
        "تحصيل أداء المندوب": "Representative performance collections",
        "سجل التحصيل السابق": "Legacy collections register",
        "طلبات وزيارات أداء المندوب": "Representative orders and visits",
        "الطلبات والزيارات السابقة": "Legacy orders and visits",
        "دفتر إنتاج تام": "Finished-goods ledger",
      }[raw] || raw
    );
  };
  const movementLabel = (value: unknown) => {
    const raw = String(value || "");
    if (isAr) return raw;
    return (
      {
        "مواد خام": "Raw materials",
        "صرف مواد": "Materials issued",
        "مواد واردة": "Incoming materials",
        "دخول إنتاج تام": "Finished-goods receipt",
        "رصيد مستودع حالي": "Current warehouse balance",
        "حركة مستودع": "Warehouse movement",
      }[raw] || raw
    );
  };
  const transactionTypeLabel = (value: unknown) => {
    const raw = String(value || "").toLowerCase();
    if (raw === "order" || raw === "طلب") return copy("طلب", "Order");
    if (raw === "visit" || raw === "زيارة") return copy("زيارة", "Visit");
    if (raw === "custom" || raw === "تصنيع خاص")
      return copy("تصنيع خاص", "Custom manufacturing");
    if (raw === "sample" || raw === "عينة") return copy("عينة", "Sample");
    if (raw === "return" || raw === "مرتجع") return copy("مرتجع", "Return");
    return copy("حركة مندوب", "Representative activity");
  };
  const transactionStatus = (status: unknown, type?: string) => {
    if (isAr) return transactionStatusLabel(status, type);
    if (type === "visit") return "Visit recorded — information only";
    const raw = String(status || "");
    return (
      {
        DRAFT: "Draft",
        RECORDED: "Recorded",
        PENDING_SALES_APPROVAL: "Pending sales manager approval",
        REJECTED_SALES: "Rejected by sales",
        PENDING_WAREHOUSE_ISSUE: "Approved — pending warehouse issue",
        WAREHOUSE_EXECUTED: "Fulfilled",
        WAREHOUSE_PARTIAL: "Partially fulfilled",
        WAREHOUSE_NOT_EXECUTED: "Not fulfilled",
        WAREHOUSE_NOT_AVAILABLE: "Unavailable",
        PENDING_REPRESENTATIVE_REPLY: "Pending representative reply",
        REPRESENTATIVE_REPLIED: "Representative replied — pending fulfilment",
        REPRESENTATIVE_CLOSED: "Closed by representative",
        CLOSED: "Closed",
        CLOSED_REJECTED: "Closed — rejected",
      }[raw] ||
      raw ||
      "No status recorded"
    );
  };
  const visitReportText = (value: unknown) => {
    if (isAr) return visitText(value);
    if (value == null || value === "") return "—";
    let data: any = value;
    if (typeof value === "string") {
      try {
        data = JSON.parse(value);
      } catch {
        return value;
      }
    }
    if (!data || typeof data !== "object") return String(value);
    const action =
      (
        {
          follow_up: "Follow-up",
          product_presentation: "Product presentation",
          product_offer: "Product offer",
          presentation: "Product presentation",
        } as Record<string, string>
      )[data.action] ||
      data.action ||
      "";
    return (
      [action, data.notes ?? data.report ?? data.observations]
        .filter(Boolean)
        .join(" — ") || "—"
    );
  };
  // الإنتاج من سجلات الإنتاج فقط؛ الدفعات المرتبطة V2 لا تضيف إنتاجاً ثانياً.
  const productionSummary = useMemo(
    () => productionMetrics(filtered.production),
    [filtered.production],
  );
  const productionPairsEquivalent = productionSummary.totalPairs;
  const productionDozen = Math.trunc(productionPairsEquivalent / 12);
  const productionPairs = productionPairsEquivalent % 12;
  const firstGradePairs = productionSummary.firstPairs;
  const secondGradePairs = productionSummary.secondPairs;
  const totalYarnUsed = productionSummary.yarnGrams;
  const totalNeedlesUsed = productionSummary.needlesUsed;
  const needlesRecorded = filtered.production.some(
    (row: any) =>
      row.needlesUsed !== null &&
      row.needlesUsed !== undefined &&
      row.needlesUsed !== "",
  );
  const wasteThread = productionSummary.wasteThreadGrams;
  const wasteSocks = productionSummary.wasteSocksGrams;
  const wasteNeedles = productionSummary.wasteNeedles;
  const waste = wasteThread + wasteSocks;
  const totalWastePercentage =
    productionSummary.wastePercent === null
      ? null
      : productionSummary.wastePercent.toFixed(2);
  const productionOnlyWorkMinutes = (() => {
    const segments = new Map<string, { date: string; minutes: number }>();
    filtered.production.forEach((row: any) => {
      const date = rowBusinessDate(row, "production") || "unknown";
      const machine = String(row.machineNumber || row.machineId || "unknown");
      const shift = String(
        row.shiftNumber || row.shiftStart || row.shiftEnd || "unknown",
      );
      const duration =
        Math.min(
          24,
          Math.max(0, Math.floor(numberValue(row.productionHours))),
        ) *
          60 +
        Math.min(
          59,
          Math.max(0, Math.floor(numberValue(row.productionMinutes))),
        );
      const key = `${date}|${machine}|${shift}`;
      const current = segments.get(key);
      if (!current || duration > current.minutes)
        segments.set(key, { date, minutes: duration });
    });
    const byDate = new Map<string, number>();
    segments.forEach(({ date, minutes }) =>
      byDate.set(date, (byDate.get(date) || 0) + minutes),
    );
    return Array.from(byDate.values()).reduce(
      (sum, minutes) => sum + Math.min(24 * 60, minutes),
      0,
    );
  })();
  const antiSlip = filtered.manufacturing.filter((row) =>
    /مانع|anti.?slip/i.test(String(row.stageName || row.productType || "")),
  );
  const salesTotal = filtered.sales.reduce(
    (sum, row) => sum + numberValue(row.amount),
    0,
  );
  const collectionTotal = filtered.collection.reduce(
    (sum, row) => sum + numberValue(row.amount),
    0,
  );
  // الإنتاج هو مصدر الكمية الوحيد. قد يحتوي الانتقال صفاً للتسليم وصفاً للاستلام؛
  // ندمجهما قبل الجمع حتى لا تتضاعف الكمية في التقرير.
  const productionIds = useMemo(
    () => new Set(data.production.map((row: any) => String(row.id))),
    [data.production],
  );
  const allHandovers = useMemo(
    () =>
      canonicalizeHandovers(
        data.tracking.filter(
          (row: any) =>
            row.productionId !== null &&
            row.productionId !== undefined &&
            productionIds.has(String(row.productionId)),
        ),
      ),
    [data.tracking, productionIds],
  );
  const handovers = useMemo(
    () =>
      canonicalizeHandovers(
        filtered.tracking.filter(
          (row: any) =>
            row.productionId !== null &&
            row.productionId !== undefined &&
            productionIds.has(String(row.productionId)),
        ),
      ),
    [filtered.tracking, productionIds],
  );
  const delivered = handovers.filter((row) => row.deliveredBy);
  const received = handovers.filter((row) => row.receivedBy);
  const pending = handovers.filter((row) => row.deliveredBy && !row.receivedAt);
  const remaining = handovers.filter(
    (row) =>
      numberValue(row.shortageDozen) * 12 + numberValue(row.shortagePairs) >
        0 && row.handoverStatus === "delivered",
  );
  const remainingPairs = remaining.reduce(
    (sum, row) =>
      sum +
      numberValue(row.shortageDozen) * 12 +
      numberValue(row.shortagePairs),
    0,
  );
  const receivedQuantityPairs = handovers
    .filter((row) => row.receivedBy)
    .reduce((sum, row) => sum + handoverPairs(row), 0);
  const rawDeliveredQuantityPairs = handovers
    .filter((row) => row.deliveredBy)
    .reduce((sum, row) => sum + deliveredHandoverPairs(row), 0);
  const deliveredQuantityPairs = rawDeliveredQuantityPairs;
  const quantityDifferencePairs =
    deliveredQuantityPairs - receivedQuantityPairs;
  // مراحل التحويل: sender=previousStage وreceiver=receiverStage؛ لا نحسب التحويل الواحد مرتين.
  const stageSummary = useMemo(() => {
    const summary = new Map<
      string,
      { previous: number; received: number; delivered: number; records: number }
    >();
    const add = (
      stage: unknown,
      field: "previous" | "received" | "delivered",
      pairs: number,
      records = 0,
    ) => {
      if (!Number.isFinite(pairs)) return;
      const key = String(stage || copy("مرحلة غير محددة", "Unspecified stage"));
      const item = summary.get(key) || {
        previous: 0,
        received: 0,
        delivered: 0,
        records: 0,
      };
      item[field] += pairs;
      item.records += records;
      summary.set(key, item);
    };
    const startDate = reportPeriodStart;
    allHandovers.forEach((row: any) => {
      const occurred = handoverBusinessDate(row);
      const outstanding = shortagePairs(row);
      if (
        startDate &&
        occurred &&
        occurred < startDate &&
        Number.isFinite(outstanding) &&
        outstanding !== 0
      )
        add(
          row.receiverStage ||
            row.currentStage ||
            row.previousStage ||
            row.stageName,
          "previous",
          outstanding,
        );
    });
    handovers.forEach((row: any) => {
      if (row.deliveredBy)
        add(
          row.previousStage || row.currentStage || row.stageName,
          "delivered",
          deliveredHandoverPairs(row),
          1,
        );
      if (row.receivedBy)
        add(
          row.receiverStage || row.currentStage || row.stageName,
          "received",
          handoverPairs(row),
          row.deliveredBy ? 0 : 1,
        );
    });
    return Array.from(summary.entries()).map(([stage, item]) => ({
      stage,
      ...item,
      available: item.previous + item.received,
      remaining: item.previous + item.received - item.delivered,
      difference: item.delivered - (item.previous + item.received),
    }));
  }, [allHandovers, handovers, reportPeriodStart, copy]);
  // مدة كل مرحلة = وقت بدايتها إلى وقت إنجازها. التداخل لا يلغي مدة أي مرحلة؛
  // لأن المطلوب قياس وقت العمل المستغرق داخل كل مرحلة ثم جمعه للتكلفة الزمنية الكلية.
  const stageDurationSummary = useMemo(() => {
    const summary = new Map<
      string,
      { minutes: number; records: number; seen: Set<string> }
    >();
    filtered.manufacturing.forEach((row: any) => {
      const stage = String(
        row.stageName || copy("مرحلة غير محددة", "Unspecified stage"),
      );
      const startValue = row.stageStartedAt || row.receivedAt || row.createdAt;
      const endValue = row.stageCompletedAt || row.movementAt;
      const start = startValue ? new Date(String(startValue)).getTime() : NaN;
      const end = endValue ? new Date(String(endValue)).getTime() : NaN;
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start)
        return;
      const identity = `${row.productionId || row.id}|${stage}|${start}|${end}`;
      const item = summary.get(stage) || {
        minutes: 0,
        records: 0,
        seen: new Set<string>(),
      };
      if (!item.seen.has(identity)) {
        item.seen.add(identity);
        item.minutes += Math.floor((end - start) / 60000);
        item.records += 1;
      }
      summary.set(stage, item);
    });
    return Array.from(summary.entries()).map(([stage, item]) => ({
      stage,
      minutes: item.minutes,
      records: item.records,
    }));
  }, [filtered.manufacturing, copy]);
  const stageWorkMinutes = stageDurationSummary.reduce(
    (sum, item) => sum + item.minutes,
    0,
  );
  const productionWorkMinutes = productionOnlyWorkMinutes + stageWorkMinutes;
  const stageCounts = filtered.manufacturing.reduce<Record<string, number>>(
    (acc, row) => {
      const stage = String(row.stageName || "مرحلة غير محددة");
      acc[stage] =
        (acc[stage] || 0) +
        numberValue(row.quantityDozen) * 12 +
        numberValue(row.quantityPair);
      return acc;
    },
    {},
  );
  const employeeSummary = useMemo(() => {
    const summary: Record<
      string,
      {
        delivered: number;
        received: number;
        deliveredPairs: number;
        receivedPairs: number;
        remainingPairs: number;
        differencePairs: number;
      }
    > = {};
    handovers.forEach((row) => {
      if (row.deliveredBy) {
        const item =
          summary[String(row.deliveredBy)] ||
          (summary[String(row.deliveredBy)] = {
            delivered: 0,
            received: 0,
            deliveredPairs: 0,
            receivedPairs: 0,
            remainingPairs: 0,
            differencePairs: 0,
          });
        item.delivered += 1;
        item.deliveredPairs += deliveredHandoverPairs(row);
        item.remainingPairs += shortagePairs(row);
      }
      if (row.receivedBy) {
        const item =
          summary[String(row.receivedBy)] ||
          (summary[String(row.receivedBy)] = {
            delivered: 0,
            received: 0,
            deliveredPairs: 0,
            receivedPairs: 0,
            remainingPairs: 0,
            differencePairs: 0,
          });
        item.received += 1;
        item.receivedPairs += handoverPairs(row);
      }
    });
    Object.values(summary).forEach((item) => {
      item.differencePairs = item.deliveredPairs - item.receivedPairs;
    });
    return Object.entries(summary).sort(([a], [b]) => a.localeCompare(b, "ar"));
  }, [handovers]);
  const filteredEmployeeSummary = useMemo(
    () =>
      employeeSummary.filter(
        ([, item]) =>
          differenceFilter === "all" ||
          (differenceFilter === "positive"
            ? item.differencePairs > 0
            : item.differencePairs < 0),
      ),
    [employeeSummary, differenceFilter],
  );
  const positiveDifferenceRows = employeeSummary.filter(
    ([, item]) => item.differencePairs > 0,
  );
  // التقرير قراءة فقط؛ لا ينشئ تنبيهات أو يعدل بيانات بمجرد فتحه.

  const representativeTransactions = useMemo(
    () =>
      sortReportRows(
        representativeReport.transactions.filter((row) =>
          rowMatchesDate(row, "transaction"),
        ),
        "transaction",
      ),
    [
      representativeReport.transactions,
      reportPeriodStart,
      reportPeriodEnd,
    ],
  );
  const representativeCollections = useMemo(
    () =>
      sortReportRows(
        representativeReport.collections.filter((row) =>
          rowMatchesDate(row, "collection"),
        ),
        "collection",
      ),
    [
      representativeReport.collections,
      reportPeriodStart,
      reportPeriodEnd,
    ],
  );
  const representativeSales = useMemo(
    () =>
      sortReportRows(
        representativeReport.sales.filter((row) => rowMatchesDate(row, "sale")),
        "sale",
      ),
    [
      representativeReport.sales,
      reportPeriodStart,
      reportPeriodEnd,
    ],
  );
  // التخزين والمستودعات — إنتاج تام: دفتر الحركة فقط، لا تكرار لسجلات التخزين كحركة ثانية.
  const warehouseSummary = useMemo(
    () =>
      warehousePeriod({
        movements: data.warehouseMovements || [],
        stock: data.warehouseStock || [],
        startDate: reportPeriodStart,
        endDate: reportPeriodEnd,
      }),
    [
      data.warehouseMovements,
      data.warehouseStock,
      reportPeriodStart,
      reportPeriodEnd,
    ],
  );
  const warehouseMovements = useMemo(
    () => sortReportRows(warehouseSummary.movements, "movement"),
    [warehouseSummary.movements],
  );
  const commercial = useMemo(
    () =>
      commercialReport({
        sales: representativeSales,
        legacySales: data.sales || [],
        collections: representativeCollections,
        legacyCollections: data.collection || [],
        transactions: representativeTransactions,
        legacyTransactions: data.ordersVisits || [],
        startDate: reportPeriodStart,
        endDate: reportPeriodEnd,
      }),
    [
      representativeSales,
      data.sales,
      representativeCollections,
      data.collection,
      representativeTransactions,
      data.ordersVisits,
      reportPeriodStart,
      reportPeriodEnd,
    ],
  );
  const reportSalesRows = useMemo(
    () => sortReportRows(commercial.salesRows, "sale"),
    [commercial.salesRows],
  );
  const reportSalesAmount = commercial.salesAmount;
  const reportCollectionRows = useMemo(
    () => sortReportRows(commercial.collectionRows, "collection"),
    [commercial.collectionRows],
  );
  const reportCollectionAmount = commercial.collectionAmount;
  const reportOrderRows = useMemo(
    () => sortReportRows(commercial.orderRows, "transaction"),
    [commercial.orderRows],
  );
  const reportVisitRows = useMemo(
    () => sortReportRows(commercial.visitRows, "transaction"),
    [commercial.visitRows],
  );
  const reportOtherTransactionRows = useMemo(
    () => sortReportRows(commercial.otherTransactionRows, "transaction"),
    [commercial.otherTransactionRows],
  );
  const commercialSourceErrors = [
    sourceErrors.representativeSales,
    sourceErrors.sales,
    sourceErrors.representativeCollections,
    sourceErrors.collection,
    sourceErrors.representativeTransactions,
  ].filter(Boolean);
  const commercialDataComplete = commercialSourceErrors.length === 0;
  const custodyCalculation = useMemo<{
    report: CustodyReport | null;
    error: string;
  }>(() => {
    if (!custodySource) return { report: null, error: "" };
    try {
      return {
        report: buildCustodyReport({
          batches: custodySource.batches,
          accounts: custodySource.accounts,
          settings: custodySource.settings,
          filters: {
            startDate: reportPeriodStart,
            endDate: reportPeriodEnd,
          },
        }),
        error: "",
      };
    } catch (error) {
      return {
        report: null,
        error:
          error instanceof Error ? error.message : "تعذر حساب تفاصيل العهد",
      };
    }
  }, [custodySource, reportPeriodStart, reportPeriodEnd]);
  const custodyReport = custodyCalculation.report;

  const marketingRows = useMemo(() => {
    const names = new Set<string>();
    [
      ...filtered.sales,
      ...filtered.collection,
      ...filtered.ordersVisits,
    ].forEach((row: any) => {
      const name = row.sellerName || row.collectorName || row.dataEnteredBy;
      if (name) names.add(String(name));
    });
    users
      .filter((account) =>
        ["sales", "marketing", "sales_manager"].includes(
          String(account.department || "").toLowerCase(),
        ),
      )
      .forEach((account) => names.add(account.name || account.username));
    if (!names.size) names.add(isAr ? "إدارة المبيعات" : "Sales department");
    return Array.from(names).map((name) => {
      const sales = reportSalesRows.filter(
        (row: any) =>
          String(
            row.representativeName ||
              row.sellerName ||
              row.salesRepName ||
              row.dataEnteredBy ||
              "",
          ) === name,
      );
      const collections = reportCollectionRows.filter(
        (row: any) =>
          String(
            row.representativeName ||
              row.collectorName ||
              row.dataEnteredBy ||
              "",
          ) === name,
      );
      const newCustomers = sales.filter((row: any) =>
        /new|جديد/i.test(String(row.customerType || row.customerStatus || "")),
      ).length;
      return {
        name,
        cashSales: sales
          .filter((row: any) =>
            /cash|نقد/i.test(String(row.paymentMethod || row.saleType || "")),
          )
          .reduce((sum: number, row: any) => sum + numberValue(row.amount), 0),
        creditSales: sales
          .filter((row: any) =>
            /credit|آجل|اجل/i.test(
              String(row.paymentMethod || row.saleType || ""),
            ),
          )
          .reduce((sum: number, row: any) => sum + numberValue(row.amount), 0),
        collection: collections.reduce(
          (sum: number, row: any) => sum + numberValue(row.amount),
          0,
        ),
        newCustomers,
        customerCategory:
          sales.find((row: any) => row.customerCategory || row.customerType)
            ?.customerCategory ||
          sales.find((row: any) => row.customerType)?.customerType ||
          "—",
        notes:
          sales
            .map((row: any) => row.notes || row.observations)
            .filter(Boolean)
            .join("؛ ") || "—",
      };
    });
  }, [
    reportSalesRows,
    reportCollectionRows,
    filtered.ordersVisits,
    users,
    isAr,
  ]);

  const comprehensiveDepartments = useMemo(
    () => [
      {
        key: "production",
        label: isAr ? "الإنتاج" : "Production",
        count: filtered.production.length,
        value: `${productionDozen} ${isAr ? "درزن" : "dozen"}`,
        icon: "precision-manufacturing",
      },
      {
        key: "manufacturing",
        label: isAr ? "مراحل التصنيع" : "Manufacturing stages",
        count: filtered.manufacturing.length,
        value: `${stageSummary.length} ${isAr ? "مراحل" : "stages"}`,
        icon: "account-tree",
      },
      {
        key: "tracking",
        label: isAr ? "التسليم والاستلام" : "Handovers",
        count: filtered.tracking.length,
        value: `${pending.length} ${isAr ? "معلق" : "pending"}`,
        icon: "swap-horiz",
      },
      {
        key: "sales",
        label: isAr ? "المبيعات والطلبات" : "Sales and orders",
        count: reportSalesRows.length,
        value: `${reportSalesAmount.toLocaleString()} ${isAr ? "ر.س" : "SAR"}`,
        icon: "point-of-sale",
      },
      {
        key: "collection",
        label: isAr ? "التحصيل" : "Collections",
        count: reportCollectionRows.length,
        value: `${reportCollectionAmount.toLocaleString()} ${isAr ? "ر.س" : "SAR"}`,
        icon: "payments",
      },
      {
        key: "warehouse",
        label: isAr ? "المستودعات" : "Warehouses",
        count: warehouseMovements.length,
        value: warehouseSummary.closingPairs === null
          ? (isAr ? "رصيد الفترة يحتاج مراجعة" : "Period balance needs review")
          : quantityLabel(warehouseSummary.closingPairs, isAr),
        icon: "inventory-2",
      },
      {
        key: "customers",
        label: isAr
          ? "أداء المندوبين والعملاء"
          : "Representatives and customers",
        count:
          representativeTransactions.length + representativeCollections.length,
        value: `${Array.isArray(representativeReport.summary?.representatives) ? representativeReport.summary.representatives.length : 0} ${isAr ? "مندوب" : "reps"}`,
        icon: "groups",
      },
      {
        key: "tasks",
        label: isAr ? "المهام والأعمال الإدارية" : "Tasks and administration",
        count: filtered.tasks.length + filtered.administrative.length,
        value: `${filtered.tasks.filter((row: any) => row.result === "completed").length} ${isAr ? "مكتمل" : "completed"}`,
        icon: "checklist",
      },
      {
        key: "maintenance",
        label: isAr ? "الصيانة" : "Maintenance",
        count: filtered.maintenance.length,
        value: `${filtered.maintenance.filter((row: any) => /stopped|متوقف/i.test(String(row.status || row.type || ""))).length} ${isAr ? "متوقف" : "stopped"}`,
        icon: "build",
      },
      {
        key: "finance",
        label: isAr ? "المالية والتكاليف" : "Finance and costs",
        count:
          filtered.expenses.length +
          filtered.financialReports.length +
          filtered.localCosts.length +
          filtered.savedProductCosts.length,
        value: `${filtered.expenses.reduce((sum: number, row: any) => sum + numberValue(row.amount), 0).toLocaleString()} ${isAr ? "ر.س مصروفات" : "SAR expenses"}`,
        icon: "account-balance",
      },
      {
        key: "meetings",
        label: isAr ? "الاجتماعات والمخرجات" : "Meetings and outputs",
        count: filtered.meetings.length + filtered.meetingOutputs.length,
        value: `${filtered.meetingOutputs.length} ${isAr ? "مخرج" : "outputs"}`,
        icon: "groups",
      },
      {
        key: "products",
        label: isAr ? "المنتجات والعطاءات" : "Products and tenders",
        count: filtered.products.length + filtered.tenders.length,
        value: `${filtered.products.length} ${isAr ? "منتج" : "products"}`,
        icon: "category",
      },
    ],
    [
      isAr,
      filtered,
      productionDozen,
      stageSummary.length,
      pending.length,
      reportSalesRows.length,
      reportSalesAmount,
      reportCollectionRows.length,
      reportCollectionAmount,
      warehouseMovements.length,
      warehouseSummary.closingPairs,
      representativeTransactions.length,
      representativeCollections.length,
      representativeReport.summary,
    ],
  );
  const representativePerformanceRows = useMemo(() => {
    const summaryRows = Array.isArray(
      representativeReport.summary?.representatives,
    )
      ? representativeReport.summary.representatives
      : [];
    const byId = new Map<
      string,
      {
        name: string;
        orders: number;
        visits: number;
        custom: number;
        samples: number;
        collections: number;
        collected: number;
        score: number;
      }
    >();
    summaryRows.forEach((row: any) =>
      byId.set(String(row.representative?.id), {
        name: row.representative?.name || copy("غير محدد", "Not specified"),
        orders: 0,
        visits: 0,
        custom: 0,
        samples: 0,
        collections: 0,
        collected: 0,
        score: Number(row.score || 0),
      }),
    );
    representativeTransactions.forEach((row: any) => {
      const key = String(
        row.representativeId ||
          row.representative?.id ||
          row.representativeName ||
          "unknown",
      );
      const item = byId.get(key) || {
        name: row.representativeName || copy("غير محدد", "Not specified"),
        orders: 0,
        visits: 0,
        custom: 0,
        samples: 0,
        collections: 0,
        collected: 0,
        score: 0,
      };
      if (row.transactionType === "order") item.orders += 1;
      if (row.transactionType === "visit") item.visits += 1;
      if (row.transactionType === "custom") item.custom += 1;
      if (row.transactionType === "sample") item.samples += 1;
      byId.set(key, item);
    });
    representativeCollections.forEach((row: any) => {
      const key = String(
        row.representativeId || row.representativeName || "unknown",
      );
      const item = byId.get(key) || {
        name: row.representativeName || copy("غير محدد", "Not specified"),
        orders: 0,
        visits: 0,
        custom: 0,
        samples: 0,
        collections: 0,
        collected: 0,
        score: 0,
      };
      item.collections += 1;
      item.collected += numberValue(row.collectedAmount || row.amount);
      byId.set(key, item);
    });
    return Array.from(byId.values()).filter(
      (row) =>
        row.orders ||
        row.visits ||
        row.custom ||
        row.samples ||
        row.collections,
    );
  }, [
    representativeReport,
    representativeTransactions,
    representativeCollections,
    copy,
  ]);

  const saveMarketingReport = async () => {
    if (!user?.id) return;
    setSavingMarketingReport(true);
    try {
      const marketingActivities = filtered.ordersVisits
        .filter((row: any) => row.customerStatus === "visit")
        .map((row: any) => ({
          customerName: row.customerName,
          representative: row.salesRepName,
          activity: row.visitReport,
          date: row.date,
        }));
      const returns = filtered.ordersVisits
        .filter((row: any) => row.customerStatus === "return")
        .map((row: any) => ({
          customerName: row.customerName,
          representative: row.salesRepName,
          quantity: row.orderItems?.reduce(
            (sum: number, item: any) => sum + numberValue(item.quantity),
            0,
          ),
          reason: row.visitReport,
          date: row.date,
        }));
      await reportsService.create({
        reportName: `التقرير اليومي لإدارة التسويق والمبيعات - ${reportRangeLabel}`,
        reportType: "sales",
        startDate: reportDate,
        endDate: reportEndDate,
        generatedBy: Number(user.id),
        data: {
          template: "marketing_daily",
          department: "sales",
          reportDate,
          reportStartDate: reportDate,
          reportEndDate,
          representatives: marketingRows,
          otherSales: reportSalesRows.filter(
            (row: any) => !row.representativeName && !row.sellerName,
          ),
          manufacturingOrders: filtered.manufacturing.map((row: any) => ({
            productName: row.productName,
            customerName: row.customerName,
            quantity: row.quantityPair ?? row.quantityDozen,
            sellerName: row.sellerName,
            manufacturingDate: row.date,
            deliveryDate: row.deliveryDate,
            notes: row.notes,
          })),
          marketingActivities,
          returns,
          notes: marketingNotes,
          createdByName: user.name || user.username || "",
        },
      });
      const rows = await reportsService.list();
      setSavedMarketingReports(
        Array.isArray(rows)
          ? rows.filter(
              (row: any) =>
                row.reportType === "sales" &&
                row.data?.template === "marketing_daily",
            )
          : [],
      );
      Alert.alert(
        isAr ? "تم حفظ التقرير اليومي" : "Daily report saved",
        isAr
          ? "تم حفظ تقرير إدارة التسويق والمبيعات لهذا التاريخ."
          : "The marketing and sales daily report was saved for this date.",
      );
    } catch (cause: any) {
      Alert.alert(
        isAr ? "تعذر حفظ التقرير" : "Report save failed",
        cause?.message || "",
      );
    } finally {
      setSavingMarketingReport(false);
    }
  };

  const print = () => {
    if (Platform.OS !== "web" || typeof window === "undefined") {
      Alert.alert(
        copy("الطباعة من الويب", "Web printing"),
        copy(
          "افتح نسخة الويب لطباعة التقرير",
          "Open the web version to print the report",
        ),
      );
      return;
    }
    const cell = (value: unknown) =>
      escapeHtml(
        value === null || value === undefined || value === "" ? "—" : value,
      );
    const formatAmount = (value: number) =>
      value.toLocaleString(english ? "en-US" : "ar-SA");
    const detailSection = (
      title: string,
      rows: any[],
      columns: Array<[string, (row: any) => unknown]>,
    ) =>
      `<h2>${escapeHtml(title)} <small>(${rows.length} ${copy("سجل", "record(s)")})</small></h2><table><thead><tr>${columns.map(([label]) => `<th>${escapeHtml(label)}</th>`).join("")}</tr></thead><tbody>${rows.length ? rows.map((row) => `<tr>${columns.map(([, getter]) => `<td>${cell(getter(row))}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${columns.length}">${copy("لا توجد بيانات مسجلة في نطاق التقرير", "No data recorded in the report range")}</td></tr>`}</tbody></table>`;
    const genericColumns: Array<[string, (row: any) => unknown]> = [
      [
        copy("البيان", "Description"),
        (row) =>
          row.productName ||
          row.name ||
          row.equipmentName ||
          row.expenseDetails ||
          row.taskDescription ||
          row.customerName ||
          row.stageName ||
          row.materialName ||
          row.materialType ||
          "—",
      ],
      [
        copy("التفاصيل/الكمية", "Details/quantity"),
        (row) =>
          row.quantityDozen ??
          row.quantityPair ??
          row.quantityPairs ??
          row.quantity ??
          row.amount ??
          row.productionDozen ??
          row.maintenanceDetails ??
          row.requestDetails ??
          "—",
      ],
      [
        copy("المسؤول/الحالة", "Responsible/status"),
        (row) =>
          row.deliveredBy ||
          row.receivedBy ||
          row.workerName ||
          row.sellerName ||
          row.collectorName ||
          row.dataEnteredBy ||
          row.status ||
          row.result ||
          row.notes ||
          "—",
      ],
      [copy("مسجل بواسطة", "Recorded by"), (row) => recordedBy(row)],
      [
        copy("التاريخ والوقت", "Date and time"),
        (row) =>
          displayTime(
            row.deliveredAt ||
              row.receivedAt ||
              row.maintenanceDate ||
              row.stopDate ||
              row.createdAt ||
              row.date ||
              row.invoiceDate ||
              row.receiptDate,
            isAr,
          ),
      ],
    ];
    const handoverColumns: Array<[string, (row: any) => unknown]> = [
      [copy("اسم المنتج", "Product"), (row) => row.productName],
      [
        copy("اللون", "Color"),
        (row) => row.productColor || copy("غير محدد", "Not specified"),
      ],
      [
        copy("المقاس", "Size"),
        (row) => row.productSize || copy("غير محدد", "Not specified"),
      ],
      [
        copy("المرحلة السابقة", "Previous stage"),
        (row) => stageLabel(row.previousStage),
      ],
      [
        copy("المرحلة الحالية", "Current stage"),
        (row) => stageLabel(row.currentStage),
      ],
      [copy("المسلّم", "Delivered by"), (row) => row.deliveredBy],
      [
        copy("المستلم", "Received by"),
        (row) => row.receivedBy || copy("بانتظار الاستلام", "Awaiting receipt"),
      ],
      [
        copy("الكمية", "Quantity"),
        (row) => quantityLabel(handoverPairs(row), isAr),
      ],
      [
        copy("وقت التسليم", "Delivery time"),
        (row) => displayTime(row.deliveredAt, isAr),
      ],
      [
        copy("وقت الاستلام", "Receipt time"),
        (row) => displayTime(row.receivedAt, isAr),
      ],
    ];
    const salesColumns: Array<[string, (row: any) => unknown]> = [
      [copy("المصدر", "Source"), (row) => reportSourceLabel(row.reportSource)],
      [
        copy("مرجع الفاتورة", "Invoice reference"),
        (row) => row.invoiceNumber || row.referenceCode,
      ],
      [copy("العميل", "Customer"), (row) => customerDetail(row, isAr)],
      [
        copy("المندوب/البائع", "Representative/seller"),
        (row) => row.representativeName || row.sellerName || "—",
      ],
      [
        copy("تاريخ الفاتورة", "Invoice date"),
        (row) => row.invoiceDate || row.saleDate || row.date,
      ],
      [
        copy("المبلغ", "Amount"),
        (row) => formatAmount(numberValue(row.amount)),
      ],
      [
        copy("المرفقات", "Attachments"),
        (row) => attachmentLabel(row.attachments, isAr),
      ],
    ];
    const transactionColumns: Array<[string, (row: any) => unknown]> = [
      [copy("المرجع", "Reference"), (row) => row.referenceCode],
      [
        copy("النوع", "Type"),
        (row) => transactionTypeLabel(row.transactionType),
      ],
      [
        copy("العميل وبياناته", "Customer details"),
        (row) => customerDetail(row, isAr),
      ],
      [
        copy("المندوب", "Representative"),
        (row) => row.representativeName || "—",
      ],
      [
        copy("الحالة", "Status"),
        (row) => transactionStatus(row.status, row.transactionType),
      ],
      [
        copy("تاريخ الطلب/الزيارة", "Order/visit date"),
        (row) => row.orderDate || row.visitDate || row.date,
      ],
      [
        copy("التقرير أو الملاحظة", "Report or note"),
        (row) =>
          visitReportText(
            row.transactionType === "visit"
              ? row.visitReport || row.visitNotes || row.notes
              : row.notes,
          ),
      ],
      [
        copy("الأصناف", "Items"),
        (row) => transactionItemsLabel(row.items || row.orderItems, isAr),
      ],
      [
        copy("المرفقات", "Attachments"),
        (row) => attachmentLabel(row.attachments, isAr),
      ],
    ];
    const collectionColumns: Array<[string, (row: any) => unknown]> = [
      [copy("المصدر", "Source"), (row) => reportSourceLabel(row.reportSource)],
      [
        copy("السند/المرجع", "Receipt/reference"),
        (row) => row.receiptNumber || row.referenceCode,
      ],
      [copy("العميل", "Customer"), (row) => customerDetail(row, isAr)],
      [
        copy("المندوب", "Representative"),
        (row) => row.representativeName || row.collectorName || "—",
      ],
      [
        copy("تاريخ التحصيل", "Collection date"),
        (row) => row.collectionDate || row.date,
      ],
      [
        copy("طريقة التحصيل", "Collection method"),
        (row) =>
          row.collectionMethod === "cash"
            ? copy("نقدي", "Cash")
            : row.collectionMethod === "transfer"
              ? copy("تحويل", "Transfer")
              : "—",
      ],
      [
        copy("المبلغ المحصل", "Collected amount"),
        (row) => formatAmount(numberValue(row.collectedAmount ?? row.amount)),
      ],
      [
        copy("المتبقي", "Remaining"),
        (row) =>
          row.remainingAmount == null
            ? copy("غير مرتبط بفواتير", "Not linked to invoices")
            : formatAmount(numberValue(row.remainingAmount)),
      ],
      [copy("الملاحظات", "Notes"), (row) => visitReportText(row.notes)],
    ];
    const stageRows = stageSummary
      .map(
        (item) =>
          `<tr><td>${cell(stageLabel(item.stage))}</td><td>${item.records}</td><td>${cell(quantityLabel(item.received, isAr))}</td><td>${cell(quantityLabel(item.previous, isAr))}</td><td>${cell(quantityLabel(item.available, isAr))}</td><td>${cell(quantityLabel(item.delivered, isAr))}</td><td>${cell(quantityLabel(item.remaining, isAr))}</td></tr>`,
      )
      .join("");
    const custodyPrintBody = custodyReport
      ? (
          reportPrintHtml(custodyReport).match(
            /<body[^>]*>([\s\S]*)<\/body>/i,
          )?.[1] || ""
        ).replace(/<script[\s\S]*?<\/script>/gi, "")
      : `<p class="notice">${escapeHtml(custodyCalculation.error || custodyError || copy("لم يكتمل تحميل مصدر العهد؛ لم يعرض التقرير صفراً بديلاً.", "The custody source did not finish loading; no zero replacement was displayed."))}</p>`;
    const sourceErrorPrintNotice = Object.keys(sourceErrors).length
      ? `<p class="notice">${escapeHtml(
          `${copy("مصادر لم يكتمل تحميلها", "Sources not fully loaded")}: ${Object.entries(
            sourceErrors,
          )
            .map(([source, message]) => `${source}: ${message}`)
            .join(" — ")}`,
        )}</p>`
      : "";
    const win = window.open("", "_blank", "width=1600,height=1000");
    if (!win) return;
    const title = copy(
      "التقرير الشامل الكامل — مصنع السلطان",
      "Complete Comprehensive Report — Sultan Factory",
    );
    const reportRange = reportRangeLabel;
    win.document.write(
      `<!doctype html><html dir="${direction}"><head><meta charset="utf-8"><title>${title}</title><style>@page{size:landscape;margin:10mm}body{font-family:Arial,sans-serif;padding:22px;color:#17202a;direction:${direction};text-align:${textAlign}}h1,h2{text-align:${textAlign};color:#0a7ea4}h2 small{font-size:12px;color:#64748b}.cards{display:flex;gap:8px;flex-wrap:wrap}.card{border:1px solid #b8c7cc;padding:10px;min-width:130px;border-radius:6px}table{width:100%;border-collapse:collapse;margin:10px 0 22px;font-size:10px}th,td{border:1px solid #b8c7cc;padding:5px;text-align:${textAlign};vertical-align:top}th{background:#0a7ea4;color:#fff}tr:nth-child(even){background:#f2f8fa}.notice{background:#fff4e5;padding:10px;border:1px solid #f0c36d}@media print{button{display:none}h2{break-after:avoid}table{break-inside:auto}tr{break-inside:avoid}}</style></head><body><h1>${title}</h1><p>${copy("نطاق التقرير", "Report range")}: ${cell(reportRange)} — ${copy("تم إنشاء التقرير", "Report generated")}: ${cell(new Date().toLocaleString(english ? "en-US" : "ar-SA", { timeZone: REPORT_TIME_ZONE }))}</p>${sourceErrorPrintNotice}<div class="cards"><div class="card">${copy("الإنتاج", "Production")}: ${quantityLabel(productionPairsEquivalent, isAr)}</div><div class="card">${copy("النخب الأول", "First grade")}: ${quantityLabel(firstGradePairs, isAr)}</div><div class="card">${copy("النخب الثاني", "Second grade")}: ${quantityLabel(secondGradePairs, isAr)}</div><div class="card">${copy("الهدر", "Waste")}: ${totalWastePercentage === null ? copy("غير محسوب", "Not calculated") : `${totalWastePercentage}%`}</div><div class="card">${copy("مدة الإنجاز", "Work duration")}: ${escapeHtml(elapsedLabel(productionWorkMinutes, isAr))}</div><div class="card">${copy("التسليم", "Deliveries")}: ${delivered.length}</div><div class="card">${copy("الاستلام", "Receipts")}: ${received.length}</div></div><h2>${copy("مراحل التصنيع", "Manufacturing stages")}</h2><table><thead><tr><th>${copy("المرحلة", "Stage")}</th><th>${copy("عدد الحركات", "Movement count")}</th><th>${copy("المستلم", "Received")}</th><th>${copy("الرصيد السابق", "Previous balance")}</th><th>${copy("المتاح", "Available")}</th><th>${copy("المسلّم", "Delivered")}</th><th>${copy("المتبقي", "Remaining")}</th></tr></thead><tbody>${stageRows || `<tr><td colspan="7">${copy("لا توجد بيانات مراحل", "No stage data")}</td></tr>`}</tbody></table>${detailSection(copy("تفاصيل التسليم والاستلام", "Delivery and receipt details"), handovers, handoverColumns)}${detailSection(copy("الإنتاج والمكائن والهدر والإبر", "Production, machines, waste and needles"), filtered.production, genericColumns)}${detailSection(copy("حركة المستودعات", "Warehouse movements"), warehouseMovements, genericColumns)}${detailSection(copy("تفاصيل فواتير المبيعات", "Sales invoice details"), reportSalesRows, salesColumns)}${detailSection(copy("تفاصيل الطلبات", "Order details"), reportOrderRows, transactionColumns)}${detailSection(copy("تفاصيل الزيارات", "Visit details"), reportVisitRows, transactionColumns)}${detailSection(copy("حركات المندوب الأخرى", "Other representative activities"), reportOtherTransactionRows, transactionColumns)}${detailSection(copy("تفاصيل التحصيل", "Collection details"), reportCollectionRows, collectionColumns)}${detailSection(copy("المصروفات", "Expenses"), filtered.expenses, genericColumns)}${detailSection(copy("الصيانة", "Maintenance"), filtered.maintenance, genericColumns)}${detailSection(copy("المهام", "Tasks"), filtered.tasks, genericColumns)}${detailSection(copy("الإجراءات الإدارية والمرفقات", "Administrative actions and attachments"), filtered.administrative, genericColumns)}${detailSection(copy("الاجتماعات ومخرجاتها", "Meetings and outputs"), [...filtered.meetings, ...filtered.meetingOutputs], genericColumns)}${detailSection(copy("التقارير المالية", "Financial reports"), filtered.financialReports, genericColumns)}${detailSection(copy("دليل المنتجات", "Product catalogue"), filtered.products, genericColumns)}<h2>${copy("الاستلام والتسليم والعهد — بيانات الدورة الجديدة", "Receipt, delivery and custody — new cycle data")}</h2>${custodyPrintBody}<script>window.onload=()=>window.print()</script></body></html>`,
    );
    win.document.close();
  };

  return (
    <ScreenContainer style={{ backgroundColor: colors.background, direction }}>
      <View
        style={{
          backgroundColor: colors.primary,
          padding: 15,
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        <BackButton />
        <View
          style={{
            flex: 1,
            alignItems: contentAlignment,
            marginHorizontal: 12,
          }}
        >
          <Text style={{ color: "#fff", fontSize: 19, fontWeight: "800" }}>
            {isAr ? "ملخص اليوم الشامل" : "Comprehensive Daily Summary"}
          </Text>
          <Text style={{ color: "#E0F2FE", fontSize: 11, marginTop: 3 }}>
            {isAr ? "كل ما حدث في المصنع بالتفصيل" : "Everything recorded"}
          </Text>
        </View>
        <MaterialIcons name="summarize" size={30} color="#fff" />
      </View>
      <ScrollView
        style={{ direction }}
        contentContainerStyle={{ padding: 14, paddingBottom: 40 }}
      >
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 14,
            padding: 12,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Text
            style={{
              color: colors.foreground,
              fontWeight: "800",
              textAlign,
              marginBottom: 7,
            }}
          >
            {isAr ? "نطاق تاريخ التقرير" : "Report date range"}
          </Text>
          <View style={{ flexDirection: rowDirection, gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: colors.muted,
                  fontSize: 10,
                  textAlign,
                  marginBottom: 3,
                }}
              >
                {isAr ? "من تاريخ" : "From"}
              </Text>
              <DateField
                value={reportDate}
                accessibilityLabel={isAr ? "من تاريخ" : "From date"}
                onChange={(value) => {
                  setReportDate(value);
                }}
                isAr={isAr}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: colors.muted,
                  fontSize: 10,
                  textAlign,
                  marginBottom: 3,
                }}
              >
                {isAr ? "إلى تاريخ" : "To"}
              </Text>
              <DateField
                value={reportEndDate}
                accessibilityLabel={isAr ? "إلى تاريخ" : "To date"}
                onChange={(value) => {
                  setReportEndDate(value);
                }}
                isAr={isAr}
              />
            </View>
          </View>
          {reportRangeIsReversed ? (
            <Text
              accessibilityRole="alert"
              style={{
                color: "#9a3412",
                fontSize: 11,
                fontWeight: "700",
                textAlign,
                marginTop: 8,
              }}
            >
              {isAr
                ? `تم عكس نطاق التاريخ تلقائياً للعرض: من ${reportPeriodStart} إلى ${reportPeriodEnd}.`
                : `The reversed date range is displayed as ${reportPeriodStart} through ${reportPeriodEnd}.`}
            </Text>
          ) : null}
          <View
            style={{
              flexDirection: rowDirection,
              flexWrap: "wrap",
              gap: 8,
              marginTop: 9,
            }}
          >
            <TouchableOpacity
              onPress={() => applyDatePreset("day")}
              style={{
                flex: 1,
                minWidth: "22%",
                backgroundColor:
                  reportDate === reportEndDate
                    ? colors.primary
                    : colors.background,
                borderRadius: 9,
                padding: 9,
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  color:
                    reportDate === reportEndDate
                      ? "#fff"
                      : colors.foreground,
                  fontWeight: "700",
                  fontSize: 11,
                }}
              >
                {isAr ? "يوم واحد" : "1 day"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => applyDatePreset("twoDays")}
              style={{
                flex: 1,
                minWidth: "22%",
                backgroundColor:
                  reportDate !== reportEndDate &&
                  reportDate ===
                    (() => {
                      const d = new Date(`${reportEndDate}T12:00:00`);
                      d.setDate(d.getDate() - 1);
                      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                    })()
                    ? colors.primary
                    : colors.background,
                borderRadius: 9,
                padding: 9,
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  color: colors.foreground,
                  fontWeight: "700",
                  fontSize: 11,
                }}
              >
                {isAr ? "يومان" : "2 days"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => applyDatePreset("week")}
              style={{
                flex: 1,
                minWidth: "22%",
                backgroundColor: colors.background,
                borderRadius: 9,
                padding: 9,
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  color: colors.foreground,
                  fontWeight: "700",
                  fontSize: 11,
                }}
              >
                {isAr ? "أسبوع" : "Week"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => applyDatePreset("month")}
              style={{
                flex: 1,
                minWidth: "22%",
                backgroundColor: colors.background,
                borderRadius: 9,
                padding: 9,
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  color: colors.foreground,
                  fontWeight: "700",
                  fontSize: 11,
                }}
              >
                {isAr ? "شهر" : "Month"}
              </Text>
            </TouchableOpacity>
          </View>
          {canExportPdf ? (
            <TouchableOpacity
              onPress={print}
              accessibilityLabel={
                isAr ? "طباعة التقرير الشامل" : "Print comprehensive report"
              }
              style={{
                backgroundColor: "#0f766e",
                borderRadius: 9,
                padding: 10,
                alignItems: "center",
                marginTop: 9,
                flexDirection: rowDirection,
                justifyContent: "center",
                gap: 7,
              }}
            >
              <MaterialIcons name="print" size={19} color="#fff" />
              <Text style={{ color: "#fff", fontWeight: "800" }}>
                {isAr
                  ? "طباعة / تصدير التقرير الشامل"
                  : "Print / Export comprehensive report"}
              </Text>
            </TouchableOpacity>
          ) : (
            <Text
              style={{
                color: colors.muted,
                fontSize: 11,
                textAlign,
                marginTop: 10,
              }}
            >
              {isAr
                ? "تصدير PDF متاح لمدير النظام فقط"
                : "PDF export is available to the system administrator only"}
            </Text>
          )}
          <TouchableOpacity
            onPress={() => router.push("/product-tracking")}
            style={{
              backgroundColor: "#1d4ed8",
              borderRadius: 9,
              padding: 10,
              alignItems: "center",
              marginTop: 8,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "800" }}>
              {isAr
                ? "فتح تقرير التسليم والاستلام التفصيلي"
                : "Open detailed delivery and receipt report"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={load}
            style={{
              borderWidth: 1,
              borderColor: colors.primary,
              borderRadius: 9,
              padding: 9,
              alignItems: "center",
              marginTop: 8,
            }}
          >
            <Text
              style={{ color: colors.primary, fontWeight: "700", fontSize: 11 }}
            >
              {isAr ? "تحديث البيانات" : "Refresh data"}
            </Text>
          </TouchableOpacity>
        </View>
        {canManageMarketingDaily && (
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 14,
              padding: 13,
              borderWidth: 1,
              borderColor: colors.border,
              marginTop: 12,
            }}
          >
            <Text
              style={{
                color: colors.foreground,
                fontSize: 16,
                fontWeight: "800",
                textAlign,
              }}
            >
              {isAr
                ? "التقرير اليومي لإدارة التسويق والمبيعات"
                : "Marketing and Sales Daily Report"}
            </Text>
            <Text
              style={{
                color: colors.muted,
                fontSize: 11,
                textAlign,
                marginTop: 5,
              }}
            >
              {isAr
                ? `نموذج التقرير المعتمد — ${reportRangeLabel}`
                : `Approved daily report template — ${reportDate}`}
            </Text>
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 8,
                marginTop: 10,
              }}
            >
              {[
                [
                  isAr ? "المبيعات النقدية" : "Cash sales",
                  marketingRows.reduce((sum, row) => sum + row.cashSales, 0),
                ],
                [
                  isAr ? "المبيعات الآجلة" : "Credit sales",
                  marketingRows.reduce((sum, row) => sum + row.creditSales, 0),
                ],
                [
                  isAr ? "التحصيل" : "Collection",
                  marketingRows.reduce((sum, row) => sum + row.collection, 0),
                ],
                [
                  isAr ? "العملاء الجدد" : "New customers",
                  marketingRows.reduce((sum, row) => sum + row.newCustomers, 0),
                ],
              ].map(([label, value]) => (
                <View
                  key={String(label)}
                  style={{
                    flex: 1,
                    minWidth: "22%",
                    padding: 9,
                    borderRadius: 9,
                    backgroundColor: colors.background,
                    borderWidth: 1,
                    borderColor: colors.border,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ color: colors.muted, fontSize: 10 }}>
                    {String(label)}
                  </Text>
                  <Text
                    style={{
                      color: colors.primary,
                      fontWeight: "800",
                      marginTop: 4,
                    }}
                  >
                    {String(value)}
                  </Text>
                </View>
              ))}
            </View>
            <Text
              style={{
                color: colors.foreground,
                fontWeight: "800",
                textAlign,
                marginTop: 13,
              }}
            >
              {isAr ? "كشف المندوبين" : "Representatives"}
            </Text>
            {marketingRows.map((row) => (
              <View
                key={row.name}
                style={{
                  borderTopWidth: 1,
                  borderColor: colors.border,
                  paddingVertical: 9,
                  marginTop: 6,
                }}
              >
                <Text
                  style={{
                    color: colors.foreground,
                    fontWeight: "800",
                    textAlign,
                  }}
                >
                  {row.name}
                </Text>
                <Text
                  style={{
                    color: colors.muted,
                    fontSize: 10,
                    textAlign,
                    marginTop: 3,
                  }}
                >
                  {isAr
                    ? `نقدي: ${row.cashSales} | آجل: ${row.creditSales} | تحصيل: ${row.collection} | عملاء جدد: ${row.newCustomers} | الفئة: ${row.customerCategory}`
                    : `Cash: ${row.cashSales} | Credit: ${row.creditSales} | Collection: ${row.collection} | New customers: ${row.newCustomers} | Category: ${row.customerCategory}`}
                </Text>
                <Text
                  style={{
                    color: colors.muted,
                    fontSize: 10,
                    textAlign,
                    marginTop: 3,
                  }}
                >
                  {isAr ? `ملاحظات: ${row.notes}` : `Notes: ${row.notes}`}
                </Text>
              </View>
            ))}
            <Text
              style={{
                color: colors.foreground,
                fontWeight: "800",
                textAlign,
                marginTop: 12,
              }}
            >
              {isAr
                ? "أوامر التصنيع والمرتجعات والتسويق"
                : "Manufacturing orders, returns and marketing"}
            </Text>
            <Text
              style={{
                color: colors.muted,
                fontSize: 10,
                textAlign,
                marginTop: 4,
              }}
            >
              {isAr
                ? `أوامر التصنيع: ${filtered.manufacturing.length} | الزيارات والأنشطة: ${filtered.ordersVisits.filter((row: any) => row.customerStatus === "visit").length} | المرتجعات المسجلة: ${filtered.ordersVisits.filter((row: any) => row.customerStatus === "return").length}`
                : `Manufacturing orders: ${filtered.manufacturing.length} | Visits and activities: ${filtered.ordersVisits.filter((row: any) => row.customerStatus === "visit").length} | Returns: ${filtered.ordersVisits.filter((row: any) => row.customerStatus === "return").length}`}
            </Text>
            <TextInput
              value={marketingNotes}
              onChangeText={setMarketingNotes}
              placeholder={copy("ملاحظات التقرير", "Report notes")}
              placeholderTextColor={colors.muted}
              multiline
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 9,
                padding: 9,
                color: colors.foreground,
                textAlign,
                minHeight: 55,
                marginTop: 9,
              }}
            />
            <TouchableOpacity
              onPress={saveMarketingReport}
              disabled={savingMarketingReport}
              style={{
                backgroundColor: savingMarketingReport
                  ? colors.muted
                  : "#0f766e",
                borderRadius: 9,
                padding: 10,
                alignItems: "center",
                marginTop: 9,
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "800" }}>
                {savingMarketingReport
                  ? isAr
                    ? "جارٍ الحفظ..."
                    : "Saving..."
                  : isAr
                    ? "حفظ التقرير اليومي"
                    : "Save daily report"}
              </Text>
            </TouchableOpacity>
            {savedMarketingReports.slice(0, 10).map((report) => (
              <View
                key={String(report.id)}
                style={{
                  borderTopWidth: 1,
                  borderColor: colors.border,
                  marginTop: 9,
                  paddingTop: 8,
                }}
              >
                <Text
                  style={{
                    color: colors.foreground,
                    fontWeight: "700",
                    textAlign,
                  }}
                >
                  {report.reportName}
                </Text>
                <Text
                  style={{
                    color: colors.muted,
                    fontSize: 10,
                    textAlign,
                    marginTop: 3,
                  }}
                >
                  {isAr
                    ? `محفوظ بتاريخ ${report.startDate} بواسطة ${report.data?.createdByName || "—"}`
                    : `Saved ${report.startDate} by ${report.data?.createdByName || "—"}`}
                </Text>
              </View>
            ))}
          </View>
        )}
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 14,
            padding: 13,
            borderWidth: 1,
            borderColor: colors.border,
            marginTop: 12,
          }}
        >
          <Text
            style={{
              color: colors.foreground,
              fontSize: 17,
              fontWeight: "900",
              textAlign,
            }}
          >
            {isAr
              ? "التقرير الإداري الشامل — جميع الإدارات"
              : "Comprehensive management report — all departments"}
          </Text>
          <Text
            style={{
              color: colors.muted,
              fontSize: 11,
              textAlign,
              marginTop: 5,
            }}
          >
            {isAr
              ? `ملخص موحّد لكل ما سُجّل في الفترة: ${reportRangeLabel}. التفاصيل الكاملة أسفل الملخص.`
              : `Unified summary for every record in the period: ${reportRangeLabel}. Full details follow.`}
          </Text>
          {loading ? (
            <View
              style={{
                marginTop: 16,
                paddingVertical: 18,
                alignItems: "center",
              }}
            >
              <ActivityIndicator size="small" color={colors.primary} />
              <Text
                style={{
                  color: colors.muted,
                  fontSize: 12,
                  fontWeight: "800",
                  marginTop: 8,
                }}
              >
                {isAr
                  ? "جارٍ تحميل بيانات جميع الإدارات..."
                  : "Loading all department data..."}
              </Text>
            </View>
          ) : (
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 8,
                marginTop: 11,
              }}
            >
              {comprehensiveDepartments.map((department) => (
                <View
                  key={department.key}
                  style={{
                    flex: 1,
                    minWidth: 145,
                    backgroundColor: colors.background,
                    borderRadius: 10,
                    padding: 10,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <View
                    style={{
                      flexDirection: rowDirection,
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <MaterialIcons
                      name={department.icon as any}
                      size={19}
                      color={colors.primary}
                    />
                    <Text
                      style={{
                        flex: 1,
                        color: colors.foreground,
                        fontWeight: "800",
                        fontSize: 11,
                        textAlign,
                      }}
                    >
                      {department.label}
                    </Text>
                  </View>
                  <Text
                    style={{
                      color: colors.primary,
                      fontSize: 17,
                      fontWeight: "900",
                      textAlign,
                      marginTop: 6,
                    }}
                  >
                    {String(department.count)}
                  </Text>
                  <Text
                    style={{
                      color: colors.muted,
                      fontSize: 10,
                      textAlign,
                      marginTop: 2,
                    }}
                  >
                    {department.value}
                  </Text>
                </View>
              ))}
            </View>
          )}
          <Text
            style={{
              color: colors.muted,
              fontSize: 10,
              textAlign,
              marginTop: 10,
            }}
          >
            {isAr
              ? "كل رقم مرتبط بمصدره الحقيقي؛ عدم وجود نشاط يظهر كحالة مستقلة وليس كبيانات وهمية."
              : "Every number is linked to its real source; no activity is shown as a separate state, never as fabricated data."}
          </Text>
        </View>
        {Object.keys(sourceErrors).length > 0 && (
          <View
            accessibilityRole="alert"
            style={{
              backgroundColor: "#fff7ed",
              borderRadius: 12,
              padding: 11,
              borderWidth: 1,
              borderColor: "#fdba74",
              marginTop: 12,
            }}
          >
            <Text
              style={{
                color: "#9a3412",
                fontWeight: "800",
                textAlign,
              }}
            >
              {isAr ? "مصادر لم يكتمل تحميلها" : "Sources not fully loaded"}
            </Text>
            <Text
              style={{
                color: "#9a3412",
                fontSize: 10,
                textAlign,
                marginTop: 4,
              }}
            >
              {Object.entries(sourceErrors)
                .map(([source, message]) => `${source}: ${message}`)
                .join(" — ")}
            </Text>
          </View>
        )}
        {loading ? (
          <ActivityIndicator
            size="large"
            color={colors.primary}
            style={{ marginTop: 24 }}
          />
        ) : (
          <>
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 8,
                marginTop: 12,
              }}
            >
              {[
                [
                  isAr ? "الإنتاج" : "Production",
                  `${productionDozen} ${isAr ? "درزن" : "dozen"}`,
                  "factory",
                ],
                [
                  isAr ? "الأزواج المدخلة" : "Entered pairs",
                  productionPairs,
                  "inventory",
                ],
                [
                  isAr ? "إجمالي الأزواج" : "Total pairs",
                  productionPairsEquivalent,
                  "all-inbox",
                ],
                [
                  isAr ? "الخيوط المستخدمة" : "Yarn used",
                  `${totalYarnUsed.toFixed(2)} ${isAr ? "جم" : "g"}`,
                  "linear-scale",
                ],
                [
                  isAr ? "النخب الأول" : "First grade",
                  quantityLabel(firstGradePairs, isAr),
                  "grade",
                ],
                [
                  isAr ? "النخب الثاني" : "Second grade",
                  quantityLabel(secondGradePairs, isAr),
                  "grade",
                ],
                [
                  isAr ? "نسبة الهدر" : "Waste %",
                  totalWastePercentage === null
                    ? isAr
                      ? "غير محسوبة"
                      : "Not calculated"
                    : `${totalWastePercentage}%`,
                  "percent",
                ],
                [
                  isAr ? "الإبر المستخدمة" : "Needles used",
                  needlesRecorded
                    ? totalNeedlesUsed
                    : isAr
                      ? "غير مسجلة"
                      : "Not recorded",
                  "build",
                ],
                [
                  isAr ? "مدة الإنجاز" : "Work duration",
                  elapsedLabel(productionWorkMinutes, isAr),
                  "schedule",
                ],
                [
                  isAr ? "هدر الخيوط والجوارب" : "Yarn and sock waste",
                  `${waste} ${isAr ? "جرام" : "g"}`,
                  "warning",
                ],
                [
                  isAr ? "الإبر التالفة" : "Damaged needles",
                  wasteNeedles,
                  "build",
                ],
                [isAr ? "التسليم" : "Deliveries", delivered.length, "upload"],
                [isAr ? "الاستلام" : "Receipts", received.length, "download"],
                [isAr ? "معلق" : "Pending", pending.length, "pending-actions"],
                [
                  isAr ? "الكمية المتبقية" : "Remaining quantities",
                  `${remainingPairs} ${isAr ? "زوج" : "pairs"}`,
                  "inventory",
                ],
              ].map(([label, value, icon]) => (
                <View
                  key={String(label)}
                  style={{
                    flex: 1,
                    minWidth: "30%",
                    backgroundColor: colors.surface,
                    borderRadius: 10,
                    padding: 11,
                    alignItems: "center",
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <MaterialIcons
                    name={String(icon) as any}
                    size={20}
                    color={colors.primary}
                  />
                  <Text
                    style={{ color: colors.muted, fontSize: 10, marginTop: 4 }}
                  >
                    {String(label)}
                  </Text>
                  <Text
                    style={{
                      color: colors.foreground,
                      fontWeight: "800",
                      marginTop: 3,
                    }}
                  >
                    {String(value)}
                  </Text>
                </View>
              ))}
            </View>
            <View
              style={{
                backgroundColor: "#fff7ed",
                borderRadius: 14,
                padding: 13,
                borderWidth: 1,
                borderColor: "#fdba74",
                marginTop: 12,
              }}
            >
              <Text
                style={{
                  color: "#9a3412",
                  fontSize: 15,
                  fontWeight: "800",
                  textAlign,
                }}
              >
                {isAr
                  ? "الكمية المتبقية في مراحل التصنيع"
                  : "Remaining quantities in manufacturing stages"}
              </Text>
              <Text
                style={{
                  color: "#c2410c",
                  fontSize: 11,
                  textAlign,
                  marginTop: 7,
                }}
              >
                {isAr
                  ? `${remaining.length} سجل متبقٍ بإجمالي ${remainingPairs} زوج — تنتقل هذه البيانات تلقائياً عند التسليم الجزئي وتختفي بعد تسليم المتبقي.`
                  : `${remaining.length} remaining record(s), ${remainingPairs} pairs — automatically created after partial delivery and cleared when the remainder is delivered.`}
              </Text>
              {remaining.map((row) => (
                <Text
                  key={String(row.id)}
                  style={{
                    color: "#7c2d12",
                    fontSize: 10,
                    textAlign,
                    marginTop: 5,
                  }}
                >
                  {row.productName} | {row.currentStage || "—"} |{" "}
                  {row.productSize || "—"} | {row.productColor || "—"} |{" "}
                  {row.shortageDozen || 0} درزن + {row.shortagePairs || 0} زوج |{" "}
                  {row.deliveredBy || "—"}
                </Text>
              ))}
            </View>
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: 14,
                padding: 13,
                borderWidth: 1,
                borderColor: colors.border,
                marginTop: 12,
              }}
            >
              <Text
                style={{
                  color: colors.foreground,
                  fontSize: 15,
                  fontWeight: "800",
                  textAlign,
                }}
              >
                {isAr
                  ? "مراحل التصنيع — كل مرحلة مستقلة"
                  : "Manufacturing stages — separated"}
              </Text>
              {stageSummary.length ? (
                stageSummary.map((item) => (
                  <View
                    key={item.stage}
                    style={{
                      borderTopWidth: 1,
                      borderColor: colors.border,
                      paddingVertical: 8,
                      marginTop: 6,
                    }}
                  >
                    <Text
                      style={{
                        color: colors.foreground,
                        fontWeight: "800",
                        textAlign,
                      }}
                    >
                      {item.stage}
                    </Text>
                    <Text
                      style={{
                        color: colors.muted,
                        fontSize: 10,
                        textAlign,
                        marginTop: 3,
                      }}
                    >
                      {isAr
                        ? `الحركات: ${item.records} — الرصيد السابق: ${quantityLabel(item.previous, true)} — المستلم إليها في الفترة: ${quantityLabel(item.received, true)} — المتاح بعد الاستلام: ${quantityLabel(item.available, true)} — المسلّم منها: ${quantityLabel(item.delivered, true)} — المتبقي: ${quantityLabel(item.remaining, true)} — الفرق: ${signedQuantityLabel(item.difference, true)} — مدة المرحلة: ${elapsedLabel(stageDurationSummary.find((entry) => entry.stage === item.stage)?.minutes ?? null, true)}`
                        : `Movements: ${item.records} — Previous balance: ${quantityLabel(item.previous, false)} — Received in period: ${quantityLabel(item.received, false)} — Available after receipt: ${quantityLabel(item.available, false)} — Delivered: ${quantityLabel(item.delivered, false)} — Remaining: ${quantityLabel(item.remaining, false)} — Difference: ${signedQuantityLabel(item.difference, false)} — Stage duration: ${elapsedLabel(stageDurationSummary.find((entry) => entry.stage === item.stage)?.minutes ?? null, false)}`}
                    </Text>
                  </View>
                ))
              ) : (
                <Text
                  style={{
                    color: colors.muted,
                    textAlign,
                    marginTop: 8,
                  }}
                >
                  {isAr ? "لا توجد بيانات مراحل" : "No stage data"}
                </Text>
              )}
            </View>
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: 14,
                padding: 13,
                borderWidth: 1,
                borderColor: colors.border,
                marginTop: 12,
              }}
            >
              <Text
                style={{
                  color: colors.foreground,
                  fontSize: 15,
                  fontWeight: "800",
                  textAlign,
                }}
              >
                {isAr ? "المبيعات — فواتير فقط" : "Sales — invoices only"}
              </Text>
              {!commercialDataComplete && (
                <Text
                  accessibilityRole="alert"
                  style={{
                    color: colors.error,
                    fontSize: 11,
                    textAlign,
                    marginTop: 6,
                  }}
                >
                  {isAr
                    ? `بيانات تجارية غير مكتملة: ${commercialSourceErrors.join(" — ")}`
                    : `Commercial data is incomplete: ${commercialSourceErrors.join(" — ")}`}
                </Text>
              )}
              <Text
                style={{
                  color: colors.muted,
                  fontSize: 11,
                  textAlign,
                  marginTop: 6,
                }}
              >
                {isAr
                  ? `عدد الفواتير: ${reportSalesRows.length} — القيمة: ${reportSalesAmount.toLocaleString()} ريال. لا تدخل الطلبات أو الزيارات أو العينات في الإيراد.`
                  : `Invoices: ${reportSalesRows.length} — amount: ${reportSalesAmount.toLocaleString()} SAR. Orders, visits, and samples are not revenue.`}
              </Text>
              {reportSalesRows.map((row: any, index: number) => (
                <View
                  key={`sale-${row.reportSource}-${row.id ?? index}`}
                  style={{
                    borderTopWidth: 1,
                    borderColor: colors.border,
                    paddingVertical: 8,
                    marginTop: 7,
                  }}
                >
                  <Text
                    style={{
                      color: colors.foreground,
                      fontWeight: "800",
                      textAlign,
                    }}
                  >
                    {row.invoiceNumber ||
                      row.referenceCode ||
                      (isAr ? "فاتورة دون رقم" : "Invoice without number")}{" "}
                    — {numberValue(row.amount).toLocaleString()}{" "}
                    {isAr ? "ريال" : "SAR"}
                  </Text>
                  <Text
                    style={{
                      color: colors.muted,
                      fontSize: 10,
                      textAlign,
                      marginTop: 3,
                    }}
                  >
                    {customerDetail(row, isAr)} |{" "}
                    {isAr ? "المندوب" : "Representative"}:{" "}
                    {row.representativeName || row.sellerName || "—"} |{" "}
                    {isAr ? "التاريخ" : "Date"}:{" "}
                    {row.invoiceDate || row.saleDate || row.date || "—"}
                  </Text>
                  <Text
                    style={{
                      color: colors.muted,
                      fontSize: 10,
                      textAlign,
                      marginTop: 3,
                    }}
                  >
                    {isAr ? "المصدر" : "Source"}: {row.reportSource} |{" "}
                    {isAr ? "المرفقات" : "Attachments"}:{" "}
                    {attachmentLabel(row.attachments, isAr)}
                  </Text>
                </View>
              ))}
            </View>
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: 14,
                padding: 13,
                borderWidth: 1,
                borderColor: colors.border,
                marginTop: 12,
              }}
            >
              <Text
                style={{
                  color: colors.foreground,
                  fontSize: 15,
                  fontWeight: "800",
                  textAlign,
                }}
              >
                {isAr
                  ? "الطلبات والزيارات — تفاصيل الأداء"
                  : "Orders and visits — performance details"}
              </Text>
              <Text
                style={{
                  color: colors.muted,
                  fontSize: 11,
                  textAlign,
                  marginTop: 5,
                }}
              >
                {isAr
                  ? `طلبات: ${reportOrderRows.length} | زيارات: ${reportVisitRows.length}`
                  : `Orders: ${reportOrderRows.length} | Visits: ${reportVisitRows.length}`}
              </Text>
              {[
                ...reportOrderRows,
                ...reportVisitRows,
                ...reportOtherTransactionRows,
              ].map((row: any, index: number) => (
                <View
                  key={`activity-${row.reportSource}-${row.id ?? index}`}
                  style={{
                    borderTopWidth: 1,
                    borderColor: colors.border,
                    paddingVertical: 8,
                    marginTop: 7,
                  }}
                >
                  <Text
                    style={{
                      color: colors.foreground,
                      fontWeight: "800",
                      textAlign,
                    }}
                  >
                    {row.transactionType === "visit"
                      ? isAr
                        ? "زيارة"
                        : "Visit"
                      : row.transactionType === "order"
                        ? isAr
                          ? "طلب"
                          : "Order"
                        : isAr
                          ? "حركة مندوب"
                          : "Representative activity"}{" "}
                    — {row.referenceCode || "—"}
                  </Text>
                  <Text
                    style={{
                      color: colors.muted,
                      fontSize: 10,
                      textAlign,
                      marginTop: 3,
                    }}
                  >
                    {customerDetail(row, isAr)} |{" "}
                    {isAr ? "المندوب" : "Representative"}:{" "}
                    {row.representativeName || "—"} |{" "}
                    {isAr ? "التاريخ" : "Date"}:{" "}
                    {row.orderDate || row.visitDate || row.date || "—"}
                  </Text>
                  <Text
                    style={{
                      color: colors.muted,
                      fontSize: 10,
                      textAlign,
                      marginTop: 3,
                    }}
                  >
                    {isAr ? "الحالة" : "Status"}:{" "}
                    {transactionStatus(row.status, row.transactionType)} |{" "}
                    {isAr ? "التقرير" : "Report"}:{" "}
                    {row.transactionType === "visit"
                      ? visitText(
                          row.visitReport || row.visitNotes || row.notes,
                        )
                      : visitReportText(row.notes)}
                  </Text>
                  <Text
                    style={{
                      color: colors.muted,
                      fontSize: 10,
                      textAlign,
                      marginTop: 3,
                    }}
                  >
                    {isAr ? "الأصناف" : "Items"}:{" "}
                    {transactionItemsLabel(row.items || row.orderItems, isAr)}
                  </Text>
                  <Text
                    style={{
                      color: colors.muted,
                      fontSize: 10,
                      textAlign,
                      marginTop: 3,
                    }}
                  >
                    {isAr ? "المرفقات" : "Attachments"}:{" "}
                    {attachmentLabel(row.attachments, isAr)}
                  </Text>
                </View>
              ))}
            </View>
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: 14,
                padding: 13,
                borderWidth: 1,
                borderColor: colors.border,
                marginTop: 12,
              }}
            >
              <Text
                style={{
                  color: colors.foreground,
                  fontSize: 15,
                  fontWeight: "800",
                  textAlign,
                }}
              >
                {isAr ? "التحصيل" : "Collections"}
              </Text>
              <Text
                style={{
                  color: colors.muted,
                  fontSize: 11,
                  textAlign,
                  marginTop: 5,
                }}
              >
                {isAr
                  ? `عدد السندات: ${reportCollectionRows.length} — الإجمالي: ${reportCollectionAmount.toLocaleString()} ريال`
                  : `Receipts: ${reportCollectionRows.length} — total: ${reportCollectionAmount.toLocaleString()} SAR`}
              </Text>
              {reportCollectionRows.map((row: any, index: number) => (
                <View
                  key={`collection-${row.reportSource}-${row.id ?? index}`}
                  style={{
                    borderTopWidth: 1,
                    borderColor: colors.border,
                    paddingVertical: 8,
                    marginTop: 7,
                  }}
                >
                  <Text
                    style={{
                      color: colors.foreground,
                      fontWeight: "800",
                      textAlign,
                    }}
                  >
                    {row.receiptNumber ||
                      row.referenceCode ||
                      (isAr ? "سند دون رقم" : "Receipt without number")}{" "}
                    —{" "}
                    {numberValue(
                      row.collectedAmount ?? row.amount,
                    ).toLocaleString()}{" "}
                    {isAr ? "ريال" : "SAR"}
                  </Text>
                  <Text
                    style={{
                      color: colors.muted,
                      fontSize: 10,
                      textAlign,
                      marginTop: 3,
                    }}
                  >
                    {customerDetail(row, isAr)} |{" "}
                    {isAr ? "المندوب" : "Representative"}:{" "}
                    {row.representativeName || row.collectorName || "—"} |{" "}
                    {isAr ? "التاريخ" : "Date"}:{" "}
                    {row.collectionDate || row.date || "—"}
                  </Text>
                  <Text
                    style={{
                      color: colors.muted,
                      fontSize: 10,
                      textAlign,
                      marginTop: 3,
                    }}
                  >
                    {isAr ? "السابق" : "Previous"}:{" "}
                    {row.invoiceAmount == null
                      ? isAr
                        ? "غير مرتبط بفواتير"
                        : "Not linked to invoices"
                      : numberValue(row.invoiceAmount).toLocaleString()}{" "}
                    | {isAr ? "الباقي" : "Remaining"}:{" "}
                    {row.remainingAmount == null
                      ? isAr
                        ? "غير مرتبط بفواتير"
                        : "Not linked to invoices"
                      : numberValue(row.remainingAmount).toLocaleString()}{" "}
                    | {isAr ? "المرفقات" : "Attachments"}:{" "}
                    {attachmentLabel(row.attachments, isAr)}
                  </Text>
                </View>
              ))}
            </View>
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: 14,
                padding: 13,
                borderWidth: 1,
                borderColor: colors.border,
                marginTop: 12,
              }}
            >
              <Text
                style={{
                  color: colors.foreground,
                  fontSize: 15,
                  fontWeight: "800",
                  textAlign,
                }}
              >
                {isAr
                  ? "التخزين والمستودعات — إنتاج تام"
                  : "Storage and warehouses — finished goods"}
              </Text>
            </View>
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: 14,
                padding: 13,
                borderWidth: 1,
                borderColor: colors.border,
                marginTop: 12,
              }}
            >
              <Text
                style={{
                  color: colors.foreground,
                  fontSize: 15,
                  fontWeight: "800",
                  textAlign,
                }}
              >
                {isAr ? "رصيد نهاية الفترة المختارة" : "Selected-period closing balance"}
              </Text>
              <Text
                style={{
                  color: colors.muted,
                  fontSize: 11,
                  textAlign,
                  marginTop: 6,
                }}
              >
                {isAr
                  ? `دفتر الفترة: وارد ${quantityLabel(warehouseSummary.receiptPairs, true)} | صادر ${quantityLabel(warehouseSummary.issuePairs, true)} | صافي ${quantityLabel(warehouseSummary.netPairs, true)} | بداية ${warehouseSummary.openingPairs === null ? "تحتاج مراجعة" : quantityLabel(warehouseSummary.openingPairs, true)} | نهاية ${warehouseSummary.closingPairs === null ? "تحتاج مراجعة" : quantityLabel(warehouseSummary.closingPairs, true)}`
                  : `Ledger period: receipt ${quantityLabel(warehouseSummary.receiptPairs, false)} | issue ${quantityLabel(warehouseSummary.issuePairs, false)} | net ${quantityLabel(warehouseSummary.netPairs, false)}`}
              </Text>
              <Text
                style={{
                  color: colors.muted,
                  fontSize: 11,
                  textAlign,
                  marginTop: 6,
                }}
              >
                {isAr
                  ? `المعروض هنا دفتر الحركات من ${reportPeriodStart} إلى ${reportPeriodEnd} فقط؛ لا تُعرض أصناف أو حركات من تاريخ آخر.`
                  : `Only movements from ${reportPeriodStart} through ${reportPeriodEnd} are displayed; no records from other dates are included.`}
              </Text>
            </View>
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: 14,
                padding: 13,
                borderWidth: 1,
                borderColor: colors.border,
                marginTop: 12,
              }}
            >
              <Text
                style={{
                  color: colors.foreground,
                  fontSize: 15,
                  fontWeight: "800",
                  textAlign,
                }}
              >
                {isAr
                  ? "تفاصيل الإنتاج والخيوط والهدر"
                  : "Production, yarn and waste details"}
              </Text>
              <Text
                style={{
                  color: colors.muted,
                  fontSize: 11,
                  textAlign,
                  marginTop: 7,
                }}
              >
                {isAr
                  ? `إجمالي الأزواج: ${productionPairsEquivalent} | إجمالي الخيوط المستخدمة: ${totalYarnUsed.toFixed(2)} جم | نسبة الهدر: ${totalWastePercentage === null ? "غير محسوبة" : `${totalWastePercentage}%`} | الإبر المستخدمة: ${totalNeedlesUsed}`
                  : `Total pairs: ${productionPairsEquivalent} | Total yarn: ${totalYarnUsed.toFixed(2)} g | Waste: ${totalWastePercentage === null ? "Not calculated" : `${totalWastePercentage}%`} | Needles: ${totalNeedlesUsed}`}
              </Text>
            </View>
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: 14,
                padding: 13,
                borderWidth: 1,
                borderColor: colors.border,
                marginTop: 12,
              }}
            >
              <Text
                style={{
                  color: colors.foreground,
                  fontSize: 15,
                  fontWeight: "800",
                  textAlign,
                }}
              >
                {isAr
                  ? "مسؤولية الموظفين — ملخص الكميات"
                  : "Employee accountability — quantity summary"}
              </Text>
              <Text
                style={{
                  color: colors.muted,
                  fontSize: 11,
                  textAlign,
                  marginTop: 6,
                }}
              >
                {isAr
                  ? "المستلم = ما استلمه الموظف، المسلّم = ما سلّمه فعلياً، الفرق = المسلّم ناقص المستلم؛ وفي ملخص المرحلة يُخصم أيضًا الرصيد السابق. مقارنة الحركة وحدها ليست حكمًا على العهدة دون مراجعة رصيد البداية. الموجب باللون الأزرق يحتاج مراجعة لأنه يدل على زيادة، والسالب باللون الأحمر يدل على نقص، والمتبقي يظهر في أيقونة الكمية المتبقية."
                  : "Received is what the employee acknowledged; delivered is what was handed over; difference is delivered minus received; stage comparisons also account for the opening balance. Period activity alone is not proof of over-delivery. Blue positive values require review as an overage, red negative values indicate a shortage, and remaining quantities appear in Remaining Quantities."}
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  gap: 7,
                  flexWrap: "wrap",
                  marginTop: 10,
                }}
              >
                <TouchableOpacity
                  onPress={() => setDifferenceFilter("all")}
                  style={{
                    flex: 1,
                    minWidth: 95,
                    backgroundColor:
                      differenceFilter === "all"
                        ? colors.primary
                        : colors.background,
                    borderRadius: 8,
                    paddingVertical: 8,
                    alignItems: "center",
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Text
                    style={{
                      color:
                        differenceFilter === "all" ? "#fff" : colors.foreground,
                      fontWeight: "800",
                      fontSize: 11,
                    }}
                  >
                    {isAr ? "الكل" : "All"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setDifferenceFilter("positive")}
                  style={{
                    flex: 1,
                    minWidth: 95,
                    backgroundColor:
                      differenceFilter === "positive"
                        ? "#2563eb"
                        : colors.background,
                    borderRadius: 8,
                    paddingVertical: 8,
                    alignItems: "center",
                    borderWidth: 1,
                    borderColor: "#93c5fd",
                  }}
                >
                  <Text
                    style={{
                      color:
                        differenceFilter === "positive" ? "#fff" : "#1d4ed8",
                      fontWeight: "800",
                      fontSize: 11,
                    }}
                  >
                    {isAr ? "+ الزيادات" : "+ Overages"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setDifferenceFilter("negative")}
                  style={{
                    flex: 1,
                    minWidth: 95,
                    backgroundColor:
                      differenceFilter === "negative"
                        ? "#b91c1c"
                        : colors.background,
                    borderRadius: 8,
                    paddingVertical: 8,
                    alignItems: "center",
                    borderWidth: 1,
                    borderColor: "#fecaca",
                  }}
                >
                  <Text
                    style={{
                      color:
                        differenceFilter === "negative" ? "#fff" : "#b91c1c",
                      fontWeight: "800",
                      fontSize: 11,
                    }}
                  >
                    {isAr ? "− النواقص" : "− Shortages"}
                  </Text>
                </TouchableOpacity>
                {positiveDifferenceRows.length > 0 && (
                  <TouchableOpacity
                    onPress={() => router.push("/remaining-quantities")}
                    style={{
                      flex: 1,
                      minWidth: 190,
                      backgroundColor: "#eff6ff",
                      borderRadius: 8,
                      paddingVertical: 8,
                      alignItems: "center",
                      borderWidth: 1,
                      borderColor: "#93c5fd",
                    }}
                  >
                    <Text
                      style={{
                        color: "#1d4ed8",
                        fontWeight: "900",
                        fontSize: 11,
                      }}
                    >
                      {isAr
                        ? "مراجعة الكميات المتبقية للزيادات"
                        : "Review remaining quantities"}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: 8,
                  marginTop: 10,
                }}
              >
                <View
                  style={{
                    flex: 1,
                    minWidth: 130,
                    backgroundColor: "#eff6ff",
                    borderRadius: 10,
                    padding: 10,
                  }}
                >
                  <Text
                    style={{
                      color: "#1d4ed8",
                      fontWeight: "800",
                      textAlign,
                    }}
                  >
                    {isAr ? "إجمالي المستلم" : "Total received"}
                  </Text>
                  <Text
                    style={{
                      color: "#1e3a8a",
                      fontSize: 16,
                      fontWeight: "900",
                      textAlign,
                      marginTop: 4,
                    }}
                  >
                    {quantityLabel(receivedQuantityPairs, isAr)}
                  </Text>
                </View>
                <View
                  style={{
                    flex: 1,
                    minWidth: 130,
                    backgroundColor: "#f0fdf4",
                    borderRadius: 10,
                    padding: 10,
                  }}
                >
                  <Text
                    style={{
                      color: "#15803d",
                      fontWeight: "800",
                      textAlign,
                    }}
                  >
                    {isAr ? "إجمالي المسلّم" : "Total delivered"}
                  </Text>
                  <Text
                    style={{
                      color: "#166534",
                      fontSize: 16,
                      fontWeight: "900",
                      textAlign,
                      marginTop: 4,
                    }}
                  >
                    {quantityLabel(deliveredQuantityPairs, isAr)}
                  </Text>
                </View>
                <View
                  style={{
                    flex: 1,
                    minWidth: 130,
                    backgroundColor: "#fff7ed",
                    borderRadius: 10,
                    padding: 10,
                  }}
                >
                  <Text
                    style={{
                      color: "#c2410c",
                      fontWeight: "800",
                      textAlign,
                    }}
                  >
                    {isAr ? "إجمالي المتبقي" : "Total remaining"}
                  </Text>
                  <Text
                    style={{
                      color: "#9a3412",
                      fontSize: 16,
                      fontWeight: "900",
                      textAlign,
                      marginTop: 4,
                    }}
                  >
                    {quantityLabel(remainingPairs, isAr)}
                  </Text>
                </View>
                <View
                  style={{
                    flex: 1,
                    minWidth: 160,
                    backgroundColor:
                      quantityDifferencePairs > 0
                        ? "#eff6ff"
                        : quantityDifferencePairs < 0
                          ? "#fef2f2"
                          : "#f8fafc",
                    borderRadius: 10,
                    padding: 10,
                  }}
                >
                  <Text
                    style={{
                      color:
                        quantityDifferencePairs > 0
                          ? "#1d4ed8"
                          : quantityDifferencePairs < 0
                            ? "#b91c1c"
                            : colors.muted,
                      fontWeight: "800",
                      textAlign,
                    }}
                  >
                    {isAr
                      ? "فرق الاستلام والتسليم"
                      : "Receipt/delivery difference"}
                  </Text>
                  <Text
                    style={{
                      color:
                        quantityDifferencePairs > 0
                          ? "#1d4ed8"
                          : quantityDifferencePairs < 0
                            ? "#b91c1c"
                            : colors.muted,
                      fontSize: 16,
                      fontWeight: "900",
                      textAlign,
                      marginTop: 4,
                    }}
                  >
                    {signedQuantityLabel(quantityDifferencePairs, isAr)}
                  </Text>
                </View>
              </View>
              {filteredEmployeeSummary.length ? (
                filteredEmployeeSummary.map(([name, item]) => (
                  <View
                    key={name}
                    style={{
                      borderTopWidth: 1,
                      borderColor: colors.border,
                      paddingVertical: 8,
                      marginTop: 6,
                    }}
                  >
                    <Text
                      style={{
                        color: colors.foreground,
                        fontWeight: "800",
                        textAlign,
                      }}
                    >
                      {name}
                    </Text>
                    <Text
                      style={{
                        color: colors.muted,
                        fontSize: 10,
                        textAlign,
                        marginTop: 3,
                      }}
                    >
                      {isAr
                        ? `المستلم: ${quantityLabel(item.receivedPairs, true)} — المسلّم: ${quantityLabel(item.deliveredPairs, true)} — الفرق: ${signedQuantityLabel(item.differencePairs, true)} — المتبقي: ${quantityLabel(item.remainingPairs, true)}`
                        : `Received: ${quantityLabel(item.receivedPairs, false)} — Delivered: ${quantityLabel(item.deliveredPairs, false)} — Difference: ${signedQuantityLabel(item.differencePairs, false)} — Remaining: ${quantityLabel(item.remainingPairs, false)}`}
                    </Text>
                  </View>
                ))
              ) : (
                <Text
                  style={{
                    color: colors.muted,
                    textAlign,
                    marginTop: 8,
                    textAlignVertical: "center",
                  }}
                >
                  {isAr
                    ? "لا توجد نتائج مطابقة للفلتر ضمن نطاق التقرير"
                    : "No results match the selected filter"}
                </Text>
              )}
            </View>
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: 14,
                padding: 13,
                borderWidth: 1,
                borderColor: colors.border,
                marginTop: 12,
              }}
            >
              <Text
                style={{
                  color: colors.foreground,
                  fontSize: 15,
                  fontWeight: "800",
                  textAlign,
                }}
              >
                {isAr
                  ? "تفاصيل التسليم والاستلام"
                  : "Delivery and receipt details"}
              </Text>
              {handovers.length ? (
                handovers.map((row) => (
                  <View
                    key={String(row.id)}
                    style={{
                      borderTopWidth: 1,
                      borderColor: colors.border,
                      paddingVertical: 8,
                      marginTop: 7,
                    }}
                  >
                    <Text
                      style={{
                        color: colors.foreground,
                        fontWeight: "700",
                        textAlign,
                      }}
                    >
                      {row.productName ||
                        (isAr ? "منتج غير محدد" : "Unspecified product")}
                    </Text>
                    <Text
                      style={{
                        color: colors.muted,
                        fontSize: 10,
                        textAlign,
                        marginTop: 3,
                      }}
                    >
                      {isAr ? "المسلّم" : "Delivered by"}:{" "}
                      {row.deliveredBy || "-"} |{" "}
                      {isAr ? "المستلم" : "Received by"}:{" "}
                      {row.receivedBy ||
                        (isAr ? "بانتظار التوقيع" : "Awaiting signature")}
                    </Text>
                    <Text
                      style={{
                        color: row.receivedAt ? "#16a34a" : "#d97706",
                        fontSize: 10,
                        textAlign,
                        marginTop: 3,
                      }}
                    >
                      {isAr ? "وقت التسليم" : "Delivery time"}:{" "}
                      {displayTime(row.deliveredAt, isAr)} |{" "}
                      {isAr ? "وقت الاستلام" : "Receipt time"}:{" "}
                      {displayTime(row.receivedAt, isAr)}
                    </Text>
                  </View>
                ))
              ) : (
                <Text
                  style={{
                    color: colors.muted,
                    textAlign,
                    marginTop: 9,
                  }}
                >
                  {isAr
                    ? "لا توجد حركات ضمن نطاق التقرير"
                    : "No movements in the report range"}
                </Text>
              )}
            </View>
            <View style={{ marginTop: 18 }}>
              <Text
                style={{
                  color: colors.foreground,
                  fontSize: 16,
                  fontWeight: "900",
                  textAlign,
                }}
              >
                {isAr
                  ? "العهد — دورة جديدة مستقلة"
                  : "Custody — independent new cycle"}
              </Text>
              <Text
                style={{
                  color: colors.muted,
                  fontSize: 11,
                  textAlign,
                  marginTop: 4,
                }}
              >
                {isAr
                  ? "صفر حركات هذه الدورة لا يعني أن الإنتاج العام صفر؛ الإنتاج التشغيلي المعروض أعلاه محفوظ من مصدره ولا يُضاف هنا مرة ثانية."
                  : "Zero movements in this new cycle do not mean overall production is zero; the operational production above remains sourced independently and is not counted here again."}
              </Text>
              {custodyCalculation.error ? (
                <Text
                  accessibilityRole="alert"
                  style={{ color: "#b91c1c", textAlign, paddingVertical: 8 }}
                >
                  {isAr
                    ? `تعذر حساب قسم العهد: ${custodyCalculation.error}. بقية التقرير متاحة؛ يمكنك تغيير التاريخ والمحاولة مجددًا.`
                    : `The custody section could not be calculated: ${custodyCalculation.error}. The remaining report is available; change the date and try again.`}
                </Text>
              ) : null}
              <CustodySummaryPanel
                startDate={reportPeriodStart}
                endDate={reportPeriodEnd}
              />
            </View>
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
