import React, { useState, useEffect } from "react";
import { BackButton } from "@/components/back-button";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { MaterialIcons } from "@expo/vector-icons";
import { AdminBadgeIcon } from "@/components/admin-badge-icon";
import { AdminCard } from "@/components/admin-card";
import { useLanguage } from "@/lib/language-context";
import { useAuth } from "@/lib/auth-context";
import { manufacturingWorkersService } from "@/lib/services/api.service";

interface ManufacturingStage {
  id: string;
  label: string;
  icon: string;
  color: string;
  workers: string[];
}

const MANUFACTURING_STAGE_IDS = ["machines", "rosso", "qalb", "kawiya", "inspection", "packing", "antislip", "storage"];

// Default stage config (used as fallback if server has no workers)
const DEFAULT_STAGES = {
  machines: { labelAr: "إنتاج المكائن", labelEn: "Machine Production", icon: "precision-manufacturing", color: "#0a7ea4", workersAr: ["رنا", "محمد احمد", "أفضل", "عطالله", "شفيق"], workersEn: ["Rana", "Mohammed Ahmed", "Afzal", "Atallah", "Shafiq"] },
  rosso: { labelAr: "الروسو", labelEn: "Rosso", icon: "loop", color: "#7c3aed", workersAr: ["فريدو", "قيوم"], workersEn: ["Fredo", "Qayyum"] },
  qalb: { labelAr: "القلب", labelEn: "Turning", icon: "flip", color: "#059669", workersAr: ["حسين السوري"], workersEn: ["Hussein Al-Suri"] },
  kawiya: { labelAr: "الكاوية", labelEn: "Ironing", icon: "local-fire-department", color: "#dc2626", workersAr: ["جنيد"], workersEn: ["Junaid"] },
  inspection: { labelAr: "الفحص", labelEn: "Inspection", icon: "search", color: "#d97706", workersAr: ["عارف", "انام الدين"], workersEn: ["Aref", "Anamuddin"] },
  packing: { labelAr: "التغليف", labelEn: "Packing", icon: "inventory-2", color: "#2563eb", workersAr: ["محمد عمر", "غلام", "بشير"], workersEn: ["Mohammed Omar", "Ghulam", "Bashir"] },
  antislip: { labelAr: "مانع الانزلاق", labelEn: "Anti-slip", icon: "layers", color: "#0891b2", workersAr: ["محمد عمر", "مرتضى", "أوجيل"], workersEn: ["Mohammed Omar", "Murtadha", "Ogil"] },
  storage: { labelAr: "التخزين", labelEn: "Storage", icon: "warehouse", color: "#4f46e5", workersAr: ["شميم"], workersEn: ["Shamim"] },
};

export default function ManufacturingScreen() {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const router = useRouter();
  const colors = useColors();
  const { user } = useAuth();
  const [stages, setStages] = useState<ManufacturingStage[]>([]);
  const [loading, setLoading] = useState(true);

  // إذا كان الموظف مسجل في مرحلة معينة، يتم توجيهه مباشرة لقسمه
  useEffect(() => {
    if (user && user.role !== "admin" && user.department && MANUFACTURING_STAGE_IDS.includes(user.department)) {
      router.replace(`/manufacturing-stage?stage=${user.department}` as any);
    }
  }, [user]);

  // Load workers from server
  useEffect(() => {
    const loadWorkers = async () => {
      try {
        const allWorkers = await manufacturingWorkersService.list();
        // Group workers by stageId
        const workersByStage: Record<string, string[]> = {};
        if (allWorkers && Array.isArray(allWorkers)) {
          allWorkers.forEach((w: any) => {
            if (!workersByStage[w.stageId]) {
              workersByStage[w.stageId] = [];
            }
            workersByStage[w.stageId].push(w.workerName);
          });
        }

        // Build stages array
        const builtStages: ManufacturingStage[] = MANUFACTURING_STAGE_IDS.map((id) => {
          const def = DEFAULT_STAGES[id as keyof typeof DEFAULT_STAGES];
          const serverWorkers = workersByStage[id];
          const workers = serverWorkers && serverWorkers.length > 0
            ? serverWorkers
            : (isAr ? def.workersAr : def.workersEn);
          return {
            id,
            label: isAr ? def.labelAr : def.labelEn,
            icon: def.icon,
            color: def.color,
            workers,
          };
        });
        setStages(builtStages);
      } catch (e) {
        console.log("Error loading workers from server:", e);
        // Fallback to defaults
        const builtStages: ManufacturingStage[] = MANUFACTURING_STAGE_IDS.map((id) => {
          const def = DEFAULT_STAGES[id as keyof typeof DEFAULT_STAGES];
          return {
            id,
            label: isAr ? def.labelAr : def.labelEn,
            icon: def.icon,
            color: def.color,
            workers: isAr ? def.workersAr : def.workersEn,
          };
        });
        setStages(builtStages);
      } finally {
        setLoading(false);
      }
    };
    loadWorkers();
  }, [isAr]);

  const handleStagePress = (stageId: string) => {
    router.push(`/manufacturing-stage?stage=${stageId}` as any);
  };

  return (
    <ScreenContainer style={{ backgroundColor: colors.background }}>
      {/* رأس الصفحة */}
      <View style={{ backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <AdminBadgeIcon />
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={{ color: '#ffffff', fontWeight: 'bold', fontSize: 20 }}>{isAr ? "مراحل التصنيع" : "Manufacturing Stages"}</Text>
          <Text style={{ fontSize: 14, marginTop: 4 }}>{isAr ? "اختر مرحلة لعرض وإدخال بيانات العمال" : "Select a stage to view and enter workers data"}</Text>
        </View>
        <BackButton />
      </View>

      {/* أدوات التصنيع المختصرة */}
      <View style={{ marginHorizontal: 16, marginTop: 12, flexDirection: "row", justifyContent: "flex-end", alignItems: "center" }}>
        <TouchableOpacity
          onPress={() => router.push("/product-tracking" as any)}
          accessibilityLabel={isAr ? "تتبع المنتجات" : "Product tracking"}
          style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: "#e0f2fe", borderWidth: 1, borderColor: "#0284c7", alignItems: "center", justifyContent: "center" }}
        >
          <MaterialIcons name="timeline" size={26} color="#0284c7" />
        </TouchableOpacity>
        <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: "700", marginRight: 8 }}>{isAr ? "تتبع المنتجات" : "Product tracking"}</Text>
      </View>

      {/* بطاقة الإجراءات الإدارية - كبيرة وواضحة */}
      <AdminCard />

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView style={{ flex: 1, paddingHorizontal: 16, paddingVertical: 16 }}>
          {stages.map((stage) => (
            <TouchableOpacity
              key={stage.id}
              onPress={() => handleStagePress(stage.id)}
              style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.border }}
              activeOpacity={0.7}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <MaterialIcons name="chevron-left" size={24} color={colors.muted} />
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Text style={{ color: colors.foreground, fontWeight: 'bold', fontSize: 16, textAlign: 'right' }}>{stage.label}</Text>
                  <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4, textAlign: 'right' }}>
                    {isAr ? "العمال: " : "Workers: "}{stage.workers.join(isAr ? "، " : ", ")}
                  </Text>
                </View>
                <View style={{ backgroundColor: `${stage.color}20`, borderRadius: 12, padding: 12 }}>
                  <MaterialIcons name={stage.icon as any} size={26} color={stage.color} />
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </ScreenContainer>
  );
}
