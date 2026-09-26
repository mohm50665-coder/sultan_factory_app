import React, { useEffect } from "react";
import { Platform, Text, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";

type DateFieldProps = {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  isAr?: boolean;
  style?: any;
  defaultToToday?: boolean;
};

export function todayDate() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

export function DateField({ value, onChange, label, isAr = true, style, defaultToToday = true }: DateFieldProps) {
  const resolvedValue = value || (defaultToToday ? todayDate() : "");
  const pickerValue = resolvedValue ? new Date(`${resolvedValue}T12:00:00`) : new Date();
  useEffect(() => {
    if (defaultToToday && !value) onChange(resolvedValue);
  }, [defaultToToday, value, resolvedValue, onChange]);
  return (
    <View style={{ gap: 4, flexGrow: 0, flexShrink: 1, minWidth: 0, width: "100%", maxWidth: 320, alignSelf: "flex-end" }}>
      {label ? <Text style={{ color: "#334155", fontWeight: "800", textAlign: "right" }}>{label}</Text> : null}
      {Platform.OS === "web"
        ? React.createElement("input", {
            type: "date",
            value: resolvedValue,
            "aria-label": label || (isAr ? "اختيار التاريخ من التقويم" : "Choose date from calendar"),
            title: isAr ? "اضغط لاختيار التاريخ من التقويم" : "Click to choose a date from the calendar",
            onChange: (event: any) => onChange(event.target.value),
            style: {
              width: "100%",
              maxWidth: 320,
              boxSizing: "border-box",
              minHeight: 38,
              borderWidth: 1,
              borderStyle: "solid",
              borderColor: "#cbd5e1",
              borderRadius: 8,
              padding: "0 10px",
              backgroundColor: "#fff",
              color: "#172033",
              fontSize: 14,
              textAlign: isAr ? "right" : "left",
              appearance: "auto",
              WebkitAppearance: "auto",
              ...style,
            },
          })
        : <DateTimePicker
            value={pickerValue}
            mode="date"
            display="default"
            onChange={(_, selectedDate) => {
              if (selectedDate) onChange(selectedDate.toISOString().slice(0, 10));
            }}
            accentColor="#0a7ea4"
            style={[{ minHeight: 38, maxWidth: 320, alignSelf: "flex-end" }, style]}
          />}
    </View>
  );
}
