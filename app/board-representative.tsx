import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { MaterialIcons } from "@expo/vector-icons";
import { useLanguage } from "@/lib/language-context";
import { BackButton } from "@/components/back-button";
import AsyncStorage from "@react-native-async-storage/async-storage";

const BOARD_STORAGE_KEY = "board_representative_data";
const BOARD_KPI_KEY = "board_representative_kpis";

interface BoardData {
  id: number;
  date: string;
  title: string;
  category: "primary" | "secondary" | "kpi" | "report";
  content: string;
  attachments?: string[];
  status: "active" | "archived";
  createdAt: string;
  updatedAt: string;
}

interface KPIData {
  id: number;
  name: string;
  targetValue: number;
  currentValue: number;
  unit: string;
  status: "on-track" | "at-risk" | "off-track";
}

const CATEGORIES = [
  { id: "primary", label: "بيانات أساسية", icon: "folder", color: "#3B82F6" },
  { id: "secondary", label: "بيانات فرعية", icon: "folder-open", color: "#10B981" },
  { id: "kpi", label: "مؤشرات الأداء", icon: "trending-up", color: "#F59E0B" },
  { id: "report", label: "التقارير", icon: "assessment", color: "#8B5CF6" },
];

export default function BoardRepresentativeScreen() {
  const router = useRouter();
  const colors = useColors();
  const { language } = useLanguage();
  const isAr = language === "ar";

  const [activeTab, setActiveTab] = useState<"data" | "kpis" | "reports">("data");
  const [boardData, setBoardData] = useState<BoardData[]>([]);
  const [kpis, setKpis] = useState<KPIData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load saved data from AsyncStorage
  useEffect(() => {
    const loadSavedData = async () => {
      try {
        const savedData = await AsyncStorage.getItem(BOARD_STORAGE_KEY);
        if (savedData) setBoardData(JSON.parse(savedData));
        const savedKpis = await AsyncStorage.getItem(BOARD_KPI_KEY);
        if (savedKpis) setKpis(JSON.parse(savedKpis));
      } catch (e) {
        console.error("Error loading board data:", e);
      } finally {
        setIsLoading(false);
      }
    };
    loadSavedData();
  }, []);

  // Save data whenever it changes
  const saveBoardData = async (data: BoardData[]) => {
    setBoardData(data);
    await AsyncStorage.setItem(BOARD_STORAGE_KEY, JSON.stringify(data));
  };

  const saveKpis = async (data: KPIData[]) => {
    setKpis(data);
    await AsyncStorage.setItem(BOARD_KPI_KEY, JSON.stringify(data));
  };

  const [showModal, setShowModal] = useState(false);
  const [editingData, setEditingData] = useState<BoardData | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");

  const [formData, setFormData] = useState<Partial<BoardData>>({
    title: "",
    category: "primary",
    content: "",
    status: "active",
  });

  const handleAddData = () => {
    setEditingData(null);
    setFormData({
      title: "",
      category: "primary",
      content: "",
      status: "active",
    });
    setShowModal(true);
  };

  const handleEditData = (data: BoardData) => {
    setEditingData(data);
    setFormData(data);
    setShowModal(true);
  };

  const handleSaveData = async () => {
    if (!formData.title || !formData.content) {
      Alert.alert(isAr ? "خطأ" : "Error", isAr ? "الرجاء ملء البيانات المطلوبة" : "Please fill required fields");
      return;
    }

    if (editingData) {
      const updated = boardData.map(d =>
        d.id === editingData.id
          ? { ...editingData, ...formData, updatedAt: new Date().toISOString() }
          : d
      ) as BoardData[];
      await saveBoardData(updated);
    } else {
      const newData: BoardData = {
        id: Math.max(...boardData.map(d => d.id), 0) + 1,
        date: new Date().toISOString().split("T")[0],
        title: formData.title || "",
        category: (formData.category || "primary") as any,
        content: formData.content || "",
        status: "active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await saveBoardData([...boardData, newData]);
    }
    setShowModal(false);
    Alert.alert(isAr ? "نجح" : "Success", isAr ? "تم حفظ البيانات" : "Data saved successfully");
  };

  const handleDeleteData = (id: number) => {
    Alert.alert(
      isAr ? "تأكيد الحذف" : "Confirm Delete",
      isAr ? "هل أنت متأكد من حذف هذه البيانات؟" : "Are you sure?",
      [
        { text: isAr ? "إلغاء" : "Cancel", style: "cancel" },
        {
          text: isAr ? "حذف" : "Delete",
          style: "destructive",
          onPress: async () => {
            const updated = boardData.filter(d => d.id !== id);
            await saveBoardData(updated);
            Alert.alert(isAr ? "تم" : "Done", isAr ? "تم حذف البيانات" : "Data deleted");
          },
        },
      ]
    );
  };

  const filteredData = boardData.filter(d => {
    const matchesCategory = !selectedCategory || d.category === selectedCategory;
    const matchesSearch = d.title.includes(searchText) || d.content.includes(searchText);
    return matchesCategory && matchesSearch;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "on-track":
        return "#10B981";
      case "at-risk":
        return "#F59E0B";
      case "off-track":
        return "#EF4444";
      default:
        return colors.muted;
    }
  };

  const renderDataCard = ({ item }: { item: BoardData }) => {
    const category = CATEGORIES.find(c => c.id === item.category);
    return (
      <View style={[styles.dataCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
            {category && <MaterialIcons name={category.icon as any} size={20} color={category.color} />}
            <Text style={[styles.dataTitle, { color: colors.foreground }]}>{item.title}</Text>
          </View>
          <Text style={[styles.dataContent, { color: colors.muted }]}>{item.content}</Text>
          <Text style={[styles.dataDate, { color: colors.muted, marginTop: 8 }]}>{item.date}</Text>
        </View>
        <View style={{ gap: 8, marginLeft: 12 }}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.primary }]}
            onPress={() => handleEditData(item)}
          >
            <MaterialIcons name="edit" size={18} color="white" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: "#EF4444" }]}
            onPress={() => handleDeleteData(item.id)}
          >
            <MaterialIcons name="delete" size={18} color="white" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderKPICard = ({ item }: { item: KPIData }) => {
    const progress = (item.currentValue / item.targetValue) * 100;
    return (
      <View style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.kpiName, { color: colors.foreground }]}>{item.name}</Text>
          <View style={{ marginTop: 8, gap: 4 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {item.currentValue} / {item.targetValue} {item.unit}
              </Text>
              <Text style={{ color: getStatusColor(item.status), fontWeight: "600", fontSize: 12 }}>
                {progress.toFixed(0)}%
              </Text>
            </View>
            <View style={[styles.progressBar, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <View
                style={{
                  height: "100%",
                  width: `${Math.min(progress, 100)}%`,
                  backgroundColor: getStatusColor(item.status),
                  borderRadius: 4,
                }}
              />
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <BackButton />
        <Text style={styles.headerTitle}>{isAr ? "ممثل مجلس الإدارة" : "Board Representative"}</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Tabs */}
      <View style={[styles.tabsContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {[
          { id: "data", label: isAr ? "البيانات" : "Data" },
          { id: "kpis", label: isAr ? "مؤشرات الأداء" : "KPIs" },
          { id: "reports", label: isAr ? "التقارير" : "Reports" },
        ].map(tab => (
          <TouchableOpacity
            key={tab.id}
            style={[
              styles.tab,
              {
                borderBottomColor: activeTab === tab.id ? colors.primary : "transparent",
                borderBottomWidth: activeTab === tab.id ? 3 : 0,
              },
            ]}
            onPress={() => setActiveTab(tab.id as any)}
          >
            <Text
              style={{
                color: activeTab === tab.id ? colors.primary : colors.muted,
                fontWeight: activeTab === tab.id ? "700" : "600",
              }}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Data Tab */}
      {activeTab === "data" && (
        <>
          {/* Search and Add Button */}
          <View style={{ paddingHorizontal: 16, paddingVertical: 12, gap: 12 }}>
            <View style={[styles.searchContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <MaterialIcons name="search" size={20} color={colors.muted} />
              <TextInput
                style={[styles.searchInput, { color: colors.foreground }]}
                placeholder={isAr ? "ابحث..." : "Search..."}
                value={searchText}
                onChangeText={setSearchText}
                placeholderTextColor={colors.muted}
              />
            </View>

            {/* Category Filter */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ gap: 8 }} contentContainerStyle={{ gap: 8 }}>
              <TouchableOpacity
                style={[
                  styles.categoryBtn,
                  {
                    backgroundColor: !selectedCategory ? colors.primary : colors.surface,
                    borderColor: colors.border,
                  },
                ]}
                onPress={() => setSelectedCategory(null)}
              >
                <Text style={{ color: !selectedCategory ? "white" : colors.foreground, fontWeight: "600", fontSize: 12 }}>
                  {isAr ? "الكل" : "All"}
                </Text>
              </TouchableOpacity>
              {CATEGORIES.map(cat => (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.categoryBtn,
                    {
                      backgroundColor: selectedCategory === cat.id ? cat.color : colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                  onPress={() => setSelectedCategory(cat.id)}
                >
                  <Text style={{ color: selectedCategory === cat.id ? "white" : colors.foreground, fontWeight: "600", fontSize: 12 }}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={[styles.addBtn, { backgroundColor: colors.primary }]}
              onPress={handleAddData}
            >
              <MaterialIcons name="add" size={20} color="white" />
              <Text style={{ color: "white", fontWeight: "600", marginLeft: 8 }}>
                {isAr ? "إضافة بيانات" : "Add Data"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Data List */}
          <FlatList
            data={filteredData}
            renderItem={renderDataCard}
            keyExtractor={item => item.id.toString()}
            contentContainerStyle={{ padding: 16, gap: 12 }}
            ListEmptyComponent={
              <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 40 }}>
                <MaterialIcons name="folder-open" size={48} color={colors.muted} />
                <Text style={{ color: colors.muted, marginTop: 12 }}>
                  {isAr ? "لا توجد بيانات" : "No data found"}
                </Text>
              </View>
            }
          />
        </>
      )}

      {/* KPIs Tab */}
      {activeTab === "kpis" && (
        <FlatList
          data={kpis}
          renderItem={renderKPICard}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          ListEmptyComponent={
            <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 40 }}>
              <MaterialIcons name="trending-up" size={48} color={colors.muted} />
              <Text style={{ color: colors.muted, marginTop: 12 }}>
                {isAr ? "لا توجد مؤشرات" : "No KPIs found"}
              </Text>
            </View>
          }
        />
      )}

      {/* Reports Tab */}
      {activeTab === "reports" && (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <MaterialIcons name="assessment" size={48} color={colors.muted} />
          <Text style={{ color: colors.foreground, marginTop: 12, fontWeight: "600" }}>
            {isAr ? "التقارير" : "Reports"}
          </Text>
          <Text style={{ color: colors.muted, marginTop: 8 }}>
            {isAr ? "سيتم إضافة التقارير قريباً" : "Reports coming soon"}
          </Text>
        </View>
      )}

      {/* Add/Edit Modal */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
            {/* Title */}
            <View>
              <Text style={{ color: colors.foreground, fontWeight: "600", marginBottom: 8 }}>
                {isAr ? "العنوان" : "Title"} *
              </Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
                placeholder={isAr ? "أدخل العنوان" : "Enter title"}
                value={formData.title}
                onChangeText={(text) => setFormData({ ...formData, title: text })}
              />
            </View>

            {/* Category */}
            <View>
              <Text style={{ color: colors.foreground, fontWeight: "600", marginBottom: 8 }}>
                {isAr ? "الفئة" : "Category"}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ gap: 8 }} contentContainerStyle={{ gap: 8 }}>
                {CATEGORIES.map(cat => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.categorySelectBtn,
                      {
                        backgroundColor: formData.category === cat.id ? cat.color : colors.surface,
                        borderColor: colors.border,
                      },
                    ]}
                    onPress={() => setFormData({ ...formData, category: cat.id as any })}
                  >
                    <Text style={{ color: formData.category === cat.id ? "white" : colors.foreground, fontSize: 12 }}>
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Content */}
            <View>
              <Text style={{ color: colors.foreground, fontWeight: "600", marginBottom: 8 }}>
                {isAr ? "المحتوى" : "Content"} *
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    color: colors.foreground,
                    minHeight: 120,
                    textAlignVertical: "top",
                  },
                ]}
                placeholder={isAr ? "أدخل المحتوى" : "Enter content"}
                value={formData.content}
                onChangeText={(text) => setFormData({ ...formData, content: text })}
                multiline
              />
            </View>

            {/* Buttons */}
            <View style={{ flexDirection: "row", gap: 12, marginTop: 16 }}>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: colors.primary, flex: 1 }]}
                onPress={handleSaveData}
              >
                <Text style={{ color: "white", fontWeight: "600", textAlign: "center" }}>
                  {isAr ? "حفظ" : "Save"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: colors.border, flex: 1 }]}
                onPress={() => setShowModal(false)}
              >
                <Text style={{ color: colors.foreground, fontWeight: "600", textAlign: "center" }}>
                  {isAr ? "إلغاء" : "Cancel"}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  tabsContainer: {
    flexDirection: "row",
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
  },
  categoryBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 8,
  },
  dataCard: {
    flexDirection: "row",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    alignItems: "flex-start",
  },
  dataTitle: {
    fontSize: 16,
    fontWeight: "bold",
    flex: 1,
  },
  dataContent: {
    fontSize: 14,
  },
  dataDate: {
    fontSize: 12,
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  kpiCard: {
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    marginHorizontal: 16,
    marginVertical: 6,
  },
  kpiName: {
    fontSize: 16,
    fontWeight: "bold",
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    overflow: "hidden",
  },
  modalContainer: {
    flex: 1,
    paddingTop: 40,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  categorySelectBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  btn: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
});
