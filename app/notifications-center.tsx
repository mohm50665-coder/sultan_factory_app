import React, { useState, useEffect } from "react";
import { BackButton } from "@/components/back-button";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Switch,
  Alert,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { MaterialIcons } from "@expo/vector-icons";
import {
  notificationService,
  Notification,
} from "@/lib/services/notification.service";

interface NotificationGroup {
  date: string;
  notifications: Notification[];
}

export default function NotificationsCenterScreen() {
  const router = useRouter();
  const colors = useColors();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState({
    taskCompleted: true,
    equipmentStopped: true,
    wasteExceeded: true,
    alerts: true,
    soundEnabled: true,
    vibrationEnabled: true,
  });

  useFocusEffect(
    React.useCallback(() => {
      loadNotifications();
    }, [])
  );

  const loadNotifications = async () => {
    try {
      setIsLoading(true);
      const allNotifications = await notificationService.getAllNotifications();
      setNotifications(allNotifications);

      const currentSettings = await notificationService.getSettings();
      setSettings(currentSettings);
    } catch (error) {
      console.error("Error loading notifications:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await notificationService.markAsRead(notificationId);
      loadNotifications();
    } catch (error) {
      Alert.alert("خطأ", "فشل في تحديث الإشعار");
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationService.markAllAsRead();
      loadNotifications();
    } catch (error) {
      Alert.alert("خطأ", "فشل في تحديث الإشعارات");
    }
  };

  const handleDeleteNotification = async (notificationId: string) => {
    try {
      await notificationService.deleteNotification(notificationId);
      loadNotifications();
    } catch (error) {
      Alert.alert("خطأ", "فشل في حذف الإشعار");
    }
  };

  const handleDeleteAllNotifications = async () => {
    Alert.alert(
      "تأكيد",
      "هل أنت متأكد من حذف جميع الإشعارات؟",
      [
        { text: "إلغاء", onPress: () => {} },
        {
          text: "حذف",
          onPress: async () => {
            try {
              await notificationService.deleteAllNotifications();
              loadNotifications();
            } catch (error) {
              Alert.alert("خطأ", "فشل في حذف الإشعارات");
            }
          },
        },
      ]
    );
  };

  const handleSettingChange = async (key: string, value: boolean) => {
    try {
      const newSettings = { ...settings, [key]: value };
      setSettings(newSettings);
      await notificationService.updateSettings(newSettings);
    } catch (error) {
      Alert.alert("خطأ", "فشل في تحديث الإعدادات");
    }
  };

  const getNotificationIcon = (type: Notification["type"]) => {
    switch (type) {
      case "task_completed":
        return "check-circle";
      case "equipment_stopped":
        return "error";
      case "waste_exceeded":
        return "warning";
      case "alert":
        return "notifications-active";
      case "info":
        return "info";
      default:
        return "notifications";
    }
  };

  const getNotificationColor = (type: Notification["type"]) => {
    switch (type) {
      case "task_completed":
        return "#22c55e";
      case "equipment_stopped":
        return "#ef4444";
      case "waste_exceeded":
        return "#f59e0b";
      case "alert":
        return "#ef4444";
      case "info":
        return "#0a7ea4";
      default:
        return colors.primary;
    }
  };

  const formatDate = (date: Date) => {
    const d = new Date(date);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (d.toDateString() === today.toDateString()) {
      return "اليوم";
    } else if (d.toDateString() === yesterday.toDateString()) {
      return "أمس";
    } else {
      return d.toLocaleDateString("ar-SA");
    }
  };

  const groupNotificationsByDate = (): NotificationGroup[] => {
    const groups: Record<string, Notification[]> = {};

    notifications.forEach((notif) => {
      const dateKey = formatDate(notif.timestamp);
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(notif);
    });

    return Object.entries(groups).map(([date, notifs]) => ({
      date,
      notifications: notifs,
    }));
  };

  const renderNotificationItem = (notification: Notification) => (
    <TouchableOpacity
      key={notification.id}
      onPress={() => handleMarkAsRead(notification.id)}
      style={{ flexDirection: 'row', alignItems: 'flex-start', padding: 16, borderBottomWidth: 1, borderColor: colors.border }}
    >
      <View
        style={{ width: 40, height: 40, borderRadius: 9999, alignItems: 'center', justifyContent: 'center', marginRight: 12, backgroundColor: getNotificationColor(notification.type) + "20", }}
      >
        <MaterialIcons
          name={getNotificationIcon(notification.type) as any}
          size={20}
          color={getNotificationColor(notification.type)}
        />
      </View>

      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: colors.foreground, fontWeight: '600', fontSize: 14 }}>
            {notification.title}
          </Text>
          {!notification.read && (
            <View style={{ width: 8, height: 8, borderRadius: 9999, backgroundColor: colors.primary }} />
          )}
        </View>
        <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
          {notification.body}
        </Text>
        <Text style={{ color: colors.muted, fontSize: 12, marginTop: 8 }}>
          {new Date(notification.timestamp).toLocaleTimeString("ar-SA", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
      </View>

      <TouchableOpacity
        onPress={() => handleDeleteNotification(notification.id)}
        style={{ marginLeft: 8, padding: 4 }}
      >
        <MaterialIcons name="close" size={18} color={colors.muted} />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <ScreenContainer style={{ backgroundColor: colors.background }}>
      {/* رأس الصفحة */}
      <View style={{ paddingHorizontal: 24, paddingVertical: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <BackButton />
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#ffffff', fontWeight: 'bold', fontSize: 20 }}>الإشعارات</Text>
            <Text style={{ fontSize: 14, marginTop: 4 }}>
              {notifications.filter((n) => !n.read).length} إشعارات جديدة
            </Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={() => setShowSettings(!showSettings)}
          style={{ borderRadius: 9999, padding: 8 }}
        >
          <MaterialIcons name="settings" size={20} color="white" />
        </TouchableOpacity>
      </View>

      {showSettings ? (
        // شاشة الإعدادات
        <ScrollView style={{ flex: 1 }}>
          <View style={{ padding: 24 }}>
            <Text style={{ color: colors.foreground, fontWeight: 'bold', fontSize: 16, marginBottom: 16 }}>
              إعدادات الإشعارات
            </Text>

            {/* إعدادات أنواع الإشعارات */}
            <View style={{ backgroundColor: colors.surface, borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, marginBottom: 24 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderColor: colors.border }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <MaterialIcons name="task-alt" size={20} color={colors.primary} />
                  <Text style={{ color: colors.foreground, fontWeight: '600', fontSize: 14, marginLeft: 12 }}>
                    إشعارات المهام المكتملة
                  </Text>
                </View>
                <Switch
                  value={settings.taskCompleted}
                  onValueChange={(value) =>
                    handleSettingChange("taskCompleted", value)
                  }
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={settings.taskCompleted ? colors.primary : colors.muted}
                />
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderColor: colors.border }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <MaterialIcons name="error" size={20} color={colors.primary} />
                  <Text style={{ color: colors.foreground, fontWeight: '600', fontSize: 14, marginLeft: 12 }}>
                    إشعارات توقف الأجهزة
                  </Text>
                </View>
                <Switch
                  value={settings.equipmentStopped}
                  onValueChange={(value) =>
                    handleSettingChange("equipmentStopped", value)
                  }
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={settings.equipmentStopped ? colors.primary : colors.muted}
                />
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <MaterialIcons name="warning" size={20} color={colors.primary} />
                  <Text style={{ color: colors.foreground, fontWeight: '600', fontSize: 14, marginLeft: 12 }}>
                    إشعارات تجاوز الهدر
                  </Text>
                </View>
                <Switch
                  value={settings.wasteExceeded}
                  onValueChange={(value) =>
                    handleSettingChange("wasteExceeded", value)
                  }
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={settings.wasteExceeded ? colors.primary : colors.muted}
                />
              </View>
            </View>

            {/* إعدادات الصوت والاهتزاز */}
            <Text style={{ color: colors.foreground, fontWeight: 'bold', fontSize: 16, marginBottom: 16 }}>
              إعدادات الصوت والاهتزاز
            </Text>

            <View style={{ backgroundColor: colors.surface, borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderColor: colors.border }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <MaterialIcons name="volume-up" size={20} color={colors.primary} />
                  <Text style={{ color: colors.foreground, fontWeight: '600', fontSize: 14, marginLeft: 12 }}>
                    تفعيل الصوت
                  </Text>
                </View>
                <Switch
                  value={settings.soundEnabled}
                  onValueChange={(value) =>
                    handleSettingChange("soundEnabled", value)
                  }
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={settings.soundEnabled ? colors.primary : colors.muted}
                />
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <MaterialIcons name="vibration" size={20} color={colors.primary} />
                  <Text style={{ color: colors.foreground, fontWeight: '600', fontSize: 14, marginLeft: 12 }}>
                    تفعيل الاهتزاز
                  </Text>
                </View>
                <Switch
                  value={settings.vibrationEnabled}
                  onValueChange={(value) =>
                    handleSettingChange("vibrationEnabled", value)
                  }
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={settings.vibrationEnabled ? colors.primary : colors.muted}
                />
              </View>
            </View>

            {/* زر العودة */}
            <TouchableOpacity
              onPress={() => setShowSettings(false)}
              style={{ backgroundColor: colors.primary, borderRadius: 8, padding: 16, alignItems: 'center', justifyContent: 'center', marginTop: 24 }}
            >
              <Text style={{ color: '#ffffff', fontWeight: '600', fontSize: 16 }}>
                العودة للإشعارات
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      ) : (
        // شاشة الإشعارات
        <>
          {isLoading ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : notifications.length === 0 ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
              <MaterialIcons name="notifications-none" size={64} color={colors.muted} />
              <Text style={{ color: colors.foreground, fontWeight: '600', fontSize: 16, marginTop: 16 }}>
                لا توجد إشعارات
              </Text>
              <Text style={{ color: colors.muted, fontSize: 14, marginTop: 8, textAlign: 'center' }}>
                ستظهر الإشعارات هنا عند حدوث أحداث مهمة في النظام
              </Text>
            </View>
          ) : (
            <>
              {/* أزرار الإجراءات */}
              <View style={{ paddingHorizontal: 24, paddingVertical: 16, flexDirection: 'row', gap: 8 }}>
                {notifications.some((n) => !n.read) && (
                  <TouchableOpacity
                    onPress={handleMarkAllAsRead}
                    style={{ flex: 1, backgroundColor: colors.primary, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Text style={{ color: '#ffffff', fontWeight: '600', fontSize: 14 }}>
                      تحديد الكل كمقروء
                    </Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={handleDeleteAllNotifications}
                  style={{ flex: 1, backgroundColor: colors.error + '33', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.error }}
                >
                  <Text style={{ color: colors.error, fontWeight: '600', fontSize: 14 }}>
                    حذف الكل
                  </Text>
                </TouchableOpacity>
              </View>

              {/* قائمة الإشعارات */}
              <FlatList
                data={groupNotificationsByDate()}
                keyExtractor={(item) => item.date}
                renderItem={({ item: group }) => (
                  <View>
                    <View style={{ paddingHorizontal: 24, paddingVertical: 12, backgroundColor: colors.background }}>
                      <Text style={{ color: colors.muted, fontWeight: '600', fontSize: 12 }}>
                        {group.date}
                      </Text>
                    </View>
                    {group.notifications.map(renderNotificationItem)}
                  </View>
                )}
              />
            </>
          )}
        </>
      )}
    </ScreenContainer>
  );
}
