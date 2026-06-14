import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";
import { MaterialIcons } from "@expo/vector-icons";

export default function HomeScreen() {
  const colors = useColors();
  const { user, logout } = useAuth();
  const { language, toggleLanguage } = useLanguage();
  const isAr = language === "ar";

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <Text style={styles.headerTitle}>
          {isAr ? "مصنع السلطان" : "Sultan Factory"}
        </Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity onPress={toggleLanguage}>
            <Text style={styles.langButton}>
              {isAr ? "EN" : "ع"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={logout}>
            <MaterialIcons name="logout" size={20} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Welcome Section */}
      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        <Text style={[styles.welcome, { color: colors.foreground }]}>
          {isAr ? "أهلاً وسهلاً" : "Welcome"}
        </Text>
        <Text style={[styles.userName, { color: colors.muted }]}>
          {user?.name || (isAr ? "المستخدم" : "User")}
        </Text>
      </View>

      {/* Quick Actions */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity style={[styles.actionButton, { backgroundColor: "#3b82f6" }]}>
          <MaterialIcons name="factory" size={24} color="white" />
          <Text style={styles.actionText}>
            {isAr ? "الإنتاج" : "Production"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.actionButton, { backgroundColor: "#10b981" }]}>
          <MaterialIcons name="warehouse" size={24} color="white" />
          <Text style={styles.actionText}>
            {isAr ? "المستودعات" : "Warehouse"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.actionButton, { backgroundColor: "#ec4899" }]}>
          <MaterialIcons name="shopping-cart" size={24} color="white" />
          <Text style={styles.actionText}>
            {isAr ? "المبيعات" : "Sales"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.actionButton, { backgroundColor: "#f59e0b" }]}>
          <MaterialIcons name="assessment" size={24} color="white" />
          <Text style={styles.actionText}>
            {isAr ? "التقارير" : "Reports"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* User Info */}
      <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.infoLabel, { color: colors.muted }]}>
          {isAr ? "الدور:" : "Role:"}
        </Text>
        <Text style={[styles.infoValue, { color: colors.foreground }]}>
          {user?.role || (isAr ? "مستخدم" : "User")}
        </Text>

        <Text style={[styles.infoLabel, { color: colors.muted, marginTop: 12 }]}>
          {isAr ? "القسم:" : "Department:"}
        </Text>
        <Text style={[styles.infoValue, { color: colors.foreground }]}>
          {user?.department || (isAr ? "غير محدد" : "Not specified")}
        </Text>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  headerTitle: {
    color: "white",
    fontSize: 20,
    fontWeight: "bold",
  },
  headerButtons: {
    flexDirection: "row",
    gap: 12,
  },
  langButton: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
    paddingHorizontal: 8,
  },
  card: {
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  welcome: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 4,
  },
  userName: {
    fontSize: 14,
  },
  actionsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 16,
  },
  actionButton: {
    width: "48%",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  actionText: {
    color: "white",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 8,
    textAlign: "center",
  },
  infoCard: {
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  infoValue: {
    fontSize: 14,
    fontWeight: "500",
    marginTop: 4,
  },
});
