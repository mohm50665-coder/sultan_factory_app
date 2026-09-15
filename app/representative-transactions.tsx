import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";

import { AttachmentPicker } from "@/components/attachment-picker";
import { BackButton } from "@/components/back-button";
import { ScreenContainer } from "@/components/screen-container";
import { SignaturePad } from "@/components/signature-pad";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/lib/auth-context";
import { AttachmentFile } from "@/lib/services/attachment.service";
import { RepresentativeItemInput, RepresentativeTransactionInput, representativeService } from "@/lib/services/representative.service";

type TransactionType = "order" | "visit" | "return" | "custom" | "sample";
const TODAY = new Date().toISOString().slice(0, 10);
const LABELS: Record<TransactionType, string> = { order: "الطلبات", visit: "الزيارات", return: "المرتجعات", custom: "التصنيع الخاص", sample: "طلبات العينات" };
const PRODUCT_SIZES: Record<string, string[]> = { "صيفي": ["L", "M", "S", "تحت الكعب"], "شتوي": ["L", "M", "S"], "رياضي": ["فوق الركبة", "تمارين منتصف الساق", "فوق الكعب", "مقصوص"], "مانع انزلاق": ["XL", "L", "M", "S", "XS", "XXS"], "عسكري": ["L"] };
const YARN_FIELDS = [{ key: "cotton", label: "قطن" }, { key: "bamboo", label: "بامبو" }, { key: "nylon", label: "نايلون" }, { key: "polyester", label: "بوليستر" }, { key: "rubber", label: "مطاط" }, { key: "spandex", label: "إسباندكس" }] as const;
const STATUS_LABELS: Record<string, string> = { DRAFT: "مسودة", PENDING_SALES_APPROVAL: "بانتظار مدير التسويق", REJECTED_SALES: "مرفوض من التسويق", PENDING_WAREHOUSE_INVOICE: "بانتظار الفاتورة من المستودع", RETURNED_TO_REPRESENTATIVE: "عادت للمندوب لاستلام الفاتورة", PENDING_PRODUCTION_APPROVAL: "بانتظار مدير الإنتاج", REJECTED_PRODUCTION: "مرفوض من الإنتاج", PENDING_SALES_RESOLUTION: "بانتظار حل مدير التسويق", IN_PRODUCTION: "قيد التصنيع", READY_FOR_REPRESENTATIVE: "جاهز للاستلام", CLOSED: "مغلق", CLOSED_REJECTED: "مغلق بالرفض" };

const emptyItem = (type: TransactionType): RepresentativeItemInput => ({ productName: "", size: "", color: "", quantity: 1, quantityUnit: type === "sample" ? "pair" : "dozen", productType: type === "custom" || type === "sample" ? "صيفي" : "", yarnRatios: type === "custom" || type === "sample" ? { cotton: 0, bamboo: 0, nylon: 0, polyester: 0, rubber: 0, spandex: 0 } : undefined });
const toAttachment = (type: string, file: AttachmentFile) => ({ type, name: file.name, url: file.uploadedUrl || file.uri, mimeType: file.mimeType });

function Input({ label, value, onChangeText, keyboardType = "default", multiline = false }: { label: string; value: string; onChangeText: (value: string) => void; keyboardType?: any; multiline?: boolean }) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput value={value} onChangeText={onChangeText} keyboardType={keyboardType} multiline={multiline} style={[styles.input, multiline && styles.multiline]} textAlign="right" /></View>;
}

function AttachmentField({ label, files, onChange, required }: { label: string; files: AttachmentFile[]; onChange: (files: AttachmentFile[]) => void; required?: boolean }) {
  return <View style={styles.attachmentBox}><Text style={styles.label}>{label}{required ? " *" : ""}</Text><AttachmentPicker attachments={files} onAttachmentsChange={onChange} maxAttachments={3} /></View>;
}

export default function RepresentativeTransactionsScreen() {
  const colors = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ type?: string }>();
  const { user } = useAuth();
  const type = (["order", "visit", "return", "custom", "sample"].includes(String(params.type)) ? params.type : "order") as TransactionType;
  const isCustom = type === "custom" || type === "sample";
  const [transactions, setTransactions] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [orderDate, setOrderDate] = useState(TODAY);
  const [deliveryDate, setDeliveryDate] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "transfer" | "credit">("cash");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [receiptNumber, setReceiptNumber] = useState("");
  const [receiptDate, setReceiptDate] = useState(TODAY);
  const [creditDays, setCreditDays] = useState<30 | 60 | 90>(30);
  const [visitReport, setVisitReport] = useState("");
  const [returnReason, setReturnReason] = useState("");
  const [items, setItems] = useState<RepresentativeItemInput[]>([emptyItem(type)]);
  const [generalFiles, setGeneralFiles] = useState<AttachmentFile[]>([]);
  const [transferFiles, setTransferFiles] = useState<AttachmentFile[]>([]);
  const [designFiles, setDesignFiles] = useState<AttachmentFile[]>([]);
  const [manufacturingFormFiles, setManufacturingFormFiles] = useState<AttachmentFile[]>([]);
  const [samplePaymentFiles, setSamplePaymentFiles] = useState<AttachmentFile[]>([]);
  const [signing, setSigning] = useState<any | null>(null);
  const [customerSignature, setCustomerSignature] = useState("");
  const [representativeSignature, setRepresentativeSignature] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [transactionRows, customerRows] = await Promise.all([representativeService.transactions.list({ transactionType: type }), representativeService.customers.list(customerSearch)]);
      setTransactions(Array.isArray(transactionRows) ? transactionRows : []);
      setCustomers(Array.isArray(customerRows) ? customerRows : []);
    } catch (error: any) { Alert.alert("تعذر التحميل", error?.message || "حدث خطأ"); }
    finally { setLoading(false); }
  }, [type, customerSearch]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setItems([emptyItem(type)]); setShowForm(false); setSigning(null); }, [type]);

  const reset = () => {
    setEditingId(null); setSelectedCustomerId(null); setCustomerSearch(""); setOrderDate(TODAY); setDeliveryDate(""); setPaymentMethod("cash"); setPaymentAmount(""); setReceiptNumber(""); setReceiptDate(TODAY); setCreditDays(30); setVisitReport(""); setReturnReason(""); setItems([emptyItem(type)]); setGeneralFiles([]); setTransferFiles([]); setDesignFiles([]); setManufacturingFormFiles([]); setSamplePaymentFiles([]); setShowForm(false);
  };

  const updateItem = (index: number, patch: Partial<RepresentativeItemInput>) => setItems((previous) => previous.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  const yarnTotal = (item: RepresentativeItemInput) => YARN_FIELDS.reduce((sum, field) => sum + Number(item.yarnRatios?.[field.key] || 0), 0);
  const selectedCustomer = customers.find((customer) => Number(customer.id) === selectedCustomerId);

  const attachments = useMemo(() => [
    ...generalFiles.map((file) => toAttachment("general", file)),
    ...transferFiles.map((file) => toAttachment("transfer_receipt", file)),
    ...designFiles.map((file) => toAttachment("design_file", file)),
    ...manufacturingFormFiles.map((file) => toAttachment("manufacturing_form", file)),
    ...samplePaymentFiles.map((file) => toAttachment("sample_payment_80", file)),
  ], [generalFiles, transferFiles, designFiles, manufacturingFormFiles, samplePaymentFiles]);

  const buildPayload = (): RepresentativeTransactionInput => ({ transactionType: type, customerId: Number(selectedCustomerId), orderDate, deliveryDate, paymentMethod: type === "order" ? paymentMethod : undefined, paymentAmount: type === "order" ? Number(paymentAmount) : 0, receiptNumber: type === "order" ? receiptNumber : "", receiptDate: type === "order" ? receiptDate : "", creditDays: type === "order" && paymentMethod === "credit" ? creditDays : undefined, visitReport, returnReason, items, attachments });

  const validate = () => {
    if (!selectedCustomerId) return "اختر العميل من الدليل المركزي";
    if (!orderDate) return "تاريخ الطلب إلزامي";
    if (["order", "custom", "sample"].includes(type) && !deliveryDate) return "موعد التسليم إلزامي";
    if (items.some((item) => !item.productName.trim() || !item.size.trim() || !item.color.trim() || Number(item.quantity) <= 0)) return "أكمل اسم ومقاس ولون وكمية كل منتج";
    if (type === "order" && (!paymentAmount || Number(paymentAmount) <= 0)) return "مبلغ الطلب إلزامي";
    if (type === "order" && paymentMethod === "cash" && (!receiptNumber || !receiptDate)) return "رقم سند القبض وتاريخه إلزاميان";
    if (type === "order" && paymentMethod === "transfer" && !transferFiles.length) return "إيصال التحويل إلزامي";
    if (type === "visit" && visitReport.trim().length < 5) return "أدخل تقرير الزيارة ونتيجتها";
    if (type === "return" && returnReason.trim().length < 5) return "أدخل سبب المرتجع بوضوح";
    if (isCustom && items.some((item) => Math.abs(yarnTotal(item) - 100) > 0.01)) return "مجموع نسب الخيوط لكل منتج يجب أن يساوي 100%";
    if (type === "sample" && items.some((item) => item.quantity < 1 || item.quantity > 5 || item.quantityUnit !== "pair")) return "العينة من 1 إلى 5 أزواج فقط";
    if (type === "sample" && !samplePaymentFiles.length) return "إيصال تحويل 80 ريال إلزامي";
    return "";
  };

  const saveDraft = async () => {
    const error = validate(); if (error) return Alert.alert("بيانات ناقصة", error);
    try {
      const payload = buildPayload();
      const result = editingId ? await representativeService.transactions.updateDraft(editingId, payload) : await representativeService.transactions.createDraft(payload);
      Alert.alert("تم الحفظ", editingId ? "تم تحديث المسودة" : `تم إنشاء المسودة ${result.referenceCode}`);
      reset(); await load();
    } catch (error: any) { Alert.alert("تعذر الحفظ", error?.message || "حدث خطأ"); }
  };

  const editDraft = async (transaction: any) => {
    try {
      const detail = await representativeService.transactions.getById(Number(transaction.id));
      setEditingId(Number(detail.id)); setSelectedCustomerId(Number(detail.customerId)); setOrderDate(detail.orderDate || TODAY); setDeliveryDate(detail.deliveryDate || ""); setPaymentMethod(detail.paymentMethod || "cash"); setPaymentAmount(String(detail.paymentAmount || "")); setReceiptNumber(detail.receiptNumber || ""); setReceiptDate(detail.receiptDate || TODAY); setCreditDays(Number(detail.creditDays || 30) as 30 | 60 | 90); setVisitReport(detail.visitReport || ""); setReturnReason(detail.returnReason || ""); setItems(detail.items?.length ? detail.items.map((item: any) => ({ productName: item.productName, size: item.size, color: item.color, quantity: Number(item.quantity), quantityUnit: item.quantityUnit, productType: item.productType || "", yarnRatios: item.yarnRatios || undefined })) : [emptyItem(type)]); setShowForm(true);
    } catch (error: any) { Alert.alert("تعذر فتح المسودة", error?.message || "حدث خطأ"); }
  };

  const signAndSubmit = async () => {
    if (!customerSignature || !representativeSignature) return Alert.alert("التوقيع مطلوب", "يجب اعتماد توقيع العميل والمندوب");
    try {
      await representativeService.transactions.sign({ id: Number(signing.id), declarationType: "customer_order", declarationText: `أقر بصحة بيانات المعاملة ${signing.referenceCode} والمنتجات والكميات وطريقة الدفع`, declarerName: signing.customerName, declarerRole: "العميل", signatureData: customerSignature });
      await representativeService.transactions.sign({ id: Number(signing.id), declarationType: "representative_order", declarationText: `أقر بأنني راجعت بيانات العميل والمعاملة ${signing.referenceCode} والمرفقات`, declarerName: user?.name || "المندوب", declarerRole: "مندوب المبيعات", signatureData: representativeSignature });
      await representativeService.transactions.submit(Number(signing.id));
      setSigning(null); setCustomerSignature(""); setRepresentativeSignature(""); await load(); Alert.alert("تم الإرسال", "أُرسلت المعاملة رسمياً إلى مدير التسويق والمبيعات");
    } catch (error: any) { Alert.alert("تعذر الإرسال", error?.message || "حدث خطأ"); }
  };

  const typeIcon = type === "order" ? "assignment" : type === "visit" ? "place" : type === "return" ? "keyboard-return" : type === "sample" ? "science" : "design-services";
  const relatedTypes: TransactionType[] = isCustom ? ["custom", "sample"] : ["order", "visit", "return"];

  if (signing) return <ScreenContainer style={{ backgroundColor: colors.background }}><View style={styles.header}><BackButton onPress={() => setSigning(null)} /><View style={{ flex: 1 }}><Text style={styles.headerTitle}>التوقيع والإرسال</Text><Text style={styles.headerSubtitle}>{signing.referenceCode} · {signing.customerName}</Text></View><MaterialIcons name="draw" size={25} color="#fff" /></View><ScrollView contentContainerStyle={styles.form}><View style={styles.notice}><Text style={styles.noticeText}>التوقيع يثبت نسخة بيانات العميل والمنتجات والدفع وقت الاعتماد، ولا تتغير هذه النسخة عند تحديث ملف العميل لاحقاً.</Text></View><SignaturePad label="توقيع العميل" onSave={setCustomerSignature} /><SignaturePad label="توقيع المندوب" onSave={setRepresentativeSignature} /><TouchableOpacity style={[styles.primaryButton, (!customerSignature || !representativeSignature) && { opacity: 0.5 }]} onPress={() => void signAndSubmit()}><MaterialIcons name="send" size={20} color="#fff" /><Text style={styles.primaryText}>اعتماد التوقيعين وإرسال المعاملة</Text></TouchableOpacity></ScrollView></ScreenContainer>;

  return <ScreenContainer style={{ backgroundColor: colors.background }}><View style={styles.header}><BackButton /><View style={{ flex: 1 }}><Text style={styles.headerTitle}>{LABELS[type]}</Text><Text style={styles.headerSubtitle}>دورة موثقة من الإنشاء حتى الاعتماد والإغلاق</Text></View><TouchableOpacity style={styles.headerButton} onPress={() => setShowForm(true)}><MaterialIcons name="add" size={24} color="#fff" /></TouchableOpacity></View><View style={styles.modeBar}>{relatedTypes.map((mode) => <TouchableOpacity key={mode} style={[styles.modeButton, type === mode && styles.modeButtonActive]} onPress={() => router.replace({ pathname: "/representative-transactions", params: { type: mode } } as any)}><Text style={[styles.modeText, type === mode && styles.modeTextActive]}>{LABELS[mode]}</Text></TouchableOpacity>)}</View>
    {showForm ? <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled"><View style={styles.notice}><MaterialIcons name="person-pin" size={20} color="#0369a1" /><Text style={styles.noticeText}>بيانات العميل تُستدعى من الدليل المركزي. إذا لم يكن العميل مسجلاً أنشئ ملفه أولاً.</Text></View><View style={styles.sectionHeader}><Text style={styles.sectionTitle}>اختيار العميل</Text><TouchableOpacity onPress={() => router.push("/representative-customers" as any)}><Text style={styles.link}>إضافة عميل جديد</Text></TouchableOpacity></View><Input label="بحث باسم العميل" value={customerSearch} onChangeText={setCustomerSearch} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.customerRow}>{customers.map((customer) => <TouchableOpacity key={customer.id} style={[styles.customerChip, selectedCustomerId === Number(customer.id) && styles.customerChipActive]} onPress={() => setSelectedCustomerId(Number(customer.id))}><Text style={[styles.customerChipTitle, selectedCustomerId === Number(customer.id) && { color: "#fff" }]}>{customer.name}</Text><Text style={[styles.customerChipMeta, selectedCustomerId === Number(customer.id) && { color: "#dbeafe" }]}>{customer.customerCode}</Text></TouchableOpacity>)}</ScrollView>
      {selectedCustomer && <View style={styles.customerSnapshot}><Text style={styles.snapshotTitle}>{selectedCustomer.name}</Text><Text style={styles.snapshotText}>السجل {selectedCustomer.commercialRegister} · {selectedCustomer.city}/{selectedCustomer.district}</Text><Text style={styles.snapshotText}>المسؤول: {selectedCustomer.contactName} · {selectedCustomer.contactPhone}</Text><Text style={styles.snapshotText}>الإصدار: {selectedCustomer.version}</Text></View>}
      <View style={styles.twoColumns}><Input label="تاريخ الطلب *" value={orderDate} onChangeText={setOrderDate} /><Input label="موعد التسليم" value={deliveryDate} onChangeText={setDeliveryDate} /></View>
      {type === "order" && <><Text style={styles.sectionTitle}>طريقة الدفع</Text><View style={styles.choiceRow}>{(["cash", "transfer", "credit"] as const).map((method) => <TouchableOpacity key={method} style={[styles.choice, paymentMethod === method && styles.choiceActive]} onPress={() => setPaymentMethod(method)}><Text style={[styles.choiceText, paymentMethod === method && styles.choiceTextActive]}>{method === "cash" ? "نقدي" : method === "transfer" ? "تحويل" : "آجل"}</Text></TouchableOpacity>)}</View><Input label="المبلغ *" value={paymentAmount} onChangeText={setPaymentAmount} keyboardType="numeric" />{paymentMethod === "cash" && <View style={styles.twoColumns}><Input label="رقم سند القبض *" value={receiptNumber} onChangeText={setReceiptNumber} /><Input label="تاريخ السند *" value={receiptDate} onChangeText={setReceiptDate} /></View>}{paymentMethod === "transfer" && <AttachmentField label="إيصال التحويل" required files={transferFiles} onChange={setTransferFiles} />}{paymentMethod === "credit" && <View style={styles.choiceRow}>{([30, 60, 90] as const).map((days) => <TouchableOpacity key={days} style={[styles.choice, creditDays === days && styles.choiceActive]} onPress={() => setCreditDays(days)}><Text style={[styles.choiceText, creditDays === days && styles.choiceTextActive]}>{days} يوم</Text></TouchableOpacity>)}</View>}</>}
      {type === "visit" && <Input label="تقرير الزيارة *" value={visitReport} onChangeText={setVisitReport} multiline />}
      {type === "return" && <Input label="سبب المرتجع *" value={returnReason} onChangeText={setReturnReason} multiline />}
      <Text style={styles.sectionTitle}>بيانات المنتجات</Text>{items.map((item, index) => <View key={index} style={styles.itemCard}><View style={styles.itemHeader}><TouchableOpacity disabled={items.length === 1} onPress={() => setItems(items.filter((_, itemIndex) => itemIndex !== index))}><MaterialIcons name="delete-outline" size={20} color={items.length === 1 ? "#cbd5e1" : "#dc2626"} /></TouchableOpacity><Text style={styles.itemTitle}>المنتج {index + 1}</Text></View><Input label="اسم المنتج *" value={item.productName} onChangeText={(value) => updateItem(index, { productName: value })} />{isCustom && <><Text style={styles.label}>النوع *</Text><View style={styles.wrapRow}>{Object.keys(PRODUCT_SIZES).map((productType) => <TouchableOpacity key={productType} style={[styles.smallChip, item.productType === productType && styles.smallChipActive]} onPress={() => updateItem(index, { productType, size: "" })}><Text style={[styles.smallChipText, item.productType === productType && styles.smallChipTextActive]}>{productType}</Text></TouchableOpacity>)}</View></>}<Text style={styles.label}>المقاس *</Text>{isCustom ? <View style={styles.wrapRow}>{(PRODUCT_SIZES[item.productType || ""] || []).map((size) => <TouchableOpacity key={size} style={[styles.smallChip, item.size === size && styles.smallChipActive]} onPress={() => updateItem(index, { size })}><Text style={[styles.smallChipText, item.size === size && styles.smallChipTextActive]}>{size}</Text></TouchableOpacity>)}</View> : <Input label="المقاس" value={item.size} onChangeText={(value) => updateItem(index, { size: value })} />}<Input label="اللون *" value={item.color} onChangeText={(value) => updateItem(index, { color: value })} /><View style={styles.twoColumns}><Input label="الكمية *" value={String(item.quantity)} onChangeText={(value) => updateItem(index, { quantity: Number(value || 0) })} keyboardType="numeric" /><View style={styles.field}><Text style={styles.label}>الوحدة</Text><View style={styles.choiceRow}>{(["dozen", "pair"] as const).map((unit) => <TouchableOpacity key={unit} disabled={type === "sample" && unit === "dozen"} style={[styles.choice, item.quantityUnit === unit && styles.choiceActive, type === "sample" && unit === "dozen" && { opacity: 0.35 }]} onPress={() => updateItem(index, { quantityUnit: unit })}><Text style={[styles.choiceText, item.quantityUnit === unit && styles.choiceTextActive]}>{unit === "dozen" ? "درزن" : "زوج"}</Text></TouchableOpacity>)}</View></View></View>{isCustom && <View style={styles.yarnBox}><View style={styles.itemHeader}><Text style={[styles.total, { color: Math.abs(yarnTotal(item) - 100) < 0.01 ? "#15803d" : "#dc2626" }]}>المجموع {yarnTotal(item).toFixed(1)}%</Text><Text style={styles.itemTitle}>نسب الخيوط</Text></View><View style={styles.yarnGrid}>{YARN_FIELDS.map((field) => <View key={field.key} style={styles.yarnField}><Text style={styles.yarnLabel}>{field.label}</Text><TextInput value={String(item.yarnRatios?.[field.key] || "")} onChangeText={(value) => updateItem(index, { yarnRatios: { ...(item.yarnRatios || {}), [field.key]: Number(value || 0) } })} keyboardType="numeric" style={styles.yarnInput} textAlign="center" /></View>)}</View></View>}</View>)}<TouchableOpacity style={styles.addItem} onPress={() => setItems([...items, emptyItem(type)])}><MaterialIcons name="add-circle" size={20} color="#0a7ea4" /><Text style={styles.link}>إضافة منتج آخر</Text></TouchableOpacity>
      {isCustom && <><AttachmentField label="نموذج التصنيع" required files={manufacturingFormFiles} onChange={setManufacturingFormFiles} /><AttachmentField label="ملف التصميم" required files={designFiles} onChange={setDesignFiles} /></>}{type === "sample" && <AttachmentField label="إيصال تحويل 80 ريال" required files={samplePaymentFiles} onChange={setSamplePaymentFiles} />}<AttachmentField label="مرفقات إضافية" files={generalFiles} onChange={setGeneralFiles} />
      <View style={styles.actionRow}><TouchableOpacity style={[styles.actionButton, styles.secondaryButton]} onPress={reset}><Text style={styles.secondaryText}>إلغاء</Text></TouchableOpacity><TouchableOpacity style={[styles.actionButton, styles.primaryButton]} onPress={() => void saveDraft()}><MaterialIcons name="save" size={19} color="#fff" /><Text style={styles.primaryText}>حفظ كمسودة</Text></TouchableOpacity></View></ScrollView> : loading ? <ActivityIndicator style={{ marginTop: 50 }} color={colors.primary} /> : <ScrollView contentContainerStyle={styles.list}>{transactions.length === 0 ? <Text style={styles.empty}>لا توجد معاملات من هذا النوع</Text> : transactions.map((transaction) => <View key={transaction.id} style={styles.card}><View style={styles.cardHeader}><View style={[styles.statusBadge, transaction.isOverdue && { backgroundColor: "#fee2e2" }]}><Text style={[styles.statusText, transaction.isOverdue && { color: "#b91c1c" }]}>{transaction.isOverdue ? "متأخر · " : ""}{STATUS_LABELS[transaction.status] || transaction.status}</Text></View><View style={{ flex: 1 }}><Text style={styles.cardTitle}>{transaction.customerName}</Text><Text style={styles.cardMeta}>{transaction.referenceCode} · {transaction.orderDate}</Text></View><MaterialIcons name={typeIcon as any} size={24} color="#0a7ea4" /></View><Text style={styles.cardMeta}>المندوب: {transaction.representativeName}</Text><Text style={styles.cardMeta}>المسؤول الحالي: {transaction.currentDepartment}</Text><View style={styles.cardActions}>{transaction.status === "DRAFT" && <><TouchableOpacity style={styles.editAction} onPress={() => void editDraft(transaction)}><MaterialIcons name="edit" size={17} color="#0369a1" /><Text style={styles.editActionText}>تعديل</Text></TouchableOpacity><TouchableOpacity style={styles.signAction} onPress={() => setSigning(transaction)}><MaterialIcons name="draw" size={17} color="#fff" /><Text style={styles.signActionText}>التوقيع والإرسال</Text></TouchableOpacity></>}<TouchableOpacity style={styles.detailAction} onPress={() => router.push({ pathname: "/representative-approvals", params: { id: String(transaction.id) } } as any)}><MaterialIcons name="history" size={17} color="#475569" /><Text style={styles.detailActionText}>التفاصيل</Text></TouchableOpacity></View></View>)}</ScrollView>}
  </ScreenContainer>;
}

const styles = StyleSheet.create({
  header: { backgroundColor: "#0a7ea4", paddingHorizontal: 16, paddingVertical: 16, flexDirection: "row", alignItems: "center", gap: 12 }, headerTitle: { color: "#fff", fontSize: 19, fontWeight: "900", textAlign: "right" }, headerSubtitle: { color: "#dbeafe", fontSize: 11, textAlign: "right", marginTop: 3 }, headerButton: { backgroundColor: "#ffffff26", borderRadius: 20, padding: 9 },
  modeBar: { flexDirection: "row-reverse", gap: 7, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e2e8f0" }, modeButton: { flex: 1, alignItems: "center", paddingVertical: 9, borderRadius: 9, backgroundColor: "#f1f5f9" }, modeButtonActive: { backgroundColor: "#0a7ea4" }, modeText: { color: "#475569", fontWeight: "800", fontSize: 11 }, modeTextActive: { color: "#fff" },
  form: { padding: 14, paddingBottom: 90, gap: 12 }, notice: { flexDirection: "row-reverse", backgroundColor: "#e0f2fe", borderRadius: 12, padding: 12, gap: 8 }, noticeText: { flex: 1, color: "#075985", textAlign: "right", lineHeight: 19 }, sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, sectionTitle: { color: "#0f172a", fontSize: 15, fontWeight: "900", textAlign: "right", marginTop: 6 }, link: { color: "#0a7ea4", fontWeight: "800" }, field: { flex: 1, gap: 5 }, label: { color: "#0f172a", fontWeight: "700", textAlign: "right", fontSize: 12 }, input: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 10, padding: 11, color: "#0f172a" }, multiline: { minHeight: 86, textAlignVertical: "top" }, twoColumns: { flexDirection: "row-reverse", gap: 10 }, customerRow: { gap: 8, paddingVertical: 4 }, customerChip: { minWidth: 150, backgroundColor: "#fff", borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 11, padding: 10 }, customerChipActive: { backgroundColor: "#0a7ea4", borderColor: "#0a7ea4" }, customerChipTitle: { color: "#0f172a", fontWeight: "800", textAlign: "right" }, customerChipMeta: { color: "#64748b", fontSize: 10, textAlign: "right", marginTop: 3 }, customerSnapshot: { backgroundColor: "#f0fdf4", borderColor: "#bbf7d0", borderWidth: 1, borderRadius: 11, padding: 11 }, snapshotTitle: { color: "#166534", fontWeight: "900", textAlign: "right" }, snapshotText: { color: "#15803d", fontSize: 11, textAlign: "right", marginTop: 2 }, choiceRow: { flexDirection: "row-reverse", gap: 7 }, choice: { flex: 1, backgroundColor: "#f1f5f9", borderRadius: 9, alignItems: "center", paddingVertical: 9 }, choiceActive: { backgroundColor: "#0a7ea4" }, choiceText: { color: "#475569", fontWeight: "700", fontSize: 12 }, choiceTextActive: { color: "#fff" }, itemCard: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 13, padding: 12, gap: 9 }, itemHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, itemTitle: { color: "#0f172a", fontWeight: "900", textAlign: "right" }, wrapRow: { flexDirection: "row-reverse", gap: 6, flexWrap: "wrap" }, smallChip: { backgroundColor: "#f1f5f9", borderRadius: 16, paddingHorizontal: 11, paddingVertical: 7 }, smallChipActive: { backgroundColor: "#0f766e" }, smallChipText: { color: "#475569", fontSize: 11, fontWeight: "700" }, smallChipTextActive: { color: "#fff" }, yarnBox: { backgroundColor: "#f8fafc", borderRadius: 11, padding: 10, gap: 8 }, yarnGrid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 7 }, yarnField: { width: "31%", gap: 4 }, yarnLabel: { color: "#475569", fontSize: 10, textAlign: "center" }, yarnInput: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8, padding: 8 }, total: { fontWeight: "900", fontSize: 12 }, addItem: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 5, padding: 8 }, attachmentBox: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 12, padding: 10, gap: 7 }, actionRow: { flexDirection: "row", gap: 10, marginTop: 6 }, actionButton: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 13, borderRadius: 11 }, secondaryButton: { backgroundColor: "#e2e8f0" }, primaryButton: { backgroundColor: "#0a7ea4" }, secondaryText: { color: "#475569", fontWeight: "800" }, primaryText: { color: "#fff", fontWeight: "900" },
  list: { padding: 14, paddingBottom: 80, gap: 10 }, empty: { color: "#64748b", textAlign: "center", marginTop: 50 }, card: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 14, padding: 13, gap: 7 }, cardHeader: { flexDirection: "row-reverse", alignItems: "center", gap: 9 }, cardTitle: { color: "#0f172a", fontSize: 15, fontWeight: "900", textAlign: "right" }, cardMeta: { color: "#64748b", fontSize: 11, textAlign: "right" }, statusBadge: { backgroundColor: "#fef3c7", borderRadius: 12, paddingHorizontal: 8, paddingVertical: 5 }, statusText: { color: "#92400e", fontSize: 10, fontWeight: "800" }, cardActions: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 7, marginTop: 6 }, editAction: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#e0f2fe", borderRadius: 9, padding: 8 }, editActionText: { color: "#0369a1", fontWeight: "800", fontSize: 11 }, signAction: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#0a7ea4", borderRadius: 9, padding: 8 }, signActionText: { color: "#fff", fontWeight: "800", fontSize: 11 }, detailAction: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#f1f5f9", borderRadius: 9, padding: 8 }, detailActionText: { color: "#475569", fontWeight: "800", fontSize: 11 },
});
