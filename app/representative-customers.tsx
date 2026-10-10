import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import { BackButton } from "@/components/back-button";
import { AttachmentPicker } from "@/components/attachment-picker";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/lib/auth-context";
import { AttachmentFile } from "@/lib/services/attachment.service";
import { CustomerInput, representativeService } from "@/lib/services/representative.service";

const EMPTY: CustomerInput = {
  customerType: "institution", name: "", sourceSellerName: "", sourceAccountCode: "", postalCode: "", buildingNumber: "", commercialRegister: "", taxNumber: "", isTaxRegistered: false, municipalLicense: "", nationalAddress: "", city: "الرياض", district: "", street: "", email: "", ownerName: "", ownerPhone: "", contactName: "", contactPhone: "", contactEmail: "", attachments: [],
};

const toAttachment = (type: string, file: AttachmentFile) => ({ type, name: file.name, url: file.uploadedUrl || file.uri, mimeType: file.mimeType });
const fromAttachment = (attachment: any): AttachmentFile => ({ uri: attachment.url || attachment.fileUrl, uploadedUrl: attachment.url || attachment.fileUrl, name: attachment.name || attachment.fileName, type: String(attachment.mimeType || "").includes("pdf") ? "pdf" : "image", mimeType: attachment.mimeType || "application/octet-stream" });

function Field({ label, value, onChangeText, keyboardType = "default", multiline = false, invalid = false }: { label: string; value: string; onChangeText: (value: string) => void; keyboardType?: any; multiline?: boolean; invalid?: boolean }) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput value={value} onChangeText={onChangeText} keyboardType={keyboardType} multiline={multiline} style={[styles.input, multiline && styles.multiline, invalid && styles.invalid]} textAlign="right" /></View>;
}

function DocumentField({ label, required, value, onChange }: { label: string; required?: boolean; value: AttachmentFile[]; onChange: (files: AttachmentFile[]) => void }) {
  return <View style={styles.document}><Text style={styles.label}>{label}{required ? " *" : ""}</Text><AttachmentPicker attachments={value} onAttachmentsChange={onChange} maxAttachments={1} /></View>;
}

function getRequiredMissing(form: CustomerInput, files: { commercial: AttachmentFile[]; national: AttachmentFile[]; tax: AttachmentFile[] }) {
  if (form.customerType === "individual") return [
    !form.name.trim() ? "اسم الفرد" : "",
    !form.contactPhone.trim() ? "رقم الجوال" : "",
  ].filter(Boolean);
  return [
    !form.name.trim() ? "اسم المؤسسة" : "",
    !form.commercialRegister.trim() ? "السجل التجاري" : "",
    !form.nationalAddress.trim() ? "العنوان الوطني" : "",
    !form.city.trim() ? "المدينة" : "",
    !form.district.trim() ? "الحي" : "",
    !form.street.trim() ? "الشارع" : "",
    !form.ownerName.trim() ? "اسم المالك" : "",
    !form.ownerPhone.trim() ? "جوال المالك" : "",
    !form.contactName.trim() ? "اسم المسؤول" : "",
    !form.contactPhone.trim() ? "جوال المسؤول" : "",
    !files.commercial.length ? "مرفق السجل التجاري" : "",
    !files.national.length ? "مرفق العنوان الوطني" : "",
    form.isTaxRegistered && !form.taxNumber?.trim() ? "الرقم الضريبي" : "",
    form.isTaxRegistered && !files.tax.length ? "مرفق الشهادة الضريبية" : "",
  ].filter(Boolean);
}

export default function RepresentativeCustomersScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ returnTo?: string }>();
  const colors = useColors();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
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
  const [showValidation, setShowValidation] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setCustomers(await representativeService.customers.list(search) || []); }
    catch (error: any) { Alert.alert("تعذر تحميل العملاء", error?.message || "حدث خطأ"); }
    finally { setLoading(false); }
  }, [search]);

  useEffect(() => { const handle = setTimeout(() => void load(), 250); return () => clearTimeout(handle); }, [load]);

  const reset = () => {
    setShowValidation(false); setForm(EMPTY); setEditingId(null); setCommercialRegisterFiles([]); setNationalAddressFiles([]); setTaxFiles([]); setLicenseFiles([]); setShowForm(false);
  };

  const edit = async (customer: any) => {
    const detail = await representativeService.customers.getById(Number(customer.id));
    if (!detail) return Alert.alert("تعذر فتح العميل", "ملف العميل غير موجود");
    customer = detail;
    const attachments = Array.isArray(customer.attachments) ? customer.attachments : [];
    setForm({ customerType: customer.customerType === "individual" ? "individual" : "institution", name: customer.name || "", sourceSellerName: customer.sourceSellerName || "", sourceAccountCode: customer.sourceAccountCode || "", postalCode: customer.postalCode || "", buildingNumber: customer.buildingNumber || "", commercialRegister: customer.commercialRegister || "", taxNumber: customer.taxNumber || "", isTaxRegistered: Boolean(customer.isTaxRegistered), municipalLicense: customer.municipalLicense || "", nationalAddress: customer.nationalAddress || "", city: customer.city || "", district: customer.district || "", street: customer.street || "", email: customer.email || "", ownerName: customer.ownerName || "", ownerPhone: customer.ownerPhone || "", contactName: customer.contactName || "", contactPhone: customer.contactPhone || "", contactEmail: customer.contactEmail || "", attachments });
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

  const requiredMissing = useMemo(() => getRequiredMissing(form, { commercial: commercialRegisterFiles, national: nationalAddressFiles, tax: taxFiles }), [form, commercialRegisterFiles, nationalAddressFiles, taxFiles]);

  const groupedCustomers = useMemo(() => {
    const groups = new Map<string, any[]>();
    for (const customer of customers) {
      const group = customer.assignedRepresentativeName || "للأدمن فقط / غير مصنف";
      groups.set(group, [...(groups.get(group) || []), customer]);
    }
    return Array.from(groups.entries()).sort(([left], [right]) => left.localeCompare(right, "ar"));
  }, [customers]);

  const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character] || character));

  const printCustomerList = () => {
    if (Platform.OS !== "web") return Alert.alert("الطباعة", "الطباعة متاحة من نسخة الويب فقط");
    const printWindow = window.open("", "_blank");
    if (!printWindow) return Alert.alert("تعذر الطباعة", "اسمح بفتح النوافذ المنبثقة ثم أعد المحاولة");
    const sections = groupedCustomers.map(([representative, rows]) => `<section><h2>${escapeHtml(representative)} <small>(${rows.length} عميل)</small></h2><table><thead><tr><th>م</th><th>اسم العميل</th><th>النوع</th><th>جوال المسؤول</th><th>الرقم الضريبي</th><th>العنوان الوطني</th><th>المدينة</th><th>الحي</th><th>الشارع</th><th>الرمز البريدي</th><th>رقم المبنى</th><th>رمز الحساب</th><th>الحالة</th></tr></thead><tbody>${rows.map((customer, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(customer.name)}</td><td>${customer.customerType === "individual" ? "فرد" : "مؤسسة"}</td><td>${escapeHtml(customer.contactPhone || "غير مضاف")}</td><td>${escapeHtml(customer.taxNumber || "غير مضاف")}</td><td>${escapeHtml(customer.nationalAddress || "غير مضاف")}</td><td>${escapeHtml(customer.city || "غير مضاف")}</td><td>${escapeHtml(customer.district || "غير مضاف")}</td><td>${escapeHtml(customer.street || "غير مضاف")}</td><td>${escapeHtml(customer.postalCode || "غير مضاف")}</td><td>${escapeHtml(customer.buildingNumber || "غير مضاف")}</td><td>${escapeHtml(customer.sourceAccountCode || "غير مضاف")}</td><td class="${customer.isComplete ? "complete" : "incomplete"}">${customer.isComplete ? "مكتمل" : "بيانات ناقصة"}</td></tr>`).join("")}</tbody></table></section>`).join("");
    printWindow.document.write(`<html dir="rtl"><head><title>دليل العملاء حسب المندوب</title><style>@page{size:landscape;margin:10mm}body{font-family:Arial,sans-serif;direction:rtl;color:#172033;font-size:10px}h1{color:#087f9f;text-align:center;margin:0 0 8px}h2{background:#e6f5f9;border-right:5px solid #087f9f;padding:7px;margin:14px 0 4px;font-size:15px}h2 small{font-size:11px;color:#64748b}table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{border:1px solid #94a3b8;padding:4px;text-align:right;vertical-align:top;word-wrap:break-word}th{background:#e2e8f0;font-weight:700}.complete{color:#166534}.incomplete{color:#b45309;font-weight:700}section{break-inside:avoid;margin-bottom:10px}</style></head><body><h1>دليل العملاء المركزي — مصنف حسب المندوب</h1><p>تاريخ الطباعة: ${escapeHtml(new Date().toLocaleString("ar-SA"))}</p>${sections || "<p>لا توجد بيانات للطباعة</p>"}</body></html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const save = async () => {
    if (saving) return;
    setShowValidation(true);
    if (form.customerType === "individual") {
      if (!form.name.trim() || !form.contactPhone.trim()) return Alert.alert("بيانات ناقصة", "بيانات الفرد المطلوبة هي الاسم ورقم الجوال");
    } else {
      const requiredValues = [form.name, form.commercialRegister, form.nationalAddress, form.city, form.district, form.street, form.ownerName, form.ownerPhone, form.contactName, form.contactPhone];
      if (requiredValues.some((value) => !String(value).trim())) return Alert.alert("بيانات ناقصة", "أكمل بيانات المؤسسة الإلزامية");
      if (!commercialRegisterFiles.length || !nationalAddressFiles.length || (form.isTaxRegistered && !taxFiles.length)) return Alert.alert("مرفقات ناقصة", "أرفق السجل التجاري والعنوان الوطني وشهادة الضريبة عند التسجيل الضريبي");
    }
    setSaving(true);
    try {
      const payload = { ...form, attachments };
      if (editingId) await representativeService.customers.update(editingId, payload);
      else await representativeService.customers.create(payload);
      Alert.alert("تم الحفظ", editingId ? "تم تحديث بيانات العميل مع حفظ السجل السابق" : "تم إنشاء ملف العميل المركزي مرة واحدة");
      reset(); await load();
      if (params.returnTo) router.replace(params.returnTo as any);
    } catch (error: any) { Alert.alert("تعذر الحفظ", error?.message || "حدث خطأ"); }
    finally { setSaving(false); }
  };

  const removeCustomer = (customer: any) => {
    if (!isAdmin) return;
    Alert.alert("تأكيد حذف العميل", `سيتم إخفاء العميل «${customer.name}» من القوائم. ستبقى حركاته السابقة محفوظة.`, [
      { text: "إلغاء", style: "cancel" },
      { text: "حذف", style: "destructive", onPress: () => void (async () => {
        try {
          await representativeService.customers.remove(Number(customer.id));
          Alert.alert("تم الحذف", "تم حذف العميل من قائمة العملاء مع الاحتفاظ بالسجل التاريخي");
          await load();
        } catch (error: any) { Alert.alert("تعذر الحذف", error?.message || "حدث خطأ"); }
      })() },
    ]);
  };

  return <ScreenContainer style={{ backgroundColor: colors.background }}>
    <View style={styles.header}><BackButton /><View style={{ flex: 1 }}><Text style={styles.headerTitle}>دليل العملاء المركزي</Text><Text style={styles.headerSubtitle}>بحث واستدعاء بيانات العميل ومرفقاته</Text></View><TouchableOpacity style={styles.printButton} onPress={printCustomerList}><MaterialIcons name="print" size={21} color="#fff" /><Text style={styles.headerButtonText}>طباعة</Text></TouchableOpacity><TouchableOpacity style={styles.headerButton} onPress={() => { reset(); setShowForm(true); }}><MaterialIcons name="person-add" size={22} color="#fff" /></TouchableOpacity></View>
    {showForm ? <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
      <View style={styles.notice}><MaterialIcons name="verified-user" size={20} color="#0369a1" /><Text style={styles.noticeText}>تُحفظ بيانات العميل مرة واحدة. أي تعديل ينشئ نسخة جديدة، بينما تبقى بيانات المعاملات الموقعة ثابتة.</Text></View>
      <View style={styles.choiceRow}><TouchableOpacity style={[styles.choice, form.customerType === "institution" && styles.choiceActive]} onPress={() => setForm({ ...form, customerType: "institution" })}><Text style={[styles.choiceText, form.customerType === "institution" && styles.choiceTextActive]}>مؤسسة</Text></TouchableOpacity><TouchableOpacity style={[styles.choice, form.customerType === "individual" && styles.choiceActive]} onPress={() => setForm({ ...form, customerType: "individual" })}><Text style={[styles.choiceText, form.customerType === "individual" && styles.choiceTextActive]}>فرد</Text></TouchableOpacity></View>
      {form.customerType === "individual" ? <><Field label="اسم الفرد *" value={form.name} invalid={showValidation && !form.name.trim()} onChangeText={(value) => setForm({ ...form, name: value })} /><Field label="رقم الجوال *" value={form.contactPhone} invalid={showValidation && !form.contactPhone.trim()} onChangeText={(value) => setForm({ ...form, contactPhone: value })} keyboardType="phone-pad" /></> : <><Field label="اسم المؤسسة *" value={form.name} invalid={showValidation && !form.name.trim()} onChangeText={(value) => setForm({ ...form, name: value })} /><Field label="السجل التجاري *" value={form.commercialRegister} invalid={showValidation && !form.commercialRegister.trim()} onChangeText={(value) => setForm({ ...form, commercialRegister: value })} /><View style={styles.choiceRow}><TouchableOpacity style={[styles.choice, form.isTaxRegistered && styles.choiceActive]} onPress={() => setForm({ ...form, isTaxRegistered: true })}><Text style={[styles.choiceText, form.isTaxRegistered && styles.choiceTextActive]}>مسجل ضريبياً</Text></TouchableOpacity><TouchableOpacity style={[styles.choice, !form.isTaxRegistered && styles.choiceActive]} onPress={() => setForm({ ...form, isTaxRegistered: false, taxNumber: "" })}><Text style={[styles.choiceText, !form.isTaxRegistered && styles.choiceTextActive]}>غير مسجل ضريبياً</Text></TouchableOpacity></View>{form.isTaxRegistered && <Field label="الرقم الضريبي *" value={form.taxNumber || ""} onChangeText={(value) => setForm({ ...form, taxNumber: value })} />}<Field label="رخصة البلدية (اختياري)" value={form.municipalLicense || ""} onChangeText={(value) => setForm({ ...form, municipalLicense: value })} /><Field label="العنوان الوطني *" value={form.nationalAddress} onChangeText={(value) => setForm({ ...form, nationalAddress: value })} multiline /><View style={styles.twoColumns}><Field label="المدينة *" value={form.city} onChangeText={(value) => setForm({ ...form, city: value })} /><Field label="الحي *" value={form.district} onChangeText={(value) => setForm({ ...form, district: value })} /></View><View style={styles.twoColumns}><Field label="الشارع *" value={form.street} onChangeText={(value) => setForm({ ...form, street: value })} /><Field label="الرمز البريدي (اختياري)" value={form.postalCode || ""} onChangeText={(value) => setForm({ ...form, postalCode: value })} keyboardType="numeric" /></View><View style={styles.twoColumns}><Field label="رقم المبنى (اختياري)" value={form.buildingNumber || ""} onChangeText={(value) => setForm({ ...form, buildingNumber: value })} keyboardType="numeric" /><Field label="البريد الإلكتروني (اختياري)" value={form.email} onChangeText={(value) => setForm({ ...form, email: value })} keyboardType="email-address" /></View><View style={styles.twoColumns}><Field label="اسم المالك *" value={form.ownerName} onChangeText={(value) => setForm({ ...form, ownerName: value })} /><Field label="جوال المالك *" value={form.ownerPhone} onChangeText={(value) => setForm({ ...form, ownerPhone: value })} keyboardType="phone-pad" /></View><View style={styles.twoColumns}><Field label="اسم المسؤول *" value={form.contactName} onChangeText={(value) => setForm({ ...form, contactName: value })} /><Field label="جوال المسؤول *" value={form.contactPhone} onChangeText={(value) => setForm({ ...form, contactPhone: value })} keyboardType="phone-pad" /></View><Field label="بريد المسؤول (اختياري)" value={form.contactEmail || ""} onChangeText={(value) => setForm({ ...form, contactEmail: value })} keyboardType="email-address" /><Text style={styles.sectionTitle}>مرفقات ملف المؤسسة</Text><DocumentField label="السجل التجاري" required value={commercialRegisterFiles} onChange={setCommercialRegisterFiles} /><DocumentField label="العنوان الوطني" required value={nationalAddressFiles} onChange={setNationalAddressFiles} />{form.isTaxRegistered && <DocumentField label="شهادة التسجيل الضريبي" required value={taxFiles} onChange={setTaxFiles} />}<DocumentField label="رخصة البلدية (اختياري)" value={licenseFiles} onChange={setLicenseFiles} /></>}
      {showForm && requiredMissing.length > 0 && <View style={styles.missingBox}><Text style={styles.missingTitle}>البيانات الإلزامية المطلوب استكمالها أولاً</Text><Text style={styles.missingText}>{requiredMissing.join("، ")}</Text></View>}
      {showForm && requiredMissing.length === 0 && <View style={styles.completeBox}><Text style={styles.completeText}>اكتملت جميع البيانات الإلزامية. يمكنك الحفظ والمتابعة.</Text></View>}
      <View style={styles.actionRow}><TouchableOpacity style={[styles.action, styles.cancel]} onPress={reset} disabled={saving}><Text style={styles.cancelText}>إلغاء</Text></TouchableOpacity><TouchableOpacity style={[styles.action, styles.save, saving && styles.saveDisabled]} onPress={() => void save()} disabled={saving}><Text style={styles.saveText}>{saving ? "جارٍ الحفظ..." : editingId ? "حفظ التعديل" : "حفظ ملف العميل"}</Text></TouchableOpacity></View>
    </ScrollView> : <View style={{ flex: 1 }}>
      <View style={styles.searchBox}><MaterialIcons name="search" size={20} color="#64748b" /><TextInput value={search} onChangeText={setSearch} placeholder="ابحث باسم العميل" style={{ flex: 1, textAlign: "right" }} /></View>
      {loading ? <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} /> : <ScrollView contentContainerStyle={styles.list}>{customers.length === 0 ? <Text style={styles.empty}>لا يوجد عملاء مطابقون</Text> : groupedCustomers.map(([representative, rows]) => <View key={representative} style={styles.group}><View style={styles.groupHeader}><Text style={styles.groupTitle}>{representative}</Text><Text style={styles.groupCount}>{rows.length} عميل</Text></View>{rows.map((customer) => <TouchableOpacity key={customer.id} style={styles.card} onPress={() => void edit(customer)}><View style={styles.cardIcon}><MaterialIcons name="business" size={24} color="#0a7ea4" /></View><View style={{ flex: 1 }}><Text style={styles.cardTitle}>{customer.name}</Text><Text style={styles.cardMeta}>{customer.customerType === "individual" ? "فرد" : "مؤسسة"} · {customer.customerCode}</Text><Text style={[styles.cardMeta, { color: customer.isComplete ? "#15803d" : "#b45309", fontWeight: "700" }]}>{customer.isComplete ? "الملف مكتمل" : `بيانات ناقصة: ${(customer.missingFields || []).join("، ")}`}</Text>{isAdmin && <View style={styles.adminDetails}><Text style={styles.detailLine}>المندوب: {customer.assignedRepresentativeName || "للأدمن فقط"} · المصدر: {customer.sourceSellerName || "غير محدد"}</Text><Text style={styles.detailLine}>جوال المسؤول: {customer.contactPhone || "غير مضاف"} · الرقم الضريبي: {customer.taxNumber || "غير مضاف"}</Text><Text style={styles.detailLine}>العنوان الوطني: {customer.nationalAddress || "غير مضاف"}</Text><Text style={styles.detailLine}>المدينة: {customer.city || "غير مضاف"} · الحي: {customer.district || "غير مضاف"} · الشارع: {customer.street || "غير مضاف"}</Text><Text style={styles.detailLine}>الرمز البريدي: {customer.postalCode || "غير مضاف"} · رقم المبنى: {customer.buildingNumber || "غير مضاف"} · رمز الحساب: {customer.sourceAccountCode || "غير مضاف"}</Text></View>}<View style={styles.activityBox}><Text style={[styles.activityStatus, { color: customer.activityStatus === "active" ? "#15803d" : "#b45309" }]}>{customer.activityStatus === "active" ? "عميل نشط" : "عميل غير نشط"}</Text><Text style={styles.activityText}>مبيعات: {customer.salesCount || 0} · تحصيل: {customer.collectionCount || 0} · إجمالي التحصيل: {Number(customer.collectionTotal || 0).toLocaleString("ar-SA")} ريال</Text><Text style={styles.activityText}>آخر مبيعات: {customer.lastSalesDate || "لا يوجد"} · آخر تحصيل: {customer.lastCollectionDate || "لا يوجد"}</Text><Text style={styles.activityText}>آخر حركة: {customer.lastActivityDate || "لا توجد حركة"}{customer.inactiveDays !== null && customer.inactiveDays !== undefined ? ` · منذ ${customer.inactiveDays} يوم` : ""}</Text></View></View>{isAdmin && <TouchableOpacity style={styles.deleteButton} onPress={() => removeCustomer(customer)}><MaterialIcons name="delete-outline" size={20} color="#b91c1c" /></TouchableOpacity>}<MaterialIcons name="edit" size={20} color="#64748b" /></TouchableOpacity>)}</View>)}</ScrollView>}
    </View>}
  </ScreenContainer>;
}

const styles = StyleSheet.create({
  header: { backgroundColor: "#0a7ea4", paddingHorizontal: 16, paddingVertical: 16, flexDirection: "row", alignItems: "center", gap: 12 }, headerTitle: { color: "#fff", fontSize: 19, fontWeight: "900", textAlign: "right" }, headerSubtitle: { color: "#dbeafe", fontSize: 11, textAlign: "right", marginTop: 3 }, headerButton: { backgroundColor: "#ffffff26", borderRadius: 20, padding: 9 }, printButton: { backgroundColor: "#ffffff26", borderRadius: 10, paddingHorizontal: 9, paddingVertical: 7, flexDirection: "row", alignItems: "center", gap: 4 }, headerButtonText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  form: { padding: 14, paddingBottom: 80, gap: 11 }, notice: { flexDirection: "row-reverse", gap: 8, backgroundColor: "#e0f2fe", borderRadius: 12, padding: 12 }, noticeText: { flex: 1, color: "#075985", textAlign: "right", lineHeight: 19, fontSize: 12 }, field: { flex: 1, gap: 5 }, label: { color: "#0f172a", fontWeight: "700", textAlign: "right", fontSize: 13 }, input: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, color: "#0f172a" }, invalid: { borderColor: "#dc2626", borderWidth: 2, backgroundColor: "#fef2f2" }, multiline: { minHeight: 76, textAlignVertical: "top" }, twoColumns: { flexDirection: "row-reverse", gap: 10 }, choiceRow: { flexDirection: "row-reverse", gap: 8 }, choice: { flex: 1, borderRadius: 10, padding: 10, backgroundColor: "#f1f5f9", alignItems: "center" }, choiceActive: { backgroundColor: "#0a7ea4" }, choiceText: { color: "#475569", fontWeight: "700" }, choiceTextActive: { color: "#fff" }, sectionTitle: { color: "#0f172a", fontWeight: "900", textAlign: "right", fontSize: 15, marginTop: 6 }, document: { backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#e2e8f0", padding: 10, gap: 7 }, actionRow: { flexDirection: "row", gap: 10, marginTop: 8 }, action: { flex: 1, paddingVertical: 13, borderRadius: 11, alignItems: "center" }, cancel: { backgroundColor: "#e2e8f0" }, save: { backgroundColor: "#0a7ea4" }, saveDisabled: { opacity: 0.6 }, cancelText: { color: "#475569", fontWeight: "800" }, saveText: { color: "#fff", fontWeight: "900" },
  searchBox: { margin: 14, paddingHorizontal: 12, backgroundColor: "#fff", borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 12, flexDirection: "row", alignItems: "center", gap: 8 }, list: { paddingHorizontal: 14, paddingBottom: 70, gap: 12 }, group: { gap: 8 }, groupHeader: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", backgroundColor: "#e0f2fe", borderRightWidth: 4, borderRightColor: "#0a7ea4", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 }, groupTitle: { color: "#075985", fontSize: 15, fontWeight: "900", textAlign: "right" }, groupCount: { color: "#0e7490", fontSize: 11, fontWeight: "800" }, card: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 13, padding: 13, flexDirection: "row-reverse", alignItems: "center", gap: 10 }, cardIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: "#e0f2fe", alignItems: "center", justifyContent: "center" }, cardTitle: { color: "#0f172a", fontSize: 15, fontWeight: "900", textAlign: "right" }, cardMeta: { color: "#64748b", fontSize: 11, textAlign: "right", marginTop: 3 }, adminDetails: { marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: "#e2e8f0", gap: 2 }, detailLine: { color: "#334155", fontSize: 10, textAlign: "right", lineHeight: 15 }, activityBox: { marginTop: 7, paddingTop: 6, borderTopWidth: 1, borderTopColor: "#dbeafe", gap: 2 }, activityStatus: { fontSize: 11, fontWeight: "900", textAlign: "right" }, activityText: { color: "#475569", fontSize: 10, textAlign: "right" }, deleteButton: { padding: 5, borderRadius: 8, backgroundColor: "#fef2f2" }, missingBox: { backgroundColor: "#fff1f2", borderWidth: 1, borderColor: "#fda4af", borderRadius: 10, padding: 10, gap: 4 }, missingTitle: { color: "#be123c", fontSize: 12, fontWeight: "900", textAlign: "right" }, missingText: { color: "#9f1239", fontSize: 12, textAlign: "right", lineHeight: 19 }, completeBox: { backgroundColor: "#f0fdf4", borderWidth: 1, borderColor: "#86efac", borderRadius: 10, padding: 10 }, completeText: { color: "#166534", fontSize: 12, fontWeight: "700", textAlign: "right" }, empty: { color: "#64748b", textAlign: "center", marginTop: 50 },
});
