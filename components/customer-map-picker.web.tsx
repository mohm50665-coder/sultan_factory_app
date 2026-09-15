import React, { useEffect, useMemo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export type CustomerLocation = { latitude: number; longitude: number };

export function CustomerMapPicker({ value, onChange }: { value: CustomerLocation; onChange: (value: CustomerLocation) => void }) {
  useEffect(() => {
    const listener = (event: MessageEvent) => {
      const data = event.data;
      if (!data || data.type !== "sultan-map-location") return;
      const latitude = Number(data.latitude);
      const longitude = Number(data.longitude);
      if (Number.isFinite(latitude) && latitude >= -90 && latitude <= 90 && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180) onChange({ latitude, longitude });
    };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, [onChange]);

  const html = useMemo(() => `<!doctype html><html dir="rtl"><head><meta name="viewport" content="width=device-width,initial-scale=1"/><link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/><style>html,body,#map{height:100%;margin:0}body{font-family:Arial}.hint{position:absolute;z-index:999;top:8px;right:8px;background:white;padding:7px 10px;border-radius:8px;box-shadow:0 2px 8px #0002;font-size:12px}</style></head><body><div class="hint">انقر على الخريطة لتحديد موقع العميل</div><div id="map"></div><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script><script>const lat=${Number(value.latitude || 24.7136)};const lng=${Number(value.longitude || 46.6753)};const map=L.map('map').setView([lat,lng],13);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'OpenStreetMap'}).addTo(map);let marker=L.marker([lat,lng]).addTo(map);map.on('click',e=>{marker.setLatLng(e.latlng);parent.postMessage({type:'sultan-map-location',latitude:e.latlng.lat,longitude:e.latlng.lng},'*')});</script></body></html>`, [value.latitude, value.longitude]);

  const locate = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((position) => onChange({ latitude: position.coords.latitude, longitude: position.coords.longitude }));
  };

  return (
    <View style={styles.wrapper}>
      {React.createElement("iframe" as any, { title: "خريطة موقع العميل", srcDoc: html, style: { width: "100%", height: 290, border: 0, borderRadius: 14 } })}
      <View style={styles.row}>
        <TouchableOpacity style={styles.button} onPress={locate}><Text style={styles.buttonText}>استخدام موقعي الحالي</Text></TouchableOpacity>
        <Text style={styles.coordinates}>{value.latitude.toFixed(6)}, {value.longitude.toFixed(6)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 8 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  button: { backgroundColor: "#0a7ea4", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
  buttonText: { color: "white", fontWeight: "700" },
  coordinates: { color: "#475569", fontSize: 12 },
});
