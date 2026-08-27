import React, { useMemo, useState } from "react";
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import * as Print from "expo-print";
import { MaterialIcons } from "@expo/vector-icons";
import { ScreenContainer } from "@/components/screen-container";
import { BackButton } from "@/components/back-button";
import { useLanguage } from "@/lib/language-context";
import { barcodeBars, chooseLabelSize, code128Pattern, labelSizeByKey, LABEL_SIZES, makeProductBarcode } from "@/lib/barcode-labels";

function escapeHtml(value: string) {
  return value.replace(/[&<>\"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" }[char] ?? char));
}

export default function BarcodeLabelsScreen() {
  const router = useRouter();
  const { language } = useLanguage();
  const isAr = language === "ar";
  const [productName, setProductName] = useState("");
  const [color, setColor] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState(isAr ? "قطعة" : "Piece");
  const [barcode, setBarcode] = useState("");
  const [manualMode, setManualMode] = useState(false);
  const [sizeKey, setSizeKey] = useState("50x40");

  const generatedBarcode = useMemo(() => makeProductBarcode(productName || "صنف", color || "عام"), [productName, color]);
  const enteredBarcode = barcode.trim().toUpperCase();
  const effectiveBarcode = enteredBarcode ? (enteredBarcode.startsWith("S") ? enteredBarcode : `S${enteredBarcode}`) : generatedBarcode;
  const automaticSize = chooseLabelSize(productName, color, quantity, unit);
  const selectedSize = labelSizeByKey(sizeKey);
  const bars = barcodeBars(code128Pattern(effectiveBarcode));

  const selectAutoSize = () => setSizeKey(automaticSize);
  const labelCount = Math.max(1, Math.floor(Number(quantity) || 1));

  const buildPrintHtml = () => {
    const label = labelSizeByKey(sizeKey);
    const labelWidth = `${label.widthMm}mm`;
    const labelHeight = `${label.heightMm}mm`;
    const safeName = escapeHtml(productName || "غير محدد");
    const safeColor = escapeHtml(color || "غير محدد");
    const safeBarcode = escapeHtml(effectiveBarcode);
    const safeUnit = escapeHtml(unit || (isAr ? "قطعة" : "Piece"));
    const barsHtml = barcodeBars(code128Pattern(effectiveBarcode))
      .map((bar) => `<span style="display:inline-block;background:${bar.black ? "#111" : "#fff"};width:${bar.width}px;height:42px"></span>`).join("");
    const oneLabel = `<div class="label"><div class="name">${safeName}</div><div class="color">${isAr ? "اللون" : "Color"}: ${safeColor}</div><div class="bars">${barsHtml}</div><div class="code">${safeBarcode}</div><div class="qty">${isAr ? "الكمية" : "Qty"}: 1 ${safeUnit}</div><div class="footer">مصنع السلطان للجوارب<br/><span>Sultan Socks Factory</span></div></div>`;
    return `<!doctype html><html dir="${isAr ? "rtl" : "ltr"}"><head><meta charset="utf-8"><style>@page{size:${labelWidth} ${labelHeight};margin:0}*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif}.sheet{display:flex;flex-wrap:wrap;gap:2mm;padding:1mm}.label{width:${labelWidth};height:${labelHeight};padding:2mm;text-align:center;border:0.2mm solid #222;overflow:hidden;break-inside:avoid}.name{font-weight:700;font-size:12px;white-space:nowrap;overflow:hidden}.color,.qty{font-size:9px}.bars{height:42px;display:flex;justify-content:center;overflow:hidden;margin:2px 0}.code{font-size:9px;letter-spacing:1px}.footer{font-size:7px;margin-top:2px;line-height:1.15}.footer span{font-size:6px}</style></head><body><div class="sheet">${Array.from({ length: labelCount }, () => oneLabel).join("")}</div></body></html>`;
  };

  const printLabels = async () => {
    if (!productName.trim() && !manualMode) { Alert.alert(isAr ? "تنبيه" : "Alert", isAr ? "أدخل اسم المنتج أولاً" : "Enter product name first"); return; }
    try {
      const html = buildPrintHtml();
      if (Platform.OS === "web") {
        const popup = window.open("", "_blank", "width=900,height=700");
        if (!popup) throw new Error("Popup blocked");
        popup.document.write(html);
        popup.document.close();
        popup.focus();
        popup.print();
      } else {
        await Print.printAsync({ html });
      }
    } catch (error) {
      Alert.alert(isAr ? "تعذر الطباعة" : "Print failed", isAr ? "تحقق من السماح بالطباعة وحاول مرة أخرى" : "Allow printing and try again");
    }
  };

  return (
    <ScreenContainer containerClassName="bg-background" safeAreaClassName="bg-background">
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}><BackButton /><View style={styles.headerText}><Text style={styles.title}>{isAr ? "ملصقات الباركود" : "Barcode Labels"}</Text><Text style={styles.subtitle}>{isAr ? "تخزين وطباعة ملصقات الصنف" : "Storage label printing"}</Text></View><MaterialIcons name="qr-code-2" size={30} color="#0a7ea4" /></View>
        <View style={styles.modeRow}>
          <Pressable onPress={() => setManualMode(false)} style={[styles.mode, !manualMode && styles.modeActive]}><Text style={[styles.modeText, !manualMode && styles.modeTextActive]}>{isAr ? "من التخزين" : "From storage"}</Text></Pressable>
          <Pressable onPress={() => setManualMode(true)} style={[styles.mode, manualMode && styles.modeActive]}><Text style={[styles.modeText, manualMode && styles.modeTextActive]}>{isAr ? "باركود بديل تالف" : "Damaged label"}</Text></Pressable>
        </View>
        {manualMode && <View style={styles.notice}><MaterialIcons name="info-outline" size={18} color="#9a6700" /><Text style={styles.noticeText}>{isAr ? "وضع مستقل: لا يحفظ أو يغير بيانات التطبيق، ويستخدم فقط لطباعة ملصق بديل." : "Standalone mode: nothing is saved or changed in the app."}</Text></View>}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{isAr ? "بيانات الملصق" : "Label data"}</Text>
          <Text style={styles.label}>{isAr ? "اسم المنتج" : "Product name"}</Text><TextInput value={productName} onChangeText={setProductName} placeholder={isAr ? "مثال: ECO" : "Example: ECO"} style={styles.input} />
          <Text style={styles.label}>{isAr ? "اللون" : "Color"}</Text><TextInput value={color} onChangeText={setColor} placeholder={isAr ? "مثال: أسود" : "Example: Black"} style={styles.input} />
          <Text style={styles.label}>{isAr ? "رقم الباركود (يبدأ تلقائياً بـ S)" : "Barcode number (starts with S)"}</Text><TextInput value={barcode} onChangeText={(value) => setBarcode(value.toUpperCase())} placeholder={generatedBarcode} style={styles.input} autoCapitalize="characters" />
          <View style={styles.twoCol}><View style={styles.col}><Text style={styles.label}>{isAr ? "الكمية" : "Quantity"}</Text><TextInput value={quantity} onChangeText={setQuantity} keyboardType="numeric" style={styles.input} /></View><View style={styles.col}><Text style={styles.label}>{isAr ? "الوحدة" : "Unit"}</Text><TextInput value={unit} onChangeText={setUnit} style={styles.input} /></View></View>
        </View>
        <View style={styles.card}>
          <View style={styles.sizeHeader}><Text style={styles.sectionTitle}>{isAr ? "مقاس الملصق" : "Label size"}</Text><Pressable onPress={selectAutoSize} style={styles.autoBtn}><MaterialIcons name="auto-fix-high" size={16} color="#0a7ea4" /><Text style={styles.autoText}>{isAr ? `تلقائي: ${automaticSize.replace("x", " × ")} مم` : `Auto: ${automaticSize.replace("x", " × ")} mm`}</Text></Pressable></View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sizeList}>{LABEL_SIZES.map((size) => <Pressable key={size.key} onPress={() => setSizeKey(size.key)} style={[styles.sizeChip, sizeKey === size.key && styles.sizeChipActive]}><Text style={[styles.sizeChipTitle, sizeKey === size.key && styles.sizeChipTitleActive]}>{size.widthMm} × {size.heightMm}</Text><Text style={[styles.sizeChipDescription, sizeKey === size.key && styles.sizeChipDescriptionActive]}>{isAr ? size.descriptionAr : `${size.widthMm} × ${size.heightMm} mm label`}</Text></Pressable>)}</ScrollView>
          <Text style={styles.selected}>{isAr ? `المحدد: ${selectedSize.widthMm} × ${selectedSize.heightMm} مم — عدد الملصقات: ${labelCount}` : `Selected: ${selectedSize.widthMm} × ${selectedSize.heightMm} mm — Labels: ${labelCount}`}</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{isAr ? "معاينة" : "Preview"}</Text>
          <View style={[styles.preview, { width: Math.min(selectedSize.widthMm * 3, 300), height: Math.min(selectedSize.heightMm * 3, 210) }]}><Text style={styles.previewName}>{productName || (isAr ? "اسم المنتج" : "Product name")}</Text><Text style={styles.previewColor}>{isAr ? "اللون" : "Color"}: {color || "—"}</Text><View style={styles.previewBars}>{bars.map((bar, index) => <View key={index} style={{ width: bar.black ? 2 : 1, height: 42, backgroundColor: bar.black ? "#111" : "#fff" }} />)}</View><Text style={styles.previewCode}>{effectiveBarcode}</Text><Text style={styles.previewQty}>{isAr ? `الكمية: 1 ${unit}` : `Qty: 1 ${unit}`}</Text><Text style={styles.previewFooter}>مصنع السلطان للجوارب</Text><Text style={styles.previewFooterEn}>Sultan Socks Factory</Text></View>
        </View>
        <Pressable onPress={printLabels} style={styles.printBtn}><MaterialIcons name="print" size={22} color="white" /><Text style={styles.printText}>{isAr ? `طباعة ${labelCount} ملصق` : `Print ${labelCount} label(s)`}</Text></Pressable>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12, maxWidth: 900, width: "100%", alignSelf: "center" }, header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 4 }, headerText: { flex: 1 }, title: { fontSize: 24, fontWeight: "800", color: "#11181C", textAlign: "right" }, subtitle: { color: "#687076", textAlign: "right" }, modeRow: { flexDirection: "row", gap: 8 }, mode: { flex: 1, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: "#d5dbe1", alignItems: "center" }, modeActive: { backgroundColor: "#e6f4f8", borderColor: "#0a7ea4" }, modeText: { color: "#55616b", fontWeight: "700" }, modeTextActive: { color: "#0a7ea4" }, notice: { flexDirection: "row", gap: 8, alignItems: "center", backgroundColor: "#fff7d6", padding: 12, borderRadius: 10 }, noticeText: { flex: 1, color: "#795b00", textAlign: "right" }, card: { backgroundColor: "#fff", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#e1e6eb", gap: 8 }, sectionTitle: { fontSize: 18, fontWeight: "800", color: "#11181C", textAlign: "right" }, label: { color: "#55616b", fontWeight: "700", textAlign: "right", marginTop: 4 }, input: { borderWidth: 1, borderColor: "#d5dbe1", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, textAlign: "right", color: "#11181C", backgroundColor: "#fbfcfd" }, twoCol: { flexDirection: "row", gap: 10 }, col: { flex: 1 }, sizeHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }, autoBtn: { flexDirection: "row", gap: 4, alignItems: "center", padding: 8, borderRadius: 8, backgroundColor: "#edf8fb" }, autoText: { color: "#0a7ea4", fontSize: 12, fontWeight: "700" }, sizeList: { gap: 8, paddingVertical: 4 }, sizeChip: { width: 150, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: "#d5dbe1", backgroundColor: "#fff" }, sizeChipActive: { borderColor: "#0a7ea4", backgroundColor: "#e6f4f8" }, sizeChipTitle: { fontWeight: "800", color: "#29343d", textAlign: "right" }, sizeChipTitleActive: { color: "#0a7ea4" }, sizeChipDescription: { color: "#687076", fontSize: 11, textAlign: "right", marginTop: 4 }, sizeChipDescriptionActive: { color: "#17657b" }, selected: { color: "#687076", fontSize: 12, textAlign: "right" }, preview: { alignSelf: "center", borderWidth: 1, borderColor: "#303840", backgroundColor: "white", padding: 8, alignItems: "center", justifyContent: "center", overflow: "hidden" }, previewName: { fontWeight: "800", fontSize: 13 }, previewColor: { fontSize: 10 }, previewBars: { height: 44, flexDirection: "row", alignItems: "center", marginVertical: 4 }, previewCode: { fontSize: 9, letterSpacing: 1 }, previewQty: { fontSize: 9 }, previewFooter: { fontSize: 8, fontWeight: "700", marginTop: 3 }, previewFooterEn: { fontSize: 7 }, printBtn: { backgroundColor: "#0a7ea4", padding: 15, borderRadius: 14, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8 }, printText: { color: "white", fontSize: 17, fontWeight: "800" },
});
