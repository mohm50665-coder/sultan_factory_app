import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  Alert,
  Platform,
  Share,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useLanguage } from "@/lib/language-context";
import { useAuth } from "@/lib/auth-context";
import { MaterialIcons } from "@expo/vector-icons";
import { savedProductCostsService } from "@/lib/services/api.service";

interface ColorEntry {
  color: string;
  code: string;
}

interface ThreadData {
  type: string;
  weight: number;
  pricePerKg: number;
  colors: ColorEntry[];
}

interface ProductCostData {
  id: string;
  date: string;
  productName: string;
  productColor: string;
  threads: {
    cotton: ThreadData;
    bamboo: ThreadData;
    nylon: ThreadData;
    span: ThreadData;
    spandex: ThreadData;
    rubber: ThreadData;
  };
  notes: string;
  totalCost: number;
  totalWeight: number;
  createdAt: string;
}



const createEmptyColors = (): ColorEntry[] => [
  { color: "", code: "" },
  { color: "", code: "" },
  { color: "", code: "" },
  { color: "", code: "" },
  { color: "", code: "" },
];

export default function ProductCostCalculatorScreen() {
  const router = useRouter();
  const colors = useColors();
  const { language, t, isRtl } = useLanguage();
  const { user } = useAuth();
  const isAr = language === "ar";

  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState<Omit<ProductCostData, "id" | "createdAt" | "totalCost" | "totalWeight">>({
    date: new Date().toISOString().split("T")[0],
    productName: "",
    productColor: "",
    threads: {
      cotton: { type: t("cotton"), weight: 0, pricePerKg: 0, colors: createEmptyColors() },
      bamboo: { type: t("bamboo"), weight: 0, pricePerKg: 0, colors: createEmptyColors() },
      nylon: { type: t("nylon"), weight: 0, pricePerKg: 0, colors: createEmptyColors() },
      span: { type: t("span"), weight: 0, pricePerKg: 0, colors: createEmptyColors() },
      spandex: { type: t("spandex"), weight: 0, pricePerKg: 0, colors: createEmptyColors() },
      rubber: { type: t("rubber"), weight: 0, pricePerKg: 0, colors: createEmptyColors() },
    },
    notes: "",
  });

  // Calculate totals
  const calculateTotalWeight = (): number => {
    return Object.values(formData.threads).reduce((sum, t) => sum + t.weight, 0);
  };

  const calculateThreadCost = (thread: ThreadData): number => {
    // Cost = (weight in grams / 1000) * price per kg
    return (thread.weight / 1000) * thread.pricePerKg;
  };

  const calculateTotalCost = (): number => {
    return Object.values(formData.threads).reduce((sum, t) => sum + calculateThreadCost(t), 0);
  };

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === "web") {
      window.alert(`${title}\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const handleSave = async () => {
    if (!formData.productName.trim()) {
      showAlert(
        t("alert"),
        t("enter_product_name_alert")
      );
      return;
    }

    setIsLoading(true);
    try {
      const newEntry: ProductCostData = {
        id: Date.now().toString(),
        ...formData,
        totalCost: calculateTotalCost(),
        totalWeight: calculateTotalWeight(),
        createdAt: new Date().toISOString(),
      };

      await savedProductCostsService.create({
        productName: newEntry.productName,
        totalCost: newEntry.totalCost,
        details: JSON.stringify(newEntry),
      });

      showAlert(
        t("success"),
        t("calculation_saved")
      );
      router.back();
    } catch (error) {
      console.error("Error saving:", error);
      showAlert(
        t("error"),
        t("save_error")
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = async () => {
    const totalWeight = calculateTotalWeight();
    const totalCost = calculateTotalCost();

    const threadLines = Object.entries(formData.threads).map(([key, thread]) => {
      const cost = calculateThreadCost(thread);
      const colorsText = thread.colors
        .filter((c) => c.color.trim())
        .map((c, i) => `    ${i + 1}. ${c.color} (${t("color_code")}: ${c.code})`)
        .join("\n");

      return `${thread.type}:
  ${isAr ? "الوزن" : "Weight"}: ${thread.weight} ${t("grams")}
  ${t("price_per_kg")}: ${thread.pricePerKg} ${t("riyal")}
  ${isAr ? "التكلفة" : "Cost"}: ${cost.toFixed(2)} ${t("riyal")}
  ${isAr ? "الألوان" : "Colors"}:
${colorsText || "    -"}`;
    });

    const reportText = `
═══════════════════════════════════════
${isAr ? "تقرير تكاليف المنتج" : "Product Cost Report"}
═══════════════════════════════════════

${t("date")}: ${formData.date}
${t("product_name")}: ${formData.productName}
${t("product_color")}: ${formData.productColor}

───────────────────────────────────────
${isAr ? "تفاصيل الخيوط" : "Thread Details"}
───────────────────────────────────────

${threadLines.join("\n\n")}

───────────────────────────────────────
${isAr ? "الملخص" : "Summary"}
───────────────────────────────────────
${t("total_weight")}: ${totalWeight} ${t("grams")}
${t("total_cost")}: ${totalCost.toFixed(2)} ${t("riyal")}

${formData.notes ? `${t("notes")}: ${formData.notes}` : ""}
═══════════════════════════════════════
`;

    try {
      if (Platform.OS === "web") {
        // Web: copy to clipboard
        await navigator.clipboard.writeText(reportText);
        showAlert(
          isAr ? "تم النسخ" : "Copied",
          isAr ? "تم نسخ التقرير إلى الحافظة" : "Report copied to clipboard"
        );
      } else {
        // Mobile: share
        await Share.share({
          message: reportText,
          title: isAr ? "تقرير تكاليف المنتج" : "Product Cost Report",
        });
      }
    } catch (error) {
      console.error("Export error:", error);
      showAlert(
        t("error"),
        isAr ? "حدث خطأ في التصدير" : "Error exporting data"
      );
    }
  };

  const updateThreadWeight = (threadKey: keyof typeof formData.threads, weight: number) => {
    setFormData((prev) => ({
      ...prev,
      threads: {
        ...prev.threads,
        [threadKey]: { ...prev.threads[threadKey], weight },
      },
    }));
  };

  const updateThreadPrice = (threadKey: keyof typeof formData.threads, pricePerKg: number) => {
    setFormData((prev) => ({
      ...prev,
      threads: {
        ...prev.threads,
        [threadKey]: { ...prev.threads[threadKey], pricePerKg },
      },
    }));
  };

  const updateThreadColor = (
    threadKey: keyof typeof formData.threads,
    colorIndex: number,
    field: "color" | "code",
    value: string
  ) => {
    setFormData((prev) => {
      const newColors = [...prev.threads[threadKey].colors];
      newColors[colorIndex] = { ...newColors[colorIndex], [field]: value };
      return {
        ...prev,
        threads: {
          ...prev.threads,
          [threadKey]: { ...prev.threads[threadKey], colors: newColors },
        },
      };
    });
  };

  const renderThreadSection = (
    threadKey: keyof typeof formData.threads,
    threadLabel: string,
    threadArabic: string,
    iconColor: string
  ) => {
    const thread = formData.threads[threadKey];
    const threadCost = calculateThreadCost(thread);

    return (
      <View
        key={threadKey}
        style={[
          styles.threadSection,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        {/* Thread Header */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View style={[styles.threadIcon, { backgroundColor: iconColor + "20" }]}>
              <MaterialIcons name="texture" size={18} color={iconColor} />
            </View>
            <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 15, marginLeft: 8 }}>
              {isAr ? threadArabic : threadLabel}
            </Text>
          </View>
          {threadCost > 0 && (
            <View style={[styles.costBadge, { backgroundColor: colors.primary + "15" }]}>
              <Text style={{ color: colors.primary, fontSize: 12, fontWeight: "700" }}>
                {threadCost.toFixed(2)} {t("riyal")}
              </Text>
            </View>
          )}
        </View>

        {/* Weight & Price Row */}
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
          {/* Weight */}
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.muted, fontSize: 11, marginBottom: 4, fontWeight: "600" }}>
              {isAr ? "الوزن (جرام)" : "Weight (g)"}
            </Text>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground, textAlign: isRtl ? "right" : "left" },
              ]}
              placeholder="0"
              placeholderTextColor={colors.muted}
              keyboardType="numeric"
              value={thread.weight === 0 ? "" : thread.weight.toString()}
              onChangeText={(text) => updateThreadWeight(threadKey, parseInt(text) || 0)}
            />
          </View>

          {/* Price per Kg */}
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.muted, fontSize: 11, marginBottom: 4, fontWeight: "600" }}>
              {isAr ? "سعر الكيلو (ر.س)" : "Price/Kg (SAR)"}
            </Text>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground, textAlign: isRtl ? "right" : "left" },
              ]}
              placeholder="0"
              placeholderTextColor={colors.muted}
              keyboardType="numeric"
              value={thread.pricePerKg === 0 ? "" : thread.pricePerKg.toString()}
              onChangeText={(text) => updateThreadPrice(threadKey, parseFloat(text) || 0)}
            />
          </View>
        </View>

        {/* Colors Table Header */}
        <View style={[styles.colorTableHeader, { backgroundColor: colors.primary + "10", borderColor: colors.border }]}>
          <Text style={[styles.colorHeaderText, { color: colors.primary, flex: 0.4 }]}>#</Text>
          <Text style={[styles.colorHeaderText, { color: colors.primary, flex: 2 }]}>
            {isAr ? "اللون" : "Color"}
          </Text>
          <Text style={[styles.colorHeaderText, { color: colors.primary, flex: 2 }]}>
            {t("color_code")}
          </Text>
        </View>

        {/* 5 Color Rows */}
        {thread.colors.map((colorEntry, index) => (
          <View
            key={index}
            style={[styles.colorRow, { borderColor: colors.border }]}
          >
            <Text style={[styles.colorRowNum, { color: colors.muted }]}>{index + 1}</Text>
            <TextInput
              style={[
                styles.colorInput,
                { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground, textAlign: isRtl ? "right" : "left" },
              ]}
              placeholder={isAr ? `لون ${index + 1}` : `Color ${index + 1}`}
              placeholderTextColor={colors.muted + "80"}
              value={colorEntry.color}
              onChangeText={(text) => updateThreadColor(threadKey, index, "color", text)}
            />
            <TextInput
              style={[
                styles.colorInput,
                { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground, textAlign: isRtl ? "right" : "left" },
              ]}
              placeholder={isAr ? `كود ${index + 1}` : `Code ${index + 1}`}
              placeholderTextColor={colors.muted + "80"}
              value={colorEntry.code}
              onChangeText={(text) => updateThreadColor(threadKey, index, "code", text)}
            />
          </View>
        ))}
      </View>
    );
  };

  const totalWeight = calculateTotalWeight();
  const totalCost = calculateTotalCost();

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={{ backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Pressable onPress={() => router.back()} style={({ pressed }) => [{ marginRight: 12, opacity: pressed ? 0.7 : 1 }]}>
            <MaterialIcons
              name={isRtl ? "chevron-right" : "chevron-left"}
              size={28}
              color="white"
            />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ color: "white", fontSize: 20, fontWeight: "bold" }}>
              {t("product_cost_calc")}
            </Text>
            <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 12, marginTop: 2 }}>
              {isAr ? "أدخل بيانات الخيوط والألوان والأسعار" : "Enter thread, color & price data"}
            </Text>
          </View>
          {/* Export Button */}
          <Pressable onPress={handleExport} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, padding: 8 }]}>
            <MaterialIcons name="share" size={24} color="white" />
          </Pressable>
        </View>
      </View>

      {/* Cost Summary Bar */}
      {(totalWeight > 0 || totalCost > 0) && (
        <View style={[styles.summaryBar, { backgroundColor: colors.success + "15", borderBottomColor: colors.border }]}>
          <View style={{ flexDirection: "row", justifyContent: "space-around", alignItems: "center" }}>
            <View style={{ alignItems: "center" }}>
              <Text style={{ color: colors.muted, fontSize: 11 }}>
                {t("total_weight")}
              </Text>
              <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "700" }}>
                {totalWeight} {t("grams")}
              </Text>
            </View>
            <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
            <View style={{ alignItems: "center" }}>
              <Text style={{ color: colors.muted, fontSize: 11 }}>
                {t("total_cost")}
              </Text>
              <Text style={{ color: colors.success, fontSize: 16, fontWeight: "700" }}>
                {totalCost.toFixed(2)} {t("riyal")}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Form */}
      <ScrollView style={styles.form} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {/* Basic Info Section */}
        <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 16, marginBottom: 16 }}>
            {isAr ? "البيانات الأساسية" : "Basic Information"}
          </Text>

          {/* Date */}
          <View style={{ marginBottom: 12 }}>
            <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 4, fontWeight: "600" }}>
              {t("date")}
            </Text>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground, textAlign: isRtl ? "right" : "left" },
              ]}
              value={formData.date}
              onChangeText={(text) => setFormData({ ...formData, date: text })}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.muted}
            />
          </View>

          {/* Product Name */}
          <View style={{ marginBottom: 12 }}>
            <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 4, fontWeight: "600" }}>
              {isAr ? "اسم المنتج *" : "Product Name *"}
            </Text>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground, textAlign: isRtl ? "right" : "left" },
              ]}
              placeholder={isAr ? "أدخل اسم المنتج" : "Enter product name"}
              placeholderTextColor={colors.muted}
              value={formData.productName}
              onChangeText={(text) => setFormData({ ...formData, productName: text })}
            />
          </View>

          {/* Product Color */}
          <View>
            <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 4, fontWeight: "600" }}>
              {isAr ? "لون المنتج" : "Product Color"}
            </Text>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground, textAlign: isRtl ? "right" : "left" },
              ]}
              placeholder={isAr ? "أدخل لون المنتج" : "Enter product color"}
              placeholderTextColor={colors.muted}
              value={formData.productColor}
              onChangeText={(text) => setFormData({ ...formData, productColor: text })}
            />
          </View>
        </View>

        {/* Thread Sections Title */}
        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 20, marginBottom: 12 }}>
          <MaterialIcons name="format-list-bulleted" size={20} color={colors.primary} />
          <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 16, marginLeft: 8 }}>
            {isAr ? "تفاصيل أوزان الخيوط المستخدمة وبياناتها" : "Thread Weights & Details"}
          </Text>
        </View>

        <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 16 }}>
          {isAr ? "لكل نوع خيط: الوزن بالجرام + سعر الكيلو + حتى 5 ألوان بأكوادها" : "Per thread: weight (g) + price/kg + up to 5 colors with codes"}
        </Text>

        {/* Thread Sections */}
        {renderThreadSection("cotton", "Cotton", "قطن", "#4CAF50")}
        {renderThreadSection("bamboo", "Bamboo", "بامبو", "#8BC34A")}
        {renderThreadSection("nylon", "Nylon", "نايلون", "#2196F3")}
        {renderThreadSection("span", "Span", "إسبان", "#FF9800")}
        {renderThreadSection("spandex", "Spandex", "إسباندكس", "#9C27B0")}
        {renderThreadSection("rubber", "Rubber", "مطاط", "#795548")}

        {/* Cost Summary Card */}
        <View style={[styles.sectionCard, { backgroundColor: colors.primary + "08", borderColor: colors.primary + "30", marginTop: 16 }]}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
            <MaterialIcons name="calculate" size={20} color={colors.primary} />
            <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 16, marginLeft: 8 }}>
              {t("cost_summary")}
            </Text>
          </View>

          {/* Per-thread costs */}
          {Object.entries(formData.threads).map(([key, thread]) => {
            const cost = calculateThreadCost(thread);
            if (thread.weight === 0 && thread.pricePerKg === 0) return null;
            return (
              <View key={key} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: colors.border }}>
                <Text style={{ color: colors.foreground, fontSize: 13 }}>{thread.type}</Text>
                <View style={{ flexDirection: "row", gap: 16 }}>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>{thread.weight}g × {thread.pricePerKg}{isAr ? " ر.س/كجم" : " SAR/kg"}</Text>
                  <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "600", minWidth: 70, textAlign: "right" }}>{cost.toFixed(2)} {t("riyal")}</Text>
                </View>
              </View>
            );
          })}

          {/* Total */}
          <View style={{ flexDirection: "row", justifyContent: "space-between", paddingTop: 12, marginTop: 8, borderTopWidth: 1.5, borderTopColor: colors.primary + "40" }}>
            <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "700" }}>
              {isAr ? "الإجمالي" : "Total"}
            </Text>
            <Text style={{ color: colors.primary, fontSize: 18, fontWeight: "800" }}>
              {totalCost.toFixed(2)} {t("riyal")}
            </Text>
          </View>
        </View>

        {/* Notes */}
        <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border, marginTop: 16 }]}>
          <Text style={{ color: colors.foreground, fontWeight: "600", marginBottom: 8 }}>
            {isAr ? "ملاحظات إضافية" : "Additional Notes"}
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.background,
                borderColor: colors.border,
                color: colors.foreground,
                minHeight: 80,
                textAlignVertical: "top",
                textAlign: isRtl ? "right" : "left",
              },
            ]}
            placeholder={isAr ? "أضف ملاحظات إضافية..." : "Add additional notes..."}
            placeholderTextColor={colors.muted}
            value={formData.notes}
            onChangeText={(text) => setFormData({ ...formData, notes: text })}
            multiline
          />
        </View>

        {/* Action Buttons */}
        <View style={{ flexDirection: "row", gap: 12, marginTop: 24, marginBottom: 32 }}>
          {/* Export Button */}
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.primary, flex: 1 }]}
            onPress={handleExport}
            activeOpacity={0.8}
          >
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <MaterialIcons name="ios-share" size={20} color={colors.primary} />
              <Text style={{ color: colors.primary, fontWeight: "600", fontSize: 14 }}>
                {t("export")}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Save Button */}
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.primary, flex: 2 }]}
            onPress={handleSave}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator color="white" />
            ) : (
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <MaterialIcons name="save" size={22} color="white" />
                <Text style={{ color: "white", fontWeight: "700", fontSize: 16 }}>
                  {t("save_calculation")}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  form: {
    flex: 1,
  },
  summaryBar: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  summaryDivider: {
    width: 1,
    height: 30,
  },
  sectionCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  threadSection: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  threadIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  costBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  colorTableHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    marginBottom: 8,
  },
  colorHeaderText: {
    fontSize: 12,
    fontWeight: "700",
  },
  colorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  colorRowNum: {
    width: 18,
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
  colorInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
  },
  actionButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
});
