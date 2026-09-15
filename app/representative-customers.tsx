import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";

import { ScreenContainer } from "@/components/screen-container";
import { BackButton } from "@/components/back-button";
import { AttachmentPicker } from "@/components/attachment-picker";
import { CustomerMapPicker } from "@/components/customer-map-picker";
import { useColors } from "@/hooks/use-colors";
import { AttachmentFile } from "@/lib/services/attachment.service";
import { CustomerInput, representativeService } from "@/lib/services/representative.service";

const EMPTY: CustomerInput = {
  name: "", commercialRegister: "", taxNumber: "", isTaxRegistered: false, municipalLicense: "", nationalAddress: "", city: "الرياض", district: "", street: "", email: "", ownerName: "", ownerPhone: "", contactName: "", contactPhone: "", contactEmail: "", latitude: 24.7136, longitude: 46.6753, attachments: [],
};

const toAttachment = (type: string, file: AttachmentFile) => ({ type, name: file.name, url: file.uploadedUrl || file.uri, mimeType: file.mimeType });
const fromAttachment = (attachment: any): AttachmentFile => ({ uri: attachment.url || attachment.fileUrl, uploadedUrl: attachment.url || attachment.fileUrl, name: attachment.name || attachment.fileName, type: String(attachment.mimeType || "").includes("pdf") ? "pdf" : "image", mimeType: attachment.mimeType || "application/octet-stream" });

function Field({ label, value, onChangeText, keyboardType = "default", multiline = false }: { label: string; value: string; onChangeText: (value: string) => void; keyboardType?: any; multiline?: boolean }) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput value={value} onChangeText={onChangeText} keyboardType={keyboardType} multiline={multiline} style={[styles.input, multiline && styles.multiline]} textAlign="right" /></View>;
}

function DocumentField({ label, required, value, onChange }: { label: string; required?: boolean; value: AttachmentFile[]; onChange: (files: AttachmentFile[]) => void }) {
  return <View style={styles.document}><Text style={styles.label}>{label}{required ? " *" : ""}</Text><AttachmentPicker attachments={value} onAttachmentsChange={onChange} maxAttachments={1} /></View>;
}

export default function RepresentativeCustomersScreen() {
  const colors = useColors();
  const [customers, setCustomers] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<CustomerInput>(EMPTY);
  const [commercialRegisterFiles, setCommercialRegisterFiles] = useState<AttachmentFile[]>([]);
  const [nationalAddressFiles, setNationalAddressFiles] = useState<AttachmentFile[]>([]);
  const [taxFiles, setTaxFiles] = useState<AttachmentFile[]>([]);
  const [licenseFiles, setLicenseFiles] = useState<AttachmentFile[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try { setCustomers(await representativeService.customers.list(search) || []); }
    catch (error: any) { Alert.alert("تعذر تحميل العملاء", error?.message || "حدث خطأ"); }
    finally { setLoading(false); }
  }, [search]);

  useEffect(() => { const handle = setTimeout(() => void load(), 250); return () => clearTimeout(handle); }, [load]);

  const reset = () => {
    setForm(EMPTY); setEditingId(null); setCommercialRegisterFiles([]); setNationalAddressFiles([]); setTaxFiles([]); setLicenseFiles([]); setShowForm(false);
  };

  const edit = (customer: any) => {
    const attachments = Array.isArray(customer.attachments) ? customer.attachments : [];
    setForm({ name: customer.name || "", commercialRegister: customer.commercialRegister || "", taxNumber: customer.taxNumber || "", isTaxRegistered: Boolean(customer.isTaxRegistered), municipalLicense: customer.municipalLicense || "", nationalAddress: customer.nationalAddress || "", city: customer.city || "", district: customer.district || "", street: customer.street || "", email: customer.email || "", ownerName: customer.ownerName || "", ownerPhone: customer.ownerPhone || "", contactName: customer.contactName || "", contactPhone: customer.contactPhone || "", contactEmail: customer.contactEmail || "", latitude: Number(customer.latitude || 24.7136), longitude: Number(customer.longitude || 46.6753), attachments });
    setCommercialRegisterFiles(attachments.filter((item: any) => item.type === "commercial_register").map(fromAttachment));
    setNationalAddressFiles(attachments.filter((item: any) => item.type === "national_address").map(fromAttachment));
    setTaxFiles(attachments.filter((item: any) => item.type === "tax_certificate").map(fromAttachment));
    setLicenseFiles(attachments.filter((item: any) => item.type === "municipal_license").map(fromAttachment));
    setEditingId(Number(customer.id)); setShowForm(true);
  };

  const attachments = useMemo(() => [
    ...commercialRegisterFiles.map((file) => toAttachment("commercial_register", file)),
    ...nationalAddressFiles.map((file) => toAttachment("national_address", file)),
    ...taxFiles.map((file) => toAttachment("tax_certificate", file)),
    ...licenseFiles.map((file) => toAttachment("municipal_license", file)),
  ], [commercialRegisterFiles, nationalAddressFiles, taxFiles, licenseFiles]);

  const save = async () => {
    const requiredValues = [form.name, form.commercialRegister, form.nationalAddress, form.city, form.district, form.street, form.email, form.ownerName, form.ownerPhone, form.contactName, form.contactPhone];
    if (requiredValues.some((value) => !String(value).trim())) return Alert.alert("بيانات ناقصة", "أكمل جميع الحقول الإلزامية");
    if (!commercialRegisterFiles.length || !nationalAddressFiles.length || (form.isTaxRegistered && !taxFiles.length)) return Alert.alert("مرفقات ناقصة", "أرفق السجل التجاري والعنوان الوطني وشهادة الضريبة عند التسجيل الضريبي");
    try {
      const payload = { ...form, attachments };
      if (editingId) await representativeService.customers.update(editingId, payload);
      else await representativeService.customers.create(payload);
      Alert.alert("تم الحفظ", editingId ? "تم إنشاء نسخة جديدة من بيانات العميل مع حفظ السجل السابق" : "تم إنشاء ملف العميل المركزي");
      reset(); await load();
    } catch (error: any) { Alert.alert("تعذر الحفظ", error?.message || "حدث خطأ"); }
  };

  return <ScreenContainer style={{ backgroundColor: colors.background }}>
    <View style={styles.header}><BackButton /><View style={{ flex: 1 }}><Text style={styles.headerTitle}>دليل العملاء المركزي</Text><Text style={styles.headerSubtitle}>بحث واستدعاء بيانات العميل ومرفقاته وموقعه</Text></View><TouchableOpacity style={styles.headerButton} onPress={() => { reset(); setShowForm(true); }}><MaterialIcons name="person-add" size={22} color="#fff" /></TouchableOpacity></View>
    {showForm ? <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
      <View style={styles.notice}><MaterialIcons name="verified-user" size={20} color="#0369a1" /><Text style={styles.noticeText}>تُحفظ بيانات العميل مرة واحدة. أي تعديل ينشئ نسخة جديدة، بينما تبقى بيانات المعاملات الموقعة ثابتة.</Text></View>
      <Field label="اسم العميل التجاري *" value={form.name} onChangeText={(value) => setForm({ ...form, name: value })} />
      <Field label="السجل التجاري *" value={form.commercialRegister} onChangeText={(value) => setForm({ ...form, commercialRegister: value })} />
      <View style={styles.choiceRow}><TouchableOpacity style={[styles.choice, form.isTaxRegistered && styles.choiceActive]} onPress={() => setForm({ ...form, isTaxRegistered: true })}><Text style={[styles.choiceText, form.isTaxRegistered && styles.choiceTextActive]}>مسجل ضريبياً</Text></TouchableOpacity><TouchableOpacity style={[styles.choice, !form.isTaxRegistered && styles.choiceActive]} onPress={() => setForm({ ...form, isTaxRegistered: false, taxNumber: "" })}><Text style={[styles.choiceText, !form.isTaxRegistered && styles.choiceTextActive]}>غير مسجل ضريبياً</Text></TouchableOpacity></View>
      {form.isTaxRegistered && <Field label="الرقم الضريبي *" value={form.taxNumber || ""} onChangeText={(value) => setForm({ ...form, taxNumber: value })} />}
      <Field label="رخصة البلدية (إن وجدت)" value={form.municipalLicense || ""} onChangeText={(value) => setForm({ ...form, municipalLicense: value })} />
      <Field label="العنوان الوطني *" value={form.nationalAddress} onChangeText={(value) => setForm({ ...form, nationalAddress: value })} multiline />
      <View style={styles.twoColumns}><Field label="المدينة *" value={form.city} onChangeText={(value) => setForm({ ...form, city: value })} /><Field label="الحي *" value={form.district} onChangeText={(value) => setForm({ ...form, district: value })} /></View>
      <Field label="الشارع *" value={form.street} onChangeText={(value) => setForm({ ...form, street: value })} />
      <Field label="البريد الإلكتروني *" value={form.email} onChangeText={(value) => setForm({ ...form, email: value })} keyboardType="email-address" />
      <View style={styles.twoColumns}><Field label="اسم المالك *" value={form.ownerName} onChangeText={(value) => setForm({ ...form, ownerName: value })} /><Field label="جوال المالك *" value={form.ownerPhone} onChangeText={(value) => setForm({ ...form, ownerPhone: value })} keyboardType="phone-pad" /></View>
      <View style={styles.twoColumns}><Field label="اسم المسؤول *" value={form.contactName} onChangeText={(value) => setForm({ ...form, contactName: value })} /><Field label="جوال المسؤول *" value={form.contactPhone} onChangeText={(value) => setForm({ ...form, contactPhone: value })} keyboardType="phone-pad" /></View>
      <Field label="بريد المسؤول" value={form.contactEmail || ""} onChangeText={(value) => setForm({ ...form, contactEmail: value })} keyboardType="email-address" />
      <Text style={styles.sectionTitle}>تحديد موقع العميل على الخريطة *</Text>
      <CustomerMapPicker value={{ latitude: form.latitude, longitude: form.longitude }} onChange={(location) => setForm({ ...form, ...location })} />
      <Text style={styles.sectionTitle}>مرفقات ملف العميل</Text>
      <DocumentField label="السجل التجاري" required value={commercialRegisterFiles} onChange={setCommercialRegisterFiles} />
      <DocumentField label="العنوان الوطني" required value={nationalAddressFiles} onChange={setNationalAddressFiles} />
      {form.isTaxRegistered && <DocumentField label="شهادة التسجيل الضريبي" required value={taxFiles} onChange={setTaxFiles} />}
      <DocumentField label="رخصة البلدية" value={licenseFiles} onChange={setLicenseFiles} />
      <View style={styles.actionRow}><TouchableOpacity style={[styles.action, styles.cancel]} onPress={reset}><Text style={styles.cancelText}>إلغاء</Text></TouchableOpacity><TouchableOpacity style={[styles.action, styles.save]} onPress={() => void save()}><Text style={styles.saveText}>{editingId ? "حفظ نسخة محدثة" : "حفظ ملف العميل"}</Text></TouchableOpacity></View>
    </ScrollView> : <View style={{ flex: 1 }}>
      <View style={styles.searchBox}><MaterialIcons name="search" size={20} color="#64748b" /><TextInput value={search} onChangeText={setSearch} placeholder="ابحث باسم العميل" style={{ flex: 1, textAlign: "right" }} /></View>
      {loading ? <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} /> : <ScrollView contentContainerStyle={styles.list}>{customers.length === 0 ? <Text style={styles.empty}>لا يوجد عملاء مطابقون</Text> : customers.map((customer) => <TouchableOpacity key={customer.id} style={styles.card} onPress={() => edit(customer)}><View style={styles.cardIcon}><MaterialIcons name="business" size={24} color="#0a7ea4" /></View><View style={{ flex: 1 }}><Text style={styles.cardTitle}>{customer.name}</Text><Text style={styles.cardMeta}>{customer.customerCode} · السجل: {customer.commercialRegister}</Text><Text style={styles.cardMeta}>{customer.city} / {customer.district} · نسخة {customer.version}</Text></View><MaterialIcons name="edit" size={20} color="#64748b" /></TouchableOpacity>)}</ScrollView>}
    </View>}
  </ScreenContainer>;
}

const styles = StyleSheet.create({
  header: { backgroundColor: "#0a7ea4", paddingHorizontal: 16, paddingVertical: 16, flexDirection: "row", alignItems: "center", gap: 12 }, headerTitle: { color: "#fff", fontSize: 19, fontWeight: "900", textAlign: "right" }, headerSubtitle: { color: "#dbeafe", fontSize: 11, textAlign: "right", marginTop: 3 }, headerButton: { backgroundColor: "#ffffff26", borderRadius: 20, padding: 9 },
  form: { padding: 14, paddingBottom: 80, gap: 11 }, notice: { flexDirection: "row-reverse", gap: 8, backgroundColor: "#e0f2fe", borderRadius: 12, padding: 12 }, noticeText: { flex: 1, color: "#075985", textAlign: "right", lineHeight: 19, fontSize: 12 }, field: { flex: 1, gap: 5 }, label: { color: "#0f172a", fontWeight: "700", textAlign: "right", fontSize: 13 }, input: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, color: "#0f172a" }, multiline: { minHeight: 76, textAlignVertical: "top" }, twoColumns: { flexDirection: "row-reverse", gap: 10 }, choiceRow: { flexDirection: "row-reverse", gap: 8 }, choice: { flex: 1, borderRadius: 10, padding: 10, backgroundColor: "#f1f5f9", alignItems: "center" }, choiceActive: { backgroundColor: "#0a7ea4" }, choiceText: { color: "#475569", fontWeight: "700" }, choiceTextActive: { color: "#fff" }, sectionTitle: { color: "#0f172a", fontWeight: "900", textAlign: "right", fontSize: 15, marginTop: 6 }, document: { backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#e2e8f0", padding: 10, gap: 7 }, actionRow: { flexDirection: "row", gap: 10, marginTop: 8 }, action: { flex: 1, paddingVertical: 13, borderRadius: 11, alignItems: "center" }, cancel: { backgroundColor: "#e2e8f0" }, save: { backgroundColor: "#0a7ea4" }, cancelText: { color: "#475569", fontWeight: "800" }, saveText: { color: "#fff", fontWeight: "900" },
  searchBox: { margin: 14, paddingHorizontal: 12, backgroundColor: "#fff", borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 12, flexDirection: "row", alignItems: "center", gap: 8 }, list: { paddingHorizontal: 14, paddingBottom: 70, gap: 9 }, card: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 13, padding: 13, flexDirection: "row-reverse", alignItems: "center", gap: 10 }, cardIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: "#e0f2fe", alignItems: "center", justifyContent: "center" }, cardTitle: { color: "#0f172a", fontSize: 15, fontWeight: "900", textAlign: "right" }, cardMeta: { color: "#64748b", fontSize: 11, textAlign: "right", marginTop: 3 }, empty: { color: "#64748b", textAlign: "center", marginTop: 50 },
});
