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
import { CustodyAccount, CustodyBatchInput, CustodyProduct } from "@/shared/custody-contract";

const operationId = () => globalThis.crypto?.randomUUID?.() || `batch-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const numberInput = (value: string) => value.replace(/[٠-٩]/g, c => String("٠١٢٣٤٥٦٧٨٩".indexOf(c))).replace(/[۰-۹]/g, c => String("۰۱۲۳۴۵۶۷۸۹".indexOf(c)));
const cleanInt = (v: string) => /^\d+$/.test(numberInput(v)) && Number.isSafeInteger(Number(numberInput(v))) ? Number(numberInput(v)) : NaN;
const riyadhDay = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const isValidTime = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
const automaticItemCode = (...parts: string[]) => parts.map(part => part.trim().replace(/\s+/g, "-")).filter(Boolean).join("-");
const MACHINE_OPTIONS = ["RB1", "RB2", "RB3", "RB4", "RB5", "RB6", "RB7", "RB8", "RB9", "NS1", "RS1", "RS2", "RS3", "RS4", "RS5", "RS6", "RS7", "RS8", "RS9", "RS10", "RS11", "LT1", "LT2"];
const DEFAULT_SHIFT_OPTIONS = [
  { value: "morning", ar: "صباحية", en: "Morning" },
  { value: "evening", ar: "مسائية", en: "Evening" },
  { value: "night", ar: "ليلية", en: "Night" },
];

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
  const textStyle = { textAlign: textAlignFor(language), direction: writingDirection(language) } as const;
  return (
    <View style={s.field}>
      <Text style={[s.label, textStyle]}>{label}{required ? " *" : ""}</Text>
      <TextInput
        accessibilityLabel={label}
        editable={editable}
        style={[s.input, !editable && s.readonly, textStyle]}
        value={value}
        onChangeText={v => onChange(numeric ? numberInput(v) : v)}
        keyboardType={numeric ? "decimal-pad" : "default"}
        placeholder={placeholder}
        placeholderTextColor="#64748b"
      />
    </View>
  );
};

type SelectOption = { value: string; label: string };

type SelectFieldProps = {
  label: string;
  value: string;
  options: SelectOption[];
  placeholder: string;
  language: "ar" | "en";
  open: boolean;
  onToggle: () => void;
  onChange: (value: string) => void;
};

const SelectField = ({ label, value, options, placeholder, language, open, onToggle, onChange }: SelectFieldProps) => {
  const textStyle = { textAlign: textAlignFor(language), direction: writingDirection(language) } as const;
  const selectedLabel = options.find(option => option.value === value)?.label || value;
  return (
    <View style={s.field}>
      <Text style={[s.label, textStyle]}>{label} *</Text>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ expanded: open }}
        onPress={onToggle}
        style={[s.input, s.selectTrigger, { flexDirection: language === "en" ? "row" : "row-reverse" }]}
      >
        <Text numberOfLines={1} style={[s.selectValue, !selectedLabel && s.placeholder, textStyle]}>{selectedLabel || placeholder}</Text>
        <Text accessibilityElementsHidden style={s.selectChevron}>{open ? "⌃" : "⌄"}</Text>
      </TouchableOpacity>
      {open && <View style={[s.selectMenu, { alignItems: language === "en" ? "flex-start" : "flex-end" }]}>
        {options.map(option => <TouchableOpacity
          key={option.value}
          accessibilityRole="button"
          accessibilityLabel={option.label}
          onPress={() => onChange(option.value)}
          style={[s.selectOption, option.value === value && s.selectOptionSelected]}
        >
          <Text style={[s.chipText, option.value === value && s.selectedText, textStyle]}>{option.label}</Text>
        </TouchableOpacity>)}
      </View>}
    </View>
  );
};

export default function CustodyBatchEntry() {
  const router = useRouter();
  const { user } = useAuth();
  const { language } = useLanguage();
  const english = isEnglish(language);
  const textAlign = textAlignFor(language);
  const direction = writingDirection(language);
  const l = (arabic: string, englishText: string) => localize(language, arabic, englishText);
  const textStyle = { textAlign, direction } as const;
  const flowStyle = { flexDirection: english ? "row" : "row-reverse" } as const;
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams<{ sampleRequestId?: string; legacySourceId?: string }>();
  const [accounts, setAccounts] = useState<CustodyAccount[]>([]);
  const [catalog, setCatalog] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [size, setSize] = useState("");
  const [color, setColor] = useState("");
  const [antiSlip, setAntiSlip] = useState<boolean | null>(null);
  const [yarns, setYarns] = useState([{ name: "", percentage: "100" }]);
  const [yarnWeight, setYarnWeight] = useState("");
  const [weightUnit, setWeightUnit] = useState<"g" | "kg">("g");
  const [pairWeight, setPairWeight] = useState("");
  const [wasteThread, setWasteThread] = useState("");
  const [needlesUsed, setNeedlesUsed] = useState("");
  const [wasteNeedles, setWasteNeedles] = useState("");
  const [wasteSocks, setWasteSocks] = useState("");
  const [date, setDate] = useState(riyadhDay);
  const [productionEndDate, setProductionEndDate] = useState(date);
  const [workStartTime, setWorkStartTime] = useState("08:00");
  const [workEndTime, setWorkEndTime] = useState("16:00");
  const [machine, setMachine] = useState("");
  const [shift, setShift] = useState("");
  const [openSelect, setOpenSelect] = useState<"machine" | "shift" | null>(null);
  const [order, setOrder] = useState("");
  const [firstD, setFirstD] = useState("0");
  const [firstP, setFirstP] = useState("0");
  const [secondD, setSecondD] = useState("0");
  const [secondP, setSecondP] = useState("0");
  const [owner, setOwner] = useState(Number(user?.id) || 0);
  const [sample, setSample] = useState<any>(null);
  const [legacy, setLegacy] = useState<any>(null);
  const [importReason, setImportReason] = useState("");
  const op = useRef(operationId());
  const lastPayload = useRef("");
  const sampleId = Number(params.sampleRequestId) || undefined;
  const legacyId = Number(params.legacySourceId) || undefined;
  const canCreate = user?.role === "admin" || (["manager", "supervisor"].includes(String(user?.role)) && ["production", "الإنتاج", "قسم الإنتاج"].includes(String(user?.department)));
  const productionAccounts = accounts.filter(a => legacy ? accountBelongsToStage(a.department, legacy.stage) : accountBelongsToStage(a.department, "production"));
  const suggestions = useMemo(() => query.trim().length < 2 ? [] : catalog.filter(p => `${p.name} ${p.barcode}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()) && (!size || String(p.size || "").toLowerCase() === size.trim().toLowerCase())).slice(0, 30), [query, catalog, size]);
  const machineOptions = useMemo(() => MACHINE_OPTIONS.map(value => ({ value, label: value })), []);
  const shiftOptions = useMemo(() => DEFAULT_SHIFT_OPTIONS.map(option => ({ value: option.value, label: english ? option.en : option.ar })), [english]);
  const displayError = (caught: unknown, fallback: string) => {
    const message = caught instanceof Error ? caught.message : fallback;
    return english && /[\u0600-\u06FF]/.test(message) ? fallback : message;
  };

  const applyProduct = (product: CustodyProduct) => {
    setCode(product.code);
    setName(product.name);
    setSize(product.size);
    setColor(product.color);
    setAntiSlip(product.antiSlip);
    setYarns(product.yarns.map(y => ({ name: y.name, percentage: String(y.percentage) })));
    setYarnWeight(String(product.yarnWeightGrams));
    setPairWeight(String(product.pairWeightGrams));
    setWeightUnit("g");
  };

  // The item code is an immutable human-readable identity, not an extra field
  // employees have to type. It always follows: item name – size – color.
  useEffect(() => {
    const nextCode = automaticItemCode(name, size, color);
    if (nextCode && nextCode !== code) setCode(nextCode);
  }, [name, size, color, code]);

  useEffect(() => {
    let active = true;
    Promise.all([
      trpcCall("custodyV2.accounts", undefined, "query"),
      productsService.list(),
      sampleId ? trpcCall("custodySamples.list", undefined, "query") : Promise.resolve([]),
      legacyId ? trpcCall("custodyV2.legacyCandidates", undefined, "query") : Promise.resolve([]),
    ]).then(([accountsResult, products, requests, candidates]) => {
      if (!active) return;
      setAccounts(accountsResult || []);
      setCatalog(products || []);
      if (legacyId) {
        const candidate = (candidates || []).find((row: any) => Number(row.sourceId) === legacyId);
        if (!candidate) throw new Error(l("السجل لم يعد مؤهلًا للترحيل أو تم ترحيله مسبقًا", "The record is no longer eligible for migration or has already been migrated."));
        setLegacy(candidate);
        setName(candidate.productName);
        setSize(candidate.productSize);
        setColor(candidate.productColor);
        const pairs = Number(candidate.quantityPairs);
        const second = candidate.quality === "second";
        setFirstD(second ? "0" : String(Math.floor(pairs / 12)));
        setFirstP(second ? "0" : String(pairs % 12));
        setSecondD(second ? String(Math.floor(pairs / 12)) : "0");
        setSecondP(second ? String(pairs % 12) : "0");
      }
      if (sampleId) {
        const selected = (requests || []).find((request: any) => Number(request.id) === sampleId);
        if (!selected || selected.status !== "ordered") throw new Error(l("يجب اعتماد بيانات العينة وإنشاء أمر تصنيعها من دورة العينات أولًا", "The sample must be approved and its manufacturing order created from the sample workflow first."));
        setSample(selected);
        const approved = selected.product || selected.payload?.product || selected.specs || selected.payload?.specs;
        if (approved) applyProduct(approved);
        const quantity = Number(selected.requestedPairs || selected.payload?.requestedPairs || 0);
        if (quantity > 0) {
          setFirstD(String(Math.floor(quantity / 12)));
          setFirstP(String(quantity % 12));
        }
      }
    }).catch(caught => active && setError(displayError(caught, l("تعذر تحميل نموذج دفعة الإنتاج", "Unable to load the production batch form."))))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [sampleId, legacyId]);

  const save = async () => {
    setError("");
    setSuccess("");
    if (!canCreate) {
      setError(l("إنشاء دفعات الإنتاج للمخولين داخل قسم الإنتاج فقط", "Only authorized users in the Production department can create production batches."));
      return;
    }
    try {
      if (!code.trim() || !name.trim() || !size.trim() || !color.trim() || (!legacyId && (!machine.trim() || !shift.trim() || !date || !productionEndDate || !isValidTime(workStartTime) || !isValidTime(workEndTime))) || antiSlip === null) {
        throw new Error(l("أكمل رمز الصنف واسمه والمقاس واللون والخاصية والماكينة والوردية وتاريخ ووقت العمل", "Complete the item code, name, size, color, feature, machine, shift, and work date and time."));
      }
      if (!legacyId && productionEndDate < date) throw new Error(l("لا يمكن أن يسبق تاريخ الانتهاء تاريخ البدء", "The end date cannot be before the start date."));
      if (!legacyId && productionEndDate === date && workEndTime <= workStartTime) throw new Error(l("يجب أن يكون وقت الانتهاء بعد وقت البدء في اليوم نفسه", "The end time must be after the start time on the same day."));
      const quantities = [firstD, firstP, secondD, secondP].map(cleanInt);
      if (quantities.some(quantity => !Number.isFinite(quantity) || quantity < 0)) throw new Error(l("الكميات أعداد صحيحة غير سالبة؛ لا يسمح بكسر الزوج", "Quantities must be non-negative whole numbers; partial pairs are not allowed."));
      const firstPairs = quantities[0] * 12 + quantities[1];
      const secondPairs = quantities[2] * 12 + quantities[3];
      if (!Number.isSafeInteger(firstPairs + secondPairs) || firstPairs + secondPairs < 1) throw new Error(l("يجب أن تكون كمية الدفعة زوجًا صحيحًا واحدًا على الأقل", "The batch quantity must be at least one whole pair."));
      const grams = Number(numberInput(yarnWeight)) * (weightUnit === "kg" ? 1000 : 1);
      const perPair = Number(numberInput(pairWeight));
      if (!Number.isFinite(grams) || grams <= 0 || !Number.isFinite(perPair) || perPair <= 0) throw new Error(l("أدخل وزن الخيوط المصروفة ووزن الزوج بقيم موجبة ووحدات صحيحة", "Enter issued yarn weight and pair weight as positive values with valid units."));
      const mix = yarns.map(yarn => ({ name: yarn.name.trim(), percentage: Number(numberInput(yarn.percentage)) }));
      if (mix.some(yarn => !yarn.name || !Number.isFinite(yarn.percentage) || yarn.percentage <= 0) || Math.abs(mix.reduce((total, yarn) => total + yarn.percentage, 0) - 100) > 0.0001) throw new Error(l("أسماء الخيوط مطلوبة ومجموع النسب يجب أن يساوي 100%", "Yarn names are required and the total percentages must equal 100%."));
      if (!productionAccounts.some(account => account.id === owner)) throw new Error(l("اختر الموظف المسؤول المفعّل في قسم العهدة", "Select the active responsible employee in the custody department."));
      if (legacyId) {
        if (user?.role !== "admin" || !legacy) throw new Error(l("ترحيل العهد السابقة محصور على الأدمن بعد المراجعة", "Migrating previous custody balances is restricted to the administrator after review."));
        if (importReason.trim().length < 5) throw new Error(l("اكتب سبب الترحيل والمراجعة بخمسة أحرف على الأقل", "Enter a migration and review reason of at least five characters."));
        setBusy(true);
        const product = { code: code.trim(), name: name.trim(), size: size.trim(), color: color.trim(), antiSlip, yarns: mix, yarnWeightGrams: grams, pairWeightGrams: perPair };
        const body = { operationKey: op.current, sourceId: legacyId, product, responsibleUserId: owner, reason: importReason.trim() };
        const fingerprint = JSON.stringify({ ...body, operationKey: "" });
        if (lastPayload.current && lastPayload.current !== fingerprint) {
          op.current = operationId();
          body.operationKey = op.current;
        }
        lastPayload.current = fingerprint;
        const result = await trpcCall("custodyV2.importLegacy", body);
        if (!result?.success) throw new Error(l("لم يؤكد الخادم ترحيل الرصيد", "The server did not confirm the balance migration."));
        setSuccess(l(`تم استيراد الرصيد الافتتاحي ${result.trackingNumber}. الكمية محفوظة من المصدر ولا تُحسب إنتاجًا جديدًا؛ الزمن التاريخي غير مكتمل.`, `Opening balance ${result.trackingNumber} was imported. The quantity is preserved from the source and is not counted as new production; historical timing is incomplete.`));
        return;
      }
      const body: CustodyBatchInput = {
        operationKey: op.current,
        product: { code: code.trim(), name: name.trim(), size: size.trim(), color: color.trim(), antiSlip, yarns: mix, yarnWeightGrams: grams, pairWeightGrams: perPair },
        productionDate: date,
        productionEndDate,
        workStartTime,
        workEndTime,
        machineNumber: machine.trim(),
        shift: shift.trim(),
        manufacturingOrder: order.trim() || undefined,
        purpose: sampleId ? "sample" : "sale",
        firstPairs,
        secondPairs,
        responsibleUserId: owner,
        sampleRequestId: sampleId,
        wasteThreadGrams: wasteThread.trim() ? Number(numberInput(wasteThread)) : undefined,
        wasteSocksGrams: wasteSocks.trim() ? Number(numberInput(wasteSocks)) : undefined,
        needlesUsed: needlesUsed.trim() ? cleanInt(needlesUsed) : undefined,
        wasteNeedles: wasteNeedles.trim() ? cleanInt(wasteNeedles) : undefined,
      };
      const fingerprint = JSON.stringify({ ...body, operationKey: "" });
      if (lastPayload.current && lastPayload.current !== fingerprint) {
        op.current = operationId();
        body.operationKey = op.current;
      }
      lastPayload.current = fingerprint;
      setBusy(true);
      const result = await trpcCall("custodyV2.createBatch", body);
      if (!result?.success) throw new Error(l("لم يؤكد الخادم حفظ الدفعة", "The server did not confirm saving the batch."));
      setSuccess(l(`تم إنشاء الدفعة ${result.trackingNumber}. بيانات الصنف محفوظة، والعهدة في الإنتاج لبدء العمل وتسجيل التقدم.`, `Batch ${result.trackingNumber} was created. Item data is saved, and custody is in Production to begin work and record progress.`));
      op.current = operationId();
      lastPayload.current = "";
    } catch (caught) {
      setError(displayError(caught, l("تعذر الحفظ", "Unable to save the batch.")));
    } finally {
      setBusy(false);
    }
  };

  const selectCatalog = (product: any) => {
    setName(product.name || "");
    setCode(product.code || product.barcode || "");
    setSize(product.size || "");
    setColor(product.color || "");
    setPairWeight(String(product.weightGrams || ""));
    const yarnDetails = product.yarnDetails || {};
    if (Array.isArray(yarnDetails.yarns)) setYarns(yarnDetails.yarns.map((yarn: any) => ({ name: yarn.name, percentage: String(yarn.percentage) })));
    if (typeof yarnDetails.antiSlip === "boolean") setAntiSlip(yarnDetails.antiSlip);
    setQuery("");
  };

  const totalPairs = [firstD, firstP, secondD, secondP].every(value => Number.isFinite(cleanInt(value)))
    ? (cleanInt(firstD) + cleanInt(secondD)) * 12 + cleanInt(firstP) + cleanInt(secondP)
    : "—";

  return (
    <ScreenContainer style={s.screen}>
      <View style={s.top}>
        <BackButton />
        <View style={[s.titleBlock, { alignItems: english ? "flex-start" : "flex-end" }]}>
          <Text style={[s.title, textStyle]}>{legacyId ? l("مراجعة رصيد افتتاحي سابق", "Review previous opening balance") : l("دفعة إنتاج جديدة", "New production batch")}</Text>
          <Text style={[s.subtitle, textStyle]}>{l("الزوج وحدة الحساب • رقم تتبع مستقل لكل دفعة", "Pairs are the unit of measure • Each batch has an independent tracking number")}</Text>
        </View>
        <TouchableOpacity onPress={() => router.push("/custody-workbench" as any)} style={s.topButton} accessibilityLabel={l("العهد", "Custody")}>
          <Text style={[s.topButtonText, textStyle]}>{l("العهد", "Custody")}</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={[]}
        renderItem={() => null}
        contentContainerStyle={[s.content, { maxWidth: width > 1000 ? 1160 : undefined }]}
        ListHeaderComponent={<>
          {loading && <View style={[s.loading, flowStyle]}><ActivityIndicator color="#0a7ea4" /><Text style={[s.small, textStyle]}>{l("جارٍ تحميل نموذج الدفعة…", "Loading batch-entry form…")}</Text></View>}
          {error ? <Text accessibilityRole="alert" style={[s.error, textStyle]}>{error}</Text> : null}
          {success ? <View style={s.success}><Text style={[s.successText, textStyle]}>{success}</Text><TouchableOpacity onPress={() => router.push("/custody-workbench" as any)}><Text style={[s.link, textStyle]}>{l("فتح عهد الإنتاج ومتابعة العمل", "Open Production custody and continue work")}</Text></TouchableOpacity></View> : null}
          {legacyId && <View style={s.notice}>
            <Text style={[s.label, textStyle]}>{l("المصدر", "Source")} #{legacyId} — {legacy?.workerName || ""} — {legacy?.quantityPairs ?? "—"} {l("زوج", "pairs")}</Text>
            <Text style={[s.note, textStyle]}>{l("الاسم والمقاس واللون والكمية مثبتة من المصدر. أكمل التعريف الحقيقي للصنف واختر موظف نفس المرحلة. لا تفترض أوزانًا غير معروفة.", "Name, size, color, and quantity are fixed from the source. Complete the actual item definition and select an employee in the same stage. Do not assume unknown weights.")}</Text>
            <RowField label={l("سبب الترحيل والمراجعة", "Migration and review reason")} value={importReason} onChange={setImportReason} language={language} />
          </View>}
          <View style={s.notice}><Text style={[s.note, textStyle]}>{l("البيانات الأساسية تنتقل آليًا لكل المراحل. يسمح بعدة عهد، ولا يسمح بتسليم جزء من عهدة. التخزين لا يضاف للمخزون إلا بعد الاعتماد النهائي.", "Core data moves automatically through every stage. Multiple custody records are allowed, but a partial custody handover is not. Storage is not added to inventory until final approval.")}</Text></View>
          {sampleId ? <View style={s.notice}>
            <Text style={[s.label, textStyle]}>{l("غرض التصنيع: عينة — أمر رقم", "Manufacturing purpose: sample — order #")} {sampleId} {sample?.referenceCode || ""}</Text>
            <Text style={[s.note, textStyle]}>{l("البيانات المعتمدة للقراءة فقط. العينة لا تدخل مخزون البيع.", "Approved data is read-only. The sample does not enter sale inventory.")}</Text>
          </View> : <View style={s.section}>
            <Text style={[s.sectionTitle, textStyle]}>{l("اختيار صنف موجود أو إدخال تعريف جديد", "Select an existing item or enter a new definition")}</Text>
            <TextInput
              style={[s.input, textStyle]}
              value={query}
              onChangeText={setQuery}
              placeholder={l("اكتب حرفين من اسم الصنف للبحث — المقاس اختياري", "Type two letters of an item name to search — size is optional")}
              placeholderTextColor="#64748b"
              accessibilityLabel={l("البحث عن صنف", "Search for an item")}
            />
            {suggestions.map(product => <TouchableOpacity style={[s.suggestion, { alignItems: english ? "flex-start" : "flex-end" }]} key={String(product.id)} onPress={() => selectCatalog(product)}>
              <Text style={[s.label, textStyle]}>{product.name} · {product.size || "—"} · {product.color || "—"}</Text>
              <Text style={[s.small, textStyle]}>{l("رمز الدليل:", "Catalog code:")} {product.barcode || "—"} — {l("لا يثبت رصيد مخزون", "does not confirm an inventory balance")}</Text>
            </TouchableOpacity>)}
          </View>}
          <View style={s.section}>
            <Text style={[s.sectionTitle, textStyle]}>{l("تعريف الصنف — مستقل عن الدفعة", "Item definition — independent of the batch")}</Text>
            <View style={[s.grid, flowStyle]}>
              <RowField label={l("اسم الصنف", "Item name")} value={name} onChange={setName} editable={!sampleId && !legacyId} language={language} />
              <RowField label={l("المقاس", "Size")} value={size} onChange={setSize} editable={!sampleId && !legacyId} language={language} />
              <RowField label={l("اللون", "Color")} value={color} onChange={setColor} editable={!sampleId && !legacyId} language={language} />
              <RowField label={l("رمز الصنف (يظهر تلقائيًا)", "Item code (auto-generated)")} value={code} onChange={() => undefined} editable={false} placeholder={l("سيظهر الرمز تلقائيًا", "The code will appear automatically")} language={language} />
            </View>
            <View style={[s.inline, flowStyle]}>
              <Text style={[s.label, textStyle]}>{l("خاصية المنتج", "Product feature")} *</Text>
              {[false, true].map(value => <TouchableOpacity key={String(value)} disabled={!!sampleId} onPress={() => setAntiSlip(value)} style={[s.chip, antiSlip === value && s.selected]}><Text style={[s.chipText, antiSlip === value && s.selectedText, textStyle]}>{value ? l("بمانع انزلاق", "With anti-slip") : l("بدون مانع انزلاق", "Without anti-slip")}</Text></TouchableOpacity>)}
            </View>
            <Text style={[s.small, textStyle]}>{l("مانع الانزلاق خاصية للصنف، وليس درجة جودة. العينة غرض تصنيع وليست نخبًا.", "Anti-slip is an item feature, not a quality grade. A sample is a manufacturing purpose, not a quality grade.")}</Text>
          </View>
          <View style={s.section}>
            <Text style={[s.sectionTitle, textStyle]}>{l("الخيوط والأوزان", "Yarns and weights")}</Text>
            {yarns.map((yarn, index) => <View key={index} style={[s.grid, flowStyle]}>
              <RowField label={l(`نوع الخيط ${index + 1}`, `Yarn type ${index + 1}`)} editable={!sampleId} value={yarn.name} onChange={value => setYarns(allYarns => allYarns.map((current, currentIndex) => currentIndex === index ? { ...current, name: value } : current))} language={language} />
              <RowField label={l("النسبة %", "Percentage %")} editable={!sampleId} value={yarn.percentage} numeric onChange={value => setYarns(allYarns => allYarns.map((current, currentIndex) => currentIndex === index ? { ...current, percentage: value } : current))} language={language} />
              {!sampleId && yarns.length > 1 && <TouchableOpacity onPress={() => setYarns(allYarns => allYarns.filter((_, currentIndex) => currentIndex !== index))} style={s.remove}><Text style={[s.errorText, textStyle]}>{l("حذف الخيط", "Remove yarn")}</Text></TouchableOpacity>}
            </View>)}
            {!sampleId && <TouchableOpacity style={[s.secondary, { alignSelf: english ? "flex-start" : "flex-end" }]} onPress={() => setYarns(allYarns => [...allYarns, { name: "", percentage: "" }])}><Text style={[s.link, textStyle]}>{l("إضافة نوع خيط للخليط", "Add yarn type to the blend")}</Text></TouchableOpacity>}
            <View style={[s.grid, flowStyle]}>
              <RowField label={l("وزن الخيوط المصروفة للدفعة", "Issued yarn weight for the batch")} numeric value={yarnWeight} onChange={setYarnWeight} editable={!sampleId} language={language} />
              <RowField label={l("وزن الزوج (جرام)", "Pair weight (grams)")} numeric value={pairWeight} onChange={setPairWeight} editable={!sampleId} language={language} />
            </View>
            <View style={[s.inline, flowStyle]}>
              <Text style={[s.label, textStyle]}>{l("وحدة وزن الخيوط", "Yarn weight unit")}</Text>
              {(["g", "kg"] as const).map(unit => <TouchableOpacity key={unit} disabled={!!sampleId} onPress={() => setWeightUnit(unit)} style={[s.chip, weightUnit === unit && s.selected]}><Text style={[s.chipText, weightUnit === unit && s.selectedText, textStyle]}>{unit === "g" ? l("جرام", "Grams") : l("كيلوجرام", "Kilograms")}</Text></TouchableOpacity>)}
            </View>
          </View>
          <View style={s.section}>
            <Text style={[s.sectionTitle, textStyle]}>{l("بيانات دفعة الإنتاج", "Production batch details")}</Text>
            <View style={[s.grid, flowStyle]}>
              <View style={s.field}><Text style={[s.label, textStyle]}>{l("تاريخ بدء الإنتاج", "Production start date")} *</Text><DateField value={date} onChange={value => { setDate(value); setProductionEndDate(current => current === date ? value : current); }} isAr={!english} accessibilityLabel={l("اختيار تاريخ بدء الإنتاج", "Choose production start date")} /></View>
              <View style={s.field}><Text style={[s.label, textStyle]}>{l("تاريخ انتهاء الإنتاج", "Production end date")} *</Text><DateField value={productionEndDate} onChange={setProductionEndDate} isAr={!english} accessibilityLabel={l("اختيار تاريخ انتهاء الإنتاج", "Choose production end date")} /></View>
              <TimeField label={l("وقت بدء العمل", "Work start time")} value={workStartTime} onChange={setWorkStartTime} isAr={!english} />
              <TimeField label={l("وقت انتهاء العمل", "Work end time")} value={workEndTime} onChange={setWorkEndTime} isAr={!english} />
              <SelectField label={l("الماكينة", "Machine")} value={machine} options={machineOptions} placeholder={l("اختر الماكينة", "Select machine")} language={language} open={openSelect === "machine"} onToggle={() => setOpenSelect(current => current === "machine" ? null : "machine")} onChange={value => { setMachine(value); setOpenSelect(null); }} />
              <SelectField label={l("الوردية", "Shift")} value={shift} options={shiftOptions} placeholder={l("اختر الوردية", "Select shift")} language={language} open={openSelect === "shift"} onToggle={() => setOpenSelect(current => current === "shift" ? null : "shift")} onChange={value => { setShift(value); setOpenSelect(null); }} />
              <RowField label={l("أمر التصنيع", "Manufacturing order")} value={order} onChange={setOrder} required={false} language={language} />
            </View>
            <Text style={[s.label, textStyle]}>{legacyId ? l("موظف مرحلة العهدة المسؤول", "Responsible custody-stage employee") : l("موظف الإنتاج المسؤول", "Responsible Production employee")} *</Text>
            <View style={[s.inline, flowStyle]}>{productionAccounts.map(account => <TouchableOpacity key={account.id} onPress={() => setOwner(account.id)} style={[s.chip, owner === account.id && s.selected]}><Text style={[s.chipText, owner === account.id && s.selectedText, textStyle]}>{account.name}</Text></TouchableOpacity>)}</View>
          </View>
          <View style={s.section}>
            <Text style={[s.sectionTitle, textStyle]}>{l("الكميات — جودة منفصلة وحساب بالزوج الصحيح", "Quantities — separate quality and whole-pair calculation")}</Text>
            <View style={[s.grid, flowStyle]}>
              <RowField label={l("النخب الأول / درزن", "First grade / dozens")} editable={!legacyId} numeric value={firstD} onChange={setFirstD} language={language} />
              <RowField label={l("النخب الأول / أزواج إضافية", "First grade / additional pairs")} editable={!legacyId} numeric value={firstP} onChange={setFirstP} language={language} />
              <RowField label={l("النخب الثاني / درزن", "Second grade / dozens")} editable={!legacyId} numeric value={secondD} onChange={setSecondD} language={language} />
              <RowField label={l("النخب الثاني / أزواج إضافية", "Second grade / additional pairs")} editable={!legacyId} numeric value={secondP} onChange={setSecondP} language={language} />
            </View>
            <Text style={[s.total, textStyle]}>{l("الإجمالي:", "Total:")} {totalPairs} {l("زوج", "pairs")}</Text>
            <Text style={[s.small, textStyle]}>{l("رقم الدفعة والتتبع يصدران من الخادم. لا يعاد احتساب الكمية كإنتاج جديد عند انتقالها بين الأقسام.", "Batch and tracking numbers are issued by the server. Quantity is not recalculated as new production when it moves between departments.")}</Text>
          </View>
          <View style={s.section}>
            <Text style={[s.sectionTitle, textStyle]}>{l("هدر الإنتاج — قياس فعلي بالجرام", "Production waste — actual measurement in grams")}</Text>
            <View style={[s.grid, flowStyle]}>
              <RowField label={l("هدر الخيوط (جرام)", "Yarn waste (grams)")} required={false} numeric value={wasteThread} onChange={setWasteThread} language={language} />
              <RowField label={l("هدر الجوارب (جرام)", "Sock waste (grams)")} required={false} numeric value={wasteSocks} onChange={setWasteSocks} language={language} />
              <RowField label={l("الإبر المستخدمة (حبة)", "Needles used (pieces)")} required={false} numeric value={needlesUsed} onChange={setNeedlesUsed} language={language} />
              <RowField label={l("الإبر التالفة (حبة)", "Damaged needles (pieces)")} required={false} numeric value={wasteNeedles} onChange={setWasteNeedles} language={language} />
            </View>
            <Text style={[s.small, textStyle]}>{l("الحقول اختيارية؛ اكتب صفرًا إذا تم القياس ولا يوجد هدر. لا يتم تقدير نسبة هدر دون أوزان مسجلة.", "These fields are optional; enter zero when measured and there is no waste. A waste percentage is not estimated without recorded weights.")}</Text>
          </View>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={busy ? l("جارٍ الحفظ", "Saving") : legacyId ? l("اعتماد الرصيد الافتتاحي بعد المراجعة", "Approve opening balance after review") : l("حفظ الدفعة وإنشاء عهد الإنتاج", "Save batch and create Production custody")} disabled={busy || loading || !canCreate || !!success} onPress={() => void save()} style={[s.primary, (busy || loading || !canCreate || !!success) && s.disabled]}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={[s.primaryText, textStyle]}>{legacyId ? l("اعتماد الرصيد الافتتاحي بعد المراجعة", "Approve opening balance after review") : l("حفظ الدفعة وإنشاء عهد الإنتاج", "Save batch and create Production custody")}</Text>}
          </TouchableOpacity>
        </>}
      />
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f5f7fa" },
  top: { backgroundColor: "#0a7ea4", flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10, gap: 10 },
  titleBlock: { flex: 1 },
  title: { color: "#fff", fontSize: 18, fontWeight: "800" },
  subtitle: { color: "#d7f1fc", fontSize: 11, marginTop: 2 },
  topButton: { padding: 9, borderRadius: 8, backgroundColor: "#ffffff22" },
  topButtonText: { color: "#fff", fontWeight: "700" },
  content: { padding: 12, paddingBottom: 32, width: "100%", alignSelf: "center", gap: 10 },
  loading: { alignItems: "center", gap: 8, marginBottom: 10 },
  section: { backgroundColor: "#fff", borderRadius: 10, borderWidth: 1, borderColor: "#dce4eb", padding: 12, marginBottom: 10 },
  sectionTitle: { fontSize: 14, fontWeight: "800", color: "#16465e", marginBottom: 9 },
  grid: { flexWrap: "wrap", gap: 9, alignItems: "flex-start" },
  field: { flexGrow: 1, flexBasis: 220, minWidth: 140, marginBottom: 8 },
  label: { fontSize: 12, fontWeight: "700", color: "#263d50", marginBottom: 4 },
  input: { borderWidth: 1, borderColor: "#c9d4df", borderRadius: 7, paddingHorizontal: 10, paddingVertical: 9, minHeight: 42, color: "#193348", backgroundColor: "#fff", fontSize: 14 },
  readonly: { backgroundColor: "#f1f5f9", color: "#475569" },
  selectTrigger: { alignItems: "center", justifyContent: "space-between", gap: 8 },
  selectValue: { flex: 1, color: "#193348", fontSize: 14 },
  placeholder: { color: "#64748b" },
  selectChevron: { color: "#087c9d", fontSize: 16, fontWeight: "800" },
  selectMenu: { borderWidth: 1, borderColor: "#c9d4df", backgroundColor: "#f8fafc", borderRadius: 7, marginTop: 5, padding: 6, gap: 5, flexDirection: "row", flexWrap: "wrap" },
  selectOption: { borderWidth: 1, borderColor: "#c8d6df", borderRadius: 6, backgroundColor: "#fff", paddingHorizontal: 10, paddingVertical: 8, minHeight: 38, justifyContent: "center", maxWidth: "100%" },
  selectOptionSelected: { backgroundColor: "#087c9d", borderColor: "#087c9d" },
  inline: { flexWrap: "wrap", gap: 7, alignItems: "center", marginBottom: 7 },
  chip: { borderWidth: 1, borderColor: "#c8d6df", paddingHorizontal: 12, paddingVertical: 9, borderRadius: 7, backgroundColor: "#f8fafc", minHeight: 42, justifyContent: "center" },
  selected: { backgroundColor: "#087c9d", borderColor: "#087c9d" },
  chipText: { color: "#334155", fontSize: 12, fontWeight: "700" },
  selectedText: { color: "#fff" },
  small: { fontSize: 11, color: "#64748b", lineHeight: 17 },
  notice: { padding: 10, backgroundColor: "#eaf5fb", borderRadius: 8, marginBottom: 10 },
  note: { fontSize: 12, color: "#27546b", lineHeight: 19 },
  error: { backgroundColor: "#fff1f2", color: "#b91c1c", padding: 12, borderRadius: 8, marginBottom: 10 },
  errorText: { color: "#b91c1c", fontSize: 12 },
  success: { backgroundColor: "#ecfdf5", padding: 12, borderRadius: 8, marginBottom: 10 },
  successText: { color: "#166534", fontSize: 13, lineHeight: 20 },
  primary: { backgroundColor: "#087c9d", padding: 13, borderRadius: 8, alignItems: "center", minHeight: 46 },
  primaryText: { color: "#fff", fontSize: 14, fontWeight: "800" },
  secondary: { borderWidth: 1, borderColor: "#a5cbda", padding: 9, borderRadius: 7, marginBottom: 9 },
  link: { color: "#087c9d", fontWeight: "800", fontSize: 12, marginTop: 5 },
  remove: { alignSelf: "center", padding: 12 },
  total: { fontSize: 18, fontWeight: "800", color: "#087c9d", marginBottom: 6 },
  suggestion: { padding: 10, borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  disabled: { opacity: 0.5 },
});
