import React, { useState, useEffect } from "react";
import { useLanguage } from "@/lib/language-context";
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
import { useAuth } from "@/hooks/use-auth";
import { MaterialIcons } from "@expo/vector-icons";
import { administrativeService, AdministrativeData } from "@/lib/services/data.service";
import { administrativeExportService } from "@/lib/services/administrative-export";
import { notificationsService } from "@/lib/services/notifications.service";

const REQUEST_TYPES_AR = [
  { label: "طلب إجازة", value: "leave_request" },
  { label: "طلب استدعاء", value: "recall_request" },
  { label: "طلب سلفة", value: "advance_request" },
  { label: "طلب استقالة", value: "resignation_request" },
  { label: "طلب نقل كفالة", value: "sponsorship_transfer" },
  { label: "طلب تقدم راتب", value: "advance_salary" },
  { label: "طلب تدريب", value: "training_request" },
  { label: "طلب نقل", value: "transfer_request" },
];

const REQUEST_TYPES_EN = [
  { label: "Leave Request", value: "leave_request" },
  { label: "Recall Request", value: "recall_request" },
  { label: "Advance Request", value: "advance_request" },
  { label: "Resignation Request", value: "resignation_request" },
  { label: "Sponsorship Transfer", value: "sponsorship_transfer" },
  { label: "Salary Advance", value: "advance_salary" },
  { label: "Training Request", value: "training_request" },
  { label: "Transfer Request", value: "transfer_request" },
];

const DEPARTMENTS_AR = [
  { label: "قسم الإنتاج", value: "production" },
  { label: "مرحلة المكائن", value: "machines" },
  { label: "مرحلة الروسو", value: "rosso" },
  { label: "مرحلة القلب", value: "qalb" },
  { label: "مرحلة الكاوية", value: "kawiya" },
  { label: "مرحلة الفحص", value: "inspection" },
  { label: "مرحلة التغليف", value: "packing" },
  { label: "مرحلة مانع الانزلاق", value: "antislip" },
  { label: "مرحلة التخزين", value: "storage" },
  { label: "قسم الإجراءات الإدارية والمصروفات", value: "administrative" },
  { label: "قسم المبيعات والتحصيل", value: "sales" },
  { label: "قسم الصيانة", value: "maintenance" },
  { label: "ممثل مجلس الإدارة", value: "board_representative" },
  { label: "قسم المستودعات", value: "warehouse" },
  { label: "الموظفين", value: "employees" },
  { label: "المناقصات الحكومية والعسكرية", value: "government_tenders" },
];

const DEPARTMENTS_EN = [
  { label: "Production Department", value: "production" },
  { label: "Machines Stage", value: "machines" },
  { label: "Rosso Stage", value: "rosso" },
  { label: "Turning Stage", value: "qalb" },
  { label: "Ironing Stage", value: "kawiya" },
  { label: "Inspection Stage", value: "inspection" },
  { label: "Packing Stage", value: "packing" },
  { label: "Anti-slip Stage", value: "antislip" },
  { label: "Storage Stage", value: "storage" },
  { label: "Administrative & Expenses", value: "administrative" },
  { label: "Sales & Collection", value: "sales" },
  { label: "Maintenance Department", value: "maintenance" },
  { label: "Board Representative", value: "board_representative" },
  { label: "Warehouse Department", value: "warehouse" },
  { label: "Employees", value: "employees" },
  { label: "Government & Military Tenders", value: "government_tenders" },
];

type AdvanceFormData = {
  advanceAmount: string;
  previousAdvanceAmount: string;
  repaymentMethod: string;
  jobTitle: string;
  workLocation: string;
  formVersion: string;
  documentNumber: string;
};

const emptyAdvanceForm = (): AdvanceFormData => ({
  advanceAmount: "",
  previousAdvanceAmount: "",
  repaymentMethod: "",
  jobTitle: "",
  workLocation: "",
  formVersion: "1.0",
  documentNumber: "",
});

const parseAdvanceDetails = (details: string): { fields: AdvanceFormData; reason: string } => {
  try {
    const parsed = JSON.parse(details);
    if (parsed?.kind === "advance_request") {
      return {
        fields: {
          advanceAmount: String(parsed.advanceAmount ?? ""),
          previousAdvanceAmount: String(parsed.previousAdvanceAmount ?? ""),
          repaymentMethod: String(parsed.repaymentMethod ?? ""),
          jobTitle: String(parsed.jobTitle ?? ""),
          workLocation: String(parsed.workLocation ?? ""),
          formVersion: String(parsed.formVersion ?? "1.0"),
          documentNumber: String(parsed.documentNumber ?? ""),
        },
        reason: String(parsed.reason ?? ""),
      };
    }
  } catch {
    // الطلبات القديمة تحفظ التفاصيل كنص عادي.
  }
  return { fields: emptyAdvanceForm(), reason: details };
};

const serializeAdvanceDetails = (fields: AdvanceFormData, reason: string) => JSON.stringify({
  kind: "advance_request",
  formVersion: fields.formVersion || "1.0",
  documentNumber: fields.documentNumber || "",
  advanceAmount: fields.advanceAmount,
  previousAdvanceAmount: fields.previousAdvanceAmount,
  repaymentMethod: fields.repaymentMethod,
  jobTitle: fields.jobTitle,
  workLocation: fields.workLocation,
  reason,
});

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
  const { language } = useLanguage();
  const isAr = language === "ar";
  const REQUEST_TYPES = isAr ? REQUEST_TYPES_AR : REQUEST_TYPES_EN;
  const DEPARTMENTS = isAr ? DEPARTMENTS_AR : DEPARTMENTS_EN;
  const router = useRouter();
  const colors = useColors();
  const { user } = useAuth();
  const [requests, setRequests] = useState<AdministrativeData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<AdministrativeData>(emptyFormData());
  const [advanceForm, setAdvanceForm] = useState<AdvanceFormData>(emptyAdvanceForm());
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
        window.alert(isAr ? "يرجى ملء جميع الحقول المطلوبة (اسم الموظف وتفاصيل الطلب)" : "Please fill all required fields (employee name and request details)");
      }
      return;
    }
    if (formData.requestType === "advance_request" && (!advanceForm.advanceAmount.trim() || !advanceForm.repaymentMethod.trim())) {
      if (Platform.OS === "web") {
        window.alert(isAr ? "يرجى إدخال مبلغ السلفة وآلية السداد قبل الحفظ." : "Please enter the advance amount and repayment method before saving.");
      }
      return;
    }
    if (!user?.id) {
      if (Platform.OS === "web") {
        window.alert(isAr ? "انتهت جلسة الدخول. يرجى تسجيل الدخول مرة أخرى ثم إعادة إرسال الطلب." : "Your session has expired. Please sign in again and resubmit the request.");
      }
      return;
    }
    try {
      setIsLoading(true);
      const requestPayload = formData.requestType === "advance_request"
        ? { ...formData, requestDetails: serializeAdvanceDetails(advanceForm, formData.requestDetails) }
        : formData;
      if (editingId) {
        await administrativeService.update(editingId, requestPayload);
        // إشعار عند تحديث الطلب
        const oldRequest = requests.find(r => r.id === editingId);
        if (oldRequest) {
          if (oldRequest.directManagerStatus !== formData.directManagerStatus ||
              oldRequest.generalManagerStatus !== formData.generalManagerStatus ||
              oldRequest.boardRepStatus !== formData.boardRepStatus) {
            notificationsService.add({
              type: "admin",
              title: isAr ? "تحديث حالة طلب" : "Update Request Status",
              message: isAr ? `تم تحديث حالة طلب ${formData.employeeName} - ${getRequestTypeLabel(formData.requestType)}` : `Request status updated ${formData.employeeName} - ${getRequestTypeLabel(formData.requestType)}`,
              data: { requestId: editingId },
            });
          }
        }
      } else {
        await administrativeService.create({ ...requestPayload, userId: user.id });
        // إشعار عند إنشاء طلب جديد
        notificationsService.add({
          type: "admin",
          title: isAr ? "طلب إداري جديد" : "New Administrative Request",
          message: isAr ? `تم إنشاء طلب جديد: ${getRequestTypeLabel(formData.requestType)} - ${formData.employeeName}` : `New request created: ${getRequestTypeLabel(formData.requestType)} - ${formData.employeeName}`,
          data: { requestType: formData.requestType },
        });
      }
      setShowForm(false);
      resetForm();
      loadRequests();
    } catch (error) {
      console.error("Error saving:", error);
      if (Platform.OS === "web") {
        const message = error instanceof Error ? error.message : (isAr ? "تعذر حفظ الطلب. يرجى المحاولة مرة أخرى." : "The request could not be saved. Please try again.");
        window.alert(message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = (id: number) => {
    if (Platform.OS === "web") {
      if (window.confirm(isAr ? "هل أنت متأكد من حذف هذا الطلب؟" : "Are you sure you want to delete this request?")) {
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
    const parsedAdvance = request.requestType === "advance_request" ? parseAdvanceDetails(request.requestDetails) : null;
    setAdvanceForm(parsedAdvance?.fields || emptyAdvanceForm());
    setFormData({
      ...emptyFormData(),
      ...request,
      requestDetails: parsedAdvance?.reason || request.requestDetails,
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
    setAdvanceForm(emptyAdvanceForm());
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
    return (isAr ? REQUEST_TYPES_AR : REQUEST_TYPES_EN).find((t) => t.value === type)?.label || type;
  };

  const getDepartmentLabel = (dept: string) => {
    return (isAr ? DEPARTMENTS_AR : DEPARTMENTS_EN).find((d) => d.value === dept)?.label || dept || (isAr ? "غير محدد" : "Not specified");
  };

  const getReadableRequestDetails = (request: AdministrativeData) => {
    if (request.requestType !== "advance_request") return request.requestDetails;
    const parsed = parseAdvanceDetails(request.requestDetails);
    const fields = parsed.fields;
    return [
      `${isAr ? "مبلغ السلفة" : "Advance amount"}: ${fields.advanceAmount || (isAr ? "غير محدد" : "Not specified")} ريال`,
      `${isAr ? "سلفة سابقة" : "Previous advance"}: ${fields.previousAdvanceAmount || (isAr ? "لا يوجد" : "None")}`,
      `${isAr ? "آلية السداد" : "Repayment method"}: ${fields.repaymentMethod || (isAr ? "غير محددة" : "Not specified")}`,
      `${isAr ? "المسمى الوظيفي" : "Job title"}: ${fields.jobTitle || (isAr ? "غير محدد" : "Not specified")}`,
      `${isAr ? "مقر العمل" : "Work location"}: ${fields.workLocation || (isAr ? "غير محدد" : "Not specified")}`,
      `${isAr ? "الأسباب" : "Reason"}: ${parsed.reason || (isAr ? "غير محددة" : "Not specified")}`,
    ].join("\n");
  };

  const getStatusLabel = (request: AdministrativeData) => {
    const status = request.status || "pending";
    if (status === "approved") return isAr ? "موافق" : "Approved";
    if (status === "rejected") return isAr ? "مرفوض" : "Rejected";
    if (request.approvedByBoardRep || request.approvedByDirectManager || request.approvedByGeneralManager) return isAr ? "قيد المراجعة" : "Under Review";
    return isAr ? "قيد الانتظار" : "Pending";
  };

  const getStatusColor = (request: AdministrativeData) => {
    const status = request.status || "pending";
    if (status === "approved") return colors.success;
    if (status === "rejected") return colors.error;
    if (request.approvedByBoardRep || request.approvedByDirectManager || request.approvedByGeneralManager) return colors.warning;
    return colors.muted;
  };

  const getApproverStatusLabel = (status: string) => {
    if (status === "approved") return isAr ? "موافق" : "Approved";
    if (status === "rejected") return isAr ? "مرفوض" : "Rejected";
    return isAr ? "قيد الانتظار" : "Pending";
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
    const content = isAr ? `طلب إداري - ${getRequestTypeLabel(item.requestType)}
` : `Administrative Request - ${getRequestTypeLabel(item.requestType)}
` +
      (item.referenceNumber ? isAr ? `الرقم المرجعي: ${item.referenceNumber}
` : `Reference Number: ${item.referenceNumber}
` : "") +
      (item.submissionDate ? isAr ? `تاريخ التقديم: ${formatDate(item.submissionDate)}
` : `Submission Date: ${formatDate(item.submissionDate)}
` : "") +
      isAr ? `اسم الموظف: ${item.employeeName}
` : `Employee Name: ${item.employeeName}
` +
      `الرقم الوظيفي: ${item.employeeNumber || isAr ? isAr ? "غير محدد" : "Not specified" : "Not specified"}\n` +
      isAr ? `الإدارة/القسم: ${getDepartmentLabel(item.department)}
` : `Department/Section: ${getDepartmentLabel(item.department)}
` +
      isAr ? `تفاصيل الطلب:\n${getReadableRequestDetails(item)}
` : `Request Details:\n${getReadableRequestDetails(item)}
` +
      (item.attachments && item.attachments.length > 0 ? isAr ? `المرفقات: ${item.attachments.join(", ")}
` : `Attachments: ${item.attachments.join(", ")}
` : "") +
      isAr ? `
الموافقات:
` : `
Approvals:
` +
      isAr ? `- المدير المباشر: ${getApproverStatusLabel(directStatus)}${item.directManagerActionDate ? " (" + formatDate(item.directManagerActionDate) + ")" : ""}${item.directManagerRejectionReason ? " - سبب الرفض: " + item.directManagerRejectionReason : ""}
` : `- Direct Manager: ${getApproverStatusLabel(directStatus)}${item.directManagerActionDate ? " (" + formatDate(item.directManagerActionDate) + ")" : ""}${item.directManagerRejectionReason ? " - Rejection Reason: " + item.directManagerRejectionReason : ""}
` +
      isAr ? `- المدير العام: ${getApproverStatusLabel(generalStatus)}${item.generalManagerActionDate ? " (" + formatDate(item.generalManagerActionDate) + ")" : ""}${item.generalManagerRejectionReason ? " - سبب الرفض: " + item.generalManagerRejectionReason : ""}
` : `- General Manager: ${getApproverStatusLabel(generalStatus)}${item.generalManagerActionDate ? " (" + formatDate(item.generalManagerActionDate) + ")" : ""}${item.generalManagerRejectionReason ? " - Rejection Reason: " + item.generalManagerRejectionReason : ""}
` +
      isAr ? `- ممثل مجلس الإدارة: ${getApproverStatusLabel(boardStatus)}${item.boardRepActionDate ? " (" + formatDate(item.boardRepActionDate) + ")" : ""}${item.boardRepRejectionReason ? " - سبب الرفض: " + item.boardRepRejectionReason : ""}` : `- Board Representative: ${getApproverStatusLabel(boardStatus)}${item.boardRepActionDate ? " (" + formatDate(item.boardRepActionDate) + ")" : ""}${item.boardRepRejectionReason ? " - Rejection Reason: " + item.boardRepRejectionReason : ""}`;
    if (Platform.OS === "web") {
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(`<html dir="rtl"><head><title>طباعة الطلب</title><style>body{font-family:Arial,sans-serif;padding:40px;direction:rtl;white-space:pre-wrap;line-height:2;font-size:16px;}h2{color:#0a7ea4;border-bottom:2px solid #0a7ea4;padding-bottom:10px;}</style></head><body><h2>طلب إداري - ${getRequestTypeLabel(item.requestType)}</h2>${content.replace(/\n/g, "<br>")}</body></html>`);
        printWindow.document.close();
        printWindow.print();
      }
    } else {
      import("react-native").then(({ Share }) => {
        Share.share({ message: content, title: isAr ? `طلب إداري - ${item.employeeName}` : `Administrative Request - ${item.employeeName}` });
      });
    }
  };

  const renderRequestItem = ({ item }: { item: AdministrativeData }) => (
    <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.border }}>
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
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.foreground, fontWeight: 'bold', fontSize: 16 }}>{item.employeeName}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
            {item.employeeNumber ? (
              <Text style={{ color: colors.muted, fontSize: 12 }}>{isAr ? "رقم وظيفي: " : "Employee #: "}{item.employeeNumber}</Text>
            ) : null}
            {item.department ? (
              <Text style={{ color: colors.muted, fontSize: 12 }}>| {getDepartmentLabel(item.department)}</Text>
            ) : null}
          </View>
          <View style={{ marginTop: 8, backgroundColor: colors.primary + "15", alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 }}>
            <Text style={{ color: colors.primary, fontSize: 11, fontWeight: "600" }}>
              {getRequestTypeLabel(item.requestType)}
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
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
      <Text style={{ color: colors.muted, fontSize: 14, marginBottom: 12, lineHeight: 20 }}>{getReadableRequestDetails(item)}</Text>

      {/* Attachments */}
      {item.attachments && item.attachments.length > 0 && (
        <View style={{ marginBottom: 12, backgroundColor: colors.background, borderRadius: 8, padding: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 4 }}>
            <MaterialIcons name="attach-file" size={14} color={colors.muted} />
            <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "600" }}>{isAr ? "المرفقات" : "Attachments"} ({item.attachments.length})</Text>
          </View>
          {item.attachments.map((att, idx) => (
            <Text key={idx} style={{ color: colors.primary, fontSize: 11, marginLeft: 16 }}>{"\u2022"} {att}</Text>
          ))}
        </View>
      )}

      {/* Approvals with per-approver status */}
      <View style={{ backgroundColor: colors.background, borderRadius: 10, padding: 12 }}>
        <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: "700", marginBottom: 10, textAlign: isAr ? "right" : "left" }}>{isAr ? "الموافقات" : "Approvals"}</Text>
        
        {/* \u0627\u0644\u0645\u062f\u064a\u0631 \u0627\u0644\u0645\u0628\u0627\u0634\u0631 */}
        <View style={{ marginBottom: 8, paddingVertical: 8, paddingHorizontal: 10, backgroundColor: colors.surface, borderRadius: 8, borderWidth: 1, borderColor: colors.border }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12, backgroundColor: (item.directManagerStatus || (item.approvedByDirectManager ? "approved" : "pending")) === "approved" ? colors.success + "20" : (item.directManagerStatus || "pending") === "rejected" ? colors.error + "20" : colors.muted + "20" }}>
              <Text style={{ fontSize: 10, fontWeight: "700", color: (item.directManagerStatus || (item.approvedByDirectManager ? "approved" : "pending")) === "approved" ? colors.success : (item.directManagerStatus || "pending") === "rejected" ? colors.error : colors.muted }}>
                {getApproverStatusLabel(item.directManagerStatus || (item.approvedByDirectManager ? "approved" : "pending"))}
              </Text>
            </View>
            <Text style={{ fontSize: 12, color: colors.foreground, fontWeight: "500" }}>{isAr ? "المدير المباشر" : "Direct Manager"}</Text>
          </View>
          {item.directManagerActionDate ? (
            <Text style={{ color: colors.muted, fontSize: 9, textAlign: "left", marginTop: 4 }}>{formatDate(item.directManagerActionDate)}</Text>
          ) : null}
        </View>
        {item.directManagerRejectionReason ? (
          <Text style={{ color: colors.error, fontSize: 10, marginBottom: 8, marginTop: -4, textAlign: isAr ? "right" : "left", paddingHorizontal: 10 }}>{isAr ? "سبب الرفض: " : "Rejection reason: "}{item.directManagerRejectionReason}</Text>
        ) : null}

        {/* \u0627\u0644\u0645\u062f\u064a\u0631 \u0627\u0644\u0639\u0627\u0645 */}
        <View style={{ marginBottom: 8, paddingVertical: 8, paddingHorizontal: 10, backgroundColor: colors.surface, borderRadius: 8, borderWidth: 1, borderColor: colors.border }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12, backgroundColor: (item.generalManagerStatus || (item.approvedByGeneralManager ? "approved" : "pending")) === "approved" ? colors.success + "20" : (item.generalManagerStatus || "pending") === "rejected" ? colors.error + "20" : colors.muted + "20" }}>
              <Text style={{ fontSize: 10, fontWeight: "700", color: (item.generalManagerStatus || (item.approvedByGeneralManager ? "approved" : "pending")) === "approved" ? colors.success : (item.generalManagerStatus || "pending") === "rejected" ? colors.error : colors.muted }}>
                {getApproverStatusLabel(item.generalManagerStatus || (item.approvedByGeneralManager ? "approved" : "pending"))}
              </Text>
            </View>
            <Text style={{ fontSize: 12, color: colors.foreground, fontWeight: "500" }}>{isAr ? "المدير العام" : "General Manager"}</Text>
          </View>
          {item.generalManagerActionDate ? (
            <Text style={{ color: colors.muted, fontSize: 9, textAlign: "left", marginTop: 4 }}>{formatDate(item.generalManagerActionDate)}</Text>
          ) : null}
        </View>
        {item.generalManagerRejectionReason ? (
          <Text style={{ color: colors.error, fontSize: 10, marginBottom: 8, marginTop: -4, textAlign: isAr ? "right" : "left", paddingHorizontal: 10 }}>{isAr ? "سبب الرفض: " : "Rejection reason: "}{item.generalManagerRejectionReason}</Text>
        ) : null}

        {/* \u0645\u0645\u062b\u0644 \u0645\u062c\u0644\u0633 \u0627\u0644\u0625\u062f\u0627\u0631\u0629 */}
        <View style={{ marginBottom: 4, paddingVertical: 8, paddingHorizontal: 10, backgroundColor: colors.surface, borderRadius: 8, borderWidth: 1, borderColor: colors.border }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12, backgroundColor: (item.boardRepStatus || (item.approvedByBoardRep ? "approved" : "pending")) === "approved" ? colors.success + "20" : (item.boardRepStatus || "pending") === "rejected" ? colors.error + "20" : colors.muted + "20" }}>
              <Text style={{ fontSize: 10, fontWeight: "700", color: (item.boardRepStatus || (item.approvedByBoardRep ? "approved" : "pending")) === "approved" ? colors.success : (item.boardRepStatus || "pending") === "rejected" ? colors.error : colors.muted }}>
                {getApproverStatusLabel(item.boardRepStatus || (item.approvedByBoardRep ? "approved" : "pending"))}
              </Text>
            </View>
            <Text style={{ fontSize: 12, color: colors.foreground, fontWeight: "500" }}>{isAr ? "ممثل مجلس الإدارة" : "Board Representative"}</Text>
          </View>
          {item.boardRepActionDate ? (
            <Text style={{ color: colors.muted, fontSize: 9, textAlign: "left", marginTop: 4 }}>{formatDate(item.boardRepActionDate)}</Text>
          ) : null}
        </View>
        {item.boardRepRejectionReason ? (
          <Text style={{ color: colors.error, fontSize: 10, marginBottom: 4, marginTop: 0, textAlign: isAr ? "right" : "left", paddingHorizontal: 10 }}>{isAr ? "سبب الرفض: " : "Rejection reason: "}{item.boardRepRejectionReason}</Text>
        ) : null}
      </View>

      {/* Print/Share Button - large and visible */}
      <TouchableOpacity
        onPress={() => administrativeExportService.exportSingle(item)}
        style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 12, paddingVertical: 12, paddingHorizontal: 16, backgroundColor: colors.primary + "12", borderRadius: 10, borderWidth: 1, borderColor: colors.primary + "30" }}
      >
        <MaterialIcons name="print" size={20} color={colors.primary} />
        <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "600" }}>{isAr ? "طباعة / مشاركة الطلب" : "Print / Share Request"}</Text>
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
      <View style={{ flex: 1 }}>
        <View style={{ flex: 1, backgroundColor: colors.background, marginTop: 32 }}>
          {/* Form Header */}
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <TouchableOpacity onPress={() => { setShowForm(false); resetForm(); }}>
              <Text style={{ color: colors.error, fontWeight: "600", fontSize: 16 }}>{isAr ? "إلغاء" : "Cancel"}</Text>
            </TouchableOpacity>
            <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 18 }}>
              {editingId ? (isAr ? "تعديل الطلب" : "Edit Request") : (isAr ? "إضافة طلب جديد" : "Add New Request")}
            </Text>
            <TouchableOpacity onPress={handleSave} disabled={isLoading}>
              <Text style={{ color: isLoading ? colors.muted : colors.primary, fontWeight: "700", fontSize: 16 }}>
                {isLoading ? (isAr ? "جاري..." : "Saving...") : (isAr ? "حفظ" : "Save")}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Form Content */}
          <ScrollView style={{ flex: 1, padding: 20 }} keyboardShouldPersistTaps="handled">
            {/* \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a \u0627\u0644\u0623\u0633\u0627\u0633\u064a\u0629 */}
            <View style={{ marginBottom: 24 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <MaterialIcons name="person" size={20} color={colors.primary} />
                <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 16 }}>{isAr ? "البيانات الأساسية" : "Basic Information"}</Text>
              </View>

              {/* \u0627\u0633\u0645 \u0627\u0644\u0645\u0648\u0638\u0641 */}
              <View style={{ marginBottom: 16 }}>
                <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600", marginBottom: 8, textAlign: isAr ? "right" : "left" }}>{isAr ? "اسم الموظف" : "Employee Name"} <Text style={{ color: colors.error }}>*</Text></Text>
                <TextInput
                  value={formData.employeeName}
                  onChangeText={(text) => setFormData({ ...formData, employeeName: text })}
                  placeholder={isAr ? "أدخل اسم الموظف" : "Enter employee name"}
                  placeholderTextColor={colors.muted}
                  style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, fontSize: 14, color: colors.foreground, backgroundColor: colors.surface, textAlign: "right" }}
                />
              </View>

              {/* \u0627\u0644\u0631\u0642\u0645 \u0627\u0644\u0648\u0638\u064a\u0641\u064a */}
              <View style={{ marginBottom: 16 }}>
                <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600", marginBottom: 8, textAlign: isAr ? "right" : "left" }}>{isAr ? "الرقم الوظيفي" : "Employee Number"}</Text>
                <TextInput
                  value={formData.employeeNumber}
                  onChangeText={(text) => setFormData({ ...formData, employeeNumber: text })}
                  placeholder={isAr ? "أدخل الرقم الوظيفي" : "Enter employee number"}
                  placeholderTextColor={colors.muted}
                  keyboardType="numeric"
                  style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, fontSize: 14, color: colors.foreground, backgroundColor: colors.surface, textAlign: "right" }}
                />
              </View>

              {/* \u0627\u0644\u0625\u062f\u0627\u0631\u0629 / \u0627\u0644\u0642\u0633\u0645 */}
              <View style={{ marginBottom: 16 }}>
                <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600", marginBottom: 8, textAlign: isAr ? "right" : "left" }}>{isAr ? "الإدارة / القسم" : "Department / Section"}</Text>
                <TouchableOpacity
                  onPress={() => setShowDepartmentDropdown(!showDepartmentDropdown)}
                  style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, backgroundColor: colors.surface, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
                >
                  <MaterialIcons name={showDepartmentDropdown ? "expand-less" : "expand-more"} size={20} color={colors.muted} />
                  <Text style={{ color: formData.department ? colors.foreground : colors.muted, fontSize: 14 }}>
                    {formData.department ? getDepartmentLabel(formData.department) : (isAr ? "اختر القسم" : "Select Department")}
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
                <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600", marginBottom: 8, textAlign: isAr ? "right" : "left" }}>{isAr ? "نوع الطلب" : "Request Type"} <Text style={{ color: colors.error }}>*</Text></Text>
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
                <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600", marginBottom: 8, textAlign: isAr ? "right" : "left" }}>{formData.requestType === "advance_request" ? (isAr ? "أسباب طلب السلفة" : "Reason for Advance") : (isAr ? "تفاصيل الطلب" : "Request Details")} <Text style={{ color: colors.error }}>*</Text></Text>
                <TextInput
                  value={formData.requestDetails}
                  onChangeText={(text) => setFormData({ ...formData, requestDetails: text })}
                  placeholder={formData.requestType === "advance_request" ? (isAr ? "اكتب أسباب طلب السلفة" : "Enter the reason for the advance") : (isAr ? "أدخل تفاصيل الطلب" : "Enter request details")}
                  placeholderTextColor={colors.muted}
                  multiline
                  numberOfLines={4}
                  style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, fontSize: 14, color: colors.foreground, backgroundColor: colors.surface, textAlign: "right", textAlignVertical: "top", minHeight: 100 }}
                />
              </View>

              {formData.requestType === "advance_request" && (
                <View style={{ marginTop: 4, marginBottom: 8, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.primary + "50", backgroundColor: colors.primary + "08" }}>
                  <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 15, textAlign: "right", marginBottom: 14 }}>{isAr ? "بيانات طلب السلفة" : "Advance Request Details"}</Text>
                  {[
                    { key: "advanceAmount", label: isAr ? "مبلغ السلفة بالريال" : "Advance Amount (SAR)", placeholder: isAr ? "مثال: 1500" : "Example: 1500", required: true },
                    { key: "previousAdvanceAmount", label: isAr ? "مبلغ سلفة سابقة إن وجدت" : "Previous Advance Amount (if any)", placeholder: isAr ? "اتركه فارغاً إذا لا يوجد" : "Leave empty if none", required: false },
                    { key: "repaymentMethod", label: isAr ? "آلية السداد" : "Repayment Method", placeholder: isAr ? "مثال: خصم شهري من الراتب" : "Example: Monthly salary deduction", required: true },
                    { key: "jobTitle", label: isAr ? "المسمى الوظيفي" : "Job Title", placeholder: isAr ? "أدخل المسمى الوظيفي" : "Enter job title", required: false },
                    { key: "workLocation", label: isAr ? "مقر العمل / الموقع" : "Work Location", placeholder: isAr ? "أدخل مقر العمل" : "Enter work location", required: false },
                  ].map((field) => (
                    <View key={field.key} style={{ marginBottom: 12 }}>
                      <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: "600", marginBottom: 6, textAlign: "right" }}>{field.label}{field.required ? <Text style={{ color: colors.error }}> *</Text> : null}</Text>
                      <TextInput
                        value={advanceForm[field.key as keyof AdvanceFormData]}
                        onChangeText={(text) => setAdvanceForm({ ...advanceForm, [field.key]: text })}
                        placeholder={field.placeholder}
                        placeholderTextColor={colors.muted}
                        keyboardType={field.key.includes("Amount") ? "numeric" : "default"}
                        style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 9, padding: 11, fontSize: 13, color: colors.foreground, backgroundColor: colors.surface, textAlign: "right" }}
                      />
                    </View>
                  ))}
                  <Text style={{ color: colors.muted, fontSize: 11, textAlign: "right", lineHeight: 18 }}>{isAr ? "تُحفظ هذه البيانات داخل الطلب وتظهر عند التعديل والطباعة." : "These details are saved with the request and appear during editing and printing."}</Text>
                </View>
              )}
            </View>

            {/* \u0627\u0644\u0645\u0631\u0641\u0642\u0627\u062a */}
            <View style={{ marginBottom: 24 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <MaterialIcons name="attach-file" size={20} color={colors.primary} />
                <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 16 }}>{isAr ? "إرفاق نماذج ومستندات" : "Attach Forms & Documents"}</Text>
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
                  placeholder={isAr ? "اسم المستند أو رابط المرفق" : "Document name or attachment link"}
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
                <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 16 }}>{isAr ? "الموافقات" : "Approvals"}</Text>
              </View>

              {/* \u0645\u0648\u0627\u0641\u0642\u0629 \u0627\u0644\u0645\u062f\u064a\u0631 \u0627\u0644\u0645\u0628\u0627\u0634\u0631 */}
              <View style={{ marginBottom: 16, backgroundColor: colors.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.border }}>
                <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "600", textAlign: isAr ? "right" : "left", marginBottom: 10 }}>{isAr ? "المدير المباشر" : "Direct Manager"}</Text>
                <View style={{ flexDirection: "row", gap: 6, justifyContent: "flex-end", marginBottom: 8 }}>
                  {[
                    { label: isAr ? "قيد الانتظار" : "Pending", value: "pending" as const, color: colors.muted },
                    { label: isAr ? "موافق" : "Approved", value: "approved" as const, color: colors.success },
                    { label: isAr ? "مرفوض" : "Rejected", value: "rejected" as const, color: colors.error },
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
                    placeholder={isAr ? "سبب الرفض" : "Rejection reason"}
                    placeholderTextColor={colors.muted}
                    style={{ borderWidth: 1, borderColor: colors.error + "40", borderRadius: 8, padding: 10, fontSize: 13, color: colors.foreground, backgroundColor: colors.error + "08", textAlign: isAr ? "right" : "left" }}
                  />
                )}
              </View>

              {/* موافقة المدير العام */}
              <View style={{ marginBottom: 16, backgroundColor: colors.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.border }}>
                <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "600", textAlign: isAr ? "right" : "left", marginBottom: 10 }}>{isAr ? "المدير العام" : "General Manager"}</Text>
                <View style={{ flexDirection: "row", gap: 6, justifyContent: "flex-end", marginBottom: 8 }}>
                  {[
                    { label: isAr ? "قيد الانتظار" : "Pending", value: "pending" as const, color: colors.muted },
                    { label: isAr ? "موافق" : "Approved", value: "approved" as const, color: colors.success },
                    { label: isAr ? "مرفوض" : "Rejected", value: "rejected" as const, color: colors.error },
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
                    placeholder={isAr ? "سبب الرفض" : "Rejection reason"}
                    placeholderTextColor={colors.muted}
                    style={{ borderWidth: 1, borderColor: colors.error + "40", borderRadius: 8, padding: 10, fontSize: 13, color: colors.foreground, backgroundColor: colors.error + "08", textAlign: isAr ? "right" : "left" }}
                  />
                )}
              </View>

              {/* موافقة ممثل مجلس الإدارة */}
              <View style={{ marginBottom: 16, backgroundColor: colors.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.border }}>
                <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "600", textAlign: isAr ? "right" : "left", marginBottom: 10 }}>{isAr ? "ممثل مجلس الإدارة" : "Board Representative"}</Text>
                <View style={{ flexDirection: "row", gap: 6, justifyContent: "flex-end", marginBottom: 8 }}>
                  {[
                    { label: isAr ? "قيد الانتظار" : "Pending", value: "pending" as const, color: colors.muted },
                    { label: isAr ? "موافق" : "Approved", value: "approved" as const, color: colors.success },
                    { label: isAr ? "مرفوض" : "Rejected", value: "rejected" as const, color: colors.error },
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
                    placeholder={isAr ? "سبب الرفض" : "Rejection reason"}
                    placeholderTextColor={colors.muted}
                    style={{ borderWidth: 1, borderColor: colors.error + "40", borderRadius: 8, padding: 10, fontSize: 13, color: colors.foreground, backgroundColor: colors.error + "08", textAlign: isAr ? "right" : "left" }}
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
    <ScreenContainer style={{ backgroundColor: colors.background }}>
      {/* \u0631\u0623\u0633 \u0627\u0644\u0635\u0641\u062d\u0629 */}
      <View
        style={{ backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
      >
        {/* \u0632\u0631 \u0627\u0644\u0625\u0636\u0627\u0641\u0629 \u0648\u0627\u0644\u062a\u0635\u062f\u064a\u0631 */}
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TouchableOpacity
            onPress={() => { resetForm(); setShowForm(true); }}
            style={{ backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 12, padding: 8 }}
          >
            <MaterialIcons name="add" size={24} color="white" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => administrativeExportService.exportAll()}
            style={{ backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 12, padding: 8 }}
          >
            <MaterialIcons name="picture-as-pdf" size={24} color="white" />
          </TouchableOpacity>
        </View>
        {/* \u0627\u0644\u0639\u0646\u0648\u0627\u0646 */}
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={{ color: '#ffffff', fontWeight: 'bold', fontSize: 20 }}>{isAr ? "الإجراءات الإدارية" : "Administrative Procedures"}</Text>
          <Text style={{ fontSize: 14, marginTop: 4, color: '#ffffff' }}>{requests.length} {isAr ? "طلب" : "requests"}</Text>
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
              <Text style={{ fontSize: 11, fontWeight: "600", color: filterType === "all" ? "#fff" : colors.muted }}>{isAr ? "الكل" : "All"}</Text>
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
            <Text style={{ color: colors.muted, fontSize: 10, marginTop: 6, textAlign: isAr ? "right" : "left" }}>{isAr ? `عرض ${filteredRequests.length} من ${requests.length} طلب` : `Showing ${filteredRequests.length} of ${requests.length} requests`}</Text>
          )}
        </View>
      )}

      {/* \u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0637\u0644\u0628\u0627\u062a */}
      {isLoading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredRequests}
          renderItem={renderRequestItem}
          keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
          contentContainerStyle={{ padding: 16, flexGrow: 1 }}
          ListEmptyComponent={
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 80 }}>
              <View style={{ backgroundColor: colors.primary + "15", borderRadius: 40, padding: 20 }}>
                <MaterialIcons name="description" size={48} color={colors.primary} />
              </View>
              <Text style={{ color: colors.foreground, fontSize: 18, marginTop: 20, fontWeight: "700" }}>{isAr ? "الإجراءات الإدارية" : "Administrative Procedures"}</Text>
              <Text style={{ color: colors.muted, fontSize: 14, marginTop: 8, textAlign: "center", paddingHorizontal: 32 }}>
                {isAr ? "لا توجد طلبات إدارية بعد.\nاضغط على زر (+) لإضافة طلب جديد." : "No administrative requests yet.\nPress (+) to add a new request."}
              </Text>
              <TouchableOpacity
                onPress={() => { resetForm(); setShowForm(true); }}
                style={{ backgroundColor: colors.primary, marginTop: 24, paddingHorizontal: 32, paddingVertical: 12, borderRadius: 12 }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={{ color: "white", fontWeight: "600" }}>{isAr ? "إضافة طلب" : "Add Request"}</Text>
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
