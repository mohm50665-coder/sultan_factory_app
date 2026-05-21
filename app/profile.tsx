import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/lib/auth-context";
import { MaterialIcons } from "@expo/vector-icons";

export default function ProfileScreen() {
  const router = useRouter();
  const colors = useColors();
  const { user, updateProfile } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || "",
    email: user?.email || "",
    phone: user?.phone || "",
    position: user?.position || "",
  });

  const handleSave = async () => {
    if (!formData.name.trim()) {
      Alert.alert("خطأ", "الرجاء إدخال الاسم");
      return;
    }

    setIsLoading(true);
    try {
      await updateProfile(formData);
      Alert.alert("نجاح", "تم تحديث البيانات بنجاح");
      setIsEditing(false);
    } catch (error) {
      Alert.alert("خطأ", "فشل تحديث البيانات");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScreenContainer className="bg-background">
      <ScrollView className="flex-1">
        {/* رأس الصفحة */}
        <View className="bg-gradient-to-r from-primary to-primary/80 px-6 py-6 flex-row items-center justify-between">
          <View className="flex-row items-center">
            <View className="w-16 h-16 rounded-full bg-white/20 items-center justify-center">
              <MaterialIcons name="account-circle" size={40} color="white" />
            </View>
            <View className="ml-4">
              <Text className="text-white font-bold text-lg">{user?.name}</Text>
              <Text className="text-white/80 text-sm">{user?.position}</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => setIsEditing(!isEditing)}
            className="bg-white/20 rounded-lg p-2"
          >
            <MaterialIcons
              name={isEditing ? "close" : "edit"}
              size={20}
              color="white"
            />
          </TouchableOpacity>
        </View>

        {/* محتوى الملف الشخصي */}
        <View className="p-6">
          {/* الاسم */}
          <View className="mb-6">
            <Text className="text-foreground font-semibold text-sm mb-2">
              الاسم الكامل
            </Text>
            <TextInput
              editable={isEditing}
              value={formData.name}
              onChangeText={(text) =>
                setFormData({ ...formData, name: text })
              }
              placeholder="أدخل الاسم الكامل"
              className={`border rounded-lg p-3 text-foreground ${
                isEditing
                  ? "border-primary bg-white"
                  : "border-border bg-surface"
              }`}
              placeholderTextColor={colors.muted}
            />
          </View>

          {/* البريد الإلكتروني */}
          <View className="mb-6">
            <Text className="text-foreground font-semibold text-sm mb-2">
              البريد الإلكتروني
            </Text>
            <TextInput
              editable={isEditing}
              value={formData.email}
              onChangeText={(text) =>
                setFormData({ ...formData, email: text })
              }
              placeholder="أدخل البريد الإلكتروني"
              keyboardType="email-address"
              className={`border rounded-lg p-3 text-foreground ${
                isEditing
                  ? "border-primary bg-white"
                  : "border-border bg-surface"
              }`}
              placeholderTextColor={colors.muted}
            />
          </View>

          {/* رقم الجوال */}
          <View className="mb-6">
            <Text className="text-foreground font-semibold text-sm mb-2">
              رقم الجوال
            </Text>
            <TextInput
              editable={isEditing}
              value={formData.phone}
              onChangeText={(text) =>
                setFormData({ ...formData, phone: text })
              }
              placeholder="أدخل رقم الجوال"
              keyboardType="phone-pad"
              className={`border rounded-lg p-3 text-foreground ${
                isEditing
                  ? "border-primary bg-white"
                  : "border-border bg-surface"
              }`}
              placeholderTextColor={colors.muted}
            />
          </View>

          {/* المنصب */}
          <View className="mb-6">
            <Text className="text-foreground font-semibold text-sm mb-2">
              المنصب
            </Text>
            <TextInput
              editable={isEditing}
              value={formData.position}
              onChangeText={(text) =>
                setFormData({ ...formData, position: text })
              }
              placeholder="أدخل المنصب"
              className={`border rounded-lg p-3 text-foreground ${
                isEditing
                  ? "border-primary bg-white"
                  : "border-border bg-surface"
              }`}
              placeholderTextColor={colors.muted}
            />
          </View>

          {/* معلومات إضافية */}
          <View className="bg-surface rounded-lg p-4 mb-6 border border-border">
            <View className="flex-row items-center mb-3">
              <MaterialIcons name="info" size={20} color={colors.primary} />
              <Text className="text-foreground font-semibold text-sm ml-2">
                معلومات الحساب
              </Text>
            </View>
            <View className="flex-row justify-between mb-2">
              <Text className="text-muted text-sm">الدور:</Text>
              <Text className="text-foreground font-semibold text-sm">
                {user?.role === "admin" ? "مدير النظام" : "موظف"}
              </Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-muted text-sm">تاريخ الإنشاء:</Text>
              <Text className="text-foreground font-semibold text-sm">
                {user?.createdAt
                  ? new Date(user.createdAt).toLocaleDateString("ar-SA")
                  : "غير محدد"}
              </Text>
            </View>
          </View>

          {/* أزرار الحفظ والإلغاء */}
          {isEditing && (
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={handleSave}
                disabled={isLoading}
                className="flex-1 bg-primary rounded-lg p-4 items-center justify-center"
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text className="text-white font-semibold">حفظ التغييرات</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setIsEditing(false);
                  setFormData({
                    name: user?.name || "",
                    email: user?.email || "",
                    phone: user?.phone || "",
                    position: user?.position || "",
                  });
                }}
                className="flex-1 bg-surface border border-border rounded-lg p-4 items-center justify-center"
              >
                <Text className="text-foreground font-semibold">إلغاء</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
