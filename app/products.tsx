import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { ScreenContainer } from "@/components/screen-container";
import { AttachmentPicker } from "@/components/attachment-picker";
import type { AttachmentFile } from "@/lib/services/attachment.service";
import { manufacturingService, productTrackingService, productionService, productsService } from "@/lib/services/api.service";
import { useAuth } from "@/lib/auth-context";

type Product = { id: number; barcode: string; name: string; size?: string | null; color?: string | null; weightGrams?: number | null; yarnDetails?: any; imageUrl?: string | null; attachments?: string[] | null; updatedAt?: string | Date | null };
type ProductStats = { productionRows: number; productionDozen: number; productionPairs: number; machines: string[]; stageRows: number; stageDozen: number; stagePairs: number; stages: string[]; trackingRows: number; storedPairs: number; };

const normalize = (value: unknown) => String(value ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase("ar");
const splitProductName = (raw: unknown) => { const parts = String(raw ?? "").trim().split(" - ").map((x) => x.trim()); return { name: parts[0] || "", size: parts[1] || "", color: parts.slice(2).join(" - ") || "" }; };
const identityKey = (name: unknown, size?: unknown, color?: unknown) => [name, size, color].map(normalize).join("|");
const matches = (product: Product, raw: unknown, size?: unknown, color?: unknown) => {
  const parsed = splitProductName(raw);
  return identityKey(product.name, product.size, product.color) === identityKey(parsed.name, size || parsed.size, color || parsed.color) || (normalize(product.name) === normalize(raw) && !product.size && !product.color);
};
const formatYarn = (details: any) => {
  if (!details) return "غير متوفر";
  if (typeof details === "string") return details;
  const entries = Object.entries(details).filter(([, value]) => value !== undefined && value !== null && value !== "" && Number(value) !== 0);
  return entries.length ? entries.map(([key, value]) => `${key}: ${key === "yarnWeightPerPair" ? value + " جم/زوج" : value + " جم"}`).join("، ") : "غير متوفر";
};
const emptyStats = (): ProductStats => ({ productionRows: 0, productionDozen: 0, productionPairs: 0, machines: [], stageRows: 0, stageDozen: 0, stagePairs: 0, stages: [], trackingRows: 0, storedPairs: 0 });

export default function ProductsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [items, setItems] = useState<Product[]>([]);
  const [stats, setStats] = useState<Record<number, ProductStats>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState<"name" | "updated" | "missing">("name");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [files, setFiles] = useState<AttachmentFile[]>([]);
  const [name, setName] = useState(""); const [size, setSize] = useState(""); const [color, setColor] = useState("");
  const [weight, setWeight] = useState(""); const [yarnWeightPerPair, setYarnWeightPerPair] = useState(""); const [yarnRubber, setYarnRubber] = useState(""); const [yarnSpandex, setYarnSpandex] = useState(""); const [yarnNylon, setYarnNylon] = useState(""); const [yarnCotton, setYarnCotton] = useState(""); const [yarnBamboo, setYarnBamboo] = useState(""); const [yarnSpan, setYarnSpan] = useState(""); const [imageUrl, setImageUrl] = useState(""); const [attachment, setAttachment] = useState("");

  const load = useCallback(async () => {
    try {
      const [catalogResult, productionResult, manufacturingResult, trackingResult] = await Promise.allSettled([productsService.list(), productionService.getAll(), manufacturingService.getAll(), productTrackingService.list()]);
      const catalog = catalogResult.status === "fulfilled" && Array.isArray(catalogResult.value) ? catalogResult.value as Product[] : [];
      const production = productionResult.status === "fulfilled" && Array.isArray(productionResult.value) ? productionResult.value as any[] : [];
      const manufacturing = manufacturingResult.status === "fulfilled" && Array.isArray(manufacturingResult.value) ? manufacturingResult.value as any[] : [];
      const tracking = trackingResult.status === "fulfilled" && Array.isArray(trackingResult.value) ? trackingResult.value as any[] : [];
      const nextStats: Record<number, ProductStats> = {};
      catalog.forEach((product) => {
        const value = emptyStats();
        const productionRows = production.filter((row) => matches(product, row.productName));
        const manufacturingRows = manufacturing.filter((row) => matches(product, row.productName));
        const trackingRows = tracking.filter((row) => matches(product, row.productName, row.productSize, row.productColor));
        value.productionRows = productionRows.length;
        value.productionDozen = productionRows.reduce((sum, row) => sum + (Number(row.productionDozen) || 0), 0);
        value.productionPairs = productionRows.reduce((sum, row) => sum + (Number(row.productionPairs) || 0), 0);
        value.machines = [...new Set(productionRows.map((row) => row.machineNumber).filter(Boolean))];
        value.stageRows = manufacturingRows.length;
        value.stageDozen = manufacturingRows.reduce((sum, row) => sum + (Number(row.quantityDozen) || 0), 0);
        value.stagePairs = manufacturingRows.reduce((sum, row) => sum + (Number(row.quantityPair) || 0), 0);
        value.stages = [...new Set(manufacturingRows.map((row) => row.stageName).filter(Boolean))];
        value.trackingRows = trackingRows.length;
        value.storedPairs = trackingRows.reduce((sum, row) => sum + (Number(row.quantityPairs) || 0), 0);
        nextStats[product.id] = value;
      });
      setItems(catalog); setStats(nextStats);
    } catch (error: any) { Alert.alert("خطأ", error?.message || "تعذر تحميل بيان المنتجات"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const reset = () => { setEditing(null); setName(""); setSize(""); setColor(""); setWeight(""); setYarnWeightPerPair(""); setYarnRubber(""); setYarnSpandex(""); setYarnNylon(""); setYarnCotton(""); setYarnBamboo(""); setYarnSpan(""); setImageUrl(""); setAttachment(""); setFiles([]); };
  const save = async () => {
    const yarnWeights = { yarnRubber: Number(yarnRubber) || 0, yarnSpandex: Number(yarnSpandex) || 0, yarnNylon: Number(yarnNylon) || 0, yarnCotton: Number(yarnCotton) || 0, yarnBamboo: Number(yarnBamboo) || 0, yarnSpan: Number(yarnSpan) || 0 };
    if (!name.trim() || !size.trim() || !color.trim() || !weight.trim() || Number(weight) <= 0 || !yarnWeightPerPair.trim() || Number(yarnWeightPerPair) <= 0 || Object.values(yarnWeights).every((value) => value <= 0)) return Alert.alert("بيانات إلزامية", "يجب إدخال الاسم والمقاس واللون ووزن الجورب ووزن الخيط/زوج ووزن نوع خيط واحد على الأقل قبل الحفظ");
    const yarnDetails: any = { yarnWeightPerPair: Number(yarnWeightPerPair), ...yarnWeights };
    const uploadedFiles = files.map((file) => file.uploadedUrl || file.uri).filter(Boolean);
    const firstImage = files.find((file) => file.type === "image");
      const manualAttachments = attachment.split(/\\n+/).map((item) => item.trim()).filter(Boolean);
    const data = { name: name.trim(), size: size.trim() || undefined, color: color.trim() || undefined, weightGrams: Math.max(0, Number(weight) || 0), yarnDetails, imageUrl: imageUrl.trim() || firstImage?.uploadedUrl || firstImage?.uri || undefined, attachments: [...new Set([...manualAttachments, ...uploadedFiles])] };
    try { if (editing) await productsService.update(editing, data); else await productsService.create({ ...data, createdBy: user?.id }); Alert.alert("تم", editing ? "تم تحديث بيان المنتج" : "تم حفظ المنتج وإنشاء الباركود"); reset(); await load(); } catch (error: any) { Alert.alert("خطأ", error?.message || "تعذر حفظ المنتج"); }
  };
  const edit = (product: Product) => { if (user?.role !== "admin") return Alert.alert("التعديل غير مسموح", "لا يقبل التعديل على المنتج إلا من قبل مدير النظام"); const details: any = typeof product.yarnDetails === "string" ? (() => { try { return JSON.parse(product.yarnDetails); } catch { return {}; } })() : product.yarnDetails || {}; setEditing(product.id); setName(product.name); setSize(product.size || ""); setColor(product.color || ""); setWeight(String(product.weightGrams || "")); setYarnWeightPerPair(String(details.yarnWeightPerPair || "")); setYarnRubber(String(details.yarnRubber || "")); setYarnSpandex(String(details.yarnSpandex || "")); setYarnNylon(String(details.yarnNylon || "")); setYarnCotton(String(details.yarnCotton || "")); setYarnBamboo(String(details.yarnBamboo || "")); setYarnSpan(String(details.yarnSpan || "")); setImageUrl(product.imageUrl || ""); setAttachment(product.attachments?.join("\\n") || ""); };
  const remove = (product: Product) => Alert.alert("تأكيد الحذف", `حذف ${product.name} من دليل المنتجات؟`, [{ text: "إلغاء", style: "cancel" }, { text: "حذف", style: "destructive", onPress: async () => { await productsService.delete(product.id); await load(); } }]);
  const sortedItems = useMemo(() => {
    const query = normalize(searchQuery);
    const filtered = items.filter((product) => !query || [product.name, product.barcode, product.size, product.color].some((value) => normalize(value).includes(query)));
    return [...filtered].sort((a, b) => {
      if (sortMode === "updated") return String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
      if (sortMode === "missing") return Number(!a.weightGrams || !a.yarnDetails) - Number(!b.weightGrams || !b.yarnDetails);
      return normalize(`${a.name} ${a.size || ""} ${a.color || ""}`).localeCompare(normalize(`${b.name} ${b.size || ""} ${b.color || ""}`), "ar");
    });
  }, [items, searchQuery, sortMode]);
  const printAllProducts = () => {
    if (typeof window === "undefined") return Alert.alert("الطباعة", "افتح التطبيق من الويب لاستخدام تقرير الطباعة");
    const esc = (value: unknown) => String(value ?? "غير متوفر").replace(/[&<>\"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\\\"": "&quot;" } as any)[char]);
    const cards = sortedItems.map((product) => { const detail = stats[product.id] || emptyStats(); return `<section class="product"><h2>${esc(product.name)}</h2><p><b>الباركود:</b> ${esc(product.barcode)} | <b>المقاس:</b> ${esc(product.size)} | <b>اللون:</b> ${esc(product.color)}</p><p><b>الوزن:</b> ${esc(product.weightGrams ? `${product.weightGrams} جرام` : "غير متوفر")}</p><p><b>الخيوط ونسبها:</b> ${esc(formatYarn(product.yarnDetails))}</p><p><b>الإنتاج:</b> ${detail.productionPairs} زوج / ${detail.productionDozen} درزن | <b>المراحل:</b> ${detail.stagePairs} زوج | <b>التتبع:</b> ${detail.trackingRows} سجل</p><p><b>المكائن:</b> ${esc(detail.machines.join("، ") || "لا توجد سجلات")}</p><p><b>مراحل التصنيع:</b> ${esc(detail.stages.join("، ") || "لا توجد سجلات")}</p><p><b>المرفقات:</b> ${product.attachments?.length || 0}</p></section>`; }).join("");
    const report = window.open("", "_blank", "width=900,height=700");
    if (!report) return Alert.alert("الطباعة", "اسمح بالنوافذ المنبثقة ثم أعد المحاولة");
    report.document.write(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>تقرير دليل المنتجات</title><style>body{font-family:Arial,sans-serif;padding:28px;color:#111;direction:rtl}h1{text-align:center;color:#0a7ea4}.product{border:1px solid #b8c8cf;border-radius:10px;padding:14px;margin:0 0 14px;page-break-inside:avoid}.product h2{margin:0 0 8px;color:#0a7ea4}.product p{line-height:1.8;margin:3px 0}@media print{button{display:none}}</style></head><body><h1>تقرير دليل المنتجات</h1><p>عدد المنتجات: ${sortedItems.length}</p>${cards}</body></html>`);
    report.document.close(); report.focus(); report.print();
  };

  return <ScreenContainer className="p-4"><ScrollView contentContainerStyle={styles.container}>
    <View style={styles.header}><Pressable onPress={() => router.back()} style={styles.back}><MaterialIcons name="arrow-forward" size={22} color="#fff" /></Pressable><View style={{ flex: 1 }}><Text style={styles.title}>دليل المنتجات</Text><Text style={styles.subtitle}>بيان شامل للهوية والمواصفات والإنتاج والحركة</Text></View><MaterialIcons name="inventory-2" size={32} color="#0a7ea4" /></View>
    <View style={styles.card}><Text style={styles.section}>{editing ? "تعديل بيانات المنتج" : "إضافة منتج جديد"}</Text><Text style={styles.label}>اسم المنتج *</Text><TextInput value={name} onChangeText={setName} style={styles.input} placeholder="مثال: ECO" />
      <View style={styles.row}><View style={styles.col}><Text style={styles.label}>المقاس</Text><TextInput value={size} onChangeText={setSize} style={styles.input} /></View><View style={styles.col}><Text style={styles.label}>اللون</Text><TextInput value={color} onChangeText={setColor} style={styles.input} /></View></View>
      <View style={styles.row}><View style={styles.col}><Text style={styles.label}>وزن الجورب الفردي (جرام) *</Text><TextInput value={weight} onChangeText={setWeight} keyboardType="numeric" style={styles.input} /></View><View style={styles.col}><Text style={styles.label}>الصورة (رابط)</Text><TextInput value={imageUrl} onChangeText={setImageUrl} style={styles.input} /></View></View>
      <Text style={styles.label}>وزن الخيط لكل زوج (جرام) *</Text><TextInput value={yarnWeightPerPair} onChangeText={setYarnWeightPerPair} keyboardType="numeric" style={styles.input} placeholder="مثل إدخال الإنتاج" />
      <Text style={styles.label}>أنواع الخيوط وأوزانها (جرام) مثل إدخال الإنتاج</Text><View style={styles.row}><View style={styles.col}><Text style={styles.label}>مطاط</Text><TextInput value={yarnRubber} onChangeText={setYarnRubber} keyboardType="numeric" style={styles.input} /></View><View style={styles.col}><Text style={styles.label}>سباندكس</Text><TextInput value={yarnSpandex} onChangeText={setYarnSpandex} keyboardType="numeric" style={styles.input} /></View><View style={styles.col}><Text style={styles.label}>نايلون</Text><TextInput value={yarnNylon} onChangeText={setYarnNylon} keyboardType="numeric" style={styles.input} /></View></View><View style={styles.row}><View style={styles.col}><Text style={styles.label}>قطن</Text><TextInput value={yarnCotton} onChangeText={setYarnCotton} keyboardType="numeric" style={styles.input} /></View><View style={styles.col}><Text style={styles.label}>بامبو</Text><TextInput value={yarnBamboo} onChangeText={setYarnBamboo} keyboardType="numeric" style={styles.input} /></View><View style={styles.col}><Text style={styles.label}>سبان</Text><TextInput value={yarnSpan} onChangeText={setYarnSpan} keyboardType="numeric" style={styles.input} /></View></View>
      <Text style={styles.label}>مرفق المنتج (رابط اختياري)</Text><TextInput value={attachment} onChangeText={setAttachment} style={styles.input} /><AttachmentPicker attachments={files} onAttachmentsChange={setFiles} language="ar" maxAttachments={10} />
      <View style={styles.row}><Pressable onPress={save} style={styles.primary}><MaterialIcons name="save" size={19} color="#fff" /><Text style={styles.primaryText}>{editing ? "حفظ التعديل" : "حفظ وإنشاء باركود"}</Text></Pressable>{editing ? <Pressable onPress={reset} style={styles.secondary}><Text>إلغاء</Text></Pressable> : null}</View>
    </View>
    <View style={styles.card}><View style={styles.listHeader}><Text style={styles.section}>بيانات المنتجات ({sortedItems.length})</Text><View style={styles.row}><Pressable onPress={printAllProducts} style={styles.reportButton}><MaterialIcons name="print" size={18} color="#0a7ea4" /><Text style={styles.reportText}>طباعة التقرير</Text></Pressable><Pressable onPress={load}><MaterialIcons name="refresh" size={22} color="#0a7ea4" /></Pressable></View></View>
      <TextInput value={searchQuery} onChangeText={setSearchQuery} style={styles.input} placeholder="بحث بالاسم أو الباركود أو المقاس أو اللون" placeholderTextColor="#8a98a2" />
      <View style={[styles.row, { justifyContent: "flex-end", flexWrap: "wrap" }]}><Pressable onPress={() => setSortMode("name")} style={[styles.filterButton, sortMode === "name" && styles.filterButtonActive]}><Text style={sortMode === "name" ? styles.filterTextActive : styles.filterText}>ترتيب الاسم</Text></Pressable><Pressable onPress={() => setSortMode("updated")} style={[styles.filterButton, sortMode === "updated" && styles.filterButtonActive]}><Text style={sortMode === "updated" ? styles.filterTextActive : styles.filterText}>الأحدث تحديثاً</Text></Pressable><Pressable onPress={() => setSortMode("missing")} style={[styles.filterButton, sortMode === "missing" && styles.filterButtonActive]}><Text style={sortMode === "missing" ? styles.filterTextActive : styles.filterText}>البيانات الناقصة</Text></Pressable></View>
      {loading ? <ActivityIndicator color="#0a7ea4" /> : sortedItems.length === 0 ? <Text style={styles.empty}>لا توجد منتجات محفوظة بعد</Text> : sortedItems.map((product) => { const detail = stats[product.id] || emptyStats(); const expanded = expandedId === product.id; return <View key={product.id} style={styles.itemWrap}>
        <Pressable onPress={() => setExpandedId(expanded ? null : product.id)} style={styles.item}><View style={styles.itemActions}><MaterialIcons name={expanded ? "expand-less" : "expand-more"} size={22} color="#687076" /><Pressable onPress={(event) => { event.stopPropagation?.(); router.push({ pathname: "/barcode-labels", params: { productName: product.name, color: product.color || "", barcode: product.barcode } } as any); }}><MaterialIcons name="print" size={21} color="#0a7ea4" /></Pressable><Pressable onPress={(event) => { event.stopPropagation?.(); edit(product); }}><MaterialIcons name="edit" size={21} color="#f59e0b" /></Pressable><Pressable onPress={(event) => { event.stopPropagation?.(); remove(product); }}><MaterialIcons name="delete" size={21} color="#dc2626" /></Pressable></View><View style={{ flex: 1 }}><Text style={styles.itemName}>{product.name} {product.size ? `• ${product.size}` : ""} {product.color ? `• ${product.color}` : ""}</Text><Text style={styles.barcode}>باركود ثابت: {product.barcode}</Text><Text style={styles.meta}>الوزن: {product.weightGrams ? `${product.weightGrams} جم` : "غير متوفر"} • إنتاج: {detail.productionPairs || 0} زوج</Text></View></Pressable>
        {expanded && <View style={styles.detail}><View style={styles.detailHeader}>{product.imageUrl ? <Image source={{ uri: product.imageUrl }} style={styles.productImage} /> : <MaterialIcons name="image-not-supported" size={36} color="#9aa5ad" />}<View style={{ flex: 1 }}><Text style={styles.detailTitle}>{product.name}</Text><Text style={styles.detailHint}>البيان الكامل للمنتج</Text></View></View><Text style={styles.detailLine}><Text style={styles.detailKey}>الهوية: </Text>{product.name} — المقاس: {product.size || "غير متوفر"} — اللون: {product.color || "غير متوفر"}</Text><Text style={styles.detailLine}><Text style={styles.detailKey}>الوزن: </Text>{product.weightGrams ? `${product.weightGrams} جرام` : "غير متوفر"}</Text><Text style={styles.detailLine}><Text style={styles.detailKey}>الخيوط ونسبها: </Text>{formatYarn(product.yarnDetails)}</Text><Text style={styles.detailLine}><Text style={styles.detailKey}>المرفقات: </Text>{product.attachments?.length ? `${product.attachments.length} مرفق` : "لا توجد مرفقات"}</Text><View style={styles.statGrid}><View style={styles.stat}><Text style={styles.statValue}>{detail.productionPairs}</Text><Text style={styles.statLabel}>زوج إنتاج</Text></View><View style={styles.stat}><Text style={styles.statValue}>{detail.productionDozen}</Text><Text style={styles.statLabel}>درزن إنتاج</Text></View><View style={styles.stat}><Text style={styles.statValue}>{detail.stagePairs}</Text><Text style={styles.statLabel}>زوج بالمراحل</Text></View><View style={styles.stat}><Text style={styles.statValue}>{detail.storedPairs}</Text><Text style={styles.statLabel}>زوج بالتتبع</Text></View></View><Text style={styles.detailLine}><Text style={styles.detailKey}>المكائن: </Text>{detail.machines.length ? detail.machines.join("، ") : "لا توجد سجلات إنتاج"}</Text><Text style={styles.detailLine}><Text style={styles.detailKey}>المراحل المسجلة: </Text>{detail.stages.length ? detail.stages.join("، ") : "لا توجد سجلات مراحل"}</Text><Text style={styles.detailLine}><Text style={styles.detailKey}>حركة التتبع: </Text>{detail.trackingRows ? `${detail.trackingRows} سجل` : "لا توجد حركة تتبع"}</Text></View>}
      </View>; })}
    </View>
  </ScrollView></ScreenContainer>;
}

const styles = StyleSheet.create({ container: { gap: 12, paddingBottom: 30, maxWidth: 900, width: "100%", alignSelf: "center" }, header: { flexDirection: "row", alignItems: "center", gap: 10 }, back: { backgroundColor: "#0a7ea4", padding: 8, borderRadius: 10 }, title: { fontSize: 24, fontWeight: "800", textAlign: "right", color: "#11181C" }, subtitle: { textAlign: "right", color: "#687076" }, card: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#e1e6eb", borderRadius: 16, padding: 15, gap: 7 }, section: { fontSize: 18, fontWeight: "800", textAlign: "right", color: "#11181C" }, label: { textAlign: "right", color: "#55616b", fontWeight: "700", marginTop: 4 }, input: { borderWidth: 1, borderColor: "#d5dbe1", borderRadius: 9, padding: 10, textAlign: "right", fontSize: 15, color: "#11181C" }, row: { flexDirection: "row", gap: 9, alignItems: "center" }, col: { flex: 1 }, primary: { flex: 1, backgroundColor: "#0a7ea4", padding: 13, borderRadius: 10, flexDirection: "row", justifyContent: "center", gap: 7 }, primaryText: { color: "#fff", fontWeight: "800" }, secondary: { padding: 13, borderRadius: 10, backgroundColor: "#eef1f3", alignItems: "center" }, listHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, empty: { textAlign: "right", color: "#687076", padding: 14 }, itemWrap: { borderTopWidth: 1, borderTopColor: "#edf0f2" }, item: { flexDirection: "row", gap: 10, paddingVertical: 12, alignItems: "center" }, itemActions: { flexDirection: "row", gap: 12, alignItems: "center", zIndex: 2 }, reportButton: { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderColor: "#c6dce4", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6 }, reportText: { color: "#0a7ea4", fontWeight: "700", fontSize: 12 }, filterButton: { borderWidth: 1, borderColor: "#c6dce4", borderRadius: 8, paddingHorizontal: 9, paddingVertical: 6 }, filterButtonActive: { backgroundColor: "#0a7ea4" }, filterText: { color: "#0a7ea4", fontSize: 11 }, filterTextActive: { color: "#fff", fontWeight: "700", fontSize: 11 },
 itemName: { textAlign: "right", fontWeight: "800", fontSize: 16, color: "#11181C" }, barcode: { textAlign: "right", color: "#0a7ea4", fontWeight: "700", marginTop: 3 }, meta: { textAlign: "right", color: "#687076", fontSize: 12, marginTop: 2 }, detail: { backgroundColor: "#f7fafb", borderRadius: 12, padding: 13, gap: 7, marginBottom: 10 }, detailHeader: { flexDirection: "row", alignItems: "center", gap: 10, justifyContent: "flex-end" }, productImage: { width: 58, height: 58, borderRadius: 10, backgroundColor: "#e8eef1" }, detailTitle: { textAlign: "right", fontSize: 17, fontWeight: "800", color: "#11181C" }, detailHint: { textAlign: "right", color: "#687076", fontSize: 12 }, detailLine: { textAlign: "right", color: "#3e4b54", lineHeight: 20 }, detailKey: { fontWeight: "800", color: "#0a7ea4" }, statGrid: { flexDirection: "row", gap: 7, flexWrap: "wrap", justifyContent: "flex-end", marginVertical: 4 }, stat: { minWidth: 92, flexGrow: 1, backgroundColor: "#fff", borderWidth: 1, borderColor: "#dce7eb", borderRadius: 10, padding: 8, alignItems: "center" }, statValue: { fontSize: 16, fontWeight: "800", color: "#0a7ea4" }, statLabel: { fontSize: 11, color: "#687076", marginTop: 2 } });
