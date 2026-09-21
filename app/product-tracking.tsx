import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { DateField } from "@/components/date-field";
import { ScreenContainer } from "@/components/screen-container";
import { BackButton } from "@/components/back-button";
import { useColors } from "@/hooks/use-colors";
import { useLanguage } from "@/lib/language-context";
import { useAuth } from "@/lib/auth-context";
import { productionService, manufacturingService, productTrackingService, productsService, employeePerformanceService, alertsService } from "@/lib/services/api.service";

const STAGES = [
  { id: "production", ar: "الإنتاج", en: "Production", color: "#0A7EA4", icon: "precision-manufacturing" },
  { id: "machines", ar: "المكائن", en: "Machines", color: "#6B7280", icon: "precision-manufacturing" },
  { id: "rosso", ar: "الروسو", en: "Rosso", color: "#FACC15", icon: "loop" },
  { id: "qalb", ar: "قلب", en: "Turning", color: "#FFFFFF", icon: "flip" },
  { id: "kawiya", ar: "كاوية", en: "Ironing", color: "#111827", icon: "local-fire-department" },
  { id: "inspection", ar: "فحص", en: "Inspection", color: "#DC2626", icon: "search" },
  { id: "packing", ar: "تغليف", en: "Packing", color: "#F97316", icon: "inventory-2" },
  { id: "antislip", ar: "مانع انزلاق", en: "Anti-slip", color: "#16A34A", icon: "layers" },
  { id: "storage", ar: "تخزين", en: "Storage", color: "#8B5A2B", icon: "warehouse" },
] as const;

const numberValue = (value: unknown) => Number(value || 0) || 0;
const today = () => new Date().toISOString().slice(0, 10);
const formatActionTime = (value: unknown) => {
  if (!value) return "—";
  const raw = String(value);
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? new Date(`${raw}T12:00:00`) : new Date(raw);
  if (!Number.isFinite(parsed.getTime())) return "—";
  return parsed.toLocaleString("ar-SA", { weekday: "long", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
};
const elapsedMinutes = (deliveredAt: unknown, receivedAt: unknown = new Date()) => {
  if (!deliveredAt) return null;
  const start = new Date(String(deliveredAt)).getTime();
  const end = new Date(String(receivedAt)).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  return Math.floor((end - start) / 60000);
};
const elapsedLabel = (minutes: number | null, isAr: boolean) => {
  if (minutes === null) return isAr ? "غير محسوبة" : "Not calculated";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return isAr ? `${hours ? `${hours} ساعة ` : ""}${mins} دقيقة` : `${hours ? `${hours}h ` : ""}${mins}m`;
};

const showTrackingMessage = (title: string, message: string) => {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
};

export default function ProductTrackingScreen() {
  const router = useRouter();
  const colors = useColors();
  const { language } = useLanguage();
  const { user } = useAuth();
  const isAr = language === "ar";
  const [dateFilter, setDateFilter] = useState("");
  const [dateToFilter, setDateToFilter] = useState("");
  const [appliedDateFilter, setAppliedDateFilter] = useState("");
  const [appliedDateToFilter, setAppliedDateToFilter] = useState("");
  const [production, setProduction] = useState<any[]>([]);
  const [manufacturing, setManufacturing] = useState<any[]>([]);
  const [handoverRecords, setHandoverRecords] = useState<any[]>([]);
  const [catalogProducts, setCatalogProducts] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [receivedBy, setReceivedBy] = useState("");
  const [qualityGrade, setQualityGrade] = useState<"first" | "second">("first");
  const [handoverNotes, setHandoverNotes] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [productFilter, setProductFilter] = useState("");
  const [expectedReceiver, setExpectedReceiver] = useState("");
  const [traceFilter, setTraceFilter] = useState<"all" | "shortage" | "delayed">("all");
  const [receiveDozen, setReceiveDozen] = useState("");
  const [receivePairs, setReceivePairs] = useState("");

  const loadData = async () => {
    setLoading(true);
    try {
      const [productionRows, stageRows, trackingRows, catalogRows, employeeRows] = await Promise.all([
        productionService.getAll(),
        manufacturingService.getAll(),
        productTrackingService.list(),
        productsService.list(),
        employeePerformanceService.listEmployees().catch(() => []),
      ]);
      const productionList = Array.isArray(productionRows) ? productionRows : [];
      const manufacturingList = Array.isArray(stageRows) ? stageRows : [];
      const movementSources = [
        ...productionList.map((row: any) => ({ ...row, sourceStage: "production", sourceWorker: row.movementBy || "", sourceKind: "production" })),
        ...manufacturingList.map((row: any) => ({ ...row, sourceStage: row.stageName || "", sourceWorker: row.workerName || row.movementBy || "", sourceKind: "stage" })),
      ].filter((row: any) => row.movementStatus && row.movementStatus !== "none" && row.productName && ((numberValue(row.quantityDozen || row.productionDozen) * 12) + numberValue(row.quantityPair || row.productionPairs)) > 0);
      const movementHistory: any[] = [];
      const pendingReceived: Record<string, any> = {};
      movementSources
        .sort((a: any, b: any) => String(a.movementAt || a.createdAt || "").localeCompare(String(b.movementAt || b.createdAt || "")))
        .forEach((row: any, index: number) => {
          const key = String(row.productName);
          const actionAt = row.movementAt || row.createdAt || null;
          if (row.movementStatus === "received") {
            const receivedDozen = numberValue(row.quantityDozen || row.productionDozen);
            const receivedPairs = numberValue(row.quantityPair || row.productionPairs);
            pendingReceived[key] = { at: actionAt, by: row.sourceWorker, stage: row.sourceStage, dozen: receivedDozen, pairs: receivedPairs };
            movementHistory.push({ id: `movement-received-${row.id || index}`, productName: row.productName, trackingDate: row.date || row.trackingDate, previousStage: row.sourceStage, currentStage: row.sourceStage, receivedBy: row.sourceWorker, receivedAt: actionAt, handoverStatus: "received", quantityDozen: receivedDozen, quantityPairs: receivedPairs, receivedQuantityDozen: receivedDozen, receivedQuantityPairs: receivedPairs, createdAt: actionAt });
          } else if (row.movementStatus === "delivered") {
            const received = pendingReceived[key];
            const deliveredDozen = numberValue(row.quantityDozen || row.productionDozen);
            const deliveredPairs = numberValue(row.quantityPair || row.productionPairs);
            const actualReceiver = row.receivedBy || received?.by || "";
            const actualReceivedAt = row.receivedAt || received?.at || null;
            movementHistory.push({ id: `movement-delivered-${row.id || index}`, productName: row.productName, productSize: row.productSize || "", productColor: row.productColor || "", productBarcode: row.barcode || "", trackingDate: row.date || row.trackingDate, previousStage: received?.stage || row.sourceStage, currentStage: row.sourceStage, deliveredBy: row.sourceWorker, deliveredAt: actionAt, receivedBy: actualReceiver, receivedAt: actualReceivedAt, expectedReceiver: row.expectedReceiver || "", receiverStage: row.receiverStage || "", handoverStatus: actualReceiver ? "received" : "pending", quantityDozen: deliveredDozen, quantityPairs: deliveredPairs, receivedQuantityDozen: received?.dozen || 0, receivedQuantityPairs: received?.pairs || 0, deliveredQuantityDozen: deliveredDozen, deliveredQuantityPairs: deliveredPairs, shortageDozen: Math.max(0, (received?.dozen || 0) - deliveredDozen), shortagePairs: Math.max(0, (received?.pairs || 0) - deliveredPairs), createdAt: actionAt });
            delete pendingReceived[key];
          }
        });
      setProduction(productionList);
      setManufacturing(manufacturingList);
      const catalogByName = new Map((Array.isArray(catalogRows) ? catalogRows : []).map((item: any) => [String(item.name || ""), item]));
      const detailedHandoverRecords = [...(Array.isArray(trackingRows) ? trackingRows : []), ...movementHistory].map((row: any) => {
        const catalog = catalogByName.get(String(row.productName || "")) || {};
        return {
          ...row,
          productName: row.productName || catalog.name || "",
          productSize: row.productSize || catalog.size || "",
          productColor: row.productColor || catalog.color || "",
          productBarcode: row.productBarcode || catalog.barcode || "",
          quantityDozen: row.quantityDozen ?? row.productionDozen ?? 0,
          quantityPairs: row.quantityPairs ?? row.productionPairs ?? row.quantityPair ?? 0,
          expectedReceiver: row.expectedReceiver || "",
          receiverStage: row.receiverStage || "",
          handoverStatus: row.receivedBy ? (row.handoverStatus || "received") : row.deliveredBy ? "pending" : (row.handoverStatus || "pending"),
        };
      });
      setHandoverRecords(detailedHandoverRecords);
      setCatalogProducts(Array.isArray(catalogRows) ? catalogRows : []);
      setEmployees(Array.isArray(employeeRows) ? employeeRows : []);
    } catch (error) {
      console.error("Product tracking load failed", error);
      Alert.alert(isAr ? "تعذر تحميل التتبع" : "Tracking unavailable", isAr ? "تحقق من اتصال الخادم ثم حاول مرة أخرى" : "Check the server connection and try again");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const groupedProducts = useMemo(() => {
    const groups: Record<string, any> = {};
    production
      .filter((row) => {
        const rowDate = String(row.date || row.createdAt || "").slice(0, 10);
        return (!appliedDateFilter || rowDate >= appliedDateFilter) && (!appliedDateToFilter || rowDate <= appliedDateToFilter);
      })
      .forEach((row) => {
        const name = String(row.productName || (isAr ? "صنف غير محدد" : "Unnamed product"));
        if (!groups[name]) {
          groups[name] = { name, dozen: 0, pairs: 0, weight: 0, machines: [], yarn: { cotton: 0, bamboo: 0, nylon: 0, span: 0, spandex: 0, rubber: 0 } };
        }
        const item = groups[name];
        item.dozen += numberValue(row.productionDozen);
        item.pairs += numberValue(row.productionPairs);
        item.weight += ["yarnCotton", "yarnBamboo", "yarnNylon", "yarnSpan", "yarnSpandex", "yarnRubber"].reduce((sum, key) => sum + numberValue(row[key]), 0);
        if (row.machineNumber && !item.machines.includes(String(row.machineNumber))) item.machines.push(String(row.machineNumber));
        item.yarn.cotton += numberValue(row.yarnCotton);
        item.yarn.bamboo += numberValue(row.yarnBamboo);
        item.yarn.nylon += numberValue(row.yarnNylon);
        item.yarn.span += numberValue(row.yarnSpan);
        item.yarn.spandex += numberValue(row.yarnSpandex);
        item.yarn.rubber += numberValue(row.yarnRubber);
      });
    return Object.values(groups).sort((a, b) => a.name.localeCompare(b.name, isAr ? "ar" : "en"));
  }, [production, appliedDateFilter, appliedDateToFilter, isAr]);

  const catalogForProduct = (productName: string) => catalogProducts.find((item) => String(item.name || "") === productName) || {};
  const employeeFor = (name: unknown) => employees.find((employee) => String(employee.name || "") === String(name || "") || String(employee.username || "") === String(name || "")) || {};
  const employeeSummaryLabel = (name: unknown) => {
    const employee = employeeFor(name);
    if (!name && !employee.name) return isAr ? "غير محدد" : "Not specified";
    return [employee.name || name, employee.position, employee.department].filter(Boolean).join(" — ");
  };
  const employeeDetailsLabel = (name: unknown) => {
    const employee = employeeFor(name);
    return [employee.name || name, employee.username && `اسم المستخدم: ${employee.username}`, employee.phone && `الجوال: ${employee.phone}`, employee.email && `البريد: ${employee.email}`, employee.department && `القسم: ${employee.department}`, employee.position && `الوظيفة: ${employee.position}`].filter(Boolean).join(" | ");
  };
  const productTimeline = (productName: string) => handoverRecords.filter((row) => String(row.productName || "") === productName).sort((a, b) => String(a.createdAt || a.deliveredAt || a.receivedAt || "").localeCompare(String(b.createdAt || b.deliveredAt || b.receivedAt || "")));
  const stageForProduct = (productName: string) => {
    const tracked = handoverRecords
      .filter((row) => String(row.productName || "") === productName)
      .sort((a, b) => String(b.deliveredAt || b.receivedAt || b.createdAt || "").localeCompare(String(a.deliveredAt || a.receivedAt || a.createdAt || "")));
    if (tracked[0]?.currentStage) return tracked[0].currentStage;
    const rows = manufacturing
      .filter((row) => String(row.productName || "") === productName)
      .sort((a, b) => String(b.movementAt || b.createdAt || "").localeCompare(String(a.movementAt || a.createdAt || "")));
    return rows[0]?.stageName || "production";
  };

  const latestTrackingForProduct = (productName: string) => handoverRecords
    .filter((row) => String(row.productName || "") === productName)
    .sort((a, b) => String(b.deliveredAt || b.receivedAt || b.createdAt || "").localeCompare(String(a.deliveredAt || a.receivedAt || a.createdAt || "")))[0] || null;

  const latestProductionForProduct = (productName: string) => production
    .filter((row) => String(row.productName || "") === productName)
    .sort((a, b) => String(b.createdAt || b.updatedAt || b.date || "").localeCompare(String(a.createdAt || a.updatedAt || a.date || "")))[0] || null;

  const locationForProduct = (productName: string) => {
    const latest = latestTrackingForProduct(productName);
    const currentStage = stageForProduct(productName);
    const targetStage = latest?.receiverStage || "";
    const isPendingReceipt = latest?.handoverStatus === "pending" && Boolean(targetStage);
    const isStored = currentStage === "storage" && (String(latest?.productType || "").startsWith("STORED:") || Boolean(latest?.stageCompletedAt));
    const stage = STAGES.find((item) => item.id === (isPendingReceipt ? targetStage : currentStage));
    if (isStored) return { stageId: "storage", label: isAr ? "مخزّن في المستودع" : "Stored in warehouse", status: isAr ? "مخزّن" : "Stored", color: "#15803d", icon: "check-circle" };
    if (isPendingReceipt) return { stageId: targetStage, label: isAr ? `بانتظار الاستلام في ${stage?.ar || targetStage}` : `Awaiting receipt at ${stage?.en || targetStage}`, status: isAr ? "بانتظار الاستلام" : "Awaiting receipt", color: "#d97706", icon: "hourglass-top" };
    if (latest?.handoverStatus === "received") return { stageId: currentStage, label: isAr ? `قيد التشغيل في ${stage?.ar || currentStage}` : `In process at ${stage?.en || currentStage}`, status: isAr ? "قيد التشغيل" : "In process", color: stage?.color || colors.primary, icon: "play-circle" };
    return { stageId: currentStage, label: isAr ? `الموقع الحالي: ${stage?.ar || currentStage}` : `Current location: ${stage?.en || currentStage}`, status: isAr ? "في المرحلة" : "At stage", color: stage?.color || colors.primary, icon: "location-on" };
  };

  const yarnLabels = [
    ["cotton", isAr ? "قطن" : "Cotton"], ["bamboo", isAr ? "بامبو" : "Bamboo"], ["nylon", isAr ? "نايلون" : "Nylon"],
    ["span", isAr ? "سبان" : "Span"], ["spandex", isAr ? "إسباندكس" : "Spandex"], ["rubber", isAr ? "مطاط" : "Rubber"],
  ] as const;

  const filteredHandovers = useMemo(() => {
    const employee = employeeFilter.trim().toLowerCase();
    const product = productFilter.trim().toLowerCase();
    return handoverRecords.filter((row) => {
      const rowDate = String(row.trackingDate || row.deliveredAt || row.receivedAt || row.createdAt || "").slice(0, 10);
      const dateMatches = (!appliedDateFilter || rowDate >= appliedDateFilter) && (!appliedDateToFilter || rowDate <= appliedDateToFilter);
      const productMatches = !product || [row.productName, row.productBarcode, row.productColor, row.productSize].some((value) => String(value || "").toLowerCase().includes(product));
      const stageMatches = stageFilter === "all" || String(row.previousStage || "") === stageFilter || String(row.currentStage || "") === stageFilter || String(row.receiverStage || "") === stageFilter;
      const employeeMatches = !employee || [row.deliveredBy, row.receivedBy, row.expectedReceiver].some((name) => String(name || "").toLowerCase().includes(employee));
      const shortageMatches = traceFilter === "all" || (traceFilter === "shortage" && numberValue(row.shortageDozen) + numberValue(row.shortagePairs) > 0);
      const delayedMatches = traceFilter !== "delayed" || (() => { const minutes = elapsedMinutes(row.deliveredAt, row.receivedAt); return minutes !== null && minutes >= 24 * 60; })();
      return dateMatches && productMatches && stageMatches && employeeMatches && shortageMatches && delayedMatches;
    });
  }, [handoverRecords, appliedDateFilter, appliedDateToFilter, stageFilter, employeeFilter, productFilter, traceFilter]);

  const employeeSummary = useMemo(() => {
    const summary: Record<string, { name: string; deliveredCount: number; receivedCount: number; deliveredDozen: number; receivedDozen: number; deliveredPairs: number; receivedPairs: number }> = {};
    const ensure = (name: string) => {
      if (!summary[name]) summary[name] = { name, deliveredCount: 0, receivedCount: 0, deliveredDozen: 0, receivedDozen: 0, deliveredPairs: 0, receivedPairs: 0 };
      return summary[name];
    };
    filteredHandovers.forEach((row) => {
      if (row.deliveredBy) { const item = ensure(String(row.deliveredBy)); item.deliveredCount += 1; item.deliveredDozen += numberValue(row.quantityDozen); item.deliveredPairs += numberValue(row.quantityPairs); }
      if (row.receivedBy) { const item = ensure(String(row.receivedBy)); item.receivedCount += 1; item.receivedDozen += numberValue(row.quantityDozen); item.receivedPairs += numberValue(row.quantityPairs); }
    });
    return Object.values(summary).sort((a, b) => a.name.localeCompare(b.name, "ar"));
  }, [filteredHandovers]);

  const applyDateFilter = () => {
    if (dateFilter && dateToFilter && dateFilter > dateToFilter) {
      showTrackingMessage(isAr ? "نطاق التاريخ غير صحيح" : "Invalid date range", isAr ? "اختر تاريخ البداية قبل تاريخ النهاية" : "Choose the start date before the end date");
      return;
    }
    setAppliedDateFilter(dateFilter);
    setAppliedDateToFilter(dateToFilter);
  };

  const stageLabel = (id: string) => STAGES.find((stage) => stage.id === id)?.ar || id || "غير محددة";
  const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>\\\"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\\\"": "&quot;", "'": "&#039;" } as Record<string, string>)[char] || char);

  const printHandoverReport = () => {
    if (Platform.OS !== "web" || typeof window === "undefined") {
      Alert.alert(isAr ? "الطباعة متاحة من الويب" : "Web printing", isAr ? "افتح التقرير من نسخة الويب لطباعة التقرير" : "Open the web version to print this report");
      return;
    }
    const detailRows = filteredHandovers.map((row, index) => {
      const catalog = catalogForProduct(String(row.productName || ""));
      const location = locationForProduct(String(row.productName || ""));
      const duration = elapsedMinutes(row.deliveredAt, row.receivedAt);
      const deliveredQty = `${numberValue(row.deliveredQuantityDozen ?? row.quantityDozen)} درزن + ${numberValue(row.deliveredQuantityPairs ?? row.quantityPairs)} زوج`;
      const receivedQty = `${numberValue(row.receivedQuantityDozen ?? row.quantityDozen)} درزن + ${numberValue(row.receivedQuantityPairs ?? row.quantityPairs)} زوج`;
      const difference = `${numberValue(row.shortageDozen)} درزن + ${numberValue(row.shortagePairs)} زوج`;
      const status = row.handoverStatus === "pending" ? "تحت الإجراء - بانتظار تأكيد المستلم" : row.receivedBy ? "مستلم ومؤكد" : location.status;
      return `<tr><td>${index + 1}</td><td><strong>${escapeHtml(row.productName || "غير محدد")}</strong><br/>المقاس: ${escapeHtml(row.productSize || catalog.size || "غير محدد")}<br/>اللون: ${escapeHtml(row.productColor || catalog.color || "غير محدد")}<br/>الباركود: ${escapeHtml(row.productBarcode || catalog.barcode || "غير محدد")}</td><td><strong>${escapeHtml(stageLabel(row.previousStage))} ← ${escapeHtml(stageLabel(row.currentStage))}</strong><br/>المرحلة التالية: ${escapeHtml(stageLabel(row.receiverStage))}<br/>الموقع الحالي: ${escapeHtml(location.label)}</td><td>تاريخ الحركة: ${escapeHtml(row.trackingDate || row.date || "غير محدد")}<br/>وقت التسليم: ${escapeHtml(formatActionTime(row.deliveredAt))}<br/>وقت الاستلام: ${escapeHtml(formatActionTime(row.receivedAt))}<br/><strong>الفارق بين التسليم والاستلام: ${escapeHtml(elapsedLabel(duration, true))}</strong></td><td>المسلّم:<br/>${escapeHtml(employeeDetailsLabel(row.deliveredBy) || "غير محدد")}<hr/>المستلم المحدد:<br/>${escapeHtml(employeeDetailsLabel(row.expectedReceiver) || "غير محدد")}<hr/>المستلم الفعلي:<br/>${escapeHtml(employeeDetailsLabel(row.receivedBy) || "لم يؤكد بعد")}</td><td>كمية التسليم: ${escapeHtml(deliveredQty)}<br/>كمية الاستلام: ${escapeHtml(receivedQty)}<br/><strong class="${numberValue(row.shortageDozen) + numberValue(row.shortagePairs) > 0 ? "danger" : "ok"}">الفرق/النقص: ${escapeHtml(difference)}</strong></td><td>الحالة الحالية: ${escapeHtml(status)}<br/>${escapeHtml(row.notes || "لا توجد ملاحظات")}</td></tr>`;
    }).join("");
    const summaryRows = employeeSummary.map((item) => `<tr><td>${escapeHtml(item.name)}</td><td>${item.deliveredCount}</td><td>${item.deliveredDozen} درزن + ${item.deliveredPairs} زوج</td><td>${item.receivedCount}</td><td>${item.receivedDozen} درزن + ${item.receivedPairs} زوج</td></tr>`).join("");
    const printWindow = window.open("", "_blank", "width=1400,height=900");
    if (!printWindow) return;
    printWindow.document.write(`<!doctype html><html dir="rtl"><head><meta charset="utf-8"><title>تقرير تفصيلي للتسليم والاستلام</title><style>body{font-family:Arial,sans-serif;padding:22px;color:#17202a;line-height:1.55}h1,h2{text-align:right;color:#075985;margin:8px 0}.meta{background:#eff8fb;border:1px solid #b8dce8;padding:12px;border-radius:8px;text-align:right}.note{background:#fff7ed;border:1px solid #fed7aa;padding:10px;margin:12px 0;text-align:right}table{width:100%;border-collapse:collapse;margin:10px 0 24px;font-size:11px;page-break-inside:auto}th,td{border:1px solid #9fb5bd;padding:8px;text-align:right;vertical-align:top}th{background:#075985;color:white;font-size:12px}tr{page-break-inside:avoid}tr:nth-child(even){background:#f7fbfc}hr{border:0;border-top:1px solid #d7e2e6;margin:5px 0}.danger{color:#b91c1c}.ok{color:#15803d}@page{size:landscape;margin:12mm}@media print{button{display:none}}</style></head><body><h1>التقرير التفصيلي للتسليم والاستلام في مراحل الإنتاج</h1><div class="meta"><strong>نطاق التقرير:</strong> ${escapeHtml(appliedDateFilter || appliedDateToFilter ? `${appliedDateFilter || "بداية غير محددة"} إلى ${appliedDateToFilter || "نهاية غير محددة"}` : "جميع التواريخ")}<br/><strong>المنتج:</strong> ${escapeHtml(productFilter || "جميع المنتجات")} | <strong>المرحلة:</strong> ${escapeHtml(stageFilter === "all" ? "جميع المراحل" : stageLabel(stageFilter))} | <strong>الموظف:</strong> ${escapeHtml(employeeFilter || "جميع الموظفين")}</div><div class="note"><strong>طريقة قراءة التقرير:</strong> كل صف يمثل حركة واحدة بين مرحلتين. يظهر وقت التسليم ووقت الاستلام منفصلين، ثم الفارق الزمني بينهما، مع بيان الموظف المسلم والمستلم المحدد والمستلم الفعلي، والفرق بين الكمية المسلّمة والكمية المستلمة.</div><h2>أولاً: ملخص مسؤولية الموظفين</h2><table><thead><tr><th>الموظف</th><th>عدد التسليم</th><th>كمية التسليم</th><th>عدد الاستلام</th><th>كمية الاستلام</th></tr></thead><tbody>${summaryRows || '<tr><td colspan="5">لا توجد بيانات</td></tr>'}</tbody></table><h2>ثانياً: سجل الحركات التفصيلي</h2><table><thead><tr><th>#</th><th>بيانات المنتج</th><th>المرحلة والمسار</th><th>التاريخ والأوقات والفارق</th><th>المسؤولية والموظفون</th><th>الكميات والفرق</th><th>الحالة والملاحظات</th></tr></thead><tbody>${detailRows || '<tr><td colspan="7">لا توجد بيانات ضمن الفلاتر الحالية</td></tr>'}</tbody></table><script>window.onload=()=>window.print()</script></body></html>`);
    printWindow.document.close();
  };

  const saveHandover = async (action: "deliver" | "receive") => {
    if (!selectedProduct || !user?.name) {
      showTrackingMessage(isAr ? "تعذر الاعتماد" : "Cannot sign", isAr ? "يجب تسجيل الدخول بحساب موظف لاعتماد الحركة" : "A signed-in employee is required");
      return;
    }
    const catalogProduct = catalogForProduct(selectedProduct.name);
      const currentStage = stageForProduct(selectedProduct.name);
      if (!receiveDozen && selectedProduct?.dozen !== undefined) setReceiveDozen(String(selectedProduct.dozen));
      if (!receivePairs && selectedProduct?.pairs !== undefined) setReceivePairs(String(selectedProduct.pairs));
    const stageIndex = Math.max(0, STAGES.findIndex((stage) => stage.id === currentStage));
    const nextStage = STAGES[Math.min(stageIndex + 1, STAGES.length - 1)].id;
    const pending = handoverRecords
      .filter((row) => String(row.productName || "") === selectedProduct.name && String(row.handoverStatus) === "delivered" && !row.receivedAt)
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))[0];
    if (action === "receive" && !pending) {
      showTrackingMessage(isAr ? "لا يوجد تسليم معلق" : "No pending delivery", isAr ? "لا يمكن اعتماد الاستلام قبل أن يسجل المسلم عملية التسليم" : "The receiver cannot sign before the sender records delivery");
      return;
    }
    if (action === "deliver" && pending) {
      showTrackingMessage(isAr ? "التسليم مسجل" : "Already delivered", isAr ? "هذه الحركة بانتظار توقيع المستلم" : "This movement is waiting for the receiver signature");
      return;
    }
    if (action === "deliver" && !expectedReceiver.trim()) {
      showTrackingMessage(isAr ? "بيانات ناقصة" : "Missing receiver", isAr ? "اختر الموظف المستلم المتوقع قبل توقيع التسليم" : "Choose the expected receiver before signing delivery");
      return;
    }
    if (action === "deliver" && expectedReceiver.trim() === user.name.trim()) {
      showTrackingMessage(isAr ? "حركة غير مسموحة" : "Invalid handover", isAr ? "لا يمكن للموظف تسليم المنتج لنفسه" : "An employee cannot deliver a product to themself");
      return;
    }
    if (action === "receive" && pending?.expectedReceiver && pending.expectedReceiver !== user.name) {
      showTrackingMessage(isAr ? "المستلم غير مطابق" : "Receiver mismatch", isAr ? `هذا التسليم مخصص للموظف: ${pending.expectedReceiver}` : `This delivery is assigned to: ${pending.expectedReceiver}`);
      return;
    }
    if (action === "receive" && pending?.deliveredBy === user.name) {
      showTrackingMessage(isAr ? "حركة غير مسموحة" : "Invalid receipt", isAr ? "لا يمكن للموظف استلام المنتج الذي سلّمه لنفسه" : "An employee cannot receive a product they delivered");
      return;
    }
    const actionTime = new Date();
    try {
      if (action === "deliver") {
        await productTrackingService.create({
          productName: selectedProduct.name,
          productSize: catalogProduct.size || undefined,
          productColor: catalogProduct.color || undefined,
          trackingDate: appliedDateFilter || today(),
          productBarcode: catalogProduct.barcode || undefined,
          qualityGrade,
          quantityDozen: Math.round(selectedProduct.dozen),
          quantityPairs: Math.round(selectedProduct.pairs),
          machineNumbers: selectedProduct.machines,
          currentStage: nextStage,
          previousStage: currentStage,
          deliveredBy: user.name,
          expectedReceiver: expectedReceiver.trim(),
          receiverStage: nextStage,
          deliveredAt: actionTime,
          handoverStatus: "delivered",
          notes: handoverNotes.trim() || undefined,
          userId: user.id || 1,
        });
      } else {
        await productTrackingService.update(pending.id, {
          handoverStatus: "received",
          receivedBy: user.name,
          receivedAt: actionTime,
          handoverDate: actionTime,
          quantityDozen: Math.max(0, Math.round(Number(receiveDozen || pending.quantityDozen || 0))),
          quantityPairs: Math.max(0, Math.round(Number(receivePairs || pending.quantityPairs || 0))),
          notes: handoverNotes.trim() || pending.notes || undefined,
        });
        const deliveredDozen = numberValue(pending.quantityDozen);
        const deliveredPairs = numberValue(pending.quantityPairs);
        const receivedDozenValue = Math.max(0, Math.round(Number(receiveDozen || pending.quantityDozen || 0)));
        const receivedPairsValue = Math.max(0, Math.round(Number(receivePairs || pending.quantityPairs || 0)));
        const shortageDozen = Math.max(0, deliveredDozen - receivedDozenValue);
        const shortagePairs = Math.max(0, deliveredPairs - receivedPairsValue);
        if (shortageDozen > 0 || shortagePairs > 0) {
          await alertsService.create({
            type: "quality_issue",
            title: isAr ? "تنبيه نقص في الاستلام" : "Receipt shortage alert",
            message: isAr ? `يوجد نقص عند استلام المنتج ${selectedProduct.name}: تم تسليم ${deliveredDozen} درزن و${deliveredPairs} زوج، واستلام ${receivedDozenValue} درزن و${receivedPairsValue} زوج. النقص: ${shortageDozen} درزن و${shortagePairs} زوج.` : `Shortage for ${selectedProduct.name}: delivered ${deliveredDozen} dozen/${deliveredPairs} pairs, received ${receivedDozenValue} dozen/${receivedPairsValue} pairs. Shortage: ${shortageDozen} dozen/${shortagePairs} pairs.`,
            severity: "critical",
            userId: user.id || 1,
            data: { productName: selectedProduct.name, stage: currentStage, deliveredDozen, deliveredPairs, receivedDozen: receivedDozenValue, receivedPairs: receivedPairsValue, shortageDozen, shortagePairs },
          });
        }
      }
      setReceivedBy("");
      setExpectedReceiver("");
      setReceiveDozen("");
      setReceivePairs("");
      setQualityGrade("first");
      setHandoverNotes("");
      setSelectedProduct(null);
      await loadData();
      showTrackingMessage(isAr ? `تم توقيع ${action === "deliver" ? "التسليم" : "الاستلام"}` : `${action === "deliver" ? "Delivery" : "Receipt"} signed`, isAr ? `تم تسجيل اسمك ووقت ${action === "deliver" ? "التسليم" : "الاستلام"} كمسؤولية على الحركة` : "Your identity and action time were recorded as responsibility for this movement");
    } catch (error) {
      const message = error instanceof Error ? error.message : (isAr ? "تعذر حفظ التوقيع. تحقق من ترحيل أعمدة الوقت ثم حاول مرة أخرى" : "Could not save the signature. Verify the time columns are migrated and try again");
      showTrackingMessage(isAr ? "تعذر الحفظ" : "Save failed", message);
    }
  };

  return (
    <ScreenContainer style={{ backgroundColor: colors.background }}>
      <View style={{ backgroundColor: colors.primary, paddingHorizontal: 18, paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <BackButton />
        <View style={{ flex: 1, alignItems: "flex-end", marginHorizontal: 12 }}>
          <Text style={{ color: "#fff", fontSize: 19, fontWeight: "800" }}>{isAr ? "تتبع المنتجات" : "Product Tracking"}</Text>
          <Text style={{ color: "#E0F2FE", fontSize: 11, marginTop: 2 }}>{isAr ? "تقرير يومي موثق من الإنتاج إلى التخزين" : "Daily trace from production to storage"}</Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push("/products" as any)}
          accessibilityLabel={isAr ? "فتح وطباعة دليل المنتجات" : "Open and print product catalog"}
          style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#ffffff22", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6 }}
        >
          <MaterialIcons name="print" size={19} color="#fff" />
          <Text style={{ color: "#fff", fontSize: 10, fontWeight: "800" }}>{isAr ? "طباعة المنتجات" : "Print products"}</Text>
        </TouchableOpacity>
      </View>
      <View style={{ paddingHorizontal: 14, paddingTop: 10 }}>
        <TouchableOpacity
          onPress={printHandoverReport}
          accessibilityLabel={isAr ? "طباعة تقرير الاستلام والتسليم" : "Print handover and receipt report"}
          style={{ backgroundColor: "#0f766e", borderRadius: 10, paddingVertical: 11, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 7, borderWidth: 1, borderColor: "#0b5f59" }}
        >
          <MaterialIcons name="print" size={20} color="#fff" />
          <Text style={{ color: "#fff", fontWeight: "900", fontSize: 13 }}>{isAr ? "طباعة تقرير الاستلام والتسليم" : "Print handover and receipt report"}</Text>
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 40 }}>
        <View style={{ backgroundColor: colors.surface, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: colors.border, marginBottom: 12 }}>
          <Text style={{ color: colors.foreground, fontWeight: "700", textAlign: "right", marginBottom: 7 }}>{isAr ? "نطاق تاريخ التقرير (اختياري)" : "Report date range (optional)"}</Text>
          <View style={{ width: "100%", marginBottom: 10 }}>
            <DateField value={dateFilter} onChange={setDateFilter} label={isAr ? "من تاريخ" : "From date"} isAr={isAr} defaultToToday={false} style={{ backgroundColor: colors.background, width: "100%" }} />
          </View>
          <View style={{ width: "100%", marginBottom: 4 }}>
            <DateField value={dateToFilter} onChange={setDateToFilter} label={isAr ? "إلى تاريخ" : "To date"} isAr={isAr} defaultToToday={false} style={{ backgroundColor: colors.background, width: "100%" }} />
          </View>
          <Text style={{ color: colors.muted, fontSize: 10, textAlign: "right", marginTop: 6 }}>{isAr ? "اضغط داخل خانة التاريخ لفتح التقويم، ثم اضغط بحث لعرض النتائج" : "Click a date field to open the calendar, then press Search to show results"}</Text>
          <TouchableOpacity onPress={applyDateFilter} accessibilityLabel={isAr ? "بحث بالتاريخ" : "Search by date"} style={{ backgroundColor: colors.primary, borderRadius: 9, paddingVertical: 10, alignItems: "center", marginTop: 8, flexDirection: "row", justifyContent: "center", gap: 6 }}><MaterialIcons name="search" size={19} color="#fff" /><Text style={{ color: "#fff", fontWeight: "800" }}>{isAr ? "بحث وعرض التقرير" : "Search and show report"}</Text></TouchableOpacity>
          <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-end", marginTop: 10, gap: 6 }}>
            {STAGES.map((stage) => (
              <View key={stage.id} style={{ flexDirection: "row", alignItems: "center", marginLeft: 7, marginBottom: 4 }}>
                <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: stage.color, borderWidth: stage.id === "qalb" ? 1 : 0, borderColor: colors.border, marginLeft: 4 }} />
                <Text style={{ color: colors.muted, fontSize: 10 }}>{isAr ? stage.ar : stage.en}</Text>
              </View>
            ))}
          </View>
          <TextInput value={productFilter} onChangeText={setProductFilter} placeholder={isAr ? "بحث باسم المنتج أو الباركود أو المقاس أو اللون" : "Search by product, barcode, size or color"} placeholderTextColor={colors.muted} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 8, color: colors.foreground, textAlign: "right", marginTop: 8 }} />
          <TextInput value={employeeFilter} onChangeText={setEmployeeFilter} placeholder={isAr ? "فلترة باسم الموظف (المسلّم أو المستلم)" : "Filter by employee (sender or receiver)"} placeholderTextColor={colors.muted} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 8, color: colors.foreground, textAlign: "right", marginTop: 8 }} />
          <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-end", gap: 6, marginTop: 8 }}>
            <TouchableOpacity onPress={() => { setDateFilter(""); setDateToFilter(""); setAppliedDateFilter(""); setAppliedDateToFilter(""); }} style={{ backgroundColor: !appliedDateFilter && !appliedDateToFilter ? colors.primary : colors.background, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 6 }}><Text style={{ color: !appliedDateFilter && !appliedDateToFilter ? "#fff" : colors.foreground, fontSize: 10 }}>{isAr ? "كل التواريخ" : "All dates"}</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => setStageFilter("all")} style={{ backgroundColor: stageFilter === "all" ? colors.primary : colors.background, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 6 }}><Text style={{ color: stageFilter === "all" ? "#fff" : colors.foreground, fontSize: 10 }}>{isAr ? "كل المراحل" : "All stages"}</Text></TouchableOpacity>
            {STAGES.map((stage) => <TouchableOpacity key={stage.id} onPress={() => setStageFilter(stage.id)} style={{ backgroundColor: stageFilter === stage.id ? colors.primary : colors.background, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 6 }}><Text style={{ color: stageFilter === stage.id ? "#fff" : colors.foreground, fontSize: 10 }}>{stage.ar}</Text></TouchableOpacity>)}
          </View>
          <Text style={{ color: colors.foreground, fontWeight: "700", textAlign: "right", marginTop: 10 }}>{isAr ? "فلاتر الحالة" : "Status filters"}</Text>
          <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 6, marginTop: 6 }}>
            {([['all', isAr ? 'الكل' : 'All'], ['shortage', isAr ? 'يوجد نقص' : 'Shortage'], ['delayed', isAr ? 'متأخر' : 'Delayed']] as const).map(([key, label]) => <TouchableOpacity key={key} onPress={() => setTraceFilter(key)} style={{ backgroundColor: traceFilter === key ? colors.primary : colors.background, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 6, borderWidth: 1, borderColor: colors.border }}><Text style={{ color: traceFilter === key ? '#fff' : colors.foreground, fontSize: 10 }}>{label}</Text></TouchableOpacity>)}
          </View>
          <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 6, marginTop: 8 }}>
            <TouchableOpacity onPress={() => { setDateFilter(""); setDateToFilter(""); setAppliedDateFilter(""); setAppliedDateToFilter(""); setProductFilter(""); setEmployeeFilter(""); setStageFilter("all"); setTraceFilter("all"); }} style={{ backgroundColor: colors.background, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 6, borderWidth: 1, borderColor: colors.border }}><Text style={{ color: colors.foreground, fontSize: 10 }}>{isAr ? "مسح كل الفلاتر" : "Clear all filters"}</Text></TouchableOpacity>
          </View>
          <TouchableOpacity onPress={printHandoverReport} style={{ backgroundColor: "#0f766e", borderRadius: 9, padding: 10, alignItems: "center", marginTop: 10 }}><Text style={{ color: "#fff", fontWeight: "800" }}>{isAr ? "طباعة التقرير الشامل لمراحل التسليم" : "Print comprehensive handover report"}</Text></TouchableOpacity>
        </View>

        {loading ? <ActivityIndicator size="large" color={colors.primary} /> : groupedProducts.length === 0 ? (
          <View style={{ padding: 24, alignItems: "center" }}><MaterialIcons name="inventory" size={42} color={colors.muted} /><Text style={{ color: colors.muted, marginTop: 8, textAlign: "center" }}>{isAr ? "لا توجد بيانات إنتاج لهذا التاريخ" : "No production data for this date"}</Text></View>
        ) : groupedProducts.map((product) => {
          const currentStage = stageForProduct(product.name);
          const location = locationForProduct(product.name);
          const latestProduction = latestProductionForProduct(product.name);
          const latestMovement = latestTrackingForProduct(product.name);
          const stageIndex = Math.max(0, STAGES.findIndex((stage) => stage.id === currentStage));
          const yarnTotal = Object.values(product.yarn).reduce((sum: number, value: any) => sum + numberValue(value), 0);
          return (
            <View key={product.name} style={{ backgroundColor: colors.surface, borderRadius: 14, padding: 13, borderWidth: 1, borderColor: colors.border, marginBottom: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "700" }}>{isAr ? "عرض وتتبع فقط" : "View and tracking only"}</Text>
                <View style={{ flex: 1, alignItems: "flex-end", marginLeft: 10 }}><Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "800" }}>{product.name}</Text><Text style={{ color: colors.muted, fontSize: 11, marginTop: 3 }}>{isAr ? `المكائن: ${product.machines.join("، ") || "-"}` : `Machines: ${product.machines.join(", ") || "-"}`}</Text><Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>اللون: {catalogForProduct(product.name).color || "غير محدد"} | المقاس: {catalogForProduct(product.name).size || "غير محدد"}</Text><Text style={{ color: "#0f766e", fontSize: 11, fontWeight: "800", marginTop: 5, textAlign: "right" }}>{isAr ? `تاريخ ووقت إدخال المنتج: ${formatActionTime(latestProduction?.createdAt || latestProduction?.updatedAt || latestProduction?.date)}` : `Product entry date and time: ${formatActionTime(latestProduction?.createdAt || latestProduction?.updatedAt || latestProduction?.date)}`}</Text><Text style={{ color: colors.muted, fontSize: 10, marginTop: 2, textAlign: "right" }}>{isAr ? `آخر حركة: ${formatActionTime(latestMovement?.deliveredAt || latestMovement?.receivedAt || latestMovement?.createdAt)}` : `Last movement: ${formatActionTime(latestMovement?.deliveredAt || latestMovement?.receivedAt || latestMovement?.createdAt)}`}</Text></View>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 11 }}>
                <View style={{ alignItems: "center", flex: 1 }}><Text style={{ color: colors.muted, fontSize: 10 }}>{isAr ? "الكمية" : "Quantity"}</Text><Text style={{ color: colors.primary, fontWeight: "800" }}>{product.dozen} {isAr ? "درزن" : "dz"} + {product.pairs} {isAr ? "زوج" : "pr"}</Text></View>
                <View style={{ alignItems: "center", flex: 1 }}><Text style={{ color: colors.muted, fontSize: 10 }}>{isAr ? "الوزن" : "Weight"}</Text><Text style={{ color: colors.foreground, fontWeight: "800" }}>{Math.round(product.weight)} {isAr ? "جرام" : "g"}</Text></View>
              </View>
              <View style={{ marginTop: 11, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 9, backgroundColor: `${location.color}18`, borderWidth: 1, borderColor: `${location.color}66`, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 7 }}>
                <View style={{ flex: 1, alignItems: "flex-end" }}><Text style={{ color: location.color, fontWeight: "900", fontSize: 12 }}>{location.status}</Text><Text style={{ color: colors.foreground, fontSize: 11, marginTop: 2, textAlign: "right" }}>{location.label}</Text></View>
                <MaterialIcons name={location.icon as any} size={24} color={location.color} />
              </View>
              <Text style={{ color: colors.foreground, fontWeight: "700", textAlign: "right", marginTop: 11, marginBottom: 5 }}>{isAr ? "الخيوط والنسبة المئوية" : "Yarns and percentages"}</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-end", gap: 5 }}>
                {yarnLabels.filter(([key]) => numberValue(product.yarn[key]) > 0).map(([key, label]) => <View key={key} style={{ backgroundColor: colors.background, borderRadius: 7, paddingHorizontal: 7, paddingVertical: 5 }}><Text style={{ color: colors.muted, fontSize: 10, textAlign: "right" }}>{label}: {numberValue(product.yarn[key]).toFixed(0)}g ({yarnTotal ? ((numberValue(product.yarn[key]) / yarnTotal) * 100).toFixed(1) : "0"}%)</Text></View>)}
                {yarnTotal === 0 && <Text style={{ color: colors.muted, fontSize: 10 }}>{isAr ? "لا يوجد وزن خيوط مسجل" : "No yarn weight recorded"}</Text>}
              </View>
              <Text style={{ color: colors.foreground, fontWeight: "700", textAlign: "right", marginTop: 11, marginBottom: 6 }}>{isAr ? "مسار المرحلة الحالية" : "Current stage path"}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                {STAGES.map((stage, index) => <View key={stage.id} style={{ alignItems: "center", flex: 1 }}><View style={{ width: 23, height: 23, borderRadius: 12, backgroundColor: index <= stageIndex ? stage.color : colors.border, borderWidth: stage.id === "qalb" ? 1 : 0, borderColor: colors.muted, alignItems: "center", justifyContent: "center" }}><MaterialIcons name={stage.icon as any} size={13} color={stage.id === "qalb" ? "#111827" : index <= stageIndex ? "#fff" : colors.muted} /></View><Text style={{ color: index === stageIndex ? colors.foreground : colors.muted, fontSize: 8, marginTop: 3, textAlign: "center" }}>{isAr ? stage.ar : stage.en}</Text></View>)}
              </View>
              <Text style={{ color: colors.muted, fontSize: 10, textAlign: "right", marginTop: 8 }}>{isAr ? `المرحلة الحالية: ${STAGES[stageIndex]?.ar}` : `Current stage: ${STAGES[stageIndex]?.en}`}</Text>
            </View>
          );
        })}

        <View style={{ backgroundColor: colors.surface, borderRadius: 14, padding: 13, borderWidth: 1, borderColor: colors.border, marginTop: 4 }}>
          <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "800", textAlign: "right" }}>{isAr ? "ملخص مسؤولية الموظفين" : "Employee accountability summary"}</Text>
          {employeeSummary.length === 0 ? <Text style={{ color: colors.muted, textAlign: "right", marginTop: 9, fontSize: 11 }}>{isAr ? "لا توجد توقيعات ضمن الفلاتر الحالية" : "No signatures for current filters"}</Text> : employeeSummary.map((item) => <View key={item.name} style={{ borderTopWidth: 1, borderColor: colors.border, paddingVertical: 9, marginTop: 7 }}><Text style={{ color: colors.foreground, fontWeight: "800", textAlign: "right" }}>{item.name}</Text><Text style={{ color: colors.muted, fontSize: 10, textAlign: "right", marginTop: 4 }}>{isAr ? `سلّم: ${item.deliveredCount} حركة — ${item.deliveredDozen} درزن + ${item.deliveredPairs} زوج` : `Delivered: ${item.deliveredCount} — ${item.deliveredDozen} dz + ${item.deliveredPairs} pairs`}</Text><Text style={{ color: colors.muted, fontSize: 10, textAlign: "right", marginTop: 2 }}>{isAr ? `استلم: ${item.receivedCount} حركة — ${item.receivedDozen} درزن + ${item.receivedPairs} زوج` : `Received: ${item.receivedCount} — ${item.receivedDozen} dz + ${item.receivedPairs} pairs`}</Text></View>)}
        </View>

        <View style={{ backgroundColor: colors.surface, borderRadius: 14, padding: 13, borderWidth: 1, borderColor: colors.border, marginTop: 4 }}>
          <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "800", textAlign: "right" }}>{isAr ? "سجل التسليم والاستلام التفصيلي" : "Detailed handover and receipt log"}</Text>
          {filteredHandovers.slice(0, 100).map((row) => <View key={String(row.id)} style={{ borderTopWidth: 1, borderColor: colors.border, paddingVertical: 8, marginTop: 7 }}><Text style={{ color: colors.foreground, fontWeight: "700", textAlign: "right" }}>{row.productName}</Text><Text style={{ color: colors.muted, fontSize: 10, textAlign: "right", marginTop: 2 }}>الباركود: {row.productBarcode || catalogForProduct(String(row.productName || "")).barcode || "غير محدد"} | اللون: {row.productColor || catalogForProduct(String(row.productName || "")).color || "غير محدد"} | المقاس: {row.productSize || catalogForProduct(String(row.productName || "")).size || "غير محدد"} | التصنيف: {row.qualityGrade === "second" ? "نخب ثاني" : row.qualityGrade === "first" ? "نخب أول" : "غير محدد"}</Text><Text style={{ color: colors.muted, fontSize: 10, textAlign: "right", marginTop: 3 }}>{isAr ? `من ${row.previousStage || "-"} إلى ${row.currentStage || "-"}` : `From ${row.previousStage || "-"} to ${row.currentStage || "-"}`}</Text><Text style={{ color: colors.muted, fontSize: 10, textAlign: "right", marginTop: 2 }}>{isAr ? `المسلّم: ${employeeDetailsLabel(row.deliveredBy) || "-"}` : `Delivered employee: ${employeeDetailsLabel(row.deliveredBy) || "-"}`}</Text><Text style={{ color: colors.muted, fontSize: 10, textAlign: "right", marginTop: 2 }}>{isAr ? `المستلم المحدد: ${employeeDetailsLabel(row.expectedReceiver) || "غير محدد"} | المرحلة: ${stageLabel(row.receiverStage)}` : `Expected receiver: ${employeeDetailsLabel(row.expectedReceiver) || "Not specified"} | Stage: ${stageLabel(row.receiverStage)}`}</Text><Text style={{ color: colors.muted, fontSize: 10, textAlign: "right", marginTop: 2 }}>{isAr ? `المستلم الفعلي: ${employeeDetailsLabel(row.receivedBy) || "لا يوجد بعد"}` : `Actual receiver: ${employeeDetailsLabel(row.receivedBy) || "Not confirmed yet"}`}</Text><Text style={{ color: row.handoverStatus === "pending" ? "#d97706" : "#16a34a", fontWeight: "800", fontSize: 10, textAlign: "right", marginTop: 2 }}>{row.handoverStatus === "pending" ? (isAr ? "حالة التسليم: تحت الإجراء – بانتظار تأكيد المستلم" : "Delivery status: In progress – awaiting receiver confirmation") : (isAr ? "حالة التسليم: مكتمل" : "Delivery status: Completed")}</Text><Text style={{ color: locationForProduct(String(row.productName || "")).color, fontWeight: "800", fontSize: 10, textAlign: "right", marginTop: 2 }}>{isAr ? `الموقع الحالي: ${locationForProduct(String(row.productName || "")).label}` : `Current location: ${locationForProduct(String(row.productName || "")).label}`}</Text><Text style={{ color: row.receivedAt ? "#16a34a" : "#d97706", fontSize: 10, textAlign: "right", marginTop: 2 }}>{isAr ? `وقت التسليم: ${formatActionTime(row.deliveredAt)} | وقت الاستلام: ${formatActionTime(row.receivedAt)} | المدة: ${elapsedLabel(elapsedMinutes(row.deliveredAt, row.receivedAt), isAr)}` : `Delivered: ${formatActionTime(row.deliveredAt)} | Received: ${formatActionTime(row.receivedAt)} | Duration: ${elapsedLabel(elapsedMinutes(row.deliveredAt, row.receivedAt), isAr)}`}</Text><Text style={{ color: colors.muted, fontSize: 10, textAlign: "right", marginTop: 2 }}>{isAr ? `كمية الاستلام: ${numberValue(row.receivedQuantityDozen ?? row.quantityDozen)} درزن + ${numberValue(row.receivedQuantityPairs ?? row.quantityPairs)} زوج | كمية التسليم: ${numberValue(row.deliveredQuantityDozen ?? row.quantityDozen)} درزن + ${numberValue(row.deliveredQuantityPairs ?? row.quantityPairs)} زوج | النقص: ${numberValue(row.shortageDozen)} درزن + ${numberValue(row.shortagePairs)} زوج` : `Received: ${numberValue(row.receivedQuantityDozen ?? row.quantityDozen)} dz + ${numberValue(row.receivedQuantityPairs ?? row.quantityPairs)} pairs | Delivered: ${numberValue(row.deliveredQuantityDozen ?? row.quantityDozen)} dz + ${numberValue(row.deliveredQuantityPairs ?? row.quantityPairs)} pairs | Shortage: ${numberValue(row.shortageDozen)} dz + ${numberValue(row.shortagePairs)} pairs`}</Text><View style={{ marginTop: 7, paddingTop: 6, borderTopWidth: 1, borderColor: colors.border }}><Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 10, textAlign: "right" }}>{isAr ? "خط سير المنتج" : "Product timeline"}</Text>{productTimeline(String(row.productName || "")).map((step, stepIndex) => <View key={`${String(step.id)}-${stepIndex}`} style={{ flexDirection: "row", alignItems: "center", justifyContent: "flex-end", marginTop: 4 }}><View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: step.handoverStatus === "received" ? "#dc2626" : "#16a34a", marginLeft: 5 }} /><Text style={{ color: colors.muted, fontSize: 9, textAlign: "right" }}>{`${stageLabel(step.previousStage)} → ${stageLabel(step.currentStage)} | ${step.handoverStatus === "received" ? (isAr ? "استلام" : "Received") : (isAr ? "تسليم" : "Delivered")} | ${formatActionTime(step.receivedAt || step.deliveredAt)} | ${employeeSummaryLabel(step.receivedBy || step.deliveredBy)}`}</Text></View>)}</View></View>)}
          {filteredHandovers.length === 0 && <Text style={{ color: colors.muted, textAlign: "right", marginTop: 9, fontSize: 11 }}>{isAr ? "لا توجد عمليات تسليم واستلام لهذا التاريخ" : "No handovers for this date"}</Text>}
        </View>
      </ScrollView>

      {selectedProduct && <View style={{ position: "absolute", left: 12, right: 12, bottom: 12, backgroundColor: colors.surface, borderRadius: 14, padding: 13, borderWidth: 2, borderColor: colors.primary, shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 8, elevation: 8 }}><View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}><TouchableOpacity onPress={() => setSelectedProduct(null)}><MaterialIcons name="close" size={22} color={colors.muted} /></TouchableOpacity><Text style={{ color: colors.foreground, fontWeight: "800", textAlign: "right", flex: 1 }}>{isAr ? `تسليم: ${selectedProduct.name}` : `Handover: ${selectedProduct.name}`}</Text></View><Text style={{ color: colors.muted, fontSize: 11, textAlign: "right", marginTop: 9 }}>{isAr ? `المستخدم الحالي: ${user?.name || "غير معروف"}` : `Current user: ${user?.name || "Unknown"}`}</Text><Text style={{ color: colors.foreground, fontWeight: "700", textAlign: "right", marginTop: 9 }}>{isAr ? "الموظف المستلم المتوقع (إلزامي عند التسليم)" : "Expected receiver (required for delivery)"}</Text><View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-end", gap: 6, marginTop: 6 }}>{employees.filter((employee) => String(employee.name || "") !== String(user?.name || "")).map((employee) => { const name = String(employee.name || employee.username || ""); return <TouchableOpacity key={String(employee.id || name)} onPress={() => setExpectedReceiver(name)} style={{ backgroundColor: expectedReceiver === name ? "#0f766e" : colors.background, borderWidth: 1, borderColor: expectedReceiver === name ? "#0f766e" : colors.border, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6 }}><Text style={{ color: expectedReceiver === name ? "#fff" : colors.foreground, fontSize: 10 }}>{name}{employee.department ? ` — ${employee.department}` : ""}</Text></TouchableOpacity>; })}</View><Text style={{ color: colors.muted, fontSize: 11, textAlign: "right", marginTop: 5 }}>{isAr ? `الباركود: ${catalogForProduct(selectedProduct.name).barcode || "غير محدد"} | اللون: ${catalogForProduct(selectedProduct.name).color || "غير محدد"} | المقاس: ${catalogForProduct(selectedProduct.name).size || "غير محدد"}` : `Barcode: ${catalogForProduct(selectedProduct.name).barcode || "Not set"} | Color: ${catalogForProduct(selectedProduct.name).color || "Not set"} | Size: ${catalogForProduct(selectedProduct.name).size || "Not set"}`}</Text><Text style={{ color: expectedReceiver ? "#0f766e" : "#b45309", fontSize: 10, textAlign: "right", marginTop: 5 }}>{isAr ? `المستلم المختار: ${expectedReceiver || "لم يتم الاختيار بعد"}` : `Selected receiver: ${expectedReceiver || "Not selected"}`}</Text><Text style={{ color: colors.foreground, fontWeight: "700", textAlign: "right", marginTop: 8 }}>{isAr ? "تصنيف المنتج" : "Product grade"}</Text><View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}><TouchableOpacity onPress={() => setQualityGrade("first")} style={{ flex: 1, borderRadius: 8, padding: 9, alignItems: "center", backgroundColor: qualityGrade === "first" ? "#16a34a" : colors.background, borderWidth: 1, borderColor: "#16a34a" }}><Text style={{ color: qualityGrade === "first" ? "#fff" : "#16a34a", fontWeight: "800" }}>{isAr ? "نخب أول" : "First grade"}</Text></TouchableOpacity><TouchableOpacity onPress={() => setQualityGrade("second")} style={{ flex: 1, borderRadius: 8, padding: 9, alignItems: "center", backgroundColor: qualityGrade === "second" ? "#d97706" : colors.background, borderWidth: 1, borderColor: "#d97706" }}><Text style={{ color: qualityGrade === "second" ? "#fff" : "#d97706", fontWeight: "800" }}>{isAr ? "نخب ثاني" : "Second grade"}</Text></TouchableOpacity></View><Text style={{ color: colors.foreground, fontWeight: "700", textAlign: "right", marginTop: 8 }}>{isAr ? "الكمية المستلمة فعلياً" : "Actual received quantity"}</Text><View style={{ flexDirection: "row", gap: 8, marginTop: 5 }}><TextInput value={receiveDozen} onChangeText={setReceiveDozen} keyboardType="numeric" placeholder={isAr ? "درزن" : "Dozen"} placeholderTextColor={colors.muted} style={{ flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 9, color: colors.foreground, textAlign: "right" }} /><TextInput value={receivePairs} onChangeText={setReceivePairs} keyboardType="numeric" placeholder={isAr ? "زوج" : "Pairs"} placeholderTextColor={colors.muted} style={{ flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 9, color: colors.foreground, textAlign: "right" }} /></View><TextInput value={handoverNotes} onChangeText={setHandoverNotes} placeholder={isAr ? "ملاحظات التسليم (اختياري)" : "Handover notes (optional)"} placeholderTextColor={colors.muted} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 9, color: colors.foreground, textAlign: "right", marginTop: 7 }} /><View style={{ flexDirection: "row", gap: 8, marginTop: 9 }}><TouchableOpacity onPress={() => saveHandover("deliver")} style={{ flex: 1, backgroundColor: "#d97706", borderRadius: 9, padding: 10, alignItems: "center" }}><Text style={{ color: "#fff", fontWeight: "800" }}>{isAr ? "توقيع التسليم" : "Sign delivery"}</Text></TouchableOpacity><TouchableOpacity onPress={() => saveHandover("receive")} style={{ flex: 1, backgroundColor: "#16a34a", borderRadius: 9, padding: 10, alignItems: "center" }}><Text style={{ color: "#fff", fontWeight: "800" }}>{isAr ? "توقيع الاستلام" : "Sign receipt"}</Text></TouchableOpacity></View></View>}
    </ScreenContainer>
  );
}
