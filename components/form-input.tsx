import React from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from "react-native";
import { useColors } from "@/hooks/use-colors";
import { MaterialIcons } from "@expo/vector-icons";

interface FormInputProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "email-address" | "numeric" | "phone-pad";
  secureTextEntry?: boolean;
  multiline?: boolean;
  numberOfLines?: number;
  required?: boolean;
  error?: string;
  editable?: boolean;
}

export function FormInput({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = "default",
  secureTextEntry = false,
  multiline = false,
  numberOfLines = 1,
  required = false,
  error,
  editable = true,
}: FormInputProps) {
  const colors = useColors();

  return (
    <View style={{ marginBottom: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
        <Text style={{ fontSize: 14, fontWeight: "600", color: colors.foreground }}>
          {label}
        </Text>
        {required && <Text style={{ color: colors.error, marginLeft: 4 }}>*</Text>}
      </View>
      <TextInput
        style={[
          styles.input,
          {
            borderColor: error ? colors.error : colors.border,
            color: colors.foreground,
            backgroundColor: colors.surface,
          },
          multiline && { minHeight: 100 },
        ]}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        multiline={multiline}
        numberOfLines={numberOfLines}
        editable={editable}
      />
      {error && <Text style={{ color: colors.error, fontSize: 12, marginTop: 4 }}>{error}</Text>}
    </View>
  );
}

interface FormNumberInputProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  unit?: string;
  required?: boolean;
  error?: string;
}

export function FormNumberInput({
  label,
  value,
  onChangeText,
  placeholder,
  unit,
  required = false,
  error,
}: FormNumberInputProps) {
  const colors = useColors();

  return (
    <View style={{ marginBottom: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
        <Text style={{ fontSize: 14, fontWeight: "600", color: colors.foreground }}>
          {label}
        </Text>
        {required && <Text style={{ color: colors.error, marginLeft: 4 }}>*</Text>}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <TextInput
          style={[
            styles.input,
            {
              borderColor: error ? colors.error : colors.border,
              color: colors.foreground,
              backgroundColor: colors.surface,
              flex: 1,
            },
          ]}
          placeholder={placeholder}
          placeholderTextColor={colors.muted}
          value={value}
          onChangeText={onChangeText}
          keyboardType="numeric"
        />
        {unit && (
          <Text
            style={{
              marginLeft: 12,
              color: colors.muted,
              fontSize: 14,
              fontWeight: "500",
            }}
          >
            {unit}
          </Text>
        )}
      </View>
      {error && <Text style={{ color: colors.error, fontSize: 12, marginTop: 4 }}>{error}</Text>}
    </View>
  );
}

interface FormSelectOption {
  label: string;
  value: string;
}

interface FormSelectProps {
  label: string;
  value: string;
  options: FormSelectOption[];
  onValueChange: (value: string) => void;
  required?: boolean;
  error?: string;
}

export function FormSelect({
  label,
  value,
  options,
  onValueChange,
  required = false,
  error,
}: FormSelectProps) {
  const colors = useColors();
  const [isOpen, setIsOpen] = React.useState(false);

  const selectedLabel = options.find((opt) => opt.value === value)?.label || label;

  return (
    <View style={{ marginBottom: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
        <Text style={{ fontSize: 14, fontWeight: "600", color: colors.foreground }}>
          {label}
        </Text>
        {required && <Text style={{ color: colors.error, marginLeft: 4 }}>*</Text>}
      </View>

      <TouchableOpacity
        onPress={() => setIsOpen(!isOpen)}
        style={[
          styles.input,
          {
            borderColor: error ? colors.error : colors.border,
            backgroundColor: colors.surface,
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          },
        ]}
      >
        <Text style={{ color: colors.foreground }}>{selectedLabel}</Text>
        <MaterialIcons
          name={isOpen ? "expand-less" : "expand-more"}
          size={20}
          color={colors.muted}
        />
      </TouchableOpacity>

      {isOpen && (
        <View
          style={{
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 8,
            marginTop: 8,
            backgroundColor: colors.surface,
            overflow: "hidden",
          }}
        >
          <ScrollView nestedScrollEnabled style={{ maxHeight: 200 }}>
            {options.map((option) => (
              <TouchableOpacity
                key={option.value}
                onPress={() => {
                  onValueChange(option.value);
                  setIsOpen(false);
                }}
                style={{
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                  backgroundColor: value === option.value ? colors.primary + "20" : "transparent",
                }}
              >
                <Text
                  style={{
                    color: value === option.value ? colors.primary : colors.foreground,
                    fontWeight: value === option.value ? "600" : "400",
                  }}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {error && <Text style={{ color: colors.error, fontSize: 12, marginTop: 4 }}>{error}</Text>}
    </View>
  );
}

interface FormCheckboxProps {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}

export function FormCheckbox({ label, value, onValueChange }: FormCheckboxProps) {
  const colors = useColors();

  return (
    <TouchableOpacity
      onPress={() => onValueChange(!value)}
      style={{
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 12,
        paddingVertical: 8,
      }}
    >
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 4,
          borderWidth: 2,
          borderColor: value ? colors.primary : colors.border,
          backgroundColor: value ? colors.primary : "transparent",
          justifyContent: "center",
          alignItems: "center",
          marginRight: 12,
        }}
      >
        {value && <MaterialIcons name="check" size={16} color="white" />}
      </View>
      <Text style={{ color: colors.foreground, fontSize: 14 }}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
});
