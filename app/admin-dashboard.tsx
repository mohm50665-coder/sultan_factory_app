import React, { useState, useEffect } from "react";
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
import { ScreenContainer } from "@/components/screen-container";
import { FormInput, FormSelect, FormCheckbox } from "@/components/form-input";
import { adminService, AdminUserData } from "@/lib/services/data.service";
import { useColors } from "@/hooks/use-colors";
import { MaterialIcons } from "@expo/vector-icons";

const ROLES = [
  { label: "مدير عام", value: "general_manager" },
  { label: "مدير إنتاج", value: "production_manager" },
  { label: "مدير مبيعات", value: "sales_manager" },
  { label: "محاسب", value: "accountant" },
  { label: "موظف", value: "employee" },
];

const PERMISSIONS = [
  { id: "view_data", label: "عرض البيانات" },
  { id: "add_data", label: "إضافة بيانات" },
  { id: "edit_data", label: "تعديل البيانات" },
  { id: "delete_data", label: "حذف البيانات" },
  { id: "view_reports", label: "عرض التقارير" },
  { id: "manage_users", label: "إدارة المستخدمين" },
  { id: "reset_password", label: "إعادة تعيين كلمات المرور" },
];

export default function AdminDashboardScreen() {
  const router = useRouter();
  const colors = useColors();

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
      Alert.alert("خطأ", "فشل تحميل بيانات المستخدمين");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name || !formData.email) {
      Alert.alert("خطأ", "يرجى ملء جميع الحقول المطلوبة");
      return;
    }

    try {
      setIsLoading(true);
      if (editingId) {
        await adminService.updateUser(editingId, formData);
        Alert.alert("نجاح", "تم تحديث بيانات المستخدم بنجاح");
      } else {
        await adminService.createUser(formData);
        Alert.alert("نجاح", "تم إضافة المستخدم بنجاح");
      }
      setShowForm(false);
      resetForm();
      loadUsers();
    } catch (error) {
      Alert.alert("خطأ", "فشل حفظ البيانات");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    Alert.alert(
      "تأكيد الحذف",
      "هل أنت متأكد من حذف هذا المستخدم؟",
      [
        { text: "إلغاء", onPress: () => {} },
        {
          text: "حذف",
          onPress: async () => {
            try {
              setIsLoading(true);
              await adminService.deleteUser(id);
              Alert.alert("نجاح", "تم حذف المستخدم بنجاح");
              loadUsers();
            } catch (error) {
              Alert.alert("خطأ", "فشل حذف البيانات");
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
    <View className="bg-white rounded-lg p-4 mb-3 border border-border">
      <View className="flex-row justify-between items-start mb-3">
        <View className="flex-1">
          <Text className="text-foreground font-bold text-base">{item.name}</Text>
          <Text className="text-muted text-sm mt-1">{item.email}</Text>
          <Text className="text-muted text-xs mt-1">
            الدور: {getRoleLabel(item.role)}
          </Text>
        </View>
        <View className="flex-row gap-2">
          <TouchableOpacity
            onPress={() => handleEdit(item)}
            className="bg-primary/10 rounded-lg p-2"
          >
            <MaterialIcons name="edit" size={18} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => item.id && handleDelete(item.id)}
            className="bg-error/10 rounded-lg p-2"
          >
            <MaterialIcons name="delete" size={18} color={colors.error} />
          </TouchableOpacity>
        </View>
      </View>

      <View className="flex-row items-center gap-2">
        {item.isActive ? (
          <View className="flex-row items-center gap-1 bg-success/10 px-2 py-1 rounded">
            <MaterialIcons name="check-circle" size={14} color={colors.success} />
            <Text className="text-success text-xs font-semibold">نشط</Text>
          </View>
        ) : (
          <View className="flex-row items-center gap-1 bg-error/10 px-2 py-1 rounded">
            <MaterialIcons name="cancel" size={14} color={colors.error} />
            <Text className="text-error text-xs font-semibold">معطل</Text>
          </View>
        )}
        <Text className="text-muted text-xs">
          {(item.permissions || []).length} صلاحية
        </Text>
      </View>
    </View>
  );

  return (
    <ScreenContainer className="bg-background">
      {/* رأس الصفحة */}
      <View className="bg-primary px-6 py-4 flex-row justify-between items-center">
        <View>
          <TouchableOpacity onPress={() => router.replace("/(tabs)")}>
            <MaterialIcons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
        </View>
        <Text className="text-white font-bold text-lg">لوحة تحكم ADMIN</Text>
        <TouchableOpacity
          onPress={() => {
            resetForm();
            setShowForm(true);
          }}
          className="bg-white/20 rounded-lg p-2"
        >
          <MaterialIcons name="add" size={24} color="white" />
        </TouchableOpacity>
      </View>

      {/* ملخص المستخدمين */}
      <View className="bg-primary/10 border-b border-border p-4">
        <Text className="text-muted text-xs mb-1">إجمالي المستخدمين</Text>
        <Text className="text-primary font-bold text-2xl">{users.length}</Text>
      </View>

      {/* قائمة المستخدمين */}
      {isLoading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={users}
          renderItem={renderUserItem}
          keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
          contentContainerStyle={{ padding: 16, flexGrow: 1 }}
          ListEmptyComponent={
            <View className="flex-1 justify-center items-center">
              <MaterialIcons name="inbox" size={48} color={colors.muted} />
              <Text className="text-muted text-center mt-4">لا توجد مستخدمين</Text>
            </View>
          }
        />
      )}

      {/* نموذج الإضافة/التعديل */}
      <Modal
        visible={showForm}
        animationType="slide"
        transparent
        onRequestClose={() => setShowForm(false)}
      >
        <View className="flex-1 bg-black/50">
          <View className="flex-1 bg-background rounded-t-3xl mt-12">
            {/* رأس النموذج */}
            <View className="flex-row justify-between items-center p-6 border-b border-border">
              <TouchableOpacity onPress={() => setShowForm(false)}>
                <Text className="text-primary font-semibold">إلغاء</Text>
              </TouchableOpacity>
              <Text className="text-foreground font-bold text-lg">
                {editingId ? "تعديل المستخدم" : "إضافة مستخدم جديد"}
              </Text>
              <TouchableOpacity onPress={handleSave} disabled={isLoading}>
                <Text className={`font-semibold ${isLoading ? "text-muted" : "text-primary"}`}>
                  {isLoading ? "جاري..." : "حفظ"}
                </Text>
              </TouchableOpacity>
            </View>

            {/* محتوى النموذج */}
            <ScrollView className="flex-1 p-6">
              <FormInput
                label="اسم المستخدم"
                value={formData.name}
                onChangeText={(text) => setFormData({ ...formData, name: text })}
                placeholder="أدخل اسم المستخدم"
                required
              />

              <FormInput
                label="البريد الإلكتروني"
                value={formData.email}
                onChangeText={(text) => setFormData({ ...formData, email: text })}
                placeholder="أدخل البريد الإلكتروني"
                keyboardType="email-address"
                required
              />

              <FormSelect
                label="الدور الوظيفي"
                value={formData.role}
                options={ROLES}
                onValueChange={(value) =>
                  setFormData({ ...formData, role: value })
                }
                required
              />

              <View className="mt-6 border-t border-border pt-6">
                <Text className="text-foreground font-semibold text-sm mb-4">الصلاحيات</Text>
                {PERMISSIONS.map((permission) => (
                  <FormCheckbox
                    key={permission.id}
                    label={permission.label}
                    value={(formData.permissions || []).includes(permission.id)}
                    onValueChange={() => togglePermission(permission.id)}
                  />
                ))}
              </View>

              <View className="mt-6 border-t border-border pt-6">
                <FormCheckbox
                  label="حساب نشط"
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
