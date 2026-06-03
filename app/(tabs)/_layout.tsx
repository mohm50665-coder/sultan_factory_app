import { Tabs } from "expo-router";
import { Platform } from "react-native";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#0a7ea4",
        headerShown: false,
        tabBarStyle: {
          paddingTop: 8,
          paddingBottom: Platform.OS === "web" ? 12 : 8,
          height: 64,
          backgroundColor: "#ffffff",
          borderTopColor: "#E5E7EB",
          borderTopWidth: 0.5,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "الرئيسية",
          tabBarIcon: () => null,
        }}
      />
    </Tabs>
  );
}
