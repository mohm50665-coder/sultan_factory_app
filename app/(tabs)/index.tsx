import { View, Text, StyleSheet } from "react-native";

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>مصنع السلطان</Text>
      <Text style={styles.subtitle}>مرحباً بك في التطبيق</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#ffffff",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#11181C",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#687076",
  },
});
