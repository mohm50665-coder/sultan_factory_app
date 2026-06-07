import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  Alert,
  Platform,
  Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useLanguage } from "@/lib/language-context";
import { useAuth } from "@/lib/auth-context";
import { MaterialIcons } from "@expo/vector-icons";
import { trpc } from "@/lib/trpc";
import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";

type GoalType = "production" | "sales" | "quality" | "efficiency" | "safety" | "custom";
type KpiType = "production" | "quality" | "efficiency" | "safety" | "financial" | "custom";

interface MonthlyGoal {
  id: number;
  month: string;
  department: string;
  goalType: GoalType;
  goalName: string;
  targetValue: number;
  unit: string;
  weight: number;
  description?: string;
  status: "active" | "completed" | "cancelled";
  createdBy: number;
  createdAt: string;
  updatedAt: string;
}

interface KPI {
  id: number;
  month: string;
  department: string;
  kpiName: string;
  kpiType: KpiType;
  currentValue: number;
  targetValue: number;
  previousValue: number;
  unit: string;
  status: "on_track" | "at_risk" | "off_track" | "exceeded";
  trend: "up" | "down" | "stable";
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

const DEPARTMENTS = [
  "الإنتاج",
  "المبيعات",
  "المستودعات",
  "الصيانة",
  "المصروفات",
  "المناقصات الحكومية",
  "ممثل مجلس الإدارة",
];

const GOAL_TYPES = [
  { value: "production", labelAr: "الإنتاج", labelEn: "Production" },
  { value: "sales", labelAr: "المبيعات", labelEn: "Sales" },
  { value: "quality", labelAr: "الجودة", labelEn: "Quality" },
  { value: "efficiency", labelAr: "الكفاءة", labelEn: "Efficiency" },
  { value: "safety", labelAr: "السلامة", labelEn: "Safety" },
];

export default function AdminGoalsKpisScreen() {
  const router = useRouter();
  const colors = useColors();
  const { language, isRtl } = useLanguage();
  const { user } = useAuth();
  const isAr = language === "ar";

  const [activeTab, setActiveTab] = useState<"goals" | "kpis">("goals");
  const [currentMonth, setCurrentMonth] = useState(new Date().toISOString().split("T")[0].slice(0, 7));
  const [selectedDepartment, setSelectedDepartment] = useState<string>("");
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [showKpiForm, setShowKpiForm] = useState(false);

  const [goalForm, setGoalForm] = useState({
    department: "",
    goalType: "production" as GoalType,
    goalName: "",
    targetValue: 0,
    unit: "",
    description: "",
  });

  const [kpiForm, setKpiForm] = useState({
    department: "",
    kpiType: "production" as KpiType,
    kpiName: "",
    currentValue: 0,
    targetValue: 0,
    unit: "",
    notes: "",
  });

  // Fetch goals using TRPC
  const { data: goalsData, isLoading: goalsLoading, refetch: refetchGoals } = useQuery({
    queryKey: ["goals", currentMonth, selectedDepartment],
    queryFn: async () => {
      try {
        const response = await fetch("/api/goals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ month: currentMonth, department: selectedDepartment }),
        });
        return response.json();
      } catch (error) {
        console.error("Error fetching goals:", error);
        return [];
      }
    },
  });

  // Fetch KPIs using TRPC
  const { data: kpisData, isLoading: kpisLoading, refetch: refetchKpis } = useQuery({
    queryKey: ["kpis", currentMonth, selectedDepartment],
    queryFn: async () => {
      try {
        const response = await fetch("/api/kpis", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ month: currentMonth, department: selectedDepartment }),
        });
        return response.json();
      } catch (error) {
        console.error("Error fetching KPIs:", error);
        return [];
      }
    },
  });

  // Create goal mutation
  const createGoalMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch("/api/goals/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          month: currentMonth,
          createdBy: user?.id,
        }),
      });
      return response.json();
    },
    onSuccess: () => {
      refetchGoals();
      setShowGoalForm(false);
      setGoalForm({
        department: "",
        goalType: "production",
        goalName: "",
        targetValue: 0,
        unit: "",
        description: "",
      });
      Alert.alert(isAr ? "نجاح" : "Success", isAr ? "تم إضافة الهدف بنجاح" : "Goal added successfully");
    },
    onError: (error) => {
      Alert.alert(isAr ? "خطأ" : "Error", isAr ? "فشل إضافة الهدف" : "Failed to add goal");
    },
  });

  // Create KPI mutation
  const createKpiMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch("/api/kpis/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          month: currentMonth,
        }),
      });
      return response.json();
    },
    onSuccess: () => {
      refetchKpis();
      setShowKpiForm(false);
      setKpiForm({
        department: "",
        kpiType: "production",
        kpiName: "",
        currentValue: 0,
        targetValue: 0,
        unit: "",
        notes: "",
      });
      Alert.alert(isAr ? "نجاح" : "Success", isAr ? "تم إضافة مؤشر الأداء بنجاح" : "KPI added successfully");
    },
    onError: (error) => {
      Alert.alert(isAr ? "خطأ" : "Error", isAr ? "فشل إضافة مؤشر الأداء" : "Failed to add KPI");
    },
  });

  // Delete goal mutation
  const deleteGoalMutation = useMutation({
    mutationFn: async (goalId: number) => {
      const response = await fetch(`/api/goals/${goalId}`, {
        method: "DELETE",
      });
      return response.json();
    },
    onSuccess: () => {
      refetchGoals();
      Alert.alert(isAr ? "نجاح" : "Success", isAr ? "تم حذف الهدف بنجاح" : "Goal deleted successfully");
    },
  });

  // Delete KPI mutation
  const deleteKpiMutation = useMutation({
    mutationFn: async (kpiId: number) => {
      const response = await fetch(`/api/kpis/${kpiId}`, {
        method: "DELETE",
      });
      return response.json();
    },
    onSuccess: () => {
      refetchKpis();
      Alert.alert(isAr ? "نجاح" : "Success", isAr ? "تم حذف مؤشر الأداء بنجاح" : "KPI deleted successfully");
    },
  });

  // Check for alerts
  useEffect(() => {
    if (kpisData && Array.isArray(kpisData)) {
      kpisData.forEach((kpi: KPI) => {
        if (kpi.status === "off_track") {
          // Send notification for off-track KPIs
          console.log(`Alert: KPI "${kpi.kpiName}" is off track`);
        } else if (kpi.status === "at_risk") {
          console.log(`Warning: KPI "${kpi.kpiName}" is at risk`);
        }
      });
    }
  }, [kpisData]);

  const handleAddGoal = () => {
    if (!goalForm.department || !goalForm.goalName || !goalForm.targetValue) {
      Alert.alert(isAr ? "تنبيه" : "Warning", isAr ? "يرجى ملء جميع الحقول المطلوبة" : "Please fill all required fields");
      return;
    }
    createGoalMutation.mutate(goalForm);
  };

  const handleAddKpi = () => {
    if (!kpiForm.department || !kpiForm.kpiName || !kpiForm.targetValue) {
      Alert.alert(isAr ? "تنبيه" : "Warning", isAr ? "يرجى ملء جميع الحقول المطلوبة" : "Please fill all required fields");
      return;
    }
    createKpiMutation.mutate(kpiForm);
  };

  const calculateProgress = (current: number, target: number) => {
    if (target === 0) return 0;
    return Math.min((current / target) * 100, 100);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "on_track":
      case "completed":
        return "#10b981";
      case "at_risk":
        return "#f59e0b";
      case "off_track":
      case "cancelled":
        return "#ef4444";
      default:
        return "#6b7280";
    }
  };

  const getStatusLabel = (status: string) => {
    const statusMap: Record<string, { ar: string; en: string }> = {
      on_track: { ar: "على المسار", en: "On Track" },
      at_risk: { ar: "معرض للخطر", en: "At Risk" },
      off_track: { ar: "خارج المسار", en: "Off Track" },
      exceeded: { ar: "متجاوز", en: "Exceeded" },
      active: { ar: "نشط", en: "Active" },
      completed: { ar: "مكتمل", en: "Completed" },
      cancelled: { ar: "ملغى", en: "Cancelled" },
    };
    return statusMap[status]?.[isAr ? "ar" : "en"] || status;
  };

  const renderGoalsTab = () => (
    <View style={{ flex: 1 }}>
      {/* Add Goal Button */}
      <TouchableOpacity
        onPress={() => setShowGoalForm(!showGoalForm)}
        style={[styles.addButton, { backgroundColor: colors.primary }]}
      >
        <MaterialIcons name={showGoalForm ? "close" : "add"} size={24} color="#fff" />
        <Text style={{ color: "#fff", fontWeight: "bold", marginLeft: 8 }}>
          {isAr ? (showGoalForm ? "إلغاء" : "إضافة هدف جديد") : (showGoalForm ? "Cancel" : "Add New Goal")}
        </Text>
      </TouchableOpacity>

      {/* Goal Form */}
      {showGoalForm && (
        <View style={[styles.form, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.formLabel, { color: colors.foreground }]}>
            {isAr ? "القسم" : "Department"}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            {DEPARTMENTS.map((dept) => (
              <TouchableOpacity
                key={dept}
                onPress={() => setGoalForm({ ...goalForm, department: dept })}
                style={[
                  styles.departmentTag,
                  {
                    backgroundColor: goalForm.department === dept ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text style={{ color: goalForm.department === dept ? "#fff" : colors.foreground }}>
                  {dept}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={[styles.formLabel, { color: colors.foreground }]}>
            {isAr ? "نوع الهدف" : "Goal Type"}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            {GOAL_TYPES.map((type) => (
              <TouchableOpacity
                key={type.value}
                onPress={() => setGoalForm({ ...goalForm, goalType: type.value as GoalType })}
                style={[
                  styles.departmentTag,
                  {
                    backgroundColor: goalForm.goalType === type.value ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text style={{ color: goalForm.goalType === type.value ? "#fff" : colors.foreground }}>
                  {isAr ? type.labelAr : type.labelEn}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={[styles.formLabel, { color: colors.foreground }]}>
            {isAr ? "اسم الهدف" : "Goal Name"}
          </Text>
          <TextInput
            style={[styles.input, { color: colors.foreground, borderColor: colors.border }]}
            placeholder={isAr ? "أدخل اسم الهدف" : "Enter goal name"}
            placeholderTextColor={colors.muted}
            value={goalForm.goalName}
            onChangeText={(text) => setGoalForm({ ...goalForm, goalName: text })}
          />

          <Text style={[styles.formLabel, { color: colors.foreground }]}>
            {isAr ? "القيمة المستهدفة" : "Target Value"}
          </Text>
          <TextInput
            style={[styles.input, { color: colors.foreground, borderColor: colors.border }]}
            placeholder={isAr ? "أدخل القيمة المستهدفة" : "Enter target value"}
            placeholderTextColor={colors.muted}
            keyboardType="decimal-pad"
            value={goalForm.targetValue.toString()}
            onChangeText={(text) => setGoalForm({ ...goalForm, targetValue: parseFloat(text) || 0 })}
          />

          <Text style={[styles.formLabel, { color: colors.foreground }]}>
            {isAr ? "الوحدة" : "Unit"}
          </Text>
          <TextInput
            style={[styles.input, { color: colors.foreground, borderColor: colors.border }]}
            placeholder={isAr ? "مثال: درزن، زوج، جرام" : "e.g., dozen, pair, gram"}
            placeholderTextColor={colors.muted}
            value={goalForm.unit}
            onChangeText={(text) => setGoalForm({ ...goalForm, unit: text })}
          />

          <TouchableOpacity
            onPress={handleAddGoal}
            disabled={createGoalMutation.isPending}
            style={[styles.submitButton, { backgroundColor: colors.primary }]}
          >
            {createGoalMutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: "#fff", fontWeight: "bold" }}>
                {isAr ? "حفظ الهدف" : "Save Goal"}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Goals List */}
      {goalsLoading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 20 }} />
      ) : (
        <ScrollView style={{ marginTop: 12 }}>
          {goalsData && Array.isArray(goalsData) && goalsData.length > 0 ? (
            goalsData.map((goal: MonthlyGoal) => (
              <View
                key={goal.id}
                style={[
                  styles.goalCard,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <View style={styles.goalHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.goalTitle, { color: colors.foreground }]}>
                      {goal.goalName}
                    </Text>
                    <Text style={[styles.goalDept, { color: colors.muted }]}>
                      {goal.department}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(goal.status) }]}>
                    <Text style={{ color: "#fff", fontSize: 12, fontWeight: "bold" }}>
                      {getStatusLabel(goal.status)}
                    </Text>
                  </View>
                </View>

                <View style={styles.goalDetails}>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>
                    {isAr ? "الهدف: " : "Target: "}{goal.targetValue} {goal.unit}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
                    {isAr ? "النوع: " : "Type: "}{goal.goalType}
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={() => deleteGoalMutation.mutate(goal.id)}
                  style={styles.deleteButton}
                >
                  <MaterialIcons name="delete" size={20} color="#ef4444" />
                </TouchableOpacity>
              </View>
            ))
          ) : (
            <Text style={[styles.emptyText, { color: colors.muted }]}>
              {isAr ? "لا توجد أهداف" : "No goals found"}
            </Text>
          )}
        </ScrollView>
      )}
    </View>
  );

  const renderKpisTab = () => (
    <View style={{ flex: 1 }}>
      {/* Add KPI Button */}
      <TouchableOpacity
        onPress={() => setShowKpiForm(!showKpiForm)}
        style={[styles.addButton, { backgroundColor: colors.primary }]}
      >
        <MaterialIcons name={showKpiForm ? "close" : "add"} size={24} color="#fff" />
        <Text style={{ color: "#fff", fontWeight: "bold", marginLeft: 8 }}>
          {isAr ? (showKpiForm ? "إلغاء" : "إضافة مؤشر أداء جديد") : (showKpiForm ? "Cancel" : "Add New KPI")}
        </Text>
      </TouchableOpacity>

      {/* KPI Form */}
      {showKpiForm && (
        <View style={[styles.form, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.formLabel, { color: colors.foreground }]}>
            {isAr ? "القسم" : "Department"}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            {DEPARTMENTS.map((dept) => (
              <TouchableOpacity
                key={dept}
                onPress={() => setKpiForm({ ...kpiForm, department: dept })}
                style={[
                  styles.departmentTag,
                  {
                    backgroundColor: kpiForm.department === dept ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text style={{ color: kpiForm.department === dept ? "#fff" : colors.foreground }}>
                  {dept}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={[styles.formLabel, { color: colors.foreground }]}>
            {isAr ? "اسم المؤشر" : "KPI Name"}
          </Text>
          <TextInput
            style={[styles.input, { color: colors.foreground, borderColor: colors.border }]}
            placeholder={isAr ? "أدخل اسم المؤشر" : "Enter KPI name"}
            placeholderTextColor={colors.muted}
            value={kpiForm.kpiName}
            onChangeText={(text) => setKpiForm({ ...kpiForm, kpiName: text })}
          />

          <Text style={[styles.formLabel, { color: colors.foreground }]}>
            {isAr ? "القيمة الحالية" : "Current Value"}
          </Text>
          <TextInput
            style={[styles.input, { color: colors.foreground, borderColor: colors.border }]}
            placeholder={isAr ? "أدخل القيمة الحالية" : "Enter current value"}
            placeholderTextColor={colors.muted}
            keyboardType="decimal-pad"
            value={kpiForm.currentValue.toString()}
            onChangeText={(text) => setKpiForm({ ...kpiForm, currentValue: parseFloat(text) || 0 })}
          />

          <Text style={[styles.formLabel, { color: colors.foreground }]}>
            {isAr ? "القيمة المستهدفة" : "Target Value"}
          </Text>
          <TextInput
            style={[styles.input, { color: colors.foreground, borderColor: colors.border }]}
            placeholder={isAr ? "أدخل القيمة المستهدفة" : "Enter target value"}
            placeholderTextColor={colors.muted}
            keyboardType="decimal-pad"
            value={kpiForm.targetValue.toString()}
            onChangeText={(text) => setKpiForm({ ...kpiForm, targetValue: parseFloat(text) || 0 })}
          />

          <TouchableOpacity
            onPress={handleAddKpi}
            disabled={createKpiMutation.isPending}
            style={[styles.submitButton, { backgroundColor: colors.primary }]}
          >
            {createKpiMutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: "#fff", fontWeight: "bold" }}>
                {isAr ? "حفظ المؤشر" : "Save KPI"}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* KPIs List with Progress Bars */}
      {kpisLoading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 20 }} />
      ) : (
        <ScrollView style={{ marginTop: 12 }}>
          {kpisData && Array.isArray(kpisData) && kpisData.length > 0 ? (
            kpisData.map((kpi: KPI) => {
              const progress = calculateProgress(kpi.currentValue, kpi.targetValue);
              const statusColor = getStatusColor(kpi.status);

              return (
                <View
                  key={kpi.id}
                  style={[
                    styles.kpiCard,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                >
                  <View style={styles.kpiHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.kpiTitle, { color: colors.foreground }]}>
                        {kpi.kpiName}
                      </Text>
                      <Text style={[styles.kpiDept, { color: colors.muted }]}>
                        {kpi.department}
                      </Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
                      <Text style={{ color: "#fff", fontSize: 12, fontWeight: "bold" }}>
                        {getStatusLabel(kpi.status)}
                      </Text>
                    </View>
                  </View>

                  {/* Progress Bar */}
                  <View style={styles.progressContainer}>
                    <View
                      style={[
                        styles.progressBar,
                        {
                          width: `${progress}%`,
                          backgroundColor: statusColor,
                        },
                      ]}
                    />
                  </View>

                  <View style={styles.kpiStats}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.muted, fontSize: 12 }}>
                        {isAr ? "الحالي" : "Current"}
                      </Text>
                      <Text style={[styles.statValue, { color: colors.foreground }]}>
                        {kpi.currentValue}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.muted, fontSize: 12 }}>
                        {isAr ? "الهدف" : "Target"}
                      </Text>
                      <Text style={[styles.statValue, { color: colors.foreground }]}>
                        {kpi.targetValue}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.muted, fontSize: 12 }}>
                        {isAr ? "النسبة" : "Progress"}
                      </Text>
                      <Text style={[styles.statValue, { color: statusColor }]}>
                        {progress.toFixed(0)}%
                      </Text>
                    </View>
                  </View>

                  {/* Trend Indicator */}
                  <View style={styles.trendContainer}>
                    <MaterialIcons
                      name={
                        kpi.trend === "up"
                          ? "trending-up"
                          : kpi.trend === "down"
                          ? "trending-down"
                          : "trending-flat"
                      }
                      size={16}
                      color={kpi.trend === "up" ? "#10b981" : kpi.trend === "down" ? "#ef4444" : "#6b7280"}
                    />
                    <Text
                      style={{
                        marginLeft: 4,
                        fontSize: 12,
                        color:
                          kpi.trend === "up"
                            ? "#10b981"
                            : kpi.trend === "down"
                            ? "#ef4444"
                            : "#6b7280",
                      }}
                    >
                      {isAr
                        ? kpi.trend === "up"
                          ? "صاعد"
                          : kpi.trend === "down"
                          ? "هابط"
                          : "مستقر"
                        : kpi.trend === "up"
                        ? "Up"
                        : kpi.trend === "down"
                        ? "Down"
                        : "Stable"}
                    </Text>
                  </View>

                  <TouchableOpacity
                    onPress={() => deleteKpiMutation.mutate(kpi.id)}
                    style={styles.deleteButton}
                  >
                    <MaterialIcons name="delete" size={20} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              );
            })
          ) : (
            <Text style={[styles.emptyText, { color: colors.muted }]}>
              {isAr ? "لا توجد مؤشرات أداء" : "No KPIs found"}
            </Text>
          )}
        </ScrollView>
      )}
    </View>
  );

  return (
    <ScreenContainer className="p-0">
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialIcons name={isRtl ? "chevron-right" : "chevron-left"} size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isAr ? "الأهداف ومؤشرات الأداء" : "Goals & KPIs"}
        </Text>
        <View style={{ width: 28 }} />
      </View>

      {/* Month Selector */}
      <View style={[styles.monthSelector, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <TouchableOpacity onPress={() => {
          const date = new Date(currentMonth + "-01");
          date.setMonth(date.getMonth() - 1);
          setCurrentMonth(date.toISOString().split("T")[0].slice(0, 7));
        }}>
          <MaterialIcons name={isRtl ? "chevron-right" : "chevron-left"} size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={[styles.monthText, { color: colors.foreground }]}>
          {currentMonth}
        </Text>
        <TouchableOpacity onPress={() => {
          const date = new Date(currentMonth + "-01");
          date.setMonth(date.getMonth() + 1);
          setCurrentMonth(date.toISOString().split("T")[0].slice(0, 7));
        }}>
          <MaterialIcons name={isRtl ? "chevron-left" : "chevron-right"} size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={[styles.tabsContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => setActiveTab("goals")}
          style={[
            styles.tab,
            activeTab === "goals" && [styles.activeTab, { borderBottomColor: colors.primary }],
          ]}
        >
          <Text style={[
            styles.tabText,
            { color: activeTab === "goals" ? colors.primary : colors.muted },
          ]}>
            {isAr ? "الأهداف" : "Goals"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setActiveTab("kpis")}
          style={[
            styles.tab,
            activeTab === "kpis" && [styles.activeTab, { borderBottomColor: colors.primary }],
          ]}
        >
          <Text style={[
            styles.tabText,
            { color: activeTab === "kpis" ? colors.primary : colors.muted },
          ]}>
            {isAr ? "مؤشرات الأداء" : "KPIs"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View style={{ flex: 1, padding: 12 }}>
        {activeTab === "goals" ? renderGoalsTab() : renderKpisTab()}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: Platform.OS === "ios" ? 16 : 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
  },
  monthSelector: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginHorizontal: 12,
    marginVertical: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  monthText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  tabsContainer: {
    flexDirection: "row",
    borderBottomWidth: 1,
    paddingHorizontal: 12,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
  },
  activeTab: {
    borderBottomWidth: 3,
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  form: {
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 8,
  },
  departmentTag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
    fontSize: 14,
  },
  submitButton: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  goalCard: {
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  goalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  goalTitle: {
    fontSize: 14,
    fontWeight: "bold",
  },
  goalDept: {
    fontSize: 12,
    marginTop: 4,
  },
  goalDetails: {
    marginBottom: 8,
  },
  kpiCard: {
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  kpiHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  kpiTitle: {
    fontSize: 14,
    fontWeight: "bold",
  },
  kpiDept: {
    fontSize: 12,
    marginTop: 4,
  },
  progressContainer: {
    height: 8,
    backgroundColor: "#e5e7eb",
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 12,
  },
  progressBar: {
    height: "100%",
    borderRadius: 4,
  },
  kpiStats: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  statValue: {
    fontSize: 14,
    fontWeight: "bold",
    marginTop: 2,
  },
  trendContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  deleteButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
  },
  emptyText: {
    textAlign: "center",
    marginTop: 20,
    fontSize: 14,
  },
});
