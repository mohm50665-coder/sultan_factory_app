import React, { useState, useEffect } from "react";
import { BackButton } from "@/components/back-button";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { MaterialIcons } from "@expo/vector-icons";
import { productionService, salesService, collectionService, expensesService } from "@/lib/services/api.service";
import { useLanguage } from "@/lib/language-context";

interface KPIData {
  totalProduction: number;
  totalWastePercent: string;
  totalSales: number;
  totalCollection: number;
  totalExpenses: number;
}

export default function ReportsScreen() {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const colors = useColors();
  const [dateFilter, setDateFilter] = useState("month");
  const [kpiData, setKpiData] = useState<KPIData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRealData();
  }, []);

  const loadRealData = async () => {
    try {
      // تحميل بيانات الإنتاج من السيرفر
      const productions = await productionService.getAll() || [];

      let totalProduction = 0;
      let totalYarnWeight = 0;
      let totalWasteAll = 0;

      productions.forEach((item: any) => {
        totalProduction += parseFloat(item.productionDozen) || 0;
        const yarnWeight = (parseFloat(item.yarnRubber) || 0) + (parseFloat(item.yarnSpandex) || 0) +
          (parseFloat(item.yarnNylon) || 0) + (parseFloat(item.yarnCotton) || 0) +
          (parseFloat(item.yarnBamboo) || 0) + (parseFloat(item.yarnSpan) || 0);
        totalYarnWeight += yarnWeight;
        totalWasteAll += (parseFloat(item.wasteThreadGrams) || 0) + (parseFloat(item.wasteSocksGrams) || 0);
      });

      const wastePercent = totalYarnWeight > 0 ? ((totalWasteAll / totalYarnWeight) * 100).toFixed(2) : "0";

      // تحميل بيانات المبيعات من السيرفر
      const sales = await salesService.getAll() || [];
      let totalSales = 0;
      sales.forEach((s: any) => { totalSales += parseFloat(s.quantity) || 0; });

      // تحميل بيانات التحصيل من السيرفر
      const collections = await collectionService.getAll() || [];
      let totalCollection = 0;
      collections.forEach((c: any) => { totalCollection += parseFloat(c.amount) || 0; });

      // تحميل بيانات المصروفات من السيرفر
      const expenses = await expensesService.getAll() || [];
      let totalExpenses = 0;
      expenses.forEach((e: any) => { totalExpenses += parseFloat(e.amount) || 0; });

      setKpiData({
        totalProduction,
        totalWastePercent: wastePercent,
        totalSales,
        totalCollection,
        totalExpenses,
      });
    } catch (e) {
      console.log(e);
    } finally {
      setLoading(false);
    }
  };

  const hasData = kpiData && (kpiData.totalProduction > 0 || kpiData.totalSales > 0 || kpiData.totalCollection > 0 || kpiData.totalExpenses > 0);

  return (
    <ScreenContainer style={{ backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        {/* رأس الصفحة */}
        <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.foreground, fontSize: 24, fontWeight: "bold", marginBottom: 4, textAlign: isAr ? "right" : "left" }}>
              {isAr ? "التقارير والإحصائيات" : "Reports & Statistics"}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12, textAlign: isAr ? "right" : "left" }}>
              {isAr ? "مؤشرات الأداء بناءً على البيانات المدخلة" : "Performance indicators based on entered data"}
            </Text>
          </View>
          <BackButton />
        </View>

        {loading ? (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingVertical: 60 }}>
            <Text style={{ color: colors.muted, fontSize: 14 }}>{isAr ? "جاري تحميل البيانات..." : "Loading data..."}</Text>
          </View>
        ) : !hasData ? (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingVertical: 60 }}>
            <View style={{ backgroundColor: colors.primary + "15", borderRadius: 40, padding: 20, marginBottom: 16 }}>
              <MaterialIcons name="bar-chart" size={48} color={colors.primary} />
            </View>
            <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: "bold", marginBottom: 8 }}>
              {isAr ? "لا توجد بيانات بعد" : "No data yet"}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 13, textAlign: "center", paddingHorizontal: 40, lineHeight: 20 }}>
              {isAr ? "ستظهر التقارير والإحصائيات هنا تلقائياً بعد إدخال بيانات الإنتاج والمبيعات والمصروفات من الأقسام المختلفة." : "Reports and statistics will appear here automatically after entering production, sales, and expenses data from different departments."}
            </Text>
          </View>
        ) : (
          <View style={{ paddingHorizontal: 16 }}>
            {/* بطاقات المؤشرات */}
            <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "600", marginBottom: 12, textAlign: isAr ? "right" : "left" }}>
              {isAr ? "ملخص الأداء" : "Performance Summary"}
            </Text>

            {/* الإنتاج */}
            {kpiData.totalProduction > 0 && (
              <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, marginBottom: 12, borderRightWidth: isAr ? 4 : 0, borderLeftWidth: isAr ? 0 : 4, borderRightColor: isAr ? "#3B82F6" : "transparent", borderLeftColor: isAr ? "transparent" : "#3B82F6" }}>
                <View style={{ flexDirection: isAr ? "row" : "row-reverse", justifyContent: "space-between", alignItems: "center" }}>
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "#3B82F620", justifyContent: "center", alignItems: "center" }}>
                    <MaterialIcons name="precision-manufacturing" size={22} color="#3B82F6" />
                  </View>
                  <View style={{ flex: 1, alignItems: isAr ? "flex-end" : "flex-start", marginRight: isAr ? 12 : 0, marginLeft: isAr ? 0 : 12 }}>
                    <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 2 }}>{isAr ? "إجمالي الإنتاج" : "Total Production"}</Text>
                    <Text style={{ color: colors.foreground, fontSize: 22, fontWeight: "bold" }}>{kpiData.totalProduction.toLocaleString()}</Text>
                    <Text style={{ color: colors.muted, fontSize: 11 }}>{isAr ? "درزن" : "Dozen"}</Text>
                  </View>
                </View>
              </View>
            )}

            {/* نسبة الهدر */}
            {kpiData.totalProduction > 0 && (
              <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, marginBottom: 12, borderRightWidth: isAr ? 4 : 0, borderLeftWidth: isAr ? 0 : 4, borderRightColor: isAr ? "#EF4444" : "transparent", borderLeftColor: isAr ? "transparent" : "#EF4444" }}>
                <View style={{ flexDirection: isAr ? "row" : "row-reverse", justifyContent: "space-between", alignItems: "center" }}>
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "#EF444420", justifyContent: "center", alignItems: "center" }}>
                    <MaterialIcons name="warning" size={22} color="#EF4444" />
                  </View>
                  <View style={{ flex: 1, alignItems: isAr ? "flex-end" : "flex-start", marginRight: isAr ? 12 : 0, marginLeft: isAr ? 0 : 12 }}>
                    <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 2 }}>{isAr ? "نسبة الهدر" : "Waste Percentage"}</Text>
                    <Text style={{ color: colors.foreground, fontSize: 22, fontWeight: "bold" }}>{kpiData.totalWastePercent}%</Text>
                    <Text style={{ color: colors.muted, fontSize: 11 }}>{isAr ? "من إجمالي وزن الخيوط" : "of total yarn weight"}</Text>
                  </View>
                </View>
              </View>
            )}

            {/* المبيعات */}
            {kpiData.totalSales > 0 && (
              <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, marginBottom: 12, borderRightWidth: isAr ? 4 : 0, borderLeftWidth: isAr ? 0 : 4, borderRightColor: isAr ? "#10B981" : "transparent", borderLeftColor: isAr ? "transparent" : "#10B981" }}>
                <View style={{ flexDirection: isAr ? "row" : "row-reverse", justifyContent: "space-between", alignItems: "center" }}>
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "#10B98120", justifyContent: "center", alignItems: "center" }}>
                    <MaterialIcons name="shopping-cart" size={22} color="#10B981" />
                  </View>
                  <View style={{ flex: 1, alignItems: isAr ? "flex-end" : "flex-start", marginRight: isAr ? 12 : 0, marginLeft: isAr ? 0 : 12 }}>
                    <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 2 }}>{isAr ? "إجمالي المبيعات" : "Total Sales"}</Text>
                    <Text style={{ color: colors.foreground, fontSize: 22, fontWeight: "bold" }}>{kpiData.totalSales.toLocaleString()}</Text>
                    <Text style={{ color: colors.muted, fontSize: 11 }}>{isAr ? "زوج" : "Pair"}</Text>
                  </View>
                </View>
              </View>
            )}

            {/* التحصيل */}
            {kpiData.totalCollection > 0 && (
              <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, marginBottom: 12, borderRightWidth: isAr ? 4 : 0, borderLeftWidth: isAr ? 0 : 4, borderRightColor: isAr ? "#F59E0B" : "transparent", borderLeftColor: isAr ? "transparent" : "#F59E0B" }}>
                <View style={{ flexDirection: isAr ? "row" : "row-reverse", justifyContent: "space-between", alignItems: "center" }}>
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "#F59E0B20", justifyContent: "center", alignItems: "center" }}>
                    <MaterialIcons name="account-balance-wallet" size={22} color="#F59E0B" />
                  </View>
                  <View style={{ flex: 1, alignItems: isAr ? "flex-end" : "flex-start", marginRight: isAr ? 12 : 0, marginLeft: isAr ? 0 : 12 }}>
                    <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 2 }}>{isAr ? "إجمالي التحصيل" : "Total Collection"}</Text>
                    <Text style={{ color: colors.foreground, fontSize: 22, fontWeight: "bold" }}>{kpiData.totalCollection.toLocaleString()}</Text>
                    <Text style={{ color: colors.muted, fontSize: 11 }}>{isAr ? "ريال" : "SAR"}</Text>
                  </View>
                </View>
              </View>
            )}

            {/* المصروفات */}
            {kpiData.totalExpenses > 0 && (
              <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, marginBottom: 24, borderRightWidth: isAr ? 4 : 0, borderLeftWidth: isAr ? 0 : 4, borderRightColor: isAr ? "#8B5CF6" : "transparent", borderLeftColor: isAr ? "transparent" : "#8B5CF6" }}>
                <View style={{ flexDirection: isAr ? "row" : "row-reverse", justifyContent: "space-between", alignItems: "center" }}>
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "#8B5CF620", justifyContent: "center", alignItems: "center" }}>
                    <MaterialIcons name="receipt-long" size={22} color="#8B5CF6" />
                  </View>
                  <View style={{ flex: 1, alignItems: isAr ? "flex-end" : "flex-start", marginRight: isAr ? 12 : 0, marginLeft: isAr ? 0 : 12 }}>
                    <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 2 }}>{isAr ? "إجمالي المصروفات" : "Total Expenses"}</Text>
                    <Text style={{ color: colors.foreground, fontSize: 22, fontWeight: "bold" }}>{kpiData.totalExpenses.toLocaleString()}</Text>
                    <Text style={{ color: colors.muted, fontSize: 11 }}>{isAr ? "ريال" : "SAR"}</Text>
                  </View>
                </View>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
