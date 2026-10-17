import React, { useMemo, useState } from "react";
import { MaterialIcons } from "@expo/vector-icons";
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import {
  findMaintenanceMachine,
  MAINTENANCE_MACHINE_INVENTORY,
  maintenanceMachineLabel,
  type MaintenanceMachineOption,
} from "@/lib/constants/maintenance-machine-inventory";

export type StoredMaintenanceMachine = Pick<MaintenanceMachineOption, "code" | "nameAr" | "nameEn" | "locationAr" | "locationEn">;

type Props = {
  value: StoredMaintenanceMachine[];
  onChange: (items: StoredMaintenanceMachine[]) => void;
  language: "ar" | "en";
  borderColor: string;
  foreground: string;
  muted: string;
  primary: string;
  surface: string;
};

export function normalizeStoredMaintenanceMachines(value: unknown, legacyText?: string): StoredMaintenanceMachine[] {
  const direct = Array.isArray(value)
    ? value
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const code = String((item as { code?: unknown }).code || "").trim();
        const found = findMaintenanceMachine(code);
        return found || (code ? {
          code,
          nameAr: String((item as { nameAr?: unknown }).nameAr || (item as { name?: unknown }).name || code),
          nameEn: String((item as { nameEn?: unknown }).nameEn || (item as { name?: unknown }).name || code),
          locationAr: String((item as { locationAr?: unknown }).locationAr || ""),
          locationEn: String((item as { locationEn?: unknown }).locationEn || ""),
        } : null);
      })
      .filter(Boolean) as StoredMaintenanceMachine[]
    : [];

  if (direct.length) return uniqueByCode(direct);

  const legacy = String(legacyText || "").trim();
  if (!legacy) return [];
  return uniqueByCode(MAINTENANCE_MACHINE_INVENTORY.filter((machine) =>
    legacy.includes(machine.code) || legacy.includes(machine.nameAr) || legacy.toLowerCase().includes(machine.nameEn.toLowerCase()),
  ));
}

export function serializeMaintenanceMachines(items: StoredMaintenanceMachine[], language: "ar" | "en" = "ar") {
  return uniqueByCode(items).map((item) => maintenanceMachineLabel(item, language)).join("، ");
}

function uniqueByCode(items: StoredMaintenanceMachine[]) {
  return Array.from(new Map(items.map((item) => [item.code, item])).values());
}

export function MaintenanceMachineSelector({ value, onChange, language, borderColor, foreground, muted, primary, surface }: Props) {
  const [query, setQuery] = useState("");
  const isAr = language === "ar";
  const selectedCodes = new Set(value.map((item) => item.code));
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return MAINTENANCE_MACHINE_INVENTORY;
    return MAINTENANCE_MACHINE_INVENTORY.filter((item) => [item.code, item.nameAr, item.nameEn, item.locationAr, item.locationEn]
      .some((part) => part.toLowerCase().includes(normalized)));
  }, [query]);

  const toggle = (option: MaintenanceMachineOption) => {
    if (selectedCodes.has(option.code)) {
      onChange(value.filter((item) => item.code !== option.code));
      return;
    }
    onChange(uniqueByCode([...value, option]));
  };

  return (
    <View style={[styles.container, { borderColor }]}> 
      <View style={styles.toolbar}>
        <Text style={[styles.helper, { color: muted }]}>{isAr ? "ابحث بالرمز أو الاسم أو الموقع، ثم اختر أكثر من ماكينة عند الحاجة." : "Search by code, name, or location, then select one or more machines."}</Text>
        {value.length > 0 ? (
          <TouchableOpacity onPress={() => onChange([])} style={styles.clearButton} accessibilityRole="button">
            <MaterialIcons name="clear-all" size={16} color="#b91c1c" />
            <Text style={styles.clearText}>{isAr ? "إزالة الكل" : "Clear all"}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {value.length > 0 ? (
        <View style={styles.selectedWrap}>
          {value.map((item) => (
            <TouchableOpacity key={item.code} onPress={() => onChange(value.filter((selected) => selected.code !== item.code))} style={[styles.selectedChip, { borderColor: primary, backgroundColor: `${primary}12` }]} accessibilityRole="button">
              <MaterialIcons name="close" size={15} color={primary} />
              <Text style={[styles.selectedText, { color: foreground }]} numberOfLines={1}>{maintenanceMachineLabel(item, language)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : (
        <Text style={[styles.emptySelection, { color: muted }]}>{isAr ? "لم يتم اختيار أي ماكينة بعد" : "No machine selected yet"}</Text>
      )}

      <View style={[styles.searchBox, { borderColor, backgroundColor: surface }]}>
        <MaterialIcons name="search" size={20} color={muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={isAr ? "اكتب رمز الماكينة أو اسمها" : "Type machine code or name"}
          placeholderTextColor={muted}
          style={[styles.searchInput, { color: foreground, textAlign: isAr ? "right" : "left" }]}
          accessibilityLabel={isAr ? "بحث في قائمة الماكينات" : "Search machine inventory"}
        />
      </View>

      <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={[styles.optionsList, { borderColor }]} contentContainerStyle={styles.optionsContent}>
        {filtered.map((option) => {
          const selected = selectedCodes.has(option.code);
          return (
            <TouchableOpacity key={option.code} onPress={() => toggle(option)} style={[styles.option, { borderColor: selected ? primary : borderColor, backgroundColor: selected ? `${primary}12` : "transparent" }]} accessibilityRole="checkbox" accessibilityState={{ checked: selected }}>
              <View style={[styles.check, { borderColor: selected ? primary : borderColor, backgroundColor: selected ? primary : "transparent" }]}>
                {selected ? <MaterialIcons name="check" size={15} color="#fff" /> : null}
              </View>
              <View style={styles.optionCopy}>
                <Text style={[styles.optionTitle, { color: foreground }]}>{option.code} · {isAr ? option.nameAr : option.nameEn}</Text>
                <Text style={[styles.optionMeta, { color: muted }]}>{isAr ? option.locationAr : option.locationEn}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
        {filtered.length === 0 ? <Text style={[styles.notFound, { color: muted }]}>{isAr ? "لا توجد نتيجة في الحصر المعتمد." : "No inventory match found."}</Text> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderWidth: 1, borderRadius: 10, padding: 10, gap: 8 },
  toolbar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  helper: { flex: 1, fontSize: 11, lineHeight: 17, textAlign: "right" },
  clearButton: { minHeight: 34, flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, borderRadius: 7, backgroundColor: "#fef2f2" },
  clearText: { color: "#b91c1c", fontSize: 11, fontWeight: "700" },
  selectedWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  selectedChip: { maxWidth: "100%", minHeight: 32, flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderRadius: 16, paddingHorizontal: 8, paddingVertical: 5 },
  selectedText: { flexShrink: 1, fontSize: 11, fontWeight: "600" },
  emptySelection: { fontSize: 12, textAlign: "right" },
  searchBox: { minHeight: 42, flexDirection: "row", alignItems: "center", gap: 7, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10 },
  searchInput: { flex: 1, fontSize: 13, paddingVertical: 8 },
  optionsList: { maxHeight: 250, borderWidth: 1, borderRadius: 8 },
  optionsContent: { padding: 5, gap: 4 },
  option: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 9, borderWidth: 1, borderRadius: 7, paddingHorizontal: 9, paddingVertical: 7 },
  check: { width: 21, height: 21, alignItems: "center", justifyContent: "center", borderWidth: 1, borderRadius: 6 },
  optionCopy: { flex: 1 },
  optionTitle: { fontSize: 12, fontWeight: "700", textAlign: "right" },
  optionMeta: { fontSize: 11, marginTop: 2, textAlign: "right" },
  notFound: { paddingVertical: 18, textAlign: "center", fontSize: 12 },
});
