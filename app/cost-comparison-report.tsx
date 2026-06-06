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
import { LineChart } from "react-native-chart-kit";

interface MonthlyComparison {
  month: string;
  expectedCost: number;
  actualCost: number;
  variance: number;
  variancePercent: number;
  productivity: number;
  costPerUnit: number;
}

export default function CostComparisonReportScreen() {
  const router = useRouter();
  const colors = useColors();
  const { t, language, isRtl } = useLanguage();
  const isAr = language === "ar";

  const [comparisons, setComparisons] = useState<MonthlyComparison[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [chartData, setChartData] = useState<any>(null);

  useEffect(() => {
    loadComparisons();
  }, []);

  const loadComparisons = async () => {
    try {
      setIsLoading(true);
      const costs = await AsyncStorage.getItem("production_costs");
      const production = await AsyncStorage.getItem("production_entries");

      const mockData: MonthlyComparison[] = [
        {
          month: "2026-01",
          expectedCost: 50000,
          actualCost: 48500,
          variance: 1500,
          variancePercent: 3,
          productivity: 95,
          costPerUnit: 12.5,
        },
        {
          month: "2026-02",
          expectedCost: 52000,
          actualCost: 51200,
          variance: 800,
          variancePercent: 1.5,
          productivity: 98,
          costPerUnit: 12.2,
        },
        {
          month: "2026-03",
          expectedCost: 55000,
          actualCost: 56800,
          variance: -1800,
          variancePercent: -3.3,
          productivity: 92,
          costPerUnit: 13.1,
        },
        {
          month: "2026-04",
          expectedCost: 53000,
          actualCost: 52300,
          variance: 700,
          variancePercent: 1.3,
          productivity: 97,
          costPerUnit: 12.3,
        },
        {
          month: "2026-05",
          expectedCost: 54000,
          actualCost: 53100,
          variance: 900,
          variancePercent: 1.7,
          productivity: 96,
          costPerUnit: 12.4,
        },
      ];

      setComparisons(mockData);
      prepareChartData(mockData);
    } catch (error) {
      console.error("Error loading comparisons:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const prepareChartData = (data: MonthlyComparison[]) => {
    const labels = data.map((d) => d.month.split("-")[1]);
    const expectedData = data.map((d) => d.expectedCost / 1000);
    const actualData = data.map((d) => d.actualCost / 1000);

    setChartData({
      labels,
      datasets: [
        {
          data: expectedData,
          color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
          strokeWidth: 2,
        },
        {
          data: actualData,
          color: (opacity = 1) => `rgba(34, 197, 94, ${opacity})`,
          strokeWidth: 2,
        },
      ],
      legend: [isAr ? "المتوقع" : "Expected", isAr ? "الفعلي" : "Actual"],
    });
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
          {isAr ? "تقرير مقارنة التكاليف" : "Cost Comparison Report"}
        </Text>

        {/* Chart */}
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
              {isAr ? "اتجاه التكاليف الشهري" : "Monthly Cost Trend"}
            </Text>
            <LineChart
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
                propsForDots: {
                  r: "6",
                  strokeWidth: "2",
                  stroke: colors.primary,
                },
              }}
              bezier
              yAxisLabel=""
              yAxisSuffix=""
            />
          </View>
        )}

        {/* Summary Stats */}
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
            {isAr ? "ملخص الأداء" : "Performance Summary"}
          </Text>

          <View style={{ gap: 8 }}>
            {comparisons.length > 0 && (
              <>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    paddingBottom: 8,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                  }}
                >
                  <Text style={{ color: colors.muted }}>
                    {isAr ? "متوسط التباين" : "Average Variance"}
                  </Text>
                  <Text
                    style={{
                      color: colors.foreground,
                      fontWeight: "bold",
                    }}
                  >
                    {(
                      comparisons.reduce((sum, c) => sum + c.variancePercent, 0) /
                      comparisons.length
                    ).toFixed(1)}
                    %
                  </Text>
                </View>

                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    paddingBottom: 8,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                  }}
                >
                  <Text style={{ color: colors.muted }}>
                    {isAr ? "متوسط الإنتاجية" : "Average Productivity"}
                  </Text>
                  <Text
                    style={{
                      color: colors.foreground,
                      fontWeight: "bold",
                    }}
                  >
                    {(
                      comparisons.reduce((sum, c) => sum + c.productivity, 0) /
                      comparisons.length
                    ).toFixed(1)}
                    %
                  </Text>
                </View>

                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                  }}
                >
                  <Text style={{ color: colors.muted }}>
                    {isAr ? "متوسط التكلفة للوحدة" : "Avg Cost Per Unit"}
                  </Text>
                  <Text
                    style={{
                      color: colors.foreground,
                      fontWeight: "bold",
                    }}
                  >
                    {(
                      comparisons.reduce((sum, c) => sum + c.costPerUnit, 0) /
                      comparisons.length
                    ).toFixed(2)}
                  </Text>
                </View>
              </>
            )}
          </View>
        </View>

        {/* Monthly Details */}
        <Text
          style={{
            fontSize: 16,
            fontWeight: "bold",
            color: colors.foreground,
            marginBottom: 12,
          }}
        >
          {isAr ? "التفاصيل الشهرية" : "Monthly Details"}
        </Text>

        {comparisons.map((comparison) => (
          <TouchableOpacity
            key={comparison.month}
            onPress={() =>
              setSelectedMonth(
                selectedMonth === comparison.month ? null : comparison.month
              )
            }
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
                    fontSize: 14,
                    fontWeight: "bold",
                    color: colors.foreground,
                  }}
                >
                  {comparison.month}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  {isAr ? "الإنتاجية: " : "Productivity: "}
                  {comparison.productivity}%
                </Text>
              </View>
              <View style={{ alignItems: isRtl ? "flex-start" : "flex-end" }}>
                <Text
                  style={{
                    color:
                      comparison.variance >= 0 ? "#22c55e" : "#ef4444",
                    fontWeight: "bold",
                  }}
                >
                  {comparison.variance >= 0 ? "+" : ""}
                  {comparison.variance.toFixed(0)} ({comparison.variancePercent}%)
                </Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  {isAr ? "التباين" : "Variance"}
                </Text>
              </View>
            </View>

            {selectedMonth === comparison.month && (
              <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    marginBottom: 8,
                  }}
                >
                  <Text style={{ color: colors.muted }}>
                    {isAr ? "التكلفة المتوقعة" : "Expected Cost"}
                  </Text>
                  <Text style={{ color: colors.foreground, fontWeight: "bold" }}>
                    {comparison.expectedCost.toFixed(0)}
                  </Text>
                </View>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    marginBottom: 8,
                  }}
                >
                  <Text style={{ color: colors.muted }}>
                    {isAr ? "التكلفة الفعلية" : "Actual Cost"}
                  </Text>
                  <Text style={{ color: colors.foreground, fontWeight: "bold" }}>
                    {comparison.actualCost.toFixed(0)}
                  </Text>
                </View>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                  }}
                >
                  <Text style={{ color: colors.muted }}>
                    {isAr ? "التكلفة للوحدة" : "Cost Per Unit"}
                  </Text>
                  <Text style={{ color: colors.foreground, fontWeight: "bold" }}>
                    {comparison.costPerUnit.toFixed(2)}
                  </Text>
                </View>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </ScreenContainer>
  );
}
