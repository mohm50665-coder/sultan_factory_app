import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { MaterialIcons } from "@expo/vector-icons";
import {
  exportReportAsPDF,
  generateProductionReport,
  generateCostReport,
  generateComprehensiveReport,
} from "@/lib/services/pdf-export.service";
import { reportsService } from "@/lib/services/server-data.service";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface ReportOption {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  type: "production" | "cost" | "sales" | "performance" | "quality" | "maintenance";
}

const REPORT_OPTIONS: ReportOption[] = [
  {
    id: "comprehensive",
    title: "التقرير الشامل",
    description: "ملخص شامل لجميع أقسام المصنع (إنتاج، مبيعات، تكاليف، مهام)",
    icon: "assessment",
    color: "#3B82F6",
    type: "performance",
  },
  {
    id: "production",
    title: "تقرير الإنتاج",
    description: "تفاصيل الإنتاج اليومي والهدر ومؤشرات الأداء",
    icon: "precision-manufacturing",
    color: "#10B981",
    type: "production",
  },
  {
    id: "costs",
    title: "تقرير التكاليف",
    description: "تحليل تكاليف المواد الخام والعمالة والصيانة",
    icon: "calculate",
    color: "#F59E0B",
    type: "cost",
  },
  {
    id: "sales",
    title: "تقرير المبيعات",
    description: "ملخص المبيعات والتحصيل وحالة العملاء",
    icon: "point-of-sale",
    color: "#8B5CF6",
    type: "sales",
  },
  {
    id: "maintenance",
    title: "تقرير الصيانة",
    description: "حالة المعدات والتوصيات والأعطال",
    icon: "build",
    color: "#EF4444",
    type: "maintenance",
  },
];

export default function ExportReports() {
  const router = useRouter();
  const colors = useColors();
  const [generating, setGenerating] = useState<string | null>(null);
  const [userId, setUserId] = useState<number>(0);
  const [recentReports, setRecentReports] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const userStr = await AsyncStorage.getItem("sultan_current_user");
      if (userStr) {
        const user = JSON.parse(userStr);
        setUserId(user.id);
      }
      const reports = await reportsService.getAll();
      setRecentReports(reports.slice(0, 5));
    } catch (error) {
      console.error("Error loading data:", error);
    }
  };

  const handleGenerateReport = async (option: ReportOption) => {
    setGenerating(option.id);
    try {
      const today = new Date().toISOString().split("T")[0];
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

      if (option.id === "comprehensive") {
        // Generate comprehensive report from server
        const result = await reportsService.generateComprehensive(thirtyDaysAgo, today, userId);
        const pdfData = generateComprehensiveReport(result?.data || {});
        await exportReportAsPDF(pdfData);
        Alert.alert("تم", "تم تصدير التقرير الشامل بنجاح");
      } else if (option.id === "production") {
        const pdfData = generateProductionReport({
          totalDozen: 0,
          totalPairs: 0,
          totalEntries: 0,
          totalWasteThread: 0,
          totalWasteSocks: 0,
          avgDaily: 0,
          targetAchievement: 85,
          wastePercentage: 3.2,
        });
        await exportReportAsPDF(pdfData);
        Alert.alert("تم", "تم تصدير تقرير الإنتاج بنجاح");
      } else if (option.id === "costs") {
        const pdfData = generateCostReport({
          totalCost: 0,
          materialsCost: 0,
          laborCost: 0,
          maintenanceCost: 0,
          utilitiesCost: 0,
          otherCost: 0,
          variancePercentage: -2.5,
          costPerUnit: 12.5,
          targetCostPerUnit: 13,
        });
        await exportReportAsPDF(pdfData);
        Alert.alert("تم", "تم تصدير تقرير التكاليف بنجاح");
      } else {
        // Generic report
        await reportsService.create({
          reportName: option.title,
          reportType: option.type,
          startDate: thirtyDaysAgo,
          endDate: today,
          generatedBy: userId,
        });
        Alert.alert("تم", `تم إنشاء ${option.title} بنجاح`);
      }

      await loadData();
    } catch (error: any) {
      Alert.alert("خطأ", error.message || "فشل في إنشاء التقرير");
    } finally {
      setGenerating(null);
    }
  };

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <MaterialIcons name="arrow-forward" size={24} color={colors.foreground} />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>تصدير التقارير</Text>
            <Text style={[styles.headerSubtitle, { color: colors.muted }]}>إنشاء وتصدير تقارير PDF</Text>
          </View>
          <MaterialIcons name="picture-as-pdf" size={28} color="#EF4444" />
        </View>

        {/* Report Options */}
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>اختر نوع التقرير</Text>
        {REPORT_OPTIONS.map((option) => (
          <TouchableOpacity
            key={option.id}
            style={[styles.reportCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => handleGenerateReport(option)}
            disabled={generating !== null}
          >
            <View style={[styles.reportIcon, { backgroundColor: option.color + "20" }]}>
              {generating === option.id ? (
                <ActivityIndicator size="small" color={option.color} />
              ) : (
                <MaterialIcons name={option.icon as any} size={28} color={option.color} />
              )}
            </View>
            <View style={styles.reportContent}>
              <Text style={[styles.reportTitle, { color: colors.foreground }]}>{option.title}</Text>
              <Text style={[styles.reportDesc, { color: colors.muted }]}>{option.description}</Text>
            </View>
            <MaterialIcons name="file-download" size={24} color={option.color} />
          </TouchableOpacity>
        ))}

        {/* Recent Reports */}
        {recentReports.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.foreground, marginTop: 24 }]}>التقارير الأخيرة</Text>
            {recentReports.map((report, index) => (
              <View key={report.id || index} style={[styles.recentCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <MaterialIcons name="description" size={20} color={colors.primary} />
                <View style={styles.recentContent}>
                  <Text style={[styles.recentTitle, { color: colors.foreground }]}>{report.reportName}</Text>
                  <Text style={[styles.recentDate, { color: colors.muted }]}>
                    {report.createdAt ? new Date(report.createdAt).toLocaleString("ar-SA") : ""}
                  </Text>
                </View>
                <View style={[styles.typeBadge, { backgroundColor: colors.primary + "20" }]}>
                  <Text style={[styles.typeBadgeText, { color: colors.primary }]}>{report.reportType}</Text>
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: 100 },
  header: { flexDirection: "row", alignItems: "center", padding: 16, gap: 12 },
  backBtn: { padding: 8 },
  headerContent: { flex: 1 },
  headerTitle: { fontSize: 22, fontWeight: "bold" },
  headerSubtitle: { fontSize: 13, marginTop: 2 },
  sectionTitle: { fontSize: 18, fontWeight: "bold", paddingHorizontal: 16, marginBottom: 12 },
  reportCard: { flexDirection: "row", alignItems: "center", marginHorizontal: 16, marginBottom: 12, padding: 16, borderRadius: 12, borderWidth: 1, gap: 12 },
  reportIcon: { width: 52, height: 52, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  reportContent: { flex: 1 },
  reportTitle: { fontSize: 16, fontWeight: "bold" },
  reportDesc: { fontSize: 12, marginTop: 4, lineHeight: 18 },
  recentCard: { flexDirection: "row", alignItems: "center", marginHorizontal: 16, marginBottom: 8, padding: 12, borderRadius: 10, borderWidth: 1, gap: 10 },
  recentContent: { flex: 1 },
  recentTitle: { fontSize: 14, fontWeight: "600" },
  recentDate: { fontSize: 11, marginTop: 2 },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  typeBadgeText: { fontSize: 11, fontWeight: "600" },
});
