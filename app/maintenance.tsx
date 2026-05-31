import React, { useState } from "react";
import { BackButton } from "@/components/back-button";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { MaterialIcons } from "@expo/vector-icons";
import { AdminBadgeIcon } from "@/components/admin-badge-icon";
import { AdminCard } from "@/components/admin-card";
import { useLanguage } from "@/lib/language-context";


const DATA_ENTRY_NAMES = ["محمد الشيخ", "محمد احمد", "افضل"];

interface MaintenanceSection {
  id: string;
  label: string;
  icon: string;
  description: string;
  color: string;
}

const MAINTENANCE_SECTIONS: MaintenanceSection[] = [
  {
    id: "periodic",
    label: "الجدول الدوري للصيانة",
    icon: "event-note",
    description: "التاريخ، الأجهزة، نتائج الصيانة، التوصيات",
    color: "#0891b2",
  },
  {
    id: "emergency",
    label: "الطوارئ",
    icon: "warning",
    description: "مكان العطل، الأسباب، إجراء الصيانة، المدة",
    color: "#dc2626",
  },
  {
    id: "stopped-devices",
    label: "تقرير الأجهزة المتوقفة",
    icon: "error-outline",
    description: "حالة الأجهزة: يعمل، لا يعمل، صيانة",
    color: "#ea580c",
  },
  {
    id: "safety",
    label: "السلامة",
    icon: "health-and-safety",
    description: "متطلبات السلامة: مطابق، غير مطابق، تحسين",
    color: "#16a34a",
  },
  {
    id: "safety-recommendations",
    label: "توصيات السلامة والصحة المهنية",
    icon: "lightbulb",
    description: "توصيات السلامة والصحة المهنية",
    color: "#7c3aed",
  },
  {
    id: "work-injuries",
    label: "إصابات العمل",
    icon: "personal-injury",
    description: "بيانات المصاب، تحديد الإصابة، الإجراءات",
    color: "#b91c1c",
  },
  {
    id: "sick-leaves",
    label: "حصر الإجازات المرضية",
    icon: "medical-services",
    description: "اسم الموظف، مصدر الإجازة، المدة، التوصيات",
    color: "#0d9488",
  },
];

export default function MaintenanceScreen() {
  const router = useRouter();
  const colors = useColors();
  const [selectedEntryPerson, setSelectedEntryPerson] = useState("");

  const handleSectionPress = (sectionId: string) => {
    if (!selectedEntryPerson) {
      return;
    }
    router.push(`/maintenance-section?section=${sectionId}&entryPerson=${encodeURIComponent(selectedEntryPerson)}` as any);
  };

  return (
    <ScreenContainer className="bg-background">
      {/* رأس الصفحة */}
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <BackButton />
        <Text style={styles.headerTitle}>الصيانة</Text>
        <AdminBadgeIcon />
      </View>

      {/* بطاقة الإجراءات الإدارية - كبيرة وواضحة */}
      <AdminCard />

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 30 }}>
        {/* اختيار مدخل البيانات */}
        <View style={[styles.card, { borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>اسم المدخل (المسؤول)</Text>
          <View style={styles.chipRow}>
            {DATA_ENTRY_NAMES.map((name) => (
              <TouchableOpacity
                key={name}
                onPress={() => setSelectedEntryPerson(name)}
                style={[
                  styles.chip,
                  selectedEntryPerson === name
                    ? { backgroundColor: colors.primary }
                    : { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 },
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: selectedEntryPerson === name ? "#fff" : colors.foreground },
                  ]}
                >
                  {name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {!selectedEntryPerson && (
            <Text style={[styles.warningText, { color: colors.error }]}>
              يرجى اختيار اسم المدخل أولاً
            </Text>
          )}
        </View>

        {/* أيقونات الأقسام */}
        {MAINTENANCE_SECTIONS.map((section) => (
          <TouchableOpacity
            key={section.id}
            onPress={() => handleSectionPress(section.id)}
            style={[
              styles.sectionCard,
              { borderColor: colors.border, opacity: selectedEntryPerson ? 1 : 0.5 },
            ]}
            activeOpacity={0.7}
          >
            <View style={[styles.iconBox, { backgroundColor: `${section.color}20` }]}>
              <MaterialIcons name={section.icon as any} size={28} color={section.color} />
            </View>
            <View style={styles.sectionInfo}>
              <Text style={[styles.sectionLabel, { color: colors.foreground }]}>{section.label}</Text>
              <Text style={[styles.sectionDesc, { color: colors.muted }]}>{section.description}</Text>
            </View>
            <MaterialIcons name="chevron-left" size={24} color={colors.muted} />
          </TouchableOpacity>
        ))}
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
  backBtn: { padding: 4 },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  content: { flex: 1, padding: 16 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  sectionTitle: { fontSize: 14, fontWeight: "bold", marginBottom: 12, textAlign: "right" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  chipText: { fontSize: 13, fontWeight: "600" },
  warningText: { fontSize: 12, marginTop: 8, textAlign: "right" },
  sectionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
  },
  iconBox: { width: 48, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center", marginLeft: 12 },
  sectionInfo: { flex: 1, marginLeft: 4 },
  sectionLabel: { fontSize: 14, fontWeight: "bold", textAlign: "right" },
  sectionDesc: { fontSize: 11, marginTop: 2, textAlign: "right" },
});
