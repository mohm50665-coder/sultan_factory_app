import React, { useState, useEffect } from "react";
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
import AsyncStorage from "@react-native-async-storage/async-storage";

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

const STORAGE_KEY = "sultan_production_data_v2";

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
  const router = useRouter();
  const colors = useColors();
  const [entries, setEntries] = useState<ProductionEntry[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ProductionEntry | null>(null);
  const [showDailySummary, setShowDailySummary] = useState(false);


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
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      if (data) setEntries(JSON.parse(data));
    } catch (e) {
      console.log(e);
    }
  };

  const saveEntries = async (newEntries: ProductionEntry[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newEntries));
      setEntries(newEntries);
    } catch (e) {
      console.log(e);
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
      Alert.alert("تنبيه", "يرجى اختيار مكينة واحدة على الأقل");
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

    await saveEntries(newEntries);
    resetForm();
    setShowForm(false);
    Alert.alert("تم بنجاح ✓", editingEntry ? "تم تعديل البيانات" : "تم حفظ البيانات");
  };

  const handleEdit = (entry: ProductionEntry) => {
    setSelectedDate(entry.date);
    setMachinesData(entry.machines);
    setActiveMachines(Object.keys(entry.machines));
    setEditingEntry(entry);
    setShowForm(true);
  };

  const handleDelete = (entry: ProductionEntry) => {
    if (Platform.OS === "web") {
      const confirmed = confirm(`هل تريد حذف بيانات يوم "${entry.date}"؟`);
      if (confirmed) {
        const newEntries = entries.filter((e) => e.id !== entry.id);
        saveEntries(newEntries);
      }
    } else {
      Alert.alert("تأكيد الحذف", `هل تريد حذف بيانات يوم "${entry.date}"؟`, [
        { text: "إلغاء", style: "cancel" },
        {
          text: "حذف",
          style: "destructive",
          onPress: async () => {
            const newEntries = entries.filter((e) => e.id !== entry.id);
            await saveEntries(newEntries);
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
      <View key={entry.id} className="bg-surface rounded-xl p-4 mb-4 border border-border">
        {/* رأس السجل */}
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-row gap-2">
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
          <View className="flex-row items-center gap-2">
            <Text className="text-foreground font-bold text-base">{entry.date}</Text>
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
            <View key={machine} className="bg-background rounded-lg p-3 mb-2 border border-border">
              <Text className="text-foreground font-bold text-sm mb-2 text-right">{machine}</Text>
              <View className="flex-row flex-wrap gap-x-4 gap-y-1 justify-end">
                <Text className="text-muted text-xs">
                  إنتاج: <Text className="text-foreground font-semibold">{data.productionDozen}</Text> درزن / <Text className="text-foreground font-semibold">{data.productionPairs}</Text> زوج
                </Text>
                <Text className="text-muted text-xs">
                  مدة: <Text className="text-foreground font-semibold">{data.productionHours || "0"}</Text>س <Text className="text-foreground font-semibold">{data.productionMinutes || "0"}</Text>د
                </Text>
                <Text className="text-muted text-xs">
                  هدر خيوط: <Text className="text-error font-semibold">{data.wasteThreadGrams}</Text> جم
                </Text>
                <Text className="text-muted text-xs">
                  هدر جوارب: <Text className="text-error font-semibold">{data.wasteSocksGrams}</Text> جم
                </Text>
                <Text className="text-muted text-xs">
                  نخب ثاني: <Text className="text-warning font-semibold">{data.secondGradeDozen || "0"}</Text> درزن <Text className="text-warning font-semibold">{data.secondGradePairs || "0"}</Text> زوج
                </Text>
                <Text className="text-muted text-xs">
                  إبر: <Text className="text-foreground font-semibold">{data.wasteNeedles}</Text> حبة
                </Text>
              </View>
              {/* وزن الخيوط */}
              <View className="flex-row flex-wrap gap-x-3 gap-y-1 justify-end mt-2 pt-2 border-t border-border">
                {parseFloat(data.yarnRubber) > 0 && <Text className="text-muted text-xs">مطاط: <Text className="text-foreground font-semibold">{data.yarnRubber}</Text>جم</Text>}
                {parseFloat(data.yarnSpandex) > 0 && <Text className="text-muted text-xs">اسباندكس: <Text className="text-foreground font-semibold">{data.yarnSpandex}</Text>جم</Text>}
                {parseFloat(data.yarnNylon) > 0 && <Text className="text-muted text-xs">نايلون: <Text className="text-foreground font-semibold">{data.yarnNylon}</Text>جم</Text>}
                {parseFloat(data.yarnCotton) > 0 && <Text className="text-muted text-xs">قطن: <Text className="text-foreground font-semibold">{data.yarnCotton}</Text>جم</Text>}
                {parseFloat(data.yarnBamboo) > 0 && <Text className="text-muted text-xs">بامبو: <Text className="text-foreground font-semibold">{data.yarnBamboo}</Text>جم</Text>}
                {parseFloat(data.yarnSpan) > 0 && <Text className="text-muted text-xs">اسبان: <Text className="text-foreground font-semibold">{data.yarnSpan}</Text>جم</Text>}
                <Text className="text-muted text-xs">إجمالي: <Text className="text-primary font-bold">{machineYarnTotal}</Text>جم</Text>
                <Text className="text-muted text-xs">نسبة الهدر: <Text className="text-error font-bold">{machineWastePercent}%</Text></Text>
              </View>
            </View>
          );
        })}

        {/* المجموع */}
        <View className="bg-background rounded-lg p-3 mt-1 border-2 border-primary/30">
          <Text className="text-primary font-bold text-sm mb-1 text-right">المجموع</Text>
          <View className="flex-row flex-wrap gap-x-4 gap-y-1 justify-end">
            <Text className="text-muted text-xs">
              إنتاج: <Text className="text-foreground font-bold">{totals.totalDozen}</Text> درزن / <Text className="text-foreground font-bold">{totals.totalPairs}</Text> زوج
            </Text>
            <Text className="text-muted text-xs">
              مدة الإنتاج: <Text className="text-foreground font-bold">{totals.totalHours}</Text>س <Text className="text-foreground font-bold">{totals.totalMinutes}</Text>د
            </Text>
            <Text className="text-muted text-xs">
              هدر خيوط: <Text className="text-error font-bold">{totals.totalWasteThread}</Text> جم
            </Text>
            <Text className="text-muted text-xs">
              هدر جوارب: <Text className="text-error font-bold">{totals.totalWasteSocks}</Text> جم
            </Text>
            <Text className="text-muted text-xs">
              نخب ثاني: <Text className="text-warning font-bold">{totals.totalSecondDozen}</Text> درزن <Text className="text-warning font-bold">{totals.totalSecondPairs}</Text> زوج
            </Text>
            <Text className="text-muted text-xs">
              إبر: <Text className="text-foreground font-bold">{totals.totalNeedles}</Text> حبة
            </Text>
          </View>
          {/* إجمالي وزن الخيوط ونسبة الهدر */}
          <View className="flex-row flex-wrap gap-x-3 gap-y-1 justify-end mt-2 pt-2 border-t border-border">
            <Text className="text-muted text-xs">إجمالي وزن الخيوط: <Text className="text-primary font-bold">{totals.totalYarnWeight}</Text> جم</Text>
            <Text className="text-muted text-xs">إجمالي كمية الهدر: <Text className="text-error font-bold">{totals.totalWasteAll}</Text> جم</Text>
            <Text className="text-muted text-xs">نسبة الهدر: <Text className="text-error font-bold">{totals.wastePercentage}%</Text></Text>
          </View>
        </View>
      </View>
    );
  };

  // نموذج الإدخال - جميع المكائن المفعلة مع حقولها
  const renderForm = () => (
    <ScrollView className="flex-1 px-4 py-4">
      <View className="bg-surface rounded-xl p-5 border border-border mb-4">
        <Text className="text-foreground font-bold text-lg mb-5 text-right">
          {editingEntry ? "✏️ تعديل بيانات الإنتاج" : "➕ إضافة بيانات إنتاج"}
        </Text>

        {/* التاريخ الموحد */}
        <View className="mb-5">
          <Text className="text-foreground font-semibold text-sm mb-2 text-right">تاريخ الإنتاج</Text>
          <TextInput
            className="bg-background border border-border rounded-lg px-4 py-3 text-foreground text-right text-base"
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.muted}
            value={selectedDate}
            onChangeText={setSelectedDate}
            returnKeyType="next"
          />
          <Text className="text-muted text-xs mt-1 text-right">تاريخ واحد لجميع المكائن</Text>
        </View>

        {/* اختيار المكائن التي عملت */}
        <View className="mb-5">
          <Text className="text-foreground font-semibold text-sm mb-3 text-right">اختر المكائن التي عملت في هذا اليوم</Text>
          <View className="flex-row flex-wrap gap-2 justify-end">
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
        <View key={machine} className="bg-surface rounded-xl p-4 border border-border mb-3">
          <View className="flex-row items-center gap-2 mb-3 justify-end">
            <Text className="text-foreground font-bold text-base">{machine}</Text>
            <View style={{ backgroundColor: "#16a34a20", borderRadius: 14, padding: 5 }}>
              <MaterialIcons name="precision-manufacturing" size={16} color="#16a34a" />
            </View>
          </View>

          {/* كمية الإنتاج */}
          <View className="flex-row gap-2 mb-3">
            <View className="flex-1">
              <Text className="text-muted text-xs mb-1 text-right">إنتاج (زوج)</Text>
              <TextInput
                className="bg-background border border-border rounded-lg px-3 py-2 text-foreground text-right text-sm"
                placeholder="0"
                placeholderTextColor={colors.muted}
                value={machinesData[machine]?.productionPairs || ""}
                onChangeText={(v) => updateMachineField(machine, "productionPairs", v)}
                keyboardType="numeric"
              />
            </View>
            <View className="flex-1">
              <Text className="text-muted text-xs mb-1 text-right">إنتاج (درزن)</Text>
              <TextInput
                className="bg-background border border-border rounded-lg px-3 py-2 text-foreground text-right text-sm"
                placeholder="0"
                placeholderTextColor={colors.muted}
                value={machinesData[machine]?.productionDozen || ""}
                onChangeText={(v) => updateMachineField(machine, "productionDozen", v)}
                keyboardType="numeric"
              />
            </View>
          </View>

          {/* هدر الخيوط وهدر الجوارب */}
          <View className="flex-row gap-2 mb-3">
            <View className="flex-1">
              <Text className="text-muted text-xs mb-1 text-right">هدر جوارب (جم)</Text>
              <TextInput
                className="bg-background border border-border rounded-lg px-3 py-2 text-foreground text-right text-sm"
                placeholder="0"
                placeholderTextColor={colors.muted}
                value={machinesData[machine]?.wasteSocksGrams || ""}
                onChangeText={(v) => updateMachineField(machine, "wasteSocksGrams", v)}
                keyboardType="numeric"
              />
            </View>
            <View className="flex-1">
              <Text className="text-muted text-xs mb-1 text-right">هدر خيوط (جم)</Text>
              <TextInput
                className="bg-background border border-border rounded-lg px-3 py-2 text-foreground text-right text-sm"
                placeholder="0"
                placeholderTextColor={colors.muted}
                value={machinesData[machine]?.wasteThreadGrams || ""}
                onChangeText={(v) => updateMachineField(machine, "wasteThreadGrams", v)}
                keyboardType="numeric"
              />
            </View>
          </View>

          {/* النخب الثاني وهدر الإبر */}
          <View className="flex-row gap-2 mb-3">
            <View className="flex-1">
              <Text className="text-muted text-xs mb-1 text-right">هدر إبر (حبة)</Text>
              <TextInput
                className="bg-background border border-border rounded-lg px-3 py-2 text-foreground text-right text-sm"
                placeholder="0"
                placeholderTextColor={colors.muted}
                value={machinesData[machine]?.wasteNeedles || ""}
                onChangeText={(v) => updateMachineField(machine, "wasteNeedles", v)}
                keyboardType="numeric"
              />
            </View>
            <View className="flex-1">
              <Text className="text-muted text-xs mb-1 text-right">نخب ثاني (زوج)</Text>
              <TextInput
                className="bg-background border border-border rounded-lg px-3 py-2 text-foreground text-right text-sm"
                placeholder="0"
                placeholderTextColor={colors.muted}
                value={machinesData[machine]?.secondGradePairs || ""}
                onChangeText={(v) => updateMachineField(machine, "secondGradePairs", v)}
                keyboardType="numeric"
              />
            </View>
            <View className="flex-1">
              <Text className="text-muted text-xs mb-1 text-right">نخب ثاني (درزن)</Text>
              <TextInput
                className="bg-background border border-border rounded-lg px-3 py-2 text-foreground text-right text-sm"
                placeholder="0"
                placeholderTextColor={colors.muted}
                value={machinesData[machine]?.secondGradeDozen || ""}
                onChangeText={(v) => updateMachineField(machine, "secondGradeDozen", v)}
                keyboardType="numeric"
              />
            </View>
          </View>

          {/* مدة الإنتاج */}
          <View className="flex-row gap-2 mb-3">
            <View className="flex-1">
              <Text className="text-muted text-xs mb-1 text-right">مدة الإنتاج (دقيقة)</Text>
              <TextInput
                className="bg-background border border-border rounded-lg px-3 py-2 text-foreground text-right text-sm"
                placeholder="0"
                placeholderTextColor={colors.muted}
                value={machinesData[machine]?.productionMinutes || ""}
                onChangeText={(v) => updateMachineField(machine, "productionMinutes", v)}
                keyboardType="numeric"
              />
            </View>
            <View className="flex-1">
              <Text className="text-muted text-xs mb-1 text-right">مدة الإنتاج (ساعة)</Text>
              <TextInput
                className="bg-background border border-border rounded-lg px-3 py-2 text-foreground text-right text-sm"
                placeholder="0"
                placeholderTextColor={colors.muted}
                value={machinesData[machine]?.productionHours || ""}
                onChangeText={(v) => updateMachineField(machine, "productionHours", v)}
                keyboardType="numeric"
              />
            </View>
          </View>

          {/* وزن الخيوط حسب النوع */}
          <View className="border-t border-border pt-3 mt-1">
            <Text className="text-foreground font-semibold text-xs mb-2 text-right">وزن الخيوط المستخدمة (جرام)</Text>
            <View className="flex-row gap-2 mb-2">
              <View className="flex-1">
                <Text className="text-muted text-xs mb-1 text-right">اسباندكس</Text>
                <TextInput
                  className="bg-background border border-border rounded-lg px-3 py-2 text-foreground text-right text-sm"
                  placeholder="0"
                  placeholderTextColor={colors.muted}
                  value={machinesData[machine]?.yarnSpandex || ""}
                  onChangeText={(v) => updateMachineField(machine, "yarnSpandex", v)}
                  keyboardType="numeric"
                />
              </View>
              <View className="flex-1">
                <Text className="text-muted text-xs mb-1 text-right">مطاط</Text>
                <TextInput
                  className="bg-background border border-border rounded-lg px-3 py-2 text-foreground text-right text-sm"
                  placeholder="0"
                  placeholderTextColor={colors.muted}
                  value={machinesData[machine]?.yarnRubber || ""}
                  onChangeText={(v) => updateMachineField(machine, "yarnRubber", v)}
                  keyboardType="numeric"
                />
              </View>
            </View>
            <View className="flex-row gap-2 mb-2">
              <View className="flex-1">
                <Text className="text-muted text-xs mb-1 text-right">قطن</Text>
                <TextInput
                  className="bg-background border border-border rounded-lg px-3 py-2 text-foreground text-right text-sm"
                  placeholder="0"
                  placeholderTextColor={colors.muted}
                  value={machinesData[machine]?.yarnCotton || ""}
                  onChangeText={(v) => updateMachineField(machine, "yarnCotton", v)}
                  keyboardType="numeric"
                />
              </View>
              <View className="flex-1">
                <Text className="text-muted text-xs mb-1 text-right">نايلون</Text>
                <TextInput
                  className="bg-background border border-border rounded-lg px-3 py-2 text-foreground text-right text-sm"
                  placeholder="0"
                  placeholderTextColor={colors.muted}
                  value={machinesData[machine]?.yarnNylon || ""}
                  onChangeText={(v) => updateMachineField(machine, "yarnNylon", v)}
                  keyboardType="numeric"
                />
              </View>
            </View>
            <View className="flex-row gap-2">
              <View className="flex-1">
                <Text className="text-muted text-xs mb-1 text-right">اسبان</Text>
                <TextInput
                  className="bg-background border border-border rounded-lg px-3 py-2 text-foreground text-right text-sm"
                  placeholder="0"
                  placeholderTextColor={colors.muted}
                  value={machinesData[machine]?.yarnSpan || ""}
                  onChangeText={(v) => updateMachineField(machine, "yarnSpan", v)}
                  keyboardType="numeric"
                />
              </View>
              <View className="flex-1">
                <Text className="text-muted text-xs mb-1 text-right">بامبو</Text>
                <TextInput
                  className="bg-background border border-border rounded-lg px-3 py-2 text-foreground text-right text-sm"
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
        <View className="flex-row gap-3 mt-2 mb-8">
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
            <Text className="text-foreground font-semibold text-sm">إلغاء</Text>
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
              <Text className="text-white font-semibold text-sm">تعديل</Text>
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
            <Text className="text-white font-semibold text-sm">حفظ</Text>
            <MaterialIcons name="save" size={18} color="white" />
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );

  return (
    <ScreenContainer className="bg-background">
      {/* رأس الصفحة */}
      <View
        style={{ backgroundColor: "#16a34a" }}
        className="px-6 py-5 flex-row items-center justify-between"
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

        {/* أيقونة إجمالي بيانات المكائن - يفتح شاشة منفصلة */}
        <TouchableOpacity
          onPress={() => router.push("/production-totals" as any)}
          style={{ backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 20, padding: 8 }}
        >
          <MaterialIcons name="summarize" size={24} color="white" />
        </TouchableOpacity>

        {/* العنوان */}
        <View className="flex-1 items-center">
          <Text className="text-white font-bold text-xl">الإنتاج</Text>
          <Text className="text-white/80 text-sm mt-1">{entries.length} سجل</Text>
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
        const label = todayEntries.length > 0 ? `ملخص اليوم (${todayStr})` : `ملخص آخر يوم (${allEntries[0]?.date})`;
        
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
          <View className="mx-4 mt-3 bg-surface rounded-xl p-4 border border-border">
            <View className="flex-row items-center gap-2 mb-3 justify-end">
              <Text className="text-foreground font-bold text-base">{label}</Text>
              <View style={{ backgroundColor: "#16a34a20", borderRadius: 14, padding: 5 }}>
                <MaterialIcons name="analytics" size={18} color="#16a34a" />
              </View>
            </View>
            <View className="flex-row justify-between items-center mb-2">
              <View className="flex-1 items-center bg-background rounded-lg p-3 mx-1 border border-border">
                <MaterialIcons name="scale" size={22} color="#0a7ea4" />
                <Text className="text-muted text-xs mt-1">إجمالي وزن الخيوط</Text>
                <Text className="text-primary font-bold text-lg">{sumYarnWeight.toFixed(0)}</Text>
                <Text className="text-muted text-xs">جرام</Text>
              </View>
              <View className="flex-1 items-center bg-background rounded-lg p-3 mx-1 border border-border">
                <MaterialIcons name="delete-outline" size={22} color="#ef4444" />
                <Text className="text-muted text-xs mt-1">إجمالي كمية الهدر</Text>
                <Text className="text-error font-bold text-lg">{sumWasteAll.toFixed(0)}</Text>
                <Text className="text-muted text-xs">جرام</Text>
              </View>
              <View className="flex-1 items-center bg-background rounded-lg p-3 mx-1 border border-border">
                <MaterialIcons name="percent" size={22} color="#f59e0b" />
                <Text className="text-muted text-xs mt-1">نسبة الهدر</Text>
                <Text className="text-warning font-bold text-lg">{wastePercent}%</Text>
                <Text className="text-muted text-xs">من الخيوط</Text>
              </View>
            </View>
            <View className="flex-row justify-end gap-4 mt-2 pt-2 border-t border-border">
              <Text className="text-muted text-xs">هدر خيوط: <Text className="text-error font-semibold">{sumWasteThread.toFixed(0)}</Text> جم</Text>
              <Text className="text-muted text-xs">هدر جوارب: <Text className="text-error font-semibold">{sumWasteSocks.toFixed(0)}</Text> جم</Text>
            </View>
          </View>
        );
      })()}

      {/* المحتوى */}
      {showForm ? (
        renderForm()
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, flexGrow: 1 }}>
          {entries.length === 0 ? (
            <View className="flex-1 items-center justify-center py-20">
              <View style={{ backgroundColor: "#16a34a15", borderRadius: 40, padding: 20 }}>
                <MaterialIcons name="precision-manufacturing" size={48} color="#16a34a" />
              </View>
              <Text className="text-foreground text-lg mt-5 font-bold">الإنتاج</Text>
              <Text className="text-muted text-sm mt-2 text-center px-8">
                لا توجد بيانات إنتاج بعد.{"\n"}اضغط على زر (+) لإضافة بيانات إنتاج جديدة.
              </Text>
              <TouchableOpacity
                onPress={() => { resetForm(); setShowForm(true); }}
                style={{ backgroundColor: "#16a34a", marginTop: 24, paddingHorizontal: 32, paddingVertical: 12, borderRadius: 12 }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text className="text-white font-semibold">إضافة إنتاج</Text>
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
