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
  Platform,
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
import { manufacturingWorkersService, productsService } from "@/lib/services/api.service";

interface ProductItem {
  productName: string;
  quantityDozen: string;
  quantityPairs: string;
  movementStatus: "none" | "received" | "delivered";
  movementAt?: string;
}

interface WorkerEntry {
  id: string;
  workerName: string;
  products: ProductItem[];
  receivedAt?: string;
  deliveredAt?: string;
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
  const isAdmin = user?.role === "admin";
  const isViewOnly = user?.department === "warehouse" && !isAdmin && stage !== "storage";

  const config = STAGE_CONFIG[stage] || STAGE_CONFIG.machines;
  const isStorageStage = stage === "storage";

  // Load workers from server
  const [stageWorkers, setStageWorkers] = useState<string[]>(config.workers);
  const [savedProducts, setSavedProducts] = useState<any[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
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
  const isProductionManager = user?.department === "production" || String(user?.position || "").includes("مدير الإنتاج") || String(user?.position || "").toLowerCase().includes("production manager");

  const [entries, setEntries] = useState<WorkerEntry[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
  const [trashEntries, setTrashEntries] = useState<any[]>([]);
  const [editingEntry, setEditingEntry] = useState<WorkerEntry | null>(null);
  // العامل يُحدد تلقائياً من حساب المستخدم المسجل دخول
  const [selectedWorker, setSelectedWorker] = useState(user?.name || "");
  // منتجات (حتى 10)
  const [products, setProducts] = useState<ProductItem[]>([
    { productName: "", quantityDozen: "", quantityPairs: "", movementStatus: "none" },
  ]);
  const [productSearch, setProductSearch] = useState<Record<number, string>>({});
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
  const [showStageReport, setShowStageReport] = useState(false);
  const [reportPeriod, setReportPeriod] = useState<"daily" | "weekly" | "monthly">("daily");
  const [reportWorker, setReportWorker] = useState("all");
  const [reportDate, setReportDate] = useState(new Date().toISOString().split("T")[0]);

  useEffect(() => {
    loadEntries();
  }, [stage]);

  useEffect(() => {
    let active = true;
    const loadSavedProducts = async () => {
      setProductsLoading(true);
      try {
        const rows = await productsService.list();
        if (active) setSavedProducts(Array.isArray(rows) ? rows : []);
      } catch (error) {
        console.log("Error loading saved products for manufacturing stage:", error);
        if (active) setSavedProducts([]);
      } finally {
        if (active) setProductsLoading(false);
      }
    };
    loadSavedProducts();
    return () => { active = false; };
  }, []);

  const loadEntries = async () => {
    try {
      const data = await manufacturingStageService.getAll();
      if (data) {
        let filtered = data.filter((d: any) => d.stageName === stage);
        // العامل يشوف بياناته فقط، الأدمن يشوف الكل
        if (user?.role !== 'admin' && !isProductionManager) {
          filtered = filtered.filter((d: any) => d.userId === user?.id || d.workerName === user?.name);
        }
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
              receivedAt: "",
              deliveredAt: "",
              date: d.date || (d.createdAt ? new Date(d.createdAt).toLocaleDateString("ar-SA") : ""),
              notes: d.productType || "",
            };
          }
          grouped[groupKey].products.push({
            productName: d.productName || "",
            quantityDozen: String(d.quantityDozen || 0),
            quantityPairs: String(d.quantityPair || 0),
            movementStatus: d.movementStatus || "none",
            movementAt: d.movementAt ? String(d.movementAt) : "",
          });
          if (d.movementStatus === "received" && d.movementAt) grouped[groupKey].receivedAt = String(d.movementAt);
          if (d.movementStatus === "delivered" && d.movementAt) grouped[groupKey].deliveredAt = String(d.movementAt);
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

  const loadTrash = async () => {
    if (!isAdmin) return;
    try {
      const deleted = await manufacturingStageService.getDeleted();
      setTrashEntries((deleted || []).filter((item: any) => item.stageName === stage));
    } catch (error) {
      console.log("Error loading deleted stage records:", error);
      setTrashEntries([]);
    }
  };
  const handleRestore = (entry: any) => {
    const label = [entry.productName, entry.workerName, entry.date].filter(Boolean).join(" - ");
    Alert.alert(isAr ? "تأكيد الاسترجاع" : "Confirm restore", isAr ? `هل تريد استرجاع السجل؟\n${label}` : `Restore this record?\n${label}`, [{ text: isAr ? "إلغاء" : "Cancel", style: "cancel" }, { text: isAr ? "استرجاع" : "Restore", onPress: async () => { try { await manufacturingStageService.restore(Number(entry.id)); await loadTrash(); await loadEntries(); Alert.alert(isAr ? "تم الاسترجاع" : "Restored", isAr ? "تم استرجاع السجل بنجاح" : "Record restored successfully"); } catch (error) { Alert.alert(isAr ? "خطأ" : "Error", error instanceof Error ? error.message : (isAr ? "تعذر استرجاع السجل" : "Unable to restore record")); } } }]);
  };
  const getSavedProductLabel = (product: any) => [product?.name, product?.size, product?.color].filter(Boolean).join(" - ");

  const selectSavedProduct = (index: number, product: any) => {
    const label = getSavedProductLabel(product);
    if (label) {
      updateProduct(index, "productName", label);
      setProductSearch((current) => ({ ...current, [index]: label }));
    }
  };

  const getFilteredSavedProducts = (index: number) => {
    const query = String(productSearch[index] || "").trim().toLocaleLowerCase("ar");
    if (!query) return savedProducts.slice(0, 20);
    return savedProducts.filter((product: any) => getSavedProductLabel(product).toLocaleLowerCase("ar").includes(query) || String(product?.barcode || "").toLocaleLowerCase("ar").includes(query)).slice(0, 20);
  };

  const resetForm = () => {
    setSelectedWorker(user?.name || "");
    setProducts([{ productName: "", quantityDozen: "", quantityPairs: "", movementStatus: "none" }]);
    setProductSearch({});
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

  // {isAr ? "إضافة منتج" : "Add Product"} جديد (حتى 10)
  const addProduct = () => {
    if (products.length >= 10) {
      Alert.alert(isAr ? "تنبيه" : "Warning", isAr ? "الحد الأقصى 10 منتجات لكل إدخال" : "Maximum 10 products per entry");
      return;
    }
    setProducts([...products, { productName: "", quantityDozen: "", quantityPairs: "", movementStatus: "none" }]);
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

  const showStageMessage = (title: string, message: string) => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  // حفظ البيانات
  const handleSave = async () => {
    // اسم العامل يؤخذ تلقائياً من حساب المستخدم
    const workerName = user?.name || selectedWorker;
    if (!workerName) {
      Alert.alert(isAr ? "تنبيه" : "Warning", isAr ? "يرجى تسجيل الدخول أولاً" : "Please login first");
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
      // حفظ التقرير مستقل عن حركة الاستلام والتسليم؛ الحالة none تعني «بانتظار الحركة».
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
          workerName: workerName,
          quantityDozen: parseInt(finishedDozen) || 0,
          quantityPair: parseInt(finishedPairs) || 0,
          productType: notes || "",
          productName: isAr ? "تخزين" : "Storage",
          date: entryDate,
          userId: user?.id || 1,
        };
        if (editingEntry) {
          const result = await manufacturingStageService.update(parseInt(editingEntry.id), apiData);
          if ((result as any)?.success === false) throw new Error("Stage update was not confirmed");
        } else {
          const result = await manufacturingStageService.create(apiData);
          if ((result as any)?.success === false) throw new Error("Stage save was not confirmed");
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
            workerName: workerName,
            quantityDozen: parseInt(product.quantityDozen) || 0,
            quantityPair: parseInt(product.quantityPairs) || 0,
            productType: notes || "",
            productName: product.productName.trim(),
            date: entryDate,
            movementStatus: product.movementStatus,
            movementBy: product.movementStatus === "none" ? undefined : workerName,
            movementAt: product.movementStatus === "none" ? undefined : new Date(),
            userId: user?.id || 1,
          };
          const result = await manufacturingStageService.create(apiData);
          if ((result as any)?.success === false) throw new Error("Stage save was not confirmed");
        }
      }

      await loadEntries();
      resetForm();
      setShowForm(false);
      showStageMessage(isAr ? "تم بنجاح ✓" : "Success ✓", editingEntry ? (isAr ? "تم تعديل البيانات بنجاح" : "Data updated successfully") : (isAr ? "تم حفظ البيانات بنجاح" : "Data saved successfully"));
    } catch (e) {
      const message = e instanceof Error ? e.message : (isAr ? "فشل حفظ البيانات" : "Failed to save data");
      showStageMessage(isAr ? "خطأ في الحفظ" : "Save error", message);
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
        movementStatus: p.movementStatus || "none",
        movementAt: p.movementAt || "",
      })));
    }
    setNotes(entry.notes || "");
    setEntryDate(entry.date || new Date().toISOString().split("T")[0]);
    setEditingEntry(entry);
    setShowForm(true);
  };

  // حذف سجل
  const handleDelete = (entry: WorkerEntry) => {
    const productLabel = entry.products?.map((product) => product.productName).filter(Boolean).join("، ") || entry.workerName;
    const confirmMessage = isAr ? `سيتم نقل المنتج إلى سلة المهملات:\n${productLabel}\nالعامل: ${entry.workerName}\nهل تريد المتابعة؟` : `This product will move to trash:\n${productLabel}\nWorker: ${entry.workerName}\nContinue?`;
    const executeDelete = async () => {
      try {
        await manufacturingStageService.delete(Number(entry.id));
        await loadEntries();
        showStageMessage(isAr ? "تم ✓" : "Done ✓", isAr ? "تم نقل السجل إلى سلة المهملات بنجاح" : "Record moved to trash successfully");
      } catch (error) {
        const message = error instanceof Error ? error.message : (isAr ? "تعذر حذف السجل" : "Unable to delete record");
        showStageMessage(isAr ? "فشل الحذف" : "Delete failed", message);
      }
    };
    if (Platform.OS === "web" && typeof window !== "undefined") {
      if (window.confirm(confirmMessage)) void executeDelete();
      return;
    }
    Alert.alert(isAr ? "تأكيد الحذف" : "Confirm Deletion", confirmMessage, [
      { text: isAr ? "إلغاء" : "Cancel", style: "cancel" },
      { text: isAr ? "حذف" : "Delete", style: "destructive", onPress: () => { void executeDelete(); } },
    ]);
  };

  const getReportWindow = (anchor: string, period: "daily" | "weekly" | "monthly") => {
    const date = new Date(`${anchor}T00:00:00`);
    if (Number.isNaN(date.getTime())) return { start: anchor, end: anchor };
    const start = new Date(date);
    const end = new Date(date);
    if (period === "weekly") {
      const day = start.getDay();
      start.setDate(start.getDate() - day);
      end.setDate(start.getDate() + 6);
    } else if (period === "monthly") {
      start.setDate(1);
      end.setMonth(start.getMonth() + 1, 0);
    }
    const format = (value: Date) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
    return { start: format(start), end: format(end) };
  };

  const getStageReport = () => {
    const window = getReportWindow(reportDate, reportPeriod);
    const selectedEntries = entries.filter((entry) => {
      const inRange = entry.date >= window.start && entry.date <= window.end;
      const workerMatch = reportWorker === "all" || entry.workerName === reportWorker;
      return inRange && workerMatch;
    });
    const productsCount = selectedEntries.reduce((sum, entry) => sum + entry.products.length, 0);
    const totalDozen = selectedEntries.reduce((sum, entry) => sum + entry.products.reduce((inner, product) => inner + (parseInt(product.quantityDozen) || 0), 0), 0);
    const totalPairs = selectedEntries.reduce((sum, entry) => sum + entry.products.reduce((inner, product) => inner + (parseInt(product.quantityPairs) || 0), 0), 0);
    const allProducts = selectedEntries.flatMap((entry) => entry.products);
    const receivedCount = allProducts.filter((product) => product.movementStatus === "received").length;
    const deliveredCount = allProducts.filter((product) => product.movementStatus === "delivered").length;
    const latestReceivedAt = selectedEntries.map((entry) => entry.receivedAt).filter(Boolean).sort().at(-1) || "";
    const latestDeliveredAt = selectedEntries.map((entry) => entry.deliveredAt).filter(Boolean).sort().at(-1) || "";
    const workers = Array.from(new Set(selectedEntries.map((entry) => entry.workerName).filter(Boolean)));
    return { window, selectedEntries, productsCount, totalDozen, totalPairs, receivedCount, deliveredCount, latestReceivedAt, latestDeliveredAt, workers };
  };

  // عرض سجل واحد
  const renderEntry = ({ item }: { item: WorkerEntry }) => (
    <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.border }}>
      {/* {isAr ? "اسم العامل" : "Worker Name"} والأزرار */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        {isAdmin && (
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
        <View style={{ alignItems: "flex-end" }}>
          <Text style={{ color: colors.muted, fontSize: 13 }}>{item.date}</Text>
          {item.receivedAt && <Text style={{ color: "#dc2626", fontSize: 11, marginTop: 3 }}>{isAr ? `وقت الاستلام: ${new Date(item.receivedAt).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}` : `Received: ${new Date(item.receivedAt).toLocaleTimeString()}`}</Text>}
          {item.deliveredAt && <Text style={{ color: "#16a34a", fontSize: 11, marginTop: 3 }}>{isAr ? `وقت التسليم: ${new Date(item.deliveredAt).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}` : `Delivered: ${new Date(item.deliveredAt).toLocaleTimeString()}`}</Text>}
        </View>
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
              borderLeftWidth: product.movementStatus === "received" || product.movementStatus === "delivered" ? 4 : 0,
              borderLeftColor: product.movementStatus === "received" ? "#dc2626" : "#16a34a",
              paddingLeft: product.movementStatus === "received" || product.movementStatus === "delivered" ? 8 : 0,
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
              <View style={{ marginTop: 8, backgroundColor: product.movementStatus === "received" ? "#fef2f2" : product.movementStatus === "delivered" ? "#f0fdf4" : "#fffbeb", borderRadius: 6, paddingVertical: 6, alignItems: "center" }}>
                <Text style={{ color: product.movementStatus === "received" ? "#dc2626" : product.movementStatus === "delivered" ? "#16a34a" : "#b45309", fontWeight: "800", fontSize: 12 }}>
                  {product.movementStatus === "received" ? (isAr ? "مستلم" : "Received") : product.movementStatus === "delivered" ? (isAr ? "مسلّم" : "Delivered") : (isAr ? "بانتظار التسليم أو الاستلام" : "Pending delivery or receipt")}
                </Text>
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
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {!isViewOnly && (
            <TouchableOpacity
              onPress={() => { resetForm(); setShowForm(true); }}
              style={{ backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 20, padding: 8 }}
              accessibilityLabel={isAr ? "إضافة بيانات" : "Add data"}
            >
              <MaterialIcons name="add" size={24} color="white" />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => setShowStageReport((value) => !value)}
            style={{ backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 20, padding: 8 }}
            accessibilityLabel={isAr ? "تقرير المرحلة" : "Stage report"}
          >
            <MaterialIcons name="assessment" size={22} color="white" />
          </TouchableOpacity>
          {isAdmin && <TouchableOpacity
            onPress={async () => { const next = !showTrash; setShowTrash(next); if (next) await loadTrash(); }}
            style={{ backgroundColor: showTrash ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.2)", borderRadius: 20, padding: 8 }}
            accessibilityLabel={isAr ? "سلة المهملات" : "Trash"}
          >
            <MaterialIcons name="delete-sweep" size={22} color="white" />
          </TouchableOpacity>}
        </View>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={{ color: '#ffffff', fontWeight: 'bold', fontSize: 20 }}>{config.name}</Text>
          <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14, marginTop: 4 }}>
            {entries.length > 0 ? (isAr ? `${entries.length} سجل` : `${entries.length} records`) : (isAr ? "لا توجد سجلات" : "No records")}
          </Text>
        </View>
        <BackButton onPress={showForm ? () => { resetForm(); setShowForm(false); } : undefined} />
      </View>

      <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingTop: 10, backgroundColor: colors.background }}>
        <TouchableOpacity
          onPress={() => router.push({ pathname: "/product-tracking", params: { stage, action: "deliver" } } as any)}
          style={{ flex: 1, backgroundColor: "#fff7ed", borderWidth: 1, borderColor: "#d97706", borderRadius: 10, paddingVertical: 9, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 5 }}
          accessibilityLabel={isAr ? `توقيع تسليم مرحلة ${config.name}` : `Sign delivery for ${config.name}`}
        >
          <MaterialIcons name="logout" size={18} color="#b45309" />
          <Text style={{ color: "#92400e", fontSize: 11, fontWeight: "800" }}>{isAr ? "توقيع التسليم" : "Sign delivery"}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.push({ pathname: "/product-tracking", params: { stage, action: "receive" } } as any)}
          style={{ flex: 1, backgroundColor: "#f0fdf4", borderWidth: 1, borderColor: "#16a34a", borderRadius: 10, paddingVertical: 9, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 5 }}
          accessibilityLabel={isAr ? `توقيع استلام مرحلة ${config.name}` : `Sign receipt for ${config.name}`}
        >
          <MaterialIcons name="login" size={18} color="#15803d" />
          <Text style={{ color: "#166534", fontSize: 11, fontWeight: "800" }}>{isAr ? "توقيع الاستلام" : "Sign receipt"}</Text>
        </TouchableOpacity>
            </View>
      {showTrash && isAdmin && <View style={{ margin: 12, padding: 12, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: "#f59e0b" }}><Text style={{ color: "#b45309", fontWeight: "800", textAlign: isAr ? "right" : "left" }}>{isAr ? "سلة مهملات مراحل التسليم — الاسترجاع متاح خلال 30 يوماً" : "Stage trash — restore available for 30 days"}</Text>{trashEntries.length === 0 ? <Text style={{ color: colors.muted, textAlign: isAr ? "right" : "left", marginTop: 8 }}>{isAr ? "لا توجد سجلات محذوفة" : "No deleted records"}</Text> : trashEntries.map((entry: any) => <View key={String(entry.id)} style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}><TouchableOpacity onPress={() => handleRestore(entry)} style={{ backgroundColor: "#16a34a", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 }}><Text style={{ color: "#fff", fontWeight: "800", fontSize: 11 }}>{isAr ? "استرجاع" : "Restore"}</Text></TouchableOpacity><Text style={{ color: colors.foreground, flex: 1, textAlign: "right", marginRight: 8, fontSize: 11 }}>{[entry.productName, entry.workerName, entry.date].filter(Boolean).join(" | ")}</Text></View>)}</View>}
      {showStageReport && (() => {
        const report = getStageReport();
        const reportWorkers = Array.from(new Set([...(stageWorkers || []), ...entries.map((entry) => entry.workerName).filter(Boolean)]));
        const periodButton = (period: "daily" | "weekly" | "monthly", labelAr: string, labelEn: string) => (
          <TouchableOpacity
            key={period}
            onPress={() => setReportPeriod(period)}
            style={{ flex: 1, backgroundColor: reportPeriod === period ? config.color : colors.background, borderWidth: 1, borderColor: config.color, borderRadius: 8, paddingVertical: 9, alignItems: "center" }}
          >
            <Text style={{ color: reportPeriod === period ? "white" : config.color, fontSize: 12, fontWeight: "800" }}>{isAr ? labelAr : labelEn}</Text>
          </TouchableOpacity>
        );
        return (
          <View style={{ marginHorizontal: 16, marginTop: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: config.color, borderRadius: 12, padding: 12 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <Text style={{ color: config.color, fontWeight: "800", fontSize: 15, textAlign: isAr ? "right" : "left" }}>{isAr ? `تقرير ${config.name}` : `${config.name} Report`}</Text>
              <MaterialIcons name="assessment" size={20} color={config.color} />
            </View>
            <View style={{ flexDirection: "row", gap: 6, marginBottom: 8 }}>
              {periodButton("daily", "يومي", "Daily")}
              {periodButton("weekly", "أسبوعي", "Weekly")}
              {periodButton("monthly", "شهري", "Monthly")}
            </View>
            <Text style={{ color: colors.muted, fontSize: 11, marginBottom: 4, textAlign: isAr ? "right" : "left" }}>{isAr ? "التاريخ المرجعي" : "Reference date"}</Text>
            <TextInput
              value={reportDate}
              onChangeText={setReportDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.muted}
              style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, color: colors.foreground, textAlign: isAr ? "right" : "left", marginBottom: 8 }}
            />
            {user?.role === "admin" && reportWorkers.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }} contentContainerStyle={{ flexDirection: isAr ? "row-reverse" : "row", gap: 6 }}>
                <TouchableOpacity onPress={() => setReportWorker("all")} style={{ backgroundColor: reportWorker === "all" ? config.color : colors.background, borderWidth: 1, borderColor: config.color, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6 }}>
                  <Text style={{ color: reportWorker === "all" ? "white" : config.color, fontSize: 11, fontWeight: "700" }}>{isAr ? "كل العمال" : "All workers"}</Text>
                </TouchableOpacity>
                {reportWorkers.map((worker) => (
                  <TouchableOpacity key={worker} onPress={() => setReportWorker(worker)} style={{ backgroundColor: reportWorker === worker ? config.color : colors.background, borderWidth: 1, borderColor: config.color, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6 }}>
                    <Text style={{ color: reportWorker === worker ? "white" : config.color, fontSize: 11, fontWeight: "700" }}>{worker}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            <View style={{ flexDirection: "row", gap: 6 }}>
              {[
                [isAr ? "السجلات" : "Records", String(report.selectedEntries.length)],
                [isAr ? "المنتجات" : "Products", String(report.productsCount)],
                [isAr ? "الدرزن" : "Dozen", String(report.totalDozen)],
                [isAr ? "الأزواج" : "Pairs", String(report.totalPairs)],
                [isAr ? "المستلم" : "Received", String(report.receivedCount)],
                [isAr ? "المسلّم" : "Delivered", String(report.deliveredCount)],
              ].map(([label, value]) => (
                <View key={label} style={{ flex: 1, backgroundColor: colors.background, borderRadius: 8, paddingVertical: 8, alignItems: "center" }}>
                  <Text style={{ color: colors.muted, fontSize: 10 }}>{label}</Text>
                  <Text style={{ color: config.color, fontWeight: "800", fontSize: 16 }}>{value}</Text>
                </View>
              ))}
            </View>
            <Text style={{ color: colors.muted, fontSize: 10, marginTop: 8, textAlign: isAr ? "right" : "left" }}>
              {isAr ? `الفترة: ${report.window.start} إلى ${report.window.end} — المرحلة: ${config.name}` : `Period: ${report.window.start} to ${report.window.end} — Stage: ${config.name}`}
            </Text>
            <View style={{ marginTop: 8, gap: 4 }}>
              <Text style={{ color: "#dc2626", fontSize: 11, textAlign: isAr ? "right" : "left" }}>{isAr ? `آخر وقت استلام: ${report.latestReceivedAt ? new Date(report.latestReceivedAt).toLocaleString("ar-SA") : "غير مسجل"}` : `Latest receipt: ${report.latestReceivedAt ? new Date(report.latestReceivedAt).toLocaleString() : "Not recorded"}`}</Text>
              <Text style={{ color: "#16a34a", fontSize: 11, textAlign: isAr ? "right" : "left" }}>{isAr ? `آخر وقت تسليم: ${report.latestDeliveredAt ? new Date(report.latestDeliveredAt).toLocaleString("ar-SA") : "غير مسجل"}` : `Latest delivery: ${report.latestDeliveredAt ? new Date(report.latestDeliveredAt).toLocaleString() : "Not recorded"}`}</Text>
            </View>
          </View>
        );
      })()}

      {/* نموذج الإدخال */}
      {showForm ? (
        <ScrollView style={{ flex: 1, paddingHorizontal: 16, paddingVertical: 16 }}>
          <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 20, borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ color: colors.foreground, fontWeight: 'bold', fontSize: 18, marginBottom: 20, textAlign: isAr ? "right" : "left" }}>
              {editingEntry ? (isAr ? "✏️ تعديل بيانات" : "✏️ Edit Data") : (isAr ? "➕ إدخال بيانات جديدة" : "➕ Enter New Data")}
            </Text>

            {/* اسم العامل - يظهر تلقائياً من حساب المستخدم */}
            <View style={{ marginBottom: 20 }}>
              <Text style={{ color: colors.foreground, fontWeight: '600', fontSize: 14, marginBottom: 12, textAlign: isAr ? "right" : "left" }}>
                {isAr ? "اسم العامل" : "Worker Name"}
              </Text>
              <View style={{ backgroundColor: `${config.color}15`, borderColor: config.color, borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 14, alignItems: 'center' }}>
                <Text style={{ color: config.color, fontWeight: "700", fontSize: 16 }}>
                  {user?.name || (isAr ? "غير معروف" : "Unknown")}
                </Text>
              </View>
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
                      {isAr ? `المنتجات (${products.length}/10)` : `Products (${products.length}/10)`}
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

                      {/* بحث احترافي عن المنتج من دليل المنتجات المحفوظة */}
                      <View style={{ marginBottom: 10 }}>
                        <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 6, textAlign: isAr ? "right" : "left" }}>{isAr ? "ابحث عن المنتج المحفوظ *" : "Search saved product *"}</Text>
                        <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#ffffff", borderWidth: 1.5, borderColor: product.productName ? config.color : colors.border, borderRadius: 10, paddingHorizontal: 10 }}>
                          <MaterialIcons name="search" size={20} color={config.color} />
                          <TextInput
                            value={productSearch[index] ?? (product.productName || "")}
                            onChangeText={(value) => { setProductSearch((current) => ({ ...current, [index]: value })); if (!value.trim()) updateProduct(index, "productName", ""); }}
                            placeholder={productsLoading ? (isAr ? "جاري تحميل المنتجات..." : "Loading products...") : (isAr ? "اكتب الاسم أو المقاس أو اللون أو الباركود" : "Search by name, size, color or barcode")}
                            placeholderTextColor="#6b7280"
                            style={{ flex: 1, color: "#111827", backgroundColor: "#ffffff", paddingHorizontal: 8, paddingVertical: 11, textAlign: isAr ? "right" : "left", fontSize: 13 }}
                          />
                          {product.productName && <MaterialIcons name="check-circle" size={19} color="#16a34a" />}
                        </View>
                        {savedProducts.length > 0 && (productSearch[index] || !product.productName) && (
                          <View style={{ marginTop: 6, backgroundColor: "#ffffff", borderWidth: 1, borderColor: colors.border, borderRadius: 10, overflow: "hidden" }}>
                            {getFilteredSavedProducts(index).map((savedProduct: any, resultIndex: number) => {
                              const label = getSavedProductLabel(savedProduct);
                              if (!label) return null;
                              const selected = product.productName === label;
                              return (
                                <TouchableOpacity key={String(savedProduct.id ?? savedProduct.barcode ?? label)} onPress={() => selectSavedProduct(index, savedProduct)} style={{ paddingHorizontal: 11, paddingVertical: 10, borderBottomWidth: resultIndex < getFilteredSavedProducts(index).length - 1 ? 1 : 0, borderColor: "#e5e7eb", backgroundColor: selected ? `${config.color}12` : "#ffffff" }}>
                                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                                    <MaterialIcons name={selected ? "check-circle" : "inventory-2"} size={18} color={selected ? "#16a34a" : config.color} />
                                    <View style={{ flex: 1, marginLeft: 8, alignItems: "flex-end" }}>
                                      <Text style={{ color: "#111827", fontSize: 13, fontWeight: "800" }}>{label}</Text>
                                      <Text style={{ color: "#6b7280", fontSize: 10, marginTop: 3 }}>{savedProduct.barcode ? `S${savedProduct.barcode}` : (isAr ? "منتج محفوظ" : "Saved product")}</Text>
                                    </View>
                                  </View>
                                </TouchableOpacity>
                              );
                            })}
                            {getFilteredSavedProducts(index).length === 0 && <Text style={{ color: "#b45309", padding: 12, textAlign: "center", fontSize: 12 }}>{isAr ? "لا توجد نتيجة مطابقة" : "No matching product"}</Text>}
                          </View>
                        )}
                        {product.productName && <Text style={{ color: "#16a34a", fontSize: 11, marginTop: 5, textAlign: isAr ? "right" : "left" }}>{isAr ? "تم اختيار منتج محفوظ من الدليل" : "Saved catalog product selected"}</Text>}
                      </View>

                      {/* حالة التسليم والاستلام */}
                      <View style={{ marginBottom: 10 }}>
                        <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 6, textAlign: isAr ? "right" : "left" }}>{isAr ? "حالة المنتج" : "Product status"}</Text>
                        <View style={{ flexDirection: "row", gap: 8 }}>
                          <TouchableOpacity onPress={() => updateProduct(index, "movementStatus", "received")} style={{ flex: 1, backgroundColor: product.movementStatus === "received" ? "#dc2626" : "#fef2f2", borderColor: "#dc2626", borderWidth: 1, borderRadius: 8, paddingVertical: 9, alignItems: "center" }}>
                            <Text style={{ color: product.movementStatus === "received" ? "#ffffff" : "#dc2626", fontWeight: "800", fontSize: 12 }}>{isAr ? "استلمت" : "Received"}</Text>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => updateProduct(index, "movementStatus", "delivered")} style={{ flex: 1, backgroundColor: product.movementStatus === "delivered" ? "#16a34a" : "#f0fdf4", borderColor: "#16a34a", borderWidth: 1, borderRadius: 8, paddingVertical: 9, alignItems: "center" }}>
                            <Text style={{ color: product.movementStatus === "delivered" ? "#ffffff" : "#16a34a", fontWeight: "800", fontSize: 12 }}>{isAr ? "سلّمت" : "Delivered"}</Text>
                          </TouchableOpacity>
                        </View>
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

            {/* وقتا الاستلام والتسليم */}
            <View style={{ marginBottom: 20, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12 }}>
              <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 14, marginBottom: 8, textAlign: isAr ? "right" : "left" }}>{isAr ? "وقت الاستلام والتسليم" : "Receipt and delivery time"}</Text>
              <Text style={{ color: colors.muted, fontSize: 12, textAlign: isAr ? "right" : "left", lineHeight: 20 }}>{isAr ? "يسجل النظام وقت العملية تلقائياً عند اختيار «استلمت» أو «سلّمت» لكل منتج، ويعرضه في سجل المرحلة والتقارير." : "The system records the action time automatically when Received or Delivered is selected for each product and shows it in stage records and reports."}</Text>
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
                <Text style={{ color: colors.foreground, fontWeight: '600', fontSize: 16 }}>{isAr ? "إلغاء" : "Cancel"}</Text>
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
                  {isAr ? "مسجل الدخول باسم:" : "Logged in as:"}
                </Text>
                <View style={{ backgroundColor: `${config.color}15`, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8, alignSelf: 'flex-end' }}>
                  <Text style={{ color: config.color, fontWeight: "700", fontSize: 15 }}>{user?.name || ""}</Text>
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
