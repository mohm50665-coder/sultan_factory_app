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
import AsyncStorage from "@react-native-async-storage/async-storage";

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

const SECTION_TITLES: Record<string, string> = {
  periodic: "الجدول الدوري للصيانة",
  emergency: "الطوارئ",
  "stopped-devices": "تقرير الأجهزة المتوقفة",
  safety: "السلامة",
  "safety-recommendations": "توصيات السلامة والصحة المهنية",
  "work-injuries": "إصابات العمل",
  "sick-leaves": "حصر الإجازات المرضية",
};

const DEVICE_STATUS_OPTIONS = ["يعمل", "لايعمل", "صيانة"];
const SAFETY_OPTIONS = ["مطابق", "غير مطابق", "تحسين"];
const SEVERITY_OPTIONS = ["خفيفة", "متوسطة", "حرجة", "إعاقة", "وفاة"];

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function MaintenanceSectionScreen() {
  const router = useRouter();
  const colors = useColors();
  const params = useLocalSearchParams<{ section: string; entryPerson: string }>();
  const section = params.section || "periodic";
  const entryPerson = decodeURIComponent(params.entryPerson || "");
  const title = SECTION_TITLES[section] || "الصيانة";

  const STORAGE_KEY = `sultan_maintenance_${section}`;

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

  const loadEntries = async () => {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      if (data) setEntries(JSON.parse(data));
    } catch (e) {}
  };

  const saveEntries = async (newEntries: AnyEntry[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newEntries));
      setEntries(newEntries);
    } catch (e) {}
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

  const handleSave = () => {
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
    saveEntries(newEntries);
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
    Alert.alert("تأكيد الحذف", "هل أنت متأكد من حذف هذا السجل؟", [
      { text: "إلغاء", style: "cancel" },
      { text: "حذف", style: "destructive", onPress: () => saveEntries(entries.filter((e) => e.id !== id)) },
    ]);
  };

  // ===== نماذج الإدخال حسب القسم =====
  const renderForm = () => {
    switch (section) {
      case "periodic":
        return (
          <>
            <Text style={[styles.label, { color: colors.foreground }]}>التاريخ</Text>
            <TextInput style={[styles.input, { borderColor: colors.border, color: colors.foreground }]} value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" placeholderTextColor={colors.muted} />
            <Text style={[styles.label, { color: colors.foreground }]}>الأجهزة والآلات</Text>
            <TextInput style={[styles.input, { borderColor: colors.border, color: colors.foreground }]} value={devices} onChangeText={setDevices} placeholder="أسماء الأجهزة" placeholderTextColor={colors.muted} />
            <Text style={[styles.label, { color: colors.foreground }]}>نتائج الصيانة</Text>
            <TextInput style={[styles.input, styles.textArea, { borderColor: colors.border, color: colors.foreground }]} value={results} onChangeText={setResults} placeholder="نتائج الصيانة" placeholderTextColor={colors.muted} multiline />
            <Text style={[styles.label, { color: colors.foreground }]}>التوصيات</Text>
            <TextInput style={[styles.input, styles.textArea, { borderColor: colors.border, color: colors.foreground }]} value={recommendations} onChangeText={setRecommendations} placeholder="التوصيات" placeholderTextColor={colors.muted} multiline />
          </>
        );
      case "emergency":
        return (
          <>
            <Text style={[styles.label, { color: colors.foreground }]}>التاريخ</Text>
            <TextInput style={[styles.input, { borderColor: colors.border, color: colors.foreground }]} value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" placeholderTextColor={colors.muted} />
            <Text style={[styles.label, { color: colors.foreground }]}>مكان العطل</Text>
            <TextInput style={[styles.input, { borderColor: colors.border, color: colors.foreground }]} value={location} onChangeText={setLocation} placeholder="مكان العطل" placeholderTextColor={colors.muted} />
            <Text style={[styles.label, { color: colors.foreground }]}>الجهة الطالبة</Text>
            <TextInput style={[styles.input, { borderColor: colors.border, color: colors.foreground }]} value={requestingParty} onChangeText={setRequestingParty} placeholder="الجهة الطالبة" placeholderTextColor={colors.muted} />
            <Text style={[styles.label, { color: colors.foreground }]}>أسباب العطل</Text>
            <TextInput style={[styles.input, styles.textArea, { borderColor: colors.border, color: colors.foreground }]} value={cause} onChangeText={setCause} placeholder="أسباب العطل" placeholderTextColor={colors.muted} multiline />
            <Text style={[styles.label, { color: colors.foreground }]}>إجراء الصيانة</Text>
            <TextInput style={[styles.input, styles.textArea, { borderColor: colors.border, color: colors.foreground }]} value={action} onChangeText={setAction} placeholder="إجراء الصيانة" placeholderTextColor={colors.muted} multiline />
            <Text style={[styles.label, { color: colors.foreground }]}>مدة الصيانة</Text>
            <TextInput style={[styles.input, { borderColor: colors.border, color: colors.foreground }]} value={duration} onChangeText={setDuration} placeholder="مدة الصيانة" placeholderTextColor={colors.muted} />
            <Text style={[styles.label, { color: colors.foreground }]}>نتائج الصيانة</Text>
            <TextInput style={[styles.input, styles.textArea, { borderColor: colors.border, color: colors.foreground }]} value={results} onChangeText={setResults} placeholder="نتائج الصيانة" placeholderTextColor={colors.muted} multiline />
            <TouchableOpacity onPress={() => setDocumentAttached(!documentAttached)} style={[styles.attachBtn, documentAttached && { backgroundColor: "#16a34a" }]}>
              <MaterialIcons name={documentAttached ? "check-circle" : "attach-file"} size={20} color="#fff" />
              <Text style={styles.attachText}>{documentAttached ? "تم إرفاق النموذج" : "إرفاق نموذج طلب الصيانة"}</Text>
            </TouchableOpacity>
          </>
        );
      case "stopped-devices":
        return (
          <>
            <Text style={[styles.label, { color: colors.foreground }]}>تاريخ التقرير</Text>
            <TextInput style={[styles.input, { borderColor: colors.border, color: colors.foreground }]} value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" placeholderTextColor={colors.muted} />
            <Text style={[styles.label, { color: colors.foreground }]}>بيانات الأجهزة والآلات</Text>
            <TextInput style={[styles.input, { borderColor: colors.border, color: colors.foreground }]} value={deviceName} onChangeText={setDeviceName} placeholder="اسم الجهاز/الآلة" placeholderTextColor={colors.muted} />
            <Text style={[styles.label, { color: colors.foreground }]}>حالة الأجهزة</Text>
            <View style={styles.chipRow}>
              {DEVICE_STATUS_OPTIONS.map((opt) => (
                <TouchableOpacity key={opt} onPress={() => setDeviceStatus(opt)} style={[styles.chip, deviceStatus === opt ? { backgroundColor: colors.primary } : { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}>
                  <Text style={[styles.chipText, { color: deviceStatus === opt ? "#fff" : colors.foreground }]}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={[styles.label, { color: colors.foreground }]}>سبب التوقف</Text>
            <TextInput style={[styles.input, styles.textArea, { borderColor: colors.border, color: colors.foreground }]} value={stopReason} onChangeText={setStopReason} placeholder="سبب التوقف" placeholderTextColor={colors.muted} multiline />
            <Text style={[styles.label, { color: colors.foreground }]}>التوصيات</Text>
            <TextInput style={[styles.input, styles.textArea, { borderColor: colors.border, color: colors.foreground }]} value={recommendations} onChangeText={setRecommendations} placeholder="التوصيات" placeholderTextColor={colors.muted} multiline />
          </>
        );
      case "safety":
        return (
          <>
            <Text style={[styles.label, { color: colors.foreground }]}>التاريخ</Text>
            <TextInput style={[styles.input, { borderColor: colors.border, color: colors.foreground }]} value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" placeholderTextColor={colors.muted} />
            <Text style={[styles.label, { color: colors.foreground }]}>التقيد بارتداء وسائل السلامة أثناء العمل</Text>
            <View style={styles.chipRow}>
              {SAFETY_OPTIONS.map((opt) => (
                <TouchableOpacity key={opt} onPress={() => setWearingSafety(opt)} style={[styles.chip, wearingSafety === opt ? { backgroundColor: colors.primary } : { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}>
                  <Text style={[styles.chipText, { color: wearingSafety === opt ? "#fff" : colors.foreground }]}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={[styles.label, { color: colors.foreground }]}>بيئة العمل - وجود الملصقات واللوحات الإرشادية</Text>
            <View style={styles.chipRow}>
              {SAFETY_OPTIONS.map((opt) => (
                <TouchableOpacity key={opt} onPress={() => setWorkEnvironment(opt)} style={[styles.chip, workEnvironment === opt ? { backgroundColor: colors.primary } : { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}>
                  <Text style={[styles.chipText, { color: workEnvironment === opt ? "#fff" : colors.foreground }]}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={[styles.label, { color: colors.foreground }]}>وجود مستلزمات وأدوات إسعافية مناسبة</Text>
            <View style={styles.chipRow}>
              {SAFETY_OPTIONS.map((opt) => (
                <TouchableOpacity key={opt} onPress={() => setFirstAidTools(opt)} style={[styles.chip, firstAidTools === opt ? { backgroundColor: colors.primary } : { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}>
                  <Text style={[styles.chipText, { color: firstAidTools === opt ? "#fff" : colors.foreground }]}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={[styles.label, { color: colors.foreground }]}>جاهزية أجهزة الرش وطفايات الحريق وأجهزة الإنذار</Text>
            <View style={styles.chipRow}>
              {SAFETY_OPTIONS.map((opt) => (
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
            <Text style={[styles.label, { color: colors.foreground }]}>التاريخ</Text>
            <TextInput style={[styles.input, { borderColor: colors.border, color: colors.foreground }]} value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" placeholderTextColor={colors.muted} />
            <Text style={[styles.label, { color: colors.foreground }]}>التوصية</Text>
            <TextInput style={[styles.input, styles.textArea, { borderColor: colors.border, color: colors.foreground }]} value={recommendation} onChangeText={setRecommendation} placeholder="أدخل التوصية" placeholderTextColor={colors.muted} multiline numberOfLines={4} />
          </>
        );
      case "work-injuries":
        return (
          <>
            <Text style={[styles.label, { color: colors.foreground }]}>بيانات المصاب</Text>
            <TextInput style={[styles.input, { borderColor: colors.border, color: colors.foreground }]} value={injuredName} onChangeText={setInjuredName} placeholder="اسم المصاب" placeholderTextColor={colors.muted} />
            <Text style={[styles.label, { color: colors.foreground }]}>تحديد الإصابة</Text>
            <TextInput style={[styles.input, { borderColor: colors.border, color: colors.foreground }]} value={injuryType} onChangeText={setInjuryType} placeholder="نوع الإصابة" placeholderTextColor={colors.muted} />
            <Text style={[styles.label, { color: colors.foreground }]}>تاريخ الإصابة</Text>
            <TextInput style={[styles.input, { borderColor: colors.border, color: colors.foreground }]} value={injuryDate} onChangeText={setInjuryDate} placeholder="YYYY-MM-DD" placeholderTextColor={colors.muted} />
            <Text style={[styles.label, { color: colors.foreground }]}>الإجراءات المنفذة</Text>
            <TextInput style={[styles.input, styles.textArea, { borderColor: colors.border, color: colors.foreground }]} value={actions} onChangeText={setActions} placeholder="الإجراءات المنفذة في الحالة" placeholderTextColor={colors.muted} multiline />
            <Text style={[styles.label, { color: colors.foreground }]}>حالة المصاب</Text>
            <View style={styles.chipRow}>
              {SEVERITY_OPTIONS.map((opt) => (
                <TouchableOpacity key={opt} onPress={() => setSeverity(opt)} style={[styles.chip, severity === opt ? { backgroundColor: opt === "وفاة" || opt === "حرجة" ? "#dc2626" : colors.primary } : { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}>
                  <Text style={[styles.chipText, { color: severity === opt ? "#fff" : colors.foreground }]}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        );
      case "sick-leaves":
        return (
          <>
            <Text style={[styles.label, { color: colors.foreground }]}>اسم الموظف</Text>
            <TextInput style={[styles.input, { borderColor: colors.border, color: colors.foreground }]} value={employeeName} onChangeText={setEmployeeName} placeholder="اسم الموظف" placeholderTextColor={colors.muted} />
            <Text style={[styles.label, { color: colors.foreground }]}>مصدر الإجازة</Text>
            <TextInput style={[styles.input, { borderColor: colors.border, color: colors.foreground }]} value={leaveSource} onChangeText={setLeaveSource} placeholder="مصدر الإجازة" placeholderTextColor={colors.muted} />
            <Text style={[styles.label, { color: colors.foreground }]}>تاريخ الإجازة</Text>
            <TextInput style={[styles.input, { borderColor: colors.border, color: colors.foreground }]} value={leaveDate} onChangeText={setLeaveDate} placeholder="YYYY-MM-DD" placeholderTextColor={colors.muted} />
            <Text style={[styles.label, { color: colors.foreground }]}>سبب الإجازة</Text>
            <TextInput style={[styles.input, { borderColor: colors.border, color: colors.foreground }]} value={reason} onChangeText={setReason} placeholder="سبب الإجازة" placeholderTextColor={colors.muted} />
            <Text style={[styles.label, { color: colors.foreground }]}>مدة الإجازة</Text>
            <TextInput style={[styles.input, { borderColor: colors.border, color: colors.foreground }]} value={leaveDuration} onChangeText={setLeaveDuration} placeholder="مدة الإجازة (أيام)" placeholderTextColor={colors.muted} keyboardType="numeric" />
            <Text style={[styles.label, { color: colors.foreground }]}>التوصيات</Text>
            <TextInput style={[styles.input, styles.textArea, { borderColor: colors.border, color: colors.foreground }]} value={leaveRecommendations} onChangeText={setLeaveRecommendations} placeholder="التوصيات" placeholderTextColor={colors.muted} multiline />
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
            {e.documentAttached && <Text style={{ color: "#16a34a", fontSize: 12 }}>✓ نموذج مرفق</Text>}
          </>
        );
      }
      case "stopped-devices": {
        const e = entry as StoppedDeviceEntry;
        const statusColor = e.status === "يعمل" ? "#16a34a" : e.status === "لايعمل" ? "#dc2626" : "#ea580c";
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
        const sevColor = e.severity === "وفاة" || e.severity === "حرجة" ? "#dc2626" : e.severity === "متوسطة" ? "#ea580c" : "#16a34a";
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
    <ScreenContainer className="bg-background">
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
            <Text style={styles.addBtnText}>إضافة سجل جديد</Text>
          </TouchableOpacity>
        )}

        {/* نموذج الإدخال */}
        {showForm && (
          <View style={[styles.formCard, { borderColor: colors.border }]}>
            <Text style={[styles.formTitle, { color: colors.foreground }]}>
              {editingEntry ? "تعديل السجل" : "إضافة سجل جديد"}
            </Text>
            {renderForm()}
            <View style={styles.formActions}>
              <TouchableOpacity onPress={handleSave} style={[styles.saveBtn, { backgroundColor: colors.primary }]}>
                <MaterialIcons name="save" size={18} color="#fff" />
                <Text style={styles.saveBtnText}>حفظ</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={resetForm} style={[styles.cancelBtn, { borderColor: colors.border }]}>
                <Text style={[styles.cancelBtnText, { color: colors.muted }]}>إلغاء</Text>
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
            <Text style={[styles.emptyText, { color: colors.muted }]}>لا توجد سجلات بعد</Text>
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
