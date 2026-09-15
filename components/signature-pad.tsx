import { useMemo, useRef, useState } from "react";
import { PanResponder, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Svg, { Path } from "react-native-svg";

type Point = { x: number; y: number };

function pointsToPath(points: Point[]) {
  if (!points.length) return "";
  return points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ");
}

function createSvgDataUri(strokes: Point[][], width: number, height: number) {
  const paths = strokes
    .filter((stroke) => stroke.length > 1)
    .map((stroke) => `<path d="${pointsToPath(stroke)}" fill="none" stroke="#0f172a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`)
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="white"/>${paths}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function SignaturePad({
  label,
  onSave,
  disabled = false,
}: {
  label: string;
  onSave: (signatureData: string) => void;
  disabled?: boolean;
}) {
  const width = 520;
  const height = 180;
  const [strokes, setStrokes] = useState<Point[][]>([]);
  const currentStroke = useRef<Point[]>([]);

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => !disabled,
    onMoveShouldSetPanResponder: () => !disabled,
    onPanResponderGrant: (event) => {
      currentStroke.current = [{ x: event.nativeEvent.locationX, y: event.nativeEvent.locationY }];
      setStrokes((previous) => [...previous, currentStroke.current]);
    },
    onPanResponderMove: (event) => {
      currentStroke.current = [...currentStroke.current, { x: event.nativeEvent.locationX, y: event.nativeEvent.locationY }];
      setStrokes((previous) => [...previous.slice(0, -1), currentStroke.current]);
    },
    onPanResponderRelease: () => {
      currentStroke.current = [];
    },
  }), [disabled]);

  const clear = () => {
    setStrokes([]);
    currentStroke.current = [];
    onSave("");
  };

  const save = () => {
    if (strokes.some((stroke) => stroke.length > 1)) onSave(createSvgDataUri(strokes, width, height));
  };

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.canvas, disabled && styles.disabled]} {...panResponder.panHandlers}>
        <Svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`}>
          {strokes.map((stroke, index) => <Path key={`${index}-${stroke.length}`} d={pointsToPath(stroke)} fill="none" stroke="#0f172a" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />)}
        </Svg>
        {!strokes.length && <Text style={styles.hint}>وقّع هنا بإصبعك أو مؤشر الفأرة</Text>}
      </View>
      <View style={styles.actions}>
        <TouchableOpacity style={[styles.button, styles.clearButton]} onPress={clear} disabled={disabled}>
          <Text style={styles.clearText}>مسح</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, styles.saveButton]} onPress={save} disabled={disabled || !strokes.length}>
          <Text style={styles.saveText}>اعتماد التوقيع</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 8 },
  label: { color: "#0f172a", fontSize: 14, fontWeight: "700", textAlign: "right" },
  canvas: { height: 180, backgroundColor: "#fff", borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 14, overflow: "hidden", position: "relative" },
  disabled: { opacity: 0.55 },
  hint: { position: "absolute", left: 0, right: 0, top: 78, textAlign: "center", color: "#94a3b8", pointerEvents: "none" },
  actions: { flexDirection: "row", gap: 10 },
  button: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 10, borderRadius: 10 },
  clearButton: { backgroundColor: "#f1f5f9" },
  saveButton: { backgroundColor: "#0a7ea4" },
  clearText: { color: "#475569", fontWeight: "700" },
  saveText: { color: "#fff", fontWeight: "700" },
});
