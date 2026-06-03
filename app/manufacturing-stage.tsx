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
import { useAuth } from "@/lib/auth-context";

interface WorkerEntry {
  id: string;
  workerName: string;
  productionDozen: string;
  productionPairs: string;
  // المدة الزمنية للإنجاز
  durationHours?: string;
  durationMinutes?: string;
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
  const { user } = useAuth();
  const stage = (params.stage as string) || "machines";
  // قسم المستودعات يرى فقط بدون إضافة/تعديل/حذف
  const isViewOnly = user?.department === "warehouse" && user?.role !== "admin";

  const config = STAGE_CONFIG[stage] || STAGE_CONFIG.machines;
  const STORAGE_KEY = `sultan_manufacturing_${stage}`;

  const [entries, setEntries] = useState<WorkerEntry[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<WorkerEntry | null>(null);
  const [selectedWorker, setSelectedWorker] = useState("");
  const [productionDozen, setProductionDozen] = useState("");
  const [productionPairs, setProductionPairs] = useState("");
  // المدة الزمنية للإنجاز
  const [durationHours, setDurationHours] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");
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
    setDurationHours("");
    setDurationMinutes("");
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
      durationHours: durationHours || "0",
      durationMinutes: durationMinutes || "0",
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
    setDurationHours(entry.durationHours || "");
    setDurationMinutes(entry.durationMinutes || "");
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
    <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.border }}>
      {/* اسم العامل والأزرار */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        {/* أيقونات التعديل والحذف - تظهر فقط لغير المستودعات */}
        {!isViewOnly && (
        <View style={{ flexDirection: 'row', gap: 8 }}>
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
        )}

        {/* اسم العامل */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ color: colors.foreground, fontWeight: 'bold', fontSize: 16 }}>{item.workerName}</Text>
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
        <View style={{ backgroundColor: colors.background, borderRadius: 8, padding: 12 }}>
          {/* الإنتاج التام */}
          <Text style={{ color: colors.foreground, fontWeight: '600', fontSize: 14, textAlign: 'right', marginBottom: 8 }}>الإنتاج التام:</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={{ color: colors.foreground, fontWeight: 'bold', fontSize: 16 }}>{item.finishedDozen || "0"}</Text>
              <Text style={{ color: colors.muted, fontSize: 14 }}>درزن</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={{ color: colors.foreground, fontWeight: 'bold', fontSize: 16 }}>{item.finishedPairs || "0"}</Text>
              <Text style={{ color: colors.muted, fontSize: 14 }}>زوج</Text>
            </View>
          </View>
          {/* النخب الثاني */}
          <View style={{ borderTopWidth: 1, borderColor: colors.border, marginTop: 8, paddingTop: 8 }}>
            <Text style={{ color: colors.foreground, fontWeight: '600', fontSize: 14, textAlign: 'right', marginBottom: 8 }}>النخب الثاني:</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={{ color: colors.foreground, fontWeight: 'bold', fontSize: 16 }}>{item.secondGradeDozen || "0"}</Text>
                <Text style={{ color: colors.muted, fontSize: 14 }}>درزن</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={{ color: colors.foreground, fontWeight: 'bold', fontSize: 16 }}>{item.secondGradePairs || "0"}</Text>
                <Text style={{ color: colors.muted, fontSize: 14 }}>زوج</Text>
              </View>
            </View>
          </View>
          {/* جوارب مانع الانزلاق */}
          <View style={{ borderTopWidth: 1, borderColor: colors.border, marginTop: 8, paddingTop: 8 }}>
            <Text style={{ color: colors.foreground, fontWeight: '600', fontSize: 14, textAlign: 'right', marginBottom: 8 }}>جوارب مانع الانزلاق:</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={{ color: colors.foreground, fontWeight: 'bold', fontSize: 16 }}>{item.antislipDozen || "0"}</Text>
                <Text style={{ color: colors.muted, fontSize: 14 }}>درزن</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={{ color: colors.foreground, fontWeight: 'bold', fontSize: 16 }}>{item.antislipPairs || "0"}</Text>
                <Text style={{ color: colors.muted, fontSize: 14 }}>زوج</Text>
              </View>
            </View>
          </View>
        </View>
      ) : (
        <View style={{ backgroundColor: colors.background, borderRadius: 8, padding: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={{ color: colors.foreground, fontWeight: 'bold', fontSize: 16 }}>{item.productionDozen}</Text>
              <Text style={{ color: colors.muted, fontSize: 14 }}>درزن</Text>
            </View>
            <Text style={{ color: colors.muted, fontSize: 14, fontWeight: '600' }}>كمية الإنتاج بالدرزن</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={{ color: colors.foreground, fontWeight: 'bold', fontSize: 16 }}>{item.productionPairs}</Text>
              <Text style={{ color: colors.muted, fontSize: 14 }}>زوج</Text>
            </View>
            <Text style={{ color: colors.muted, fontSize: 14, fontWeight: '600' }}>كمية الإنتاج بالزوج</Text>
          </View>
        </View>
      )}

      {/* المدة الزمنية للإنجاز */}
      {(parseInt(item.durationHours || "0") > 0 || parseInt(item.durationMinutes || "0") > 0) && (
        <View style={{ marginTop: 8, backgroundColor: colors.background, borderRadius: 8, padding: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
          <Text style={{ color: colors.foreground, fontWeight: 'bold', fontSize: 14 }}>
            {item.durationHours || "0"} ساعة {item.durationMinutes || "0"} دقيقة
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={{ color: colors.muted, fontSize: 12 }}>مدة الإنجاز:</Text>
            <MaterialIcons name="timer" size={14} color={colors.muted} />
          </View>
        </View>
      )}

      {/* ملاحظات */}
      {item.notes ? (
        <View style={{ marginTop: 8, backgroundColor: colors.background, borderRadius: 8, padding: 8 }}>
          <Text style={{ color: colors.muted, fontSize: 12, textAlign: 'right' }}>{item.notes}</Text>
        </View>
      ) : null}

      {/* التاريخ */}
      <Text style={{ color: colors.muted, fontSize: 12, marginTop: 8, textAlign: 'right' }}>{item.date}</Text>
    </View>
  );

  return (
    <ScreenContainer style={{ backgroundColor: colors.background }}>
      {/* رأس الصفحة */}
      <View
        style={{ backgroundColor: config.color, paddingHorizontal: 24, paddingVertical: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
      >
        {/* زر الإضافة - يظهر فقط لغير المستودعات */}
        {isViewOnly ? (
          <View style={{ width: 40 }} />
        ) : (
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
        )}

        {/* عنوان الصفحة */}
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={{ color: '#ffffff', fontWeight: 'bold', fontSize: 20 }}>{config.name}</Text>
          <Text style={{ fontSize: 14, marginTop: 4 }}>
            {entries.length > 0 ? `${entries.length} سجل` : "لا توجد سجلات"}
          </Text>
        </View>

        {/* زر الرجوع */}
        <BackButton />
      </View>

      {/* نموذج الإدخال */}
      {showForm ? (
        <ScrollView style={{ flex: 1, paddingHorizontal: 16, paddingVertical: 16 }}>
          <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 20, borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ color: colors.foreground, fontWeight: 'bold', fontSize: 18, marginBottom: 20, textAlign: 'right' }}>
              {editingEntry ? "✏️ تعديل بيانات العامل" : "➕ إدخال بيانات جديدة"}
            </Text>

            {/* اختيار اسم العامل */}
            <View style={{ marginBottom: 20 }}>
              <Text style={{ color: colors.foreground, fontWeight: '600', fontSize: 14, marginBottom: 12, textAlign: 'right' }}>
                اسم العامل
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end' }}>
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
                <View style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                  <Text style={{ color: config.color, fontWeight: 'bold', fontSize: 14 }}>
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
                <View style={{ marginBottom: 16, backgroundColor: colors.background, borderRadius: 8, padding: 12, borderWidth: 1, borderColor: colors.border }}>
                  <Text style={{ color: colors.foreground, fontWeight: 'bold', fontSize: 14, marginBottom: 12, textAlign: 'right' }}>
                    الإنتاج التام
                  </Text>
                  <View style={{ marginBottom: 12 }}>
                    <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 4, textAlign: 'right' }}>الكمية بالدرزن</Text>
                    <TextInput
                      style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12, color: colors.foreground, textAlign: 'right', fontSize: 16 }}
                      placeholder="0"
                      placeholderTextColor={colors.muted}
                      value={finishedDozen}
                      onChangeText={setFinishedDozen}
                      keyboardType="numeric"
                      returnKeyType="next"
                    />
                  </View>
                  <View>
                    <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 4, textAlign: 'right' }}>الكمية بالزوج</Text>
                    <TextInput
                      style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12, color: colors.foreground, textAlign: 'right', fontSize: 16 }}
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
                <View style={{ marginBottom: 16, backgroundColor: colors.background, borderRadius: 8, padding: 12, borderWidth: 1, borderColor: colors.border }}>
                  <Text style={{ color: colors.foreground, fontWeight: 'bold', fontSize: 14, marginBottom: 12, textAlign: 'right' }}>
                    النخب الثاني
                  </Text>
                  <View style={{ marginBottom: 12 }}>
                    <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 4, textAlign: 'right' }}>الكمية بالدرزن</Text>
                    <TextInput
                      style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12, color: colors.foreground, textAlign: 'right', fontSize: 16 }}
                      placeholder="0"
                      placeholderTextColor={colors.muted}
                      value={secondGradeDozen}
                      onChangeText={setSecondGradeDozen}
                      keyboardType="numeric"
                      returnKeyType="next"
                    />
                  </View>
                  <View>
                    <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 4, textAlign: 'right' }}>الكمية بالزوج</Text>
                    <TextInput
                      style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12, color: colors.foreground, textAlign: 'right', fontSize: 16 }}
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
                <View style={{ marginBottom: 16, backgroundColor: colors.background, borderRadius: 8, padding: 12, borderWidth: 1, borderColor: colors.border }}>
                  <Text style={{ color: colors.foreground, fontWeight: 'bold', fontSize: 14, marginBottom: 12, textAlign: 'right' }}>
                    جوارب مانع الانزلاق
                  </Text>
                  <View style={{ marginBottom: 12 }}>
                    <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 4, textAlign: 'right' }}>الكمية بالدرزن</Text>
                    <TextInput
                      style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12, color: colors.foreground, textAlign: 'right', fontSize: 16 }}
                      placeholder="0"
                      placeholderTextColor={colors.muted}
                      value={antislipDozen}
                      onChangeText={setAntislipDozen}
                      keyboardType="numeric"
                      returnKeyType="next"
                    />
                  </View>
                  <View>
                    <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 4, textAlign: 'right' }}>الكمية بالزوج</Text>
                    <TextInput
                      style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12, color: colors.foreground, textAlign: 'right', fontSize: 16 }}
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
                <View style={{ marginBottom: 16 }}>
                  <Text style={{ color: colors.foreground, fontWeight: '600', fontSize: 14, marginBottom: 8, textAlign: 'right' }}>
                    كمية الإنتاج (درزن)
                  </Text>
                  <TextInput
                    style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12, color: colors.foreground, textAlign: 'right', fontSize: 16 }}
                    placeholder="أدخل الكمية بالدرزن"
                    placeholderTextColor={colors.muted}
                    value={productionDozen}
                    onChangeText={setProductionDozen}
                    keyboardType="numeric"
                    returnKeyType="next"
                  />
                </View>

                {/* كمية الإنتاج بالزوج */}
                <View style={{ marginBottom: 16 }}>
                  <Text style={{ color: colors.foreground, fontWeight: '600', fontSize: 14, marginBottom: 8, textAlign: 'right' }}>
                    كمية الإنتاج (زوج)
                  </Text>
                  <TextInput
                    style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12, color: colors.foreground, textAlign: 'right', fontSize: 16 }}
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

            {/* المدة الزمنية للإنجاز */}
            <View style={{ marginBottom: 20 }}>
              <Text style={{ color: colors.foreground, fontWeight: '600', fontSize: 14, marginBottom: 8, textAlign: 'right' }}>
                المدة الزمنية للإنجاز
              </Text>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 4, textAlign: 'right' }}>دقيقة</Text>
                  <TextInput
                    style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12, color: colors.foreground, textAlign: 'right', fontSize: 16 }}
                    placeholder="0"
                    placeholderTextColor={colors.muted}
                    value={durationMinutes}
                    onChangeText={setDurationMinutes}
                    keyboardType="numeric"
                    returnKeyType="next"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 4, textAlign: 'right' }}>ساعة</Text>
                  <TextInput
                    style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12, color: colors.foreground, textAlign: 'right', fontSize: 16 }}
                    placeholder="0"
                    placeholderTextColor={colors.muted}
                    value={durationHours}
                    onChangeText={setDurationHours}
                    keyboardType="numeric"
                    returnKeyType="next"
                  />
                </View>
              </View>
            </View>

            {/* ملاحظات */}
            <View style={{ marginBottom: 20 }}>
              <Text style={{ color: colors.foreground, fontWeight: '600', fontSize: 14, marginBottom: 8, textAlign: 'right' }}>
                ملاحظات (اختياري)
              </Text>
              <TextInput
                style={[{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12, color: colors.foreground, textAlign: 'right', fontSize: 16 }, { minHeight: 70, textAlignVertical: "top" }]}
                placeholder="أدخل ملاحظات إضافية"
                placeholderTextColor={colors.muted}
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
                returnKeyType="done"
              />
            </View>

            {/* أزرار الإجراءات */}
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
              {/* زر إلغاء */}
              <TouchableOpacity
                onPress={() => {
                  setShowForm(false);
                  resetForm();
                }}
                style={{ flex: 1, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingVertical: 16, alignItems: 'center', flexDirection: "row", justifyContent: "center", gap: 6 }}
              >
                <Text style={{ color: colors.foreground, fontWeight: '600', fontSize: 16 }}>إلغاء</Text>
                <MaterialIcons name="close" size={20} color={colors.foreground} />
              </TouchableOpacity>

              {/* زر حفظ */}
              <TouchableOpacity
                onPress={handleSave}
                style={{ backgroundColor: config.color, flexDirection: "row", justifyContent: "center", gap: 6, flex: 1, borderRadius: 12, paddingVertical: 16, alignItems: 'center' }}
              >
                <Text style={{ color: '#ffffff', fontWeight: '600', fontSize: 16 }}>
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
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80 }}>
              <View
                style={{ backgroundColor: `${config.color}15`, borderRadius: 40, padding: 20 }}
              >
                <MaterialIcons name={config.icon as any} size={48} color={config.color} />
              </View>
              <Text style={{ color: colors.foreground, fontSize: 18, marginTop: 20, fontWeight: 'bold' }}>{config.name}</Text>
              <Text style={{ color: colors.muted, fontSize: 14, marginTop: 8, textAlign: 'center', paddingHorizontal: 32 }}>
                {isViewOnly ? "لا توجد بيانات مسجلة بعد." : "لا توجد بيانات مسجلة بعد.\nاضغط على زر (+) في الأعلى لإضافة بيانات إنتاج جديدة."}
              </Text>

              {/* عرض أسماء العمال */}
              <View style={{ marginTop: 20, backgroundColor: colors.surface, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: colors.border, width: '100%' }}>
                <Text style={{ color: colors.foreground, fontWeight: '600', fontSize: 14, marginBottom: 12, textAlign: 'right' }}>
                  العمال في هذه المرحلة:
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end' }}>
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

              {!isViewOnly && (
              <TouchableOpacity
                onPress={() => {
                  resetForm();
                  setShowForm(true);
                }}
                style={{ backgroundColor: config.color, marginTop: 24, paddingHorizontal: 32, paddingVertical: 12, borderRadius: 12 }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={{ color: '#ffffff', fontWeight: '600' }}>إضافة بيانات</Text>
                  <MaterialIcons name="add" size={20} color="white" />
                </View>
              </TouchableOpacity>
              )}
            </View>
          }
        />
      )}
    </ScreenContainer>
  );
}
