import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { BackButton } from "@/components/back-button";
import { useColors } from "@/hooks/use-colors";
import { MaterialIcons } from "@expo/vector-icons";
import { meetingsService } from "@/lib/services/api.service";

interface Meeting {
  id: string;
  meetingNumber: number;
  title: string;
  date: string;
  time: string;
  location: string;
  method: "in_person" | "remote" | "hybrid";
  meetingLink?: string;
  attendees: string[];
  attachments: string[];
  status: "scheduled" | "completed" | "cancelled";
  createdAt: string;
}

interface MeetingOutput {
  id: string;
  meetingId: string;
  meetingNumber: number;
  recommendations: string[];
  decisions: string[];
  attachments: string[];
  notes: string;
  createdAt: string;
}

export default function GovernmentTendersScreen() {
  const router = useRouter();
  const colors = useColors();
  const [recentMeetings, setRecentMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRecentMeetings();
  }, []);

  const loadRecentMeetings = async () => {
    try {
      const data = await meetingsService.list();
      if (data && Array.isArray(data)) {
        const mapped: Meeting[] = data.slice(0, 3).map((m: any) => ({
          id: String(m.id),
          meetingNumber: m.meetingNumber || 0,
          title: m.title || "",
          date: m.date || "",
          time: m.time || "",
          location: m.location || "",
          method: m.type || "in_person",
          meetingLink: m.notes || "",
          attendees: Array.isArray(m.attendees) ? m.attendees : [],
          attachments: [],
          status: m.status || "scheduled",
          createdAt: m.createdAt || "",
        }));
        setRecentMeetings(mapped);
      }
    } catch (error) {
      console.error("Error loading meetings:", error);
    } finally {
      setLoading(false);
    }
  };

  const menuItems = [
    {
      id: "tasks",
      title: "المهام",
      subtitle: "إدارة مهام المناقصات",
      icon: "assignment",
      color: "#3B82F6",
      route: "/tasks",
    },
    {
      id: "administrative",
      title: "الإجراءات الإدارية",
      subtitle: "إجراءات القسم الإدارية",
      icon: "admin-panel-settings",
      color: "#8B5CF6",
      route: "/administrative",
    },
    {
      id: "meeting_request",
      title: "طلب اجتماع",
      subtitle: "جدولة اجتماع جديد مع الأعضاء",
      icon: "groups",
      color: "#10B981",
      route: "/meeting-request",
    },
    {
      id: "meeting_outputs",
      title: "مخرجات الاجتماع",
      subtitle: "التوصيات والقرارات والمرفقات",
      icon: "summarize",
      color: "#F59E0B",
      route: "/meeting-outputs",
    },
  ];

  const getMethodLabel = (method: string) => {
    switch (method) {
      case "in_person": return "حضوري";
      case "remote": return "عن بعد";
      case "hybrid": return "مختلط";
      default: return method;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "scheduled": return "#3B82F6";
      case "completed": return "#10B981";
      case "cancelled": return "#EF4444";
      default: return colors.muted;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "scheduled": return "مجدول";
      case "completed": return "مكتمل";
      case "cancelled": return "ملغي";
      default: return status;
    }
  };

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: "#1E3A5F" }]}>
        <BackButton />
        <Text style={styles.headerTitle}>المناقصات الحكومية والعسكرية</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        {/* Menu Grid */}
        <View style={styles.grid}>
          {menuItems.map(item => (
            <TouchableOpacity
              key={item.id}
              style={[styles.menuCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => router.push(item.route as any)}
            >
              <View style={[styles.iconCircle, { backgroundColor: item.color + "20" }]}>
                <MaterialIcons name={item.icon as any} size={28} color={item.color} />
              </View>
              <Text style={[styles.menuTitle, { color: colors.foreground }]}>{item.title}</Text>
              <Text style={[styles.menuSubtitle, { color: colors.muted }]}>{item.subtitle}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Recent Meetings */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>آخر الاجتماعات</Text>
            <TouchableOpacity onPress={() => router.push("/meeting-request" as any)}>
              <Text style={{ color: colors.primary, fontSize: 12, fontWeight: "600" }}>عرض الكل</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator size="small" color={colors.primary} style={{ paddingVertical: 20 }} />
          ) : recentMeetings.length === 0 ? (
            <View style={{ alignItems: "center", paddingVertical: 24 }}>
              <MaterialIcons name="event-busy" size={36} color={colors.muted} />
              <Text style={{ color: colors.muted, marginTop: 8, fontSize: 13 }}>لا توجد اجتماعات مسجلة</Text>
            </View>
          ) : (
            recentMeetings.map(meeting => (
              <View key={meeting.id} style={[styles.meetingItem, { borderColor: colors.border }]}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <View style={[styles.meetingNumBadge, { backgroundColor: "#1E3A5F" }]}>
                    <Text style={{ color: "white", fontSize: 10, fontWeight: "bold" }}>#{meeting.meetingNumber}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.foreground, fontWeight: "bold", fontSize: 13 }}>{meeting.title}</Text>
                    <Text style={{ color: colors.muted, fontSize: 11 }}>{meeting.date} - {getMethodLabel(meeting.method)}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(meeting.status) + "20" }]}>
                    <Text style={{ color: getStatusColor(meeting.status), fontSize: 10, fontWeight: "600" }}>
                      {getStatusLabel(meeting.status)}
                    </Text>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Quick Stats */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: "#3B82F620", borderColor: "#3B82F640" }]}>
            <MaterialIcons name="event" size={20} color="#3B82F6" />
            <Text style={{ color: "#3B82F6", fontWeight: "bold", fontSize: 18, marginTop: 4 }}>
              {recentMeetings.filter(m => m.status === "scheduled").length}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 10 }}>اجتماعات قادمة</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: "#10B98120", borderColor: "#10B98140" }]}>
            <MaterialIcons name="check-circle" size={20} color="#10B981" />
            <Text style={{ color: "#10B981", fontWeight: "bold", fontSize: 18, marginTop: 4 }}>
              {recentMeetings.filter(m => m.status === "completed").length}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 10 }}>مكتملة</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: "#F59E0B20", borderColor: "#F59E0B40" }]}>
            <MaterialIcons name="people" size={20} color="#F59E0B" />
            <Text style={{ color: "#F59E0B", fontWeight: "bold", fontSize: 18, marginTop: 4 }}>
              {recentMeetings.reduce((sum, m) => sum + m.attendees.length, 0)}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 10 }}>إجمالي الحضور</Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerTitle: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  menuCard: {
    width: "47%",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    alignItems: "center",
    gap: 8,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
  },
  menuTitle: {
    fontSize: 13,
    fontWeight: "bold",
    textAlign: "center",
  },
  menuSubtitle: {
    fontSize: 10,
    textAlign: "center",
  },
  section: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "bold",
  },
  meetingItem: {
    paddingVertical: 10,
    borderBottomWidth: 0.5,
  },
  meetingNumBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  statsRow: {
    flexDirection: "row",
    gap: 8,
  },
  statCard: {
    flex: 1,
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
    borderWidth: 1,
  },
});
