import { useState, useEffect, useCallback } from "react";
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
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { MaterialIcons } from "@expo/vector-icons";
import { useLanguage } from "@/lib/language-context";
import { BackButton } from "@/components/back-button";
import { boardDataService } from "@/lib/services/api.service";

interface BoardData {
  id: number;
  userId: number;
  dataType: string;
  value: string;
  description: string | null;
  date: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function BoardRepresentativeScreen() {
  const router = useRouter();
  const colors = useColors();
  const { language, t, isRtl } = useLanguage();
  const isAr = language === "ar";

  const CATEGORIES = [
    { id: "primary", label: isAr ? "بيانات أساسية" : "Primary Data", icon: "folder", color: "#3B82F6" },
    { id: "secondary", label: isAr ? "بيانات فرعية" : "Secondary Data", icon: "folder-open", color: "#10B981" },
    { id: "kpi", label: isAr ? "مؤشرات الأداء" : "KPIs", icon: "trending-up", color: "#F59E0B" },
    { id: "report", label: isAr ? "التقارير" : "Reports", icon: "assessment", color: "#8B5CF6" },
  ];

  const [activeTab, setActiveTab] = useState<"data" | "kpis" | "reports">("data");
  const [boardData, setBoardData] = useState<BoardData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [editingData, setEditingData] = useState<BoardData | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");

  const [formData, setFormData] = useState({
    dataType: "primary",
    value: "",
    description: "",
    date: new Date().toISOString().split("T")[0],
    notes: "",
  });

  // Load data from server
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const result = await boardDataService.getAll();
      if (result && Array.isArray(result)) {
        setBoardData(result);
      }
    } catch (e) {
      console.error("Error loading board data from server:", e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAddData = () => {
    setEditingData(null);
    setFormData({
      dataType: "primary",
      value: "",
      description: "",
      date: new Date().toISOString().split("T")[0],
      notes: "",
    });
    setShowModal(true);
  };

  const handleEditData = (data: BoardData) => {
    setEditingData(data);
    setFormData({
      dataType: data.dataType,
      value: data.value,
      description: data.description || "",
      date: data.date,
      notes: data.notes || "",
    });
    setShowModal(true);
  };

  const handleSaveData = async () => {
    if (!formData.value) {
      Alert.alert(t("error"), t("fill_all_fields"));
      return;
    }

    setIsSaving(true);
    try {
      if (editingData) {
        await boardDataService.update({
          id: editingData.id,
          value: formData.value,
          description: formData.description || undefined,
          notes: formData.notes || undefined,
        });
      } else {
        await boardDataService.save({
          userId: 1,
          dataType: formData.dataType,
          value: formData.value,
          description: formData.description || undefined,
          date: formData.date,
          notes: formData.notes || undefined,
        });
      }
      setShowModal(false);
      await loadData();
      Alert.alert(t("success"), t("saved_success"));
    } catch (e) {
      console.error("Error saving board data:", e);
      Alert.alert(t("error"), t("operation_failed"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteData = (id: number) => {
    Alert.alert(
      t("confirm_delete"),
      t("confirm_delete_msg"),
      [
        { text: t("cancel"), style: "cancel" },
        {
          text: t("delete"),
          style: "destructive",
          onPress: async () => {
            try {
              await boardDataService.delete(id);
              await loadData();
              Alert.alert(t("done"), t("deleted_success"));
            } catch (e) {
              Alert.alert(t("error"), t("operation_failed"));
            }
          },
        },
      ]
    );
  };

  const filteredData = boardData.filter(d => {
    const matchesCategory = !selectedCategory || d.dataType === selectedCategory;
    const matchesSearch = d.value.includes(searchText) || (d.description || "").includes(searchText);
    return matchesCategory && matchesSearch;
  });

  const renderDataCard = ({ item }: { item: BoardData }) => {
    const category = CATEGORIES.find(c => c.id === item.dataType);
    return (
      <View style={[styles.dataCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
            {category && <MaterialIcons name={category.icon as any} size={20} color={category.color} />}
            <Text style={[styles.dataTitle, { color: colors.foreground }]}>
              {category?.label}
            </Text>
          </View>
          <Text style={[styles.dataContent, { color: colors.foreground }]}>{item.value}</Text>
          {item.description && (
            <Text style={[styles.dataDesc, { color: colors.muted }]}>{item.description}</Text>
          )}
          <Text style={[styles.dataDate, { color: colors.muted, marginTop: 8 }]}>{item.date}</Text>
          {item.notes && (
            <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4, fontStyle: "italic" }}>{item.notes}</Text>
          )}
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

  if (isLoading) {
    return (
      <ScreenContainer>
        <View style={[styles.header, { backgroundColor: colors.primary }]}>
          <BackButton />
          <Text style={styles.headerTitle}>{t("board_representative")}</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ color: colors.muted, marginTop: 12 }}>{t("loading")}</Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <BackButton />
        <Text style={styles.headerTitle}>{t("board_representative")}</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Tabs */}
      <View style={[styles.tabsContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {[
          { id: "data", label: t("panel_data") },
          { id: "kpis", label: t("kpi") },
          { id: "reports", label: t("reports") },
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
          <View style={{ paddingHorizontal: 16, paddingVertical: 12, gap: 12 }}>
            <View style={[styles.searchContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <MaterialIcons name="search" size={20} color={colors.muted} />
              <TextInput
                style={[styles.searchInput, { color: colors.foreground }]}
                placeholder={t("search")}
                value={searchText}
                onChangeText={setSearchText}
                placeholderTextColor={colors.muted}
              />
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              <TouchableOpacity
                style={[styles.categoryBtn, { backgroundColor: !selectedCategory ? colors.primary : colors.surface, borderColor: colors.border }]}
                onPress={() => setSelectedCategory(null)}
              >
                <Text style={{ color: !selectedCategory ? "white" : colors.foreground, fontWeight: "600", fontSize: 12 }}>
                  {t("all")}
                </Text>
              </TouchableOpacity>
              {CATEGORIES.map(cat => (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.categoryBtn, { backgroundColor: selectedCategory === cat.id ? cat.color : colors.surface, borderColor: colors.border }]}
                  onPress={() => setSelectedCategory(cat.id)}
                >
                  <Text style={{ color: selectedCategory === cat.id ? "white" : colors.foreground, fontWeight: "600", fontSize: 12 }}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.primary }]} onPress={handleAddData}>
              <MaterialIcons name="add" size={20} color="white" />
              <Text style={{ color: "white", fontWeight: "600", marginLeft: 8 }}>
                {t("add_data")}
              </Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={filteredData}
            renderItem={renderDataCard}
            keyExtractor={item => item.id.toString()}
            contentContainerStyle={{ padding: 16, gap: 12 }}
            ListEmptyComponent={
              <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 40 }}>
                <MaterialIcons name="folder-open" size={48} color={colors.muted} />
                <Text style={{ color: colors.muted, marginTop: 12 }}>
                  {t("no_data")}
                </Text>
              </View>
            }
          />
        </>
      )}

      {/* KPIs Tab */}
      {activeTab === "kpis" && (
        <View style={{ flex: 1 }}>
          <FlatList
            data={boardData.filter(d => d.dataType === "kpi")}
            renderItem={renderDataCard}
            keyExtractor={item => item.id.toString()}
            contentContainerStyle={{ padding: 16, gap: 12 }}
            ListEmptyComponent={
              <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 40 }}>
                <MaterialIcons name="trending-up" size={48} color={colors.muted} />
                <Text style={{ color: colors.muted, marginTop: 12 }}>
                  {isAr ? "لا توجد مؤشرات - أضف من تبويب البيانات" : "No KPIs - add from Data tab"}
                </Text>
              </View>
            }
          />
        </View>
      )}

      {/* Reports Tab */}
      {activeTab === "reports" && (
        <View style={{ flex: 1 }}>
          <FlatList
            data={boardData.filter(d => d.dataType === "report")}
            renderItem={renderDataCard}
            keyExtractor={item => item.id.toString()}
            contentContainerStyle={{ padding: 16, gap: 12 }}
            ListEmptyComponent={
              <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 40 }}>
                <MaterialIcons name="assessment" size={48} color={colors.muted} />
                <Text style={{ color: colors.muted, marginTop: 12 }}>
                  {isAr ? "لا توجد تقارير - أضف من تبويب البيانات" : "No reports - add from Data tab"}
                </Text>
              </View>
            }
          />
        </View>
      )}

      {/* Add/Edit Modal */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: "bold" }}>
              {editingData ? (t("edit")) : (t("add_data"))}
            </Text>
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <MaterialIcons name="close" size={24} color={colors.muted} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
            {/* Category */}
            {!editingData && (
              <View>
                <Text style={{ color: colors.foreground, fontWeight: "600", marginBottom: 8 }}>
                  {isAr ? "الفئة" : "Category"}
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {CATEGORIES.map(cat => (
                    <TouchableOpacity
                      key={cat.id}
                      style={[styles.categorySelectBtn, { backgroundColor: formData.dataType === cat.id ? cat.color : colors.surface, borderColor: colors.border }]}
                      onPress={() => setFormData({ ...formData, dataType: cat.id })}
                    >
                      <Text style={{ color: formData.dataType === cat.id ? "white" : colors.foreground, fontSize: 12 }}>
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Value */}
            <View>
              <Text style={{ color: colors.foreground, fontWeight: "600", marginBottom: 8 }}>
                {isAr ? "القيمة / المحتوى" : "Value / Content"} *
              </Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground, minHeight: 80, textAlignVertical: "top" }]}
                placeholder={isAr ? "أدخل القيمة أو المحتوى" : "Enter value or content"}
                value={formData.value}
                onChangeText={(text) => setFormData({ ...formData, value: text })}
                placeholderTextColor={colors.muted}
                multiline
              />
            </View>

            {/* Description */}
            <View>
              <Text style={{ color: colors.foreground, fontWeight: "600", marginBottom: 8 }}>
                {t("description")}
              </Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
                placeholder={isAr ? "وصف مختصر (اختياري)" : "Brief description (optional)"}
                value={formData.description}
                onChangeText={(text) => setFormData({ ...formData, description: text })}
                placeholderTextColor={colors.muted}
              />
            </View>

            {/* Date */}
            {!editingData && (
              <View>
                <Text style={{ color: colors.foreground, fontWeight: "600", marginBottom: 8 }}>
                  {t("date")}
                </Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
                  placeholder="YYYY-MM-DD"
                  value={formData.date}
                  onChangeText={(text) => setFormData({ ...formData, date: text })}
                  placeholderTextColor={colors.muted}
                />
              </View>
            )}

            {/* Notes */}
            <View>
              <Text style={{ color: colors.foreground, fontWeight: "600", marginBottom: 8 }}>
                {t("notes")}
              </Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground, minHeight: 60, textAlignVertical: "top" }]}
                placeholder={isAr ? "ملاحظات إضافية (اختياري)" : "Additional notes (optional)"}
                value={formData.notes}
                onChangeText={(text) => setFormData({ ...formData, notes: text })}
                placeholderTextColor={colors.muted}
                multiline
              />
            </View>

            {/* Buttons */}
            <View style={{ flexDirection: "row", gap: 12, marginTop: 16 }}>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: colors.primary, flex: 1, opacity: isSaving ? 0.6 : 1 }]}
                onPress={handleSaveData}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={{ color: "white", fontWeight: "600", textAlign: "center" }}>
                    {t("save")}
                  </Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: colors.border, flex: 1 }]}
                onPress={() => setShowModal(false)}
              >
                <Text style={{ color: colors.foreground, fontWeight: "600", textAlign: "center" }}>
                  {t("cancel")}
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
    fontSize: 14,
    fontWeight: "bold",
    flex: 1,
  },
  dataContent: {
    fontSize: 15,
    fontWeight: "600",
  },
  dataDesc: {
    fontSize: 13,
    marginTop: 4,
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
  modalContainer: {
    flex: 1,
    paddingTop: 40,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
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
