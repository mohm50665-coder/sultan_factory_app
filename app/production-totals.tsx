import { BackButton } from "@/components/back-button";
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { MaterialIcons } from "@expo/vector-icons";
import { useState, useEffect } from "react";
import { useLanguage } from "@/lib/language-context";
import { maintenanceService, productionService } from "@/lib/services/api.service";
import { useAuth } from "@/lib/auth-context";



interface MachineData {
  productionDozen: string;
  productionPairs: string;
  wasteThreadGrams: string;
  wasteSocksGrams: string;
  secondGradeDozen: string;
  secondGradePairs: string;
  wasteNeedles: string;
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
  const [reportPeriod, setReportPeriod] = useState<"all" | "day" | "week" | "month">("all");
  const [reportDate, setReportDate] = useState(() => new Date().toISOString().slice(0, 10));

  const visibleEntries = entries.filter((entry) => {
    if (reportPeriod === "all") return true;
    const entryDate = new Date(`${entry.date}T00:00:00`);
    const selected = new Date(`${reportDate}T00:00:00`);
    if (Number.isNaN(entryDate.getTime()) || Number.isNaN(selected.getTime())) return false;
    if (reportPeriod === "day") return entry.date === reportDate;
    if (reportPeriod === "month") return entryDate.getFullYear() === selected.getFullYear() && entryDate.getMonth() === selected.getMonth();
    const start = new Date(selected);
    const day = start.getDay();
    start.setDate(start.getDate() - (day === 0 ? 6 : day - 1));
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return entryDate >= start && entryDate <= end;
  });

  useEffect(() => {
    loadEntries();
  }, []);

  const loadEntries = async () => {
    try {
      const data = await productionService.getAll();
      if (data && data.length > 0) {
        const grouped: { [date: string]: { [key: string]: MachineData } } = {};
        data.forEach((item: any) => {
          const date = item.date || item.entryDate || "unknown";
          if (!grouped[date]) grouped[date] = {};
          const machine = item.machineNumber || "unknown";
          const shift = item.shiftNumber || "1";
          const key = `${machine}_S${shift}_${item.productName || ""}`;
          grouped[date][key] = {
            productionDozen: String(item.productionDozen || "0"),
            productionPairs: String(item.productionPairs || "0"),
            wasteThreadGrams: String(item.wasteThreadGrams || "0"),
            wasteSocksGrams: String(item.wasteSocksGrams || "0"),
            secondGradeDozen: String(item.secondGradeDozen || "0"),
            secondGradePairs: String(item.secondGradePairs || "0"),
            wasteNeedles: String(item.wasteNeedles || "0"),
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
        const entriesArray = Object.entries(grouped).map(([date, machines]) => ({
          id: date,
          date,
          machines,
        }));
        setEntries(entriesArray);
      }
    } catch (e) {
      console.error("Error loading entries:", e);
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

  // تحويل الدقائق الزائدة لساعات
  grandHours += Math.floor(grandMinutes / 60);
  grandMinutes = grandMinutes % 60;

  // ملاحظة 1: تحويل النخب الثاني - تجميع كل الأزواج ثم التحويل
  const totalSecondPairsAll = grandSecondPairs + (grandSecondDozen * 12);
  const secondConverted = convertPairsToDozens(totalSecondPairsAll);

  const grandWasteAll = grandWasteThread + grandWasteSocks;
  const grandWastePercent = grandYarnWeight > 0 ? ((grandWasteAll / grandYarnWeight) * 100) : 0;
  const wasteColor = grandWastePercent > 5 ? "#ef4444" : "#22c55e";
  const yarnDetails = visibleEntries.flatMap((entry) => Object.entries(entry.machines).map(([machine, m]) => ({
    key: `${entry.date}-${machine}`,
    date: entry.date,
    machine,
    productName: m.productName || (isAr ? "بدون اسم" : "Unnamed"),
    pairs: (parseFloat(m.productionDozen) || 0) * 12 + (parseFloat(m.productionPairs) || 0),
    yarnWeightPerPair: parseFloat(m.yarnWeightPerPair) || 0,
    values: YARN_FIELDS.map(([field, ar, en]) => ({ label: isAr ? ar : en, perPair: parseFloat(m[field]) || 0, total: (parseFloat(m[field]) || 0) * ((parseFloat(m.productionDozen) || 0) * 12 + (parseFloat(m.productionPairs) || 0)) })),
  })));

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      {/* الهيدر */}
      <View style={{ backgroundColor: "#0d9488", paddingVertical: 16, paddingHorizontal: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ width: 40 }} />
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ color: '#ffffff', fontWeight: 'bold', fontSize: 20 }}>{isAr ? "إجمالي بيانات المكائن" : "Total Machines Data"}</Text>
            <Text style={{ fontSize: 14, marginTop: 4, color: 'rgba(255,255,255,0.8)' }}>{visibleEntries.length} {isAr ? "سجل" : "Record"}</Text>
          </View>
          <BackButton />
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: colors.border, marginBottom: 12 }}>
          <Text style={{ color: colors.foreground, fontWeight: "800", textAlign: "right", marginBottom: 8 }}>{isAr ? "فترة تقرير إنتاج المكائن" : "Machine production report period"}</Text>
          <TextInput value={reportDate} onChangeText={setReportDate} placeholder="YYYY-MM-DD" placeholderTextColor={colors.muted} style={{ color: colors.foreground, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 9, textAlign: "right", marginBottom: 8 }} />
          <View style={{ flexDirection: isAr ? "row-reverse" : "row", gap: 6 }}>
            {([["all", isAr ? "كل السجلات" : "All"], ["day", isAr ? "يومي" : "Daily"], ["week", isAr ? "أسبوعي" : "Weekly"], ["month", isAr ? "شهري" : "Monthly"]] as [typeof reportPeriod, string][]).map(([key, label]) => <TouchableOpacity key={key} onPress={() => setReportPeriod(key)} style={{ flex: 1, backgroundColor: reportPeriod === key ? "#0d9488" : colors.background, borderWidth: 1, borderColor: reportPeriod === key ? "#0d9488" : colors.border, borderRadius: 8, paddingVertical: 8, alignItems: "center" }}><Text style={{ color: reportPeriod === key ? "#fff" : colors.foreground, fontSize: 11, fontWeight: "700" }}>{label}</Text></TouchableOpacity>)}
          </View>
          <Text style={{ color: colors.muted, fontSize: 10, textAlign: "right", marginTop: 7 }}>{isAr ? `عدد سجلات الفترة: ${visibleEntries.length}` : `Records in period: ${visibleEntries.length}`}</Text>
        </View>
        {visibleEntries.length === 0 ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80 }}>
            <View style={{ backgroundColor: "#0d948815", borderRadius: 40, padding: 20 }}>
              <MaterialIcons name="summarize" size={48} color="#0d9488" />
            </View>
            <Text style={{ color: colors.foreground, fontSize: 18, marginTop: 20, fontWeight: 'bold' }}>{isAr ? "لا توجد بيانات" : "No Data"}</Text>
            <Text style={{ color: colors.muted, fontSize: 14, marginTop: 8, textAlign: 'center', paddingHorizontal: 32 }}>
              {isAr ? "لم يتم تسجيل أي بيانات إنتاج بعد." : "No production data has been recorded yet."}
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
                  <Text style={{ color: wasteColor, fontWeight: 'bold', fontSize: 18 }}>{grandWastePercent.toFixed(2)}%</Text>
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
              <Text style={{ color: colors.foreground, fontWeight: 'bold', fontSize: 24, textAlign: 'right' }}>{grandNeedles} {isAr ? "حبة" : "pcs"}</Text>
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
                {grandWastePercent.toFixed(2)}%
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12, textAlign: 'right', marginTop: 8 }}>
                {isAr ? "إجمالي الهدر / وزن الخيوط × 100" : "Total Waste / Yarn Weight × 100"}
              </Text>
              <View style={{ backgroundColor: wasteColor + "15", borderRadius: 8, padding: 8, marginTop: 8 }}>
                <Text style={{ color: wasteColor, fontWeight: "600", textAlign: "right", fontSize: 13 }}>
                  {grandWastePercent > 5 ? (isAr ? "⚠️ تجاوز الحد المسموح (5%)" : "⚠️ Exceeded allowed limit (5%)") : (isAr ? "✅ ضمن الحد المسموح (5%)" : "✅ Within allowed limit (5%)")}
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
                  const name = (m.productName || "").trim() || (isAr ? "بدون اسم" : "Unnamed");
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
                            <Text style={{ color: "#14b8a6", fontWeight: 'bold', fontSize: 15 }}>{data.dozen} {isAr ? "درزن" : "dz"}</Text>
                            {data.pairs > 0 && <Text style={{ color: colors.muted, fontSize: 12 }}>+ {data.pairs} {isAr ? "زوج" : "pr"}</Text>}
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
                  shiftSummary[shift].dozen += parseFloat(m.productionDozen) || 0;
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
                          <Text style={{ color: "#6366f1", fontWeight: 'bold', fontSize: 16 }}>{data.dozen} {isAr ? "درزن" : "dz"}</Text>
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
