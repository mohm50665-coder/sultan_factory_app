import React, { useState } from "react";
import { ScrollView, View, Text, TextInput, TouchableOpacity, Alert } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { trpcCall } from "@/lib/services/data.service";
import { useAuth } from "@/hooks/use-auth";

const THREAD_TYPES = [
  { name: "قطن", key: "cotton" },
  { name: "بامبو", key: "bamboo" },
  { name: "نايلون", key: "nylon" },
  { name: "إسبان", key: "span" },
  { name: "إسباندكس", key: "spandex" },
  { name: "مطاط", key: "rubber" },
];

interface ThreadColor {
  color: string;
  weight: string;
  code: string;
}

interface ThreadData {
  [key: string]: ThreadColor[];
}

export default function ProductCostCalculator() {
  const colors = useColors();
  const { user } = useAuth();
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [productName, setProductName] = useState("");
  const [productColor, setProductColor] = useState("");
  const [threadData, setThreadData] = useState<ThreadData>(
    THREAD_TYPES.reduce((acc, t) => ({ ...acc, [t.key]: [] }), {})
  );
  const [loading, setLoading] = useState(false);

  const addColorToThread = (threadKey: string) => {
    setThreadData((prev) => ({
      ...prev,
      [threadKey]: [
        ...prev[threadKey],
        { color: "", weight: "", code: "" },
      ],
    }));
  };

  const removeColorFromThread = (threadKey: string, index: number) => {
    setThreadData((prev) => ({
      ...prev,
      [threadKey]: prev[threadKey].filter((_, i) => i !== index),
    }));
  };

  const updateThreadColor = (
    threadKey: string,
    index: number,
    field: "color" | "weight" | "code",
    value: string
  ) => {
    setThreadData((prev) => ({
      ...prev,
      [threadKey]: prev[threadKey].map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      ),
    }));
  };

  const handleSave = async () => {
    if (!productName.trim()) {
      Alert.alert("خطأ", "يرجى إدخال اسم المنتج");
      return;
    }

    setLoading(true);
    try {
      const response = await trpcCall("productCosts.create", {
        date,
        productName,
        productColor,
        threadData,
      });

      Alert.alert("نجاح", "تم حفظ بيانات المنتج بنجاح");
        setProductName("");
        setProductColor("");
        setThreadData(
          THREAD_TYPES.reduce((acc, t) => ({ ...acc, [t.key]: [] }), {})
        );
    } catch (error) {
      Alert.alert("خطأ", (error as Error).message || "حدث خطأ أثناء الحفظ");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer className="bg-background">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="p-4">
        <Text className="text-2xl font-bold text-foreground mb-6">
          حساب تكاليف منتج جديد
        </Text>

        {/* التاريخ واسم المنتج */}
        <View className="gap-4 mb-6">
          <View>
            <Text className="text-sm font-semibold text-foreground mb-2">
              التاريخ
            </Text>
            <TextInput
              value={date}
              onChangeText={setDate}
              placeholder="YYYY-MM-DD"
              className="border border-border rounded-lg p-3 text-foreground bg-surface"
              placeholderTextColor={colors.muted}
            />
          </View>

          <View>
            <Text className="text-sm font-semibold text-foreground mb-2">
              اسم المنتج
            </Text>
            <TextInput
              value={productName}
              onChangeText={setProductName}
              placeholder="مثال: جوارب رجالي"
              className="border border-border rounded-lg p-3 text-foreground bg-surface"
              placeholderTextColor={colors.muted}
            />
          </View>

          <View>
            <Text className="text-sm font-semibold text-foreground mb-2">
              لون المنتج
            </Text>
            <TextInput
              value={productColor}
              onChangeText={setProductColor}
              placeholder="مثال: أسود"
              className="border border-border rounded-lg p-3 text-foreground bg-surface"
              placeholderTextColor={colors.muted}
            />
          </View>
        </View>

        {/* بيانات الخيوط */}
        <Text className="text-lg font-bold text-foreground mb-4">
          تفاصيل الخيوط
        </Text>

        {THREAD_TYPES.map((thread) => (
          <View
            key={thread.key}
            className="mb-6 p-4 bg-surface rounded-lg border border-border"
          >
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-base font-semibold text-foreground">
                {thread.name}
              </Text>
              <Text className="text-xs text-muted">
                {threadData[thread.key].length}/5 ألوان
              </Text>
            </View>

            {threadData[thread.key].map((item, index) => (
              <View key={index} className="mb-4 p-3 bg-background rounded-lg">
                <View className="gap-3">
                  <View>
                    <Text className="text-xs text-muted mb-1">اللون</Text>
                    <TextInput
                      value={item.color}
                      onChangeText={(value) =>
                        updateThreadColor(thread.key, index, "color", value)
                      }
                      placeholder="مثال: أحمر"
                      className="border border-border rounded p-2 text-foreground bg-surface"
                      placeholderTextColor={colors.muted}
                    />
                  </View>

                  <View>
                    <Text className="text-xs text-muted mb-1">
                      الوزن (بالجرام)
                    </Text>
                    <TextInput
                      value={item.weight}
                      onChangeText={(value) =>
                        updateThreadColor(thread.key, index, "weight", value)
                      }
                      placeholder="0"
                      keyboardType="decimal-pad"
                      className="border border-border rounded p-2 text-foreground bg-surface"
                      placeholderTextColor={colors.muted}
                    />
                  </View>

                  <View>
                    <Text className="text-xs text-muted mb-1">كود الخيط</Text>
                    <TextInput
                      value={item.code}
                      onChangeText={(value) =>
                        updateThreadColor(thread.key, index, "code", value)
                      }
                      placeholder="مثال: C001"
                      className="border border-border rounded p-2 text-foreground bg-surface"
                      placeholderTextColor={colors.muted}
                    />
                  </View>

                  <TouchableOpacity
                    onPress={() => removeColorFromThread(thread.key, index)}
                    className="bg-error rounded p-2 mt-2"
                  >
                    <Text className="text-white text-center text-sm font-semibold">
                      حذف
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}

            {threadData[thread.key].length < 5 && (
              <TouchableOpacity
                onPress={() => addColorToThread(thread.key)}
                className="bg-primary rounded p-3 mt-2"
              >
                <Text className="text-background text-center text-sm font-semibold">
                  + إضافة لون
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ))}

        {/* زر الحفظ */}
        <TouchableOpacity
          onPress={handleSave}
          disabled={loading}
          className="bg-primary rounded-lg p-4 mt-6 mb-4"
        >
          <Text className="text-background text-center text-base font-bold">
            {loading ? "جاري الحفظ..." : "حفظ البيانات"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
}
