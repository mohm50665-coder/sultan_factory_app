import { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useLanguage } from "@/lib/language-context";
import { MaterialIcons } from "@expo/vector-icons";
import { BackButton } from "@/components/back-button";
import { productionCostsLocalService } from "@/lib/services/api.service";

interface CostData {
  id: string;
  date: string;
  rawMaterials: {
    yarn: number;
    rubber: number;
    spandex: number;
    nylon: number;
    cotton: number;
    bamboo: number;
    span: number;
  };
  labor: number;
  utilities: number;
  maintenance: number;
  other: number;
  notes: string;
}

interface CostSummary {
  totalCost: number;
  costPerUnit: number;
  costPerDozen: number;
  rawMaterialCost: number;
  laborCost: number;
  utilitiesCost: number;
  maintenanceCost: number;
  otherCost: number;
}

export default function ProductionCostsScreen() {
  const router = useRouter();
  const colors = useColors();
  const { t, language, isRtl } = useLanguage();
  const isAr = language === "ar";

  const [costs, setCosts] = useState<CostData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [summary, setSummary] = useState<CostSummary | null>(null);

  const [formData, setFormData] = useState<CostData>({
    id: "",
    date: new Date().toISOString().split("T")[0],
    rawMaterials: {
      yarn: 0,
      rubber: 0,
      spandex: 0,
      nylon: 0,
      cotton: 0,
      bamboo: 0,
      span: 0,
    },
    labor: 0,
    utilities: 0,
    maintenance: 0,
    other: 0,
    notes: "",
  });

  useEffect(() => {
    loadCosts();
  }, []);

  const loadCosts = async () => {
    try {
      setIsLoading(true);
      const data = await productionCostsLocalService.list();
      if (data && Array.isArray(data)) {
        const parsed = data.map((item: any) => {
          const details = item.details ? (typeof item.details === "string" ? JSON.parse(item.details) : item.details) : {};
          return {
            id: String(item.id),
            date: details.date || item.month || "",
            rawMaterials: details.rawMaterials || { yarn: 0, rubber: 0, spandex: 0, nylon: 0, cotton: 0, bamboo: 0, span: 0 },
            labor: details.labor || 0,
            utilities: details.utilities || 0,
            maintenance: details.maintenance || 0,
            other: details.other || 0,
            notes: details.notes || "",
          };
        });
        setCosts(parsed);
        calculateSummary(parsed);
      }
    } catch (error) {
      console.error("Error loading costs:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateSummary = (costsList: CostData[]) => {
    if (costsList.length === 0) return;

    const today = new Date().toISOString().split("T")[0];
    const todaysCosts = costsList.filter((c) => c.date === today);

    if (todaysCosts.length === 0) return;

    const totalRawMaterial = todaysCosts.reduce(
      (sum, c) =>
        sum +
        Object.values(c.rawMaterials).reduce((a, b) => a + b, 0),
      0
    );
    const totalLabor = todaysCosts.reduce((sum, c) => sum + c.labor, 0);
    const totalUtilities = todaysCosts.reduce((sum, c) => sum + c.utilities, 0);
    const totalMaintenance = todaysCosts.reduce((sum, c) => sum + c.maintenance, 0);
    const totalOther = todaysCosts.reduce((sum, c) => sum + c.other, 0);

    const totalCost = totalRawMaterial + totalLabor + totalUtilities + totalMaintenance + totalOther;

    setSummary({
      totalCost,
      costPerUnit: totalCost / 1000, // تقدير
      costPerDozen: (totalCost / 1000) * 12,
      rawMaterialCost: totalRawMaterial,
      laborCost: totalLabor,
      utilitiesCost: totalUtilities,
      maintenanceCost: totalMaintenance,
      otherCost: totalOther,
    });
  };

  const handleSave = async () => {
    if (!formData.date) {
      if (Platform.OS === "web") {
        window.alert(isAr ? "يرجى إدخال التاريخ" : "Please enter date");
      }
      return;
    }

    try {
      setIsLoading(true);
      const entryData = editingId ? formData : { ...formData, id: Date.now().toString() };
      const serverPayload = {
        month: formData.date,
        year: new Date().getFullYear(),
        category: "production",
        details: JSON.stringify(entryData),
      };
      if (editingId) {
        await productionCostsLocalService.update(Number(editingId), serverPayload);
      } else {
        await productionCostsLocalService.create(serverPayload);
      }
      await loadCosts();
      resetForm();
      setShowForm(false);
    } catch (error) {
      console.error("Error saving:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await productionCostsLocalService.delete(Number(id));
      const updatedCosts = costs.filter((c) => c.id !== id);
      setCosts(updatedCosts);
      calculateSummary(updatedCosts);
    } catch (error) {
      console.error("Error deleting:", error);
    }
  };

  const resetForm = () => {
    setFormData({
      id: "",
      date: new Date().toISOString().split("T")[0],
      rawMaterials: {
        yarn: 0,
        rubber: 0,
        spandex: 0,
        nylon: 0,
        cotton: 0,
        bamboo: 0,
        span: 0,
      },
      labor: 0,
      utilities: 0,
      maintenance: 0,
      other: 0,
      notes: "",
    });
    setEditingId(null);
  };

  if (isLoading) {
    return (
      <ScreenContainer>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <BackButton />
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 16 }}>
        <Text style={{ fontSize: 24, fontWeight: "bold", color: colors.foreground, marginBottom: 16, textAlign: isRtl ? "right" : "left" }}>
          {isAr ? "حساب التكاليف" : "Cost Calculation"}
        </Text>

        {/* Summary Card */}
        {summary && (
          <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ fontSize: 16, fontWeight: "bold", color: colors.foreground, marginBottom: 12 }}>
              {isAr ? "ملخص التكاليف اليومي" : "Daily Cost Summary"}
            </Text>
            <View style={{ gap: 8 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: colors.muted }}>{isAr ? "إجمالي التكاليف" : "Total Cost"}</Text>
                <Text style={{ color: colors.foreground, fontWeight: "bold" }}>
                  {summary.totalCost.toFixed(2)} {isAr ? "ريال" : "SAR"}
                </Text>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: colors.muted }}>{isAr ? "المواد الخام" : "Raw Materials"}</Text>
                <Text style={{ color: colors.foreground }}>{summary.rawMaterialCost.toFixed(2)}</Text>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: colors.muted }}>{isAr ? "الأجور" : "Labor"}</Text>
                <Text style={{ color: colors.foreground }}>{summary.laborCost.toFixed(2)}</Text>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: colors.muted }}>{isAr ? "المرافق" : "Utilities"}</Text>
                <Text style={{ color: colors.foreground }}>{summary.utilitiesCost.toFixed(2)}</Text>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: colors.muted }}>{isAr ? "التكلفة لكل وحدة" : "Cost Per Unit"}</Text>
                <Text style={{ color: colors.foreground, fontWeight: "bold" }}>
                  {summary.costPerUnit.toFixed(2)}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Add Button */}
        <TouchableOpacity
          onPress={() => {
            resetForm();
            setShowForm(true);
          }}
          style={{ backgroundColor: colors.primary, borderRadius: 8, padding: 12, marginBottom: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}
        >
          <MaterialIcons name="add" size={20} color="white" />
          <Text style={{ color: "white", fontWeight: "bold" }}>
            {isAr ? "إضافة تكاليف" : "Add Costs"}
          </Text>
        </TouchableOpacity>

        {/* Costs List */}
        {costs.map((cost) => (
          <View key={cost.id} style={{ backgroundColor: colors.surface, borderRadius: 8, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: colors.border }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <Text style={{ fontWeight: "bold", color: colors.foreground }}>
                {cost.date}
              </Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TouchableOpacity
                  onPress={() => {
                    setFormData(cost);
                    setEditingId(cost.id);
                    setShowForm(true);
                  }}
                >
                  <MaterialIcons name="edit" size={20} color={colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(cost.id)}>
                  <MaterialIcons name="delete" size={20} color="#ef4444" />
                </TouchableOpacity>
              </View>
            </View>
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              {isAr ? "إجمالي: " : "Total: "}
              {(Object.values(cost.rawMaterials).reduce((a, b) => a + b, 0) +
                cost.labor +
                cost.utilities +
                cost.maintenance +
                cost.other).toFixed(2)}{" "}
              {isAr ? "ريال" : "SAR"}
            </Text>
          </View>
        ))}

        {/* Form Modal */}
        {showForm && (
          <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ fontSize: 18, fontWeight: "bold", color: colors.foreground, marginBottom: 12 }}>
              {editingId ? (isAr ? "تعديل التكاليف" : "Edit Costs") : (isAr ? "إضافة تكاليف جديدة" : "Add New Costs")}
            </Text>

            {/* Date Input */}
            <View style={{ marginBottom: 12 }}>
              <Text style={{ color: colors.foreground, marginBottom: 4 }}>
                {isAr ? "التاريخ" : "Date"}
              </Text>
              <TextInput
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 8,
                  padding: 8,
                  color: colors.foreground,
                  backgroundColor: colors.background,
                }}
                value={formData.date}
                onChangeText={(text) =>
                  setFormData({ ...formData, date: text })
                }
                placeholder="YYYY-MM-DD"
              />
            </View>

            {/* Raw Materials */}
            <Text style={{ color: colors.foreground, fontWeight: "bold", marginBottom: 8 }}>
              {isAr ? "المواد الخام" : "Raw Materials"}
            </Text>
            {Object.entries(formData.rawMaterials).map(([key, value]) => (
              <View key={key} style={{ marginBottom: 8 }}>
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  {key.charAt(0).toUpperCase() + key.slice(1)}
                </Text>
                <TextInput
                  style={{
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 8,
                    padding: 8,
                    color: colors.foreground,
                    backgroundColor: colors.background,
                  }}
                  value={value.toString()}
                  onChangeText={(text) =>
                    setFormData({
                      ...formData,
                      rawMaterials: {
                        ...formData.rawMaterials,
                        [key]: parseFloat(text) || 0,
                      },
                    })
                  }
                  keyboardType="decimal-pad"
                  placeholder="0"
                />
              </View>
            ))}

            {/* Other Costs */}
            {[
              { key: "labor", label: isAr ? "الأجور" : "Labor" },
              { key: "utilities", label: isAr ? "المرافق" : "Utilities" },
              { key: "maintenance", label: isAr ? "الصيانة" : "Maintenance" },
              { key: "other", label: isAr ? "أخرى" : "Other" },
            ].map(({ key, label }) => (
              <View key={key} style={{ marginBottom: 8 }}>
                <Text style={{ color: colors.muted, fontSize: 12 }}>{label}</Text>
                <TextInput
                  style={{
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 8,
                    padding: 8,
                    color: colors.foreground,
                    backgroundColor: colors.background,
                  }}
                  value={formData[key as keyof CostData].toString()}
                  onChangeText={(text) =>
                    setFormData({
                      ...formData,
                      [key]: parseFloat(text) || 0,
                    })
                  }
                  keyboardType="decimal-pad"
                  placeholder="0"
                />
              </View>
            ))}

            {/* Notes */}
            <View style={{ marginBottom: 12 }}>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {isAr ? "ملاحظات" : "Notes"}
              </Text>
              <TextInput
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 8,
                  padding: 8,
                  color: colors.foreground,
                  backgroundColor: colors.background,
                  minHeight: 60,
                }}
                value={formData.notes}
                onChangeText={(text) =>
                  setFormData({ ...formData, notes: text })
                }
                multiline
                placeholder={isAr ? "أضف ملاحظات..." : "Add notes..."}
              />
            </View>

            {/* Buttons */}
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TouchableOpacity
                onPress={handleSave}
                style={{
                  flex: 1,
                  backgroundColor: colors.primary,
                  borderRadius: 8,
                  padding: 12,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: "white", fontWeight: "bold" }}>
                  {isAr ? "حفظ" : "Save"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setShowForm(false);
                  resetForm();
                }}
                style={{
                  flex: 1,
                  backgroundColor: colors.border,
                  borderRadius: 8,
                  padding: 12,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: colors.foreground, fontWeight: "bold" }}>
                  {isAr ? "إلغاء" : "Cancel"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
