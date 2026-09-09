import React, { useEffect } from "react";
import { Platform, Text, TextInput, View } from "react-native";

type DateFieldProps = {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  isAr?: boolean;
  style?: any;
};

export function todayDate() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

export function DateField({ value, onChange, label, isAr = true, style }: DateFieldProps) {
  const resolvedValue = value || todayDate();
  useEffect(() => {
    if (!value) onChange(resolvedValue);
  }, [value, resolvedValue]);
  return (
    <View style={{ gap: 5, flex: 1 }}>
      {label ? <Text style={{ color: "#334155", fontWeight: "800", textAlign: "right" }}>{label}</Text> : null}
      {Platform.OS === "web"
        ? React.createElement("input", {
            type: "date",
            value: resolvedValue,
            onChange: (event: any) => onChange(event.target.value),
            style: {
              width: "100%",
              minHeight: 42,
              borderWidth: 1,
              borderStyle: "solid",
              borderColor: "#cbd5e1",
              borderRadius: 8,
              padding: "0 12px",
              backgroundColor: "#fff",
              color: "#172033",
              fontSize: 15,
              textAlign: isAr ? "right" : "left",
              ...style,
            },
          })
        : <TextInput value={resolvedValue} onChangeText={onChange} placeholder="YYYY-MM-DD" style={[{ minHeight: 42, borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8, paddingHorizontal: 12, backgroundColor: "#fff", color: "#172033", textAlign: "right" }, style]} />}
    </View>
  );
}
