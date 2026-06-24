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
import { manufacturingStageService } from "@/lib/services/data.service";
import { useAuth } from "@/lib/auth-context";
import { AttachmentPicker } from "@/components/attachment-picker";
import { AttachmentFile } from "@/lib/services/attachment.service";
import { useLanguage } from "@/lib/language-context";
import { manufacturingWorkersService } from "@/lib/services/api.service";

interface ProductItem {
  productName: string;
  quantityDozen: string;
  quantityPairs: string;
}

interface WorkerEntry {
  id: string;
  workerName: string;
  products: ProductItem[];
  durationHours?: string;
  durationMinutes?: string;
  // حقول التخزين
  finishedDozen?: string;
  finishedPairs?: string;
  secondGradeDozen?: string;
  secondGradePairs?: string;
  antislipDozen?: string;
  antislipPairs?: string;
  date: string;
  notes: string;
}

// بيانات العمال لكل مرحلة - سيتم تعريفها داخل الدالة

export default function ManufacturingStageScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const colors = useColors();
  const { user } = useAuth();
  const { language } = useLanguage();
  const isAr = language === "ar";
  const stage = (params.stage as string) || "machines";

  // بيانات العمال لكل مرحلة
  const STAGE_CONFIG: Record<
    string,
    { name: string; color: string; icon: string; workers: string[]; fields: string[] }
  > = {
    machines: {
      name: isAr ? "إنتاج المكائن" : "Machines Production",
      color: "#0a7ea4",
      icon: "precision-manufacturing",
      workers: isAr ? ["رنا", "محمد احمد", "أفضل", "عطالله", "شفيق", "الجميع"] : ["Rana", "Mohammed Ahmed", "Afzal", "Atallah", "Shafiq", "All"],
      fields: ["dozen", "pairs"],
    },
    rosso: {
      name: isAr ? "الروسو" : "Rosso",
      color: "#7c3aed",
      icon: "loop",
      workers: isAr ? ["فريدو", "قيوم", "الجميع"] : ["Fredo", "Qayyum", "All"],
      fields: ["dozen", "pairs"],
    },
    qalb: {
      name: isAr ? "القلب" : "Qalb",
      color: "#059669",
      icon: "flip",
      workers: isAr ? ["حسين السوري"] : ["Hussein Al-Suri"],
      fields: ["dozen", "pairs"],
    },
    kawiya: {
      name: isAr ? "الكاوية" : "Kawiya",
      color: "#dc2626",
      icon: "local-fire-department",
      workers: isAr ? ["جنيد"] : ["Junaid"],
      fields: ["dozen", "pairs"],
    },
    inspection: {
      name: isAr ? "الفحص" : "Inspection",
      color: "#d97706",
      icon: "search",
      workers: isAr ? ["عارف", "انام الدين", "الجميع"] : ["Aref", "Anamuddin", "All"],
      fields: ["dozen", "pairs"],
    },
    packing: {
      name: isAr ? "التغليف" : "Packing",
      color: "#2563eb",
      icon: "inventory-2",
      workers: isAr ? ["محمد عمر", "غلام", "بشير", "الجميع"] : ["Mohammed Omar", "Ghulam", "Bashir", "All"],
      fields: ["dozen", "pairs"],
    },
    antislip: {
      name: isAr ? "مانع الانزلاق" : "Anti-slip",
      color: "#0891b2",
      icon: "layers",
      workers: isAr ? ["محمد عمر", "مرتضى", "أوجيل", "الجميع"] : ["Mohammed Omar", "Murtaza", "Ogil", "All"],
      fields: ["dozen", "pairs"],
    },
    storage: {
      name: isAr ? "التخزين" : "Storage",
      color: "#4f46e5",
      icon: "warehouse",
      workers: isAr ? ["شميم"] : ["Shamim"],
      fields: ["storage"],
    },
  };
  // عمال المرحلة يمكنهم الإدخال، المستودعات view only فقط
  const isViewOnly = user?.department === "warehouse" && user?.role !== "admin" && stage !== "storage";

  const config = STAGE_CONFIG[stage] || STAGE_CONFIG.machines;
  const isStorageStage = stage === "storage";

  // Load workers from server
  const [stageWorkers, setStageWorkers] = useState<string[]>(config.workers);
  useEffect(() => {
    const loadServerWorkers = async () => {
      try {
        const workers = await manufacturingWorkersService.list(stage);
        if (workers && Array.isArray(workers) && workers.length > 0) {
          const names = workers.map((w: any) => w.workerName);
          // Add "الجميع" for stages that had it
          if (config.workers.includes(isAr ? "الجميع" : "All") && !names.includes(isAr ? "الجميع" : "All")) {
            names.push(isAr ? "الجميع" : "All");
          }
          setStageWorkers(names);
        }
      } catch (e) {
        console.log("Error loading workers from server:", e);
        // fallback to config workers
      }
    };
    loadServerWorkers();
  }, [stage]);

  const MANUFACTURING_STAGE_IDS = ["machines", "rosso", "qalb", "kawiya", "inspection", "packing", "antislip", "storage"];
  const isStageWorker = user?.department && MANUFACTURING_STAGE_IDS.includes(user.department) && user.department === stage;
  // إذا كان العامل في هذه المرحلة، يرى اسمه فقط
  const workerNameDisplay = isStageWorker ? (user?.name || "") : "";

  const [entries, setEntries] = useState<WorkerEntry[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<WorkerEntry | null>(null);
  const [selectedWorker, setSelectedWorker] = useState(isStageWorker ? (user?.name || "") : "");
  // منتجات (حتى 5)
  const [products, setProducts] = useState<ProductItem[]>([
    { productName: "", quantityDozen: "", quantityPairs: "" },
  ]);
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
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split("T")[0]);
  const [stageAttachments, setStageAttachments] = useState<AttachmentFile[]>([]);

  useEffect(() => {
    loadEntries();
  }, [stage]);

  const loadEntries = async () => {
    try {
      const data = await manufacturingStageService.getAll();
      if (data) {
        const filtered = data.filter((d: any) => d.stageName === stage);
        // تجميع السجلات حسب workerName + date + createdAt (نفس الإدخال)
        const grouped: Record<string, WorkerEntry> = {};
        filtered.forEach((d: any) => {
          // نستخدم groupKey لتجميع المنتجات التي أُدخلت معاً
          const groupKey = `${d.workerName}_${d.date || ""}_${d.id}`;
          if (!grouped[groupKey]) {
            grouped[groupKey] = {
              id: String(d.id),
              workerName: d.workerName || "",
              products: [],
              durationHours: "0",
              durationMinutes: "0",
              date: d.date || (d.createdAt ? new Date(d.createdAt).toLocaleDateString("ar-SA") : ""),
              notes: d.productType || "",
            };
          }
          grouped[groupKey].products.push({
            productName: d.productName || "",
            quantityDozen: String(d.quantityDozen || 0),
            quantityPairs: String(d.quantityPair || 0),
          });
        });
        setEntries(Object.values(grouped));
      } else {
        setEntries([]);
      }
    } catch (e) {
      console.log("Error loading entries:", e);
      setEntries([]);
    }
  };

  const resetForm = () => {
    setSelectedWorker("");
    setProducts([{ productName: "", quantityDozen: "", quantityPairs: "" }]);
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
    setEntryDate(new Date().toISOString().split("T")[0]);
  };

  // {isAr ? "إضافة منتج" : "Add Product"} جديد (حتى 5)
  const addProduct = () => {
    if (products.length >= 5) {
      Alert.alert(isAr ? "تنبيه" : "Warning", isAr ? "الحد الأقصى 5 منتجات لكل إدخال" : "Maximum 5 products per entry");
      return;
    }
    setProducts([...products, { productName: "", quantityDozen: "", quantityPairs: "" }]);
  };

  // حذف منتج
  const removeProduct = (index: number) => {
    if (products.length <= 1) return;
    const newProducts = products.filter((_, i) => i !== index);
    setProducts(newProducts);
  };

  // تحديث بيانات منتج
  const updateProduct = (index: number, field: keyof ProductItem, value: string) => {
    const newProducts = [...products];
    newProducts[index] = { ...newProducts[index], [field]: value };
    setProducts(newProducts);
  };

  // حفظ البيانات
  const handleSave = async () => {
    if (!selectedWorker) {
      Alert.alert(isAr ? "تنبيه" : "Warning", isAr ? "يرجى اختيار اسم العامل" : "Please select a worker name");
      return;
    }

    if (isStorageStage) {
      if (!finishedDozen && !finishedPairs && !secondGradeDozen && !secondGradePairs && !antislipDozen && !antislipPairs) {
        Alert.alert(isAr ? "تنبيه" : "Warning", isAr ? "يرجى إدخال كمية واحدة على الأقل" : "Please enter at least one quantity");
        return;
      }
    } else {
      // التحقق من أن كل منتج له اسم وكمية
      const validProducts = products.filter(p => p.productName.trim());
      if (validProducts.length === 0) {
        Alert.alert(isAr ? "تنبيه" : "Warning", isAr ? "يرجى إدخال اسم منتج واحد على الأقل مع الكمية" : "Please enter at least one product name with quantity");
        return;
      }
      const hasQuantity = validProducts.some(p => p.quantityDozen || p.quantityPairs);
      if (!hasQuantity) {
        Alert.alert(isAr ? "تنبيه" : "Warning", isAr ? "يرجى إدخال كمية لمنتج واحد على الأقل" : "Please enter a quantity for at least one product");
        return;
      }
    }

    try {
      if (isStorageStage) {
        // التخزين - إدخال واحد
        const apiData = {
          stageName: stage,
          workerName: selectedWorker,
          quantityDozen: parseInt(finishedDozen) || 0,
          quantityPair: parseInt(finishedPairs) || 0,
          productType: notes || "",
          productName: isAr ? "تخزين" : "Storage",
          date: entryDate,
          userId: user?.id || 1,
        };
        if (editingEntry) {
          await manufacturingStageService.update(parseInt(editingEntry.id), apiData);
        } else {
          await manufacturingStageService.create(apiData);
        }
      } else {
        // مراحل عادية - إدخال لكل منتج
        const validProducts = products.filter(p => p.productName.trim());
        
        if (editingEntry) {
          // عند التعديل: حذف القديم وإدخال الجديد
          await manufacturingStageService.delete(parseInt(editingEntry.id));
        }
        
        // إدخال كل منتج كسجل منفصل
        for (const product of validProducts) {
          const apiData = {
            stageName: stage,
            workerName: selectedWorker,
            quantityDozen: parseInt(product.quantityDozen) || 0,
            quantityPair: parseInt(product.quantityPairs) || 0,
            productType: notes || "",
            productName: product.productName.trim(),
            date: entryDate,
            userId: user?.id || 1,
          };
          await manufacturingStageService.create(apiData);
        }
      }

      await loadEntries();
      resetForm();
      setShowForm(false);
      Alert.alert(isAr ? "تم بنجاح ✓" : "Success ✓", editingEntry ? (isAr ? "تم تعديل البيانات بنجاح" : "Data updated successfully") : (isAr ? "تم حفظ البيانات بنجاح" : "Data saved successfully"));
    } catch (e) {
      Alert.alert(isAr ? "خطأ" : "Error", isAr ? "فشل حفظ البيانات" : "Failed to save data");
    }
  };

  // تعديل سجل
  const handleEdit = (entry: WorkerEntry) => {
    setSelectedWorker(entry.workerName);
    if (entry.products && entry.products.length > 0) {
      setProducts(entry.products.map(p => ({
        productName: p.productName,
        quantityDozen: p.quantityDozen,
        quantityPairs: p.quantityPairs,
      })));
    }
    setDurationHours(entry.durationHours || "");
    setDurationMinutes(entry.durationMinutes || "");
    setNotes(entry.notes || "");
    setEntryDate(entry.date || new Date().toISOString().split("T")[0]);
    setEditingEntry(entry);
    setShowForm(true);
  };

  // حذف سجل
  const handleDelete = (entry: WorkerEntry) => {
    Alert.alert(
      isAr ? "تأكيد الحذف" : "Confirm Deletion",
      isAr ? `هل أنت متأكد من حذف سجل "${entry.workerName}"؟` : `Are you sure you want to delete the record for "${entry.workerName}"?`,
      [
        { text: isAr ? "إلغاء" : "Cancel", style: "cancel" },
        {
          text: isAr ? "حذف" : "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await manufacturingStageService.delete(parseInt(entry.id));
              await loadEntries();
              Alert.alert(isAr ? "تم ✓" : "Done ✓", isAr ? "تم حذف السجل بنجاح" : "Record deleted successfully");
            } catch (e) { console.log(e); }
          },
        },
      ]
    );
  };

  // عرض سجل واحد
  const renderEntry = ({ item }: { item: WorkerEntry }) => (
    <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.border }}>
      {/* {isAr ? "اسم العامل" : "Worker Name"} والأزرار */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        {!isViewOnly && (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              onPress={() => handleEdit(item)}
              style={{ backgroundColor: `${config.color}15`, borderRadius: 20, padding: 8 }}
            >
              <MaterialIcons name="edit" size={18} color={config.color} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleDelete(item)}
              style={{ backgroundColor: "#ef444415", borderRadius: 20, padding: 8 }}
            >
              <MaterialIcons name="delete" size={18} color="#ef4444" />
            </TouchableOpacity>
          </View>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ color: colors.foreground, fontWeight: 'bold', fontSize: 16 }}>{item.workerName}</Text>
          <View style={{ backgroundColor: `${config.color}20`, borderRadius: 16, padding: 6 }}>
            <MaterialIcons name="person" size={18} color={config.color} />
          </View>
        </View>
      </View>

      {/* {isAr ? "التاريخ" : "Date"} */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6, marginBottom: 12 }}>
        <Text style={{ color: colors.muted, fontSize: 13 }}>{item.date}</Text>
        <MaterialIcons name="calendar-today" size={14} color={colors.muted} />
      </View>

      {/* المنتجات */}
      {item.products && item.products.length > 0 && (
        <View style={{ backgroundColor: colors.background, borderRadius: 8, padding: 12 }}>
          <Text style={{ color: config.color, fontWeight: 'bold', fontSize: 14, marginBottom: 10, textAlign: isAr ? "right" : "left" }}>
            {isAr ? `المنتجات (${item.products.length})` : `Products (${item.products.length})`}
          </Text>
          {item.products.map((product, idx) => (
            <View key={idx} style={{ 
              borderBottomWidth: idx < item.products.length - 1 ? 1 : 0, 
              borderColor: colors.border, 
              paddingBottom: idx < item.products.length - 1 ? 10 : 0,
              marginBottom: idx < item.products.length - 1 ? 10 : 0,
            }}>
              {/* {isAr ? "اسم المنتج *" : "Product Name *"} */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6, marginBottom: 6 }}>
                <Text style={{ color: colors.foreground, fontWeight: 'bold', fontSize: 15 }}>
                  {product.productName || (isAr ? "بدون اسم" : "Unnamed")}
                </Text>
                <MaterialIcons name="inventory" size={16} color={config.color} />
              </View>
              {/* الكميات */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ color: colors.foreground, fontWeight: 'bold', fontSize: 16 }}>{product.quantityDozen || "0"}</Text>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>{isAr ? "درزن" : "Dozen"}</Text>
                </View>
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ color: colors.foreground, fontWeight: 'bold', fontSize: 16 }}>{product.quantityPairs || "0"}</Text>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>{isAr ? "زوج" : "Pair"}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* ملاحظات */}
      {item.notes ? (
        <View style={{ marginTop: 8, backgroundColor: colors.background, borderRadius: 8, padding: 8 }}>
          <Text style={{ color: colors.muted, fontSize: 12, textAlign: isAr ? "right" : "left" }}>{item.notes}</Text>
        </View>
      ) : null}
    </View>
  );

  return (
    <ScreenContainer style={{ backgroundColor: colors.background }}>
      {/* رأس الصفحة */}
      <View style={{ backgroundColor: config.color, paddingHorizontal: 24, paddingVertical: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        {isViewOnly ? (
          <View style={{ width: 40 }} />
        ) : (
          <TouchableOpacity
            onPress={() => { resetForm(); setShowForm(true); }}
            style={{ backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 20, padding: 8 }}
          >
            <MaterialIcons name="add" size={24} color="white" />
          </TouchableOpacity>
        )}
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={{ color: '#ffffff', fontWeight: 'bold', fontSize: 20 }}>{config.name}</Text>
          <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14, marginTop: 4 }}>
            {entries.length > 0 ? (isAr ? `${entries.length} سجل` : `${entries.length} records`) : (isAr ? "لا توجد سجلات" : "No records")}
          </Text>
        </View>
        <BackButton />
      </View>

      {/* نموذج الإدخال */}
      {showForm ? (
        <ScrollView style={{ flex: 1, paddingHorizontal: 16, paddingVertical: 16 }}>
          <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 20, borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ color: colors.foreground, fontWeight: 'bold', fontSize: 18, marginBottom: 20, textAlign: isAr ? "right" : "left" }}>
              {editingEntry ? (isAr ? "✏️ تعديل بيانات" : "✏️ Edit Data") : (isAr ? "➕ إدخال بيانات جديدة" : "➕ Enter New Data")}
            </Text>

            {/* اختيار اسم العامل */}
            <View style={{ marginBottom: 20 }}>
              <Text style={{ color: colors.foreground, fontWeight: '600', fontSize: 14, marginBottom: 12, textAlign: isAr ? "right" : "left" }}>
                {isAr ? "اسم العامل" : "Worker Name"}
              </Text>
              {isStageWorker ? (
                // إذا كان العامل في هذه المرحلة، يرى اسمه فقط (بدون خيارات)
                <View style={{ backgroundColor: config.color + "20", borderRadius: 12, padding: 16, borderWidth: 1.5, borderColor: config.color }}>
                  <Text style={{ color: config.color, fontWeight: "700", fontSize: 16, textAlign: isAr ? "right" : "left" }}>
                    {user?.name || ""}
                  </Text>
                </View>
              ) : (
                // الأدمن يرى جميع الخيارات
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end' }}>
                  {stageWorkers.map((worker) => (
                    <TouchableOpacity
                      key={worker}
                      onPress={() => setSelectedWorker(worker)}
                      style={{
                        backgroundColor: selectedWorker === worker ? config.color : "transparent",
                        borderColor: config.color,
                        borderWidth: 1.5,
                        borderRadius: 22,
                        paddingHorizontal: 18,
                        paddingVertical: 10,
                      }}
                    >
                      <Text style={{ color: selectedWorker === worker ? "white" : config.color, fontWeight: "700", fontSize: 14 }}>
                        {worker}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* {isAr ? "التاريخ" : "Date"} */}
            <View style={{ marginBottom: 20 }}>
              <Text style={{ color: colors.foreground, fontWeight: '600', fontSize: 14, marginBottom: 8, textAlign: isAr ? "right" : "left" }}>
                {isAr ? "التاريخ" : "Date"}
              </Text>
              <TextInput
                style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12, color: colors.foreground, textAlign: isAr ? "right" : "left", fontSize: 16 }}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.muted}
                value={entryDate}
                onChangeText={setEntryDate}
                returnKeyType="next"
              />
            </View>

            {/* حقول الإدخال حسب المرحلة */}
            {isStorageStage ? (
              <View>
                {/* {isAr ? "الإنتاج التام" : "Finished Production"} */}
                <View style={{ marginBottom: 16, backgroundColor: colors.background, borderRadius: 8, padding: 12, borderWidth: 1, borderColor: colors.border }}>
                  <Text style={{ color: colors.foreground, fontWeight: 'bold', fontSize: 14, marginBottom: 12, textAlign: isAr ? "right" : "left" }}>{isAr ? "الإنتاج التام" : "Finished Production"}</Text>
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 4, textAlign: isAr ? "right" : "left" }}>{isAr ? "زوج" : "Pair"}</Text>
                      <TextInput
                        style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, color: colors.foreground, textAlign: isAr ? "right" : "left", fontSize: 16 }}
                        placeholder="0" placeholderTextColor={colors.muted} value={finishedPairs} onChangeText={setFinishedPairs} keyboardType="numeric"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 4, textAlign: isAr ? "right" : "left" }}>{isAr ? "درزن" : "Dozen"}</Text>
                      <TextInput
                        style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, color: colors.foreground, textAlign: isAr ? "right" : "left", fontSize: 16 }}
                        placeholder="0" placeholderTextColor={colors.muted} value={finishedDozen} onChangeText={setFinishedDozen} keyboardType="numeric"
                      />
                    </View>
                  </View>
                </View>
                {/* {isAr ? "النخب الثاني" : "Second Grade"} */}
                <View style={{ marginBottom: 16, backgroundColor: colors.background, borderRadius: 8, padding: 12, borderWidth: 1, borderColor: colors.border }}>
                  <Text style={{ color: colors.foreground, fontWeight: 'bold', fontSize: 14, marginBottom: 12, textAlign: isAr ? "right" : "left" }}>{isAr ? "النخب الثاني" : "Second Grade"}</Text>
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 4, textAlign: isAr ? "right" : "left" }}>{isAr ? "زوج" : "Pair"}</Text>
                      <TextInput
                        style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, color: colors.foreground, textAlign: isAr ? "right" : "left", fontSize: 16 }}
                        placeholder="0" placeholderTextColor={colors.muted} value={secondGradePairs} onChangeText={setSecondGradePairs} keyboardType="numeric"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 4, textAlign: isAr ? "right" : "left" }}>{isAr ? "درزن" : "Dozen"}</Text>
                      <TextInput
                        style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, color: colors.foreground, textAlign: isAr ? "right" : "left", fontSize: 16 }}
                        placeholder="0" placeholderTextColor={colors.muted} value={secondGradeDozen} onChangeText={setSecondGradeDozen} keyboardType="numeric"
                      />
                    </View>
                  </View>
                </View>
                {/* مانع الانزلاق */}
                <View style={{ marginBottom: 16, backgroundColor: colors.background, borderRadius: 8, padding: 12, borderWidth: 1, borderColor: colors.border }}>
                  <Text style={{ color: colors.foreground, fontWeight: 'bold', fontSize: 14, marginBottom: 12, textAlign: isAr ? "right" : "left" }}>{isAr ? "جوارب مانع الانزلاق" : "Anti-slip Socks"}</Text>
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 4, textAlign: isAr ? "right" : "left" }}>{isAr ? "زوج" : "Pair"}</Text>
                      <TextInput
                        style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, color: colors.foreground, textAlign: isAr ? "right" : "left", fontSize: 16 }}
                        placeholder="0" placeholderTextColor={colors.muted} value={antislipPairs} onChangeText={setAntislipPairs} keyboardType="numeric"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 4, textAlign: isAr ? "right" : "left" }}>{isAr ? "درزن" : "Dozen"}</Text>
                      <TextInput
                        style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, color: colors.foreground, textAlign: isAr ? "right" : "left", fontSize: 16 }}
                        placeholder="0" placeholderTextColor={colors.muted} value={antislipDozen} onChangeText={setAntislipDozen} keyboardType="numeric"
                      />
                    </View>
                  </View>
                </View>
              </View>
            ) : (
              <View>
                {/* قائمة المنتجات */}
                <View style={{ marginBottom: 16 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <TouchableOpacity
                      onPress={addProduct}
                      style={{ backgroundColor: config.color, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 4 }}
                    >
                      <Text style={{ color: 'white', fontSize: 12, fontWeight: '600' }}>{isAr ? "إضافة منتج" : "Add Product"}</Text>
                      <MaterialIcons name="add" size={16} color="white" />
                    </TouchableOpacity>
                    <Text style={{ color: colors.foreground, fontWeight: '600', fontSize: 14 }}>
                      {isAr ? `المنتجات (${products.length}/5)` : `Products (${products.length}/5)`}
                    </Text>
                  </View>

                  {products.map((product, index) => (
                    <View key={index} style={{ 
                      backgroundColor: colors.background, 
                      borderRadius: 10, 
                      padding: 14, 
                      marginBottom: 12, 
                      borderWidth: 1, 
                      borderColor: colors.border,
                      borderLeftWidth: 4,
                      borderLeftColor: config.color,
                    }}>
                      {/* رأس المنتج */}
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        {products.length > 1 && (
                          <TouchableOpacity onPress={() => removeProduct(index)} style={{ padding: 4 }}>
                            <MaterialIcons name="close" size={20} color="#ef4444" />
                          </TouchableOpacity>
                        )}
                        <Text style={{ color: config.color, fontWeight: 'bold', fontSize: 14 }}>
                          {isAr ? `منتج ${index + 1}` : `Product ${index + 1}`}
                        </Text>
                      </View>

                      {/* {isAr ? "اسم المنتج *" : "Product Name *"} */}
                      <View style={{ marginBottom: 10 }}>
                        <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 4, textAlign: isAr ? "right" : "left" }}>{isAr ? "اسم المنتج *" : "Product Name *"}</Text>
                        <TextInput
                          style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10, color: colors.foreground, textAlign: isAr ? "right" : "left", fontSize: 15 }}
                          placeholder={isAr ? "أدخل اسم المنتج" : "Enter product name"}
                          placeholderTextColor={colors.muted}
                          value={product.productName}
                          onChangeText={(v) => updateProduct(index, "productName", v)}
                          returnKeyType="next"
                        />
                      </View>

                      {/* الكميات */}
                      <View style={{ flexDirection: 'row', gap: 12 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 4, textAlign: isAr ? "right" : "left" }}>{isAr ? "زوج" : "Pair"}</Text>
                          <TextInput
                            style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, color: colors.foreground, textAlign: isAr ? "right" : "left", fontSize: 16 }}
                            placeholder="0" placeholderTextColor={colors.muted}
                            value={product.quantityPairs}
                            onChangeText={(v) => updateProduct(index, "quantityPairs", v)}
                            keyboardType="numeric" returnKeyType="next"
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 4, textAlign: isAr ? "right" : "left" }}>{isAr ? "درزن" : "Dozen"}</Text>
                          <TextInput
                            style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, color: colors.foreground, textAlign: isAr ? "right" : "left", fontSize: 16 }}
                            placeholder="0" placeholderTextColor={colors.muted}
                            value={product.quantityDozen}
                            onChangeText={(v) => updateProduct(index, "quantityDozen", v)}
                            keyboardType="numeric" returnKeyType="next"
                          />
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* {isAr ? "المدة الزمنية للإنجاز" : "Completion Time"} */}
            <View style={{ marginBottom: 20 }}>
              <Text style={{ color: colors.foreground, fontWeight: '600', fontSize: 14, marginBottom: 8, textAlign: isAr ? "right" : "left" }}>
                {isAr ? "المدة الزمنية للإنجاز" : "Completion Time"}
              </Text>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 4, textAlign: isAr ? "right" : "left" }}>{isAr ? "دقيقة" : "Minute"}</Text>
                  <TextInput
                    style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12, color: colors.foreground, textAlign: isAr ? "right" : "left", fontSize: 16 }}
                    placeholder="0" placeholderTextColor={colors.muted} value={durationMinutes} onChangeText={setDurationMinutes} keyboardType="numeric"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 4, textAlign: isAr ? "right" : "left" }}>{isAr ? "ساعة" : "Hour"}</Text>
                  <TextInput
                    style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12, color: colors.foreground, textAlign: isAr ? "right" : "left", fontSize: 16 }}
                    placeholder="0" placeholderTextColor={colors.muted} value={durationHours} onChangeText={setDurationHours} keyboardType="numeric"
                  />
                </View>
              </View>
            </View>

            {/* ملاحظات */}
            <View style={{ marginBottom: 20 }}>
              <Text style={{ color: colors.foreground, fontWeight: '600', fontSize: 14, marginBottom: 8, textAlign: isAr ? "right" : "left" }}>
                {isAr ? "ملاحظات (اختياري)" : "Notes (Optional)"}
              </Text>
              <TextInput
                style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12, color: colors.foreground, textAlign: isAr ? "right" : "left", fontSize: 16, minHeight: 70, textAlignVertical: "top" }}
                placeholder={isAr ? "أدخل ملاحظات إضافية" : "Enter additional notes"}
                placeholderTextColor={colors.muted}
                value={notes} onChangeText={setNotes} multiline numberOfLines={3}
              />
            </View>

            {/* المرفقات */}
            <AttachmentPicker
              attachments={stageAttachments}
              onAttachmentsChange={setStageAttachments}
              language={language}
            />

            {/* أزرار الإجراءات */}
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
              <TouchableOpacity
                onPress={() => { setShowForm(false); resetForm(); }}
                style={{ flex: 1, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingVertical: 16, alignItems: 'center', flexDirection: "row", justifyContent: "center", gap: 6 }}
              >
                <Text style={{ color: colors.foreground, fontWeight: '600', fontSize: 16 }}>إلغاء</Text>
                <MaterialIcons name="close" size={20} color={colors.foreground} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSave}
                style={{ backgroundColor: config.color, flexDirection: "row", justifyContent: "center", gap: 6, flex: 1, borderRadius: 12, paddingVertical: 16, alignItems: 'center' }}
              >
                <Text style={{ color: '#ffffff', fontWeight: '600', fontSize: 16 }}>
                  {editingEntry ? (isAr ? "تعديل" : "Edit") : (isAr ? "حفظ" : "Save")}
                </Text>
                <MaterialIcons name={editingEntry ? "edit" : "save"} size={20} color="white" />
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
              <View style={{ backgroundColor: `${config.color}15`, borderRadius: 40, padding: 20 }}>
                <MaterialIcons name={config.icon as any} size={48} color={config.color} />
              </View>
              <Text style={{ color: colors.foreground, fontSize: 18, marginTop: 20, fontWeight: 'bold' }}>{config.name}</Text>
              <Text style={{ color: colors.muted, fontSize: 14, marginTop: 8, textAlign: 'center', paddingHorizontal: 32 }}>
                {isViewOnly ? (isAr ? "لا توجد بيانات مسجلة بعد." : "No data recorded yet.") : (isAr ? "لا توجد بيانات مسجلة بعد.\nاضغط على زر (+) في الأعلى لإضافة بيانات إنتاج جديدة." : "No data recorded yet.\nPress the (+) button above to add new production data.")}
              </Text>
              <View style={{ marginTop: 20, backgroundColor: colors.surface, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: colors.border, width: '100%' }}>
                <Text style={{ color: colors.foreground, fontWeight: '600', fontSize: 14, marginBottom: 12, textAlign: isAr ? "right" : "left" }}>
                  {isAr ? "العمال في هذه المرحلة:" : "Workers in this stage:"}
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end' }}>
                  {stageWorkers.map((worker) => (
                    <View key={worker} style={{ backgroundColor: `${config.color}15`, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 }}>
                      <Text style={{ color: config.color, fontWeight: "600", fontSize: 13 }}>{worker}</Text>
                    </View>
                  ))}
                </View>
              </View>
              {!isViewOnly && (
                <TouchableOpacity
                  onPress={() => { resetForm(); setShowForm(true); }}
                  style={{ backgroundColor: config.color, marginTop: 20, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 14 }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text style={{ color: '#ffffff', fontWeight: '600' }}>{isAr ? "إضافة بيانات" : "Add Data"}</Text>
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
