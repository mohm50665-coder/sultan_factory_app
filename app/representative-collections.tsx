import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";

import { AttachmentPicker } from "@/components/attachment-picker";
import { BackButton } from "@/components/back-button";
import { ScreenContainer } from "@/components/screen-container";
import { DateField } from "@/components/date-field";
import { useColors } from "@/hooks/use-colors";
import { AttachmentFile } from "@/lib/services/attachment.service";
import { representativeService } from "@/lib/services/representative.service";

const TODAY = new Date().toISOString().slice(0, 10);

function Field({ label, value, onChangeText, keyboardType = "default" }: { label: string; value: string; onChangeText: (value: string) => void; keyboardType?: any }) {
  if (label.includes("تاريخ") || label.toLowerCase().includes("date")) return <DateField value={value} onChange={onChangeText} label={label} isAr style={styles.input} />;
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput value={value} onChangeText={onChangeText} keyboardType={keyboardType} style={styles.input} textAlign="right" /></View>;
}

export default function RepresentativeCollectionsScreen() {
  const colors = useColors();
  const [customers, setCustomers] = useState<any[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [collectedAmount, setCollectedAmount] = useState("");
  const [method, setMethod] = useState<"cash" | "transfer">("cash");
  const [receiptNumber, setReceiptNumber] = useState("");
  const [collectionDate, setCollectionDate] = useState(TODAY);
  const [notes, setNotes] = useState("");
  const [files, setFiles] = useState<AttachmentFile[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [customerRows, collectionRows] = await Promise.all([representativeService.customers.list(search), representativeService.collections.list()]);
      setCustomers(Array.isArray(customerRows) ? customerRows : []);
      setRows(Array.isArray(collectionRows) ? collectionRows : []);
    } catch (error: any) { Alert.alert("تعذر التحميل", error?.message || "حدث خطأ"); }
    finally { setLoading(false); }
  }, [search]);
  useEffect(() => { void load(); }, [load]);

  const reset = () => { setSelectedCustomerId(null); setCollectedAmount(""); setMethod("cash"); setReceiptNumber(""); setCollectionDate(TODAY); setNotes(""); setFiles([]); setShowForm(false); };
  const save = async () => {
    if (!selectedCustomerId || Number(collectedAmount) <= 0) return Alert.alert("بيانات ناقصة", "اختر العميل وأدخل المبلغ المحصل");
    if (saving) return;
    setSaving(true);
    try {
      const result = await representativeService.collections.create({ customerId: selectedCustomerId, collectedAmount: Number(collectedAmount), collectionMethod: method, receiptNumber, collectionDate, notes, attachments: files.map((file) => ({ type: method === "transfer" ? "transfer_receipt" : "cash_receipt", name: file.name, url: file.uploadedUrl || file.uri, mimeType: file.mimeType })) });
      if (!result?.success || !result?.id) throw new Error("لم يؤكد الخادم إنشاء سجل التحصيل");
      Alert.alert("تم حفظ سجل التحصيل", `${result.referenceCode} · تقرير أداء حر مستقل عن الفواتير`); reset(); await load();
    } catch (error: any) { Alert.alert("تعذر الحفظ", error?.message || "حدث خطأ"); }
    finally { setSaving(false); }
  };

  return <ScreenContainer style={{ backgroundColor: colors.background }}><View style={styles.header}><BackButton /><View style={{ flex: 1 }}><Text style={styles.headerTitle}>التحصيل</Text><Text style={styles.headerSubtitle}>سجل تقريري حر لتحليل أداء المندوب — مستقل عن الفواتير</Text></View><TouchableOpacity style={styles.headerButton} onPress={() => setShowForm(true)}><MaterialIcons name="add" size={24} color="#fff" /></TouchableOpacity></View>{showForm ? <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled"><Text style={styles.reportNote}>هذا السجل لأغراض التقارير وقياس الأداء التنفيذي فقط، ويمكن إدخال تحصيلات سابقة قبل تشغيل البرنامج مثل تحصيلات عام 2024.</Text><Text style={styles.sectionTitle}>اختيار العميل</Text><Field label="بحث باسم العميل" value={search} onChangeText={setSearch} /><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.customerRow}>{customers.map((customer) => <TouchableOpacity key={customer.id} style={[styles.customerChip, selectedCustomerId === Number(customer.id) && styles.activeChip]} onPress={() => setSelectedCustomerId(Number(customer.id))}><Text style={[styles.customerName, selectedCustomerId === Number(customer.id) && { color: "#fff" }]}>{customer.name}</Text><Text style={[styles.customerCode, selectedCustomerId === Number(customer.id) && { color: "#dbeafe" }]}>{customer.customerCode}</Text></TouchableOpacity>)}</ScrollView><View style={styles.twoColumns}><Field label="المبلغ المحصل *" value={collectedAmount} onChangeText={setCollectedAmount} keyboardType="numeric" /><Field label="تاريخ التحصيل *" value={collectionDate} onChangeText={setCollectionDate} /></View><Text style={styles.sectionTitle}>طريقة التحصيل</Text><View style={styles.choiceRow}>{(["cash", "transfer"] as const).map((value) => <TouchableOpacity key={value} style={[styles.choice, method === value && styles.choiceActive]} onPress={() => setMethod(value)}><Text style={[styles.choiceText, method === value && styles.choiceTextActive]}>{value === "cash" ? "نقدي" : "تحويل"}</Text></TouchableOpacity>)}</View>{method === "cash" && <Field label="رقم سند القبض (اختياري للتقرير)" value={receiptNumber} onChangeText={setReceiptNumber} />}<Field label="ملاحظات التقرير" value={notes} onChangeText={setNotes} /><View style={styles.attachmentBox}><Text style={styles.label}>{method === "transfer" ? "إيصال التحويل (اختياري)" : "مرفق سند القبض (اختياري)"}</Text><AttachmentPicker attachments={files} onAttachmentsChange={setFiles} maxAttachments={3} /></View><View style={styles.actions}><TouchableOpacity style={[styles.action, styles.cancel]} onPress={reset} disabled={saving}><Text style={styles.cancelText}>إلغاء</Text></TouchableOpacity><TouchableOpacity style={[styles.action, styles.save, saving && { opacity: 0.6 }]} onPress={() => void save()} disabled={saving}><Text style={styles.saveText}>{saving ? "جارٍ الحفظ..." : "حفظ السجل"}</Text></TouchableOpacity></View></ScrollView> : loading ? <ActivityIndicator style={{ marginTop: 50 }} color={colors.primary} /> : <ScrollView contentContainerStyle={styles.list}>{rows.length === 0 ? <Text style={styles.empty}>لا توجد سجلات تحصيل</Text> : rows.map((row) => <View key={row.id} style={styles.card}><View style={styles.cardHeader}><View style={styles.money}><Text style={styles.moneyText}>{Number(row.collectedAmount).toLocaleString("ar-SA")} ريال</Text></View><View style={{ flex: 1 }}><Text style={styles.cardTitle}>{row.customerName}</Text><Text style={styles.cardMeta}>{row.referenceCode} · {row.collectionDate}</Text></View><MaterialIcons name="payments" size={24} color="#15803d" /></View><Text style={styles.cardMeta}>المندوب: {row.representativeName}</Text><Text style={styles.cardMeta}>طريقة التحصيل: {row.collectionMethod === "transfer" ? "تحويل" : "نقدي"} · سجل تقريري حر مستقل عن الفواتير</Text>{row.notes ? <Text style={styles.cardMeta}>ملاحظات: {row.notes}</Text> : null}</View>)}</ScrollView>}</ScreenContainer>;
}

const styles = StyleSheet.create({
  header: { backgroundColor: "#0a7ea4", paddingHorizontal: 16, paddingVertical: 16, flexDirection: "row", alignItems: "center", gap: 12 }, headerTitle: { color: "#fff", fontSize: 19, fontWeight: "900", textAlign: "right" }, headerSubtitle: { color: "#dbeafe", fontSize: 11, textAlign: "right", marginTop: 3 }, headerButton: { backgroundColor: "#ffffff26", borderRadius: 20, padding: 9 }, form: { padding: 14, paddingBottom: 80, gap: 12 }, reportNote: { backgroundColor: "#eff6ff", borderColor: "#93c5fd", borderWidth: 1, borderRadius: 10, padding: 11, color: "#1e3a8a", textAlign: "right", fontSize: 11, lineHeight: 18 }, field: { flex: 1, gap: 5 }, label: { color: "#0f172a", fontWeight: "700", textAlign: "right", fontSize: 12 }, input: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 10, padding: 11, color: "#0f172a" }, sectionTitle: { color: "#0f172a", fontSize: 15, fontWeight: "900", textAlign: "right" }, customerRow: { gap: 8 }, customerChip: { minWidth: 150, borderWidth: 1, borderColor: "#cbd5e1", backgroundColor: "#fff", borderRadius: 11, padding: 10 }, activeChip: { backgroundColor: "#0a7ea4" }, customerName: { color: "#0f172a", fontWeight: "800", textAlign: "right" }, customerCode: { color: "#64748b", fontSize: 10, textAlign: "right" }, invoiceList: { gap: 7 }, invoiceCard: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 10, padding: 10 }, invoiceCardActive: { backgroundColor: "#0a7ea4", borderColor: "#0a7ea4" }, invoiceTitle: { color: "#0f172a", fontWeight: "900", textAlign: "right" }, invoiceMeta: { color: "#64748b", fontSize: 10, textAlign: "right", marginTop: 2 }, invoiceSummary: { backgroundColor: "#f0fdf4", borderRadius: 10, padding: 10, gap: 3 }, invoiceSummaryText: { color: "#166534", fontWeight: "700", textAlign: "right" }, emptyInvoice: { color: "#b45309", backgroundColor: "#fef3c7", padding: 10, borderRadius: 9, textAlign: "right" }, twoColumns: { flexDirection: "row-reverse", gap: 10 }, choiceRow: { flexDirection: "row-reverse", gap: 8 }, choice: { flex: 1, padding: 10, backgroundColor: "#f1f5f9", borderRadius: 10, alignItems: "center" }, choiceActive: { backgroundColor: "#0a7ea4" }, choiceText: { color: "#475569", fontWeight: "700" }, choiceTextActive: { color: "#fff" }, attachmentBox: { backgroundColor: "#fff", padding: 10, borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 12 }, actions: { flexDirection: "row", gap: 10 }, action: { flex: 1, paddingVertical: 13, borderRadius: 11, alignItems: "center" }, cancel: { backgroundColor: "#e2e8f0" }, save: { backgroundColor: "#0a7ea4" }, cancelText: { color: "#475569", fontWeight: "800" }, saveText: { color: "#fff", fontWeight: "900" }, list: { padding: 14, paddingBottom: 80, gap: 10 }, empty: { color: "#64748b", textAlign: "center", marginTop: 50 }, card: { backgroundColor: "#fff", padding: 13, borderRadius: 14, borderWidth: 1, borderColor: "#e2e8f0", gap: 6 }, cardHeader: { flexDirection: "row-reverse", gap: 9, alignItems: "center" }, cardTitle: { color: "#0f172a", fontSize: 15, fontWeight: "900", textAlign: "right" }, cardMeta: { color: "#64748b", fontSize: 11, textAlign: "right" }, money: { backgroundColor: "#dcfce7", borderRadius: 10, padding: 8 }, moneyText: { color: "#15803d", fontWeight: "900", fontSize: 11 },
});
