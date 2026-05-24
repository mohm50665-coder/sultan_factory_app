import React, { useState, useEffect } from "react";
import { BackButton } from "@/components/back-button";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { MaterialIcons } from "@expo/vector-icons";
import { administrativeService, AdministrativeData } from "@/lib/services/data.service";

const REQUEST_TYPES = [
  { label: "\u0637\u0644\u0628 \u0625\u062c\u0627\u0632\u0629", value: "leave_request" },
  { label: "\u0637\u0644\u0628 \u0627\u0633\u062a\u062f\u0639\u0627\u0621", value: "recall_request" },
  { label: "\u0637\u0644\u0628 \u0633\u0644\u0641\u0629", value: "advance_request" },
  { label: "\u0637\u0644\u0628 \u0627\u0633\u062a\u0642\u0627\u0644\u0629", value: "resignation_request" },
  { label: "\u0637\u0644\u0628 \u0646\u0642\u0644 \u0643\u0641\u0627\u0644\u0629", value: "sponsorship_transfer" },
  { label: "\u0637\u0644\u0628 \u062a\u0642\u062f\u0645 \u0631\u0627\u062a\u0628", value: "advance_salary" },
  { label: "\u0637\u0644\u0628 \u062a\u062f\u0631\u064a\u0628", value: "training_request" },
  { label: "\u0637\u0644\u0628 \u0646\u0642\u0644", value: "transfer_request" },
];

const DEPARTMENTS = [
  { label: "\u0627\u0644\u0625\u0646\u062a\u0627\u062c", value: "production" },
  { label: "\u0627\u0644\u0625\u062c\u0631\u0627\u0621\u0627\u062a \u0627\u0644\u0625\u062f\u0627\u0631\u064a\u0629 \u0648\u0627\u0644\u0645\u0635\u0631\u0648\u0641\u0627\u062a", value: "administrative" },
  { label: "\u0627\u0644\u0645\u0628\u064a\u0639\u0627\u062a \u0648\u0627\u0644\u062a\u062d\u0635\u064a\u0644", value: "sales" },
  { label: "\u0627\u0644\u0635\u064a\u0627\u0646\u0629", value: "maintenance" },
  { label: "\u0645\u0645\u062b\u0644 \u0645\u062c\u0644\u0633 \u0627\u0644\u0625\u062f\u0627\u0631\u0629", value: "board_representative" },
  { label: "\u0627\u0644\u0645\u0633\u062a\u0648\u062f\u0639\u0627\u062a", value: "warehouse" },
];

const emptyFormData = (): AdministrativeData => ({
  employeeName: "",
  employeeNumber: "",
  department: "",
  requestType: "leave_request",
  requestDetails: "",
  attachments: [],
  approvedByBoardRep: false,
  approvedByDirectManager: false,
  rejectionReason: "",
  status: "pending",
});

export default function AdministrativeScreen() {
  const router = useRouter();
  const colors = useColors();
  const [requests, setRequests] = useState<AdministrativeData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<AdministrativeData>(emptyFormData());
  const [showRequestTypeDropdown, setShowRequestTypeDropdown] = useState(false);
  const [showDepartmentDropdown, setShowDepartmentDropdown] = useState(false);
  const [attachmentInput, setAttachmentInput] = useState("");

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    try {
      setIsLoading(true);
      const data = await administrativeService.getAll();
      setRequests(data);
    } catch (error) {
      console.error("Error loading requests:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.employeeName || !formData.requestDetails) {
      if (Platform.OS === "web") {
        window.alert("\u064a\u0631\u062c\u0649 \u0645\u0644\u0621 \u062c\u0645\u064a\u0639 \u0627\u0644\u062d\u0642\u0648\u0644 \u0627\u0644\u0645\u0637\u0644\u0648\u0628\u0629 (\u0627\u0633\u0645 \u0627\u0644\u0645\u0648\u0638\u0641 \u0648\u062a\u0641\u0627\u0635\u064a\u0644 \u0627\u0644\u0637\u0644\u0628)");
      }
      return;
    }
    try {
      setIsLoading(true);
      if (editingId) {
        await administrativeService.update(editingId, formData);
      } else {
        await administrativeService.create(formData);
      }
      setShowForm(false);
      resetForm();
      loadRequests();
    } catch (error) {
      console.error("Error saving:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = (id: number) => {
    if (Platform.OS === "web") {
      if (window.confirm("\u0647\u0644 \u0623\u0646\u062a \u0645\u062a\u0623\u0643\u062f \u0645\u0646 \u062d\u0630\u0641 \u0647\u0630\u0627 \u0627\u0644\u0637\u0644\u0628\u061f")) {
        performDelete(id);
      }
    } else {
      performDelete(id);
    }
  };

  const performDelete = async (id: number) => {
    try {
      setIsLoading(true);
      await administrativeService.delete(id);
      loadRequests();
    } catch (error) {
      console.error("Error deleting:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (request: AdministrativeData) => {
    setFormData({
      ...emptyFormData(),
      ...request,
      attachments: request.attachments || [],
      status: request.status || "pending",
      rejectionReason: request.rejectionReason || "",
      employeeNumber: request.employeeNumber || "",
      department: request.department || "",
      approvedByBoardRep: request.approvedByBoardRep || false,
      approvedByDirectManager: request.approvedByDirectManager || false,
    });
    setEditingId(request.id || null);
    setShowForm(true);
  };

  const resetForm = () => {
    setFormData(emptyFormData());
    setEditingId(null);
    setAttachmentInput("");
  };

  const addAttachment = () => {
    if (attachmentInput.trim()) {
      setFormData({
        ...formData,
        attachments: [...(formData.attachments || []), attachmentInput.trim()],
      });
      setAttachmentInput("");
    }
  };

  const removeAttachment = (index: number) => {
    const newAttachments = [...(formData.attachments || [])];
    newAttachments.splice(index, 1);
    setFormData({ ...formData, attachments: newAttachments });
  };

  const getRequestTypeLabel = (type: string) => {
    return REQUEST_TYPES.find((t) => t.value === type)?.label || type;
  };

  const getDepartmentLabel = (dept: string) => {
    return DEPARTMENTS.find((d) => d.value === dept)?.label || dept || "\u063a\u064a\u0631 \u0645\u062d\u062f\u062f";
  };

  const getStatusLabel = (request: AdministrativeData) => {
    const status = request.status || "pending";
    if (status === "approved") return "\u0645\u0648\u0627\u0641\u0642";
    if (status === "rejected") return "\u0645\u0631\u0641\u0648\u0636";
    if (request.approvedByBoardRep || request.approvedByDirectManager) return "\u0642\u064a\u062f \u0627\u0644\u0645\u0631\u0627\u062c\u0639\u0629";
    return "\u0642\u064a\u062f \u0627\u0644\u0627\u0646\u062a\u0638\u0627\u0631";
  };

  const getStatusColor = (request: AdministrativeData) => {
    const status = request.status || "pending";
    if (status === "approved") return colors.success;
    if (status === "rejected") return colors.error;
    if (request.approvedByBoardRep || request.approvedByDirectManager) return colors.warning;
    return colors.muted;
  };

  const renderRequestItem = ({ item }: { item: AdministrativeData }) => (
    <View className="bg-surface rounded-xl p-4 mb-3 border border-border">
      {/* Header */}
      <View className="flex-row justify-between items-start mb-3">
        <View className="flex-1">
          <Text className="text-foreground font-bold text-base">{item.employeeName}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
            {item.employeeNumber ? (
              <Text className="text-muted text-xs">{"\u0631\u0642\u0645 \u0648\u0638\u064a\u0641\u064a: "}{item.employeeNumber}</Text>
            ) : null}
            {item.department ? (
              <Text className="text-muted text-xs">| {getDepartmentLabel(item.department)}</Text>
            ) : null}
          </View>
          <View style={{ marginTop: 8, backgroundColor: colors.primary + "15", alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 }}>
            <Text style={{ color: colors.primary, fontSize: 11, fontWeight: "600" }}>
              {getRequestTypeLabel(item.requestType)}
            </Text>
          </View>
        </View>
        <View className="flex-row gap-2">
          <TouchableOpacity
            onPress={() => handleEdit(item)}
            style={{ backgroundColor: colors.primary + "15", borderRadius: 8, padding: 8 }}
          >
            <MaterialIcons name="edit" size={18} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => item.id && handleDelete(item.id)}
            style={{ backgroundColor: colors.error + "15", borderRadius: 8, padding: 8 }}
          >
            <MaterialIcons name="delete" size={18} color={colors.error} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Details */}
      <Text className="text-muted text-sm mb-3" style={{ lineHeight: 20 }}>{item.requestDetails}</Text>

      {/* Attachments */}
      {item.attachments && item.attachments.length > 0 && (
        <View style={{ marginBottom: 12, backgroundColor: colors.background, borderRadius: 8, padding: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 4 }}>
            <MaterialIcons name="attach-file" size={14} color={colors.muted} />
            <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "600" }}>{"\u0627\u0644\u0645\u0631\u0641\u0642\u0627\u062a"} ({item.attachments.length})</Text>
          </View>
          {item.attachments.map((att, idx) => (
            <Text key={idx} style={{ color: colors.primary, fontSize: 11, marginLeft: 16 }}>{"\u2022"} {att}</Text>
          ))}
        </View>
      )}

      {/* Approvals & Status */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: colors.background, borderRadius: 10, padding: 10 }}>
        <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: item.approvedByBoardRep ? colors.success + "15" : colors.muted + "15" }}>
            <MaterialIcons
              name={item.approvedByBoardRep ? "check-circle" : "radio-button-unchecked"}
              size={14}
              color={item.approvedByBoardRep ? colors.success : colors.muted}
            />
            <Text style={{ fontSize: 10, color: item.approvedByBoardRep ? colors.success : colors.muted, fontWeight: "600" }}>
              {"\u0645\u0645\u062b\u0644 \u0645. \u0627\u0644\u0625\u062f\u0627\u0631\u0629"}
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: item.approvedByDirectManager ? colors.success + "15" : colors.muted + "15" }}>
            <MaterialIcons
              name={item.approvedByDirectManager ? "check-circle" : "radio-button-unchecked"}
              size={14}
              color={item.approvedByDirectManager ? colors.success : colors.muted}
            />
            <Text style={{ fontSize: 10, color: item.approvedByDirectManager ? colors.success : colors.muted, fontWeight: "600" }}>
              {"\u0627\u0644\u0645\u062f\u064a\u0631 \u0627\u0644\u0645\u0628\u0627\u0634\u0631"}
            </Text>
          </View>
        </View>
        <View style={{ paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, backgroundColor: getStatusColor(item) + "20" }}>
          <Text style={{ fontSize: 11, fontWeight: "700", color: getStatusColor(item) }}>
            {getStatusLabel(item)}
          </Text>
        </View>
      </View>

      {/* Rejection Reason */}
      {(item.status === "rejected" && item.rejectionReason) && (
        <View style={{ marginTop: 8, backgroundColor: colors.error + "10", borderRadius: 10, padding: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 4 }}>
            <MaterialIcons name="cancel" size={14} color={colors.error} />
            <Text style={{ color: colors.error, fontSize: 11, fontWeight: "600" }}>{"\u0633\u0628\u0628 \u0627\u0644\u0631\u0641\u0636"}</Text>
          </View>
          <Text style={{ color: colors.error, fontSize: 11 }}>{item.rejectionReason}</Text>
        </View>
      )}
    </View>
  );

  const renderForm = () => (
    <Modal
      visible={showForm}
      animationType="slide"
      transparent
      onRequestClose={() => setShowForm(false)}
    >
      <View className="flex-1 bg-black/50">
        <View className="flex-1 bg-background rounded-t-3xl mt-8">
          {/* Form Header */}
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <TouchableOpacity onPress={() => { setShowForm(false); resetForm(); }}>
              <Text style={{ color: colors.error, fontWeight: "600", fontSize: 16 }}>{"\u0625\u0644\u063a\u0627\u0621"}</Text>
            </TouchableOpacity>
            <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 18 }}>
              {editingId ? "\u062a\u0639\u062f\u064a\u0644 \u0627\u0644\u0637\u0644\u0628" : "\u0625\u0636\u0627\u0641\u0629 \u0637\u0644\u0628 \u062c\u062f\u064a\u062f"}
            </Text>
            <TouchableOpacity onPress={handleSave} disabled={isLoading}>
              <Text style={{ color: isLoading ? colors.muted : colors.primary, fontWeight: "700", fontSize: 16 }}>
                {isLoading ? "\u062c\u0627\u0631\u064a..." : "\u062d\u0641\u0638"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Form Content */}
          <ScrollView style={{ flex: 1, padding: 20 }} keyboardShouldPersistTaps="handled">
            {/* \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a \u0627\u0644\u0623\u0633\u0627\u0633\u064a\u0629 */}
            <View style={{ marginBottom: 24 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <MaterialIcons name="person" size={20} color={colors.primary} />
                <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 16 }}>{"\u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a \u0627\u0644\u0623\u0633\u0627\u0633\u064a\u0629"}</Text>
              </View>

              {/* \u0627\u0633\u0645 \u0627\u0644\u0645\u0648\u0638\u0641 */}
              <View style={{ marginBottom: 16 }}>
                <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600", marginBottom: 8, textAlign: "right" }}>{"\u0627\u0633\u0645 \u0627\u0644\u0645\u0648\u0638\u0641"} <Text style={{ color: colors.error }}>*</Text></Text>
                <TextInput
                  value={formData.employeeName}
                  onChangeText={(text) => setFormData({ ...formData, employeeName: text })}
                  placeholder={"\u0623\u062f\u062e\u0644 \u0627\u0633\u0645 \u0627\u0644\u0645\u0648\u0638\u0641"}
                  placeholderTextColor={colors.muted}
                  style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, fontSize: 14, color: colors.foreground, backgroundColor: colors.surface, textAlign: "right" }}
                />
              </View>

              {/* \u0627\u0644\u0631\u0642\u0645 \u0627\u0644\u0648\u0638\u064a\u0641\u064a */}
              <View style={{ marginBottom: 16 }}>
                <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600", marginBottom: 8, textAlign: "right" }}>{"\u0627\u0644\u0631\u0642\u0645 \u0627\u0644\u0648\u0638\u064a\u0641\u064a"}</Text>
                <TextInput
                  value={formData.employeeNumber}
                  onChangeText={(text) => setFormData({ ...formData, employeeNumber: text })}
                  placeholder={"\u0623\u062f\u062e\u0644 \u0627\u0644\u0631\u0642\u0645 \u0627\u0644\u0648\u0638\u064a\u0641\u064a"}
                  placeholderTextColor={colors.muted}
                  keyboardType="numeric"
                  style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, fontSize: 14, color: colors.foreground, backgroundColor: colors.surface, textAlign: "right" }}
                />
              </View>

              {/* \u0627\u0644\u0625\u062f\u0627\u0631\u0629 / \u0627\u0644\u0642\u0633\u0645 */}
              <View style={{ marginBottom: 16 }}>
                <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600", marginBottom: 8, textAlign: "right" }}>{"\u0627\u0644\u0625\u062f\u0627\u0631\u0629 / \u0627\u0644\u0642\u0633\u0645"}</Text>
                <TouchableOpacity
                  onPress={() => setShowDepartmentDropdown(!showDepartmentDropdown)}
                  style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, backgroundColor: colors.surface, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
                >
                  <MaterialIcons name={showDepartmentDropdown ? "expand-less" : "expand-more"} size={20} color={colors.muted} />
                  <Text style={{ color: formData.department ? colors.foreground : colors.muted, fontSize: 14 }}>
                    {formData.department ? getDepartmentLabel(formData.department) : "\u0627\u062e\u062a\u0631 \u0627\u0644\u0642\u0633\u0645"}
                  </Text>
                </TouchableOpacity>
                {showDepartmentDropdown && (
                  <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 10, marginTop: 4, backgroundColor: colors.surface, overflow: "hidden" }}>
                    {DEPARTMENTS.map((dept) => (
                      <TouchableOpacity
                        key={dept.value}
                        onPress={() => { setFormData({ ...formData, department: dept.value }); setShowDepartmentDropdown(false); }}
                        style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: formData.department === dept.value ? colors.primary + "15" : "transparent" }}
                      >
                        <Text style={{ color: formData.department === dept.value ? colors.primary : colors.foreground, fontWeight: formData.department === dept.value ? "600" : "400", textAlign: "right" }}>
                          {dept.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              {/* \u0646\u0648\u0639 \u0627\u0644\u0637\u0644\u0628 */}
              <View style={{ marginBottom: 16 }}>
                <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600", marginBottom: 8, textAlign: "right" }}>{"\u0646\u0648\u0639 \u0627\u0644\u0637\u0644\u0628"} <Text style={{ color: colors.error }}>*</Text></Text>
                <TouchableOpacity
                  onPress={() => setShowRequestTypeDropdown(!showRequestTypeDropdown)}
                  style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, backgroundColor: colors.surface, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
                >
                  <MaterialIcons name={showRequestTypeDropdown ? "expand-less" : "expand-more"} size={20} color={colors.muted} />
                  <Text style={{ color: colors.foreground, fontSize: 14 }}>
                    {getRequestTypeLabel(formData.requestType)}
                  </Text>
                </TouchableOpacity>
                {showRequestTypeDropdown && (
                  <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 10, marginTop: 4, backgroundColor: colors.surface, overflow: "hidden" }}>
                    <ScrollView nestedScrollEnabled style={{ maxHeight: 200 }}>
                      {REQUEST_TYPES.map((type) => (
                        <TouchableOpacity
                          key={type.value}
                          onPress={() => { setFormData({ ...formData, requestType: type.value }); setShowRequestTypeDropdown(false); }}
                          style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: formData.requestType === type.value ? colors.primary + "15" : "transparent" }}
                        >
                          <Text style={{ color: formData.requestType === type.value ? colors.primary : colors.foreground, fontWeight: formData.requestType === type.value ? "600" : "400", textAlign: "right" }}>
                            {type.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>

              {/* \u062a\u0641\u0627\u0635\u064a\u0644 \u0627\u0644\u0637\u0644\u0628 */}
              <View style={{ marginBottom: 16 }}>
                <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600", marginBottom: 8, textAlign: "right" }}>{"\u062a\u0641\u0627\u0635\u064a\u0644 \u0627\u0644\u0637\u0644\u0628"} <Text style={{ color: colors.error }}>*</Text></Text>
                <TextInput
                  value={formData.requestDetails}
                  onChangeText={(text) => setFormData({ ...formData, requestDetails: text })}
                  placeholder={"\u0623\u062f\u062e\u0644 \u062a\u0641\u0627\u0635\u064a\u0644 \u0627\u0644\u0637\u0644\u0628"}
                  placeholderTextColor={colors.muted}
                  multiline
                  numberOfLines={4}
                  style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, fontSize: 14, color: colors.foreground, backgroundColor: colors.surface, textAlign: "right", textAlignVertical: "top", minHeight: 100 }}
                />
              </View>
            </View>

            {/* \u0627\u0644\u0645\u0631\u0641\u0642\u0627\u062a */}
            <View style={{ marginBottom: 24 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <MaterialIcons name="attach-file" size={20} color={colors.primary} />
                <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 16 }}>{"\u0625\u0631\u0641\u0627\u0642 \u0646\u0645\u0627\u0630\u062c \u0648\u0645\u0633\u062a\u0646\u062f\u0627\u062a"}</Text>
              </View>

              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <TouchableOpacity
                  onPress={addAttachment}
                  style={{ backgroundColor: colors.primary, borderRadius: 10, padding: 10 }}
                >
                  <MaterialIcons name="add" size={20} color="white" />
                </TouchableOpacity>
                <TextInput
                  value={attachmentInput}
                  onChangeText={setAttachmentInput}
                  placeholder={"\u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062a\u0646\u062f \u0623\u0648 \u0631\u0627\u0628\u0637 \u0627\u0644\u0645\u0631\u0641\u0642"}
                  placeholderTextColor={colors.muted}
                  onSubmitEditing={addAttachment}
                  style={{ flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10, fontSize: 14, color: colors.foreground, backgroundColor: colors.surface, textAlign: "right" }}
                />
              </View>

              {/* \u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0645\u0631\u0641\u0642\u0627\u062a */}
              {formData.attachments && formData.attachments.length > 0 && (
                <View style={{ backgroundColor: colors.surface, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: colors.border }}>
                  {formData.attachments.map((att, idx) => (
                    <View key={idx} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: idx < formData.attachments.length - 1 ? 1 : 0, borderBottomColor: colors.border }}>
                      <TouchableOpacity onPress={() => removeAttachment(idx)}>
                        <MaterialIcons name="close" size={18} color={colors.error} />
                      </TouchableOpacity>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1, justifyContent: "flex-end" }}>
                        <Text style={{ color: colors.foreground, fontSize: 13 }}>{att}</Text>
                        <MaterialIcons name="description" size={16} color={colors.primary} />
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* \u0627\u0644\u0645\u0648\u0627\u0641\u0642\u0627\u062a */}
            <View style={{ marginBottom: 24 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <MaterialIcons name="verified" size={20} color={colors.primary} />
                <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 16 }}>{"\u0627\u0644\u0645\u0648\u0627\u0641\u0642\u0627\u062a"}</Text>
              </View>

              {/* \u0645\u0648\u0627\u0641\u0642\u0629 \u0645\u0645\u062b\u0644 \u0645\u062c\u0644\u0633 \u0627\u0644\u0625\u062f\u0627\u0631\u0629 */}
              <TouchableOpacity
                onPress={() => setFormData({ ...formData, approvedByBoardRep: !formData.approvedByBoardRep })}
                style={{ flexDirection: "row", alignItems: "center", marginBottom: 12, paddingVertical: 12, paddingHorizontal: 14, backgroundColor: colors.surface, borderRadius: 10, borderWidth: 1, borderColor: colors.border }}
              >
                <View style={{ flex: 1, alignItems: "flex-end" }}>
                  <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "500" }}>{"\u0645\u0648\u0627\u0641\u0642\u0629 \u0645\u0645\u062b\u0644 \u0645\u062c\u0644\u0633 \u0627\u0644\u0625\u062f\u0627\u0631\u0629"}</Text>
                </View>
                <View
                  style={{ width: 26, height: 26, borderRadius: 6, borderWidth: 2, borderColor: formData.approvedByBoardRep ? colors.success : colors.border, backgroundColor: formData.approvedByBoardRep ? colors.success : "transparent", justifyContent: "center", alignItems: "center", marginLeft: 12 }}
                >
                  {formData.approvedByBoardRep && <MaterialIcons name="check" size={18} color="white" />}
                </View>
              </TouchableOpacity>

              {/* \u0645\u0648\u0627\u0641\u0642\u0629 \u0627\u0644\u0645\u062f\u064a\u0631 \u0627\u0644\u0645\u0628\u0627\u0634\u0631 */}
              <TouchableOpacity
                onPress={() => setFormData({ ...formData, approvedByDirectManager: !formData.approvedByDirectManager })}
                style={{ flexDirection: "row", alignItems: "center", marginBottom: 12, paddingVertical: 12, paddingHorizontal: 14, backgroundColor: colors.surface, borderRadius: 10, borderWidth: 1, borderColor: colors.border }}
              >
                <View style={{ flex: 1, alignItems: "flex-end" }}>
                  <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "500" }}>{"\u0645\u0648\u0627\u0641\u0642\u0629 \u0627\u0644\u0645\u062f\u064a\u0631 \u0627\u0644\u0645\u0628\u0627\u0634\u0631"}</Text>
                </View>
                <View
                  style={{ width: 26, height: 26, borderRadius: 6, borderWidth: 2, borderColor: formData.approvedByDirectManager ? colors.success : colors.border, backgroundColor: formData.approvedByDirectManager ? colors.success : "transparent", justifyContent: "center", alignItems: "center", marginLeft: 12 }}
                >
                  {formData.approvedByDirectManager && <MaterialIcons name="check" size={18} color="white" />}
                </View>
              </TouchableOpacity>

              {/* \u062d\u0627\u0644\u0629 \u0627\u0644\u0637\u0644\u0628 */}
              <View style={{ marginBottom: 16, marginTop: 8 }}>
                <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600", marginBottom: 8, textAlign: "right" }}>{"\u062d\u0627\u0644\u0629 \u0627\u0644\u0637\u0644\u0628"}</Text>
                <View style={{ flexDirection: "row", gap: 8, justifyContent: "flex-end" }}>
                  {[
                    { label: "\u0642\u064a\u062f \u0627\u0644\u0627\u0646\u062a\u0638\u0627\u0631", value: "pending" as const, color: colors.muted },
                    { label: "\u0645\u0648\u0627\u0641\u0642", value: "approved" as const, color: colors.success },
                    { label: "\u0645\u0631\u0641\u0648\u0636", value: "rejected" as const, color: colors.error },
                  ].map((statusOption) => (
                    <TouchableOpacity
                      key={statusOption.value}
                      onPress={() => setFormData({ ...formData, status: statusOption.value })}
                      style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 2, borderColor: formData.status === statusOption.value ? statusOption.color : colors.border, backgroundColor: formData.status === statusOption.value ? statusOption.color + "15" : "transparent" }}
                    >
                      <Text style={{ color: formData.status === statusOption.value ? statusOption.color : colors.muted, fontWeight: "600", fontSize: 12 }}>
                        {statusOption.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* \u0633\u0628\u0628 \u0627\u0644\u0631\u0641\u0636 */}
              {formData.status === "rejected" && (
                <View style={{ marginBottom: 16 }}>
                  <Text style={{ color: colors.error, fontSize: 13, fontWeight: "600", marginBottom: 8, textAlign: "right" }}>{"\u0633\u0628\u0628 \u0627\u0644\u0631\u0641\u0636"}</Text>
                  <TextInput
                    value={formData.rejectionReason}
                    onChangeText={(text) => setFormData({ ...formData, rejectionReason: text })}
                    placeholder={"\u0623\u062f\u062e\u0644 \u0633\u0628\u0628 \u0627\u0644\u0631\u0641\u0636"}
                    placeholderTextColor={colors.muted}
                    multiline
                    numberOfLines={3}
                    style={{ borderWidth: 1, borderColor: colors.error + "50", borderRadius: 10, padding: 12, fontSize: 14, color: colors.foreground, backgroundColor: colors.error + "08", textAlign: "right", textAlignVertical: "top", minHeight: 80 }}
                  />
                </View>
              )}
            </View>

            {/* Spacer */}
            <View style={{ height: 100 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  return (
    <ScreenContainer className="bg-background">
      {/* \u0631\u0623\u0633 \u0627\u0644\u0635\u0641\u062d\u0629 */}
      <View
        style={{ backgroundColor: colors.primary }}
        className="px-6 py-5 flex-row items-center justify-between"
      >
        {/* \u0632\u0631 \u0627\u0644\u0625\u0636\u0627\u0641\u0629 */}
        <TouchableOpacity
          onPress={() => { resetForm(); setShowForm(true); }}
          style={{ backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 12, padding: 8 }}
        >
          <MaterialIcons name="add" size={24} color="white" />
        </TouchableOpacity>
        {/* \u0627\u0644\u0639\u0646\u0648\u0627\u0646 */}
        <View className="flex-1 items-center">
          <Text className="text-white font-bold text-xl">{"\u0627\u0644\u0625\u062c\u0631\u0627\u0621\u0627\u062a \u0627\u0644\u0625\u062f\u0627\u0631\u064a\u0629"}</Text>
          <Text className="text-white/80 text-sm mt-1">{requests.length} {"\u0637\u0644\u0628"}</Text>
        </View>
        {/* \u0632\u0631 \u0627\u0644\u0631\u062c\u0648\u0639 */}
        <BackButton />
      </View>

      {/* \u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0637\u0644\u0628\u0627\u062a */}
      {isLoading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={requests}
          renderItem={renderRequestItem}
          keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
          contentContainerStyle={{ padding: 16, flexGrow: 1 }}
          ListEmptyComponent={
            <View className="flex-1 justify-center items-center" style={{ paddingVertical: 80 }}>
              <View style={{ backgroundColor: colors.primary + "15", borderRadius: 40, padding: 20 }}>
                <MaterialIcons name="description" size={48} color={colors.primary} />
              </View>
              <Text style={{ color: colors.foreground, fontSize: 18, marginTop: 20, fontWeight: "700" }}>{"\u0627\u0644\u0625\u062c\u0631\u0627\u0621\u0627\u062a \u0627\u0644\u0625\u062f\u0627\u0631\u064a\u0629"}</Text>
              <Text style={{ color: colors.muted, fontSize: 14, marginTop: 8, textAlign: "center", paddingHorizontal: 32 }}>
                {"\u0644\u0627 \u062a\u0648\u062c\u062f \u0637\u0644\u0628\u0627\u062a \u0625\u062f\u0627\u0631\u064a\u0629 \u0628\u0639\u062f.\n\u0627\u0636\u063a\u0637 \u0639\u0644\u0649 \u0632\u0631 (+) \u0644\u0625\u0636\u0627\u0641\u0629 \u0637\u0644\u0628 \u062c\u062f\u064a\u062f."}
              </Text>
              <TouchableOpacity
                onPress={() => { resetForm(); setShowForm(true); }}
                style={{ backgroundColor: colors.primary, marginTop: 24, paddingHorizontal: 32, paddingVertical: 12, borderRadius: 12 }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={{ color: "white", fontWeight: "600" }}>{"\u0625\u0636\u0627\u0641\u0629 \u0637\u0644\u0628"}</Text>
                  <MaterialIcons name="add" size={20} color="white" />
                </View>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      {/* \u0646\u0645\u0648\u0630\u062c \u0627\u0644\u0625\u0636\u0627\u0641\u0629/\u0627\u0644\u062a\u0639\u062f\u064a\u0644 */}
      {renderForm()}
    </ScreenContainer>
  );
}
