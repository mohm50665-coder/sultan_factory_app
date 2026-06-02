import React, { useState, useEffect } from "react";
import { BackButton } from "@/components/back-button";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  Modal,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";
import { MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import RolesService, { type UserRole } from "@/lib/services/roles.service";

const AVATAR_COLORS = [
  "#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6",
  "#ec4899", "#06b6d4", "#6366f1", "#14b8a6", "#f97316",
];

export default function ProfileScreen() {
  const router = useRouter();
  const colors = useColors();
  const { user, logout, updateProfile } = useAuth();
  const { t, language, isRtl } = useLanguage();
  const isAr = language === "ar";
  const textAlign = isRtl ? "right" : "left";

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [avatarColor, setAvatarColor] = useState("#0a7ea4");
  const [isLoading, setIsLoading] = useState(false);

  const [editForm, setEditForm] = useState({
    name: user?.name || "",
    phone: user?.phone || "",
    position: user?.position || "",
  });

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    loadAvatarColor();
  }, []);

  const loadAvatarColor = async () => {
    try {
      const saved = await AsyncStorage.getItem("avatar_color");
      if (saved) setAvatarColor(saved);
    } catch (error) {
      // ignore
    }
  };

  const saveAvatarColor = async (color: string) => {
    setAvatarColor(color);
    await AsyncStorage.setItem("avatar_color", color);
    setShowAvatarModal(false);
  };

  const handleEditProfile = async () => {
    if (!editForm.name.trim()) {
      Alert.alert(t("error"), isAr ? "الرجاء إدخال الاسم" : "Please enter name");
      return;
    }
    setIsLoading(true);
    try {
      await updateProfile(editForm);
      Alert.alert(t("success"), isAr ? "تم تحديث البيانات بنجاح" : "Profile updated successfully");
      setShowEditModal(false);
    } catch (error) {
      Alert.alert(t("error"), isAr ? "فشل تحديث البيانات" : "Failed to update profile");
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangePassword = async () => {
    const errors: Record<string, string> = {};
    if (!passwordForm.currentPassword) {
      errors.current = isAr ? "كلمة المرور الحالية مطلوبة" : "Current password is required";
    }
    if (!passwordForm.newPassword) {
      errors.new = isAr ? "كلمة المرور الجديدة مطلوبة" : "New password is required";
    } else if (passwordForm.newPassword.length < 6) {
      errors.new = t("password_min");
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      errors.confirm = t("passwords_not_match");
    }

    setPasswordErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsLoading(true);
    try {
      const usersData = await AsyncStorage.getItem("users");
      if (usersData) {
        const users = JSON.parse(usersData);
        const currentUser = users.find((u: any) => u.username === user?.username);
        if (currentUser && currentUser.password !== passwordForm.currentPassword) {
          setPasswordErrors({ current: isAr ? "كلمة المرور الحالية غير صحيحة" : "Current password is incorrect" });
          setIsLoading(false);
          return;
        }
        const updatedUsers = users.map((u: any) =>
          u.username === user?.username ? { ...u, password: passwordForm.newPassword } : u
        );
        await AsyncStorage.setItem("users", JSON.stringify(updatedUsers));
      }

      Alert.alert(t("success"), isAr ? "تم تغيير كلمة المرور بنجاح" : "Password changed successfully");
      setShowPasswordModal(false);
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (error) {
      Alert.alert(t("error"), isAr ? "فشل تغيير كلمة المرور" : "Failed to change password");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      t("logout"),
      isAr ? "هل أنت متأكد من رغبتك في تسجيل الخروج؟" : "Are you sure you want to logout?",
      [
        { text: t("cancel") },
        {
          text: t("logout"),
          onPress: async () => {
            await logout();
            router.replace("/login");
          },
        },
      ]
    );
  };

  const userRole = (user?.role || "user") as UserRole;
  const roleName = RolesService.getRoleName(userRole, language);
  const permissions = RolesService.getPermissionsForRole(userRole);
  const initials = user?.name
    ? user.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
    : "U";

  return (
    <ScreenContainer style={{ backgroundColor: colors.background }}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <BackButton />
        <Text style={styles.headerTitle}>{t("profile")}</Text>
        <TouchableOpacity onPress={() => setShowEditModal(true)} style={styles.backBtn}>
          <MaterialIcons name="edit" size={20} color="white" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Avatar & Name */}
        <View style={styles.profileSection}>
          <TouchableOpacity onPress={() => setShowAvatarModal(true)} style={styles.avatarWrapper}>
            <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            <View style={styles.editBadge}>
              <MaterialIcons name="edit" size={12} color="white" />
            </View>
          </TouchableOpacity>
          <Text style={styles.profileName}>{user?.name || (isAr ? "المستخدم" : "User")}</Text>
          <Text style={styles.profileRole}>{roleName}</Text>
          {user?.position && (
            <Text style={styles.profilePosition}>{user.position}</Text>
          )}
        </View>

        {/* Account Info Card */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { textAlign }]}>
            {t("account_info")}
          </Text>
          <View style={styles.card}>
            <View style={styles.infoRow}>
              <MaterialIcons name="person-outline" size={20} color="#6b7280" />
              <View style={styles.infoContent}>
                <Text style={[styles.infoLabel, { textAlign }]}>{t("username")}</Text>
                <Text style={[styles.infoValue, { textAlign }]}>{user?.username || "-"}</Text>
              </View>
            </View>

            <View style={styles.infoDivider} />

            <View style={styles.infoRow}>
              <MaterialIcons name="phone" size={20} color="#6b7280" />
              <View style={styles.infoContent}>
                <Text style={[styles.infoLabel, { textAlign }]}>{t("phone")}</Text>
                <Text style={[styles.infoValue, { textAlign }]}>{user?.phone || "-"}</Text>
              </View>
            </View>

            <View style={styles.infoDivider} />

            <View style={styles.infoRow}>
              <MaterialIcons name="badge" size={20} color="#6b7280" />
              <View style={styles.infoContent}>
                <Text style={[styles.infoLabel, { textAlign }]}>{t("role")}</Text>
                <Text style={[styles.infoValue, { textAlign }]}>{roleName}</Text>
              </View>
            </View>

            <View style={styles.infoDivider} />

            <View style={styles.infoRow}>
              <MaterialIcons name="calendar-today" size={20} color="#6b7280" />
              <View style={styles.infoContent}>
                <Text style={[styles.infoLabel, { textAlign }]}>{t("member_since")}</Text>
                <Text style={[styles.infoValue, { textAlign }]}>
                  {user?.createdAt
                    ? new Date(user.createdAt).toLocaleDateString(isAr ? "ar-SA" : "en-US")
                    : "-"}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Permissions Card */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { textAlign }]}>
            {t("permissions")} ({permissions.length})
          </Text>
          <View style={styles.card}>
            <View style={styles.permissionsGrid}>
              {permissions.slice(0, 8).map((perm) => (
                <View key={perm.id} style={styles.permBadge}>
                  <MaterialIcons name="check-circle" size={14} color="#10b981" />
                  <Text style={styles.permText}>{perm.name}</Text>
                </View>
              ))}
              {permissions.length > 8 && (
                <View style={styles.permBadge}>
                  <Text style={styles.permMoreText}>
                    +{permissions.length - 8} {isAr ? "أخرى" : "more"}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { textAlign }]}>
            {isAr ? "الإجراءات" : "Actions"}
          </Text>
          <View style={styles.card}>
            <TouchableOpacity onPress={() => setShowPasswordModal(true)} style={styles.actionRow}>
              <MaterialIcons name="chevron-left" size={20} color="#9ca3af" />
              <View style={styles.actionContent}>
                <Text style={[styles.actionLabel, { textAlign }]}>{t("change_password")}</Text>
                <View style={[styles.actionIcon, { backgroundColor: "#3b82f615" }]}>
                  <MaterialIcons name="lock-outline" size={20} color="#3b82f6" />
                </View>
              </View>
            </TouchableOpacity>

            <View style={styles.infoDivider} />

            <TouchableOpacity onPress={() => router.push("/settings" as any)} style={styles.actionRow}>
              <MaterialIcons name="chevron-left" size={20} color="#9ca3af" />
              <View style={styles.actionContent}>
                <Text style={[styles.actionLabel, { textAlign }]}>{t("settings")}</Text>
                <View style={[styles.actionIcon, { backgroundColor: "#6366f115" }]}>
                  <MaterialIcons name="settings" size={20} color="#6366f1" />
                </View>
              </View>
            </TouchableOpacity>

            <View style={styles.infoDivider} />

            <TouchableOpacity onPress={handleLogout} style={styles.actionRow}>
              <MaterialIcons name="chevron-left" size={20} color="#9ca3af" />
              <View style={styles.actionContent}>
                <Text style={[styles.actionLabel, { textAlign, color: "#ef4444" }]}>{t("logout")}</Text>
                <View style={[styles.actionIcon, { backgroundColor: "#ef444415" }]}>
                  <MaterialIcons name="logout" size={20} color="#ef4444" />
                </View>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal visible={showEditModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowEditModal(false)}>
                <MaterialIcons name="close" size={24} color="#1f2937" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>{isAr ? "تعديل الملف الشخصي" : "Edit Profile"}</Text>
              <View style={{ width: 24 }} />
            </View>

            <View style={styles.modalBody}>
              <View style={styles.modalInputGroup}>
                <Text style={[styles.modalLabel, { textAlign }]}>{t("full_name")}</Text>
                <TextInput
                  style={[styles.modalInput, { textAlign }]}
                  value={editForm.name}
                  onChangeText={(text) => setEditForm({ ...editForm, name: text })}
                  placeholder={isAr ? "الاسم الكامل" : "Full name"}
                  placeholderTextColor="#9ca3af"
                />
              </View>

              <View style={styles.modalInputGroup}>
                <Text style={[styles.modalLabel, { textAlign }]}>{t("phone")}</Text>
                <TextInput
                  style={[styles.modalInput, { textAlign }]}
                  value={editForm.phone}
                  onChangeText={(text) => setEditForm({ ...editForm, phone: text })}
                  placeholder={isAr ? "رقم الجوال" : "Phone number"}
                  placeholderTextColor="#9ca3af"
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.modalInputGroup}>
                <Text style={[styles.modalLabel, { textAlign }]}>{isAr ? "المنصب" : "Position"}</Text>
                <TextInput
                  style={[styles.modalInput, { textAlign }]}
                  value={editForm.position}
                  onChangeText={(text) => setEditForm({ ...editForm, position: text })}
                  placeholder={isAr ? "المنصب الوظيفي" : "Job position"}
                  placeholderTextColor="#9ca3af"
                />
              </View>

              <TouchableOpacity
                onPress={handleEditProfile}
                disabled={isLoading}
                style={[styles.modalButton, isLoading && { opacity: 0.6 }]}
              >
                {isLoading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.modalButtonText}>{t("save")}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Change Password Modal */}
      <Modal visible={showPasswordModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowPasswordModal(false)}>
                <MaterialIcons name="close" size={24} color="#1f2937" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>{t("change_password")}</Text>
              <View style={{ width: 24 }} />
            </View>

            <View style={styles.modalBody}>
              <View style={styles.modalInputGroup}>
                <Text style={[styles.modalLabel, { textAlign }]}>
                  {isAr ? "كلمة المرور الحالية" : "Current Password"}
                </Text>
                <TextInput
                  style={[styles.modalInput, { textAlign }, passwordErrors.current && styles.modalInputError]}
                  placeholder={isAr ? "أدخل كلمة المرور الحالية" : "Enter current password"}
                  placeholderTextColor="#9ca3af"
                  secureTextEntry
                  value={passwordForm.currentPassword}
                  onChangeText={(text) => {
                    setPasswordForm({ ...passwordForm, currentPassword: text });
                    if (passwordErrors.current) setPasswordErrors({ ...passwordErrors, current: "" });
                  }}
                />
                {passwordErrors.current && (
                  <Text style={[styles.modalError, { textAlign }]}>{passwordErrors.current}</Text>
                )}
              </View>

              <View style={styles.modalInputGroup}>
                <Text style={[styles.modalLabel, { textAlign }]}>{t("new_password")}</Text>
                <TextInput
                  style={[styles.modalInput, { textAlign }, passwordErrors.new && styles.modalInputError]}
                  placeholder={isAr ? "أدخل كلمة المرور الجديدة" : "Enter new password"}
                  placeholderTextColor="#9ca3af"
                  secureTextEntry
                  value={passwordForm.newPassword}
                  onChangeText={(text) => {
                    setPasswordForm({ ...passwordForm, newPassword: text });
                    if (passwordErrors.new) setPasswordErrors({ ...passwordErrors, new: "" });
                  }}
                />
                {passwordErrors.new && (
                  <Text style={[styles.modalError, { textAlign }]}>{passwordErrors.new}</Text>
                )}
              </View>

              <View style={styles.modalInputGroup}>
                <Text style={[styles.modalLabel, { textAlign }]}>{t("confirm_password")}</Text>
                <TextInput
                  style={[styles.modalInput, { textAlign }, passwordErrors.confirm && styles.modalInputError]}
                  placeholder={isAr ? "أعد إدخال كلمة المرور" : "Re-enter password"}
                  placeholderTextColor="#9ca3af"
                  secureTextEntry
                  value={passwordForm.confirmPassword}
                  onChangeText={(text) => {
                    setPasswordForm({ ...passwordForm, confirmPassword: text });
                    if (passwordErrors.confirm) setPasswordErrors({ ...passwordErrors, confirm: "" });
                  }}
                />
                {passwordErrors.confirm && (
                  <Text style={[styles.modalError, { textAlign }]}>{passwordErrors.confirm}</Text>
                )}
              </View>

              <TouchableOpacity
                onPress={handleChangePassword}
                disabled={isLoading}
                style={[styles.modalButton, isLoading && { opacity: 0.6 }]}
              >
                {isLoading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.modalButtonText}>{t("save")}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Avatar Color Picker Modal */}
      <Modal visible={showAvatarModal} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: 300 }]}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowAvatarModal(false)}>
                <MaterialIcons name="close" size={24} color="#1f2937" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>
                {isAr ? "اختر لون الصورة الشخصية" : "Choose Avatar Color"}
              </Text>
              <View style={{ width: 24 }} />
            </View>
            <View style={styles.colorGrid}>
              {AVATAR_COLORS.map((color) => (
                <TouchableOpacity
                  key={color}
                  onPress={() => saveAvatarColor(color)}
                  style={[
                    styles.colorOption,
                    { backgroundColor: color },
                    avatarColor === color && styles.colorSelected,
                  ]}
                >
                  {avatarColor === color && (
                    <MaterialIcons name="check" size={24} color="white" />
                  )}
                </TouchableOpacity>
              ))}
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
    paddingVertical: 16,
  },
  backBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "white",
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  profileSection: {
    alignItems: "center",
    marginBottom: 28,
    marginTop: 8,
  },
  avatarWrapper: {
    position: "relative",
    marginBottom: 14,
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: "bold",
    color: "white",
  },
  editBadge: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#0a7ea4",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "white",
  },
  profileName: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#1f2937",
    marginBottom: 4,
  },
  profileRole: {
    fontSize: 14,
    color: "#0a7ea4",
    fontWeight: "600",
    marginBottom: 2,
  },
  profilePosition: {
    fontSize: 13,
    color: "#6b7280",
  },
  section: {
    marginBottom: 22,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#6b7280",
    marginBottom: 10,
    paddingHorizontal: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: "white",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: "#9ca3af",
  },
  infoValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1f2937",
    marginTop: 2,
  },
  infoDivider: {
    height: 1,
    backgroundColor: "#f3f4f6",
    marginLeft: 48,
  },
  permissionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 14,
    gap: 8,
  },
  permBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#f0fdf4",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  permText: {
    fontSize: 11,
    color: "#166534",
    fontWeight: "500",
  },
  permMoreText: {
    fontSize: 11,
    color: "#6b7280",
    fontWeight: "600",
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  actionContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1f2937",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "white",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "bold",
    color: "#1f2937",
  },
  modalBody: {
    gap: 16,
  },
  modalInputGroup: {
    marginBottom: 4,
  },
  modalLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 6,
  },
  modalInput: {
    borderWidth: 1.5,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: "#1f2937",
    backgroundColor: "#f9fafb",
  },
  modalInputError: {
    borderColor: "#ef4444",
    backgroundColor: "#fef2f2",
  },
  modalError: {
    color: "#ef4444",
    fontSize: 11,
    marginTop: 4,
  },
  modalButton: {
    backgroundColor: "#0a7ea4",
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 8,
  },
  modalButtonText: {
    color: "white",
    fontWeight: "700",
    fontSize: 15,
    textAlign: "center",
  },
  colorGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 16,
    paddingVertical: 16,
  },
  colorOption: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
  },
  colorSelected: {
    borderWidth: 3,
    borderColor: "white",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
});
