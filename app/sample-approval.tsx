import { useEffect, useState } from "react";
import { Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { sampleRequestsService } from "@/lib/services/data.service";
import { AttachmentPicker } from "@/components/attachment-picker";
import { attachmentService, type AttachmentFile } from "@/lib/services/attachment.service";

export default function SampleApprovalScreen() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const [request, setRequest] = useState<any>(null);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);

  useEffect(() => {
    if (!token) { setMessage("رابط الاعتماد غير مكتمل"); setLoading(false); return; }
    sampleRequestsService.getCustomerApproval(String(token)).then(setRequest).catch((e: any) => setMessage(e?.message || "الرابط غير صالح")).finally(() => setLoading(false));
  }, [token]);

  const decide = async (decision: "approved" | "rejected") => {
    if (!token) return;
    if (decision === "rejected" && !reason.trim()) { Alert.alert("سبب الرفض مطلوب", "اكتب سبب عدم الموافقة حتى يتمكن المصنع من المعالجة"); return; }
    setSaving(true);
    try {
      const uploaded = await Promise.all(attachments.map(async (file) => ({ ...file, uploadedUrl: await attachmentService.uploadAttachment(file) })));
      await sampleRequestsService.approveByCustomer({ token: String(token), decision, reason: reason.trim() || undefined, attachments: uploaded.map((file) => ({ name: file.name, type: file.type, url: file.uploadedUrl || file.uri })) });
      setRequest((old: any) => ({ ...old, customerApprovalStatus: decision, customerApprovalReason: reason.trim() }));
      Alert.alert("تم تسجيل القرار", decision === "approved" ? "تمت الموافقة على العينة" : "تم تسجيل عدم الموافقة");
    } catch (e: any) { Alert.alert("تعذر التسجيل", e?.message || "حاول مرة أخرى"); }
    finally { setSaving(false); }
  };

  if (loading) return <ScreenContainer className="p-5"><Text style={{ textAlign: "right", fontSize: 18 }}>جارٍ تحميل العينة...</Text></ScreenContainer>;
  if (!request) return <ScreenContainer className="p-5"><Text style={{ textAlign: "right", fontSize: 20, fontWeight: "800" }}>{message || "لا توجد عينة"}</Text></ScreenContainer>;
  const decided = ["approved", "rejected"].includes(String(request.customerApprovalStatus));
  return <ScreenContainer className="p-4"><ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
    <View style={{ backgroundColor: "#0f766e", borderRadius: 16, padding: 18, marginBottom: 14 }}><Text style={{ color: "#fff", textAlign: "right", fontSize: 23, fontWeight: "900" }}>اعتماد عينة مصنع السلطان</Text><Text style={{ color: "#d1fae5", textAlign: "right", marginTop: 6 }}>المرجع: {request.referenceCode}</Text></View>
    <View style={{ borderWidth: 1, borderColor: "#d1d5db", borderRadius: 12, padding: 14, gap: 9 }}>
      <Text style={{ textAlign: "right", fontWeight: "900", fontSize: 19 }}>{request.clientName || "عميل"}</Text>
      <Text style={{ textAlign: "right" }}>المنتج: {request.productName}</Text><Text style={{ textAlign: "right" }}>المقاس: {request.productSize} — اللون: {request.productColor}</Text><Text style={{ textAlign: "right" }}>الكمية: {request.quantity} {request.quantityUnit === "dozen" ? "درزن" : "زوج"}</Text>
      <Text style={{ textAlign: "right", fontWeight: "800", marginTop: 8 }}>المواصفات</Text><Text style={{ textAlign: "right", lineHeight: 23 }}>{request.specifications}</Text>
    </View>
    {request.customerApprovalReason ? <Text style={{ textAlign: "right", color: request.customerApprovalStatus === "rejected" ? "#b91c1c" : "#166534", marginTop: 12, fontWeight: "800" }}>القرار المسجل: {request.customerApprovalStatus === "approved" ? "موافق" : "غير موافق"} — {request.customerApprovalReason}</Text> : null}
    {!decided ? <View style={{ marginTop: 16 }}><Text style={{ textAlign: "right", fontWeight: "800", marginBottom: 6 }}>ملاحظات العميل عند الحاجة</Text><TextInput value={reason} onChangeText={setReason} multiline placeholder="سبب عدم الموافقة أو أي ملاحظة" style={{ minHeight: 90, borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 10, padding: 10, textAlign: "right" }} /><AttachmentPicker attachments={attachments} onAttachmentsChange={setAttachments} language="ar" maxAttachments={5} /><View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}><TouchableOpacity disabled={saving} onPress={() => decide("rejected")} style={{ flex: 1, backgroundColor: "#fee2e2", padding: 13, borderRadius: 10, alignItems: "center" }}><Text style={{ color: "#991b1b", fontWeight: "900" }}>غير موافق</Text></TouchableOpacity><TouchableOpacity disabled={saving} onPress={() => decide("approved")} style={{ flex: 1, backgroundColor: "#dcfce7", padding: 13, borderRadius: 10, alignItems: "center" }}><Text style={{ color: "#166534", fontWeight: "900" }}>موافق</Text></TouchableOpacity></View></View> : <Text style={{ textAlign: "right", marginTop: 18, color: "#166534", fontWeight: "900" }}>تم إغلاق رابط الاعتماد بعد تسجيل القرار.</Text>}
  </ScrollView></ScreenContainer>;
}
