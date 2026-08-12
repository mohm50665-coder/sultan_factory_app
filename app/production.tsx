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
import { productionService, appSettingsService } from "@/lib/services/api.service";
import { useAuth } from "@/lib/auth-context";
import { AdminBadgeIcon } from "@/components/admin-badge-icon";
import { AdminCard } from "@/components/admin-card";
import { AttachmentPicker } from "@/components/attachment-picker";
import { AttachmentFile } from "@/lib/services/attachment.service";


// أرقام المكائن
const MACHINES = [
  "RB1", "RB2", "RB3", "RB4", "RB5", "RB6", "RB7", "RB8", "RB9",
  "NS1",
  "RS1", "RS2", "RS3", "RS4", "RS5", "RS6", "RS7", "RS8", "RS9", "RS10", "RS11",
  "LT1", "LT2",
];

// ملاحظة 6: اسم المنتج = اسم الصنف + المقاس + اللون
interface ProductItem {
  itemName: string;       // اسم الصنف
  itemSize: string;       // المقاس
  itemColor: string;      // اللون
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
}

// ملاحظة 3: كل مكينة تتحمل 5 منتجات أو أكثر
interface ShiftData {
  shiftNumber: number;
  shiftStart: string;
  shiftEnd: string;
  products: ProductItem[]; // مصفوفة منتجات بدل منتج واحد
}

// بيانات المنتج المحفوظة تلقائياً (ملاحظة 5)
interface SavedProductData {
  itemName: string;
  itemSize: string;
  itemColor: string;
  yarnWeightPerPair: string;
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

const emptyProduct = (): ProductItem => ({
  itemName: "",
  itemSize: "",
  itemColor: "",
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
  yarnWeightPerPair: "",
});

const emptyShiftData = (shiftNum: number): ShiftData => ({
  shiftNumber: shiftNum,
  shiftStart: "",
  shiftEnd: "",
  products: [emptyProduct()],
});

const formatDate = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// دالة تحويل النخب الثاني من زوج لدرزن (ملاحظة 1)
const convertPairsToDozens = (totalPairs: number): { dozens: number; remainingPairs: number } => {
  const dozens = Math.floor(totalPairs / 12);
  const remainingPairs = totalPairs % 12;
  return { dozens, remainingPairs };
};

// دالة الحصول على اسم المنتج الكامل
const getFullProductName = (product: ProductItem): string => {
  const parts = [product.itemName, product.itemSize, product.itemColor].filter(p => p.trim());
  return parts.join(" - ") || "";
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
  const [productionAttachments, setProductionAttachments] = useState<AttachmentFile[]>([]);

  const [selectedDate, setSelectedDate] = useState(formatDate(new Date()));
  const [machinesData, setMachinesData] = useState<{ [key: string]: MachineShifts }>({});
  const [activeMachines, setActiveMachines] = useState<string[]>([]);
  const [savedProducts, setSavedProducts] = useState<SavedProductData[]>([]);
  const [productSuggestions, setProductSuggestions] = useState<SavedProductData[]>([]);
  const [showSuggestions, setShowSuggestions] = useState<{machine: string; shiftIndex: number; productIndex: number} | null>(null);

  useEffect(() => {
    loadEntries();
    loadSavedProducts();
  }, []);

  // تحميل بيانات المنتجات المحفوظة (ملاحظة 5)
  const loadSavedProducts = async () => {
    try {
      const result = await appSettingsService.get("saved_products_data");
      if (result && result.value) {
        const parsed = JSON.parse(result.value);
        setSavedProducts(parsed);
      }
    } catch (e) {
      console.log("Error loading saved products:", e);
    }
  };

  // حفظ بيانات منتج جديد (ملاحظة 5)
  const saveProductData = async (product: ProductItem) => {
    if (!product.itemName.trim()) return;
    const key = `${product.itemName.trim()}_${product.itemSize.trim()}_${product.itemColor.trim()}`;
    const newSaved: SavedProductData = {
      itemName: product.itemName.trim(),
      itemSize: product.itemSize.trim(),
      itemColor: product.itemColor.trim(),
      yarnWeightPerPair: product.yarnWeightPerPair,
      yarnRubber: product.yarnRubber,
      yarnSpandex: product.yarnSpandex,
      yarnNylon: product.yarnNylon,
      yarnCotton: product.yarnCotton,
      yarnBamboo: product.yarnBamboo,
      yarnSpan: product.yarnSpan,
    };
    // تحديث أو إضافة
    const existing = savedProducts.findIndex(p =>
      `${p.itemName.trim()}_${p.itemSize.trim()}_${p.itemColor.trim()}` === key
    );
    let updated: SavedProductData[];
    if (existing >= 0) {
      updated = [...savedProducts];
      updated[existing] = newSaved;
    } else {
      updated = [...savedProducts, newSaved];
    }
    setSavedProducts(updated);
    try {
      await appSettingsService.set("saved_products_data", JSON.stringify(updated));
    } catch (e) {
      console.log("Error saving product data:", e);
    }
  };

  // البحث عن اقتراحات المنتجات (ملاحظة 5)
  const getProductSuggestions = (text: string): SavedProductData[] => {
    if (!text.trim()) return [];
    return savedProducts.filter(p =>
      p.itemName.includes(text.trim()) ||
      p.itemColor.includes(text.trim()) ||
      p.itemSize.includes(text.trim())
    );
  };

  const loadEntries = async () => {
    try {
      setIsLoading(true);
      const rows = await productionService.getAll() || [];
      // تجميع حسب التاريخ ثم المكينة ثم الورديات
      const grouped: { [date: string]: { [machine: string]: { [shift: number]: ProductItem[] } } } = {};
      for (const row of rows) {
        const d = row.date || "";
        if (!grouped[d]) grouped[d] = {};
        const machine = row.machineNumber || "unknown";
        if (!grouped[d][machine]) grouped[d][machine] = {};
        const shiftNum = row.shiftNumber || 1;
        if (!grouped[d][machine][shiftNum]) grouped[d][machine][shiftNum] = [];

        // تحليل اسم المنتج القديم (قد يكون "صنف - مقاس - لون" أو نص واحد)
        const rawName = row.productName || "";
        let itemName = rawName;
        let itemSize = "";
        let itemColor = "";
        if (rawName.includes(" - ")) {
          const parts = rawName.split(" - ");
          itemName = parts[0] || "";
          itemSize = parts[1] || "";
          itemColor = parts[2] || "";
        }

        grouped[d][machine][shiftNum].push({
          itemName,
          itemSize,
          itemColor,
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
          yarnWeightPerPair: String(row.yarnWeightPerPair || ""),
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
              {
                shifts: Object.entries(shifts)
                  .sort(([a], [b]) => parseInt(a) - parseInt(b))
                  .map(([shiftNum, products]) => ({
                    shiftNumber: parseInt(shiftNum),
                    shiftStart: "",
                    shiftEnd: "",
                    products,
                  })),
              },
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
          shift.products.forEach((product) => {
            // اسم المنتج = صنف - مقاس - لون
            const productName = getFullProductName(product);
            if (!productName && !product.productionDozen && !product.productionPairs) return; // تخطي المنتجات الفارغة
            batchEntries.push({
              date: entry.date,
              machineNumber: machine,
              productName: productName,
              shiftNumber: shift.shiftNumber || 1,
              shiftStart: shift.shiftStart || "",
              shiftEnd: shift.shiftEnd || "",
              productionDozen: parseInt(product.productionDozen) || 0,
              productionPairs: parseInt(product.productionPairs) || 0,
              wasteThreadGrams: parseInt(product.wasteThreadGrams) || 0,
              wasteSocksGrams: parseInt(product.wasteSocksGrams) || 0,
              secondGradeDozen: parseInt(product.secondGradeDozen) || 0,
              secondGradePairs: parseInt(product.secondGradePairs) || 0,
              wasteNeedles: parseInt(product.wasteNeedles) || 0,
              productionHours: parseInt(product.productionHours) || 0,
              productionMinutes: parseInt(product.productionMinutes) || 0,
              yarnRubber: parseInt(product.yarnRubber) || 0,
              yarnSpandex: parseInt(product.yarnSpandex) || 0,
              yarnNylon: parseInt(product.yarnNylon) || 0,
              yarnCotton: parseInt(product.yarnCotton) || 0,
              yarnBamboo: parseInt(product.yarnBamboo) || 0,
              yarnSpan: parseInt(product.yarnSpan) || 0,
              userId,
            });
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
    newShifts.forEach((s, i) => { s.shiftNumber = i + 1; });
    setMachinesData({ ...machinesData, [machine]: { shifts: newShifts } });
  };

  // ملاحظة 3: إضافة منتج جديد في الوردية
  const addProduct = (machine: string, shiftIndex: number) => {
    const current = machinesData[machine] || { shifts: [emptyShiftData(1)] };
    const newShifts = [...current.shifts];
    newShifts[shiftIndex] = {
      ...newShifts[shiftIndex],
      products: [...newShifts[shiftIndex].products, emptyProduct()],
    };
    setMachinesData({ ...machinesData, [machine]: { shifts: newShifts } });
  };

  // حذف منتج من الوردية
  const removeProduct = (machine: string, shiftIndex: number, productIndex: number) => {
    const current = machinesData[machine];
    if (!current) return;
    const products = current.shifts[shiftIndex].products;
    if (products.length <= 1) return;
    const newShifts = [...current.shifts];
    newShifts[shiftIndex] = {
      ...newShifts[shiftIndex],
      products: products.filter((_, i) => i !== productIndex),
    };
    setMachinesData({ ...machinesData, [machine]: { shifts: newShifts } });
  };

  const updateShiftField = (machine: string, shiftIndex: number, field: "shiftStart" | "shiftEnd", value: string) => {
    const current = machinesData[machine] || { shifts: [emptyShiftData(1)] };
    const newShifts = [...current.shifts];
    newShifts[shiftIndex] = { ...newShifts[shiftIndex], [field]: value };
    setMachinesData({ ...machinesData, [machine]: { shifts: newShifts } });
  };

  const updateProductField = (machine: string, shiftIndex: number, productIndex: number, field: keyof ProductItem, value: string) => {
    const current = machinesData[machine] || { shifts: [emptyShiftData(1)] };
    const newShifts = [...current.shifts];
    const newProducts = [...newShifts[shiftIndex].products];
    newProducts[productIndex] = { ...newProducts[productIndex], [field]: value };

    // ملاحظة 5: عند تغيير اسم الصنف - إظهار اقتراحات
    if (field === "itemName") {
      const suggestions = getProductSuggestions(value);
      setProductSuggestions(suggestions);
      if (value.trim()) {
        setShowSuggestions({ machine, shiftIndex, productIndex });
      } else {
        setShowSuggestions(null);
      }
    }

    newShifts[shiftIndex] = { ...newShifts[shiftIndex], products: newProducts };
    setMachinesData({ ...machinesData, [machine]: { shifts: newShifts } });
  };

  // اختيار منتج من الاقتراحات (ملاحظة 5)
  const selectProductSuggestion = (machine: string, shiftIndex: number, productIndex: number, saved: SavedProductData) => {
    const current = machinesData[machine] || { shifts: [emptyShiftData(1)] };
    const newShifts = [...current.shifts];
    const newProducts = [...newShifts[shiftIndex].products];
    // تعبئة تلقائية لكل البيانات ماعدا الكمية والهدر والنخب الثاني والوقت
    newProducts[productIndex] = {
      ...newProducts[productIndex],
      itemName: saved.itemName,
      itemSize: saved.itemSize,
      itemColor: saved.itemColor,
      yarnWeightPerPair: saved.yarnWeightPerPair,
      yarnRubber: saved.yarnRubber,
      yarnSpandex: saved.yarnSpandex,
      yarnNylon: saved.yarnNylon,
      yarnCotton: saved.yarnCotton,
      yarnBamboo: saved.yarnBamboo,
      yarnSpan: saved.yarnSpan,
      // لا نعبئ: productionDozen, productionPairs, wasteThreadGrams, wasteSocksGrams, secondGradeDozen, secondGradePairs, wasteNeedles, productionHours, productionMinutes
    };
    newShifts[shiftIndex] = { ...newShifts[shiftIndex], products: newProducts };
    setMachinesData({ ...machinesData, [machine]: { shifts: newShifts } });
    setShowSuggestions(null);
    setProductSuggestions([]);
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
      // حفظ بيانات المنتجات تلقائياً (ملاحظة 5)
      activeMachines.forEach((machine) => {
        const mData = machinesData[machine] || { shifts: [] };
        mData.shifts.forEach((shift) => {
          shift.products.forEach((product) => {
            if (product.itemName.trim()) {
              saveProductData(product);
            }
          });
        });
      });

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

  // حساب إجمالي وزن الخيوط لمنتج واحد
  const getProductTotalYarn = (p: ProductItem): number => {
    return (
      (parseFloat(p.yarnRubber) || 0) +
      (parseFloat(p.yarnSpandex) || 0) +
      (parseFloat(p.yarnNylon) || 0) +
      (parseFloat(p.yarnCotton) || 0) +
      (parseFloat(p.yarnBamboo) || 0) +
      (parseFloat(p.yarnSpan) || 0)
    );
  };

  // حساب المجاميع لسجل واحد
  const getEntryTotals = (entry: ProductionEntry) => {
    let totalDozen = 0, totalPairs = 0, totalWasteThread = 0, totalWasteSocks = 0;
    let totalSecondDozen = 0, totalSecondPairs = 0, totalNeedles = 0;
    let totalHours = 0, totalMinutes = 0;
    let totalYarnRubber = 0, totalYarnSpandex = 0, totalYarnNylon = 0;
    let totalYarnCotton = 0, totalYarnBamboo = 0, totalYarnSpan = 0;
    let totalYarnByPairs = 0;

    Object.values(entry.machines).forEach((machineShifts) => {
      machineShifts.shifts.forEach((shift) => {
        shift.products.forEach((p) => {
          totalDozen += parseFloat(p.productionDozen) || 0;
          totalPairs += parseFloat(p.productionPairs) || 0;
          totalWasteThread += parseFloat(p.wasteThreadGrams) || 0;
          totalWasteSocks += parseFloat(p.wasteSocksGrams) || 0;
          totalSecondDozen += parseFloat(p.secondGradeDozen) || 0;
          totalSecondPairs += parseFloat(p.secondGradePairs) || 0;
          totalNeedles += parseFloat(p.wasteNeedles) || 0;
          totalHours += parseFloat(p.productionHours) || 0;
          totalMinutes += parseFloat(p.productionMinutes) || 0;
          totalYarnRubber += parseFloat(p.yarnRubber) || 0;
          totalYarnSpandex += parseFloat(p.yarnSpandex) || 0;
          totalYarnNylon += parseFloat(p.yarnNylon) || 0;
          totalYarnCotton += parseFloat(p.yarnCotton) || 0;
          totalYarnBamboo += parseFloat(p.yarnBamboo) || 0;
          totalYarnSpan += parseFloat(p.yarnSpan) || 0;
          const yarnPerPair = parseFloat(p.yarnWeightPerPair) || 0;
          const pairs = parseInt(p.productionPairs) || 0;
          totalYarnByPairs += yarnPerPair * pairs;
        });
      });
    });

    totalHours += Math.floor(totalMinutes / 60);
    totalMinutes = totalMinutes % 60;

    const totalYarnWeight = totalYarnRubber + totalYarnSpandex + totalYarnNylon + totalYarnCotton + totalYarnBamboo + totalYarnSpan;
    const totalWasteAll = totalWasteThread + totalWasteSocks;
    const wastePercentage = totalYarnWeight > 0 ? ((totalWasteAll / totalYarnWeight) * 100).toFixed(2) : "0";

    // ملاحظة 1: تحويل النخب الثاني
    const totalSecondPairsAll = totalSecondPairs + (totalSecondDozen * 12);
    const secondConverted = convertPairsToDozens(totalSecondPairsAll);

    return {
      totalDozen, totalPairs, totalWasteThread, totalWasteSocks,
      totalSecondDozen: secondConverted.dozens, totalSecondPairs: secondConverted.remainingPairs,
      totalNeedles, totalHours, totalMinutes,
      totalYarnRubber, totalYarnSpandex, totalYarnNylon, totalYarnCotton, totalYarnBamboo, totalYarnSpan,
      totalYarnWeight, totalWasteAll, wastePercentage, totalYarnByPairs,
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
              <Text style={{ color: colors.muted, fontSize: 12, flex: 1 }}>
                {entry.machines[machine].shifts.map(s =>
                  s.products.map(p => getFullProductName(p) || (isAr ? "بدون اسم" : "No name")).join(", ")
                ).join(" | ")}
              </Text>
              <Text style={{ color: colors.primary, fontWeight: 'bold', fontSize: 14, marginLeft: 8 }}>{machine}</Text>
            </View>
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
            <Text style={{ color: colors.muted, fontSize: 10 }}>{isAr ? "نخب ثاني" : "2nd Grade"}</Text>
            <Text style={{ color: "#f59e0b", fontWeight: 'bold', fontSize: 14 }}>
              {totals.totalSecondDozen > 0 ? `${totals.totalSecondDozen} ${isAr ? "د" : "dz"}` : ""}{totals.totalSecondPairs > 0 ? ` ${totals.totalSecondPairs} ${isAr ? "ز" : "pr"}` : "0"}
            </Text>
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

  // فورم إدخال منتج واحد
  const renderProductForm = (machine: string, shiftIndex: number, product: ProductItem, productIndex: number, totalProducts: number) => (
    <View key={`${machine}-s${shiftIndex}-p${productIndex}`} style={{ backgroundColor: colors.background, borderRadius: 8, padding: 10, marginBottom: 8, borderWidth: 1, borderColor: colors.border }}>
      {/* رأس المنتج */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {totalProducts > 1 && (
            <TouchableOpacity onPress={() => removeProduct(machine, shiftIndex, productIndex)} style={{ backgroundColor: "#ef444415", borderRadius: 14, padding: 3 }}>
              <MaterialIcons name="remove-circle" size={18} color="#ef4444" />
            </TouchableOpacity>
          )}
        </View>
        <Text style={{ color: colors.primary, fontWeight: '600', fontSize: 12 }}>
          {isAr ? `منتج ${productIndex + 1}` : `Product ${productIndex + 1}`}
        </Text>
      </View>

      {/* ملاحظة 6: اسم الصنف + المقاس + اللون */}
      <View style={{ marginBottom: 8, zIndex: 10 }}>
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 6 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.muted, fontSize: 11, marginBottom: 3, textAlign: 'right' }}>{isAr ? "اللون" : "Color"}</Text>
            <TextInput
              style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6, color: colors.foreground, textAlign: 'right', fontSize: 13 }}
              placeholder={isAr ? "اللون" : "Color"}
              placeholderTextColor={colors.muted}
              value={product.itemColor}
              onChangeText={(v) => updateProductField(machine, shiftIndex, productIndex, "itemColor", v)}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.muted, fontSize: 11, marginBottom: 3, textAlign: 'right' }}>{isAr ? "المقاس" : "Size"}</Text>
            <TextInput
              style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6, color: colors.foreground, textAlign: 'right', fontSize: 13 }}
              placeholder={isAr ? "المقاس" : "Size"}
              placeholderTextColor={colors.muted}
              value={product.itemSize}
              onChangeText={(v) => updateProductField(machine, shiftIndex, productIndex, "itemSize", v)}
            />
          </View>
          <View style={{ flex: 2 }}>
            <Text style={{ color: colors.muted, fontSize: 11, marginBottom: 3, textAlign: 'right' }}>{isAr ? "اسم الصنف" : "Item Name"}</Text>
            <TextInput
              style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6, color: colors.foreground, textAlign: 'right', fontSize: 13 }}
              placeholder={isAr ? "اسم الصنف" : "Item name"}
              placeholderTextColor={colors.muted}
              value={product.itemName}
              onChangeText={(v) => updateProductField(machine, shiftIndex, productIndex, "itemName", v)}
              onBlur={() => setTimeout(() => setShowSuggestions(null), 200)}
            />
          </View>
        </View>
        {/* اقتراحات المنتجات المحفوظة */}
        {showSuggestions?.machine === machine && showSuggestions?.shiftIndex === shiftIndex && showSuggestions?.productIndex === productIndex && productSuggestions.length > 0 && (
          <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.primary, borderRadius: 8, marginTop: 2, maxHeight: 120, overflow: 'hidden' }}>
            <ScrollView nestedScrollEnabled style={{ maxHeight: 120 }}>
              {productSuggestions.map((suggestion, idx) => (
                <TouchableOpacity
                  key={idx}
                  onPress={() => selectProductSuggestion(machine, shiftIndex, productIndex, suggestion)}
                  style={{ paddingHorizontal: 10, paddingVertical: 8, borderBottomWidth: idx < productSuggestions.length - 1 ? 1 : 0, borderColor: colors.border }}
                >
                  <Text style={{ color: colors.foreground, fontSize: 12, textAlign: 'right' }}>
                    {suggestion.itemName} - {suggestion.itemSize} - {suggestion.itemColor}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 10, textAlign: 'right' }}>
                    {isAr ? "وزن الخيط:" : "Yarn:"} {suggestion.yarnWeightPerPair} {isAr ? "جم/زوج" : "g/pair"}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </View>

      {/* وزن الخيط لكل زوج + إجمالي */}
      <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
        <View style={{ flex: 1, backgroundColor: '#f0fdf4', borderRadius: 6, padding: 6, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#16a34a', fontSize: 9 }}>{isAr ? "إجمالي وزن الخيوط" : "Total Yarn"}</Text>
          <Text style={{ color: '#16a34a', fontWeight: 'bold', fontSize: 14 }}>
            {(() => {
              const weight = parseFloat(product.yarnWeightPerPair) || 0;
              const pairs = parseInt(product.productionPairs) || 0;
              const total = weight * pairs;
              return total > 0 ? `${total.toLocaleString()} ${isAr ? 'جم' : 'g'}` : '---';
            })()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.muted, fontSize: 11, marginBottom: 3, textAlign: 'right' }}>{isAr ? "وزن الخيط/زوج" : "Yarn/Pair"}</Text>
          <TextInput
            style={{ backgroundColor: product.yarnWeightPerPair ? '#f0fdf4' : colors.surface, borderWidth: 1, borderColor: product.yarnWeightPerPair ? '#16a34a' : colors.border, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6, color: colors.foreground, textAlign: 'right', fontSize: 13 }}
            placeholder="0"
            placeholderTextColor={colors.muted}
            value={product.yarnWeightPerPair}
            onChangeText={(v) => updateProductField(machine, shiftIndex, productIndex, "yarnWeightPerPair", v)}
            keyboardType="numeric"
          />
        </View>
      </View>

      {/* كمية الإنتاج */}
      <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.muted, fontSize: 11, marginBottom: 3, textAlign: 'right' }}>{isAr ? "إنتاج (زوج)" : "Pairs"}</Text>
          <TextInput
            style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6, color: colors.foreground, textAlign: 'right', fontSize: 13 }}
            placeholder="0" placeholderTextColor={colors.muted}
            value={product.productionPairs}
            onChangeText={(v) => updateProductField(machine, shiftIndex, productIndex, "productionPairs", v)}
            keyboardType="numeric"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.muted, fontSize: 11, marginBottom: 3, textAlign: 'right' }}>{isAr ? "إنتاج (درزن)" : "Dozen"}</Text>
          <TextInput
            style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6, color: colors.foreground, textAlign: 'right', fontSize: 13 }}
            placeholder="0" placeholderTextColor={colors.muted}
            value={product.productionDozen}
            onChangeText={(v) => updateProductField(machine, shiftIndex, productIndex, "productionDozen", v)}
            keyboardType="numeric"
          />
        </View>
      </View>

      {/* الهدر */}
      <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.muted, fontSize: 11, marginBottom: 3, textAlign: 'right' }}>{isAr ? "هدر جوارب (جم)" : "Socks (g)"}</Text>
          <TextInput
            style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6, color: colors.foreground, textAlign: 'right', fontSize: 13 }}
            placeholder="0" placeholderTextColor={colors.muted}
            value={product.wasteSocksGrams}
            onChangeText={(v) => updateProductField(machine, shiftIndex, productIndex, "wasteSocksGrams", v)}
            keyboardType="numeric"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.muted, fontSize: 11, marginBottom: 3, textAlign: 'right' }}>{isAr ? "هدر خيوط (جم)" : "Thread (g)"}</Text>
          <TextInput
            style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6, color: colors.foreground, textAlign: 'right', fontSize: 13 }}
            placeholder="0" placeholderTextColor={colors.muted}
            value={product.wasteThreadGrams}
            onChangeText={(v) => updateProductField(machine, shiftIndex, productIndex, "wasteThreadGrams", v)}
            keyboardType="numeric"
          />
        </View>
      </View>

      {/* النخب الثاني وهدر الإبر */}
      <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.muted, fontSize: 11, marginBottom: 3, textAlign: 'right' }}>{isAr ? "هدر إبر" : "Needles"}</Text>
          <TextInput
            style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6, color: colors.foreground, textAlign: 'right', fontSize: 13 }}
            placeholder="0" placeholderTextColor={colors.muted}
            value={product.wasteNeedles}
            onChangeText={(v) => updateProductField(machine, shiftIndex, productIndex, "wasteNeedles", v)}
            keyboardType="numeric"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.muted, fontSize: 11, marginBottom: 3, textAlign: 'right' }}>{isAr ? "نخب ثاني (زوج)" : "2nd (Pairs)"}</Text>
          <TextInput
            style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6, color: colors.foreground, textAlign: 'right', fontSize: 13 }}
            placeholder="0" placeholderTextColor={colors.muted}
            value={product.secondGradePairs}
            onChangeText={(v) => updateProductField(machine, shiftIndex, productIndex, "secondGradePairs", v)}
            keyboardType="numeric"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.muted, fontSize: 11, marginBottom: 3, textAlign: 'right' }}>{isAr ? "نخب ثاني (درزن)" : "2nd (Dz)"}</Text>
          <TextInput
            style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6, color: colors.foreground, textAlign: 'right', fontSize: 13 }}
            placeholder="0" placeholderTextColor={colors.muted}
            value={product.secondGradeDozen}
            onChangeText={(v) => updateProductField(machine, shiftIndex, productIndex, "secondGradeDozen", v)}
            keyboardType="numeric"
          />
        </View>
      </View>

      {/* مدة الإنتاج */}
      <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.muted, fontSize: 11, marginBottom: 3, textAlign: 'right' }}>{isAr ? "دقيقة" : "Min"}</Text>
          <TextInput
            style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6, color: colors.foreground, textAlign: 'right', fontSize: 13 }}
            placeholder="0" placeholderTextColor={colors.muted}
            value={product.productionMinutes}
            onChangeText={(v) => updateProductField(machine, shiftIndex, productIndex, "productionMinutes", v)}
            keyboardType="numeric"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.muted, fontSize: 11, marginBottom: 3, textAlign: 'right' }}>{isAr ? "ساعة" : "Hour"}</Text>
          <TextInput
            style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6, color: colors.foreground, textAlign: 'right', fontSize: 13 }}
            placeholder="0" placeholderTextColor={colors.muted}
            value={product.productionHours}
            onChangeText={(v) => updateProductField(machine, shiftIndex, productIndex, "productionHours", v)}
            keyboardType="numeric"
          />
        </View>
      </View>

      {/* وزن الخيوط */}
      <View style={{ borderTopWidth: 1, borderColor: colors.border, paddingTop: 8, marginTop: 4 }}>
        <Text style={{ color: colors.foreground, fontWeight: '600', fontSize: 11, marginBottom: 6, textAlign: 'right' }}>{isAr ? "وزن الخيوط (جرام)" : "Yarn Weight (g)"}</Text>
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 6 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.muted, fontSize: 10, marginBottom: 2, textAlign: 'right' }}>{isAr ? "اسباندكس" : "Spandex"}</Text>
            <TextInput
              style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 5, color: colors.foreground, textAlign: 'right', fontSize: 12 }}
              placeholder="0" placeholderTextColor={colors.muted}
              value={product.yarnSpandex}
              onChangeText={(v) => updateProductField(machine, shiftIndex, productIndex, "yarnSpandex", v)}
              keyboardType="numeric"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.muted, fontSize: 10, marginBottom: 2, textAlign: 'right' }}>{isAr ? "مطاط" : "Rubber"}</Text>
            <TextInput
              style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 5, color: colors.foreground, textAlign: 'right', fontSize: 12 }}
              placeholder="0" placeholderTextColor={colors.muted}
              value={product.yarnRubber}
              onChangeText={(v) => updateProductField(machine, shiftIndex, productIndex, "yarnRubber", v)}
              keyboardType="numeric"
            />
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 6 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.muted, fontSize: 10, marginBottom: 2, textAlign: 'right' }}>{isAr ? "قطن" : "Cotton"}</Text>
            <TextInput
              style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 5, color: colors.foreground, textAlign: 'right', fontSize: 12 }}
              placeholder="0" placeholderTextColor={colors.muted}
              value={product.yarnCotton}
              onChangeText={(v) => updateProductField(machine, shiftIndex, productIndex, "yarnCotton", v)}
              keyboardType="numeric"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.muted, fontSize: 10, marginBottom: 2, textAlign: 'right' }}>{isAr ? "نايلون" : "Nylon"}</Text>
            <TextInput
              style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 5, color: colors.foreground, textAlign: 'right', fontSize: 12 }}
              placeholder="0" placeholderTextColor={colors.muted}
              value={product.yarnNylon}
              onChangeText={(v) => updateProductField(machine, shiftIndex, productIndex, "yarnNylon", v)}
              keyboardType="numeric"
            />
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.muted, fontSize: 10, marginBottom: 2, textAlign: 'right' }}>{isAr ? "اسبان" : "Span"}</Text>
            <TextInput
              style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 5, color: colors.foreground, textAlign: 'right', fontSize: 12 }}
              placeholder="0" placeholderTextColor={colors.muted}
              value={product.yarnSpan}
              onChangeText={(v) => updateProductField(machine, shiftIndex, productIndex, "yarnSpan", v)}
              keyboardType="numeric"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.muted, fontSize: 10, marginBottom: 2, textAlign: 'right' }}>{isAr ? "بامبو" : "Bamboo"}</Text>
            <TextInput
              style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 5, color: colors.foreground, textAlign: 'right', fontSize: 12 }}
              placeholder="0" placeholderTextColor={colors.muted}
              value={product.yarnBamboo}
              onChangeText={(v) => updateProductField(machine, shiftIndex, productIndex, "yarnBamboo", v)}
              keyboardType="numeric"
            />
          </View>
        </View>
      </View>
    </View>
  );

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

      {/* المنتجات */}
      {shift.products.map((product, pIdx) => renderProductForm(machine, shiftIndex, product, pIdx, shift.products.length))}

      {/* زر إضافة منتج */}
      <TouchableOpacity
        onPress={() => addProduct(machine, shiftIndex)}
        style={{ backgroundColor: "#0a7ea415", borderRadius: 8, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 4 }}
      >
        <Text style={{ color: "#0a7ea4", fontSize: 12, fontWeight: '600' }}>{isAr ? "إضافة منتج" : "Add Product"}</Text>
        <MaterialIcons name="add" size={16} color="#0a7ea4" />
      </TouchableOpacity>
    </View>
  );

  // فورم الإدخال الرئيسي
  const renderForm = () => (
    <View style={{ flex: 1 }}>
      {/* قائمة المكائن الثابتة في الأعلى */}
      <View style={{ backgroundColor: colors.surface, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderColor: colors.border }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row', gap: 6, paddingHorizontal: 4 }}>
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
                minWidth: 48,
                alignItems: "center",
              }}
            >
              <Text style={{ color: activeMachines.includes(machine) ? "white" : "#16a34a", fontWeight: "700", fontSize: 11 }}>
                {machine}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* المحتوى القابل للتمرير */}
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
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
            <AttachmentPicker
              attachments={productionAttachments}
              onAttachmentsChange={setProductionAttachments}
              language={language}
            />

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
    </View>
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
            machineShifts.shifts.forEach(shift => {
              shift.products.forEach(p => {
                sumYarnWeight += getProductTotalYarn(p);
                sumWasteThread += parseFloat(p.wasteThreadGrams) || 0;
                sumWasteSocks += parseFloat(p.wasteSocksGrams) || 0;
              });
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

          <TouchableOpacity
            onPress={() => router.push("/product-cost-calculator" as any)}
            style={{ marginHorizontal: 16, marginTop: 4, marginBottom: 4, backgroundColor: "#fef3c7", borderRadius: 16, padding: 16, borderWidth: 2, borderColor: "#f59e0b", flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
          >
            <MaterialIcons name="chevron-left" size={24} color="#f59e0b" />
            <View style={{ flex: 1, alignItems: "flex-end" }}>
              <Text style={{ fontSize: 16, fontWeight: "bold", color: "#f59e0b" }}>{isAr ? "حساب تكاليف منتج جديد" : "Calculate Product Cost"}</Text>
              <Text style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>{isAr ? "إضافة تفاصيل الخيوط والألوان" : "Add Thread and Color Details"}</Text>
            </View>
            <View style={{ backgroundColor: "#f59e0b", borderRadius: 12, padding: 10, marginLeft: 12 }}>
              <MaterialIcons name="calculate" size={28} color="white" />
            </View>
          </TouchableOpacity>
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
