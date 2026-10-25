import { accountBelongsToStage } from "@shared/custody-policy";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { BackButton } from "@/components/back-button";
import { DateField } from "@/components/date-field";
import { TimeField } from "@/components/time-field";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";
import { isEnglish, localize, textAlignFor, writingDirection } from "@/lib/i18n/runtime";
import { productsService, trpcCall } from "@/lib/services/api.service";
import { productionMetrics } from "@shared/operational-report";
import { calculateYarnBreakdown, normalizeIssuedYarnGrams } from "@shared/yarn-breakdown";
import type { CustodyAccount, CustodyBatchInput, CustodyProduct } from "@/shared/custody-contract";

const MAX_PRODUCTS_PER_MACHINE_SHIFT = 5;
const operationId = () => globalThis.crypto?.randomUUID?.() || `batch-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const numberInput = (value: string) => value.replace(/[٠-٩]/g, c => String("٠١٢٣٤٥٦٧٨٩".indexOf(c))).replace(/[۰-۹]/g, c => String("۰۱۲۳۴۵۶۷۸۹".indexOf(c)));
const cleanInt = (value: string) => /^\d+$/.test(numberInput(value)) && Number.isSafeInteger(Number(numberInput(value))) ? Number(numberInput(value)) : NaN;
const riyadhDay = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const isValidTime = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
const automaticItemCode = (...parts: string[]) => parts.map(part => part.trim().replace(/\s+/g, "-")).filter(Boolean).join("-");
const MACHINE_OPTIONS = ["RB1", "RB2", "RB3", "RB4", "RB5", "RB6", "RB7", "RB8", "RB9", "NS1", "RS1", "RS2", "RS3", "RS4", "RS5", "RS6", "RS7", "RS8", "RS9", "RS10", "RS11", "LT1", "LT2"];
const DEFAULT_SHIFT_OPTIONS = [
  { value: "morning", ar: "صباحية", en: "Morning" },
  { value: "evening", ar: "مسائية", en: "Evening" },
  { value: "night", ar: "ليلية", en: "Night" },
];

/** Every product remains an independent batch and independent custody after the one-click group save. */
type DraftProduct = {
  key: string;
  name: string;
  size: string;
  color: string;
  antiSlip: boolean | null;
  yarns: { name: string; percentage: string }[];
  yarnWeight: string;
  weightUnit: "g" | "kg";
  pairWeight: string;
  firstD: string;
  firstP: string;
  secondD: string;
  secondP: string;
  wasteThread: string;
  wasteSocks: string;
  needlesUsed: string;
  wasteNeedles: string;
};

type CatalogProduct = {
  id: number | string;
  name?: string | null;
  size?: string | null;
  color?: string | null;
  barcode?: string | null;
  weightGrams?: number | string | null;
  yarnDetails?: unknown;
};

const newDraft = (): DraftProduct => ({
  key: operationId(),
  name: "", size: "", color: "", antiSlip: null,
  yarns: [{ name: "", percentage: "100" }],
  yarnWeight: "", weightUnit: "g", pairWeight: "",
  firstD: "0", firstP: "0", secondD: "0", secondP: "0",
  wasteThread: "", wasteSocks: "", needlesUsed: "", wasteNeedles: "",
});

const parseDetails = (details: unknown): Record<string, unknown> => {
  if (details && typeof details === "object" && !Array.isArray(details)) return details as Record<string, unknown>;
  if (typeof details === "string") {
    try {
      const parsed = JSON.parse(details);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch { return {}; }
  }
  return {};
};

const yarnsFromCatalog = (details: Record<string, unknown>) => {
  if (Array.isArray(details.yarns)) {
    const saved = details.yarns
      .map((yarn: any) => ({ name: String(yarn?.name || "").trim(), percentage: String(yarn?.percentage ?? "") }))
      .filter(yarn => yarn.name && Number(yarn.percentage) > 0);
    if (saved.length) return saved;
  }
  const legacyNames: Record<string, string> = {
    yarnRubber: "مطاط", yarnSpandex: "سباندكس", yarnNylon: "نايلون", yarnCotton: "قطن", yarnBamboo: "بامبو", yarnSpan: "سبان",
  };
  const legacy = Object.entries(legacyNames)
    .map(([key, name]) => ({ name, amount: Number(details[key] || 0) }))
    .filter(item => item.amount > 0);
  const total = legacy.reduce((sum, item) => sum + item.amount, 0);
  return total > 0
    ? legacy.map(item => ({ name: item.name, percentage: String(Math.round((item.amount / total) * 10000) / 100) }))
    : [{ name: "", percentage: "100" }];
};

const draftFromCatalog = (product: CatalogProduct): DraftProduct => {
  const details = parseDetails(product.yarnDetails);
  const pairWeight = Number(details.yarnWeightPerPair || product.weightGrams || 0);
  return {
    ...newDraft(),
    name: String(product.name || ""),
    size: String(product.size || ""),
    color: String(product.color || ""),
    antiSlip: typeof details.antiSlip === "boolean" ? details.antiSlip : null,
    yarns: yarnsFromCatalog(details),
    pairWeight: pairWeight > 0 ? String(pairWeight) : "",
  };
};

type RowFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  language: "ar" | "en";
  required?: boolean;
  numeric?: boolean;
  editable?: boolean;
  placeholder?: string;
};

const RowField = ({ label, value, onChange, language, required = true, numeric = false, editable = true, placeholder }: RowFieldProps) => {
  const textStyle = { textAlign: textAlignFor(language), writingDirection: writingDirection(language) } as const;
  return (
    <View style={s.field}>
      <Text style={[s.label, textStyle]}>{label}{required ? " *" : ""}</Text>
      <TextInput
        accessibilityLabel={label}
        editable={editable}
        style={[s.input, !editable && s.readonly, textStyle]}
        value={value}
        onChangeText={next => onChange(numeric ? numberInput(next) : next)}
        keyboardType={numeric ? "decimal-pad" : "default"}
        placeholder={placeholder}
        placeholderTextColor="#64748b"
      />
    </View>
  );
};

type SelectOption = { value: string; label: string };
type SelectFieldProps = { label: string; value: string; options: SelectOption[]; placeholder: string; language: "ar" | "en"; open: boolean; onToggle: () => void; onChange: (value: string) => void };
const SelectField = ({ label, value, options, placeholder, language, open, onToggle, onChange }: SelectFieldProps) => {
  const textStyle = { textAlign: textAlignFor(language), writingDirection: writingDirection(language) } as const;
  const selectedLabel = options.find(option => option.value === value)?.label || value;
  return <View style={s.field}>
    <Text style={[s.label, textStyle]}>{label} *</Text>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ expanded: open }} onPress={onToggle}
      style={[s.input, s.selectTrigger, { flexDirection: language === "en" ? "row" : "row-reverse" }]}>
      <Text numberOfLines={1} style={[s.selectValue, !selectedLabel && s.placeholder, textStyle]}>{selectedLabel || placeholder}</Text>
      <Text accessibilityElementsHidden style={s.selectChevron}>{open ? "⌃" : "⌄"}</Text>
    </TouchableOpacity>
    {open && <View style={[s.selectMenu, { alignItems: language === "en" ? "flex-start" : "flex-end" }]}>
      {options.map(option => <TouchableOpacity key={option.value} accessibilityRole="button" accessibilityLabel={option.label} onPress={() => onChange(option.value)} style={[s.selectOption, option.value === value && s.selectOptionSelected]}>
        <Text style={[s.chipText, option.value === value && s.selectedText, textStyle]}>{option.label}</Text>
      </TouchableOpacity>)}
    </View>}
  </View>;
};

export default function CustodyBatchEntry() {
  const router = useRouter();
  const { user } = useAuth();
  const { language } = useLanguage();
  const english = isEnglish(language);
  const textAlign = textAlignFor(language);
  const direction = writingDirection(language);
  const l = (arabic: string, englishText: string) => localize(language, arabic, englishText);
  const textStyle = { textAlign, writingDirection: direction } as const;
  const flowStyle = { flexDirection: english ? "row" : "row-reverse" } as const;
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams<{ sampleRequestId?: string; legacySourceId?: string }>();
  const sampleId = Number(params.sampleRequestId) || undefined;
  const legacyId = Number(params.legacySourceId) || undefined;

  const [accounts, setAccounts] = useState<CustodyAccount[]>([]);
  const [catalog, setCatalog] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [activeDraftIndex, setActiveDraftIndex] = useState(0);
  const [drafts, setDrafts] = useState<DraftProduct[]>([newDraft()]);
  const [date, setDate] = useState(riyadhDay);
  const [productionEndDate, setProductionEndDate] = useState(date);
  const [workStartTime, setWorkStartTime] = useState("08:00");
  const [workEndTime, setWorkEndTime] = useState("16:00");
  const [machine, setMachine] = useState("");
  const [shift, setShift] = useState("");
  const [openSelect, setOpenSelect] = useState<"machine" | "shift" | null>(null);
  const [order, setOrder] = useState("");
  const [owner, setOwner] = useState(Number(user?.id) || 0);
  const [sample, setSample] = useState<any>(null);
  const [legacy, setLegacy] = useState<any>(null);
  const [importReason, setImportReason] = useState("");
  const operation = useRef(operationId());
  const lastPayload = useRef("");

  const canCreate = user?.role === "admin" || (["manager", "supervisor"].includes(String(user?.role)) && accountBelongsToStage(user?.department, "production"));
  const productionAccounts = useMemo(() => {
    const listed = accounts.filter(account => accountBelongsToStage(account.department, "production"));
    if (listed.length) return listed;
    return user && accountBelongsToStage(user.department, "production") ? [{ id: user.id, name: user.name, department: user.department || "production", role: user.role }] : [];
  }, [accounts, user]);
  const suggestions = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (needle.length < 2) return [];
    return catalog.filter(product => [product.name, product.size, product.color, product.barcode]
      .some(value => String(value || "").toLocaleLowerCase().includes(needle)));
  }, [query, catalog]);
  const machineOptions = useMemo(() => MACHINE_OPTIONS.map(value => ({ value, label: value })), []);
  const shiftOptions = useMemo(() => DEFAULT_SHIFT_OPTIONS.map(option => ({ value: option.value, label: english ? option.en : option.ar })), [english]);
  const displayError = (caught: unknown, fallback: string) => {
    const message = caught instanceof Error ? caught.message : fallback;
    return english && /[\u0600-\u06FF]/.test(message) ? fallback : message;
  };

  const replaceDraft = (index: number, patch: Partial<DraftProduct>) => setDrafts(current => current.map((draft, itemIndex) => itemIndex === index ? { ...draft, ...patch } : draft));
  const changeYarn = (draftIndex: number, yarnIndex: number, patch: Partial<DraftProduct["yarns"][number]>) => setDrafts(current => current.map((draft, itemIndex) => itemIndex === draftIndex ? {
    ...draft, yarns: draft.yarns.map((yarn, index) => index === yarnIndex ? { ...yarn, ...patch } : yarn),
  } : draft));
  const addYarn = (draftIndex: number) => replaceDraft(draftIndex, { yarns: [...drafts[draftIndex].yarns, { name: "", percentage: "" }] });
  const removeYarn = (draftIndex: number, yarnIndex: number) => replaceDraft(draftIndex, { yarns: drafts[draftIndex].yarns.filter((_, index) => index !== yarnIndex) });

  // The catalog is deliberately loaded separately from protected accounts. A stale
  // employee session must never turn an existing products catalog into an empty search.
  useEffect(() => {
    let active = true;
    const load = async () => {
      const [accountsResult, productsResult, samplesResult, candidatesResult] = await Promise.allSettled([
        trpcCall("custodyV2.accounts", undefined, "query"),
        productsService.list(),
        sampleId ? trpcCall("custodySamples.list", undefined, "query") : Promise.resolve([]),
        legacyId ? trpcCall("custodyV2.legacyCandidates", undefined, "query") : Promise.resolve([]),
      ]);
      if (!active) return;
      if (productsResult.status === "fulfilled") setCatalog(Array.isArray(productsResult.value) ? productsResult.value : []);
      else setError(displayError(productsResult.reason, l("تعذر تحميل دليل المنتجات. أعد المحاولة؛ لم تُعرض النتيجة كقائمة فارغة.", "Unable to load the product catalog. Retry; it was not displayed as an empty list.")));
      if (accountsResult.status === "fulfilled") setAccounts(Array.isArray(accountsResult.value) ? accountsResult.value : []);
      else setError(previous => previous || displayError(accountsResult.reason, l("تعذر تحميل الموظفين المسؤولين. أعد تسجيل الدخول قبل الحفظ؛ البحث في دليل المنتجات متاح.", "Responsible employees could not be loaded. Sign in again before saving; catalog search remains available.")));
      if (samplesResult.status === "rejected") setError(previous => previous || displayError(samplesResult.reason, l("تعذر تحميل أمر العينة.", "Unable to load the sample order.")));
      if (candidatesResult.status === "rejected") setError(previous => previous || displayError(candidatesResult.reason, l("تعذر تحميل سجل الرصيد السابق.", "Unable to load the previous balance record.")));
      const requests = samplesResult.status === "fulfilled" && Array.isArray(samplesResult.value) ? samplesResult.value : [];
      const candidates = candidatesResult.status === "fulfilled" && Array.isArray(candidatesResult.value) ? candidatesResult.value : [];
      if (legacyId) {
        const candidate = candidates.find((row: any) => Number(row.sourceId) === legacyId);
        if (!candidate) setError(previous => previous || l("السجل لم يعد مؤهلًا للترحيل أو تم ترحيله مسبقًا", "The record is no longer eligible for migration or has already been migrated."));
        else {
          setLegacy(candidate);
          setDrafts([{
            ...newDraft(), name: String(candidate.productName || ""), size: String(candidate.productSize || ""), color: String(candidate.productColor || ""),
            firstD: candidate.quality === "second" ? "0" : String(Math.floor(Number(candidate.quantityPairs || 0) / 12)),
            firstP: candidate.quality === "second" ? "0" : String(Number(candidate.quantityPairs || 0) % 12),
            secondD: candidate.quality === "second" ? String(Math.floor(Number(candidate.quantityPairs || 0) / 12)) : "0",
            secondP: candidate.quality === "second" ? String(Number(candidate.quantityPairs || 0) % 12) : "0",
          }]);
        }
      }
      if (sampleId) {
        const selected = requests.find((request: any) => Number(request.id) === sampleId);
        if (!selected || selected.status !== "ordered") setError(previous => previous || l("يجب اعتماد بيانات العينة وإنشاء أمر تصنيعها من دورة العينات أولًا", "The sample must be approved and its manufacturing order created from the sample workflow first."));
        else {
          setSample(selected);
          const approved = selected.product || selected.payload?.product || selected.specs || selected.payload?.specs;
          const selectedDraft = approved ? {
            ...newDraft(), code: approved.code, name: approved.name || "", size: approved.size || "", color: approved.color || "", antiSlip: approved.antiSlip,
            yarns: Array.isArray(approved.yarns) ? approved.yarns.map((yarn: any) => ({ name: yarn.name, percentage: String(yarn.percentage) })) : [{ name: "", percentage: "100" }],
            yarnWeight: approved.yarnWeightGrams ? String(approved.yarnWeightGrams) : "", pairWeight: approved.pairWeightGrams ? String(approved.pairWeightGrams) : "",
          } as DraftProduct : newDraft();
          const quantity = Number(selected.requestedPairs || selected.payload?.requestedPairs || 0);
          selectedDraft.firstD = quantity > 0 ? String(Math.floor(quantity / 12)) : "0";
          selectedDraft.firstP = quantity > 0 ? String(quantity % 12) : "0";
          setDrafts([selectedDraft]);
        }
      }
    };
    void load().catch(caught => active && setError(displayError(caught, l("تعذر تحميل نموذج دفعة الإنتاج", "Unable to load the production batch form.")))).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [sampleId, legacyId]);

  useEffect(() => {
    if (!owner && productionAccounts[0]) setOwner(productionAccounts[0].id);
  }, [owner, productionAccounts]);

  const selectCatalog = (product: CatalogProduct) => {
    replaceDraft(activeDraftIndex, { ...draftFromCatalog(product), key: drafts[activeDraftIndex]?.key || operationId() });
    setQuery("");
  };
  const addProduct = () => {
    if (drafts.length >= MAX_PRODUCTS_PER_MACHINE_SHIFT) return;
    setDrafts(current => [...current, newDraft()]);
    setActiveDraftIndex(drafts.length);
  };
  const removeProduct = (index: number) => {
    if (drafts.length === 1) return;
    setDrafts(current => current.filter((_, itemIndex) => itemIndex !== index));
    setActiveDraftIndex(current => Math.max(0, Math.min(current, drafts.length - 2)));
  };

  const asBatch = (draft: DraftProduct, index: number): CustodyBatchInput => {
    const code = automaticItemCode(draft.name, draft.size, draft.color);
    if (!code || !draft.name.trim() || !draft.size.trim() || !draft.color.trim() || draft.antiSlip === null) {
      throw new Error(l(`أكمل تعريف المنتج ${index + 1}: الاسم ثم المقاس ثم اللون والخاصية.`, `Complete item ${index + 1}: name, size, color, and feature.`));
    }
    const quantities = [draft.firstD, draft.firstP, draft.secondD, draft.secondP].map(cleanInt);
    if (quantities.some(quantity => !Number.isFinite(quantity) || quantity < 0)) throw new Error(l(`كميات المنتج ${index + 1} يجب أن تكون أعدادًا صحيحة غير سالبة.`, `Item ${index + 1} quantities must be non-negative whole numbers.`));
    const firstPairs = quantities[0] * 12 + quantities[1];
    const secondPairs = quantities[2] * 12 + quantities[3];
    if (!Number.isSafeInteger(firstPairs + secondPairs) || firstPairs + secondPairs < 1) throw new Error(l(`أدخل زوجًا واحدًا على الأقل للمنتج ${index + 1}.`, `Enter at least one pair for item ${index + 1}.`));
    const hasIssuedYarnWeight = draft.yarnWeight.trim().length > 0;
    const grams = hasIssuedYarnWeight ? Number(numberInput(draft.yarnWeight)) * (draft.weightUnit === "kg" ? 1000 : 1) : 0;
    const perPair = Number(numberInput(draft.pairWeight));
    if ((hasIssuedYarnWeight && (!Number.isFinite(grams) || grams <= 0)) || !Number.isFinite(perPair) || perPair <= 0) throw new Error(l(`أدخل وزن زوج صحيح للمنتج ${index + 1}. وزن الخيوط المصروفة اختياري، لكنه يلزم لحساب نسبة الهدر.`, `Enter a valid pair weight for item ${index + 1}. Issued yarn weight is optional, but required to calculate the waste rate.`));
    const yarns = draft.yarns.map(yarn => ({ name: yarn.name.trim(), percentage: Number(numberInput(yarn.percentage)) }));
    if (!yarns.length || yarns.some(yarn => !yarn.name || !Number.isFinite(yarn.percentage) || yarn.percentage <= 0) || Math.abs(yarns.reduce((total, yarn) => total + yarn.percentage, 0) - 100) > 0.001) {
      throw new Error(l(`أكمل أسماء الخيوط للمنتج ${index + 1} واجعل مجموع النسب 100%.`, `Complete yarn names for item ${index + 1} and make the percentages total 100%.`));
    }
    const optionalInt = (value: string, label: string) => {
      if (!value.trim()) return undefined;
      const parsed = cleanInt(value);
      if (!Number.isFinite(parsed) || parsed < 0) throw new Error(label);
      return parsed;
    };
    const optionalGram = (value: string, label: string) => {
      if (!value.trim()) return undefined;
      const parsed = Number(numberInput(value));
      if (!Number.isFinite(parsed) || parsed < 0) throw new Error(label);
      return parsed;
    };
    return {
      operationKey: `${operation.current}-${index + 1}`,
      product: { code, name: draft.name.trim(), size: draft.size.trim(), color: draft.color.trim(), antiSlip: draft.antiSlip, yarns, yarnWeightGrams: grams, pairWeightGrams: perPair },
      productionDate: date, productionEndDate, workStartTime, workEndTime, machineNumber: machine.trim(), shift: shift.trim(), manufacturingOrder: order.trim() || undefined,
      purpose: sampleId ? "sample" : "sale", firstPairs, secondPairs, responsibleUserId: owner, sampleRequestId: sampleId,
      wasteThreadGrams: optionalGram(draft.wasteThread, l(`هدر خيوط المنتج ${index + 1} غير صالح.`, `Item ${index + 1} yarn waste is invalid.`)),
      wasteSocksGrams: optionalGram(draft.wasteSocks, l(`هدر جوارب المنتج ${index + 1} غير صالح.`, `Item ${index + 1} sock waste is invalid.`)),
      needlesUsed: optionalInt(draft.needlesUsed, l(`الإبر المستخدمة للمنتج ${index + 1} غير صالحة.`, `Item ${index + 1} used needles are invalid.`)),
      wasteNeedles: optionalInt(draft.wasteNeedles, l(`الإبر التالفة للمنتج ${index + 1} غير صالحة.`, `Item ${index + 1} damaged needles are invalid.`)),
    };
  };

  const save = async () => {
    setError(""); setSuccess("");
    if (!canCreate) { setError(l("إنشاء دفعات الإنتاج للمخولين داخل قسم الإنتاج فقط", "Only authorized users in the Production department can create production batches.")); return; }
    try {
      if (!legacyId && (!machine.trim() || !shift.trim() || !date || !productionEndDate || !isValidTime(workStartTime) || !isValidTime(workEndTime))) throw new Error(l("اختر الماكينة والوردية وأكمل تاريخ ووقت العمل.", "Select machine and shift and complete work date and time."));
      if (!legacyId && productionEndDate < date) throw new Error(l("لا يمكن أن يسبق تاريخ الانتهاء تاريخ البدء", "The end date cannot be before the start date."));
      if (!legacyId && productionEndDate === date && workEndTime <= workStartTime) throw new Error(l("يجب أن يكون وقت الانتهاء بعد وقت البدء في اليوم نفسه", "The end time must be after the start time on the same day."));
      if (!productionAccounts.some(account => account.id === owner)) throw new Error(l("اختر الموظف المسؤول المفعّل في قسم الإنتاج.", "Select the active responsible employee in Production."));
      const batches = drafts.map(asBatch);
      if (legacyId) {
        if (user?.role !== "admin" || !legacy) throw new Error(l("ترحيل العهد السابقة محصور على الأدمن بعد المراجعة", "Migrating previous custody balances is restricted to the administrator after review."));
        if (importReason.trim().length < 5) throw new Error(l("اكتب سبب الترحيل والمراجعة بخمسة أحرف على الأقل", "Enter a migration and review reason of at least five characters."));
        const first = batches[0];
        const result = await trpcCall("custodyV2.importLegacy", { operationKey: operation.current, sourceId: legacyId, product: first.product, responsibleUserId: owner, reason: importReason.trim() });
        if (!result?.success) throw new Error(l("لم يؤكد الخادم ترحيل الرصيد", "The server did not confirm the balance migration."));
        setSuccess(l(`تم استيراد الرصيد الافتتاحي ${result.trackingNumber}. الكمية محفوظة من المصدر ولا تُحسب إنتاجًا جديدًا.`, `Opening balance ${result.trackingNumber} was imported. The quantity is preserved from the source and is not counted as new production.`));
        return;
      }
      const body = {
        operationKey: operation.current,
        productionDate: date, productionEndDate, workStartTime, workEndTime, machineNumber: machine.trim(), shift: shift.trim(), manufacturingOrder: order.trim() || undefined,
        responsibleUserId: owner, purpose: "sale" as const,
        products: batches.map(({ operationKey: _operationKey, productionDate: _start, productionEndDate: _end, workStartTime: _workStart, workEndTime: _workEnd, machineNumber: _machine, shift: _shift, manufacturingOrder: _order, responsibleUserId: _owner, purpose: _purpose, ...product }) => product),
      };
      const fingerprint = JSON.stringify({ ...body, operationKey: "" });
      if (lastPayload.current && lastPayload.current !== fingerprint) operation.current = operationId();
      lastPayload.current = fingerprint;
      setBusy(true);
      const result = sampleId
        ? await trpcCall("custodyV2.createBatch", batches[0])
        : await trpcCall("custodyV2.createBatchGroup", { ...body, operationKey: operation.current });
      if (!result?.success) throw new Error(l("لم يؤكد الخادم حفظ دفعة الإنتاج.", "The server did not confirm saving the production batch."));
      const tracking = Array.isArray(result.trackingNumbers) ? result.trackingNumbers.join("، ") : result.trackingNumber;
      setSuccess(l(`تم حفظ ${batches.length} ${batches.length === 1 ? "منتج" : "منتجات"} للماكينة ${machine} والوردية المحددة. أرقام التتبع: ${tracking || "صدرت من الخادم"}.`, `${batches.length} item(s) were saved for machine ${machine} and the selected shift. Tracking numbers: ${tracking || "issued by the server"}.`));
      operation.current = operationId(); lastPayload.current = "";
    } catch (caught) {
      setError(displayError(caught, l("تعذر الحفظ", "Unable to save the batch.")));
    } finally { setBusy(false); }
  };

  const renderProductCard = (draft: DraftProduct, draftIndex: number) => {
    const code = automaticItemCode(draft.name, draft.size, draft.color);
    const totalPairs = [draft.firstD, draft.firstP, draft.secondD, draft.secondP].every(value => Number.isFinite(cleanInt(value)))
      ? (cleanInt(draft.firstD) + cleanInt(draft.secondD)) * 12 + cleanInt(draft.firstP) + cleanInt(draft.secondP) : "—";
    const issuedYarnGrams = draft.yarnWeight.trim()
      ? Number(numberInput(draft.yarnWeight)) * (draft.weightUnit === "kg" ? 1000 : 1)
      : null;
    const normalizedIssuedYarnGrams = normalizeIssuedYarnGrams(issuedYarnGrams);
    const yarnBreakdown = calculateYarnBreakdown(normalizedIssuedYarnGrams, draft.yarns);
    const wastePreview = productionMetrics([{
      productionDozen: 0,
      productionPairs: 0,
      yarnIssuedGrams: normalizedIssuedYarnGrams,
      wasteThreadGrams: draft.wasteThread.trim() ? Number(numberInput(draft.wasteThread)) : 0,
      wasteSocksGrams: draft.wasteSocks.trim() ? Number(numberInput(draft.wasteSocks)) : 0,
    }]);
    const wasteRate = wastePreview.wastePercent;
    const readOnly = !!sampleId || !!legacyId;
    return <View key={draft.key} style={[s.productCard, activeDraftIndex === draftIndex && s.productCardActive]}>
      <View style={[s.productHeader, flowStyle]}>
        <View style={s.productTitleWrap}><Text style={[s.productTitle, textStyle]}>{l("المنتج", "Item")} {draftIndex + 1}</Text><Text style={[s.small, textStyle]}>{code || l("أكمل الاسم والمقاس واللون لتوليد الرمز", "Complete name, size, and color to generate the code")}</Text></View>
        <View style={[s.productActions, flowStyle]}>
          <TouchableOpacity onPress={() => setActiveDraftIndex(draftIndex)} style={[s.targetButton, activeDraftIndex === draftIndex && s.targetButtonActive]} accessibilityLabel={l(`اختيار المنتج ${draftIndex + 1} لنتائج البحث`, `Set item ${draftIndex + 1} as search target`)}><Text style={[s.targetButtonText, activeDraftIndex === draftIndex && s.targetButtonTextActive, textStyle]}>{l("نتائج البحث هنا", "Search target")}</Text></TouchableOpacity>
          {!readOnly && drafts.length > 1 ? <TouchableOpacity onPress={() => removeProduct(draftIndex)} style={s.deleteProduct}><Text style={[s.deleteProductText, textStyle]}>{l("حذف", "Remove")}</Text></TouchableOpacity> : null}
        </View>
      </View>
      <View style={[s.grid, flowStyle]}>
        <RowField label={l("اسم الصنف", "Item name")} value={draft.name} onChange={value => replaceDraft(draftIndex, { name: value })} editable={!readOnly} language={language} />
        <RowField label={l("المقاس", "Size")} value={draft.size} onChange={value => replaceDraft(draftIndex, { size: value })} editable={!readOnly} language={language} />
        <RowField label={l("اللون", "Color")} value={draft.color} onChange={value => replaceDraft(draftIndex, { color: value })} editable={!readOnly} language={language} />
        <RowField label={l("رمز الصنف (آلي)", "Item code (automatic)")} value={code} onChange={() => undefined} editable={false} placeholder={l("الاسم - المقاس - اللون", "Name - size - color")} language={language} />
      </View>
      <View style={[s.inline, flowStyle]}><Text style={[s.label, textStyle]}>{l("خاصية المنتج", "Product feature")} *</Text>
        {[false, true].map(value => <TouchableOpacity key={String(value)} disabled={readOnly} onPress={() => replaceDraft(draftIndex, { antiSlip: value })} style={[s.chip, draft.antiSlip === value && s.selected]}><Text style={[s.chipText, draft.antiSlip === value && s.selectedText, textStyle]}>{value ? l("بمانع انزلاق", "With anti-slip") : l("بدون مانع انزلاق", "Without anti-slip")}</Text></TouchableOpacity>)}
      </View>
      <Text style={[s.minorTitle, textStyle]}>{l("الخيوط والأوزان", "Yarns and weights")}</Text>
      {draft.yarns.map((yarn, yarnIndex) => {
        const breakdown = yarnBreakdown[yarnIndex];
        const quantity = breakdown?.grams;
        return <View key={`${draft.key}-yarn-${yarnIndex}`} style={[s.yarnRow, flowStyle]}>
          <RowField label={l(`نوع الخيط ${yarnIndex + 1}`, `Yarn type ${yarnIndex + 1}`)} editable={!readOnly} value={yarn.name} onChange={value => changeYarn(draftIndex, yarnIndex, { name: value })} language={language} />
          <View style={s.field}>
            <Text style={[s.label, textStyle]}>{l("الكمية المحسوبة (جرام)", "Calculated amount (grams)")}</Text>
            <View style={[s.input, s.readonly, s.calculatedValue]}><Text style={[s.calculatedText, textStyle]}>{quantity === null || quantity === undefined ? l("غير مسجلة", "Not recorded") : `${quantity.toFixed(2)} ${l("جرام", "g")}`}</Text></View>
          </View>
          <RowField label={l("النسبة %", "Percentage %")} editable={!readOnly} value={yarn.percentage} numeric onChange={value => changeYarn(draftIndex, yarnIndex, { percentage: value })} language={language} />
          {!readOnly && draft.yarns.length > 1 ? <TouchableOpacity onPress={() => removeYarn(draftIndex, yarnIndex)} style={s.remove}><Text style={[s.deleteProductText, textStyle]}>{l("حذف الخيط", "Remove yarn")}</Text></TouchableOpacity> : null}
        </View>;
      })}
      {!readOnly ? <TouchableOpacity style={[s.secondary, { alignSelf: english ? "flex-start" : "flex-end" }]} onPress={() => addYarn(draftIndex)}><Text style={[s.link, textStyle]}>{l("إضافة نوع خيط", "Add yarn type")}</Text></TouchableOpacity> : null}
      <View style={[s.grid, flowStyle]}>
        <RowField label={l("وزن الخيوط المصروفة للدفعة (اختياري)", "Issued yarn weight for item (optional)")} required={false} numeric value={draft.yarnWeight} onChange={value => replaceDraft(draftIndex, { yarnWeight: value })} editable={!readOnly} placeholder={l("أدخله لحساب نسبة الهدر", "Enter to calculate waste rate")} language={language} />
        <RowField label={l("وزن الزوج (جرام)", "Pair weight (grams)")} numeric value={draft.pairWeight} onChange={value => replaceDraft(draftIndex, { pairWeight: value })} editable={!readOnly} language={language} />
      </View>
      <View style={[s.inline, flowStyle]}><Text style={[s.label, textStyle]}>{l("وحدة وزن الخيوط", "Yarn weight unit")}</Text>
        {(["g", "kg"] as const).map(unit => <TouchableOpacity key={unit} disabled={readOnly} onPress={() => replaceDraft(draftIndex, { weightUnit: unit })} style={[s.chip, draft.weightUnit === unit && s.selected]}><Text style={[s.chipText, draft.weightUnit === unit && s.selectedText, textStyle]}>{unit === "g" ? l("جرام", "Grams") : l("كيلوجرام", "Kilograms")}</Text></TouchableOpacity>)}
      </View>
      <Text style={[s.weightSummary, textStyle]}>{normalizedIssuedYarnGrams === null
        ? l("أدخل وزن الخيوط المصروفة لعرض كمية كل نوع بالجرام؛ تبقى النسب ظاهرة ويمكن الحفظ.", "Enter issued yarn weight to display each type in grams; percentages remain visible and saving is allowed.")
        : l(`إجمالي الوزن المصروف للدفعة: ${normalizedIssuedYarnGrams.toFixed(2)} جرام (100%)`, `Total issued yarn for this item: ${normalizedIssuedYarnGrams.toFixed(2)} g (100%)`)}</Text>
      <Text style={[s.minorTitle, textStyle]}>{l("الكميات حسب الجودة", "Quantities by grade")}</Text>
      <View style={[s.grid, flowStyle]}>
        <RowField label={l("النخب الأول / درزن", "First grade / dozens")} editable={!legacyId} numeric value={draft.firstD} onChange={value => replaceDraft(draftIndex, { firstD: value })} language={language} />
        <RowField label={l("النخب الأول / زوج إضافي", "First grade / extra pairs")} editable={!legacyId} numeric value={draft.firstP} onChange={value => replaceDraft(draftIndex, { firstP: value })} language={language} />
        <RowField label={l("النخب الثاني / درزن", "Second grade / dozens")} editable={!legacyId} numeric value={draft.secondD} onChange={value => replaceDraft(draftIndex, { secondD: value })} language={language} />
        <RowField label={l("النخب الثاني / زوج إضافي", "Second grade / extra pairs")} editable={!legacyId} numeric value={draft.secondP} onChange={value => replaceDraft(draftIndex, { secondP: value })} language={language} />
      </View>
      <Text style={[s.total, textStyle]}>{l("إجمالي المنتج:", "Item total:")} {totalPairs} {l("زوج", "pairs")}</Text>
      <View style={[s.grid, flowStyle]}>
        <RowField label={l("هدر الخيوط (جرام)", "Yarn waste (grams)")} required={false} numeric value={draft.wasteThread} onChange={value => replaceDraft(draftIndex, { wasteThread: value })} language={language} />
        <RowField label={l("هدر الجوارب (جرام)", "Sock waste (grams)")} required={false} numeric value={draft.wasteSocks} onChange={value => replaceDraft(draftIndex, { wasteSocks: value })} language={language} />
        <RowField label={l("الإبر المستخدمة (حبة)", "Needles used (pieces)")} required={false} numeric value={draft.needlesUsed} onChange={value => replaceDraft(draftIndex, { needlesUsed: value })} language={language} />
        <RowField label={l("الإبر التالفة (حبة)", "Damaged needles (pieces)")} required={false} numeric value={draft.wasteNeedles} onChange={value => replaceDraft(draftIndex, { wasteNeedles: value })} language={language} />
      </View>
      <View style={s.wasteRateBox} accessibilityLabel={l("نسبة الهدر التلقائية", "Automatic waste rate")}>
        <Text style={[s.wasteRateLabel, textStyle]}>{l("نسبة الهدر الإجمالية (تلقائية)", "Total waste rate (automatic)")}</Text>
        <Text style={[s.wasteRateValue, textStyle]}>{wasteRate === null ? l("غير محسوبة", "Not calculated") : `${wasteRate.toFixed(2)}%`}</Text>
        <Text style={[s.small, textStyle]}>{issuedYarnGrams && issuedYarnGrams > 0
          ? l("المعادلة: (هدر الخيوط + هدر الجوارب) ÷ وزن الخيوط المصروفة × 100", "Formula: (yarn waste + sock waste) ÷ issued yarn weight × 100")
          : l("وزن الخيوط المصروفة غير مدخل؛ يمكن الحفظ، لكن لا تُحسب النسبة دون وزن.", "Issued yarn weight is not entered; saving is allowed, but the rate cannot be calculated without a weight.")}</Text>
      </View>
    </View>;
  };

  return <ScreenContainer style={s.screen}>
    <View style={s.top}>
      <BackButton />
      <View style={[s.titleBlock, { alignItems: english ? "flex-start" : "flex-end" }]}><Text style={[s.title, textStyle]}>{legacyId ? l("مراجعة رصيد افتتاحي سابق", "Review previous opening balance") : l("إدخال إنتاج الماكينة والوردية", "Machine & shift production entry")}</Text><Text style={[s.subtitle, textStyle]}>{l("حتى 5 منتجات • حفظ واحد • تتبع مستقل لكل منتج", "Up to 5 items • one save • independent tracking per item")}</Text></View>
      <TouchableOpacity onPress={() => router.push("/custody-workbench" as any)} style={s.topButton} accessibilityLabel={l("العهد", "Custody")}><Text style={[s.topButtonText, textStyle]}>{l("العهد", "Custody")}</Text></TouchableOpacity>
    </View>
    <FlatList data={[]} renderItem={() => null} contentContainerStyle={[s.content, { maxWidth: width > 1000 ? 1160 : undefined }]} ListHeaderComponent={<>
      {loading ? <View style={[s.loading, flowStyle]}><ActivityIndicator color="#0a7ea4" /><Text style={[s.small, textStyle]}>{l("جارٍ تحميل دليل المنتجات والموظفين…", "Loading product catalog and employees…")}</Text></View> : null}
      {error ? <Text accessibilityRole="alert" style={[s.error, textStyle]}>{error}</Text> : null}
      {success ? <View style={s.success}><Text style={[s.successText, textStyle]}>{success}</Text><TouchableOpacity onPress={() => router.push("/custody-workbench" as any)}><Text style={[s.link, textStyle]}>{l("فتح عهد الإنتاج ومتابعة العمل", "Open Production custody and continue work")}</Text></TouchableOpacity></View> : null}
      {legacyId ? <View style={s.notice}><Text style={[s.label, textStyle]}>{l("المصدر", "Source")} #{legacyId} — {legacy?.workerName || ""} — {legacy?.quantityPairs ?? "—"} {l("زوج", "pairs")}</Text><Text style={[s.note, textStyle]}>{l("الاسم والمقاس واللون والكمية مثبتة من المصدر. أكمل التعريف الحقيقي للصنف فقط.", "Name, size, color, and quantity are fixed from the source. Complete only the actual item definition.")}</Text><RowField label={l("سبب الترحيل والمراجعة", "Migration and review reason")} value={importReason} onChange={setImportReason} language={language} /></View> : null}
      <View style={s.notice}><Text style={[s.note, textStyle]}>{l("اختر الماكينة والوردية مرة واحدة، ثم أضف منتجاتها. لا تُدخل الكمية إلا بالدرزن والزوج؛ وكل منتج يصبح عهدة مستقلة بعد الحفظ.", "Choose the machine and shift once, then add its items. Enter quantities only as dozens and pairs; every item becomes an independent custody after saving.")}</Text></View>
      {sampleId ? <View style={s.notice}><Text style={[s.label, textStyle]}>{l("غرض التصنيع: عينة — أمر رقم", "Manufacturing purpose: sample — order #")} {sampleId} {sample?.referenceCode || ""}</Text><Text style={[s.note, textStyle]}>{l("العينة منتج واحد وبياناتها المعتمدة للقراءة فقط؛ لا تدخل مخزون البيع.", "A sample is one item; approved definition is read-only and it never enters sale stock.")}</Text></View> : null}
      {!sampleId && !legacyId ? <View style={s.section}>
        <Text style={[s.sectionTitle, textStyle]}>{l("ابحث في دليل المنتجات", "Search product catalog")}</Text>
        <Text style={[s.small, textStyle]}>{l(`تُعبّأ نتيجة البحث في المنتج ${activeDraftIndex + 1}. اكتب حرفين على الأقل من الاسم أو المقاس أو اللون أو الباركود.`, `The search result will fill item ${activeDraftIndex + 1}. Type at least two characters of name, size, color, or barcode.`)}</Text>
        <TextInput style={[s.input, textStyle]} value={query} onChangeText={setQuery} placeholder={l("مثال: SP", "Example: SP")} placeholderTextColor="#64748b" accessibilityLabel={l("البحث عن صنف", "Search for an item")} />
        {query.trim().length >= 2 && !suggestions.length ? <Text style={[s.emptySearch, textStyle]}>{catalog.length ? l("لا توجد مطابقة لهذا البحث في الدليل.", "No catalog match for this search.") : l("دليل المنتجات لم يكتمل تحميله. أعد المحاولة أو تحقق من تسجيل الدخول.", "The product catalog has not loaded. Retry or verify sign-in.")}</Text> : null}
        {suggestions.map(product => <TouchableOpacity style={[s.suggestion, { alignItems: english ? "flex-start" : "flex-end" }]} key={String(product.id)} onPress={() => selectCatalog(product)}><Text style={[s.label, textStyle]}>{product.name} · {product.size || "—"} · {product.color || "—"}</Text><Text style={[s.small, textStyle]}>{l("باركود الدليل:", "Catalog barcode:")} {product.barcode || "—"}</Text></TouchableOpacity>)}
      </View> : null}
      {!legacyId ? <View style={s.section}>
        <Text style={[s.sectionTitle, textStyle]}>{l("بيانات الماكينة والوردية المشتركة", "Shared machine and shift details")}</Text>
        <View style={[s.grid, flowStyle]}>
          <SelectField label={l("الماكينة", "Machine")} value={machine} options={machineOptions} placeholder={l("اختر الماكينة", "Select machine")} language={language} open={openSelect === "machine"} onToggle={() => setOpenSelect(current => current === "machine" ? null : "machine")} onChange={value => { setMachine(value); setOpenSelect(null); }} />
          <SelectField label={l("الوردية", "Shift")} value={shift} options={shiftOptions} placeholder={l("اختر الوردية", "Select shift")} language={language} open={openSelect === "shift"} onToggle={() => setOpenSelect(current => current === "shift" ? null : "shift")} onChange={value => { setShift(value); setOpenSelect(null); }} />
          <View style={s.field}><Text style={[s.label, textStyle]}>{l("تاريخ بدء الإنتاج", "Production start date")} *</Text><DateField value={date} onChange={value => { setDate(value); setProductionEndDate(current => current === date ? value : current); }} isAr={!english} accessibilityLabel={l("اختيار تاريخ بدء الإنتاج", "Choose production start date")} /></View>
          <View style={s.field}><Text style={[s.label, textStyle]}>{l("تاريخ انتهاء الإنتاج", "Production end date")} *</Text><DateField value={productionEndDate} onChange={setProductionEndDate} isAr={!english} accessibilityLabel={l("اختيار تاريخ انتهاء الإنتاج", "Choose production end date")} /></View>
          <TimeField label={l("وقت بدء العمل", "Work start time")} value={workStartTime} onChange={setWorkStartTime} isAr={!english} />
          <TimeField label={l("وقت انتهاء العمل", "Work end time")} value={workEndTime} onChange={setWorkEndTime} isAr={!english} />
          <RowField label={l("أمر التصنيع", "Manufacturing order")} value={order} onChange={setOrder} required={false} language={language} />
        </View>
        <Text style={[s.label, textStyle]}>{l("موظف الإنتاج المسؤول", "Responsible Production employee")} *</Text>
        <View style={[s.inline, flowStyle]}>{productionAccounts.map(account => <TouchableOpacity key={account.id} onPress={() => setOwner(account.id)} style={[s.chip, owner === account.id && s.selected]}><Text style={[s.chipText, owner === account.id && s.selectedText, textStyle]}>{account.name}</Text></TouchableOpacity>)}</View>
        {!productionAccounts.length ? <Text style={[s.emptySearch, textStyle]}>{l("لا تظهر قائمة الموظف المسؤول قبل تسجيل الدخول بحساب مصرح له في قسم الإنتاج.", "The responsible employee list appears after signing in with an authorized Production account.")}</Text> : null}
      </View> : null}
      <View style={s.productSectionHeader}><View><Text style={[s.sectionTitle, textStyle]}>{l("منتجات هذه الماكينة والوردية", "Items for this machine and shift")}</Text><Text style={[s.small, textStyle]}>{drafts.length}/{MAX_PRODUCTS_PER_MACHINE_SHIFT} {l("منتجات", "items")}</Text></View>{!sampleId && !legacyId && drafts.length < MAX_PRODUCTS_PER_MACHINE_SHIFT ? <TouchableOpacity onPress={addProduct} style={s.addProduct}><Text style={[s.addProductText, textStyle]}>{l("+ إضافة منتج", "+ Add item")}</Text></TouchableOpacity> : null}</View>
      {drafts.map(renderProductCard)}
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={busy ? l("جارٍ الحفظ", "Saving") : legacyId ? l("اعتماد الرصيد الافتتاحي بعد المراجعة", "Approve opening balance after review") : l("حفظ كل المنتجات وإنشاء عهد الإنتاج", "Save all items and create Production custody")} disabled={busy || loading || !canCreate || !!success} onPress={() => void save()} style={[s.primary, (busy || loading || !canCreate || !!success) && s.disabled]}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={[s.primaryText, textStyle]}>{legacyId ? l("اعتماد الرصيد الافتتاحي بعد المراجعة", "Approve opening balance after review") : l(`حفظ ${drafts.length} ${drafts.length === 1 ? "منتج" : "منتجات"} وإنشاء العهد`, `Save ${drafts.length} item(s) and create custody`)}</Text>}
      </TouchableOpacity>
    </>} />
  </ScreenContainer>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f5f7fa" },
  top: { backgroundColor: "#0a7ea4", flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10, gap: 10 },
  titleBlock: { flex: 1 }, title: { color: "#fff", fontSize: 18, fontWeight: "800" }, subtitle: { color: "#d7f1fc", fontSize: 11, marginTop: 2 },
  topButton: { padding: 9, borderRadius: 8, backgroundColor: "#ffffff22" }, topButtonText: { color: "#fff", fontWeight: "700" },
  content: { padding: 12, paddingBottom: 32, width: "100%", alignSelf: "center", gap: 10 }, loading: { alignItems: "center", gap: 8, marginBottom: 10 },
  section: { backgroundColor: "#fff", borderRadius: 10, borderWidth: 1, borderColor: "#dce4eb", padding: 12, marginBottom: 10 },
  sectionTitle: { fontSize: 14, fontWeight: "800", color: "#16465e", marginBottom: 4 },
  grid: { flexWrap: "wrap", gap: 9, alignItems: "flex-start" }, field: { flexGrow: 1, flexBasis: 190, minWidth: 140, marginBottom: 6 },
  label: { fontSize: 12, fontWeight: "700", color: "#263d50", marginBottom: 4 }, input: { borderWidth: 1, borderColor: "#c9d4df", borderRadius: 7, paddingHorizontal: 10, paddingVertical: 9, minHeight: 42, color: "#193348", backgroundColor: "#fff", fontSize: 14 }, readonly: { backgroundColor: "#f1f5f9", color: "#475569" },
  selectTrigger: { alignItems: "center", justifyContent: "space-between", gap: 8 }, selectValue: { flex: 1, color: "#193348", fontSize: 14 }, placeholder: { color: "#64748b" }, selectChevron: { color: "#087c9d", fontSize: 16, fontWeight: "800" }, selectMenu: { borderWidth: 1, borderColor: "#c9d4df", backgroundColor: "#f8fafc", borderRadius: 7, marginTop: 5, padding: 6, gap: 5, flexDirection: "row", flexWrap: "wrap" }, selectOption: { borderWidth: 1, borderColor: "#c8d6df", borderRadius: 6, backgroundColor: "#fff", paddingHorizontal: 10, paddingVertical: 8, minHeight: 38, justifyContent: "center", maxWidth: "100%" }, selectOptionSelected: { backgroundColor: "#087c9d", borderColor: "#087c9d" },
  inline: { flexWrap: "wrap", gap: 7, alignItems: "center", marginBottom: 7 }, chip: { borderWidth: 1, borderColor: "#c8d6df", paddingHorizontal: 12, paddingVertical: 9, borderRadius: 7, backgroundColor: "#f8fafc", minHeight: 42, justifyContent: "center" }, selected: { backgroundColor: "#087c9d", borderColor: "#087c9d" }, chipText: { color: "#334155", fontSize: 12, fontWeight: "700" }, selectedText: { color: "#fff" },
  small: { fontSize: 11, color: "#64748b", lineHeight: 17 }, notice: { padding: 10, backgroundColor: "#eaf5fb", borderRadius: 8, marginBottom: 10 }, note: { fontSize: 12, color: "#27546b", lineHeight: 19 }, error: { backgroundColor: "#fff1f2", color: "#b91c1c", padding: 12, borderRadius: 8, marginBottom: 10 }, errorText: { color: "#b91c1c", fontSize: 12 }, success: { backgroundColor: "#ecfdf5", padding: 12, borderRadius: 8, marginBottom: 10 }, successText: { color: "#166534", fontSize: 13, lineHeight: 20 },
  primary: { backgroundColor: "#087c9d", padding: 13, borderRadius: 8, alignItems: "center", minHeight: 46, marginTop: 2 }, primaryText: { color: "#fff", fontSize: 14, fontWeight: "800" }, secondary: { borderWidth: 1, borderColor: "#a5cbda", padding: 8, borderRadius: 7, marginBottom: 9 }, link: { color: "#087c9d", fontWeight: "800", fontSize: 12, marginTop: 5 }, remove: { alignSelf: "center", padding: 10 }, total: { fontSize: 16, fontWeight: "800", color: "#087c9d", marginBottom: 6 }, suggestion: { padding: 10, borderBottomWidth: 1, borderBottomColor: "#e2e8f0", backgroundColor: "#f8fbfd" }, emptySearch: { color: "#9a3412", backgroundColor: "#fff7ed", padding: 8, borderRadius: 6, marginTop: 7, fontSize: 12 }, disabled: { opacity: 0.5 },
  productSectionHeader: { backgroundColor: "#eaf5fb", borderRadius: 9, padding: 10, marginBottom: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }, addProduct: { minHeight: 38, paddingHorizontal: 11, justifyContent: "center", borderRadius: 7, backgroundColor: "#087c9d" }, addProductText: { color: "#fff", fontWeight: "800", fontSize: 12 },
  productCard: { backgroundColor: "#fff", borderRadius: 10, borderWidth: 1, borderColor: "#cddce5", padding: 12, marginBottom: 10 }, productCardActive: { borderColor: "#087c9d", borderWidth: 2 }, productHeader: { alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 9 }, productTitleWrap: { flexGrow: 1, flexShrink: 1 }, productTitle: { color: "#16465e", fontSize: 14, fontWeight: "900" }, productActions: { alignItems: "center", gap: 5, flexWrap: "wrap" }, targetButton: { paddingHorizontal: 9, paddingVertical: 7, borderRadius: 6, borderWidth: 1, borderColor: "#7ab7cc", backgroundColor: "#fff" }, targetButtonActive: { backgroundColor: "#e0f2fe", borderColor: "#087c9d" }, targetButtonText: { color: "#075985", fontSize: 11, fontWeight: "800" }, targetButtonTextActive: { color: "#075985" }, deleteProduct: { paddingHorizontal: 9, paddingVertical: 7, borderRadius: 6, backgroundColor: "#fff1f2" }, deleteProductText: { color: "#b91c1c", fontSize: 11, fontWeight: "800" }, minorTitle: { color: "#31566b", fontWeight: "800", fontSize: 12, marginTop: 6, marginBottom: 6 }, yarnRow: { flexWrap: "wrap", gap: 9, alignItems: "flex-start" }, calculatedValue: { justifyContent: "center" }, calculatedText: { color: "#334155", fontSize: 13, fontWeight: "800" }, weightSummary: { color: "#0c4a6e", backgroundColor: "#ecfeff", borderRadius: 7, padding: 8, marginBottom: 9, fontSize: 11, lineHeight: 17 },
  wasteRateBox: { marginTop: 9, padding: 10, borderRadius: 8, backgroundColor: "#eff8ff", borderWidth: 1, borderColor: "#bae6fd" }, wasteRateLabel: { color: "#075985", fontWeight: "800", fontSize: 12 }, wasteRateValue: { color: "#0369a1", fontWeight: "900", fontSize: 20, marginVertical: 3 },
});
