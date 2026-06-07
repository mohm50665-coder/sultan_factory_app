import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useLanguage } from "@/lib/language-context";
import { MaterialIcons } from "@expo/vector-icons";
import { productionService, salesService, expensesService, taskService } from "@/lib/services/api.service";
import { maintenanceEntriesService } from "@/lib/services/data.service";
import { exportReportAsPDF, type PDFReportData } from "@/lib/services/pdf-export.service";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface MonthOption {
  label: string;
  value: number; // month index 0-11
  year: number;
}

interface ReportData {
  production: {
    totalDozen: number;
    totalPairs: number;
    totalEntries: number;
    wasteThread: number;
    wasteSocks: number;
    wasteNeedles: number;
    secondGrade: number;
    wastePercentage: number;
  };
  sales: {
    totalEntries: number;
    totalAmount: number;
    cashAmount: number;
    creditAmount: number;
  };
  expenses: {
    totalAmount: number;
    categories: { name: string; amount: number }[];
  };
  maintenance: {
    periodicCount: number;
    emergencyCount: number;
    stoppedMachines: number;
  };
  tasks: {
    total: number;
    completed: number;
    pending: number;
    overdue: number;
    completionRate: number;
  };
  collection: {
    totalAmount: number;
    collectionRate: number;
  };
}

export default function BoardMonthlyReport() {
  const router = useRouter();
  const colors = useColors();
  const { language } = useLanguage();
  const isAr = language === "ar";

  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [showMonthPicker, setShowMonthPicker] = useState(false);

  const monthNamesAr = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
  const monthNamesEn = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const monthNames = isAr ? monthNamesAr : monthNamesEn;

  // Generate last 12 months options
  const monthOptions: MonthOption[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    monthOptions.push({
      label: `${monthNames[d.getMonth()]} ${d.getFullYear()}`,
      value: d.getMonth(),
      year: d.getFullYear(),
    });
  }

  useEffect(() => {
    loadReportData();
  }, [selectedMonth, selectedYear]);

  const loadReportData = async () => {
    setIsLoading(true);
    try {
      // Load production data
      const prodEntries = await productionService.getAll() || [];
      let totalDozen = 0, totalPairs = 0, wasteThread = 0, wasteSocks = 0, wasteNeedles = 0, secondGrade = 0;
      let prodCount = 0;
      prodEntries.forEach((item: any) => {
        totalDozen += parseInt(item.productionDozen || "0");
        totalPairs += parseInt(item.productionPairs || "0");
        wasteThread += parseInt(item.wasteThreadGrams || "0");
        wasteSocks += parseInt(item.wasteSocksGrams || "0");
        wasteNeedles += parseInt(item.wasteNeedles || "0");
        secondGrade += parseInt(item.secondGradePairs || "0");
        prodCount++;
      });
      const totalProd = totalDozen * 12 + totalPairs;
      const totalWaste = wasteThread + wasteSocks;
      const wastePercentage = totalProd > 0 ? (totalWaste / totalProd) * 100 : 0;

      // Load sales data
      const salesEntries = await salesService.getAll() || [];
      let salesTotal = 0, cashAmount = 0, creditAmount = 0;
      salesEntries.forEach((item: any) => {
        const amount = parseFloat(item.amount || item.totalAmount || "0");
        salesTotal += amount;
        if (item.paymentMethod === "cash" || item.paymentMethod === "نقدي") {
          cashAmount += amount;
        } else {
          creditAmount += amount;
        }
      });

      // Load expenses data
      const expEntries = await expensesService.getAll() || [];
      let expTotal = 0;
      const expCategories: Record<string, number> = {};
      expEntries.forEach((item: any) => {
        const amount = parseFloat(item.amount || "0");
        expTotal += amount;
        const cat = item.category || item.description || (isAr ? "أخرى" : "Other");
        expCategories[cat] = (expCategories[cat] || 0) + amount;
      });

      // Load maintenance data
      const periodic = await maintenanceEntriesService.getBySection("periodic") || [];
      const emergency = await maintenanceEntriesService.getBySection("emergency") || [];
      const stopped = await maintenanceEntriesService.getBySection("stopped") || [];

      // Load tasks data
      const tasksEntries = await taskService.getAll() || [];
      const tasksCompleted = tasksEntries.filter((t: any) => t.result === "completed").length;
      const tasksPending = tasksEntries.filter((t: any) => !t.result || t.result === "pending").length;
      const tasksOverdue = tasksEntries.filter((t: any) => t.result === "overdue" || t.status === "overdue").length;
      const completionRate = tasksEntries.length > 0 ? (tasksCompleted / tasksEntries.length) * 100 : 0;

      // Load collection data
      const collectionStr = await AsyncStorage.getItem("sultan_collection_data");
      let collectionTotal = 0;
      if (collectionStr) {
        const collectionEntries = JSON.parse(collectionStr);
        collectionEntries.forEach((item: any) => {
          collectionTotal += parseFloat(item.amount || "0");
        });
      }
      const collectionRate = salesTotal > 0 ? (collectionTotal / salesTotal) * 100 : 0;

      setReportData({
        production: {
          totalDozen,
          totalPairs,
          totalEntries: prodCount,
          wasteThread,
          wasteSocks,
          wasteNeedles,
          secondGrade,
          wastePercentage,
        },
        sales: {
          totalEntries: salesEntries.length,
          totalAmount: salesTotal,
          cashAmount,
          creditAmount,
        },
        expenses: {
          totalAmount: expTotal,
          categories: Object.entries(expCategories).map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount).slice(0, 5),
        },
        maintenance: {
          periodicCount: periodic.length,
          emergencyCount: emergency.length,
          stoppedMachines: stopped.length,
        },
        tasks: {
          total: tasksEntries.length,
          completed: tasksCompleted,
          pending: tasksPending,
          overdue: tasksOverdue,
          completionRate,
        },
        collection: {
          totalAmount: collectionTotal,
          collectionRate,
        },
      });
    } catch (error) {
      console.error("Error loading report data:", error);
      setReportData(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportPDF = async () => {
    if (!reportData) return;
    setIsExporting(true);
    try {
      const monthLabel = `${monthNames[selectedMonth]} ${selectedYear}`;
      const pdfData: PDFReportData = {
        title: isAr ? "التقرير الشهري لمجلس الإدارة" : "Monthly Board Report",
        subtitle: monthLabel,
        date: new Date().toLocaleDateString(isAr ? "ar-SA" : "en-US"),
        footer: isAr ? "مصنع السلطان - تقرير سري وخاص بمجلس الإدارة" : "Sultan Factory - Confidential Board Report",
        sections: [
          {
            title: isAr ? "ملخص الأداء العام" : "Overall Performance Summary",
            type: "summary",
            data: [
              { label: isAr ? "إجمالي الإنتاج" : "Total Production", value: `${reportData.production.totalDozen} ${isAr ? "دزينة" : "dozen"}` },
              { label: isAr ? "إجمالي المبيعات" : "Total Sales", value: `${reportData.sales.totalAmount.toLocaleString()} ${isAr ? "ريال" : "SAR"}` },
              { label: isAr ? "إجمالي المصروفات" : "Total Expenses", value: `${reportData.expenses.totalAmount.toLocaleString()} ${isAr ? "ريال" : "SAR"}` },
              { label: isAr ? "صافي الربح" : "Net Profit", value: `${(reportData.sales.totalAmount - reportData.expenses.totalAmount).toLocaleString()} ${isAr ? "ريال" : "SAR"}` },
              { label: isAr ? "إجمالي التحصيل" : "Total Collection", value: `${reportData.collection.totalAmount.toLocaleString()} ${isAr ? "ريال" : "SAR"}` },
              { label: isAr ? "المهام المكتملة" : "Tasks Completed", value: `${reportData.tasks.completed}/${reportData.tasks.total}` },
            ],
          },
          {
            title: isAr ? "مؤشرات الأداء الرئيسية" : "Key Performance Indicators",
            type: "kpi",
            data: [
              {
                title: isAr ? "نسبة الهدر" : "Waste Rate",
                value: `${reportData.production.wastePercentage.toFixed(1)}%`,
                target: isAr ? "أقل من 5%" : "Below 5%",
                status: reportData.production.wastePercentage <= 5 ? "good" : reportData.production.wastePercentage <= 10 ? "warning" : "bad",
              },
              {
                title: isAr ? "نسبة إنجاز المهام" : "Task Completion Rate",
                value: `${reportData.tasks.completionRate.toFixed(0)}%`,
                target: "100%",
                status: reportData.tasks.completionRate >= 80 ? "good" : reportData.tasks.completionRate >= 60 ? "warning" : "bad",
              },
              {
                title: isAr ? "نسبة التحصيل" : "Collection Rate",
                value: `${reportData.collection.collectionRate.toFixed(0)}%`,
                target: "100%",
                status: reportData.collection.collectionRate >= 80 ? "good" : reportData.collection.collectionRate >= 60 ? "warning" : "bad",
              },
              {
                title: isAr ? "هامش الربح" : "Profit Margin",
                value: reportData.sales.totalAmount > 0 ? `${(((reportData.sales.totalAmount - reportData.expenses.totalAmount) / reportData.sales.totalAmount) * 100).toFixed(1)}%` : "0%",
                target: isAr ? "أكثر من 20%" : "Above 20%",
                status: reportData.sales.totalAmount > 0 && ((reportData.sales.totalAmount - reportData.expenses.totalAmount) / reportData.sales.totalAmount) >= 0.2 ? "good" : "warning",
              },
            ],
          },
          {
            title: isAr ? "تفاصيل الإنتاج" : "Production Details",
            type: "table",
            data: {
              headers: [
                isAr ? "البند" : "Item",
                isAr ? "القيمة" : "Value",
              ],
              rows: [
                [isAr ? "إجمالي الإنتاج (دزينة)" : "Total Production (Dozen)", `${reportData.production.totalDozen}`],
                [isAr ? "إجمالي الإنتاج (أزواج)" : "Total Production (Pairs)", `${reportData.production.totalPairs}`],
                [isAr ? "عدد الإدخالات" : "Total Entries", `${reportData.production.totalEntries}`],
                [isAr ? "هدر الخيوط (جرام)" : "Thread Waste (g)", `${reportData.production.wasteThread}`],
                [isAr ? "هدر الجوارب (جرام)" : "Socks Waste (g)", `${reportData.production.wasteSocks}`],
                [isAr ? "هدر الإبر (حبة)" : "Needle Waste (pcs)", `${reportData.production.wasteNeedles}`],
                [isAr ? "النخب الثاني (أزواج)" : "Second Grade (Pairs)", `${reportData.production.secondGrade}`],
              ],
            },
          },
          {
            title: isAr ? "تفاصيل المبيعات" : "Sales Details",
            type: "table",
            data: {
              headers: [
                isAr ? "البند" : "Item",
                isAr ? "القيمة" : "Value",
              ],
              rows: [
                [isAr ? "عدد عمليات البيع" : "Sales Transactions", `${reportData.sales.totalEntries}`],
                [isAr ? "إجمالي المبيعات" : "Total Sales", `${reportData.sales.totalAmount.toLocaleString()} ${isAr ? "ريال" : "SAR"}`],
                [isAr ? "المبيعات النقدية" : "Cash Sales", `${reportData.sales.cashAmount.toLocaleString()} ${isAr ? "ريال" : "SAR"}`],
                [isAr ? "المبيعات الآجلة" : "Credit Sales", `${reportData.sales.creditAmount.toLocaleString()} ${isAr ? "ريال" : "SAR"}`],
                [isAr ? "إجمالي التحصيل" : "Total Collection", `${reportData.collection.totalAmount.toLocaleString()} ${isAr ? "ريال" : "SAR"}`],
                [isAr ? "نسبة التحصيل" : "Collection Rate", `${reportData.collection.collectionRate.toFixed(1)}%`],
              ],
            },
          },
          {
            title: isAr ? "تفاصيل المصروفات" : "Expenses Details",
            type: "table",
            data: {
              headers: [
                isAr ? "البند" : "Category",
                isAr ? "المبلغ" : "Amount",
              ],
              rows: [
                [isAr ? "إجمالي المصروفات" : "Total Expenses", `${reportData.expenses.totalAmount.toLocaleString()} ${isAr ? "ريال" : "SAR"}`],
                ...reportData.expenses.categories.map(cat => [cat.name, `${cat.amount.toLocaleString()} ${isAr ? "ريال" : "SAR"}`]),
              ],
            },
          },
          {
            title: isAr ? "الصيانة" : "Maintenance",
            type: "summary",
            data: [
              { label: isAr ? "الصيانة الدورية" : "Periodic Maintenance", value: `${reportData.maintenance.periodicCount}` },
              { label: isAr ? "صيانة الطوارئ" : "Emergency Maintenance", value: `${reportData.maintenance.emergencyCount}` },
              { label: isAr ? "أجهزة متوقفة" : "Stopped Machines", value: `${reportData.maintenance.stoppedMachines}` },
            ],
          },
          {
            title: isAr ? "المهام" : "Tasks",
            type: "summary",
            data: [
              { label: isAr ? "إجمالي المهام" : "Total Tasks", value: `${reportData.tasks.total}` },
              { label: isAr ? "مكتملة" : "Completed", value: `${reportData.tasks.completed}` },
              { label: isAr ? "معلقة" : "Pending", value: `${reportData.tasks.pending}` },
              { label: isAr ? "متأخرة" : "Overdue", value: `${reportData.tasks.overdue}` },
              { label: isAr ? "نسبة الإنجاز" : "Completion Rate", value: `${reportData.tasks.completionRate.toFixed(0)}%` },
            ],
          },
          {
            title: isAr ? "التوصيات" : "Recommendations",
            type: "text",
            data: generateRecommendations(reportData),
          },
        ],
      };

      await exportReportAsPDF(pdfData);
      Alert.alert(
        isAr ? "تم التصدير" : "Exported",
        isAr ? "تم تصدير التقرير الشهري بنجاح" : "Monthly report exported successfully"
      );
    } catch (error: any) {
      Alert.alert(
        isAr ? "خطأ" : "Error",
        error.message || (isAr ? "فشل في تصدير التقرير" : "Failed to export report")
      );
    } finally {
      setIsExporting(false);
    }
  };

  const generateRecommendations = (data: ReportData): string => {
    const recommendations: string[] = [];
    if (data.production.wastePercentage > 5) {
      recommendations.push(isAr
        ? `• نسبة الهدر (${data.production.wastePercentage.toFixed(1)}%) تتجاوز الحد المقبول (5%). يُوصى بمراجعة خطوط الإنتاج وتدريب العمال.`
        : `• Waste rate (${data.production.wastePercentage.toFixed(1)}%) exceeds acceptable limit (5%). Review production lines and train workers.`
      );
    }
    if (data.tasks.completionRate < 80) {
      recommendations.push(isAr
        ? `• نسبة إنجاز المهام (${data.tasks.completionRate.toFixed(0)}%) أقل من المطلوب. يُوصى بمتابعة المهام المتأخرة وتوزيع الأعباء.`
        : `• Task completion rate (${data.tasks.completionRate.toFixed(0)}%) is below target. Follow up on overdue tasks.`
      );
    }
    if (data.collection.collectionRate < 80) {
      recommendations.push(isAr
        ? `• نسبة التحصيل (${data.collection.collectionRate.toFixed(0)}%) منخفضة. يُوصى بتكثيف جهود التحصيل ومتابعة العملاء المتأخرين.`
        : `• Collection rate (${data.collection.collectionRate.toFixed(0)}%) is low. Intensify collection efforts.`
      );
    }
    if (data.maintenance.emergencyCount > 3) {
      recommendations.push(isAr
        ? `• عدد حالات الطوارئ (${data.maintenance.emergencyCount}) مرتفع. يُوصى بتعزيز الصيانة الوقائية.`
        : `• Emergency maintenance cases (${data.maintenance.emergencyCount}) are high. Strengthen preventive maintenance.`
      );
    }
    if (data.sales.totalAmount > 0 && data.expenses.totalAmount > data.sales.totalAmount) {
      recommendations.push(isAr
        ? `• المصروفات تتجاوز المبيعات. يُوصى بمراجعة بنود الصرف وتقليل التكاليف غير الضرورية.`
        : `• Expenses exceed sales. Review spending items and reduce unnecessary costs.`
      );
    }
    if (recommendations.length === 0) {
      recommendations.push(isAr
        ? "• الأداء العام جيد. يُوصى بالاستمرار في المتابعة والتحسين المستمر."
        : "• Overall performance is good. Continue monitoring and continuous improvement."
      );
    }
    return recommendations.join("\n\n");
  };

  const getStatusColor = (value: number, goodThreshold: number, warningThreshold: number) => {
    if (value >= goodThreshold) return "#22C55E";
    if (value >= warningThreshold) return "#F59E0B";
    return "#EF4444";
  };

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <MaterialIcons name="arrow-forward" size={24} color={colors.foreground} />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>
              {isAr ? "التقرير الشهري لمجلس الإدارة" : "Monthly Board Report"}
            </Text>
            <Text style={[styles.headerSubtitle, { color: colors.muted }]}>
              {isAr ? "تقرير شامل قابل للطباعة" : "Comprehensive printable report"}
            </Text>
          </View>
          <View style={[styles.headerIcon, { backgroundColor: "#7C3AED20" }]}>
            <MaterialIcons name="summarize" size={24} color="#7C3AED" />
          </View>
        </View>

        {/* Month Selector */}
        <View style={[styles.monthSelector, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.monthLabel, { color: colors.muted }]}>
            {isAr ? "اختر الشهر:" : "Select Month:"}
          </Text>
          <TouchableOpacity
            style={[styles.monthButton, { backgroundColor: colors.background, borderColor: colors.border }]}
            onPress={() => setShowMonthPicker(!showMonthPicker)}
          >
            <MaterialIcons name="calendar-today" size={18} color={colors.primary} />
            <Text style={[styles.monthButtonText, { color: colors.foreground }]}>
              {`${monthNames[selectedMonth]} ${selectedYear}`}
            </Text>
            <MaterialIcons name={showMonthPicker ? "expand-less" : "expand-more"} size={20} color={colors.muted} />
          </TouchableOpacity>
        </View>

        {/* Month Picker Dropdown */}
        {showMonthPicker && (
          <View style={[styles.monthDropdown, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {monthOptions.map((option, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.monthOption,
                  option.value === selectedMonth && option.year === selectedYear && { backgroundColor: colors.primary + "20" },
                ]}
                onPress={() => {
                  setSelectedMonth(option.value);
                  setSelectedYear(option.year);
                  setShowMonthPicker(false);
                }}
              >
                <Text style={[
                  styles.monthOptionText,
                  { color: option.value === selectedMonth && option.year === selectedYear ? colors.primary : colors.foreground },
                ]}>
                  {option.label}
                </Text>
                {option.value === selectedMonth && option.year === selectedYear && (
                  <MaterialIcons name="check" size={18} color={colors.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Loading State */}
        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.muted }]}>
              {isAr ? "جاري تحميل البيانات..." : "Loading data..."}
            </Text>
          </View>
        )}

        {/* Report Preview */}
        {!isLoading && reportData && (
          <>
            {/* Summary Cards */}
            <View style={styles.summaryGrid}>
              <View style={[styles.summaryCard, { backgroundColor: "#EFF6FF", borderColor: "#BFDBFE" }]}>
                <MaterialIcons name="precision-manufacturing" size={22} color="#2563EB" />
                <Text style={[styles.summaryValue, { color: "#2563EB" }]}>{reportData.production.totalDozen}</Text>
                <Text style={styles.summaryLabel}>{isAr ? "دزينة إنتاج" : "Dozen Produced"}</Text>
              </View>
              <View style={[styles.summaryCard, { backgroundColor: "#F0FDF4", borderColor: "#BBF7D0" }]}>
                <MaterialIcons name="point-of-sale" size={22} color="#16A34A" />
                <Text style={[styles.summaryValue, { color: "#16A34A" }]}>{reportData.sales.totalAmount.toLocaleString()}</Text>
                <Text style={styles.summaryLabel}>{isAr ? "ريال مبيعات" : "SAR Sales"}</Text>
              </View>
              <View style={[styles.summaryCard, { backgroundColor: "#FEF2F2", borderColor: "#FECACA" }]}>
                <MaterialIcons name="money-off" size={22} color="#DC2626" />
                <Text style={[styles.summaryValue, { color: "#DC2626" }]}>{reportData.expenses.totalAmount.toLocaleString()}</Text>
                <Text style={styles.summaryLabel}>{isAr ? "ريال مصروفات" : "SAR Expenses"}</Text>
              </View>
              <View style={[styles.summaryCard, { backgroundColor: "#F5F3FF", borderColor: "#DDD6FE" }]}>
                <MaterialIcons name="trending-up" size={22} color="#7C3AED" />
                <Text style={[styles.summaryValue, { color: "#7C3AED" }]}>
                  {(reportData.sales.totalAmount - reportData.expenses.totalAmount).toLocaleString()}
                </Text>
                <Text style={styles.summaryLabel}>{isAr ? "صافي الربح" : "Net Profit"}</Text>
              </View>
            </View>

            {/* KPI Indicators */}
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              {isAr ? "مؤشرات الأداء" : "Performance Indicators"}
            </Text>
            <View style={styles.kpiGrid}>
              <View style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={[styles.kpiIndicator, { backgroundColor: getStatusColor(100 - reportData.production.wastePercentage, 95, 90) }]} />
                <Text style={[styles.kpiTitle, { color: colors.muted }]}>{isAr ? "نسبة الهدر" : "Waste Rate"}</Text>
                <Text style={[styles.kpiValue, { color: getStatusColor(100 - reportData.production.wastePercentage, 95, 90) }]}>
                  {reportData.production.wastePercentage.toFixed(1)}%
                </Text>
              </View>
              <View style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={[styles.kpiIndicator, { backgroundColor: getStatusColor(reportData.tasks.completionRate, 80, 60) }]} />
                <Text style={[styles.kpiTitle, { color: colors.muted }]}>{isAr ? "إنجاز المهام" : "Task Completion"}</Text>
                <Text style={[styles.kpiValue, { color: getStatusColor(reportData.tasks.completionRate, 80, 60) }]}>
                  {reportData.tasks.completionRate.toFixed(0)}%
                </Text>
              </View>
              <View style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={[styles.kpiIndicator, { backgroundColor: getStatusColor(reportData.collection.collectionRate, 80, 60) }]} />
                <Text style={[styles.kpiTitle, { color: colors.muted }]}>{isAr ? "نسبة التحصيل" : "Collection Rate"}</Text>
                <Text style={[styles.kpiValue, { color: getStatusColor(reportData.collection.collectionRate, 80, 60) }]}>
                  {reportData.collection.collectionRate.toFixed(0)}%
                </Text>
              </View>
              <View style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={[styles.kpiIndicator, { backgroundColor: reportData.maintenance.emergencyCount <= 3 ? "#22C55E" : "#EF4444" }]} />
                <Text style={[styles.kpiTitle, { color: colors.muted }]}>{isAr ? "طوارئ الصيانة" : "Emergency Maint."}</Text>
                <Text style={[styles.kpiValue, { color: reportData.maintenance.emergencyCount <= 3 ? "#22C55E" : "#EF4444" }]}>
                  {reportData.maintenance.emergencyCount}
                </Text>
              </View>
            </View>

            {/* Detailed Sections */}
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              {isAr ? "تفاصيل الأقسام" : "Section Details"}
            </Text>

            {/* Production Details */}
            <View style={[styles.detailCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.detailHeader}>
                <MaterialIcons name="precision-manufacturing" size={20} color="#2563EB" />
                <Text style={[styles.detailTitle, { color: colors.foreground }]}>
                  {isAr ? "الإنتاج" : "Production"}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: colors.muted }]}>{isAr ? "الإنتاج (دزينة)" : "Production (Dozen)"}</Text>
                <Text style={[styles.detailValue, { color: colors.foreground }]}>{reportData.production.totalDozen}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: colors.muted }]}>{isAr ? "هدر الخيوط" : "Thread Waste"}</Text>
                <Text style={[styles.detailValue, { color: colors.foreground }]}>{reportData.production.wasteThread} {isAr ? "جرام" : "g"}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: colors.muted }]}>{isAr ? "النخب الثاني" : "Second Grade"}</Text>
                <Text style={[styles.detailValue, { color: colors.foreground }]}>{reportData.production.secondGrade} {isAr ? "زوج" : "pairs"}</Text>
              </View>
            </View>

            {/* Sales Details */}
            <View style={[styles.detailCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.detailHeader}>
                <MaterialIcons name="point-of-sale" size={20} color="#16A34A" />
                <Text style={[styles.detailTitle, { color: colors.foreground }]}>
                  {isAr ? "المبيعات والتحصيل" : "Sales & Collection"}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: colors.muted }]}>{isAr ? "إجمالي المبيعات" : "Total Sales"}</Text>
                <Text style={[styles.detailValue, { color: colors.foreground }]}>{reportData.sales.totalAmount.toLocaleString()} {isAr ? "ر.س" : "SAR"}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: colors.muted }]}>{isAr ? "نقدي" : "Cash"}</Text>
                <Text style={[styles.detailValue, { color: colors.foreground }]}>{reportData.sales.cashAmount.toLocaleString()} {isAr ? "ر.س" : "SAR"}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: colors.muted }]}>{isAr ? "آجل" : "Credit"}</Text>
                <Text style={[styles.detailValue, { color: colors.foreground }]}>{reportData.sales.creditAmount.toLocaleString()} {isAr ? "ر.س" : "SAR"}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: colors.muted }]}>{isAr ? "المحصّل" : "Collected"}</Text>
                <Text style={[styles.detailValue, { color: colors.foreground }]}>{reportData.collection.totalAmount.toLocaleString()} {isAr ? "ر.س" : "SAR"}</Text>
              </View>
            </View>

            {/* Maintenance Details */}
            <View style={[styles.detailCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.detailHeader}>
                <MaterialIcons name="build" size={20} color="#F59E0B" />
                <Text style={[styles.detailTitle, { color: colors.foreground }]}>
                  {isAr ? "الصيانة" : "Maintenance"}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: colors.muted }]}>{isAr ? "صيانة دورية" : "Periodic"}</Text>
                <Text style={[styles.detailValue, { color: colors.foreground }]}>{reportData.maintenance.periodicCount}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: colors.muted }]}>{isAr ? "طوارئ" : "Emergency"}</Text>
                <Text style={[styles.detailValue, { color: colors.foreground }]}>{reportData.maintenance.emergencyCount}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: colors.muted }]}>{isAr ? "أجهزة متوقفة" : "Stopped"}</Text>
                <Text style={[styles.detailValue, { color: colors.foreground }]}>{reportData.maintenance.stoppedMachines}</Text>
              </View>
            </View>

            {/* Export Button */}
            <TouchableOpacity
              style={[styles.exportButton, isExporting && styles.exportButtonDisabled]}
              onPress={handleExportPDF}
              disabled={isExporting}
            >
              {isExporting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <MaterialIcons name="picture-as-pdf" size={22} color="#fff" />
              )}
              <Text style={styles.exportButtonText}>
                {isExporting
                  ? (isAr ? "جاري التصدير..." : "Exporting...")
                  : (isAr ? "تصدير التقرير PDF" : "Export Report PDF")}
              </Text>
            </TouchableOpacity>

            {/* Print Note */}
            <View style={[styles.noteCard, { backgroundColor: "#FFFBEB", borderColor: "#FDE68A" }]}>
              <MaterialIcons name="info-outline" size={18} color="#D97706" />
              <Text style={[styles.noteText, { color: "#92400E" }]}>
                {isAr
                  ? "التقرير المُصدّر بصيغة HTML يمكن طباعته مباشرة من المتصفح كـ PDF عبر خيار الطباعة (Ctrl+P)"
                  : "The exported HTML report can be printed directly from browser as PDF via Print option (Ctrl+P)"}
              </Text>
            </View>
          </>
        )}

        {/* Empty State */}
        {!isLoading && !reportData && (
          <View style={styles.emptyState}>
            <MaterialIcons name="insert-chart-outlined" size={64} color={colors.muted} />
            <Text style={[styles.emptyText, { color: colors.muted }]}>
              {isAr ? "لا توجد بيانات متاحة لهذا الشهر" : "No data available for this month"}
            </Text>
            <TouchableOpacity
              style={[styles.retryButton, { borderColor: colors.primary }]}
              onPress={loadReportData}
            >
              <Text style={[styles.retryText, { color: colors.primary }]}>
                {isAr ? "إعادة المحاولة" : "Retry"}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: 120 },
  header: { flexDirection: "row", alignItems: "center", margin: 16, padding: 16, borderRadius: 16, borderWidth: 1, gap: 12 },
  backBtn: { padding: 4 },
  headerContent: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: "bold" },
  headerSubtitle: { fontSize: 12, marginTop: 2 },
  headerIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  monthSelector: { flexDirection: "row", alignItems: "center", marginHorizontal: 16, marginBottom: 12, padding: 14, borderRadius: 12, borderWidth: 1, gap: 12 },
  monthLabel: { fontSize: 14, fontWeight: "600" },
  monthButton: { flex: 1, flexDirection: "row", alignItems: "center", padding: 10, borderRadius: 8, borderWidth: 1, gap: 8 },
  monthButtonText: { flex: 1, fontSize: 14, fontWeight: "600" },
  monthDropdown: { marginHorizontal: 16, marginBottom: 12, borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  monthOption: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: "#E5E7EB" },
  monthOptionText: { fontSize: 14 },
  loadingContainer: { alignItems: "center", justifyContent: "center", paddingVertical: 60 },
  loadingText: { marginTop: 12, fontSize: 14 },
  summaryGrid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 12, marginBottom: 16 },
  summaryCard: { width: "47%", margin: "1.5%", padding: 14, borderRadius: 12, borderWidth: 1, alignItems: "center", gap: 4 },
  summaryValue: { fontSize: 18, fontWeight: "bold" },
  summaryLabel: { fontSize: 11, color: "#6B7280", textAlign: "center" },
  sectionTitle: { fontSize: 16, fontWeight: "bold", paddingHorizontal: 16, marginBottom: 12, marginTop: 8 },
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 12, marginBottom: 16 },
  kpiCard: { width: "47%", margin: "1.5%", padding: 12, borderRadius: 10, borderWidth: 1, alignItems: "center", gap: 4 },
  kpiIndicator: { width: 8, height: 8, borderRadius: 4, position: "absolute", top: 10, right: 10 },
  kpiTitle: { fontSize: 11, textAlign: "center" },
  kpiValue: { fontSize: 20, fontWeight: "bold" },
  detailCard: { marginHorizontal: 16, marginBottom: 12, padding: 16, borderRadius: 12, borderWidth: 1 },
  detailHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: "#E5E7EB" },
  detailTitle: { fontSize: 15, fontWeight: "bold" },
  detailRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 6 },
  detailLabel: { fontSize: 13 },
  detailValue: { fontSize: 14, fontWeight: "600" },
  exportButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginHorizontal: 16, marginTop: 20, marginBottom: 12, padding: 16, borderRadius: 12, backgroundColor: "#7C3AED", gap: 10 },
  exportButtonDisabled: { opacity: 0.6 },
  exportButtonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  noteCard: { flexDirection: "row", alignItems: "flex-start", marginHorizontal: 16, marginBottom: 16, padding: 12, borderRadius: 10, borderWidth: 1, gap: 8 },
  noteText: { flex: 1, fontSize: 12, lineHeight: 18 },
  emptyState: { alignItems: "center", paddingVertical: 60, gap: 12 },
  emptyText: { fontSize: 15 },
  retryButton: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  retryText: { fontSize: 14, fontWeight: "600" },
});
