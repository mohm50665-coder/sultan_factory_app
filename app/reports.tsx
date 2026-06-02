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
import AsyncStorage from "@react-native-async-storage/async-storage";

interface KPIData {
  totalProduction: number;
  totalWastePercent: string;
  totalSales: number;
  totalCollection: number;
  totalExpenses: number;
}

export default function ReportsScreen() {
  const colors = useColors();
  const [dateFilter, setDateFilter] = useState("month");
  const [kpiData, setKpiData] = useState<KPIData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRealData();
  }, []);

  const loadRealData = async () => {
    try {
      // تحميل بيانات الإنتاج
      const prodData = await AsyncStorage.getItem("sultan_production_data_v2");
      const productions = prodData ? JSON.parse(prodData) : [];

      let totalProduction = 0;
      let totalYarnWeight = 0;
      let totalWasteAll = 0;

      productions.forEach((entry: any) => {
        if (entry.machines) {
          Object.values(entry.machines).forEach((m: any) => {
            totalProduction += parseFloat(m.productionDozen) || 0;
            const yarnWeight = (parseFloat(m.yarnRubber) || 0) + (parseFloat(m.yarnSpandex) || 0) +
              (parseFloat(m.yarnNylon) || 0) + (parseFloat(m.yarnCotton) || 0) +
              (parseFloat(m.yarnBamboo) || 0) + (parseFloat(m.yarnSpan) || 0);
            totalYarnWeight += yarnWeight;
            totalWasteAll += (parseFloat(m.wasteThreadGrams) || 0) + (parseFloat(m.wasteSocksGrams) || 0);
          });
        }
      });

      const wastePercent = totalYarnWeight > 0 ? ((totalWasteAll / totalYarnWeight) * 100).toFixed(2) : "0";

      // تحميل بيانات المبيعات
      const salesData = await AsyncStorage.getItem("sultan_sales_data");
      const sales = salesData ? JSON.parse(salesData) : [];
      let totalSales = 0;
      sales.forEach((s: any) => { totalSales += parseFloat(s.quantity) || 0; });

      // تحميل بيانات التحصيل
      const collData = await AsyncStorage.getItem("sultan_collection_data");
      const collections = collData ? JSON.parse(collData) : [];
      let totalCollection = 0;
      collections.forEach((c: any) => { totalCollection += parseFloat(c.amount) || 0; });

      // تحميل بيانات المصروفات
      const expData = await AsyncStorage.getItem("sultan_expenses_data");
      const expenses = expData ? JSON.parse(expData) : [];
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
            <Text style={{ color: colors.foreground, fontSize: 24, fontWeight: "bold", marginBottom: 4, textAlign: "right" }}>
              التقارير والإحصائيات
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12, textAlign: "right" }}>
              مؤشرات الأداء بناءً على البيانات المدخلة
            </Text>
          </View>
          <BackButton />
        </View>

        {loading ? (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingVertical: 60 }}>
            <Text style={{ color: colors.muted, fontSize: 14 }}>جاري تحميل البيانات...</Text>
          </View>
        ) : !hasData ? (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingVertical: 60 }}>
            <View style={{ backgroundColor: colors.primary + "15", borderRadius: 40, padding: 20, marginBottom: 16 }}>
              <MaterialIcons name="bar-chart" size={48} color={colors.primary} />
            </View>
            <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: "bold", marginBottom: 8 }}>
              لا توجد بيانات بعد
            </Text>
            <Text style={{ color: colors.muted, fontSize: 13, textAlign: "center", paddingHorizontal: 40, lineHeight: 20 }}>
              ستظهر التقارير والإحصائيات هنا تلقائياً بعد إدخال بيانات الإنتاج والمبيعات والمصروفات من الأقسام المختلفة.
            </Text>
          </View>
        ) : (
          <View style={{ paddingHorizontal: 16 }}>
            {/* بطاقات المؤشرات */}
            <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "600", marginBottom: 12, textAlign: "right" }}>
              ملخص الأداء
            </Text>

            {/* الإنتاج */}
            {kpiData.totalProduction > 0 && (
              <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, marginBottom: 12, borderRightWidth: 4, borderRightColor: "#3B82F6" }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "#3B82F620", justifyContent: "center", alignItems: "center" }}>
                    <MaterialIcons name="precision-manufacturing" size={22} color="#3B82F6" />
                  </View>
                  <View style={{ flex: 1, alignItems: "flex-end", marginRight: 12 }}>
                    <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 2 }}>إجمالي الإنتاج</Text>
                    <Text style={{ color: colors.foreground, fontSize: 22, fontWeight: "bold" }}>{kpiData.totalProduction.toLocaleString()}</Text>
                    <Text style={{ color: colors.muted, fontSize: 11 }}>درزن</Text>
                  </View>
                </View>
              </View>
            )}

            {/* نسبة الهدر */}
            {kpiData.totalProduction > 0 && (
              <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, marginBottom: 12, borderRightWidth: 4, borderRightColor: "#EF4444" }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "#EF444420", justifyContent: "center", alignItems: "center" }}>
                    <MaterialIcons name="warning" size={22} color="#EF4444" />
                  </View>
                  <View style={{ flex: 1, alignItems: "flex-end", marginRight: 12 }}>
                    <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 2 }}>نسبة الهدر</Text>
                    <Text style={{ color: colors.foreground, fontSize: 22, fontWeight: "bold" }}>{kpiData.totalWastePercent}%</Text>
                    <Text style={{ color: colors.muted, fontSize: 11 }}>من إجمالي وزن الخيوط</Text>
                  </View>
                </View>
              </View>
            )}

            {/* المبيعات */}
            {kpiData.totalSales > 0 && (
              <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, marginBottom: 12, borderRightWidth: 4, borderRightColor: "#10B981" }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "#10B98120", justifyContent: "center", alignItems: "center" }}>
                    <MaterialIcons name="shopping-cart" size={22} color="#10B981" />
                  </View>
                  <View style={{ flex: 1, alignItems: "flex-end", marginRight: 12 }}>
                    <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 2 }}>إجمالي المبيعات</Text>
                    <Text style={{ color: colors.foreground, fontSize: 22, fontWeight: "bold" }}>{kpiData.totalSales.toLocaleString()}</Text>
                    <Text style={{ color: colors.muted, fontSize: 11 }}>زوج</Text>
                  </View>
                </View>
              </View>
            )}

            {/* التحصيل */}
            {kpiData.totalCollection > 0 && (
              <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, marginBottom: 12, borderRightWidth: 4, borderRightColor: "#F59E0B" }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "#F59E0B20", justifyContent: "center", alignItems: "center" }}>
                    <MaterialIcons name="account-balance-wallet" size={22} color="#F59E0B" />
                  </View>
                  <View style={{ flex: 1, alignItems: "flex-end", marginRight: 12 }}>
                    <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 2 }}>إجمالي التحصيل</Text>
                    <Text style={{ color: colors.foreground, fontSize: 22, fontWeight: "bold" }}>{kpiData.totalCollection.toLocaleString()}</Text>
                    <Text style={{ color: colors.muted, fontSize: 11 }}>ريال</Text>
                  </View>
                </View>
              </View>
            )}

            {/* المصروفات */}
            {kpiData.totalExpenses > 0 && (
              <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, marginBottom: 24, borderRightWidth: 4, borderRightColor: "#8B5CF6" }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "#8B5CF620", justifyContent: "center", alignItems: "center" }}>
                    <MaterialIcons name="receipt-long" size={22} color="#8B5CF6" />
                  </View>
                  <View style={{ flex: 1, alignItems: "flex-end", marginRight: 12 }}>
                    <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 2 }}>إجمالي المصروفات</Text>
                    <Text style={{ color: colors.foreground, fontSize: 22, fontWeight: "bold" }}>{kpiData.totalExpenses.toLocaleString()}</Text>
                    <Text style={{ color: colors.muted, fontSize: 11 }}>ريال</Text>
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
