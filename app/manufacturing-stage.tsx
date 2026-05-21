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
  date: string;
}

// أسماء العمال لكل مرحلة حسب المتطلبات
const WORKERS_BY_STAGE: Record<string, string[]> = {
  machines: ["رنا", "شفيق", "محمد احمد", "عطالله", "الجميع"],
  rosso: ["فريدو", "قيوم", "الجميع"],
  qalb: ["حسين السوري"],
  kawiya: ["جنيد"],
  inspection: ["عارف", "انام الدين"],
  packing: ["الجميع"],
  storage: ["الجميع"],
};

const STAGE_NAMES: Record<string, string> = {
  machines: "إنتاج المكائن",
  rosso: "الروسو",
  qalb: "القلب",
  kawiya: "الكاوية",
  inspection: "الفحص",
  packing: "التغليف",
  storage: "التخزين",
};

const STAGE_COLORS: Record<string, string> = {
  machines: "#0a7ea4",
  rosso: "#7c3aed",
  qalb: "#059669",
  kawiya: "#dc2626",
  inspection: "#d97706",
  packing: "#2563eb",
  storage: "#4f46e5",
};

export default function ManufacturingStageScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const colors = useColors();
  const stage = (params.stage as string) || "machines";

  const [entries, setEntries] = useState<WorkerEntry[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<WorkerEntry | null>(null);
  const [selectedWorker, setSelectedWorker] = useState("");
  const [productionDozen, setProductionDozen] = useState("");
  const [productionPairs, setProductionPairs] = useState("");

  const workers = WORKERS_BY_STAGE[stage] || [];
  const stageName = STAGE_NAMES[stage] || stage;
  const stageColor = STAGE_COLORS[stage] || colors.primary;
  const STORAGE_KEY = `sultan_manufacturing_${stage}`;

  useEffect(() => {
    loadEntries();
  }, [stage]);

  const loadEntries = async () => {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      if (data) setEntries(JSON.parse(data));
      else setEntries([]);
    } catch (e) { console.log(e); }
  };

  const saveEntries = async (newEntries: WorkerEntry[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newEntries));
      setEntries(newEntries);
    } catch (e) { console.log(e); }
  };

  const resetForm = () => {
    setSelectedWorker("");
    setProductionDozen("");
    setProductionPairs("");
    setEditingEntry(null);
  };

  const handleSave = async () => {
    if (!selectedWorker) {
      Alert.alert("خطأ", "يرجى اختيار اسم العامل");
      return;
    }

    const entry: WorkerEntry = {
      id: editingEntry?.id || Date.now().toString(),
      workerName: selectedWorker,
      productionDozen: productionDozen || "0",
      productionPairs: productionPairs || "0",
      date: new Date().toLocaleDateString("ar-SA"),
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
    Alert.alert("نجاح", editingEntry ? "تم تعديل البيانات بنجاح" : "تم حفظ البيانات بنجاح");
  };

  const handleEdit = (entry: WorkerEntry) => {
    setSelectedWorker(entry.workerName);
    setProductionDozen(entry.productionDozen);
    setProductionPairs(entry.productionPairs);
    setEditingEntry(entry);
    setShowForm(true);
  };

  const handleDelete = (entry: WorkerEntry) => {
    Alert.alert("تأكيد الحذف", "هل أنت متأكد من حذف هذا السجل؟", [
      { text: "إلغاء" },
      {
        text: "حذف",
        style: "destructive",
        onPress: async () => {
          const newEntries = entries.filter((e) => e.id !== entry.id);
          await saveEntries(newEntries);
          Alert.alert("نجاح", "تم حذف السجل بنجاح");
        },
      },
    ]);
  };

  const renderEntry = ({ item }: { item: WorkerEntry }) => (
    <View className="bg-surface rounded-xl p-4 mb-3 border border-border">
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row gap-2">
          <TouchableOpacity onPress={() => handleEdit(item)} style={{ backgroundColor: `${stageColor}20`, borderRadius: 20, padding: 6 }}>
            <MaterialIcons name="edit" size={16} color={stageColor} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleDelete(item)} style={{ backgroundColor: "#ef444420", borderRadius: 20, padding: 6 }}>
            <MaterialIcons name="delete" size={16} color="#ef4444" />
          </TouchableOpacity>
        </View>
        <View className="flex-row items-center gap-2">
          <Text className="text-foreground font-bold text-base">{item.workerName}</Text>
          <MaterialIcons name="person" size={20} color={stageColor} />
        </View>
      </View>

      <View className="bg-background rounded-lg p-3">
        <View className="flex-row justify-between mb-2">
          <Text className="text-foreground font-semibold">{item.productionDozen} درزن</Text>
          <Text className="text-muted text-sm">الإنتاج بالدرزن</Text>
        </View>
        <View className="flex-row justify-between">
          <Text className="text-foreground font-semibold">{item.productionPairs} زوج</Text>
          <Text className="text-muted text-sm">الإنتاج بالزوج</Text>
        </View>
      </View>

      <Text className="text-muted text-xs mt-2 text-right">{item.date}</Text>
    </View>
  );

  return (
    <ScreenContainer className="bg-background">
      {/* رأس الصفحة */}
      <View style={{ backgroundColor: stageColor }} className="px-6 py-5 flex-row items-center justify-between">
        <TouchableOpacity onPress={() => { setShowForm(true); resetForm(); }} style={{ backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 20, padding: 8 }}>
          <MaterialIcons name="add" size={24} color="white" />
        </TouchableOpacity>
        <View className="flex-1 items-center">
          <Text className="text-white font-bold text-xl">{stageName}</Text>
          <Text className="text-white/80 text-sm mt-1">بيانات إنتاج العمال</Text>
        </View>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialIcons name="arrow-forward" size={24} color="white" />
        </TouchableOpacity>
      </View>

      {showForm ? (
        <ScrollView className="flex-1 px-4 py-4">
          <View className="bg-surface rounded-xl p-5 border border-border">
            <Text className="text-foreground font-bold text-lg mb-4 text-right">
              {editingEntry ? "تعديل بيانات العامل" : "إدخال بيانات جديدة"}
            </Text>

            {/* اختيار العامل */}
            <View className="mb-4">
              <Text className="text-foreground font-semibold text-sm mb-2 text-right">اسم العامل</Text>
              <View className="flex-row flex-wrap gap-2 justify-end">
                {workers.map((worker) => (
                  <TouchableOpacity
                    key={worker}
                    onPress={() => setSelectedWorker(worker)}
                    style={{
                      backgroundColor: selectedWorker === worker ? stageColor : "transparent",
                      borderColor: stageColor,
                      borderWidth: 1,
                      borderRadius: 20,
                      paddingHorizontal: 16,
                      paddingVertical: 8,
                    }}
                  >
                    <Text style={{ color: selectedWorker === worker ? "white" : stageColor, fontWeight: "600" }}>
                      {worker}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* كمية الإنتاج بالدرزن */}
            <View className="mb-4">
              <Text className="text-foreground font-semibold text-sm mb-2 text-right">كمية الإنتاج (درزن)</Text>
              <TextInput
                className="bg-background border border-border rounded-lg px-4 py-3 text-foreground text-right"
                placeholder="أدخل الكمية بالدرزن"
                placeholderTextColor={colors.muted}
                value={productionDozen}
                onChangeText={setProductionDozen}
                keyboardType="numeric"
              />
            </View>

            {/* كمية الإنتاج بالزوج */}
            <View className="mb-4">
              <Text className="text-foreground font-semibold text-sm mb-2 text-right">كمية الإنتاج (زوج)</Text>
              <TextInput
                className="bg-background border border-border rounded-lg px-4 py-3 text-foreground text-right"
                placeholder="أدخل الكمية بالزوج"
                placeholderTextColor={colors.muted}
                value={productionPairs}
                onChangeText={setProductionPairs}
                keyboardType="numeric"
              />
            </View>

            <View className="flex-row gap-3 mt-4">
              <TouchableOpacity onPress={() => { setShowForm(false); resetForm(); }} className="flex-1 bg-border rounded-lg py-3 items-center">
                <Text className="text-foreground font-semibold">إلغاء</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSave} style={{ backgroundColor: stageColor }} className="flex-1 rounded-lg py-3 items-center">
                <Text className="text-white font-semibold">{editingEntry ? "تعديل" : "حفظ"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => item.id}
          renderItem={renderEntry}
          contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={
            <View className="items-center justify-center py-16">
              <MaterialIcons name="people" size={56} color={colors.muted} />
              <Text className="text-muted text-lg mt-4 font-semibold">لا توجد بيانات</Text>
              <Text className="text-muted text-sm mt-2">اضغط + لإضافة بيانات جديدة</Text>
            </View>
          }
        />
      )}
    </ScreenContainer>
  );
}
