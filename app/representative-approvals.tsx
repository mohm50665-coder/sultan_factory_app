import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Linking, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import * as Print from "expo-print";

import { AttachmentPicker } from "@/components/attachment-picker";
import { BackButton } from "@/components/back-button";
import { ScreenContainer } from "@/components/screen-container";
import { SignaturePad } from "@/components/signature-pad";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/lib/auth-context";
import { AttachmentFile } from "@/lib/services/attachment.service";
import { representativeService } from "@/lib/services/representative.service";

const STATUS: Record<string, string> = { DRAFT: "مسودة", PENDING_SALES_APPROVAL: "بانتظار اعتماد مدير التسويق", REJECTED_SALES: "مرفوض من مدير التسويق", PENDING_WAREHOUSE_INVOICE: "بانتظار إصدار الفاتورة", RETURNED_TO_REPRESENTATIVE: "بانتظار استلام المندوب للفاتورة", PENDING_PRODUCTION_APPROVAL: "بانتظار اعتماد مدير الإنتاج", PENDING_SALES_RESOLUTION: "بانتظار الحل والإجراء التصحيحي", IN_PRODUCTION: "قيد التصنيع", READY_FOR_REPRESENTATIVE: "جاهز لاستلام المندوب", CLOSED: "مغلق", CLOSED_REJECTED: "مغلق بالرفض" };
const TYPE: Record<string, string> = { order: "طلب عادي", visit: "زيارة", return: "مرتجع", custom: "تصنيع خاص", sample: "عينة" };
const toInputAttachment = (type: string, file: AttachmentFile) => ({ type, name: file.name, url: file.uploadedUrl || file.uri, mimeType: file.mimeType });

export default function RepresentativeApprovalsScreen() {
  const colors = useColors();
  const params = useLocalSearchParams<{ id?: string }>();
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [correctiveAction, setCorrectiveAction] = useState("");
  const [files, setFiles] = useState<AttachmentFile[]>([]);
  const [signature, setSignature] = useState("");
  const isManager = user?.role === "admin" || user?.role === "manager" || user?.role === "supervisor";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (isManager) await representativeService.scanOverdue().catch(() => null);
      const approvalRows = await representativeService.approvals();
      const list = Array.isArray(approvalRows) ? approvalRows : [];
      setRows(list);
      const requestedId = Number(params.id || 0);
      if (requestedId) setSelected(await representativeService.transactions.getById(requestedId));
    } catch (error: any) { Alert.alert("تعذر تحميل الاعتمادات", error?.message || "حدث خطأ"); }
    finally { setLoading(false); }
  }, [params.id, isManager]);
  useEffect(() => { void load(); }, [load]);

  const open = async (id: number) => {
    try { setSelected(await representativeService.transactions.getById(id)); setNotes(""); setInvoiceNumber(""); setCorrectiveAction(""); setFiles([]); setSignature(""); }
    catch (error: any) { Alert.alert("تعذر فتح المعاملة", error?.message || "حدث خطأ"); }
  };

  const action = async (name: string) => {
    if (!selected) return;
    try {
      const attachments = files.map((file) => toInputAttachment(name === "warehouse_invoice" ? "invoice" : "corrective_evidence", file));
      if (name === "representative_close" || name === "representative_receive") {
        if (!signature) return Alert.alert("التوقيع مطلوب", "وقّع الإقرار قبل الإغلاق");
        await representativeService.transactions.sign({ id: selected.id, declarationType: name === "representative_close" ? "representative_receipt" : "representative_sample_receipt", declarationText: name === "representative_close" ? `أقر باستلام فاتورة المعاملة ${selected.referenceCode}` : `أقر باستلام العينة/المنتج للمعاملة ${selected.referenceCode} بتاريخ ${new Date().toLocaleString("ar-SA")}`, declarerName: user?.name || "المندوب", declarerRole: "مندوب المبيعات", signatureData: signature });
      }
      await representativeService.transactions.transition({ id: selected.id, action: name, notes, attachments, invoiceNumber, correctiveAction: name === "sales_resubmit" ? { action: correctiveAction, evidence: attachments } : undefined });
      Alert.alert("تم تنفيذ الإجراء", "تم تحديث الحالة وإرسال الإشعار الرسمي للجهة التالية");
      setSelected(null); await load();
    } catch (error: any) { Alert.alert("تعذر تنفيذ الإجراء", error?.message || "حدث خطأ"); }
  };

  const deleteDraft = () => {
    if (!selected) return;
    Alert.alert("تأكيد حذف المسودة", `سيتم حذف ${selected.referenceCode} حذفاً آمناً مع تسجيل العملية.`, [
      { text: "إلغاء", style: "cancel" },
      { text: "حذف", style: "destructive", onPress: async () => {
        try {
          await representativeService.transactions.softDelete(Number(selected.id), "حذف المسودة قبل الإرسال للاعتماد");
          setSelected(null);
          await load();
          Alert.alert("تم الحذف", "حُذفت المسودة من القائمة وسُجلت العملية في سجل التدقيق");
        } catch (error: any) {
          Alert.alert("تعذر الحذف", error?.message || "حدث خطأ");
        }
      } },
    ]);
  };

  const printDetail = async () => {
    if (!selected) return;
    const items = (selected.items || []).map((item: any) => `<tr><td>${item.productName}</td><td>${item.size}</td><td>${item.color}</td><td>${item.quantity} ${item.quantityUnit === "dozen" ? "درزن" : "زوج"}</td></tr>`).join("");
    const events = (selected.events || []).map((event: any) => `<tr><td>${event.action}</td><td>${STATUS[event.toStatus] || event.toStatus}</td><td>${event.actorName}</td><td>${new Date(event.createdAt).toLocaleString("ar-SA")}</td><td>${event.durationMinutes || 0} دقيقة</td><td>${event.notes || "—"}</td></tr>`).join("");
    await Print.printAsync({ html: `<html dir="rtl"><head><meta charset="utf-8"><style>body{font-family:Arial;padding:24px;color:#0f172a}h1{color:#0a7ea4}table{width:100%;border-collapse:collapse;margin:12px 0}th,td{border:1px solid #cbd5e1;padding:8px;text-align:right}th{background:#e0f2fe}.meta{background:#f8fafc;padding:12px;border-radius:8px;line-height:1.9}</style></head><body><h1>تقرير المعاملة ${selected.referenceCode}</h1><div class="meta">النوع: ${TYPE[selected.transactionType]}<br>العميل: ${selected.customerName}<br>المندوب: ${selected.representativeName}<br>الحالة: ${STATUS[selected.status] || selected.status}<br>تاريخ الطلب: ${selected.orderDate || "—"}<br>موعد التسليم: ${selected.deliveryDate || "—"}</div><h2>المنتجات</h2><table><tr><th>المنتج</th><th>المقاس</th><th>اللون</th><th>الكمية</th></tr>${items}</table><h2>السجل الزمني</h2><table><tr><th>الإجراء</th><th>الحالة</th><th>المنفذ</th><th>الوقت</th><th>المدة</th><th>الملاحظات</th></tr>${events}</table></body></html>` });
  };

  const events = useMemo(() => selected?.events || [], [selected]);

  if (selected) return <ScreenContainer style={{ backgroundColor: colors.background }}><View style={styles.header}><BackButton onPress={() => setSelected(null)} /><View style={{ flex: 1 }}><Text style={styles.headerTitle}>{selected.referenceCode}</Text><Text style={styles.headerSubtitle}>{TYPE[selected.transactionType]} · {selected.customerName}</Text></View><TouchableOpacity style={styles.headerButton} onPress={() => void printDetail()}><MaterialIcons name="print" size={22} color="#fff" /></TouchableOpacity></View><ScrollView contentContainerStyle={styles.content}><View style={styles.summary}><Text style={styles.summaryTitle}>{STATUS[selected.status] || selected.status}</Text><Text style={styles.summaryText}>المندوب: {selected.representativeName}</Text><Text style={styles.summaryText}>المسؤول الحالي: {selected.currentDepartment}</Text><Text style={styles.summaryText}>التاريخ: {selected.orderDate || "—"} · التسليم: {selected.deliveryDate || "—"}</Text>{selected.rejectionReason ? <Text style={styles.rejection}>سبب الرفض: {selected.rejectionReason}</Text> : null}</View><Text style={styles.sectionTitle}>بيانات العميل</Text><View style={styles.box}><Text style={styles.rowText}>{selected.customer?.name}</Text><Text style={styles.rowText}>السجل: {selected.customer?.commercialRegister} · الضريبي: {selected.customer?.taxNumber || "غير مسجل"}</Text><Text style={styles.rowText}>{selected.customer?.city} / {selected.customer?.district} / {selected.customer?.street}</Text><Text style={styles.rowText}>المسؤول: {selected.customer?.contactName} · {selected.customer?.contactPhone}</Text></View><Text style={styles.sectionTitle}>المنتجات</Text>{(selected.items || []).map((item: any) => <View key={item.id} style={styles.item}><Text style={styles.itemTitle}>{item.productName}</Text><Text style={styles.rowText}>{item.size} · {item.color} · {item.quantity} {item.quantityUnit === "dozen" ? "درزن" : "زوج"}</Text>{item.productType ? <Text style={styles.rowText}>{item.productType}</Text> : null}</View>)}<Text style={styles.sectionTitle}>المرفقات</Text><View style={styles.wrap}>{(selected.uploadedAttachments || []).map((attachment: any) => <TouchableOpacity key={attachment.id} style={styles.attachmentChip} onPress={() => Linking.openURL(attachment.fileUrl)}><MaterialIcons name="attach-file" size={16} color="#0369a1" /><Text style={styles.attachmentText}>{attachment.fileName}</Text></TouchableOpacity>)}</View><Text style={styles.sectionTitle}>السجل الزمني</Text>{events.map((event: any, index: number) => <View key={event.id} style={styles.timeline}><View style={styles.timelineDot} /><View style={{ flex: 1 }}><Text style={styles.eventTitle}>{STATUS[event.toStatus] || event.toStatus}</Text><Text style={styles.eventMeta}>{event.actorName} · {new Date(event.createdAt).toLocaleString("ar-SA")}</Text><Text style={styles.eventMeta}>المدة منذ الإجراء السابق: {event.durationMinutes || 0} دقيقة</Text>{event.notes ? <Text style={styles.eventNotes}>{event.notes}</Text> : null}</View><Text style={styles.eventIndex}>{index + 1}</Text></View>)}
      {selected.status === "DRAFT" && <View style={styles.actionBox}><Text style={styles.sectionTitle}>إدارة المسودة</Text><Text style={styles.rowText}>يمكن تعديل المسودة من شاشة المعاملات أو حذفها بأمان قبل إرسالها للاعتماد.</Text><TouchableOpacity style={[styles.action, styles.reject]} onPress={deleteDraft}><Text style={styles.rejectText}>حذف المسودة</Text></TouchableOpacity></View>}
      {selected.status === "PENDING_SALES_APPROVAL" && <View style={styles.actionBox}><Text style={styles.sectionTitle}>قرار مدير التسويق والمبيعات</Text><TextInput value={notes} onChangeText={setNotes} placeholder="سبب الرفض أو ملاحظة الاعتماد" multiline style={styles.textarea} textAlign="right" /><View style={styles.actions}><TouchableOpacity style={[styles.action, styles.reject]} onPress={() => void action("sales_reject")}><Text style={styles.rejectText}>رفض وإغلاق</Text></TouchableOpacity><TouchableOpacity style={[styles.action, styles.approve]} onPress={() => void action("sales_approve")}><Text style={styles.approveText}>اعتماد وتوجيه</Text></TouchableOpacity></View></View>}
      {selected.status === "PENDING_WAREHOUSE_INVOICE" && <View style={styles.actionBox}><Text style={styles.sectionTitle}>إصدار الفاتورة</Text><TextInput value={invoiceNumber} onChangeText={setInvoiceNumber} placeholder="رقم الفاتورة" style={styles.input} textAlign="right" /><AttachmentPicker attachments={files} onAttachmentsChange={setFiles} maxAttachments={3} /><TouchableOpacity style={[styles.action, styles.approve]} onPress={() => void action("warehouse_invoice")}><Text style={styles.approveText}>إرفاق الفاتورة وإعادتها للمندوب</Text></TouchableOpacity></View>}
      {selected.status === "PENDING_PRODUCTION_APPROVAL" && <View style={styles.actionBox}><Text style={styles.sectionTitle}>قرار مدير الإنتاج</Text><TextInput value={notes} onChangeText={setNotes} placeholder="سبب الرفض عند الرفض" multiline style={styles.textarea} textAlign="right" /><View style={styles.actions}><TouchableOpacity style={[styles.action, styles.reject]} onPress={() => void action("production_reject")}><Text style={styles.rejectText}>رفض مع السبب</Text></TouchableOpacity><TouchableOpacity style={[styles.action, styles.approve]} onPress={() => void action("production_approve")}><Text style={styles.approveText}>قبول وبدء الإنتاج</Text></TouchableOpacity></View></View>}
      {selected.status === "PENDING_SALES_RESOLUTION" && <View style={styles.actionBox}><Text style={styles.sectionTitle}>الإجراء التصحيحي</Text><TextInput value={correctiveAction} onChangeText={setCorrectiveAction} placeholder="اكتب الإجراء الواضح وفق نظام الجودة" multiline style={styles.textarea} textAlign="right" /><AttachmentPicker attachments={files} onAttachmentsChange={setFiles} maxAttachments={5} /><View style={styles.actions}><TouchableOpacity style={[styles.action, styles.reject]} onPress={() => void action("sales_accept_rejection")}><Text style={styles.rejectText}>قبول الرفض وإغلاق</Text></TouchableOpacity><TouchableOpacity style={[styles.action, styles.approve]} onPress={() => void action("sales_resubmit")}><Text style={styles.approveText}>إرفاق الحل وإعادة التوجيه</Text></TouchableOpacity></View></View>}
      {selected.status === "IN_PRODUCTION" && <View style={styles.actionBox}><TextInput value={notes} onChangeText={setNotes} placeholder="ملاحظات إتمام العينة/المنتج" style={styles.input} textAlign="right" /><TouchableOpacity style={[styles.action, styles.approve]} onPress={() => void action("production_ready")}><Text style={styles.approveText}>تم التجهيز وتسليمها للمندوب</Text></TouchableOpacity></View>}
      {["RETURNED_TO_REPRESENTATIVE", "READY_FOR_REPRESENTATIVE"].includes(selected.status) && <View style={styles.actionBox}><SignaturePad label={selected.status === "RETURNED_TO_REPRESENTATIVE" ? "توقيع المندوب على استلام الفاتورة" : "توقيع المندوب على استلام العينة/المنتج"} onSave={setSignature} /><TouchableOpacity style={[styles.action, styles.approve]} onPress={() => void action(selected.status === "RETURNED_TO_REPRESENTATIVE" ? "representative_close" : "representative_receive")}><Text style={styles.approveText}>تسجيل الاستلام وإغلاق المعاملة</Text></TouchableOpacity></View>}
    </ScrollView></ScreenContainer>;

  return <ScreenContainer style={{ backgroundColor: colors.background }}><View style={styles.header}><BackButton /><View style={{ flex: 1 }}><Text style={styles.headerTitle}>الاعتمادات والطلبات</Text><Text style={styles.headerSubtitle}>المعاملات المطلوب اتخاذ إجراء عليها حسب صلاحيتك</Text></View><TouchableOpacity style={styles.headerButton} onPress={() => void load()}><MaterialIcons name="refresh" size={22} color="#fff" /></TouchableOpacity></View>{loading ? <ActivityIndicator style={{ marginTop: 50 }} color={colors.primary} /> : <ScrollView contentContainerStyle={styles.list}>{rows.length === 0 ? <Text style={styles.empty}>لا توجد معاملات بانتظار إجراء منك</Text> : rows.map((row) => <TouchableOpacity key={row.id} style={styles.card} onPress={() => void open(Number(row.id))}><View style={styles.cardIcon}><MaterialIcons name={row.transactionType === "sample" ? "science" : row.transactionType === "custom" ? "design-services" : "assignment"} size={23} color="#0a7ea4" /></View><View style={{ flex: 1 }}><Text style={styles.cardTitle}>{row.customerName}</Text><Text style={styles.cardMeta}>{row.referenceCode} · {TYPE[row.transactionType]}</Text><Text style={styles.cardMeta}>{STATUS[row.status] || row.status}</Text></View><MaterialIcons name="chevron-left" size={24} color="#94a3b8" /></TouchableOpacity>)}</ScrollView>}</ScreenContainer>;
}

const styles = StyleSheet.create({
  header: { backgroundColor: "#0a7ea4", paddingHorizontal: 16, paddingVertical: 16, flexDirection: "row", alignItems: "center", gap: 12 }, headerTitle: { color: "#fff", fontSize: 19, fontWeight: "900", textAlign: "right" }, headerSubtitle: { color: "#dbeafe", fontSize: 11, textAlign: "right", marginTop: 3 }, headerButton: { backgroundColor: "#ffffff26", borderRadius: 20, padding: 9 }, content: { padding: 14, paddingBottom: 90, gap: 10 }, summary: { backgroundColor: "#0f172a", borderRadius: 14, padding: 14, gap: 4 }, summaryTitle: { color: "#67e8f9", fontWeight: "900", fontSize: 16, textAlign: "right" }, summaryText: { color: "#e2e8f0", textAlign: "right", fontSize: 12 }, rejection: { color: "#fecaca", textAlign: "right", marginTop: 5 }, sectionTitle: { color: "#0f172a", fontSize: 15, fontWeight: "900", textAlign: "right", marginTop: 4 }, box: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 12, padding: 12, gap: 4 }, rowText: { color: "#475569", fontSize: 12, textAlign: "right" }, item: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 11, padding: 11 }, itemTitle: { color: "#0f172a", fontWeight: "800", textAlign: "right" }, wrap: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 7 }, attachmentChip: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#e0f2fe", borderRadius: 15, paddingHorizontal: 10, paddingVertical: 7 }, attachmentText: { color: "#0369a1", fontSize: 10, maxWidth: 150 }, timeline: { flexDirection: "row-reverse", gap: 9, backgroundColor: "#fff", borderRadius: 11, padding: 11, borderWidth: 1, borderColor: "#e2e8f0" }, timelineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#0a7ea4", marginTop: 4 }, eventTitle: { color: "#0f172a", fontWeight: "800", textAlign: "right" }, eventMeta: { color: "#64748b", fontSize: 10, textAlign: "right", marginTop: 2 }, eventNotes: { color: "#334155", textAlign: "right", marginTop: 4 }, eventIndex: { color: "#94a3b8", fontWeight: "900" }, actionBox: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 13, padding: 12, gap: 10, marginTop: 5 }, input: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 10, padding: 11 }, textarea: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 10, padding: 11, minHeight: 80, textAlignVertical: "top" }, actions: { flexDirection: "row", gap: 8 }, action: { flex: 1, borderRadius: 10, padding: 12, alignItems: "center" }, reject: { backgroundColor: "#fee2e2" }, approve: { backgroundColor: "#0a7ea4" }, rejectText: { color: "#b91c1c", fontWeight: "900" }, approveText: { color: "#fff", fontWeight: "900", textAlign: "center" }, list: { padding: 14, paddingBottom: 80, gap: 9 }, empty: { color: "#64748b", textAlign: "center", marginTop: 50 }, card: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 13, padding: 12, flexDirection: "row-reverse", alignItems: "center", gap: 10 }, cardIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: "#e0f2fe", alignItems: "center", justifyContent: "center" }, cardTitle: { color: "#0f172a", fontSize: 15, fontWeight: "900", textAlign: "right" }, cardMeta: { color: "#64748b", fontSize: 11, textAlign: "right", marginTop: 2 },
});
