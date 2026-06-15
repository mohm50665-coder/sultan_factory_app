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
import { useLanguage } from "@/lib/language-context";

interface ReportOption {
  id: string;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  icon: string;
  color: string;
  type: "production" | "cost" | "sales" | "performance" | "quality" | "maintenance";
}

const REPORT_OPTIONS: ReportOption[] = [
  {
    id: "comprehensive",
    titleAr: "التقرير الشامل",
    titleEn: "Comprehensive Report",
    descriptionAr: "ملخص شامل لجميع أقسام المصنع (إنتاج، مبيعات، تكاليف، مهام)",
    descriptionEn: "Comprehensive summary of all factory departments (production, sales, costs, tasks)",
    icon: "assessment",
    color: "#3B82F6",
    type: "performance",
  },
  {
    id: "production",
    titleAr: "تقرير الإنتاج",
    titleEn: "Production Report",
    descriptionAr: "تفاصيل الإنتاج اليومي والهدر ومؤشرات الأداء",
    descriptionEn: "Daily production details, waste, and performance indicators",
    icon: "precision-manufacturing",
    color: "#10B981",
    type: "production",
  },
  {
    id: "costs",
    titleAr: "تقرير التكاليف",
    titleEn: "Costs Report",
    descriptionAr: "تحليل تكاليف المواد الخام والعمالة والصيانة",
    descriptionEn: "Analysis of raw materials, labor, and maintenance costs",
    icon: "calculate",
    color: "#F59E0B",
    type: "cost",
  },
  {
    id: "sales",
    titleAr: "تقرير المبيعات",
    titleEn: "Sales Report",
    descriptionAr: "ملخص المبيعات والتحصيل وحالة العملاء",
    descriptionEn: "Summary of sales, collections, and customer status",
    icon: "point-of-sale",
    color: "#8B5CF6",
    type: "sales",
  },
  {
    id: "maintenance",
    titleAr: "تقرير الصيانة",
    titleEn: "Maintenance Report",
    descriptionAr: "حالة المعدات والتوصيات والأعطال",
    descriptionEn: "Equipment status, recommendations, and breakdowns",
    icon: "build",
    color: "#EF4444",
    type: "maintenance",
  },
];

export default function ExportReports() {
  const { language } = useLanguage();
  const isAr = language === "ar";
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
        Alert.alert(isAr ? "تم" : "Done", isAr ? "تم تصدير التقرير الشامل بنجاح" : "Comprehensive report exported successfully");
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
        Alert.alert(isAr ? "تم" : "Done", isAr ? "تم تصدير تقرير الإنتاج بنجاح" : "Production report exported successfully");
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
        Alert.alert(isAr ? "تم" : "Done", isAr ? "تم تصدير تقرير التكاليف بنجاح" : "Costs report exported successfully");
      } else {
        // Generic report
        await reportsService.create({
          reportName: isAr ? option.titleAr : option.titleEn,
          reportType: option.type,
          startDate: thirtyDaysAgo,
          endDate: today,
          generatedBy: userId,
        });
        Alert.alert(isAr ? "تم" : "Done", isAr ? `تم إنشاء ${option.titleAr} بنجاح` : `${option.titleEn} created successfully`);
      }

      await loadData();
    } catch (error: any) {
      Alert.alert(isAr ? "خطأ" : "Error", error.message || (isAr ? "فشل في إنشاء التقرير" : "Failed to generate report"));
    } finally {
      setGenerating(null);
    }
  };

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header */}
        <View style={[styles.header, { flexDirection: isAr ? "row" : "row-reverse" }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <MaterialIcons name={isAr ? "arrow-forward" : "arrow-back"} size={24} color={colors.foreground} />
          </TouchableOpacity>
          <View style={[styles.headerContent, { alignItems: isAr ? "flex-start" : "flex-end" }]}>
            <Text style={[styles.headerTitle, { color: colors.foreground, textAlign: isAr ? "right" : "left" }]}>{isAr ? "تصدير التقارير" : "Export Reports"}</Text>
            <Text style={[styles.headerSubtitle, { color: colors.muted, textAlign: isAr ? "right" : "left" }]}>{isAr ? "إنشاء وتصدير تقارير PDF" : "Generate and export PDF reports"}</Text>
          </View>
          <MaterialIcons name="picture-as-pdf" size={28} color="#EF4444" />
        </View>

        {/* Report Options */}
        <Text style={[styles.sectionTitle, { color: colors.foreground, textAlign: isAr ? "right" : "left" }]}>{isAr ? "اختر نوع التقرير" : "Select Report Type"}</Text>
        {REPORT_OPTIONS.map((option) => (
          <TouchableOpacity
            key={option.id}
            style={[styles.reportCard, { backgroundColor: colors.surface, borderColor: colors.border, flexDirection: isAr ? "row" : "row-reverse" }]}
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
            <View style={[styles.reportContent, { alignItems: isAr ? "flex-start" : "flex-end" }]}>
              <Text style={[styles.reportTitle, { color: colors.foreground, textAlign: isAr ? "right" : "left" }]}>{isAr ? option.titleAr : option.titleEn}</Text>
              <Text style={[styles.reportDesc, { color: colors.muted, textAlign: isAr ? "right" : "left" }]}>{isAr ? option.descriptionAr : option.descriptionEn}</Text>
            </View>
            <MaterialIcons name="file-download" size={24} color={option.color} />
          </TouchableOpacity>
        ))}

        {/* Recent Reports */}
        {recentReports.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.foreground, marginTop: 24, textAlign: isAr ? "right" : "left" }]}>{isAr ? "التقارير الأخيرة" : "Recent Reports"}</Text>
            {recentReports.map((report, index) => (
              <View key={report.id || index} style={[styles.recentCard, { backgroundColor: colors.surface, borderColor: colors.border, flexDirection: isAr ? "row" : "row-reverse" }]}>
                <MaterialIcons name="description" size={20} color={colors.primary} />
                <View style={[styles.recentContent, { alignItems: isAr ? "flex-start" : "flex-end" }]}>
                  <Text style={[styles.recentTitle, { color: colors.foreground, textAlign: isAr ? "right" : "left" }]}>{report.reportName}</Text>
                  <Text style={[styles.recentDate, { color: colors.muted, textAlign: isAr ? "right" : "left" }]}>
                    {report.createdAt ? new Date(report.createdAt).toLocaleString(isAr ? "ar-SA" : "en-US") : ""}
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
  header: { alignItems: "center", padding: 16, gap: 12 },
  backBtn: { padding: 8 },
  headerContent: { flex: 1 },
  headerTitle: { fontSize: 22, fontWeight: "bold" },
  headerSubtitle: { fontSize: 13, marginTop: 2 },
  sectionTitle: { fontSize: 18, fontWeight: "bold", paddingHorizontal: 16, marginBottom: 12 },
  reportCard: { alignItems: "center", marginHorizontal: 16, marginBottom: 12, padding: 16, borderRadius: 12, borderWidth: 1, gap: 12 },
  reportIcon: { width: 52, height: 52, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  reportContent: { flex: 1 },
  reportTitle: { fontSize: 16, fontWeight: "bold" },
  reportDesc: { fontSize: 12, marginTop: 4, lineHeight: 18 },
  recentCard: { alignItems: "center", marginHorizontal: 16, marginBottom: 8, padding: 12, borderRadius: 10, borderWidth: 1, gap: 10 },
  recentContent: { flex: 1 },
  recentTitle: { fontSize: 14, fontWeight: "600" },
  recentDate: { fontSize: 11, marginTop: 2 },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  typeBadgeText: { fontSize: 11, fontWeight: "600" },
});
