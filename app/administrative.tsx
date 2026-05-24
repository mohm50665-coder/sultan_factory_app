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
  boardRepStatus: "pending",
  boardRepRejectionReason: "",
  approvedByDirectManager: false,
  directManagerStatus: "pending",
  directManagerRejectionReason: "",
  approvedByGeneralManager: false,
  generalManagerStatus: "pending",
  generalManagerRejectionReason: "",
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
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterDepartment, setFilterDepartment] = useState<string>("all");

  const filteredRequests = requests.filter((r) => {
    if (filterType !== "all" && r.requestType !== filterType) return false;
    if (filterDepartment !== "all" && r.department !== filterDepartment) return false;
    if (filterStatus !== "all") {
      if (filterStatus === "pending" && r.directManagerStatus !== "pending") return false;
      if (filterStatus === "approved" && !(r.directManagerStatus === "approved" && r.generalManagerStatus === "approved" && r.boardRepStatus === "approved")) return false;
      if (filterStatus === "rejected" && !(r.directManagerStatus === "rejected" || r.generalManagerStatus === "rejected" || r.boardRepStatus === "rejected")) return false;
    }
    return true;
  });

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
      boardRepStatus: request.boardRepStatus || "pending",
      boardRepRejectionReason: request.boardRepRejectionReason || "",
      approvedByDirectManager: request.approvedByDirectManager || false,
      directManagerStatus: request.directManagerStatus || "pending",
      directManagerRejectionReason: request.directManagerRejectionReason || "",
      approvedByGeneralManager: request.approvedByGeneralManager || false,
      generalManagerStatus: request.generalManagerStatus || "pending",
      generalManagerRejectionReason: request.generalManagerRejectionReason || "",
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
    if (status === "approved") return "موافق";
    if (status === "rejected") return "مرفوض";
    if (request.approvedByBoardRep || request.approvedByDirectManager || request.approvedByGeneralManager) return "قيد المراجعة";
    return "قيد الانتظار";
  };

  const getStatusColor = (request: AdministrativeData) => {
    const status = request.status || "pending";
    if (status === "approved") return colors.success;
    if (status === "rejected") return colors.error;
    if (request.approvedByBoardRep || request.approvedByDirectManager || request.approvedByGeneralManager) return colors.warning;
    return colors.muted;
  };

  const getApproverStatusLabel = (status: string) => {
    if (status === "approved") return "موافق";
    if (status === "rejected") return "مرفوض";
    return "قيد الانتظار";
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  const handlePrintShare = (item: AdministrativeData) => {
    const boardStatus = item.boardRepStatus || (item.approvedByBoardRep ? "approved" : "pending");
    const directStatus = item.directManagerStatus || (item.approvedByDirectManager ? "approved" : "pending");
    const generalStatus = item.generalManagerStatus || (item.approvedByGeneralManager ? "approved" : "pending");
    const content = `طلب إداري - ${getRequestTypeLabel(item.requestType)}\n` +
      (item.referenceNumber ? `الرقم المرجعي: ${item.referenceNumber}\n` : "") +
      (item.submissionDate ? `تاريخ التقديم: ${formatDate(item.submissionDate)}\n` : "") +
      `اسم الموظف: ${item.employeeName}\n` +
      `الرقم الوظيفي: ${item.employeeNumber || "غير محدد"}\n` +
      `الإدارة/القسم: ${getDepartmentLabel(item.department)}\n` +
      `تفاصيل الطلب: ${item.requestDetails}\n` +
      (item.attachments && item.attachments.length > 0 ? `المرفقات: ${item.attachments.join(", ")}\n` : "") +
      `\nالموافقات:\n` +
      `- المدير المباشر: ${getApproverStatusLabel(directStatus)}${item.directManagerActionDate ? " (" + formatDate(item.directManagerActionDate) + ")" : ""}${item.directManagerRejectionReason ? " - سبب الرفض: " + item.directManagerRejectionReason : ""}\n` +
      `- المدير العام: ${getApproverStatusLabel(generalStatus)}${item.generalManagerActionDate ? " (" + formatDate(item.generalManagerActionDate) + ")" : ""}${item.generalManagerRejectionReason ? " - سبب الرفض: " + item.generalManagerRejectionReason : ""}\n` +
      `- ممثل مجلس الإدارة: ${getApproverStatusLabel(boardStatus)}${item.boardRepActionDate ? " (" + formatDate(item.boardRepActionDate) + ")" : ""}${item.boardRepRejectionReason ? " - سبب الرفض: " + item.boardRepRejectionReason : ""}`;
    if (Platform.OS === "web") {
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(`<html dir="rtl"><head><title>طباعة الطلب</title><style>body{font-family:Arial,sans-serif;padding:40px;direction:rtl;white-space:pre-wrap;line-height:2;font-size:16px;}h2{color:#0a7ea4;border-bottom:2px solid #0a7ea4;padding-bottom:10px;}</style></head><body><h2>طلب إداري - ${getRequestTypeLabel(item.requestType)}</h2>${content.replace(/\n/g, "<br>")}</body></html>`);
        printWindow.document.close();
        printWindow.print();
      }
    } else {
      import("react-native").then(({ Share }) => {
        Share.share({ message: content, title: `طلب إداري - ${item.employeeName}` });
      });
    }
  };

  const renderRequestItem = ({ item }: { item: AdministrativeData }) => (
    <View className="bg-surface rounded-xl p-4 mb-3 border border-border">
      {/* Reference Number & Submission Date */}
      {(item.referenceNumber || item.submissionDate) && (
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          {item.referenceNumber ? (
            <View style={{ backgroundColor: colors.primary + "12", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 }}>
              <Text style={{ color: colors.primary, fontSize: 11, fontWeight: "700" }}>{item.referenceNumber}</Text>
            </View>
          ) : <View />}
          {item.submissionDate ? (
            <Text style={{ color: colors.muted, fontSize: 10 }}>{formatDate(item.submissionDate)}</Text>
          ) : null}
        </View>
      )}
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

      {/* Approvals with per-approver status */}
      <View style={{ backgroundColor: colors.background, borderRadius: 10, padding: 12 }}>
        <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: "700", marginBottom: 10, textAlign: "right" }}>{"\u0627\u0644\u0645\u0648\u0627\u0641\u0642\u0627\u062a"}</Text>
        
        {/* \u0627\u0644\u0645\u062f\u064a\u0631 \u0627\u0644\u0645\u0628\u0627\u0634\u0631 */}
        <View style={{ marginBottom: 8, paddingVertical: 8, paddingHorizontal: 10, backgroundColor: colors.surface, borderRadius: 8, borderWidth: 1, borderColor: colors.border }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12, backgroundColor: (item.directManagerStatus || (item.approvedByDirectManager ? "approved" : "pending")) === "approved" ? colors.success + "20" : (item.directManagerStatus || "pending") === "rejected" ? colors.error + "20" : colors.muted + "20" }}>
              <Text style={{ fontSize: 10, fontWeight: "700", color: (item.directManagerStatus || (item.approvedByDirectManager ? "approved" : "pending")) === "approved" ? colors.success : (item.directManagerStatus || "pending") === "rejected" ? colors.error : colors.muted }}>
                {getApproverStatusLabel(item.directManagerStatus || (item.approvedByDirectManager ? "approved" : "pending"))}
              </Text>
            </View>
            <Text style={{ fontSize: 12, color: colors.foreground, fontWeight: "500" }}>{"\u0627\u0644\u0645\u062f\u064a\u0631 \u0627\u0644\u0645\u0628\u0627\u0634\u0631"}</Text>
          </View>
          {item.directManagerActionDate ? (
            <Text style={{ color: colors.muted, fontSize: 9, textAlign: "left", marginTop: 4 }}>{formatDate(item.directManagerActionDate)}</Text>
          ) : null}
        </View>
        {item.directManagerRejectionReason ? (
          <Text style={{ color: colors.error, fontSize: 10, marginBottom: 8, marginTop: -4, textAlign: "right", paddingHorizontal: 10 }}>{"\u0633\u0628\u0628 \u0627\u0644\u0631\u0641\u0636: "}{item.directManagerRejectionReason}</Text>
        ) : null}

        {/* \u0627\u0644\u0645\u062f\u064a\u0631 \u0627\u0644\u0639\u0627\u0645 */}
        <View style={{ marginBottom: 8, paddingVertical: 8, paddingHorizontal: 10, backgroundColor: colors.surface, borderRadius: 8, borderWidth: 1, borderColor: colors.border }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12, backgroundColor: (item.generalManagerStatus || (item.approvedByGeneralManager ? "approved" : "pending")) === "approved" ? colors.success + "20" : (item.generalManagerStatus || "pending") === "rejected" ? colors.error + "20" : colors.muted + "20" }}>
              <Text style={{ fontSize: 10, fontWeight: "700", color: (item.generalManagerStatus || (item.approvedByGeneralManager ? "approved" : "pending")) === "approved" ? colors.success : (item.generalManagerStatus || "pending") === "rejected" ? colors.error : colors.muted }}>
                {getApproverStatusLabel(item.generalManagerStatus || (item.approvedByGeneralManager ? "approved" : "pending"))}
              </Text>
            </View>
            <Text style={{ fontSize: 12, color: colors.foreground, fontWeight: "500" }}>{"\u0627\u0644\u0645\u062f\u064a\u0631 \u0627\u0644\u0639\u0627\u0645"}</Text>
          </View>
          {item.generalManagerActionDate ? (
            <Text style={{ color: colors.muted, fontSize: 9, textAlign: "left", marginTop: 4 }}>{formatDate(item.generalManagerActionDate)}</Text>
          ) : null}
        </View>
        {item.generalManagerRejectionReason ? (
          <Text style={{ color: colors.error, fontSize: 10, marginBottom: 8, marginTop: -4, textAlign: "right", paddingHorizontal: 10 }}>{"\u0633\u0628\u0628 \u0627\u0644\u0631\u0641\u0636: "}{item.generalManagerRejectionReason}</Text>
        ) : null}

        {/* \u0645\u0645\u062b\u0644 \u0645\u062c\u0644\u0633 \u0627\u0644\u0625\u062f\u0627\u0631\u0629 */}
        <View style={{ marginBottom: 4, paddingVertical: 8, paddingHorizontal: 10, backgroundColor: colors.surface, borderRadius: 8, borderWidth: 1, borderColor: colors.border }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12, backgroundColor: (item.boardRepStatus || (item.approvedByBoardRep ? "approved" : "pending")) === "approved" ? colors.success + "20" : (item.boardRepStatus || "pending") === "rejected" ? colors.error + "20" : colors.muted + "20" }}>
              <Text style={{ fontSize: 10, fontWeight: "700", color: (item.boardRepStatus || (item.approvedByBoardRep ? "approved" : "pending")) === "approved" ? colors.success : (item.boardRepStatus || "pending") === "rejected" ? colors.error : colors.muted }}>
                {getApproverStatusLabel(item.boardRepStatus || (item.approvedByBoardRep ? "approved" : "pending"))}
              </Text>
            </View>
            <Text style={{ fontSize: 12, color: colors.foreground, fontWeight: "500" }}>{"\u0645\u0645\u062b\u0644 \u0645\u062c\u0644\u0633 \u0627\u0644\u0625\u062f\u0627\u0631\u0629"}</Text>
          </View>
          {item.boardRepActionDate ? (
            <Text style={{ color: colors.muted, fontSize: 9, textAlign: "left", marginTop: 4 }}>{formatDate(item.boardRepActionDate)}</Text>
          ) : null}
        </View>
        {item.boardRepRejectionReason ? (
          <Text style={{ color: colors.error, fontSize: 10, marginBottom: 4, marginTop: 0, textAlign: "right", paddingHorizontal: 10 }}>{"\u0633\u0628\u0628 \u0627\u0644\u0631\u0641\u0636: "}{item.boardRepRejectionReason}</Text>
        ) : null}
      </View>

      {/* Print/Share Button - large and visible */}
      <TouchableOpacity
        onPress={() => handlePrintShare(item)}
        style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 12, paddingVertical: 12, paddingHorizontal: 16, backgroundColor: colors.primary + "12", borderRadius: 10, borderWidth: 1, borderColor: colors.primary + "30" }}
      >
        <MaterialIcons name="print" size={20} color={colors.primary} />
        <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "600" }}>{"\u0637\u0628\u0627\u0639\u0629 / \u0645\u0634\u0627\u0631\u0643\u0629 \u0627\u0644\u0637\u0644\u0628"}</Text>
        <MaterialIcons name="share" size={18} color={colors.primary} />
      </TouchableOpacity>
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

              {/* \u0645\u0648\u0627\u0641\u0642\u0629 \u0627\u0644\u0645\u062f\u064a\u0631 \u0627\u0644\u0645\u0628\u0627\u0634\u0631 */}
              <View style={{ marginBottom: 16, backgroundColor: colors.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.border }}>
                <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "600", textAlign: "right", marginBottom: 10 }}>{"\u0627\u0644\u0645\u062f\u064a\u0631 \u0627\u0644\u0645\u0628\u0627\u0634\u0631"}</Text>
                <View style={{ flexDirection: "row", gap: 6, justifyContent: "flex-end", marginBottom: 8 }}>
                  {[
                    { label: "\u0642\u064a\u062f \u0627\u0644\u0627\u0646\u062a\u0638\u0627\u0631", value: "pending" as const, color: colors.muted },
                    { label: "\u0645\u0648\u0627\u0641\u0642", value: "approved" as const, color: colors.success },
                    { label: "\u0645\u0631\u0641\u0648\u0636", value: "rejected" as const, color: colors.error },
                  ].map((opt) => (
                    <TouchableOpacity
                      key={opt.value}
                      onPress={() => setFormData({ ...formData, directManagerStatus: opt.value, approvedByDirectManager: opt.value === "approved" })}
                      style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 2, borderColor: formData.directManagerStatus === opt.value ? opt.color : colors.border, backgroundColor: formData.directManagerStatus === opt.value ? opt.color + "15" : "transparent" }}
                    >
                      <Text style={{ color: formData.directManagerStatus === opt.value ? opt.color : colors.muted, fontWeight: "600", fontSize: 11 }}>{opt.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {formData.directManagerStatus === "rejected" && (
                  <TextInput
                    value={formData.directManagerRejectionReason}
                    onChangeText={(text) => setFormData({ ...formData, directManagerRejectionReason: text })}
                    placeholder={"\u0633\u0628\u0628 \u0627\u0644\u0631\u0641\u0636"}
                    placeholderTextColor={colors.muted}
                    style={{ borderWidth: 1, borderColor: colors.error + "40", borderRadius: 8, padding: 10, fontSize: 13, color: colors.foreground, backgroundColor: colors.error + "08", textAlign: "right" }}
                  />
                )}
              </View>

              {/* \u0645\u0648\u0627\u0641\u0642\u0629 \u0627\u0644\u0645\u062f\u064a\u0631 \u0627\u0644\u0639\u0627\u0645 */}
              <View style={{ marginBottom: 16, backgroundColor: colors.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.border }}>
                <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "600", textAlign: "right", marginBottom: 10 }}>{"\u0627\u0644\u0645\u062f\u064a\u0631 \u0627\u0644\u0639\u0627\u0645"}</Text>
                <View style={{ flexDirection: "row", gap: 6, justifyContent: "flex-end", marginBottom: 8 }}>
                  {[
                    { label: "\u0642\u064a\u062f \u0627\u0644\u0627\u0646\u062a\u0638\u0627\u0631", value: "pending" as const, color: colors.muted },
                    { label: "\u0645\u0648\u0627\u0641\u0642", value: "approved" as const, color: colors.success },
                    { label: "\u0645\u0631\u0641\u0648\u0636", value: "rejected" as const, color: colors.error },
                  ].map((opt) => (
                    <TouchableOpacity
                      key={opt.value}
                      onPress={() => setFormData({ ...formData, generalManagerStatus: opt.value, approvedByGeneralManager: opt.value === "approved" })}
                      style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 2, borderColor: formData.generalManagerStatus === opt.value ? opt.color : colors.border, backgroundColor: formData.generalManagerStatus === opt.value ? opt.color + "15" : "transparent" }}
                    >
                      <Text style={{ color: formData.generalManagerStatus === opt.value ? opt.color : colors.muted, fontWeight: "600", fontSize: 11 }}>{opt.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {formData.generalManagerStatus === "rejected" && (
                  <TextInput
                    value={formData.generalManagerRejectionReason}
                    onChangeText={(text) => setFormData({ ...formData, generalManagerRejectionReason: text })}
                    placeholder={"\u0633\u0628\u0628 \u0627\u0644\u0631\u0641\u0636"}
                    placeholderTextColor={colors.muted}
                    style={{ borderWidth: 1, borderColor: colors.error + "40", borderRadius: 8, padding: 10, fontSize: 13, color: colors.foreground, backgroundColor: colors.error + "08", textAlign: "right" }}
                  />
                )}
              </View>

              {/* \u0645\u0648\u0627\u0641\u0642\u0629 \u0645\u0645\u062b\u0644 \u0645\u062c\u0644\u0633 \u0627\u0644\u0625\u062f\u0627\u0631\u0629 */}
              <View style={{ marginBottom: 16, backgroundColor: colors.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.border }}>
                <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "600", textAlign: "right", marginBottom: 10 }}>{"\u0645\u0645\u062b\u0644 \u0645\u062c\u0644\u0633 \u0627\u0644\u0625\u062f\u0627\u0631\u0629"}</Text>
                <View style={{ flexDirection: "row", gap: 6, justifyContent: "flex-end", marginBottom: 8 }}>
                  {[
                    { label: "\u0642\u064a\u062f \u0627\u0644\u0627\u0646\u062a\u0638\u0627\u0631", value: "pending" as const, color: colors.muted },
                    { label: "\u0645\u0648\u0627\u0641\u0642", value: "approved" as const, color: colors.success },
                    { label: "\u0645\u0631\u0641\u0648\u0636", value: "rejected" as const, color: colors.error },
                  ].map((opt) => (
                    <TouchableOpacity
                      key={opt.value}
                      onPress={() => setFormData({ ...formData, boardRepStatus: opt.value, approvedByBoardRep: opt.value === "approved" })}
                      style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 2, borderColor: formData.boardRepStatus === opt.value ? opt.color : colors.border, backgroundColor: formData.boardRepStatus === opt.value ? opt.color + "15" : "transparent" }}
                    >
                      <Text style={{ color: formData.boardRepStatus === opt.value ? opt.color : colors.muted, fontWeight: "600", fontSize: 11 }}>{opt.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {formData.boardRepStatus === "rejected" && (
                  <TextInput
                    value={formData.boardRepRejectionReason}
                    onChangeText={(text) => setFormData({ ...formData, boardRepRejectionReason: text })}
                    placeholder={"\u0633\u0628\u0628 \u0627\u0644\u0631\u0641\u0636"}
                    placeholderTextColor={colors.muted}
                    style={{ borderWidth: 1, borderColor: colors.error + "40", borderRadius: 8, padding: 10, fontSize: 13, color: colors.foreground, backgroundColor: colors.error + "08", textAlign: "right" }}
                  />
                )}
              </View>
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

      {/* \u0634\u0631\u064a\u0637 \u0627\u0644\u062a\u0635\u0641\u064a\u0629 */}
      {!isLoading && requests.length > 0 && (
        <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 }}>
          {/* \u062a\u0635\u0641\u064a\u0629 \u062d\u0633\u0628 \u0627\u0644\u0646\u0648\u0639 */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }} contentContainerStyle={{ gap: 6 }}>
            <TouchableOpacity
              onPress={() => setFilterType("all")}
              style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: filterType === "all" ? colors.primary : colors.surface, borderWidth: 1, borderColor: filterType === "all" ? colors.primary : colors.border }}
            >
              <Text style={{ fontSize: 11, fontWeight: "600", color: filterType === "all" ? "#fff" : colors.muted }}>{"\u0627\u0644\u0643\u0644"}</Text>
            </TouchableOpacity>
            {REQUEST_TYPES.map((t) => (
              <TouchableOpacity
                key={t.value}
                onPress={() => setFilterType(filterType === t.value ? "all" : t.value)}
                style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: filterType === t.value ? colors.primary : colors.surface, borderWidth: 1, borderColor: filterType === t.value ? colors.primary : colors.border }}
              >
                <Text style={{ fontSize: 11, fontWeight: "600", color: filterType === t.value ? "#fff" : colors.muted }}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          {/* \u062a\u0635\u0641\u064a\u0629 \u062d\u0633\u0628 \u0627\u0644\u062d\u0627\u0644\u0629 \u0648\u0627\u0644\u0642\u0633\u0645 */}
          <View style={{ flexDirection: "row", gap: 6 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {[{ label: "\u0642\u064a\u062f \u0627\u0644\u0627\u0646\u062a\u0638\u0627\u0631", value: "pending" }, { label: "\u0645\u0648\u0627\u0641\u0642", value: "approved" }, { label: "\u0645\u0631\u0641\u0648\u0636", value: "rejected" }].map((s) => (
                <TouchableOpacity
                  key={s.value}
                  onPress={() => setFilterStatus(filterStatus === s.value ? "all" : s.value)}
                  style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, backgroundColor: filterStatus === s.value ? (s.value === "approved" ? colors.success : s.value === "rejected" ? colors.error : colors.warning) + "20" : colors.surface, borderWidth: 1, borderColor: filterStatus === s.value ? (s.value === "approved" ? colors.success : s.value === "rejected" ? colors.error : colors.warning) : colors.border }}
                >
                  <Text style={{ fontSize: 10, fontWeight: "600", color: filterStatus === s.value ? (s.value === "approved" ? colors.success : s.value === "rejected" ? colors.error : colors.warning) : colors.muted }}>{s.label}</Text>
                </TouchableOpacity>
              ))}
              {DEPARTMENTS.map((d) => (
                <TouchableOpacity
                  key={d.value}
                  onPress={() => setFilterDepartment(filterDepartment === d.value ? "all" : d.value)}
                  style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, backgroundColor: filterDepartment === d.value ? colors.primary + "20" : colors.surface, borderWidth: 1, borderColor: filterDepartment === d.value ? colors.primary : colors.border }}
                >
                  <Text style={{ fontSize: 10, fontWeight: "600", color: filterDepartment === d.value ? colors.primary : colors.muted }}>{d.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
          {filteredRequests.length !== requests.length && (
            <Text style={{ color: colors.muted, fontSize: 10, marginTop: 6, textAlign: "right" }}>{"\u0639\u0631\u0636"} {filteredRequests.length} {"\u0645\u0646"} {requests.length} {"\u0637\u0644\u0628"}</Text>
          )}
        </View>
      )}

      {/* \u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0637\u0644\u0628\u0627\u062a */}
      {isLoading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredRequests}
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
