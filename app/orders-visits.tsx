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

const SECTION_KEY = "orders_visits";

interface OrderItem {
  productName: string;
  quantity: string;
  unit: string; // "dozen" | "pair"
}

interface OrderVisitEntry {
  id: string;
  customerName: string;
  customerAddress: string;
  contactPerson: string;
  phone: string;
  customerType: string; // "new" | "old"
  customerStatus: string; // "order" | "visit" | "return"
  visitReport: string;
  orderItems: OrderItem[];
  attachments: AttachmentFile[];
  // بيانات العميل الجديد
  commercialRegister: string;
  nationalAddress: string;
  shopLicense: string;
  ownerName: string;
  ownerPhone: string;
  // بيانات المندوب (تلقائية)
  salesRepName: string;
  salesRepPhone: string;
  // حالة الاعتماد
  approvalStatus: string; // "pending" | "approved" | "rejected"
  // حالة التجهيز من المستودع
  warehouseStatus: string; // "" | "ready" | "not_ready" | "partial"
  warehouseNotes: string;
  date: string;
}

export default function OrdersVisitsScreen() {
  const colors = useColors();
  const { language } = useLanguage();
  const isAr = language === "ar";
  const { user } = useAuth();

  const [entries, setEntries] = useState<OrderVisitEntry[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<OrderVisitEntry | null>(null);

  // حقول النموذج
  const [customerName, setCustomerName] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [phone, setPhone] = useState("");
  const [customerType, setCustomerType] = useState<"new" | "old">("old");
  const [customerStatus, setCustomerStatus] = useState<"order" | "visit" | "return">("order");
  const [visitReport, setVisitReport] = useState("");
  const [orderItems, setOrderItems] = useState<OrderItem[]>([{ productName: "", quantity: "", unit: "dozen" }]);
  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);
  // بيانات العميل الجديد
  const [commercialRegister, setCommercialRegister] = useState("");
  const [nationalAddress, setNationalAddress] = useState("");
  const [shopLicense, setShopLicense] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");

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
      console.log("Error loading orders:", e);
    }
  };

  const resetForm = () => {
    setCustomerName("");
    setCustomerAddress("");
    setContactPerson("");
    setPhone("");
    setCustomerType("old");
    setCustomerStatus("order");
    setVisitReport("");
    setOrderItems([{ productName: "", quantity: "", unit: "dozen" }]);
    setAttachments([]);
    setCommercialRegister("");
    setNationalAddress("");
    setShopLicense("");
    setOwnerName("");
    setOwnerPhone("");
    setEditingEntry(null);
  };

  const handleSave = async () => {
    if (!customerName.trim()) {
      Alert.alert(isAr ? "تنبيه" : "Alert", isAr ? "يرجى إدخال اسم العميل" : "Please enter customer name");
      return;
    }

    const entryData = {
      customerName,
      customerAddress,
      contactPerson,
      phone,
      customerType,
      customerStatus,
      visitReport,
      orderItems: orderItems.filter(i => i.productName.trim()),
      attachments,
      commercialRegister,
      nationalAddress,
      shopLicense,
      ownerName,
      ownerPhone,
      salesRepName: user?.name || "",
      salesRepPhone: user?.phone || "",
      approvalStatus: "pending",
      warehouseStatus: "",
      warehouseNotes: "",
    };

    try {
      if (editingEntry) {
        await maintenanceEntriesService.update(Number(editingEntry.id), entryData);
      } else {
        await maintenanceEntriesService.create(SECTION_KEY, entryData, user?.name, undefined, user?.id ? Number(user.id) : undefined);
        // إشعار لمدير المبيعات
        await notificationsService.add({
          type: "admin",
          title: isAr ? "طلب جديد" : "New Order",
          message: isAr ? `طلب جديد من ${user?.name || "مندوب"} - العميل: ${customerName}` : `New order from ${user?.name || "Rep"} - Customer: ${customerName}`,
          data: { section: SECTION_KEY, customerName },
        });
      }
      resetForm();
      setShowForm(false);
      loadEntries();
      Alert.alert(isAr ? "تم" : "Done", isAr ? "تم حفظ البيانات بنجاح" : "Data saved successfully");
    } catch (e) {
      Alert.alert(isAr ? "خطأ" : "Error", isAr ? "حدث خطأ أثناء الحفظ" : "Error saving data");
    }
  };

  const handleEdit = (entry: OrderVisitEntry) => {
    setCustomerName(entry.customerName || "");
    setCustomerAddress(entry.customerAddress || "");
    setContactPerson(entry.contactPerson || "");
    setPhone(entry.phone || "");
    setCustomerType(entry.customerType as any || "old");
    setCustomerStatus(entry.customerStatus as any || "order");
    setVisitReport(entry.visitReport || "");
    setOrderItems(entry.orderItems?.length ? entry.orderItems : [{ productName: "", quantity: "", unit: "dozen" }]);
    setAttachments(entry.attachments || []);
    setCommercialRegister(entry.commercialRegister || "");
    setNationalAddress(entry.nationalAddress || "");
    setShopLicense(entry.shopLicense || "");
    setOwnerName(entry.ownerName || "");
    setOwnerPhone(entry.ownerPhone || "");
    setEditingEntry(entry);
    setShowForm(true);
  };

  const handleDelete = (entry: OrderVisitEntry) => {
    Alert.alert(
      isAr ? "تأكيد الحذف" : "Confirm Delete",
      isAr ? "هل تريد حذف هذا السجل؟" : "Delete this record?",
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

  const addOrderItem = () => {
    setOrderItems([...orderItems, { productName: "", quantity: "", unit: "dozen" }]);
  };

  const updateOrderItem = (index: number, field: keyof OrderItem, value: string) => {
    const updated = [...orderItems];
    updated[index] = { ...updated[index], [field]: value };
    setOrderItems(updated);
  };

  const removeOrderItem = (index: number) => {
    if (orderItems.length > 1) {
      setOrderItems(orderItems.filter((_, i) => i !== index));
    }
  };

  const handleApproval = async (entry: OrderVisitEntry, decision: "approved" | "rejected") => {
    try {
      await maintenanceEntriesService.update(Number(entry.id), {
        ...entry,
        approvalStatus: decision,
      });
      await notificationsService.add({
        type: "admin",
        title: isAr ? "تعميد طلب" : "Order Approval",
        message: isAr ? `تم ${decision === "approved" ? "اعتماد" : "رفض"} طلب العميل: ${entry.customerName}` : `Order ${decision} for: ${entry.customerName}`,
        data: { section: SECTION_KEY, orderId: entry.id },
      });
      loadEntries();
      Alert.alert(isAr ? "تم" : "Done", isAr ? `تم ${decision === "approved" ? "اعتماد" : "رفض"} الطلب` : `Order ${decision}`);
    } catch (e) {
      Alert.alert(isAr ? "خطأ" : "Error", isAr ? "حدث خطأ" : "An error occurred");
    }
  };

  const handleWarehouseResponse = (entry: OrderVisitEntry, status: "done" | "not_done" | "partial") => {
    if (status === "done") {
      // أنجز - حفظ مباشر
      saveWarehouseResponse(entry, status, "");
    } else {
      // لم ينجز أو جزئي - طلب السبب/النواقص
      Alert.prompt(
        isAr ? (status === "not_done" ? "سبب عدم الإنجاز" : "النواقص والسبب") : (status === "not_done" ? "Reason for not completing" : "Shortages and reason"),
        isAr ? (status === "not_done" ? "أدخل سبب عدم الإنجاز" : "أدخل الأصناف الناقصة والسبب") : (status === "not_done" ? "Enter reason" : "Enter missing items and reason"),
        [
          { text: isAr ? "إلغاء" : "Cancel", style: "cancel" },
          {
            text: isAr ? "حفظ" : "Save",
            onPress: (notes?: string) => saveWarehouseResponse(entry, status, notes || ""),
          },
        ],
        "plain-text"
      );
    }
  };

  const saveWarehouseResponse = async (entry: OrderVisitEntry, status: string, notes: string) => {
    try {
      await maintenanceEntriesService.update(Number(entry.id), {
        ...entry,
        warehouseStatus: status,
        warehouseNotes: notes,
      });
      await notificationsService.add({
        type: "admin",
        title: isAr ? "إفادة مستودع" : "Warehouse Response",
        message: isAr ? `إفادة المستودع لطلب ${entry.customerName}: ${status === "done" ? "أنجز" : status === "not_done" ? "لم ينجز" : "جزئياً"}` : `Warehouse response for ${entry.customerName}: ${status}`,
        data: { section: SECTION_KEY, orderId: entry.id },
      });
      loadEntries();
    } catch (e) {
      Alert.alert(isAr ? "خطأ" : "Error", isAr ? "حدث خطأ" : "An error occurred");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved": return "#16a34a";
      case "rejected": return "#ef4444";
      default: return "#f59e0b";
    }
  };

  const getStatusLabel = (status: string) => {
    if (isAr) {
      switch (status) {
        case "approved": return "معتمد";
        case "rejected": return "مرفوض";
        default: return "معلق";
      }
    }
    switch (status) {
      case "approved": return "Approved";
      case "rejected": return "Rejected";
      default: return "Pending";
    }
  };

  const renderEntry = ({ item }: { item: OrderVisitEntry }) => (
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
          <Text style={{ fontWeight: "bold", fontSize: 16, color: "#11181C", textAlign: "right" }}>{item.customerName}</Text>
          <View style={{ backgroundColor: getStatusColor(item.approvalStatus) + "20", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 }}>
            <Text style={{ color: getStatusColor(item.approvalStatus), fontSize: 11, fontWeight: "600" }}>{getStatusLabel(item.approvalStatus)}</Text>
          </View>
        </View>
      </View>
      <View style={{ gap: 4 }}>
        <Text style={{ color: "#687076", fontSize: 13, textAlign: "right" }}>
          {isAr ? "الحالة: " : "Status: "}
          {isAr ? (item.customerStatus === "order" ? "طلب" : item.customerStatus === "visit" ? "زيارة" : "مرتجع") : item.customerStatus}
        </Text>
        <Text style={{ color: "#687076", fontSize: 13, textAlign: "right" }}>
          {isAr ? "المندوب: " : "Rep: "}{item.salesRepName}
        </Text>
        {item.orderItems?.length > 0 && (
          <Text style={{ color: "#687076", fontSize: 13, textAlign: "right" }}>
            {isAr ? "الأصناف: " : "Items: "}{item.orderItems.map(i => `${i.productName} (${i.quantity} ${i.unit === "dozen" ? (isAr ? "درزن" : "dz") : (isAr ? "زوج" : "pr")})`).join(", ")}
          </Text>
        )}
        <Text style={{ color: "#9BA1A6", fontSize: 11, textAlign: "right", marginTop: 4 }}>{item.date}</Text>
      </View>

      {/* تعميد مدير المبيعات والتسويق */}
      <View style={{ marginTop: 10, borderTopWidth: 1, borderColor: "#E5E7EB", paddingTop: 10 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View style={{ flexDirection: "row", gap: 6 }}>
            {(user?.role === "admin" || user?.role === "manager" || user?.department === "sales") && item.approvalStatus === "pending" && (
              <>
                <TouchableOpacity
                  onPress={() => handleApproval(item, "approved")}
                  style={{ backgroundColor: "#16a34a", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, flexDirection: "row", alignItems: "center", gap: 4 }}
                >
                  <MaterialIcons name="check" size={14} color="white" />
                  <Text style={{ color: "white", fontSize: 11, fontWeight: "600" }}>{isAr ? "اعتماد" : "Approve"}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleApproval(item, "rejected")}
                  style={{ backgroundColor: "#ef4444", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, flexDirection: "row", alignItems: "center", gap: 4 }}
                >
                  <MaterialIcons name="close" size={14} color="white" />
                  <Text style={{ color: "white", fontSize: 11, fontWeight: "600" }}>{isAr ? "رفض" : "Reject"}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
          <Text style={{ color: "#0a7ea4", fontWeight: "bold", fontSize: 12, textAlign: "right" }}>
            {isAr ? "تعميد مدير المبيعات" : "Sales Manager Approval"}
          </Text>
        </View>
        {item.approvalStatus !== "pending" && (
          <Text style={{ color: getStatusColor(item.approvalStatus), fontSize: 12, textAlign: "right", marginTop: 4 }}>
            {isAr ? "القرار: " : "Decision: "}{getStatusLabel(item.approvalStatus)}
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
                {isAr ? (item.warehouseStatus === "done" ? "أنجز" : item.warehouseStatus === "not_done" ? "لم ينجز" : "أنجز جزئياً") : (item.warehouseStatus === "done" ? "Completed" : item.warehouseStatus === "not_done" ? "Not Completed" : "Partially Completed")}
              </Text>
              <MaterialIcons name={item.warehouseStatus === "done" ? "check-circle" : item.warehouseStatus === "not_done" ? "cancel" : "warning"} size={16} color={item.warehouseStatus === "done" ? "#16a34a" : item.warehouseStatus === "not_done" ? "#ef4444" : "#f59e0b"} />
            </View>
            {item.warehouseNotes ? (
              <Text style={{ color: "#687076", fontSize: 11, textAlign: "right" }}>{item.warehouseNotes}</Text>
            ) : null}
          </View>
        ) : (
          (user?.role === "admin" || user?.role === "manager" || user?.department === "warehouse") && item.approvalStatus === "approved" ? (
            <View style={{ gap: 6 }}>
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
            </View>
          ) : (
            <Text style={{ color: "#9BA1A6", fontSize: 11, textAlign: "right" }}>
              {item.approvalStatus !== "approved" ? (isAr ? "بانتظار اعتماد المدير" : "Waiting for manager approval") : (isAr ? "بانتظار إفادة المستودعات" : "Waiting for warehouse response")}
            </Text>
          )
        )}
      </View>
    </View>
  );

  const renderForm = () => (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
      {/* بيانات المندوب - تلقائية */}
      <View style={{ backgroundColor: "#0a7ea410", borderRadius: 12, padding: 12, marginBottom: 16 }}>
        <Text style={{ color: "#0a7ea4", fontWeight: "bold", fontSize: 14, textAlign: "right", marginBottom: 4 }}>
          {isAr ? "بيانات المندوب (تلقائية)" : "Sales Rep (Auto)"}
        </Text>
        <Text style={{ color: "#687076", fontSize: 13, textAlign: "right" }}>
          {user?.name || "-"} | {user?.phone || "-"}
        </Text>
      </View>

      {/* اسم العميل */}
      <Text style={{ fontWeight: "600", color: colors.foreground, textAlign: "right", marginBottom: 6 }}>{isAr ? "اسم العميل *" : "Customer Name *"}</Text>
      <TextInput
        value={customerName}
        onChangeText={setCustomerName}
        placeholder={isAr ? "أدخل اسم العميل" : "Enter customer name"}
        style={{ backgroundColor: "white", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "#E5E7EB", textAlign: "right", marginBottom: 12 }}
      />

      {/* عنوان العميل */}
      <Text style={{ fontWeight: "600", color: colors.foreground, textAlign: "right", marginBottom: 6 }}>{isAr ? "عنوان العميل" : "Customer Address"}</Text>
      <TextInput
        value={customerAddress}
        onChangeText={setCustomerAddress}
        placeholder={isAr ? "أدخل عنوان العميل" : "Enter customer address"}
        style={{ backgroundColor: "white", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "#E5E7EB", textAlign: "right", marginBottom: 12 }}
      />

      {/* اسم الشخص المسؤول */}
      <Text style={{ fontWeight: "600", color: colors.foreground, textAlign: "right", marginBottom: 6 }}>{isAr ? "اسم الشخص المسؤول" : "Contact Person"}</Text>
      <TextInput
        value={contactPerson}
        onChangeText={setContactPerson}
        placeholder={isAr ? "أدخل اسم المسؤول" : "Enter contact person"}
        style={{ backgroundColor: "white", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "#E5E7EB", textAlign: "right", marginBottom: 12 }}
      />

      {/* رقم الجوال */}
      <Text style={{ fontWeight: "600", color: colors.foreground, textAlign: "right", marginBottom: 6 }}>{isAr ? "رقم الجوال" : "Phone"}</Text>
      <TextInput
        value={phone}
        onChangeText={setPhone}
        placeholder={isAr ? "أدخل رقم الجوال" : "Enter phone"}
        keyboardType="phone-pad"
        style={{ backgroundColor: "white", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "#E5E7EB", textAlign: "right", marginBottom: 12 }}
      />

      {/* نوع العميل */}
      <Text style={{ fontWeight: "600", color: colors.foreground, textAlign: "right", marginBottom: 6 }}>{isAr ? "نوع العميل" : "Customer Type"}</Text>
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 12, justifyContent: "flex-end" }}>
        {(["old", "new"] as const).map((type) => (
          <TouchableOpacity
            key={type}
            onPress={() => setCustomerType(type)}
            style={{
              paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
              backgroundColor: customerType === type ? "#0a7ea4" : "#f1f5f9",
            }}
          >
            <Text style={{ color: customerType === type ? "white" : "#687076", fontWeight: "600" }}>
              {type === "new" ? (isAr ? "جديد" : "New") : (isAr ? "قديم" : "Existing")}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* حالة العميل */}
      <Text style={{ fontWeight: "600", color: colors.foreground, textAlign: "right", marginBottom: 6 }}>{isAr ? "حالة العميل" : "Customer Status"}</Text>
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 12, justifyContent: "flex-end", flexWrap: "wrap" }}>
        {(["order", "visit", "return"] as const).map((status) => (
          <TouchableOpacity
            key={status}
            onPress={() => setCustomerStatus(status)}
            style={{
              paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
              backgroundColor: customerStatus === status ? "#ec4899" : "#f1f5f9",
            }}
          >
            <Text style={{ color: customerStatus === status ? "white" : "#687076", fontWeight: "600" }}>
              {status === "order" ? (isAr ? "طلب" : "Order") : status === "visit" ? (isAr ? "زيارة" : "Visit") : (isAr ? "مرتجع" : "Return")}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* تقرير الزيارة */}
      <Text style={{ fontWeight: "600", color: colors.foreground, textAlign: "right", marginBottom: 6 }}>{isAr ? "تقرير الزيارة" : "Visit Report"}</Text>
      <TextInput
        value={visitReport}
        onChangeText={setVisitReport}
        placeholder={isAr ? "أدخل تقرير الزيارة" : "Enter visit report"}
        multiline
        numberOfLines={3}
        style={{ backgroundColor: "white", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "#E5E7EB", textAlign: "right", marginBottom: 12, minHeight: 80, textAlignVertical: "top" }}
      />

      {/* تفاصيل الطلب */}
      <Text style={{ fontWeight: "600", color: colors.foreground, textAlign: "right", marginBottom: 6 }}>{isAr ? "تفاصيل الطلب" : "Order Details"}</Text>
      {orderItems.map((item, index) => (
        <View key={index} style={{ backgroundColor: "#f8fafc", borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: "#E5E7EB" }}>
          <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
            <TouchableOpacity onPress={() => removeOrderItem(index)} style={{ padding: 4 }}>
              <MaterialIcons name="close" size={18} color="#ef4444" />
            </TouchableOpacity>
            <View style={{ flexDirection: "row", gap: 6 }}>
              <TouchableOpacity
                onPress={() => updateOrderItem(index, "unit", "pair")}
                style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: item.unit === "pair" ? "#0a7ea4" : "#e2e8f0" }}
              >
                <Text style={{ color: item.unit === "pair" ? "white" : "#687076", fontSize: 11 }}>{isAr ? "زوج" : "Pair"}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => updateOrderItem(index, "unit", "dozen")}
                style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: item.unit === "dozen" ? "#0a7ea4" : "#e2e8f0" }}
              >
                <Text style={{ color: item.unit === "dozen" ? "white" : "#687076", fontSize: 11 }}>{isAr ? "درزن" : "Dozen"}</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              value={item.quantity}
              onChangeText={(v) => updateOrderItem(index, "quantity", v)}
              placeholder={isAr ? "الكمية" : "Qty"}
              keyboardType="numeric"
              style={{ backgroundColor: "white", borderRadius: 8, padding: 8, borderWidth: 1, borderColor: "#E5E7EB", width: 60, textAlign: "center" }}
            />
            <TextInput
              value={item.productName}
              onChangeText={(v) => updateOrderItem(index, "productName", v)}
              placeholder={isAr ? "اسم الصنف" : "Product"}
              style={{ flex: 1, backgroundColor: "white", borderRadius: 8, padding: 8, borderWidth: 1, borderColor: "#E5E7EB", textAlign: "right" }}
            />
          </View>
        </View>
      ))}
      <TouchableOpacity onPress={addOrderItem} style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 8, marginBottom: 12 }}>
        <Text style={{ color: "#0a7ea4", fontWeight: "600" }}>{isAr ? "إضافة صنف" : "Add Item"}</Text>
        <MaterialIcons name="add-circle" size={20} color="#0a7ea4" />
      </TouchableOpacity>

      {/* بيانات العميل الجديد */}
      {customerType === "new" && (
        <View style={{ backgroundColor: "#fef3c7", borderRadius: 12, padding: 12, marginBottom: 12 }}>
          <Text style={{ fontWeight: "bold", color: "#92400e", textAlign: "right", marginBottom: 8 }}>
            {isAr ? "بيانات العميل الجديد (مطلوبة)" : "New Customer Data (Required)"}
          </Text>
          <TextInput
            value={commercialRegister}
            onChangeText={setCommercialRegister}
            placeholder={isAr ? "السجل التجاري" : "Commercial Register"}
            style={{ backgroundColor: "white", borderRadius: 8, padding: 10, borderWidth: 1, borderColor: "#E5E7EB", textAlign: "right", marginBottom: 8 }}
          />
          <TextInput
            value={nationalAddress}
            onChangeText={setNationalAddress}
            placeholder={isAr ? "العنوان الوطني" : "National Address"}
            style={{ backgroundColor: "white", borderRadius: 8, padding: 10, borderWidth: 1, borderColor: "#E5E7EB", textAlign: "right", marginBottom: 8 }}
          />
          <TextInput
            value={shopLicense}
            onChangeText={setShopLicense}
            placeholder={isAr ? "رخصة المحل" : "Shop License"}
            style={{ backgroundColor: "white", borderRadius: 8, padding: 10, borderWidth: 1, borderColor: "#E5E7EB", textAlign: "right", marginBottom: 8 }}
          />
          <TextInput
            value={ownerName}
            onChangeText={setOwnerName}
            placeholder={isAr ? "اسم المالك" : "Owner Name"}
            style={{ backgroundColor: "white", borderRadius: 8, padding: 10, borderWidth: 1, borderColor: "#E5E7EB", textAlign: "right", marginBottom: 8 }}
          />
          <TextInput
            value={ownerPhone}
            onChangeText={setOwnerPhone}
            placeholder={isAr ? "جوال المالك" : "Owner Phone"}
            keyboardType="phone-pad"
            style={{ backgroundColor: "white", borderRadius: 8, padding: 10, borderWidth: 1, borderColor: "#E5E7EB", textAlign: "right" }}
          />
        </View>
      )}

      {/* المرفقات */}
      <Text style={{ fontWeight: "600", color: colors.foreground, textAlign: "right", marginBottom: 6 }}>{isAr ? "المرفقات" : "Attachments"}</Text>
      <AttachmentPicker
        attachments={attachments}
        onAttachmentsChange={setAttachments}
        maxAttachments={10}
      />

      {/* أزرار الحفظ والإلغاء */}
      <View style={{ flexDirection: "row", gap: 12, marginTop: 20 }}>
        <TouchableOpacity
          onPress={() => { resetForm(); setShowForm(false); }}
          style={{ flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: "#f1f5f9", alignItems: "center" }}
        >
          <Text style={{ color: "#687076", fontWeight: "600" }}>{isAr ? "إلغاء" : "Cancel"}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleSave}
          style={{ flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: "#0a7ea4", alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 6 }}
        >
          <MaterialIcons name="save" size={18} color="white" />
          <Text style={{ color: "white", fontWeight: "600" }}>{editingEntry ? (isAr ? "تعديل" : "Update") : (isAr ? "حفظ" : "Save")}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  return (
    <ScreenContainer style={{ backgroundColor: colors.background }}>
      {/* رأس الصفحة */}
      <View style={{ backgroundColor: "#0a7ea4", paddingHorizontal: 24, paddingVertical: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <TouchableOpacity
          onPress={() => { resetForm(); setShowForm(true); }}
          style={{ backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 20, padding: 8 }}
        >
          <MaterialIcons name="add" size={24} color="white" />
        </TouchableOpacity>
        <AdminBadgeIcon />
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={{ color: "#ffffff", fontWeight: "bold", fontSize: 20 }}>{isAr ? "الطلبات والزيارات" : "Orders & Visits"}</Text>
          <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 13, marginTop: 4 }}>
            {isAr ? `${entries.length} سجل` : `${entries.length} Records`}
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
              <View style={{ backgroundColor: "#0a7ea415", borderRadius: 40, padding: 20 }}>
                <MaterialIcons name="assignment" size={48} color="#0a7ea4" />
              </View>
              <Text style={{ color: colors.foreground, fontSize: 18, marginTop: 20, fontWeight: "bold" }}>{isAr ? "الطلبات والزيارات" : "Orders & Visits"}</Text>
              <Text style={{ color: colors.muted, fontSize: 14, marginTop: 8, textAlign: "center", paddingHorizontal: 32 }}>
                {isAr ? "لا توجد طلبات بعد.\nاضغط على زر (+) لإضافة طلب أو زيارة جديدة." : "No orders yet.\nPress (+) to add a new order or visit."}
              </Text>
              <TouchableOpacity
                onPress={() => { resetForm(); setShowForm(true); }}
                style={{ backgroundColor: "#0a7ea4", marginTop: 24, paddingHorizontal: 32, paddingVertical: 12, borderRadius: 12 }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={{ color: "#ffffff", fontWeight: "600" }}>{isAr ? "إضافة طلب" : "Add Order"}</Text>
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
