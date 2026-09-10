import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { ScreenContainer } from "@/components/screen-container";
import { DateField } from "@/components/date-field";
import { AttachmentPicker } from "@/components/attachment-picker";
import type { AttachmentFile } from "@/lib/services/attachment.service";
import { manufacturingService, productTrackingService, productionService, productsService } from "@/lib/services/api.service";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";

type Product = { id: number; barcode: string; name: string; size?: string | null; color?: string | null; weightGrams?: number | null; yarnDetails?: any; imageUrl?: string | null; attachments?: string[] | null; createdAt?: string | Date | null; updatedAt?: string | Date | null };
type ProductStats = { productionRows: number; productionDozen: number; productionPairs: number; machines: string[]; stageRows: number; stageDozen: number; stagePairs: number; stages: string[]; trackingRows: number; storedPairs: number; };

const normalize = (value: unknown) => String(value ?? "")
  .normalize("NFKD")
  .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
  .replace(/[أإآٱ]/g, "ا")
  .replace(/ى/g, "ي")
  .replace(/ة/g, "ه")
  .trim()
  .replace(/\s+/g, " ")
  .toLocaleLowerCase("ar");
const splitProductName = (raw: unknown) => { const parts = String(raw ?? "").trim().split(" - ").map((x) => x.trim()); return { name: parts[0] || "", size: parts[1] || "", color: parts.slice(2).join(" - ") || "" }; };
const identityKey = (name: unknown, size?: unknown, color?: unknown) => [name, size, color].map(normalize).join("|");
const matches = (product: Product, raw: unknown, size?: unknown, color?: unknown) => {
  const parsed = splitProductName(raw);
  return identityKey(product.name, product.size, product.color) === identityKey(parsed.name, size || parsed.size, color || parsed.color) || (normalize(product.name) === normalize(raw) && !product.size && !product.color);
};
const formatYarn = (details: any, isAr = true) => {
  if (!details) return isAr ? "غير متوفر" : "Not available";
  if (typeof details === "string") return details;
  const names: Record<string, string> = isAr ? { yarnWeightPerPair: "وزن الخيط لكل زوج", yarnRubber: "مطاط", yarnSpandex: "إسباندكس", yarnNylon: "نايلون", yarnCotton: "قطن", yarnBamboo: "بامبو", yarnSpan: "سبان" } : { yarnWeightPerPair: "Thread weight per pair", yarnRubber: "Rubber", yarnSpandex: "Spandex", yarnNylon: "Nylon", yarnCotton: "Cotton", yarnBamboo: "Bamboo", yarnSpan: "Span" };
  const entries = Object.entries(details).filter(([, value]) => value !== undefined && value !== null && value !== "" && Number(value) !== 0);
  return entries.length ? entries.map(([key, value]) => `${names[key] || key}: ${key === "yarnWeightPerPair" ? value + (isAr ? " جم/زوج" : " g/pair") : value + (isAr ? " جم" : " g")}`).join(isAr ? "، " : ", ") : (isAr ? "غير متوفر" : "Not available");
};
const emptyStats = (): ProductStats => ({ productionRows: 0, productionDozen: 0, productionPairs: 0, machines: [], stageRows: 0, stageDozen: 0, stagePairs: 0, stages: [], trackingRows: 0, storedPairs: 0 });
const formatAddedDate = (value: string | Date | null | undefined, isAr: boolean) => {
  if (!value) return isAr ? "غير محدد" : "Not specified";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return new Intl.DateTimeFormat(isAr ? "ar-SA" : "en-GB", { dateStyle: "medium", timeStyle: "short" }).format(parsed);
};
const parseYarnDetails = (details: any) => {
  if (!details) return {};
  if (typeof details !== "string") return details;
  try { return JSON.parse(details); } catch { return {}; }
};
const getProductCompletion = (product: Partial<Product>) => {
  const yarn = parseYarnDetails(product.yarnDetails);
  const hasYarnTypeWeight = ["yarnRubber", "yarnSpandex", "yarnNylon", "yarnCotton", "yarnBamboo", "yarnSpan"]
    .some((field) => (Number(yarn?.[field]) || 0) > 0);
  const checks = {
    name: Boolean(String(product.name || "").trim()),
    size: Boolean(String(product.size || "").trim()) && normalize(product.size) !== "free",
    color: Boolean(String(product.color || "").trim()),
    weight: (Number(product.weightGrams) || 0) > 0,
    yarnWeightPerPair: (Number(yarn?.yarnWeightPerPair) || 0) > 0,
    yarnType: hasYarnTypeWeight,
  };
  return { checks, complete: Object.values(checks).every(Boolean) };
};

export default function ProductsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { language } = useLanguage();
  const isAr = language === "ar";
  const canCreateCatalogProduct = user?.role === "admin" || user?.department === "production" || user?.department === "الإنتاج" || String(user?.position || "").includes("مدير الإنتاج") || String(user?.position || "").toLowerCase().includes("production manager");
  const [items, setItems] = useState<Product[]>([]);
  const [stats, setStats] = useState<Record<number, ProductStats>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showAllProducts, setShowAllProducts] = useState(false);
  const [sortMode, setSortMode] = useState<"name" | "updated" | "missing">("name");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [files, setFiles] = useState<AttachmentFile[]>([]);
  const [name, setName] = useState(""); const [size, setSize] = useState(""); const [color, setColor] = useState("");
  const [weight, setWeight] = useState(""); const [yarnWeightPerPair, setYarnWeightPerPair] = useState(""); const [yarnRubber, setYarnRubber] = useState(""); const [yarnSpandex, setYarnSpandex] = useState(""); const [yarnNylon, setYarnNylon] = useState(""); const [yarnCotton, setYarnCotton] = useState(""); const [yarnBamboo, setYarnBamboo] = useState(""); const [yarnSpan, setYarnSpan] = useState(""); const [imageUrl, setImageUrl] = useState(""); const [attachment, setAttachment] = useState("");
  const formCompletion = useMemo(() => getProductCompletion({ name, size, color, weightGrams: Number(weight), yarnDetails: { yarnWeightPerPair: Number(yarnWeightPerPair), yarnRubber: Number(yarnRubber), yarnSpandex: Number(yarnSpandex), yarnNylon: Number(yarnNylon), yarnCotton: Number(yarnCotton), yarnBamboo: Number(yarnBamboo), yarnSpan: Number(yarnSpan) } }), [name, size, color, weight, yarnWeightPerPair, yarnRubber, yarnSpandex, yarnNylon, yarnCotton, yarnBamboo, yarnSpan]);
  const catalogReview = useMemo(() => {
    const complete = items.filter((product) => getProductCompletion(product).complete).length;
    return { complete, incomplete: items.length - complete };
  }, [items]);
  const completionItems = [
    { key: "name" as const, label: isAr ? "اسم المنتج" : "Product name" },
    { key: "size" as const, label: isAr ? "مقاس صحيح" : "Valid size" },
    { key: "color" as const, label: isAr ? "اللون" : "Color" },
    { key: "weight" as const, label: isAr ? "وزن الجورب" : "Sock weight" },
    { key: "yarnWeightPerPair" as const, label: isAr ? "وزن الخيط لكل زوج" : "Thread weight per pair" },
    { key: "yarnType" as const, label: isAr ? "وزن نوع خيط واحد على الأقل" : "At least one thread type weight" },
  ];

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
    } catch (error: any) { Alert.alert(isAr ? "خطأ" : "Error", error?.message || (isAr ? "تعذر تحميل بيان المنتجات" : "Unable to load product catalog")); }
    finally { setLoading(false); }
  }, [isAr]);
  useEffect(() => { load(); }, [load]);

  const reset = () => { setEditing(null); setName(""); setSize(""); setColor(""); setWeight(""); setYarnWeightPerPair(""); setYarnRubber(""); setYarnSpandex(""); setYarnNylon(""); setYarnCotton(""); setYarnBamboo(""); setYarnSpan(""); setImageUrl(""); setAttachment(""); setFiles([]); };
  const save = async () => {
    if (!canCreateCatalogProduct) return Alert.alert(isAr ? "غير مصرح" : "Not authorized", isAr ? "إنشاء المنتجات محصور على مدير الإنتاج والأدمن" : "Product creation is restricted to the Production Manager and Admin");
    const yarnWeights = { yarnRubber: Number(yarnRubber) || 0, yarnSpandex: Number(yarnSpandex) || 0, yarnNylon: Number(yarnNylon) || 0, yarnCotton: Number(yarnCotton) || 0, yarnBamboo: Number(yarnBamboo) || 0, yarnSpan: Number(yarnSpan) || 0 };
    if (normalize(size) === "free") return Alert.alert(isAr ? "مقاس غير مسموح" : "Invalid size", isAr ? "لا يمكن حفظ المنتج بمقاس FREE. اختر المقاس الفعلي والواضح للمنتج." : "Products cannot be saved with size FREE. Enter the product's actual, clear size.");
    if (!formCompletion.complete) {
      const missing = completionItems.filter((item) => !formCompletion.checks[item.key]).map((item) => item.label).join(isAr ? "، " : ", ");
      return Alert.alert(isAr ? "بيانات المنتج غير مكتملة" : "Incomplete product data", isAr ? `أكمل الحقول التالية قبل الحفظ: ${missing}` : `Complete the following before saving: ${missing}`);
    }
    const yarnDetails: any = { yarnWeightPerPair: Number(yarnWeightPerPair), ...yarnWeights };
    const uploadedFiles = files.map((file) => file.uploadedUrl || file.uri).filter(Boolean);
    const firstImage = files.find((file) => file.type === "image");
      const manualAttachments = attachment.split(/\\n+/).map((item) => item.trim()).filter(Boolean);
    const data = { name: name.trim(), size: size.trim() || undefined, color: color.trim() || undefined, weightGrams: Math.max(0, Number(weight) || 0), yarnDetails, imageUrl: imageUrl.trim() || firstImage?.uploadedUrl || firstImage?.uri || undefined, attachments: [...new Set([...manualAttachments, ...uploadedFiles])] };
    try { if (editing) await productsService.update(editing, data); else await productsService.create({ ...data, createdBy: user?.id }); Alert.alert(isAr ? "تم" : "Done", editing ? (isAr ? "تم تحديث بيان المنتج" : "Product details updated") : (isAr ? "تم حفظ المنتج وإنشاء الباركود" : "Product saved and barcode created")); reset(); await load(); } catch (error: any) { Alert.alert(isAr ? "خطأ" : "Error", error?.message || (isAr ? "تعذر حفظ المنتج" : "Unable to save product")); }
  };
  const edit = (product: Product) => { if (user?.role !== "admin") return Alert.alert(isAr ? "التعديل غير مسموح" : "Editing not allowed", isAr ? "لا يقبل التعديل على المنتج إلا من قبل مدير النظام" : "Only the system administrator can edit saved products"); const details: any = typeof product.yarnDetails === "string" ? (() => { try { return JSON.parse(product.yarnDetails); } catch { return {}; } })() : product.yarnDetails || {}; setEditing(product.id); setName(product.name); setSize(product.size || ""); setColor(product.color || ""); setWeight(String(product.weightGrams || "")); setYarnWeightPerPair(String(details.yarnWeightPerPair || "")); setYarnRubber(String(details.yarnRubber || "")); setYarnSpandex(String(details.yarnSpandex || "")); setYarnNylon(String(details.yarnNylon || "")); setYarnCotton(String(details.yarnCotton || "")); setYarnBamboo(String(details.yarnBamboo || "")); setYarnSpan(String(details.yarnSpan || "")); setImageUrl(product.imageUrl || ""); setAttachment(product.attachments?.join("\\n") || ""); };
  const remove = (product: Product) => Alert.alert(isAr ? "تأكيد الحذف" : "Confirm deletion", isAr ? `حذف ${product.name} من دليل المنتجات؟` : `Delete ${product.name} from the product catalog?`, [{ text: isAr ? "إلغاء" : "Cancel", style: "cancel" }, { text: isAr ? "حذف" : "Delete", style: "destructive", onPress: async () => { try { await productsService.delete(product.id); await load(); Alert.alert(isAr ? "تم" : "Done", isAr ? "تم حذف المنتج" : "Product deleted"); } catch (error: any) { Alert.alert(isAr ? "خطأ" : "Error", error?.message || (isAr ? "تعذر حذف المنتج" : "Unable to delete product")); } } }]);
  const hasActiveSearch = Boolean(normalize(searchQuery) || dateFrom || dateTo);
  const sortedItems = useMemo(() => {
    const query = normalize(searchQuery);
    const from = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null;
    const to = dateTo ? new Date(`${dateTo}T23:59:59.999`).getTime() : null;
    const rangeStart = from !== null && to !== null ? Math.min(from, to) : from;
    const rangeEnd = from !== null && to !== null ? Math.max(from, to) : to;
    const filtered = items.filter((product) => {
      if (showAllProducts) return true;
      if (!hasActiveSearch) return false;
      const matchesQuery = !query || [product.name, product.barcode, product.size, product.color].some((value) => normalize(value).includes(query));
      const rawDate = product.createdAt || product.updatedAt;
      const timestamp = rawDate ? new Date(rawDate).getTime() : NaN;
      return matchesQuery && (rangeStart === null || (!Number.isNaN(timestamp) && timestamp >= rangeStart)) && (rangeEnd === null || (!Number.isNaN(timestamp) && timestamp <= rangeEnd));
    });
    return [...filtered].sort((a, b) => {
      if (sortMode === "updated") return String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
      if (sortMode === "missing") return Number(!a.weightGrams || !a.yarnDetails) - Number(!b.weightGrams || !b.yarnDetails);
      return normalize(`${a.name} ${a.size || ""} ${a.color || ""}`).localeCompare(normalize(`${b.name} ${b.size || ""} ${b.color || ""}`), "ar");
    });
  }, [items, searchQuery, dateFrom, dateTo, sortMode, showAllProducts, hasActiveSearch]);
  const dailyCounts = useMemo(() => {
    const counts = new Map<string, number>();
    sortedItems.forEach((product) => {
      const rawDate = product.createdAt || product.updatedAt;
      const day = rawDate ? new Date(rawDate).toISOString().slice(0, 10) : "unknown";
      counts.set(day, (counts.get(day) || 0) + 1);
    });
    return [...counts.entries()].sort(([a], [b]) => b.localeCompare(a));
  }, [sortedItems]);
  const printAllProducts = () => {
    if (typeof window === "undefined") return Alert.alert("الطباعة", "افتح التطبيق من الويب لاستخدام تقرير الطباعة");
    const esc = (value: unknown) => String(value ?? "غير متوفر").replace(/[&<>\"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\\\"": "&quot;" } as any)[char]);
    const cards = sortedItems.map((product) => { const detail = stats[product.id] || emptyStats(); return `<section class="product"><h2>${esc(product.name)}</h2><p><b>تاريخ الإضافة:</b> ${esc(formatAddedDate(product.createdAt || product.updatedAt, true))}</p><p><b>الباركود:</b> ${esc(product.barcode)} | <b>المقاس:</b> ${esc(product.size)} | <b>اللون:</b> ${esc(product.color)}</p><p><b>الوزن:</b> ${esc(product.weightGrams ? `${product.weightGrams} جرام` : "غير متوفر")}</p><p><b>الخيوط ونسبها:</b> ${esc(formatYarn(product.yarnDetails, isAr))}</p><p><b>الإنتاج:</b> ${detail.productionPairs} زوج / ${detail.productionDozen} درزن | <b>المراحل:</b> ${detail.stagePairs} زوج | <b>التتبع:</b> ${detail.trackingRows} سجل</p><p><b>المكائن:</b> ${esc(detail.machines.join("، ") || "لا توجد سجلات")}</p><p><b>مراحل التصنيع:</b> ${esc(detail.stages.join("، ") || "لا توجد سجلات")}</p><p><b>المرفقات:</b> ${product.attachments?.length || 0}</p></section>`; }).join("");
    const report = window.open("", "_blank", "width=900,height=700");
    if (!report) return Alert.alert("الطباعة", "اسمح بالنوافذ المنبثقة ثم أعد المحاولة");
    report.document.write(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>تقرير دليل المنتجات</title><style>body{font-family:Arial,sans-serif;padding:28px;color:#111;direction:rtl}h1{text-align:center;color:#0a7ea4}.product{border:1px solid #b8c8cf;border-radius:10px;padding:14px;margin:0 0 14px;page-break-inside:avoid}.product h2{margin:0 0 8px;color:#0a7ea4}.product p{line-height:1.8;margin:3px 0}@media print{button{display:none}}</style></head><body><h1>تقرير دليل المنتجات</h1><p>عدد المنتجات: ${sortedItems.length}</p>${cards}</body></html>`);
    report.document.close(); report.focus(); report.print();
  };

  return <ScreenContainer className="p-4"><ScrollView contentContainerStyle={styles.container}>
    <View style={styles.header}><Pressable onPress={() => router.back()} style={styles.back}><MaterialIcons name="arrow-forward" size={22} color="#fff" /></Pressable><View style={{ flex: 1 }}><Text style={styles.title}>{isAr ? "دليل المنتجات" : "Product Catalog"}</Text><Text style={styles.subtitle}>{isAr ? "بيان شامل للهوية والمواصفات والإنتاج والحركة" : "Complete product identity, specifications, production, and movement report"}</Text></View><MaterialIcons name="inventory-2" size={32} color="#0a7ea4" /></View>
    <View style={styles.reviewSummary}><View style={{ flex: 1 }}><Text style={styles.reviewTitle}>{isAr ? "مراجعة واعتماد دليل المنتجات" : "Product catalog review"}</Text><Text style={styles.reviewSubtitle}>{catalogReview.incomplete === 0 ? (isAr ? "جميع المنتجات الحالية مكتملة وواضحة" : "All current products are complete and clear") : (isAr ? "توجد منتجات تحتاج استكمال بياناتها" : "Some products need their data completed")}</Text></View><View style={styles.reviewCounts}><View style={styles.reviewCount}><Text style={styles.reviewCountValue}>{catalogReview.complete}</Text><Text style={styles.reviewCountLabel}>{isAr ? "مكتمل" : "Complete"}</Text></View><View style={[styles.reviewCount, catalogReview.incomplete > 0 && styles.reviewCountWarning]}><Text style={[styles.reviewCountValue, catalogReview.incomplete > 0 && { color: "#dc2626" }]}>{catalogReview.incomplete}</Text><Text style={styles.reviewCountLabel}>{isAr ? "يحتاج استكمال" : "Needs review"}</Text></View></View></View>
    {canCreateCatalogProduct ? <View style={styles.card}><Text style={styles.section}>{editing ? (isAr ? "تعديل بيانات المنتج" : "Edit product details") : (isAr ? "إضافة منتج جديد" : "Add new product")}</Text><View style={styles.completionPanel}><View style={styles.completionHeader}><MaterialIcons name={formCompletion.complete ? "verified" : "fact-check"} size={20} color={formCompletion.complete ? "#15803d" : "#b45309"} /><Text style={[styles.completionTitle, { color: formCompletion.complete ? "#15803d" : "#92400e" }]}>{formCompletion.complete ? (isAr ? "المنتج جاهز للحفظ" : "Product is ready to save") : (isAr ? "أكمل متطلبات الحفظ" : "Complete the save requirements")}</Text></View><View style={styles.completionGrid}>{completionItems.map((item) => { const done = formCompletion.checks[item.key]; return <View key={item.key} style={[styles.completionItem, done ? styles.completionItemDone : styles.completionItemPending]}><MaterialIcons name={done ? "check-circle" : "radio-button-unchecked"} size={15} color={done ? "#15803d" : "#b45309"} /><Text style={[styles.completionItemText, { color: done ? "#166534" : "#92400e" }]}>{item.label}</Text></View>; })}</View></View><Text style={styles.label}>{isAr ? "اسم المنتج *" : "Product name *"}</Text><TextInput value={name} onChangeText={setName} style={styles.input} placeholder={isAr ? "مثال: ECO" : "Example: ECO"} />
      <View style={styles.row}><View style={styles.col}><Text style={styles.label}>{isAr ? "المقاس" : "Size"}</Text><TextInput value={size} onChangeText={setSize} style={styles.input} /></View><View style={styles.col}><Text style={styles.label}>{isAr ? "اللون" : "Color"}</Text><TextInput value={color} onChangeText={setColor} style={styles.input} /></View></View>
      <View style={styles.row}><View style={styles.col}><Text style={styles.label}>{isAr ? "وزن الجورب الفردي (جرام) *" : "Individual sock weight (g) *"}</Text><TextInput value={weight} onChangeText={setWeight} keyboardType="numeric" style={styles.input} /></View><View style={styles.col}><Text style={styles.label}>{isAr ? "الصورة (رابط)" : "Image (URL)"}</Text><TextInput value={imageUrl} onChangeText={setImageUrl} style={styles.input} /></View></View>
      <Text style={styles.label}>{isAr ? "وزن الخيط لكل زوج (جرام) *" : "Thread weight per pair (g) *"}</Text><TextInput value={yarnWeightPerPair} onChangeText={setYarnWeightPerPair} keyboardType="numeric" style={styles.input} placeholder={isAr ? "مثل إدخال الإنتاج" : "Same as production entry"} />
      <Text style={styles.label}>{isAr ? "أنواع الخيوط وأوزانها (جرام) مثل إدخال الإنتاج" : "Thread types and weights (g), same as production entry"}</Text><View style={styles.row}><View style={styles.col}><Text style={styles.label}>{isAr ? "مطاط" : "Rubber"}</Text><TextInput value={yarnRubber} onChangeText={setYarnRubber} keyboardType="numeric" style={styles.input} /></View><View style={styles.col}><Text style={styles.label}>{isAr ? "سباندكس" : "Spandex"}</Text><TextInput value={yarnSpandex} onChangeText={setYarnSpandex} keyboardType="numeric" style={styles.input} /></View><View style={styles.col}><Text style={styles.label}>{isAr ? "نايلون" : "Nylon"}</Text><TextInput value={yarnNylon} onChangeText={setYarnNylon} keyboardType="numeric" style={styles.input} /></View></View><View style={styles.row}><View style={styles.col}><Text style={styles.label}>{isAr ? "قطن" : "Cotton"}</Text><TextInput value={yarnCotton} onChangeText={setYarnCotton} keyboardType="numeric" style={styles.input} /></View><View style={styles.col}><Text style={styles.label}>{isAr ? "بامبو" : "Bamboo"}</Text><TextInput value={yarnBamboo} onChangeText={setYarnBamboo} keyboardType="numeric" style={styles.input} /></View><View style={styles.col}><Text style={styles.label}>{isAr ? "سبان" : "Span"}</Text><TextInput value={yarnSpan} onChangeText={setYarnSpan} keyboardType="numeric" style={styles.input} /></View></View>
      <Text style={styles.label}>{isAr ? "مرفق المنتج (رابط اختياري)" : "Product attachment (optional URL)"}</Text><TextInput value={attachment} onChangeText={setAttachment} style={styles.input} /><AttachmentPicker attachments={files} onAttachmentsChange={setFiles} language={language} maxAttachments={10} />
      <View style={styles.row}><Pressable onPress={save} style={[styles.primary, !formCompletion.complete && styles.primaryIncomplete]}><MaterialIcons name="save" size={19} color="#fff" /><Text style={styles.primaryText}>{editing ? (isAr ? "حفظ التعديل" : "Save changes") : (isAr ? "حفظ وإنشاء باركود" : "Save and create barcode")}</Text></Pressable>{editing ? <Pressable onPress={reset} style={styles.secondary}><Text>{isAr ? "إلغاء" : "Cancel"}</Text></Pressable> : null}</View>
    </View> : <View style={[styles.card, { backgroundColor: "#f0f9ff", borderColor: "#7dd3fc", alignItems: "center" }]}><MaterialIcons name="lock" size={28} color="#0369a1" /><Text style={[styles.section, { color: "#075985", textAlign: "center" }]}>{isAr ? "عرض دليل المنتجات فقط" : "Product catalog view only"}</Text><Text style={{ color: "#0c4a6e", textAlign: "center", lineHeight: 20 }}>{isAr ? "إضافة المنتجات الجديدة محصورة على مدير الإنتاج والأدمن. ستظهر المنتجات للعمال تلقائياً ضمن قائمة الاستلام في مرحلتهم." : "New products can only be added by the Production Manager or Admin. Products appear automatically in each worker's receipt queue."}</Text></View>}
    <View style={styles.card}><View style={styles.listHeader}><View style={{ flex: 1 }}><Text style={styles.section}>{showAllProducts ? (isAr ? "جميع المنتجات المحفوظة" : "All saved products") : (isAr ? "محرك بحث المنتجات" : "Product search")} ({sortedItems.length})</Text><Text style={styles.searchHint}>{isAr ? "يمكن البحث بالاسم وحده، والتاريخ اختياري" : "Search by name only; dates are optional"}</Text></View><View style={[styles.row, { flexWrap: "wrap", justifyContent: "flex-end" }]}><Pressable onPress={() => { setShowAllProducts((current) => !current); setSearchQuery(""); setDateFrom(""); setDateTo(""); }} style={[styles.catalogButton, showAllProducts && styles.catalogButtonActive]}><MaterialIcons name={showAllProducts ? "search" : "inventory-2"} size={18} color={showAllProducts ? "#ffffff" : "#0a7ea4"} /><Text style={showAllProducts ? styles.catalogButtonTextActive : styles.catalogButtonText}>{showAllProducts ? (isAr ? "العودة للبحث" : "Back to search") : (isAr ? `المنتجات المحفوظة (${items.length})` : `Saved products (${items.length})`)}</Text></Pressable><Pressable disabled={!sortedItems.length} onPress={printAllProducts} style={[styles.reportButton, !sortedItems.length && styles.buttonDisabled]}><MaterialIcons name="print" size={18} color="#0a7ea4" /><Text style={styles.reportText}>{isAr ? "طباعة النتائج" : "Print results"}</Text></Pressable><Pressable onPress={load}><MaterialIcons name="refresh" size={22} color="#0a7ea4" /></Pressable></View></View>
      <TextInput value={searchQuery} onChangeText={(value) => { setSearchQuery(value); setShowAllProducts(false); }} style={styles.input} placeholder={isAr ? "ابحث بالاسم فقط أو الباركود أو المقاس أو اللون" : "Search by name only, barcode, size, or color"} placeholderTextColor="#8a98a2" returnKeyType="search" />
      <View style={[styles.row, { justifyContent: "flex-end", flexWrap: "wrap" }]}><DateField value={dateFrom} onChange={(value) => { setDateFrom(value); setShowAllProducts(false); }} label={isAr ? "من تاريخ (اختياري)" : "From date (optional)"} isAr={isAr} defaultToToday={false} /><DateField value={dateTo} onChange={(value) => { setDateTo(value); setShowAllProducts(false); }} label={isAr ? "إلى تاريخ (اختياري)" : "To date (optional)"} isAr={isAr} defaultToToday={false} /><Pressable onPress={() => { setDateFrom(""); setDateTo(""); setShowAllProducts(false); }} style={styles.filterButton}><Text style={styles.filterText}>{isAr ? "مسح التاريخ" : "Clear dates"}</Text></Pressable></View>
      <View style={[styles.row, { justifyContent: "flex-end", flexWrap: "wrap" }]}><Pressable onPress={() => setSortMode("name")} style={[styles.filterButton, sortMode === "name" && styles.filterButtonActive]}><Text style={sortMode === "name" ? styles.filterTextActive : styles.filterText}>{isAr ? "ترتيب الاسم" : "Sort by name"}</Text></Pressable><Pressable onPress={() => setSortMode("updated")} style={[styles.filterButton, sortMode === "updated" && styles.filterButtonActive]}><Text style={sortMode === "updated" ? styles.filterTextActive : styles.filterText}>{isAr ? "الأحدث تحديثاً" : "Recently updated"}</Text></Pressable><Pressable onPress={() => setSortMode("missing")} style={[styles.filterButton, sortMode === "missing" && styles.filterButtonActive]}><Text style={sortMode === "missing" ? styles.filterTextActive : styles.filterText}>{isAr ? "البيانات الناقصة" : "Missing data"}</Text></Pressable></View>
      <View style={{ gap: 3, paddingVertical: 4 }}>{dailyCounts.map(([day, count]) => <Text key={day} style={styles.meta}>{day === "unknown" ? (isAr ? "بدون تاريخ" : "No date") : day}: {count} {isAr ? "منتج" : "product(s)"}</Text>)}</View>
      {loading ? <ActivityIndicator color="#0a7ea4" /> : !showAllProducts && !hasActiveSearch ? <View style={styles.searchEmpty}><MaterialIcons name="search" size={32} color="#0a7ea4" /><Text style={styles.empty}>{isAr ? "أدخل اسم المنتج أو أي معيار بحث. التاريخ غير إلزامي، ولن تظهر المنتجات هنا إلا بعد البحث." : "Enter a product name or another search criterion. Dates are optional, and products appear here only after searching."}</Text><Text style={styles.searchEmptyNote}>{isAr ? "لعرض القائمة العامة استخدم أيقونة «المنتجات المحفوظة» أعلاه." : "Use the Saved products icon above to open the complete catalog."}</Text></View> : sortedItems.length === 0 ? <Text style={styles.empty}>{isAr ? "لا توجد منتجات مطابقة لمعايير البحث" : "No products match the search criteria"}</Text> : sortedItems.map((product) => { const detail = stats[product.id] || emptyStats(); const expanded = expandedId === product.id; return <View key={product.id} style={styles.itemWrap}>
        <Pressable onPress={() => setExpandedId(expanded ? null : product.id)} style={styles.item}><View style={styles.itemActions}><MaterialIcons name={expanded ? "expand-less" : "expand-more"} size={22} color="#687076" /><Pressable onPress={(event) => { event.stopPropagation?.(); router.push({ pathname: "/barcode-labels", params: { productName: product.name, color: product.color || "", barcode: product.barcode } } as any); }}><MaterialIcons name="print" size={21} color="#0a7ea4" /></Pressable><Pressable onPress={(event) => { event.stopPropagation?.(); edit(product); }}><MaterialIcons name="edit" size={21} color="#f59e0b" /></Pressable><Pressable onPress={(event) => { event.stopPropagation?.(); remove(product); }}><MaterialIcons name="delete" size={21} color="#dc2626" /></Pressable></View><View style={{ flex: 1 }}><View style={styles.itemTitleRow}><View style={getProductCompletion(product).complete ? styles.completeBadge : styles.incompleteBadge}><MaterialIcons name={getProductCompletion(product).complete ? "verified" : "error-outline"} size={14} color={getProductCompletion(product).complete ? "#15803d" : "#dc2626"} /><Text style={getProductCompletion(product).complete ? styles.completeBadgeText : styles.incompleteBadgeText}>{getProductCompletion(product).complete ? (isAr ? "مكتمل ومعتمد" : "Complete") : (isAr ? "يحتاج استكمال" : "Needs completion")}</Text></View><Text style={styles.itemName}>{product.name} {product.size ? `• ${product.size}` : ""} {product.color ? `• ${product.color}` : ""}</Text></View><Text style={styles.barcode}>{isAr ? "باركود ثابت" : "Fixed barcode"}: {product.barcode}</Text><Text style={styles.meta}>{isAr ? "تاريخ الإضافة" : "Added"}: {formatAddedDate(product.createdAt || product.updatedAt, isAr)} • {isAr ? "الوزن" : "Weight"}: {product.weightGrams ? `${product.weightGrams} ${isAr ? "جم" : "g"}` : (isAr ? "غير متوفر" : "Not available")} • {isAr ? "الإنتاج" : "Production"}: {detail.productionPairs || 0} {isAr ? "زوج" : "pairs"}</Text></View></Pressable>
        {expanded && <View style={styles.detail}><View style={styles.detailHeader}>{product.imageUrl ? <Image source={{ uri: product.imageUrl }} style={styles.productImage} /> : <MaterialIcons name="image-not-supported" size={36} color="#9aa5ad" />}<View style={{ flex: 1 }}><Text style={styles.detailTitle}>{product.name}</Text><Text style={styles.detailHint}>{isAr ? "البيان الكامل للمنتج" : "Complete product details"}</Text></View></View><Text style={styles.detailLine}><Text style={styles.detailKey}>{isAr ? "الهوية" : "Identity"}: </Text>{product.name} — {isAr ? "المقاس" : "Size"}: {product.size || (isAr ? "غير متوفر" : "Not available")} — {isAr ? "اللون" : "Color"}: {product.color || (isAr ? "غير متوفر" : "Not available")}</Text><Text style={styles.detailLine}><Text style={styles.detailKey}>{isAr ? "تاريخ الإضافة" : "Added date"}: </Text>{formatAddedDate(product.createdAt || product.updatedAt, isAr)}</Text><Text style={styles.detailLine}><Text style={styles.detailKey}>{isAr ? "الوزن" : "Weight"}: </Text>{product.weightGrams ? `${product.weightGrams} ${isAr ? "جرام" : "g"}` : (isAr ? "غير متوفر" : "Not available")}</Text><Text style={styles.detailLine}><Text style={styles.detailKey}>{isAr ? "الخيوط ونسبها" : "Threads and ratios"}: </Text>{formatYarn(product.yarnDetails, isAr)}</Text><Text style={styles.detailLine}><Text style={styles.detailKey}>{isAr ? "المرفقات" : "Attachments"}: </Text>{product.attachments?.length ? `${product.attachments.length} ${isAr ? "مرفق" : "attachment(s)"}` : (isAr ? "لا توجد مرفقات" : "No attachments")}</Text><View style={styles.statGrid}><View style={styles.stat}><Text style={styles.statValue}>{detail.productionPairs}</Text><Text style={styles.statLabel}>{isAr ? "زوج إنتاج" : "Production pairs"}</Text></View><View style={styles.stat}><Text style={styles.statValue}>{detail.productionDozen}</Text><Text style={styles.statLabel}>{isAr ? "درزن إنتاج" : "Production dozen"}</Text></View><View style={styles.stat}><Text style={styles.statValue}>{detail.stagePairs}</Text><Text style={styles.statLabel}>{isAr ? "زوج بالمراحل" : "Stage pairs"}</Text></View><View style={styles.stat}><Text style={styles.statValue}>{detail.storedPairs}</Text><Text style={styles.statLabel}>{isAr ? "زوج بالتتبع" : "Tracked pairs"}</Text></View></View><Text style={styles.detailLine}><Text style={styles.detailKey}>{isAr ? "المكائن" : "Machines"}: </Text>{detail.machines.length ? detail.machines.join(isAr ? "، " : ", ") : (isAr ? "لا توجد سجلات إنتاج" : "No production records")}</Text><Text style={styles.detailLine}><Text style={styles.detailKey}>{isAr ? "المراحل المسجلة" : "Recorded stages"}: </Text>{detail.stages.length ? detail.stages.join(isAr ? "، " : ", ") : (isAr ? "لا توجد سجلات مراحل" : "No stage records")}</Text><Text style={styles.detailLine}><Text style={styles.detailKey}>{isAr ? "حركة التتبع" : "Tracking movements"}: </Text>{detail.trackingRows ? `${detail.trackingRows} ${isAr ? "سجل" : "record(s)"}` : (isAr ? "لا توجد حركة تتبع" : "No tracking movements")}</Text></View>}
      </View>; })}
    </View>
  </ScrollView></ScreenContainer>;
}

const styles = StyleSheet.create({ container: { gap: 12, paddingBottom: 30, maxWidth: 900, width: "100%", alignSelf: "center" }, header: { flexDirection: "row", alignItems: "center", gap: 10 }, back: { backgroundColor: "#0a7ea4", padding: 8, borderRadius: 10 }, title: { fontSize: 24, fontWeight: "800", textAlign: "right", color: "#11181C" }, subtitle: { textAlign: "right", color: "#687076" }, reviewSummary: { backgroundColor: "#f0fdf4", borderWidth: 1, borderColor: "#86efac", borderRadius: 16, padding: 14, flexDirection: "row", alignItems: "center", gap: 12, flexWrap: "wrap" }, reviewTitle: { textAlign: "right", color: "#166534", fontSize: 16, fontWeight: "900" }, reviewSubtitle: { textAlign: "right", color: "#15803d", fontSize: 12, marginTop: 3 }, reviewCounts: { flexDirection: "row", gap: 8 }, reviewCount: { minWidth: 78, alignItems: "center", backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#bbf7d0", borderRadius: 10, padding: 8 }, reviewCountWarning: { borderColor: "#fecaca", backgroundColor: "#fef2f2" }, reviewCountValue: { color: "#15803d", fontSize: 18, fontWeight: "900" }, reviewCountLabel: { color: "#55616b", fontSize: 10, fontWeight: "700", marginTop: 1 }, card: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#e1e6eb", borderRadius: 16, padding: 15, gap: 7 }, section: { fontSize: 18, fontWeight: "800", textAlign: "right", color: "#11181C" }, completionPanel: { backgroundColor: "#fffbeb", borderWidth: 1, borderColor: "#fde68a", borderRadius: 12, padding: 10, gap: 7 }, completionHeader: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 6 }, completionTitle: { textAlign: "right", fontWeight: "900", fontSize: 13 }, completionGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-end", gap: 6 }, completionItem: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 }, completionItemDone: { backgroundColor: "#dcfce7" }, completionItemPending: { backgroundColor: "#fef3c7" }, completionItemText: { fontSize: 10, fontWeight: "800" }, searchHint: { textAlign: "right", color: "#687076", fontSize: 12, marginTop: 2 }, label: { textAlign: "right", color: "#55616b", fontWeight: "700", marginTop: 4 }, input: { borderWidth: 1, borderColor: "#d5dbe1", borderRadius: 9, padding: 10, textAlign: "right", fontSize: 15, color: "#11181C" }, row: { flexDirection: "row", gap: 9, alignItems: "center" }, col: { flex: 1 }, primary: { flex: 1, backgroundColor: "#0a7ea4", padding: 13, borderRadius: 10, flexDirection: "row", justifyContent: "center", gap: 7 }, primaryIncomplete: { backgroundColor: "#64748b" }, primaryText: { color: "#fff", fontWeight: "800" }, secondary: { padding: 13, borderRadius: 10, backgroundColor: "#eef1f3", alignItems: "center" }, listHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }, empty: { textAlign: "center", color: "#687076", padding: 14 }, searchEmpty: { alignItems: "center", justifyContent: "center", paddingVertical: 24, paddingHorizontal: 12, backgroundColor: "#f7fafb", borderRadius: 12, marginTop: 4 }, searchEmptyNote: { textAlign: "center", color: "#0a7ea4", fontWeight: "700", fontSize: 12 }, itemWrap: { borderTopWidth: 1, borderTopColor: "#edf0f2" }, item: { flexDirection: "row", gap: 10, paddingVertical: 12, alignItems: "center" }, itemActions: { flexDirection: "row", gap: 12, alignItems: "center", zIndex: 2 }, itemTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 7, flexWrap: "wrap" }, completeBadge: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "#dcfce7", borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3 }, completeBadgeText: { color: "#15803d", fontWeight: "800", fontSize: 10 }, incompleteBadge: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "#fee2e2", borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3 }, incompleteBadgeText: { color: "#dc2626", fontWeight: "800", fontSize: 10 }, reportButton: { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderColor: "#c6dce4", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6 }, reportText: { color: "#0a7ea4", fontWeight: "700", fontSize: 12 }, buttonDisabled: { opacity: 0.4 }, catalogButton: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderColor: "#0a7ea4", borderRadius: 8, paddingHorizontal: 9, paddingVertical: 6 }, catalogButtonActive: { backgroundColor: "#0a7ea4" }, catalogButtonText: { color: "#0a7ea4", fontWeight: "800", fontSize: 12 }, catalogButtonTextActive: { color: "#fff", fontWeight: "800", fontSize: 12 }, filterButton: { borderWidth: 1, borderColor: "#c6dce4", borderRadius: 8, paddingHorizontal: 9, paddingVertical: 6 }, filterButtonActive: { backgroundColor: "#0a7ea4" }, filterText: { color: "#0a7ea4", fontSize: 11 }, filterTextActive: { color: "#fff", fontWeight: "700", fontSize: 11 },
 itemName: { textAlign: "right", fontWeight: "800", fontSize: 16, color: "#11181C" }, barcode: { textAlign: "right", color: "#0a7ea4", fontWeight: "700", marginTop: 3 }, meta: { textAlign: "right", color: "#687076", fontSize: 12, marginTop: 2 }, detail: { backgroundColor: "#f7fafb", borderRadius: 12, padding: 13, gap: 7, marginBottom: 10 }, detailHeader: { flexDirection: "row", alignItems: "center", gap: 10, justifyContent: "flex-end" }, productImage: { width: 58, height: 58, borderRadius: 10, backgroundColor: "#e8eef1" }, detailTitle: { textAlign: "right", fontSize: 17, fontWeight: "800", color: "#11181C" }, detailHint: { textAlign: "right", color: "#687076", fontSize: 12 }, detailLine: { textAlign: "right", color: "#3e4b54", lineHeight: 20 }, detailKey: { fontWeight: "800", color: "#0a7ea4" }, statGrid: { flexDirection: "row", gap: 7, flexWrap: "wrap", justifyContent: "flex-end", marginVertical: 4 }, stat: { minWidth: 92, flexGrow: 1, backgroundColor: "#fff", borderWidth: 1, borderColor: "#dce7eb", borderRadius: 10, padding: 8, alignItems: "center" }, statValue: { fontSize: 16, fontWeight: "800", color: "#0a7ea4" }, statLabel: { fontSize: 11, color: "#687076", marginTop: 2 } });
