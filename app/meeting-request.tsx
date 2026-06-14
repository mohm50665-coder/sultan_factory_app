import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  FlatList,
  Modal,
  ActivityIndicator,
  Linking,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { BackButton } from "@/components/back-button";
import { useColors } from "@/hooks/use-colors";
import { MaterialIcons } from "@expo/vector-icons";
import { meetingsService, adminService } from "@/lib/services/api.service";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";

interface Meeting {
  id: number | string;
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
  createdBy: string;
}

interface User {
  id: string;
  name: string;
  position?: string;
  department?: string;
}

export default function MeetingRequestScreen() {
  const router = useRouter();
  const colors = useColors();
  const { user } = useAuth();
  const { language, t, isRtl } = useLanguage();
  const isAr = language === "ar";
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showAttendeesPicker, setShowAttendeesPicker] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);

  const [form, setForm] = useState({
    title: "",
    date: "",
    time: "",
    location: "",
    method: "in_person" as "in_person" | "remote" | "hybrid",
    meetingLink: "",
    attendees: [] as string[],
    attachmentNames: [] as string[],
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [meetingsData, usersData] = await Promise.all([
        meetingsService.list(),
        adminService.getAllUsers(),
      ]);
      const mapped = (meetingsData || []).map((m: any) => ({
        id: m.id,
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
        createdBy: m.requestedBy || "",
      }));
      setMeetings(mapped);
      setAllUsers(usersData || []);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleNewMeeting = () => {
    setEditingMeeting(null);
    setForm({
      title: "",
      date: "",
      time: "",
      location: "",
      method: "in_person",
      meetingLink: "",
      attendees: [],
      attachmentNames: [],
    });
    setShowForm(true);
  };

  const handleEditMeeting = (meeting: Meeting) => {
    setEditingMeeting(meeting);
    setForm({
      title: meeting.title,
      date: meeting.date,
      time: meeting.time,
      location: meeting.location,
      method: meeting.method,
      meetingLink: meeting.meetingLink || "",
      attendees: meeting.attendees,
      attachmentNames: meeting.attachments,
    });
    setShowForm(true);
  };

  const handleSaveMeeting = async () => {
    if (!form.title || !form.date) {
      Alert.alert(t("error"), isAr ? "الرجاء إدخال عنوان الاجتماع والتاريخ" : "Please enter meeting title and date");
      return;
    }
    if (form.attendees.length === 0) {
      Alert.alert(t("error"), isAr ? "الرجاء تحديد الأعضاء المعنيين بالاجتماع" : "Please select meeting attendees");
      return;
    }

    try {
      if (editingMeeting) {
        // تعديل اجتماع موجود
        await meetingsService.update(Number(editingMeeting.id), {
          title: form.title,
          date: form.date,
          time: form.time,
          location: form.location,
          type: form.method,
          notes: form.meetingLink,
          attendees: form.attendees,
        });
      } else {
        // إنشاء اجتماع جديد
        const nextNumber = await meetingsService.getNextNumber();
        await meetingsService.create({
          meetingNumber: nextNumber || 1,
          title: form.title,
          date: form.date,
          time: form.time,
          location: form.location,
          type: form.method,
          notes: form.meetingLink,
          attendees: form.attendees,
          status: "scheduled",
          requestedBy: user?.name || (isAr ? "الأدمن" : "Admin"),
        });
      }

      await loadData();
      setShowForm(false);
      Alert.alert(t("success"), editingMeeting ? (isAr ? "تم تحديث الاجتماع" : "Meeting updated") : (isAr ? "تم جدولة الاجتماع بنجاح" : "Meeting scheduled successfully"));
    } catch (error) {
      Alert.alert(t("error"), isAr ? "فشل في حفظ الاجتماع" : "Failed to save meeting");
    }
  };

  const handleDeleteMeeting = (meeting: Meeting) => {
    Alert.alert(t("confirm_delete"), isAr ? `هل تريد حذف الاجتماع رقم #${meeting.meetingNumber}؟` : `Do you want to delete meeting #${meeting.meetingNumber}?`, [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("delete"),
        style: "destructive",
        onPress: async () => {
          try {
            await meetingsService.delete(Number(meeting.id));
            setMeetings(meetings.filter(m => m.id !== meeting.id));
          } catch (e) {
            Alert.alert(t("error"), isAr ? "فشل في حذف الاجتماع" : "Failed to delete meeting");
          }
        },
      },
    ]);
  };

  const handleStatusChange = async (meeting: Meeting, newStatus: "scheduled" | "completed" | "cancelled") => {
    try {
      await meetingsService.update(Number(meeting.id), { status: newStatus });
      setMeetings(meetings.map(m => m.id === meeting.id ? { ...m, status: newStatus } : m));
    } catch (e) {
      console.log("Error updating status:", e);
    }
  };

  const handleOpenLink = (link: string) => {
    if (!link || link.trim() === "") {
      Alert.alert(t("error"), isAr ? "لم يتم تحديد رابط للاجتماع" : "No meeting link provided");
      return;
    }
    const url = link.startsWith("http") ? link : "https://" + link;
    Linking.openURL(url).catch(() => Alert.alert(t("error"), isAr ? "لا يمكن فتح الرابط" : "Cannot open link"));
  };

  const toggleAttendee = (userId: string) => {
    setForm(prev => ({
      ...prev,
      attendees: prev.attendees.includes(userId)
        ? prev.attendees.filter(a => a !== userId)
        : [...prev.attendees, userId],
    }));
  };

  const addAttachment = () => {
    Alert.prompt ? Alert.prompt(isAr ? "إضافة مرفق" : "Add Attachment", isAr ? "أدخل اسم المرفق/النموذج" : "Enter attachment/form name", (name) => {
      if (name) setForm(prev => ({ ...prev, attachmentNames: [...prev.attachmentNames, name] }));
    }) : (() => {
      const name = (isAr ? "مرفق " : "Attachment ") + (form.attachmentNames.length + 1);
      setForm(prev => ({ ...prev, attachmentNames: [...prev.attachmentNames, name] }));
    })();
  };

  const getMethodLabel = (method: string) => {
    switch (method) {
      case "in_person": return isAr ? "حضوري" : "In Person";
      case "remote": return isAr ? "عن بعد" : "Remote";
      case "hybrid": return isAr ? "مختلط" : "Hybrid";
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
      case "scheduled": return t("meeting_pending");
      case "completed": return t("meeting_completed");
      case "cancelled": return isAr ? "ملغي" : "Cancelled";
      default: return status;
    }
  };

  const getUserName = (userId: string) => {
    const user = allUsers.find(u => u.id === userId);
    return user ? user.name : userId;
  };

  if (loading) {
    return (
      <ScreenContainer>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: "#1E3A5F" }]}>
        <BackButton />
        <Text style={styles.headerTitle}>{t("request_meeting")}</Text>
        <TouchableOpacity onPress={handleNewMeeting}>
          <MaterialIcons name="add-circle" size={28} color="white" />
        </TouchableOpacity>
      </View>

      {/* Meetings List */}
      <FlatList
        data={meetings}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        renderItem={({ item }) => (
          <View style={[styles.meetingCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {/* Header Row */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <View style={[styles.numBadge, { backgroundColor: "#1E3A5F" }]}>
                <Text style={{ color: "white", fontSize: 11, fontWeight: "bold" }}>#{item.meetingNumber}</Text>
              </View>
              <Text style={{ color: colors.foreground, fontWeight: "bold", fontSize: 14, flex: 1 }}>{item.title}</Text>
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + "20" }]}>
                <Text style={{ color: getStatusColor(item.status), fontSize: 10, fontWeight: "600" }}>
                  {getStatusLabel(item.status)}
                </Text>
              </View>
            </View>

            {/* Details */}
            <View style={{ gap: 4, marginBottom: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <MaterialIcons name="event" size={14} color={colors.muted} />
                <Text style={{ color: colors.muted, fontSize: 12 }}>{item.date} {item.time && `- ${item.time}`}</Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <MaterialIcons name="location-on" size={14} color={colors.muted} />
                <Text style={{ color: colors.muted, fontSize: 12 }}>{item.location || "—"} ({getMethodLabel(item.method)})</Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <MaterialIcons name="people" size={14} color={colors.muted} />
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  {item.attendees.length} {isAr ? "عضو:" : "Member:"} {item.attendees.map(a => getUserName(a)).join("، ")}
                </Text>
              </View>
              {item.attachments.length > 0 && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <MaterialIcons name="attach-file" size={14} color={colors.muted} />
                  <Text style={{ color: colors.muted, fontSize: 12 }}>{item.attachments.length} {isAr ? "مرفق" : "Attachment"}</Text>
                </View>
              )}
            </View>

            {/* Meeting Link */}
            {item.meetingLink && (
              <TouchableOpacity
                style={[styles.linkBtn, { backgroundColor: "#10B98120" }]}
                onPress={() => handleOpenLink(item.meetingLink!)}
              >
                <MaterialIcons name="link" size={16} color="#10B981" />
                <Text style={{ color: "#10B981", fontSize: 12, fontWeight: "600" }}>{isAr ? "الدخول للاجتماع" : "Join Meeting"}</Text>
              </TouchableOpacity>
            )}

            {/* Actions */}
            <View style={{ flexDirection: "row", gap: 6, marginTop: 8, borderTopWidth: 0.5, borderColor: colors.border, paddingTop: 8 }}>
              {item.status === "scheduled" && (
                <TouchableOpacity
                  style={[styles.actionChip, { backgroundColor: "#10B98120" }]}
                  onPress={() => handleStatusChange(item, "completed")}
                >
                  <MaterialIcons name="check" size={14} color="#10B981" />
                  <Text style={{ color: "#10B981", fontSize: 11 }}>{t("meeting_completed")}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.actionChip, { backgroundColor: colors.primary + "20" }]}
                onPress={() => handleEditMeeting(item)}
              >
                <MaterialIcons name="edit" size={14} color={colors.primary} />
                <Text style={{ color: colors.primary, fontSize: 11 }}>{t("edit")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionChip, { backgroundColor: "#EF444420" }]}
                onPress={() => handleDeleteMeeting(item)}
              >
                <MaterialIcons name="delete" size={14} color="#EF4444" />
                <Text style={{ color: "#EF4444", fontSize: 11 }}>{t("delete")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={{ alignItems: "center", paddingVertical: 60 }}>
            <MaterialIcons name="event-busy" size={56} color={colors.muted} />
            <Text style={{ color: colors.muted, marginTop: 12, fontSize: 15 }}>{t("no_meetings")}</Text>
            <TouchableOpacity style={[styles.emptyBtn, { backgroundColor: colors.primary }]} onPress={handleNewMeeting}>
              <Text style={{ color: "white", fontWeight: "600" }}>{isAr ? "جدولة اجتماع جديد" : "Schedule New Meeting"}</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* ===== NEW/EDIT MEETING FORM ===== */}
      <Modal visible={showForm} animationType="slide" transparent>
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderColor: colors.border }]}>
            <TouchableOpacity onPress={() => setShowForm(false)}>
              <Text style={{ color: colors.primary, fontWeight: "600" }}>{t("cancel")}</Text>
            </TouchableOpacity>
            <Text style={{ color: colors.foreground, fontWeight: "bold", fontSize: 16 }}>
              {editingMeeting ? (isAr ? `تعديل اجتماع #${editingMeeting.meetingNumber}` : `Edit Meeting #${editingMeeting.meetingNumber}`) : t("request_meeting")}
            </Text>
            <TouchableOpacity onPress={handleSaveMeeting}>
              <Text style={{ color: colors.primary, fontWeight: "bold" }}>{t("save")}</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
            {/* Title */}
            <View>
              <Text style={[styles.label, { color: colors.foreground }]}>isAr ? "عنوان الاجتماع *" : "Meeting Title *"</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
                value={form.title}
                onChangeText={t => setForm({ ...form, title: t })}
                placeholder={isAr ? "مثال: اجتماع مراجعة المناقصة" : "e.g. Tender Review Meeting"}
                placeholderTextColor={colors.muted}
              />
            </View>

            {/* Date & Time */}
            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: colors.foreground }]}>isAr ? "التاريخ *" : "Date *"</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
                  value={form.date}
                  onChangeText={t => setForm({ ...form, date: t })}
                  placeholder="2025/01/15"
                  placeholderTextColor={colors.muted}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: colors.foreground }]}>isAr ? "الوقت" : "Time"</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
                  value={form.time}
                  onChangeText={t => setForm({ ...form, time: t })}
                  placeholder="10:00 ص"
                  placeholderTextColor={colors.muted}
                />
              </View>
            </View>

            {/* Location */}
            <View>
              <Text style={[styles.label, { color: colors.foreground }]}>isAr ? "المكان" : "Location"</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
                value={form.location}
                onChangeText={t => setForm({ ...form, location: t })}
                placeholder={isAr ? "قاعة الاجتماعات / عن بعد" : "Meeting Room / Remote"}
                placeholderTextColor={colors.muted}
              />
            </View>

            {/* Method */}
            <View>
              <Text style={[styles.label, { color: colors.foreground }]}>isAr ? "وسيلة الاجتماع *" : "Meeting Method *"</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {[
                  { id: "in_person", label: isAr ? "حضوري" : "In Person", icon: "meeting-room" },
                  { id: "remote", label: isAr ? "عن بعد" : "Remote", icon: "videocam" },
                  { id: "hybrid", label: isAr ? "مختلط" : "Hybrid", icon: "devices" },
                ].map(opt => (
                  <TouchableOpacity
                    key={opt.id}
                    style={[styles.methodChip, {
                      backgroundColor: form.method === opt.id ? "#1E3A5F" : colors.surface,
                      borderColor: form.method === opt.id ? "#1E3A5F" : colors.border,
                    }]}
                    onPress={() => setForm({ ...form, method: opt.id as any })}
                  >
                    <MaterialIcons name={opt.icon as any} size={16} color={form.method === opt.id ? "white" : colors.foreground} />
                    <Text style={{ color: form.method === opt.id ? "white" : colors.foreground, fontSize: 12 }}>{opt.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Meeting Link */}
            {(form.method === "remote" || form.method === "hybrid") && (
              <View>
                <Text style={[styles.label, { color: colors.foreground }]}>isAr ? "رابط الاجتماع (Zoom, Teams, Google Meet...)" : "Meeting Link (Zoom, Teams, Google Meet...)"</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
                  value={form.meetingLink}
                  onChangeText={t => setForm({ ...form, meetingLink: t })}
                  placeholder="https://zoom.us/j/..."
                  placeholderTextColor={colors.muted}
                  keyboardType="url"
                />
              </View>
            )}

            {/* Attendees */}
            <View>
              <Text style={[styles.label, { color: colors.foreground }]}>isAr ? "الأعضاء المعنيون بالاجتماع *" : "Meeting Attendees *" ({form.attendees.length} isAr ? "عضو)" : "Member)"</Text>
              <TouchableOpacity
                style={[styles.selectBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => setShowAttendeesPicker(true)}
              >
                <MaterialIcons name="people" size={18} color={colors.primary} />
                <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "600" }}>isAr ? "اختيار الأعضاء" : "Select Members"</Text>
              </TouchableOpacity>
              {form.attendees.length > 0 && (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                  {form.attendees.map(userId => (
                    <View key={userId} style={[styles.attendeeChip, { backgroundColor: "#1E3A5F20" }]}>
                      <Text style={{ color: "#1E3A5F", fontSize: 11 }}>{getUserName(userId)}</Text>
                      <TouchableOpacity onPress={() => toggleAttendee(userId)}>
                        <MaterialIcons name="close" size={14} color="#1E3A5F" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* Attachments */}
            <View>
              <Text style={[styles.label, { color: colors.foreground }]}>isAr ? "المرفقات والنماذج" : "Attachments & Forms"</Text>
              <TouchableOpacity
                style={[styles.selectBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={addAttachment}
              >
                <MaterialIcons name="attach-file" size={18} color={colors.primary} />
                <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "600" }}>إضافة isAr ? "مرفق" : "Attachment"</Text>
              </TouchableOpacity>
              {form.attachmentNames.length > 0 && (
                <View style={{ gap: 4, marginTop: 8 }}>
                  {form.attachmentNames.map((name, idx) => (
                    <View key={idx} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <MaterialIcons name="description" size={16} color={colors.muted} />
                      <Text style={{ color: colors.foreground, fontSize: 12, flex: 1 }}>{name}</Text>
                      <TouchableOpacity onPress={() => setForm(prev => ({ ...prev, attachmentNames: prev.attachmentNames.filter((_, i) => i !== idx) }))}>
                        <MaterialIcons name="close" size={16} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* ===== ATTENDEES PICKER MODAL ===== */}
      <Modal visible={showAttendeesPicker} animationType="slide" transparent>
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderColor: colors.border }]}>
            <TouchableOpacity onPress={() => setShowAttendeesPicker(false)}>
              <Text style={{ color: colors.primary, fontWeight: "600" }}>{t("done")}</Text>
            </TouchableOpacity>
            <Text style={{ color: colors.foreground, fontWeight: "bold", fontSize: 16 }}>isAr ? "اختيار الأعضاء" : "Select Members"</Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>{form.attendees.length} isAr ? "محدد" : "Selected"</Text>
          </View>
          <FlatList
            data={allUsers}
            keyExtractor={item => String(item.id)}
            contentContainerStyle={{ padding: 16, gap: 6 }}
            renderItem={({ item }) => {
              const isSelected = form.attendees.includes(item.id);
              return (
                <TouchableOpacity
                  style={[styles.userItem, {
                    backgroundColor: isSelected ? colors.primary + "10" : colors.surface,
                    borderColor: isSelected ? colors.primary : colors.border,
                  }]}
                  onPress={() => toggleAttendee(item.id)}
                >
                  <View style={[styles.checkCircle, { borderColor: isSelected ? colors.primary : colors.border, backgroundColor: isSelected ? colors.primary : "transparent" }]}>
                    {isSelected && <MaterialIcons name="check" size={14} color="white" />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 14 }}>{item.name}</Text>
                    <Text style={{ color: colors.muted, fontSize: 11 }}>{item.position || item.department}</Text>
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </Modal>
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
  meetingCard: {
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
  },
  numBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  linkBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignSelf: "flex-start",
  },
  actionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  emptyBtn: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  modalContainer: {
    flex: 1,
    paddingTop: 40,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  label: {
    fontWeight: "600",
    marginBottom: 6,
    fontSize: 13,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  methodChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  selectBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  attendeeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  userItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
  },
});
