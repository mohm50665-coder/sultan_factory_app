import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useLanguage } from "@/lib/language-context";
import { useAuth } from "@/lib/auth-context";
import { MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import RolesService, { type UserRole } from "@/lib/services/roles.service";

interface SearchResult {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  icon: string;
  color: string;
  route: string;
}

const APP_SECTIONS = [
  { id: "production", titleAr: "الإنتاج", titleEn: "Production", icon: "factory", color: "#3b82f6", route: "/production", section: "production", keywords: ["إنتاج", "مكينة", "درزن", "production", "machine"] },
  { id: "manufacturing", titleAr: "مراحل تسليم الإنتاج", titleEn: "Manufacturing Stages", icon: "precision-manufacturing", color: "#8b5cf6", route: "/manufacturing", section: "manufacturing", keywords: ["تصنيع", "مراحل", "manufacturing"] },
  { id: "sales", titleAr: "المبيعات والتحصيل", titleEn: "Sales & Collection", icon: "shopping-cart", color: "#ec4899", route: "/sales", section: "sales", keywords: ["مبيعات", "تحصيل", "sales"] },
  { id: "warehouse", titleAr: "المستودعات", titleEn: "Warehouse", icon: "warehouse", color: "#f59e0b", route: "/warehouse", section: "warehouse", keywords: ["مستودع", "مخزن", "warehouse"] },
  { id: "maintenance", titleAr: "الصيانة", titleEn: "Maintenance", icon: "build", color: "#ef4444", route: "/maintenance", section: "maintenance", keywords: ["صيانة", "إصلاح", "maintenance"] },
  { id: "financial", titleAr: "المصروفات", titleEn: "Expenses", icon: "payments", color: "#6366f1", route: "/financial", section: "financial", keywords: ["مصروفات", "مالية", "expenses"] },
  { id: "tasks", titleAr: "المهام", titleEn: "Tasks", icon: "checklist", color: "#14b8a6", route: "/tasks", section: "tasks", keywords: ["مهام", "تكليف", "tasks"] },
  { id: "administrative", titleAr: "الإجراءات الإدارية", titleEn: "Administrative", icon: "assignment", color: "#06b6d4", route: "/administrative", section: "hr", keywords: ["إدارية", "طلبات", "administrative"] },
  { id: "reports", titleAr: "التقارير والتحليلات", titleEn: "Reports & Analytics", icon: "bar-chart", color: "#059669", route: "/reports-analytics", section: "reports", keywords: ["تقارير", "تحليلات", "reports"] },
  { id: "notifications", titleAr: "الإشعارات", titleEn: "Notifications", icon: "notifications", color: "#d97706", route: "/in-app-notifications", section: "", keywords: ["إشعارات", "تنبيهات", "notifications"] },
  { id: "settings", titleAr: "الإعدادات", titleEn: "Settings", icon: "settings", color: "#6b7280", route: "/settings", section: "", keywords: ["إعدادات", "ضبط", "settings"] },
  { id: "profile", titleAr: "الملف الشخصي", titleEn: "Profile", icon: "person", color: "#8b5cf6", route: "/profile", section: "", keywords: ["ملف شخصي", "حساب", "profile"] },
  { id: "waste-alerts", titleAr: "تنبيهات الهدر", titleEn: "Waste Alerts", icon: "warning-amber", color: "#dc2626", route: "/waste-alerts", section: "waste_alerts", keywords: ["هدر", "تنبيه", "waste"] },
  { id: "activity-log", titleAr: "سجل النشاطات", titleEn: "Activity Log", icon: "history", color: "#0891b2", route: "/activity-log", section: "activity_log", keywords: ["سجل", "نشاطات", "log"] },
  { id: "export", titleAr: "تصدير البيانات", titleEn: "Export Data", icon: "file-download", color: "#6366f1", route: "/production-export", section: "export", keywords: ["تصدير", "ملف", "export"] },
  { id: "users", titleAr: "إدارة المستخدمين", titleEn: "Users Management", icon: "people", color: "#7c3aed", route: "/users-management", section: "users_management", keywords: ["مستخدمين", "صلاحيات", "users"] },
];

export default function GlobalSearchScreen() {
  const router = useRouter();
  const colors = useColors();
  const { t, language, isRtl } = useLanguage();
  const { user } = useAuth();
  const isAr = language === "ar";
  const textAlign = isRtl ? "right" : "left";

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const userRole = (user?.role || "user") as UserRole;

  useEffect(() => {
    loadRecentSearches();
  }, []);

  const loadRecentSearches = async () => {
    try {
      const data = await AsyncStorage.getItem("recent_searches");
      if (data) setRecentSearches(JSON.parse(data));
    } catch { /* ignore */ }
  };

  const saveRecentSearch = async (term: string) => {
    const updated = [term, ...recentSearches.filter((s) => s !== term)].slice(0, 10);
    setRecentSearches(updated);
    await AsyncStorage.setItem("recent_searches", JSON.stringify(updated));
  };

  const performSearch = useCallback((searchQuery: string) => {
    if (!searchQuery.trim()) { setResults([]); return; }
    setIsSearching(true);
    const q = searchQuery.toLowerCase().trim();
    const searchResults: SearchResult[] = [];

    APP_SECTIONS.forEach((section) => {
      const matchesTitle = section.titleAr.toLowerCase().includes(q) || section.titleEn.toLowerCase().includes(q);
      const matchesKeywords = section.keywords.some((k) => k.toLowerCase().includes(q));

      if (matchesTitle || matchesKeywords) {
        if (section.section && !RolesService.canAccessSection(userRole, section.section)) return;
        if (section.id === "users" && userRole !== "admin") return;

        searchResults.push({
          id: section.id,
          type: "section",
          title: isAr ? section.titleAr : section.titleEn,
          subtitle: isAr ? "قسم في التطبيق" : "App section",
          icon: section.icon,
          color: section.color,
          route: section.route,
        });
      }
    });

    setResults(searchResults);
    setIsSearching(false);
  }, [userRole, isAr]);

  useEffect(() => {
    const timer = setTimeout(() => { performSearch(query); }, 300);
    return () => clearTimeout(timer);
  }, [query, performSearch]);

  const handleResultPress = (result: SearchResult) => {
    saveRecentSearch(query);
    router.push(result.route as any);
  };

  const clearRecentSearches = async () => {
    setRecentSearches([]);
    await AsyncStorage.removeItem("recent_searches");
  };

  const renderResult = ({ item }: { item: SearchResult }) => (
    <TouchableOpacity onPress={() => handleResultPress(item)} style={styles.resultCard} activeOpacity={0.7}>
      <View style={[styles.resultIcon, { backgroundColor: `${item.color}15` }]}>
        <MaterialIcons name={item.icon as any} size={22} color={item.color} />
      </View>
      <View style={styles.resultContent}>
        <Text style={[styles.resultTitle, { textAlign }]}>{item.title}</Text>
        <Text style={[styles.resultSubtitle, { textAlign }]}>{item.subtitle}</Text>
      </View>
      <MaterialIcons name={isRtl ? "chevron-left" : "chevron-right"} size={20} color="#9ca3af" />
    </TouchableOpacity>
  );

  return (
    <ScreenContainer className="bg-background">
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <TouchableOpacity onPress={() => router.replace("/(tabs)")} style={styles.backBtn}>
          <MaterialIcons name={isRtl ? "arrow-forward" : "arrow-back"} size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isAr ? "البحث الشامل" : "Global Search"}</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrapper}>
          <MaterialIcons name="search" size={22} color="#9ca3af" />
          <TextInput
            style={[styles.searchInput, { textAlign }]}
            placeholder={isAr ? "ابحث في جميع الأقسام..." : "Search all sections..."}
            placeholderTextColor="#9ca3af"
            value={query}
            onChangeText={setQuery}
            autoFocus
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery("")}>
              <MaterialIcons name="close" size={20} color="#9ca3af" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {isSearching ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : query.length > 0 ? (
        results.length > 0 ? (
          <FlatList data={results} keyExtractor={(item) => item.id} renderItem={renderResult} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false} />
        ) : (
          <View style={styles.centerContainer}>
            <MaterialIcons name="search-off" size={56} color="#d1d5db" />
            <Text style={styles.emptyText}>{isAr ? "لا توجد نتائج" : "No results found"}</Text>
            <Text style={styles.emptySubtext}>{isAr ? "جرب كلمات بحث مختلفة" : "Try different search terms"}</Text>
          </View>
        )
      ) : (
        <View style={styles.suggestionsContainer}>
          {recentSearches.length > 0 && (
            <View style={styles.recentSection}>
              <View style={styles.recentHeader}>
                <Text style={[styles.recentTitle, { textAlign }]}>{isAr ? "عمليات البحث الأخيرة" : "Recent Searches"}</Text>
                <TouchableOpacity onPress={clearRecentSearches}>
                  <Text style={styles.clearText}>{t("clear_all")}</Text>
                </TouchableOpacity>
              </View>
              {recentSearches.map((term, index) => (
                <TouchableOpacity key={index} onPress={() => { setQuery(term); performSearch(term); }} style={styles.recentItem}>
                  <MaterialIcons name="history" size={18} color="#9ca3af" />
                  <Text style={[styles.recentItemText, { textAlign }]}>{term}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={styles.quickSection}>
            <Text style={[styles.recentTitle, { textAlign }]}>{isAr ? "وصول سريع" : "Quick Access"}</Text>
            <View style={styles.quickGrid}>
              {APP_SECTIONS.filter((s) => {
                if (s.section && !RolesService.canAccessSection(userRole, s.section)) return false;
                if (s.id === "users" && userRole !== "admin") return false;
                return true;
              }).slice(0, 8).map((section) => (
                <TouchableOpacity key={section.id} onPress={() => router.push(section.route as any)} style={styles.quickItem}>
                  <View style={[styles.quickIcon, { backgroundColor: `${section.color}15` }]}>
                    <MaterialIcons name={section.icon as any} size={20} color={section.color} />
                  </View>
                  <Text style={styles.quickLabel} numberOfLines={1}>{isAr ? section.titleAr : section.titleEn}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 16 },
  backBtn: { padding: 8, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.2)" },
  headerTitle: { fontSize: 18, fontWeight: "bold", color: "white" },
  searchContainer: { padding: 16 },
  searchInputWrapper: { flexDirection: "row", alignItems: "center", backgroundColor: "#f3f4f6", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, gap: 10, borderWidth: 1.5, borderColor: "#e5e7eb" },
  searchInput: { flex: 1, fontSize: 15, color: "#1f2937" },
  centerContainer: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
  emptyText: { fontSize: 16, fontWeight: "600", color: "#6b7280", marginTop: 16 },
  emptySubtext: { fontSize: 13, color: "#9ca3af", marginTop: 6 },
  listContent: { padding: 16, gap: 10 },
  resultCard: { flexDirection: "row", alignItems: "center", backgroundColor: "white", borderRadius: 14, padding: 14, gap: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1 },
  resultIcon: { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  resultContent: { flex: 1 },
  resultTitle: { fontSize: 14, fontWeight: "700", color: "#1f2937" },
  resultSubtitle: { fontSize: 12, color: "#9ca3af", marginTop: 2 },
  suggestionsContainer: { flex: 1, padding: 16 },
  recentSection: { marginBottom: 28 },
  recentHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  recentTitle: { fontSize: 14, fontWeight: "700", color: "#1f2937" },
  clearText: { fontSize: 12, color: "#ef4444", fontWeight: "600" },
  recentItem: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  recentItemText: { fontSize: 14, color: "#4b5563" },
  quickSection: { marginBottom: 20 },
  quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 12 },
  quickItem: { width: "22%", alignItems: "center", gap: 6 },
  quickIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  quickLabel: { fontSize: 10, color: "#4b5563", textAlign: "center", fontWeight: "500" },
});
