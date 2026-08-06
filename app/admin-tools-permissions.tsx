import { View, Text, ScrollView, TouchableOpacity, Alert, Switch, StyleSheet } from 'react-native';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { useLanguage } from '@/lib/language-context';
import { useAuth } from '@/lib/auth-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';


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
  // الأدوات الإضافية - مطابقة للواجهة الرئيسية
  { id: 'reports', labelAr: 'التقارير', labelEn: 'Reports', icon: 'bar-chart', color: '#059669' },
  { id: 'notifications_center', labelAr: 'مركز الإشعارات', labelEn: 'Notifications Center', icon: 'notifications', color: '#d97706' },
  { id: 'export_data', labelAr: 'تصدير البيانات', labelEn: 'Export Data', icon: 'file-download', color: '#6366f1' },
  { id: 'activity_log', labelAr: 'سجل التعديلات', labelEn: 'Activity Log', icon: 'history', color: '#0891b2' },
  { id: 'production_export', labelAr: 'طباعة الإنتاج', labelEn: 'Production Export', icon: 'print', color: '#16a34a' },
  { id: 'waste_alerts', labelAr: 'تنبيهات الهدر', labelEn: 'Waste Alerts', icon: 'warning-amber', color: '#dc2626' },
  { id: 'reports_analytics', labelAr: 'التحليلات', labelEn: 'Analytics', icon: 'bar-chart', color: '#059669' },
  { id: 'section_reports', labelAr: 'تقارير الأقسام', labelEn: 'Section Reports', icon: 'summarize', color: '#0891b2' },
  { id: 'users_management', labelAr: 'إدارة المستخدمين', labelEn: 'User Management', icon: 'people', color: '#7c3aed' },
  { id: 'employee_performance', labelAr: 'أداء الموظفين', labelEn: 'Employee Performance', icon: 'assessment', color: '#059669' },
  { id: 'backup_restore', labelAr: 'نسخ احتياطي', labelEn: 'Backup & Restore', icon: 'backup', color: '#6366f1' },
  { id: 'machines_comparison', labelAr: 'مقارنة المكائن', labelEn: 'Machines Comparison', icon: 'precision-manufacturing', color: '#8b5cf6' },
  { id: 'share_reports', labelAr: 'مشاركة التقارير', labelEn: 'Share Reports', icon: 'share', color: '#0ea5e9' },
];

export default function AdminToolsPermissionsScreen() {
  const { language } = useLanguage();
  const isAr = language === "ar";
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
      const { adminService } = await import('@/lib/services/api.service');
      const allUsers = await adminService.getAllUsers();
      if (allUsers && allUsers.length > 0) {
        setUsers(allUsers);
        selectUser(allUsers[0]);
      }
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const selectUser = (userData: any): void => {
    setSelectedUser(userData);
    // Load from server toolPermissions field
    if (userData.toolPermissions && Object.keys(userData.toolPermissions).length > 0) {
      setUserPermissions(userData.toolPermissions);
    } else {
      const defaultPermissions: Record<string, boolean> = {};
      AVAILABLE_TOOLS.forEach(tool => {
        defaultPermissions[tool.id] = true;
      });
      setUserPermissions(defaultPermissions);
    }
  };

  const toggleToolPermission = (toolId: string): void => {
    setUserPermissions((prev: Record<string, boolean>) => ({
      ...prev,
      [toolId]: !prev[toolId]
    }));
  };

  const savePermissions = async () => {
    if (!selectedUser) return;
    setIsLoading(true);
    try {
      // Save to server
      const { adminService } = await import('@/lib/services/api.service');
      await adminService.updateToolPermissions(selectedUser.id, userPermissions);
      Alert.alert(isAr ? 'نجح' : 'Success', isAr ? 'تم حفظ الصلاحيات بنجاح' : 'Permissions saved successfully');
    } catch (error) {
      console.error('Error saving permissions:', error);
      Alert.alert(isAr ? 'خطأ' : 'Error', isAr ? 'حدث خطأ أثناء حفظ الصلاحيات' : 'An error occurred while saving permissions');
    } finally {
      setIsLoading(false);
    }
  };

  const resetToDefaults = () => {
    Alert.alert(
      isAr ? 'تأكيد' : 'Confirm',
      isAr ? 'هل تريد إعادة تعيين جميع الأدوات للظهور الافتراضي؟' : 'Do you want to reset all tools to default visibility?',
      [
        { text: isAr ? 'إلغاء' : 'Cancel', style: 'cancel' },
        {
          text: isAr ? 'تأكيد' : 'Confirm',
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
      {/* Header with Back Button */}
      <View style={{ flexDirection: isAr ? 'row' : 'row-reverse', alignItems: 'center', backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 12 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
          <MaterialIcons name={isAr ? "arrow-forward" : "arrow-back"} size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold', marginRight: isAr ? 12 : 0, marginLeft: isAr ? 0 : 12, flex: 1, textAlign: isAr ? 'right' : 'left' }}>
          {isAr ? 'صلاحيات الأدوات' : 'Tools Permissions'}
        </Text>
      </View>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View style={{ padding: 16, gap: 16 }}>
          {/* Header */}
          <View style={{ marginBottom: 8 }}>
            <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.foreground, marginBottom: 4, textAlign: isAr ? 'right' : 'left' }}>
              {isAr ? 'صلاحيات الأدوات الإضافية' : 'Additional Tools Permissions'}
            </Text>
            <Text style={{ fontSize: 14, color: colors.muted, textAlign: isAr ? 'right' : 'left' }}>
              {isAr ? 'حدد الأدوات التي يمكن للمستخدم الوصول إليها' : 'Select which tools the user can access'}
            </Text>
          </View>

          {/* User Selection */}
          <View>
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.foreground, marginBottom: 8, textAlign: isAr ? 'right' : 'left' }}>
              {isAr ? 'اختر المستخدم' : 'Select User'}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              {users.map((u: any) => (
                <TouchableOpacity
                  key={u.id}
                  onPress={() => selectUser(u)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    marginRight: 8,
                    borderRadius: 8,
                    backgroundColor: selectedUser?.id === u.id ? colors.primary : colors.surface,
                    borderWidth: 1,
                    borderColor: selectedUser?.id === u.id ? colors.primary : colors.border,
                  }}
                >
                  <Text style={{ color: selectedUser?.id === u.id ? '#fff' : colors.foreground, fontWeight: '600' }}>
                    {u.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Tools List */}
          <View>
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.foreground, marginBottom: 12, textAlign: isAr ? 'right' : 'left' }}>
              {isAr ? 'الأدوات المتاحة' : 'Available Tools'}
            </Text>
            {AVAILABLE_TOOLS.map((tool: Tool) => (
              <View
                key={tool.id}
                style={{
                  flexDirection: isAr ? 'row' : 'row-reverse',
                  alignItems: 'center',
                  paddingVertical: 12,
                  paddingHorizontal: 12,
                  marginBottom: 8,
                  backgroundColor: colors.surface,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <MaterialIcons name={tool.icon as any} size={24} color={tool.color} style={{ marginRight: isAr ? 12 : 0, marginLeft: isAr ? 0 : 12 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.foreground, textAlign: isAr ? 'right' : 'left' }}>
                    {isAr ? tool.labelAr : tool.labelEn}
                  </Text>
                </View>
                <Switch
                  value={userPermissions[tool.id] || false}
                  onValueChange={() => toggleToolPermission(tool.id)}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={userPermissions[tool.id] ? colors.primary : colors.muted}
                />
              </View>
            ))}
          </View>

          {/* Action Buttons */}
          <View style={{ flexDirection: isAr ? 'row' : 'row-reverse', gap: 12, marginTop: 16 }}>
            <TouchableOpacity
              onPress={savePermissions}
              disabled={isLoading}
              style={{
                flex: 1,
                paddingVertical: 12,
                backgroundColor: colors.primary,
                borderRadius: 8,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>
                {isLoading ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'حفظ الصلاحيات' : 'Save Permissions')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={resetToDefaults}
              style={{
                flex: 1,
                paddingVertical: 12,
                backgroundColor: colors.surface,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: colors.border,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: colors.foreground, fontWeight: '600', fontSize: 14 }}>
                {isAr ? 'إعادة تعيين' : 'Reset'}
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
