import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  FlatList,
  StyleSheet,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { MaterialIcons } from "@expo/vector-icons";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: "task" | "equipment" | "event" | "alert";
  timestamp: string;
  read: boolean;
  icon: string;
  color: string;
}

export default function NotificationsScreen() {
  const colors = useColors();
  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: "1",
      title: "انتهاء المهمة",
      message: "تم إكمال مهمة فحص الإنتاج بنجاح",
      type: "task",
      timestamp: "منذ 5 دقائق",
      read: false,
      icon: "check-circle",
      color: "#10B981",
    },
    {
      id: "2",
      title: "توقف الجهاز",
      message: "توقف جهاز الكاوية رقم 3 - يحتاج صيانة",
      type: "equipment",
      timestamp: "منذ 15 دقيقة",
      read: false,
      icon: "error",
      color: "#EF4444",
    },
    {
      id: "3",
      title: "حدث مهم",
      message: "تم تجاوز حد الإنتاج المخطط له بنسبة 20%",
      type: "event",
      timestamp: "منذ ساعة",
      read: true,
      icon: "trending-up",
      color: "#3B82F6",
    },
    {
      id: "4",
      title: "تنبيه",
      message: "معدل الهدر في الإنتاج أعلى من المعدل الطبيعي",
      type: "alert",
      timestamp: "منذ ساعتين",
      read: true,
      icon: "warning",
      color: "#F59E0B",
    },
    {
      id: "5",
      title: "انتهاء المهمة",
      message: "تم تسليم الطلب رقم 2024-001",
      type: "task",
      timestamp: "منذ 3 ساعات",
      read: true,
      icon: "check-circle",
      color: "#10B981",
    },
  ]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkAsRead = (id: string) => {
    setNotifications(
      notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      )
    );
  };

  const handleClearAll = () => {
    setNotifications(notifications.map((n) => ({ ...n, read: true })));
  };

  const renderNotification = (notification: Notification) => (
    <TouchableOpacity
      key={notification.id}
      onPress={() => handleMarkAsRead(notification.id)}
      style={{
        backgroundColor: notification.read ? colors.surface : colors.primary + "10",
        borderLeftWidth: 4,
        borderLeftColor: notification.color,
        paddingVertical: 12,
        paddingHorizontal: 16,
        marginBottom: 8,
        borderRadius: 8,
        flexDirection: "row",
        alignItems: "flex-start",
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: notification.color + "20",
          justifyContent: "center",
          alignItems: "center",
          marginRight: 12,
        }}
      >
        <MaterialIcons
          name={notification.icon as any}
          size={20}
          color={notification.color}
        />
      </View>

      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
          <Text
            style={{
              color: colors.foreground,
              fontSize: 13,
              fontWeight: notification.read ? "500" : "600",
              flex: 1,
            }}
          >
            {notification.title}
          </Text>
          {!notification.read && (
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: colors.primary,
                marginLeft: 8,
              }}
            />
          )}
        </View>
        <Text
          style={{
            color: colors.muted,
            fontSize: 12,
            marginTop: 4,
            marginBottom: 4,
          }}
        >
          {notification.message}
        </Text>
        <Text style={{ color: colors.muted, fontSize: 11 }}>
          {notification.timestamp}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <ScreenContainer style={{ backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        {/* رأس الصفحة */}
        <View
          style={{
            paddingHorizontal: 16,
            paddingTop: 16,
            paddingBottom: 12,
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <View>
            <Text
              style={{
                color: colors.foreground,
                fontSize: 24,
                fontWeight: "bold",
                marginBottom: 4,
              }}
            >
              الإشعارات
            </Text>
            {unreadCount > 0 && (
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {unreadCount} إشعارات جديدة
              </Text>
            )}
          </View>
          {unreadCount > 0 && (
            <TouchableOpacity
              onPress={handleClearAll}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                backgroundColor: colors.surface,
                borderRadius: 6,
              }}
            >
              <Text style={{ color: colors.primary, fontSize: 11, fontWeight: "500" }}>
                تحديد الكل
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* الإشعارات */}
        <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
          {notifications.length > 0 ? (
            notifications.map(renderNotification)
          ) : (
            <View
              style={{
                alignItems: "center",
                justifyContent: "center",
                paddingVertical: 48,
              }}
            >
              <MaterialIcons
                name="notifications-none"
                size={48}
                color={colors.muted}
              />
              <Text
                style={{
                  color: colors.muted,
                  fontSize: 14,
                  marginTop: 12,
                }}
              >
                لا توجد إشعارات
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
