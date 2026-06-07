import React, { useState, useEffect } from "react";
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
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useLanguage } from "@/lib/language-context";
import { useAuth } from "@/lib/auth-context";
import { MaterialIcons } from "@expo/vector-icons";
import { trpc } from "@/lib/trpc";

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

export default function AdminGoalsKpisScreen() {
  const router = useRouter();
  const colors = useColors();
  const { language, isRtl } = useLanguage();
  const { user } = useAuth();
  const isAr = language === "ar";

  const [activeTab, setActiveTab] = useState<"goals" | "kpis">("goals");
  const [isLoading, setIsLoading] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date().toISOString().split("T")[0].slice(0, 7));
  const [selectedDepartment, setSelectedDepartment] = useState<string>("");

  // Goals state
  const [goals, setGoals] = useState<MonthlyGoal[]>([]);
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [goalForm, setGoalForm] = useState({
    department: "",
    goalType: "production" as GoalType,
    goalName: "",
    targetValue: 0,
    unit: "",
    description: "",
  });

  // KPIs state
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [showKpiForm, setShowKpiForm] = useState(false);
  const [kpiForm, setKpiForm] = useState({
    department: "",
    kpiType: "production" as KpiType,
    kpiName: "",
    currentValue: 0,
    targetValue: 0,
    unit: "",
    notes: "",
  });

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === "web") {
      window.alert(`${title}\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const handleAddGoal = async () => {
    if (!goalForm.department || !goalForm.goalName || !goalForm.unit) {
      showAlert(isAr ? "تنبيه" : "Alert", isAr ? "الرجاء ملء جميع الحقول المطلوبة" : "Please fill all required fields");
      return;
    }

    setIsLoading(true);
    try {
      // Here you would call the API to create the goal
      // For now, we'll just add it to the local state
      const newGoal: MonthlyGoal = {
        id: Date.now(),
        month: currentMonth,
        department: goalForm.department,
        goalType: goalForm.goalType,
        goalName: goalForm.goalName,
        targetValue: goalForm.targetValue,
        unit: goalForm.unit,
        weight: 100,
        description: goalForm.description,
        status: "active",
        createdBy: user?.id || 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      setGoals([...goals, newGoal]);
      setGoalForm({
        department: "",
        goalType: "production",
        goalName: "",
        targetValue: 0,
        unit: "",
        description: "",
      });
      setShowGoalForm(false);
      showAlert(isAr ? "نجاح" : "Success", isAr ? "تم إضافة الهدف بنجاح" : "Goal added successfully");
    } catch (error) {
      console.error("Error adding goal:", error);
      showAlert(isAr ? "خطأ" : "Error", isAr ? "حدث خطأ في إضافة الهدف" : "Error adding goal");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddKpi = async () => {
    if (!kpiForm.department || !kpiForm.kpiName || !kpiForm.unit) {
      showAlert(isAr ? "تنبيه" : "Alert", isAr ? "الرجاء ملء جميع الحقول المطلوبة" : "Please fill all required fields");
      return;
    }

    setIsLoading(true);
    try {
      const newKpi: KPI = {
        id: Date.now(),
        month: currentMonth,
        department: kpiForm.department,
        kpiType: kpiForm.kpiType,
        kpiName: kpiForm.kpiName,
        currentValue: kpiForm.currentValue,
        targetValue: kpiForm.targetValue,
        previousValue: 0,
        unit: kpiForm.unit,
        status: "on_track",
        trend: "stable",
        notes: kpiForm.notes,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      setKpis([...kpis, newKpi]);
      setKpiForm({
        department: "",
        kpiType: "production",
        kpiName: "",
        currentValue: 0,
        targetValue: 0,
        unit: "",
        notes: "",
      });
      setShowKpiForm(false);
      showAlert(isAr ? "نجاح" : "Success", isAr ? "تم إضافة المؤشر بنجاح" : "KPI added successfully");
    } catch (error) {
      console.error("Error adding KPI:", error);
      showAlert(isAr ? "خطأ" : "Error", isAr ? "حدث خطأ في إضافة المؤشر" : "Error adding KPI");
    } finally {
      setIsLoading(false);
    }
  };

  const deleteGoal = (id: number) => {
    setGoals(goals.filter((g) => g.id !== id));
  };

  const deleteKpi = (id: number) => {
    setKpis(kpis.filter((k) => k.id !== id));
  };

  const getProgressPercentage = (current: number, target: number) => {
    if (target === 0) return 0;
    return Math.min(Math.round((current / target) * 100), 100);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "on_track":
      case "active":
        return colors.success;
      case "at_risk":
      case "completed":
        return colors.warning;
      case "off_track":
      case "cancelled":
        return colors.error;
      case "exceeded":
        return colors.primary;
      default:
        return colors.muted;
    }
  };

  const filteredGoals = selectedDepartment
    ? goals.filter((g) => g.department === selectedDepartment)
    : goals;

  const filteredKpis = selectedDepartment
    ? kpis.filter((k) => k.department === selectedDepartment)
    : kpis;

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={{ backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Pressable onPress={() => router.back()} style={({ pressed }) => [{ marginRight: 12, opacity: pressed ? 0.7 : 1 }]}>
            <MaterialIcons
              name={isRtl ? "chevron-right" : "chevron-left"}
              size={28}
              color="white"
            />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ color: "white", fontSize: 20, fontWeight: "bold" }}>
              {isAr ? "الأهداف ومؤشرات الأداء" : "Goals & KPIs"}
            </Text>
            <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 12, marginTop: 2 }}>
              {isAr ? "إدارة أهداف الأقسام ومؤشرات الأداء" : "Manage department goals and KPIs"}
            </Text>
          </View>
        </View>
      </View>

      {/* Tabs */}
      <View style={{ flexDirection: "row", backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <TouchableOpacity
          style={[
            styles.tab,
            {
              backgroundColor: activeTab === "goals" ? colors.primary : "transparent",
              flex: 1,
            },
          ]}
          onPress={() => setActiveTab("goals")}
        >
          <Text style={{ color: activeTab === "goals" ? "white" : colors.foreground, fontWeight: "600", textAlign: "center" }}>
            {isAr ? "الأهداف الشهرية" : "Monthly Goals"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tab,
            {
              backgroundColor: activeTab === "kpis" ? colors.primary : "transparent",
              flex: 1,
            },
          ]}
          onPress={() => setActiveTab("kpis")}
        >
          <Text style={{ color: activeTab === "kpis" ? "white" : colors.foreground, fontWeight: "600", textAlign: "center" }}>
            {isAr ? "مؤشرات الأداء" : "KPIs"}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {/* Month & Department Filters */}
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.muted, fontSize: 11, marginBottom: 4, fontWeight: "600" }}>
              {isAr ? "الشهر" : "Month"}
            </Text>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground, textAlign: isRtl ? "right" : "left" },
              ]}
              placeholder="YYYY-MM"
              value={currentMonth}
              onChangeText={setCurrentMonth}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.muted, fontSize: 11, marginBottom: 4, fontWeight: "600" }}>
              {isAr ? "القسم" : "Department"}
            </Text>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground, textAlign: isRtl ? "right" : "left" },
              ]}
              placeholder={isAr ? "اختر القسم" : "Select department"}
              value={selectedDepartment}
              onChangeText={setSelectedDepartment}
            />
          </View>
        </View>

        {/* Goals Tab */}
        {activeTab === "goals" && (
          <View>
            {/* Add Goal Button */}
            <TouchableOpacity
              style={[styles.addButton, { backgroundColor: colors.primary }]}
              onPress={() => setShowGoalForm(!showGoalForm)}
            >
              <MaterialIcons name={showGoalForm ? "expand-less" : "add-circle"} size={20} color="white" />
              <Text style={{ color: "white", fontWeight: "600", marginLeft: 8 }}>
                {isAr ? "إضافة هدف جديد" : "Add New Goal"}
              </Text>
            </TouchableOpacity>

            {/* Goal Form */}
            {showGoalForm && (
              <View style={[styles.formCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                {/* Department */}
                <View style={{ marginBottom: 12 }}>
                  <Text style={{ color: colors.muted, fontSize: 11, marginBottom: 4, fontWeight: "600" }}>
                    {isAr ? "القسم *" : "Department *"}
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground, textAlign: isRtl ? "right" : "left" },
                    ]}
                    placeholder={isAr ? "اختر القسم" : "Select department"}
                    value={goalForm.department}
                    onChangeText={(text) => setGoalForm({ ...goalForm, department: text })}
                  />
                </View>

                {/* Goal Name */}
                <View style={{ marginBottom: 12 }}>
                  <Text style={{ color: colors.muted, fontSize: 11, marginBottom: 4, fontWeight: "600" }}>
                    {isAr ? "اسم الهدف *" : "Goal Name *"}
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground, textAlign: isRtl ? "right" : "left" },
                    ]}
                    placeholder={isAr ? "أدخل اسم الهدف" : "Enter goal name"}
                    value={goalForm.goalName}
                    onChangeText={(text) => setGoalForm({ ...goalForm, goalName: text })}
                  />
                </View>

                {/* Target Value & Unit */}
                <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.muted, fontSize: 11, marginBottom: 4, fontWeight: "600" }}>
                      {isAr ? "القيمة المستهدفة *" : "Target Value *"}
                    </Text>
                    <TextInput
                      style={[
                        styles.input,
                        { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground, textAlign: isRtl ? "right" : "left" },
                      ]}
                      placeholder="0"
                      keyboardType="numeric"
                      value={goalForm.targetValue === 0 ? "" : goalForm.targetValue.toString()}
                      onChangeText={(text) => setGoalForm({ ...goalForm, targetValue: parseInt(text) || 0 })}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.muted, fontSize: 11, marginBottom: 4, fontWeight: "600" }}>
                      {isAr ? "الوحدة *" : "Unit *"}
                    </Text>
                    <TextInput
                      style={[
                        styles.input,
                        { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground, textAlign: isRtl ? "right" : "left" },
                      ]}
                      placeholder={isAr ? "درزن، ريال، إلخ" : "dozen, SAR, etc"}
                      value={goalForm.unit}
                      onChangeText={(text) => setGoalForm({ ...goalForm, unit: text })}
                    />
                  </View>
                </View>

                {/* Description */}
                <View style={{ marginBottom: 12 }}>
                  <Text style={{ color: colors.muted, fontSize: 11, marginBottom: 4, fontWeight: "600" }}>
                    {isAr ? "الوصف" : "Description"}
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: colors.background,
                        borderColor: colors.border,
                        color: colors.foreground,
                        minHeight: 60,
                        textAlignVertical: "top",
                        textAlign: isRtl ? "right" : "left",
                      },
                    ]}
                    placeholder={isAr ? "أضف وصفاً للهدف" : "Add goal description"}
                    value={goalForm.description}
                    onChangeText={(text) => setGoalForm({ ...goalForm, description: text })}
                    multiline
                  />
                </View>

                {/* Save Button */}
                <TouchableOpacity
                  style={[styles.saveButton, { backgroundColor: colors.primary }]}
                  onPress={handleAddGoal}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text style={{ color: "white", fontWeight: "700", textAlign: "center" }}>
                      {isAr ? "حفظ الهدف" : "Save Goal"}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* Goals List */}
            <View style={{ marginTop: 16 }}>
              {filteredGoals.length === 0 ? (
                <View style={{ alignItems: "center", paddingVertical: 40 }}>
                  <MaterialIcons name="flag" size={48} color={colors.muted + "40"} />
                  <Text style={{ color: colors.muted, marginTop: 8, textAlign: "center" }}>
                    {isAr ? "لا توجد أهداف محددة" : "No goals defined"}
                  </Text>
                </View>
              ) : (
                filteredGoals.map((goal) => (
                  <View
                    key={goal.id}
                    style={[
                      styles.goalCard,
                      { backgroundColor: colors.surface, borderColor: colors.border },
                    ]}
                  >
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 14 }}>
                          {goal.goalName}
                        </Text>
                        <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
                          {goal.department}
                        </Text>
                      </View>
                      <Pressable onPress={() => deleteGoal(goal.id)}>
                        <MaterialIcons name="delete" size={20} color={colors.error} />
                      </Pressable>
                    </View>

                    <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                      <Text style={{ color: colors.muted, fontSize: 12 }}>
                        {isAr ? "الهدف" : "Target"}: {goal.targetValue} {goal.unit}
                      </Text>
                      <Text style={[{ fontSize: 12, fontWeight: "600" }, { color: getStatusColor(goal.status) }]}>
                        {goal.status === "active" ? (isAr ? "نشط" : "Active") : goal.status === "completed" ? (isAr ? "مكتمل" : "Completed") : (isAr ? "ملغى" : "Cancelled")}
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          </View>
        )}

        {/* KPIs Tab */}
        {activeTab === "kpis" && (
          <View>
            {/* Add KPI Button */}
            <TouchableOpacity
              style={[styles.addButton, { backgroundColor: colors.primary }]}
              onPress={() => setShowKpiForm(!showKpiForm)}
            >
              <MaterialIcons name={showKpiForm ? "expand-less" : "add-circle"} size={20} color="white" />
              <Text style={{ color: "white", fontWeight: "600", marginLeft: 8 }}>
                {isAr ? "إضافة مؤشر أداء جديد" : "Add New KPI"}
              </Text>
            </TouchableOpacity>

            {/* KPI Form */}
            {showKpiForm && (
              <View style={[styles.formCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                {/* Department */}
                <View style={{ marginBottom: 12 }}>
                  <Text style={{ color: colors.muted, fontSize: 11, marginBottom: 4, fontWeight: "600" }}>
                    {isAr ? "القسم *" : "Department *"}
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground, textAlign: isRtl ? "right" : "left" },
                    ]}
                    placeholder={isAr ? "اختر القسم" : "Select department"}
                    value={kpiForm.department}
                    onChangeText={(text) => setKpiForm({ ...kpiForm, department: text })}
                  />
                </View>

                {/* KPI Name */}
                <View style={{ marginBottom: 12 }}>
                  <Text style={{ color: colors.muted, fontSize: 11, marginBottom: 4, fontWeight: "600" }}>
                    {isAr ? "اسم المؤشر *" : "KPI Name *"}
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground, textAlign: isRtl ? "right" : "left" },
                    ]}
                    placeholder={isAr ? "أدخل اسم المؤشر" : "Enter KPI name"}
                    value={kpiForm.kpiName}
                    onChangeText={(text) => setKpiForm({ ...kpiForm, kpiName: text })}
                  />
                </View>

                {/* Current & Target Values */}
                <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.muted, fontSize: 11, marginBottom: 4, fontWeight: "600" }}>
                      {isAr ? "القيمة الحالية" : "Current Value"}
                    </Text>
                    <TextInput
                      style={[
                        styles.input,
                        { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground, textAlign: isRtl ? "right" : "left" },
                      ]}
                      placeholder="0"
                      keyboardType="numeric"
                      value={kpiForm.currentValue === 0 ? "" : kpiForm.currentValue.toString()}
                      onChangeText={(text) => setKpiForm({ ...kpiForm, currentValue: parseInt(text) || 0 })}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.muted, fontSize: 11, marginBottom: 4, fontWeight: "600" }}>
                      {isAr ? "القيمة المستهدفة *" : "Target Value *"}
                    </Text>
                    <TextInput
                      style={[
                        styles.input,
                        { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground, textAlign: isRtl ? "right" : "left" },
                      ]}
                      placeholder="0"
                      keyboardType="numeric"
                      value={kpiForm.targetValue === 0 ? "" : kpiForm.targetValue.toString()}
                      onChangeText={(text) => setKpiForm({ ...kpiForm, targetValue: parseInt(text) || 0 })}
                    />
                  </View>
                </View>

                {/* Unit */}
                <View style={{ marginBottom: 12 }}>
                  <Text style={{ color: colors.muted, fontSize: 11, marginBottom: 4, fontWeight: "600" }}>
                    {isAr ? "الوحدة *" : "Unit *"}
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground, textAlign: isRtl ? "right" : "left" },
                    ]}
                    placeholder={isAr ? "درزن، ريال، إلخ" : "dozen, SAR, etc"}
                    value={kpiForm.unit}
                    onChangeText={(text) => setKpiForm({ ...kpiForm, unit: text })}
                  />
                </View>

                {/* Notes */}
                <View style={{ marginBottom: 12 }}>
                  <Text style={{ color: colors.muted, fontSize: 11, marginBottom: 4, fontWeight: "600" }}>
                    {isAr ? "ملاحظات" : "Notes"}
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: colors.background,
                        borderColor: colors.border,
                        color: colors.foreground,
                        minHeight: 60,
                        textAlignVertical: "top",
                        textAlign: isRtl ? "right" : "left",
                      },
                    ]}
                    placeholder={isAr ? "أضف ملاحظات" : "Add notes"}
                    value={kpiForm.notes}
                    onChangeText={(text) => setKpiForm({ ...kpiForm, notes: text })}
                    multiline
                  />
                </View>

                {/* Save Button */}
                <TouchableOpacity
                  style={[styles.saveButton, { backgroundColor: colors.primary }]}
                  onPress={handleAddKpi}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text style={{ color: "white", fontWeight: "700", textAlign: "center" }}>
                      {isAr ? "حفظ المؤشر" : "Save KPI"}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* KPIs List */}
            <View style={{ marginTop: 16 }}>
              {filteredKpis.length === 0 ? (
                <View style={{ alignItems: "center", paddingVertical: 40 }}>
                  <MaterialIcons name="trending-up" size={48} color={colors.muted + "40"} />
                  <Text style={{ color: colors.muted, marginTop: 8, textAlign: "center" }}>
                    {isAr ? "لا توجد مؤشرات أداء محددة" : "No KPIs defined"}
                  </Text>
                </View>
              ) : (
                filteredKpis.map((kpi) => {
                  const progress = getProgressPercentage(kpi.currentValue, kpi.targetValue);
                  return (
                    <View
                      key={kpi.id}
                      style={[
                        styles.kpiCard,
                        { backgroundColor: colors.surface, borderColor: colors.border },
                      ]}
                    >
                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 14 }}>
                            {kpi.kpiName}
                          </Text>
                          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
                            {kpi.department}
                          </Text>
                        </View>
                        <Pressable onPress={() => deleteKpi(kpi.id)}>
                          <MaterialIcons name="delete" size={20} color={colors.error} />
                        </Pressable>
                      </View>

                      {/* Progress Bar */}
                      <View style={{ marginBottom: 8 }}>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                          <Text style={{ color: colors.muted, fontSize: 11 }}>
                            {kpi.currentValue} / {kpi.targetValue} {kpi.unit}
                          </Text>
                          <Text style={[{ fontSize: 11, fontWeight: "600" }, { color: getStatusColor(kpi.status) }]}>
                            {progress}%
                          </Text>
                        </View>
                        <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
                          <View
                            style={[
                              styles.progressFill,
                              {
                                width: `${progress}%`,
                                backgroundColor: getStatusColor(kpi.status),
                              },
                            ]}
                          />
                        </View>
                      </View>

                      {/* Status */}
                      <Text style={[{ fontSize: 12, fontWeight: "600" }, { color: getStatusColor(kpi.status) }]}>
                        {kpi.status === "on_track"
                          ? isAr
                            ? "على المسار"
                            : "On Track"
                          : kpi.status === "at_risk"
                          ? isAr
                            ? "معرض للخطر"
                            : "At Risk"
                          : kpi.status === "off_track"
                          ? isAr
                            ? "خارج المسار"
                            : "Off Track"
                          : isAr
                          ? "متجاوز"
                          : "Exceeded"}
                      </Text>
                    </View>
                  );
                })
              )}
            </View>
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
  tab: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  formCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  saveButton: {
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  goalCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  kpiCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
  },
});
