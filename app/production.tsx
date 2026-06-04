import React, { useState, useEffect } from "react";
import { useLanguage } from "@/lib/language-context";
import { BackButton } from "@/components/back-button";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { MaterialIcons } from "@expo/vector-icons";
import { productionService } from "@/lib/services/api.service";
import { useAuth } from "@/lib/auth-context";
import { AdminBadgeIcon } from "@/components/admin-badge-icon";
import { AdminCard } from "@/components/admin-card";


// أرقام المكائن
const MACHINES = [
  "RB1", "RB2", "RB3", "RB4", "RB5", "RB6", "RB7", "RB8", "RB9",
  "NS1",
  "RS1", "RS2", "RS3", "RS4", "RS5", "RS6", "RS7", "RS8", "RS9", "RS10", "RS11",
  "LT1", "LT2",
];

interface MachineData {
  productionDozen: string;
  productionPairs: string;
  wasteThreadGrams: string;
  wasteSocksGrams: string;
  secondGradeDozen: string;
  secondGradePairs: string;
  wasteNeedles: string;
  // مدة الإنتاج
  productionHours: string;
  productionMinutes: string;
  // وزن الخيوط حسب النوع (بالجرام)
  yarnRubber: string;      // مطاط
  yarnSpandex: string;     // اسباندكس
  yarnNylon: string;       // نايلون
  yarnCotton: string;      // قطن
  yarnBamboo: string;      // بامبو
  yarnSpan: string;        // اسبان
}

interface ProductionEntry {
  id: string;
  date: string;
  machines: { [key: string]: MachineData };
}



const emptyMachineData = (): MachineData => ({
  productionDozen: "",
  productionPairs: "",
  wasteThreadGrams: "",
  wasteSocksGrams: "",
  secondGradeDozen: "",
  secondGradePairs: "",
  wasteNeedles: "",
  productionHours: "",
  productionMinutes: "",
  yarnRubber: "",
  yarnSpandex: "",
  yarnNylon: "",
  yarnCotton: "",
  yarnBamboo: "",
  yarnSpan: "",
});

// تنسيق التاريخ
const formatDate = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export default function ProductionScreen() {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const router = useRouter();
  const colors = useColors();
  const { user } = useAuth();
  const [entries, setEntries] = useState<ProductionEntry[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ProductionEntry | null>(null);
  const [showDailySummary, setShowDailySummary] = useState(false);
  const [isLoading, setIsLoading] = useState(false);


  // حقل التاريخ الموحد
  const [selectedDate, setSelectedDate] = useState(formatDate(new Date()));

  // بيانات كل مكينة
  const [machinesData, setMachinesData] = useState<{ [key: string]: MachineData }>({});

  // المكائن المفعلة (التي عملت في هذا اليوم)
  const [activeMachines, setActiveMachines] = useState<string[]>([]);

  useEffect(() => {
    loadEntries();
  }, []);

  const loadEntries = async () => {
    try {
      setIsLoading(true);
      const rows = await productionService.getAll() || [];
      // تحويل الصفوف المسطحة إلى بنية مجمّعة حسب التاريخ
      const grouped: { [date: string]: { [machine: string]: MachineData } } = {};
      for (const row of rows) {
        const d = row.date || "";
        if (!grouped[d]) grouped[d] = {};
        grouped[d][row.machineNumber] = {
          productionDozen: String(row.productionDozen || 0),
          productionPairs: String(row.productionPairs || 0),
          wasteThreadGrams: String(row.wasteThreadGrams || 0),
          wasteSocksGrams: String(row.wasteSocksGrams || 0),
          secondGradeDozen: String(row.secondGradeDozen || 0),
          secondGradePairs: String(row.secondGradePairs || 0),
          wasteNeedles: String(row.wasteNeedles || 0),
          productionHours: String(row.productionHours || 0),
          productionMinutes: String(row.productionMinutes || 0),
          yarnRubber: String(row.yarnRubber || 0),
          yarnSpandex: String(row.yarnSpandex || 0),
          yarnNylon: String(row.yarnNylon || 0),
          yarnCotton: String(row.yarnCotton || 0),
          yarnBamboo: String(row.yarnBamboo || 0),
          yarnSpan: String(row.yarnSpan || 0),
        };
      }
      const loadedEntries: ProductionEntry[] = Object.keys(grouped)
        .sort((a, b) => b.localeCompare(a))
        .map((date) => ({
          id: date,
          date,
          machines: grouped[date],
        }));
      setEntries(loadedEntries);
    } catch (e) {
      console.log("Error loading production:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const saveToServer = async (entry: ProductionEntry, isEdit: boolean) => {
    try {
      const userId = user?.id || 1;
      // حذف السجلات القديمة لهذا التاريخ إذا كان تعديل
      if (isEdit) {
        await productionService.deleteByDate(entry.date);
      }
      // إنشاء سجلات جديدة لكل مكينة
      const batchEntries = Object.entries(entry.machines).map(([machine, data]) => ({
        date: entry.date,
        machineNumber: machine,
        productionDozen: parseInt(data.productionDozen) || 0,
        productionPairs: parseInt(data.productionPairs) || 0,
        wasteThreadGrams: parseInt(data.wasteThreadGrams) || 0,
        wasteSocksGrams: parseInt(data.wasteSocksGrams) || 0,
        secondGradeDozen: parseInt(data.secondGradeDozen) || 0,
        secondGradePairs: parseInt(data.secondGradePairs) || 0,
        wasteNeedles: parseInt(data.wasteNeedles) || 0,
        productionHours: parseInt(data.productionHours) || 0,
        productionMinutes: parseInt(data.productionMinutes) || 0,
        yarnRubber: parseInt(data.yarnRubber) || 0,
        yarnSpandex: parseInt(data.yarnSpandex) || 0,
        yarnNylon: parseInt(data.yarnNylon) || 0,
        yarnCotton: parseInt(data.yarnCotton) || 0,
        yarnBamboo: parseInt(data.yarnBamboo) || 0,
        yarnSpan: parseInt(data.yarnSpan) || 0,
        userId,
      }));
      if (batchEntries.length > 0) {
        await productionService.createBatch(batchEntries);
      }
    } catch (e) {
      console.log("Error saving to server:", e);
      throw e;
    }
  };

  const resetForm = () => {
    setSelectedDate(formatDate(new Date()));
    setMachinesData({});
    setActiveMachines([]);
    setEditingEntry(null);
  };

  const toggleMachine = (machine: string) => {
    if (activeMachines.includes(machine)) {
      setActiveMachines(activeMachines.filter((m) => m !== machine));
      const newData = { ...machinesData };
      delete newData[machine];
      setMachinesData(newData);
    } else {
      setActiveMachines([...activeMachines, machine]);
      setMachinesData({ ...machinesData, [machine]: emptyMachineData() });
    }
  };

  const updateMachineField = (machine: string, field: keyof MachineData, value: string) => {
    setMachinesData({
      ...machinesData,
      [machine]: {
        ...(machinesData[machine] || emptyMachineData()),
        [field]: value,
      },
    });
  };

  const handleSave = async () => {
    if (activeMachines.length === 0) {
      Alert.alert(isAr ? "تنبيه" : "Alert", isAr ? "يرجى اختيار مكينة واحدة على الأقل" : "Please select at least one machine");
      return;
    }

    // تصفية المكائن التي لديها بيانات
    const filteredMachines: { [key: string]: MachineData } = {};
    activeMachines.forEach((machine) => {
      const data = machinesData[machine] || emptyMachineData();
      filteredMachines[machine] = {
        productionDozen: data.productionDozen || "0",
        productionPairs: data.productionPairs || "0",
        wasteThreadGrams: data.wasteThreadGrams || "0",
        wasteSocksGrams: data.wasteSocksGrams || "0",
        secondGradeDozen: data.secondGradeDozen || "0",
        secondGradePairs: data.secondGradePairs || "0",
        wasteNeedles: data.wasteNeedles || "0",
        productionHours: data.productionHours || "0",
        productionMinutes: data.productionMinutes || "0",
        yarnRubber: data.yarnRubber || "0",
        yarnSpandex: data.yarnSpandex || "0",
        yarnNylon: data.yarnNylon || "0",
        yarnCotton: data.yarnCotton || "0",
        yarnBamboo: data.yarnBamboo || "0",
        yarnSpan: data.yarnSpan || "0",
      };
    });

    const entry: ProductionEntry = {
      id: editingEntry?.id || Date.now().toString(),
      date: selectedDate,
      machines: filteredMachines,
    };

    let newEntries: ProductionEntry[];
    if (editingEntry) {
      newEntries = entries.map((e) => (e.id === editingEntry.id ? entry : e));
    } else {
      newEntries = [entry, ...entries];
    }

    try {
      await saveToServer(entry, !!editingEntry);
      await loadEntries();
      resetForm();
      setShowForm(false);
      Alert.alert(isAr ? "تم بنجاح ✓" : "Success ✓", editingEntry ? isAr ? "تم تعديل البيانات" : "Data updated" : isAr ? "تم حفظ البيانات" : "Data saved");
    } catch (e) {
      Alert.alert(isAr ? "خطأ" : "Error", isAr ? "فشل حفظ البيانات" : "Failed to save data");
    }
  };

  const handleEdit = (entry: ProductionEntry) => {
    setSelectedDate(entry.date);
    setMachinesData(entry.machines);
    setActiveMachines(Object.keys(entry.machines));
    setEditingEntry(entry);
    setShowForm(true);
  };

  const handleDelete = async (entry: ProductionEntry) => {
    if (Platform.OS === "web") {
      const confirmed = confirm(isAr ? `هل تريد حذف بيانات يوم "${entry.date}"؟` : `Do you want to delete data for day "${entry.date}"?`);
      if (confirmed) {
        try {
          await productionService.deleteByDate(entry.date);
          await loadEntries();
        } catch (e) { console.log(e); }
      }
    } else {
      Alert.alert(isAr ? "تأكيد الحذف" : "Confirm Deletion", isAr ? `هل تريد حذف بيانات يوم "${entry.date}"؟` : `Do you want to delete data for day "${entry.date}"?`, [
        { text: isAr ? "إلغاء" : "Cancel", style: "cancel" },
        {
          text: isAr ? "حذف" : "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await productionService.deleteByDate(entry.date);
              await loadEntries();
            } catch (e) { console.log(e); }
          },
        },
      ]);
    }
  };

  // حساب إجمالي وزن الخيوط لمكينة واحدة
  const getMachineTotalYarn = (m: MachineData): number => {
    return (
      (parseFloat(m.yarnRubber) || 0) +
      (parseFloat(m.yarnSpandex) || 0) +
      (parseFloat(m.yarnNylon) || 0) +
      (parseFloat(m.yarnCotton) || 0) +
      (parseFloat(m.yarnBamboo) || 0) +
      (parseFloat(m.yarnSpan) || 0)
    );
  };

  // حساب المجاميع لسجل واحد
  const getEntryTotals = (entry: ProductionEntry) => {
    let totalDozen = 0;
    let totalPairs = 0;
    let totalWasteThread = 0;
    let totalWasteSocks = 0;
    let totalSecondDozen = 0;
    let totalSecondPairs = 0;
    let totalNeedles = 0;
    let totalHours = 0;
    let totalMinutes = 0;
    let totalYarnRubber = 0;
    let totalYarnSpandex = 0;
    let totalYarnNylon = 0;
    let totalYarnCotton = 0;
    let totalYarnBamboo = 0;
    let totalYarnSpan = 0;

    Object.values(entry.machines).forEach((m) => {
      totalDozen += parseFloat(m.productionDozen) || 0;
      totalPairs += parseFloat(m.productionPairs) || 0;
      totalWasteThread += parseFloat(m.wasteThreadGrams) || 0;
      totalWasteSocks += parseFloat(m.wasteSocksGrams) || 0;
      totalSecondDozen += parseFloat(m.secondGradeDozen) || 0;
      totalSecondPairs += parseFloat(m.secondGradePairs) || 0;
      totalNeedles += parseFloat(m.wasteNeedles) || 0;
      totalHours += parseFloat(m.productionHours) || 0;
      totalMinutes += parseFloat(m.productionMinutes) || 0;
      totalYarnRubber += parseFloat(m.yarnRubber) || 0;
      totalYarnSpandex += parseFloat(m.yarnSpandex) || 0;
      totalYarnNylon += parseFloat(m.yarnNylon) || 0;
      totalYarnCotton += parseFloat(m.yarnCotton) || 0;
      totalYarnBamboo += parseFloat(m.yarnBamboo) || 0;
      totalYarnSpan += parseFloat(m.yarnSpan) || 0;
    });

    // تحويل الدقائق الزائدة إلى ساعات
    totalHours += Math.floor(totalMinutes / 60);
    totalMinutes = totalMinutes % 60;

    const totalYarnWeight = totalYarnRubber + totalYarnSpandex + totalYarnNylon + totalYarnCotton + totalYarnBamboo + totalYarnSpan;
    // إجمالي كمية الهدر = هدر الخيوط + هدر الجوارب
    const totalWasteAll = totalWasteThread + totalWasteSocks;
    // نسبة الهدر = إجمالي كمية الهدر / إجمالي وزن الخيوط * 100
    const wastePercentage = totalYarnWeight > 0 ? ((totalWasteAll / totalYarnWeight) * 100).toFixed(2) : "0";

    return {
      totalDozen, totalPairs, totalWasteThread, totalWasteSocks, totalSecondDozen, totalSecondPairs, totalNeedles,
      totalHours, totalMinutes,
      totalYarnRubber, totalYarnSpandex, totalYarnNylon, totalYarnCotton, totalYarnBamboo, totalYarnSpan,
      totalYarnWeight, totalWasteAll, wastePercentage,
    };
  };

  // عرض سجل إنتاج يوم كامل
  const renderEntry = (entry: ProductionEntry) => {
    const totals = getEntryTotals(entry);
    const machineKeys = Object.keys(entry.machines);

    return (
      <View key={entry.id} style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: colors.border }}>
        {/* رأس السجل */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              onPress={() => handleEdit(entry)}
              style={{ backgroundColor: "#0a7ea415", borderRadius: 20, padding: 8 }}
            >
              <MaterialIcons name="edit" size={18} color="#0a7ea4" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleDelete(entry)}
              style={{ backgroundColor: "#ef444415", borderRadius: 20, padding: 8 }}
            >
              <MaterialIcons name="delete" size={18} color="#ef4444" />
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ color: colors.foreground, fontWeight: 'bold', fontSize: 16 }}>{entry.date}</Text>
            <MaterialIcons name="calendar-today" size={18} color="#16a34a" />
          </View>
        </View>

        {/* بيانات كل مكينة */}
        {machineKeys.map((machine) => {
          const data = entry.machines[machine];
          const machineYarnTotal = getMachineTotalYarn(data);
          const machineWastePercent = machineYarnTotal > 0
            ? (((parseFloat(data.wasteThreadGrams) || 0) / machineYarnTotal) * 100).toFixed(2)
            : "0";
          return (
            <View key={machine} style={{ backgroundColor: colors.background, borderRadius: 8, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: colors.border }}>
              <Text style={{ color: colors.foreground, fontWeight: 'bold', fontSize: 14, marginBottom: 8, textAlign: 'right' }}>{machine}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, rowGap: 4, justifyContent: 'flex-end' }}>
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  {isAr ? "إنتاج:" : "Production:"} <Text style={{ color: colors.foreground, fontWeight: '600' }}>{data.productionDozen}</Text> {isAr ? "درزن /" : "Dozen /"} <Text style={{ color: colors.foreground, fontWeight: '600' }}>{data.productionPairs}</Text> {isAr ? "زوج" : "Pairs"}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  {isAr ? "مدة:" : "Duration:"} <Text style={{ color: colors.foreground, fontWeight: '600' }}>{data.productionHours || "0"}</Text>{isAr ? "س" : "h"} <Text style={{ color: colors.foreground, fontWeight: '600' }}>{data.productionMinutes || "0"}</Text>{isAr ? "د" : "m"}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  {isAr ? "هدر خيوط:" : "Thread Waste:"} <Text style={{ color: colors.error, fontWeight: '600' }}>{data.wasteThreadGrams}</Text> {isAr ? "جم" : "g"}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  {isAr ? "هدر جوارب:" : "Socks Waste:"} <Text style={{ color: colors.error, fontWeight: '600' }}>{data.wasteSocksGrams}</Text> {isAr ? "جم" : "g"}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  {isAr ? "نخب ثاني:" : "Second Grade:"} <Text style={{ color: colors.warning, fontWeight: '600' }}>{data.secondGradeDozen || "0"}</Text> {isAr ? "درزن" : "Dozen"} <Text style={{ color: colors.warning, fontWeight: '600' }}>{data.secondGradePairs || "0"}</Text> {isAr ? "زوج" : "Pairs"}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  {isAr ? "إبر:" : "Needles:"} <Text style={{ color: colors.foreground, fontWeight: '600' }}>{data.wasteNeedles}</Text> {isAr ? "حبة" : "pcs"}
                </Text>
              </View>
              {/* وزن الخيوط */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 4, justifyContent: 'flex-end', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderColor: colors.border }}>
                {parseFloat(data.yarnRubber) > 0 && <Text style={{ color: colors.muted, fontSize: 12 }}>{isAr ? "مطاط:" : "Rubber:"} <Text style={{ color: colors.foreground, fontWeight: '600' }}>{data.yarnRubber}</Text>{isAr ? "جم" : "g"}</Text>}
                {parseFloat(data.yarnSpandex) > 0 && <Text style={{ color: colors.muted, fontSize: 12 }}>{isAr ? "اسباندكس:" : "Spandex:"} <Text style={{ color: colors.foreground, fontWeight: '600' }}>{data.yarnSpandex}</Text>{isAr ? "جم" : "g"}</Text>}
                {parseFloat(data.yarnNylon) > 0 && <Text style={{ color: colors.muted, fontSize: 12 }}>{isAr ? "نايلون:" : "Nylon:"} <Text style={{ color: colors.foreground, fontWeight: '600' }}>{data.yarnNylon}</Text>{isAr ? "جم" : "g"}</Text>}
                {parseFloat(data.yarnCotton) > 0 && <Text style={{ color: colors.muted, fontSize: 12 }}>{isAr ? "قطن:" : "Cotton:"} <Text style={{ color: colors.foreground, fontWeight: '600' }}>{data.yarnCotton}</Text>{isAr ? "جم" : "g"}</Text>}
                {parseFloat(data.yarnBamboo) > 0 && <Text style={{ color: colors.muted, fontSize: 12 }}>{isAr ? "بامبو:" : "Bamboo:"} <Text style={{ color: colors.foreground, fontWeight: '600' }}>{data.yarnBamboo}</Text>{isAr ? "جم" : "g"}</Text>}
                {parseFloat(data.yarnSpan) > 0 && <Text style={{ color: colors.muted, fontSize: 12 }}>{isAr ? "اسبان:" : "Span:"} <Text style={{ color: colors.foreground, fontWeight: '600' }}>{data.yarnSpan}</Text>{isAr ? "جم" : "g"}</Text>}
                <Text style={{ color: colors.muted, fontSize: 12 }}>{isAr ? "إجمالي:" : "Total:"} <Text style={{ color: colors.primary, fontWeight: 'bold' }}>{machineYarnTotal}</Text>{isAr ? "جم" : "g"}</Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>{isAr ? "نسبة الهدر:" : "Waste Percentage:"} <Text style={{ color: colors.error, fontWeight: 'bold' }}>{machineWastePercent}%</Text></Text>
              </View>
            </View>
          );
        })}

        {/* المجموع */}
        <View style={{ backgroundColor: colors.background, borderRadius: 8, padding: 12, marginTop: 4, borderWidth: 2 }}>
          <Text style={{ color: colors.primary, fontWeight: 'bold', fontSize: 14, marginBottom: 4, textAlign: 'right' }}>{isAr ? "المجموع" : "Total"}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, rowGap: 4, justifyContent: 'flex-end' }}>
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              {isAr ? "إنتاج:" : "Production:"} <Text style={{ color: colors.foreground, fontWeight: 'bold' }}>{totals.totalDozen}</Text> {isAr ? "درزن /" : "Dozen /"} <Text style={{ color: colors.foreground, fontWeight: 'bold' }}>{totals.totalPairs}</Text> {isAr ? "زوج" : "Pairs"}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              مدة ال{isAr ? "إنتاج:" : "Production:"} <Text style={{ color: colors.foreground, fontWeight: 'bold' }}>{totals.totalHours}</Text>{isAr ? "س" : "h"} <Text style={{ color: colors.foreground, fontWeight: 'bold' }}>{totals.totalMinutes}</Text>{isAr ? "د" : "m"}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              {isAr ? "هدر خيوط:" : "Thread Waste:"} <Text style={{ color: colors.error, fontWeight: 'bold' }}>{totals.totalWasteThread}</Text> {isAr ? "جم" : "g"}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              {isAr ? "هدر جوارب:" : "Socks Waste:"} <Text style={{ color: colors.error, fontWeight: 'bold' }}>{totals.totalWasteSocks}</Text> {isAr ? "جم" : "g"}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              {isAr ? "نخب ثاني:" : "Second Grade:"} <Text style={{ color: colors.warning, fontWeight: 'bold' }}>{totals.totalSecondDozen}</Text> {isAr ? "درزن" : "Dozen"} <Text style={{ color: colors.warning, fontWeight: 'bold' }}>{totals.totalSecondPairs}</Text> {isAr ? "زوج" : "Pairs"}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              {isAr ? "إبر:" : "Needles:"} <Text style={{ color: colors.foreground, fontWeight: 'bold' }}>{totals.totalNeedles}</Text> {isAr ? "حبة" : "pcs"}
            </Text>
          </View>
          {/* إجمالي وزن الخيوط ونسبة الهدر */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 4, justifyContent: 'flex-end', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderColor: colors.border }}>
            <Text style={{ color: colors.muted, fontSize: 12 }}>{isAr ? "إجمالي وزن الخيوط:" : "Total Yarn Weight:"} <Text style={{ color: colors.primary, fontWeight: 'bold' }}>{totals.totalYarnWeight}</Text> {isAr ? "جم" : "g"}</Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>{isAr ? "إجمالي كمية الهدر:" : "Total Waste Amount:"} <Text style={{ color: colors.error, fontWeight: 'bold' }}>{totals.totalWasteAll}</Text> {isAr ? "جم" : "g"}</Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>{isAr ? "نسبة الهدر:" : "Waste Percentage:"} <Text style={{ color: colors.error, fontWeight: 'bold' }}>{totals.wastePercentage}%</Text></Text>
          </View>
        </View>
      </View>
    );
  };

  // نموذج الإدخال - جميع المكائن المفعلة مع حقولها
  const renderForm = () => (
    <ScrollView style={{ flex: 1, paddingHorizontal: 16, paddingVertical: 16 }}>
      <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 20, borderWidth: 1, borderColor: colors.border, marginBottom: 16 }}>
        <Text style={{ color: colors.foreground, fontWeight: 'bold', fontSize: 18, marginBottom: 20, textAlign: 'right' }}>
          {editingEntry ? isAr ? "✏️ تعديل بيانات الإنتاج" : "✏️ Edit Production Data" : isAr ? "➕ إضافة بيانات إنتاج" : "➕ Add Production Data"}
        </Text>

        {/* التاريخ الموحد */}
        <View style={{ marginBottom: 20 }}>
          <Text style={{ color: colors.foreground, fontWeight: '600', fontSize: 14, marginBottom: 8, textAlign: 'right' }}>{isAr ? "تاريخ الإنتاج" : "Production Date"}</Text>
          <TextInput
            style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12, color: colors.foreground, textAlign: 'right', fontSize: 16 }}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.muted}
            value={selectedDate}
            onChangeText={setSelectedDate}
            returnKeyType="next"
          />
          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4, textAlign: 'right' }}>{isAr ? "تاريخ واحد لجميع المكائن" : "One date for all machines"}</Text>
        </View>

        {/* اختيار المكائن التي عملت */}
        <View style={{ marginBottom: 20 }}>
          <Text style={{ color: colors.foreground, fontWeight: '600', fontSize: 14, marginBottom: 12, textAlign: 'right' }}>{isAr ? "اختر المكائن التي عملت في هذا اليوم" : "Select machines that worked today"}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end' }}>
            {MACHINES.map((machine) => (
              <TouchableOpacity
                key={machine}
                onPress={() => toggleMachine(machine)}
                style={{
                  backgroundColor: activeMachines.includes(machine) ? "#16a34a" : "transparent",
                  borderColor: "#16a34a",
                  borderWidth: 1.5,
                  borderRadius: 22,
                  paddingHorizontal: 12,
                  paddingVertical: 7,
                  minWidth: 52,
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    color: activeMachines.includes(machine) ? "white" : "#16a34a",
                    fontWeight: "700",
                    fontSize: 11,
                  }}
                >
                  {machine}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {/* حقول الإدخال لكل مكينة مفعلة */}
      {activeMachines.map((machine) => (
        <View key={machine} style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: colors.border, marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, justifyContent: 'flex-end' }}>
            <Text style={{ color: colors.foreground, fontWeight: 'bold', fontSize: 16 }}>{machine}</Text>
            <View style={{ backgroundColor: "#16a34a20", borderRadius: 14, padding: 5 }}>
              <MaterialIcons name="precision-manufacturing" size={16} color="#16a34a" />
            </View>
          </View>

          {/* كمية الإنتاج */}
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 4, textAlign: 'right' }}>{isAr ? "إنتاج (زوج)" : "Production (Pairs)"}</Text>
              <TextInput
                style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, color: colors.foreground, textAlign: 'right', fontSize: 14 }}
                placeholder="0"
                placeholderTextColor={colors.muted}
                value={machinesData[machine]?.productionPairs || ""}
                onChangeText={(v) => updateMachineField(machine, "productionPairs", v)}
                keyboardType="numeric"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 4, textAlign: 'right' }}>{isAr ? "إنتاج (درزن)" : "Production (Dozen)"}</Text>
              <TextInput
                style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, color: colors.foreground, textAlign: 'right', fontSize: 14 }}
                placeholder="0"
                placeholderTextColor={colors.muted}
                value={machinesData[machine]?.productionDozen || ""}
                onChangeText={(v) => updateMachineField(machine, "productionDozen", v)}
                keyboardType="numeric"
              />
            </View>
          </View>

          {/* هدر الخيوط وهدر الجوارب */}
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 4, textAlign: 'right' }}>{isAr ? "هدر جوارب (جم)" : "Socks Waste (g)"}</Text>
              <TextInput
                style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, color: colors.foreground, textAlign: 'right', fontSize: 14 }}
                placeholder="0"
                placeholderTextColor={colors.muted}
                value={machinesData[machine]?.wasteSocksGrams || ""}
                onChangeText={(v) => updateMachineField(machine, "wasteSocksGrams", v)}
                keyboardType="numeric"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 4, textAlign: 'right' }}>{isAr ? "هدر خيوط (جم)" : "Thread Waste (g)"}</Text>
              <TextInput
                style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, color: colors.foreground, textAlign: 'right', fontSize: 14 }}
                placeholder="0"
                placeholderTextColor={colors.muted}
                value={machinesData[machine]?.wasteThreadGrams || ""}
                onChangeText={(v) => updateMachineField(machine, "wasteThreadGrams", v)}
                keyboardType="numeric"
              />
            </View>
          </View>

          {/* النخب الثاني وهدر الإبر */}
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 4, textAlign: 'right' }}>{isAr ? "هدر إبر (حبة)" : "Needles Waste (pcs)"}</Text>
              <TextInput
                style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, color: colors.foreground, textAlign: 'right', fontSize: 14 }}
                placeholder="0"
                placeholderTextColor={colors.muted}
                value={machinesData[machine]?.wasteNeedles || ""}
                onChangeText={(v) => updateMachineField(machine, "wasteNeedles", v)}
                keyboardType="numeric"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 4, textAlign: 'right' }}>{isAr ? "نخب ثاني (زوج)" : "Second Grade (Pairs)"}</Text>
              <TextInput
                style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, color: colors.foreground, textAlign: 'right', fontSize: 14 }}
                placeholder="0"
                placeholderTextColor={colors.muted}
                value={machinesData[machine]?.secondGradePairs || ""}
                onChangeText={(v) => updateMachineField(machine, "secondGradePairs", v)}
                keyboardType="numeric"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 4, textAlign: 'right' }}>{isAr ? "نخب ثاني (درزن)" : "Second Grade (Dozen)"}</Text>
              <TextInput
                style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, color: colors.foreground, textAlign: 'right', fontSize: 14 }}
                placeholder="0"
                placeholderTextColor={colors.muted}
                value={machinesData[machine]?.secondGradeDozen || ""}
                onChangeText={(v) => updateMachineField(machine, "secondGradeDozen", v)}
                keyboardType="numeric"
              />
            </View>
          </View>

          {/* مدة الإنتاج */}
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 4, textAlign: 'right' }}>{isAr ? "مدة الإنتاج (دقيقة)" : "Production Duration (Minutes)"}</Text>
              <TextInput
                style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, color: colors.foreground, textAlign: 'right', fontSize: 14 }}
                placeholder="0"
                placeholderTextColor={colors.muted}
                value={machinesData[machine]?.productionMinutes || ""}
                onChangeText={(v) => updateMachineField(machine, "productionMinutes", v)}
                keyboardType="numeric"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 4, textAlign: 'right' }}>{isAr ? "مدة الإنتاج (ساعة)" : "Production Duration (Hours)"}</Text>
              <TextInput
                style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, color: colors.foreground, textAlign: 'right', fontSize: 14 }}
                placeholder="0"
                placeholderTextColor={colors.muted}
                value={machinesData[machine]?.productionHours || ""}
                onChangeText={(v) => updateMachineField(machine, "productionHours", v)}
                keyboardType="numeric"
              />
            </View>
          </View>

          {/* وزن الخيوط حسب النوع */}
          <View style={{ borderTopWidth: 1, borderColor: colors.border, paddingTop: 12, marginTop: 4 }}>
            <Text style={{ color: colors.foreground, fontWeight: '600', fontSize: 12, marginBottom: 8, textAlign: 'right' }}>{isAr ? "وزن الخيوط المستخدمة (جرام)" : "Used Yarn Weight (grams)"}</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 4, textAlign: 'right' }}>{isAr ? "اسباندكس" : "Spandex"}</Text>
                <TextInput
                  style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, color: colors.foreground, textAlign: 'right', fontSize: 14 }}
                  placeholder="0"
                  placeholderTextColor={colors.muted}
                  value={machinesData[machine]?.yarnSpandex || ""}
                  onChangeText={(v) => updateMachineField(machine, "yarnSpandex", v)}
                  keyboardType="numeric"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 4, textAlign: 'right' }}>{isAr ? "مطاط" : "Rubber"}</Text>
                <TextInput
                  style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, color: colors.foreground, textAlign: 'right', fontSize: 14 }}
                  placeholder="0"
                  placeholderTextColor={colors.muted}
                  value={machinesData[machine]?.yarnRubber || ""}
                  onChangeText={(v) => updateMachineField(machine, "yarnRubber", v)}
                  keyboardType="numeric"
                />
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 4, textAlign: 'right' }}>{isAr ? "قطن" : "Cotton"}</Text>
                <TextInput
                  style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, color: colors.foreground, textAlign: 'right', fontSize: 14 }}
                  placeholder="0"
                  placeholderTextColor={colors.muted}
                  value={machinesData[machine]?.yarnCotton || ""}
                  onChangeText={(v) => updateMachineField(machine, "yarnCotton", v)}
                  keyboardType="numeric"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 4, textAlign: 'right' }}>{isAr ? "نايلون" : "Nylon"}</Text>
                <TextInput
                  style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, color: colors.foreground, textAlign: 'right', fontSize: 14 }}
                  placeholder="0"
                  placeholderTextColor={colors.muted}
                  value={machinesData[machine]?.yarnNylon || ""}
                  onChangeText={(v) => updateMachineField(machine, "yarnNylon", v)}
                  keyboardType="numeric"
                />
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 4, textAlign: 'right' }}>{isAr ? "اسبان" : "Span"}</Text>
                <TextInput
                  style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, color: colors.foreground, textAlign: 'right', fontSize: 14 }}
                  placeholder="0"
                  placeholderTextColor={colors.muted}
                  value={machinesData[machine]?.yarnSpan || ""}
                  onChangeText={(v) => updateMachineField(machine, "yarnSpan", v)}
                  keyboardType="numeric"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 4, textAlign: 'right' }}>{isAr ? "بامبو" : "Bamboo"}</Text>
                <TextInput
                  style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, color: colors.foreground, textAlign: 'right', fontSize: 14 }}
                  placeholder="0"
                  placeholderTextColor={colors.muted}
                  value={machinesData[machine]?.yarnBamboo || ""}
                  onChangeText={(v) => updateMachineField(machine, "yarnBamboo", v)}
                  keyboardType="numeric"
                />
              </View>
            </View>
          </View>
        </View>
      ))}

      {/* أزرار الحفظ والتعديل والإلغاء */}
      {activeMachines.length > 0 && (
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 8, marginBottom: 32 }}>
          <TouchableOpacity
            onPress={() => { setShowForm(false); resetForm(); }}
            style={{
              flex: 1,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 12,
              paddingVertical: 14,
              flexDirection: "row",
              justifyContent: "center",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Text style={{ color: colors.foreground, fontWeight: '600', fontSize: 14 }}>{isAr ? "إلغاء" : "Cancel"}</Text>
            <MaterialIcons name="close" size={18} color={colors.foreground} />
          </TouchableOpacity>

          {editingEntry && (
            <TouchableOpacity
              onPress={handleSave}
              style={{
                flex: 1,
                backgroundColor: "#0a7ea4",
                borderRadius: 12,
                paddingVertical: 14,
                flexDirection: "row",
                justifyContent: "center",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Text style={{ color: '#ffffff', fontWeight: '600', fontSize: 14 }}>{isAr ? "تعديل" : "Edit"}</Text>
              <MaterialIcons name="edit" size={18} color="white" />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={handleSave}
            style={{
              flex: 1,
              backgroundColor: "#16a34a",
              borderRadius: 12,
              paddingVertical: 14,
              flexDirection: "row",
              justifyContent: "center",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Text style={{ color: '#ffffff', fontWeight: '600', fontSize: 14 }}>{isAr ? "حفظ" : "Save"}</Text>
            <MaterialIcons name="save" size={18} color="white" />
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );

  return (
    <ScreenContainer style={{ backgroundColor: colors.background }}>
      {/* رأس الصفحة */}
      <View
        style={{ backgroundColor: "#16a34a", paddingHorizontal: 24, paddingVertical: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
      >
        {/* زر الإضافة */}
        <TouchableOpacity
          onPress={() => { resetForm(); setShowForm(true); }}
          style={{ backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 20, padding: 8 }}
        >
          <MaterialIcons name="add" size={24} color="white" />
        </TouchableOpacity>

        {/* أيقونة الملخص اليومي */}
        <TouchableOpacity
          onPress={() => setShowDailySummary(!showDailySummary)}
          style={{ backgroundColor: showDailySummary ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.2)", borderRadius: 20, padding: 8 }}
        >
          <MaterialIcons name="analytics" size={24} color="white" />
        </TouchableOpacity>

        {/* أيقونة {isAr ? "إجمالي بيانات المكائن" : "Total Machine Data"} - يفتح شاشة منفصلة */}
        <TouchableOpacity
          onPress={() => router.push("/production-totals" as any)}
          style={{ backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 20, padding: 8 }}
        >
          <MaterialIcons name="summarize" size={24} color="white" />
        </TouchableOpacity>
        {/* أيقونة الإجراءات الإدارية */}
        <AdminBadgeIcon />

        {/* العنوان */}
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={{ color: '#ffffff', fontWeight: 'bold', fontSize: 20 }}>{isAr ? "الإنتاج" : "Production"}</Text>
          <Text style={{ fontSize: 14, marginTop: 4 }}>{entries.length} {isAr ? "سجل" : "Record"}</Text>
        </View>

        {/* زر الرجوع */}
        <BackButton />
      </View>

      {/* الملخص اليومي */}
      {showDailySummary && entries.length > 0 && (() => {
        // حساب إجماليات اليوم الحالي
        const todayStr = formatDate(new Date());
        const todayEntries = entries.filter(e => e.date === todayStr);
        const allEntries = todayEntries.length > 0 ? todayEntries : entries;
        const label = todayEntries.length > 0 ? isAr ? `ملخص اليوم (${todayStr})` : `Today's Summary (${todayStr})` : isAr ? `ملخص آخر يوم (${allEntries[0]?.date})` : `Last Day's Summary (${allEntries[0]?.date})`;
        
        let sumYarnWeight = 0;
        let sumWasteThread = 0;
        let sumWasteSocks = 0;
        
        allEntries.forEach(entry => {
          Object.values(entry.machines).forEach(m => {
            sumYarnWeight += (parseFloat(m.yarnRubber) || 0) + (parseFloat(m.yarnSpandex) || 0) + (parseFloat(m.yarnNylon) || 0) + (parseFloat(m.yarnCotton) || 0) + (parseFloat(m.yarnBamboo) || 0) + (parseFloat(m.yarnSpan) || 0);
            sumWasteThread += parseFloat(m.wasteThreadGrams) || 0;
            sumWasteSocks += parseFloat(m.wasteSocksGrams) || 0;
          });
        });
        
        const sumWasteAll = sumWasteThread + sumWasteSocks;
        const wastePercent = sumYarnWeight > 0 ? ((sumWasteAll / sumYarnWeight) * 100).toFixed(2) : "0";
        
        return (
          <View style={{ marginHorizontal: 16, marginTop: 12, backgroundColor: colors.surface, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: colors.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, justifyContent: 'flex-end' }}>
              <Text style={{ color: colors.foreground, fontWeight: 'bold', fontSize: 16 }}>{label}</Text>
              <View style={{ backgroundColor: "#16a34a20", borderRadius: 14, padding: 5 }}>
                <MaterialIcons name="analytics" size={18} color="#16a34a" />
              </View>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <View style={{ flex: 1, alignItems: 'center', backgroundColor: colors.background, borderRadius: 8, padding: 12, marginHorizontal: 4, borderWidth: 1, borderColor: colors.border }}>
                <MaterialIcons name="scale" size={22} color="#0a7ea4" />
                <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>{isAr ? "إجمالي وزن الخيوط" : "Total Yarn Weight"}</Text>
                <Text style={{ color: colors.primary, fontWeight: 'bold', fontSize: 18 }}>{sumYarnWeight.toFixed(0)}</Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>{isAr ? "جرام" : "grams"}</Text>
              </View>
              <View style={{ flex: 1, alignItems: 'center', backgroundColor: colors.background, borderRadius: 8, padding: 12, marginHorizontal: 4, borderWidth: 1, borderColor: colors.border }}>
                <MaterialIcons name="delete-outline" size={22} color="#ef4444" />
                <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>{isAr ? "إجمالي كمية الهدر" : "Total Waste Amount"}</Text>
                <Text style={{ color: colors.error, fontWeight: 'bold', fontSize: 18 }}>{sumWasteAll.toFixed(0)}</Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>{isAr ? "جرام" : "grams"}</Text>
              </View>
              <View style={{ flex: 1, alignItems: 'center', backgroundColor: colors.background, borderRadius: 8, padding: 12, marginHorizontal: 4, borderWidth: 1, borderColor: colors.border }}>
                <MaterialIcons name="percent" size={22} color="#f59e0b" />
                <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>{isAr ? "نسبة الهدر" : "Waste Percentage"}</Text>
                <Text style={{ color: colors.warning, fontWeight: 'bold', fontSize: 18 }}>{wastePercent}%</Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>{isAr ? "من الخيوط" : "of Yarn"}</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 16, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderColor: colors.border }}>
              <Text style={{ color: colors.muted, fontSize: 12 }}>{isAr ? "هدر خيوط:" : "Thread Waste:"} <Text style={{ color: colors.error, fontWeight: '600' }}>{sumWasteThread.toFixed(0)}</Text> {isAr ? "جم" : "g"}</Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>{isAr ? "هدر جوارب:" : "Socks Waste:"} <Text style={{ color: colors.error, fontWeight: '600' }}>{sumWasteSocks.toFixed(0)}</Text> {isAr ? "جم" : "g"}</Text>
            </View>
          </View>
        );
      })()}

      {/* بطاقة {isAr ? "إجمالي بيانات المكائن" : "Total Machine Data"} - كبيرة وواضحة */}
      {!showForm && (
        <TouchableOpacity
          onPress={() => router.push("/production-totals" as any)}
          style={{
            marginHorizontal: 16,
            marginTop: 12,
            marginBottom: 4,
            backgroundColor: "#f0fdf4",
            borderRadius: 16,
            padding: 16,
            borderWidth: 2,
            borderColor: "#16a34a",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <MaterialIcons name="chevron-left" size={24} color="#16a34a" />
          </View>
          <View style={{ flex: 1, alignItems: "flex-end" }}>
            <Text style={{ fontSize: 16, fontWeight: "bold", color: "#16a34a" }}>
              {isAr ? "إجمالي بيانات المكائن" : "Total Machine Data"}
            </Text>
            <Text style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
              {isAr ? "عرض إجماليات الإنتاج والهدر والخيوط" : "View Production, Waste, and Yarn Totals"}
            </Text>
          </View>
          <View style={{ backgroundColor: "#16a34a", borderRadius: 12, padding: 10, marginLeft: 12 }}>
            <MaterialIcons name="summarize" size={28} color="white" />
          </View>
        </TouchableOpacity>
      )}
      {/* بطاقة الإجراءات الإدارية - كبيرة وواضحة */}
      {!showForm && (
      <AdminCard />
      )}
      {/* المحتوى */}
      {showForm ? (
        renderForm()
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, flexGrow: 1 }}>
          {entries.length === 0 ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80 }}>
              <View style={{ backgroundColor: "#16a34a15", borderRadius: 40, padding: 20 }}>
                <MaterialIcons name="precision-manufacturing" size={48} color="#16a34a" />
              </View>
              <Text style={{ color: colors.foreground, fontSize: 18, marginTop: 20, fontWeight: 'bold' }}>{isAr ? "الإنتاج" : "Production"}</Text>
              <Text style={{ color: colors.muted, fontSize: 14, marginTop: 8, textAlign: 'center', paddingHorizontal: 32 }}>
                {isAr ? "لا توجد بيانات إنتاج بعد." : "No production data yet."}{"\n"}{isAr ? "اضغط على زر (+) لإضافة بيانات إنتاج جديدة." : "Press the (+) button to add new production data."}
              </Text>
              <TouchableOpacity
                onPress={() => { resetForm(); setShowForm(true); }}
                style={{ backgroundColor: "#16a34a", marginTop: 24, paddingHorizontal: 32, paddingVertical: 12, borderRadius: 12 }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={{ color: '#ffffff', fontWeight: '600' }}>{isAr ? "إضافة إنتاج" : "Add Production"}</Text>
                  <MaterialIcons name="add" size={20} color="white" />
                </View>
              </TouchableOpacity>
            </View>
          ) : (
            entries.map((entry) => renderEntry(entry))
          )}
        </ScrollView>
      )}
    </ScreenContainer>
  );
}
