import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, Switch, Text, TextInput, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { BackButton } from "@/components/back-button";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";
import { isEnglish, localize, textAlignFor, writingDirection } from "@/lib/i18n/runtime";
import { trpcCall } from "@/lib/services/api.service";

type Yarn = { name: string; percentage: number };
type Product = {
  code: string; name: string; size: string; color: string; antiSlip: boolean;
  yarnWeightGrams: number; pairWeightGrams: number; yarns: Yarn[];
};
type SampleOrder = {
  id: number; referenceCode: string; clientName: string; requirements: string;
  requestedPairs: number; product: Product | null; status: string; batchId: string | null;
  events: Array<{ at: string; action: string }>;
};

const statusLabels: Record<string, { arabic: string; english: string }> = {
  intake: { arabic: "استقبال الاحتياج", english: "Requirement received" },
  specs_ready: { arabic: "المواصفات معتمدة", english: "Specifications approved" },
  ordered: { arabic: "أمر تصنيع صادر", english: "Manufacturing order issued" },
  in_production: { arabic: "قيد الإنتاج", english: "In production" },
  ready_for_customer: { arabic: "جاهزة للعميل", english: "Ready for customer" },
  delivered: { arabic: "تم التسليم للعميل", english: "Delivered to customer" },
};

function statusLabel(language: "ar" | "en", status: string) {
  const label = statusLabels[status];
  return label ? localize(language, label.arabic, label.english) : status;
}

function operationKey(action: string, id?: number) {
  return `custody-samples:${action}:${id ?? "new"}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeDepartment(value: unknown) {
  const text = String(value || "").normalize("NFKC").trim().toLocaleLowerCase("ar").replace(/\s+/g, " ");
  if (["production", "الإنتاج", "قسم الإنتاج"].includes(text)) return "production";
  if (["sales", "المبيعات", "التسويق", "التسويق والمبيعات"].includes(text)) return "sales";
  if (["customer_service", "customer service", "خدمة العملاء"].includes(text)) return "customer_service";
  return "";
}

const blankProduct = (): Product => ({
  code: "", name: "", size: "", color: "", antiSlip: false,
  yarnWeightGrams: 0, pairWeightGrams: 0, yarns: [{ name: "", percentage: 100 }],
});

export default function CustodySamplesScreen() {
  const colors = useColors();
  const { user } = useAuth();
  const { language } = useLanguage();
  const english = isEnglish(language);
  const direction = writingDirection(language);
  const textAlign = textAlignFor(language);
  const copy = (arabic: string, englishText: string) => localize(language, arabic, englishText);
  const errorMessage = (error: any, arabic: string, englishText: string) => english ? englishText : error?.message || arabic;
  const department = normalizeDepartment(user?.department);
  const canIntake = user?.role === "admin" || department === "sales" || department === "customer_service";
  const canSetSpecs = user?.role === "admin" || department === "production";
  const [orders, setOrders] = useState<SampleOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showIntake, setShowIntake] = useState(false);
  const [editingSpecs, setEditingSpecs] = useState<number | null>(null);
  const [clientName, setClientName] = useState("");
  const [requirements, setRequirements] = useState("");
  const [requestedPairs, setRequestedPairs] = useState("");
  const [product, setProduct] = useState<Product>(blankProduct());
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await trpcCall("custodySamples.list", undefined, "query");
      setOrders(Array.isArray(response) ? response : []);
    } catch (error: any) {
      Alert.alert(copy("تعذر تحميل العينات", "Unable to load samples"), errorMessage(error, "حاول مرة أخرى", "Try again"));
    } finally {
      setLoading(false);
    }
  }, [language]);

  useEffect(() => { load(); }, [load]);

  const resetIntake = () => {
    setClientName(""); setRequirements(""); setRequestedPairs(""); setShowIntake(false);
  };

  const saveIntake = async () => {
    const pairs = Number(requestedPairs);
    if (!clientName.trim() || !requirements.trim() || !Number.isSafeInteger(pairs) || pairs <= 0) {
      Alert.alert(copy("بيانات ناقصة", "Missing information"), copy("أدخل اسم العميل والاحتياج وكمية موجبة صحيحة بالأزواج.", "Enter the client name, requirement, and a valid positive number of pairs."));
      return;
    }
    setSaving(true);
    try {
      await trpcCall("custodySamples.create", {
        operationKey: operationKey("intake"), clientName: clientName.trim(), requirements: requirements.trim(), requestedPairs: pairs,
      });
      resetIntake(); await load();
    } catch (error: any) {
      Alert.alert(copy("تعذر الحفظ", "Unable to save"), errorMessage(error, "تعذر إنشاء طلب العينة", "Unable to create the sample request"));
    } finally { setSaving(false); }
  };

  const beginSpecs = (order: SampleOrder) => {
    setEditingSpecs(order.id);
    setProduct(order.product ? { ...order.product, yarns: order.product.yarns.map((yarn) => ({ ...yarn })) } : blankProduct());
    setReason("");
  };

  const updateYarn = (index: number, field: keyof Yarn, value: string) => {
    setProduct((previous) => ({
      ...previous,
      yarns: previous.yarns.map((yarn, yarnIndex) => yarnIndex === index
        ? { ...yarn, [field]: field === "percentage" ? Number(value) : value } : yarn),
    }));
  };

  const yarnTotal = useMemo(() => product.yarns.reduce((sum, yarn) => sum + (Number(yarn.percentage) || 0), 0), [product.yarns]);
  const yarnKg = product.yarnWeightGrams / 1000;

  const saveSpecs = async () => {
    if (!editingSpecs) return;
    if (!product.code.trim() || !product.name.trim() || !product.size.trim() || !product.color.trim() || product.pairWeightGrams <= 0 || product.yarnWeightGrams < 0 || yarnTotal !== 100 || product.yarns.some((yarn) => !yarn.name.trim() || yarn.percentage <= 0)) {
      Alert.alert(copy("مواصفات غير مكتملة", "Incomplete specifications"), copy("أكمل الصنف والمقاس واللون والأوزان وخليط الخيوط بنسبة إجمالية 100٪.", "Complete the item, size, color, weights, and yarn blend totaling 100%."));
      return;
    }
    setSaving(true);
    try {
      await trpcCall("custodySamples.setSpecs", {
        id: editingSpecs, operationKey: operationKey("specs", editingSpecs), product,
        ...(reason.trim() ? { reason: reason.trim() } : {}),
      });
      setEditingSpecs(null); await load();
    } catch (error: any) {
      Alert.alert(copy("تعذر اعتماد المواصفات", "Unable to approve specifications"), errorMessage(error, "حاول مرة أخرى", "Try again"));
    } finally { setSaving(false); }
  };

  const orderProduction = async (order: SampleOrder) => {
    setSaving(true);
    try {
      await trpcCall("custodySamples.order", { id: order.id, operationKey: operationKey("order", order.id) });
      await load();
    } catch (error: any) {
      Alert.alert(copy("تعذر إصدار أمر التصنيع", "Unable to issue the manufacturing order"), errorMessage(error, "حاول مرة أخرى", "Try again"));
    } finally { setSaving(false); }
  };

  const field = (label: string, value: string, setter: (value: string) => void, keyboardType: "default" | "numeric" = "default") => (
    <View style={{ flex: 1, marginBottom: 8 }}>
      <Text style={{ color: colors.foreground, fontWeight: "800", fontSize: 12, textAlign, marginBottom: 3 }}>{label}</Text>
      <TextInput value={value} onChangeText={setter} keyboardType={keyboardType} textAlign={textAlign} placeholderTextColor={colors.muted}
        style={{ color: colors.foreground, borderColor: colors.border, borderWidth: 1, borderRadius: 7, paddingHorizontal: 9, paddingVertical: 8, backgroundColor: colors.background, direction: direction as any }} />
    </View>
  );

  if (!canIntake && !canSetSpecs) {
    return <ScreenContainer className="p-4"><View style={{ direction: direction as any }}><BackButton /><View style={{ alignItems: "center", marginTop: 40 }}><MaterialIcons name="lock-outline" size={34} color={colors.error} /><Text style={{ color: colors.foreground, fontWeight: "900", marginTop: 12, textAlign }}>{copy("وحدة العينات مخصصة للإنتاج أو المبيعات أو خدمة العملاء", "The samples unit is for Production, Sales, or Customer Service")}</Text></View></View></ScreenContainer>;
  }

  return (
    <ScreenContainer className="p-3">
      <View style={{ direction: direction as any }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 36 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <BackButton />
          <View style={{ flex: 1, alignItems: english ? "flex-start" : "flex-end" }}>
            <Text style={{ color: colors.foreground, fontWeight: "900", fontSize: 20, textAlign }}>{copy("عينات متسلسلة V2", "Sequential Samples V2")}</Text>
            <Text style={{ color: colors.muted, fontSize: 11, textAlign }}>{copy("احتياج العميل ← مواصفات الإنتاج ← أمر الدفعة ← إثبات التسليم", "Customer requirement → Production specifications → Batch order → Proof of delivery")}</Text>
          </View>
          <MaterialIcons name="science" size={27} color={colors.primary} />
        </View>

        {canIntake && <TouchableOpacity onPress={() => { setEditingSpecs(null); setShowIntake((open) => !open); }} style={{ backgroundColor: colors.primary, padding: 10, borderRadius: 8, alignItems: "center", marginBottom: 10 }}>
          <Text style={{ color: "#fff", fontWeight: "900" }}>{showIntake ? copy("إغلاق نموذج الاستقبال", "Close intake form") : copy("+ استقبال احتياج عينة", "+ Receive sample requirement")}</Text>
        </TouchableOpacity>}

        {showIntake && <View style={{ backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 10, padding: 10, marginBottom: 10, direction: direction as any }}>
          <Text style={{ color: colors.foreground, fontWeight: "900", textAlign, marginBottom: 8 }}>{copy("استقبال العميل — لا رسوم ولا دفعة في هذه المرحلة", "Customer intake — no fee or payment at this stage")}</Text>
          {field(copy("اسم العميل", "Client name"), clientName, setClientName)}
          <Text style={{ color: colors.foreground, fontWeight: "800", fontSize: 12, textAlign, marginBottom: 3 }}>{copy("الاحتياج / الملاحظات", "Requirement / notes")}</Text>
          <TextInput value={requirements} onChangeText={setRequirements} multiline textAlign={textAlign} placeholderTextColor={colors.muted}
            style={{ color: colors.foreground, minHeight: 62, borderColor: colors.border, borderWidth: 1, borderRadius: 7, padding: 9, backgroundColor: colors.background, marginBottom: 8, direction: direction as any }} />
          {field(copy("الكمية المطلوبة (زوج صحيح)", "Requested quantity (whole pairs)"), requestedPairs, setRequestedPairs, "numeric")}
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity onPress={resetIntake} style={{ flex: 1, borderColor: colors.border, borderWidth: 1, borderRadius: 7, padding: 9, alignItems: "center" }}><Text style={{ color: colors.foreground }}>{copy("إلغاء", "Cancel")}</Text></TouchableOpacity>
            <TouchableOpacity disabled={saving} onPress={saveIntake} style={{ flex: 1, backgroundColor: colors.primary, borderRadius: 7, padding: 9, alignItems: "center", opacity: saving ? 0.6 : 1 }}><Text style={{ color: "#fff", fontWeight: "900" }}>{saving ? copy("جارٍ الحفظ", "Saving…") : copy("حفظ الاستقبال", "Save intake")}</Text></TouchableOpacity>
          </View>
        </View>}

        {editingSpecs !== null && canSetSpecs && <View style={{ backgroundColor: colors.surface, borderColor: colors.primary, borderWidth: 1, borderRadius: 10, padding: 10, marginBottom: 10 }}>
          <Text style={{ color: colors.foreground, fontWeight: "900", textAlign, marginBottom: 8 }}>{copy("تحرير مواصفات الإنتاج المعتمدة", "Edit approved production specifications")}</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>{field(copy("رمز الصنف", "Item code"), product.code, (code) => setProduct((p) => ({ ...p, code })))}{field(copy("اسم الصنف", "Item name"), product.name, (name) => setProduct((p) => ({ ...p, name })))}</View>
          <View style={{ flexDirection: "row", gap: 8 }}>{field(copy("المقاس", "Size"), product.size, (size) => setProduct((p) => ({ ...p, size })))}{field(copy("اللون", "Color"), product.color, (color) => setProduct((p) => ({ ...p, color })))}</View>
          <View style={{ flexDirection: "row", gap: 8 }}>{field(copy("وزن الخيوط (غ)", "Yarn weight (g)"), String(product.yarnWeightGrams || ""), (value) => setProduct((p) => ({ ...p, yarnWeightGrams: Number(value) })), "numeric")}{field(copy("وزن الزوج (غ)", "Pair weight (g)"), String(product.pairWeightGrams || ""), (value) => setProduct((p) => ({ ...p, pairWeightGrams: Number(value) })), "numeric")}</View>
          <Text style={{ color: colors.muted, textAlign, marginBottom: 7, fontSize: 11 }}>{copy("تحويل الوزن: ", "Weight conversion: ")}{product.yarnWeightGrams || 0}{copy(" غ = ", " g = ")}{yarnKg.toFixed(3)}{copy(" كجم", " kg")}</Text>
          <View style={{ flexDirection: "row", justifyContent: english ? "flex-start" : "flex-end", alignItems: "center", gap: 8, marginBottom: 8 }}><Text style={{ color: colors.foreground, fontWeight: "800" }}>{copy("مانع انزلاق", "Anti-slip")}</Text><Switch value={product.antiSlip} onValueChange={(antiSlip) => setProduct((p) => ({ ...p, antiSlip }))} /></View>
          <Text style={{ color: colors.foreground, textAlign, fontWeight: "800", marginBottom: 5 }}>{copy("خليط الخيوط (", "Yarn blend (")}{yarnTotal}{copy("٪ / يجب 100٪)", "% / must be 100%)")}</Text>
          {product.yarns.map((yarn, index) => <View key={index} style={{ flexDirection: "row", gap: 6, alignItems: "flex-end" }}>
            {field(copy("نوع الخيط", "Yarn type"), yarn.name, (value) => updateYarn(index, "name", value))}
            {field(copy("النسبة ٪", "Ratio %"), String(yarn.percentage || ""), (value) => updateYarn(index, "percentage", value), "numeric")}
            <TouchableOpacity onPress={() => setProduct((p) => ({ ...p, yarns: p.yarns.filter((_, yarnIndex) => yarnIndex !== index) }))} disabled={product.yarns.length === 1} style={{ padding: 9, opacity: product.yarns.length === 1 ? 0.35 : 1 }}><MaterialIcons name="remove-circle-outline" size={22} color={colors.error} /></TouchableOpacity>
          </View>)}
          <TouchableOpacity onPress={() => setProduct((p) => ({ ...p, yarns: [...p.yarns, { name: "", percentage: 0 }] }))} style={{ alignSelf: english ? "flex-start" : "flex-end", paddingVertical: 5 }}><Text style={{ color: colors.primary, fontWeight: "800" }}>{copy("+ إضافة خيط", "+ Add yarn")}</Text></TouchableOpacity>
          <TextInput value={reason} onChangeText={setReason} textAlign={textAlign} placeholder={copy("سبب/ملاحظة الاعتماد (اختياري)", "Approval reason/note (optional)")} placeholderTextColor={colors.muted} style={{ color: colors.foreground, borderColor: colors.border, borderWidth: 1, borderRadius: 7, padding: 9, marginVertical: 7, direction: direction as any }} />
          <View style={{ flexDirection: "row", gap: 8 }}><TouchableOpacity onPress={() => setEditingSpecs(null)} style={{ flex: 1, borderColor: colors.border, borderWidth: 1, borderRadius: 7, padding: 9, alignItems: "center" }}><Text style={{ color: colors.foreground }}>{copy("إلغاء", "Cancel")}</Text></TouchableOpacity><TouchableOpacity disabled={saving} onPress={saveSpecs} style={{ flex: 1, backgroundColor: colors.primary, borderRadius: 7, padding: 9, alignItems: "center", opacity: saving ? 0.6 : 1 }}><Text style={{ color: "#fff", fontWeight: "900" }}>{copy("اعتماد المواصفات", "Approve specifications")}</Text></TouchableOpacity></View>
        </View>}

        <View style={{ flexDirection: "row", paddingHorizontal: 8, paddingVertical: 7, backgroundColor: colors.surface, borderRadius: 7, marginBottom: 6 }}>
          <Text style={{ flex: 1.3, color: colors.muted, fontWeight: "800", fontSize: 11, textAlign }}>{copy("العميل / المرجع", "Client / reference")}</Text><Text style={{ flex: 0.7, color: colors.muted, fontWeight: "800", fontSize: 11, textAlign: "center" }}>{copy("أزواج", "Pairs")}</Text><Text style={{ flex: 1, color: colors.muted, fontWeight: "800", fontSize: 11, textAlign: english ? "right" : "left" }}>{copy("الحالة", "Status")}</Text>
        </View>
        {loading ? <Text style={{ color: colors.muted, textAlign: "center", padding: 20 }}>{copy("جارٍ التحميل…", "Loading…")}</Text> : orders.map((order) => <View key={order.id} style={{ borderColor: colors.border, borderWidth: 1, borderRadius: 9, padding: 9, marginBottom: 7, backgroundColor: colors.background }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}><View style={{ flex: 1.3, alignItems: english ? "flex-start" : "flex-end" }}><Text style={{ color: colors.foreground, fontWeight: "900", textAlign }}>{order.clientName}</Text><Text style={{ color: colors.muted, fontSize: 10, textAlign }}>{order.referenceCode}</Text></View><Text style={{ flex: 0.7, color: colors.foreground, textAlign: "center", fontWeight: "800" }}>{order.requestedPairs}</Text><Text style={{ flex: 1, color: order.status === "delivered" ? colors.success : colors.primary, textAlign: english ? "right" : "left", fontWeight: "800", fontSize: 11 }}>{statusLabel(language, order.status)}</Text></View>
          <Text style={{ color: colors.muted, textAlign, fontSize: 11, marginTop: 4 }} numberOfLines={2}>{order.requirements}</Text>
          {order.product && <Text style={{ color: colors.muted, textAlign, fontSize: 11, marginTop: 3 }}>{order.product.code} — {order.product.name} / {order.product.size} / {order.product.color} / {order.product.antiSlip ? copy("مانع انزلاق", "Anti-slip") : copy("بدون مانع", "Without anti-slip")}</Text>}
          <View style={{ flexDirection: "row", gap: 6, marginTop: 8 }}>
            {canSetSpecs && order.status === "intake" && <TouchableOpacity onPress={() => beginSpecs(order)} style={{ flex: 1, backgroundColor: "#dbeafe", padding: 8, borderRadius: 6, alignItems: "center" }}><Text style={{ color: "#1d4ed8", fontWeight: "800", fontSize: 11 }}>{copy("إدخال المواصفات", "Enter specifications")}</Text></TouchableOpacity>}
            {canIntake && order.status === "specs_ready" && <TouchableOpacity disabled={saving} onPress={() => orderProduction(order)} style={{ flex: 1, backgroundColor: "#dcfce7", padding: 8, borderRadius: 6, alignItems: "center" }}><Text style={{ color: "#166534", fontWeight: "800", fontSize: 11 }}>{copy("إصدار أمر تصنيع", "Issue manufacturing order")}</Text></TouchableOpacity>}
            {canSetSpecs && order.status === "ordered" && <TouchableOpacity onPress={() => router.push(`/custody-batch-entry?sampleRequestId=${order.id}` as any)} style={{ flex: 1, backgroundColor: "#ede9fe", padding: 8, borderRadius: 6, alignItems: "center" }}><Text style={{ color: "#6d28d9", fontWeight: "800", fontSize: 11 }}>{copy("فتح إدخال الدفعة", "Open batch entry")}</Text></TouchableOpacity>}
          </View>
        </View>)}
        {!loading && orders.length === 0 && <Text style={{ color: colors.muted, textAlign: "center", padding: 20 }}>{copy("لا توجد طلبات عينات V2.", "No V2 sample requests.")}</Text>}
      </ScrollView>
      </View>
    </ScreenContainer>
  );
}
