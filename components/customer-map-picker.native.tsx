import { StyleSheet, Text, View } from "react-native";
import MapView, { Marker } from "react-native-maps";

export type CustomerLocation = { latitude: number; longitude: number };

export function CustomerMapPicker({ value, onChange }: { value: CustomerLocation; onChange: (value: CustomerLocation) => void }) {
  return (
    <View style={styles.wrapper}>
      <MapView
        style={styles.map}
        region={{ latitude: value.latitude || 24.7136, longitude: value.longitude || 46.6753, latitudeDelta: 0.08, longitudeDelta: 0.08 }}
        onPress={(event) => onChange(event.nativeEvent.coordinate)}
      >
        <Marker draggable coordinate={{ latitude: value.latitude || 24.7136, longitude: value.longitude || 46.6753 }} onDragEnd={(event) => onChange(event.nativeEvent.coordinate)} />
      </MapView>
      <Text style={styles.coordinates}>{value.latitude.toFixed(6)}, {value.longitude.toFixed(6)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 8 },
  map: { width: "100%", height: 290, borderRadius: 14 },
  coordinates: { color: "#475569", fontSize: 12, textAlign: "center" },
});
