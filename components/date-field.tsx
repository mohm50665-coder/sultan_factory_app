import React, { useEffect, useRef, useState } from "react";
import { Platform, Text, TouchableOpacity, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { calendarDateKey, dateFieldCommit, normalizeReportDateInput } from "../shared/report-date-input";

type DateFieldProps = {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  accessibilityLabel?: string;
  isAr?: boolean;
  style?: any;
  defaultToToday?: boolean;
};
export function todayDate() { return calendarDateKey(new Date()); }
export function DateField({ value, onChange, label, accessibilityLabel, isAr = true, style, defaultToToday = true }: DateFieldProps) {
  const normalized = normalizeReportDateInput(value);
  const resolvedValue = normalized || (defaultToToday ? todayDate() : "");
  const pickerValue = new Date(`${resolvedValue || todayDate()}T12:00:00`);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [showNativePicker, setShowNativePicker] = useState(false);
  const accessibleLabel = accessibilityLabel || label || (isAr ? "اختيار التاريخ من التقويم" : "Choose date from calendar");
  const commit = (raw: unknown) => {
    const next = dateFieldCommit(raw, defaultToToday);
    if (next !== null && next !== value) onChange(next);
  };
  useEffect(() => {
    if (defaultToToday && !value) onChange(resolvedValue);
  }, [defaultToToday, value, resolvedValue, onChange]);
  const openCalendar = () => {
    if (Platform.OS !== "web") { setShowNativePicker(true); return; }
    const input = inputRef.current;
    if (!input) return;
    try { if (typeof input.showPicker === "function") input.showPicker(); else input.focus(); }
    catch { input.focus(); }
  };
  return (
    <View style={{ gap: 4, flexGrow: 0, flexShrink: 1, minWidth: 0, width: "100%", maxWidth: 320, alignSelf: "flex-end" }}>
      {label ? <Text style={{ color: "#334155", fontWeight: "800", textAlign: isAr ? "right" : "left" }}>{label}</Text> : null}
      <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 4 }}>
        {Platform.OS === "web" ? React.createElement("input", {
          ref: inputRef,
          type: "date",
          value: resolvedValue,
          "aria-label": accessibleLabel,
          title: isAr ? "اختر التاريخ من التقويم" : "Choose a date from the calendar",
          onChange: (event: any) => commit(event.currentTarget.value),
          onBlur: (event: any) => { event.currentTarget.value = resolvedValue; },
          style: { flex: 1, minWidth: 0, width: "100%", maxWidth: 320, boxSizing: "border-box", minHeight: 40,
            border: "1px solid #cbd5e1", borderRadius: 8, padding: "0 10px", backgroundColor: "#fff",
            color: "#172033", fontSize: 14, textAlign: isAr ? "right" : "left", appearance: "auto", ...style },
        }) : <TouchableOpacity onPress={openCalendar} accessibilityRole="button" accessibilityLabel={accessibleLabel}
          style={[{ flex: 1, minHeight: 44, borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8,
            paddingHorizontal: 10, justifyContent: "center", backgroundColor: "#fff" }, style]}>
          <Text style={{ color: "#172033", textAlign: isAr ? "right" : "left" }}>{resolvedValue || (isAr ? "اختيار التاريخ" : "Choose date")}</Text>
        </TouchableOpacity>}
        <TouchableOpacity onPress={openCalendar} accessibilityRole="button"
          accessibilityLabel={isAr ? `فتح التقويم: ${accessibleLabel}` : `Open calendar: ${accessibleLabel}`}
          style={{ width: 44, minHeight: 44, borderRadius: 8, backgroundColor: "#e0f2fe", alignItems: "center", justifyContent: "center" }}>
          <MaterialIcons name="calendar-today" size={19} color="#075985" />
        </TouchableOpacity>
      </View>
      {Platform.OS !== "web" && showNativePicker ? <View>
        <DateTimePicker value={pickerValue} mode="date" display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={(event, selectedDate) => {
            if (Platform.OS !== "ios") setShowNativePicker(false);
            if (event.type !== "dismissed" && selectedDate) commit(calendarDateKey(selectedDate));
          }} accentColor="#0a7ea4" style={{ maxWidth: 320, alignSelf: "flex-end" }} />
        {Platform.OS === "ios" ? <TouchableOpacity onPress={() => setShowNativePicker(false)} style={{ padding: 10 }}>
          <Text style={{ color: "#075985", fontWeight: "800", textAlign: "right" }}>{isAr ? "تم" : "Done"}</Text>
        </TouchableOpacity> : null}
      </View> : null}
    </View>
  );
}
