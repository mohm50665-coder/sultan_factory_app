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
import { simpleAuthService, type User } from "@/lib/services/simple-auth";

const ROLES = [
  { value: "admin", label: "مدير النظام" },
  { value: "manager", label: "مدير إدارة" },
  { value: "supervisor", label: "مشرف" },
  { value: "user", label: "موظف" },
];

export default function UsersManagementScreen() {
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

  const loadUsers = useCallback(async () => {
    const allUsers = await simpleAuthService.getAllUsers();
    setUsers(allUsers);
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleToggleActive = async (userId: string) => {
    if (userId === currentUser?.id) {
      Alert.alert("تنبيه", "لا يمكنك تعطيل حسابك الخاص");
      return;
    }
    await simpleAuthService.toggleUserActive(userId);
    loadUsers();
  };

  const handleChangeRole = (user: User) => {
    if (user.id === currentUser?.id) {
      Alert.alert("تنبيه", "لا يمكنك تغيير صلاحيتك الخاصة");
      return;
    }
    setEditingUser(user);
    setEditRole(user.role);
    setShowEditModal(true);
  };

  const handleSaveRole = async () => {
    if (!editingUser) return;
    await simpleAuthService.changeUserRole(editingUser.id, editRole);
    setShowEditModal(false);
    setEditingUser(null);
    loadUsers();
  };

  const handleDeleteUser = (userId: string, userName: string) => {
    if (userId === currentUser?.id) {
      Alert.alert("تنبيه", "لا يمكنك حذف حسابك الخاص");
      return;
    }
    Alert.alert(
      "تأكيد الحذف",
      `هل أنت متأكد من حذف المستخدم "${userName}"؟`,
      [
        { text: "إلغاء" },
        {
          text: "حذف",
          style: "destructive",
          onPress: async () => {
            await simpleAuthService.deleteUser(userId);
            loadUsers();
          },
        },
      ]
    );
  };

  const handleResetPassword = (userId: string) => {
    setResetUserId(userId);
    setNewPassword("");
    setShowResetModal(true);
  };

  const handleSaveResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      Alert.alert("خطأ", "كلمة المرور يجب أن تكون 6 أحرف على الأقل");
      return;
    }
    await simpleAuthService.resetUserPassword(resetUserId, newPassword);
    setShowResetModal(false);
    Alert.alert("نجاح", "تم إعادة تعيين كلمة المرور بنجاح");
  };

  const getRoleLabel = (role: string) => {
    return ROLES.find((r) => r.value === role)?.label || role;
  };

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={styles.header}>
        <BackButton />
        <Text style={styles.headerTitle}>إدارة المستخدمين</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: "#e0f2fe" }]}>
          <Text style={[styles.statNumber, { color: "#0369a1" }]}>{users.length}</Text>
          <Text style={styles.statLabel}>إجمالي</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: "#dcfce7" }]}>
          <Text style={[styles.statNumber, { color: "#15803d" }]}>
            {users.filter((u) => u.isActive).length}
          </Text>
          <Text style={styles.statLabel}>نشط</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: "#fee2e2" }]}>
          <Text style={[styles.statNumber, { color: "#b91c1c" }]}>
            {users.filter((u) => !u.isActive).length}
          </Text>
          <Text style={styles.statLabel}>معطل</Text>
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
              <Text style={styles.userDetail}>@{u.username}</Text>
              <Text style={styles.userDetail}>{u.position} | {getRoleLabel(u.role)}</Text>
              <Text style={styles.userDetail}>{u.phone}</Text>
            </View>

            <View style={styles.actions}>
              {/* تغيير الصلاحية */}
              <TouchableOpacity
                onPress={() => handleChangeRole(u)}
                style={[styles.actionBtn, { backgroundColor: "#e0f2fe" }]}
              >
                <MaterialIcons name="admin-panel-settings" size={18} color="#0369a1" />
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
            <Text style={styles.modalTitle}>تغيير صلاحية: {editingUser?.name}</Text>
            <View style={styles.rolesContainer}>
              {ROLES.map((role) => (
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
                <Text style={styles.cancelBtnText}>إلغاء</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSaveRole} style={styles.saveBtn}>
                <Text style={styles.saveBtnText}>حفظ</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal إعادة تعيين كلمة المرور */}
      <Modal visible={showResetModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>إعادة تعيين كلمة المرور</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="كلمة المرور الجديدة (6 أحرف على الأقل)"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => setShowResetModal(false)}
                style={styles.cancelBtn}
              >
                <Text style={styles.cancelBtnText}>إلغاء</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSaveResetPassword} style={styles.saveBtn}>
                <Text style={styles.saveBtnText}>حفظ</Text>
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
    textAlign: "right",
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
    textAlign: "right",
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
