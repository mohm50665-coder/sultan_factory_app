import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { ScreenContainer } from "@/components/screen-container";
import { BackButton } from "@/components/back-button";
import { useColors } from "@/hooks/use-colors";
import { useLanguage } from "@/lib/language-context";
import { useAuth } from "@/lib/auth-context";
import { productionService, manufacturingService, productTrackingService } from "@/lib/services/api.service";

const STAGES = [
  { id: "machines", ar: "إنتاج", en: "Production", color: "#6B7280", icon: "precision-manufacturing" },
  { id: "rosso", ar: "روسو", en: "Rosso", color: "#FACC15", icon: "loop" },
  { id: "qalb", ar: "قلب", en: "Turning", color: "#FFFFFF", icon: "flip" },
  { id: "kawiya", ar: "كاوية", en: "Ironing", color: "#111827", icon: "local-fire-department" },
  { id: "inspection", ar: "فحص", en: "Inspection", color: "#DC2626", icon: "search" },
  { id: "packing", ar: "تغليف", en: "Packing", color: "#F97316", icon: "inventory-2" },
  { id: "antislip", ar: "مانع انزلاق", en: "Anti-slip", color: "#16A34A", icon: "layers" },
  { id: "storage", ar: "تخزين", en: "Storage", color: "#8B5A2B", icon: "warehouse" },
] as const;

const numberValue = (value: unknown) => Number(value || 0) || 0;
const today = () => new Date().toISOString().slice(0, 10);

export default function ProductTrackingScreen() {
  const router = useRouter();
  const colors = useColors();
  const { language } = useLanguage();
  const { user } = useAuth();
  const isAr = language === "ar";
  const [dateFilter, setDateFilter] = useState(today());
  const [production, setProduction] = useState<any[]>([]);
  const [manufacturing, setManufacturing] = useState<any[]>([]);
  const [handoverRecords, setHandoverRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [receivedBy, setReceivedBy] = useState("");
  const [handoverNotes, setHandoverNotes] = useState("");

  const loadData = async () => {
    setLoading(true);
    try {
      const [productionRows, stageRows, trackingRows] = await Promise.all([
        productionService.getAll(),
        manufacturingService.getAll(),
        productTrackingService.list(),
      ]);
      setProduction(Array.isArray(productionRows) ? productionRows : []);
      setManufacturing(Array.isArray(stageRows) ? stageRows : []);
      setHandoverRecords(Array.isArray(trackingRows) ? trackingRows : []);
    } catch (error) {
      console.error("Product tracking load failed", error);
      Alert.alert(isAr ? "تعذر تحميل التتبع" : "Tracking unavailable", isAr ? "تحقق من اتصال الخادم ثم حاول مرة أخرى" : "Check the server connection and try again");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const groupedProducts = useMemo(() => {
    const groups: Record<string, any> = {};
    production
      .filter((row) => !dateFilter || String(row.date || "").slice(0, 10) === dateFilter)
      .forEach((row) => {
        const name = String(row.productName || (isAr ? "صنف غير محدد" : "Unnamed product"));
        if (!groups[name]) {
          groups[name] = { name, dozen: 0, pairs: 0, weight: 0, machines: [], yarn: { cotton: 0, bamboo: 0, nylon: 0, span: 0, spandex: 0, rubber: 0 } };
        }
        const item = groups[name];
        item.dozen += numberValue(row.productionDozen);
        item.pairs += numberValue(row.productionPairs);
        item.weight += ["yarnCotton", "yarnBamboo", "yarnNylon", "yarnSpan", "yarnSpandex", "yarnRubber"].reduce((sum, key) => sum + numberValue(row[key]), 0);
        if (row.machineNumber && !item.machines.includes(String(row.machineNumber))) item.machines.push(String(row.machineNumber));
        item.yarn.cotton += numberValue(row.yarnCotton);
        item.yarn.bamboo += numberValue(row.yarnBamboo);
        item.yarn.nylon += numberValue(row.yarnNylon);
        item.yarn.span += numberValue(row.yarnSpan);
        item.yarn.spandex += numberValue(row.yarnSpandex);
        item.yarn.rubber += numberValue(row.yarnRubber);
      });
    return Object.values(groups).sort((a, b) => a.name.localeCompare(b.name, isAr ? "ar" : "en"));
  }, [production, dateFilter, isAr]);

  const stageForProduct = (productName: string) => {
    const rows = manufacturing
      .filter((row) => String(row.productName || "") === productName)
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    return rows[0]?.stageName || "machines";
  };

  const yarnLabels = [
    ["cotton", isAr ? "قطن" : "Cotton"], ["bamboo", isAr ? "بامبو" : "Bamboo"], ["nylon", isAr ? "نايلون" : "Nylon"],
    ["span", isAr ? "سبان" : "Span"], ["spandex", isAr ? "إسباندكس" : "Spandex"], ["rubber", isAr ? "مطاط" : "Rubber"],
  ] as const;

  const saveHandover = async () => {
    if (!selectedProduct || !receivedBy.trim()) {
      Alert.alert(isAr ? "بيانات ناقصة" : "Missing data", isAr ? "اكتب اسم المستلم قبل اعتماد التسليم" : "Enter the receiver name before confirming the handover");
      return;
    }
    const currentStage = stageForProduct(selectedProduct.name);
    const stageIndex = Math.max(0, STAGES.findIndex((stage) => stage.id === currentStage));
    const nextStage = STAGES[Math.min(stageIndex + 1, STAGES.length - 1)].id;
    try {
      await productTrackingService.create({
        productName: selectedProduct.name,
        trackingDate: dateFilter || today(),
        totalWeightGrams: Math.round(selectedProduct.weight),
        yarnDetails: selectedProduct.yarn,
        quantityDozen: Math.round(selectedProduct.dozen),
        quantityPairs: Math.round(selectedProduct.pairs),
        machineNumbers: selectedProduct.machines,
        currentStage: nextStage,
        previousStage: currentStage,
        deliveredBy: user?.name || "",
        receivedBy: receivedBy.trim(),
        handoverStatus: "received",
        notes: handoverNotes.trim() || undefined,
        userId: user?.id || 1,
      });
      setReceivedBy("");
      setHandoverNotes("");
      setSelectedProduct(null);
      await loadData();
      Alert.alert(isAr ? "تم توثيق التسليم" : "Handover recorded", isAr ? "تم حفظ المسلم والمستلم والكمية والوزن والمرحلة والتاريخ" : "The handover, quantity, weight, stage, and date were recorded");
    } catch (error) {
      Alert.alert(isAr ? "تعذر الحفظ" : "Save failed", isAr ? "تعذر حفظ سجل التسليم والاستلام" : "The handover record could not be saved");
    }
  };

  return (
    <ScreenContainer style={{ backgroundColor: colors.background }}>
      <View style={{ backgroundColor: colors.primary, paddingHorizontal: 18, paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <BackButton />
        <View style={{ flex: 1, alignItems: "flex-end", marginHorizontal: 12 }}>
          <Text style={{ color: "#fff", fontSize: 19, fontWeight: "800" }}>{isAr ? "تتبع المنتجات" : "Product Tracking"}</Text>
          <Text style={{ color: "#E0F2FE", fontSize: 11, marginTop: 2 }}>{isAr ? "تقرير يومي موثق من الإنتاج إلى التخزين" : "Daily trace from production to storage"}</Text>
        </View>
        <MaterialIcons name="timeline" size={30} color="#fff" />
      </View>
      <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 40 }}>
        <View style={{ backgroundColor: colors.surface, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: colors.border, marginBottom: 12 }}>
          <Text style={{ color: colors.foreground, fontWeight: "700", textAlign: "right", marginBottom: 7 }}>{isAr ? "تاريخ التقرير" : "Report date"}</Text>
          <TextInput value={dateFilter} onChangeText={setDateFilter} placeholder="YYYY-MM-DD" placeholderTextColor={colors.muted} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 8, color: colors.foreground, textAlign: "right" }} />
          <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-end", marginTop: 10, gap: 6 }}>
            {STAGES.map((stage) => (
              <View key={stage.id} style={{ flexDirection: "row", alignItems: "center", marginLeft: 7, marginBottom: 4 }}>
                <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: stage.color, borderWidth: stage.id === "qalb" ? 1 : 0, borderColor: colors.border, marginLeft: 4 }} />
                <Text style={{ color: colors.muted, fontSize: 10 }}>{isAr ? stage.ar : stage.en}</Text>
              </View>
            ))}
          </View>
        </View>

        {loading ? <ActivityIndicator size="large" color={colors.primary} /> : groupedProducts.length === 0 ? (
          <View style={{ padding: 24, alignItems: "center" }}><MaterialIcons name="inventory" size={42} color={colors.muted} /><Text style={{ color: colors.muted, marginTop: 8, textAlign: "center" }}>{isAr ? "لا توجد بيانات إنتاج لهذا التاريخ" : "No production data for this date"}</Text></View>
        ) : groupedProducts.map((product) => {
          const currentStage = stageForProduct(product.name);
          const stageIndex = Math.max(0, STAGES.findIndex((stage) => stage.id === currentStage));
          const yarnTotal = Object.values(product.yarn).reduce((sum: number, value: any) => sum + numberValue(value), 0);
          return (
            <View key={product.name} style={{ backgroundColor: colors.surface, borderRadius: 14, padding: 13, borderWidth: 1, borderColor: colors.border, marginBottom: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <TouchableOpacity onPress={() => setSelectedProduct(product)} style={{ backgroundColor: colors.primary, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 7 }}><Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>{isAr ? "تسجيل تسليم" : "Record handover"}</Text></TouchableOpacity>
                <View style={{ flex: 1, alignItems: "flex-end", marginLeft: 10 }}><Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "800" }}>{product.name}</Text><Text style={{ color: colors.muted, fontSize: 11, marginTop: 3 }}>{isAr ? `المكائن: ${product.machines.join("، ") || "-"}` : `Machines: ${product.machines.join(", ") || "-"}`}</Text></View>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 11 }}>
                <View style={{ alignItems: "center", flex: 1 }}><Text style={{ color: colors.muted, fontSize: 10 }}>{isAr ? "الكمية" : "Quantity"}</Text><Text style={{ color: colors.primary, fontWeight: "800" }}>{product.dozen} {isAr ? "درزن" : "dz"} + {product.pairs} {isAr ? "زوج" : "pr"}</Text></View>
                <View style={{ alignItems: "center", flex: 1 }}><Text style={{ color: colors.muted, fontSize: 10 }}>{isAr ? "الوزن" : "Weight"}</Text><Text style={{ color: colors.foreground, fontWeight: "800" }}>{Math.round(product.weight)} {isAr ? "جرام" : "g"}</Text></View>
              </View>
              <Text style={{ color: colors.foreground, fontWeight: "700", textAlign: "right", marginTop: 11, marginBottom: 5 }}>{isAr ? "الخيوط والنسبة المئوية" : "Yarns and percentages"}</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-end", gap: 5 }}>
                {yarnLabels.filter(([key]) => numberValue(product.yarn[key]) > 0).map(([key, label]) => <View key={key} style={{ backgroundColor: colors.background, borderRadius: 7, paddingHorizontal: 7, paddingVertical: 5 }}><Text style={{ color: colors.muted, fontSize: 10, textAlign: "right" }}>{label}: {numberValue(product.yarn[key]).toFixed(0)}g ({yarnTotal ? ((numberValue(product.yarn[key]) / yarnTotal) * 100).toFixed(1) : "0"}%)</Text></View>)}
                {yarnTotal === 0 && <Text style={{ color: colors.muted, fontSize: 10 }}>{isAr ? "لا يوجد وزن خيوط مسجل" : "No yarn weight recorded"}</Text>}
              </View>
              <Text style={{ color: colors.foreground, fontWeight: "700", textAlign: "right", marginTop: 11, marginBottom: 6 }}>{isAr ? "مسار المرحلة الحالية" : "Current stage path"}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                {STAGES.map((stage, index) => <View key={stage.id} style={{ alignItems: "center", flex: 1 }}><View style={{ width: 23, height: 23, borderRadius: 12, backgroundColor: index <= stageIndex ? stage.color : colors.border, borderWidth: stage.id === "qalb" ? 1 : 0, borderColor: colors.muted, alignItems: "center", justifyContent: "center" }}><MaterialIcons name={stage.icon as any} size={13} color={stage.id === "qalb" ? "#111827" : index <= stageIndex ? "#fff" : colors.muted} /></View><Text style={{ color: index === stageIndex ? colors.foreground : colors.muted, fontSize: 8, marginTop: 3, textAlign: "center" }}>{isAr ? stage.ar : stage.en}</Text></View>)}
              </View>
              <Text style={{ color: colors.muted, fontSize: 10, textAlign: "right", marginTop: 8 }}>{isAr ? `المرحلة الحالية: ${STAGES[stageIndex]?.ar}` : `Current stage: ${STAGES[stageIndex]?.en}`}</Text>
            </View>
          );
        })}

        <View style={{ backgroundColor: colors.surface, borderRadius: 14, padding: 13, borderWidth: 1, borderColor: colors.border, marginTop: 4 }}>
          <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "800", textAlign: "right" }}>{isAr ? "سجل التسليم والاستلام" : "Handover and receipt log"}</Text>
          {handoverRecords.filter((row) => !dateFilter || String(row.trackingDate || "").slice(0, 10) === dateFilter).slice(0, 20).map((row) => <View key={String(row.id)} style={{ borderTopWidth: 1, borderColor: colors.border, paddingVertical: 8, marginTop: 7 }}><Text style={{ color: colors.foreground, fontWeight: "700", textAlign: "right" }}>{row.productName}</Text><Text style={{ color: colors.muted, fontSize: 10, textAlign: "right", marginTop: 3 }}>{isAr ? `من ${row.previousStage || "-"} إلى ${row.currentStage || "-"} | المُسلِّم: ${row.deliveredBy || "-"} | المُستلم: ${row.receivedBy || "-"}` : `From ${row.previousStage || "-"} to ${row.currentStage || "-"} | Delivered: ${row.deliveredBy || "-"} | Received: ${row.receivedBy || "-"}`}</Text><Text style={{ color: colors.muted, fontSize: 10, textAlign: "right", marginTop: 2 }}>{isAr ? `الكمية: ${row.quantityDozen || 0} درزن + ${row.quantityPairs || 0} زوج | الوزن: ${row.totalWeightGrams || 0} جرام` : `Quantity: ${row.quantityDozen || 0} dz + ${row.quantityPairs || 0} pairs | Weight: ${row.totalWeightGrams || 0} g`}</Text></View>)}
          {handoverRecords.filter((row) => !dateFilter || String(row.trackingDate || "").slice(0, 10) === dateFilter).length === 0 && <Text style={{ color: colors.muted, textAlign: "right", marginTop: 9, fontSize: 11 }}>{isAr ? "لا توجد عمليات تسليم واستلام لهذا التاريخ" : "No handovers for this date"}</Text>}
        </View>
      </ScrollView>

      {selectedProduct && <View style={{ position: "absolute", left: 12, right: 12, bottom: 12, backgroundColor: colors.surface, borderRadius: 14, padding: 13, borderWidth: 2, borderColor: colors.primary, shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 8, elevation: 8 }}><View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}><TouchableOpacity onPress={() => setSelectedProduct(null)}><MaterialIcons name="close" size={22} color={colors.muted} /></TouchableOpacity><Text style={{ color: colors.foreground, fontWeight: "800", textAlign: "right", flex: 1 }}>{isAr ? `تسليم: ${selectedProduct.name}` : `Handover: ${selectedProduct.name}`}</Text></View><TextInput value={receivedBy} onChangeText={setReceivedBy} placeholder={isAr ? "اسم المستلم" : "Receiver name"} placeholderTextColor={colors.muted} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 9, color: colors.foreground, textAlign: "right", marginTop: 9 }} /><TextInput value={handoverNotes} onChangeText={setHandoverNotes} placeholder={isAr ? "ملاحظات التسليم (اختياري)" : "Handover notes (optional)"} placeholderTextColor={colors.muted} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 9, color: colors.foreground, textAlign: "right", marginTop: 7 }} /><TouchableOpacity onPress={saveHandover} style={{ backgroundColor: colors.primary, borderRadius: 9, padding: 10, alignItems: "center", marginTop: 9 }}><Text style={{ color: "#fff", fontWeight: "800" }}>{isAr ? "اعتماد التسليم والاستلام" : "Confirm handover and receipt"}</Text></TouchableOpacity></View>}
    </ScreenContainer>
  );
}
