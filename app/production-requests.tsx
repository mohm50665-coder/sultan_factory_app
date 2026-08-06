import { useState, useEffect } from "react";
import { useLanguage } from "@/lib/language-context";
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
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { MaterialIcons } from "@expo/vector-icons";
import { maintenanceEntriesService } from "@/lib/services/data.service";
import { useAuth } from "@/lib/auth-context";
import { AdminBadgeIcon } from "@/components/admin-badge-icon";
import { AdminCard } from "@/components/admin-card";
import { notificationsService } from "@/lib/services/notifications.service";

const SECTION_KEY = "production_requests";

interface ProductionRequestEntry {
  id: string;
  productName: string;
  quantity: string;
  unit: string;
  dateFrom: string;
  dateTo: string;
  requestedBy: string;
  status: string; // "pending" | "in_progress" | "completed"
  notes: string;
  date: string;
}

export default function ProductionRequestsScreen() {
  const colors = useColors();
  const { language } = useLanguage();
  const isAr = language === "ar";
  const { user } = useAuth();

  const [entries, setEntries] = useState<ProductionRequestEntry[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ProductionRequestEntry | null>(null);

  const [productName, setProductName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState<"dozen" | "pair">("dozen");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    loadEntries();
  }, []);

  const loadEntries = async () => {
    try {
      const data = await maintenanceEntriesService.getBySection(SECTION_KEY);
      if (data && data.length > 0) {
        setEntries(data.map((d: any) => ({
          id: String(d.id),
          ...d.data,
          date: d.date || d.createdAt ? new Date(d.date || d.createdAt).toLocaleDateString("ar-SA") : "",
        })));
      }
    } catch (e) {
      console.log("Error loading production requests:", e);
    }
  };

  const resetForm = () => {
    setProductName("");
    setQuantity("");
    setUnit("dozen");
    setDateFrom("");
    setDateTo("");
    setNotes("");
    setEditingEntry(null);
  };

  const handleSave = async () => {
    if (!productName.trim() || !quantity.trim()) {
      Alert.alert(isAr ? "تنبيه" : "Alert", isAr ? "يرجى إدخال اسم الصنف والكمية" : "Please enter product name and quantity");
      return;
    }

    const entryData = {
      productName,
      quantity,
      unit,
      dateFrom,
      dateTo,
      requestedBy: user?.name || "",
      status: "pending",
      notes,
    };

    try {
      if (editingEntry) {
        await maintenanceEntriesService.update(Number(editingEntry.id), entryData);
      } else {
        await maintenanceEntriesService.create(SECTION_KEY, entryData, user?.name, undefined, user?.id ? Number(user.id) : undefined);
        // إشعار لمدير الإنتاج
        await notificationsService.add({
          type: "production",
          title: isAr ? "طلب إنتاج جديد" : "New Production Request",
          message: isAr ? `طلب إنتاج: ${productName} - ${quantity} ${unit === "dozen" ? "درزن" : "زوج"}` : `Production request: ${productName} - ${quantity} ${unit === "dozen" ? "dozen" : "pairs"}`,
          data: { section: SECTION_KEY, productName, quantity },
        });
      }
      resetForm();
      setShowForm(false);
      loadEntries();
      Alert.alert(isAr ? "تم" : "Done", isAr ? "تم حفظ طلب الإنتاج بنجاح" : "Production request saved");
    } catch (e) {
      Alert.alert(isAr ? "خطأ" : "Error", isAr ? "حدث خطأ أثناء الحفظ" : "Error saving");
    }
  };

  const handleEdit = (entry: ProductionRequestEntry) => {
    setProductName(entry.productName || "");
    setQuantity(entry.quantity || "");
    setUnit((entry.unit as any) || "dozen");
    setDateFrom(entry.dateFrom || "");
    setDateTo(entry.dateTo || "");
    setNotes(entry.notes || "");
    setEditingEntry(entry);
    setShowForm(true);
  };

  const handleDelete = (entry: ProductionRequestEntry) => {
    Alert.alert(
      isAr ? "تأكيد الحذف" : "Confirm Delete",
      isAr ? "هل تريد حذف هذا الطلب؟" : "Delete this request?",
      [
        { text: isAr ? "إلغاء" : "Cancel", style: "cancel" },
        {
          text: isAr ? "حذف" : "Delete",
          style: "destructive",
          onPress: async () => {
            await maintenanceEntriesService.delete(Number(entry.id));
            loadEntries();
          },
        },
      ]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "in_progress": return "#3b82f6";
      case "completed": return "#16a34a";
      default: return "#f59e0b";
    }
  };

  const getStatusLabel = (status: string) => {
    if (isAr) {
      switch (status) {
        case "in_progress": return "قيد التنفيذ";
        case "completed": return "مكتمل";
        default: return "معلق";
      }
    }
    switch (status) {
      case "in_progress": return "In Progress";
      case "completed": return "Completed";
      default: return "Pending";
    }
  };

  const renderEntry = ({ item }: { item: ProductionRequestEntry }) => (
    <View style={{ backgroundColor: "white", borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "#E5E7EB" }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TouchableOpacity onPress={() => handleEdit(item)} style={{ padding: 6 }}>
            <MaterialIcons name="edit" size={18} color="#3b82f6" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleDelete(item)} style={{ padding: 6 }}>
            <MaterialIcons name="delete" size={18} color="#ef4444" />
          </TouchableOpacity>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={{ fontWeight: "bold", fontSize: 16, color: "#11181C" }}>{item.productName}</Text>
          <View style={{ backgroundColor: getStatusColor(item.status) + "20", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 }}>
            <Text style={{ color: getStatusColor(item.status), fontSize: 11, fontWeight: "600" }}>{getStatusLabel(item.status)}</Text>
          </View>
        </View>
      </View>
      <View style={{ gap: 4 }}>
        <Text style={{ color: "#687076", fontSize: 13, textAlign: "right" }}>
          {isAr ? "الكمية: " : "Qty: "}{item.quantity} {item.unit === "dozen" ? (isAr ? "درزن" : "dozen") : (isAr ? "زوج" : "pairs")}
        </Text>
        {(item.dateFrom || item.dateTo) && (
          <Text style={{ color: "#687076", fontSize: 13, textAlign: "right" }}>
            {isAr ? "المدة: " : "Period: "}{item.dateFrom || "?"} → {item.dateTo || "?"}
          </Text>
        )}
        <Text style={{ color: "#687076", fontSize: 13, textAlign: "right" }}>
          {isAr ? "الطالب: " : "By: "}{item.requestedBy}
        </Text>
        <Text style={{ color: "#9BA1A6", fontSize: 11, textAlign: "right", marginTop: 4 }}>{item.date}</Text>
      </View>
    </View>
  );

  const renderForm = () => (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
      {/* اسم الصنف */}
      <Text style={{ fontWeight: "600", color: colors.foreground, textAlign: "right", marginBottom: 6 }}>{isAr ? "اسم الصنف *" : "Product Name *"}</Text>
      <TextInput
        value={productName}
        onChangeText={setProductName}
        placeholder={isAr ? "أدخل اسم الصنف" : "Enter product name"}
        style={{ backgroundColor: "white", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "#E5E7EB", textAlign: "right", marginBottom: 12 }}
      />

      {/* الكمية والوحدة */}
      <Text style={{ fontWeight: "600", color: colors.foreground, textAlign: "right", marginBottom: 6 }}>{isAr ? "الكمية *" : "Quantity *"}</Text>
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
        <View style={{ flexDirection: "row", gap: 6 }}>
          <TouchableOpacity
            onPress={() => setUnit("pair")}
            style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, backgroundColor: unit === "pair" ? "#0a7ea4" : "#f1f5f9" }}
          >
            <Text style={{ color: unit === "pair" ? "white" : "#687076", fontWeight: "600" }}>{isAr ? "زوج" : "Pair"}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setUnit("dozen")}
            style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, backgroundColor: unit === "dozen" ? "#0a7ea4" : "#f1f5f9" }}
          >
            <Text style={{ color: unit === "dozen" ? "white" : "#687076", fontWeight: "600" }}>{isAr ? "درزن" : "Dozen"}</Text>
          </TouchableOpacity>
        </View>
        <TextInput
          value={quantity}
          onChangeText={setQuantity}
          placeholder={isAr ? "الكمية" : "Qty"}
          keyboardType="numeric"
          style={{ flex: 1, backgroundColor: "white", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "#E5E7EB", textAlign: "right" }}
        />
      </View>

      {/* مدة الإنتاج */}
      <Text style={{ fontWeight: "600", color: colors.foreground, textAlign: "right", marginBottom: 6 }}>{isAr ? "مدة الإنتاج المطلوبة" : "Required Production Period"}</Text>
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
        <TextInput
          value={dateTo}
          onChangeText={setDateTo}
          placeholder={isAr ? "إلى (مثال: 2025/02/15)" : "To (e.g. 2025/02/15)"}
          style={{ flex: 1, backgroundColor: "white", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "#E5E7EB", textAlign: "right" }}
        />
        <TextInput
          value={dateFrom}
          onChangeText={setDateFrom}
          placeholder={isAr ? "من (مثال: 2025/01/15)" : "From (e.g. 2025/01/15)"}
          style={{ flex: 1, backgroundColor: "white", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "#E5E7EB", textAlign: "right" }}
        />
      </View>

      {/* ملاحظات */}
      <Text style={{ fontWeight: "600", color: colors.foreground, textAlign: "right", marginBottom: 6 }}>{isAr ? "ملاحظات" : "Notes"}</Text>
      <TextInput
        value={notes}
        onChangeText={setNotes}
        placeholder={isAr ? "أدخل ملاحظات" : "Enter notes"}
        multiline
        numberOfLines={3}
        style={{ backgroundColor: "white", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "#E5E7EB", textAlign: "right", marginBottom: 12, minHeight: 80, textAlignVertical: "top" }}
      />

      {/* أزرار */}
      <View style={{ flexDirection: "row", gap: 12, marginTop: 20 }}>
        <TouchableOpacity
          onPress={() => { resetForm(); setShowForm(false); }}
          style={{ flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: "#f1f5f9", alignItems: "center" }}
        >
          <Text style={{ color: "#687076", fontWeight: "600" }}>{isAr ? "إلغاء" : "Cancel"}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleSave}
          style={{ flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: "#8b5cf6", alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 6 }}
        >
          <MaterialIcons name="save" size={18} color="white" />
          <Text style={{ color: "white", fontWeight: "600" }}>{editingEntry ? (isAr ? "تعديل" : "Update") : (isAr ? "حفظ" : "Save")}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  return (
    <ScreenContainer style={{ backgroundColor: colors.background }}>
      <View style={{ backgroundColor: "#8b5cf6", paddingHorizontal: 24, paddingVertical: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <TouchableOpacity
          onPress={() => { resetForm(); setShowForm(true); }}
          style={{ backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 20, padding: 8 }}
        >
          <MaterialIcons name="add" size={24} color="white" />
        </TouchableOpacity>
        <AdminBadgeIcon />
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={{ color: "#ffffff", fontWeight: "bold", fontSize: 20 }}>{isAr ? "طلبات الإنتاج" : "Production Requests"}</Text>
          <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 13, marginTop: 4 }}>
            {isAr ? `${entries.length} طلب` : `${entries.length} Requests`}
          </Text>
        </View>
        <BackButton />
      </View>

      <AdminCard />

      {showForm ? renderForm() : (
        <FlatList
          data={entries}
          keyExtractor={(item) => item.id}
          renderItem={renderEntry}
          contentContainerStyle={{ padding: 16, flexGrow: 1 }}
          ListEmptyComponent={
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 80 }}>
              <View style={{ backgroundColor: "#8b5cf615", borderRadius: 40, padding: 20 }}>
                <MaterialIcons name="factory" size={48} color="#8b5cf6" />
              </View>
              <Text style={{ color: colors.foreground, fontSize: 18, marginTop: 20, fontWeight: "bold" }}>{isAr ? "طلبات الإنتاج" : "Production Requests"}</Text>
              <Text style={{ color: colors.muted, fontSize: 14, marginTop: 8, textAlign: "center", paddingHorizontal: 32 }}>
                {isAr ? "لا توجد طلبات إنتاج بعد.\nاضغط على زر (+) لإضافة طلب جديد." : "No production requests yet.\nPress (+) to add a new request."}
              </Text>
              <TouchableOpacity
                onPress={() => { resetForm(); setShowForm(true); }}
                style={{ backgroundColor: "#8b5cf6", marginTop: 24, paddingHorizontal: 32, paddingVertical: 12, borderRadius: 12 }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={{ color: "#ffffff", fontWeight: "600" }}>{isAr ? "إضافة طلب" : "Add Request"}</Text>
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
