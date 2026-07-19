import { useState, useEffect } from "react";
import { useLanguage } from "@/lib/language-context";
import { BackButton } from "@/components/back-button";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  FlatList,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { MaterialIcons } from "@expo/vector-icons";
import { maintenanceEntriesService } from "@/lib/services/data.service";
import { useAuth } from "@/lib/auth-context";
import { AdminBadgeIcon } from "@/components/admin-badge-icon";
import { AdminCard } from "@/components/admin-card";

interface TrackingItem {
  id: string;
  section: string;
  title: string;
  createdAt: string;
  approvalTime: string;
  warehouseTime: string;
  orderDate: string;
  deliveryDate: string;
  approvalStatus: string;
  warehouseStatus: string;
  warehouseNotes: string;
  requestedBy: string;
  status: string;
}

const SECTIONS_TO_TRACK = [
  { key: "orders_visits", labelAr: "الطلبات والزيارات", labelEn: "Orders & Visits" },
  { key: "custom_manufacturing", labelAr: "التصنيع الخاص", labelEn: "Custom Manufacturing" },
  { key: "production_requests", labelAr: "طلبات الإنتاج", labelEn: "Production Requests" },
];

export default function TrackingScreen() {
  const colors = useColors();
  const { language } = useLanguage();
  const isAr = language === "ar";
  const { user } = useAuth();

  const [items, setItems] = useState<TrackingItem[]>([]);
  const [filter, setFilter] = useState<"all" | "delayed" | "pending" | "completed">("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAllItems();
  }, []);

  const loadAllItems = async () => {
    setLoading(true);
    try {
      const allItems: TrackingItem[] = [];
      for (const section of SECTIONS_TO_TRACK) {
        const data = await maintenanceEntriesService.getBySection(section.key);
        if (data && data.length > 0) {
          data.forEach((d: any) => {
            const entry = d.data || {};
            allItems.push({
              id: String(d.id),
              section: section.key,
              title: entry.customerName || entry.productName || entry.itemName || "-",
              createdAt: entry.createdAt || d.createdAt || "",
              approvalTime: entry.approvalTime || "",
              warehouseTime: entry.warehouseTime || "",
              orderDate: entry.orderDate || "",
              deliveryDate: entry.deliveryDate || entry.dateTo || "",
              approvalStatus: entry.approvalStatus || "pending",
              warehouseStatus: entry.warehouseStatus || "",
              warehouseNotes: entry.warehouseNotes || "",
              requestedBy: entry.salesRepName || entry.requestedBy || "",
              status: entry.status || "pending",
            });
          });
        }
      }
      // ترتيب حسب الأحدث
      allItems.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setItems(allItems);
    } catch (e) {
      console.log("Error loading tracking items:", e);
    }
    setLoading(false);
  };

  const getSectionLabel = (key: string) => {
    const s = SECTIONS_TO_TRACK.find(sec => sec.key === key);
    return isAr ? s?.labelAr || key : s?.labelEn || key;
  };

  const getTimeDiff = (from: string, to: string) => {
    if (!from || !to) return null;
    const diff = new Date(to).getTime() - new Date(from).getTime();
    if (diff < 0) return null;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return isAr ? `${days} يوم ${hours % 24} ساعة` : `${days}d ${hours % 24}h`;
    }
    return isAr ? `${hours} ساعة ${minutes} دقيقة` : `${hours}h ${minutes}m`;
  };

  const isDelayed = (item: TrackingItem) => {
    if (!item.deliveryDate) return false;
    const delivery = new Date(item.deliveryDate);
    const now = new Date();
    return now > delivery && item.warehouseStatus !== "done" && item.status !== "completed";
  };

  const isCompleted = (item: TrackingItem) => {
    return item.warehouseStatus === "done" || item.status === "completed";
  };

  const isPending = (item: TrackingItem) => {
    return item.approvalStatus === "pending" || (item.approvalStatus === "approved" && !item.warehouseStatus);
  };

  const filteredItems = items.filter(item => {
    if (filter === "all") return true;
    if (filter === "delayed") return isDelayed(item);
    if (filter === "completed") return isCompleted(item);
    if (filter === "pending") return isPending(item);
    return true;
  });

  // إحصائيات
  const stats = {
    total: items.length,
    delayed: items.filter(isDelayed).length,
    pending: items.filter(isPending).length,
    completed: items.filter(isCompleted).length,
  };

  const getApprovalStatusLabel = (status: string) => {
    if (isAr) {
      switch (status) {
        case "approved": return "معتمد";
        case "rejected": return "مرفوض";
        default: return "بانتظار التعميد";
      }
    }
    switch (status) {
      case "approved": return "Approved";
      case "rejected": return "Rejected";
      default: return "Pending Approval";
    }
  };

  const getWarehouseStatusLabel = (status: string) => {
    if (isAr) {
      switch (status) {
        case "done": return "أنجز";
        case "not_done": return "لم ينجز";
        case "partial": return "أنجز جزئياً";
        default: return "بانتظار التنفيذ";
      }
    }
    switch (status) {
      case "done": return "Completed";
      case "not_done": return "Not Done";
      case "partial": return "Partial";
      default: return "Pending";
    }
  };

  const renderItem = ({ item }: { item: TrackingItem }) => {
    const delayed = isDelayed(item);
    const completed = isCompleted(item);
    const approvalDuration = getTimeDiff(item.createdAt, item.approvalTime);
    const executionDuration = getTimeDiff(item.approvalTime, item.warehouseTime);
    const totalDuration = getTimeDiff(item.createdAt, item.warehouseTime || new Date().toISOString());

    return (
      <View style={{
        backgroundColor: "white",
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 2,
        borderColor: delayed ? "#ef4444" : completed ? "#16a34a" : "#E5E7EB",
      }}>
        {/* العنوان والقسم */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <View style={{
            backgroundColor: delayed ? "#fef2f2" : completed ? "#f0fdf4" : "#fffbeb",
            paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8
          }}>
            <Text style={{ color: delayed ? "#ef4444" : completed ? "#16a34a" : "#f59e0b", fontSize: 10, fontWeight: "700" }}>
              {delayed ? (isAr ? "متأخر" : "DELAYED") : completed ? (isAr ? "مكتمل" : "DONE") : (isAr ? "قيد التنفيذ" : "IN PROGRESS")}
            </Text>
          </View>
          <View style={{ alignItems: "flex-end", flex: 1 }}>
            <Text style={{ fontWeight: "bold", fontSize: 15, color: "#11181C", textAlign: "right" }}>{item.title}</Text>
            <Text style={{ color: "#687076", fontSize: 11, textAlign: "right" }}>{getSectionLabel(item.section)}</Text>
          </View>
        </View>

        {/* التواريخ */}
        <View style={{ backgroundColor: "#f8fafc", borderRadius: 10, padding: 10, marginBottom: 8, gap: 4 }}>
          {item.orderDate && (
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ color: "#687076", fontSize: 12 }}>{item.orderDate}</Text>
              <Text style={{ color: "#687076", fontSize: 12, fontWeight: "600" }}>{isAr ? "تاريخ الطلب" : "Order Date"}</Text>
            </View>
          )}
          {item.deliveryDate && (
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ color: delayed ? "#ef4444" : "#16a34a", fontSize: 12, fontWeight: "600" }}>{item.deliveryDate}</Text>
              <Text style={{ color: "#687076", fontSize: 12, fontWeight: "600" }}>{isAr ? "تاريخ التسليم" : "Delivery Date"}</Text>
            </View>
          )}
        </View>

        {/* مراحل التنفيذ - Timeline */}
        <View style={{ gap: 6 }}>
          <Text style={{ fontWeight: "700", fontSize: 13, color: "#11181C", textAlign: "right", marginBottom: 4 }}>
            {isAr ? "مراحل التنفيذ" : "Execution Stages"}
          </Text>

          {/* مرحلة 1: الإنشاء */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: "#16a34a", alignItems: "center", justifyContent: "center" }}>
              <MaterialIcons name="check" size={12} color="white" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, color: "#11181C" }}>{isAr ? "إنشاء الطلب" : "Order Created"}</Text>
              {item.createdAt && <Text style={{ fontSize: 10, color: "#9BA1A6" }}>{new Date(item.createdAt).toLocaleString("ar-SA")}</Text>}
            </View>
          </View>

          {/* مرحلة 2: التعميد */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{
              width: 20, height: 20, borderRadius: 10,
              backgroundColor: item.approvalStatus === "approved" ? "#16a34a" : item.approvalStatus === "rejected" ? "#ef4444" : "#d1d5db",
              alignItems: "center", justifyContent: "center"
            }}>
              {item.approvalStatus === "approved" ? <MaterialIcons name="check" size={12} color="white" /> :
               item.approvalStatus === "rejected" ? <MaterialIcons name="close" size={12} color="white" /> :
               <MaterialIcons name="schedule" size={12} color="white" />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, color: "#11181C" }}>
                {isAr ? "تعميد المدير: " : "Manager Approval: "}{getApprovalStatusLabel(item.approvalStatus)}
              </Text>
              {approvalDuration && <Text style={{ fontSize: 10, color: "#f59e0b" }}>{isAr ? "المدة: " : "Duration: "}{approvalDuration}</Text>}
            </View>
          </View>

          {/* مرحلة 3: التنفيذ */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{
              width: 20, height: 20, borderRadius: 10,
              backgroundColor: item.warehouseStatus === "done" ? "#16a34a" : item.warehouseStatus === "not_done" ? "#ef4444" : item.warehouseStatus === "partial" ? "#f59e0b" : "#d1d5db",
              alignItems: "center", justifyContent: "center"
            }}>
              {item.warehouseStatus === "done" ? <MaterialIcons name="check" size={12} color="white" /> :
               item.warehouseStatus ? <MaterialIcons name="warning" size={12} color="white" /> :
               <MaterialIcons name="schedule" size={12} color="white" />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, color: "#11181C" }}>
                {isAr ? "التنفيذ: " : "Execution: "}{getWarehouseStatusLabel(item.warehouseStatus)}
              </Text>
              {executionDuration && <Text style={{ fontSize: 10, color: "#f59e0b" }}>{isAr ? "المدة: " : "Duration: "}{executionDuration}</Text>}
              {item.warehouseNotes ? <Text style={{ fontSize: 10, color: "#ef4444" }}>{item.warehouseNotes}</Text> : null}
            </View>
          </View>
        </View>

        {/* الإجمالي */}
        <View style={{ marginTop: 8, borderTopWidth: 1, borderColor: "#E5E7EB", paddingTop: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ fontSize: 12, color: delayed ? "#ef4444" : "#16a34a", fontWeight: "700" }}>
            {totalDuration || "-"}
          </Text>
          <Text style={{ fontSize: 12, color: "#687076", fontWeight: "600" }}>
            {isAr ? "إجمالي المدة" : "Total Duration"}
          </Text>
        </View>

        {/* المندوب */}
        {item.requestedBy && (
          <Text style={{ fontSize: 11, color: "#9BA1A6", textAlign: "right", marginTop: 4 }}>
            {isAr ? "بواسطة: " : "By: "}{item.requestedBy}
          </Text>
        )}
      </View>
    );
  };

  return (
    <ScreenContainer>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderColor: "#E5E7EB" }}>
          <TouchableOpacity onPress={loadAllItems} style={{ padding: 6 }}>
            <MaterialIcons name="refresh" size={22} color={colors.primary} />
          </TouchableOpacity>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={{ fontSize: 18, fontWeight: "bold", color: colors.foreground }}>{isAr ? "المتابعة" : "Tracking"}</Text>
            <AdminBadgeIcon />
          </View>
          <BackButton />
        </View>

        {/* إحصائيات */}
        <View style={{ flexDirection: "row", padding: 12, gap: 8 }}>
          <View style={{ flex: 1, backgroundColor: "#fef2f2", borderRadius: 12, padding: 10, alignItems: "center" }}>
            <Text style={{ fontSize: 20, fontWeight: "bold", color: "#ef4444" }}>{stats.delayed}</Text>
            <Text style={{ fontSize: 10, color: "#ef4444", fontWeight: "600" }}>{isAr ? "متأخر" : "Delayed"}</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: "#fffbeb", borderRadius: 12, padding: 10, alignItems: "center" }}>
            <Text style={{ fontSize: 20, fontWeight: "bold", color: "#f59e0b" }}>{stats.pending}</Text>
            <Text style={{ fontSize: 10, color: "#f59e0b", fontWeight: "600" }}>{isAr ? "قيد التنفيذ" : "Pending"}</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: "#f0fdf4", borderRadius: 12, padding: 10, alignItems: "center" }}>
            <Text style={{ fontSize: 20, fontWeight: "bold", color: "#16a34a" }}>{stats.completed}</Text>
            <Text style={{ fontSize: 10, color: "#16a34a", fontWeight: "600" }}>{isAr ? "مكتمل" : "Done"}</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: "#f1f5f9", borderRadius: 12, padding: 10, alignItems: "center" }}>
            <Text style={{ fontSize: 20, fontWeight: "bold", color: "#64748b" }}>{stats.total}</Text>
            <Text style={{ fontSize: 10, color: "#64748b", fontWeight: "600" }}>{isAr ? "الكل" : "All"}</Text>
          </View>
        </View>

        {/* فلتر */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, gap: 8, paddingVertical: 8 }}>
          {([
            { key: "all", labelAr: "الكل", labelEn: "All", color: "#64748b" },
            { key: "delayed", labelAr: "متأخر", labelEn: "Delayed", color: "#ef4444" },
            { key: "pending", labelAr: "قيد التنفيذ", labelEn: "Pending", color: "#f59e0b" },
            { key: "completed", labelAr: "مكتمل", labelEn: "Completed", color: "#16a34a" },
          ] as const).map((f) => (
            <TouchableOpacity
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={{
                paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
                backgroundColor: filter === f.key ? f.color : "#f1f5f9",
              }}
            >
              <Text style={{ color: filter === f.key ? "white" : "#687076", fontSize: 13, fontWeight: "600" }}>
                {isAr ? f.labelAr : f.labelEn}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* القائمة */}
        <FlatList
          data={filteredItems}
          renderItem={renderItem}
          keyExtractor={(item) => item.id + item.section}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          ListEmptyComponent={
            <View style={{ alignItems: "center", padding: 40 }}>
              <MaterialIcons name="track-changes" size={48} color="#d1d5db" />
              <Text style={{ color: "#9BA1A6", marginTop: 12, fontSize: 14 }}>
                {loading ? (isAr ? "جاري التحميل..." : "Loading...") : (isAr ? "لا توجد بيانات" : "No data")}
              </Text>
            </View>
          }
        />

        {/* Admin Card */}
        <AdminCard />
      </View>
    </ScreenContainer>
  );
}
