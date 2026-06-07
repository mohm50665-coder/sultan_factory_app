import { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useLanguage } from "@/lib/language-context";
import { MaterialIcons } from "@expo/vector-icons";
import { BackButton } from "@/components/back-button";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BarChart } from "react-native-chart-kit";

interface KPI {
  label: string;
  value: string;
  target: string;
  status: "good" | "warning" | "critical";
  icon: string;
}

interface AdminProcedure {
  id: string;
  type: string;
  employee: string;
  status: "pending" | "approved" | "rejected";
  date: string;
}

interface PerformanceMetric {
  department: string;
  efficiency: number;
  quality: number;
  safety: number;
  overall: number;
}

export default function BoardRepresentativeDashboardScreen() {
  const router = useRouter();
  const colors = useColors();
  const { t, language, isRtl } = useLanguage();
  const isAr = language === "ar";

  const [isLoading, setIsLoading] = useState(true);
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [procedures, setProcedures] = useState<AdminProcedure[]>([]);
  const [metrics, setMetrics] = useState<PerformanceMetric[]>([]);
  const [chartData, setChartData] = useState<any>(null);
  const [alerts, setAlerts] = useState<string[]>([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);

      // Load real KPIs from AsyncStorage
      const savedKpis = await AsyncStorage.getItem("board_representative_kpis");
      if (savedKpis) {
        const parsedKpis = JSON.parse(savedKpis);
        const mappedKpis: KPI[] = parsedKpis.map((k: any) => ({
          label: k.name || k.label || "",
          value: String(k.currentValue || k.value || "0"),
          target: String(k.targetValue || k.target || "0"),
          status: k.status === "on-track" ? "good" : k.status === "at-risk" ? "warning" : "critical",
          icon: "trending-up",
        }));
        setKpis(mappedKpis);
      } else {
        setKpis([]);
      }

      // Load real board data from AsyncStorage
      const savedData = await AsyncStorage.getItem("board_representative_data");
      if (savedData) {
        const parsedData = JSON.parse(savedData);
        const mappedProcs: AdminProcedure[] = parsedData.slice(0, 10).map((d: any) => ({
          id: String(d.id),
          type: d.title || d.category || "",
          employee: d.content || "",
          status: "approved" as const,
          date: d.date || "",
        }));
        setProcedures(mappedProcs);
      } else {
        setProcedures([]);
      }

      setMetrics([]);
      setChartData(null);
      setAlerts([]);
    } catch (error) {
      console.error("Error loading dashboard:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "good":
        return "#22c55e";
      case "warning":
        return "#f59e0b";
      case "critical":
        return "#ef4444";
      default:
        return colors.muted;
    }
  };

  if (isLoading) {
    return (
      <ScreenContainer>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </ScreenContainer>
    );
  }

  const screenWidth = Dimensions.get("window").width;

  return (
    <ScreenContainer>
      <BackButton />
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 16 }}>
        <Text
          style={{
            fontSize: 24,
            fontWeight: "bold",
            color: colors.foreground,
            marginBottom: 16,
            textAlign: isRtl ? "right" : "left",
          }}
        >
          {isAr ? "لوحة تحكم ممثل مجلس الإدارة" : "Board Representative Dashboard"}
        </Text>

        {/* Alerts */}
        {alerts.length > 0 && (
          <View
            style={{
              backgroundColor: "#fef2f2",
              borderRadius: 12,
              padding: 12,
              marginBottom: 16,
              borderLeftWidth: 4,
              borderLeftColor: "#ef4444",
            }}
          >
            <Text
              style={{
                color: "#dc2626",
                fontWeight: "bold",
                marginBottom: 8,
              }}
            >
              {isAr ? "تنبيهات" : "Alerts"}
            </Text>
            {alerts.map((alert, idx) => (
              <Text
                key={idx}
                style={{
                  color: "#991b1b",
                  fontSize: 12,
                  marginBottom: idx < alerts.length - 1 ? 4 : 0,
                }}
              >
                • {alert}
              </Text>
            ))}
          </View>
        )}

        {/* KPIs Grid */}
        <Text
          style={{
            fontSize: 18,
            fontWeight: "bold",
            color: colors.foreground,
            marginBottom: 12,
            textAlign: isRtl ? "right" : "left",
          }}
        >
          {isAr ? "مؤشرات الأداء الرئيسية" : "Key Performance Indicators"}
        </Text>

        <View style={{ marginBottom: 16 }}>
          {kpis.map((kpi, idx) => (
            <View
              key={idx}
              style={{
                backgroundColor: colors.surface,
                borderRadius: 12,
                padding: 16,
                marginBottom: 12,
                borderWidth: 1,
                borderColor: colors.border,
                borderLeftWidth: 4,
                borderLeftColor: getStatusColor(kpi.status),
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 8,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <MaterialIcons
                    name={kpi.icon as any}
                    size={24}
                    color={getStatusColor(kpi.status)}
                  />
                  <Text
                    style={{
                      color: colors.foreground,
                      fontWeight: "bold",
                      fontSize: 14,
                    }}
                  >
                    {kpi.label}
                  </Text>
                </View>
              </View>

              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <View>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>
                    {isAr ? "القيمة الحالية" : "Current Value"}
                  </Text>
                  <Text
                    style={{
                      color: colors.foreground,
                      fontWeight: "bold",
                      fontSize: 16,
                    }}
                  >
                    {kpi.value}
                  </Text>
                </View>
                <View style={{ alignItems: isRtl ? "flex-start" : "flex-end" }}>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>
                    {isAr ? "الهدف" : "Target"}
                  </Text>
                  <Text
                    style={{
                      color: colors.foreground,
                      fontWeight: "bold",
                      fontSize: 16,
                    }}
                  >
                    {kpi.target}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* Performance Chart */}
        {chartData && (
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 12,
              padding: 16,
              marginBottom: 16,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text
              style={{
                fontSize: 16,
                fontWeight: "bold",
                color: colors.foreground,
                marginBottom: 12,
              }}
            >
              {isAr ? "كفاءة الأقسام" : "Department Efficiency"}
            </Text>
            <BarChart
              data={chartData}
              width={screenWidth - 64}
              height={220}
              chartConfig={{
                backgroundColor: colors.surface,
                backgroundGradientFrom: colors.surface,
                backgroundGradientTo: colors.surface,
                decimalPlaces: 0,
                color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                labelColor: (opacity = 1) =>
                  colors.foreground,
                style: { borderRadius: 16 },
                barPercentage: 0.7,
              }}
              yAxisLabel=""
              yAxisSuffix=""
            />
          </View>
        )}

        {/* Performance Metrics Table */}
        <Text
          style={{
            fontSize: 16,
            fontWeight: "bold",
            color: colors.foreground,
            marginBottom: 12,
            textAlign: isRtl ? "right" : "left",
          }}
        >
          {isAr ? "مقاييس الأداء التفصيلية" : "Detailed Performance Metrics"}
        </Text>

        {metrics.map((metric, idx) => (
          <View
            key={idx}
            style={{
              backgroundColor: colors.surface,
              borderRadius: 12,
              padding: 16,
              marginBottom: 12,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <Text
                style={{
                  color: colors.foreground,
                  fontWeight: "bold",
                  fontSize: 14,
                }}
              >
                {metric.department}
              </Text>
              <View
                style={{
                  backgroundColor: getStatusColor(
                    metric.overall >= 95
                      ? "good"
                      : metric.overall >= 90
                      ? "warning"
                      : "critical"
                  ),
                  borderRadius: 20,
                  paddingHorizontal: 12,
                  paddingVertical: 4,
                }}
              >
                <Text
                  style={{
                    color: "white",
                    fontWeight: "bold",
                    fontSize: 12,
                  }}
                >
                  {metric.overall}%
                </Text>
              </View>
            </View>

            <View style={{ gap: 8 }}>
              {[
                { label: isAr ? "الكفاءة" : "Efficiency", value: metric.efficiency },
                { label: isAr ? "الجودة" : "Quality", value: metric.quality },
                { label: isAr ? "السلامة" : "Safety", value: metric.safety },
              ].map((item, itemIdx) => (
                <View key={itemIdx}>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      marginBottom: 4,
                    }}
                  >
                    <Text style={{ color: colors.muted, fontSize: 12 }}>
                      {item.label}
                    </Text>
                    <Text
                      style={{
                        color: colors.foreground,
                        fontWeight: "bold",
                        fontSize: 12,
                      }}
                    >
                      {item.value}%
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
                        width: `${item.value}%`,
                        backgroundColor: getStatusColor(
                          item.value >= 95
                            ? "good"
                            : item.value >= 90
                            ? "warning"
                            : "critical"
                        ),
                      }}
                    />
                  </View>
                </View>
              ))}
            </View>
          </View>
        ))}

        {/* Pending Procedures */}
        <Text
          style={{
            fontSize: 16,
            fontWeight: "bold",
            color: colors.foreground,
            marginBottom: 12,
            marginTop: 16,
            textAlign: isRtl ? "right" : "left",
          }}
        >
          {isAr ? "الإجراءات الإدارية المعلقة" : "Pending Administrative Procedures"}
        </Text>

        {procedures
          .filter((p) => p.status === "pending")
          .map((procedure) => (
            <View
              key={procedure.id}
              style={{
                backgroundColor: colors.surface,
                borderRadius: 12,
                padding: 16,
                marginBottom: 12,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <View>
                  <Text
                    style={{
                      color: colors.foreground,
                      fontWeight: "bold",
                      fontSize: 14,
                    }}
                  >
                    {procedure.type}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>
                    {procedure.employee} - {procedure.date}
                  </Text>
                </View>
                <View
                  style={{
                    backgroundColor: "#fef3c7",
                    borderRadius: 20,
                    paddingHorizontal: 12,
                    paddingVertical: 4,
                  }}
                >
                  <Text
                    style={{
                      color: "#92400e",
                      fontWeight: "bold",
                      fontSize: 12,
                    }}
                  >
                    {isAr ? "معلق" : "Pending"}
                  </Text>
                </View>
              </View>
            </View>
          ))}

        {procedures.filter((p) => p.status === "pending").length === 0 && (
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 12,
              padding: 16,
              alignItems: "center",
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text style={{ color: colors.muted }}>
              {isAr ? "لا توجد إجراءات معلقة" : "No pending procedures"}
            </Text>
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
