import React, { useState, useEffect } from "react";
import { BackButton } from "@/components/back-button";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { productionService } from "@/lib/services/api.service";

interface MachineStats {
  machineNumber: string;
  totalProduction: number;
  totalWaste: number;
  totalSecondGrade: number;
  wastePercentage: number;
  secondGradePercentage: number;
  efficiency: number;
  entries: number;
}

export default function MachinesComparisonScreen() {
  const colors = useColors();
  const [machines, setMachines] = useState<MachineStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const entries = await productionService.getAll() || [];
      if (entries.length > 0) {
        const machineMap: Record<string, { production: number; waste: number; secondGrade: number; count: number }> = {};

        entries.forEach((entry: any) => {
          const num = entry.machineNumber || "غير محدد";
          if (!machineMap[num]) {
            machineMap[num] = { production: 0, waste: 0, secondGrade: 0, count: 0 };
          }
          machineMap[num].production += parseFloat(entry.productionDozen || 0);
          machineMap[num].waste += (parseFloat(entry.wasteThreadGrams || 0) + parseFloat(entry.wasteSocksGrams || 0));
          machineMap[num].secondGrade += parseFloat(entry.secondGradeDozen || 0);
          machineMap[num].count++;
        });

        const stats: MachineStats[] = Object.entries(machineMap).map(([num, data]) => {
          const wastePercentage = data.production > 0 ? (data.waste / data.production) * 100 : 0;
          const secondGradePercentage = data.production > 0 ? (data.secondGrade / data.production) * 100 : 0;
          const efficiency = 100 - wastePercentage - secondGradePercentage;
          return {
            machineNumber: num,
            totalProduction: data.production,
            totalWaste: data.waste,
            totalSecondGrade: data.secondGrade,
            wastePercentage,
            secondGradePercentage,
            efficiency: Math.max(0, efficiency),
            entries: data.count,
          };
        });

        stats.sort((a, b) => b.efficiency - a.efficiency);
        setMachines(stats);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const getBestMachine = () => machines.length > 0 ? machines[0] : null;
  const getWorstMachine = () => machines.length > 0 ? machines[machines.length - 1] : null;

  const getEfficiencyColor = (efficiency: number) => {
    if (efficiency >= 90) return "#22c55e";
    if (efficiency >= 75) return "#f59e0b";
    return "#ef4444";
  };

  return (
    <ScreenContainer>
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <BackButton />
        <Text style={styles.headerTitle}>مقارنة أداء المكائن</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content}>
        {isLoading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 50 }} />
        ) : machines.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialIcons name="precision-manufacturing" size={64} color={colors.muted} />
            <Text style={[styles.emptyText, { color: colors.muted }]}>لا توجد بيانات إنتاج بعد</Text>
            <Text style={[styles.emptySubText, { color: colors.muted }]}>
              أدخل بيانات الإنتاج أولاً لعرض مقارنة أداء المكائن
            </Text>
          </View>
        ) : (
          <>
            {/* أفضل وأسوأ مكينة */}
            <View style={styles.highlightRow}>
              {getBestMachine() && (
                <View style={[styles.highlightCard, { backgroundColor: "#dcfce7", borderColor: "#22c55e" }]}>
                  <MaterialIcons name="emoji-events" size={28} color="#22c55e" />
                  <Text style={[styles.highlightLabel, { color: "#166534" }]}>الأفضل أداءً</Text>
                  <Text style={[styles.highlightValue, { color: "#166534" }]}>
                    مكينة {getBestMachine()!.machineNumber}
                  </Text>
                  <Text style={[styles.highlightPercent, { color: "#22c55e" }]}>
                    {getBestMachine()!.efficiency.toFixed(1)}%
                  </Text>
                </View>
              )}
              {getWorstMachine() && machines.length > 1 && (
                <View style={[styles.highlightCard, { backgroundColor: "#fef2f2", borderColor: "#ef4444" }]}>
                  <MaterialIcons name="warning" size={28} color="#ef4444" />
                  <Text style={[styles.highlightLabel, { color: "#991b1b" }]}>تحتاج تحسين</Text>
                  <Text style={[styles.highlightValue, { color: "#991b1b" }]}>
                    مكينة {getWorstMachine()!.machineNumber}
                  </Text>
                  <Text style={[styles.highlightPercent, { color: "#ef4444" }]}>
                    {getWorstMachine()!.efficiency.toFixed(1)}%
                  </Text>
                </View>
              )}
            </View>

            {/* جدول المقارنة */}
            <View style={[styles.tableCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.tableTitle, { color: colors.foreground }]}>
                ترتيب المكائن حسب الكفاءة
              </Text>

              {/* رأس الجدول */}
              <View style={[styles.tableHeader, { borderBottomColor: colors.border }]}>
                <Text style={[styles.thCell, { color: colors.muted, flex: 0.8 }]}>#</Text>
                <Text style={[styles.thCell, { color: colors.muted, flex: 1.2 }]}>المكينة</Text>
                <Text style={[styles.thCell, { color: colors.muted, flex: 1.2 }]}>الإنتاج</Text>
                <Text style={[styles.thCell, { color: colors.muted, flex: 1 }]}>الهدر%</Text>
                <Text style={[styles.thCell, { color: colors.muted, flex: 1.2 }]}>الكفاءة</Text>
              </View>

              {machines.map((machine, index) => (
                <View
                  key={machine.machineNumber}
                  style={[
                    styles.tableRow,
                    { borderBottomColor: colors.border },
                    index === 0 && { backgroundColor: "#f0fdf4" },
                    index === machines.length - 1 && machines.length > 1 && { backgroundColor: "#fef2f2" },
                  ]}
                >
                  <Text style={[styles.tdCell, { color: colors.foreground, flex: 0.8 }]}>
                    {index + 1}
                  </Text>
                  <Text style={[styles.tdCell, { color: colors.foreground, flex: 1.2, fontWeight: "bold" }]}>
                    {machine.machineNumber}
                  </Text>
                  <Text style={[styles.tdCell, { color: colors.foreground, flex: 1.2 }]}>
                    {machine.totalProduction.toFixed(0)}
                  </Text>
                  <Text style={[styles.tdCell, { color: "#ef4444", flex: 1 }]}>
                    {machine.wastePercentage.toFixed(1)}%
                  </Text>
                  <View style={{ flex: 1.2, alignItems: "center" }}>
                    <View style={[styles.efficiencyBadge, { backgroundColor: getEfficiencyColor(machine.efficiency) + "20" }]}>
                      <Text style={[styles.efficiencyText, { color: getEfficiencyColor(machine.efficiency) }]}>
                        {machine.efficiency.toFixed(1)}%
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>

            {/* ملخص */}
            <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.summaryTitle, { color: colors.foreground }]}>ملخص الأداء العام</Text>
              <View style={styles.summaryRow}>
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryValue, { color: colors.primary }]}>{machines.length}</Text>
                  <Text style={[styles.summaryLabel, { color: colors.muted }]}>عدد المكائن</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryValue, { color: colors.primary }]}>
                    {machines.reduce((sum, m) => sum + m.totalProduction, 0).toFixed(0)}
                  </Text>
                  <Text style={[styles.summaryLabel, { color: colors.muted }]}>إجمالي الإنتاج</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryValue, { color: "#ef4444" }]}>
                    {machines.length > 0
                      ? (machines.reduce((sum, m) => sum + m.wastePercentage, 0) / machines.length).toFixed(1)
                      : "0"}%
                  </Text>
                  <Text style={[styles.summaryLabel, { color: colors.muted }]}>متوسط الهدر</Text>
                </View>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  content: {
    flex: 1,
    padding: 16,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    gap: 12,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "bold",
  },
  emptySubText: {
    fontSize: 14,
    textAlign: "center",
    paddingHorizontal: 40,
  },
  highlightRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  highlightCard: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    gap: 4,
  },
  highlightLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  highlightValue: {
    fontSize: 14,
    fontWeight: "bold",
  },
  highlightPercent: {
    fontSize: 20,
    fontWeight: "bold",
  },
  tableCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  tableTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 12,
    textAlign: "right",
  },
  tableHeader: {
    flexDirection: "row",
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  thCell: {
    fontSize: 12,
    fontWeight: "bold",
    textAlign: "center",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    alignItems: "center",
  },
  tdCell: {
    fontSize: 13,
    textAlign: "center",
  },
  efficiencyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  efficiencyText: {
    fontSize: 12,
    fontWeight: "bold",
  },
  summaryCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 16,
    textAlign: "right",
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  summaryItem: {
    alignItems: "center",
    gap: 4,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: "bold",
  },
  summaryLabel: {
    fontSize: 12,
  },
});
