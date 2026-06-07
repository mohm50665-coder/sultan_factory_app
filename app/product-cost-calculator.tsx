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
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useLanguage } from "@/lib/language-context";
import { useAuth } from "@/lib/auth-context";
import { MaterialIcons } from "@expo/vector-icons";
import { trpc } from "@/lib/trpc";

interface ThreadData {
  type: string;
  weight: number;
  color: string;
  code: string;
}

interface ProductCostData {
  date: string;
  productName: string;
  productColor: string;
  cotton: ThreadData;
  bamboo: ThreadData;
  nylon: ThreadData;
  span: ThreadData;
  spandex: ThreadData;
  rubber: ThreadData;
  notes: string;
}

export default function ProductCostCalculatorScreen() {
  const router = useRouter();
  const colors = useColors();
  const { language, isRtl } = useLanguage();
  const { user } = useAuth();
  const isAr = language === "ar";

  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState<ProductCostData>({
    date: new Date().toISOString().split("T")[0],
    productName: "",
    productColor: "",
    cotton: { type: "قطن", weight: 0, color: "", code: "" },
    bamboo: { type: "بامبو", weight: 0, color: "", code: "" },
    nylon: { type: "نايلون", weight: 0, color: "", code: "" },
    span: { type: "إسبان", weight: 0, color: "", code: "" },
    spandex: { type: "إسباندكس", weight: 0, color: "", code: "" },
    rubber: { type: "مطاط", weight: 0, color: "", code: "" },
    notes: "",
  });

  // Mutation to save product cost calculation
  const saveMutation = trpc.productCostCalculation.create.useMutation();

  const handleSave = async () => {
    if (!formData.productName.trim()) {
      alert(isAr ? "الرجاء إدخال اسم المنتج" : "Please enter product name");
      return;
    }

    setIsLoading(true);
    try {
      const totalWeight =
        formData.cotton.weight +
        formData.bamboo.weight +
        formData.nylon.weight +
        formData.span.weight +
        formData.spandex.weight +
        formData.rubber.weight;

      await saveMutation.mutateAsync({
        date: formData.date,
        productName: formData.productName,
        productColor: formData.productColor,
        cottonWeight: formData.cotton.weight,
        cottonColor: formData.cotton.color,
        cottonCode: formData.cotton.code,
        bambooWeight: formData.bamboo.weight,
        bambooColor: formData.bamboo.color,
        bambooCode: formData.bamboo.code,
        nylonWeight: formData.nylon.weight,
        nylonColor: formData.nylon.color,
        nylonCode: formData.nylon.code,
        spanWeight: formData.span.weight,
        spanColor: formData.span.color,
        spanCode: formData.span.code,
        spandexWeight: formData.spandex.weight,
        spandexColor: formData.spandex.color,
        spandexCode: formData.spandex.code,
        rubberWeight: formData.rubber.weight,
        rubberColor: formData.rubber.color,
        rubberCode: formData.rubber.code,
        totalThreadWeight: totalWeight,
        notes: formData.notes,
        userId: user?.id || 0,
      });

      alert(isAr ? "تم حفظ البيانات بنجاح" : "Data saved successfully");
      router.back();
    } catch (error) {
      console.error("Error saving:", error);
      alert(isAr ? "حدث خطأ في الحفظ" : "Error saving data");
    } finally {
      setIsLoading(false);
    }
  };

  const renderThreadSection = (
    threadKey: keyof Omit<ProductCostData, "date" | "productName" | "productColor" | "notes">,
    threadLabel: string,
    threadArabic: string
  ) => {
    const thread = formData[threadKey] as ThreadData;

    return (
      <View
        key={threadKey}
        style={[
          styles.threadSection,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 14, marginBottom: 12 }}>
          {isAr ? threadArabic : threadLabel}
        </Text>

        <View style={{ gap: 8 }}>
          {/* Weight */}
          <View>
            <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 4 }}>
              {isAr ? "الوزن (جرام)" : "Weight (grams)"}
            </Text>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground },
              ]}
              placeholder="0"
              keyboardType="numeric"
              value={thread.weight.toString()}
              onChangeText={(text) => {
                const newData = { ...formData };
                (newData[threadKey] as ThreadData).weight = parseInt(text) || 0;
                setFormData(newData);
              }}
            />
          </View>

          {/* Color */}
          <View>
            <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 4 }}>
              {isAr ? "اللون" : "Color"}
            </Text>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground },
              ]}
              placeholder={isAr ? "أدخل اللون" : "Enter color"}
              value={thread.color}
              onChangeText={(text) => {
                const newData = { ...formData };
                (newData[threadKey] as ThreadData).color = text;
                setFormData(newData);
              }}
            />
          </View>

          {/* Code */}
          <View>
            <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 4 }}>
              {isAr ? "كود الخيط" : "Thread Code"}
            </Text>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground },
              ]}
              placeholder={isAr ? "أدخل كود الخيط" : "Enter thread code"}
              value={thread.code}
              onChangeText={(text) => {
                const newData = { ...formData };
                (newData[threadKey] as ThreadData).code = text;
                setFormData(newData);
              }}
            />
          </View>
        </View>
      </View>
    );
  };

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={{ backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
          <Pressable onPress={() => router.back()} style={{ marginRight: 12 }}>
            <MaterialIcons
              name={isRtl ? "chevron-right" : "chevron-left"}
              size={24}
              color="white"
            />
          </Pressable>
          <Text style={{ color: "white", fontSize: 20, fontWeight: "bold", flex: 1 }}>
            {isAr ? "حساب تكاليف منتج جديد" : "Calculate Product Cost"}
          </Text>
        </View>
      </View>

      {/* Form */}
      <ScrollView style={styles.form} contentContainerStyle={{ padding: 16, gap: 16 }}>
        {/* Date */}
        <View>
          <Text style={{ color: colors.foreground, fontWeight: "600", marginBottom: 8 }}>
            {isAr ? "التاريخ" : "Date"}
          </Text>
          <TextInput
            style={[
              styles.input,
              { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground },
            ]}
            value={formData.date}
            onChangeText={(text) => setFormData({ ...formData, date: text })}
            placeholder="YYYY-MM-DD"
          />
        </View>

        {/* Product Name */}
        <View>
          <Text style={{ color: colors.foreground, fontWeight: "600", marginBottom: 8 }}>
            {isAr ? "اسم المنتج" : "Product Name"}
          </Text>
          <TextInput
            style={[
              styles.input,
              { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground },
            ]}
            placeholder={isAr ? "أدخل اسم المنتج" : "Enter product name"}
            value={formData.productName}
            onChangeText={(text) => setFormData({ ...formData, productName: text })}
          />
        </View>

        {/* Product Color */}
        <View>
          <Text style={{ color: colors.foreground, fontWeight: "600", marginBottom: 8 }}>
            {isAr ? "لون المنتج" : "Product Color"}
          </Text>
          <TextInput
            style={[
              styles.input,
              { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground },
            ]}
            placeholder={isAr ? "أدخل لون المنتج" : "Enter product color"}
            value={formData.productColor}
            onChangeText={(text) => setFormData({ ...formData, productColor: text })}
          />
        </View>

        {/* Thread Sections */}
        <View>
          <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 16, marginBottom: 12 }}>
            {isAr ? "تفاصيل الخيوط" : "Thread Details"}
          </Text>

          {renderThreadSection("cotton", "Cotton", "قطن")}
          {renderThreadSection("bamboo", "Bamboo", "بامبو")}
          {renderThreadSection("nylon", "Nylon", "نايلون")}
          {renderThreadSection("span", "Span", "إسبان")}
          {renderThreadSection("spandex", "Spandex", "إسباندكس")}
          {renderThreadSection("rubber", "Rubber", "مطاط")}
        </View>

        {/* Notes */}
        <View>
          <Text style={{ color: colors.foreground, fontWeight: "600", marginBottom: 8 }}>
            {isAr ? "ملاحظات" : "Notes"}
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                color: colors.foreground,
                minHeight: 100,
                textAlignVertical: "top",
              },
            ]}
            placeholder={isAr ? "أضف ملاحظات إضافية" : "Add additional notes"}
            value={formData.notes}
            onChangeText={(text) => setFormData({ ...formData, notes: text })}
            multiline
          />
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: colors.primary }]}
          onPress={handleSave}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="white" />
          ) : (
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <MaterialIcons name="save" size={20} color="white" />
              <Text style={{ color: "white", fontWeight: "600", fontSize: 16 }}>
                {isAr ? "حفظ" : "Save"}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  form: {
    flex: 1,
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
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  saveButton: {
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 16,
  },
});
