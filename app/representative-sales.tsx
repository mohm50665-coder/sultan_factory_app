import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from "react-native";
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
  const { width } = useWindowDimensions();
  const isWide = width >= 900;
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
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    void load();
  }, [load]);

  const reset = () => {
    setSearch("");
    setSelectedCustomer(null);
    setInvoiceNumber("");
    setAmount("");
    setInvoiceDate(TODAY);
    setFiles([]);
    setShowForm(false);
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
        customerId: Number(selectedCustomer.id),
        invoiceNumber: invoiceNumber.trim(),
        amount: Number(amount),
        invoiceDate,
        attachments: files.map((file) => ({
          type: "sales_invoice",
          name: file.name,
          url: file.uploadedUrl || file.uri,
          mimeType: file.mimeType,
        })),
      });
      if (!result?.success || !result?.id) throw new Error("لم يؤكد الخادم إنشاء سجل المبيعات");
      Alert.alert("تم حفظ المبيعات", `رقم السجل: ${result.referenceCode}`);
      reset();
      await load();
    } catch (error: any) {
      Alert.alert("تعذر الحفظ", error?.message || "حدث خطأ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenContainer style={{ backgroundColor: "#f8fafc" }}>
      <View style={styles.header}>
        <BackButton />
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>المبيعات</Text>
          <Text style={styles.headerSubtitle}>سجل الفاتورة وربطها بملف العميل</Text>
        </View>
        <TouchableOpacity style={styles.headerButton} onPress={() => setShowForm(true)} accessibilityLabel="إضافة مبيعات">
          <MaterialIcons name="add" size={21} color="#fff" />
        </TouchableOpacity>
      </View>

      {showForm ? (
        <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
          <View style={[styles.formCard, isWide && styles.formCardWide]}>
            <View style={styles.formTopRow}>
              <View style={styles.formTitleWrap}>
                <Text style={styles.formTitle}>إضافة عملية بيع</Text>
                <Text style={styles.formSubtitle}>اختر العميل ثم أدخل بيانات الفاتورة والمبلغ.</Text>
              </View>
              <View style={styles.formIcon}><MaterialIcons name="receipt-long" size={20} color="#c2410c" /></View>
            </View>

            <View style={styles.customerSection}>
              <View style={styles.fieldHeading}>
                <Text style={styles.label}>العميل *</Text>
                <Text style={styles.fieldHint}>اكتب حرفين أو أكثر</Text>
              </View>
              <TextInput
                value={search}
                onChangeText={(value) => {
                  setSearch(value);
                  setSelectedCustomer(null);
                }}
                placeholder="ابحث باسم العميل"
                style={styles.input}
                textAlign="right"
                returnKeyType="done"
              />
              {search.trim() ? (
                customers.length ? (
                  <View style={styles.customerResults}>
                    {customers.map((customer) => (
                      <TouchableOpacity
                        key={customer.id}
                        style={[styles.customerChip, selectedCustomer?.id === customer.id && styles.activeChip]}
                        onPress={() => {
                          setSelectedCustomer(customer);
                          setSearch(customer.name);
                        }}
                      >
                        <MaterialIcons name={selectedCustomer?.id === customer.id ? "check-circle" : "business"} size={16} color={selectedCustomer?.id === customer.id ? "#fff" : "#64748b"} />
                        <View style={styles.customerChipInfo}>
                          <Text style={[styles.customerName, selectedCustomer?.id === customer.id && styles.activeCustomerText]} numberOfLines={1}>{customer.name}</Text>
                          {customer.customerCode ? <Text style={[styles.customerCode, selectedCustomer?.id === customer.id && styles.activeCustomerCode]}>{customer.customerCode}</Text> : null}
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : <Text style={styles.noResults}>لا توجد نتائج مطابقة للاسم المدخل.</Text>
              ) : <Text style={styles.hint}>لن تظهر قائمة العملاء إلا بعد الكتابة في حقل البحث.</Text>}
              {selectedCustomer ? (
                <View style={styles.selectedCustomer}>
                  <MaterialIcons name="check-circle" size={17} color="#15803d" />
                  <Text style={styles.selectedText}>تم اختيار: {selectedCustomer.name}</Text>
                </View>
              ) : null}
            </View>

            <View style={[styles.invoiceGrid, !isWide && styles.invoiceGridStack]}>
              <View style={[styles.field, styles.invoiceField]}>
                <Text style={styles.label}>رقم الفاتورة *</Text>
                <TextInput
                  value={invoiceNumber}
                  onChangeText={setInvoiceNumber}
                  placeholder="مثال: INV-1024"
                  style={styles.input}
                  textAlign="right"
                  returnKeyType="next"
                />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>المبلغ *</Text>
                <TextInput
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                  style={styles.input}
                  textAlign="right"
                  returnKeyType="done"
                />
              </View>
              <View style={styles.field}>
                <DateField value={invoiceDate} onChange={setInvoiceDate} label="تاريخ الفاتورة *" isAr style={styles.dateInput} />
              </View>
            </View>

            <View style={styles.attachmentBox}>
              <View style={styles.attachmentHeader}>
                <View style={styles.attachmentIcon}><MaterialIcons name="attach-file" size={18} color="#0369a1" /></View>
                <View style={styles.attachmentTitleWrap}>
                  <Text style={styles.attachmentTitle}>مرفق الفاتورة</Text>
                  <Text style={styles.attachmentHint}>صورة أو PDF — اختياري</Text>
                </View>
              </View>
              <AttachmentPicker attachments={files} onAttachmentsChange={setFiles} maxAttachments={3} />
            </View>

            <View style={styles.actions}>
              <TouchableOpacity style={[styles.action, styles.cancel]} onPress={reset} disabled={saving}>
                <Text style={styles.cancelText}>إلغاء</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.action, styles.save, saving && styles.disabled]} onPress={() => void save()} disabled={saving}>
                <MaterialIcons name="save" size={18} color="#fff" />
                <Text style={styles.saveText}>{saving ? "جارٍ الحفظ..." : "حفظ المبيعات"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      ) : loading ? (
        <ActivityIndicator style={styles.loader} color={colors.primary} />
      ) : (
        <ScrollView contentContainerStyle={styles.page}>
          <View style={[styles.listWrap, isWide && styles.listWrapWide]}>
            <View style={styles.listHeader}>
              <Text style={styles.listTitle}>سجل المبيعات</Text>
              <Text style={styles.listCount}>{rows.length} سجل</Text>
            </View>
            {rows.length === 0 ? (
              <View style={styles.emptyState}>
                <MaterialIcons name="point-of-sale" size={30} color="#94a3b8" />
                <Text style={styles.empty}>لا توجد سجلات مبيعات بعد</Text>
                <TouchableOpacity style={styles.emptyAction} onPress={() => setShowForm(true)}><Text style={styles.emptyActionText}>إضافة أول عملية بيع</Text></TouchableOpacity>
              </View>
            ) : rows.map((row) => (
              <View key={row.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.money}><Text style={styles.moneyText}>{Number(row.amount).toLocaleString("ar-SA")} ريال</Text></View>
                  <View style={styles.cardInfo}>
                    <Text style={styles.cardTitle}>{row.customerName}</Text>
                    <Text style={styles.cardMeta}>{row.referenceCode} · فاتورة {row.invoiceNumber}</Text>
                  </View>
                  <View style={styles.saleIcon}><MaterialIcons name="shopping-cart" size={19} color="#c2410c" /></View>
                </View>
                <Text style={styles.cardMeta}>تاريخ الفاتورة: {row.invoiceDate} · المندوب: {row.representativeName}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: "#c2410c", minHeight: 64, paddingHorizontal: 16, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 10 },
  headerText: { flex: 1, minWidth: 0 },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "900", textAlign: "right" },
  headerSubtitle: { color: "#ffedd5", fontSize: 11, textAlign: "right", marginTop: 1 },
  headerButton: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: "#ffffff29" },
  page: { width: "100%", padding: 12, paddingBottom: 34, alignItems: "center" },
  formCard: { width: "100%", maxWidth: 1280, backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: "#e2e8f0", padding: 14, gap: 12, shadowColor: "#0f172a", shadowOpacity: 0.04, shadowOffset: { width: 0, height: 2 }, shadowRadius: 8, elevation: 1 },
  formCardWide: { padding: 16 },
  formTopRow: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  formTitleWrap: { flex: 1 },
  formTitle: { color: "#0f172a", fontSize: 16, fontWeight: "900", textAlign: "right" },
  formSubtitle: { color: "#64748b", fontSize: 11, textAlign: "right", marginTop: 2 },
  formIcon: { width: 34, height: 34, borderRadius: 9, backgroundColor: "#fff7ed", alignItems: "center", justifyContent: "center", marginLeft: 8 },
  customerSection: { backgroundColor: "#f8fafc", borderColor: "#e2e8f0", borderWidth: 1, borderRadius: 11, padding: 10, gap: 7 },
  fieldHeading: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" },
  label: { color: "#0f172a", fontWeight: "800", textAlign: "right", fontSize: 12 },
  fieldHint: { color: "#64748b", fontSize: 10, textAlign: "left" },
  input: { minHeight: 44, backgroundColor: "#fff", borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8, paddingHorizontal: 11, paddingVertical: 8, color: "#0f172a", fontSize: 14 },
  customerResults: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 7 },
  customerChip: { maxWidth: 270, minWidth: 155, flexGrow: 1, flexDirection: "row-reverse", alignItems: "center", gap: 6, borderWidth: 1, borderColor: "#cbd5e1", backgroundColor: "#fff", borderRadius: 8, paddingVertical: 7, paddingHorizontal: 9 },
  customerChipInfo: { flex: 1, minWidth: 0 },
  activeChip: { backgroundColor: "#c2410c", borderColor: "#c2410c" },
  customerName: { color: "#0f172a", fontWeight: "800", textAlign: "right", fontSize: 12 },
  activeCustomerText: { color: "#fff" },
  customerCode: { color: "#64748b", fontSize: 9, textAlign: "right", marginTop: 1 },
  activeCustomerCode: { color: "#ffedd5" },
  hint: { color: "#64748b", fontSize: 11, textAlign: "right" },
  noResults: { color: "#b45309", fontSize: 11, textAlign: "right" },
  selectedCustomer: { flexDirection: "row-reverse", alignItems: "center", gap: 5, backgroundColor: "#ecfdf5", borderRadius: 7, paddingVertical: 7, paddingHorizontal: 9, alignSelf: "flex-start" },
  selectedText: { color: "#166534", fontWeight: "800", textAlign: "right", fontSize: 12 },
  invoiceGrid: { flexDirection: "row-reverse", alignItems: "flex-end", gap: 10 },
  invoiceGridStack: { flexDirection: "column", alignItems: "stretch", gap: 9 },
  field: { flex: 1, minWidth: 0, gap: 5 },
  invoiceField: { flex: 1.35 },
  dateInput: { minHeight: 44, maxWidth: "100%", alignSelf: "stretch" },
  attachmentBox: { backgroundColor: "#f8fafc", padding: 10, borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 11, gap: 6 },
  attachmentHeader: { flexDirection: "row-reverse", alignItems: "center", gap: 7 },
  attachmentIcon: { width: 28, height: 28, borderRadius: 7, alignItems: "center", justifyContent: "center", backgroundColor: "#e0f2fe" },
  attachmentTitleWrap: { flex: 1 },
  attachmentTitle: { color: "#0f172a", fontWeight: "800", fontSize: 12, textAlign: "right" },
  attachmentHint: { color: "#64748b", fontSize: 10, textAlign: "right", marginTop: 1 },
  actions: { flexDirection: "row-reverse", gap: 8, paddingTop: 2 },
  action: { minHeight: 44, borderRadius: 9, alignItems: "center", justifyContent: "center", flexDirection: "row-reverse", gap: 6 },
  cancel: { width: 110, borderWidth: 1, borderColor: "#cbd5e1", backgroundColor: "#fff" },
  save: { flex: 1, backgroundColor: "#c2410c" },
  disabled: { opacity: 0.6 },
  cancelText: { color: "#475569", fontWeight: "800", fontSize: 13 },
  saveText: { color: "#fff", fontWeight: "900", fontSize: 13 },
  loader: { marginTop: 34 },
  listWrap: { width: "100%", maxWidth: 1280, gap: 8 },
  listWrapWide: { gap: 9 },
  listHeader: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 2, marginBottom: 2 },
  listTitle: { color: "#0f172a", fontSize: 16, fontWeight: "900", textAlign: "right" },
  listCount: { color: "#64748b", fontSize: 11, fontWeight: "700" },
  emptyState: { backgroundColor: "#fff", borderColor: "#e2e8f0", borderWidth: 1, borderRadius: 12, paddingVertical: 30, alignItems: "center", gap: 8 },
  empty: { color: "#64748b", textAlign: "center", fontSize: 13 },
  emptyAction: { marginTop: 3, backgroundColor: "#fff7ed", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  emptyActionText: { color: "#c2410c", fontSize: 12, fontWeight: "800" },
  card: { backgroundColor: "#fff", padding: 11, borderRadius: 11, borderWidth: 1, borderColor: "#e2e8f0", gap: 5 },
  cardHeader: { flexDirection: "row-reverse", gap: 8, alignItems: "center" },
  cardInfo: { flex: 1, minWidth: 0 },
  saleIcon: { width: 30, height: 30, borderRadius: 8, backgroundColor: "#fff7ed", alignItems: "center", justifyContent: "center" },
  cardTitle: { color: "#0f172a", fontSize: 14, fontWeight: "900", textAlign: "right" },
  cardMeta: { color: "#64748b", fontSize: 10, textAlign: "right" },
  money: { backgroundColor: "#ffedd5", borderRadius: 7, paddingVertical: 6, paddingHorizontal: 8 },
  moneyText: { color: "#c2410c", fontWeight: "900", fontSize: 11 },
});
