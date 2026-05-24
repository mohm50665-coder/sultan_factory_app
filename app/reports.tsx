import React, { useState } from "react";
import { BackButton } from "@/components/back-button";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  StyleSheet,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { MaterialIcons } from "@expo/vector-icons";

interface KPI {
  title: string;
  value: string;
  unit: string;
  icon: string;
  trend: "up" | "down" | "stable";
  percentage: string;
  color: string;
}

export default function ReportsScreen() {
  const colors = useColors();
  const [dateFilter, setDateFilter] = useState("month");

  const kpis: KPI[] = [
    {
      title: "إجمالي الإنتاج",
      value: "12,450",
      unit: "درزن",
      icon: "factory",
      trend: "up",
      percentage: "+15%",
      color: "#3B82F6",
    },
    {
      title: "معدل الهدر",
      value: "2.5",
      unit: "%",
      icon: "warning",
      trend: "down",
      percentage: "-5%",
      color: "#EF4444",
    },
    {
      title: "إجمالي المبيعات",
      value: "8,900",
      unit: "زوج",
      icon: "shopping-cart",
      trend: "up",
      percentage: "+22%",
      color: "#10B981",
    },
    {
      title: "كفاءة الإنتاج",
      value: "94.2",
      unit: "%",
      icon: "trending-up",
      trend: "stable",
      percentage: "+2%",
      color: "#8B5CF6",
    },
  ];

  const renderKPICard = (kpi: KPI) => (
    <View
      key={kpi.title}
      style={{
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderLeftWidth: 4,
        borderLeftColor: kpi.color,
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 4 }}>
            {kpi.title}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "baseline" }}>
            <Text style={{ color: colors.foreground, fontSize: 24, fontWeight: "bold" }}>
              {kpi.value}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12, marginLeft: 4 }}>
              {kpi.unit}
            </Text>
          </View>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginTop: 8,
            }}
          >
            <MaterialIcons
              name={kpi.trend === "up" ? "trending-up" : kpi.trend === "down" ? "trending-down" : "trending-flat"}
              size={14}
              color={kpi.trend === "up" ? "#10B981" : kpi.trend === "down" ? "#EF4444" : colors.muted}
            />
            <Text
              style={{
                color: kpi.trend === "up" ? "#10B981" : kpi.trend === "down" ? "#EF4444" : colors.muted,
                fontSize: 12,
                marginLeft: 4,
              }}
            >
              {kpi.percentage} هذا الشهر
            </Text>
          </View>
        </View>
        <View
          style={{
            width: 50,
            height: 50,
            borderRadius: 25,
            backgroundColor: kpi.color + "20",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <MaterialIcons name={kpi.icon as any} size={24} color={kpi.color} />
        </View>
      </View>
    </View>
  );

  return (
    <ScreenContainer className="bg-background">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        {/* رأس الصفحة */}
        <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.foreground, fontSize: 24, fontWeight: "bold", marginBottom: 4, textAlign: "right" }}>
              التقارير والإحصائيات
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12, textAlign: "right" }}>
              مؤشرات الأداء الرئيسية للمصنع
            </Text>
          </View>
          <BackButton />
        </View>

        {/* مرشحات التاريخ */}
        <View style={{ paddingHorizontal: 16, marginBottom: 20 }}>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {[
              { label: "اليوم", value: "day" },
              { label: "هذا الأسبوع", value: "week" },
              { label: "هذا الشهر", value: "month" },
              { label: "هذا العام", value: "year" },
            ].map((filter) => (
              <TouchableOpacity
                key={filter.value}
                onPress={() => setDateFilter(filter.value)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 20,
                  backgroundColor:
                    dateFilter === filter.value
                      ? colors.primary
                      : colors.surface,
                  borderWidth: 1,
                  borderColor:
                    dateFilter === filter.value
                      ? colors.primary
                      : colors.border,
                }}
              >
                <Text
                  style={{
                    color:
                      dateFilter === filter.value
                        ? "white"
                        : colors.foreground,
                    fontSize: 11,
                    fontWeight: "500",
                  }}
                >
                  {filter.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* بطاقات KPI */}
        <View style={{ paddingHorizontal: 16, marginBottom: 24 }}>
          <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "600", marginBottom: 12 }}>
            مؤشرات الأداء الرئيسية
          </Text>
          {kpis.map(renderKPICard)}
        </View>

        {/* قسم التفاصيل */}
        <View style={{ paddingHorizontal: 16, marginBottom: 24 }}>
          <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "600", marginBottom: 12 }}>
            تفاصيل الأداء
          </Text>

          {/* الإنتاج حسب المرحلة */}
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 12,
              padding: 16,
              marginBottom: 12,
            }}
          >
            <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600", marginBottom: 12 }}>
              الإنتاج حسب المرحلة
            </Text>
            {[
              { stage: "إنتاج المكائن", quantity: 3200, percentage: 26 },
              { stage: "الروسو", quantity: 2800, percentage: 22 },
              { stage: "القلب", quantity: 2400, percentage: 19 },
              { stage: "الكاوية", quantity: 2100, percentage: 17 },
              { stage: "الفحص", quantity: 1950, percentage: 16 },
            ].map((item, index) => (
              <View key={index} style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                  <Text style={{ color: colors.foreground, fontSize: 12 }}>
                    {item.stage}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>
                    {item.quantity} درزن
                  </Text>
                </View>
                <View
                  style={{
                    height: 6,
                    backgroundColor: colors.border,
                    borderRadius: 3,
                    overflow: "hidden",
                  }}
                >
                  <View
                    style={{
                      height: "100%",
                      width: `${item.percentage}%`,
                      backgroundColor: colors.primary,
                    }}
                  />
                </View>
              </View>
            ))}
          </View>

          {/* أفضل الموظفين */}
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 12,
              padding: 16,
            }}
          >
            <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600", marginBottom: 12 }}>
              أفضل الموظفين أداءً
            </Text>
            {[
              { name: "رنا", production: 2450, rating: 4.8 },
              { name: "شفيق", production: 2100, rating: 4.6 },
              { name: "محمد أحمد", production: 1950, rating: 4.5 },
            ].map((worker, index) => (
              <View
                key={index}
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  paddingVertical: 10,
                  borderBottomWidth: index < 2 ? 1 : 0,
                  borderBottomColor: colors.border,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: "500" }}>
                    {worker.name}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 11 }}>
                    {worker.production} درزن
                  </Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <MaterialIcons name="star" size={14} color="#FCD34D" />
                  <Text style={{ color: colors.foreground, fontSize: 12, marginLeft: 4 }}>
                    {worker.rating}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
