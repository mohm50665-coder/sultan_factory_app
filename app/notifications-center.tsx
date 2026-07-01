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
import { useLanguage } from "@/lib/language-context";

interface NotificationGroup {
  date: string;
  notifications: Notification[];
}

export default function NotificationsCenterScreen() {
  const { language } = useLanguage();
  const isAr = language === "ar";
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
      Alert.alert(isAr ? "خطأ" : "Error", isAr ? "فشل في تحديث الإشعار" : "Failed to update notification");
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationService.markAllAsRead();
      loadNotifications();
    } catch (error) {
      Alert.alert(isAr ? "خطأ" : "Error", isAr ? "فشل في تحديث الإشعارات" : "Failed to update notifications");
    }
  };

  const handleDeleteNotification = async (notificationId: string) => {
    try {
      await notificationService.deleteNotification(notificationId);
      loadNotifications();
    } catch (error) {
      Alert.alert(isAr ? "خطأ" : "Error", isAr ? "فشل في حذف الإشعار" : "Failed to delete notification");
    }
  };

  const handleDeleteAllNotifications = async () => {
    Alert.alert(
      isAr ? "تأكيد" : "Confirm",
      isAr ? "هل أنت متأكد من حذف جميع الإشعارات؟" : "Are you sure you want to delete all notifications?",
      [
        { text: isAr ? "إلغاء" : "Cancel", onPress: () => {} },
        {
          text: isAr ? "حذف" : "Delete",
          onPress: async () => {
            try {
              await notificationService.deleteAllNotifications();
              loadNotifications();
            } catch (error) {
              Alert.alert(isAr ? "خطأ" : "Error", isAr ? "فشل في حذف الإشعارات" : "Failed to delete notifications");
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
      Alert.alert(isAr ? "خطأ" : "Error", isAr ? "فشل في تحديث الإعدادات" : "Failed to update settings");
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
      return isAr ? "اليوم" : "Today";
    } else if (d.toDateString() === yesterday.toDateString()) {
      return isAr ? "أمس" : "Yesterday";
    } else {
      return d.toLocaleDateString(isAr ? "ar-SA" : "en-US");
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
      style={{ flexDirection: isAr ? 'row' : 'row-reverse', alignItems: 'flex-start', padding: 16, borderBottomWidth: 1, borderColor: colors.border }}
    >
      <View
        style={{ width: 40, height: 40, borderRadius: 9999, alignItems: 'center', justifyContent: 'center', marginRight: isAr ? 12 : 0, marginLeft: isAr ? 0 : 12, backgroundColor: getNotificationColor(notification.type) + "20", }}
      >
        <MaterialIcons
          name={getNotificationIcon(notification.type) as any}
          size={20}
          color={getNotificationColor(notification.type)}
        />
      </View>

      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: isAr ? 'row' : 'row-reverse', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: colors.foreground, fontWeight: '600', fontSize: 14, textAlign: isAr ? "right" : "left" }}>
            {notification.title}
          </Text>
          {!notification.read && (
            <View style={{ width: 8, height: 8, borderRadius: 9999, backgroundColor: colors.primary }} />
          )}
        </View>
        <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4, textAlign: isAr ? "right" : "left" }}>
          {notification.body}
        </Text>
        <Text style={{ color: colors.muted, fontSize: 12, marginTop: 8, textAlign: isAr ? "right" : "left" }}>
          {new Date(notification.timestamp).toLocaleTimeString(isAr ? "ar-SA" : "en-US", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
      </View>

      <TouchableOpacity
        onPress={() => handleDeleteNotification(notification.id)}
        style={{ marginLeft: isAr ? 8 : 0, marginRight: isAr ? 0 : 8, padding: 4 }}
      >
        <MaterialIcons name="close" size={18} color={colors.muted} />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <ScreenContainer style={{ backgroundColor: colors.background }}>
      {/* رأس الصفحة */}
      <View style={{ paddingHorizontal: 24, paddingVertical: 24, flexDirection: isAr ? 'row' : 'row-reverse', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: isAr ? 'row' : 'row-reverse', alignItems: 'center', flex: 1 }}>
          <BackButton />
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#ffffff', fontWeight: 'bold', fontSize: 20, textAlign: isAr ? "right" : "left" }}>{isAr ? "الإشعارات" : "Notifications"}</Text>
            <Text style={{ fontSize: 14, marginTop: 4, textAlign: isAr ? "right" : "left" }}>
              {notifications.filter((n) => !n.read).length} {isAr ? "إشعارات جديدة" : "new notifications"}
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
            <Text style={{ color: colors.foreground, fontWeight: 'bold', fontSize: 16, marginBottom: 16, textAlign: isAr ? "right" : "left" }}>
              {isAr ? "إعدادات الإشعارات" : "Notification Settings"}
            </Text>

            {/* إعدادات أنواع الإشعارات */}
            <View style={{ backgroundColor: colors.surface, borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, marginBottom: 24 }}>
              <View style={{ flexDirection: isAr ? 'row' : 'row-reverse', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderColor: colors.border }}>
                <View style={{ flexDirection: isAr ? 'row' : 'row-reverse', alignItems: 'center', flex: 1 }}>
                  <MaterialIcons name="task-alt" size={20} color={colors.primary} />
                  <Text style={{ color: colors.foreground, fontWeight: '600', fontSize: 14, marginLeft: isAr ? 12 : 0, marginRight: isAr ? 0 : 12, textAlign: isAr ? "right" : "left" }}>
                    {isAr ? "إشعارات المهام المكتملة" : "Completed Tasks Notifications"}
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

              <View style={{ flexDirection: isAr ? 'row' : 'row-reverse', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderColor: colors.border }}>
                <View style={{ flexDirection: isAr ? 'row' : 'row-reverse', alignItems: 'center', flex: 1 }}>
                  <MaterialIcons name="error" size={20} color={colors.primary} />
                  <Text style={{ color: colors.foreground, fontWeight: '600', fontSize: 14, marginLeft: isAr ? 12 : 0, marginRight: isAr ? 0 : 12, textAlign: isAr ? "right" : "left" }}>
                    {isAr ? "إشعارات توقف الأجهزة" : "Equipment Stopped Notifications"}
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

              <View style={{ flexDirection: isAr ? 'row' : 'row-reverse', alignItems: 'center', justifyContent: 'space-between', padding: 16 }}>
                <View style={{ flexDirection: isAr ? 'row' : 'row-reverse', alignItems: 'center', flex: 1 }}>
                  <MaterialIcons name="warning" size={20} color={colors.primary} />
                  <Text style={{ color: colors.foreground, fontWeight: '600', fontSize: 14, marginLeft: isAr ? 12 : 0, marginRight: isAr ? 0 : 12, textAlign: isAr ? "right" : "left" }}>
                    {isAr ? "إشعارات تجاوز الهدر" : "Waste Exceeded Notifications"}
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
            <Text style={{ color: colors.foreground, fontWeight: 'bold', fontSize: 16, marginBottom: 16, textAlign: isAr ? "right" : "left" }}>
              {isAr ? "إعدادات الصوت والاهتزاز" : "Sound and Vibration Settings"}
            </Text>

            <View style={{ backgroundColor: colors.surface, borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}>
              <View style={{ flexDirection: isAr ? 'row' : 'row-reverse', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderColor: colors.border }}>
                <View style={{ flexDirection: isAr ? 'row' : 'row-reverse', alignItems: 'center', flex: 1 }}>
                  <MaterialIcons name="volume-up" size={20} color={colors.primary} />
                  <Text style={{ color: colors.foreground, fontWeight: '600', fontSize: 14, marginLeft: isAr ? 12 : 0, marginRight: isAr ? 0 : 12, textAlign: isAr ? "right" : "left" }}>
                    {isAr ? "تفعيل الصوت" : "Enable Sound"}
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

              <View style={{ flexDirection: isAr ? 'row' : 'row-reverse', alignItems: 'center', justifyContent: 'space-between', padding: 16 }}>
                <View style={{ flexDirection: isAr ? 'row' : 'row-reverse', alignItems: 'center', flex: 1 }}>
                  <MaterialIcons name="vibration" size={20} color={colors.primary} />
                  <Text style={{ color: colors.foreground, fontWeight: '600', fontSize: 14, marginLeft: isAr ? 12 : 0, marginRight: isAr ? 0 : 12, textAlign: isAr ? "right" : "left" }}>
                    {isAr ? "تفعيل الاهتزاز" : "Enable Vibration"}
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
                {isAr ? "العودة للإشعارات" : "Back to Notifications"}
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
              <Text style={{ color: colors.foreground, fontWeight: '600', fontSize: 16, marginTop: 16, textAlign: isAr ? "right" : "left" }}>
                {isAr ? "لا توجد إشعارات" : "No notifications"}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 14, marginTop: 8, textAlign: isAr ? "center" : "center" }}>
                {isAr ? "ستظهر الإشعارات هنا عند حدوث أحداث مهمة في النظام" : "Notifications will appear here when important events occur in the system"}
              </Text>
            </View>
          ) : (
            <>
              {/* أزرار الإجراءات */}
              <View style={{ paddingHorizontal: 24, paddingVertical: 16, flexDirection: isAr ? 'row' : 'row-reverse', gap: 8 }}>
                {notifications.some((n) => !n.read) && (
                  <TouchableOpacity
                    onPress={handleMarkAllAsRead}
                    style={{ flex: 1, backgroundColor: colors.primary, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Text style={{ color: '#ffffff', fontWeight: '600', fontSize: 14 }}>
                      {isAr ? "تحديد الكل كمقروء" : "Mark all as read"}
                    </Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={handleDeleteAllNotifications}
                  style={{ flex: 1, backgroundColor: colors.error + '33', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.error }}
                >
                  <Text style={{ color: colors.error, fontWeight: '600', fontSize: 14 }}>
                    {isAr ? "حذف الكل" : "Delete all"}
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
                      <Text style={{ color: colors.muted, fontWeight: '600', fontSize: 12, textAlign: isAr ? "right" : "left" }}>
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
