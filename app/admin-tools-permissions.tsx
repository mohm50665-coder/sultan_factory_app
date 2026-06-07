import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, Switch, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { useLanguage } from '@/lib/language-context';
import { useAuth } from '@/hooks/use-auth';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Tool {
  id: string;
  labelAr: string;
  labelEn: string;
  icon: string;
  color: string;
}

interface UserToolPermissions {
  userId: string;
  tools: Record<string, boolean>; // tool id -> visible
}

const AVAILABLE_TOOLS: Tool[] = [
  { id: 'advanced_analytics', labelAr: 'التحليلات المتقدمة', labelEn: 'Advanced Analytics', icon: 'insights', color: '#0891b2' },
  { id: 'export_reports', labelAr: 'تصدير التقارير PDF', labelEn: 'Export Reports PDF', icon: 'picture-as-pdf', color: '#dc2626' },
  { id: 'cost_comparison', labelAr: 'تقرير مقارنة التكاليف', labelEn: 'Cost Comparison Report', icon: 'trending-down', color: '#f97316' },
  { id: 'product_cost_calculator', labelAr: 'حساب تكاليف منتج جديد', labelEn: 'Product Cost Calculator', icon: 'calculate', color: '#8b5cf6' },
  { id: 'activity_log', labelAr: 'سجل التعديلات', labelEn: 'Activity Log', icon: 'history', color: '#6366f1' },
  { id: 'global_search', labelAr: 'البحث الشامل', labelEn: 'Global Search', icon: 'search', color: '#06b6d4' },
  { id: 'data_backup', labelAr: 'النسخ الاحتياطي', labelEn: 'Data Backup', icon: 'backup', color: '#14b8a6' },
  { id: 'user_management', labelAr: 'إدارة المستخدمين', labelEn: 'User Management', icon: 'people', color: '#f59e0b' },
];

export default function AdminToolsPermissionsScreen() {
  const router = useRouter();
  const colors = useColors();
  const { t } = useLanguage();
  const { user } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [userPermissions, setUserPermissions] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const usersData = await AsyncStorage.getItem('users');
      if (usersData) {
        const parsedUsers = JSON.parse(usersData);
        setUsers(parsedUsers);
        if (parsedUsers.length > 0) {
          selectUser(parsedUsers[0]);
        }
      }
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const selectUser = async (userData: any) => {
    setSelectedUser(userData);
    try {
      const permissionsKey = `tool_permissions_${userData.id}`;
      const permissions = await AsyncStorage.getItem(permissionsKey);
      if (permissions) {
        setUserPermissions(JSON.parse(permissions));
      } else {
        // Default: all tools visible
        const defaultPermissions: Record<string, boolean> = {};
        AVAILABLE_TOOLS.forEach(tool => {
          defaultPermissions[tool.id] = true;
        });
        setUserPermissions(defaultPermissions);
      }
    } catch (error) {
      console.error('Error loading permissions:', error);
    }
  };

  const toggleToolPermission = (toolId: string) => {
    setUserPermissions(prev => ({
      ...prev,
      [toolId]: !prev[toolId]
    }));
  };

  const savePermissions = async () => {
    if (!selectedUser) return;
    setIsLoading(true);
    try {
      const permissionsKey = `tool_permissions_${selectedUser.id}`;
      await AsyncStorage.setItem(permissionsKey, JSON.stringify(userPermissions));
      Alert.alert('نجح', 'تم حفظ الصلاحيات بنجاح');
    } catch (error) {
      console.error('Error saving permissions:', error);
      Alert.alert('خطأ', 'حدث خطأ أثناء حفظ الصلاحيات');
    } finally {
      setIsLoading(false);
    }
  };

  const resetToDefaults = () => {
    Alert.alert(
      'تأكيد',
      'هل تريد إعادة تعيين جميع الأدوات للظهور الافتراضي؟',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'تأكيد',
          style: 'destructive',
          onPress: () => {
            const defaultPermissions: Record<string, boolean> = {};
            AVAILABLE_TOOLS.forEach(tool => {
              defaultPermissions[tool.id] = true;
            });
            setUserPermissions(defaultPermissions);
          }
        }
      ]
    );
  };

  return (
    <ScreenContainer style={{ backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View style={{ padding: 16, gap: 16 }}>
          {/* Header */}
          <View style={{ marginBottom: 8 }}>
            <Text style={{ fontSize: 24, fontWeight: 'bold', color: colors.foreground, marginBottom: 4 }}>
              صلاحيات الأدوات الإضافية
            </Text>
            <Text style={{ fontSize: 14, color: colors.muted }}>
              تحديد الأدوات المتاحة لكل مستخدم
            </Text>
          </View>

          {/* User Selection */}
          <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.foreground, marginBottom: 8 }}>
              اختر المستخدم:
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
              {users.map((u) => (
                <TouchableOpacity
                  key={u.id}
                  onPress={() => selectUser(u)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 8,
                    marginRight: 8,
                    backgroundColor: selectedUser?.id === u.id ? colors.primary : colors.background,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Text style={{
                    color: selectedUser?.id === u.id ? 'white' : colors.foreground,
                    fontWeight: '600',
                    fontSize: 12
                  }}>
                    {u.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {selectedUser && (
              <View style={{ backgroundColor: colors.background, padding: 8, borderRadius: 8 }}>
                <Text style={{ fontSize: 12, color: colors.muted }}>
                  القسم: {selectedUser.department}
                </Text>
                <Text style={{ fontSize: 12, color: colors.muted }}>
                  الدور: {selectedUser.role}
                </Text>
              </View>
            )}
          </View>

          {/* Tools Permissions */}
          {selectedUser && (
            <View style={{ gap: 8 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.foreground }}>
                الأدوات المتاحة:
              </Text>
              {AVAILABLE_TOOLS.map((tool) => (
                <View
                  key={tool.id}
                  style={{
                    backgroundColor: colors.surface,
                    borderRadius: 12,
                    padding: 12,
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: userPermissions[tool.id] ? tool.color : colors.border,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                    <View style={{ width: 40, height: 40, borderRadius: 8, backgroundColor: tool.color + '20', justifyContent: 'center', alignItems: 'center' }}>
                      <MaterialIcons name={tool.icon as any} size={20} color={tool.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: colors.foreground }}>
                        {tool.labelAr}
                      </Text>
                      <Text style={{ fontSize: 12, color: colors.muted }}>
                        {tool.labelEn}
                      </Text>
                    </View>
                  </View>
                  <Switch
                    value={userPermissions[tool.id] || false}
                    onValueChange={() => toggleToolPermission(tool.id)}
                    trackColor={{ false: colors.border, true: colors.primary + '80' }}
                    thumbColor={userPermissions[tool.id] ? colors.primary : colors.muted}
                  />
                </View>
              ))}
            </View>
          )}

          {/* Action Buttons */}
          <View style={{ gap: 8, marginTop: 16 }}>
            <TouchableOpacity
              onPress={savePermissions}
              disabled={isLoading}
              style={{
                backgroundColor: colors.primary,
                borderRadius: 12,
                paddingVertical: 12,
                alignItems: 'center',
                opacity: isLoading ? 0.6 : 1
              }}
            >
              <Text style={{ color: 'white', fontWeight: '600', fontSize: 14 }}>
                حفظ الصلاحيات
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={resetToDefaults}
              style={{
                backgroundColor: colors.surface,
                borderRadius: 12,
                paddingVertical: 12,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: colors.border
              }}
            >
              <Text style={{ color: colors.foreground, fontWeight: '600', fontSize: 14 }}>
                إعادة تعيين للافتراضي
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.back()}
              style={{
                backgroundColor: colors.surface,
                borderRadius: 12,
                paddingVertical: 12,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: colors.border
              }}
            >
              <Text style={{ color: colors.foreground, fontWeight: '600', fontSize: 14 }}>
                رجوع
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
