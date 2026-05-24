import React, { useState, useEffect } from "react";
import { BackButton } from "@/components/back-button";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  FlatList,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface WorkerEntry {
  id: string;
  workerName: string;
  productionDozen: string;
  productionPairs: string;
  // حقول التخزين - الإنتاج التام
  finishedDozen?: string;
  finishedPairs?: string;
  // حقول التخزين - النخب الثاني
  secondGradeDozen?: string;
  secondGradePairs?: string;
  // حقول التخزين - جوارب مانع الانزلاق
  antislipDozen?: string;
  antislipPairs?: string;
  date: string;
  notes: string;
}

// بيانات العمال لكل مرحلة
const STAGE_CONFIG: Record<
  string,
  { name: string; color: string; icon: string; workers: string[]; fields: string[] }
> = {
  machines: {
    name: "إنتاج المكائن",
    color: "#0a7ea4",
    icon: "precision-manufacturing",
    workers: ["رنا", "محمد احمد", "أفضل", "عطالله", "شفيق", "الجميع"],
    fields: ["dozen", "pairs"],
  },
  rosso: {
    name: "الروسو",
    color: "#7c3aed",
    icon: "loop",
    workers: ["فريدو", "قيوم", "الجميع"],
    fields: ["dozen", "pairs"],
  },
  qalb: {
    name: "القلب",
    color: "#059669",
    icon: "flip",
    workers: ["حسين السوري"],
    fields: ["dozen", "pairs"],
  },
  kawiya: {
    name: "الكاوية",
    color: "#dc2626",
    icon: "local-fire-department",
    workers: ["جنيد"],
    fields: ["dozen", "pairs"],
  },
  inspection: {
    name: "الفحص",
    color: "#d97706",
    icon: "search",
    workers: ["عارف", "انام الدين", "الجميع"],
    fields: ["dozen", "pairs"],
  },
  packing: {
    name: "التغليف",
    color: "#2563eb",
    icon: "inventory-2",
    workers: ["محمد عمر", "غلام", "بشير", "الجميع"],
    fields: ["dozen", "pairs"],
  },
  antislip: {
    name: "مانع الانزلاق",
    color: "#0891b2",
    icon: "layers",
    workers: ["محمد عمر", "مرتضى", "أوجيل", "الجميع"],
    fields: ["dozen", "pairs"],
  },
  storage: {
    name: "التخزين",
    color: "#4f46e5",
    icon: "warehouse",
    workers: ["شميم"],
    fields: ["storage"],
  },
};

export default function ManufacturingStageScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const colors = useColors();
  const stage = (params.stage as string) || "machines";

  const config = STAGE_CONFIG[stage] || STAGE_CONFIG.machines;
  const STORAGE_KEY = `sultan_manufacturing_${stage}`;

  const [entries, setEntries] = useState<WorkerEntry[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<WorkerEntry | null>(null);
  const [selectedWorker, setSelectedWorker] = useState("");
  const [productionDozen, setProductionDozen] = useState("");
  const [productionPairs, setProductionPairs] = useState("");
  // حقول التخزين
  const [finishedDozen, setFinishedDozen] = useState("");
  const [finishedPairs, setFinishedPairs] = useState("");
  const [secondGradeDozen, setSecondGradeDozen] = useState("");
  const [secondGradePairs, setSecondGradePairs] = useState("");
  const [antislipDozen, setAntislipDozen] = useState("");
  const [antislipPairs, setAntislipPairs] = useState("");
  const [notes, setNotes] = useState("");

  const isStorageStage = stage === "storage";

  useEffect(() => {
    loadEntries();
  }, [stage]);

  const loadEntries = async () => {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      if (data) setEntries(JSON.parse(data));
      else setEntries([]);
    } catch (e) {
      console.log("Error loading entries:", e);
    }
  };

  const saveEntries = async (newEntries: WorkerEntry[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newEntries));
      setEntries(newEntries);
    } catch (e) {
      console.log("Error saving entries:", e);
    }
  };

  const resetForm = () => {
    setSelectedWorker("");
    setProductionDozen("");
    setProductionPairs("");
    setFinishedDozen("");
    setFinishedPairs("");
    setSecondGradeDozen("");
    setSecondGradePairs("");
    setAntislipDozen("");
    setAntislipPairs("");
    setNotes("");
    setEditingEntry(null);
  };

  // حفظ البيانات
  const handleSave = async () => {
    if (!selectedWorker) {
      Alert.alert("تنبيه", "يرجى اختيار اسم العامل");
      return;
    }
    if (isStorageStage) {
      if (!finishedDozen && !finishedPairs && !secondGradeDozen && !secondGradePairs && !antislipDozen && !antislipPairs) {
        Alert.alert("تنبيه", "يرجى إدخال كمية واحدة على الأقل");
        return;
      }
    } else {
      if (!productionDozen && !productionPairs) {
        Alert.alert("تنبيه", "يرجى إدخال كمية الإنتاج (درزن أو زوج)");
        return;
      }
    }

    const entry: WorkerEntry = {
      id: editingEntry?.id || Date.now().toString(),
      workerName: selectedWorker,
      productionDozen: isStorageStage ? "0" : (productionDozen || "0"),
      productionPairs: isStorageStage ? "0" : (productionPairs || "0"),
      finishedDozen: isStorageStage ? (finishedDozen || "0") : undefined,
      finishedPairs: isStorageStage ? (finishedPairs || "0") : undefined,
      secondGradeDozen: isStorageStage ? (secondGradeDozen || "0") : undefined,
      secondGradePairs: isStorageStage ? (secondGradePairs || "0") : undefined,
      antislipDozen: isStorageStage ? (antislipDozen || "0") : undefined,
      antislipPairs: isStorageStage ? (antislipPairs || "0") : undefined,
      date: new Date().toLocaleDateString("ar-SA"),
      notes: notes,
    };

    let newEntries: WorkerEntry[];
    if (editingEntry) {
      newEntries = entries.map((e) => (e.id === editingEntry.id ? entry : e));
    } else {
      newEntries = [entry, ...entries];
    }

    await saveEntries(newEntries);
    resetForm();
    setShowForm(false);
    Alert.alert(
      "تم بنجاح ✓",
      editingEntry ? "تم تعديل البيانات بنجاح" : "تم حفظ البيانات بنجاح"
    );
  };

  // تعديل سجل
  const handleEdit = (entry: WorkerEntry) => {
    setSelectedWorker(entry.workerName);
    setProductionDozen(entry.productionDozen);
    setProductionPairs(entry.productionPairs);
    setFinishedDozen(entry.finishedDozen || "");
    setFinishedPairs(entry.finishedPairs || "");
    setSecondGradeDozen(entry.secondGradeDozen || "");
    setSecondGradePairs(entry.secondGradePairs || "");
    setAntislipDozen(entry.antislipDozen || "");
    setAntislipPairs(entry.antislipPairs || "");
    setNotes(entry.notes || "");
    setEditingEntry(entry);
    setShowForm(true);
  };

  // حذف سجل
  const handleDelete = (entry: WorkerEntry) => {
    Alert.alert(
      "تأكيد الحذف",
      `هل أنت متأكد من حذف سجل "${entry.workerName}"؟`,
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "حذف",
          style: "destructive",
          onPress: async () => {
            const newEntries = entries.filter((e) => e.id !== entry.id);
            await saveEntries(newEntries);
            Alert.alert("تم ✓", "تم حذف السجل بنجاح");
          },
        },
      ]
    );
  };

  // عرض سجل واحد
  const renderEntry = ({ item }: { item: WorkerEntry }) => (
    <View className="bg-surface rounded-xl p-4 mb-3 border border-border">
      {/* اسم العامل والأزرار */}
      <View className="flex-row items-center justify-between mb-3">
        {/* أيقونات التعديل والحذف */}
        <View className="flex-row gap-2">
          <TouchableOpacity
            onPress={() => handleEdit(item)}
            style={{
              backgroundColor: `${config.color}15`,
              borderRadius: 20,
              padding: 8,
            }}
          >
            <MaterialIcons name="edit" size={18} color={config.color} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleDelete(item)}
            style={{
              backgroundColor: "#ef444415",
              borderRadius: 20,
              padding: 8,
            }}
          >
            <MaterialIcons name="delete" size={18} color="#ef4444" />
          </TouchableOpacity>
        </View>

        {/* اسم العامل */}
        <View className="flex-row items-center gap-2">
          <Text className="text-foreground font-bold text-base">{item.workerName}</Text>
          <View
            style={{
              backgroundColor: `${config.color}20`,
              borderRadius: 16,
              padding: 6,
            }}
          >
            <MaterialIcons name="person" size={18} color={config.color} />
          </View>
        </View>
      </View>

      {/* بيانات الإنتاج */}
      {isStorageStage ? (
        <View className="bg-background rounded-lg p-3">
          {/* الإنتاج التام */}
          <Text className="text-foreground font-semibold text-sm text-right mb-2">الإنتاج التام:</Text>
          <View className="flex-row justify-between items-center mb-1">
            <View className="flex-row items-center gap-1">
              <Text className="text-foreground font-bold text-base">{item.finishedDozen || "0"}</Text>
              <Text className="text-muted text-sm">درزن</Text>
            </View>
            <View className="flex-row items-center gap-1">
              <Text className="text-foreground font-bold text-base">{item.finishedPairs || "0"}</Text>
              <Text className="text-muted text-sm">زوج</Text>
            </View>
          </View>
          {/* النخب الثاني */}
          <View className="border-t border-border mt-2 pt-2">
            <Text className="text-foreground font-semibold text-sm text-right mb-2">النخب الثاني:</Text>
            <View className="flex-row justify-between items-center">
              <View className="flex-row items-center gap-1">
                <Text className="text-foreground font-bold text-base">{item.secondGradeDozen || "0"}</Text>
                <Text className="text-muted text-sm">درزن</Text>
              </View>
              <View className="flex-row items-center gap-1">
                <Text className="text-foreground font-bold text-base">{item.secondGradePairs || "0"}</Text>
                <Text className="text-muted text-sm">زوج</Text>
              </View>
            </View>
          </View>
          {/* جوارب مانع الانزلاق */}
          <View className="border-t border-border mt-2 pt-2">
            <Text className="text-foreground font-semibold text-sm text-right mb-2">جوارب مانع الانزلاق:</Text>
            <View className="flex-row justify-between items-center">
              <View className="flex-row items-center gap-1">
                <Text className="text-foreground font-bold text-base">{item.antislipDozen || "0"}</Text>
                <Text className="text-muted text-sm">درزن</Text>
              </View>
              <View className="flex-row items-center gap-1">
                <Text className="text-foreground font-bold text-base">{item.antislipPairs || "0"}</Text>
                <Text className="text-muted text-sm">زوج</Text>
              </View>
            </View>
          </View>
        </View>
      ) : (
        <View className="bg-background rounded-lg p-3">
          <View className="flex-row justify-between items-center mb-2">
            <View className="flex-row items-center gap-1">
              <Text className="text-foreground font-bold text-base">{item.productionDozen}</Text>
              <Text className="text-muted text-sm">درزن</Text>
            </View>
            <Text className="text-muted text-sm font-semibold">كمية الإنتاج بالدرزن</Text>
          </View>
          <View className="flex-row justify-between items-center">
            <View className="flex-row items-center gap-1">
              <Text className="text-foreground font-bold text-base">{item.productionPairs}</Text>
              <Text className="text-muted text-sm">زوج</Text>
            </View>
            <Text className="text-muted text-sm font-semibold">كمية الإنتاج بالزوج</Text>
          </View>
        </View>
      )}

      {/* ملاحظات */}
      {item.notes ? (
        <View className="mt-2 bg-background rounded-lg p-2">
          <Text className="text-muted text-xs text-right">{item.notes}</Text>
        </View>
      ) : null}

      {/* التاريخ */}
      <Text className="text-muted text-xs mt-2 text-right">{item.date}</Text>
    </View>
  );

  return (
    <ScreenContainer className="bg-background">
      {/* رأس الصفحة */}
      <View
        style={{ backgroundColor: config.color }}
        className="px-6 py-5 flex-row items-center justify-between"
      >
        {/* زر الإضافة */}
        <TouchableOpacity
          onPress={() => {
            resetForm();
            setShowForm(true);
          }}
          style={{
            backgroundColor: "rgba(255,255,255,0.2)",
            borderRadius: 20,
            padding: 8,
          }}
        >
          <MaterialIcons name="add" size={24} color="white" />
        </TouchableOpacity>

        {/* عنوان الصفحة */}
        <View className="flex-1 items-center">
          <Text className="text-white font-bold text-xl">{config.name}</Text>
          <Text className="text-white/80 text-sm mt-1">
            {entries.length > 0 ? `${entries.length} سجل` : "لا توجد سجلات"}
          </Text>
        </View>

        {/* زر الرجوع */}
        <BackButton />
      </View>

      {/* نموذج الإدخال */}
      {showForm ? (
        <ScrollView className="flex-1 px-4 py-4">
          <View className="bg-surface rounded-xl p-5 border border-border">
            <Text className="text-foreground font-bold text-lg mb-5 text-right">
              {editingEntry ? "✏️ تعديل بيانات العامل" : "➕ إدخال بيانات جديدة"}
            </Text>

            {/* اختيار اسم العامل */}
            <View className="mb-5">
              <Text className="text-foreground font-semibold text-sm mb-3 text-right">
                اسم العامل
              </Text>
              <View className="flex-row flex-wrap gap-2 justify-end">
                {config.workers.map((worker) => (
                  <TouchableOpacity
                    key={worker}
                    onPress={() => setSelectedWorker(worker)}
                    style={{
                      backgroundColor:
                        selectedWorker === worker ? config.color : "transparent",
                      borderColor: config.color,
                      borderWidth: 1.5,
                      borderRadius: 22,
                      paddingHorizontal: 18,
                      paddingVertical: 10,
                    }}
                  >
                    <Text
                      style={{
                        color: selectedWorker === worker ? "white" : config.color,
                        fontWeight: "700",
                        fontSize: 14,
                      }}
                    >
                      {worker}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {selectedWorker ? (
                <View className="mt-3 flex-row items-center justify-end gap-2">
                  <Text style={{ color: config.color }} className="font-bold text-sm">
                    {selectedWorker}
                  </Text>
                  <MaterialIcons name="check-circle" size={16} color={config.color} />
                </View>
              ) : null}
            </View>

            {/* حقول الإدخال حسب المرحلة */}
            {isStorageStage ? (
              <View>
                {/* الإنتاج التام */}
                <View className="mb-4 bg-background rounded-lg p-3 border border-border">
                  <Text className="text-foreground font-bold text-sm mb-3 text-right">
                    الإنتاج التام
                  </Text>
                  <View className="mb-3">
                    <Text className="text-muted text-xs mb-1 text-right">الكمية بالدرزن</Text>
                    <TextInput
                      className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground text-right text-base"
                      placeholder="0"
                      placeholderTextColor={colors.muted}
                      value={finishedDozen}
                      onChangeText={setFinishedDozen}
                      keyboardType="numeric"
                      returnKeyType="next"
                    />
                  </View>
                  <View>
                    <Text className="text-muted text-xs mb-1 text-right">الكمية بالزوج</Text>
                    <TextInput
                      className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground text-right text-base"
                      placeholder="0"
                      placeholderTextColor={colors.muted}
                      value={finishedPairs}
                      onChangeText={setFinishedPairs}
                      keyboardType="numeric"
                      returnKeyType="next"
                    />
                  </View>
                </View>

                {/* النخب الثاني */}
                <View className="mb-4 bg-background rounded-lg p-3 border border-border">
                  <Text className="text-foreground font-bold text-sm mb-3 text-right">
                    النخب الثاني
                  </Text>
                  <View className="mb-3">
                    <Text className="text-muted text-xs mb-1 text-right">الكمية بالدرزن</Text>
                    <TextInput
                      className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground text-right text-base"
                      placeholder="0"
                      placeholderTextColor={colors.muted}
                      value={secondGradeDozen}
                      onChangeText={setSecondGradeDozen}
                      keyboardType="numeric"
                      returnKeyType="next"
                    />
                  </View>
                  <View>
                    <Text className="text-muted text-xs mb-1 text-right">الكمية بالزوج</Text>
                    <TextInput
                      className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground text-right text-base"
                      placeholder="0"
                      placeholderTextColor={colors.muted}
                      value={secondGradePairs}
                      onChangeText={setSecondGradePairs}
                      keyboardType="numeric"
                      returnKeyType="next"
                    />
                  </View>
                </View>

                {/* جوارب مانع الانزلاق */}
                <View className="mb-4 bg-background rounded-lg p-3 border border-border">
                  <Text className="text-foreground font-bold text-sm mb-3 text-right">
                    جوارب مانع الانزلاق
                  </Text>
                  <View className="mb-3">
                    <Text className="text-muted text-xs mb-1 text-right">الكمية بالدرزن</Text>
                    <TextInput
                      className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground text-right text-base"
                      placeholder="0"
                      placeholderTextColor={colors.muted}
                      value={antislipDozen}
                      onChangeText={setAntislipDozen}
                      keyboardType="numeric"
                      returnKeyType="next"
                    />
                  </View>
                  <View>
                    <Text className="text-muted text-xs mb-1 text-right">الكمية بالزوج</Text>
                    <TextInput
                      className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground text-right text-base"
                      placeholder="0"
                      placeholderTextColor={colors.muted}
                      value={antislipPairs}
                      onChangeText={setAntislipPairs}
                      keyboardType="numeric"
                      returnKeyType="next"
                    />
                  </View>
                </View>
              </View>
            ) : (
              <View>
                {/* كمية الإنتاج بالدرزن */}
                <View className="mb-4">
                  <Text className="text-foreground font-semibold text-sm mb-2 text-right">
                    كمية الإنتاج (درزن)
                  </Text>
                  <TextInput
                    className="bg-background border border-border rounded-lg px-4 py-3 text-foreground text-right text-base"
                    placeholder="أدخل الكمية بالدرزن"
                    placeholderTextColor={colors.muted}
                    value={productionDozen}
                    onChangeText={setProductionDozen}
                    keyboardType="numeric"
                    returnKeyType="next"
                  />
                </View>

                {/* كمية الإنتاج بالزوج */}
                <View className="mb-4">
                  <Text className="text-foreground font-semibold text-sm mb-2 text-right">
                    كمية الإنتاج (زوج)
                  </Text>
                  <TextInput
                    className="bg-background border border-border rounded-lg px-4 py-3 text-foreground text-right text-base"
                    placeholder="أدخل الكمية بالزوج"
                    placeholderTextColor={colors.muted}
                    value={productionPairs}
                    onChangeText={setProductionPairs}
                    keyboardType="numeric"
                    returnKeyType="next"
                  />
                </View>
              </View>
            )}

            {/* ملاحظات */}
            <View className="mb-5">
              <Text className="text-foreground font-semibold text-sm mb-2 text-right">
                ملاحظات (اختياري)
              </Text>
              <TextInput
                className="bg-background border border-border rounded-lg px-4 py-3 text-foreground text-right text-base"
                placeholder="أدخل ملاحظات إضافية"
                placeholderTextColor={colors.muted}
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
                returnKeyType="done"
                style={{ minHeight: 70, textAlignVertical: "top" }}
              />
            </View>

            {/* أزرار الإجراءات */}
            <View className="flex-row gap-3 mt-2">
              {/* زر إلغاء */}
              <TouchableOpacity
                onPress={() => {
                  setShowForm(false);
                  resetForm();
                }}
                className="flex-1 bg-background border border-border rounded-xl py-4 items-center"
                style={{ flexDirection: "row", justifyContent: "center", gap: 6 }}
              >
                <Text className="text-foreground font-semibold text-base">إلغاء</Text>
                <MaterialIcons name="close" size={20} color={colors.foreground} />
              </TouchableOpacity>

              {/* زر حفظ */}
              <TouchableOpacity
                onPress={handleSave}
                style={{ backgroundColor: config.color, flexDirection: "row", justifyContent: "center", gap: 6 }}
                className="flex-1 rounded-xl py-4 items-center"
              >
                <Text className="text-white font-semibold text-base">
                  {editingEntry ? "تعديل" : "حفظ"}
                </Text>
                <MaterialIcons
                  name={editingEntry ? "edit" : "save"}
                  size={20}
                  color="white"
                />
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      ) : (
        /* قائمة السجلات */
        <FlatList
          data={entries}
          keyExtractor={(item) => item.id}
          renderItem={renderEntry}
          contentContainerStyle={{ padding: 16, flexGrow: 1 }}
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center py-20">
              <View
                style={{ backgroundColor: `${config.color}15`, borderRadius: 40, padding: 20 }}
              >
                <MaterialIcons name={config.icon as any} size={48} color={config.color} />
              </View>
              <Text className="text-foreground text-lg mt-5 font-bold">{config.name}</Text>
              <Text className="text-muted text-sm mt-2 text-center px-8">
                لا توجد بيانات مسجلة بعد.{"\n"}اضغط على زر (+) في الأعلى لإضافة بيانات إنتاج جديدة.
              </Text>

              {/* عرض أسماء العمال */}
              <View className="mt-5 bg-surface rounded-xl p-4 border border-border w-full">
                <Text className="text-foreground font-semibold text-sm mb-3 text-right">
                  العمال في هذه المرحلة:
                </Text>
                <View className="flex-row flex-wrap gap-2 justify-end">
                  {config.workers.map((worker) => (
                    <View
                      key={worker}
                      style={{
                        backgroundColor: `${config.color}15`,
                        borderRadius: 16,
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                      }}
                    >
                      <Text style={{ color: config.color, fontWeight: "600", fontSize: 13 }}>
                        {worker}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>

              <TouchableOpacity
                onPress={() => {
                  resetForm();
                  setShowForm(true);
                }}
                style={{ backgroundColor: config.color }}
                className="mt-6 px-8 py-3 rounded-xl"
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text className="text-white font-semibold">إضافة بيانات</Text>
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
