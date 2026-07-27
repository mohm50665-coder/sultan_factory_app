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
  Platform,
  Linking,
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
  // بيانات العميل التجاري
  clientCommercialName: string;
  clientContactName: string;
  clientPhone: string;
  // بيانات المنتج
  productName: string;
  color: string;
  size: string;
  orderType: string; // "sample" | "product"
  quantity: string;
  unit: string;
  dateFrom: string;
  dateTo: string;
  // المرفقات المطلوبة
  attachments: AttachmentFile[];
  manufacturingFormAttachment: AttachmentFile[];
  commercialRegAttachment: AttachmentFile[];
  taxNumberAttachment: AttachmentFile[];
  nationalAddressAttachment: AttachmentFile[];
  designFileAttachment: AttachmentFile[];
  notes: string;
  requestedBy: string;
  status: string; // "pending" | "approved_sales" | "approved_production" | "in_progress" | "completed"
  orderDate: string;
  deliveryDate: string;
  // سير العمل: مدير المبيعات → مدير الإنتاج
  salesApprovalStatus: string; // "pending" | "approved" | "rejected"
  salesApprovalTime: string;
  productionApprovalStatus: string; // "" | "received" | "in_progress" | "completed"
  productionApprovalTime: string;
  productionNotes: string;
  productionProgress: number; // 0 | 25 | 50 | 75 | 100
  createdAt: string;
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

  // حقول النموذج
  const [clientCommercialName, setClientCommercialName] = useState("");
  const [clientContactName, setClientContactName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [productName, setProductName] = useState("");
  const [color, setColor] = useState("");
  const [size, setSize] = useState("");
  const [orderType, setOrderType] = useState<"sample" | "product">("product");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState<"dozen" | "pair">("dozen");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split("T")[0]);
  const [deliveryDate, setDeliveryDate] = useState("");
  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);
  const [manufacturingFormAttachment, setManufacturingFormAttachment] = useState<AttachmentFile[]>([]);
  const [commercialRegAttachment, setCommercialRegAttachment] = useState<AttachmentFile[]>([]);
  const [taxNumberAttachment, setTaxNumberAttachment] = useState<AttachmentFile[]>([]);
  const [nationalAddressAttachment, setNationalAddressAttachment] = useState<AttachmentFile[]>([]);
  const [designFileAttachment, setDesignFileAttachment] = useState<AttachmentFile[]>([]);
  const [notes, setNotes] = useState("");
  const [showReport, setShowReport] = useState(false);

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
    setClientCommercialName("");
    setClientContactName("");
    setClientPhone("");
    setProductName("");
    setColor("");
    setSize("");
    setOrderType("product");
    setQuantity("");
    setUnit("dozen");
    setDateFrom("");
    setDateTo("");
    setOrderDate(new Date().toISOString().split("T")[0]);
    setDeliveryDate("");
    setAttachments([]);
    setManufacturingFormAttachment([]);
    setCommercialRegAttachment([]);
    setTaxNumberAttachment([]);
    setNationalAddressAttachment([]);
    setDesignFileAttachment([]);
    setNotes("");
    setEditingEntry(null);
  };

  const handleSave = async () => {
    if (!productName.trim() || !quantity.trim()) {
      Alert.alert(isAr ? "تنبيه" : "Alert", isAr ? "يرجى إدخال اسم الصنف والكمية" : "Please enter product name and quantity");
      return;
    }
    if (!clientCommercialName.trim()) {
      Alert.alert(isAr ? "تنبيه" : "Alert", isAr ? "يرجى إدخال اسم العميل التجاري" : "Please enter client commercial name");
      return;
    }

    const entryData = {
      clientCommercialName,
      clientContactName,
      clientPhone,
      productName,
      color,
      size,
      orderType,
      quantity,
      unit,
      dateFrom,
      dateTo,
      orderDate,
      deliveryDate,
      attachments,
      manufacturingFormAttachment,
      commercialRegAttachment,
      taxNumberAttachment,
      nationalAddressAttachment,
      designFileAttachment,
      notes,
      requestedBy: user?.name || "",
      status: "pending",
      salesApprovalStatus: "pending",
      salesApprovalTime: "",
      productionApprovalStatus: "",
      productionApprovalTime: "",
      productionNotes: "",
      productionProgress: 0,
      createdAt: new Date().toISOString(),
    };

    try {
      if (editingEntry) {
        await maintenanceEntriesService.update(Number(editingEntry.id), entryData);
      } else {
        await maintenanceEntriesService.create(SECTION_KEY, entryData, user?.name, undefined, user?.id ? Number(user.id) : undefined);
        // إشعار لمدير المبيعات لاعتماد الطلب
        await notificationsService.add({
          type: "admin",
          title: isAr ? "طلب تصنيع خاص جديد - بانتظار الاعتماد" : "New Custom Manufacturing - Pending Approval",
          message: isAr ? `طلب تصنيع خاص من العميل: ${clientCommercialName} - ${productName} (${quantity} ${unit === "dozen" ? "درزن" : "زوج"})` : `Custom manufacturing from: ${clientCommercialName} - ${productName} (${quantity} ${unit})`,
          data: { section: SECTION_KEY, productName, clientCommercialName },
        });
      }
      resetForm();
      setShowForm(false);
      loadEntries();
      Alert.alert(isAr ? "تم" : "Done", isAr ? "تم حفظ طلب التصنيع بنجاح وتم رفعه لمدير المبيعات للاعتماد" : "Custom manufacturing request saved and sent to Sales Manager for approval");
    } catch (e) {
      Alert.alert(isAr ? "خطأ" : "Error", isAr ? "حدث خطأ أثناء الحفظ" : "Error saving");
    }
  };

  const handleEdit = (entry: CustomManufacturingEntry) => {
    setClientCommercialName(entry.clientCommercialName || "");
    setClientContactName(entry.clientContactName || "");
    setClientPhone(entry.clientPhone || "");
    setProductName(entry.productName || "");
    setColor(entry.color || "");
    setSize(entry.size || "");
    setOrderType((entry.orderType as any) || "product");
    setQuantity(entry.quantity || "");
    setUnit((entry.unit as any) || "dozen");
    setDateFrom(entry.dateFrom || "");
    setDateTo(entry.dateTo || "");
    setOrderDate(entry.orderDate || new Date().toISOString().split("T")[0]);
    setDeliveryDate(entry.deliveryDate || "");
    setAttachments(entry.attachments || []);
    setManufacturingFormAttachment(entry.manufacturingFormAttachment || []);
    setCommercialRegAttachment(entry.commercialRegAttachment || []);
    setTaxNumberAttachment(entry.taxNumberAttachment || []);
    setNationalAddressAttachment(entry.nationalAddressAttachment || []);
    setDesignFileAttachment(entry.designFileAttachment || []);
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

  // إرسال رسالة واتساب للعميل
  const sendWhatsAppToClient = (phone: string, message: string) => {
    if (!phone) return;
    // تنسيق الرقم: إزالة الصفر الأول وإضافة 966
    let formattedPhone = phone.replace(/\s+/g, "").replace(/^0/, "966");
    if (!formattedPhone.startsWith("966") && !formattedPhone.startsWith("+")) {
      formattedPhone = "966" + formattedPhone;
    }
    const url = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
    Linking.openURL(url).catch(() => {
      Alert.alert(isAr ? "خطأ" : "Error", isAr ? "لا يمكن فتح الواتساب" : "Cannot open WhatsApp");
    });
  };

  // اعتماد مدير المبيعات
  const handleSalesApproval = async (entry: CustomManufacturingEntry, decision: "approved" | "rejected") => {
    try {
      const updatedData = {
        ...entry,
        salesApprovalStatus: decision,
        salesApprovalTime: new Date().toISOString(),
        status: decision === "approved" ? "approved_sales" : "pending",
      };
      delete (updatedData as any).id;
      delete (updatedData as any).date;
      await maintenanceEntriesService.update(Number(entry.id), updatedData);

      if (decision === "approved") {
        // بعد اعتماد مدير المبيعات → إشعار لمدير الإنتاج (وليس المستودعات)
        await notificationsService.add({
          type: "production",
          title: isAr ? "طلب تصنيع خاص معتمد - بانتظار مدير الإنتاج" : "Approved Custom Manufacturing - Pending Production Manager",
          message: isAr ? `تم اعتماد طلب تصنيع خاص من العميل: ${entry.clientCommercialName || ""} - ${entry.productName} وتحويله لمدير الإنتاج` : `Approved custom manufacturing from: ${entry.clientCommercialName || ""} - ${entry.productName} - forwarded to Production Manager`,
          data: { section: SECTION_KEY, id: entry.id, productName: entry.productName },
        });
      }

      await notificationsService.add({
        type: "admin",
        title: isAr ? "قرار تعميد تصنيع خاص" : "Custom Manufacturing Approval Decision",
        message: isAr ? `تم ${decision === "approved" ? "اعتماد" : "رفض"} طلب تصنيع: ${entry.productName} من العميل: ${entry.clientCommercialName || ""}` : `Manufacturing request ${decision}: ${entry.productName} from: ${entry.clientCommercialName || ""}`,
        data: { section: SECTION_KEY, id: entry.id },
      });

      loadEntries();

      // إرسال رسالة واتساب للعميل
      if (entry.clientPhone) {
        const whatsMsg = decision === "approved"
          ? isAr
            ? `مرحباً ${entry.clientContactName || entry.clientCommercialName}،\nنفيدكم بأنه تم اعتماد طلب التصنيع الخاص الخاص بكم (${entry.productName}).\nسيتم البدء في التنفيذ قريباً.\nمصنع السلطان`
            : `Hello ${entry.clientContactName || entry.clientCommercialName},\nYour custom manufacturing request (${entry.productName}) has been approved.\nProduction will begin soon.\nSultan Factory`
          : isAr
            ? `مرحباً ${entry.clientContactName || entry.clientCommercialName}،\nنأسف لإبلاغكم بأنه تم رفض طلب التصنيع الخاص (${entry.productName}).\nيرجى التواصل معنا لمزيد من التفاصيل.\nمصنع السلطان`
            : `Hello ${entry.clientContactName || entry.clientCommercialName},\nWe regret to inform you that your custom manufacturing request (${entry.productName}) has been rejected.\nPlease contact us for details.\nSultan Factory`;
        sendWhatsAppToClient(entry.clientPhone, whatsMsg);
      }

      Alert.alert(isAr ? "تم" : "Done", isAr ? `تم ${decision === "approved" ? "اعتماد" : "رفض"} الطلب` : `Request ${decision}`);
    } catch (e) {
      Alert.alert(isAr ? "خطأ" : "Error", isAr ? "حدث خطأ" : "An error occurred");
    }
  };

  // استلام مدير الإنتاج
  const handleProductionResponse = async (entry: CustomManufacturingEntry, status: "received" | "in_progress" | "completed", pNotes?: string) => {
    try {
      const progressMap = { received: 25, in_progress: 50, completed: 100 };
      const updatedData = {
        ...entry,
        productionApprovalStatus: status,
        productionApprovalTime: new Date().toISOString(),
        productionNotes: pNotes || entry.productionNotes || "",
        productionProgress: progressMap[status] || 0,
        status: status === "completed" ? "completed" : status === "in_progress" ? "in_progress" : "approved_sales",
      };
      delete (updatedData as any).id;
      delete (updatedData as any).date;
      await maintenanceEntriesService.update(Number(entry.id), updatedData);

      await notificationsService.add({
        type: "admin",
        title: isAr ? "تحديث من مدير الإنتاج" : "Production Manager Update",
        message: isAr ? `طلب تصنيع ${entry.productName}: ${status === "received" ? "تم الاستلام (25%)" : status === "in_progress" ? "قيد التنفيذ (50%)" : "مكتمل (100%)"}` : `Manufacturing ${entry.productName}: ${status} (${progressMap[status]}%)`,
        data: { section: SECTION_KEY, id: entry.id },
      });

      // إرسال واتساب للعميل عند اكتمال الطلب
      if (status === "completed" && entry.clientPhone) {
        const msg = isAr
          ? `مرحباً ${entry.clientContactName || entry.clientCommercialName}،\nيسعدنا إبلاغكم بأن طلب التصنيع الخاص (${entry.productName}) قد اكتمل.\nيمكنكم استلام الطلب.\nمصنع السلطان`
          : `Hello ${entry.clientContactName || entry.clientCommercialName},\nWe are pleased to inform you that your custom manufacturing order (${entry.productName}) is now complete.\nYou may collect your order.\nSultan Factory`;
        sendWhatsAppToClient(entry.clientPhone, msg);
      }

      loadEntries();
    } catch (e) {
      Alert.alert(isAr ? "خطأ" : "Error", isAr ? "حدث خطأ" : "An error occurred");
    }
  };

  // تحديث نسبة التقدم
  const handleUpdateProgress = async (entry: CustomManufacturingEntry, progress: number) => {
    try {
      const updatedData = {
        ...entry,
        productionProgress: progress,
        productionApprovalStatus: progress === 100 ? "completed" : progress >= 50 ? "in_progress" : "received",
        status: progress === 100 ? "completed" : "in_progress",
        productionApprovalTime: new Date().toISOString(),
      };
      delete (updatedData as any).id;
      delete (updatedData as any).date;
      await maintenanceEntriesService.update(Number(entry.id), updatedData);

      await notificationsService.add({
        type: "admin",
        title: isAr ? "تحديث نسبة الإنجاز" : "Progress Update",
        message: isAr ? `طلب تصنيع ${entry.productName}: ${progress}%` : `Manufacturing ${entry.productName}: ${progress}%`,
        data: { section: SECTION_KEY, id: entry.id },
      });

      // إرسال واتساب عند الاكتمال
      if (progress === 100 && entry.clientPhone) {
        const msg = isAr
          ? `مرحباً ${entry.clientContactName || entry.clientCommercialName}،\nيسعدنا إبلاغكم بأن طلب التصنيع الخاص (${entry.productName}) قد اكتمل.\nيمكنكم استلام الطلب.\nمصنع السلطان`
          : `Hello ${entry.clientContactName || entry.clientCommercialName},\nYour custom manufacturing order (${entry.productName}) is now complete.\nYou may collect your order.\nSultan Factory`;
        sendWhatsAppToClient(entry.clientPhone, msg);
      }

      loadEntries();
    } catch (e) {
      Alert.alert(isAr ? "خطأ" : "Error", isAr ? "حدث خطأ" : "An error occurred");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved_sales": return "#3b82f6";
      case "approved_production": return "#8b5cf6";
      case "in_progress": return "#f59e0b";
      case "completed": return "#16a34a";
      default: return "#9ca3af";
    }
  };

  const getStatusLabel = (status: string) => {
    if (isAr) {
      switch (status) {
        case "approved_sales": return "معتمد من المبيعات";
        case "in_progress": return "قيد التنفيذ";
        case "completed": return "مكتمل";
        default: return "بانتظار الاعتماد";
      }
    }
    switch (status) {
      case "approved_sales": return "Sales Approved";
      case "in_progress": return "In Progress";
      case "completed": return "Completed";
      default: return "Pending Approval";
    }
  };

  const renderEntry = ({ item }: { item: CustomManufacturingEntry }) => (
    <View style={{ backgroundColor: "white", borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "#E5E7EB" }}>
      {/* رأس الطلب */}
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
          <View style={{ backgroundColor: item.orderType === "sample" ? "#f59e0b20" : "#16a34a20", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 }}>
            <Text style={{ color: item.orderType === "sample" ? "#f59e0b" : "#16a34a", fontSize: 11, fontWeight: "600" }}>
              {item.orderType === "sample" ? (isAr ? "عينة" : "Sample") : (isAr ? "منتج" : "Product")}
            </Text>
          </View>
        </View>
      </View>

      {/* بيانات العميل التجاري */}
      <View style={{ backgroundColor: "#f0f9ff", borderRadius: 8, padding: 10, marginBottom: 8 }}>
        <Text style={{ color: "#0369a1", fontWeight: "bold", fontSize: 12, textAlign: "right", marginBottom: 4 }}>
          {isAr ? "بيانات العميل" : "Client Info"}
        </Text>
        {item.clientCommercialName && (
          <Text style={{ color: "#0c4a6e", fontSize: 13, textAlign: "right" }}>
            {isAr ? "الاسم التجاري: " : "Commercial Name: "}{item.clientCommercialName}
          </Text>
        )}
        {item.clientContactName && (
          <Text style={{ color: "#0c4a6e", fontSize: 13, textAlign: "right" }}>
            {isAr ? "المسئول: " : "Contact: "}{item.clientContactName}
          </Text>
        )}
        {item.clientPhone && (
          <Text style={{ color: "#0c4a6e", fontSize: 13, textAlign: "right" }}>
            {isAr ? "الجوال: " : "Phone: "}{item.clientPhone}
          </Text>
        )}
      </View>

      {/* تفاصيل المنتج */}
      <View style={{ gap: 4 }}>
        {item.color && <Text style={{ color: "#687076", fontSize: 13, textAlign: "right" }}>{isAr ? "اللون: " : "Color: "}{item.color}</Text>}
        {item.size && <Text style={{ color: "#687076", fontSize: 13, textAlign: "right" }}>{isAr ? "المقاس: " : "Size: "}{item.size}</Text>}
        <Text style={{ color: "#687076", fontSize: 13, textAlign: "right" }}>
          {isAr ? "الكمية: " : "Qty: "}{item.quantity} {item.unit === "dozen" ? (isAr ? "درزن" : "dozen") : (isAr ? "زوج" : "pairs")}
        </Text>
        {item.orderDate && <Text style={{ color: "#687076", fontSize: 13, textAlign: "right" }}>{isAr ? "تاريخ الطلب: " : "Order Date: "}{item.orderDate}</Text>}
        {item.deliveryDate && <Text style={{ color: "#687076", fontSize: 13, textAlign: "right" }}>{isAr ? "تاريخ التسليم: " : "Delivery: "}{item.deliveryDate}</Text>}
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
          <View style={{ backgroundColor: getStatusColor(item.status) + "20", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 }}>
            <Text style={{ color: getStatusColor(item.status), fontSize: 11, fontWeight: "600" }}>{getStatusLabel(item.status)}</Text>
          </View>
          <Text style={{ color: "#9BA1A6", fontSize: 11 }}>{item.date}</Text>
        </View>
      </View>

      {/* تعميد مدير المبيعات */}
      <View style={{ marginTop: 10, borderTopWidth: 1, borderColor: "#E5E7EB", paddingTop: 10 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View style={{ flexDirection: "row", gap: 6 }}>
            {(user?.role === "admin" || user?.role === "manager" || user?.department === "sales") && (!item.salesApprovalStatus || item.salesApprovalStatus === "pending") && (
              <>
                <TouchableOpacity onPress={() => handleSalesApproval(item, "approved")} style={{ backgroundColor: "#16a34a", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <MaterialIcons name="check" size={14} color="white" />
                  <Text style={{ color: "white", fontSize: 11, fontWeight: "600" }}>{isAr ? "اعتماد" : "Approve"}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleSalesApproval(item, "rejected")} style={{ backgroundColor: "#ef4444", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, flexDirection: "row", alignItems: "center", gap: 4 }}>
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
        {item.salesApprovalStatus && item.salesApprovalStatus !== "pending" && (
          <Text style={{ color: item.salesApprovalStatus === "approved" ? "#16a34a" : "#ef4444", fontSize: 12, textAlign: "right", marginTop: 4 }}>
            {isAr ? "القرار: " : "Decision: "}{item.salesApprovalStatus === "approved" ? (isAr ? "معتمد ✓" : "Approved ✓") : (isAr ? "مرفوض ✗" : "Rejected ✗")}
            {item.salesApprovalTime ? ` (${new Date(item.salesApprovalTime).toLocaleDateString("ar-SA")})` : ""}
          </Text>
        )}
      </View>

      {/* مدير الإنتاج (بعد اعتماد مدير المبيعات) */}
      {item.salesApprovalStatus === "approved" && (
        <View style={{ marginTop: 10, borderTopWidth: 1, borderColor: "#E5E7EB", paddingTop: 10 }}>
          <Text style={{ color: "#8b5cf6", fontWeight: "bold", fontSize: 12, textAlign: "right", marginBottom: 6 }}>
            {isAr ? "مدير الإنتاج" : "Production Manager"}
          </Text>

          {/* شريط النسبة المئوية */}
          {item.productionApprovalStatus && (
            <View style={{ marginBottom: 8 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                <Text style={{ fontSize: 11, color: "#8b5cf6", fontWeight: "bold" }}>{item.productionProgress || 0}%</Text>
                <Text style={{ fontSize: 11, color: "#687076" }}>{isAr ? "نسبة الإنجاز" : "Progress"}</Text>
              </View>
              <View style={{ height: 8, backgroundColor: "#e5e7eb", borderRadius: 4, overflow: "hidden" }}>
                <View style={{ height: 8, backgroundColor: (item.productionProgress || 0) === 100 ? "#16a34a" : (item.productionProgress || 0) >= 50 ? "#f59e0b" : "#3b82f6", borderRadius: 4, width: `${item.productionProgress || 0}%` }} />
              </View>
              {/* أزرار النسب المئوية لمدير الإنتاج */}
              {(user?.role === "admin" || user?.role === "manager" || user?.department === "production") && (item.productionProgress || 0) < 100 && (
                <View style={{ flexDirection: "row", gap: 4, justifyContent: "flex-end", marginTop: 6, flexWrap: "wrap" }}>
                  {[25, 50, 75, 100].map((p) => (
                    <TouchableOpacity
                      key={p}
                      onPress={() => handleUpdateProgress(item, p)}
                      style={{ backgroundColor: (item.productionProgress || 0) >= p ? "#d1d5db" : p === 100 ? "#16a34a" : "#8b5cf6", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, opacity: (item.productionProgress || 0) >= p ? 0.5 : 1 }}
                    >
                      <Text style={{ color: "white", fontSize: 10, fontWeight: "600" }}>{p}%</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}

          {item.productionApprovalStatus ? (
            <View style={{ gap: 4 }}>
              <View style={{ flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 6 }}>
                <Text style={{ color: item.productionApprovalStatus === "completed" ? "#16a34a" : item.productionApprovalStatus === "in_progress" ? "#f59e0b" : "#3b82f6", fontSize: 12, fontWeight: "600" }}>
                  {isAr ? (item.productionApprovalStatus === "completed" ? "مكتمل" : item.productionApprovalStatus === "in_progress" ? "قيد التنفيذ" : "تم الاستلام") : (item.productionApprovalStatus === "completed" ? "Completed" : item.productionApprovalStatus === "in_progress" ? "In Progress" : "Received")}
                </Text>
                <MaterialIcons name={item.productionApprovalStatus === "completed" ? "check-circle" : item.productionApprovalStatus === "in_progress" ? "autorenew" : "inbox"} size={16} color={item.productionApprovalStatus === "completed" ? "#16a34a" : item.productionApprovalStatus === "in_progress" ? "#f59e0b" : "#3b82f6"} />
              </View>
              {item.productionNotes ? <Text style={{ color: "#687076", fontSize: 11, textAlign: "right" }}>{item.productionNotes}</Text> : null}
              {/* أزرار تحديث الحالة لمدير الإنتاج */}
              {(user?.role === "admin" || user?.role === "manager" || user?.department === "production") && item.productionApprovalStatus !== "completed" && (
                <View style={{ flexDirection: "row", gap: 6, justifyContent: "flex-end", marginTop: 6 }}>
                  {item.productionApprovalStatus === "received" && (
                    <TouchableOpacity onPress={() => handleProductionResponse(item, "in_progress")} style={{ backgroundColor: "#f59e0b", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 }}>
                      <Text style={{ color: "white", fontSize: 11, fontWeight: "600" }}>{isAr ? "بدء التنفيذ" : "Start"}</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={() => handleProductionResponse(item, "completed")} style={{ backgroundColor: "#16a34a", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 }}>
                    <Text style={{ color: "white", fontSize: 11, fontWeight: "600" }}>{isAr ? "مكتمل" : "Complete"}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ) : (
            (user?.role === "admin" || user?.role === "manager" || user?.department === "production") ? (
              <View style={{ flexDirection: "row", gap: 6, justifyContent: "flex-end" }}>
                <TouchableOpacity onPress={() => handleProductionResponse(item, "received")} style={{ backgroundColor: "#3b82f6", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 }}>
                  <Text style={{ color: "white", fontSize: 11, fontWeight: "600" }}>{isAr ? "استلام الطلب" : "Receive"}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleProductionResponse(item, "in_progress")} style={{ backgroundColor: "#f59e0b", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 }}>
                  <Text style={{ color: "white", fontSize: 11, fontWeight: "600" }}>{isAr ? "بدء التنفيذ" : "Start"}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={{ color: "#9BA1A6", fontSize: 11, textAlign: "right" }}>
                {isAr ? "بانتظار استلام مدير الإنتاج" : "Waiting for Production Manager"}
              </Text>
            )
          )}
        </View>
      )}
    </View>
  );

  const renderForm = () => (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
      {/* بيانات العميل التجاري */}
      <View style={{ backgroundColor: "#f0f9ff", borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: "#bae6fd" }}>
        <Text style={{ color: "#0369a1", fontWeight: "bold", fontSize: 14, textAlign: "right", marginBottom: 10 }}>
          {isAr ? "بيانات العميل التجاري" : "Client Commercial Info"}
        </Text>

        <Text style={{ fontWeight: "600", color: colors.foreground, textAlign: "right", marginBottom: 6 }}>{isAr ? "اسم العميل التجاري *" : "Commercial Name *"}</Text>
        <TextInput
          value={clientCommercialName}
          onChangeText={setClientCommercialName}
          placeholder={isAr ? "أدخل اسم العميل التجاري" : "Enter commercial name"}
          style={{ backgroundColor: "white", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "#E5E7EB", textAlign: "right", marginBottom: 12 }}
        />

        <Text style={{ fontWeight: "600", color: colors.foreground, textAlign: "right", marginBottom: 6 }}>{isAr ? "اسم المسئول" : "Contact Person"}</Text>
        <TextInput
          value={clientContactName}
          onChangeText={setClientContactName}
          placeholder={isAr ? "أدخل اسم المسئول" : "Enter contact name"}
          style={{ backgroundColor: "white", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "#E5E7EB", textAlign: "right", marginBottom: 12 }}
        />

        <Text style={{ fontWeight: "600", color: colors.foreground, textAlign: "right", marginBottom: 6 }}>{isAr ? "رقم الجوال" : "Phone Number"}</Text>
        <TextInput
          value={clientPhone}
          onChangeText={setClientPhone}
          placeholder={isAr ? "05XXXXXXXX" : "05XXXXXXXX"}
          keyboardType="phone-pad"
          style={{ backgroundColor: "white", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "#E5E7EB", textAlign: "right" }}
        />
      </View>

      {/* تاريخ الطلب وتاريخ التسليم */}
      <View style={{ flexDirection: "row", gap: 10, marginBottom: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: "600", color: colors.foreground, textAlign: "right", marginBottom: 6 }}>{isAr ? "تاريخ التسليم" : "Delivery Date"}</Text>
          <TextInput
            value={deliveryDate}
            onChangeText={setDeliveryDate}
            placeholder="YYYY-MM-DD"
            style={{ backgroundColor: "white", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "#E5E7EB", textAlign: "center" }}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: "600", color: colors.foreground, textAlign: "right", marginBottom: 6 }}>{isAr ? "تاريخ الطلب" : "Order Date"}</Text>
          <TextInput
            value={orderDate}
            onChangeText={setOrderDate}
            placeholder="YYYY-MM-DD"
            style={{ backgroundColor: "white", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "#E5E7EB", textAlign: "center" }}
          />
        </View>
      </View>

      {/* اسم الصنف */}
      <Text style={{ fontWeight: "600", color: colors.foreground, textAlign: "right", marginBottom: 6 }}>{isAr ? "اسم الصنف *" : "Product Name *"}</Text>
      <TextInput
        value={productName}
        onChangeText={setProductName}
        placeholder={isAr ? "أدخل اسم الصنف" : "Enter product name"}
        style={{ backgroundColor: "white", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "#E5E7EB", textAlign: "right", marginBottom: 12 }}
      />

      {/* اللون والمقاس */}
      <View style={{ flexDirection: "row", gap: 10, marginBottom: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: "600", color: colors.foreground, textAlign: "right", marginBottom: 6 }}>{isAr ? "المقاس" : "Size"}</Text>
          <TextInput
            value={size}
            onChangeText={setSize}
            placeholder={isAr ? "المقاس" : "Size"}
            style={{ backgroundColor: "white", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "#E5E7EB", textAlign: "right" }}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: "600", color: colors.foreground, textAlign: "right", marginBottom: 6 }}>{isAr ? "اللون" : "Color"}</Text>
          <TextInput
            value={color}
            onChangeText={setColor}
            placeholder={isAr ? "اللون" : "Color"}
            style={{ backgroundColor: "white", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "#E5E7EB", textAlign: "right" }}
          />
        </View>
      </View>

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
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
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

      {/* المرفقات المطلوبة */}
      <View style={{ backgroundColor: "#fef3c7", borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: "#fbbf24" }}>
        <Text style={{ color: "#92400e", fontWeight: "bold", fontSize: 14, textAlign: "right", marginBottom: 10 }}>
          {isAr ? "المرفقات المطلوبة" : "Required Attachments"}
        </Text>

        {/* نموذج التصنيع */}
        <Text style={{ fontWeight: "600", color: "#92400e", textAlign: "right", marginBottom: 6, fontSize: 13 }}>
          {isAr ? "1. نموذج التصنيع" : "1. Manufacturing Form"}
        </Text>
        <AttachmentPicker
          attachments={manufacturingFormAttachment}
          onAttachmentsChange={setManufacturingFormAttachment}
          maxAttachments={3}
        />

        {/* السجل التجاري */}
        <Text style={{ fontWeight: "600", color: "#92400e", textAlign: "right", marginBottom: 6, marginTop: 10, fontSize: 13 }}>
          {isAr ? "2. السجل التجاري" : "2. Commercial Registration"}
        </Text>
        <AttachmentPicker
          attachments={commercialRegAttachment}
          onAttachmentsChange={setCommercialRegAttachment}
          maxAttachments={3}
        />

        {/* الرقم الضريبي */}
        <Text style={{ fontWeight: "600", color: "#92400e", textAlign: "right", marginBottom: 6, marginTop: 10, fontSize: 13 }}>
          {isAr ? "3. الرقم الضريبي" : "3. Tax Number"}
        </Text>
        <AttachmentPicker
          attachments={taxNumberAttachment}
          onAttachmentsChange={setTaxNumberAttachment}
          maxAttachments={3}
        />

        {/* العنوان الوطني */}
        <Text style={{ fontWeight: "600", color: "#92400e", textAlign: "right", marginBottom: 6, marginTop: 10, fontSize: 13 }}>
          {isAr ? "4. العنوان الوطني" : "4. National Address"}
        </Text>
        <AttachmentPicker
          attachments={nationalAddressAttachment}
          onAttachmentsChange={setNationalAddressAttachment}
          maxAttachments={3}
        />

        {/* ملف التصميم */}
        <Text style={{ fontWeight: "600", color: "#92400e", textAlign: "right", marginBottom: 6, marginTop: 10, fontSize: 13 }}>
          {isAr ? "5. ملف التصميم" : "5. Design File"}
        </Text>
        <AttachmentPicker
          attachments={designFileAttachment}
          onAttachmentsChange={setDesignFileAttachment}
          maxAttachments={5}
        />
      </View>

      {/* مرفقات إضافية */}
      <Text style={{ fontWeight: "600", color: colors.foreground, textAlign: "right", marginBottom: 6 }}>{isAr ? "مرفقات إضافية (اختياري)" : "Additional Attachments (Optional)"}</Text>
      <AttachmentPicker
        attachments={attachments}
        onAttachmentsChange={setAttachments}
        maxAttachments={10}
      />

      {/* ملاحظات */}
      <Text style={{ fontWeight: "600", color: colors.foreground, textAlign: "right", marginBottom: 6, marginTop: 12 }}>{isAr ? "ملاحظات" : "Notes"}</Text>
      <TextInput
        value={notes}
        onChangeText={setNotes}
        placeholder={isAr ? "أدخل أي ملاحظات إضافية" : "Enter any additional notes"}
        multiline
        numberOfLines={4}
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
          style={{ flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: "#ec4899", alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 6 }}
        >
          <MaterialIcons name="save" size={18} color="white" />
          <Text style={{ color: "white", fontWeight: "600" }}>{editingEntry ? (isAr ? "تعديل" : "Update") : (isAr ? "حفظ ورفع للاعتماد" : "Save & Submit")}</Text>
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

      {/* توضيح سير العمل */}
      {!showForm && (
        <View style={{ marginHorizontal: 16, marginTop: 12, backgroundColor: "#faf5ff", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "#d8b4fe" }}>
          <Text style={{ color: "#7c3aed", fontWeight: "bold", fontSize: 12, textAlign: "right", marginBottom: 6 }}>
            {isAr ? "سير العمل:" : "Workflow:"}
          </Text>
          <Text style={{ color: "#6b21a8", fontSize: 11, textAlign: "right", lineHeight: 18 }}>
            {isAr ? "1. إنشاء الطلب → 2. اعتماد مدير المبيعات → 3. تحويل لمدير الإنتاج → 4. تنفيذ" : "1. Create → 2. Sales Approval → 3. Forward to Production → 4. Execute"}
          </Text>
        </View>
      )}

      <AdminCard />

      {/* زر التقرير الشهري */}
      {!showForm && entries.length > 0 && (
        <View style={{ marginHorizontal: 16, marginTop: 8 }}>
          <TouchableOpacity
            onPress={() => setShowReport(!showReport)}
            style={{ backgroundColor: "#7c3aed", paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}
          >
            <MaterialIcons name={showReport ? "close" : "assessment"} size={18} color="white" />
            <Text style={{ color: "white", fontWeight: "600", fontSize: 13 }}>
              {showReport ? (isAr ? "إغلاق التقرير" : "Close Report") : (isAr ? "التقرير الشهري" : "Monthly Report")}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* التقرير الشهري */}
      {showReport && !showForm && (() => {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        const monthEntries = entries.filter((e) => {
          const d = new Date(e.createdAt || e.date);
          return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        });
        const totalRequests = monthEntries.length;
        const approved = monthEntries.filter((e) => e.salesApprovalStatus === "approved").length;
        const rejected = monthEntries.filter((e) => e.salesApprovalStatus === "rejected").length;
        const pending = monthEntries.filter((e) => !e.salesApprovalStatus || e.salesApprovalStatus === "pending").length;
        const completed = monthEntries.filter((e) => e.status === "completed").length;
        const inProgress = monthEntries.filter((e) => e.status === "in_progress").length;

        return (
          <View style={{ marginHorizontal: 16, marginTop: 10, backgroundColor: "#f5f3ff", borderRadius: 14, padding: 16, borderWidth: 1, borderColor: "#c4b5fd" }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 12 }}>
              <MaterialIcons name="assessment" size={20} color="#7c3aed" />
              <Text style={{ color: "#7c3aed", fontWeight: "bold", fontSize: 15 }}>
                {isAr ? `تقرير شهر ${now.toLocaleDateString("ar-SA", { month: "long", year: "numeric" })}` : `Report for ${now.toLocaleDateString("en", { month: "long", year: "numeric" })}`}
              </Text>
            </View>

            {/* إحصائيات */}
            <View style={{ gap: 8 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", backgroundColor: "white", borderRadius: 10, padding: 12 }}>
                <Text style={{ color: "#7c3aed", fontWeight: "bold", fontSize: 18 }}>{totalRequests}</Text>
                <Text style={{ color: "#374151", fontWeight: "600", fontSize: 13 }}>{isAr ? "إجمالي الطلبات" : "Total Requests"}</Text>
              </View>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <View style={{ flex: 1, backgroundColor: "#dcfce7", borderRadius: 10, padding: 10, alignItems: "center" }}>
                  <Text style={{ color: "#16a34a", fontWeight: "bold", fontSize: 16 }}>{approved}</Text>
                  <Text style={{ color: "#16a34a", fontSize: 10, marginTop: 2 }}>{isAr ? "معتمدة" : "Approved"}</Text>
                </View>
                <View style={{ flex: 1, backgroundColor: "#fee2e2", borderRadius: 10, padding: 10, alignItems: "center" }}>
                  <Text style={{ color: "#ef4444", fontWeight: "bold", fontSize: 16 }}>{rejected}</Text>
                  <Text style={{ color: "#ef4444", fontSize: 10, marginTop: 2 }}>{isAr ? "مرفوضة" : "Rejected"}</Text>
                </View>
                <View style={{ flex: 1, backgroundColor: "#fef3c7", borderRadius: 10, padding: 10, alignItems: "center" }}>
                  <Text style={{ color: "#f59e0b", fontWeight: "bold", fontSize: 16 }}>{pending}</Text>
                  <Text style={{ color: "#f59e0b", fontSize: 10, marginTop: 2 }}>{isAr ? "بانتظار" : "Pending"}</Text>
                </View>
              </View>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <View style={{ flex: 1, backgroundColor: "#dbeafe", borderRadius: 10, padding: 10, alignItems: "center" }}>
                  <Text style={{ color: "#3b82f6", fontWeight: "bold", fontSize: 16 }}>{inProgress}</Text>
                  <Text style={{ color: "#3b82f6", fontSize: 10, marginTop: 2 }}>{isAr ? "قيد التنفيذ" : "In Progress"}</Text>
                </View>
                <View style={{ flex: 1, backgroundColor: "#d1fae5", borderRadius: 10, padding: 10, alignItems: "center" }}>
                  <Text style={{ color: "#059669", fontWeight: "bold", fontSize: 16 }}>{completed}</Text>
                  <Text style={{ color: "#059669", fontSize: 10, marginTop: 2 }}>{isAr ? "مكتملة" : "Completed"}</Text>
                </View>
              </View>
            </View>
          </View>
        );
      })()}

      {showForm ? renderForm() : (
        !showReport && (
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
        )
      )}
    </ScreenContainer>
  );
}
