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
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { BackButton } from "@/components/back-button";
import { useColors } from "@/hooks/use-colors";
import { useLanguage } from "@/lib/language-context";
import { MaterialIcons } from "@expo/vector-icons";
import { meetingsService, meetingOutputsService } from "@/lib/services/api.service";

interface Meeting {
  id: string;
  meetingNumber: number;
  title: string;
  date: string;
  status: string;
}

interface MeetingOutput {
  id: string;
  meetingId: string;
  meetingNumber: number;
  meetingTitle: string;
  recommendations: string[];
  decisions: string[];
  actionItems: { task: string; assignee: string; deadline: string }[];
  attachments: string[];
  notes: string;
  createdAt: string;
}

export default function MeetingOutputsScreen() {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const router = useRouter();
  const colors = useColors();
  const [outputs, setOutputs] = useState<MeetingOutput[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingOutput, setEditingOutput] = useState<MeetingOutput | null>(null);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [showMeetingPicker, setShowMeetingPicker] = useState(false);

  const [form, setForm] = useState({
    recommendations: [""],
    decisions: [""],
    actionItems: [{ task: "", assignee: "", deadline: "" }],
    attachments: [] as string[],
    notes: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [meetingsData, outputsData] = await Promise.all([
        meetingsService.list(),
        meetingOutputsService.list(),
      ]);
      const mappedMeetings = (meetingsData || []).map((m: any) => ({
        id: String(m.id),
        meetingNumber: m.meetingNumber || 0,
        title: m.title || "",
        date: m.date || "",
        status: m.status || "scheduled",
      }));
      const mappedOutputs = (outputsData || []).map((o: any) => ({
        id: String(o.id),
        meetingId: String(o.meetingId),
        meetingNumber: 0,
        meetingTitle: o.description || "",
        recommendations: [],
        decisions: [],
        actionItems: [],
        attachments: [],
        notes: o.assignedTo || "",
        createdAt: o.createdAt || "",
      }));
      setMeetings(mappedMeetings);
      setOutputs(mappedOutputs);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleNewOutput = () => {
    setEditingOutput(null);
    setSelectedMeeting(null);
    setForm({
      recommendations: [""],
      decisions: [""],
      actionItems: [{ task: "", assignee: "", deadline: "" }],
      attachments: [],
      notes: "",
    });
    setShowForm(true);
  };

  const handleEditOutput = (output: MeetingOutput) => {
    setEditingOutput(output);
    const meeting = meetings.find(m => m.id === output.meetingId);
    setSelectedMeeting(meeting || null);
    setForm({
      recommendations: output.recommendations.length > 0 ? output.recommendations : [""],
      decisions: output.decisions.length > 0 ? output.decisions : [""],
      actionItems: output.actionItems.length > 0 ? output.actionItems : [{ task: "", assignee: "", deadline: "" }],
      attachments: output.attachments,
      notes: output.notes,
    });
    setShowForm(true);
  };

  const handleSaveOutput = async () => {
    if (!selectedMeeting) {
      Alert.alert(isAr ? "خطأ" : "Error", isAr ? "الرجاء اختيار الاجتماع" : "Please select a meeting");
      return;
    }

    const cleanRecommendations = form.recommendations.filter(r => r.trim());
    const cleanDecisions = form.decisions.filter(d => d.trim());
    const cleanActionItems = form.actionItems.filter(a => a.task.trim());

    if (cleanRecommendations.length === 0 && cleanDecisions.length === 0) {
      Alert.alert(isAr ? "خطأ" : "Error", isAr ? "الرجاء إدخال توصية أو قرار واحد على الأقل" : "Please enter at least one recommendation or decision");
      return;
    }

    try {
      const description = [
        ...cleanRecommendations.map(r => `[${isAr ? "توصية" : "Recommendation"}] ${r}`),
        ...cleanDecisions.map(d => `[${isAr ? "قرار" : "Decision"}] ${d}`),
        ...cleanActionItems.map(a => `[${isAr ? "مهمة" : "Task"}] ${a.task} - ${a.assignee} - ${a.deadline}`),
      ].join(" | ");

      if (editingOutput) {
        await meetingOutputsService.update(Number(editingOutput.id), {
          description,
          assignedTo: form.notes,
        });
      } else {
        await meetingOutputsService.create({
          meetingId: Number(selectedMeeting.id),
          description,
          assignedTo: form.notes,
          status: "pending",
        });
      }

      await loadData();
      setShowForm(false);
      Alert.alert(isAr ? "نجح" : "Success", editingOutput ? (isAr ? "تم تحديث المخرجات" : "Outputs updated") : (isAr ? "تم حفظ مخرجات الاجتماع" : "Meeting outputs saved"));
    } catch (error) {
      Alert.alert(isAr ? "خطأ" : "Error", isAr ? "فشل في الحفظ" : "Failed to save");
    }
  };

  const handleDeleteOutput = (output: MeetingOutput) => {
    Alert.alert(isAr ? "تأكيد" : "Confirm", isAr ? "هل تريد حذف مخرجات هذا الاجتماع؟" : "Do you want to delete this meeting's outputs?", [
      { text: isAr ? "إلغاء" : "Cancel", style: "cancel" },
      {
        text: isAr ? "حذف" : "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await meetingOutputsService.delete(Number(output.id));
            setOutputs(outputs.filter(o => o.id !== output.id));
          } catch (e) {
            Alert.alert(isAr ? "خطأ" : "Error", isAr ? "فشل في الحذف" : "Failed to delete");
          }
        },
      },
    ]);
  };

  const addRecommendation = () => setForm(prev => ({ ...prev, recommendations: [...prev.recommendations, ""] }));
  const addDecision = () => setForm(prev => ({ ...prev, decisions: [...prev.decisions, ""] }));
  const addActionItem = () => setForm(prev => ({ ...prev, actionItems: [...prev.actionItems, { task: "", assignee: "", deadline: "" }] }));

  const addAttachment = () => {
    const name = (isAr ? "مرفق " : "Attachment ") + (form.attachments.length + 1);
    setForm(prev => ({ ...prev, attachments: [...prev.attachments, name] }));
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
        <Text style={styles.headerTitle}>{isAr ? "مخرجات الاجتماع" : "Meeting Outputs"}</Text>
        <TouchableOpacity onPress={handleNewOutput}>
          <MaterialIcons name="add-circle" size={28} color="white" />
        </TouchableOpacity>
      </View>

      {/* Outputs List */}
      <FlatList
        data={outputs}
        keyExtractor={item => item.id}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {/* Header */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <View style={[styles.numBadge, { backgroundColor: "#F59E0B" }]}>
                <Text style={{ color: "white", fontSize: 11, fontWeight: "bold" }}>#{item.meetingNumber}</Text>
              </View>
              <Text style={{ color: colors.foreground, fontWeight: "bold", fontSize: 14, flex: 1 }}>{item.meetingTitle}</Text>
            </View>

            {/* Recommendations */}
            {item.recommendations.length > 0 && (
              <View style={{ marginBottom: 8 }}>
                <Text style={{ color: colors.primary, fontWeight: "bold", fontSize: 12, marginBottom: 4 }}>{isAr ? "التوصيات:" : "Recommendations:"}</Text>
                {item.recommendations.map((rec, idx) => (
                  <View key={idx} style={{ flexDirection: "row", gap: 6, marginBottom: 2 }}>
                    <Text style={{ color: "#10B981", fontSize: 12 }}>•</Text>
                    <Text style={{ color: colors.foreground, fontSize: 12, flex: 1 }}>{rec}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Decisions */}
            {item.decisions.length > 0 && (
              <View style={{ marginBottom: 8 }}>
                <Text style={{ color: "#8B5CF6", fontWeight: "bold", fontSize: 12, marginBottom: 4 }}>{isAr ? "القرارات:" : "Decisions:"}</Text>
                {item.decisions.map((dec, idx) => (
                  <View key={idx} style={{ flexDirection: "row", gap: 6, marginBottom: 2 }}>
                    <Text style={{ color: "#8B5CF6", fontSize: 12 }}>•</Text>
                    <Text style={{ color: colors.foreground, fontSize: 12, flex: 1 }}>{dec}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Action Items */}
            {item.actionItems.length > 0 && (
              <View style={{ marginBottom: 8 }}>
                <Text style={{ color: "#F59E0B", fontWeight: "bold", fontSize: 12, marginBottom: 4 }}>{isAr ? "بنود العمل:" : "Action Items:"}</Text>
                {item.actionItems.map((ai, idx) => (
                  <View key={idx} style={{ flexDirection: "row", gap: 6, marginBottom: 2 }}>
                    <MaterialIcons name="assignment-turned-in" size={14} color="#F59E0B" />
                    <Text style={{ color: colors.foreground, fontSize: 12, flex: 1 }}>
                      {ai.task} {ai.assignee ? `(${ai.assignee})` : ""} {ai.deadline ? `- ${ai.deadline}` : ""}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Attachments */}
            {item.attachments.length > 0 && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <MaterialIcons name="attach-file" size={14} color={colors.muted} />
                <Text style={{ color: colors.muted, fontSize: 11 }}>{item.attachments.length} {isAr ? "مرفق" : "Attachment(s)"}</Text>
              </View>
            )}

            {/* Actions */}
            <View style={{ flexDirection: "row", gap: 6, borderTopWidth: 0.5, borderColor: colors.border, paddingTop: 8 }}>
              <TouchableOpacity
                style={[styles.actionChip, { backgroundColor: colors.primary + "20" }]}
                onPress={() => handleEditOutput(item)}
              >
                <MaterialIcons name="edit" size={14} color={colors.primary} />
                <Text style={{ color: colors.primary, fontSize: 11 }}>{isAr ? "تعديل" : "Edit"}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionChip, { backgroundColor: "#EF444420" }]}
                onPress={() => handleDeleteOutput(item)}
              >
                <MaterialIcons name="delete" size={14} color="#EF4444" />
                <Text style={{ color: "#EF4444", fontSize: 11 }}>{isAr ? "حذف" : "Delete"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={{ alignItems: "center", paddingVertical: 60 }}>
            <MaterialIcons name="summarize" size={56} color={colors.muted} />
            <Text style={{ color: colors.muted, marginTop: 12, fontSize: 15 }}>{isAr ? "لا توجد مخرجات مسجلة" : "No outputs recorded"}</Text>
            <TouchableOpacity style={[styles.emptyBtn, { backgroundColor: colors.primary }]} onPress={handleNewOutput}>
              <Text style={{ color: "white", fontWeight: "600" }}>{isAr ? "إضافة مخرجات اجتماع" : "Add Meeting Outputs"}</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* ===== NEW/EDIT OUTPUT FORM ===== */}
      <Modal visible={showForm} animationType="slide" transparent>
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderColor: colors.border }]}>
            <TouchableOpacity onPress={() => setShowForm(false)}>
              <Text style={{ color: colors.primary, fontWeight: "600" }}>{isAr ? "إلغاء" : "Cancel"}</Text>
            </TouchableOpacity>
            <Text style={{ color: colors.foreground, fontWeight: "bold", fontSize: 16 }}>
              {editingOutput ? (isAr ? "تعديل المخرجات" : "Edit Outputs") : (isAr ? "إضافة مخرجات اجتماع" : "Add Meeting Outputs")}
            </Text>
            <TouchableOpacity onPress={handleSaveOutput}>
              <Text style={{ color: colors.primary, fontWeight: "bold" }}>{isAr ? "حفظ" : "Save"}</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
            {/* Select Meeting */}
            <View>
              <Text style={[styles.label, { color: colors.foreground }]}>{isAr ? "اختر الاجتماع *" : "Select Meeting *"}</Text>
              <TouchableOpacity
                style={[styles.selectBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => setShowMeetingPicker(true)}
              >
                <MaterialIcons name="event" size={18} color={colors.primary} />
                <Text style={{ color: selectedMeeting ? colors.foreground : colors.muted, fontSize: 13, flex: 1 }}>
                  {selectedMeeting ? `#${selectedMeeting.meetingNumber} - ${selectedMeeting.title}` : (isAr ? "اختر الاجتماع" : "Select Meeting")}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Recommendations */}
            <View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={[styles.label, { color: colors.foreground }]}>{isAr ? "التوصيات" : "Recommendations"}</Text>
                <TouchableOpacity onPress={addRecommendation}>
                  <MaterialIcons name="add-circle-outline" size={20} color={colors.primary} />
                </TouchableOpacity>
              </View>
              {form.recommendations.map((rec, idx) => (
                <View key={idx} style={{ flexDirection: "row", gap: 6, marginBottom: 6 }}>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground, flex: 1 }]}
                    value={rec}
                    onChangeText={t => {
                      const updated = [...form.recommendations];
                      updated[idx] = t;
                      setForm({ ...form, recommendations: updated });
                    }}
                    placeholder={isAr ? `توصية ${idx + 1}` : `Recommendation ${idx + 1}`}
                    placeholderTextColor={colors.muted}
                  />
                  {form.recommendations.length > 1 && (
                    <TouchableOpacity
                      style={{ justifyContent: "center" }}
                      onPress={() => setForm(prev => ({ ...prev, recommendations: prev.recommendations.filter((_, i) => i !== idx) }))}
                    >
                      <MaterialIcons name="remove-circle" size={20} color="#EF4444" />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>

            {/* Decisions */}
            <View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={[styles.label, { color: colors.foreground }]}>{isAr ? "القرارات" : "Decisions"}</Text>
                <TouchableOpacity onPress={addDecision}>
                  <MaterialIcons name="add-circle-outline" size={20} color={colors.primary} />
                </TouchableOpacity>
              </View>
              {form.decisions.map((dec, idx) => (
                <View key={idx} style={{ flexDirection: "row", gap: 6, marginBottom: 6 }}>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground, flex: 1 }]}
                    value={dec}
                    onChangeText={t => {
                      const updated = [...form.decisions];
                      updated[idx] = t;
                      setForm({ ...form, decisions: updated });
                    }}
                    placeholder={isAr ? `قرار ${idx + 1}` : `Decision ${idx + 1}`}
                    placeholderTextColor={colors.muted}
                  />
                  {form.decisions.length > 1 && (
                    <TouchableOpacity
                      style={{ justifyContent: "center" }}
                      onPress={() => setForm(prev => ({ ...prev, decisions: prev.decisions.filter((_, i) => i !== idx) }))}
                    >
                      <MaterialIcons name="remove-circle" size={20} color="#EF4444" />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>

            {/* Action Items */}
            <View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={[styles.label, { color: colors.foreground }]}>{isAr ? "بنود العمل" : "Action Items"}</Text>
                <TouchableOpacity onPress={addActionItem}>
                  <MaterialIcons name="add-circle-outline" size={20} color={colors.primary} />
                </TouchableOpacity>
              </View>
              {form.actionItems.map((item, idx) => (
                <View key={idx} style={[styles.actionItemRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <TextInput
                    style={[styles.input, { borderColor: colors.border, color: colors.foreground }]}
                    value={item.task}
                    onChangeText={t => {
                      const updated = [...form.actionItems];
                      updated[idx] = { ...updated[idx], task: t };
                      setForm({ ...form, actionItems: updated });
                    }}
                    placeholder={isAr ? "المهمة" : "Task"}
                    placeholderTextColor={colors.muted}
                  />
                  <View style={{ flexDirection: "row", gap: 6 }}>
                    <TextInput
                      style={[styles.input, { borderColor: colors.border, color: colors.foreground, flex: 1 }]}
                      value={item.assignee}
                      onChangeText={t => {
                        const updated = [...form.actionItems];
                        updated[idx] = { ...updated[idx], assignee: t };
                        setForm({ ...form, actionItems: updated });
                      }}
                      placeholder={isAr ? "المسؤول" : "Assignee"}
                      placeholderTextColor={colors.muted}
                    />
                    <TextInput
                      style={[styles.input, { borderColor: colors.border, color: colors.foreground, flex: 1 }]}
                      value={item.deadline}
                      onChangeText={t => {
                        const updated = [...form.actionItems];
                        updated[idx] = { ...updated[idx], deadline: t };
                        setForm({ ...form, actionItems: updated });
                      }}
                      placeholder={isAr ? "الموعد" : "Deadline"}
                      placeholderTextColor={colors.muted}
                    />
                  </View>
                  {form.actionItems.length > 1 && (
                    <TouchableOpacity
                      style={{ alignSelf: "flex-end" }}
                      onPress={() => setForm(prev => ({ ...prev, actionItems: prev.actionItems.filter((_, i) => i !== idx) }))}
                    >
                      <MaterialIcons name="remove-circle" size={18} color="#EF4444" />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>

            {/* Attachments */}
            <View>
              <Text style={[styles.label, { color: colors.foreground }]}>{isAr ? "المرفقات" : "Attachments"}</Text>
              <TouchableOpacity
                style={[styles.selectBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={addAttachment}
              >
                <MaterialIcons name="attach-file" size={18} color={colors.primary} />
                <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "600" }}>{isAr ? "إضافة مرفق" : "Add Attachment"}</Text>
              </TouchableOpacity>
              {form.attachments.length > 0 && (
                <View style={{ gap: 4, marginTop: 8 }}>
                  {form.attachments.map((name, idx) => (
                    <View key={idx} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <MaterialIcons name="description" size={16} color={colors.muted} />
                      <Text style={{ color: colors.foreground, fontSize: 12, flex: 1 }}>{name}</Text>
                      <TouchableOpacity onPress={() => setForm(prev => ({ ...prev, attachments: prev.attachments.filter((_, i) => i !== idx) }))}>
                        <MaterialIcons name="close" size={16} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* Notes */}
            <View>
              <Text style={[styles.label, { color: colors.foreground }]}>{isAr ? "ملاحظات إضافية" : "Additional Notes"}</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground, height: 80, textAlignVertical: "top" }]}
                value={form.notes}
                onChangeText={t => setForm({ ...form, notes: t })}
                placeholder={isAr ? "ملاحظات..." : "Notes..."}
                placeholderTextColor={colors.muted}
                multiline
              />
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* ===== MEETING PICKER ===== */}
      <Modal visible={showMeetingPicker} animationType="slide" transparent>
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderColor: colors.border }]}>
            <TouchableOpacity onPress={() => setShowMeetingPicker(false)}>
              <Text style={{ color: colors.primary, fontWeight: "600" }}>{isAr ? "إلغاء" : "Cancel"}</Text>
            </TouchableOpacity>
            <Text style={{ color: colors.foreground, fontWeight: "bold", fontSize: 16 }}>{isAr ? "اختر الاجتماع" : "Select Meeting"}</Text>
            <View style={{ width: 40 }} />
          </View>
          <FlatList
            data={meetings}
            keyExtractor={item => item.id}
            contentContainerStyle={{ padding: 16, gap: 8 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.meetingPickerItem, {
                  backgroundColor: selectedMeeting?.id === item.id ? colors.primary + "10" : colors.surface,
                  borderColor: selectedMeeting?.id === item.id ? colors.primary : colors.border,
                }]}
                onPress={() => {
                  setSelectedMeeting(item);
                  setShowMeetingPicker(false);
                }}
              >
                <View style={[styles.numBadge, { backgroundColor: "#1E3A5F" }]}>
                  <Text style={{ color: "white", fontSize: 10, fontWeight: "bold" }}>#{item.meetingNumber}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 13 }}>{item.title}</Text>
                  <Text style={{ color: colors.muted, fontSize: 11 }}>{item.date}</Text>
                </View>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={{ alignItems: "center", paddingVertical: 40 }}>
                <Text style={{ color: colors.muted }}>{isAr ? "لا توجد اجتماعات. أنشئ اجتماعاً أولاً." : "No meetings. Create a meeting first."}</Text>
              </View>
            }
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
  card: {
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
  },
  numBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
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
  selectBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  actionItemRow: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
    marginBottom: 8,
  },
  meetingPickerItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
});
