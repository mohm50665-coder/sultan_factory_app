import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Switch,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useLanguage } from "@/lib/language-context";
import { MaterialIcons } from "@expo/vector-icons";
import { adminService, manufacturingWorkersService, boardDataService } from "@/lib/services/api.service";

// Storage keys removed - all data now on server

// ===== TYPES =====
interface StageWorker {
  id: string;
  name: string;
  nameEn: string;
}

interface Stage {
  id: string;
  label: string;
  labelEn: string;
  icon: string;
  color: string;
  workers: StageWorker[];
}

type ActiveSection = "stages" | "permissions" | "board" | "settings";

// ===== AVAILABLE TOOLS (for permissions) =====
const AVAILABLE_TOOLS = [
  { id: "advanced_analytics", labelAr: "التحليلات المتقدمة", labelEn: "Advanced Analytics", icon: "insights", color: "#0891b2" },
  { id: "export_reports", labelAr: "تصدير التقارير PDF", labelEn: "Export Reports PDF", icon: "picture-as-pdf", color: "#dc2626" },
  { id: "cost_comparison", labelAr: "تقرير مقارنة التكاليف", labelEn: "Cost Comparison Report", icon: "trending-down", color: "#f97316" },
  { id: "product_cost_calculator", labelAr: "حساب تكاليف منتج جديد", labelEn: "Product Cost Calculator", icon: "calculate", color: "#8b5cf6" },
  { id: "activity_log", labelAr: "سجل التعديلات", labelEn: "Activity Log", icon: "history", color: "#6366f1" },
  { id: "global_search", labelAr: "البحث الشامل", labelEn: "Global Search", icon: "search", color: "#06b6d4" },
  { id: "data_backup", labelAr: "النسخ الاحتياطي", labelEn: "Data Backup", icon: "backup", color: "#14b8a6" },
  { id: "user_management", labelAr: "إدارة المستخدمين", labelEn: "User Management", icon: "people", color: "#f59e0b" },
];

// ===== DEFAULT STAGES =====
const DEFAULT_STAGES: Stage[] = [
  {
    id: "machines",
    label: "إنتاج المكائن",
    labelEn: "Machine Production",
    icon: "precision-manufacturing",
    color: "#0a7ea4",
    workers: [
      { id: "w1", name: "رنا", nameEn: "Rana" },
      { id: "w2", name: "محمد احمد", nameEn: "Mohammed Ahmed" },
      { id: "w3", name: "أفضل", nameEn: "Afzal" },
      { id: "w4", name: "عطالله", nameEn: "Atallah" },
      { id: "w5", name: "شفيق", nameEn: "Shafiq" },
    ],
  },
  {
    id: "rosso",
    label: "الروسو",
    labelEn: "Rosso",
    icon: "loop",
    color: "#7c3aed",
    workers: [
      { id: "w6", name: "فريدو", nameEn: "Fredo" },
      { id: "w7", name: "قيوم", nameEn: "Qayyum" },
    ],
  },
  {
    id: "qalb",
    label: "القلب",
    labelEn: "Turning",
    icon: "flip",
    color: "#059669",
    workers: [{ id: "w8", name: "حسين السوري", nameEn: "Hussein Al-Suri" }],
  },
  {
    id: "kawiya",
    label: "الكاوية",
    labelEn: "Ironing",
    icon: "local-fire-department",
    color: "#dc2626",
    workers: [{ id: "w9", name: "جنيد", nameEn: "Junaid" }],
  },
  {
    id: "inspection",
    label: "الفحص",
    labelEn: "Inspection",
    icon: "search",
    color: "#d97706",
    workers: [
      { id: "w10", name: "عارف", nameEn: "Aref" },
      { id: "w11", name: "انام الدين", nameEn: "Anamuddin" },
    ],
  },
  {
    id: "packing",
    label: "التغليف",
    labelEn: "Packing",
    icon: "inventory-2",
    color: "#2563eb",
    workers: [
      { id: "w12", name: "محمد عمر", nameEn: "Mohammed Omar" },
      { id: "w13", name: "غلام", nameEn: "Ghulam" },
      { id: "w14", name: "بشير", nameEn: "Bashir" },
    ],
  },
  {
    id: "antislip",
    label: "مانع الانزلاق",
    labelEn: "Anti-slip",
    icon: "layers",
    color: "#0891b2",
    workers: [
      { id: "w15", name: "محمد عمر", nameEn: "Mohammed Omar" },
      { id: "w16", name: "مرتضى", nameEn: "Murtadha" },
      { id: "w17", name: "أوجيل", nameEn: "Ogil" },
    ],
  },
  {
    id: "storage",
    label: "التخزين",
    labelEn: "Storage",
    icon: "warehouse",
    color: "#4f46e5",
    workers: [{ id: "w18", name: "شميم", nameEn: "Shamim" }],
  },
];

export default function ComprehensiveAdminPanel() {
  const router = useRouter();
  const colors = useColors();
  const { language, t, isRtl } = useLanguage();
  const isAr = language === "ar";

  const [activeSection, setActiveSection] = useState<ActiveSection>("stages");
  const [stages, setStages] = useState<Stage[]>(DEFAULT_STAGES);
  const [isLoading, setIsLoading] = useState(true);

  // Worker modal
  const [showWorkerModal, setShowWorkerModal] = useState(false);
  const [editingWorker, setEditingWorker] = useState<StageWorker | null>(null);
  const [selectedStage, setSelectedStage] = useState<Stage | null>(null);
  const [workerName, setWorkerName] = useState("");
  const [workerNameEn, setWorkerNameEn] = useState("");

  // Permissions
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [userPermissions, setUserPermissions] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Load stages workers from server
      try {
        const allWorkers = await manufacturingWorkersService.list();
        if (allWorkers && Array.isArray(allWorkers) && allWorkers.length > 0) {
          // Group workers by stageId and build stages
          const workersByStage: Record<string, StageWorker[]> = {};
          allWorkers.forEach((w: any) => {
            if (!workersByStage[w.stageId]) workersByStage[w.stageId] = [];
            workersByStage[w.stageId].push({ id: String(w.id), name: w.workerName, nameEn: w.role || w.workerName });
          });
          // Merge with default stages
          const merged = DEFAULT_STAGES.map((s) => ({
            ...s,
            workers: workersByStage[s.id] || s.workers,
          }));
          setStages(merged);
        }
      } catch (e) {
        console.log("Using default stages", e);
      }
      // Load users from server API
      try {
        const serverUsers = await adminService.getAllUsers();
        if (serverUsers && serverUsers.length > 0) {
          setUsers(serverUsers);
        }
      } catch (e) {
        console.log("Error loading users", e);
      }
    } catch (e) {
      console.error("Error loading data:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const saveStages = async (newStages: Stage[]) => {
    setStages(newStages);
    // Sync each stage's workers to server
    for (const stage of newStages) {
      try {
        await manufacturingWorkersService.bulkSet(
          stage.id,
          stage.workers.map((w) => ({ workerName: w.name, role: w.nameEn }))
        );
      } catch (e) {
        console.log("Error saving stage workers to server:", e);
      }
    }
  };

  // ===== WORKER MANAGEMENT =====
  const handleAddWorker = (stage: Stage) => {
    setSelectedStage(stage);
    setEditingWorker(null);
    setWorkerName("");
    setWorkerNameEn("");
    setShowWorkerModal(true);
  };

  const handleEditWorker = (stage: Stage, worker: StageWorker) => {
    setSelectedStage(stage);
    setEditingWorker(worker);
    setWorkerName(worker.name);
    setWorkerNameEn(worker.nameEn);
    setShowWorkerModal(true);
  };

  const handleSaveWorker = async () => {
    if (!workerName.trim()) {
      Alert.alert(t("error"), isAr ? "يرجى إدخال اسم الموظف" : "Please enter worker name");
      return;
    }
    if (!selectedStage) return;

    const updatedStages = stages.map((s) => {
      if (s.id !== selectedStage.id) return s;
      if (editingWorker) {
        return {
          ...s,
          workers: s.workers.map((w) =>
            w.id === editingWorker.id ? { ...w, name: workerName.trim(), nameEn: workerNameEn.trim() || workerName.trim() } : w
          ),
        };
      } else {
        const newWorker: StageWorker = {
          id: `w_${Date.now()}`,
          name: workerName.trim(),
          nameEn: workerNameEn.trim() || workerName.trim(),
        };
        return { ...s, workers: [...s.workers, newWorker] };
      }
    });

    await saveStages(updatedStages);
    setShowWorkerModal(false);
    Alert.alert(t("done"), t("saved_success"));
  };

  const handleDeleteWorker = (stage: Stage, worker: StageWorker) => {
    Alert.alert(
      t("confirm_delete"),
      isAr ? `حذف "${worker.name}" من ${stage.label}؟` : `Delete "${worker.nameEn}" from ${stage.labelEn}?`,
      [
        { text: t("cancel"), style: "cancel" },
        {
          text: t("delete"),
          style: "destructive",
          onPress: async () => {
            const updatedStages = stages.map((s) => {
              if (s.id !== stage.id) return s;
              return { ...s, workers: s.workers.filter((w) => w.id !== worker.id) };
            });
            await saveStages(updatedStages);
          },
        },
      ]
    );
  };

  const handleMoveWorker = (stage: Stage, worker: StageWorker) => {
    const otherStages = stages.filter((s) => s.id !== stage.id);
    Alert.alert(
      isAr ? "نقل الموظف" : "Move Worker",
      isAr ? `نقل "${worker.name}" إلى:` : `Move "${worker.nameEn}" to:`,
      [
        ...otherStages.map((stg) => ({
          text: isAr ? stg.label : stg.labelEn,
          onPress: async () => {
            const updatedStages = stages.map((s) => {
              if (s.id === stage.id) return { ...s, workers: s.workers.filter((w) => w.id !== worker.id) };
              if (s.id === stg.id) return { ...s, workers: [...s.workers, worker] };
              return s;
            });
            await saveStages(updatedStages);
            Alert.alert(t("done"), isAr ? `تم نقل ${worker.name}` : `Moved ${worker.nameEn}`);
          },
        })),
        { text: t("cancel"), style: "cancel" },
      ]
    );
  };

  // ===== PERMISSIONS =====
  const selectUser = async (u: any) => {
    setSelectedUser(u);
    try {
      // Use server-stored permissions
      if (u.toolPermissions && Object.keys(u.toolPermissions).length > 0) {
        setUserPermissions(u.toolPermissions);
      } else {
        const defaults: Record<string, boolean> = {};
        AVAILABLE_TOOLS.forEach((t) => { defaults[t.id] = true; });
        setUserPermissions(defaults);
      }
    } catch (e) {
      console.error("Error loading permissions:", e);
      const defaults: Record<string, boolean> = {};
      AVAILABLE_TOOLS.forEach((t) => { defaults[t.id] = true; });
      setUserPermissions(defaults);
    }
  };

  const togglePermission = (toolId: string) => {
    setUserPermissions((prev) => ({ ...prev, [toolId]: !prev[toolId] }));
  };

  const savePermissions = async () => {
    if (!selectedUser) return;
    try {
      await adminService.updateToolPermissions(selectedUser.id, userPermissions);
      Alert.alert(t("done"), isAr ? "تم حفظ الصلاحيات" : "Permissions saved");
    } catch (e) {
      console.log("Error saving permissions:", e);
      Alert.alert(t("error"), isAr ? "فشل حفظ الصلاحيات" : "Failed to save permissions");
    }
  };

  // ===== BOARD/RESET =====
  const handleClearBoardData = () => {
    Alert.alert(
      isAr ? "تأكيد التصفير" : "Confirm Clear",
      isAr ? "سيتم حذف جميع بيانات ممثل مجلس الإدارة نهائياً" : "All board data will be permanently deleted",
      [
        { text: t("cancel"), style: "cancel" },
        {
          text: isAr ? "تصفير" : "Clear",
          style: "destructive",
          onPress: async () => {
            try {
              await boardDataService.clear();
              Alert.alert(t("done"), isAr ? "تم تصفير جميع البيانات" : "All data cleared");
            } catch (e) {
              Alert.alert(t("error"), isAr ? "فشل التصفير" : "Failed to clear data");
            }
          },
        },
      ]
    );
  };

  const handleResetStages = () => {
    Alert.alert(
      isAr ? "إعادة تعيين" : "Reset",
      isAr ? "إرجاع المراحل والموظفين للوضع الافتراضي؟" : "Reset stages and workers to defaults?",
      [
        { text: t("cancel"), style: "cancel" },
        {
          text: isAr ? "إعادة تعيين" : "Reset",
          style: "destructive",
          onPress: async () => {
            // Reset to defaults on server
            await saveStages(DEFAULT_STAGES);
            Alert.alert(t("done"), isAr ? "تم إعادة التعيين" : "Reset complete");
          },
        },
      ]
    );
  };

  // ===== RENDER: STAGES =====
  const renderStagesSection = () => (
    <View style={{ gap: 12 }}>
      <Text style={[styles.sectionDesc, { color: colors.muted }]}>
        {isAr ? "إدارة الموظفين في مراحل تسليم الإنتاج (إضافة، حذف، تعديل، نقل)" : "Manage workers in production stages (add, delete, edit, move)"}
      </Text>
      {stages.map((stage) => (
        <View key={stage.id} style={[styles.stageCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.stageHeader}>
            <View style={[styles.stageIcon, { backgroundColor: `${stage.color}15` }]}>
              <MaterialIcons name={stage.icon as any} size={22} color={stage.color} />
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={[styles.stageTitle, { color: colors.foreground }]}>
                {isAr ? stage.label : stage.labelEn}
              </Text>
              <Text style={{ fontSize: 11, color: colors.muted }}>
                {stage.workers.length} {isAr ? "موظف" : "workers"}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => handleAddWorker(stage)}
              style={[styles.addWorkerBtn, { backgroundColor: stage.color }]}
            >
              <MaterialIcons name="person-add" size={14} color="#fff" />
              <Text style={{ color: "#fff", fontSize: 11, fontWeight: "600", marginLeft: 4 }}>
                {t("add")}
              </Text>
            </TouchableOpacity>
          </View>

          {stage.workers.length > 0 && (
            <View style={{ gap: 6, marginTop: 10 }}>
              {stage.workers.map((worker) => (
                <View key={worker.id} style={[styles.workerRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.workerName, { color: colors.foreground }]}>{worker.name}</Text>
                  </View>
                  <View style={styles.workerActions}>
                    <TouchableOpacity onPress={() => handleEditWorker(stage, worker)} style={styles.workerActionBtn}>
                      <MaterialIcons name="edit" size={15} color={colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleMoveWorker(stage, worker)} style={styles.workerActionBtn}>
                      <MaterialIcons name="swap-horiz" size={15} color="#f59e0b" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDeleteWorker(stage, worker)} style={styles.workerActionBtn}>
                      <MaterialIcons name="close" size={15} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      ))}
    </View>
  );

  // ===== RENDER: PERMISSIONS =====
  const renderPermissionsSection = () => (
    <View style={{ gap: 12 }}>
      <Text style={[styles.sectionDesc, { color: colors.muted }]}>
        {isAr ? "تحديد الأدوات الإضافية المتاحة لكل مستخدم" : "Set which extra tools each user can access"}
      </Text>

      {/* User Selection */}
      {users.length === 0 ? (
        <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <MaterialIcons name="info-outline" size={20} color={colors.muted} />
          <Text style={{ flex: 1, marginLeft: 10, fontSize: 13, color: colors.muted }}>
            {isAr ? "لا يوجد مستخدمين مسجلين بعد" : "No registered users yet"}
          </Text>
        </View>
      ) : (
        <>
          <Text style={{ fontSize: 13, fontWeight: "600", color: colors.foreground }}>
            {isAr ? "اختر المستخدم:" : "Select user:"}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {users.map((u) => (
              <TouchableOpacity
                key={u.id}
                onPress={() => selectUser(u)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 8,
                  backgroundColor: selectedUser?.id === u.id ? colors.primary : colors.surface,
                  borderWidth: 1,
                  borderColor: selectedUser?.id === u.id ? colors.primary : colors.border,
                }}
              >
                <Text style={{ color: selectedUser?.id === u.id ? "#fff" : colors.foreground, fontWeight: "600", fontSize: 13 }}>
                  {u.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {selectedUser && (
            <View style={{ gap: 8, marginTop: 8 }}>
              <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <MaterialIcons name="person" size={18} color={colors.primary} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={{ fontSize: 14, fontWeight: "600", color: colors.foreground }}>{selectedUser.name}</Text>
                  <Text style={{ fontSize: 12, color: colors.muted }}>
                    {selectedUser.department || (isAr ? "بدون قسم" : "No department")} • {selectedUser.role || "user"}
                  </Text>
                </View>
              </View>

              {AVAILABLE_TOOLS.map((tool) => (
                <View
                  key={tool.id}
                  style={[styles.permissionRow, { backgroundColor: colors.surface, borderColor: userPermissions[tool.id] ? tool.color + "40" : colors.border }]}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", flex: 1, gap: 10 }}>
                    <View style={{ width: 34, height: 34, borderRadius: 8, backgroundColor: tool.color + "15", justifyContent: "center", alignItems: "center" }}>
                      <MaterialIcons name={tool.icon as any} size={18} color={tool.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontWeight: "600", color: colors.foreground }}>
                        {isAr ? tool.labelAr : tool.labelEn}
                      </Text>
                    </View>
                  </View>
                  <Switch
                    value={userPermissions[tool.id] || false}
                    onValueChange={() => togglePermission(tool.id)}
                    trackColor={{ false: colors.border, true: colors.primary + "60" }}
                    thumbColor={userPermissions[tool.id] ? colors.primary : colors.muted}
                  />
                </View>
              ))}

              <TouchableOpacity
                onPress={savePermissions}
                style={[styles.saveBtn, { backgroundColor: colors.primary }]}
              >
                <MaterialIcons name="save" size={18} color="#fff" />
                <Text style={{ color: "#fff", fontWeight: "600", marginLeft: 8 }}>
                  {isAr ? "حفظ الصلاحيات" : "Save Permissions"}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      )}
    </View>
  );

  // ===== RENDER: BOARD =====
  const renderBoardSection = () => (
    <View style={{ gap: 12 }}>
      <Text style={[styles.sectionDesc, { color: colors.muted }]}>
        {isAr ? "تصفير بيانات ممثل مجلس الإدارة (الأرقام والمؤشرات)" : "Clear board representative data (numbers and KPIs)"}
      </Text>

      <TouchableOpacity
        onPress={handleClearBoardData}
        style={[styles.dangerBtn, { borderColor: "#ef4444" }]}
      >
        <MaterialIcons name="delete-sweep" size={22} color="#ef4444" />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[styles.dangerBtnTitle, { color: "#ef4444" }]}>
            {isAr ? "تصفير جميع بيانات ممثل المجلس" : "Clear All Board Data"}
          </Text>
          <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>
            {isAr ? "حذف جميع البيانات والمؤشرات نهائياً" : "Permanently delete all data and KPIs"}
          </Text>
        </View>
      </TouchableOpacity>

      <View style={{ height: 16 }} />

      <Text style={[styles.sectionDesc, { color: colors.muted }]}>
        {isAr ? "إعادة تعيين مراحل الإنتاج" : "Reset production stages"}
      </Text>

      <TouchableOpacity
        onPress={handleResetStages}
        style={[styles.dangerBtn, { borderColor: "#f59e0b" }]}
      >
        <MaterialIcons name="restart-alt" size={22} color="#f59e0b" />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[styles.dangerBtnTitle, { color: "#f59e0b" }]}>
            {isAr ? "إعادة تعيين المراحل والموظفين" : "Reset Stages & Workers"}
          </Text>
          <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>
            {isAr ? "إرجاع الأسماء للوضع الافتراضي" : "Restore default worker names"}
          </Text>
        </View>
      </TouchableOpacity>
    </View>
  );

  // ===== RENDER: SETTINGS =====
  const renderSettingsSection = () => (
    <View style={{ gap: 12 }}>
      <Text style={[styles.sectionDesc, { color: colors.muted }]}>
        {isAr ? "إعدادات التطبيق والنظام" : "App and system settings"}
      </Text>

      <TouchableOpacity
        onPress={() => router.push("/users-management" as any)}
        style={[styles.settingsItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
      >
        <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: "#f59e0b15", justifyContent: "center", alignItems: "center" }}>
          <MaterialIcons name="people" size={20} color="#f59e0b" />
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={{ fontSize: 14, fontWeight: "600", color: colors.foreground }}>
            {t("users_management")}
          </Text>
          <Text style={{ fontSize: 12, color: colors.muted }}>
            {isAr ? "إضافة، تعديل، حذف المستخدمين والأدوار" : "Add, edit, delete users and roles"}
          </Text>
        </View>
        <MaterialIcons name="chevron-right" size={20} color={colors.muted} />
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => router.push("/admin-goals-kpis" as any)}
        style={[styles.settingsItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
      >
        <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: "#06b6d415", justifyContent: "center", alignItems: "center" }}>
          <MaterialIcons name="trending-up" size={20} color="#06b6d4" />
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={{ fontSize: 14, fontWeight: "600", color: colors.foreground }}>
            {isAr ? "الأهداف ومؤشرات الأداء" : "Goals & KPIs"}
          </Text>
          <Text style={{ fontSize: 12, color: colors.muted }}>
            {isAr ? "تحديد أهداف شهرية ومتابعة الإنجاز" : "Set monthly goals and track progress"}
          </Text>
        </View>
        <MaterialIcons name="chevron-right" size={20} color={colors.muted} />
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => router.push("/backup-restore" as any)}
        style={[styles.settingsItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
      >
        <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: "#14b8a615", justifyContent: "center", alignItems: "center" }}>
          <MaterialIcons name="backup" size={20} color="#14b8a6" />
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={{ fontSize: 14, fontWeight: "600", color: colors.foreground }}>
            {isAr ? "النسخ الاحتياطي" : "Backup & Restore"}
          </Text>
          <Text style={{ fontSize: 12, color: colors.muted }}>
            {isAr ? "نسخ واستعادة بيانات التطبيق" : "Backup and restore app data"}
          </Text>
        </View>
        <MaterialIcons name="chevron-right" size={20} color={colors.muted} />
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => router.push("/task-assignment-sources" as any)}
        style={[styles.settingsItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
      >
        <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: "#8b5cf615", justifyContent: "center", alignItems: "center" }}>
          <MaterialIcons name="assignment" size={20} color="#8b5cf6" />
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={{ fontSize: 14, fontWeight: "600", color: colors.foreground }}>
            {isAr ? "مصادر التكليف" : "Task Assignment Sources"}
          </Text>
          <Text style={{ fontSize: 12, color: colors.muted }}>
            {isAr ? "إدارة قائمة المشرفين ومدراء الأقسام" : "Manage supervisors and managers list"}
          </Text>
        </View>
        <MaterialIcons name="chevron-right" size={20} color={colors.muted} />
      </TouchableOpacity>
    </View>
  );

  if (isLoading) {
    return (
      <ScreenContainer>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </ScreenContainer>
    );
  }

  const TABS = [
    { id: "stages" as const, labelAr: "الموظفين", labelEn: "Workers", icon: "people" },
    { id: "permissions" as const, labelAr: "الصلاحيات", labelEn: "Permissions", icon: "security" },
    { id: "board" as const, labelAr: "تصفير", labelEn: "Reset", icon: "restart-alt" },
    { id: "settings" as const, labelAr: "الإعدادات", labelEn: "Settings", icon: "settings" },
  ];

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
          <MaterialIcons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {t("comprehensive_panel")}
        </Text>
        <View style={{ width: 32 }} />
      </View>

      {/* Tabs */}
      <View style={[styles.tabsRow, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            onPress={() => setActiveSection(tab.id)}
            style={[
              styles.tabItem,
              activeSection === tab.id && { borderBottomColor: colors.primary, borderBottomWidth: 3 },
            ]}
          >
            <MaterialIcons
              name={tab.icon as any}
              size={16}
              color={activeSection === tab.id ? colors.primary : colors.muted}
            />
            <Text style={[styles.tabLabel, { color: activeSection === tab.id ? colors.primary : colors.muted }]}>
              {isAr ? tab.labelAr : tab.labelEn}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {activeSection === "stages" && renderStagesSection()}
        {activeSection === "permissions" && renderPermissionsSection()}
        {activeSection === "board" && renderBoardSection()}
        {activeSection === "settings" && renderSettingsSection()}
      </ScrollView>

      {/* Worker Modal */}
      <Modal visible={showWorkerModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              {editingWorker ? (t("edit_worker")) : (t("add_worker"))}
            </Text>
            {selectedStage && (
              <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 16 }}>
                {isAr ? selectedStage.label : selectedStage.labelEn}
              </Text>
            )}

            <Text style={[styles.inputLabel, { color: colors.foreground }]}>
              {isAr ? "الاسم *" : "Name *"}
            </Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
              value={workerName}
              onChangeText={setWorkerName}
              placeholder={isAr ? "أدخل الاسم" : "Enter name"}
              placeholderTextColor={colors.muted}
            />

            <Text style={[styles.inputLabel, { color: colors.foreground, marginTop: 12 }]}>
              {isAr ? "الاسم بالإنجليزي (اختياري)" : "English name (optional)"}
            </Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
              value={workerNameEn}
              onChangeText={setWorkerNameEn}
              placeholder={t("optional")}
              placeholderTextColor={colors.muted}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={handleSaveWorker} style={[styles.modalBtn, { backgroundColor: colors.primary }]}>
                <Text style={{ color: "#fff", fontWeight: "600" }}>{t("save")}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowWorkerModal(false)} style={[styles.modalBtn, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]}>
                <Text style={{ color: colors.foreground, fontWeight: "600" }}>{t("cancel")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  tabsRow: { flexDirection: "row", borderBottomWidth: 1 },
  tabItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 11,
    gap: 4,
    borderBottomWidth: 3,
    borderBottomColor: "transparent",
  },
  tabLabel: { fontSize: 11, fontWeight: "600" },
  sectionDesc: { fontSize: 13, marginBottom: 6 },
  stageCard: { borderRadius: 12, padding: 14, borderWidth: 1 },
  stageHeader: { flexDirection: "row", alignItems: "center" },
  stageIcon: { width: 36, height: 36, borderRadius: 9, justifyContent: "center", alignItems: "center" },
  stageTitle: { fontSize: 15, fontWeight: "bold" },
  addWorkerBtn: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  workerRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  workerName: { fontSize: 14, fontWeight: "500" },
  workerActions: { flexDirection: "row", gap: 4 },
  workerActionBtn: { padding: 5, borderRadius: 6 },
  permissionRow: { flexDirection: "row", alignItems: "center", padding: 10, borderRadius: 10, borderWidth: 1 },
  saveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 12, borderRadius: 10, marginTop: 8 },
  dangerBtn: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 12, borderWidth: 1.5 },
  dangerBtnTitle: { fontSize: 14, fontWeight: "bold" },
  infoCard: { flexDirection: "row", alignItems: "center", padding: 12, borderRadius: 10, borderWidth: 1 },
  settingsItem: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 12, borderWidth: 1 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 24 },
  modalContent: { borderRadius: 16, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: "bold", marginBottom: 4 },
  inputLabel: { fontSize: 13, fontWeight: "600", marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  modalButtons: { flexDirection: "row", gap: 10, marginTop: 20 },
  modalBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: "center" },
});
