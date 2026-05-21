import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { MaterialIcons } from "@expo/vector-icons";

interface MonthlyReport {
  month: string;
  totalProduction: number;
  wastePercentage: number;
  totalSales: number;
  revenue: number;
  efficiency: number;
  topEmployee: string;
  topEmployeeProduction: number;
  maintenanceCount: number;
  equipmentDowntime: number;
}

const mockReports: MonthlyReport[] = [
  {
    month: "يناير 2026",
    totalProduction: 45000,
    wastePercentage: 3.2,
    totalSales: 38000,
    revenue: 285000,
    efficiency: 96.8,
    topEmployee: "محمد أحمد",
    topEmployeeProduction: 8500,
    maintenanceCount: 5,
    equipmentDowntime: 12,
  },
  {
    month: "فبراير 2026",
    totalProduction: 48000,
    wastePercentage: 2.8,
    totalSales: 41000,
    revenue: 307500,
    efficiency: 97.2,
    topEmployee: "شفيق",
    topEmployeeProduction: 9200,
    maintenanceCount: 3,
    equipmentDowntime: 8,
  },
  {
    month: "مارس 2026",
    totalProduction: 52000,
    wastePercentage: 2.5,
    totalSales: 44000,
    revenue: 330000,
    efficiency: 97.5,
    topEmployee: "رنا",
    topEmployeeProduction: 10000,
    maintenanceCount: 4,
    equipmentDowntime: 6,
  },
];

export default function MonthlyReportsScreen() {
  const colors = useColors();
  const [selectedMonth, setSelectedMonth] = useState(0);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const report = mockReports[selectedMonth];
  const screenWidth = Dimensions.get("window").width;

  const StatCard = ({
    label,
    value,
    unit,
    icon,
    color,
  }: {
    label: string;
    value: number | string;
    unit?: string;
    icon: string;
    color: string;
  }) => (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderLeftWidth: 4,
        borderLeftColor: color,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 4 }}>
          {label}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "baseline" }}>
          <Text
            style={{
              color: colors.foreground,
              fontSize: 20,
              fontWeight: "bold",
            }}
          >
            {value}
          </Text>
          {unit && (
            <Text style={{ color: colors.muted, fontSize: 12, marginLeft: 4 }}>
              {unit}
            </Text>
          )}
        </View>
      </View>
      <View
        style={{
          width: 50,
          height: 50,
          borderRadius: 25,
          backgroundColor: `${color}20`,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <MaterialIcons name={icon as any} size={24} color={color} />
      </View>
    </View>
  );

  const SectionHeader = ({
    title,
    icon,
    onPress,
  }: {
    title: string;
    icon: string;
    onPress: () => void;
  }) => (
    <TouchableOpacity
      onPress={onPress}
      style={{
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: 14,
        marginBottom: 12,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <MaterialIcons name={icon as any} size={20} color={colors.primary} />
        <Text
          style={{
            color: colors.foreground,
            fontSize: 14,
            fontWeight: "600",
          }}
        >
          {title}
        </Text>
      </View>
      <MaterialIcons
        name={
          expandedSection === title ? "expand-less" : "expand-more"
        }
        size={20}
        color={colors.muted}
      />
    </TouchableOpacity>
  );

  return (
    <ScreenContainer className="bg-background">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        {/* رأس الصفحة */}
        <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 }}>
          <Text
            style={{
              color: colors.foreground,
              fontSize: 24,
              fontWeight: "bold",
              marginBottom: 4,
            }}
          >
            التقارير الشهرية
          </Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            تحليل شامل لأداء المصنع الشهري
          </Text>
        </View>

        {/* اختيار الشهر */}
        <View style={{ paddingHorizontal: 16, marginBottom: 20 }}>
          <Text
            style={{
              color: colors.foreground,
              fontSize: 12,
              fontWeight: "600",
              marginBottom: 8,
            }}
          >
            اختر الشهر
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginHorizontal: -16, paddingHorizontal: 16 }}
          >
            {mockReports.map((r, index) => (
              <TouchableOpacity
                key={index}
                onPress={() => setSelectedMonth(index)}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: 20,
                  backgroundColor:
                    selectedMonth === index ? colors.primary : colors.surface,
                  borderWidth: 1,
                  borderColor:
                    selectedMonth === index ? colors.primary : colors.border,
                  marginRight: 8,
                }}
              >
                <Text
                  style={{
                    color:
                      selectedMonth === index ? "white" : colors.foreground,
                    fontSize: 12,
                    fontWeight: "500",
                  }}
                >
                  {r.month}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* الإحصائيات الرئيسية */}
        <View style={{ paddingHorizontal: 16, marginBottom: 20 }}>
          <Text
            style={{
              color: colors.foreground,
              fontSize: 13,
              fontWeight: "600",
              marginBottom: 12,
            }}
          >
            الإحصائيات الرئيسية
          </Text>

          <StatCard
            label="إجمالي الإنتاج"
            value={report.totalProduction.toLocaleString("ar-SA")}
            unit="وحدة"
            icon="factory"
            color={colors.primary}
          />

          <StatCard
            label="نسبة الهدر"
            value={report.wastePercentage.toFixed(1)}
            unit="%"
            icon="warning"
            color="#FF9800"
          />

          <StatCard
            label="إجمالي المبيعات"
            value={report.totalSales.toLocaleString("ar-SA")}
            unit="وحدة"
            icon="shopping-cart"
            color={colors.success}
          />

          <StatCard
            label="الإيرادات"
            value={report.revenue.toLocaleString("ar-SA")}
            unit="ريال"
            icon="attach-money"
            color="#4CAF50"
          />

          <StatCard
            label="كفاءة الإنتاج"
            value={report.efficiency.toFixed(1)}
            unit="%"
            icon="trending-up"
            color="#2196F3"
          />
        </View>

        {/* الموظف الأفضل */}
        <View style={{ paddingHorizontal: 16, marginBottom: 20 }}>
          <SectionHeader
            title="الموظف الأفضل"
            icon="star"
            onPress={() =>
              setExpandedSection(
                expandedSection === "الموظف الأفضل" ? null : "الموظف الأفضل"
              )
            }
          />
          {expandedSection === "الموظف الأفضل" && (
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: 12,
                padding: 14,
                marginBottom: 12,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <View style={{ marginBottom: 12 }}>
                <Text style={{ color: colors.muted, fontSize: 11, marginBottom: 4 }}>
                  الاسم
                </Text>
                <Text
                  style={{
                    color: colors.foreground,
                    fontSize: 14,
                    fontWeight: "600",
                  }}
                >
                  {report.topEmployee}
                </Text>
              </View>
              <View>
                <Text style={{ color: colors.muted, fontSize: 11, marginBottom: 4 }}>
                  إنتاجه الشهري
                </Text>
                <Text
                  style={{
                    color: colors.primary,
                    fontSize: 18,
                    fontWeight: "bold",
                  }}
                >
                  {report.topEmployeeProduction.toLocaleString("ar-SA")} وحدة
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* الصيانة والتوقفات */}
        <View style={{ paddingHorizontal: 16, marginBottom: 20 }}>
          <SectionHeader
            title="الصيانة والتوقفات"
            icon="build"
            onPress={() =>
              setExpandedSection(
                expandedSection === "الصيانة والتوقفات"
                  ? null
                  : "الصيانة والتوقفات"
              )
            }
          />
          {expandedSection === "الصيانة والتوقفات" && (
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: 12,
                padding: 14,
                marginBottom: 12,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  marginBottom: 12,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.muted, fontSize: 11, marginBottom: 4 }}>
                    عدد مرات الصيانة
                  </Text>
                  <Text
                    style={{
                      color: colors.foreground,
                      fontSize: 16,
                      fontWeight: "bold",
                    }}
                  >
                    {report.maintenanceCount}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.muted, fontSize: 11, marginBottom: 4 }}>
                    ساعات التوقف
                  </Text>
                  <Text
                    style={{
                      color: colors.warning,
                      fontSize: 16,
                      fontWeight: "bold",
                    }}
                  >
                    {report.equipmentDowntime} ساعة
                  </Text>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* ملخص الشهر */}
        <View style={{ paddingHorizontal: 16, marginBottom: 20 }}>
          <View
            style={{
              backgroundColor: colors.primary,
              borderRadius: 12,
              padding: 16,
              opacity: 0.1,
            }}
          >
            <Text
              style={{
                color: colors.foreground,
                fontSize: 12,
                lineHeight: 18,
              }}
            >
              الشهر الحالي يظهر أداءً قوياً مع تحسن في كفاءة الإنتاج وانخفاض نسبة
              الهدر. استمرار هذا الاتجاه الإيجابي سيساهم في تحقيق الأهداف السنوية
              للمصنع.
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
