import React, { useRef, useState } from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";

export type TimeFieldProps = {
  value: string;
  onChange: (value: string) => void;
  label: string;
  accessibilityLabel?: string;
  isAr?: boolean;
  style?: any;
};

function isTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function toTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

/** A real time picker; it never passes a React Native style array to the web DOM. */
export function TimeField({ value, onChange, label, accessibilityLabel, isAr = true, style }: TimeFieldProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const normalized = isTime(value) ? value : "";
  const nativeDate = new Date(`2000-01-01T${normalized || "08:00"}:00`);
  const webStyle = Platform.OS === "web" ? (StyleSheet.flatten(style) || {}) : undefined;
  const accessibleLabel = accessibilityLabel || label;
  const open = () => {
    if (Platform.OS !== "web") { setShowPicker(true); return; }
    try { inputRef.current?.showPicker?.(); } catch { inputRef.current?.focus(); }
  };
  return <View style={{ gap: 4, flexGrow: 1, flexShrink: 1, minWidth: 130 }}>
    <Text style={{ color: "#334155", fontWeight: "800", textAlign: isAr ? "right" : "left" }}>{label} *</Text>
    <View style={{ flexDirection: isAr ? "row-reverse" : "row", alignItems: "center", gap: 4 }}>
      {Platform.OS === "web" ? React.createElement("input", {
        ref: inputRef,
        type: "time",
        value: normalized,
        "aria-label": accessibleLabel,
        onChange: (event: any) => onChange(event.currentTarget.value),
        style: { flex: 1, width: "100%", boxSizing: "border-box", minHeight: 40, border: "1px solid #cbd5e1", borderRadius: 8, padding: "0 10px", backgroundColor: "#fff", color: "#172033", fontSize: 14, textAlign: isAr ? "right" : "left", ...webStyle },
      }) : <TouchableOpacity onPress={open} accessibilityRole="button" accessibilityLabel={accessibleLabel}
        style={[{ flex: 1, minHeight: 44, borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8, paddingHorizontal: 10, justifyContent: "center", backgroundColor: "#fff" }, style]}>
        <Text style={{ color: "#172033", textAlign: isAr ? "right" : "left" }}>{normalized || "--:--"}</Text>
      </TouchableOpacity>}
      <TouchableOpacity onPress={open} accessibilityRole="button" accessibilityLabel={isAr ? `فتح اختيار الوقت: ${accessibleLabel}` : `Open time picker: ${accessibleLabel}`}
        style={{ width: 44, minHeight: 44, borderRadius: 8, backgroundColor: "#e0f2fe", alignItems: "center", justifyContent: "center" }}>
        <MaterialIcons name="schedule" size={20} color="#075985" />
      </TouchableOpacity>
    </View>
    {Platform.OS !== "web" && showPicker ? <DateTimePicker value={nativeDate} mode="time" display={Platform.OS === "ios" ? "spinner" : "default"}
      onChange={(event, selected) => {
        if (Platform.OS !== "ios") setShowPicker(false);
        if (event.type !== "dismissed" && selected) onChange(toTime(selected));
      }} /> : null}
  </View>;
}
