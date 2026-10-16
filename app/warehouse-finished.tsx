import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";

/**
 * Compatibility route only. Finished stock has one canonical view and one approved ledger:
 * `/finished-warehouse-inventory`. This route deliberately creates no parallel entry or stock.
 */
export default function WarehouseFinishedRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/finished-warehouse-inventory" as never);
  }, [router]);
  return (
    <ScreenContainer className="items-center justify-center p-6">
      <View style={styles.card}>
        <ActivityIndicator color="#166534" />
        <Text style={styles.text}>
          جارٍ فتح التخزين والمستودعات — إنتاج تام…
        </Text>
      </View>
    </ScreenContainer>
  );
}
const styles = StyleSheet.create({
  card: { alignItems: "center", gap: 10 },
  text: { color: "#166534", fontWeight: "800", textAlign: "center" },
});
