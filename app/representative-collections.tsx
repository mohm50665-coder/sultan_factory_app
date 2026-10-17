import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";

import { AttachmentPicker } from "@/components/attachment-picker";
import { BackButton } from "@/components/back-button";
import { DateField } from "@/components/date-field";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useLanguage } from "@/lib/language-context";
import { isEnglish, localize, textAlignFor, writingDirection } from "@/lib/i18n/runtime";
import { AttachmentFile } from "@/lib/services/attachment.service";
import { representativeService } from "@/lib/services/representative.service";

const TODAY = new Date().toISOString().slice(0, 10);

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  language: "ar" | "en";
  keyboardType?: any;
  placeholder?: string;
  isDate?: boolean;
};

function Field({ label, value, onChangeText, language, keyboardType = "default", placeholder, isDate = false }: FieldProps) {
  const align = textAlignFor(language);
  if (isDate) {
    return <DateField value={value} onChange={onChangeText} label={label} accessibilityLabel={label} isAr={!isEnglish(language)} style={[styles.input, { textAlign: align }]} />;
  }

  return (
    <View style={styles.field}>
      <Text style={[styles.label, { textAlign: align }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        placeholder={placeholder}
        placeholderTextColor="#64748b"
        style={[styles.input, { textAlign: align }]}
      />
    </View>
  );
}

export default function RepresentativeCollectionsScreen() {
  const colors = useColors();
  const { language } = useLanguage();
  const english = isEnglish(language);
  const align = textAlignFor(language);
  const direction = writingDirection(language);
  const t = (arabic: string, englishText: string) => localize(language, arabic, englishText);

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
      const customerQuery = search.trim();
      const [customerRows, collectionRows] = await Promise.all([
        customerQuery ? representativeService.customers.list(customerQuery) : Promise.resolve([]),
        representativeService.collections.list(),
      ]);
      setCustomers(customerQuery && Array.isArray(customerRows) ? customerRows : []);
      setRows(Array.isArray(collectionRows) ? collectionRows : []);
    } catch (error: any) {
      Alert.alert(t("تعذر التحميل", "Unable to load"), error?.message || t("حدث خطأ", "An error occurred"));
    } finally {
      setLoading(false);
    }
  }, [search, language]);

  useEffect(() => { void load(); }, [load]);

  const reset = () => {
    setSelectedCustomerId(null);
    setCollectedAmount("");
    setMethod("cash");
    setReceiptNumber("");
    setCollectionDate(TODAY);
    setNotes("");
    setFiles([]);
    setSearch("");
    setShowForm(false);
  };

  const save = async () => {
    if (!selectedCustomerId || Number(collectedAmount) <= 0) {
      return Alert.alert(t("بيانات ناقصة", "Missing information"), t("اختر العميل وأدخل المبلغ المحصل", "Select a customer and enter the collected amount"));
    }
    if (saving) return;

    setSaving(true);
    try {
      const result = await representativeService.collections.create({
        customerId: selectedCustomerId,
        collectedAmount: Number(collectedAmount),
        collectionMethod: method,
        receiptNumber,
        collectionDate,
        notes,
        attachments: files.map((file) => ({
          type: method === "transfer" ? "transfer_receipt" : "cash_receipt",
          name: file.name,
          url: file.uploadedUrl || file.uri,
          mimeType: file.mimeType,
        })),
      });
      if (!result?.success || !result?.id) {
        throw new Error(t("لم يؤكد الخادم إنشاء سجل التحصيل", "The server did not confirm creation of the collection record"));
      }
      Alert.alert(t("تم حفظ سجل التحصيل", "Collection record saved"), `${result.referenceCode} · ${t("تقرير أداء حر مستقل عن الفواتير", "Independent performance report, separate from invoices")}`);
      reset();
      await load();
    } catch (error: any) {
      Alert.alert(t("تعذر الحفظ", "Unable to save"), error?.message || t("حدث خطأ", "An error occurred"));
    } finally {
      setSaving(false);
    }
  };

  const rowDirection = english ? "row" : "row-reverse";
  const currencyLocale = english ? "en-US" : "ar-SA";

  return (
    <ScreenContainer style={{ backgroundColor: colors.background, direction }}>
      <View style={[styles.header, { flexDirection: rowDirection }]}>
        <BackButton />
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { textAlign: align }]}>{t("التحصيل", "Collections")}</Text>
          <Text style={[styles.headerSubtitle, { textAlign: align }]}>{t("سجل تقريري حر لتحليل أداء المندوب — مستقل عن الفواتير", "An independent reporting record for representative performance analysis — separate from invoices")}</Text>
        </View>
        <TouchableOpacity style={styles.headerButton} onPress={() => setShowForm(true)} accessibilityLabel={t("إضافة سجل تحصيل", "Add collection record")}>
          <MaterialIcons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {showForm ? (
        <ScrollView contentContainerStyle={[styles.form, { direction }]} keyboardShouldPersistTaps="handled">
          <Text style={[styles.reportNote, { textAlign: align }]}>{t("هذا السجل لأغراض التقارير وقياس الأداء التنفيذي فقط، ويمكن إدخال تحصيلات سابقة قبل تشغيل البرنامج مثل تحصيلات عام 2024.", "This record is for reporting and performance measurement only. It can include collections from before the application was launched, such as collections from 2024.")}</Text>
          <Text style={[styles.sectionTitle, { textAlign: align }]}>{t("اختيار العميل", "Select customer")}</Text>
          <Field language={language} label={t("بحث باسم العميل", "Search by customer name")} placeholder={t("اكتب اسم العميل للبحث", "Type a customer name to search")} value={search} onChangeText={setSearch} />

          {search.trim() ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.customerRow} style={{ direction }}>
              {customers.map((customer) => (
                <TouchableOpacity key={customer.id} style={[styles.customerChip, selectedCustomerId === Number(customer.id) && styles.activeChip]} onPress={() => setSelectedCustomerId(Number(customer.id))}>
                  <Text style={[styles.customerName, { textAlign: align }, selectedCustomerId === Number(customer.id) && { color: "#fff" }]}>{customer.name}</Text>
                  {!customer.isComplete && <Text style={[styles.incompleteCustomer, { textAlign: align }]}>{t("بيانات ناقصة", "Incomplete information")}</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : <Text style={[styles.searchHint, { textAlign: align }]}>{t("اكتب اسم العميل للبحث", "Type a customer name to search")}</Text>}

          <View style={[styles.twoColumns, { flexDirection: rowDirection }]}>
            <Field language={language} label={t("المبلغ المحصل *", "Collected amount *")} placeholder={t("أدخل المبلغ", "Enter amount")} value={collectedAmount} onChangeText={setCollectedAmount} keyboardType="numeric" />
            <Field language={language} label={t("تاريخ التحصيل *", "Collection date *")} value={collectionDate} onChangeText={setCollectionDate} isDate />
          </View>

          <Text style={[styles.sectionTitle, { textAlign: align }]}>{t("طريقة التحصيل", "Collection method")}</Text>
          <View style={[styles.choiceRow, { flexDirection: rowDirection }]}>
            {(["cash", "transfer"] as const).map((value) => (
              <TouchableOpacity key={value} style={[styles.choice, method === value && styles.choiceActive]} onPress={() => setMethod(value)}>
                <Text style={[styles.choiceText, method === value && styles.choiceTextActive]}>{value === "cash" ? t("نقدي", "Cash") : t("تحويل", "Bank transfer")}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {method === "cash" && <Field language={language} label={t("رقم سند القبض (اختياري للتقرير)", "Receipt number (optional for reporting)")} placeholder={t("أدخل رقم السند", "Enter receipt number")} value={receiptNumber} onChangeText={setReceiptNumber} />}
          <Field language={language} label={t("ملاحظات التقرير", "Report notes")} placeholder={t("أضف ملاحظات للتقرير", "Add notes for the report")} value={notes} onChangeText={setNotes} />

          <View style={styles.attachmentBox}>
            <Text style={[styles.label, { textAlign: align }]}>{method === "transfer" ? t("إيصال التحويل (اختياري)", "Transfer receipt (optional)") : t("مرفق سند القبض (اختياري)", "Receipt attachment (optional)")}</Text>
            <AttachmentPicker attachments={files} onAttachmentsChange={setFiles} language={language} maxAttachments={3} />
          </View>

          <View style={[styles.actions, { flexDirection: rowDirection }]}>
            <TouchableOpacity style={[styles.action, styles.cancel]} onPress={reset} disabled={saving}><Text style={styles.cancelText}>{t("إلغاء", "Cancel")}</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.action, styles.save, saving && { opacity: 0.6 }]} onPress={() => void save()} disabled={saving}><Text style={styles.saveText}>{saving ? t("جارٍ الحفظ...", "Saving...") : t("حفظ السجل", "Save record")}</Text></TouchableOpacity>
          </View>
        </ScrollView>
      ) : loading ? <ActivityIndicator style={{ marginTop: 50 }} color={colors.primary} /> : (
        <ScrollView contentContainerStyle={[styles.list, { direction }]}>
          {rows.length === 0 ? <Text style={styles.empty}>{t("لا توجد سجلات تحصيل", "No collection records")}</Text> : rows.map((row) => (
            <View key={row.id} style={styles.card}>
              <View style={[styles.cardHeader, { flexDirection: rowDirection }]}>
                <View style={styles.money}><Text style={styles.moneyText}>{Number(row.collectedAmount).toLocaleString(currencyLocale)} {t("ريال", "SAR")}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardTitle, { textAlign: align }]}>{row.customerName}</Text>
                  <Text style={[styles.cardMeta, { textAlign: align }]}>{row.referenceCode} · {row.collectionDate}</Text>
                </View>
                <MaterialIcons name="payments" size={24} color="#15803d" />
              </View>
              <Text style={[styles.cardMeta, { textAlign: align }]}>{t("المندوب:", "Representative:")} {row.representativeName}</Text>
              <Text style={[styles.cardMeta, { textAlign: align }]}>{t("طريقة التحصيل:", "Collection method:")} {row.collectionMethod === "transfer" ? t("تحويل", "Bank transfer") : t("نقدي", "Cash")} · {t("سجل تقريري حر مستقل عن الفواتير", "Independent reporting record, separate from invoices")}</Text>
              {row.notes ? <Text style={[styles.cardMeta, { textAlign: align }]}>{t("ملاحظات:", "Notes:")} {row.notes}</Text> : null}
            </View>
          ))}
        </ScrollView>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: "#0a7ea4", paddingHorizontal: 16, paddingVertical: 16, alignItems: "center", gap: 12 },
  headerTitle: { color: "#fff", fontSize: 19, fontWeight: "900" },
  headerSubtitle: { color: "#dbeafe", fontSize: 11, marginTop: 3 },
  headerButton: { backgroundColor: "#ffffff26", borderRadius: 20, padding: 9 },
  form: { padding: 14, paddingBottom: 80, gap: 12 },
  reportNote: { backgroundColor: "#eff6ff", borderColor: "#93c5fd", borderWidth: 1, borderRadius: 10, padding: 11, color: "#1e3a8a", fontSize: 11, lineHeight: 18 },
  field: { flex: 1, gap: 5 },
  label: { color: "#0f172a", fontWeight: "700", fontSize: 12 },
  input: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 10, padding: 11, color: "#0f172a" },
  sectionTitle: { color: "#0f172a", fontSize: 15, fontWeight: "900" },
  customerRow: { gap: 8 },
  customerChip: { minWidth: 150, borderWidth: 1, borderColor: "#cbd5e1", backgroundColor: "#fff", borderRadius: 11, padding: 10 },
  activeChip: { backgroundColor: "#0a7ea4" },
  customerName: { color: "#0f172a", fontWeight: "800" },
  searchHint: { color: "#64748b", fontSize: 12, paddingVertical: 8 },
  incompleteCustomer: { color: "#b45309", fontSize: 10, fontWeight: "700", marginTop: 3 },
  twoColumns: { gap: 10 },
  choiceRow: { gap: 8 },
  choice: { flex: 1, padding: 10, backgroundColor: "#f1f5f9", borderRadius: 10, alignItems: "center" },
  choiceActive: { backgroundColor: "#0a7ea4" },
  choiceText: { color: "#475569", fontWeight: "700" },
  choiceTextActive: { color: "#fff" },
  attachmentBox: { backgroundColor: "#fff", padding: 10, borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 12 },
  actions: { gap: 10 },
  action: { flex: 1, paddingVertical: 13, borderRadius: 11, alignItems: "center" },
  cancel: { backgroundColor: "#e2e8f0" },
  save: { backgroundColor: "#0a7ea4" },
  cancelText: { color: "#475569", fontWeight: "800" },
  saveText: { color: "#fff", fontWeight: "900" },
  list: { padding: 14, paddingBottom: 80, gap: 10 },
  empty: { color: "#64748b", textAlign: "center", marginTop: 50 },
  card: { backgroundColor: "#fff", padding: 13, borderRadius: 14, borderWidth: 1, borderColor: "#e2e8f0", gap: 6 },
  cardHeader: { gap: 9, alignItems: "center" },
  cardTitle: { color: "#0f172a", fontSize: 15, fontWeight: "900" },
  cardMeta: { color: "#64748b", fontSize: 11 },
  money: { backgroundColor: "#dcfce7", borderRadius: 10, padding: 8 },
  moneyText: { color: "#15803d", fontWeight: "900", fontSize: 11 },
});
