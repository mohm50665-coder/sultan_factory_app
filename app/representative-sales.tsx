import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";

import { AttachmentPicker } from "@/components/attachment-picker";
import { BackButton } from "@/components/back-button";
import { DateField } from "@/components/date-field";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { AttachmentFile } from "@/lib/services/attachment.service";
import { representativeService } from "@/lib/services/representative.service";

const TODAY = new Date().toISOString().slice(0, 10);

export default function RepresentativeSalesScreen() {
  const colors = useColors();
  const [customers, setCustomers] = useState<any[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(TODAY);
  const [files, setFiles] = useState<AttachmentFile[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const query = search.trim();
      const [customerRows, salesRows] = await Promise.all([
        query ? representativeService.customers.list(query) : Promise.resolve([]),
        representativeService.sales.list(),
      ]);
      setCustomers(query ? (Array.isArray(customerRows) ? customerRows : []) : []);
      setRows(Array.isArray(salesRows) ? salesRows : []);
    } catch (error: any) {
      Alert.alert("تعذر تحميل المبيعات", error?.message || "حدث خطأ");
    } finally { setLoading(false); }
  }, [search]);

  useEffect(() => { void load(); }, [load]);

  const reset = () => {
    setSearch(""); setSelectedCustomer(null); setInvoiceNumber(""); setAmount(""); setInvoiceDate(TODAY); setFiles([]); setShowForm(false);
  };

  const save = async () => {
    if (!selectedCustomer?.id) return Alert.alert("بيانات ناقصة", "ابحث عن العميل واختره من النتائج");
    if (!invoiceNumber.trim()) return Alert.alert("بيانات ناقصة", "رقم الفاتورة إلزامي");
    if (!(Number(amount) > 0)) return Alert.alert("بيانات ناقصة", "أدخل مبلغاً صحيحاً أكبر من صفر");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(invoiceDate)) return Alert.alert("بيانات ناقصة", "أدخل تاريخ الفاتورة بصيغة YYYY-MM-DD");
    if (saving) return;
    setSaving(true);
    try {
      const result = await representativeService.sales.create({
        customerId: Number(selectedCustomer.id), invoiceNumber: invoiceNumber.trim(), amount: Number(amount), invoiceDate,
        attachments: files.map((file) => ({ type: "sales_invoice", name: file.name, url: file.uploadedUrl || file.uri, mimeType: file.mimeType })),
      });
      if (!result?.success || !result?.id) throw new Error("لم يؤكد الخادم إنشاء سجل المبيعات");
      Alert.alert("تم حفظ المبيعات", `رقم السجل: ${result.referenceCode}`);
      reset(); await load();
    } catch (error: any) { Alert.alert("تعذر الحفظ", error?.message || "حدث خطأ"); }
    finally { setSaving(false); }
  };

  return <ScreenContainer style={{ backgroundColor: colors.background }}>
    <View style={styles.header}><BackButton /><View style={{ flex: 1 }}><Text style={styles.headerTitle}>المبيعات</Text><Text style={styles.headerSubtitle}>تسجيل مبيعات المندوب مرتبطة بملف العميل والفاتورة</Text></View><TouchableOpacity style={styles.headerButton} onPress={() => setShowForm(true)}><MaterialIcons name="add" size={24} color="#fff" /></TouchableOpacity></View>
    {showForm ? <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
      <View style={styles.note}><Text style={styles.noteText}>اختر العميل من نتائج البحث؛ سيُحفظ اسمه وملفه تلقائياً مع سجل المبيعات.</Text></View>
      <Text style={styles.sectionTitle}>العميل</Text>
      <Text style={styles.label}>البحث باسم العميل *</Text><TextInput value={search} onChangeText={(value) => { setSearch(value); setSelectedCustomer(null); }} placeholder="اكتب حرفين أو أكثر" style={styles.input} textAlign="right" />
      {search.trim() ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.customerRow}>{customers.map((customer) => <TouchableOpacity key={customer.id} style={[styles.customerChip, selectedCustomer?.id === customer.id && styles.activeChip]} onPress={() => { setSelectedCustomer(customer); setSearch(customer.name); }}><Text style={[styles.customerName, selectedCustomer?.id === customer.id && { color: "#fff" }]}>{customer.name}</Text>{customer.customerCode ? <Text style={styles.customerCode}>{customer.customerCode}</Text> : null}</TouchableOpacity>)}</ScrollView> : <Text style={styles.hint}>اكتب اسم العميل لظهور النتائج فقط</Text>}
      {selectedCustomer && <View style={styles.selected}><MaterialIcons name="check-circle" size={18} color="#15803d" /><Text style={styles.selectedText}>العميل المختار: {selectedCustomer.name}</Text></View>}
      <Text style={styles.sectionTitle}>بيانات الفاتورة</Text>
      <Text style={styles.label}>رقم الفاتورة *</Text><TextInput value={invoiceNumber} onChangeText={setInvoiceNumber} placeholder="رقم الفاتورة" style={styles.input} textAlign="right" />
      <View style={styles.twoColumns}><View style={styles.field}><Text style={styles.label}>المبلغ *</Text><TextInput value={amount} onChangeText={setAmount} placeholder="0.00" keyboardType="decimal-pad" style={styles.input} textAlign="right" /></View><View style={styles.field}><DateField value={invoiceDate} onChange={setInvoiceDate} label="تاريخ الفاتورة *" isAr style={styles.input} /></View></View>
      <View style={styles.attachmentBox}><Text style={styles.label}>مرفق الفاتورة (صورة أو PDF، اختياري)</Text><AttachmentPicker attachments={files} onAttachmentsChange={setFiles} maxAttachments={3} /></View>
      <View style={styles.actions}><TouchableOpacity style={[styles.action, styles.cancel]} onPress={reset} disabled={saving}><Text style={styles.cancelText}>إلغاء</Text></TouchableOpacity><TouchableOpacity style={[styles.action, styles.save, saving && { opacity: 0.6 }]} onPress={() => void save()} disabled={saving}><Text style={styles.saveText}>{saving ? "جارٍ الحفظ..." : "حفظ المبيعات"}</Text></TouchableOpacity></View>
    </ScrollView> : loading ? <ActivityIndicator style={{ marginTop: 50 }} color={colors.primary} /> : <ScrollView contentContainerStyle={styles.list}>{rows.length === 0 ? <Text style={styles.empty}>لا توجد سجلات مبيعات</Text> : rows.map((row) => <View key={row.id} style={styles.card}><View style={styles.cardHeader}><View style={styles.money}><Text style={styles.moneyText}>{Number(row.amount).toLocaleString("ar-SA")} ريال</Text></View><View style={{ flex: 1 }}><Text style={styles.cardTitle}>{row.customerName}</Text><Text style={styles.cardMeta}>{row.referenceCode} · فاتورة {row.invoiceNumber}</Text></View><MaterialIcons name="shopping-cart" size={24} color="#c2410c" /></View><Text style={styles.cardMeta}>تاريخ الفاتورة: {row.invoiceDate} · المندوب: {row.representativeName}</Text></View>)}</ScrollView>}
  </ScreenContainer>;
}

const styles = StyleSheet.create({
  header: { backgroundColor: "#c2410c", paddingHorizontal: 16, paddingVertical: 16, flexDirection: "row", alignItems: "center", gap: 12 }, headerTitle: { color: "#fff", fontSize: 19, fontWeight: "900", textAlign: "right" }, headerSubtitle: { color: "#ffedd5", fontSize: 11, textAlign: "right", marginTop: 3 }, headerButton: { backgroundColor: "#ffffff26", borderRadius: 20, padding: 9 }, form: { padding: 14, paddingBottom: 80, gap: 12 }, note: { backgroundColor: "#fff7ed", borderColor: "#fdba74", borderWidth: 1, borderRadius: 10, padding: 11 }, noteText: { color: "#9a3412", textAlign: "right", fontSize: 11, lineHeight: 18 }, sectionTitle: { color: "#0f172a", fontSize: 15, fontWeight: "900", textAlign: "right", marginTop: 4 }, label: { color: "#0f172a", fontWeight: "700", textAlign: "right", fontSize: 12 }, input: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 10, padding: 11, color: "#0f172a" }, customerRow: { gap: 8 }, customerChip: { minWidth: 160, borderWidth: 1, borderColor: "#cbd5e1", backgroundColor: "#fff", borderRadius: 11, padding: 10 }, activeChip: { backgroundColor: "#c2410c" }, customerName: { color: "#0f172a", fontWeight: "800", textAlign: "right" }, customerCode: { color: "#64748b", fontSize: 10, textAlign: "right", marginTop: 3 }, hint: { color: "#64748b", fontSize: 12, textAlign: "right" }, selected: { flexDirection: "row-reverse", alignItems: "center", gap: 6, backgroundColor: "#f0fdf4", borderRadius: 9, padding: 9 }, selectedText: { color: "#166534", fontWeight: "800", textAlign: "right" }, twoColumns: { flexDirection: "row-reverse", gap: 10 }, field: { flex: 1, gap: 5 }, attachmentBox: { backgroundColor: "#fff", padding: 10, borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 12, gap: 7 }, actions: { flexDirection: "row", gap: 10 }, action: { flex: 1, paddingVertical: 13, borderRadius: 11, alignItems: "center" }, cancel: { backgroundColor: "#e2e8f0" }, save: { backgroundColor: "#c2410c" }, cancelText: { color: "#475569", fontWeight: "800" }, saveText: { color: "#fff", fontWeight: "900" }, list: { padding: 14, paddingBottom: 80, gap: 10 }, empty: { color: "#64748b", textAlign: "center", marginTop: 50 }, card: { backgroundColor: "#fff", padding: 13, borderRadius: 14, borderWidth: 1, borderColor: "#e2e8f0", gap: 6 }, cardHeader: { flexDirection: "row-reverse", gap: 9, alignItems: "center" }, cardTitle: { color: "#0f172a", fontSize: 15, fontWeight: "900", textAlign: "right" }, cardMeta: { color: "#64748b", fontSize: 11, textAlign: "right" }, money: { backgroundColor: "#ffedd5", borderRadius: 10, padding: 8 }, moneyText: { color: "#c2410c", fontWeight: "900", fontSize: 11 },
});
