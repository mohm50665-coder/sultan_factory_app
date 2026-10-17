import { businessDate, exactPairs, inReportPeriod, pairLabel, productionMetrics, reportDate, reportRows, riyadhDate } from "@shared/operational-report";
import { BackButton } from "@/components/back-button";
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert, Platform } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { DateField } from "@/components/date-field";
import { useColors } from "@/hooks/use-colors";
import { MaterialIcons } from "@expo/vector-icons";
import { useState, useEffect } from "react";
import { useLanguage } from "@/lib/language-context";
import { maintenanceService, productionService } from "@/lib/services/api.service";
import { useAuth } from "@/lib/auth-context";
import * as Print from "expo-print";



interface MachineData {
  productionDozen: string;
  productionPairs: string;
  wasteThreadGrams: string;
  wasteSocksGrams: string;
  secondGradeDozen: string;
  secondGradePairs: string;
  wasteNeedles: string;
  needlesUsed?: string;
  yarnIssuedGrams?: number;
  productSize?: string;
  productColor?: string;
  productionHours: string;
  productionMinutes: string;
  yarnRubber: string;
  yarnSpandex: string;
  yarnNylon: string;
  yarnCotton: string;
  yarnBamboo: string;
  yarnSpan: string;
  yarnWeightPerPair: string;
  productName?: string;
  shiftNumber?: string;
  shiftStart?: string;
  shiftEnd?: string;
}

interface ProductionEntry {
  id: string;
  date: string;
  machines: { [key: string]: MachineData };
}

const MACHINES = ["RB1", "RB2", "RB3", "RB4", "RB5", "RB6", "RB7", "RB8", "RB9", "NS1", "RS1", "RS2", "RS3", "RS4", "RS5", "RS6", "RS7", "RS8", "RS9", "RS10", "RS11", "LT1", "LT2"];
const YARN_FIELDS = [
  ["yarnRubber", "مطاط", "Rubber"],
  ["yarnSpandex", "اسباندكس", "Spandex"],
  ["yarnNylon", "نايلون", "Nylon"],
  ["yarnCotton", "قطن", "Cotton"],
  ["yarnBamboo", "بامبو", "Bamboo"],
  ["yarnSpan", "اسبان", "Span"],
] as const;

type YarnField = typeof YARN_FIELDS[number][0];

const STOP_REASONS = [
  { ar: "عطل", en: "Breakdown" },
  { ar: "لا يوجد طلب متاح", en: "No available order" },
  { ar: "لا يمكنها نسج الأصناف المطلوبة", en: "Cannot knit the required products" },
  { ar: "لا توجد مواد خام لتشغيلها", en: "No raw materials available" },
  { ar: "لا يوجد موظف مختص لتشغيلها", en: "No qualified operator available" },
];
// ملاحظة 1: تحويل النخب الثاني من زوج لدرزن
const convertPairsToDozens = (totalPairs: number): { dozens: number; remainingPairs: number } => {
  const dozens = Math.floor(totalPairs / 12);
  const remainingPairs = totalPairs % 12;
  return { dozens, remainingPairs };
};

export default function ProductionTotalsScreen() {
  const colors = useColors();
  const [entries, setEntries] = useState<ProductionEntry[]>([]);
  const [stopReasons, setStopReasons] = useState<Record<string, string>>({});
  const [savedStops, setSavedStops] = useState<Record<string, boolean>>({});
  const { language } = useLanguage();
  const { user } = useAuth();
  const isAr = language === "ar";
  const [startDate, setStartDate] = useState(() => riyadhDate());
  const [endDate, setEndDate] = useState(() => riyadhDate());
  const [loading, setLoading] = useState(true);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [undatedRecords, setUndatedRecords] = useState(0);
  const normalizedStart = reportDate(startDate);
  const normalizedEnd = reportDate(endDate);
  const hasValidRange = Boolean(normalizedStart && normalizedEnd);
  const rangeReversed = hasValidRange && normalizedStart > normalizedEnd;
  const visibleEntries = hasValidRange
    ? entries.filter((entry) => inReportPeriod(entry, "production", startDate, endDate))
    : [];

  const setNormalizedStartDate = (value: string) => {
    const normalized = reportDate(value);
    if (normalized) setStartDate(normalized);
  };
  const setNormalizedEndDate = (value: string) => {
    const normalized = reportDate(value);
    if (normalized) setEndDate(normalized);
  };

  useEffect(() => {
    loadEntries();
  }, []);

  const loadEntries = async () => {
    setLoading(true);
    setSourceError(null);
    try {
      const response = await productionService.getAll();
      const data = reportRows(response);
      const hasRecognizedRows = Array.isArray(response) || ["items", "rows", "data", "results"].some((key) => Array.isArray(response?.[key]));
      if (!hasRecognizedRows) throw new Error(isAr ? "استجابة مصدر الإنتاج غير صالحة؛ لم تعرض كأصفار." : "Production source response is invalid and was not displayed as zeros.");

      const grouped: { [date: string]: { [key: string]: MachineData } } = {};
      let missingDateCount = 0;
      data.forEach((item: any) => {
        const date = businessDate(item, "production");
        if (!date) {
          missingDateCount += 1;
          return;
        }
        if (!grouped[date]) grouped[date] = {};
        const machine = item.machineNumber || "unknown";
        const shift = item.shiftNumber || "1";
        const key = `${machine}_S${shift}_${item.id}_${item.productName || ""}_${item.productSize || ""}_${item.productColor || ""}`;
        grouped[date][key] = {
          productionDozen: String(item.productionDozen || "0"),
          productionPairs: String(item.productionPairs || "0"),
          wasteThreadGrams: String(item.wasteThreadGrams || "0"),
          wasteSocksGrams: String(item.wasteSocksGrams || "0"),
          secondGradeDozen: String(item.secondGradeDozen || "0"),
          secondGradePairs: String(item.secondGradePairs || "0"),
          wasteNeedles: String(item.wasteNeedles || "0"),
          needlesUsed: String(item.needlesUsed || "0"),
          yarnIssuedGrams: item.yarnIssuedGrams,
          productSize: item.productSize,
          productColor: item.productColor,
          productionHours: String(item.productionHours || "0"),
          productionMinutes: String(item.productionMinutes || "0"),
          yarnRubber: String(item.yarnRubber || "0"),
          yarnSpandex: String(item.yarnSpandex || "0"),
          yarnNylon: String(item.yarnNylon || "0"),
          yarnCotton: String(item.yarnCotton || "0"),
          yarnBamboo: String(item.yarnBamboo || "0"),
          yarnSpan: String(item.yarnSpan || "0"),
          yarnWeightPerPair: String(item.yarnWeightPerPair || "0"),
          productName: item.productName || "",
          shiftNumber: String(item.shiftNumber || "1"),
          shiftStart: item.shiftStart || "",
          shiftEnd: item.shiftEnd || "",
        };
      });
      const entriesArray = Object.entries(grouped)
        .map(([date, machines]) => ({ id: date, date, machines }))
        .sort((a, b) => b.date.localeCompare(a.date));
      setEntries(entriesArray);
      setUndatedRecords(missingDateCount);
    } catch (e) {
      console.error("Error loading entries:", e);
      setEntries([]);
      setUndatedRecords(0);
      setSourceError(e instanceof Error ? e.message : (isAr ? "تعذر تحميل مصدر الإنتاج." : "Could not load the production source."));
    } finally {
      setLoading(false);
    }
  };

  const unusedMachinesFor = (entry: ProductionEntry) => {
    const used = new Set(Object.keys(entry.machines).map((key) => key.split("_S")[0]));
    return MACHINES.filter((machine) => !used.has(machine));
  };
  const saveStoppedMachine = async (machine: string, date: string) => {
    const key = `${date}:${machine}`;
    const reason = stopReasons[key];
    if (!reason) {
      Alert.alert(isAr ? "سبب عدم التشغيل مطلوب" : "Stop reason required", isAr ? "اختر سبب عدم تشغيل الماكينة أولاً." : "Select a reason before saving.");
      return;
    }
    if (!user?.id) {
      Alert.alert(isAr ? "الجلسة غير متاحة" : "Session unavailable", isAr ? "أعد تسجيل الدخول ثم حاول مرة أخرى." : "Sign in again and try again.");
      return;
    }
    try {
      await maintenanceService.createStopped({ equipmentName: machine, stopDate: `${date}T${new Date().toTimeString().slice(0, 8)}`, stopReason: reason, userId: user.id });
      setSavedStops((current) => ({ ...current, [key]: true }));
      Alert.alert(isAr ? "تم حفظ التقرير" : "Report saved", isAr ? "تم حفظ سبب عدم تشغيل الماكينة." : "The machine non-operation reason was saved.");
    } catch (error) {
      Alert.alert(isAr ? "تعذر الحفظ" : "Save failed", error instanceof Error ? error.message : (isAr ? "حدث خطأ غير متوقع." : "Unexpected error."));
    }
  };

  // حساب الإجماليات لجميع المكائن في جميع السجلات
  let grandDozen = 0;
  let grandPairs = 0;
  let grandPairsEquivalent = 0;
  let grandSecondDozen = 0;
  let grandSecondPairs = 0;
  let grandWasteThread = 0;
  let grandWasteSocks = 0;
  let grandYarnWeight = 0;
  let grandNeedles = 0;
  let grandHours = 0;
  let grandMinutes = 0;

  let totalRubber = 0;
  let totalSpandex = 0;
  let totalNylon = 0;
  let totalCotton = 0;
  let totalBamboo = 0;
  let totalSpan = 0;

  visibleEntries.forEach(entry => {
    Object.values(entry.machines).forEach(m => {
      grandDozen += parseFloat(m.productionDozen) || 0;
      const productionPairs = (parseFloat(m.productionDozen) || 0) * 12 + (parseFloat(m.productionPairs) || 0);
      grandPairs += parseFloat(m.productionPairs) || 0;
      grandPairsEquivalent += productionPairs;
      grandSecondDozen += parseFloat(m.secondGradeDozen) || 0;
      grandSecondPairs += parseFloat(m.secondGradePairs) || 0;
      grandWasteThread += parseFloat(m.wasteThreadGrams) || 0;
      grandWasteSocks += parseFloat(m.wasteSocksGrams) || 0;
      grandNeedles += parseFloat(m.wasteNeedles) || 0;
      grandHours += parseFloat(m.productionHours) || 0;
      grandMinutes += parseFloat(m.productionMinutes) || 0;

      const rubber = parseFloat(m.yarnRubber) || 0;
      const spandex = parseFloat(m.yarnSpandex) || 0;
      const nylon = parseFloat(m.yarnNylon) || 0;
      const cotton = parseFloat(m.yarnCotton) || 0;
      const bamboo = parseFloat(m.yarnBamboo) || 0;
      const span = parseFloat(m.yarnSpan) || 0;

      totalRubber += rubber * productionPairs;
      totalSpandex += spandex * productionPairs;
      totalNylon += nylon * productionPairs;
      totalCotton += cotton * productionPairs;
      totalBamboo += bamboo * productionPairs;
      totalSpan += span * productionPairs;

      grandYarnWeight += (rubber + spandex + nylon + cotton + bamboo + span) * productionPairs;
    });
  });

  const periodRows = visibleEntries.flatMap(entry => Object.values(entry.machines));
  const measured = productionMetrics(periodRows);
  const periodRecordCount = periodRows.length;
  grandDozen = Math.floor(measured.totalPairs / 12);
  grandPairs = measured.totalPairs % 12;
  grandYarnWeight = measured.yarnGrams;
  // تحويل الدقائق الزائدة لساعات
  grandHours += Math.floor(grandMinutes / 60);
  grandMinutes = grandMinutes % 60;

  // ملاحظة 1: تحويل النخب الثاني - تجميع كل الأزواج ثم التحويل
  const totalSecondPairsAll = grandSecondPairs + (grandSecondDozen * 12);
  const secondConverted = convertPairsToDozens(totalSecondPairsAll);

  const grandWasteAll = grandWasteThread + grandWasteSocks;
  const grandWastePercent = measured.wastePercent;
  const wasteColor = (grandWastePercent ?? 0) > 5 ? "#ef4444" : "#22c55e";
  const yarnDetails = visibleEntries.flatMap((entry) => Object.entries(entry.machines).map(([machine, m]) => ({
    key: `${entry.date}-${machine}`,
    date: entry.date,
    machine,
    productName: m.productName || (isAr ? "بدون اسم" : "Unnamed"),
    pairs: (parseFloat(m.productionDozen) || 0) * 12 + (parseFloat(m.productionPairs) || 0),
    yarnWeightPerPair: parseFloat(m.yarnWeightPerPair) || 0,
    values: YARN_FIELDS.map(([field, ar, en]) => ({ label: isAr ? ar : en, perPair: parseFloat(m[field]) || 0, total: (parseFloat(m[field]) || 0) * ((parseFloat(m.productionDozen) || 0) * 12 + (parseFloat(m.productionPairs) || 0)) })),
  })));

  const handlePrint = async () => {
    if (!hasValidRange) {
      Alert.alert(isAr ? "فترة غير صالحة" : "Invalid period", isAr ? "اختر تاريخ بداية ونهاية صالحين قبل الطباعة." : "Choose valid start and end dates before printing.");
      return;
    }
    if (loading || sourceError) {
      Alert.alert(isAr ? "التقرير غير جاهز" : "Report unavailable", isAr ? "انتظر تحميل مصدر الإنتاج أو أعد المحاولة قبل الطباعة." : "Wait for the production source to load or retry before printing.");
      return;
    }
    if (periodRecordCount === 0) {
      Alert.alert(isAr ? "لا توجد بيانات للطباعة" : "No data to print", isAr ? "لا توجد سجلات إنتاج مؤرخة ضمن الفترة المحددة." : "No dated production records fall within the selected range.");
      return;
    }

    const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] || character);
    const appliedStart = rangeReversed ? normalizedEnd : normalizedStart;
    const appliedEnd = rangeReversed ? normalizedStart : normalizedEnd;
    const details = visibleEntries.flatMap((entry) => Object.entries(entry.machines).map(([machine, machineData]) => {
      const productionPairs = (parseFloat(machineData.productionDozen) || 0) * 12 + (parseFloat(machineData.productionPairs) || 0);
      const secondPairs = (parseFloat(machineData.secondGradeDozen) || 0) * 12 + (parseFloat(machineData.secondGradePairs) || 0);
      return `<tr><td>${escapeHtml(entry.date)}</td><td>${escapeHtml(machine)}</td><td>${escapeHtml(machineData.productName || (isAr ? "بدون اسم" : "Unnamed"))}</td><td>${productionPairs}</td><td>${secondPairs}</td></tr>`;
    })).join("");
    const html = `<!doctype html><html lang="${isAr ? "ar" : "en"}" dir="${isAr ? "rtl" : "ltr"}"><head><meta charset="utf-8"/><title>${isAr ? "مجاميع الإنتاج" : "Production totals"}</title><style>body{font-family:Arial,sans-serif;color:#172033;padding:24px}h1,h2,p{text-align:${isAr ? "right" : "left"}}h1{color:#0d9488;margin-bottom:4px}.muted{color:#64748b}.metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:20px 0}.metric{border:1px solid #cbd5e1;border-radius:8px;padding:10px}.metric b{display:block;color:#0f766e;font-size:18px;margin-top:4px}table{width:100%;border-collapse:collapse;margin-top:16px;font-size:12px}th,td{border:1px solid #cbd5e1;padding:7px;text-align:${isAr ? "right" : "left"}}th{background:#ccfbf1}@media print{body{padding:0}}</style></head><body><h1>${isAr ? "مجاميع إنتاج المكائن" : "Machine Production Totals"}</h1><p class="muted">${isAr ? "فترة تاريخ حدث الإنتاج:" : "Production event-date period:"} ${escapeHtml(appliedStart)} — ${escapeHtml(appliedEnd)}</p><p class="muted">${isAr ? "عدد سجلات الإنتاج المؤرخة:" : "Dated production records:"} ${periodRecordCount}</p><div class="metrics"><div class="metric">${isAr ? "إجمالي الإنتاج" : "Total production"}<b>${grandPairsEquivalent} ${isAr ? "زوج" : "pairs"}</b></div><div class="metric">${isAr ? "النخب الثاني" : "Second grade"}<b>${totalSecondPairsAll} ${isAr ? "زوج" : "pairs"}</b></div><div class="metric">${isAr ? "إجمالي الهدر" : "Total waste"}<b>${grandWasteAll.toFixed(0)} ${isAr ? "جم" : "g"}</b></div><div class="metric">${isAr ? "الخيوط المستخدمة" : "Used yarn"}<b>${grandYarnWeight.toFixed(0)} ${isAr ? "جم" : "g"}</b></div><div class="metric">${isAr ? "نسبة الهدر" : "Waste rate"}<b>${grandWastePercent == null ? (isAr ? "غير محسوبة" : "Not calculated") : `${grandWastePercent.toFixed(2)}%`}</b></div><div class="metric">${isAr ? "الإبر" : "Needles"}<b>${grandNeedles} ${isAr ? "تالفة" : "damaged"} / ${measured.needlesUsed} ${isAr ? "مستخدمة" : "used"}</b></div></div><h2>${isAr ? "تفاصيل الإنتاج المرشحة" : "Filtered production details"}</h2><table><thead><tr><th>${isAr ? "تاريخ الإنتاج" : "Production date"}</th><th>${isAr ? "الماكينة" : "Machine"}</th><th>${isAr ? "المنتج" : "Product"}</th><th>${isAr ? "الإنتاج (زوج)" : "Production (pairs)"}</th><th>${isAr ? "نخب ثانٍ (زوج)" : "Second grade (pairs)"}</th></tr></thead><tbody>${details}</tbody></table></body></html>`;

    try {
      if (Platform.OS === "web") {
        const printWindow = window.open("", "_blank", "width=1100,height=800");
        if (!printWindow) throw new Error("PRINT_WINDOW_BLOCKED");
        printWindow.document.open();
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        window.setTimeout(() => {
          printWindow.print();
          printWindow.close();
        }, 250);
      } else {
        await Print.printAsync({ html, orientation: Print.Orientation.landscape });
      }
    } catch (error) {
      Alert.alert(isAr ? "خطأ في الطباعة" : "Print error", isAr ? "تعذر فتح الطباعة. اسمح بالنوافذ المنبثقة ثم حاول مرة أخرى." : "Unable to open printing. Allow pop-ups and try again.");
    }
  };

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      {/* الهيدر */}
      <View style={{ backgroundColor: "#0d9488", paddingVertical: 16, paddingHorizontal: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <TouchableOpacity onPress={handlePrint} accessibilityRole="button" accessibilityLabel={isAr ? "طباعة مجاميع الإنتاج للفترة المحددة" : "Print production totals for selected period"} style={{ width: 40, minHeight: 40, alignItems: "center", justifyContent: "center" }}>
            <MaterialIcons name="print" size={23} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ color: '#ffffff', fontWeight: 'bold', fontSize: 20 }}>{isAr ? "إجمالي بيانات المكائن" : "Total Machines Data"}</Text>
            <Text style={{ fontSize: 14, marginTop: 4, color: 'rgba(255,255,255,0.8)' }}>{periodRecordCount} {isAr ? "سجل إنتاج" : "production record(s)"}</Text>
          </View>
          <BackButton />
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: colors.border, marginBottom: 12 }}>
          <Text style={{ color: colors.foreground, fontWeight: "800", textAlign: "right", marginBottom: 8 }}>{isAr ? "فترة تقرير إنتاج المكائن" : "Machine production report period"}</Text>
          <View style={{ flexDirection: isAr ? "row-reverse" : "row", flexWrap: "wrap", gap: 8 }}>
            <View style={{ flex: 1, minWidth: 150 }}><DateField value={startDate} onChange={setNormalizedStartDate} label={isAr ? "من تاريخ" : "Start date"} isAr={isAr} /></View>
            <View style={{ flex: 1, minWidth: 150 }}><DateField value={endDate} onChange={setNormalizedEndDate} label={isAr ? "إلى تاريخ" : "End date"} isAr={isAr} /></View>
          </View>
          {rangeReversed ? <Text accessibilityRole="alert" style={{ color: "#b45309", fontSize: 11, textAlign: "right", marginTop: 7 }}>{isAr ? "تاريخ البداية بعد تاريخ النهاية؛ يرتّب التقرير حدود الفترة للترشيح فقط." : "Start date is after end date; the report orders the period bounds for filtering only."}</Text> : null}
          {!hasValidRange ? <Text accessibilityRole="alert" style={{ color: colors.error, fontSize: 11, textAlign: "right", marginTop: 7 }}>{isAr ? "أدخل تاريخ بداية ونهاية صالحين من التقويم." : "Choose valid start and end dates from the calendar."}</Text> : null}
          {!loading && !sourceError && undatedRecords > 0 ? <Text accessibilityRole="alert" style={{ color: "#b45309", fontSize: 11, textAlign: "right", marginTop: 7 }}>{isAr ? `${undatedRecords} سجل إنتاج بلا تاريخ صالح لم يدخل في التقرير.` : `${undatedRecords} production record(s) without a valid date were excluded from the report.`}</Text> : null}
          <Text style={{ color: colors.muted, fontSize: 10, textAlign: "right", marginTop: 7 }}>{isAr ? `عدد سجلات الإنتاج في الفترة: ${periodRecordCount}` : `Production records in period: ${periodRecordCount}`}</Text>
        </View>
        {sourceError ? (
          <View accessibilityRole="alert" style={{ alignItems: "center", justifyContent: "center", paddingVertical: 48 }}>
            <MaterialIcons name="error-outline" size={48} color={colors.error} />
            <Text style={{ color: colors.error, fontSize: 18, marginTop: 16, fontWeight: "bold" }}>{isAr ? "تعذر تحميل مصدر الإنتاج" : "Production source unavailable"}</Text>
            <Text style={{ color: colors.muted, fontSize: 13, marginTop: 8, textAlign: "center", paddingHorizontal: 24 }}>{sourceError}</Text>
            <TouchableOpacity onPress={loadEntries} style={{ backgroundColor: "#0d9488", borderRadius: 8, paddingVertical: 10, paddingHorizontal: 18, marginTop: 16 }}><Text style={{ color: "#fff", fontWeight: "800" }}>{isAr ? "إعادة المحاولة" : "Try again"}</Text></TouchableOpacity>
          </View>
        ) : loading ? (
          <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 80 }}>
            <Text style={{ color: colors.muted, fontSize: 14 }}>{isAr ? "جارٍ تحميل بيانات الإنتاج..." : "Loading production data..."}</Text>
          </View>
        ) : !hasValidRange ? (
          <View accessibilityRole="alert" style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80 }}>
            <View style={{ backgroundColor: "#ef444415", borderRadius: 40, padding: 20 }}>
              <MaterialIcons name="date-range" size={48} color={colors.error} />
            </View>
            <Text style={{ color: colors.foreground, fontSize: 18, marginTop: 20, fontWeight: 'bold' }}>{isAr ? "اختر فترة صالحة" : "Choose a valid period"}</Text>
            <Text style={{ color: colors.muted, fontSize: 14, marginTop: 8, textAlign: 'center', paddingHorizontal: 32 }}>
              {isAr ? "لن يعرض التقرير أصفارًا بدل بيانات الفترة؛ اختر تاريخ بداية ونهاية من التقويم." : "The report does not show zeros in place of period data; choose start and end dates from the calendar."}
            </Text>
          </View>
        ) : visibleEntries.length === 0 ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80 }}>
            <View style={{ backgroundColor: "#0d948815", borderRadius: 40, padding: 20 }}>
              <MaterialIcons name="summarize" size={48} color="#0d9488" />
            </View>
            <Text style={{ color: colors.foreground, fontSize: 18, marginTop: 20, fontWeight: 'bold' }}>{isAr ? "لا توجد بيانات في الفترة" : "No data in this period"}</Text>
            <Text style={{ color: colors.muted, fontSize: 14, marginTop: 8, textAlign: 'center', paddingHorizontal: 32 }}>
              {isAr ? "لا توجد سجلات إنتاج مؤرخة ضمن النطاق المحدد." : "No dated production records fall within the selected range."}
            </Text>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {/* الإنتاج التام */}
            <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: colors.border }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'flex-end', marginBottom: 12 }}>
                <Text style={{ color: colors.foreground, fontWeight: 'bold', fontSize: 16 }}>{isAr ? "إنتاج تام (جميع المكائن)" : "Total Production (All Machines)"}</Text>
                <View style={{ backgroundColor: "#16a34a20", borderRadius: 14, padding: 5 }}>
                  <MaterialIcons name="check-circle" size={20} color="#16a34a" />
                </View>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 24 }}>
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ color: colors.primary, fontWeight: 'bold', fontSize: 24 }}>{grandDozen}</Text>
                  <Text style={{ color: colors.muted, fontSize: 14 }}>{isAr ? "درزن" : "Dozen"}</Text>
                </View>
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ color: colors.primary, fontWeight: 'bold', fontSize: 24 }}>{grandPairs}</Text>
                  <Text style={{ color: colors.muted, fontSize: 14 }}>{isAr ? "زوج" : "Pair"}</Text>
                </View>
              </View>
              <View style={{ backgroundColor: colors.background, borderRadius: 8, padding: 10, marginTop: 10, alignItems: "center" }}>
                <Text style={{ color: colors.primary, fontWeight: "800", fontSize: 18 }}>{grandPairsEquivalent}</Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>{isAr ? "إجمالي الأزواج المحولة (الدرازن × 12 + الأزواج)" : "Total converted pairs (dozen × 12 + pairs)"}</Text>
              </View>
            </View>

            <View style={{padding:10, backgroundColor:colors.surface,borderRadius:8}}><Text style={{color:colors.foreground,textAlign:"right",fontWeight:"800"}}>النخب الأول: {pairLabel(measured.firstPairs)} — النخب الثاني: {pairLabel(measured.secondPairs)}</Text><Text style={{color:colors.muted,textAlign:"right",fontSize:11}}>النخب الثاني جزء من إجمالي الإنتاج وليس كمية تضاف إليه. الإبر من القيم المدخلة وليست تقديرًا.</Text></View>
            {/* النخب الثاني - ملاحظة 1: تحويل من زوج لدرزن */}
            <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: colors.border }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'flex-end', marginBottom: 12 }}>
                <Text style={{ color: colors.foreground, fontWeight: 'bold', fontSize: 16 }}>{isAr ? "كمية النخب الثاني" : "Second Grade Quantity"}</Text>
                <View style={{ backgroundColor: "#f59e0b20", borderRadius: 14, padding: 5 }}>
                  <MaterialIcons name="low-priority" size={20} color="#f59e0b" />
                </View>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 24 }}>
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ color: "#f59e0b", fontWeight: "bold", fontSize: 22 }}>{secondConverted.dozens}</Text>
                  <Text style={{ color: colors.muted, fontSize: 14 }}>{isAr ? "درزن" : "Dozen"}</Text>
                </View>
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ color: "#f59e0b", fontWeight: "bold", fontSize: 22 }}>{secondConverted.remainingPairs}</Text>
                  <Text style={{ color: colors.muted, fontSize: 14 }}>{isAr ? "زوج" : "Pair"}</Text>
                </View>
              </View>
              {totalSecondPairsAll > 0 && (
                <Text style={{ color: colors.muted, fontSize: 12, textAlign: 'right', marginTop: 8 }}>
                  {isAr ? `(إجمالي: ${totalSecondPairsAll} زوج = ${secondConverted.dozens} درزن و ${secondConverted.remainingPairs} زوج)` : `(Total: ${totalSecondPairsAll} pairs = ${secondConverted.dozens} dozen & ${secondConverted.remainingPairs} pairs)`}
                </Text>
              )}
            </View>

            {/* كمية وزن الهدر */}
            <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: colors.border }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'flex-end', marginBottom: 12 }}>
                <Text style={{ color: colors.foreground, fontWeight: 'bold', fontSize: 16 }}>{isAr ? "كمية وزن الهدر" : "Waste Weight Quantity"}</Text>
                <View style={{ backgroundColor: "#ef444420", borderRadius: 14, padding: 5 }}>
                  <MaterialIcons name="delete-outline" size={20} color="#ef4444" />
                </View>
              </View>
              <View style={{ gap: 8 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.background, borderRadius: 8, padding: 12 }}>
                  <Text style={{ color: colors.error, fontWeight: 'bold', fontSize: 18 }}>{grandWasteThread.toFixed(0)} {isAr ? "جم" : "g"}</Text>
                  <Text style={{ color: colors.muted, fontSize: 14 }}>{isAr ? "هدر خيوط" : "Thread Waste"}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.background, borderRadius: 8, padding: 12 }}>
                  <Text style={{ color: colors.error, fontWeight: 'bold', fontSize: 18 }}>{grandWasteSocks.toFixed(0)} {isAr ? "جم" : "g"}</Text>
                  <Text style={{ color: colors.muted, fontSize: 14 }}>{isAr ? "هدر جوارب" : "Socks Waste"}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.background, borderRadius: 8, padding: 12, borderWidth: 1, borderColor: colors.error }}>
                  <Text style={{ color: colors.error, fontWeight: 'bold', fontSize: 18 }}>{grandWasteAll.toFixed(0)} {isAr ? "جم" : "g"}</Text>
                  <Text style={{ color: colors.foreground, fontWeight: '600', fontSize: 14 }}>{isAr ? "إجمالي الهدر" : "Total Waste"}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: `${wasteColor}12`, borderRadius: 8, padding: 12, borderWidth: 1, borderColor: wasteColor }}>
                  <Text style={{ color: wasteColor, fontWeight: 'bold', fontSize: 18 }}>{grandWastePercent == null ? (isAr ? "غير محسوبة — وزن غير مسجل" : "Not calculated") : `${grandWastePercent.toFixed(2)}%`}</Text>
                  <Text style={{ color: wasteColor, fontWeight: '700', fontSize: 14 }}>{isAr ? "نسبة الهدر من الخيوط المستخدمة" : "Waste % of used yarn"}</Text>
                </View>
              </View>
            </View>

            {/* وزن الخيوط المستخدمة */}
            <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: colors.border }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'flex-end', marginBottom: 12 }}>
                <Text style={{ color: colors.foreground, fontWeight: 'bold', fontSize: 16 }}>{isAr ? "وزن الخيوط المستخدمة (جميع الأنواع)" : "Used Yarn Weight (All Types)"}</Text>
                <View style={{ backgroundColor: "#0a7ea420", borderRadius: 14, padding: 5 }}>
                  <MaterialIcons name="scale" size={20} color="#0a7ea4" />
                </View>
              </View>
              <Text style={{ color: colors.primary, fontWeight: 'bold', fontSize: 24, textAlign: 'right', marginBottom: 12 }}>{grandYarnWeight.toFixed(0)} {isAr ? "جرام" : "Grams"}</Text>
                <View style={{ gap: 8 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.background, borderRadius: 8, padding: 8, paddingHorizontal: 12 }}>
                  <Text style={{ color: colors.foreground, fontWeight: '600' }}>{totalRubber.toFixed(0)} {isAr ? "جم" : "g"}</Text>
                  <Text style={{ color: colors.muted, fontSize: 14 }}>{isAr ? "مطاط" : "Rubber"}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.background, borderRadius: 8, padding: 8, paddingHorizontal: 12 }}>
                  <Text style={{ color: colors.foreground, fontWeight: '600' }}>{totalSpandex.toFixed(0)} {isAr ? "جم" : "g"}</Text>
                  <Text style={{ color: colors.muted, fontSize: 14 }}>{isAr ? "اسباندكس" : "Spandex"}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.background, borderRadius: 8, padding: 8, paddingHorizontal: 12 }}>
                  <Text style={{ color: colors.foreground, fontWeight: '600' }}>{totalNylon.toFixed(0)} {isAr ? "جم" : "g"}</Text>
                  <Text style={{ color: colors.muted, fontSize: 14 }}>{isAr ? "نايلون" : "Nylon"}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.background, borderRadius: 8, padding: 8, paddingHorizontal: 12 }}>
                  <Text style={{ color: colors.foreground, fontWeight: '600' }}>{totalCotton.toFixed(0)} {isAr ? "جم" : "g"}</Text>
                  <Text style={{ color: colors.muted, fontSize: 14 }}>{isAr ? "قطن" : "Cotton"}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.background, borderRadius: 8, padding: 8, paddingHorizontal: 12 }}>
                  <Text style={{ color: colors.foreground, fontWeight: '600' }}>{totalBamboo.toFixed(0)} {isAr ? "جم" : "g"}</Text>
                  <Text style={{ color: colors.muted, fontSize: 14 }}>{isAr ? "بامبو" : "Bamboo"}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.background, borderRadius: 8, padding: 8, paddingHorizontal: 12 }}>
                  <Text style={{ color: colors.foreground, fontWeight: '600' }}>{totalSpan.toFixed(0)} {isAr ? "جم" : "g"}</Text>
                  <Text style={{ color: colors.muted, fontSize: 14 }}>{isAr ? "اسبان" : "Span"}</Text>
                </View>
              </View>
              <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 }}>
                <Text style={{ color: colors.foreground, fontWeight: "800", textAlign: "right", marginBottom: 7 }}>{isAr ? "التفصيل حسب المنتج والماكينة" : "Detail by product and machine"}</Text>
                {yarnDetails.map((row) => <View key={row.key} style={{ backgroundColor: colors.background, borderRadius: 8, padding: 9, marginBottom: 7 }}>
                  <Text style={{ color: colors.foreground, fontWeight: "700", textAlign: "right" }}>{row.productName} — {row.machine} — {row.date}</Text>
                  <Text style={{ color: colors.muted, fontSize: 10, textAlign: "right", marginTop: 3 }}>{isAr ? `الكمية: ${row.pairs} زوج | وزن الزوج: ${row.yarnWeightPerPair.toFixed(2)} جم` : `Quantity: ${row.pairs} pairs | Pair weight: ${row.yarnWeightPerPair.toFixed(2)} g`}</Text>
                  {row.values.filter((value) => value.perPair > 0 || value.total > 0).map((value) => <Text key={value.label} style={{ color: colors.primary, fontSize: 10, textAlign: "right", marginTop: 2 }}>{value.label}: {value.perPair.toFixed(2)} {isAr ? "جم/زوج" : "g/pair"} × {row.pairs} = {value.total.toFixed(2)} {isAr ? "جم إجمالي" : "g total"}</Text>)}
                </View>)}
              </View>
            </View>

            {/* هدر الإبر */}
            <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: colors.border }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'flex-end', marginBottom: 12 }}>
                <Text style={{ color: colors.foreground, fontWeight: 'bold', fontSize: 16 }}>{isAr ? "كمية هدر الإبر" : "Needles Waste Quantity"}</Text>
                <View style={{ backgroundColor: "#6b728020", borderRadius: 14, padding: 5 }}>
                  <MaterialIcons name="push-pin" size={20} color="#6b7280" />
                </View>
              </View>
              <Text style={{ color: colors.foreground, fontWeight: 'bold', fontSize: 24, textAlign: 'right' }}>{grandNeedles} {isAr ? "حبة تالفة" : "damaged pcs"} — {measured.needlesUsed} {isAr ? "حبة مستخدمة" : "used pcs"}</Text>
            </View>

            {/* نسبة الهدر */}
            <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, borderColor: wasteColor, borderWidth: 2 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'flex-end', marginBottom: 12 }}>
                <Text style={{ color: colors.foreground, fontWeight: 'bold', fontSize: 16 }}>{isAr ? "نسبة الهدر" : "Waste Percentage"}</Text>
                <View style={{ backgroundColor: wasteColor + "20", borderRadius: 14, padding: 5 }}>
                  <MaterialIcons name="percent" size={20} color={wasteColor} />
                </View>
              </View>
              <Text style={{ color: wasteColor, fontWeight: "bold", fontSize: 28, textAlign: "right" }}>
                {grandWastePercent == null ? (isAr ? "غير محسوبة — وزن غير مسجل" : "Not calculated") : `${grandWastePercent.toFixed(2)}%`}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12, textAlign: 'right', marginTop: 8 }}>
                {isAr ? "إجمالي الهدر / وزن الخيوط × 100" : "Total Waste / Yarn Weight × 100"}
              </Text>
              <View style={{ backgroundColor: wasteColor + "15", borderRadius: 8, padding: 8, marginTop: 8 }}>
                <Text style={{ color: wasteColor, fontWeight: "600", textAlign: "right", fontSize: 13 }}>
                  {(grandWastePercent ?? 0) > 5 ? (isAr ? "⚠️ تجاوز الحد المسموح (5%)" : "⚠️ Exceeded allowed limit (5%)") : (isAr ? "✅ ضمن الحد المسموح (5%)" : "✅ Within allowed limit (5%)")}
                </Text>
              </View>
            </View>

            {/* مدة الإنتاج الإجمالية */}
            <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: colors.border }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'flex-end', marginBottom: 12 }}>
                <Text style={{ color: colors.foreground, fontWeight: 'bold', fontSize: 16 }}>{isAr ? "مدة الإنتاج الإجمالية" : "Total Production Time"}</Text>
                <View style={{ backgroundColor: "#8b5cf620", borderRadius: 14, padding: 5 }}>
                  <MaterialIcons name="timer" size={20} color="#8b5cf6" />
                </View>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 16 }}>
                <Text style={{ color: colors.muted, fontSize: 14 }}><Text style={{ color: "#8b5cf6", fontWeight: "bold", fontSize: 20 }}>{Math.round(grandMinutes)}</Text> {isAr ? "دقيقة" : "Minute"}</Text>
                <Text style={{ color: colors.muted, fontSize: 14 }}><Text style={{ color: "#8b5cf6", fontWeight: "bold", fontSize: 20 }}>{grandHours}</Text> {isAr ? "ساعة" : "Hour"}</Text>
              </View>
            </View>

            {/* ملاحظة 2: ملخص حسب المنتج - تجميع المنتجات المتكررة */}
            {(() => {
              const productSummary: Record<string, { dozen: number; pairs: number; machines: string[] }> = {};
              visibleEntries.forEach(entry => {
                Object.entries(entry.machines).forEach(([machine, m]) => {
                  const name = [(m.productName || "").trim() || (isAr ? "بدون اسم" : "Unnamed"), m.productSize, m.productColor].filter(Boolean).join(" — ");
                  if (!productSummary[name]) productSummary[name] = { dozen: 0, pairs: 0, machines: [] };
                  productSummary[name].dozen += parseFloat(m.productionDozen) || 0;
                  productSummary[name].pairs += parseFloat(m.productionPairs) || 0;
                  if (!productSummary[name].machines.includes(machine)) productSummary[name].machines.push(machine);
                });
              });
              const products = Object.entries(productSummary);
              if (products.length === 0) return null;
              return (
                <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: colors.border }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'flex-end', marginBottom: 12 }}>
                    <Text style={{ color: colors.foreground, fontWeight: 'bold', fontSize: 16 }}>{isAr ? "الإنتاج حسب المنتج" : "Production by Product"}</Text>
                    <View style={{ backgroundColor: "#14b8a620", borderRadius: 14, padding: 5 }}>
                      <MaterialIcons name="category" size={20} color="#14b8a6" />
                    </View>
                  </View>
                  <View style={{ gap: 8 }}>
                    {products.map(([name, data]) => (
                      <View key={name} style={{ backgroundColor: colors.background, borderRadius: 8, padding: 10 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <View style={{ flexDirection: 'row', gap: 8 }}>
                            <Text style={{ color: "#14b8a6", fontWeight: 'bold', fontSize: 15 }}>{Math.floor((data.dozen * 12 + data.pairs) / 12)} {isAr ? "درزن" : "dz"}</Text>
                            {(data.dozen * 12 + data.pairs) % 12 > 0 && <Text style={{ color: colors.muted, fontSize: 12 }}>+ {(data.dozen * 12 + data.pairs) % 12} {isAr ? "زوج" : "pr"}</Text>}
                          </View>
                          <Text style={{ color: colors.foreground, fontWeight: '700', fontSize: 14, textAlign: 'right', flex: 1, marginLeft: 8 }}>{name}</Text>
                        </View>
                        <Text style={{ color: colors.muted, fontSize: 11, textAlign: 'right', marginTop: 5 }}>
                          {isAr ? `المكائن: ${data.machines.join("، ")}` : `Machines: ${data.machines.join(", ")}`}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              );
            })()}

            {/* تقرير المكائن غير المستخدمة */}
            <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: "#f59e0b" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, justifyContent: "flex-end", marginBottom: 10 }}>
                <Text style={{ color: colors.foreground, fontWeight: "bold", fontSize: 16 }}>{isAr ? "تقرير عمل مكائن الإنتاج" : "Production Machine Work Report"}</Text>
                <View style={{ backgroundColor: "#f59e0b20", borderRadius: 14, padding: 5 }}><MaterialIcons name="warning" size={20} color="#f59e0b" /></View>
              </View>
              <Text style={{ color: colors.muted, fontSize: 12, textAlign: "right", marginBottom: 10 }}>{isAr ? "تظهر هنا المكائن التي لم يظهر لها إنتاج في كل تاريخ." : "Machines without recorded production appear here for each date."}</Text>
              {visibleEntries.map((entry) => {
                const unused = unusedMachinesFor(entry);
                if (!unused.length) return null;
                return <View key={`unused-${entry.date}`} style={{ marginBottom: 12 }}>
                  <Text style={{ color: colors.foreground, fontWeight: "800", textAlign: "right", marginBottom: 6 }}>{isAr ? `تاريخ التقرير: ${entry.date}` : `Report date: ${entry.date}`}</Text>
                  {unused.map((machine) => {
                    const key = `${entry.date}:${machine}`;
                    const selected = stopReasons[key];
                    return <View key={machine} style={{ backgroundColor: colors.background, borderRadius: 9, padding: 10, marginBottom: 7, borderWidth: 1, borderColor: savedStops[key] ? "#22c55e" : colors.border }}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                        <Text style={{ color: colors.muted, fontSize: 11 }}>{isAr ? `وقت التقرير: ${new Date().toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}` : `Report time: ${new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`}</Text>
                        <Text style={{ color: colors.foreground, fontWeight: "800" }}>{isAr ? `الماكينة: ${machine}` : `Machine: ${machine}`}</Text>
                      </View>
                      <Text style={{ color: colors.muted, fontSize: 11, textAlign: "right", marginTop: 4 }}>{isAr ? "سبب عدم التشغيل:" : "Reason for non-operation:"}</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginTop: 6 }}>
                        {STOP_REASONS.map((reason) => <TouchableOpacity key={reason.ar} onPress={() => setStopReasons((current) => ({ ...current, [key]: isAr ? reason.ar : reason.en }))} style={{ borderWidth: 1, borderColor: selected === (isAr ? reason.ar : reason.en) ? "#f59e0b" : colors.border, backgroundColor: selected === (isAr ? reason.ar : reason.en) ? "#fef3c7" : colors.surface, borderRadius: 8, paddingVertical: 7, paddingHorizontal: 9 }}><Text style={{ color: colors.foreground, fontSize: 11, textAlign: "center" }}>{isAr ? reason.ar : reason.en}</Text></TouchableOpacity>)}
                      </ScrollView>
                      <TextInput value={selected || ""} editable={false} placeholder={isAr ? "اختر السبب من القائمة" : "Select a reason above"} placeholderTextColor={colors.muted} style={{ color: colors.foreground, textAlign: "right", borderWidth: 1, borderColor: colors.border, borderRadius: 7, padding: 8, marginTop: 7 }} />
                      <TouchableOpacity disabled={savedStops[key]} onPress={() => saveStoppedMachine(machine, entry.date)} style={{ backgroundColor: savedStops[key] ? "#22c55e" : "#f59e0b", borderRadius: 8, padding: 9, alignItems: "center", marginTop: 8, opacity: savedStops[key] ? 0.75 : 1 }}><Text style={{ color: "#fff", fontWeight: "800" }}>{savedStops[key] ? (isAr ? "تم الحفظ" : "Saved") : (isAr ? "حفظ تقرير عدم التشغيل" : "Save non-operation report")}</Text></TouchableOpacity>
                    </View>;
                  })}
                </View>;
              })}
            </View>

            {/* ملخص حسب الوردية */}
            {(() => {
              const shiftSummary: Record<string, { dozen: number; count: number }> = {};
              visibleEntries.forEach(entry => {
                Object.values(entry.machines).forEach(m => {
                  const shift = `${isAr ? "وردية" : "Shift"} ${m.shiftNumber || "1"}`;
                  if (!shiftSummary[shift]) shiftSummary[shift] = { dozen: 0, count: 0 };
                  shiftSummary[shift].dozen += exactPairs(m, "production") / 12;
                  shiftSummary[shift].count += 1;
                });
              });
              const shifts = Object.entries(shiftSummary);
              if (shifts.length <= 1) return null;
              return (
                <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: colors.border }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'flex-end', marginBottom: 12 }}>
                    <Text style={{ color: colors.foreground, fontWeight: 'bold', fontSize: 16 }}>{isAr ? "الإنتاج حسب الوردية" : "Production by Shift"}</Text>
                    <View style={{ backgroundColor: "#6366f120", borderRadius: 14, padding: 5 }}>
                      <MaterialIcons name="schedule" size={20} color="#6366f1" />
                    </View>
                  </View>
                  <View style={{ gap: 8 }}>
                    {shifts.map(([name, data]) => (
                      <View key={name} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.background, borderRadius: 8, padding: 12 }}>
                        <View style={{ flexDirection: 'row', gap: 12 }}>
                          <Text style={{ color: "#6366f1", fontWeight: 'bold', fontSize: 16 }}>{Math.floor(data.dozen)} {isAr ? "درزن" : "dz"} + {Math.round((data.dozen % 1) * 12)} {isAr ? "زوج" : "pairs"}</Text>
                          <Text style={{ color: colors.muted, fontSize: 13 }}>({data.count} {isAr ? "إدخال" : "entries"})</Text>
                        </View>
                        <Text style={{ color: colors.foreground, fontWeight: '600', fontSize: 14 }}>{name}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              );
            })()}
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
