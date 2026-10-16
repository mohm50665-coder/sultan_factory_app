import { DateField } from "@/components/date-field";
import { CustodySummaryPanel } from "@/components/custody-summary-panel";
import { representativeService } from "@/lib/services/representative.service";
import { commercialReport, exactPairs, inReportPeriod, pairLabel, productionMetrics, reportRows, riyadhDate, warehousePeriod, type ReportKind } from "@shared/operational-report";
import React, { useState, useEffect, useRef } from "react";
import { BackButton } from "@/components/back-button";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useLanguage } from "@/lib/language-context";
import { MaterialIcons } from "@expo/vector-icons";
import { BarChart, PieChart, ProgressBar, StatCard } from "@/components/charts";
import { productionService, salesService, collectionService, expensesService, manufacturingService, taskService, administrativeService, finishedWarehouseService } from "@/lib/services/api.service";
import { maintenanceEntriesService, warehouseEntriesService } from "@/lib/services/data.service";

type ReportSection = "production" | "manufacturing" | "warehouse" | "sales" | "expenses" | "maintenance" | "tasks" | "administrative";

interface SectionConfig {
  key: ReportSection;
  titleAr: string;
  titleEn: string;
  icon: string;
  color: string;
}

const SECTIONS: SectionConfig[] = [
  { key: "production", titleAr: "الإنتاج", titleEn: "Production", icon: "factory", color: "#3b82f6" },
  { key: "manufacturing", titleAr: "مراحل التسليم", titleEn: "Manufacturing", icon: "precision-manufacturing", color: "#8b5cf6" },
  { key: "warehouse", titleAr: "التخزين والمستودعات — إنتاج تام", titleEn: "Warehouse", icon: "warehouse", color: "#f59e0b" },
  { key: "sales", titleAr: "إدارة التسويق والمبيعات", titleEn: "Marketing & Sales Management", icon: "business-center", color: "#ec4899" },
  { key: "expenses", titleAr: "المصروفات", titleEn: "Expenses", icon: "payments", color: "#6366f1" },
  { key: "maintenance", titleAr: "الصيانة", titleEn: "Maintenance", icon: "build", color: "#ef4444" },
  { key: "tasks", titleAr: "المهام", titleEn: "Tasks", icon: "checklist", color: "#14b8a6" },
  { key: "administrative", titleAr: "الإجراءات الإدارية", titleEn: "Administrative", icon: "assignment", color: "#06b6d4" },
];

export default function SectionReportsScreen() {
  const router = useRouter();
  const colors = useColors();
  const { language, isRtl } = useLanguage();
  const isAr = language === "ar";

  const [activeSection, setActiveSection] = useState<ReportSection>("production");
  const [isLoading, setIsLoading] = useState(true);
  const [reportData, setReportData] = useState<any>(null);
  const today = riyadhDate();
  const [startDate, setStartDate] = useState(`${today.slice(0,7)}-01`);
  const [endDate, setEndDate] = useState(today);
  const [error, setError] = useState("");
  const loadVersion = useRef(0);
  const periodRows = (value:any, kind:ReportKind = "general") => reportRows(value).filter(row=>inReportPeriod(row,kind,startDate,endDate));

  useEffect(() => {
    loadReportData(activeSection);
  }, [activeSection, startDate, endDate]);

  const loadReportData = async (section: ReportSection) => {
    const version = ++loadVersion.current;
    setIsLoading(true); setError("");
    try {
      let data: any = {};
      switch (section) {
        case "production":
          data = await loadProductionReport();
          break;
        case "manufacturing":
          data = await loadManufacturingReport();
          break;
        case "warehouse":
          data = await loadWarehouseReport();
          break;
        case "sales":
          data = await loadSalesReport();
          break;
        case "expenses":
          data = await loadExpensesReport();
          break;
        case "maintenance":
          data = await loadMaintenanceReport();
          break;
        case "tasks":
          data = await loadTasksReport();
          break;
        case "administrative":
          data = await loadAdministrativeReport();
          break;
      }
      if (version === loadVersion.current) setReportData(data);
    } catch (error) {
      if (version === loadVersion.current) { setReportData(null); setError(error instanceof Error ? error.message : "تعذر تحميل هذا المصدر؛ ليس صفر نشاط"); }
    } finally {
      if (version === loadVersion.current) setIsLoading(false);
    }
  };

  // Load Production Report
  const loadProductionReport = async () => {
    const entries = periodRows(await productionService.getAll(), "production");
    const measured = productionMetrics(entries);
    const totalProduction = pairLabel(measured.totalPairs);
    const totalWasteThread = entries.reduce((s: number, e: any) => s + (parseFloat(e.wasteThreadGrams) || 0), 0);
    const totalWasteSocks = entries.reduce((s: number, e: any) => s + (parseFloat(e.wasteSocksGrams) || 0), 0);
    const totalSecondGrade = measured.secondPairs;
    const totalNeedles = entries.reduce((s: number, e: any) => s + (parseFloat(e.wasteNeedles) || 0), 0);
    const machineCount = new Set(entries.map((e: any) => e.machineNumber)).size;
    const totalShifts = entries.length;

    // بيانات حسب المكينة
    const machineData: Record<string, number> = {};
    entries.forEach((e: any) => {
      const key = e.machineNumber || "?";
      machineData[key] = (machineData[key] || 0) + (exactPairs(e, "production") / 12);
    });

    // بيانات حسب المنتج
    const productData: Record<string, number> = {};
    entries.forEach((e: any) => {
      const product = [e.productName || (isAr ? "بدون اسم" : "Unnamed"), e.productSize, e.productColor].filter(Boolean).join(" — ");
      productData[product] = (productData[product] || 0) + (exactPairs(e, "production") / 12);
    });

    // بيانات حسب الوردية
    const shiftData: Record<string, number> = {};
    entries.forEach((e: any) => {
      const shift = `${isAr ? "وردية" : "Shift"} ${e.shiftNumber || 1}`;
      shiftData[shift] = (shiftData[shift] || 0) + (exactPairs(e, "production") / 12);
    });

    return {
      totalEntries: entries.length,
      firstPairs: measured.firstPairs, yarnGrams: measured.yarnGrams, wastePercent: measured.wastePercent, needlesUsed: measured.needlesUsed,
      totalProduction,
      totalWasteThread,
      totalWasteSocks,
      totalSecondGrade,
      totalNeedles,
      machineCount,
      totalShifts,
      machineData,
      productData,
      shiftData,
    };
  };

  // Load Manufacturing Report
  const loadManufacturingReport = async () => ({ source: "custodyV2" });

  // Load Warehouse Report
  const loadWarehouseReport = async () => {
    const [stock, movements] = await Promise.all([finishedWarehouseService.list(), finishedWarehouseService.movements()]);
    const ledger = warehousePeriod({stock:reportRows(stock),movements:reportRows(movements),startDate,endDate});
    return { inCount:ledger.movements.filter(r=>r.movementType === "receipt").length,
      outCount:ledger.movements.filter(r=>r.movementType === "issue").length,
      totalIn:ledger.receiptPairs,totalOut:ledger.issuePairs,balance:ledger.closingPairs,currentPairs:ledger.currentPairs,openingPairs:ledger.openingPairs };
  };

  // Load Sales Report
  const loadSalesReport = async () => {
    const [sales,legacySales,collections,legacyCollections,transactions] = await Promise.all([representativeService.sales.list(),salesService.getAll(),representativeService.collections.list(),collectionService.getAll(),representativeService.transactions.list()]);
    const report = commercialReport({sales:reportRows(sales),legacySales:reportRows(legacySales),collections:reportRows(collections),legacyCollections:reportRows(legacyCollections),transactions:reportRows(transactions),startDate,endDate});
    return { salesCount:report.salesRows.length,collectionsCount:report.collectionRows.length,totalSalesAmount:report.salesAmount,totalCollected:report.collectionAmount,orderCount:report.orderRows.length,visitCount:report.visitRows.length };
  };

  // Load Expenses Report
  const loadExpensesReport = async () => {
    const entries = periodRows(await expensesService.getAll());
    const totalExpenses = entries.reduce((s: number, e: any) => s + (parseFloat(e.amount) || 0), 0);

    const categoryData: Record<string, number> = {};
    entries.forEach((e: any) => {
      const cat = e.category || e.description || "أخرى";
      categoryData[cat] = (categoryData[cat] || 0) + (parseFloat(e.amount) || 0);
    });

    return {
      totalEntries: entries.length,
      totalExpenses,
      categoryData,
    };
  };

  // Load Maintenance Report
  const loadMaintenanceReport = async () => {
    const periodic = periodRows(await maintenanceEntriesService.getBySection("periodic"));
    const emergency = periodRows(await maintenanceEntriesService.getBySection("emergency"));
    const stopped = periodRows(await maintenanceEntriesService.getBySection("stopped-devices"));

    return {
      periodicCount: periodic.length,
      emergencyCount: emergency.length,
      stoppedCount: stopped.length,
      totalEntries: periodic.length + emergency.length + stopped.length,
    };
  };

  // Load Tasks Report
  const loadTasksReport = async () => {
    const entries = periodRows(await taskService.getAll());

    const completed = entries.filter((e: any) => e.status === "completed" || e.completed).length;
    const pending = entries.filter((e: any) => e.status === "pending" || (!e.completed && !e.overdue)).length;
    const overdue = entries.filter((e: any) => e.status === "overdue" || e.overdue).length;

    return {
      totalTasks: entries.length,
      completed,
      pending,
      overdue,
    };
  };

  // Load Administrative Report
  const loadAdministrativeReport = async () => {
    const entries = periodRows(await administrativeService.getAll());

    const approved = entries.filter((e: any) => e.status === "approved").length;
    const pendingApproval = entries.filter((e: any) => e.status === "pending").length;
    const rejected = entries.filter((e: any) => e.status === "rejected").length;

    return {
      totalRequests: entries.length,
      approved,
      pendingApproval,
      rejected,
    };
  };

  const renderProductionReport = () => {
    if (!reportData) return null;
    const { firstPairs, yarnGrams, wastePercent, needlesUsed, totalProduction, totalWasteThread, totalWasteSocks, totalSecondGrade, totalNeedles, machineCount, machineData, totalEntries, totalShifts, productData, shiftData } = reportData;

    const barData = Object.entries(machineData || {}).slice(0, 10).map(([label, value]) => ({ label, value: value as number }));
    const productBarData = Object.entries(productData || {}).slice(0, 8).map(([label, value]) => ({ label, value: value as number }));
    const shiftBarData = Object.entries(shiftData || {}).map(([label, value]) => ({ label, value: value as number }));
    const pieData = [
      { label: isAr ? "خيوط" : "Thread", value: totalWasteThread || 0, color: "#3b82f6" },
      { label: isAr ? "جوارب" : "Socks", value: totalWasteSocks || 0, color: "#ef4444" },

    ];

    return (
      <View>
        <View style={styles.statsRow}>
          <StatCard title={isAr ? "إجمالي الإنتاج" : "Total Production"} value={`${totalProduction}`} subtitle={isAr ? "درزن + زوج" : "dozen + pairs"} color="#3b82f6" />
          <StatCard title={isAr ? "المكائن النشطة" : "Active Machines"} value={`${machineCount}`} color="#10b981" />
        </View>
        <View style={styles.statsRow}>
          <StatCard title={isAr ? "إجمالي الورديات" : "Total Shifts"} value={`${totalShifts}`} color="#8b5cf6" />
          <StatCard title={isAr ? "المنتجات" : "Products"} value={`${Object.keys(productData || {}).length}`} color="#14b8a6" />
        </View>
        <View style={styles.statsRow}>
          <StatCard title={isAr ? "هدر الخيوط" : "Thread Waste"} value={`${totalWasteThread}`} subtitle={isAr ? "جرام" : "g"} color="#ef4444" />
          <StatCard title={isAr ? "النخب الثاني" : "2nd Grade"} value={`${totalSecondGrade}`} subtitle={isAr ? "زوج" : "pairs"} color="#f59e0b" />
        </View>
        <View style={styles.statsRow}>
          <StatCard title={isAr ? "عدد الإدخالات" : "Entries"} value={`${totalEntries}`} color="#6366f1" />
          <StatCard title={isAr ? "هدر الإبر" : "Needle Waste"} value={`${totalNeedles}`} subtitle={isAr ? "حبة" : "pcs"} color="#dc2626" />
        </View>
        <View style={styles.statsRow}><StatCard title="النخب الأول" value={pairLabel(firstPairs)} color="#15803d"/><StatCard title="الخيوط المستخدمة" value={`${Number(yarnGrams).toFixed(2)} جم`} color="#075985"/></View><View style={styles.statsRow}><StatCard title="نسبة الهدر الإجمالي" value={wastePercent == null ? "غير محسوبة" : `${wastePercent.toFixed(2)}%`} color="#b91c1c"/><StatCard title="الإبر المستخدمة" value={`${needlesUsed} حبة`} color="#075985"/></View>
        {barData.length > 0 && <BarChart data={barData} title={isAr ? "الإنتاج حسب المكينة" : "Production by Machine"} />}
        {productBarData.length > 0 && <BarChart data={productBarData} title={isAr ? "الإنتاج حسب المنتج" : "Production by Product"} barColor="#14b8a6" />}
        {shiftBarData.length > 0 && <BarChart data={shiftBarData} title={isAr ? "الإنتاج حسب الوردية" : "Production by Shift"} barColor="#8b5cf6" />}
        {(totalWasteThread > 0 || totalWasteSocks > 0) && <PieChart data={pieData} title={isAr ? "توزيع الهدر" : "Waste Distribution"} />}
      </View>
    );
  };

  const renderManufacturingReport = () => <CustodySummaryPanel startDate={startDate} endDate={endDate}/>;

  const renderWarehouseReport = () => {
    if (!reportData) return null;
    const { inCount, outCount, totalIn, totalOut, balance, currentPairs, openingPairs } = reportData;

    const pieData = [
      { label: isAr ? "داخل" : "In", value: totalIn || 0, color: "#10b981" },
      { label: isAr ? "خارج" : "Out", value: totalOut || 0, color: "#ef4444" },
    ];

    return (
      <View>
        <View style={styles.statsRow}>
          <StatCard title={isAr ? "إجمالي الداخل" : "Total In"} value={pairLabel(totalIn)} color="#10b981" />
          <StatCard title={isAr ? "إجمالي الخارج" : "Total Out"} value={pairLabel(totalOut)} color="#ef4444" />
        </View>
        <View style={styles.statsRow}>
          <StatCard title={isAr ? "الرصيد" : "Balance"} value={balance == null ? "غير مؤكد" : pairLabel(balance)} color={balance >= 0 ? "#3b82f6" : "#ef4444"} />
          <StatCard title={isAr ? "عمليات الإدخال" : "Operations"} value={`${inCount + outCount}`} color="#6366f1" />
        </View>
        <View style={styles.statsRow}><StatCard title="رصيد بداية الفترة" value={openingPairs == null ? "غير مؤكد" : pairLabel(openingPairs)} color="#075985"/><StatCard title="الرصيد الحالي — مستقل عن حركة الفترة" value={pairLabel(currentPairs)} color="#075985"/></View>
        {(totalIn > 0 || totalOut > 0) && <PieChart data={pieData} title={isAr ? "حركة المستودع" : "Warehouse Movement"} />}
      </View>
    );
  };

  const renderSalesReport = () => {
    if (!reportData) return null;
    const { salesCount, collectionsCount, totalSalesAmount, totalCollected, orderCount, visitCount } = reportData;

    return (
      <View>
        <View style={styles.statsRow}>
          <StatCard title={isAr ? "إجمالي المبيعات" : "Total Sales"} value={`${totalSalesAmount}`} subtitle={isAr ? "ريال" : "SAR"} color="#ec4899" />
          <StatCard title={isAr ? "المحصّل" : "Collected"} value={`${totalCollected}`} subtitle={isAr ? "ريال" : "SAR"} color="#10b981" />
        </View>
        <View style={styles.statsRow}>
          <StatCard title="الطلبات — ليست مبيعات" value={`${orderCount}`} color="#f59e0b" />
          <StatCard title="الزيارات — معلومات فقط" value={`${visitCount}`} color="#3b82f6" />
        </View>
        <View style={styles.statsRow}>
          <StatCard title={isAr ? "عمليات البيع" : "Sales Ops"} value={`${salesCount}`} color="#6366f1" />
          <StatCard title={isAr ? "عمليات التحصيل" : "Collections"} value={`${collectionsCount}`} color="#14b8a6" />
        </View>
        <TouchableOpacity onPress={()=>router.push("/representative-reports" as never)} style={{padding:12}}><Text style={{textAlign:"right",color:colors.primary,fontWeight:"800"}}>تفاصيل الفواتير والتحصيل والطلبات والزيارات والطباعة</Text></TouchableOpacity>
      </View>
    );
  };

  const renderExpensesReport = () => {
    if (!reportData) return null;
    const { totalEntries, totalExpenses, categoryData } = reportData;

    const categories = Object.entries(categoryData || {}).slice(0, 6);
    const barData = categories.map(([label, value]) => ({ label: label.slice(0, 10), value: value as number }));
    const pieColors = ["#3b82f6", "#ef4444", "#f59e0b", "#10b981", "#8b5cf6", "#ec4899"];
    const pieData = categories.map(([label, value], i) => ({ label: label.slice(0, 12), value: value as number, color: pieColors[i % 6] }));

    return (
      <View>
        <View style={styles.statsRow}>
          <StatCard title={isAr ? "إجمالي المصروفات" : "Total Expenses"} value={`${totalExpenses}`} subtitle={isAr ? "ريال" : "SAR"} color="#6366f1" />
          <StatCard title={isAr ? "عدد العمليات" : "Operations"} value={`${totalEntries}`} color="#f59e0b" />
        </View>
        {barData.length > 0 && <BarChart data={barData} title={isAr ? "المصروفات حسب البند" : "Expenses by Category"} barColor="#6366f1" />}
        {pieData.length > 0 && <PieChart data={pieData} title={isAr ? "توزيع المصروفات" : "Expenses Distribution"} />}
      </View>
    );
  };

  const renderMaintenanceReport = () => {
    if (!reportData) return null;
    const { periodicCount, emergencyCount, stoppedCount, totalEntries } = reportData;

    const pieData = [
      { label: isAr ? "دورية" : "Periodic", value: periodicCount || 1, color: "#10b981" },
      { label: isAr ? "طوارئ" : "Emergency", value: emergencyCount || 1, color: "#ef4444" },
      { label: isAr ? "متوقفة" : "Stopped", value: stoppedCount || 1, color: "#f59e0b" },
    ];

    return (
      <View>
        <View style={styles.statsRow}>
          <StatCard title={isAr ? "إجمالي العمليات" : "Total Ops"} value={`${totalEntries}`} color="#ef4444" />
          <StatCard title={isAr ? "صيانة دورية" : "Periodic"} value={`${periodicCount}`} color="#10b981" />
        </View>
        <View style={styles.statsRow}>
          <StatCard title={isAr ? "طوارئ" : "Emergency"} value={`${emergencyCount}`} color="#ef4444" />
          <StatCard title={isAr ? "أجهزة متوقفة" : "Stopped"} value={`${stoppedCount}`} color="#f59e0b" />
        </View>
        <PieChart data={pieData} title={isAr ? "توزيع الصيانة" : "Maintenance Distribution"} />
      </View>
    );
  };

  const renderTasksReport = () => {
    if (!reportData) return null;
    const { totalTasks, completed, pending, overdue } = reportData;

    const pieData = [
      { label: isAr ? "مكتملة" : "Completed", value: completed || 1, color: "#10b981" },
      { label: isAr ? "معلقة" : "Pending", value: pending || 1, color: "#f59e0b" },
      { label: isAr ? "متأخرة" : "Overdue", value: overdue || 1, color: "#ef4444" },
    ];

    return (
      <View>
        <View style={styles.statsRow}>
          <StatCard title={isAr ? "إجمالي المهام" : "Total Tasks"} value={`${totalTasks}`} color="#14b8a6" />
          <StatCard title={isAr ? "مكتملة" : "Completed"} value={`${completed}`} color="#10b981" />
        </View>
        <View style={styles.statsRow}>
          <StatCard title={isAr ? "معلقة" : "Pending"} value={`${pending}`} color="#f59e0b" />
          <StatCard title={isAr ? "متأخرة" : "Overdue"} value={`${overdue}`} color="#ef4444" />
        </View>
        {totalTasks > 0 && <PieChart data={pieData} title={isAr ? "حالة المهام" : "Tasks Status"} />}
        {totalTasks > 0 && (
          <View style={styles.chartContainer}>
            <Text style={styles.chartTitle}>{isAr ? "نسبة الإنجاز" : "Completion Rate"}</Text>
            <ProgressBar label={isAr ? "الإنجاز" : "Progress"} value={completed} max={totalTasks || 1} color="#10b981" />
          </View>
        )}
      </View>
    );
  };

  const renderAdministrativeReport = () => {
    if (!reportData) return null;
    const { totalRequests, approved, pendingApproval, rejected } = reportData;

    const pieData = [
      { label: isAr ? "موافق عليها" : "Approved", value: approved || 1, color: "#10b981" },
      { label: isAr ? "قيد المراجعة" : "Pending", value: pendingApproval || 1, color: "#f59e0b" },
      { label: isAr ? "مرفوضة" : "Rejected", value: rejected || 1, color: "#ef4444" },
    ];

    return (
      <View>
        <View style={styles.statsRow}>
          <StatCard title={isAr ? "إجمالي الطلبات" : "Total Requests"} value={`${totalRequests}`} color="#06b6d4" />
          <StatCard title={isAr ? "موافق عليها" : "Approved"} value={`${approved}`} color="#10b981" />
        </View>
        <View style={styles.statsRow}>
          <StatCard title={isAr ? "قيد المراجعة" : "Pending"} value={`${pendingApproval}`} color="#f59e0b" />
          <StatCard title={isAr ? "مرفوضة" : "Rejected"} value={`${rejected}`} color="#ef4444" />
        </View>
        {totalRequests > 0 && <PieChart data={pieData} title={isAr ? "حالة الطلبات" : "Requests Status"} />}
      </View>
    );
  };

  const renderActiveReport = () => {
    switch (activeSection) {
      case "production": return renderProductionReport();
      case "manufacturing": return renderManufacturingReport();
      case "warehouse": return renderWarehouseReport();
      case "sales": return renderSalesReport();
      case "expenses": return renderExpensesReport();
      case "maintenance": return renderMaintenanceReport();
      case "tasks": return renderTasksReport();
      case "administrative": return renderAdministrativeReport();
      default: return null;
    }
  };

  const activeSectionConfig = SECTIONS.find((s) => s.key === activeSection);

  return (
    <ScreenContainer style={{ backgroundColor: colors.background }}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <BackButton />
        <Text style={styles.headerTitle}>
          {isAr ? "تقارير الأقسام" : "Section Reports"}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={{flexDirection:"row-reverse",flexWrap:"wrap",gap:8,padding:10}}><DateField label="من تاريخ" value={startDate} onChange={setStartDate} isAr style={{flex:1,minWidth:150}}/><DateField label="إلى تاريخ" value={endDate} onChange={setEndDate} isAr style={{flex:1,minWidth:150}}/></View>
      {error?<Text accessibilityRole="alert" style={{color:"#b91c1c",padding:10,textAlign:"right"}}>{error}</Text>:null}
      {/* Section Tabs */}
      <View style={styles.tabsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsList}>
          {SECTIONS.map((section) => (
            <TouchableOpacity
              key={section.key}
              onPress={() => setActiveSection(section.key)}
              style={[styles.tab, activeSection === section.key && { backgroundColor: section.color }]}
            >
              <MaterialIcons
                name={section.icon as any}
                size={16}
                color={activeSection === section.key ? "white" : section.color}
              />
              <Text
                style={[styles.tabText, activeSection === section.key && styles.tabTextActive]}
                numberOfLines={1}
              >
                {isAr ? section.titleAr : section.titleEn}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Section Title */}
      <View style={styles.sectionHeader}>
        <View style={[styles.sectionIcon, { backgroundColor: `${activeSectionConfig?.color}15` }]}>
          <MaterialIcons name={activeSectionConfig?.icon as any} size={20} color={activeSectionConfig?.color} />
        </View>
        <Text style={[styles.sectionTitle, { textAlign: isRtl ? "right" : "left" }]}>
          {isAr
            ? `تقرير ${activeSectionConfig?.titleAr}`
            : `${activeSectionConfig?.titleEn} Report`}
        </Text>
      </View>

      {/* Report Content */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>{isAr ? "جارٍ تحميل التقرير..." : "Loading report..."}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {renderActiveReport()}

          {/* Empty State */}
          {reportData && Object.values(reportData).every((v) => v === 0 || v === null || (Array.isArray(v) && v.length === 0) || (typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 0)) && (
            <View style={styles.emptyState}>
              <MaterialIcons name="analytics" size={56} color="#d1d5db" />
              <Text style={styles.emptyText}>
                {isAr ? "لا توجد بيانات بعد" : "No data available yet"}
              </Text>
              <Text style={styles.emptySubtext}>
                {isAr ? "ابدأ بإدخال البيانات في هذا القسم لعرض التقرير" : "Start entering data in this section to view the report"}
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  backBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "white",
  },
  tabsContainer: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  tabsList: {
    paddingHorizontal: 12,
    gap: 8,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#f3f4f6",
  },
  tabText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#4b5563",
  },
  tabTextActive: {
    color: "white",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sectionIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1f2937",
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: "#6b7280",
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  chartContainer: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  chartTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1f2937",
    marginBottom: 14,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
    marginTop: 20,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#6b7280",
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 13,
    color: "#9ca3af",
    marginTop: 6,
    textAlign: "center",
  },
});
