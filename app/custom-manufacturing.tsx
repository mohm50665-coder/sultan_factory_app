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
import { AttachmentPicker } from "@/components/attachment-picker";
import { AttachmentFile } from "@/lib/services/attachment.service";

const SECTION_KEY = "custom_manufacturing";

interface CustomManufacturingEntry {
  id: string;
  productName: string;
  color: string;
  size: string;
  orderType: string; // "sample" | "product"
  quantity: string;
  unit: string;
  dateFrom: string;
  dateTo: string;
  attachments: AttachmentFile[];
  manufacturingForm: string;
  designFile: string;
  notes: string;
  requestedBy: string;
  status: string; // "pending" | "approved" | "in_progress" | "completed"
  approvalStatus: string; // "pending" | "approved" | "rejected"
  warehouseStatus: string; // "" | "done" | "not_done" | "partial"
  warehouseNotes: string;
  date: string;
}

export default function CustomManufacturingScreen() {
  const colors = useColors();
  const { language } = useLanguage();
  const isAr = language === "ar";
  const { user } = useAuth();

  const [entries, setEntries] = useState<CustomManufacturingEntry[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<CustomManufacturingEntry | null>(null);

  const [productName, setProductName] = useState("");
  const [color, setColor] = useState("");
  const [size, setSize] = useState("");
  const [orderType, setOrderType] = useState<"sample" | "product">("product");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState<"dozen" | "pair">("dozen");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);
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
      console.log("Error loading custom manufacturing:", e);
    }
  };

  const resetForm = () => {
    setProductName("");
    setColor("");
    setSize("");
    setOrderType("product");
    setQuantity("");
    setUnit("dozen");
    setDateFrom("");
    setDateTo("");
    setAttachments([]);
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
      color,
      size,
      orderType,
      quantity,
      unit,
      dateFrom,
      dateTo,
      attachments,
      manufacturingForm: "",
      designFile: "",
      notes,
      requestedBy: user?.name || "",
      status: "pending",
    };

    try {
      if (editingEntry) {
        await maintenanceEntriesService.update(Number(editingEntry.id), entryData);
      } else {
        await maintenanceEntriesService.create(SECTION_KEY, entryData, user?.name, undefined, user?.id ? Number(user.id) : undefined);
        // إشعار لمدير الإنتاج
        await notificationsService.add({
          type: "production",
          title: isAr ? "طلب تصنيع خاص جديد" : "New Custom Manufacturing Request",
          message: isAr ? `طلب تصنيع خاص: ${productName} - ${orderType === "sample" ? "عينة" : "منتج"} - ${quantity} ${unit === "dozen" ? "درزن" : "زوج"}` : `Custom manufacturing: ${productName} - ${orderType} - ${quantity} ${unit}`,
          data: { section: SECTION_KEY, productName, orderType },
        });
      }
      resetForm();
      setShowForm(false);
      loadEntries();
      Alert.alert(isAr ? "تم" : "Done", isAr ? "تم حفظ طلب التصنيع بنجاح" : "Custom manufacturing request saved");
    } catch (e) {
      Alert.alert(isAr ? "خطأ" : "Error", isAr ? "حدث خطأ أثناء الحفظ" : "Error saving");
    }
  };

  const handleEdit = (entry: CustomManufacturingEntry) => {
    setProductName(entry.productName || "");
    setColor(entry.color || "");
    setSize(entry.size || "");
    setOrderType((entry.orderType as any) || "product");
    setQuantity(entry.quantity || "");
    setUnit((entry.unit as any) || "dozen");
    setDateFrom(entry.dateFrom || "");
    setDateTo(entry.dateTo || "");
    setAttachments(entry.attachments || []);
    setNotes(entry.notes || "");
    setEditingEntry(entry);
    setShowForm(true);
  };

  const handleDelete = (entry: CustomManufacturingEntry) => {
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

  const handleConvertToProduct = async (entry: CustomManufacturingEntry) => {
    Alert.alert(
      isAr ? "تحويل لمنتج" : "Convert to Product",
      isAr ? "هل تريد تحويل هذه العينة إلى منتج؟" : "Convert this sample to a product?",
      [
        { text: isAr ? "إلغاء" : "Cancel", style: "cancel" },
        {
          text: isAr ? "تحويل" : "Convert",
          onPress: async () => {
            const updatedData = { ...entry, orderType: "product" };
            delete (updatedData as any).id;
            delete (updatedData as any).date;
            await maintenanceEntriesService.update(Number(entry.id), updatedData);
            loadEntries();
            Alert.alert(isAr ? "تم" : "Done", isAr ? "تم تحويل العينة إلى منتج" : "Sample converted to product");
          },
        },
      ]
    );
  };

  const handleApproval = async (entry: CustomManufacturingEntry, decision: "approved" | "rejected") => {
    try {
      await maintenanceEntriesService.update(Number(entry.id), {
        ...entry,
        approvalStatus: decision,
        status: decision === "approved" ? "approved" : "pending",
      });
      await notificationsService.add({
        type: "admin",
        title: isAr ? "تعميد طلب تصنيع" : "Manufacturing Approval",
        message: isAr ? `تم ${decision === "approved" ? "اعتماد" : "رفض"} طلب تصنيع: ${entry.productName}` : `Manufacturing request ${decision}: ${entry.productName}`,
        data: { section: SECTION_KEY, id: entry.id },
      });
      loadEntries();
      Alert.alert(isAr ? "تم" : "Done", isAr ? `تم ${decision === "approved" ? "اعتماد" : "رفض"} الطلب` : `Request ${decision}`);
    } catch (e) {
      Alert.alert(isAr ? "خطأ" : "Error", isAr ? "حدث خطأ" : "An error occurred");
    }
  };

  const handleWarehouseResponse = (entry: CustomManufacturingEntry, status: "done" | "not_done" | "partial") => {
    if (status === "done") {
      saveWarehouseResponse(entry, status, "");
    } else {
      Alert.prompt(
        isAr ? (status === "not_done" ? "سبب عدم الإنجاز" : "النواقص والسبب") : (status === "not_done" ? "Reason" : "Shortages & reason"),
        isAr ? "أدخل التفاصيل" : "Enter details",
        [
          { text: isAr ? "إلغاء" : "Cancel", style: "cancel" },
          { text: isAr ? "حفظ" : "Save", onPress: (notes?: string) => saveWarehouseResponse(entry, status, notes || "") },
        ],
        "plain-text"
      );
    }
  };

  const saveWarehouseResponse = async (entry: CustomManufacturingEntry, status: string, notes: string) => {
    try {
      await maintenanceEntriesService.update(Number(entry.id), {
        ...entry,
        warehouseStatus: status,
        warehouseNotes: notes,
      });
      await notificationsService.add({
        type: "admin",
        title: isAr ? "إفادة مستودع" : "Warehouse Response",
        message: isAr ? `إفادة المستودع لطلب تصنيع: ${entry.productName}` : `Warehouse response for: ${entry.productName}`,
        data: { section: SECTION_KEY, id: entry.id },
      });
      loadEntries();
    } catch (e) {
      Alert.alert(isAr ? "خطأ" : "Error", isAr ? "حدث خطأ" : "An error occurred");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved": return "#3b82f6";
      case "in_progress": return "#f59e0b";
      case "completed": return "#16a34a";
      default: return "#9ca3af";
    }
  };

  const getStatusLabel = (status: string) => {
    if (isAr) {
      switch (status) {
        case "approved": return "معتمد";
        case "in_progress": return "قيد التنفيذ";
        case "completed": return "مكتمل";
        default: return "معلق";
      }
    }
    switch (status) {
      case "approved": return "Approved";
      case "in_progress": return "In Progress";
      case "completed": return "Completed";
      default: return "Pending";
    }
  };

  const renderEntry = ({ item }: { item: CustomManufacturingEntry }) => (
    <View style={{ backgroundColor: "white", borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "#E5E7EB" }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TouchableOpacity onPress={() => handleEdit(item)} style={{ padding: 6 }}>
            <MaterialIcons name="edit" size={18} color="#3b82f6" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleDelete(item)} style={{ padding: 6 }}>
            <MaterialIcons name="delete" size={18} color="#ef4444" />
          </TouchableOpacity>
          {item.orderType === "sample" && (
            <TouchableOpacity onPress={() => handleConvertToProduct(item)} style={{ padding: 6 }}>
              <MaterialIcons name="swap-horiz" size={18} color="#8b5cf6" />
            </TouchableOpacity>
          )}
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={{ fontWeight: "bold", fontSize: 16, color: "#11181C" }}>{item.productName}</Text>
          <View style={{ backgroundColor: item.orderType === "sample" ? "#f59e0b20" : "#16a34a20", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 }}>
            <Text style={{ color: item.orderType === "sample" ? "#f59e0b" : "#16a34a", fontSize: 11, fontWeight: "600" }}>
              {item.orderType === "sample" ? (isAr ? "عينة" : "Sample") : (isAr ? "منتج" : "Product")}
            </Text>
          </View>
        </View>
      </View>
      <View style={{ gap: 4 }}>
        {item.color && <Text style={{ color: "#687076", fontSize: 13, textAlign: "right" }}>{isAr ? "اللون: " : "Color: "}{item.color}</Text>}
        {item.size && <Text style={{ color: "#687076", fontSize: 13, textAlign: "right" }}>{isAr ? "المقاس: " : "Size: "}{item.size}</Text>}
        <Text style={{ color: "#687076", fontSize: 13, textAlign: "right" }}>
          {isAr ? "الكمية: " : "Qty: "}{item.quantity} {item.unit === "dozen" ? (isAr ? "درزن" : "dozen") : (isAr ? "زوج" : "pairs")}
        </Text>
        {(item.dateFrom || item.dateTo) && (
          <Text style={{ color: "#687076", fontSize: 13, textAlign: "right" }}>
            {isAr ? "المدة: " : "Period: "}{item.dateFrom || "?"} → {item.dateTo || "?"}
          </Text>
        )}
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
          <View style={{ backgroundColor: getStatusColor(item.status) + "20", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 }}>
            <Text style={{ color: getStatusColor(item.status), fontSize: 11, fontWeight: "600" }}>{getStatusLabel(item.status)}</Text>
          </View>
          <Text style={{ color: "#9BA1A6", fontSize: 11 }}>{item.date}</Text>
        </View>
      </View>

      {/* تعميد مدير المبيعات والتسويق */}
      <View style={{ marginTop: 10, borderTopWidth: 1, borderColor: "#E5E7EB", paddingTop: 10 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View style={{ flexDirection: "row", gap: 6 }}>
            {(user?.role === "admin" || user?.role === "manager" || user?.department === "sales") && (!item.approvalStatus || item.approvalStatus === "pending") && (
              <>
                <TouchableOpacity onPress={() => handleApproval(item, "approved")} style={{ backgroundColor: "#16a34a", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <MaterialIcons name="check" size={14} color="white" />
                  <Text style={{ color: "white", fontSize: 11, fontWeight: "600" }}>{isAr ? "اعتماد" : "Approve"}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleApproval(item, "rejected")} style={{ backgroundColor: "#ef4444", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <MaterialIcons name="close" size={14} color="white" />
                  <Text style={{ color: "white", fontSize: 11, fontWeight: "600" }}>{isAr ? "رفض" : "Reject"}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
          <Text style={{ color: "#ec4899", fontWeight: "bold", fontSize: 12, textAlign: "right" }}>
            {isAr ? "تعميد مدير المبيعات" : "Sales Manager Approval"}
          </Text>
        </View>
        {item.approvalStatus && item.approvalStatus !== "pending" && (
          <Text style={{ color: item.approvalStatus === "approved" ? "#16a34a" : "#ef4444", fontSize: 12, textAlign: "right", marginTop: 4 }}>
            {isAr ? "القرار: " : "Decision: "}{item.approvalStatus === "approved" ? (isAr ? "معتمد" : "Approved") : (isAr ? "مرفوض" : "Rejected")}
          </Text>
        )}
      </View>

      {/* إفادة المستودعات */}
      <View style={{ marginTop: 10, borderTopWidth: 1, borderColor: "#E5E7EB", paddingTop: 10 }}>
        <Text style={{ color: "#8b5cf6", fontWeight: "bold", fontSize: 12, textAlign: "right", marginBottom: 6 }}>
          {isAr ? "إفادة المستودعات" : "Warehouse Response"}
        </Text>
        {item.warehouseStatus ? (
          <View style={{ gap: 4 }}>
            <View style={{ flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 6 }}>
              <Text style={{ color: item.warehouseStatus === "done" ? "#16a34a" : item.warehouseStatus === "not_done" ? "#ef4444" : "#f59e0b", fontSize: 12, fontWeight: "600" }}>
                {isAr ? (item.warehouseStatus === "done" ? "أنجز" : item.warehouseStatus === "not_done" ? "لم ينجز" : "أنجز جزئياً") : (item.warehouseStatus === "done" ? "Done" : item.warehouseStatus === "not_done" ? "Not Done" : "Partial")}
              </Text>
              <MaterialIcons name={item.warehouseStatus === "done" ? "check-circle" : item.warehouseStatus === "not_done" ? "cancel" : "warning"} size={16} color={item.warehouseStatus === "done" ? "#16a34a" : item.warehouseStatus === "not_done" ? "#ef4444" : "#f59e0b"} />
            </View>
            {item.warehouseNotes ? <Text style={{ color: "#687076", fontSize: 11, textAlign: "right" }}>{item.warehouseNotes}</Text> : null}
          </View>
        ) : (
          (user?.role === "admin" || user?.role === "manager" || user?.department === "warehouse") && item.approvalStatus === "approved" ? (
            <View style={{ flexDirection: "row", gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}>
              <TouchableOpacity onPress={() => handleWarehouseResponse(item, "done")} style={{ backgroundColor: "#16a34a", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 }}>
                <Text style={{ color: "white", fontSize: 11, fontWeight: "600" }}>{isAr ? "أنجز" : "Done"}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleWarehouseResponse(item, "not_done")} style={{ backgroundColor: "#ef4444", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 }}>
                <Text style={{ color: "white", fontSize: 11, fontWeight: "600" }}>{isAr ? "لم ينجز" : "Not Done"}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleWarehouseResponse(item, "partial")} style={{ backgroundColor: "#f59e0b", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 }}>
                <Text style={{ color: "white", fontSize: 11, fontWeight: "600" }}>{isAr ? "جزئياً" : "Partial"}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={{ color: "#9BA1A6", fontSize: 11, textAlign: "right" }}>
              {(!item.approvalStatus || item.approvalStatus !== "approved") ? (isAr ? "بانتظار اعتماد المدير" : "Waiting for approval") : (isAr ? "بانتظار إفادة المستودع" : "Waiting for warehouse")}
            </Text>
          )
        )}
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

      {/* اللون */}
      <Text style={{ fontWeight: "600", color: colors.foreground, textAlign: "right", marginBottom: 6 }}>{isAr ? "اللون" : "Color"}</Text>
      <TextInput
        value={color}
        onChangeText={setColor}
        placeholder={isAr ? "أدخل اللون" : "Enter color"}
        style={{ backgroundColor: "white", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "#E5E7EB", textAlign: "right", marginBottom: 12 }}
      />

      {/* المقاس */}
      <Text style={{ fontWeight: "600", color: colors.foreground, textAlign: "right", marginBottom: 6 }}>{isAr ? "المقاس" : "Size"}</Text>
      <TextInput
        value={size}
        onChangeText={setSize}
        placeholder={isAr ? "أدخل المقاس" : "Enter size"}
        style={{ backgroundColor: "white", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "#E5E7EB", textAlign: "right", marginBottom: 12 }}
      />

      {/* نوع الطلب */}
      <Text style={{ fontWeight: "600", color: colors.foreground, textAlign: "right", marginBottom: 6 }}>{isAr ? "نوع الطلب" : "Order Type"}</Text>
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 12, justifyContent: "flex-end" }}>
        {(["product", "sample"] as const).map((type) => (
          <TouchableOpacity
            key={type}
            onPress={() => setOrderType(type)}
            style={{
              paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
              backgroundColor: orderType === type ? "#ec4899" : "#f1f5f9",
            }}
          >
            <Text style={{ color: orderType === type ? "white" : "#687076", fontWeight: "600" }}>
              {type === "sample" ? (isAr ? "عينة" : "Sample") : (isAr ? "منتج" : "Product")}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* الكمية والوحدة */}
      <Text style={{ fontWeight: "600", color: colors.foreground, textAlign: "right", marginBottom: 6 }}>{isAr ? "الكمية *" : "Quantity *"}</Text>
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
        <View style={{ flexDirection: "row", gap: 6 }}>
          <TouchableOpacity
            onPress={() => setUnit("pair")}
            style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, backgroundColor: unit === "pair" ? "#ec4899" : "#f1f5f9" }}
          >
            <Text style={{ color: unit === "pair" ? "white" : "#687076", fontWeight: "600" }}>{isAr ? "زوج" : "Pair"}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setUnit("dozen")}
            style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, backgroundColor: unit === "dozen" ? "#ec4899" : "#f1f5f9" }}
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
          placeholder={isAr ? "إلى" : "To"}
          style={{ flex: 1, backgroundColor: "white", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "#E5E7EB", textAlign: "right" }}
        />
        <TextInput
          value={dateFrom}
          onChangeText={setDateFrom}
          placeholder={isAr ? "من" : "From"}
          style={{ flex: 1, backgroundColor: "white", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "#E5E7EB", textAlign: "right" }}
        />
      </View>

      {/* المرفقات */}
      <Text style={{ fontWeight: "600", color: colors.foreground, textAlign: "right", marginBottom: 6 }}>{isAr ? "المرفقات (صورة / كاميرا / PDF)" : "Attachments (Image / Camera / PDF)"}</Text>
      <AttachmentPicker
        attachments={attachments}
        onAttachmentsChange={setAttachments}
        maxAttachments={10}
      />

      {/* ملاحظة */}
      <Text style={{ fontWeight: "600", color: colors.foreground, textAlign: "right", marginBottom: 6, marginTop: 12 }}>{isAr ? "ملاحظات (نموذج التصنيع / ملف التصميم)" : "Notes (Manufacturing Form / Design File)"}</Text>
      <TextInput
        value={notes}
        onChangeText={setNotes}
        placeholder={isAr ? "أدخل ملاحظات أو وصف نموذج التصنيع الخاص وملف التصميم" : "Enter notes or describe manufacturing form and design file"}
        multiline
        numberOfLines={4}
        style={{ backgroundColor: "white", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "#E5E7EB", textAlign: "right", marginBottom: 12, minHeight: 100, textAlignVertical: "top" }}
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
          style={{ flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: "#ec4899", alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 6 }}
        >
          <MaterialIcons name="save" size={18} color="white" />
          <Text style={{ color: "white", fontWeight: "600" }}>{editingEntry ? (isAr ? "تعديل" : "Update") : (isAr ? "حفظ" : "Save")}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  return (
    <ScreenContainer style={{ backgroundColor: colors.background }}>
      <View style={{ backgroundColor: "#ec4899", paddingHorizontal: 24, paddingVertical: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <TouchableOpacity
          onPress={() => { resetForm(); setShowForm(true); }}
          style={{ backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 20, padding: 8 }}
        >
          <MaterialIcons name="add" size={24} color="white" />
        </TouchableOpacity>
        <AdminBadgeIcon />
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={{ color: "#ffffff", fontWeight: "bold", fontSize: 18 }}>{isAr ? "طلبات التصنيع الخاصة" : "Custom Manufacturing"}</Text>
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
              <View style={{ backgroundColor: "#ec489915", borderRadius: 40, padding: 20 }}>
                <MaterialIcons name="design-services" size={48} color="#ec4899" />
              </View>
              <Text style={{ color: colors.foreground, fontSize: 18, marginTop: 20, fontWeight: "bold" }}>{isAr ? "طلبات التصنيع الخاصة" : "Custom Manufacturing"}</Text>
              <Text style={{ color: colors.muted, fontSize: 14, marginTop: 8, textAlign: "center", paddingHorizontal: 32 }}>
                {isAr ? "لا توجد طلبات تصنيع خاصة بعد.\nاضغط على زر (+) لإضافة طلب جديد." : "No custom manufacturing requests yet.\nPress (+) to add a new request."}
              </Text>
              <TouchableOpacity
                onPress={() => { resetForm(); setShowForm(true); }}
                style={{ backgroundColor: "#ec4899", marginTop: 24, paddingHorizontal: 32, paddingVertical: 12, borderRadius: 12 }}
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
