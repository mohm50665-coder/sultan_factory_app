import React, { useState, useEffect, useCallback } from "react";
import { BackButton } from "@/components/back-button";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  StyleSheet,
  TextInput,
  Modal,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/lib/auth-context";
import { MaterialIcons } from "@expo/vector-icons";
import { adminService } from "@/lib/services/api.service";
import type { User } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";

const ROLES_AR = [
  { value: "admin", label: "مدير النظام" },
  { value: "manager", label: "مدير إدارة" },
  { value: "supervisor", label: "مشرف" },
  { value: "user", label: "موظف" },
];

const ROLES_EN = [
  { value: "admin", label: "System Admin" },
  { value: "manager", label: "Manager" },
  { value: "supervisor", label: "Supervisor" },
  { value: "user", label: "Employee" },
];

const ALL_SECTIONS_AR = [
  { id: "production", label: "الإنتاج" },
  { id: "manufacturing", label: "مراحل تسليم الإنتاج" },
  { id: "sales", label: "المبيعات والتحصيل" },
  { id: "warehouse", label: "المستودعات" },
  { id: "maintenance", label: "الصيانة" },
  { id: "financial", label: "المصروفات" },
  { id: "administrative", label: "الإجراءات الإدارية" },
  { id: "tasks", label: "المهام" },
];

const ALL_SECTIONS_EN = [
  { id: "production", label: "Production" },
  { id: "manufacturing", label: "Manufacturing Delivery Stages" },
  { id: "sales", label: "Sales and Collection" },
  { id: "warehouse", label: "Warehouses" },
  { id: "maintenance", label: "Maintenance" },
  { id: "financial", label: "Expenses" },
  { id: "administrative", label: "Administrative Procedures" },
  { id: "tasks", label: "Tasks" },
];

// الأدوات الإضافية
const EXTRA_TOOLS_AR = [
  { id: "reports", label: "التقارير" },
  { id: "notifications_center", label: "مركز الإشعارات" },
  { id: "export_data", label: "تصدير البيانات" },
  { id: "activity_log", label: "سجل النشاط" },
  { id: "production_export", label: "تصدير الإنتاج" },
  { id: "waste_alerts", label: "تنبيهات الهدر" },
  { id: "reports_analytics", label: "تحليلات التقارير" },
  { id: "section_reports", label: "تقارير الأقسام" },
  { id: "users_management", label: "إدارة المستخدمين" },
  { id: "employee_performance", label: "أداء الموظفين" },
  { id: "backup_restore", label: "النسخ الاحتياطي" },
  { id: "machines_comparison", label: "مقارنة المكائن" },
  { id: "share_reports", label: "مشاركة التقارير" },
];

const EXTRA_TOOLS_EN = [
  { id: "reports", label: "Reports" },
  { id: "notifications_center", label: "Notifications Center" },
  { id: "export_data", label: "Export Data" },
  { id: "activity_log", label: "Activity Log" },
  { id: "production_export", label: "Production Export" },
  { id: "waste_alerts", label: "Waste Alerts" },
  { id: "reports_analytics", label: "Reports Analytics" },
  { id: "section_reports", label: "Section Reports" },
  { id: "users_management", label: "Users Management" },
  { id: "employee_performance", label: "Employee Performance" },
  { id: "backup_restore", label: "Backup & Restore" },
  { id: "machines_comparison", label: "Machines Comparison" },
  { id: "share_reports", label: "Share Reports" },
];

export default function UsersManagementScreen() {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const router = useRouter();
  const colors = useColors();
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editRole, setEditRole] = useState("");
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetUserId, setResetUserId] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showSectionsModal, setShowSectionsModal] = useState(false);
  const [sectionsUser, setSectionsUser] = useState<User | null>(null);
  const [selectedSections, setSelectedSections] = useState<string[]>([]);
  const [editPosition, setEditPosition] = useState("");
  const [showToolsModal, setShowToolsModal] = useState(false);
  const [toolsUser, setToolsUser] = useState<User | null>(null);
  const [selectedTools, setSelectedTools] = useState<Record<string, boolean>>({});

  const loadUsers = useCallback(async () => {
    const allUsers = await adminService.getAllUsers();
    setUsers(allUsers);
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleToggleActive = async (userId: number) => {
    if (userId === currentUser?.id) {
      Alert.alert(isAr ? "تنبيه" : "Alert", isAr ? "لا يمكنك تعطيل حسابك الخاص" : "You cannot disable your own account");
      return;
    }
    await adminService.toggleUserActive(userId);
    loadUsers();
  };

  const handleChangeRole = (user: any) => {
    if (user.id === currentUser?.id) {
      Alert.alert(isAr ? "تنبيه" : "Alert", isAr ? "لا يمكنك تغيير صلاحيتك الخاصة" : "You cannot change your own role");
      return;
    }
    setEditingUser(user);
    setEditRole(user.role);
    setEditPosition(user.position || "");
    setShowEditModal(true);
  };

  const handleSaveRole = async () => {
    if (!editingUser) return;
    try {
      await adminService.changeUserRole(editingUser.id, editRole as any);
      // Also save position if changed
      if (editPosition !== (editingUser.position || "")) {
        await adminService.updatePosition(editingUser.id, editPosition);
      }
      setShowEditModal(false);
      setEditingUser(null);
      loadUsers();
      Alert.alert(isAr ? "نجاح" : "Success", isAr ? "تم حفظ التغييرات بنجاح" : "Changes saved successfully");
    } catch (e) {
      Alert.alert(isAr ? "خطأ" : "Error", isAr ? "حدث خطأ أثناء الحفظ" : "An error occurred while saving");
    }
  };

  const handleDeleteUser = (userId: number, userName: string) => {
    if (userId === currentUser?.id) {
      Alert.alert(isAr ? "تنبيه" : "Alert", isAr ? "لا يمكنك حذف حسابك الخاص" : "You cannot delete your own account");
      return;
    }
    Alert.alert(
      isAr ? "تأكيد الحذف" : "Confirm Deletion",
      isAr ? `هل أنت متأكد من حذف المستخدم "${userName}"؟` : `Are you sure you want to delete user "${userName}"?`,
      [
        { text: isAr ? "إلغاء" : "Cancel" },
        {
          text: isAr ? "حذف" : "Delete",
          style: "destructive",
          onPress: async () => {
            await adminService.deleteUser(userId);
            loadUsers();
          },
        },
      ]
    );
  };

  const handleResetPassword = (userId: number) => {
    setResetUserId(userId.toString());
    setNewPassword("");
    setShowResetModal(true);
  };

  const handleSaveResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      Alert.alert(isAr ? "خطأ" : "Error", isAr ? "كلمة المرور يجب أن تكون 6 أحرف على الأقل" : "Password must be at least 6 characters");
      return;
    }
    await adminService.resetUserPassword(parseInt(resetUserId), newPassword);
    setShowResetModal(false);
    Alert.alert(isAr ? "نجاح" : "Success", isAr ? "تم إعادة تعيين كلمة المرور بنجاح" : "Password reset successfully");
  };

  const getRoleLabel = (role: string) => {
    const ROLES = isAr ? ROLES_AR : ROLES_EN;
    return ROLES.find((r) => r.value === role)?.label || role;
  };

  const handleManageSections = (u: User) => {
    setSectionsUser(u);
    setSelectedSections(u.allowedSections || []);
    setShowSectionsModal(true);
  };

  const toggleSection = (sectionId: string) => {
    setSelectedSections((prev) =>
      prev.includes(sectionId)
        ? prev.filter((s) => s !== sectionId)
        : [...prev, sectionId]
    );
  };

  const handleSaveSections = async () => {
    if (!sectionsUser) return;
    await adminService.updateAllowedSections(sectionsUser.id, selectedSections);
    setShowSectionsModal(false);
    setSectionsUser(null);
    loadUsers();
    Alert.alert(isAr ? "نجاح" : "Success", isAr ? "تم تحديث الصلاحيات بنجاح" : "Permissions updated successfully");
  };

  const handleManageTools = (u: User) => {
    setToolsUser(u);
    const currentPerms: Record<string, boolean> = {};
    EXTRA_TOOLS_AR.forEach((t) => {
      currentPerms[t.id] = (u as any).toolPermissions?.[t.id] ?? true;
    });
    setSelectedTools(currentPerms);
    setShowToolsModal(true);
  };

  const toggleTool = (toolId: string) => {
    setSelectedTools((prev) => ({ ...prev, [toolId]: !prev[toolId] }));
  };

  const handleSaveTools = async () => {
    if (!toolsUser) return;
    try {
      await adminService.updateToolPermissions(toolsUser.id, selectedTools);
      setShowToolsModal(false);
      setToolsUser(null);
      loadUsers();
      Alert.alert(isAr ? "نجاح" : "Success", isAr ? "تم تحديث صلاحيات الأدوات" : "Tool permissions updated");
    } catch (e) {
      Alert.alert(isAr ? "خطأ" : "Error", isAr ? "فشل حفظ الصلاحيات" : "Failed to save permissions");
    }
  };

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={styles.header}>
        <BackButton />
        <Text style={styles.headerTitle}>{isAr ? "إدارة المستخدمين" : "Users Management"}</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: "#e0f2fe" }]}>
          <Text style={[styles.statNumber, { color: "#0369a1" }]}>{users.length}</Text>
          <Text style={styles.statLabel}>{isAr ? "إجمالي" : "Total"}</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: "#dcfce7" }]}>
          <Text style={[styles.statNumber, { color: "#15803d" }]}>
            {users.filter((u) => u.isActive).length}
          </Text>
          <Text style={styles.statLabel}>{isAr ? "نشط" : "Active"}</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: "#fee2e2" }]}>
          <Text style={[styles.statNumber, { color: "#b91c1c" }]}>
            {users.filter((u) => !u.isActive).length}
          </Text>
          <Text style={styles.statLabel}>{isAr ? "معطل" : "Disabled"}</Text>
        </View>
      </View>

      {/* Users List */}
      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        {users.map((u) => (
          <View key={u.id} style={[styles.userCard, !u.isActive && styles.userCardInactive]}>
            <View style={styles.userInfo}>
              <View style={styles.userHeader}>
                <View style={[styles.statusDot, { backgroundColor: u.isActive ? "#22c55e" : "#ef4444" }]} />
                <Text style={styles.userName}>{u.name}</Text>
              </View>
              <Text style={[styles.userDetail, { textAlign: isAr ? "right" : "left" }]}>@{u.username}</Text>
              <Text style={[styles.userDetail, { textAlign: isAr ? "right" : "left" }]}>{u.position} | {getRoleLabel(u.role)}</Text>
              <Text style={[styles.userDetail, { textAlign: isAr ? "right" : "left" }]}>{u.phone}</Text>
            </View>

            <View style={styles.actions}>
              {/* تغيير الصلاحية */}
              <TouchableOpacity
                onPress={() => handleChangeRole(u)}
                style={[styles.actionBtn, { backgroundColor: "#e0f2fe" }]}
              >
                <MaterialIcons name="admin-panel-settings" size={18} color="#0369a1" />
              </TouchableOpacity>

              {/* تحديد الأقسام */}
              <TouchableOpacity
                onPress={() => handleManageSections(u)}
                style={[styles.actionBtn, { backgroundColor: "#f0fdf4" }]}
              >
                <MaterialIcons name="apps" size={18} color="#16a34a" />
              </TouchableOpacity>

              {/* صلاحيات الأدوات الإضافية */}
              <TouchableOpacity
                onPress={() => handleManageTools(u)}
                style={[styles.actionBtn, { backgroundColor: "#ede9fe" }]}
              >
                <MaterialIcons name="build" size={18} color="#7c3aed" />
              </TouchableOpacity>

              {/* تفعيل/تعطيل */}
              <TouchableOpacity
                onPress={() => handleToggleActive(u.id)}
                style={[styles.actionBtn, { backgroundColor: u.isActive ? "#fee2e2" : "#dcfce7" }]}
              >
                <MaterialIcons
                  name={u.isActive ? "block" : "check-circle"}
                  size={18}
                  color={u.isActive ? "#b91c1c" : "#15803d"}
                />
              </TouchableOpacity>

              {/* إعادة تعيين كلمة المرور */}
              <TouchableOpacity
                onPress={() => handleResetPassword(u.id)}
                style={[styles.actionBtn, { backgroundColor: "#fef3c7" }]}
              >
                <MaterialIcons name="lock-reset" size={18} color="#92400e" />
              </TouchableOpacity>

              {/* حذف */}
              <TouchableOpacity
                onPress={() => handleDeleteUser(u.id, u.name)}
                style={[styles.actionBtn, { backgroundColor: "#fee2e2" }]}
              >
                <MaterialIcons name="delete" size={18} color="#b91c1c" />
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Modal تغيير الصلاحية */}
      <Modal visible={showEditModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{isAr ? "تغيير صلاحية ومنصب: " : "Change Role and Position: "}{editingUser?.name}</Text>
            <TextInput
              style={[styles.modalInput, { marginBottom: 12, textAlign: isAr ? "right" : "left" }]}
              placeholder={isAr ? "المنصب (مثل: مشرف إنتاج)" : "Position (e.g., Production Supervisor)"}
              value={editPosition}
              onChangeText={setEditPosition}
            />
            <Text style={{ fontSize: 13, fontWeight: '600', marginBottom: 8, color: '#374151', textAlign: isAr ? "right" : "left" }}>{isAr ? "الصلاحية:" : "Role:"}</Text>
            <View style={styles.rolesContainer}>
              {(isAr ? ROLES_AR : ROLES_EN).map((role) => (
                <TouchableOpacity
                  key={role.value}
                  onPress={() => setEditRole(role.value)}
                  style={[
                    styles.roleOption,
                    editRole === role.value && styles.roleOptionActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.roleOptionText,
                      editRole === role.value && styles.roleOptionTextActive,
                    ]}
                  >
                    {role.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => setShowEditModal(false)}
                style={styles.cancelBtn}
              >
                <Text style={styles.cancelBtnText}>{isAr ? "إلغاء" : "Cancel"}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSaveRole} style={styles.saveBtn}>
                <Text style={styles.saveBtnText}>{isAr ? "حفظ" : "Save"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal إعادة تعيين كلمة المرور */}
      <Modal visible={showResetModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{isAr ? "إعادة تعيين كلمة المرور" : "Reset Password"}</Text>
            <TextInput
              style={[styles.modalInput, { textAlign: isAr ? "right" : "left" }]}
              placeholder={isAr ? "كلمة المرور الجديدة (6 أحرف على الأقل)" : "New Password (at least 6 characters)"}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => setShowResetModal(false)}
                style={styles.cancelBtn}
              >
                <Text style={styles.cancelBtnText}>{isAr ? "إلغاء" : "Cancel"}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSaveResetPassword} style={styles.saveBtn}>
                <Text style={styles.saveBtnText}>{isAr ? "حفظ" : "Save"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal تحديد الأيقونات المسموحة */}
      <Modal visible={showSectionsModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: "80%" }]}>
            <Text style={styles.modalTitle}>{isAr ? "تحديد الأيقونات المسموحة: " : "Select Allowed Icons: "}{sectionsUser?.name}</Text>
            <Text style={{ fontSize: 12, color: "#687076", textAlign: "center", marginBottom: 12 }}>
              {isAr ? "اختر الأقسام التي يمكن للمستخدم الوصول إليها. إذا لم تختر شيئاً سيتم استخدام الصلاحيات الافتراضية حسب القسم." : "Select the sections the user can access. If nothing is selected, default permissions based on the section will be used."}
            </Text>
            <ScrollView style={{ maxHeight: 300 }}>
              {(isAr ? ALL_SECTIONS_AR : ALL_SECTIONS_EN).map((section) => (
                <TouchableOpacity
                  key={section.id}
                  onPress={() => toggleSection(section.id)}
                  style={[
                    styles.roleOption,
                    { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
                    selectedSections.includes(section.id) && styles.roleOptionActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.roleOptionText,
                      { textAlign: isAr ? "right" : "left", flex: 1 },
                      selectedSections.includes(section.id) && styles.roleOptionTextActive,
                    ]}
                  >
                    {section.label}
                  </Text>
                  <MaterialIcons
                    name={selectedSections.includes(section.id) ? "check-box" : "check-box-outline-blank"}
                    size={22}
                    color={selectedSections.includes(section.id) ? "#0a7ea4" : "#9ca3af"}
                  />
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={[styles.modalActions, { marginTop: 16 }]}>
              <TouchableOpacity
                onPress={() => setShowSectionsModal(false)}
                style={styles.cancelBtn}
              >
                <Text style={styles.cancelBtnText}>{isAr ? "إلغاء" : "Cancel"}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSaveSections} style={styles.saveBtn}>
                <Text style={styles.saveBtnText}>{isAr ? "حفظ" : "Save"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal صلاحيات الأدوات الإضافية */}
      <Modal visible={showToolsModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: "80%" }]}>
            <Text style={styles.modalTitle}>{isAr ? "صلاحيات الأدوات الإضافية: " : "Extra Tools Permissions: "}{toolsUser?.name}</Text>
            <Text style={{ fontSize: 12, color: "#687076", textAlign: "center", marginBottom: 12 }}>
              {isAr ? "اختر الأدوات الإضافية التي يمكن للمستخدم الوصول إليها" : "Select extra tools the user can access"}
            </Text>
            <ScrollView style={{ maxHeight: 350 }}>
              {(isAr ? EXTRA_TOOLS_AR : EXTRA_TOOLS_EN).map((tool) => (
                <TouchableOpacity
                  key={tool.id}
                  onPress={() => toggleTool(tool.id)}
                  style={[
                    styles.roleOption,
                    { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
                    selectedTools[tool.id] && styles.roleOptionActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.roleOptionText,
                      { textAlign: isAr ? "right" : "left", flex: 1 },
                      selectedTools[tool.id] && styles.roleOptionTextActive,
                    ]}
                  >
                    {tool.label}
                  </Text>
                  <MaterialIcons
                    name={selectedTools[tool.id] ? "check-box" : "check-box-outline-blank"}
                    size={22}
                    color={selectedTools[tool.id] ? "#7c3aed" : "#9ca3af"}
                  />
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={[styles.modalActions, { marginTop: 16 }]}>
              <TouchableOpacity
                onPress={() => setShowToolsModal(false)}
                style={styles.cancelBtn}
              >
                <Text style={styles.cancelBtnText}>{isAr ? "إلغاء" : "Cancel"}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSaveTools} style={styles.saveBtn}>
                <Text style={styles.saveBtnText}>{isAr ? "حفظ" : "Save"}</Text>
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
    backgroundColor: "#0a7ea4",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  statCard: {
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  statNumber: {
    fontSize: 22,
    fontWeight: "bold",
  },
  statLabel: {
    fontSize: 11,
    color: "#687076",
    marginTop: 2,
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: 16,
  },
  userCard: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  userCardInactive: {
    opacity: 0.6,
    backgroundColor: "#f9fafb",
  },
  userInfo: {
    flex: 1,
  },
  userHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  userName: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#11181C",
  },
  userDetail: {
    fontSize: 12,
    color: "#687076",
    marginTop: 2,
  },
  actions: {
    flexDirection: "column",
    gap: 6,
  },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 24,
    width: "85%",
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#11181C",
    textAlign: "center",
    marginBottom: 16,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    marginBottom: 16,
  },
  rolesContainer: {
    gap: 8,
    marginBottom: 16,
  },
  roleOption: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  roleOptionActive: {
    borderColor: "#0a7ea4",
    backgroundColor: "#e0f7fa",
  },
  roleOptionText: {
    fontSize: 14,
    color: "#687076",
    textAlign: "center",
  },
  roleOptionTextActive: {
    color: "#0a7ea4",
    fontWeight: "bold",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    paddingVertical: 12,
  },
  cancelBtnText: {
    textAlign: "center",
    color: "#687076",
    fontWeight: "600",
  },
  saveBtn: {
    flex: 1,
    backgroundColor: "#0a7ea4",
    borderRadius: 10,
    paddingVertical: 12,
  },
  saveBtnText: {
    textAlign: "center",
    color: "white",
    fontWeight: "600",
  },
});
