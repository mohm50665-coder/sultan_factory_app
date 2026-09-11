import { useEffect, useState } from "react";
import { Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { ScreenContainer } from "@/components/screen-container";
import { BackButton } from "@/components/back-button";
import { AttachmentPicker } from "@/components/attachment-picker";
import type { AttachmentFile } from "@/lib/services/attachment.service";
import { sampleRequestsService } from "@/lib/services/data.service";
import { useColors } from "@/hooks/use-colors";
import { useLanguage } from "@/lib/language-context";
import { useAuth } from "@/lib/auth-context";

const emptyFiles = () => [] as AttachmentFile[];

const statusLabels: Record<string, string> = {
  incomplete: "غير مكتمل",
  pending_sales: "بانتظار اعتماد مدير المبيعات",
  approved_sales: "معتمد من المبيعات",
  rejected_sales: "مرفوض من المبيعات",
  approved_production: "محول للإنتاج",
  in_production: "قيد الإنتاج",
  ready_for_requester: "جاهز للتسليم",
  completed: "مكتمل",
};

export default function SampleRequestsScreen() {
  const colors = useColors();
  const { language } = useLanguage();
  const { user } = useAuth();
  const isAr = language === "ar";
  const [requests, setRequests] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [clientName, setClientName] = useState("");
  const [productName, setProductName] = useState("");
  const [productSize, setProductSize] = useState("");
  const [productColor, setProductColor] = useState("");
  const [quantity, setQuantity] = useState("");
  const [quantityUnit, setQuantityUnit] = useState<"dozen" | "pair">("dozen");
  const [specifications, setSpecifications] = useState("");
  const [designAttachments, setDesignAttachments] = useState<AttachmentFile[]>(emptyFiles());
  const [manufacturingFormAttachments, setManufacturingFormAttachments] = useState<AttachmentFile[]>(emptyFiles());
  const [transferReceiptAttachments, setTransferReceiptAttachments] = useState<AttachmentFile[]>(emptyFiles());
  const [signatureAttachments, setSignatureAttachments] = useState<AttachmentFile[]>(emptyFiles());
  const [sampleMediaAttachments, setSampleMediaAttachments] = useState<AttachmentFile[]>(emptyFiles());
  const [notes, setNotes] = useState("");

  const loadRequests = async () => {
    try {
      const rows = await sampleRequestsService.list();
      setRequests(Array.isArray(rows) ? rows : []);
    } catch (error) {
      console.error("Sample requests load failed", error);
    }
  };

  useEffect(() => { loadRequests(); }, []);

  const resetForm = () => {
    setEditingId(null);
    setClientName(""); setProductName(""); setProductSize(""); setProductColor(""); setQuantity("");
    setQuantityUnit("dozen"); setSpecifications(""); setDesignAttachments(emptyFiles());
    setManufacturingFormAttachments(emptyFiles()); setTransferReceiptAttachments(emptyFiles());
    setSignatureAttachments(emptyFiles()); setSampleMediaAttachments(emptyFiles()); setNotes("");
  };

  const saveRequest = async () => {
    if (!clientName.trim() || !productName.trim() || !productSize.trim() || !productColor.trim() || !specifications.trim() || (Number(quantity) || 0) <= 0) {
      Alert.alert(isAr ? "بيانات ناقصة" : "Incomplete data", isAr ? "أكمل بيانات العميل والمنتج والكمية والمواصفات" : "Complete client, product, quantity and specification fields");
      return;
    }
    if (Number(quantity) > 10) {
      Alert.alert(isAr ? "الحد الأعلى 10 عينات" : "Maximum 10 samples", isAr ? "لا يمكن أن يتجاوز الطلب 10 عينات" : "A request cannot exceed 10 samples");
      return;
    }
    if (!designAttachments.length || !manufacturingFormAttachments.length || !transferReceiptAttachments.length || !signatureAttachments.length) {
      Alert.alert(isAr ? "المرفقات إلزامية" : "Attachments required", isAr ? "أرفق التصميم ونموذج التصنيع وإيصال التحويل والتوقيع" : "Attach the design, manufacturing form, transfer receipt and signature");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        clientName: clientName.trim(), productName: productName.trim(), productSize: productSize.trim(), productColor: productColor.trim(),
        quantity: Number(quantity), quantityUnit, specifications: specifications.trim(), notes: notes.trim(),
      };
      const result = editingId
        ? await sampleRequestsService.update({ id: editingId, ...payload })
        : await sampleRequestsService.create({ ...payload, designAttachments, manufacturingFormAttachments, transferReceiptAttachments, signatureAttachments, sampleMediaAttachments });
      Alert.alert(editingId ? (isAr ? "تم تعديل الطلب" : "Request updated") : (isAr ? "تم إنشاء الطلب" : "Request created"), `${isAr ? "الرقم المرجعي" : "Reference"}: ${result?.referenceCode || "-"}`);
      resetForm(); setShowForm(false); await loadRequests();
    } catch (error: any) {
      Alert.alert(isAr ? "تعذر الحفظ" : "Save failed", error?.message || (isAr ? "تعذر إنشاء طلب العينة" : "Could not create sample request"));
    } finally { setSaving(false); }
  };

  const beginEdit = (request: any) => {
    setEditingId(request.id);
    setClientName(request.clientName || ""); setProductName(request.productName || ""); setProductSize(request.productSize || ""); setProductColor(request.productColor || ""); setQuantity(String(request.quantity || ""));
    setQuantityUnit(request.quantityUnit === "pair" ? "pair" : "dozen"); setSpecifications(request.specifications || ""); setNotes(request.notes || "");
    setShowForm(true);
  };

  const deleteRequest = async (id: number) => {
    try {
      await sampleRequestsService.delete({ id });
      await loadRequests();
    } catch (error: any) {
      Alert.alert(isAr ? "تعذر الحذف" : "Delete failed", error?.message || "");
    }
  };

  const completeDelivery = async (request: any) => {
    try {
      await sampleRequestsService.completeDelivery({ id: request.id, deliveredTo: request.clientName || request.requesterName, receivedBy: request.requesterName || request.clientName });
      await loadRequests();
    } catch (error: any) {
      Alert.alert(isAr ? "تعذر إتمام التسليم" : "Delivery failed", error?.message || "");
    }
  };

  const updateStatus = async (id: number, status: string) => {
    try {
      await sampleRequestsService.updateStatus({ id, status });
      await loadRequests();
    } catch (error: any) {
      Alert.alert(isAr ? "تعذر تحديث الحالة" : "Status update failed", error?.message || "");
    }
  };

  const field = (label: string, value: string, setter: (value: string) => void, placeholder = "") => (
    <View style={{ marginBottom: 10 }}>
      <Text style={{ color: colors.foreground, textAlign: "right", fontWeight: "700", marginBottom: 4 }}>{label}</Text>
      <TextInput value={value} onChangeText={setter} placeholder={placeholder || label} placeholderTextColor={colors.muted} style={{ borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, color: colors.foreground, borderRadius: 8, padding: 10, textAlign: "right" }} />
    </View>
  );

  return (
    <ScreenContainer className="p-4">
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <BackButton />
          <View style={{ alignItems: "flex-end", flex: 1 }}><Text style={{ color: colors.foreground, fontSize: 22, fontWeight: "900" }}>{isAr ? "طلبات العينات" : "Sample Requests"}</Text><Text style={{ color: colors.muted, fontSize: 11 }}>{isAr ? "طلب واحد مرتبط بالإنتاج والعهدة والتسليم" : "One request linked to production, custody and delivery"}</Text></View>
          <MaterialIcons name="science" size={28} color={colors.primary} />
        </View>
        {!showForm && <TouchableOpacity onPress={() => { resetForm(); setShowForm(true); }} style={{ backgroundColor: colors.primary, borderRadius: 9, padding: 12, alignItems: "center", marginBottom: 14 }}><Text style={{ color: "#fff", fontWeight: "900" }}>{isAr ? "+ طلب عينة جديد" : "+ New sample request"}</Text></TouchableOpacity>}
        {showForm && <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, backgroundColor: colors.surface, marginBottom: 16 }}>
          <Text style={{ color: colors.foreground, fontWeight: "900", fontSize: 16, textAlign: "right", marginBottom: 10 }}>{editingId ? (isAr ? "تعديل طلب العينة" : "Edit sample request") : (isAr ? "بيانات طلب العينة" : "Sample request details")}</Text>
          {field(isAr ? "اسم العميل" : "Client name", clientName, setClientName)}
          {field(isAr ? "اسم المنتج" : "Product name", productName, setProductName)}
          <View style={{ flexDirection: "row", gap: 8 }}>{field(isAr ? "المقاس" : "Size", productSize, setProductSize)}<View style={{ flex: 1 }}>{field(isAr ? "اللون" : "Color", productColor, setProductColor)}</View></View>
          <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-end" }}><View style={{ flex: 1 }}>{field(isAr ? "الكمية (حد أقصى 10)" : "Quantity (max 10)", quantity, setQuantity)}</View><View style={{ flex: 1 }}><Text style={{ color: colors.foreground, textAlign: "right", fontWeight: "700", marginBottom: 4 }}>{isAr ? "الوحدة" : "Unit"}</Text><View style={{ flexDirection: "row", gap: 6 }}><TouchableOpacity onPress={() => setQuantityUnit("dozen")} style={{ flex: 1, padding: 10, borderRadius: 8, backgroundColor: quantityUnit === "dozen" ? colors.primary : colors.background, borderWidth: 1, borderColor: colors.border }}><Text style={{ color: quantityUnit === "dozen" ? "#fff" : colors.foreground, textAlign: "center" }}>{isAr ? "درزن" : "Dozen"}</Text></TouchableOpacity><TouchableOpacity onPress={() => setQuantityUnit("pair")} style={{ flex: 1, padding: 10, borderRadius: 8, backgroundColor: quantityUnit === "pair" ? colors.primary : colors.background, borderWidth: 1, borderColor: colors.border }}><Text style={{ color: quantityUnit === "pair" ? "#fff" : colors.foreground, textAlign: "center" }}>{isAr ? "زوج" : "Pair"}</Text></TouchableOpacity></View></View></View>
          {field(isAr ? "المواصفات المطلوبة" : "Required specifications", specifications, setSpecifications)}
          <TextInput value={notes} onChangeText={setNotes} multiline placeholder={isAr ? "ملاحظات" : "Notes"} placeholderTextColor={colors.muted} style={{ minHeight: 70, borderWidth: 1, borderColor: colors.border, color: colors.foreground, borderRadius: 8, padding: 10, textAlign: "right", marginBottom: 10 }} />
          <AttachmentPicker attachments={designAttachments} onAttachmentsChange={setDesignAttachments} language={language} maxAttachments={10} />
          <AttachmentPicker attachments={manufacturingFormAttachments} onAttachmentsChange={setManufacturingFormAttachments} language={language} maxAttachments={10} />
          <AttachmentPicker attachments={transferReceiptAttachments} onAttachmentsChange={setTransferReceiptAttachments} language={language} maxAttachments={10} />
          <AttachmentPicker attachments={signatureAttachments} onAttachmentsChange={setSignatureAttachments} language={language} maxAttachments={10} />
          <AttachmentPicker attachments={sampleMediaAttachments} onAttachmentsChange={setSampleMediaAttachments} language={language} maxAttachments={10} />
          <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}><TouchableOpacity onPress={() => { resetForm(); setShowForm(false); }} style={{ flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 11, alignItems: "center" }}><Text style={{ color: colors.foreground }}>{isAr ? "إلغاء" : "Cancel"}</Text></TouchableOpacity><TouchableOpacity onPress={saveRequest} disabled={saving} style={{ flex: 1, backgroundColor: colors.primary, borderRadius: 8, padding: 11, alignItems: "center" }}><Text style={{ color: "#fff", fontWeight: "900" }}>{saving ? (isAr ? "جارٍ الحفظ" : "Saving") : (editingId ? (isAr ? "حفظ التعديل" : "Save changes") : (isAr ? "رفع الطلب" : "Submit request"))}</Text></TouchableOpacity></View>
        </View>}
        {requests.map((request) => <View key={request.id} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, marginBottom: 10, backgroundColor: colors.surface }}><View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}><Text style={{ color: colors.primary, fontWeight: "900" }}>{request.referenceCode}</Text><Text style={{ color: colors.foreground, fontWeight: "900", textAlign: "right", flex: 1 }}>{request.productName}</Text></View><Text style={{ color: colors.muted, textAlign: "right", marginTop: 5 }}>{request.clientName} • {request.productSize} • {request.productColor} • {request.quantity} {request.quantityUnit === "dozen" ? (isAr ? "درزن" : "dozen") : (isAr ? "زوج" : "pair")}</Text><Text style={{ color: request.status === "rejected_sales" ? colors.error : colors.primary, textAlign: "right", fontWeight: "800", marginTop: 6 }}>{statusLabels[request.status] || request.status}</Text>{(user?.role === "admin" || request.requesterId === user?.id) && ["incomplete", "pending_sales", "rejected_sales"].includes(request.status) && <View style={{ flexDirection: "row", gap: 8, marginTop: 9 }}><TouchableOpacity onPress={() => beginEdit(request)} style={{ flex: 1, backgroundColor: "#dbeafe", padding: 9, borderRadius: 8, alignItems: "center" }}><Text style={{ color: "#1d4ed8", fontWeight: "800" }}>{isAr ? "تعديل" : "Edit"}</Text></TouchableOpacity><TouchableOpacity onPress={() => deleteRequest(request.id)} style={{ flex: 1, backgroundColor: "#fee2e2", padding: 9, borderRadius: 8, alignItems: "center" }}><Text style={{ color: "#b91c1c", fontWeight: "800" }}>{isAr ? "حذف" : "Delete"}</Text></TouchableOpacity></View>}{request.status === "pending_sales" && (user?.role === "admin" || String(user?.department || "").includes("sales") || String(user?.position || "").includes("مدير المبيعات")) && <View style={{ flexDirection: "row", gap: 8, marginTop: 9 }}><TouchableOpacity onPress={() => updateStatus(request.id, "rejected_sales")} style={{ flex: 1, backgroundColor: "#fee2e2", padding: 9, borderRadius: 8, alignItems: "center" }}><Text style={{ color: "#b91c1c", fontWeight: "800" }}>{isAr ? "رفض" : "Reject"}</Text></TouchableOpacity><TouchableOpacity onPress={() => updateStatus(request.id, "approved_sales")} style={{ flex: 1, backgroundColor: "#dcfce7", padding: 9, borderRadius: 8, alignItems: "center" }}><Text style={{ color: "#166534", fontWeight: "800" }}>{isAr ? "اعتماد المبيعات" : "Approve sales"}</Text></TouchableOpacity></View>}{request.status === "ready_for_requester" && (user?.role === "admin" || request.requesterId === user?.id) && <TouchableOpacity onPress={() => completeDelivery(request)} style={{ marginTop: 9, backgroundColor: "#dcfce7", padding: 9, borderRadius: 8, alignItems: "center" }}><Text style={{ color: "#166534", fontWeight: "800" }}>{isAr ? "تأكيد التسليم لطالب العينة" : "Confirm delivery to requester"}</Text></TouchableOpacity>}{request.status === "approved_sales" && (user?.role === "admin" || String(user?.department || "").includes("production") || String(user?.position || "").includes("مدير الإنتاج")) && <TouchableOpacity onPress={() => updateStatus(request.id, "approved_production")} style={{ marginTop: 9, backgroundColor: "#dbeafe", padding: 9, borderRadius: 8, alignItems: "center" }}><Text style={{ color: "#1d4ed8", fontWeight: "800" }}>{isAr ? "تحويل إلى الإنتاج" : "Send to production"}</Text></TouchableOpacity>}</View>)}
        {requests.length === 0 && <Text style={{ color: colors.muted, textAlign: "center", marginTop: 20 }}>{isAr ? "لا توجد طلبات عينات" : "No sample requests"}</Text>}
      </ScrollView>
    </ScreenContainer>
  );
}
