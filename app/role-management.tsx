import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  FlatList,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { MaterialIcons } from "@expo/vector-icons";
import RolesService, { UserRole, RolePermissions } from "@/lib/services/roles.service";
import { useLanguage } from "@/lib/language-context";

export default function RoleManagementScreen() {
  const colors = useColors();
  const { language, t, isRtl } = useLanguage();
  const isAr = language === "ar";
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [expandedRole, setExpandedRole] = useState<UserRole | null>(null);

  const allRoles = RolesService.getAllRoles();

  const RoleCard = ({ role }: { role: RolePermissions }) => {
    const isExpanded = expandedRole === role.role;
    const isSelected = selectedRole === role.role;

    return (
      <View style={{ marginBottom: 12 }}>
        <TouchableOpacity
          onPress={() => setExpandedRole(isExpanded ? null : role.role)}
          style={{
            backgroundColor: colors.surface,
            borderRadius: 12,
            padding: 14,
            borderWidth: 2,
            borderColor: isSelected ? colors.primary : colors.border,
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: colors.foreground,
                fontSize: 14,
                fontWeight: "600",
                marginBottom: 4,
              }}
            >
              {role.description}
            </Text>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
              }}
            >
              <MaterialIcons
                name="check-circle"
                size={14}
                color={colors.success}
              />
              <Text style={{ color: colors.muted, fontSize: 11 }}>
                {role.permissions.length} {isAr ? "صلاحية" : "Permissions"}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
            <TouchableOpacity
              onPress={() => {
                setSelectedRole(role.role);
                setShowModal(true);
              }}
              style={{
                padding: 8,
                borderRadius: 8,
                backgroundColor: colors.primary,
              }}
            >
              <MaterialIcons name="edit" size={16} color="white" />
            </TouchableOpacity>
            <MaterialIcons
              name={isExpanded ? "expand-less" : "expand-more"}
              size={20}
              color={colors.muted}
            />
          </View>
        </TouchableOpacity>

        {/* تفاصيل الصلاحيات */}
        {isExpanded && (
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 0,
              borderBottomLeftRadius: 12,
              borderBottomRightRadius: 12,
              padding: 14,
              borderLeftWidth: 2,
              borderRightWidth: 2,
              borderBottomWidth: 2,
              borderColor: colors.border,
              marginTop: -2,
            }}
          >
            <Text
              style={{
                color: colors.foreground,
                fontSize: 12,
                fontWeight: "600",
                marginBottom: 10,
              }}
            >
              {isAr ? "الصلاحيات المتاحة:" : "Available Permissions:"}
            </Text>
            {role.permissions.map((permission) => (
              <View
                key={permission.id}
                style={{
                  flexDirection: "row",
                  alignItems: "flex-start",
                  marginBottom: 8,
                  paddingLeft: 8,
                }}
              >
                <MaterialIcons
                  name="check"
                  size={16}
                  color={colors.success}
                  style={{ marginRight: 8, marginTop: 2 }}
                />
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: colors.foreground,
                      fontSize: 11,
                      fontWeight: "500",
                    }}
                  >
                    {permission.name}
                  </Text>
                  <Text
                    style={{
                      color: colors.muted,
                      fontSize: 10,
                      marginTop: 2,
                    }}
                  >
                    {permission.description}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  return (
    <ScreenContainer style={{ backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        {/* رأس الصفحة */}
        <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 }}>
          <Text
            style={{
              color: colors.foreground,
              fontSize: 24,
              fontWeight: "bold",
              marginBottom: 4,
            }}
          >
            {isAr ? "إدارة الأدوار والصلاحيات" : "Roles and Permissions Management"}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            {isAr ? "إدارة أدوار المستخدمين والصلاحيات المرتبطة بها" : "Manage user roles and associated permissions"}
          </Text>
        </View>

        {/* قائمة الأدوار */}
        <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
          <Text
            style={{
              color: colors.foreground,
              fontSize: 13,
              fontWeight: "600",
              marginBottom: 12,
            }}
          >
            {isAr ? "الأدوار المتاحة" : "Available Roles"} ({allRoles.length})
          </Text>

          {allRoles.map((role) => (
            <RoleCard key={role.role} role={role} />
          ))}
        </View>

        {/* معلومات إضافية */}
        <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 12,
              padding: 14,
              borderLeftWidth: 4,
              borderLeftColor: colors.primary,
            }}
          >
            <Text
              style={{
                color: colors.foreground,
                fontSize: 12,
                fontWeight: "600",
                marginBottom: 8,
              }}
            >
              {isAr ? "نصيحة" : "Tip"}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 11, lineHeight: 16 }}>
              {isAr ? "يمكنك تعديل الصلاحيات لكل دور بالضغط على زر التعديل. تأكد من أن كل مستخدم لديه الصلاحيات المناسبة لعمله." : "You can edit permissions for each role by clicking the edit button. Ensure each user has the appropriate permissions for their work."}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* نموذج التعديل */}
      <Modal
        visible={showModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowModal(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            justifyContent: "flex-end",
          }}
        >
          <View
            style={{
              backgroundColor: colors.background,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              paddingTop: 20,
              maxHeight: "80%",
            }}
          >
            {/* رأس النموذج */}
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                paddingHorizontal: 16,
                paddingBottom: 16,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              }}
            >
              <Text
                style={{
                  color: colors.foreground,
                  fontSize: 16,
                  fontWeight: "bold",
                }}
              >
                {isAr ? "تعديل الصلاحيات" : "Edit Permissions"}
              </Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <MaterialIcons name="close" size={24} color={colors.foreground} />
              </TouchableOpacity>
            </View>

            {/* محتوى النموذج */}
            <ScrollView style={{ padding: 16 }}>
              {selectedRole && (
                <View>
                  <Text
                    style={{
                      color: colors.foreground,
                      fontSize: 14,
                      fontWeight: "600",
                      marginBottom: 12,
                    }}
                  >
                    {RolesService.getRoleDescription(selectedRole)}
                  </Text>

                  {RolesService.getPermissionsForRole(selectedRole).map(
                    (permission) => (
                      <TouchableOpacity
                        key={permission.id}
                        style={{
                          backgroundColor: colors.surface,
                          borderRadius: 8,
                          padding: 12,
                          marginBottom: 8,
                          flexDirection: "row",
                          alignItems: "center",
                          borderWidth: 1,
                          borderColor: colors.border,
                        }}
                      >
                        <View
                          style={{
                            width: 20,
                            height: 20,
                            borderRadius: 4,
                            backgroundColor: colors.primary,
                            alignItems: "center",
                            justifyContent: "center",
                            marginRight: 12,
                          }}
                        >
                          <MaterialIcons
                            name="check"
                            size={14}
                            color="white"
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text
                            style={{
                              color: colors.foreground,
                              fontSize: 12,
                              fontWeight: "500",
                            }}
                          >
                            {permission.name}
                          </Text>
                          <Text
                            style={{
                              color: colors.muted,
                              fontSize: 10,
                              marginTop: 2,
                            }}
                          >
                            {permission.description}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    )
                  )}

                  {/* أزرار الإجراء */}
                  <View
                    style={{
                      flexDirection: "row",
                      gap: 12,
                      marginTop: 20,
                      marginBottom: 20,
                    }}
                  >
                    <TouchableOpacity
                      onPress={() => setShowModal(false)}
                      style={{
                        flex: 1,
                        backgroundColor: colors.primary,
                        paddingVertical: 12,
                        borderRadius: 8,
                        alignItems: "center",
                      }}
                    >
                      <Text style={{ color: "white", fontWeight: "600" }}>
                        {isAr ? "حفظ التغييرات" : "Save Changes"}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setShowModal(false)}
                      style={{
                        flex: 1,
                        backgroundColor: colors.surface,
                        paddingVertical: 12,
                        borderRadius: 8,
                        alignItems: "center",
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}
                    >
                      <Text style={{ color: colors.foreground, fontWeight: "600" }}>
                        {isAr ? "إلغاء" : "Cancel"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
