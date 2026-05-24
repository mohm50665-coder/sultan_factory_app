import { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useLanguage } from "@/lib/language-context";
import { MaterialIcons } from "@expo/vector-icons";
import { taskService, TaskData } from "@/lib/services/data.service";

const EMPLOYEES = [
  { label: "المدير العام", labelEn: "General Manager", value: "general_manager" },
  { label: "مدير التسويق والمبيعات", labelEn: "Marketing & Sales Manager", value: "marketing_sales_manager" },
  { label: "مدير الإنتاج", labelEn: "Production Manager", value: "production_manager" },
  { label: "مدير المستودعات", labelEn: "Warehouse Manager", value: "warehouse_manager" },
  { label: "مسئول الصيانة", labelEn: "Maintenance Officer", value: "maintenance_officer" },
  { label: "مدير الشؤون الإدارية والمالية", labelEn: "Admin & Finance Manager", value: "admin_finance_manager" },
];

interface EmployeeStats {
  value: string;
  label: string;
  totalTasks: number;
  completed: number;
  notCompleted: number;
  partial: number;
  pending: number;
  extended: number;
  totalRewards: number;
  totalDeductions: number;
  hasWarnings: number;
  completionRate: number;
}

export default function EmployeePerformanceScreen() {
  const router = useRouter();
  const colors = useColors();
  const { language, isRtl } = useLanguage();
  const isAr = language === "ar";
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<EmployeeStats[]>([]);

  useEffect(() => {
    loadPerformance();
  }, []);

  const loadPerformance = async () => {
    setIsLoading(true);
    try {
      const tasks = await taskService.getAll();
      const employeeStats: EmployeeStats[] = EMPLOYEES.map((emp) => {
        const empTasks = tasks.filter((t: TaskData) => t.assignedEmployee === emp.value);
        const completed = empTasks.filter((t: TaskData) => t.result === "completed").length;
        const notCompleted = empTasks.filter((t: TaskData) => t.result === "not_completed").length;
        const partial = empTasks.filter((t: TaskData) => t.result === "partial").length;
        const pending = empTasks.filter((t: TaskData) => t.result === "pending").length;
        const extended = empTasks.filter((t: TaskData) => t.result === "extended").length;
        const totalRewards = empTasks.reduce((s: number, t: TaskData) => s + (t.reward || 0), 0);
        const totalDeductions = empTasks.reduce((s: number, t: TaskData) => s + (t.deduction || 0), 0);
        const hasWarnings = empTasks.filter((t: TaskData) => t.hasWarning).length;
        const completionRate = empTasks.length > 0 ? Math.round((completed / empTasks.length) * 100) : 0;

        return {
          value: emp.value,
          label: isAr ? emp.label : emp.labelEn,
          totalTasks: empTasks.length,
          completed,
          notCompleted,
          partial,
          pending,
          extended,
          totalRewards,
          totalDeductions,
          hasWarnings,
          completionRate,
        };
      }).filter((s) => s.totalTasks > 0);

      setStats(employeeStats);
    } catch (error) {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  const getPerformanceColor = (rate: number) => {
    if (rate >= 80) return "#10b981";
    if (rate >= 50) return "#f59e0b";
    return "#ef4444";
  };

  return (
    <ScreenContainer className="bg-background">
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <TouchableOpacity onPress={() => router.replace("/(tabs)")} style={styles.headerBtn}>
          <MaterialIcons name={isRtl ? "arrow-forward" : "arrow-back"} size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isAr ? "أداء الموظفين" : "Employee Performance"}</Text>
        <TouchableOpacity onPress={loadPerformance} style={styles.headerBtn}>
          <MaterialIcons name="refresh" size={24} color="white" />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : stats.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32 }}>
          <MaterialIcons name="people" size={64} color="#d1d5db" />
          <Text style={{ fontSize: 18, fontWeight: "bold", color: colors.foreground, marginTop: 16 }}>
            {isAr ? "لا توجد بيانات أداء" : "No performance data"}
          </Text>
          <Text style={{ fontSize: 14, color: colors.muted, marginTop: 8, textAlign: "center" }}>
            {isAr ? "ابدأ بإنشاء مهام وتعيينها للموظفين لعرض تقرير الأداء" : "Start creating and assigning tasks to view performance"}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          {/* Overview */}
          <View style={[styles.overviewCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.overviewTitle, { color: colors.foreground }]}>
              {isAr ? "ملخص عام" : "Overview"}
            </Text>
            <View style={styles.overviewRow}>
              <View style={styles.overviewItem}>
                <Text style={[styles.overviewVal, { color: colors.primary }]}>{stats.length}</Text>
                <Text style={[styles.overviewLbl, { color: colors.muted }]}>{isAr ? "موظفين" : "Employees"}</Text>
              </View>
              <View style={styles.overviewItem}>
                <Text style={[styles.overviewVal, { color: "#10b981" }]}>{stats.reduce((s, e) => s + e.completed, 0)}</Text>
                <Text style={[styles.overviewLbl, { color: colors.muted }]}>{isAr ? "مهام منجزة" : "Completed"}</Text>
              </View>
              <View style={styles.overviewItem}>
                <Text style={[styles.overviewVal, { color: "#f59e0b" }]}>{stats.reduce((s, e) => s + e.totalRewards, 0)}</Text>
                <Text style={[styles.overviewLbl, { color: colors.muted }]}>{isAr ? "مكافآت (ر.س)" : "Rewards"}</Text>
              </View>
              <View style={styles.overviewItem}>
                <Text style={[styles.overviewVal, { color: "#ef4444" }]}>{stats.reduce((s, e) => s + e.totalDeductions, 0)}</Text>
                <Text style={[styles.overviewLbl, { color: colors.muted }]}>{isAr ? "حسومات (ر.س)" : "Deductions"}</Text>
              </View>
            </View>
          </View>

          {/* Employee Cards */}
          {stats.sort((a, b) => b.completionRate - a.completionRate).map((emp) => (
            <View key={emp.value} style={[styles.empCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.empHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.empName, { color: colors.foreground }]}>{emp.label}</Text>
                  <Text style={{ fontSize: 12, color: colors.muted }}>
                    {isAr ? `${emp.totalTasks} مهمة` : `${emp.totalTasks} tasks`}
                  </Text>
                </View>
                <View style={[styles.rateBadge, { backgroundColor: `${getPerformanceColor(emp.completionRate)}15` }]}>
                  <Text style={[styles.rateText, { color: getPerformanceColor(emp.completionRate) }]}>
                    {emp.completionRate}%
                  </Text>
                </View>
              </View>

              {/* Progress Bar */}
              <View style={styles.progressContainer}>
                <View style={styles.progressBg}>
                  <View style={[styles.progressFill, { width: `${emp.completionRate}%`, backgroundColor: getPerformanceColor(emp.completionRate) }]} />
                </View>
              </View>

              {/* Stats Grid */}
              <View style={styles.statsGrid}>
                <View style={styles.statItem}>
                  <MaterialIcons name="check-circle" size={14} color="#10b981" />
                  <Text style={styles.statVal}>{emp.completed}</Text>
                  <Text style={[styles.statLbl, { color: colors.muted }]}>{isAr ? "منجز" : "Done"}</Text>
                </View>
                <View style={styles.statItem}>
                  <MaterialIcons name="pending" size={14} color="#f59e0b" />
                  <Text style={styles.statVal}>{emp.pending}</Text>
                  <Text style={[styles.statLbl, { color: colors.muted }]}>{isAr ? "معلق" : "Pending"}</Text>
                </View>
                <View style={styles.statItem}>
                  <MaterialIcons name="cancel" size={14} color="#ef4444" />
                  <Text style={styles.statVal}>{emp.notCompleted}</Text>
                  <Text style={[styles.statLbl, { color: colors.muted }]}>{isAr ? "لم ينجز" : "Failed"}</Text>
                </View>
                <View style={styles.statItem}>
                  <MaterialIcons name="schedule" size={14} color="#8b5cf6" />
                  <Text style={styles.statVal}>{emp.extended}</Text>
                  <Text style={[styles.statLbl, { color: colors.muted }]}>{isAr ? "تمديد" : "Extended"}</Text>
                </View>
              </View>

              {/* Financial */}
              {(emp.totalRewards > 0 || emp.totalDeductions > 0 || emp.hasWarnings > 0) && (
                <View style={styles.financialRow}>
                  {emp.totalRewards > 0 && (
                    <View style={[styles.financialBadge, { backgroundColor: "#ecfdf5" }]}>
                      <MaterialIcons name="star" size={12} color="#10b981" />
                      <Text style={{ fontSize: 11, color: "#10b981", fontWeight: "600" }}>{emp.totalRewards} {isAr ? "ر.س" : "SAR"}</Text>
                    </View>
                  )}
                  {emp.totalDeductions > 0 && (
                    <View style={[styles.financialBadge, { backgroundColor: "#fef2f2" }]}>
                      <MaterialIcons name="remove-circle" size={12} color="#ef4444" />
                      <Text style={{ fontSize: 11, color: "#ef4444", fontWeight: "600" }}>{emp.totalDeductions} {isAr ? "ر.س" : "SAR"}</Text>
                    </View>
                  )}
                  {emp.hasWarnings > 0 && (
                    <View style={[styles.financialBadge, { backgroundColor: "#fffbeb" }]}>
                      <MaterialIcons name="warning" size={12} color="#f59e0b" />
                      <Text style={{ fontSize: 11, color: "#f59e0b", fontWeight: "600" }}>{emp.hasWarnings} {isAr ? "إنذار" : "warnings"}</Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          ))}
        </ScrollView>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 16 },
  headerBtn: { padding: 8, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.2)" },
  headerTitle: { fontSize: 18, fontWeight: "bold", color: "white" },
  overviewCard: { borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1 },
  overviewTitle: { fontSize: 14, fontWeight: "700", marginBottom: 12 },
  overviewRow: { flexDirection: "row", justifyContent: "space-between" },
  overviewItem: { alignItems: "center" },
  overviewVal: { fontSize: 18, fontWeight: "bold" },
  overviewLbl: { fontSize: 10, marginTop: 4 },
  empCard: { borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1 },
  empHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  empName: { fontSize: 14, fontWeight: "700" },
  rateBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  rateText: { fontSize: 13, fontWeight: "bold" },
  progressContainer: { marginBottom: 12 },
  progressBg: { height: 6, backgroundColor: "#e5e7eb", borderRadius: 3, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 3 },
  statsGrid: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  statItem: { alignItems: "center", gap: 2 },
  statVal: { fontSize: 14, fontWeight: "bold", color: "#1f2937" },
  statLbl: { fontSize: 10 },
  financialRow: { flexDirection: "row", gap: 8, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: "#f3f4f6" },
  financialBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
});
