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
import { DEPARTMENT_IDS, DEPARTMENT_OPTIONS } from "@/lib/constants/departments";

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
  { id: "sales", label: "إدارة التسويق والمبيعات" },
  { id: "representative_performance", label: "أداء المندوب" },
  { id: "daily_sales_collection_report", label: "التقرير اليومي للمبيعات والتحصيل" },
  { id: "representative_evaluation", label: "تقييم أداء المندوب" },
  { id: "sales_approvals_requests", label: "الاعتمادات والطلبات" },
  { id: "representative_comprehensive_report", label: "تقرير أداء المندوب الشامل" },
  { id: "warehouse", label: "المستودعات" },
  { id: "maintenance", label: "الصيانة" },
  { id: "tasks", label: "المهام" },
  { id: "employee_performance", label: "تقييم أداء الموظفين" },
  { id: "server_notifications", label: "الإشعارات الفورية" },
];

const ALL_SECTIONS_EN = [
  { id: "production", label: "Production" },
  { id: "manufacturing", label: "Manufacturing Delivery Stages" },
  { id: "sales", label: "Marketing & Sales Management" },
  { id: "representative_performance", label: "Representative Performance" },
  { id: "daily_sales_collection_report", label: "Daily Sales & Collection Report" },
  { id: "representative_evaluation", label: "Representative Evaluation" },
  { id: "sales_approvals_requests", label: "Approvals & Requests" },
  { id: "representative_comprehensive_report", label: "Comprehensive Representative Report" },
  { id: "warehouse", label: "Warehouses" },
  { id: "maintenance", label: "Maintenance" },
  { id: "tasks", label: "Tasks" },
  { id: "employee_performance", label: "Employee Performance" },
  { id: "server_notifications", label: "Instant Notifications" },
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
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameUser, setRenameUser] = useState<User | null>(null);
  const [renameUsername, setRenameUsername] = useState("");
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [profileName, setProfileName] = useState("");
  const [profileUsername, setProfileUsername] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [profilePosition, setProfilePosition] = useState("");
  const [profileDepartment, setProfileDepartment] = useState("");
  const [profileRole, setProfileRole] = useState<User["role"]>("user");
  const [showProfileDepartmentPicker, setShowProfileDepartmentPicker] = useState(false);

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

  const handleEditProfile = (u: User) => {
    setProfileUser(u);
    setProfileName(u.name || "");
    setProfileUsername(u.username || "");
    setProfileEmail(u.email || "");
    setProfilePhone(u.phone || "");
    setProfilePosition(u.position || "");
    setProfileDepartment(u.department || "");
    setProfileRole(u.role);
    setShowProfileModal(true);
  };

  const handleSaveProfile = async () => {
    if (!profileUser || !profileName.trim() || !profileUsername.trim() || !profileEmail.trim()) {
      Alert.alert(isAr ? "بيانات ناقصة" : "Missing data", isAr ? "الاسم واسم المستخدم والبريد الإلكتروني حقول مطلوبة" : "Name, username and email are required");
      return;
    }
    if (!DEPARTMENT_IDS.has(profileDepartment)) {
      Alert.alert(isAr ? "القسم مطلوب" : "Department required", isAr ? "اختر القسم من القائمة المعتمدة، ولا تكتب قيمة يدوية." : "Select a department from the approved list; manual values are not allowed.");
      return;
    }
    try {
      await adminService.updateUserProfile({
        userId: profileUser.id,
        name: profileName.trim(),
        username: profileUsername.trim(),
        email: profileEmail.trim(),
        phone: profilePhone.trim(),
        position: profilePosition.trim(),
        department: profileDepartment.trim(),
        role: profileRole,
      });
      setShowProfileModal(false);
      setProfileUser(null);
      await loadUsers();
      Alert.alert(isAr ? "نجاح" : "Success", isAr ? "تم تحديث بيانات الموظف والقسم بنجاح" : "Employee data and department updated successfully");
    } catch (e: any) {
      Alert.alert(isAr ? "تعذر الحفظ" : "Save failed", e?.message || (isAr ? "حدث خطأ أثناء حفظ بيانات الموظف" : "Could not save employee data"));
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
            try {
              await adminService.deleteUser(userId);
              await loadUsers();
              Alert.alert(isAr ? "تم الحذف" : "Deleted", isAr ? "تم حذف المستخدم بنجاح" : "User deleted successfully");
            } catch (error) {
              const message = error instanceof Error ? error.message : (isAr ? "تعذر حذف المستخدم" : "Could not delete user");
              Alert.alert(isAr ? "تعذر الحذف" : "Delete failed", message);
            }
          },
        },
      ]
    );
  };

  const duplicateUsernames = users.filter((u, index, list) => list.findIndex((item) => item.username.trim().toLowerCase() === u.username.trim().toLowerCase()) !== index);

  const handleRenameUser = (u: User) => {
    setRenameUser(u);
    setRenameUsername(u.username.trim());
    setShowRenameModal(true);
  };

  const handleSaveRename = async () => {
    if (!renameUser || !renameUsername.trim()) return;
    try {
      await adminService.renameUser(renameUser.id, renameUsername);
      setShowRenameModal(false);
      setRenameUser(null);
      await loadUsers();
      Alert.alert(isAr ? "نجاح" : "Success", isAr ? "تم تحديث اسم المستخدم" : "Username updated");
    } catch (e: any) {
      Alert.alert(isAr ? "خطأ" : "Error", e?.message || (isAr ? "تعذر تحديث اسم المستخدم" : "Could not update username"));
    }
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

  const getDepartmentLabel = (department: string) => {
    const option = DEPARTMENT_OPTIONS.find((item) => item.id === department);
    return option ? (isAr ? option.labelAr : option.labelEn) : (isAr ? "اختر القسم" : "Select Department");
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

  const toggleAllSections = () => {
    const allIds = (isAr ? ALL_SECTIONS_AR : ALL_SECTIONS_EN).map((section) => section.id);
    setSelectedSections((prev) => prev.length === allIds.length ? [] : allIds);
  };

  const handleSaveSections = async () => {
    if (!sectionsUser) return;
    await adminService.updateAllowedSections(sectionsUser.id, selectedSections);
    setShowSectionsModal(false);
    setSectionsUser(null);
    loadUsers();
    Alert.alert(isAr ? "نجاح" : "Success", isAr ? "تم تحديث الصلاحيات بنجاح" : "Permissions updated successfully");
  };

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={styles.header}>
        <BackButton />
        <Text style={styles.headerTitle}>{isAr ? "إدارة المستخدمين" : "Users Management"}</Text>
        {currentUser?.role === "admin" ? (
          <TouchableOpacity
            onPress={() => router.push("/register" as any)}
            style={styles.addUserHeaderBtn}
            accessibilityLabel={isAr ? "إضافة مستخدم جديد" : "Add new user"}
          >
            <MaterialIcons name="person-add" size={20} color="#fff" />
            <Text style={styles.addUserHeaderText}>{isAr ? "إضافة مستخدم" : "Add user"}</Text>
          </TouchableOpacity>
        ) : <View style={{ width: 40 }} />}
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

      {currentUser?.role === "admin" && duplicateUsernames.length > 0 && (
        <View style={[styles.duplicateNotice, { backgroundColor: "#fff7ed", borderColor: "#fb923c" }]}>
          <Text style={styles.duplicateTitle}>{isAr ? "تنبيه: توجد أسماء مستخدمين مكررة" : "Warning: duplicate usernames found"}</Text>
          <Text style={styles.duplicateText}>{isAr ? "أعد تسمية الحسابات غير الأساسية لتجنب رفض كلمة المرور أو الدخول إلى الحساب الخطأ." : "Rename non-primary accounts to avoid password conflicts."}</Text>
        </View>
      )}

      {/* Users List */}
      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        {users.map((u) => (
          <View key={u.id} style={[styles.userCard, !u.isActive && styles.userCardInactive]}>
            <View style={styles.userInfo}>
              <View style={styles.userHeader}>
                <View style={[styles.statusDot, { backgroundColor: u.isActive ? "#22c55e" : "#ef4444" }]} />
                <Text style={styles.userName}>{u.name}</Text>
              <Text style={[styles.registrationDate, { textAlign: isAr ? "right" : "left" }]}>
                {isAr ? "تاريخ التسجيل: " : "Registered: "}{u.createdAt ? new Date(u.createdAt).toLocaleDateString(isAr ? "ar-SA" : "en-US") : "-"}
              </Text>
              </View>
              <Text style={[styles.userDetail, { textAlign: isAr ? "right" : "left", fontWeight: "700", color: "#0369a1" }]}>{isAr ? "اسم المستخدم: " : "Username: "}{u.username}</Text>
              <Text style={[styles.userDetail, { textAlign: isAr ? "right" : "left" }]}>{u.position} | {getRoleLabel(u.role)}</Text>
              <Text style={[styles.userDetail, { textAlign: isAr ? "right" : "left" }]}>{u.phone}</Text>
            </View>

            <View style={styles.actions}>
              {/* تعديل بيانات التسجيل والقسم */}
              <TouchableOpacity
                onPress={() => handleEditProfile(u)}
                style={[styles.actionBtn, { backgroundColor: "#ede9fe" }]}
                accessibilityLabel={isAr ? "تعديل بيانات الموظف والقسم" : "Edit employee data and department"}
              >
                <MaterialIcons name="edit" size={18} color="#6d28d9" />
              </TouchableOpacity>

              {/* تغيير الصلاحية */}
              <TouchableOpacity
                onPress={() => handleChangeRole(u)}
                style={[styles.actionBtn, { backgroundColor: "#e0f2fe" }]}
              >
                <MaterialIcons name="admin-panel-settings" size={18} color="#0369a1" />
              </TouchableOpacity>

              {/* تحديد الأيقونات/الصلاحيات */}
              <TouchableOpacity
                onPress={() => handleManageSections(u)}
                style={[styles.actionBtn, { backgroundColor: "#f0fdf4" }]}
              >
                <MaterialIcons name="apps" size={18} color="#16a34a" />
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

              {users.filter((item) => item.username.trim().toLowerCase() === u.username.trim().toLowerCase()).length > 1 && currentUser?.role === "admin" && (
                <TouchableOpacity onPress={() => handleRenameUser(u)} style={[styles.actionBtn, { backgroundColor: "#ffedd5" }]}>
                  <MaterialIcons name="drive-file-rename-outline" size={18} color="#c2410c" />
                </TouchableOpacity>
              )}

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

      {/* Modal تعديل بيانات التسجيل والقسم */}
      <Modal visible={showProfileModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: "88%" }]}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>{isAr ? "تعديل بيانات الموظف" : "Edit Employee Data"}</Text>
              <Text style={styles.modalHint}>{isAr ? "الأدمن فقط يستطيع تعديل هذه البيانات. الاسم واسم المستخدم والبريد الإلكتروني حقول مطلوبة." : "Only admins can edit these fields. Name, username and email are required."}</Text>
              <TextInput style={styles.modalInput} placeholder={isAr ? "الاسم الكامل *" : "Full name *"} value={profileName} onChangeText={setProfileName} textAlign={isAr ? "right" : "left"} />
              <TextInput style={styles.modalInput} placeholder={isAr ? "اسم المستخدم *" : "Username *"} value={profileUsername} onChangeText={setProfileUsername} autoCapitalize="none" textAlign={isAr ? "right" : "left"} />
              <TextInput style={styles.modalInput} placeholder={isAr ? "البريد الإلكتروني *" : "Email *"} value={profileEmail} onChangeText={setProfileEmail} keyboardType="email-address" autoCapitalize="none" textAlign={isAr ? "right" : "left"} />
              <TextInput style={styles.modalInput} placeholder={isAr ? "رقم الجوال" : "Phone"} value={profilePhone} onChangeText={setProfilePhone} keyboardType="phone-pad" textAlign={isAr ? "right" : "left"} />
              <TextInput style={styles.modalInput} placeholder={isAr ? "المسمى الوظيفي" : "Position"} value={profilePosition} onChangeText={setProfilePosition} textAlign={isAr ? "right" : "left"} />
              <Text style={styles.modalLabel}>{isAr ? "القسم *" : "Department *"}</Text>
              <TouchableOpacity
                onPress={() => setShowProfileDepartmentPicker(true)}
                style={styles.departmentPicker}
                accessibilityLabel={isAr ? "اختيار القسم" : "Select department"}
              >
                <MaterialIcons name="arrow-drop-down" size={22} color="#64748b" />
                <Text style={[styles.departmentPickerText, !profileDepartment && { color: "#94a3b8" }]}>
                  {getDepartmentLabel(profileDepartment)}
                </Text>
                <MaterialIcons name="business" size={18} color="#64748b" />
              </TouchableOpacity>
              <Text style={styles.modalLabel}>{isAr ? "الصلاحية" : "Role"}</Text>
              <View style={styles.rolesContainer}>
                {(isAr ? ROLES_AR : ROLES_EN).map((role) => (
                  <TouchableOpacity key={role.value} onPress={() => setProfileRole(role.value as User["role"])} style={[styles.roleOption, profileRole === role.value && styles.roleOptionActive]}>
                    <Text style={[styles.roleOptionText, profileRole === role.value && styles.roleOptionTextActive]}>{role.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.modalActions}>
                <TouchableOpacity onPress={() => setShowProfileModal(false)} style={styles.cancelBtn}><Text style={styles.cancelBtnText}>{isAr ? "إلغاء" : "Cancel"}</Text></TouchableOpacity>
                <TouchableOpacity onPress={handleSaveProfile} style={styles.saveBtn}><Text style={styles.saveBtnText}>{isAr ? "حفظ البيانات" : "Save data"}</Text></TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* قائمة الأقسام الرسمية — لا يوجد إدخال نصي حر */}
      <Modal visible={showProfileDepartmentPicker} transparent animationType="fade" onRequestClose={() => setShowProfileDepartmentPicker(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: "80%" }]}>
            <Text style={styles.modalTitle}>{isAr ? "اختر القسم" : "Select Department"}</Text>
            <ScrollView>
              {DEPARTMENT_OPTIONS.map((department) => (
                <TouchableOpacity
                  key={department.id}
                  onPress={() => {
                    setProfileDepartment(department.id);
                    setShowProfileDepartmentPicker(false);
                  }}
                  style={[styles.departmentOption, profileDepartment === department.id && styles.departmentOptionActive]}
                >
                  <MaterialIcons name={department.icon as any} size={19} color={profileDepartment === department.id ? "#0a7ea4" : "#64748b"} />
                  <Text style={[styles.departmentOptionText, profileDepartment === department.id && styles.departmentOptionTextActive]}>
                    {isAr ? department.labelAr : department.labelEn}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity onPress={() => setShowProfileDepartmentPicker(false)} style={styles.cancelBtn}>
              <Text style={styles.cancelBtnText}>{isAr ? "إلغاء" : "Cancel"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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

      {/* Modal إعادة تسمية الحساب المتكرر */}
      <Modal visible={showRenameModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{isAr ? "إعادة تسمية حساب متكرر" : "Rename duplicate account"}</Text>
            <Text style={{ fontSize: 12, color: "#687076", textAlign: "right", marginBottom: 10 }}>{isAr ? "اكتب اسماً فريداً لهذا الحساب، ولن تتغير كلمة المرور." : "Enter a unique username. The password will not change."}</Text>
            <TextInput value={renameUsername} onChangeText={setRenameUsername} autoCapitalize="none" style={[styles.modalInput, { textAlign: isAr ? "right" : "left" }]} placeholder={isAr ? "اسم المستخدم الجديد" : "New username"} />
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setShowRenameModal(false)} style={styles.cancelBtn}><Text style={styles.cancelBtnText}>{isAr ? "إلغاء" : "Cancel"}</Text></TouchableOpacity>
              <TouchableOpacity onPress={handleSaveRename} style={styles.saveBtn}><Text style={styles.saveBtnText}>{isAr ? "حفظ" : "Save"}</Text></TouchableOpacity>
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
              {isAr ? "لا تظهر إلا القوائم المحددة صراحةً. ترك جميع الخيارات دون تحديد يعني عدم منح أي قائمة." : "Only explicitly selected menus are visible. Leaving all options clear grants no menu access."}
            </Text>
            <View style={{ flexDirection: isAr ? "row" : "row-reverse", gap: 8, marginBottom: 10 }}>
              <TouchableOpacity onPress={() => setSelectedSections((isAr ? ALL_SECTIONS_AR : ALL_SECTIONS_EN).map((section) => section.id))} style={[styles.saveBtn, { flex: 1 }]}>
                <Text style={styles.saveBtnText}>{isAr ? "تحديد الكل" : "Select all"}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setSelectedSections([])} style={[styles.cancelBtn, { flex: 1 }]}>
                <Text style={styles.cancelBtnText}>{isAr ? "إلغاء الكل" : "Clear all"}</Text>
              </TouchableOpacity>
            </View>
            <Text style={{ fontSize: 12, color: "#687076", textAlign: isAr ? "right" : "left", marginBottom: 8 }}>
              {isAr ? `${selectedSections.length} من ${(isAr ? ALL_SECTIONS_AR : ALL_SECTIONS_EN).length} قائمة محددة` : `${selectedSections.length} of ${(isAr ? ALL_SECTIONS_AR : ALL_SECTIONS_EN).length} menus selected`}
            </Text>
            <TouchableOpacity onPress={() => { setShowSectionsModal(false); router.push("/admin-tools-permissions" as any); }} style={[styles.cancelBtn, { marginBottom: 10, alignItems: "center" }]}>
              <Text style={styles.cancelBtnText}>{isAr ? "فتح صلاحيات الأدوات الإضافية" : "Open extra tools permissions"}</Text>
            </TouchableOpacity>
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
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  duplicateNotice: { marginHorizontal: 16, marginBottom: 10, padding: 12, borderRadius: 10, borderWidth: 1 },
  duplicateTitle: { color: "#9a3412", fontWeight: "800", textAlign: "right" },
  duplicateText: { color: "#c2410c", fontSize: 12, lineHeight: 18, textAlign: "right", marginTop: 4 },
  registrationDate: { color: "#64748b", fontSize: 11, marginTop: 2 },
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
  modalTitle: { fontSize: 20, fontWeight: "bold", color: "#11181C", textAlign: "center", marginBottom: 16 },
  modalHint: { fontSize: 12, color: "#64748b", textAlign: "right", lineHeight: 18, marginBottom: 12 },
  modalLabel: { fontSize: 13, fontWeight: "700", color: "#374151", textAlign: "right", marginBottom: 8 },
  addUserHeaderBtn: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#0a7ea4", borderRadius: 10, paddingHorizontal: 9, paddingVertical: 8 },
  addUserHeaderText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  modalInput: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    marginBottom: 16,
  },
  departmentPicker: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    paddingHorizontal: 12,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  departmentPickerText: {
    flex: 1,
    color: "#11181C",
    fontSize: 14,
    textAlign: "right",
    marginHorizontal: 8,
  },
  departmentOption: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 9,
    paddingHorizontal: 10,
    marginBottom: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  departmentOptionActive: {
    borderColor: "#0a7ea4",
    backgroundColor: "#e0f7fa",
  },
  departmentOptionText: {
    flex: 1,
    color: "#374151",
    fontSize: 13,
    textAlign: "right",
  },
  departmentOptionTextActive: {
    color: "#0a7ea4",
    fontWeight: "700",
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
