import React, { useState, useEffect } from "react";
import { BackButton } from "@/components/back-button";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  FlatList,
  Modal,
} from "react-native";
import { useRouter } from "expo-router";
import { useLanguage } from "@/lib/language-context";
import { ScreenContainer } from "@/components/screen-container";
import { FormInput, FormSelect, FormCheckbox } from "@/components/form-input";
import { adminService, AdminUserData } from "@/lib/services/data.service";
import { useColors } from "@/hooks/use-colors";
import { MaterialIcons } from "@expo/vector-icons";

export default function AdminDashboardScreen() {
  const router = useRouter();
  const colors = useColors();
  const { language } = useLanguage();
  const isAr = language === "ar";

  const ROLES = [
    { label: isAr ? "مدير عام" : "General Manager", value: "general_manager" },
    { label: isAr ? "مدير إنتاج" : "Production Manager", value: "production_manager" },
    { label: isAr ? "مدير مبيعات" : "Sales Manager", value: "sales_manager" },
    { label: isAr ? "محاسب" : "Accountant", value: "accountant" },
    { label: isAr ? "موظف" : "Employee", value: "employee" },
  ];

  const PERMISSIONS = [
    { id: "view_data", label: isAr ? "عرض البيانات" : "View Data" },
    { id: "add_data", label: isAr ? "إضافة بيانات" : "Add Data" },
    { id: "edit_data", label: isAr ? "تعديل البيانات" : "Edit Data" },
    { id: "delete_data", label: isAr ? "حذف البيانات" : "Delete Data" },
    { id: "view_reports", label: isAr ? "عرض التقارير" : "View Reports" },
    { id: "manage_users", label: isAr ? "إدارة المستخدمين" : "Manage Users" },
    { id: "reset_password", label: isAr ? "إعادة تعيين كلمات المرور" : "Reset Passwords" },
  ];

  const [users, setUsers] = useState<AdminUserData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [formData, setFormData] = useState<AdminUserData>({
    name: "",
    email: "",
    role: "employee",
    permissions: [],
    isActive: true,
  });

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setIsLoading(true);
      const data = await adminService.getAllUsers();
      setUsers(data);
    } catch (error) {
      Alert.alert(isAr ? "خطأ" : "Error", isAr ? "فشل تحميل بيانات المستخدمين" : "Failed to load users data");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name || !formData.email) {
      Alert.alert(isAr ? "خطأ" : "Error", isAr ? "يرجى ملء جميع الحقول المطلوبة" : "Please fill all required fields");
      return;
    }

    try {
      setIsLoading(true);
      if (editingId) {
        await adminService.updateUser(editingId, formData);
        Alert.alert(isAr ? "نجاح" : "Success", isAr ? "تم تحديث بيانات المستخدم بنجاح" : "User data updated successfully");
      } else {
        await adminService.createUser(formData);
        Alert.alert(isAr ? "نجاح" : "Success", isAr ? "تم إضافة المستخدم بنجاح" : "User added successfully");
      }
      setShowForm(false);
      resetForm();
      loadUsers();
    } catch (error) {
      Alert.alert(isAr ? "خطأ" : "Error", isAr ? "فشل حفظ البيانات" : "Failed to save data");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    Alert.alert(
      isAr ? "تأكيد الحذف" : "Confirm Deletion",
      isAr ? "هل أنت متأكد من حذف هذا المستخدم؟" : "Are you sure you want to delete this user?",
      [
        { text: isAr ? "إلغاء" : "Cancel", onPress: () => {} },
        {
          text: isAr ? "حذف" : "Delete",
          onPress: async () => {
            try {
              setIsLoading(true);
              await adminService.deleteUser(id);
              Alert.alert(isAr ? "نجاح" : "Success", isAr ? "تم حذف المستخدم بنجاح" : "User deleted successfully");
              loadUsers();
            } catch (error) {
              Alert.alert(isAr ? "خطأ" : "Error", isAr ? "فشل حذف البيانات" : "Failed to delete data");
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleEdit = (user: AdminUserData) => {
    setFormData(user);
    setEditingId(user.id || null);
    setShowForm(true);
  };

  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      role: "employee",
      permissions: [],
      isActive: true,
    });
    setEditingId(null);
  };

  const getRoleLabel = (role: string) => {
    return ROLES.find((r) => r.value === role)?.label || role;
  };

  const togglePermission = (permissionId: string) => {
    const permissions = formData.permissions || [];
    if (permissions.includes(permissionId)) {
      setFormData({
        ...formData,
        permissions: permissions.filter((p) => p !== permissionId),
      });
    } else {
      setFormData({
        ...formData,
        permissions: [...permissions, permissionId],
      });
    }
  };

  const renderUserItem = ({ item }: { item: AdminUserData }) => (
    <View style={{ backgroundColor: '#ffffff', borderRadius: 8, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.border }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.foreground, fontWeight: 'bold', fontSize: 16 }}>{item.name}</Text>
          <Text style={{ color: colors.muted, fontSize: 14, marginTop: 4 }}>{item.email}</Text>
          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
            {isAr ? "الدور:" : "Role:"} {getRoleLabel(item.role)}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity
            onPress={() => handleEdit(item)}
            style={{ backgroundColor: colors.primary + '19', borderRadius: 8, padding: 8 }}
          >
            <MaterialIcons name="edit" size={18} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => item.id && handleDelete(item.id)}
            style={{ backgroundColor: colors.error + '19', borderRadius: 8, padding: 8 }}
          >
            <MaterialIcons name="delete" size={18} color={colors.error} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {item.isActive ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.success + '19', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 }}>
            <MaterialIcons name="check-circle" size={14} color={colors.success} />
            <Text style={{ color: colors.success, fontSize: 12, fontWeight: '600' }}>{isAr ? "نشط" : "Active"}</Text>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.error + '19', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 }}>
            <MaterialIcons name="cancel" size={14} color={colors.error} />
            <Text style={{ color: colors.error, fontSize: 12, fontWeight: '600' }}>{isAr ? "معطل" : "Inactive"}</Text>
          </View>
        )}
        <Text style={{ color: colors.muted, fontSize: 12 }}>
          {(item.permissions || []).length} {isAr ? "صلاحية" : "Permissions"}
        </Text>
      </View>
    </View>
  );

  return (
    <ScreenContainer style={{ backgroundColor: colors.background }}>
      {/* Header */}
      <View style={{ backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View>
          <BackButton />
        </View>
        <Text style={{ color: '#ffffff', fontWeight: 'bold', fontSize: 18 }}>{isAr ? "لوحة تحكم ADMIN" : "ADMIN Dashboard"}</Text>
        <TouchableOpacity
          onPress={() => {
            resetForm();
            setShowForm(true);
          }}
          style={{ borderRadius: 8, padding: 8 }}
        >
          <MaterialIcons name="add" size={24} color="white" />
        </TouchableOpacity>
      </View>

      {/* Users Summary */}
      <View style={{ backgroundColor: colors.primary + '19', borderBottomWidth: 1, borderColor: colors.border, padding: 16 }}>
        <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 4 }}>{isAr ? "إجمالي المستخدمين" : "Total Users"}</Text>
        <Text style={{ color: colors.primary, fontWeight: 'bold', fontSize: 24 }}>{users.length}</Text>
      </View>

      {/* Users List */}
      {isLoading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={users}
          renderItem={renderUserItem}
          keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
          contentContainerStyle={{ padding: 16, flexGrow: 1 }}
          ListEmptyComponent={
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <MaterialIcons name="inbox" size={48} color={colors.muted} />
              <Text style={{ color: colors.muted, textAlign: 'center', marginTop: 16 }}>{isAr ? "لا توجد مستخدمين" : "No users found"}</Text>
            </View>
          }
        />
      )}

      {/* Add/Edit Form */}
      <Modal
        visible={showForm}
        animationType="slide"
        transparent
        onRequestClose={() => setShowForm(false)}
      >
        <View style={{ flex: 1 }}>
          <View style={{ flex: 1, backgroundColor: colors.background, marginTop: 48 }}>
            {/* Form Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24, borderBottomWidth: 1, borderColor: colors.border }}>
              <TouchableOpacity onPress={() => setShowForm(false)}>
                <Text style={{ color: colors.primary, fontWeight: '600' }}>{isAr ? "إلغاء" : "Cancel"}</Text>
              </TouchableOpacity>
              <Text style={{ color: colors.foreground, fontWeight: 'bold', fontSize: 18 }}>
                {editingId ? (isAr ? "تعديل المستخدم" : "Edit User") : (isAr ? "إضافة مستخدم جديد" : "Add New User")}
              </Text>
              <TouchableOpacity onPress={handleSave} disabled={isLoading}>
                <Text style={{ fontWeight: '600' }}>
                  {isLoading ? (isAr ? "جاري..." : "Saving...") : (isAr ? "حفظ" : "Save")}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Form Content */}
            <ScrollView style={{ flex: 1, padding: 24 }}>
              <FormInput
                label={isAr ? "اسم المستخدم" : "Username"}
                value={formData.name}
                onChangeText={(text) => setFormData({ ...formData, name: text })}
                placeholder={isAr ? "أدخل اسم المستخدم" : "Enter username"}
                required
              />

              <FormInput
                label={isAr ? "البريد الإلكتروني" : "Email"}
                value={formData.email}
                onChangeText={(text) => setFormData({ ...formData, email: text })}
                placeholder={isAr ? "أدخل البريد الإلكتروني" : "Enter email"}
                keyboardType="email-address"
                required
              />

              <FormSelect
                label={isAr ? "الدور الوظيفي" : "Role"}
                value={formData.role}
                options={ROLES}
                onValueChange={(value) =>
                  setFormData({ ...formData, role: value })
                }
                required
              />

              <View style={{ marginTop: 24, borderTopWidth: 1, borderColor: colors.border, paddingTop: 24 }}>
                <Text style={{ color: colors.foreground, fontWeight: '600', fontSize: 14, marginBottom: 16 }}>{isAr ? "الصلاحيات" : "Permissions"}</Text>
                {PERMISSIONS.map((permission) => (
                  <FormCheckbox
                    key={permission.id}
                    label={permission.label}
                    value={(formData.permissions || []).includes(permission.id)}
                    onValueChange={() => togglePermission(permission.id)}
                  />
                ))}
              </View>

              <View style={{ marginTop: 24, borderTopWidth: 1, borderColor: colors.border, paddingTop: 24 }}>
                <FormCheckbox
                  label={isAr ? "حساب نشط" : "Active Account"}
                  value={formData.isActive}
                  onValueChange={(value) =>
                    setFormData({ ...formData, isActive: value })
                  }
                />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
