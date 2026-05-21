import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  FlatList,
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

interface ProductionEntry {
  id: string;
  machineNumber: string;
  productionDozen: string;
  productionPairs: string;
  wasteThreadGrams: string;
  wasteSocksGrams: string;
  secondGradePairs: string;
  secondGradeGrams: string;
  wasteNeedles: string;
  date: string;
}

const STORAGE_KEY = "sultan_production_data";

export default function ProductionScreen() {
  const router = useRouter();
  const colors = useColors();
  const [entries, setEntries] = useState<ProductionEntry[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ProductionEntry | null>(null);

  // حقول النموذج
  const [selectedMachine, setSelectedMachine] = useState("");
  const [productionDozen, setProductionDozen] = useState("");
  const [productionPairs, setProductionPairs] = useState("");
  const [wasteThread, setWasteThread] = useState("");
  const [wasteSocks, setWasteSocks] = useState("");
  const [secondGradePairs, setSecondGradePairs] = useState("");
  const [secondGradeGrams, setSecondGradeGrams] = useState("");
  const [wasteNeedles, setWasteNeedles] = useState("");

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
    setSelectedMachine("");
    setProductionDozen("");
    setProductionPairs("");
    setWasteThread("");
    setWasteSocks("");
    setSecondGradePairs("");
    setSecondGradeGrams("");
    setWasteNeedles("");
    setEditingEntry(null);
  };

  const handleSave = async () => {
    if (!selectedMachine) {
      Alert.alert("تنبيه", "يرجى اختيار رقم المكينة");
      return;
    }
    if (!productionDozen && !productionPairs) {
      Alert.alert("تنبيه", "يرجى إدخال كمية الإنتاج");
      return;
    }

    const entry: ProductionEntry = {
      id: editingEntry?.id || Date.now().toString(),
      machineNumber: selectedMachine,
      productionDozen: productionDozen || "0",
      productionPairs: productionPairs || "0",
      wasteThreadGrams: wasteThread || "0",
      wasteSocksGrams: wasteSocks || "0",
      secondGradePairs: secondGradePairs || "0",
      secondGradeGrams: secondGradeGrams || "0",
      wasteNeedles: wasteNeedles || "0",
      date: new Date().toLocaleDateString("ar-SA"),
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
    setSelectedMachine(entry.machineNumber);
    setProductionDozen(entry.productionDozen);
    setProductionPairs(entry.productionPairs);
    setWasteThread(entry.wasteThreadGrams);
    setWasteSocks(entry.wasteSocksGrams);
    setSecondGradePairs(entry.secondGradePairs);
    setSecondGradeGrams(entry.secondGradeGrams);
    setWasteNeedles(entry.wasteNeedles || "0");
    setEditingEntry(entry);
    setShowForm(true);
  };

  const handleDelete = (entry: ProductionEntry) => {
    Alert.alert("تأكيد الحذف", `هل تريد حذف بيانات المكينة "${entry.machineNumber}"؟`, [
      { text: "إلغاء", style: "cancel" },
      {
        text: "حذف",
        style: "destructive",
        onPress: async () => {
          const newEntries = entries.filter((e) => e.id !== entry.id);
          await saveEntries(newEntries);
          Alert.alert("تم ✓", "تم حذف السجل");
        },
      },
    ]);
  };

  // حساب المجاميع
  const getTotals = () => {
    let totalDozen = 0;
    let totalPairs = 0;
    let totalWasteThread = 0;
    let totalWasteSocks = 0;
    let totalSecondPairs = 0;
    let totalSecondGrams = 0;
    let totalNeedles = 0;

    entries.forEach((e) => {
      totalDozen += parseFloat(e.productionDozen) || 0;
      totalPairs += parseFloat(e.productionPairs) || 0;
      totalWasteThread += parseFloat(e.wasteThreadGrams) || 0;
      totalWasteSocks += parseFloat(e.wasteSocksGrams) || 0;
      totalSecondPairs += parseFloat(e.secondGradePairs) || 0;
      totalSecondGrams += parseFloat(e.secondGradeGrams) || 0;
      totalNeedles += parseFloat(e.wasteNeedles || "0") || 0;
    });

    return { totalDozen, totalPairs, totalWasteThread, totalWasteSocks, totalSecondPairs, totalSecondGrams, totalNeedles };
  };

  // عرض سجل إنتاج
  const renderEntry = ({ item }: { item: ProductionEntry }) => (
    <View className="bg-surface rounded-xl p-4 mb-3 border border-border">
      {/* رأس السجل */}
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row gap-2">
          <TouchableOpacity
            onPress={() => handleEdit(item)}
            style={{ backgroundColor: "#0a7ea415", borderRadius: 20, padding: 8 }}
          >
            <MaterialIcons name="edit" size={18} color="#0a7ea4" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleDelete(item)}
            style={{ backgroundColor: "#ef444415", borderRadius: 20, padding: 8 }}
          >
            <MaterialIcons name="delete" size={18} color="#ef4444" />
          </TouchableOpacity>
        </View>
        <View className="flex-row items-center gap-2">
          <Text className="text-foreground font-bold text-lg">{item.machineNumber}</Text>
          <View style={{ backgroundColor: "#16a34a20", borderRadius: 16, padding: 6 }}>
            <MaterialIcons name="precision-manufacturing" size={20} color="#16a34a" />
          </View>
        </View>
      </View>

      {/* بيانات الإنتاج */}
      <View className="bg-background rounded-lg p-3">
        <View className="flex-row justify-between items-center mb-2 pb-2 border-b border-border">
          <View className="flex-row items-center gap-2">
            <Text className="text-foreground font-bold">{item.productionDozen}</Text>
            <Text className="text-muted text-xs">درزن</Text>
            <Text className="text-muted mx-1">|</Text>
            <Text className="text-foreground font-bold">{item.productionPairs}</Text>
            <Text className="text-muted text-xs">زوج</Text>
          </View>
          <Text className="text-muted text-sm font-semibold">الإنتاج</Text>
        </View>

        <View className="flex-row justify-between items-center mb-2 pb-2 border-b border-border">
          <View className="flex-row items-center gap-1">
            <Text className="text-error font-bold">{item.wasteThreadGrams}</Text>
            <Text className="text-muted text-xs">جرام</Text>
          </View>
          <Text className="text-muted text-sm font-semibold">هدر خيوط</Text>
        </View>

        <View className="flex-row justify-between items-center mb-2 pb-2 border-b border-border">
          <View className="flex-row items-center gap-1">
            <Text className="text-error font-bold">{item.wasteSocksGrams}</Text>
            <Text className="text-muted text-xs">جرام</Text>
          </View>
          <Text className="text-muted text-sm font-semibold">هدر جوارب تالفة</Text>
        </View>

        <View className="flex-row justify-between items-center mb-2 pb-2 border-b border-border">
          <View className="flex-row items-center gap-2">
            <Text className="text-warning font-bold">{item.secondGradePairs}</Text>
            <Text className="text-muted text-xs">زوج</Text>
            <Text className="text-muted mx-1">|</Text>
            <Text className="text-warning font-bold">{item.secondGradeGrams}</Text>
            <Text className="text-muted text-xs">جرام</Text>
          </View>
          <Text className="text-muted text-sm font-semibold">النخب الثاني</Text>
        </View>

        <View className="flex-row justify-between items-center">
          <View className="flex-row items-center gap-1">
            <Text className="text-foreground font-bold">{item.wasteNeedles || "0"}</Text>
            <Text className="text-muted text-xs">حبة</Text>
          </View>
          <Text className="text-muted text-sm font-semibold">هدر الإبر</Text>
        </View>
      </View>

      <Text className="text-muted text-xs mt-2 text-right">{item.date}</Text>
    </View>
  );

  // ملخص المجاميع
  const renderTotals = () => {
    const totals = getTotals();
    if (entries.length === 0) return null;

    return (
      <View className="bg-surface rounded-xl p-4 mb-4 border border-border">
        <View className="flex-row items-center gap-2 mb-3 justify-end">
          <Text className="text-foreground font-bold text-base">ملخص المجاميع</Text>
          <MaterialIcons name="summarize" size={20} color="#16a34a" />
        </View>
        <View className="bg-background rounded-lg p-3">
          <View className="flex-row justify-between items-center mb-2 pb-2 border-b border-border">
            <Text className="text-foreground font-bold">
              {totals.totalDozen} درزن | {totals.totalPairs} زوج
            </Text>
            <Text className="text-muted text-sm">إجمالي الإنتاج</Text>
          </View>
          <View className="flex-row justify-between items-center mb-2 pb-2 border-b border-border">
            <Text className="text-error font-bold">{totals.totalWasteThread} جرام</Text>
            <Text className="text-muted text-sm">إجمالي هدر الخيوط</Text>
          </View>
          <View className="flex-row justify-between items-center mb-2 pb-2 border-b border-border">
            <Text className="text-error font-bold">{totals.totalWasteSocks} جرام</Text>
            <Text className="text-muted text-sm">إجمالي هدر الجوارب</Text>
          </View>
          <View className="flex-row justify-between items-center mb-2 pb-2 border-b border-border">
            <Text className="text-warning font-bold">
              {totals.totalSecondPairs} زوج | {totals.totalSecondGrams} جرام
            </Text>
            <Text className="text-muted text-sm">إجمالي النخب الثاني</Text>
          </View>
          <View className="flex-row justify-between items-center">
            <Text className="text-foreground font-bold">{totals.totalNeedles} حبة</Text>
            <Text className="text-muted text-sm">إجمالي هدر الإبر</Text>
          </View>
        </View>
      </View>
    );
  };

  // نموذج الإدخال
  const renderForm = () => (
    <ScrollView className="flex-1 px-4 py-4">
      <View className="bg-surface rounded-xl p-5 border border-border">
        <Text className="text-foreground font-bold text-lg mb-5 text-right">
          {editingEntry ? "✏️ تعديل بيانات الإنتاج" : "➕ إضافة بيانات إنتاج"}
        </Text>

        {/* رقم المكينة */}
        <View className="mb-5">
          <Text className="text-foreground font-semibold text-sm mb-3 text-right">رقم المكينة</Text>
          <View className="flex-row flex-wrap gap-2 justify-end">
            {MACHINES.map((machine) => (
              <TouchableOpacity
                key={machine}
                onPress={() => setSelectedMachine(machine)}
                style={{
                  backgroundColor: selectedMachine === machine ? "#16a34a" : "transparent",
                  borderColor: "#16a34a",
                  borderWidth: 1.5,
                  borderRadius: 22,
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  minWidth: 56,
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    color: selectedMachine === machine ? "white" : "#16a34a",
                    fontWeight: "700",
                    fontSize: 12,
                  }}
                >
                  {machine}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* كمية الإنتاج بالدرزن */}
        <View className="mb-4">
          <Text className="text-foreground font-semibold text-sm mb-2 text-right">كمية الإنتاج (درزن)</Text>
          <TextInput
            className="bg-background border border-border rounded-lg px-4 py-3 text-foreground text-right text-base"
            placeholder="0"
            placeholderTextColor={colors.muted}
            value={productionDozen}
            onChangeText={setProductionDozen}
            keyboardType="numeric"
            returnKeyType="next"
          />
        </View>

        {/* كمية الإنتاج بالزوج */}
        <View className="mb-4">
          <Text className="text-foreground font-semibold text-sm mb-2 text-right">كمية الإنتاج (زوج)</Text>
          <TextInput
            className="bg-background border border-border rounded-lg px-4 py-3 text-foreground text-right text-base"
            placeholder="0"
            placeholderTextColor={colors.muted}
            value={productionPairs}
            onChangeText={setProductionPairs}
            keyboardType="numeric"
            returnKeyType="next"
          />
        </View>

        {/* هدر الخيوط */}
        <View className="mb-4">
          <Text className="text-foreground font-semibold text-sm mb-2 text-right">هدر الخيوط (جرام)</Text>
          <TextInput
            className="bg-background border border-border rounded-lg px-4 py-3 text-foreground text-right text-base"
            placeholder="0"
            placeholderTextColor={colors.muted}
            value={wasteThread}
            onChangeText={setWasteThread}
            keyboardType="numeric"
            returnKeyType="next"
          />
        </View>

        {/* هدر جوارب تالفة */}
        <View className="mb-4">
          <Text className="text-foreground font-semibold text-sm mb-2 text-right">هدر جوارب تالفة (جرام)</Text>
          <TextInput
            className="bg-background border border-border rounded-lg px-4 py-3 text-foreground text-right text-base"
            placeholder="0"
            placeholderTextColor={colors.muted}
            value={wasteSocks}
            onChangeText={setWasteSocks}
            keyboardType="numeric"
            returnKeyType="next"
          />
        </View>

        {/* النخب الثاني بالزوج */}
        <View className="mb-4">
          <Text className="text-foreground font-semibold text-sm mb-2 text-right">النخب الثاني (زوج)</Text>
          <TextInput
            className="bg-background border border-border rounded-lg px-4 py-3 text-foreground text-right text-base"
            placeholder="0"
            placeholderTextColor={colors.muted}
            value={secondGradePairs}
            onChangeText={setSecondGradePairs}
            keyboardType="numeric"
            returnKeyType="next"
          />
        </View>

        {/* النخب الثاني بالجرام */}
        <View className="mb-4">
          <Text className="text-foreground font-semibold text-sm mb-2 text-right">النخب الثاني (جرام)</Text>
          <TextInput
            className="bg-background border border-border rounded-lg px-4 py-3 text-foreground text-right text-base"
            placeholder="0"
            placeholderTextColor={colors.muted}
            value={secondGradeGrams}
            onChangeText={setSecondGradeGrams}
            keyboardType="numeric"
            returnKeyType="next"
          />
        </View>

        {/* هدر الإبر */}
        <View className="mb-5">
          <Text className="text-foreground font-semibold text-sm mb-2 text-right">هدر الإبر (حبة)</Text>
          <TextInput
            className="bg-background border border-border rounded-lg px-4 py-3 text-foreground text-right text-base"
            placeholder="0"
            placeholderTextColor={colors.muted}
            value={wasteNeedles}
            onChangeText={setWasteNeedles}
            keyboardType="numeric"
            returnKeyType="done"
          />
        </View>

        {/* أزرار */}
        <View className="flex-row gap-3 mt-2">
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
            <Text className="text-foreground font-semibold text-base">إلغاء</Text>
            <MaterialIcons name="close" size={20} color={colors.foreground} />
          </TouchableOpacity>

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
            <Text className="text-white font-semibold text-base">
              {editingEntry ? "تعديل" : "حفظ"}
            </Text>
            <MaterialIcons name={editingEntry ? "edit" : "save"} size={20} color="white" />
          </TouchableOpacity>
        </View>
      </View>
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

        {/* العنوان */}
        <View className="flex-1 items-center">
          <Text className="text-white font-bold text-xl">الإنتاج</Text>
          <Text className="text-white/80 text-sm mt-1">{entries.length} سجل</Text>
        </View>

        {/* زر الرجوع */}
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialIcons name="arrow-forward" size={24} color="white" />
        </TouchableOpacity>
      </View>

      {/* المحتوى */}
      {showForm ? (
        renderForm()
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => item.id}
          renderItem={renderEntry}
          contentContainerStyle={{ padding: 16, flexGrow: 1 }}
          ListHeaderComponent={renderTotals()}
          ListEmptyComponent={
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
          }
        />
      )}
    </ScreenContainer>
  );
}
