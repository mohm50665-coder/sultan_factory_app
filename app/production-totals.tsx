import { BackButton } from "@/components/back-button";
import { View, Text, ScrollView } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useState, useEffect } from "react";
import { useLanguage } from "@/lib/language-context";

const STORAGE_KEY = "sultan_production_entries";

interface MachineData {
  productionDozen: string;
  productionPairs: string;
  wasteThreadGrams: string;
  wasteSocksGrams: string;
  secondGradeDozen: string;
  secondGradePairs: string;
  wasteNeedles: string;
  productionHours: string;
  productionMinutes: string;
  yarnRubber: string;
  yarnSpandex: string;
  yarnNylon: string;
  yarnCotton: string;
  yarnBamboo: string;
  yarnSpan: string;
}

interface ProductionEntry {
  id: string;
  date: string;
  machines: { [key: string]: MachineData };
}

export default function ProductionTotalsScreen() {
  const colors = useColors();
  const [entries, setEntries] = useState<ProductionEntry[]>([]);
  const { language } = useLanguage();
  const isAr = language === "ar";

  useEffect(() => {
    loadEntries();
  }, []);

  const loadEntries = async () => {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      if (data) {
        setEntries(JSON.parse(data));
      }
    } catch (e) {
      console.error("Error loading entries:", e);
    }
  };

  // حساب الإجماليات لجميع المكائن في جميع السجلات
  let grandDozen = 0;
  let grandPairs = 0;
  let grandSecondDozen = 0;
  let grandSecondPairs = 0;
  let grandWasteThread = 0;
  let grandWasteSocks = 0;
  let grandYarnWeight = 0;
  let grandNeedles = 0;
  let grandHours = 0;
  let grandMinutes = 0;

  // تفاصيل الخيوط حسب النوع
  let totalRubber = 0;
  let totalSpandex = 0;
  let totalNylon = 0;
  let totalCotton = 0;
  let totalBamboo = 0;
  let totalSpan = 0;

  entries.forEach(entry => {
    Object.values(entry.machines).forEach(m => {
      grandDozen += parseFloat(m.productionDozen) || 0;
      grandPairs += parseFloat(m.productionPairs) || 0;
      grandSecondDozen += parseFloat(m.secondGradeDozen) || 0;
      grandSecondPairs += parseFloat(m.secondGradePairs) || 0;
      grandWasteThread += parseFloat(m.wasteThreadGrams) || 0;
      grandWasteSocks += parseFloat(m.wasteSocksGrams) || 0;
      grandNeedles += parseFloat(m.wasteNeedles) || 0;
      grandHours += parseFloat(m.productionHours) || 0;
      grandMinutes += parseFloat(m.productionMinutes) || 0;

      const rubber = parseFloat(m.yarnRubber) || 0;
      const spandex = parseFloat(m.yarnSpandex) || 0;
      const nylon = parseFloat(m.yarnNylon) || 0;
      const cotton = parseFloat(m.yarnCotton) || 0;
      const bamboo = parseFloat(m.yarnBamboo) || 0;
      const span = parseFloat(m.yarnSpan) || 0;

      totalRubber += rubber;
      totalSpandex += spandex;
      totalNylon += nylon;
      totalCotton += cotton;
      totalBamboo += bamboo;
      totalSpan += span;

      grandYarnWeight += rubber + spandex + nylon + cotton + bamboo + span;
    });
  });

  // تحويل الدقائق الزائدة لساعات
  grandHours += Math.floor(grandMinutes / 60);
  grandMinutes = grandMinutes % 60;

  const grandWasteAll = grandWasteThread + grandWasteSocks;
  const grandWastePercent = grandYarnWeight > 0 ? ((grandWasteAll / grandYarnWeight) * 100) : 0;
  const wasteColor = grandWastePercent > 5 ? "#ef4444" : "#22c55e";

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      {/* الهيدر */}
      <View style={{ backgroundColor: "#0d9488", paddingVertical: 16, paddingHorizontal: 16 }}>
        <View className="flex-row items-center justify-between">
          <View style={{ width: 40 }} />
          <View className="flex-1 items-center">
            <Text className="text-white font-bold text-xl">{isAr ? "إجمالي بيانات المكائن" : "Total Machines Data"}</Text>
            <Text className="text-white/80 text-sm mt-1">{entries.length} {isAr ? "سجل" : "Record"}</Text>
          </View>
          <BackButton />
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {entries.length === 0 ? (
          <View className="flex-1 items-center justify-center py-20">
            <View style={{ backgroundColor: "#0d948815", borderRadius: 40, padding: 20 }}>
              <MaterialIcons name="summarize" size={48} color="#0d9488" />
            </View>
            <Text className="text-foreground text-lg mt-5 font-bold">{isAr ? "لا توجد بيانات" : "No Data"}</Text>
            <Text className="text-muted text-sm mt-2 text-center px-8">
              {isAr ? "لم يتم تسجيل أي بيانات إنتاج بعد." : "No production data has been recorded yet."}
            </Text>
          </View>
        ) : (
          <View className="gap-3">
            {/* الإنتاج التام */}
            <View className="bg-surface rounded-xl p-4 border border-border">
              <View className="flex-row items-center gap-2 justify-end mb-3">
                <Text className="text-foreground font-bold text-base">{isAr ? "إنتاج تام (جميع المكائن)" : "Total Production (All Machines)"}</Text>
                <View style={{ backgroundColor: "#16a34a20", borderRadius: 14, padding: 5 }}>
                  <MaterialIcons name="check-circle" size={20} color="#16a34a" />
                </View>
              </View>
              <View className="flex-row justify-end gap-6">
                <View className="items-center">
                  <Text className="text-primary font-bold text-2xl">{grandDozen}</Text>
                  <Text className="text-muted text-sm">{isAr ? "درزن" : "Dozen"}</Text>
                </View>
                <View className="items-center">
                  <Text className="text-primary font-bold text-2xl">{grandPairs}</Text>
                  <Text className="text-muted text-sm">{isAr ? "زوج" : "Pair"}</Text>
                </View>
              </View>
            </View>

            {/* النخب الثاني */}
            <View className="bg-surface rounded-xl p-4 border border-border">
              <View className="flex-row items-center gap-2 justify-end mb-3">
                <Text className="text-foreground font-bold text-base">{isAr ? "كمية النخب الثاني" : "Second Grade Quantity"}</Text>
                <View style={{ backgroundColor: "#f59e0b20", borderRadius: 14, padding: 5 }}>
                  <MaterialIcons name="low-priority" size={20} color="#f59e0b" />
                </View>
              </View>
              <View className="flex-row justify-end gap-6">
                <View className="items-center">
                  <Text style={{ color: "#f59e0b", fontWeight: "bold", fontSize: 22 }}>{grandSecondDozen}</Text>
                  <Text className="text-muted text-sm">{isAr ? "درزن" : "Dozen"}</Text>
                </View>
                <View className="items-center">
                  <Text style={{ color: "#f59e0b", fontWeight: "bold", fontSize: 22 }}>{grandSecondPairs}</Text>
                  <Text className="text-muted text-sm">{isAr ? "زوج" : "Pair"}</Text>
                </View>
              </View>
            </View>

            {/* كمية وزن الهدر */}
            <View className="bg-surface rounded-xl p-4 border border-border">
              <View className="flex-row items-center gap-2 justify-end mb-3">
                <Text className="text-foreground font-bold text-base">{isAr ? "كمية وزن الهدر" : "Waste Weight Quantity"}</Text>
                <View style={{ backgroundColor: "#ef444420", borderRadius: 14, padding: 5 }}>
                  <MaterialIcons name="delete-outline" size={20} color="#ef4444" />
                </View>
              </View>
              <View className="gap-2">
                <View className="flex-row justify-between items-center bg-background rounded-lg p-3">
                  <Text className="text-error font-bold text-lg">{grandWasteThread.toFixed(0)} {isAr ? "جم" : "g"}</Text>
                  <Text className="text-muted text-sm">{isAr ? "هدر خيوط" : "Thread Waste"}</Text>
                </View>
                <View className="flex-row justify-between items-center bg-background rounded-lg p-3">
                  <Text className="text-error font-bold text-lg">{grandWasteSocks.toFixed(0)} {isAr ? "جم" : "g"}</Text>
                  <Text className="text-muted text-sm">{isAr ? "هدر جوارب" : "Socks Waste"}</Text>
                </View>
                <View className="flex-row justify-between items-center bg-background rounded-lg p-3 border border-error">
                  <Text className="text-error font-bold text-lg">{grandWasteAll.toFixed(0)} {isAr ? "جم" : "g"}</Text>
                  <Text className="text-foreground font-semibold text-sm">{isAr ? "إجمالي الهدر" : "Total Waste"}</Text>
                </View>
              </View>
            </View>

            {/* وزن الخيوط المستخدمة */}
            <View className="bg-surface rounded-xl p-4 border border-border">
              <View className="flex-row items-center gap-2 justify-end mb-3">
                <Text className="text-foreground font-bold text-base">{isAr ? "وزن الخيوط المستخدمة (جميع الأنواع)" : "Used Yarn Weight (All Types)"}</Text>
                <View style={{ backgroundColor: "#0a7ea420", borderRadius: 14, padding: 5 }}>
                  <MaterialIcons name="scale" size={20} color="#0a7ea4" />
                </View>
              </View>
              <Text className="text-primary font-bold text-2xl text-right mb-3">{grandYarnWeight.toFixed(0)} {isAr ? "جرام" : "Grams"}</Text>
              <View className="gap-2">
                <View className="flex-row justify-between items-center bg-background rounded-lg p-2 px-3">
                  <Text className="text-foreground font-semibold">{totalRubber.toFixed(0)} {isAr ? "جم" : "g"}</Text>
                  <Text className="text-muted text-sm">{isAr ? "مطاط" : "Rubber"}</Text>
                </View>
                <View className="flex-row justify-between items-center bg-background rounded-lg p-2 px-3">
                  <Text className="text-foreground font-semibold">{totalSpandex.toFixed(0)} {isAr ? "جم" : "g"}</Text>
                  <Text className="text-muted text-sm">{isAr ? "اسباندكس" : "Spandex"}</Text>
                </View>
                <View className="flex-row justify-between items-center bg-background rounded-lg p-2 px-3">
                  <Text className="text-foreground font-semibold">{totalNylon.toFixed(0)} {isAr ? "جم" : "g"}</Text>
                  <Text className="text-muted text-sm">{isAr ? "نايلون" : "Nylon"}</Text>
                </View>
                <View className="flex-row justify-between items-center bg-background rounded-lg p-2 px-3">
                  <Text className="text-foreground font-semibold">{totalCotton.toFixed(0)} {isAr ? "جم" : "g"}</Text>
                  <Text className="text-muted text-sm">{isAr ? "قطن" : "Cotton"}</Text>
                </View>
                <View className="flex-row justify-between items-center bg-background rounded-lg p-2 px-3">
                  <Text className="text-foreground font-semibold">{totalBamboo.toFixed(0)} {isAr ? "جم" : "g"}</Text>
                  <Text className="text-muted text-sm">{isAr ? "بامبو" : "Bamboo"}</Text>
                </View>
                <View className="flex-row justify-between items-center bg-background rounded-lg p-2 px-3">
                  <Text className="text-foreground font-semibold">{totalSpan.toFixed(0)} {isAr ? "جم" : "g"}</Text>
                  <Text className="text-muted text-sm">{isAr ? "اسبان" : "Span"}</Text>
                </View>
              </View>
            </View>

            {/* هدر الإبر */}
            <View className="bg-surface rounded-xl p-4 border border-border">
              <View className="flex-row items-center gap-2 justify-end mb-3">
                <Text className="text-foreground font-bold text-base">{isAr ? "كمية هدر الإبر" : "Needles Waste Quantity"}</Text>
                <View style={{ backgroundColor: "#6b728020", borderRadius: 14, padding: 5 }}>
                  <MaterialIcons name="push-pin" size={20} color="#6b7280" />
                </View>
              </View>
              <Text className="text-foreground font-bold text-2xl text-right">{grandNeedles} {isAr ? "حبة" : "pcs"}</Text>
            </View>

            {/* نسبة الهدر */}
            <View className="bg-surface rounded-xl p-4" style={{ borderColor: wasteColor, borderWidth: 2, borderRadius: 12 }}>
              <View className="flex-row items-center gap-2 justify-end mb-3">
                <Text className="text-foreground font-bold text-base">{isAr ? "نسبة الهدر" : "Waste Percentage"}</Text>
                <View style={{ backgroundColor: wasteColor + "20", borderRadius: 14, padding: 5 }}>
                  <MaterialIcons name="percent" size={20} color={wasteColor} />
                </View>
              </View>
              <Text style={{ color: wasteColor, fontWeight: "bold", fontSize: 28, textAlign: "right" }}>
                {grandWastePercent.toFixed(2)}%
              </Text>
              <Text className="text-muted text-xs text-right mt-2">
                {isAr ? "إجمالي الهدر / وزن الخيوط × 100" : "Total Waste / Yarn Weight × 100"}
              </Text>
              <View style={{ backgroundColor: wasteColor + "15", borderRadius: 8, padding: 8, marginTop: 8 }}>
                <Text style={{ color: wasteColor, fontWeight: "600", textAlign: "right", fontSize: 13 }}>
                  {grandWastePercent > 5 ? (isAr ? "⚠️ تجاوز الحد المسموح (5%)" : "⚠️ Exceeded allowed limit (5%)") : (isAr ? "✅ ضمن الحد المسموح (5%)" : "✅ Within allowed limit (5%)")}
                </Text>
              </View>
            </View>

            {/* مدة الإنتاج الإجمالية */}
            <View className="bg-surface rounded-xl p-4 border border-border">
              <View className="flex-row items-center gap-2 justify-end mb-3">
                <Text className="text-foreground font-bold text-base">{isAr ? "إجمالي مدة الإنتاج" : "Total Production Duration"}</Text>
                <View style={{ backgroundColor: "#8b5cf620", borderRadius: 14, padding: 5 }}>
                  <MaterialIcons name="timer" size={20} color="#8b5cf6" />
                </View>
              </View>
              <View className="flex-row justify-end gap-4">
                <Text className="text-muted text-sm"><Text style={{ color: "#8b5cf6", fontWeight: "bold", fontSize: 20 }}>{Math.round(grandMinutes)}</Text> {isAr ? "دقيقة" : "Minute"}</Text>
                <Text className="text-muted text-sm"><Text style={{ color: "#8b5cf6", fontWeight: "bold", fontSize: 20 }}>{grandHours}</Text> {isAr ? "ساعة" : "Hour"}</Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
