import React, { useState, useEffect } from "react";
import { BackButton } from "@/components/back-button";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  StyleSheet,
  Alert,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { MaterialIcons } from "@expo/vector-icons";
import { maintenanceEntriesService } from "@/lib/services/data.service";
import { useAuth } from "@/lib/auth-context";
import { AttachmentPicker } from "@/components/attachment-picker";
import { AttachmentFile } from "@/lib/services/attachment.service";
import { useLanguage } from "@/lib/language-context";

// ===== أنواع البيانات =====
interface BaseEntry {
  id: string;
  entryPerson: string;
  date: string;
}

interface PeriodicEntry extends BaseEntry {
  devices: string;
  results: string;
  recommendations: string;
}

interface EmergencyEntry extends BaseEntry {
  location: string;
  requestingParty: string;
  cause: string;
  action: string;
  duration: string;
  results: string;
  documentAttached: boolean;
}

interface StoppedDeviceEntry extends BaseEntry {
  deviceName: string;
  status: string; // يعمل، لايعمل، صيانة
  stopReason: string;
  recommendations: string;
}

interface SafetyEntry extends BaseEntry {
  wearingSafety: string; // مطابق، غير مطابق، تحسين
  workEnvironment: string;
  firstAidTools: string;
  fireExtinguishers: string;
}

interface SafetyRecommendationEntry extends BaseEntry {
  recommendation: string;
}

interface WorkInjuryEntry extends BaseEntry {
  injuredName: string;
  injuryType: string;
  injuryDate: string;
  actions: string;
  severity: string; // خفيفة، متوسطة، حرجة، إعاقة، وفاة
}

interface SickLeaveEntry extends BaseEntry {
  employeeName: string;
  leaveSource: string;
  leaveDate: string;
  reason: string;
  duration: string;
  recommendations: string;
}

type AnyEntry = PeriodicEntry | EmergencyEntry | StoppedDeviceEntry | SafetyEntry | SafetyRecommendationEntry | WorkInjuryEntry | SickLeaveEntry;

const getSectionTitles = (isAr: boolean): Record<string, string> => ({
  periodic: isAr ? "الجدول الدوري للصيانة" : "Periodic Maintenance Schedule",
  emergency: isAr ? "الطوارئ" : "Emergency",
  "stopped-devices": isAr ? "تقرير الأجهزة المتوقفة" : "Stopped Devices Report",
  safety: isAr ? "السلامة" : "Safety",
  "safety-recommendations": isAr ? "توصيات السلامة والصحة المهنية" : "Occupational Safety Recommendations",
  "work-injuries": isAr ? "إصابات العمل" : "Work Injuries",
  "sick-leaves": isAr ? "حصر الإجازات المرضية" : "Sick Leaves",
});

const getDeviceStatusOptions = (isAr: boolean) => [isAr ? "يعمل" : "Working", isAr ? "لايعمل" : "Not Working", isAr ? "صيانة" : "Maintenance"];
const getSafetyOptions = (isAr: boolean) => [isAr ? "مطابق" : "Compliant", isAr ? "غير مطابق" : "Non-compliant", isAr ? "تحسين" : "Needs Improvement"];
const getSeverityOptions = (isAr: boolean) => [isAr ? "خفيفة" : "Mild", isAr ? "متوسطة" : "Moderate", isAr ? "حرجة" : "Critical", isAr ? "إعاقة" : "Disability", isAr ? "وفاة" : "Death"];

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function MaintenanceSectionScreen() {
  const router = useRouter();
  const colors = useColors();
  const { language, t, isRtl } = useLanguage();
  const isAr = language === 'ar';
  const params = useLocalSearchParams<{ section: string; entryPerson: string }>();
  const section = params.section || "periodic";
  const entryPerson = decodeURIComponent(params.entryPerson || "");
  const title = getSectionTitles(isAr)[section] || (isAr ? "الصيانة" : "Maintenance");

  const [sectionAttachments, setSectionAttachments] = useState<AttachmentFile[]>([]);

  const [entries, setEntries] = useState<AnyEntry[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<AnyEntry | null>(null);
  const [date, setDate] = useState(formatDate(new Date()));

  // حقول الجدول الدوري
  const [devices, setDevices] = useState("");
  const [results, setResults] = useState("");
  const [recommendations, setRecommendations] = useState("");

  // حقول الطوارئ
  const [location, setLocation] = useState("");
  const [requestingParty, setRequestingParty] = useState("");
  const [cause, setCause] = useState("");
  const [action, setAction] = useState("");
  const [duration, setDuration] = useState("");
  const [documentAttached, setDocumentAttached] = useState(false);

  // حقول الأجهزة المتوقفة
  const [deviceName, setDeviceName] = useState("");
  const [deviceStatus, setDeviceStatus] = useState("");
  const [stopReason, setStopReason] = useState("");

  // حقول السلامة
  const [wearingSafety, setWearingSafety] = useState("");
  const [workEnvironment, setWorkEnvironment] = useState("");
  const [firstAidTools, setFirstAidTools] = useState("");
  const [fireExtinguishers, setFireExtinguishers] = useState("");

  // حقول توصيات السلامة
  const [recommendation, setRecommendation] = useState("");

  // حقول إصابات العمل
  const [injuredName, setInjuredName] = useState("");
  const [injuryType, setInjuryType] = useState("");
  const [injuryDate, setInjuryDate] = useState(formatDate(new Date()));
  const [actions, setActions] = useState("");
  const [severity, setSeverity] = useState("");

  // حقول الإجازات المرضية
  const [employeeName, setEmployeeName] = useState("");
  const [leaveSource, setLeaveSource] = useState("");
  const [leaveDate, setLeaveDate] = useState(formatDate(new Date()));
  const [reason, setReason] = useState("");
  const [leaveDuration, setLeaveDuration] = useState("");
  const [leaveRecommendations, setLeaveRecommendations] = useState("");

  useEffect(() => { loadEntries(); }, []);

  const { user } = useAuth();

  const loadEntries = async () => {
    try {
      const results = await maintenanceEntriesService.getBySection(section);
      if (results && results.length > 0) {
        setEntries(results.map((r: any) => ({
          id: String(r.id),
          entryPerson: r.entry_person || r.entryPerson || "",
          date: r.date || "",
          ...(r.data || {}),
        })));
      } else {
        setEntries([]);
      }
    } catch (e) {
      console.log("Error loading entries:", e);
      setEntries([]);
    }
  };

  const resetForm = () => {
    setDate(formatDate(new Date()));
    setDevices(""); setResults(""); setRecommendations("");
    setLocation(""); setRequestingParty(""); setCause(""); setAction(""); setDuration(""); setDocumentAttached(false);
    setDeviceName(""); setDeviceStatus(""); setStopReason("");
    setWearingSafety(""); setWorkEnvironment(""); setFirstAidTools(""); setFireExtinguishers("");
    setRecommendation("");
    setInjuredName(""); setInjuryType(""); setInjuryDate(formatDate(new Date())); setActions(""); setSeverity("");
    setEmployeeName(""); setLeaveSource(""); setLeaveDate(formatDate(new Date())); setReason(""); setLeaveDuration(""); setLeaveRecommendations("");
    setEditingEntry(null);
    setShowForm(false);
  };

  const handleSave = async () => {
    let newEntry: AnyEntry;
    const base = { id: editingEntry?.id || Date.now().toString(), entryPerson, date };

    switch (section) {
      case "periodic":
        newEntry = { ...base, devices, results, recommendations } as PeriodicEntry;
        break;
      case "emergency":
        newEntry = { ...base, location, requestingParty, cause, action, duration, results, documentAttached } as EmergencyEntry;
        break;
      case "stopped-devices":
        newEntry = { ...base, deviceName, status: deviceStatus, stopReason, recommendations } as StoppedDeviceEntry;
        break;
      case "safety":
        newEntry = { ...base, wearingSafety, workEnvironment, firstAidTools, fireExtinguishers } as SafetyEntry;
        break;
      case "safety-recommendations":
        newEntry = { ...base, recommendation } as SafetyRecommendationEntry;
        break;
      case "work-injuries":
        newEntry = { ...base, injuredName, injuryType, injuryDate, actions, severity } as WorkInjuryEntry;
        break;
      case "sick-leaves":
        newEntry = { ...base, employeeName, leaveSource, leaveDate, reason, duration: leaveDuration, recommendations: leaveRecommendations } as SickLeaveEntry;
        break;
      default:
        return;
    }

    let newEntries: AnyEntry[];
    if (editingEntry) {
      newEntries = entries.map((e) => (e.id === editingEntry.id ? newEntry : e));
    } else {
      newEntries = [newEntry, ...entries];
    }
    try {
      const { id, entryPerson: _ep, date: _d, ...entryData } = newEntry as any;
      if (editingEntry) {
        await maintenanceEntriesService.update(parseInt(editingEntry.id), entryData, newEntry.date);
      } else {
        await maintenanceEntriesService.create(section, entryData, entryPerson, newEntry.date, user?.id);
      }
      await loadEntries();
    } catch (e) {
      Alert.alert(t("error"), isAr ? "فشل حفظ البيانات" : "Failed to save data");
    }
    resetForm();
  };

  const handleEdit = (entry: AnyEntry) => {
    setDate(entry.date);
    switch (section) {
      case "periodic": {
        const e = entry as PeriodicEntry;
        setDevices(e.devices); setResults(e.results); setRecommendations(e.recommendations);
        break;
      }
      case "emergency": {
        const e = entry as EmergencyEntry;
        setLocation(e.location); setRequestingParty(e.requestingParty); setCause(e.cause);
        setAction(e.action); setDuration(e.duration); setResults(e.results); setDocumentAttached(e.documentAttached);
        break;
      }
      case "stopped-devices": {
        const e = entry as StoppedDeviceEntry;
        setDeviceName(e.deviceName); setDeviceStatus(e.status); setStopReason(e.stopReason); setRecommendations(e.recommendations);
        break;
      }
      case "safety": {
        const e = entry as SafetyEntry;
        setWearingSafety(e.wearingSafety); setWorkEnvironment(e.workEnvironment);
        setFirstAidTools(e.firstAidTools); setFireExtinguishers(e.fireExtinguishers);
        break;
      }
      case "safety-recommendations": {
        const e = entry as SafetyRecommendationEntry;
        setRecommendation(e.recommendation);
        break;
      }
      case "work-injuries": {
        const e = entry as WorkInjuryEntry;
        setInjuredName(e.injuredName); setInjuryType(e.injuryType); setInjuryDate(e.injuryDate);
        setActions(e.actions); setSeverity(e.severity);
        break;
      }
      case "sick-leaves": {
        const e = entry as SickLeaveEntry;
        setEmployeeName(e.employeeName); setLeaveSource(e.leaveSource); setLeaveDate(e.leaveDate);
        setReason(e.reason); setLeaveDuration(e.duration); setLeaveRecommendations(e.recommendations);
        break;
      }
    }
    setEditingEntry(entry);
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    Alert.alert(t("confirm_delete"), t("confirm_delete_msg"), [
      { text: t("cancel"), style: "cancel" },
      { text: t("delete"), style: "destructive", onPress: async () => {
        try {
          await maintenanceEntriesService.delete(parseInt(id));
          await loadEntries();
        } catch (e) { console.log(e); }
      } },
    ]);
  };

  // ===== نماذج الإدخال حسب القسم =====
  const renderForm = () => {
    switch (section) {
      case "periodic":
        return (
          <>
            <Text style={[styles.label, { color: colors.foreground }]}>{t("date")}</Text>
            <TextInput style={[styles.input, { borderColor: colors.border, color: colors.foreground }]} value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" placeholderTextColor={colors.muted} />
            <Text style={[styles.label, { color: colors.foreground }]}>{isAr ? isAr ? "الأجهزة والآلات" : "Devices and Machines" : "Devices and Machines"}</Text>
            <TextInput style={[styles.input, { borderColor: colors.border, color: colors.foreground }]} value={devices} onChangeText={setDevices} placeholder={isAr ? isAr ? "أسماء الأجهزة" : "Device Names" : "Device Names"} placeholderTextColor={colors.muted} />
            <Text style={[styles.label, { color: colors.foreground }]}>{t("maintenance_results")}</Text>
            <TextInput style={[styles.input, styles.textArea, { borderColor: colors.border, color: colors.foreground }]} value={results} onChangeText={setResults} placeholder={t("maintenance_results")} placeholderTextColor={colors.muted} multiline />
            <Text style={[styles.label, { color: colors.foreground }]}>{t("recommendations")}</Text>
            <TextInput style={[styles.input, styles.textArea, { borderColor: colors.border, color: colors.foreground }]} value={recommendations} onChangeText={setRecommendations} placeholder={t("recommendations")} placeholderTextColor={colors.muted} multiline />
          </>
        );
      case "emergency":
        return (
          <>
            <Text style={[styles.label, { color: colors.foreground }]}>{t("date")}</Text>
            <TextInput style={[styles.input, { borderColor: colors.border, color: colors.foreground }]} value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" placeholderTextColor={colors.muted} />
            <Text style={[styles.label, { color: colors.foreground }]}>{t("malfunction_location")}</Text>
            <TextInput style={[styles.input, { borderColor: colors.border, color: colors.foreground }]} value={location} onChangeText={setLocation} placeholder={t("malfunction_location")} placeholderTextColor={colors.muted} />
            <Text style={[styles.label, { color: colors.foreground }]}>{t("requesting_party")}</Text>
            <TextInput style={[styles.input, { borderColor: colors.border, color: colors.foreground }]} value={requestingParty} onChangeText={setRequestingParty} placeholder={t("requesting_party")} placeholderTextColor={colors.muted} />
            <Text style={[styles.label, { color: colors.foreground }]}>{t("malfunction_cause")}</Text>
            <TextInput style={[styles.input, styles.textArea, { borderColor: colors.border, color: colors.foreground }]} value={cause} onChangeText={setCause} placeholder={t("malfunction_cause")} placeholderTextColor={colors.muted} multiline />
            <Text style={[styles.label, { color: colors.foreground }]}>{t("maintenance_action")}</Text>
            <TextInput style={[styles.input, styles.textArea, { borderColor: colors.border, color: colors.foreground }]} value={action} onChangeText={setAction} placeholder={t("maintenance_action")} placeholderTextColor={colors.muted} multiline />
            <Text style={[styles.label, { color: colors.foreground }]}>{t("maintenance_duration")}</Text>
            <TextInput style={[styles.input, { borderColor: colors.border, color: colors.foreground }]} value={duration} onChangeText={setDuration} placeholder={t("maintenance_duration")} placeholderTextColor={colors.muted} />
            <Text style={[styles.label, { color: colors.foreground }]}>{t("maintenance_results")}</Text>
            <TextInput style={[styles.input, styles.textArea, { borderColor: colors.border, color: colors.foreground }]} value={results} onChangeText={setResults} placeholder={t("maintenance_results")} placeholderTextColor={colors.muted} multiline />
            <TouchableOpacity onPress={() => setDocumentAttached(!documentAttached)} style={[styles.attachBtn, documentAttached && { backgroundColor: "#16a34a" }]}>
              <MaterialIcons name={documentAttached ? "check-circle" : "attach-file"} size={20} color="#fff" />
              <Text style={styles.attachText}>{documentAttached ? isAr ? "تم إرفاق النموذج" : "Form Attached" : t("attach_form")}</Text>
            </TouchableOpacity>
          </>
        );
      case "stopped-devices":
        return (
          <>
            <Text style={[styles.label, { color: colors.foreground }]}>{isAr ? isAr ? "تاريخ التقرير" : "Report Date" : "Report Date"}</Text>
            <TextInput style={[styles.input, { borderColor: colors.border, color: colors.foreground }]} value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" placeholderTextColor={colors.muted} />
            <Text style={[styles.label, { color: colors.foreground }]}>{isAr ? isAr ? "بيانات الأجهزة والآلات" : "Devices and Machines Data" : "Devices and Machines Data"}</Text>
            <TextInput style={[styles.input, { borderColor: colors.border, color: colors.foreground }]} value={deviceName} onChangeText={setDeviceName} placeholder={t("device_name")} placeholderTextColor={colors.muted} />
            <Text style={[styles.label, { color: colors.foreground }]}>{t("device_status")}</Text>
            <View style={styles.chipRow}>
              {getDeviceStatusOptions(isAr).map((opt) => (
                <TouchableOpacity key={opt} onPress={() => setDeviceStatus(opt)} style={[styles.chip, deviceStatus === opt ? { backgroundColor: colors.primary } : { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}>
                  <Text style={[styles.chipText, { color: deviceStatus === opt ? "#fff" : colors.foreground }]}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={[styles.label, { color: colors.foreground }]}>{t("stop_reason")}</Text>
            <TextInput style={[styles.input, styles.textArea, { borderColor: colors.border, color: colors.foreground }]} value={stopReason} onChangeText={setStopReason} placeholder={t("stop_reason")} placeholderTextColor={colors.muted} multiline />
            <Text style={[styles.label, { color: colors.foreground }]}>{t("recommendations")}</Text>
            <TextInput style={[styles.input, styles.textArea, { borderColor: colors.border, color: colors.foreground }]} value={recommendations} onChangeText={setRecommendations} placeholder={t("recommendations")} placeholderTextColor={colors.muted} multiline />
          </>
        );
      case "safety":
        return (
          <>
            <Text style={[styles.label, { color: colors.foreground }]}>{t("date")}</Text>
            <TextInput style={[styles.input, { borderColor: colors.border, color: colors.foreground }]} value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" placeholderTextColor={colors.muted} />
            <Text style={[styles.label, { color: colors.foreground }]}>{isAr ? isAr ? "التقيد بارتداء وسائل السلامة أثناء العمل" : "Adherence to wearing safety equipment during work" : "Adherence to wearing safety equipment during work"}</Text>
            <View style={styles.chipRow}>
              {getSafetyOptions(isAr).map((opt) => (
                <TouchableOpacity key={opt} onPress={() => setWearingSafety(opt)} style={[styles.chip, wearingSafety === opt ? { backgroundColor: colors.primary } : { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}>
                  <Text style={[styles.chipText, { color: wearingSafety === opt ? "#fff" : colors.foreground }]}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={[styles.label, { color: colors.foreground }]}>{isAr ? isAr ? "بيئة العمل - وجود الملصقات واللوحات الإرشادية" : "Work environment - Presence of posters and signboards" : "Work environment - Presence of posters and signboards"}</Text>
            <View style={styles.chipRow}>
              {getSafetyOptions(isAr).map((opt) => (
                <TouchableOpacity key={opt} onPress={() => setWorkEnvironment(opt)} style={[styles.chip, workEnvironment === opt ? { backgroundColor: colors.primary } : { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}>
                  <Text style={[styles.chipText, { color: workEnvironment === opt ? "#fff" : colors.foreground }]}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={[styles.label, { color: colors.foreground }]}>{isAr ? isAr ? "وجود مستلزمات وأدوات إسعافية مناسبة" : "Presence of appropriate first aid supplies and tools" : "Presence of appropriate first aid supplies and tools"}</Text>
            <View style={styles.chipRow}>
              {getSafetyOptions(isAr).map((opt) => (
                <TouchableOpacity key={opt} onPress={() => setFirstAidTools(opt)} style={[styles.chip, firstAidTools === opt ? { backgroundColor: colors.primary } : { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}>
                  <Text style={[styles.chipText, { color: firstAidTools === opt ? "#fff" : colors.foreground }]}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={[styles.label, { color: colors.foreground }]}>{isAr ? isAr ? "جاهزية أجهزة الرش وطفايات الحريق وأجهزة الإنذار" : "Readiness of sprinklers, fire extinguishers and alarms" : "Readiness of sprinklers, fire extinguishers and alarms"}</Text>
            <View style={styles.chipRow}>
              {getSafetyOptions(isAr).map((opt) => (
                <TouchableOpacity key={opt} onPress={() => setFireExtinguishers(opt)} style={[styles.chip, fireExtinguishers === opt ? { backgroundColor: colors.primary } : { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}>
                  <Text style={[styles.chipText, { color: fireExtinguishers === opt ? "#fff" : colors.foreground }]}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        );
      case "safety-recommendations":
        return (
          <>
            <Text style={[styles.label, { color: colors.foreground }]}>{t("date")}</Text>
            <TextInput style={[styles.input, { borderColor: colors.border, color: colors.foreground }]} value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" placeholderTextColor={colors.muted} />
            <Text style={[styles.label, { color: colors.foreground }]}>{isAr ? isAr ? "التوصية" : "Recommendation" : "Recommendation"}</Text>
            <TextInput style={[styles.input, styles.textArea, { borderColor: colors.border, color: colors.foreground }]} value={recommendation} onChangeText={setRecommendation} placeholder={isAr ? isAr ? "أدخل التوصية" : "Enter recommendation" : "Enter recommendation"} placeholderTextColor={colors.muted} multiline numberOfLines={4} />
          </>
        );
      case "work-injuries":
        return (
          <>
            <Text style={[styles.label, { color: colors.foreground }]}>{isAr ? isAr ? "بيانات المصاب" : "Injured Data" : "Injured Data"}</Text>
            <TextInput style={[styles.input, { borderColor: colors.border, color: colors.foreground }]} value={injuredName} onChangeText={setInjuredName} placeholder={t("injured_name")} placeholderTextColor={colors.muted} />
            <Text style={[styles.label, { color: colors.foreground }]}>{isAr ? isAr ? "تحديد الإصابة" : "Determine Injury" : "Determine Injury"}</Text>
            <TextInput style={[styles.input, { borderColor: colors.border, color: colors.foreground }]} value={injuryType} onChangeText={setInjuryType} placeholder={t("injury_type")} placeholderTextColor={colors.muted} />
            <Text style={[styles.label, { color: colors.foreground }]}>{t("injury_date")}</Text>
            <TextInput style={[styles.input, { borderColor: colors.border, color: colors.foreground }]} value={injuryDate} onChangeText={setInjuryDate} placeholder="YYYY-MM-DD" placeholderTextColor={colors.muted} />
            <Text style={[styles.label, { color: colors.foreground }]}>{t("procedures_taken")}</Text>
            <TextInput style={[styles.input, styles.textArea, { borderColor: colors.border, color: colors.foreground }]} value={actions} onChangeText={setActions} placeholder={isAr ? isAr ? "الإجراءات المنفذة في الحالة" : "Procedures taken in the case" : "Procedures taken in the case"} placeholderTextColor={colors.muted} multiline />
            <Text style={[styles.label, { color: colors.foreground }]}>{isAr ? isAr ? "حالة المصاب" : "Injured Status" : "Injured Status"}</Text>
            <View style={styles.chipRow}>
              {getSeverityOptions(isAr).map((opt) => (
                <TouchableOpacity key={opt} onPress={() => setSeverity(opt)} style={[styles.chip, severity === opt ? { backgroundColor: opt === (isAr ? "وفاة" : "Death") || opt === (isAr ? "حرجة" : "Critical") ? "#dc2626" : colors.primary } : { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}>
                  <Text style={[styles.chipText, { color: severity === opt ? "#fff" : colors.foreground }]}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        );
      case "sick-leaves":
        return (
          <>
            <Text style={[styles.label, { color: colors.foreground }]}>{t("employee_name")}</Text>
            <TextInput style={[styles.input, { borderColor: colors.border, color: colors.foreground }]} value={employeeName} onChangeText={setEmployeeName} placeholder={t("employee_name")} placeholderTextColor={colors.muted} />
            <Text style={[styles.label, { color: colors.foreground }]}>{t("leave_source")}</Text>
            <TextInput style={[styles.input, { borderColor: colors.border, color: colors.foreground }]} value={leaveSource} onChangeText={setLeaveSource} placeholder={t("leave_source")} placeholderTextColor={colors.muted} />
            <Text style={[styles.label, { color: colors.foreground }]}>{isAr ? isAr ? "تاريخ الإجازة" : "Leave Date" : "Leave Date"}</Text>
            <TextInput style={[styles.input, { borderColor: colors.border, color: colors.foreground }]} value={leaveDate} onChangeText={setLeaveDate} placeholder="YYYY-MM-DD" placeholderTextColor={colors.muted} />
            <Text style={[styles.label, { color: colors.foreground }]}>{t("leave_reason")}</Text>
            <TextInput style={[styles.input, { borderColor: colors.border, color: colors.foreground }]} value={reason} onChangeText={setReason} placeholder={t("leave_reason")} placeholderTextColor={colors.muted} />
            <Text style={[styles.label, { color: colors.foreground }]}>{t("leave_duration")}</Text>
            <TextInput style={[styles.input, { borderColor: colors.border, color: colors.foreground }]} value={leaveDuration} onChangeText={setLeaveDuration} placeholder={isAr ? isAr ? "مدة الإجازة (أيام)" : "Leave Duration (days)" : "Leave Duration (days)"} placeholderTextColor={colors.muted} keyboardType="numeric" />
            <Text style={[styles.label, { color: colors.foreground }]}>{t("recommendations")}</Text>
            <TextInput style={[styles.input, styles.textArea, { borderColor: colors.border, color: colors.foreground }]} value={leaveRecommendations} onChangeText={setLeaveRecommendations} placeholder={t("recommendations")} placeholderTextColor={colors.muted} multiline />
          </>
        );
      default:
        return null;
    }
  };

  // ===== عرض السجلات حسب القسم =====
  const renderEntry = (entry: AnyEntry) => {
    switch (section) {
      case "periodic": {
        const e = entry as PeriodicEntry;
        return (
          <>
            <Text style={[styles.entryField, { color: colors.muted }]}>الأجهزة: <Text style={{ color: colors.foreground }}>{e.devices}</Text></Text>
            <Text style={[styles.entryField, { color: colors.muted }]}>النتائج: <Text style={{ color: colors.foreground }}>{e.results}</Text></Text>
            <Text style={[styles.entryField, { color: colors.muted }]}>التوصيات: <Text style={{ color: colors.foreground }}>{e.recommendations}</Text></Text>
          </>
        );
      }
      case "emergency": {
        const e = entry as EmergencyEntry;
        return (
          <>
            <Text style={[styles.entryField, { color: colors.muted }]}>مكان العطل: <Text style={{ color: colors.foreground }}>{e.location}</Text></Text>
            <Text style={[styles.entryField, { color: colors.muted }]}>الجهة الطالبة: <Text style={{ color: colors.foreground }}>{e.requestingParty}</Text></Text>
            <Text style={[styles.entryField, { color: colors.muted }]}>الأسباب: <Text style={{ color: colors.foreground }}>{e.cause}</Text></Text>
            <Text style={[styles.entryField, { color: colors.muted }]}>الإجراء: <Text style={{ color: colors.foreground }}>{e.action}</Text></Text>
            <Text style={[styles.entryField, { color: colors.muted }]}>المدة: <Text style={{ color: colors.foreground }}>{e.duration}</Text></Text>
            <Text style={[styles.entryField, { color: colors.muted }]}>النتائج: <Text style={{ color: colors.foreground }}>{e.results}</Text></Text>
            {e.documentAttached && <Text style={{ color: "#16a34a", fontSize: 12 }}>{isAr ? isAr ? "✓ نموذج مرفق" : "✓ Form Attached" : "✓ Form Attached"}</Text>}
          </>
        );
      }
      case "stopped-devices": {
        const e = entry as StoppedDeviceEntry;
        const statusColor = e.status === (isAr ? "يعمل" : "Working") ? "#16a34a" : e.status === (isAr ? "لايعمل" : "Not Working") ? "#dc2626" : "#ea580c";
        return (
          <>
            <Text style={[styles.entryField, { color: colors.muted }]}>الجهاز: <Text style={{ color: colors.foreground }}>{e.deviceName}</Text></Text>
            <Text style={[styles.entryField, { color: colors.muted }]}>الحالة: <Text style={{ color: statusColor, fontWeight: "bold" }}>{e.status}</Text></Text>
            <Text style={[styles.entryField, { color: colors.muted }]}>سبب التوقف: <Text style={{ color: colors.foreground }}>{e.stopReason}</Text></Text>
            <Text style={[styles.entryField, { color: colors.muted }]}>التوصيات: <Text style={{ color: colors.foreground }}>{e.recommendations}</Text></Text>
          </>
        );
      }
      case "safety": {
        const e = entry as SafetyEntry;
        return (
          <>
            <Text style={[styles.entryField, { color: colors.muted }]}>ارتداء وسائل السلامة: <Text style={{ color: colors.foreground }}>{e.wearingSafety}</Text></Text>
            <Text style={[styles.entryField, { color: colors.muted }]}>بيئة العمل: <Text style={{ color: colors.foreground }}>{e.workEnvironment}</Text></Text>
            <Text style={[styles.entryField, { color: colors.muted }]}>أدوات إسعافية: <Text style={{ color: colors.foreground }}>{e.firstAidTools}</Text></Text>
            <Text style={[styles.entryField, { color: colors.muted }]}>طفايات الحريق: <Text style={{ color: colors.foreground }}>{e.fireExtinguishers}</Text></Text>
          </>
        );
      }
      case "safety-recommendations": {
        const e = entry as SafetyRecommendationEntry;
        return <Text style={[styles.entryField, { color: colors.foreground }]}>{e.recommendation}</Text>;
      }
      case "work-injuries": {
        const e = entry as WorkInjuryEntry;
        const sevColor = e.severity === (isAr ? "وفاة" : "Death") || e.severity === (isAr ? "حرجة" : "Critical") ? "#dc2626" : e.severity === (isAr ? "متوسطة" : "Moderate") ? "#ea580c" : "#16a34a";
        return (
          <>
            <Text style={[styles.entryField, { color: colors.muted }]}>المصاب: <Text style={{ color: colors.foreground }}>{e.injuredName}</Text></Text>
            <Text style={[styles.entryField, { color: colors.muted }]}>الإصابة: <Text style={{ color: colors.foreground }}>{e.injuryType}</Text></Text>
            <Text style={[styles.entryField, { color: colors.muted }]}>تاريخ الإصابة: <Text style={{ color: colors.foreground }}>{e.injuryDate}</Text></Text>
            <Text style={[styles.entryField, { color: colors.muted }]}>الإجراءات: <Text style={{ color: colors.foreground }}>{e.actions}</Text></Text>
            <Text style={[styles.entryField, { color: colors.muted }]}>الحالة: <Text style={{ color: sevColor, fontWeight: "bold" }}>{e.severity}</Text></Text>
          </>
        );
      }
      case "sick-leaves": {
        const e = entry as SickLeaveEntry;
        return (
          <>
            <Text style={[styles.entryField, { color: colors.muted }]}>الموظف: <Text style={{ color: colors.foreground }}>{e.employeeName}</Text></Text>
            <Text style={[styles.entryField, { color: colors.muted }]}>المصدر: <Text style={{ color: colors.foreground }}>{e.leaveSource}</Text></Text>
            <Text style={[styles.entryField, { color: colors.muted }]}>التاريخ: <Text style={{ color: colors.foreground }}>{e.leaveDate}</Text></Text>
            <Text style={[styles.entryField, { color: colors.muted }]}>السبب: <Text style={{ color: colors.foreground }}>{e.reason}</Text></Text>
            <Text style={[styles.entryField, { color: colors.muted }]}>المدة: <Text style={{ color: colors.foreground }}>{e.duration} يوم</Text></Text>
            <Text style={[styles.entryField, { color: colors.muted }]}>التوصيات: <Text style={{ color: colors.foreground }}>{e.recommendations}</Text></Text>
          </>
        );
      }
      default:
        return null;
    }
  };

  return (
    <ScreenContainer style={{ backgroundColor: colors.background }}>
      {/* رأس الصفحة */}
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <BackButton />
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* معلومات المدخل */}
        <View style={[styles.infoBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <MaterialIcons name="person" size={18} color={colors.primary} />
          <Text style={[styles.infoText, { color: colors.foreground }]}>المدخل: {entryPerson}</Text>
        </View>

        {/* زر إضافة */}
        {!showForm && (
          <TouchableOpacity onPress={() => setShowForm(true)} style={[styles.addBtn, { backgroundColor: colors.primary }]}>
            <MaterialIcons name="add" size={20} color="#fff" />
            <Text style={styles.addBtnText}>{isAr ? isAr ? "إضافة سجل جديد" : "Add New Record" : "Add New Record"}</Text>
          </TouchableOpacity>
        )}

        {/* نموذج الإدخال */}
        {showForm && (
          <View style={[styles.formCard, { borderColor: colors.border }]}>
            <Text style={[styles.formTitle, { color: colors.foreground }]}>
              {editingEntry ? isAr ? "تعديل السجل" : "Edit Record" : isAr ? "إضافة سجل جديد" : "Add New Record"}
            </Text>
            {renderForm()}
            {/* المرفقات */}
            <AttachmentPicker
              attachments={sectionAttachments}
              onAttachmentsChange={setSectionAttachments}
              language={language}
            />
            <View style={styles.formActions}>
              <TouchableOpacity onPress={handleSave} style={[styles.saveBtn, { backgroundColor: colors.primary }]}>
                <MaterialIcons name="save" size={18} color="#fff" />
                <Text style={styles.saveBtnText}>{t("save")}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={resetForm} style={[styles.cancelBtn, { borderColor: colors.border }]}>
                <Text style={[styles.cancelBtnText, { color: colors.muted }]}>{t("cancel")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* عرض السجلات */}
        {entries.length > 0 && (
          <View style={{ marginTop: 16 }}>
            <Text style={[styles.sectionHeader, { color: colors.foreground }]}>السجلات ({entries.length})</Text>
            {entries.map((entry) => (
              <View key={entry.id} style={[styles.entryCard, { borderColor: colors.border }]}>
                <View style={styles.entryHeader}>
                  <Text style={[styles.entryDate, { color: colors.primary }]}>{entry.date}</Text>
                  <View style={styles.entryActions}>
                    <TouchableOpacity onPress={() => handleEdit(entry)} style={styles.actionBtn}>
                      <MaterialIcons name="edit" size={18} color="#0891b2" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDelete(entry.id)} style={styles.actionBtn}>
                      <MaterialIcons name="delete" size={18} color="#dc2626" />
                    </TouchableOpacity>
                  </View>
                </View>
                <Text style={[styles.entryField, { color: colors.muted }]}>المدخل: <Text style={{ color: colors.foreground }}>{entry.entryPerson}</Text></Text>
                {renderEntry(entry)}
              </View>
            ))}
          </View>
        )}

        {entries.length === 0 && !showForm && (
          <View style={styles.emptyState}>
            <MaterialIcons name="inbox" size={48} color={colors.muted} />
            <Text style={[styles.emptyText, { color: colors.muted }]}>{t("no_records_yet")}</Text>
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14 },
  backBtn: { padding: 4 },
  headerTitle: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  content: { flex: 1, padding: 16 },
  infoBar: { flexDirection: "row", alignItems: "center", padding: 10, borderRadius: 8, borderWidth: 1, marginBottom: 12, gap: 8 },
  infoText: { fontSize: 13, fontWeight: "600" },
  addBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", padding: 12, borderRadius: 10, gap: 6, marginBottom: 16 },
  addBtnText: { color: "#fff", fontSize: 14, fontWeight: "bold" },
  formCard: { backgroundColor: "#fff", borderRadius: 12, padding: 16, borderWidth: 1, marginBottom: 16 },
  formTitle: { fontSize: 15, fontWeight: "bold", marginBottom: 12, textAlign: "right" },
  label: { fontSize: 13, fontWeight: "600", marginBottom: 6, marginTop: 10, textAlign: "right" },
  input: { borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 14, textAlign: "right" },
  textArea: { minHeight: 70, textAlignVertical: "top" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 18 },
  chipText: { fontSize: 12, fontWeight: "600" },
  attachBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#6b7280", padding: 10, borderRadius: 8, marginTop: 12, gap: 6 },
  attachText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  formActions: { flexDirection: "row", gap: 10, marginTop: 16 },
  saveBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", padding: 12, borderRadius: 8, gap: 6 },
  saveBtnText: { color: "#fff", fontSize: 14, fontWeight: "bold" },
  cancelBtn: { flex: 1, alignItems: "center", justifyContent: "center", padding: 12, borderRadius: 8, borderWidth: 1 },
  cancelBtnText: { fontSize: 14 },
  sectionHeader: { fontSize: 15, fontWeight: "bold", marginBottom: 10, textAlign: "right" },
  entryCard: { backgroundColor: "#fff", borderRadius: 10, padding: 12, borderWidth: 1, marginBottom: 10 },
  entryHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  entryDate: { fontSize: 12, fontWeight: "bold" },
  entryActions: { flexDirection: "row", gap: 8 },
  actionBtn: { padding: 4 },
  entryField: { fontSize: 12, marginTop: 3, textAlign: "right" },
  emptyState: { alignItems: "center", justifyContent: "center", marginTop: 60 },
  emptyText: { fontSize: 14, marginTop: 10 },
});
