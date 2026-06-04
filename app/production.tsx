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

interface ShiftData {
  productName: string;
  shiftNumber: number;
  shiftStart: string;
  shiftEnd: string;
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
}

interface MachineShifts {
  shifts: ShiftData[];
}

interface ProductionEntry {
  id: string;
  date: string;
  machines: { [key: string]: MachineShifts };
}

const emptyShiftData = (shiftNum: number): ShiftData => ({
  productName: "",
  shiftNumber: shiftNum,
  shiftStart: "",
  shiftEnd: "",
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

  const [selectedDate, setSelectedDate] = useState(formatDate(new Date()));
  const [machinesData, setMachinesData] = useState<{ [key: string]: MachineShifts }>({});
  const [activeMachines, setActiveMachines] = useState<string[]>([]);

  useEffect(() => {
    loadEntries();
  }, []);

  const loadEntries = async () => {
    try {
      setIsLoading(true);
      const rows = await productionService.getAll() || [];
      // تجميع حسب التاريخ ثم المكينة ثم الورديات
      const grouped: { [date: string]: { [machine: string]: ShiftData[] } } = {};
      for (const row of rows) {
        const d = row.date || "";
        if (!grouped[d]) grouped[d] = {};
        if (!grouped[d][row.machineNumber]) grouped[d][row.machineNumber] = [];
        grouped[d][row.machineNumber].push({
          productName: row.productName || "",
          shiftNumber: row.shiftNumber || 1,
          shiftStart: row.shiftStart || "",
          shiftEnd: row.shiftEnd || "",
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
        });
      }
      const loadedEntries: ProductionEntry[] = Object.keys(grouped)
        .sort((a, b) => b.localeCompare(a))
        .map((date) => ({
          id: date,
          date,
          machines: Object.fromEntries(
            Object.entries(grouped[date]).map(([machine, shifts]) => [
              machine,
              { shifts: shifts.sort((a, b) => a.shiftNumber - b.shiftNumber) },
            ])
          ),
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
      if (isEdit) {
        await productionService.deleteByDate(entry.date);
      }
      const batchEntries: any[] = [];
      Object.entries(entry.machines).forEach(([machine, machineShifts]) => {
        machineShifts.shifts.forEach((shift) => {
          batchEntries.push({
            date: entry.date,
            machineNumber: machine,
            productName: shift.productName || "",
            shiftNumber: shift.shiftNumber || 1,
            shiftStart: shift.shiftStart || "",
            shiftEnd: shift.shiftEnd || "",
            productionDozen: parseInt(shift.productionDozen) || 0,
            productionPairs: parseInt(shift.productionPairs) || 0,
            wasteThreadGrams: parseInt(shift.wasteThreadGrams) || 0,
            wasteSocksGrams: parseInt(shift.wasteSocksGrams) || 0,
            secondGradeDozen: parseInt(shift.secondGradeDozen) || 0,
            secondGradePairs: parseInt(shift.secondGradePairs) || 0,
            wasteNeedles: parseInt(shift.wasteNeedles) || 0,
            productionHours: parseInt(shift.productionHours) || 0,
            productionMinutes: parseInt(shift.productionMinutes) || 0,
            yarnRubber: parseInt(shift.yarnRubber) || 0,
            yarnSpandex: parseInt(shift.yarnSpandex) || 0,
            yarnNylon: parseInt(shift.yarnNylon) || 0,
            yarnCotton: parseInt(shift.yarnCotton) || 0,
            yarnBamboo: parseInt(shift.yarnBamboo) || 0,
            yarnSpan: parseInt(shift.yarnSpan) || 0,
            userId,
          });
        });
      });
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
      setMachinesData({ ...machinesData, [machine]: { shifts: [emptyShiftData(1)] } });
    }
  };

  const addShift = (machine: string) => {
    const current = machinesData[machine] || { shifts: [] };
    const newShiftNum = current.shifts.length + 1;
    setMachinesData({
      ...machinesData,
      [machine]: { shifts: [...current.shifts, emptyShiftData(newShiftNum)] },
    });
  };

  const removeShift = (machine: string, shiftIndex: number) => {
    const current = machinesData[machine];
    if (!current || current.shifts.length <= 1) return;
    const newShifts = current.shifts.filter((_, i) => i !== shiftIndex);
    // إعادة ترقيم
    newShifts.forEach((s, i) => { s.shiftNumber = i + 1; });
    setMachinesData({ ...machinesData, [machine]: { shifts: newShifts } });
  };

  const updateShiftField = (machine: string, shiftIndex: number, field: keyof ShiftData, value: string) => {
    const current = machinesData[machine] || { shifts: [emptyShiftData(1)] };
    const newShifts = [...current.shifts];
    newShifts[shiftIndex] = { ...newShifts[shiftIndex], [field]: value };
    setMachinesData({ ...machinesData, [machine]: { shifts: newShifts } });
  };

  const handleSave = async () => {
    if (activeMachines.length === 0) {
      Alert.alert(isAr ? "تنبيه" : "Alert", isAr ? "يرجى اختيار مكينة واحدة على الأقل" : "Please select at least one machine");
      return;
    }

    const entry: ProductionEntry = {
      id: editingEntry?.id || Date.now().toString(),
      date: selectedDate,
      machines: {},
    };

    activeMachines.forEach((machine) => {
      const mData = machinesData[machine] || { shifts: [emptyShiftData(1)] };
      entry.machines[machine] = mData;
    });

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

  // حساب إجمالي وزن الخيوط لوردية واحدة
  const getShiftTotalYarn = (s: ShiftData): number => {
    return (
      (parseFloat(s.yarnRubber) || 0) +
      (parseFloat(s.yarnSpandex) || 0) +
      (parseFloat(s.yarnNylon) || 0) +
      (parseFloat(s.yarnCotton) || 0) +
      (parseFloat(s.yarnBamboo) || 0) +
      (parseFloat(s.yarnSpan) || 0)
    );
  };

  // حساب المجاميع لسجل واحد
  const getEntryTotals = (entry: ProductionEntry) => {
    let totalDozen = 0, totalPairs = 0, totalWasteThread = 0, totalWasteSocks = 0;
    let totalSecondDozen = 0, totalSecondPairs = 0, totalNeedles = 0;
    let totalHours = 0, totalMinutes = 0;
    let totalYarnRubber = 0, totalYarnSpandex = 0, totalYarnNylon = 0;
    let totalYarnCotton = 0, totalYarnBamboo = 0, totalYarnSpan = 0;

    Object.values(entry.machines).forEach((machineShifts) => {
      machineShifts.shifts.forEach((s) => {
        totalDozen += parseFloat(s.productionDozen) || 0;
        totalPairs += parseFloat(s.productionPairs) || 0;
        totalWasteThread += parseFloat(s.wasteThreadGrams) || 0;
        totalWasteSocks += parseFloat(s.wasteSocksGrams) || 0;
        totalSecondDozen += parseFloat(s.secondGradeDozen) || 0;
        totalSecondPairs += parseFloat(s.secondGradePairs) || 0;
        totalNeedles += parseFloat(s.wasteNeedles) || 0;
        totalHours += parseFloat(s.productionHours) || 0;
        totalMinutes += parseFloat(s.productionMinutes) || 0;
        totalYarnRubber += parseFloat(s.yarnRubber) || 0;
        totalYarnSpandex += parseFloat(s.yarnSpandex) || 0;
        totalYarnNylon += parseFloat(s.yarnNylon) || 0;
        totalYarnCotton += parseFloat(s.yarnCotton) || 0;
        totalYarnBamboo += parseFloat(s.yarnBamboo) || 0;
        totalYarnSpan += parseFloat(s.yarnSpan) || 0;
      });
    });

    totalHours += Math.floor(totalMinutes / 60);
    totalMinutes = totalMinutes % 60;

    const totalYarnWeight = totalYarnRubber + totalYarnSpandex + totalYarnNylon + totalYarnCotton + totalYarnBamboo + totalYarnSpan;
    const totalWasteAll = totalWasteThread + totalWasteSocks;
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
    const totalShifts = machineKeys.reduce((sum, m) => sum + entry.machines[m].shifts.length, 0);

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
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ color: colors.foreground, fontWeight: 'bold', fontSize: 16 }}>{entry.date}</Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              {machineKeys.length} {isAr ? "مكينة" : "machines"} | {totalShifts} {isAr ? "وردية" : "shifts"}
            </Text>
          </View>
        </View>

        {/* ملخص المكائن والمنتجات */}
        {machineKeys.map((machine) => (
          <View key={machine} style={{ marginBottom: 8, paddingVertical: 6, borderBottomWidth: 1, borderColor: colors.border }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {entry.machines[machine].shifts.map(s => s.productName || (isAr ? "بدون اسم" : "No name")).join(" | ")}
              </Text>
              <Text style={{ color: colors.primary, fontWeight: 'bold', fontSize: 14 }}>{machine}</Text>
            </View>
            {entry.machines[machine].shifts.map((shift, idx) => (
              <View key={idx} style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, paddingRight: 8 }}>
                <Text style={{ color: colors.muted, fontSize: 11 }}>
                  {shift.shiftStart && shift.shiftEnd ? `${shift.shiftStart} - ${shift.shiftEnd}` : ""}
                </Text>
                <Text style={{ color: colors.foreground, fontSize: 11 }}>
                  {isAr ? `وردية ${shift.shiftNumber}` : `Shift ${shift.shiftNumber}`}: {shift.productionDozen || 0} {isAr ? "درزن" : "dz"}
                </Text>
              </View>
            ))}
          </View>
        ))}

        {/* الإجماليات */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderColor: colors.border }}>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ color: colors.muted, fontSize: 10 }}>{isAr ? "إنتاج" : "Production"}</Text>
            <Text style={{ color: colors.foreground, fontWeight: 'bold', fontSize: 14 }}>{totals.totalDozen}</Text>
            <Text style={{ color: colors.muted, fontSize: 10 }}>{isAr ? "درزن" : "dozen"}</Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ color: colors.muted, fontSize: 10 }}>{isAr ? "هدر" : "Waste"}</Text>
            <Text style={{ color: colors.error, fontWeight: 'bold', fontSize: 14 }}>{totals.totalWasteAll}</Text>
            <Text style={{ color: colors.muted, fontSize: 10 }}>{isAr ? "جم" : "g"}</Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ color: colors.muted, fontSize: 10 }}>{isAr ? "نسبة الهدر" : "Waste %"}</Text>
            <Text style={{ color: colors.warning, fontWeight: 'bold', fontSize: 14 }}>{totals.wastePercentage}%</Text>
          </View>
        </View>
      </View>
    );
  };

  // فورم إدخال الوردية
  const renderShiftForm = (machine: string, shift: ShiftData, shiftIndex: number, totalShifts: number) => (
    <View key={`${machine}-shift-${shiftIndex}`} style={{ backgroundColor: colors.background, borderRadius: 10, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: colors.border }}>
      {/* رأس الوردية */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {totalShifts > 1 && (
            <TouchableOpacity onPress={() => removeShift(machine, shiftIndex)} style={{ backgroundColor: "#ef444415", borderRadius: 16, padding: 4 }}>
              <MaterialIcons name="remove-circle" size={20} color="#ef4444" />
            </TouchableOpacity>
          )}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ color: colors.primary, fontWeight: 'bold', fontSize: 14 }}>
            {isAr ? `الوردية ${shift.shiftNumber}` : `Shift ${shift.shiftNumber}`}
          </Text>
          <MaterialIcons name="schedule" size={16} color={colors.primary} />
        </View>
      </View>

      {/* اسم المنتج */}
      <View style={{ marginBottom: 12 }}>
        <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 4, textAlign: 'right' }}>{isAr ? "اسم المنتج" : "Product Name"}</Text>
        <TextInput
          style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, color: colors.foreground, textAlign: 'right', fontSize: 14 }}
          placeholder={isAr ? "مثال: جوارب رجالي قطن" : "e.g. Men's cotton socks"}
          placeholderTextColor={colors.muted}
          value={shift.productName}
          onChangeText={(v) => updateShiftField(machine, shiftIndex, "productName", v)}
        />
      </View>

      {/* وقت بداية ونهاية الوردية */}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 4, textAlign: 'right' }}>{isAr ? "نهاية الوردية" : "Shift End"}</Text>
          <TextInput
            style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, color: colors.foreground, textAlign: 'right', fontSize: 14 }}
            placeholder="18:00"
            placeholderTextColor={colors.muted}
            value={shift.shiftEnd}
            onChangeText={(v) => updateShiftField(machine, shiftIndex, "shiftEnd", v)}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 4, textAlign: 'right' }}>{isAr ? "بداية الوردية" : "Shift Start"}</Text>
          <TextInput
            style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, color: colors.foreground, textAlign: 'right', fontSize: 14 }}
            placeholder="06:00"
            placeholderTextColor={colors.muted}
            value={shift.shiftStart}
            onChangeText={(v) => updateShiftField(machine, shiftIndex, "shiftStart", v)}
          />
        </View>
      </View>

      {/* كمية الإنتاج */}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 4, textAlign: 'right' }}>{isAr ? "إنتاج (زوج)" : "Production (Pairs)"}</Text>
          <TextInput
            style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, color: colors.foreground, textAlign: 'right', fontSize: 14 }}
            placeholder="0"
            placeholderTextColor={colors.muted}
            value={shift.productionPairs}
            onChangeText={(v) => updateShiftField(machine, shiftIndex, "productionPairs", v)}
            keyboardType="numeric"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 4, textAlign: 'right' }}>{isAr ? "إنتاج (درزن)" : "Production (Dozen)"}</Text>
          <TextInput
            style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, color: colors.foreground, textAlign: 'right', fontSize: 14 }}
            placeholder="0"
            placeholderTextColor={colors.muted}
            value={shift.productionDozen}
            onChangeText={(v) => updateShiftField(machine, shiftIndex, "productionDozen", v)}
            keyboardType="numeric"
          />
        </View>
      </View>

      {/* هدر الخيوط وهدر الجوارب */}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 4, textAlign: 'right' }}>{isAr ? "هدر جوارب (جم)" : "Socks Waste (g)"}</Text>
          <TextInput
            style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, color: colors.foreground, textAlign: 'right', fontSize: 14 }}
            placeholder="0"
            placeholderTextColor={colors.muted}
            value={shift.wasteSocksGrams}
            onChangeText={(v) => updateShiftField(machine, shiftIndex, "wasteSocksGrams", v)}
            keyboardType="numeric"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 4, textAlign: 'right' }}>{isAr ? "هدر خيوط (جم)" : "Thread Waste (g)"}</Text>
          <TextInput
            style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, color: colors.foreground, textAlign: 'right', fontSize: 14 }}
            placeholder="0"
            placeholderTextColor={colors.muted}
            value={shift.wasteThreadGrams}
            onChangeText={(v) => updateShiftField(machine, shiftIndex, "wasteThreadGrams", v)}
            keyboardType="numeric"
          />
        </View>
      </View>

      {/* النخب الثاني وهدر الإبر */}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 4, textAlign: 'right' }}>{isAr ? "هدر إبر" : "Needles"}</Text>
          <TextInput
            style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, color: colors.foreground, textAlign: 'right', fontSize: 14 }}
            placeholder="0"
            placeholderTextColor={colors.muted}
            value={shift.wasteNeedles}
            onChangeText={(v) => updateShiftField(machine, shiftIndex, "wasteNeedles", v)}
            keyboardType="numeric"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 4, textAlign: 'right' }}>{isAr ? "نخب ثاني (زوج)" : "2nd Grade (Pairs)"}</Text>
          <TextInput
            style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, color: colors.foreground, textAlign: 'right', fontSize: 14 }}
            placeholder="0"
            placeholderTextColor={colors.muted}
            value={shift.secondGradePairs}
            onChangeText={(v) => updateShiftField(machine, shiftIndex, "secondGradePairs", v)}
            keyboardType="numeric"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 4, textAlign: 'right' }}>{isAr ? "نخب ثاني (درزن)" : "2nd Grade (Dz)"}</Text>
          <TextInput
            style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, color: colors.foreground, textAlign: 'right', fontSize: 14 }}
            placeholder="0"
            placeholderTextColor={colors.muted}
            value={shift.secondGradeDozen}
            onChangeText={(v) => updateShiftField(machine, shiftIndex, "secondGradeDozen", v)}
            keyboardType="numeric"
          />
        </View>
      </View>

      {/* مدة الإنتاج */}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 4, textAlign: 'right' }}>{isAr ? "دقيقة" : "Minutes"}</Text>
          <TextInput
            style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, color: colors.foreground, textAlign: 'right', fontSize: 14 }}
            placeholder="0"
            placeholderTextColor={colors.muted}
            value={shift.productionMinutes}
            onChangeText={(v) => updateShiftField(machine, shiftIndex, "productionMinutes", v)}
            keyboardType="numeric"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 4, textAlign: 'right' }}>{isAr ? "ساعة" : "Hours"}</Text>
          <TextInput
            style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, color: colors.foreground, textAlign: 'right', fontSize: 14 }}
            placeholder="0"
            placeholderTextColor={colors.muted}
            value={shift.productionHours}
            onChangeText={(v) => updateShiftField(machine, shiftIndex, "productionHours", v)}
            keyboardType="numeric"
          />
        </View>
      </View>

      {/* وزن الخيوط */}
      <View style={{ borderTopWidth: 1, borderColor: colors.border, paddingTop: 12, marginTop: 4 }}>
        <Text style={{ color: colors.foreground, fontWeight: '600', fontSize: 12, marginBottom: 8, textAlign: 'right' }}>{isAr ? "وزن الخيوط (جرام)" : "Yarn Weight (g)"}</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.muted, fontSize: 11, marginBottom: 4, textAlign: 'right' }}>{isAr ? "اسباندكس" : "Spandex"}</Text>
            <TextInput
              style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, color: colors.foreground, textAlign: 'right', fontSize: 13 }}
              placeholder="0" placeholderTextColor={colors.muted}
              value={shift.yarnSpandex}
              onChangeText={(v) => updateShiftField(machine, shiftIndex, "yarnSpandex", v)}
              keyboardType="numeric"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.muted, fontSize: 11, marginBottom: 4, textAlign: 'right' }}>{isAr ? "مطاط" : "Rubber"}</Text>
            <TextInput
              style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, color: colors.foreground, textAlign: 'right', fontSize: 13 }}
              placeholder="0" placeholderTextColor={colors.muted}
              value={shift.yarnRubber}
              onChangeText={(v) => updateShiftField(machine, shiftIndex, "yarnRubber", v)}
              keyboardType="numeric"
            />
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.muted, fontSize: 11, marginBottom: 4, textAlign: 'right' }}>{isAr ? "قطن" : "Cotton"}</Text>
            <TextInput
              style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, color: colors.foreground, textAlign: 'right', fontSize: 13 }}
              placeholder="0" placeholderTextColor={colors.muted}
              value={shift.yarnCotton}
              onChangeText={(v) => updateShiftField(machine, shiftIndex, "yarnCotton", v)}
              keyboardType="numeric"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.muted, fontSize: 11, marginBottom: 4, textAlign: 'right' }}>{isAr ? "نايلون" : "Nylon"}</Text>
            <TextInput
              style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, color: colors.foreground, textAlign: 'right', fontSize: 13 }}
              placeholder="0" placeholderTextColor={colors.muted}
              value={shift.yarnNylon}
              onChangeText={(v) => updateShiftField(machine, shiftIndex, "yarnNylon", v)}
              keyboardType="numeric"
            />
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.muted, fontSize: 11, marginBottom: 4, textAlign: 'right' }}>{isAr ? "اسبان" : "Span"}</Text>
            <TextInput
              style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, color: colors.foreground, textAlign: 'right', fontSize: 13 }}
              placeholder="0" placeholderTextColor={colors.muted}
              value={shift.yarnSpan}
              onChangeText={(v) => updateShiftField(machine, shiftIndex, "yarnSpan", v)}
              keyboardType="numeric"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.muted, fontSize: 11, marginBottom: 4, textAlign: 'right' }}>{isAr ? "بامبو" : "Bamboo"}</Text>
            <TextInput
              style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, color: colors.foreground, textAlign: 'right', fontSize: 13 }}
              placeholder="0" placeholderTextColor={colors.muted}
              value={shift.yarnBamboo}
              onChangeText={(v) => updateShiftField(machine, shiftIndex, "yarnBamboo", v)}
              keyboardType="numeric"
            />
          </View>
        </View>
      </View>
    </View>
  );

  // فورم الإدخال الرئيسي
  const renderForm = () => (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      {/* التاريخ */}
      <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: colors.border, marginBottom: 16 }}>
        <Text style={{ color: colors.foreground, fontWeight: '600', fontSize: 14, marginBottom: 8, textAlign: 'right' }}>{isAr ? "التاريخ" : "Date"}</Text>
        <TextInput
          style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, color: colors.foreground, textAlign: 'right', fontSize: 16 }}
          value={selectedDate}
          onChangeText={setSelectedDate}
          placeholder="2026-01-01"
          placeholderTextColor={colors.muted}
        />

        {/* اختيار المكائن */}
        <View style={{ marginTop: 16 }}>
          <Text style={{ color: colors.foreground, fontWeight: '600', fontSize: 14, marginBottom: 12, textAlign: 'right' }}>{isAr ? "اختر المكائن" : "Select Machines"}</Text>
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
                <Text style={{ color: activeMachines.includes(machine) ? "white" : "#16a34a", fontWeight: "700", fontSize: 11 }}>
                  {machine}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {/* حقول الإدخال لكل مكينة مفعلة */}
      {activeMachines.map((machine) => {
        const machineShifts = machinesData[machine] || { shifts: [emptyShiftData(1)] };
        return (
          <View key={machine} style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: colors.border, marginBottom: 12 }}>
            {/* رأس المكينة */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <TouchableOpacity
                onPress={() => addShift(machine)}
                style={{ backgroundColor: "#0a7ea420", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 4 }}
              >
                <Text style={{ color: "#0a7ea4", fontSize: 12, fontWeight: '600' }}>{isAr ? "إضافة وردية" : "Add Shift"}</Text>
                <MaterialIcons name="add" size={16} color="#0a7ea4" />
              </TouchableOpacity>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ color: colors.foreground, fontWeight: 'bold', fontSize: 16 }}>{machine}</Text>
                <View style={{ backgroundColor: "#16a34a20", borderRadius: 14, padding: 5 }}>
                  <MaterialIcons name="precision-manufacturing" size={16} color="#16a34a" />
                </View>
              </View>
            </View>

            {/* ورديات المكينة */}
            {machineShifts.shifts.map((shift, idx) => renderShiftForm(machine, shift, idx, machineShifts.shifts.length))}
          </View>
        );
      })}

      {/* أزرار الحفظ */}
      {activeMachines.length > 0 && (
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 8, marginBottom: 32 }}>
          <TouchableOpacity
            onPress={() => { setShowForm(false); resetForm(); }}
            style={{ flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingVertical: 14, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6 }}
          >
            <Text style={{ color: colors.foreground, fontWeight: '600', fontSize: 14 }}>{isAr ? "إلغاء" : "Cancel"}</Text>
            <MaterialIcons name="close" size={18} color={colors.foreground} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleSave}
            style={{ flex: 1, backgroundColor: "#16a34a", borderRadius: 12, paddingVertical: 14, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6 }}
          >
            <Text style={{ color: '#ffffff', fontWeight: '600', fontSize: 14 }}>{editingEntry ? (isAr ? "تعديل" : "Update") : (isAr ? "حفظ" : "Save")}</Text>
            <MaterialIcons name="save" size={18} color="white" />
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );

  return (
    <ScreenContainer style={{ backgroundColor: colors.background }}>
      {/* رأس الصفحة */}
      <View style={{ backgroundColor: "#16a34a", paddingHorizontal: 24, paddingVertical: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <TouchableOpacity
          onPress={() => { resetForm(); setShowForm(true); }}
          style={{ backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 20, padding: 8 }}
        >
          <MaterialIcons name="add" size={24} color="white" />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setShowDailySummary(!showDailySummary)}
          style={{ backgroundColor: showDailySummary ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.2)", borderRadius: 20, padding: 8 }}
        >
          <MaterialIcons name="analytics" size={24} color="white" />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push("/production-totals" as any)}
          style={{ backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 20, padding: 8 }}
        >
          <MaterialIcons name="summarize" size={24} color="white" />
        </TouchableOpacity>

        <AdminBadgeIcon />

        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={{ color: '#ffffff', fontWeight: 'bold', fontSize: 20 }}>{isAr ? "الإنتاج" : "Production"}</Text>
          <Text style={{ fontSize: 14, marginTop: 4, color: 'rgba(255,255,255,0.8)' }}>{entries.length} {isAr ? "سجل" : "Record"}</Text>
        </View>

        <BackButton />
      </View>

      {/* الملخص اليومي */}
      {showDailySummary && entries.length > 0 && (() => {
        const todayStr = formatDate(new Date());
        const todayEntries = entries.filter(e => e.date === todayStr);
        const allEntries = todayEntries.length > 0 ? todayEntries : entries.slice(0, 1);
        const label = todayEntries.length > 0 ? (isAr ? `ملخص اليوم (${todayStr})` : `Today (${todayStr})`) : (isAr ? `ملخص آخر يوم (${allEntries[0]?.date})` : `Last Day (${allEntries[0]?.date})`);

        let sumYarnWeight = 0, sumWasteThread = 0, sumWasteSocks = 0;
        allEntries.forEach(entry => {
          Object.values(entry.machines).forEach(machineShifts => {
            machineShifts.shifts.forEach(s => {
              sumYarnWeight += getShiftTotalYarn(s);
              sumWasteThread += parseFloat(s.wasteThreadGrams) || 0;
              sumWasteSocks += parseFloat(s.wasteSocksGrams) || 0;
            });
          });
        });

        const sumWasteAll = sumWasteThread + sumWasteSocks;
        const wastePercent = sumYarnWeight > 0 ? ((sumWasteAll / sumYarnWeight) * 100).toFixed(2) : "0";

        return (
          <View style={{ marginHorizontal: 16, marginTop: 12, backgroundColor: colors.surface, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ color: colors.foreground, fontWeight: 'bold', fontSize: 16, textAlign: 'right', marginBottom: 12 }}>{label}</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <View style={{ flex: 1, alignItems: 'center', backgroundColor: colors.background, borderRadius: 8, padding: 12, marginHorizontal: 4 }}>
                <MaterialIcons name="scale" size={22} color="#0a7ea4" />
                <Text style={{ color: colors.muted, fontSize: 11, marginTop: 4 }}>{isAr ? "خيوط" : "Yarn"}</Text>
                <Text style={{ color: colors.primary, fontWeight: 'bold', fontSize: 16 }}>{sumYarnWeight.toFixed(0)}</Text>
              </View>
              <View style={{ flex: 1, alignItems: 'center', backgroundColor: colors.background, borderRadius: 8, padding: 12, marginHorizontal: 4 }}>
                <MaterialIcons name="delete-outline" size={22} color="#ef4444" />
                <Text style={{ color: colors.muted, fontSize: 11, marginTop: 4 }}>{isAr ? "هدر" : "Waste"}</Text>
                <Text style={{ color: colors.error, fontWeight: 'bold', fontSize: 16 }}>{sumWasteAll.toFixed(0)}</Text>
              </View>
              <View style={{ flex: 1, alignItems: 'center', backgroundColor: colors.background, borderRadius: 8, padding: 12, marginHorizontal: 4 }}>
                <MaterialIcons name="percent" size={22} color="#f59e0b" />
                <Text style={{ color: colors.muted, fontSize: 11, marginTop: 4 }}>{isAr ? "نسبة" : "%"}</Text>
                <Text style={{ color: colors.warning, fontWeight: 'bold', fontSize: 16 }}>{wastePercent}%</Text>
              </View>
            </View>
          </View>
        );
      })()}

      {/* بطاقة إجمالي بيانات المكائن */}
      {!showForm && (
        <TouchableOpacity
          onPress={() => router.push("/production-totals" as any)}
          style={{ marginHorizontal: 16, marginTop: 12, marginBottom: 4, backgroundColor: "#f0fdf4", borderRadius: 16, padding: 16, borderWidth: 2, borderColor: "#16a34a", flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
        >
          <MaterialIcons name="chevron-left" size={24} color="#16a34a" />
          <View style={{ flex: 1, alignItems: "flex-end" }}>
            <Text style={{ fontSize: 16, fontWeight: "bold", color: "#16a34a" }}>{isAr ? "إجمالي بيانات المكائن" : "Total Machine Data"}</Text>
            <Text style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>{isAr ? "عرض إجماليات الإنتاج والهدر والخيوط" : "View Production, Waste, and Yarn Totals"}</Text>
          </View>
          <View style={{ backgroundColor: "#16a34a", borderRadius: 12, padding: 10, marginLeft: 12 }}>
            <MaterialIcons name="summarize" size={28} color="white" />
          </View>
        </TouchableOpacity>
      )}
      {!showForm && <AdminCard />}

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
                {isAr ? "لا توجد بيانات إنتاج بعد.\nاضغط على زر (+) لإضافة بيانات إنتاج جديدة." : "No production data yet.\nPress (+) to add new production data."}
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
