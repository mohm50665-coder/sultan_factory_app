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
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ width: 40 }} />
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ color: '#ffffff', fontWeight: 'bold', fontSize: 20 }}>{isAr ? "إجمالي بيانات المكائن" : "Total Machines Data"}</Text>
            <Text style={{ fontSize: 14, marginTop: 4 }}>{entries.length} {isAr ? "سجل" : "Record"}</Text>
          </View>
          <BackButton />
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {entries.length === 0 ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80 }}>
            <View style={{ backgroundColor: "#0d948815", borderRadius: 40, padding: 20 }}>
              <MaterialIcons name="summarize" size={48} color="#0d9488" />
            </View>
            <Text style={{ color: colors.foreground, fontSize: 18, marginTop: 20, fontWeight: 'bold' }}>{isAr ? "لا توجد بيانات" : "No Data"}</Text>
            <Text style={{ color: colors.muted, fontSize: 14, marginTop: 8, textAlign: 'center', paddingHorizontal: 32 }}>
              {isAr ? "لم يتم تسجيل أي بيانات إنتاج بعد." : "No production data has been recorded yet."}
            </Text>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {/* الإنتاج التام */}
            <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: colors.border }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'flex-end', marginBottom: 12 }}>
                <Text style={{ color: colors.foreground, fontWeight: 'bold', fontSize: 16 }}>{isAr ? "إنتاج تام (جميع المكائن)" : "Total Production (All Machines)"}</Text>
                <View style={{ backgroundColor: "#16a34a20", borderRadius: 14, padding: 5 }}>
                  <MaterialIcons name="check-circle" size={20} color="#16a34a" />
                </View>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 24 }}>
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ color: colors.primary, fontWeight: 'bold', fontSize: 24 }}>{grandDozen}</Text>
                  <Text style={{ color: colors.muted, fontSize: 14 }}>{isAr ? "درزن" : "Dozen"}</Text>
                </View>
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ color: colors.primary, fontWeight: 'bold', fontSize: 24 }}>{grandPairs}</Text>
                  <Text style={{ color: colors.muted, fontSize: 14 }}>{isAr ? "زوج" : "Pair"}</Text>
                </View>
              </View>
            </View>

            {/* النخب الثاني */}
            <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: colors.border }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'flex-end', marginBottom: 12 }}>
                <Text style={{ color: colors.foreground, fontWeight: 'bold', fontSize: 16 }}>{isAr ? "كمية النخب الثاني" : "Second Grade Quantity"}</Text>
                <View style={{ backgroundColor: "#f59e0b20", borderRadius: 14, padding: 5 }}>
                  <MaterialIcons name="low-priority" size={20} color="#f59e0b" />
                </View>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 24 }}>
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ color: "#f59e0b", fontWeight: "bold", fontSize: 22 }}>{grandSecondDozen}</Text>
                  <Text style={{ color: colors.muted, fontSize: 14 }}>{isAr ? "درزن" : "Dozen"}</Text>
                </View>
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ color: "#f59e0b", fontWeight: "bold", fontSize: 22 }}>{grandSecondPairs}</Text>
                  <Text style={{ color: colors.muted, fontSize: 14 }}>{isAr ? "زوج" : "Pair"}</Text>
                </View>
              </View>
            </View>

            {/* كمية وزن الهدر */}
            <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: colors.border }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'flex-end', marginBottom: 12 }}>
                <Text style={{ color: colors.foreground, fontWeight: 'bold', fontSize: 16 }}>{isAr ? "كمية وزن الهدر" : "Waste Weight Quantity"}</Text>
                <View style={{ backgroundColor: "#ef444420", borderRadius: 14, padding: 5 }}>
                  <MaterialIcons name="delete-outline" size={20} color="#ef4444" />
                </View>
              </View>
              <View style={{ gap: 8 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.background, borderRadius: 8, padding: 12 }}>
                  <Text style={{ color: colors.error, fontWeight: 'bold', fontSize: 18 }}>{grandWasteThread.toFixed(0)} {isAr ? "جم" : "g"}</Text>
                  <Text style={{ color: colors.muted, fontSize: 14 }}>{isAr ? "هدر خيوط" : "Thread Waste"}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.background, borderRadius: 8, padding: 12 }}>
                  <Text style={{ color: colors.error, fontWeight: 'bold', fontSize: 18 }}>{grandWasteSocks.toFixed(0)} {isAr ? "جم" : "g"}</Text>
                  <Text style={{ color: colors.muted, fontSize: 14 }}>{isAr ? "هدر جوارب" : "Socks Waste"}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.background, borderRadius: 8, padding: 12, borderWidth: 1, borderColor: colors.error }}>
                  <Text style={{ color: colors.error, fontWeight: 'bold', fontSize: 18 }}>{grandWasteAll.toFixed(0)} {isAr ? "جم" : "g"}</Text>
                  <Text style={{ color: colors.foreground, fontWeight: '600', fontSize: 14 }}>{isAr ? "إجمالي الهدر" : "Total Waste"}</Text>
                </View>
              </View>
            </View>

            {/* وزن الخيوط المستخدمة */}
            <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: colors.border }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'flex-end', marginBottom: 12 }}>
                <Text style={{ color: colors.foreground, fontWeight: 'bold', fontSize: 16 }}>{isAr ? "وزن الخيوط المستخدمة (جميع الأنواع)" : "Used Yarn Weight (All Types)"}</Text>
                <View style={{ backgroundColor: "#0a7ea420", borderRadius: 14, padding: 5 }}>
                  <MaterialIcons name="scale" size={20} color="#0a7ea4" />
                </View>
              </View>
              <Text style={{ color: colors.primary, fontWeight: 'bold', fontSize: 24, textAlign: 'right', marginBottom: 12 }}>{grandYarnWeight.toFixed(0)} {isAr ? "جرام" : "Grams"}</Text>
              <View style={{ gap: 8 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.background, borderRadius: 8, padding: 8, paddingHorizontal: 12 }}>
                  <Text style={{ color: colors.foreground, fontWeight: '600' }}>{totalRubber.toFixed(0)} {isAr ? "جم" : "g"}</Text>
                  <Text style={{ color: colors.muted, fontSize: 14 }}>{isAr ? "مطاط" : "Rubber"}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.background, borderRadius: 8, padding: 8, paddingHorizontal: 12 }}>
                  <Text style={{ color: colors.foreground, fontWeight: '600' }}>{totalSpandex.toFixed(0)} {isAr ? "جم" : "g"}</Text>
                  <Text style={{ color: colors.muted, fontSize: 14 }}>{isAr ? "اسباندكس" : "Spandex"}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.background, borderRadius: 8, padding: 8, paddingHorizontal: 12 }}>
                  <Text style={{ color: colors.foreground, fontWeight: '600' }}>{totalNylon.toFixed(0)} {isAr ? "جم" : "g"}</Text>
                  <Text style={{ color: colors.muted, fontSize: 14 }}>{isAr ? "نايلون" : "Nylon"}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.background, borderRadius: 8, padding: 8, paddingHorizontal: 12 }}>
                  <Text style={{ color: colors.foreground, fontWeight: '600' }}>{totalCotton.toFixed(0)} {isAr ? "جم" : "g"}</Text>
                  <Text style={{ color: colors.muted, fontSize: 14 }}>{isAr ? "قطن" : "Cotton"}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.background, borderRadius: 8, padding: 8, paddingHorizontal: 12 }}>
                  <Text style={{ color: colors.foreground, fontWeight: '600' }}>{totalBamboo.toFixed(0)} {isAr ? "جم" : "g"}</Text>
                  <Text style={{ color: colors.muted, fontSize: 14 }}>{isAr ? "بامبو" : "Bamboo"}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.background, borderRadius: 8, padding: 8, paddingHorizontal: 12 }}>
                  <Text style={{ color: colors.foreground, fontWeight: '600' }}>{totalSpan.toFixed(0)} {isAr ? "جم" : "g"}</Text>
                  <Text style={{ color: colors.muted, fontSize: 14 }}>{isAr ? "اسبان" : "Span"}</Text>
                </View>
              </View>
            </View>

            {/* هدر الإبر */}
            <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: colors.border }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'flex-end', marginBottom: 12 }}>
                <Text style={{ color: colors.foreground, fontWeight: 'bold', fontSize: 16 }}>{isAr ? "كمية هدر الإبر" : "Needles Waste Quantity"}</Text>
                <View style={{ backgroundColor: "#6b728020", borderRadius: 14, padding: 5 }}>
                  <MaterialIcons name="push-pin" size={20} color="#6b7280" />
                </View>
              </View>
              <Text style={{ color: colors.foreground, fontWeight: 'bold', fontSize: 24, textAlign: 'right' }}>{grandNeedles} {isAr ? "حبة" : "pcs"}</Text>
            </View>

            {/* نسبة الهدر */}
            <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, borderColor: wasteColor, borderWidth: 2 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'flex-end', marginBottom: 12 }}>
                <Text style={{ color: colors.foreground, fontWeight: 'bold', fontSize: 16 }}>{isAr ? "نسبة الهدر" : "Waste Percentage"}</Text>
                <View style={{ backgroundColor: wasteColor + "20", borderRadius: 14, padding: 5 }}>
                  <MaterialIcons name="percent" size={20} color={wasteColor} />
                </View>
              </View>
              <Text style={{ color: wasteColor, fontWeight: "bold", fontSize: 28, textAlign: "right" }}>
                {grandWastePercent.toFixed(2)}%
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12, textAlign: 'right', marginTop: 8 }}>
                {isAr ? "إجمالي الهدر / وزن الخيوط × 100" : "Total Waste / Yarn Weight × 100"}
              </Text>
              <View style={{ backgroundColor: wasteColor + "15", borderRadius: 8, padding: 8, marginTop: 8 }}>
                <Text style={{ color: wasteColor, fontWeight: "600", textAlign: "right", fontSize: 13 }}>
                  {grandWastePercent > 5 ? (isAr ? "⚠️ تجاوز الحد المسموح (5%)" : "⚠️ Exceeded allowed limit (5%)") : (isAr ? "✅ ضمن الحد المسموح (5%)" : "✅ Within allowed limit (5%)")}
                </Text>
              </View>
            </View>

            {/* مدة الإنتاج الإجمالية */}
            <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: colors.border }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'flex-end', marginBottom: 12 }}>
                <Text style={{ color: colors.foreground, fontWeight: 'bold', fontSize: 16 }}>{isAr ? "إجمالي مدة الإنتاج" : "Total Production Duration"}</Text>
                <View style={{ backgroundColor: "#8b5cf620", borderRadius: 14, padding: 5 }}>
                  <MaterialIcons name="timer" size={20} color="#8b5cf6" />
                </View>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 16 }}>
                <Text style={{ color: colors.muted, fontSize: 14 }}><Text style={{ color: "#8b5cf6", fontWeight: "bold", fontSize: 20 }}>{Math.round(grandMinutes)}</Text> {isAr ? "دقيقة" : "Minute"}</Text>
                <Text style={{ color: colors.muted, fontSize: 14 }}><Text style={{ color: "#8b5cf6", fontWeight: "bold", fontSize: 20 }}>{grandHours}</Text> {isAr ? "ساعة" : "Hour"}</Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
