import { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
  FlatList,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { BackButton } from "@/components/back-button";
import { useColors } from "@/hooks/use-colors";
import { useLanguage } from "@/lib/language-context";
import { MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

// جميع مفاتيح التخزين المستخدمة في التطبيق
const ALL_STORAGE_KEYS: { key: string; labelAr: string; labelEn: string; icon: string; color: string }[] = [
  { key: "sultan_production_entries", labelAr: "بيانات الإنتاج", labelEn: "Production Data", icon: "factory", color: "#3b82f6" },
  { key: "sultan_manufacturing_machines", labelAr: "مراحل التسليم - المكائن", labelEn: "Manufacturing - Machines", icon: "precision-manufacturing", color: "#8b5cf6" },
  { key: "sultan_manufacturing_rosso", labelAr: "مراحل التسليم - الروسو", labelEn: "Manufacturing - Rosso", icon: "loop", color: "#7c3aed" },
  { key: "sultan_manufacturing_qalb", labelAr: "مراحل التسليم - القلب", labelEn: "Manufacturing - Turning", icon: "flip", color: "#059669" },
  { key: "sultan_manufacturing_kawiya", labelAr: "مراحل التسليم - الكاوية", labelEn: "Manufacturing - Ironing", icon: "local-fire-department", color: "#dc2626" },
  { key: "sultan_manufacturing_inspection", labelAr: "مراحل التسليم - الفحص", labelEn: "Manufacturing - Inspection", icon: "search", color: "#d97706" },
  { key: "sultan_manufacturing_packing", labelAr: "مراحل التسليم - التغليف", labelEn: "Manufacturing - Packing", icon: "inventory-2", color: "#2563eb" },
  { key: "sultan_manufacturing_antislip", labelAr: "مراحل التسليم - مانع الانزلاق", labelEn: "Manufacturing - Antislip", icon: "layers", color: "#0891b2" },
  { key: "sultan_manufacturing_storage", labelAr: "مراحل التسليم - التخزين", labelEn: "Manufacturing - Storage", icon: "warehouse", color: "#4f46e5" },
  { key: "sultan_sales_entries", labelAr: "بيانات المبيعات", labelEn: "Sales Data", icon: "shopping-cart", color: "#ec4899" },
  { key: "sultan_collection_entries", labelAr: "بيانات التحصيل", labelEn: "Collection Data", icon: "payments", color: "#14b8a6" },
  { key: "sultan_financial_entries", labelAr: "بيانات المصروفات", labelEn: "Financial Data", icon: "account-balance-wallet", color: "#6366f1" },
  { key: "sultan_administrative_entries", labelAr: "الإجراءات الإدارية", labelEn: "Administrative Data", icon: "assignment", color: "#06b6d4" },
  { key: "sultan_maintenance_entries", labelAr: "بيانات الصيانة", labelEn: "Maintenance Data", icon: "build", color: "#ef4444" },
  { key: "sultan_warehouse_raw", labelAr: "المستودعات - مواد خام", labelEn: "Warehouse - Raw", icon: "warehouse", color: "#f59e0b" },
  { key: "sultan_warehouse_finished", labelAr: "المستودعات - منتج تام", labelEn: "Warehouse - Finished", icon: "inventory", color: "#22c55e" },
  { key: "sultan_warehouse_out", labelAr: "المستودعات - صادر", labelEn: "Warehouse - Out", icon: "local-shipping", color: "#0ea5e9" },
  { key: "sultan_tasks_entries", labelAr: "المهام", labelEn: "Tasks", icon: "checklist", color: "#14b8a6" },
];

type SettingsSection = "main" | "data-management" | "view-data" | "edit-record" | "app-config";

interface DataRecord {
  id: string;
  [key: string]: any;
}

export default function AdminSettingsScreen() {
  const router = useRouter();
  const colors = useColors();
  const { language } = useLanguage();
  const isAr = language === "ar";

  const [section, setSection] = useState<SettingsSection>("main");
  const [selectedKey, setSelectedKey] = useState<string>("");
  const [selectedKeyLabel, setSelectedKeyLabel] = useState<string>("");
  const [records, setRecords] = useState<DataRecord[]>([]);
  const [editingRecord, setEditingRecord] = useState<DataRecord | null>(null);
  const [editFields, setEditFields] = useState<Record<string, string>>({});
  const [dataCounts, setDataCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    loadDataCounts();
  }, []);

  const loadDataCounts = async () => {
    const counts: Record<string, number> = {};
    for (const item of ALL_STORAGE_KEYS) {
      try {
        const data = await AsyncStorage.getItem(item.key);
        if (data) {
          const parsed = JSON.parse(data);
          counts[item.key] = Array.isArray(parsed) ? parsed.length : 1;
        } else {
          counts[item.key] = 0;
        }
      } catch {
        counts[item.key] = 0;
      }
    }
    setDataCounts(counts);
  };

  const loadRecords = async (key: string) => {
    try {
      const data = await AsyncStorage.getItem(key);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) {
          setRecords(parsed);
        } else {
          setRecords([parsed]);
        }
      } else {
        setRecords([]);
      }
    } catch {
      setRecords([]);
    }
  };

  const handleViewData = async (key: string, label: string) => {
    setSelectedKey(key);
    setSelectedKeyLabel(label);
    await loadRecords(key);
    setSection("view-data");
  };

  const handleDeleteRecord = (record: DataRecord) => {
    const msg = isAr ? `هل أنت متأكد من حذف هذا السجل؟` : "Are you sure you want to delete this record?";
    if (Platform.OS === "web") {
      if (window.confirm(msg)) {
        deleteRecord(record);
      }
    } else {
      Alert.alert(
        isAr ? "تأكيد الحذف" : "Confirm Delete",
        msg,
        [
          { text: isAr ? "إلغاء" : "Cancel", style: "cancel" },
          { text: isAr ? "حذف" : "Delete", style: "destructive", onPress: () => deleteRecord(record) },
        ]
      );
    }
  };

  const deleteRecord = async (record: DataRecord) => {
    const newRecords = records.filter((r) => r.id !== record.id);
    await AsyncStorage.setItem(selectedKey, JSON.stringify(newRecords));
    setRecords(newRecords);
    setDataCounts((prev) => ({ ...prev, [selectedKey]: newRecords.length }));
  };

  const handleDeleteAllData = (key: string, label: string) => {
    const msg = isAr
      ? `هل أنت متأكد من حذف جميع بيانات "${label}"؟ لا يمكن التراجع عن هذا الإجراء.`
      : `Are you sure you want to delete all "${label}" data? This cannot be undone.`;
    if (Platform.OS === "web") {
      if (window.confirm(msg)) {
        clearData(key);
      }
    } else {
      Alert.alert(
        isAr ? "تأكيد الحذف" : "Confirm Delete",
        msg,
        [
          { text: isAr ? "إلغاء" : "Cancel", style: "cancel" },
          { text: isAr ? "حذف الكل" : "Delete All", style: "destructive", onPress: () => clearData(key) },
        ]
      );
    }
  };

  const clearData = async (key: string) => {
    await AsyncStorage.removeItem(key);
    setDataCounts((prev) => ({ ...prev, [key]: 0 }));
    if (selectedKey === key) {
      setRecords([]);
    }
  };

  const handleEditRecord = (record: DataRecord) => {
    setEditingRecord(record);
    const fields: Record<string, string> = {};
    Object.entries(record).forEach(([k, v]) => {
      if (k !== "id") {
        fields[k] = typeof v === "object" ? JSON.stringify(v) : String(v ?? "");
      }
    });
    setEditFields(fields);
    setSection("edit-record");
  };

  const handleSaveEdit = async () => {
    if (!editingRecord) return;
    const updatedRecord: DataRecord = { id: editingRecord.id };
    Object.entries(editFields).forEach(([k, v]) => {
      // Try to parse JSON for objects/arrays
      try {
        const parsed = JSON.parse(v);
        if (typeof parsed === "object") {
          updatedRecord[k] = parsed;
        } else {
          updatedRecord[k] = v;
        }
      } catch {
        updatedRecord[k] = v;
      }
    });

    const newRecords = records.map((r) => (r.id === editingRecord.id ? updatedRecord : r));
    await AsyncStorage.setItem(selectedKey, JSON.stringify(newRecords));
    setRecords(newRecords);
    setEditingRecord(null);
    setSection("view-data");
  };

  const getFieldLabel = (key: string): string => {
    const labels: Record<string, string> = {
      workerName: isAr ? "اسم العامل" : "Worker Name",
      productionDozen: isAr ? "الإنتاج (درزن)" : "Production (Dozen)",
      productionPairs: isAr ? "الإنتاج (زوج)" : "Production (Pairs)",
      durationHours: isAr ? "المدة (ساعة)" : "Duration (Hours)",
      durationMinutes: isAr ? "المدة (دقيقة)" : "Duration (Minutes)",
      date: isAr ? "التاريخ" : "Date",
      notes: isAr ? "ملاحظات" : "Notes",
      machineNumber: isAr ? "رقم المكينة" : "Machine Number",
      quantity: isAr ? "الكمية" : "Quantity",
      waste: isAr ? "الهدر" : "Waste",
      secondGrade: isAr ? "النخب الثاني" : "Second Grade",
      title: isAr ? "العنوان" : "Title",
      description: isAr ? "الوصف" : "Description",
      status: isAr ? "الحالة" : "Status",
      amount: isAr ? "المبلغ" : "Amount",
      clientName: isAr ? "اسم العميل" : "Client Name",
      assignedTo: isAr ? "مكلف إلى" : "Assigned To",
      priority: isAr ? "الأولوية" : "Priority",
      finishedDozen: isAr ? "الإنتاج التام (درزن)" : "Finished (Dozen)",
      finishedPairs: isAr ? "الإنتاج التام (زوج)" : "Finished (Pairs)",
      secondGradeDozen: isAr ? "النخب الثاني (درزن)" : "2nd Grade (Dozen)",
      secondGradePairs: isAr ? "النخب الثاني (زوج)" : "2nd Grade (Pairs)",
      antislipDozen: isAr ? "مانع الانزلاق (درزن)" : "Antislip (Dozen)",
      antislipPairs: isAr ? "مانع الانزلاق (زوج)" : "Antislip (Pairs)",
    };
    return labels[key] || key;
  };

  // Main menu
  const renderMainMenu = () => (
    <ScrollView style={{ flex: 1, paddingHorizontal: 16, paddingVertical: 16 }}>
      {/* إدارة البيانات */}
      <TouchableOpacity
        onPress={() => setSection("data-management")}
        style={{ backgroundColor: "#3b82f615", borderColor: "#3b82f6", borderWidth: 1, borderRadius: 16, padding: 20, marginBottom: 16 }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.foreground, fontWeight: 'bold', fontSize: 16, textAlign: 'right' }}>
              {isAr ? "إدارة البيانات" : "Data Management"}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12, textAlign: 'right', marginTop: 4 }}>
              {isAr ? "عرض وتعديل وحذف جميع بيانات الأقسام" : "View, edit and delete all section data"}
            </Text>
          </View>
          <View style={{ backgroundColor: "#3b82f620", borderRadius: 12, padding: 12 }}>
            <MaterialIcons name="storage" size={28} color="#3b82f6" />
          </View>
        </View>
      </TouchableOpacity>

      {/* إدارة المستخدمين */}
      <TouchableOpacity
        onPress={() => router.push("/users-management" as any)}
        style={{ backgroundColor: "#7c3aed15", borderColor: "#7c3aed", borderWidth: 1, borderRadius: 16, padding: 20, marginBottom: 16 }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.foreground, fontWeight: 'bold', fontSize: 16, textAlign: 'right' }}>
              {isAr ? "إدارة المستخدمين" : "User Management"}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12, textAlign: 'right', marginTop: 4 }}>
              {isAr ? "إضافة وتعديل وحذف المستخدمين والصلاحيات" : "Add, edit and delete users and permissions"}
            </Text>
          </View>
          <View style={{ backgroundColor: "#7c3aed20", borderRadius: 12, padding: 12 }}>
            <MaterialIcons name="people" size={28} color="#7c3aed" />
          </View>
        </View>
      </TouchableOpacity>

      {/* النسخ الاحتياطي */}
      <TouchableOpacity
        onPress={() => router.push("/backup-restore" as any)}
        style={{ backgroundColor: "#6366f115", borderColor: "#6366f1", borderWidth: 1, borderRadius: 16, padding: 20, marginBottom: 16 }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.foreground, fontWeight: 'bold', fontSize: 16, textAlign: 'right' }}>
              {isAr ? "النسخ الاحتياطي والاستعادة" : "Backup & Restore"}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12, textAlign: 'right', marginTop: 4 }}>
              {isAr ? "نسخ احتياطي واستعادة جميع البيانات" : "Backup and restore all data"}
            </Text>
          </View>
          <View style={{ backgroundColor: "#6366f120", borderRadius: 12, padding: 12 }}>
            <MaterialIcons name="backup" size={28} color="#6366f1" />
          </View>
        </View>
      </TouchableOpacity>

      {/* إعدادات التطبيق */}
      <TouchableOpacity
        onPress={() => router.push("/settings" as any)}
        style={{ backgroundColor: "#05966915", borderColor: "#059669", borderWidth: 1, borderRadius: 16, padding: 20, marginBottom: 16 }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.foreground, fontWeight: 'bold', fontSize: 16, textAlign: 'right' }}>
              {isAr ? "إعدادات التطبيق" : "App Settings"}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12, textAlign: 'right', marginTop: 4 }}>
              {isAr ? "اللغة والمظهر والإشعارات" : "Language, appearance and notifications"}
            </Text>
          </View>
          <View style={{ backgroundColor: "#05966920", borderRadius: 12, padding: 12 }}>
            <MaterialIcons name="settings" size={28} color="#059669" />
          </View>
        </View>
      </TouchableOpacity>

      {/* سجل النشاط */}
      <TouchableOpacity
        onPress={() => router.push("/activity-log" as any)}
        style={{ backgroundColor: "#0891b215", borderColor: "#0891b2", borderWidth: 1, borderRadius: 16, padding: 20, marginBottom: 16 }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.foreground, fontWeight: 'bold', fontSize: 16, textAlign: 'right' }}>
              {isAr ? "سجل النشاط" : "Activity Log"}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12, textAlign: 'right', marginTop: 4 }}>
              {isAr ? "عرض جميع العمليات والتغييرات" : "View all operations and changes"}
            </Text>
          </View>
          <View style={{ backgroundColor: "#0891b220", borderRadius: 12, padding: 12 }}>
            <MaterialIcons name="history" size={28} color="#0891b2" />
          </View>
        </View>
      </TouchableOpacity>

      {/* حذف جميع البيانات */}
      <TouchableOpacity
        onPress={() => {
          const msg = isAr
            ? "هل أنت متأكد من حذف جميع بيانات التطبيق؟ لا يمكن التراجع عن هذا الإجراء."
            : "Are you sure you want to delete ALL app data? This cannot be undone.";
          if (Platform.OS === "web") {
            if (window.confirm(msg)) {
              handleClearAllData();
            }
          } else {
            Alert.alert(isAr ? "تحذير" : "Warning", msg, [
              { text: isAr ? "إلغاء" : "Cancel", style: "cancel" },
              { text: isAr ? "حذف الكل" : "Delete All", style: "destructive", onPress: handleClearAllData },
            ]);
          }
        }}
        style={{ backgroundColor: "#ef444415", borderColor: "#ef4444", borderWidth: 1, borderRadius: 16, padding: 20, marginBottom: 16 }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: "#ef4444", fontWeight: 'bold', fontSize: 16, textAlign: 'right' }}>
              {isAr ? "حذف جميع البيانات" : "Delete All Data"}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12, textAlign: 'right', marginTop: 4 }}>
              {isAr ? "حذف جميع بيانات التطبيق نهائياً" : "Permanently delete all app data"}
            </Text>
          </View>
          <View style={{ backgroundColor: "#ef444420", borderRadius: 12, padding: 12 }}>
            <MaterialIcons name="delete-forever" size={28} color="#ef4444" />
          </View>
        </View>
      </TouchableOpacity>
    </ScrollView>
  );

  const handleClearAllData = async () => {
    for (const item of ALL_STORAGE_KEYS) {
      await AsyncStorage.removeItem(item.key);
    }
    setDataCounts({});
    setRecords([]);
  };

  // Data management section
  const renderDataManagement = () => (
    <ScrollView style={{ flex: 1, paddingHorizontal: 16, paddingVertical: 16 }}>
      <Text style={{ color: colors.foreground, fontWeight: 'bold', fontSize: 18, marginBottom: 16, textAlign: 'right' }}>
        {isAr ? "إدارة بيانات الأقسام" : "Section Data Management"}
      </Text>
      {ALL_STORAGE_KEYS.map((item) => (
        <View
          key={item.key}
          style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.border }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            {/* Actions */}
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TouchableOpacity
                onPress={() => handleViewData(item.key, isAr ? item.labelAr : item.labelEn)}
                style={{ backgroundColor: `${item.color}15`, borderRadius: 8, padding: 8 }}
              >
                <MaterialIcons name="visibility" size={18} color={item.color} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleDeleteAllData(item.key, isAr ? item.labelAr : item.labelEn)}
                style={{ backgroundColor: "#ef444415", borderRadius: 8, padding: 8 }}
              >
                <MaterialIcons name="delete" size={18} color="#ef4444" />
              </TouchableOpacity>
            </View>

            {/* Label */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1, justifyContent: "flex-end" }}>
              <View>
                <Text style={{ color: colors.foreground, fontWeight: '600', fontSize: 14, textAlign: 'right' }}>
                  {isAr ? item.labelAr : item.labelEn}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 12, textAlign: 'right' }}>
                  {dataCounts[item.key] || 0} {isAr ? "سجل" : "records"}
                </Text>
              </View>
              <View style={{ backgroundColor: `${item.color}20`, borderRadius: 10, padding: 8 }}>
                <MaterialIcons name={item.icon as any} size={20} color={item.color} />
              </View>
            </View>
          </View>
        </View>
      ))}
    </ScrollView>
  );

  // View data records
  const renderViewData = () => (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <TouchableOpacity onPress={() => setSection("data-management")}>
          <MaterialIcons name="arrow-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={{ color: colors.foreground, fontWeight: 'bold', fontSize: 16 }}>{selectedKeyLabel}</Text>
        <Text style={{ color: colors.muted, fontSize: 14 }}>{records.length} {isAr ? "سجل" : "records"}</Text>
      </View>
      {records.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80 }}>
          <MaterialIcons name="inbox" size={48} color={colors.muted} />
          <Text style={{ color: colors.muted, fontSize: 16, marginTop: 16 }}>
            {isAr ? "لا توجد بيانات" : "No data"}
          </Text>
        </View>
      ) : (
        <FlatList
          data={records}
          keyExtractor={(item, index) => item.id || String(index)}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => (
            <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.border }}>
              {/* Record fields */}
              {Object.entries(item)
                .filter(([k]) => k !== "id")
                .slice(0, 6)
                .map(([key, value]) => (
                  <View key={key} style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                    <Text style={{ color: colors.foreground, fontSize: 12, flex: 1 }}>
                      {typeof value === "object" ? JSON.stringify(value).slice(0, 30) : String(value ?? "").slice(0, 40)}
                    </Text>
                    <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '600', marginLeft: 8 }}>
                      {getFieldLabel(key)}
                    </Text>
                  </View>
                ))}
              {Object.keys(item).length > 7 && (
                <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
                  +{Object.keys(item).length - 7} {isAr ? "حقول أخرى" : "more fields"}
                </Text>
              )}
              {/* Actions */}
              <View style={{ flexDirection: "row", gap: 8, marginTop: 8, justifyContent: "flex-start" }}>
                <TouchableOpacity
                  onPress={() => handleEditRecord(item)}
                  style={{ backgroundColor: "#3b82f615", borderRadius: 8, padding: 6, flexDirection: "row", alignItems: "center", gap: 4 }}
                >
                  <Text style={{ color: "#3b82f6", fontSize: 11 }}>{isAr ? "تعديل" : "Edit"}</Text>
                  <MaterialIcons name="edit" size={14} color="#3b82f6" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleDeleteRecord(item)}
                  style={{ backgroundColor: "#ef444415", borderRadius: 8, padding: 6, flexDirection: "row", alignItems: "center", gap: 4 }}
                >
                  <Text style={{ color: "#ef4444", fontSize: 11 }}>{isAr ? "حذف" : "Delete"}</Text>
                  <MaterialIcons name="delete" size={14} color="#ef4444" />
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );

  // Edit record
  const renderEditRecord = () => (
    <ScrollView style={{ flex: 1, paddingHorizontal: 16, paddingVertical: 16 }}>
      <View style={{ paddingHorizontal: 0, paddingVertical: 12, marginBottom: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <TouchableOpacity onPress={() => setSection("view-data")}>
          <MaterialIcons name="arrow-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={{ color: colors.foreground, fontWeight: 'bold', fontSize: 16 }}>
          {isAr ? "تعديل السجل" : "Edit Record"}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      {Object.entries(editFields).map(([key, value]) => (
        <View key={key} style={{ marginBottom: 16 }}>
          <Text style={{ color: colors.foreground, fontWeight: '600', fontSize: 14, marginBottom: 8, textAlign: 'right' }}>
            {getFieldLabel(key)}
          </Text>
          <TextInput
            style={[{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12, color: colors.foreground, textAlign: 'right', fontSize: 16 }, value.length > 50 ? { minHeight: 80, textAlignVertical: "top" } : undefined]}
            value={value}
            onChangeText={(text) => setEditFields((prev) => ({ ...prev, [key]: text }))}
            multiline={value.length > 50}
          />
        </View>
      ))}

      <View style={{ flexDirection: "row", gap: 12, marginTop: 16 }}>
        <TouchableOpacity
          onPress={() => setSection("view-data")}
          style={{ flex: 1, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingVertical: 16, alignItems: 'center' }}
        >
          <Text style={{ color: colors.foreground, fontWeight: '600', fontSize: 16 }}>{isAr ? "إلغاء" : "Cancel"}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleSaveEdit}
          style={{ backgroundColor: "#3b82f6", flex: 1, borderRadius: 12, paddingVertical: 16, alignItems: 'center' }}
        >
          <Text style={{ color: '#ffffff', fontWeight: '600', fontSize: 16 }}>{isAr ? "حفظ التعديل" : "Save"}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const getHeaderTitle = () => {
    switch (section) {
      case "data-management": return isAr ? "إدارة البيانات" : "Data Management";
      case "view-data": return selectedKeyLabel;
      case "edit-record": return isAr ? "تعديل السجل" : "Edit Record";
      default: return isAr ? "إعدادات المدير" : "Admin Settings";
    }
  };

  return (
    <ScreenContainer style={{ backgroundColor: colors.background }}>
      {/* Header */}
      <View style={{ backgroundColor: "#f59e0b", paddingHorizontal: 24, paddingVertical: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        {section !== "main" && section !== "view-data" && section !== "edit-record" ? (
          <TouchableOpacity onPress={() => setSection("main")} style={{ padding: 4 }}>
            <MaterialIcons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
        ) : section === "main" ? (
          <View style={{ width: 32 }} />
        ) : (
          <View style={{ width: 32 }} />
        )}

        <Text style={{ color: '#ffffff', fontWeight: 'bold', fontSize: 20, flex: 1, textAlign: 'center' }}>
          {section === "main" ? (isAr ? "إعدادات المدير" : "Admin Settings") : ""}
        </Text>

        <BackButton />
      </View>

      {/* Content */}
      {section === "main" && renderMainMenu()}
      {section === "data-management" && renderDataManagement()}
      {section === "view-data" && renderViewData()}
      {section === "edit-record" && renderEditRecord()}
    </ScreenContainer>
  );
}
