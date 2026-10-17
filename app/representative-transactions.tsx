import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";

import { AttachmentPicker } from "@/components/attachment-picker";
import { BackButton } from "@/components/back-button";
import { ScreenContainer } from "@/components/screen-container";
import { DateField } from "@/components/date-field";
import { SignaturePad } from "@/components/signature-pad";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";
import {
  isEnglish,
  localize,
  textAlignFor,
  writingDirection,
} from "@/lib/i18n/runtime";
import { AttachmentFile } from "@/lib/services/attachment.service";
import {
  RepresentativeItemInput,
  RepresentativeTransactionInput,
  representativeService,
} from "@/lib/services/representative.service";
import {
  MAX_REPRESENTATIVE_ITEMS,
  canAddRepresentativeItem,
  getCustomerAttachmentType,
  hasRequiredCustomerAttachments,
} from "@/lib/services/representative-form.utils";
import {
  finishedWarehouseService,
  productsService,
} from "@/lib/services/api.service";

type TransactionType = "order" | "visit" | "return" | "custom" | "sample";
const TODAY = new Date().toISOString().slice(0, 10);
const TRANSACTION_LABELS: Record<TransactionType, { ar: string; en: string }> =
  {
    order: { ar: "الطلبات", en: "Orders" },
    visit: { ar: "الزيارات", en: "Visits" },
    return: { ar: "المرتجعات", en: "Returns" },
    custom: { ar: "التصنيع الخاص", en: "Custom manufacturing" },
    sample: { ar: "طلبات العينات", en: "Sample requests" },
  };
const PRODUCT_SIZES: Record<string, string[]> = {
  صيفي: ["L", "M", "S", "تحت الكعب"],
  شتوي: ["L", "M", "S"],
  رياضي: ["فوق الركبة", "تمارين منتصف الساق", "فوق الكعب", "مقصوص"],
  "مانع انزلاق": ["XL", "L", "M", "S", "XS", "XXS"],
  عسكري: ["L"],
};
const YARN_FIELDS = [
  { key: "cotton", label: "قطن" },
  { key: "bamboo", label: "بامبو" },
  { key: "nylon", label: "نايلون" },
  { key: "polyester", label: "بوليستر" },
  { key: "rubber", label: "مطاط" },
  { key: "spandex", label: "إسباندكس" },
] as const;
const STATUS_LABELS: Record<string, { ar: string; en: string }> = {
  DRAFT: { ar: "مسودة", en: "Draft" },
  RECORDED: {
    ar: "زيارة مسجلة — معلومات فقط",
    en: "Visit recorded — information only",
  },
  PENDING_SALES_APPROVAL: {
    ar: "بانتظار اعتماد مدير التسويق والمبيعات",
    en: "Pending Sales & Marketing Manager approval",
  },
  REJECTED_SALES: { ar: "مرفوض من التسويق", en: "Rejected by Sales" },
  PENDING_WAREHOUSE_ISSUE: {
    ar: "معتمد — بانتظار إخراج المستودع خلال 48 ساعة",
    en: "Approved — warehouse issue pending within 48 hours",
  },
  WAREHOUSE_PARTIAL: {
    ar: "تنفيذ جزئي / رد مطلوب",
    en: "Partially fulfilled / response required",
  },
  WAREHOUSE_NOT_EXECUTED: {
    ar: "لم يتم التنفيذ / رد مطلوب",
    en: "Not fulfilled / response required",
  },
  WAREHOUSE_EXECUTED: { ar: "تم تنفيذ الطلب", en: "Order fulfilled" },
  REPRESENTATIVE_CLOSED: {
    ar: "أغلقه المندوب",
    en: "Closed by representative",
  },
  PENDING_WAREHOUSE_INVOICE: {
    ar: "بانتظار الفاتورة من المستودع",
    en: "Awaiting warehouse invoice",
  },
  RETURNED_TO_REPRESENTATIVE: {
    ar: "عادت للمندوب لاستلام الفاتورة",
    en: "Returned to representative to collect invoice",
  },
  PENDING_PRODUCTION_APPROVAL: {
    ar: "بانتظار مدير الإنتاج",
    en: "Pending Production Manager approval",
  },
  REJECTED_PRODUCTION: { ar: "مرفوض من الإنتاج", en: "Rejected by Production" },
  PENDING_SALES_RESOLUTION: {
    ar: "بانتظار حل مدير التسويق",
    en: "Pending Sales Manager resolution",
  },
  IN_PRODUCTION: { ar: "قيد التصنيع", en: "In production" },
  READY_FOR_REPRESENTATIVE: { ar: "جاهز للاستلام", en: "Ready for collection" },
  CLOSED: { ar: "مغلق", en: "Closed" },
  CLOSED_REJECTED: { ar: "مغلق بالرفض", en: "Closed — rejected" },
};

const emptyItem = (type: TransactionType): RepresentativeItemInput => ({
  productName: "",
  size: "",
  color: "",
  quantity: 0,
  quantityUnit: type === "sample" ? "pair" : "dozen",
  quantityDozen: 0,
  quantityPair: 0,
  productType: type === "custom" || type === "sample" ? "صيفي" : "",
  yarnRatios:
    type === "custom" || type === "sample"
      ? { cotton: 0, bamboo: 0, nylon: 0, polyester: 0, rubber: 0, spandex: 0 }
      : undefined,
});
const toAttachment = (type: string, file: AttachmentFile) => ({
  type,
  name: file.name,
  url: file.uploadedUrl || file.uri,
  mimeType: file.mimeType,
});
const parseQuantity = (value: string) => {
  const normalized = String(value || "").replace(/[^0-9]/g, "");
  return normalized ? Number(normalized) : 0;
};

function Input({
  label,
  value,
  onChangeText,
  keyboardType = "default",
  multiline = false,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: any;
  multiline?: boolean;
}) {
  const { language } = useLanguage();
  const alignment = textAlignFor(language);
  if (label.includes("تاريخ") || label.toLowerCase().includes("date"))
    return (
      <DateField
        value={value}
        onChange={onChangeText}
        label={label}
        isAr={!isEnglish(language)}
        style={[styles.input, { textAlign: alignment }]}
      />
    );
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { textAlign: alignment }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        multiline={multiline}
        style={[styles.input, multiline && styles.multiline]}
        textAlign={alignment}
      />
    </View>
  );
}

function TableCell({
  value,
  onChangeText,
  placeholder,
  keyboardType = "default",
  wide = false,
  invalid = false,
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: any;
  wide?: boolean;
  invalid?: boolean;
}) {
  const { language } = useLanguage();
  return (
    <View
      style={[
        styles.sheetCell,
        wide && styles.sheetCellWide,
        invalid && styles.invalidCell,
      ]}
    >
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType={keyboardType}
        style={styles.sheetInput}
        textAlign={textAlignFor(language)}
      />
    </View>
  );
}

function OrderTableCell({
  value,
  onChangeText,
  placeholder,
  keyboardType = "default",
  width,
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: any;
  width: number;
}) {
  const { language } = useLanguage();
  return (
    <View style={[styles.orderCell, { width }]}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType={keyboardType}
        style={styles.orderCellInput}
        textAlign={textAlignFor(language)}
      />
    </View>
  );
}

function AttachmentField({
  label,
  files,
  onChange,
  required,
}: {
  label: string;
  files: AttachmentFile[];
  onChange: (files: AttachmentFile[]) => void;
  required?: boolean;
}) {
  const { language } = useLanguage();
  return (
    <View style={styles.attachmentBox}>
      <Text
        style={[
          styles.label,
          {
            textAlign: textAlignFor(language),
            writingDirection: writingDirection(language),
          },
        ]}
      >
        {label}
        {required ? " *" : ""}
      </Text>
      <AttachmentPicker
        attachments={files}
        onAttachmentsChange={onChange}
        maxAttachments={3}
      />
    </View>
  );
}

export default function RepresentativeTransactionsScreen() {
  const { language } = useLanguage();
  const english = isEnglish(language);
  const t = (arabic: string, englishText: string) =>
    localize(language, arabic, englishText);
  const textAlign = textAlignFor(language);
  const layoutDirection =
    writingDirection(language) === "ltr" ? "row" : "row-reverse";
  const locale = english ? "en-US" : "ar-SA";
  const directionStyle = {
    textAlign,
  } as const;
  const failureMessage = (
    error: any,
    arabicFallback: string,
    englishFallback: string,
  ) => (english ? englishFallback : error?.message || arabicFallback);
  const colors = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ type?: string }>();
  const { user } = useAuth();
  const { width: viewportWidth } = useWindowDimensions();
  const [previewMode, setPreviewMode] = useState<"auto" | "mobile" | "desktop">(
    "auto",
  );
  const [density, setDensity] = useState<"compact" | "comfortable">("compact");
  const type = (
    ["order", "visit", "return", "custom", "sample"].includes(
      String(params.type),
    )
      ? params.type
      : "order"
  ) as TransactionType;
  const isCustom = type === "custom" || type === "sample";
  const [transactions, setTransactions] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(
    null,
  );
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerType, setCustomerType] = useState<
    "institution" | "individual"
  >("institution");
  const [customerStatus, setCustomerStatus] = useState<"new" | "old">("old");
  const [customerName, setCustomerName] = useState("");
  const [commercialRegister, setCommercialRegister] = useState("");
  const [taxNumber, setTaxNumber] = useState("");
  const [municipalLicense, setMunicipalLicense] = useState("");
  const [nationalAddress, setNationalAddress] = useState("");
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [street, setStreet] = useState("");
  const [email, setEmail] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [customerFiles, setCustomerFiles] = useState<AttachmentFile[]>([]);
  const [orderDate, setOrderDate] = useState(TODAY);
  const [deliveryDate, setDeliveryDate] = useState("");
  const [visitReport, setVisitReport] = useState("");
  const [visitAction, setVisitAction] = useState<
    "follow_up" | "product_presentation"
  >("follow_up");
  const [visitNotes, setVisitNotes] = useState("");
  const [returnReason, setReturnReason] = useState("");
  const [items, setItems] = useState<RepresentativeItemInput[]>([
    emptyItem(type),
  ]);
  const [generalFiles, setGeneralFiles] = useState<AttachmentFile[]>([]);
  const [designFiles, setDesignFiles] = useState<AttachmentFile[]>([]);
  const [manufacturingFormFiles, setManufacturingFormFiles] = useState<
    AttachmentFile[]
  >([]);
  const [samplePaymentFiles, setSamplePaymentFiles] = useState<
    AttachmentFile[]
  >([]);
  const [signing, setSigning] = useState<any | null>(null);
  const [customerSignature, setCustomerSignature] = useState("");
  const [representativeSignature, setRepresentativeSignature] = useState("");
  const [showValidation, setShowValidation] = useState(false);
  const [stockAvailability, setStockAvailability] = useState<
    Record<string, number>
  >({});
  const [stockSuggestions, setStockSuggestions] = useState<
    Record<number, any[]>
  >({});
  const [stockSearchResults, setStockSearchResults] = useState<
    Record<number, any[]>
  >({});
  const [selectedStock, setSelectedStock] = useState<
    Record<number, any | null>
  >({});
  const [activeStockSearchIndex, setActiveStockSearchIndex] = useState<
    number | null
  >(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const [saveError, setSaveError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const customerQuery = customerSearch.trim();
      const [transactionRows, customerRows] = await Promise.all([
        representativeService.transactions.list({ transactionType: type }),
        customerQuery
          ? representativeService.customers.list(customerQuery)
          : Promise.resolve([]),
      ]);
      setTransactions(Array.isArray(transactionRows) ? transactionRows : []);
      setCustomers(
        customerQuery && Array.isArray(customerRows) ? customerRows : [],
      );
    } catch (error: any) {
      Alert.alert(
        t("تعذر التحميل", "Unable to load"),
        failureMessage(error, "حدث خطأ", "Please try again."),
      );
    } finally {
      setLoading(false);
    }
  }, [type, customerSearch, language]);

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    setItems([emptyItem(type)]);
    setShowForm(false);
    setSigning(null);
  }, [type]);
  useEffect(() => {
    setStockAvailability({});
    setStockSuggestions({});
    setStockSearchResults({});
    setSelectedStock({});
    setActiveStockSearchIndex(null);
  }, [type]);

  const reset = () => {
    setShowValidation(false);
    setSaveError("");
    setEditingId(null);
    setSelectedCustomerId(null);
    setCustomerSearch("");
    setCustomerType("institution");
    setCustomerStatus("old");
    setCustomerName("");
    setCommercialRegister("");
    setTaxNumber("");
    setMunicipalLicense("");
    setNationalAddress("");
    setCity("");
    setDistrict("");
    setStreet("");
    setEmail("");
    setOwnerName("");
    setOwnerPhone("");
    setContactName("");
    setContactPhone("");
    setContactEmail("");
    setCustomerFiles([]);
    setOrderDate(TODAY);
    setDeliveryDate("");
    setVisitReport("");
    setVisitAction("follow_up");
    setVisitNotes("");
    setReturnReason("");
    setItems([emptyItem(type)]);
    setStockSuggestions({});
    setStockSearchResults({});
    setSelectedStock({});
    setActiveStockSearchIndex(null);
    setGeneralFiles([]);
    setDesignFiles([]);
    setManufacturingFormFiles([]);
    setSamplePaymentFiles([]);
    setShowForm(false);
  };

  const updateItem = (index: number, patch: Partial<RepresentativeItemInput>) =>
    setItems((previous) =>
      previous.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    );
  const normalizeVariantSearchValue = (value: unknown) =>
    String(value || "")
      .trim()
      .replace(/\s+/g, "")
      .toLocaleLowerCase();
  const searchStockForItem = async (index: number, value: string) => {
    setActiveStockSearchIndex(index);
    updateItem(index, { productName: value, barcode: "", size: "", color: "" });
    setSelectedStock((previous) => ({ ...previous, [index]: null }));
    if (value.trim().length < 2) {
      setStockSearchResults((previous) => ({ ...previous, [index]: [] }));
      setStockSuggestions((previous) => ({ ...previous, [index]: [] }));
      return;
    }
    try {
      let rows: any[] = [];
      try {
        const result: any = await finishedWarehouseService.search(value.trim());
        rows = Array.isArray(result) ? result : [];
      } catch {
        rows = [];
      }
      if (!rows.length) {
        const [catalogResult, stockResult] = await Promise.all([
          productsService.list(),
          finishedWarehouseService.list(),
        ]);
        const query = normalizeVariantSearchValue(value);
        const matches = (row: any) =>
          [
            row.productName,
            row.name,
            row.barcode,
            row.productSize,
            row.size,
            row.productColor,
            row.color,
          ].some((field) => normalizeVariantSearchValue(field).includes(query));
        const stockRows = Array.isArray(stockResult) ? stockResult : [];
        const stockByBarcode = new Map(
          stockRows.map((row: any) => [
            String(row.barcode || "").toUpperCase(),
            row,
          ]),
        );
        rows = (Array.isArray(catalogResult) ? catalogResult : [])
          .filter(matches)
          .map((product: any) => {
            const stock = stockByBarcode.get(
              String(product.barcode || "").toUpperCase(),
            );
            return stock
              ? { ...stock, catalogProductId: product.id, source: "warehouse" }
              : {
                  id: `catalog-${product.id}`,
                  catalogProductId: product.id,
                  barcode: product.barcode,
                  productName: product.name,
                  productSize: product.size || "",
                  productColor: product.color || "",
                  quantityDozen: 0,
                  noStockYet: true,
                  source: "catalog",
                };
          });
      }
      setStockSearchResults((previous) => ({ ...previous, [index]: rows }));
      setStockSuggestions((previous) => ({ ...previous, [index]: rows }));
    } catch {
      setStockSearchResults((previous) => ({ ...previous, [index]: [] }));
      setStockSuggestions((previous) => ({ ...previous, [index]: [] }));
    }
  };
  const updateVariantValue = (
    index: number,
    field: "size" | "color",
    value: string,
  ) => {
    updateItem(index, { [field]: value });
    setSelectedStock((previous) => ({ ...previous, [index]: null }));
    if (field === "size") {
      const allResults = stockSearchResults[index] || [];
      const normalizedSize = normalizeVariantSearchValue(value);
      setStockSuggestions((previous) => ({
        ...previous,
        [index]: normalizedSize
          ? allResults.filter(
              (stock) =>
                normalizeVariantSearchValue(stock.productSize) ===
                normalizedSize,
            )
          : allResults,
      }));
      setActiveStockSearchIndex(index);
    }
  };
  const selectStockForItem = (index: number, stock: any) => {
    setActiveStockSearchIndex(null);
    updateItem(index, {
      productName: String(stock.productName || ""),
      barcode: String(stock.barcode || ""),
      size: String(stock.productSize || ""),
      color: String(stock.productColor || ""),
    });
    setSelectedStock((previous) => ({ ...previous, [index]: stock }));
    setStockSuggestions((previous) => ({ ...previous, [index]: [] }));
    setStockSearchResults((previous) => ({ ...previous, [index]: [] }));
  };
  const yarnTotal = (item: RepresentativeItemInput) =>
    YARN_FIELDS.reduce(
      (sum, field) => sum + Number(item.yarnRatios?.[field.key] || 0),
      0,
    );
  const selectedCustomer = customers.find(
    (customer) => Number(customer.id) === selectedCustomerId,
  );
  const fillCustomer = async (customer: any) => {
    const detail = await representativeService.customers.getById(
      Number(customer.id),
    );
    if (!detail)
      return Alert.alert(
        t("تعذر تحميل ملف العميل", "Unable to load customer profile"),
        t("حاول البحث عن العميل مرة أخرى", "Search for the customer again."),
      );
    setSelectedCustomerId(Number(detail.id));
    setCustomerType(
      detail.customerType === "individual" ? "individual" : "institution",
    );
    setCustomerName(detail.name || "");
    setCommercialRegister(detail.commercialRegister || "");
    setTaxNumber(detail.taxNumber || "");
    setMunicipalLicense(detail.municipalLicense || "");
    setNationalAddress(detail.nationalAddress || "");
    setCity(detail.city || "");
    setDistrict(detail.district || "");
    setStreet(detail.street || "");
    setEmail(detail.email || "");
    setOwnerName(detail.ownerName || "");
    setOwnerPhone(detail.ownerPhone || "");
    setContactName(detail.contactName || "");
    setContactPhone(detail.contactPhone || "");
    setContactEmail(detail.contactEmail || "");
    setCustomerFiles(
      (detail.attachments || []).map((file: any) => ({
        uri: file.url || file.fileUrl,
        uploadedUrl: file.url || file.fileUrl,
        name: file.name || file.fileName,
        mimeType: file.mimeType,
      })),
    );
  };

  const attachments = useMemo(
    () => [
      ...generalFiles.map((file) => toAttachment("general", file)),
      ...designFiles.map((file) => toAttachment("design_file", file)),
      ...manufacturingFormFiles.map((file) =>
        toAttachment("manufacturing_form", file),
      ),
      ...samplePaymentFiles.map((file) =>
        toAttachment("sample_payment_80", file),
      ),
    ],
    [generalFiles, designFiles, manufacturingFormFiles, samplePaymentFiles],
  );

  const customerAttachments = useMemo(
    () =>
      customerFiles.map((file) =>
        toAttachment(getCustomerAttachmentType(file.name), file),
      ),
    [customerFiles],
  );

  const customerPayload = () => ({
    customerType,
    name: customerName.trim(),
    commercialRegister:
      customerType === "institution" ? commercialRegister.trim() : "",
    taxNumber: customerType === "institution" ? taxNumber.trim() : "",
    isTaxRegistered:
      customerType === "institution" && Boolean(taxNumber.trim()),
    municipalLicense:
      customerType === "institution" ? municipalLicense.trim() : "",
    nationalAddress:
      customerType === "institution" ? nationalAddress.trim() : "",
    city: customerType === "institution" ? city.trim() : "",
    district: customerType === "institution" ? district.trim() : "",
    street: customerType === "institution" ? street.trim() : "",
    email: customerType === "institution" ? email.trim() : "",
    ownerName: customerType === "institution" ? ownerName.trim() : "",
    ownerPhone:
      customerType === "institution" ? ownerPhone.trim() : contactPhone.trim(),
    contactName: customerType === "institution" ? contactName.trim() : "",
    contactPhone: contactPhone.trim(),
    contactEmail: customerType === "institution" ? contactEmail.trim() : "",
    attachments: customerType === "institution" ? customerAttachments : [],
  });

  const saveCustomerRecord = async () => {
    if (selectedCustomerId) return selectedCustomerId;
    const payload = customerPayload();
    if (customerType === "individual") {
      if (!payload.name || !payload.contactPhone)
        throw new Error(
          t(
            "بيانات الفرد المطلوبة هي الاسم ورقم الجوال",
            "An individual customer requires a name and mobile number",
          ),
        );
    } else {
      const required = [
        payload.name,
        payload.commercialRegister,
        payload.nationalAddress,
        payload.city,
        payload.district,
        payload.street,
        payload.ownerName,
        payload.ownerPhone,
        payload.contactName,
        payload.contactPhone,
      ];
      if (required.some((value) => !value))
        throw new Error(
          t(
            "أكمل بيانات المؤسسة الإلزامية في جدول بيانات العميل",
            "Complete the required organization details in the customer information table",
          ),
        );
      if (
        !hasRequiredCustomerAttachments(
          customerAttachments.map((file) => file.type),
        )
      )
        throw new Error(
          t(
            "أرفق السجل التجاري والعنوان الوطني للمؤسسة",
            "Attach the organization’s commercial registration and national address",
          ),
        );
    }
    const created = await representativeService.customers.create(payload);
    return Number(created.id);
  };

  const buildPayload = (
    customerId: number,
  ): RepresentativeTransactionInput => ({
    transactionType: type,
    customerId,
    customerStatus,
    orderDate,
    deliveryDate,
    visitReport:
      type === "visit"
        ? JSON.stringify({ action: visitAction, notes: visitNotes.trim() })
        : visitReport,
    returnReason,
    items: type === "visit" ? [] : items,
    attachments,
  });

  const requestedDozen = (item: RepresentativeItemInput) => {
    const dozen = Number(item.quantityDozen || 0);
    const pairs = Number(item.quantityPair || 0);
    return dozen > 0 || pairs > 0
      ? dozen + pairs / 12
      : item.quantityUnit === "pair"
        ? Number(item.quantity || 0) / 12
        : Number(item.quantity || 0);
  };
  const updateQuantity = (
    index: number,
    field: "quantityDozen" | "quantityPair",
    value: string,
  ) => {
    const parsed = parseQuantity(value);
    setItems((previous) =>
      previous.map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        const next = { ...item, [field]: parsed };
        const dozen = Number(next.quantityDozen || 0);
        const pairs = Number(next.quantityPair || 0);
        return {
          ...next,
          quantity: dozen * 12 + pairs,
          quantityUnit: pairs > 0 ? "pair" : "dozen",
        };
      }),
    );
  };
  const stockValidationMessage = (
    item: RepresentativeItemInput,
    index: number,
  ) => {
    const stock = selectedStock[index];
    if (type !== "order" || !stock) return "";
    const requested = requestedDozen(item);
    const available = Number(stock.quantityDozen || 0);
    return requested > available
      ? english
        ? `The requested quantity for ${item.productName} exceeds available stock (${available} dozen)`
        : `الكمية المطلوبة للصنف ${item.productName} تتجاوز الرصيد المتاح (${available} درزن)`
      : "";
  };

  const validate = () => {
    if (!customerName.trim())
      return t(
        "أدخل اسم العميل في جدول بيانات العميل",
        "Enter the customer name in the customer information table",
      );
    if (!orderDate) return t("تاريخ الطلب إلزامي", "Order date is required");
    if (["order", "custom", "sample"].includes(type) && !deliveryDate)
      return t("موعد التسليم إلزامي", "Delivery date is required");
    if (
      type !== "visit" &&
      items.some(
        (item) =>
          !item.productName.trim() ||
          !item.barcode?.trim() ||
          !item.size.trim() ||
          !item.color.trim() ||
          requestedDozen(item) <= 0,
      )
    )
      return t(
        "اختر كل منتج من القائمة أو أدخل اسمه وباركوده ومقاسه ولونه وكميته",
        "Select each product from the list, or enter its name, barcode, size, color, and quantity",
      );
    if (type === "order" && items.some((item, index) => !selectedStock[index]))
      return t(
        "اختر النسخة المحددة من القائمة السفلية لكل منتج؛ لا يمكن اعتماد كمية عامة",
        "Select the exact variant from the list below for every product; a general quantity cannot be approved",
      );
    const stockError = items.map(stockValidationMessage).find(Boolean);
    if (stockError) return stockError;
    if (type === "visit" && visitNotes.trim().length < 5)
      return t("أضف ملاحظات الزيارة", "Add visit notes");
    if (type === "return" && returnReason.trim().length < 5)
      return t("أدخل سبب المرتجع بوضوح", "Enter a clear return reason");
    if (
      isCustom &&
      items.some((item) => Math.abs(yarnTotal(item) - 100) > 0.01)
    )
      return t(
        "مجموع نسب الخيوط لكل منتج يجب أن يساوي 100%",
        "The yarn ratios for each product must total 100%",
      );
    if (
      type === "sample" &&
      items.some(
        (item) =>
          Number(item.quantityDozen || 0) !== 0 ||
          Number(
            item.quantityPair ||
              (item.quantityUnit === "pair" ? item.quantity : 0),
          ) < 1 ||
          Number(
            item.quantityPair ||
              (item.quantityUnit === "pair" ? item.quantity : 0),
          ) > 5,
      )
    )
      return t(
        "العينة من 1 إلى 5 أزواج فقط",
        "A sample must contain 1 to 5 pairs only",
      );
    if (type === "sample" && !samplePaymentFiles.length)
      return t(
        "إيصال تحويل 80 ريال إلزامي",
        "An 80 SAR transfer receipt is required",
      );
    return "";
  };

  const saveDraft = async () => {
    if (savingOrder) return;
    setSaveError("");
    setShowValidation(true);
    const error = validate();
    if (error) {
      setSaveError(error);
      return Alert.alert(t("بيانات ناقصة", "Missing information"), error);
    }
    setSavingOrder(true);
    try {
      const customerId = await saveCustomerRecord();
      const payload = buildPayload(customerId);
      if (type === "order") {
        if (editingId) {
          const result = await representativeService.transactions.updateDraft(
            editingId,
            payload,
          );
          const sent =
            await representativeService.transactions.submitOrderDirect(
              Number(result.id || editingId),
            );
          if (!sent?.success || sent.status !== "PENDING_SALES_APPROVAL")
            throw new Error(
              t(
                "تم حفظ الطلب كمسودة لكن تعذر إرساله لاعتماد مدير التسويق والمبيعات؛ أعد المحاولة",
                "The order was saved as a draft but could not be sent for Sales & Marketing approval. Please try again.",
              ),
            );
          Alert.alert(
            t("تم الإرسال للاعتماد", "Sent for approval"),
            english
              ? `Order ${sent.referenceCode || ""} was saved and sent to the Sales & Marketing Manager. It will not appear to warehouses before approval.`
              : `تم حفظ الطلب رقم ${sent.referenceCode || ""} وإرساله إلى مدير التسويق والمبيعات. لن يظهر للمستودعات قبل الاعتماد.`,
          );
        } else {
          const sent =
            await representativeService.transactions.createAndSubmitOrder(
              payload,
            );
          if (
            !sent?.success ||
            sent.status !== "PENDING_SALES_APPROVAL" ||
            sent.currentDepartment !== "sales_management"
          )
            throw new Error(
              t(
                "لم يتم تأكيد حفظ الطلب وإرساله لاعتماد مدير التسويق والمبيعات",
                "The order could not be confirmed and sent for Sales & Marketing approval",
              ),
            );
          Alert.alert(
            t("تم الإرسال للاعتماد", "Sent for approval"),
            english
              ? `Order ${sent.referenceCode || ""} was saved and sent to the Sales & Marketing Manager. It will not appear to warehouses before approval.`
              : `تم حفظ الطلب رقم ${sent.referenceCode || ""} وإرساله إلى مدير التسويق والمبيعات. لن يظهر للمستودعات قبل الاعتماد.`,
          );
        }
      } else {
        const result = editingId
          ? await representativeService.transactions.updateDraft(
              editingId,
              payload,
            )
          : await representativeService.transactions.createDraft(payload);
        Alert.alert(
          t("تم الحفظ", "Saved"),
          editingId
            ? t("تم تحديث المسودة", "Draft updated")
            : english
              ? `Draft ${result.referenceCode} was created`
              : `تم إنشاء المسودة ${result.referenceCode}`,
        );
      }
      reset();
      await load();
    } catch (error: any) {
      const message = failureMessage(
        error,
        "حدث خطأ غير متوقع أثناء الحفظ",
        "An unexpected error occurred while saving.",
      );
      setSaveError(message);
      Alert.alert(t("تعذر الحفظ", "Unable to save"), message);
    } finally {
      setSavingOrder(false);
    }
  };

  const editDraft = async (transaction: any) => {
    try {
      const detail = await representativeService.transactions.getById(
        Number(transaction.id),
      );
      if (detail.customer) fillCustomer(detail.customer);
      setEditingId(Number(detail.id));
      setCustomerStatus(detail.customerStatus === "new" ? "new" : "old");
      setOrderDate(detail.orderDate || TODAY);
      setDeliveryDate(detail.deliveryDate || "");
      setVisitReport(detail.visitReport || "");
      try {
        const parsedVisit = JSON.parse(detail.visitReport || "{}");
        setVisitAction(
          parsedVisit.action === "product_presentation"
            ? "product_presentation"
            : "follow_up",
        );
        setVisitNotes(parsedVisit.notes || "");
      } catch {
        setVisitAction("follow_up");
        setVisitNotes(detail.visitReport || "");
      }
      setReturnReason(detail.returnReason || "");
      setItems(
        detail.items?.length
          ? detail.items.map((item: any) => ({
              productName: item.productName,
              barcode: item.barcode || "",
              size: item.size,
              color: item.color,
              quantity: Number(item.quantity),
              quantityUnit: item.quantityUnit,
              quantityDozen: Number(
                item.quantityDozen ||
                  (item.quantityUnit === "dozen" ? item.quantity : 0),
              ),
              quantityPair: Number(
                item.quantityPair ||
                  (item.quantityUnit === "pair" ? item.quantity : 0),
              ),
              productType: item.productType || "",
              yarnRatios: item.yarnRatios || undefined,
            }))
          : [emptyItem(type)],
      );
      setStockSuggestions({});
      setSelectedStock({});
      setShowForm(true);
    } catch (error: any) {
      Alert.alert(
        t("تعذر فتح المسودة", "Unable to open draft"),
        failureMessage(error, "حدث خطأ", "Please try again."),
      );
    }
  };

  const signAndSubmit = async () => {
    if (!customerSignature || !representativeSignature)
      return Alert.alert(
        t("التوقيع مطلوب", "Signature required"),
        t(
          "يجب اعتماد توقيع العميل والمندوب",
          "Both the customer and representative signatures are required",
        ),
      );
    try {
      await representativeService.transactions.sign({
        id: Number(signing.id),
        declarationType: "customer_order",
        declarationText: `أقر بصحة بيانات المعاملة ${signing.referenceCode} والمنتجات والكميات`,
        declarerName: signing.customerName,
        declarerRole: "العميل",
        signatureData: customerSignature,
      });
      await representativeService.transactions.sign({
        id: Number(signing.id),
        declarationType: "representative_order",
        declarationText: `أقر بأنني راجعت بيانات العميل والمعاملة ${signing.referenceCode} والمرفقات`,
        declarerName: user?.name || "المندوب",
        declarerRole: "مندوب المبيعات",
        signatureData: representativeSignature,
      });
      await representativeService.transactions.submit(Number(signing.id));
      setSigning(null);
      setCustomerSignature("");
      setRepresentativeSignature("");
      await load();
      Alert.alert(
        t("تم الإرسال", "Sent"),
        t(
          "أُرسلت المعاملة رسمياً إلى مدير التسويق والمبيعات",
          "The transaction was officially sent to the Sales & Marketing Manager",
        ),
      );
    } catch (error: any) {
      Alert.alert(
        t("تعذر الإرسال", "Unable to send"),
        failureMessage(error, "حدث خطأ", "Please try again."),
      );
    }
  };

  const typeIcon =
    type === "order"
      ? "assignment"
      : type === "visit"
        ? "place"
        : type === "return"
          ? "keyboard-return"
          : type === "sample"
            ? "science"
            : "design-services";
  const relatedTypes: TransactionType[] = isCustom
    ? ["custom", "sample"]
    : ["order", "visit", "return"];
  const actualPreview =
    previewMode === "auto"
      ? viewportWidth >= 900
        ? "desktop"
        : "mobile"
      : previewMode;
  const previewHint =
    actualPreview === "desktop"
      ? t("معاينة الكمبيوتر", "Desktop preview")
      : t("معاينة الجوال", "Mobile preview");

  if (signing)
    return (
      <ScreenContainer
        style={{
          backgroundColor: colors.background,
        }}
      >
        <View style={[styles.header, { flexDirection: layoutDirection }]}>
          <BackButton onPress={() => setSigning(null)} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, directionStyle]}>
              {t("التوقيع والإرسال", "Sign and send")}
            </Text>
            <Text style={[styles.headerSubtitle, directionStyle]}>
              {signing.referenceCode} · {signing.customerName}
            </Text>
          </View>
          <MaterialIcons name="draw" size={25} color="#fff" />
        </View>
        <ScrollView contentContainerStyle={styles.form}>
          <View style={[styles.notice, { flexDirection: layoutDirection }]}>
            <Text style={[styles.noticeText, directionStyle]}>
              {t(
                "التوقيع يثبت نسخة بيانات العميل والمنتجات وقت الاعتماد، ولا تتغير هذه النسخة عند تحديث ملف العميل لاحقاً.",
                "Signatures confirm the customer and product data at approval time; this snapshot does not change when the customer profile is updated later.",
              )}
            </Text>
          </View>
          <SignaturePad
            label={t("توقيع العميل", "Customer signature")}
            onSave={setCustomerSignature}
          />
          <SignaturePad
            label={t("توقيع المندوب", "Representative signature")}
            onSave={setRepresentativeSignature}
          />
          <TouchableOpacity
            style={[
              styles.primaryButton,
              (!customerSignature || !representativeSignature) && {
                opacity: 0.5,
              },
            ]}
            onPress={() => void signAndSubmit()}
          >
            <MaterialIcons name="send" size={20} color="#fff" />
            <Text style={[styles.primaryText, directionStyle]}>
              {t(
                "اعتماد التوقيعين وإرسال المعاملة",
                "Confirm both signatures and send transaction",
              )}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </ScreenContainer>
    );

  return (
    <ScreenContainer
      style={{
        backgroundColor: colors.background,
      }}
    >
      <View style={[styles.header, { flexDirection: layoutDirection }]}>
        <BackButton />
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, directionStyle]}>
            {localize(
              language,
              TRANSACTION_LABELS[type].ar,
              TRANSACTION_LABELS[type].en,
            )}
          </Text>
          <Text style={[styles.headerSubtitle, directionStyle]}>
            {t(
              "دورة موثقة من الإنشاء حتى الاعتماد والإغلاق",
              "A documented workflow from creation through approval and closure",
            )}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => setShowForm(true)}
        >
          <MaterialIcons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
      <View style={[styles.modeBar, { flexDirection: layoutDirection }]}>
        {relatedTypes.map((mode) => (
          <TouchableOpacity
            key={mode}
            style={[
              styles.modeButton,
              type === mode && styles.modeButtonActive,
            ]}
            onPress={() =>
              router.replace({
                pathname: "/representative-transactions",
                params: { type: mode },
              } as any)
            }
          >
            <Text
              style={[styles.modeText, type === mode && styles.modeTextActive]}
            >
              {localize(
                language,
                TRANSACTION_LABELS[mode].ar,
                TRANSACTION_LABELS[mode].en,
              )}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {showForm ? (
        <>
          <View
            style={[styles.viewToolbar, { flexDirection: layoutDirection }]}
          >
            <View
              style={[styles.toolbarGroup, { flexDirection: layoutDirection }]}
            >
              <Text style={[styles.toolbarLabel, directionStyle]}>
                {t("المعاينة", "Preview")}
              </Text>
              <TouchableOpacity
                onPress={() => setPreviewMode("auto")}
                style={[
                  styles.toolbarButton,
                  previewMode === "auto" && styles.toolbarButtonActive,
                ]}
              >
                <Text
                  style={[
                    styles.toolbarButtonText,
                    directionStyle,
                    previewMode === "auto" && styles.toolbarButtonTextActive,
                  ]}
                >
                  {t("تلقائي", "Auto")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setPreviewMode("mobile")}
                style={[
                  styles.toolbarButton,
                  previewMode === "mobile" && styles.toolbarButtonActive,
                ]}
              >
                <Text
                  style={[
                    styles.toolbarButtonText,
                    directionStyle,
                    previewMode === "mobile" && styles.toolbarButtonTextActive,
                  ]}
                >
                  {t("جوال", "Mobile")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setPreviewMode("desktop")}
                style={[
                  styles.toolbarButton,
                  previewMode === "desktop" && styles.toolbarButtonActive,
                ]}
              >
                <Text
                  style={[
                    styles.toolbarButtonText,
                    directionStyle,
                    previewMode === "desktop" && styles.toolbarButtonTextActive,
                  ]}
                >
                  {t("كمبيوتر", "Desktop")}
                </Text>
              </TouchableOpacity>
            </View>
            <View
              style={[styles.toolbarGroup, { flexDirection: layoutDirection }]}
            >
              <Text style={[styles.toolbarLabel, directionStyle]}>
                {t("الكثافة", "Density")}
              </Text>
              <TouchableOpacity
                onPress={() => setDensity("compact")}
                style={[
                  styles.toolbarButton,
                  density === "compact" && styles.toolbarButtonActive,
                ]}
              >
                <Text
                  style={[
                    styles.toolbarButtonText,
                    directionStyle,
                    density === "compact" && styles.toolbarButtonTextActive,
                  ]}
                >
                  {t("مضغوط", "Compact")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setDensity("comfortable")}
                style={[
                  styles.toolbarButton,
                  density === "comfortable" && styles.toolbarButtonActive,
                ]}
              >
                <Text
                  style={[
                    styles.toolbarButtonText,
                    directionStyle,
                    density === "comfortable" && styles.toolbarButtonTextActive,
                  ]}
                >
                  {t("مريح", "Comfortable")}
                </Text>
              </TouchableOpacity>
            </View>
            <Text
              style={[
                styles.toolbarHint,
                directionStyle,
                {
                  marginRight: english ? undefined : "auto",
                  marginLeft: english ? "auto" : undefined,
                },
              ]}
            >
              {previewHint}
            </Text>
          </View>
          <ScrollView
            contentContainerStyle={[
              styles.form,
              density === "comfortable" && styles.formComfortable,
              actualPreview === "desktop" && styles.formDesktop,
              actualPreview === "mobile" && styles.formMobile,
            ]}
            keyboardShouldPersistTaps="handled"
          >
            <View style={[styles.notice, { flexDirection: layoutDirection }]}>
              <MaterialIcons name="person-pin" size={20} color="#0369a1" />
              <Text style={[styles.noticeText, directionStyle]}>
                {t(
                  "أدخل بيانات العميل في الجدول مرة واحدة. يمكنك اختيار ملف سابق ثم تعديله، أو إنشاء ملف جديد مباشرة قبل حفظ المعاملة.",
                  "Enter customer information once in the table. You can select and update an existing profile, or create a new profile immediately before saving the transaction.",
                )}
              </Text>
            </View>
            {type === "visit" && (
              <View style={styles.visitDateTop}>
                <Input
                  label={t("تاريخ الزيارة *", "Visit date *")}
                  value={orderDate}
                  onChangeText={setOrderDate}
                />
              </View>
            )}
            <View
              style={[styles.sectionHeader, { flexDirection: layoutDirection }]}
            >
              <Text style={[styles.sectionTitle, directionStyle]}>
                {t("جدول بيانات العميل", "Customer information")}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setSelectedCustomerId(null);
                  setCustomerType("institution");
                  setCustomerName("");
                  setCommercialRegister("");
                  setTaxNumber("");
                  setMunicipalLicense("");
                  setNationalAddress("");
                  setCity("");
                  setDistrict("");
                  setStreet("");
                  setEmail("");
                  setOwnerName("");
                  setOwnerPhone("");
                  setContactName("");
                  setContactPhone("");
                  setContactEmail("");
                  setCustomerFiles([]);
                }}
              >
                <Text style={[styles.link, directionStyle]}>
                  {t("عميل جديد", "New customer")}
                </Text>
              </TouchableOpacity>
            </View>
            <Input
              label={t("بحث في دليل العملاء", "Search customer directory")}
              value={customerSearch}
              onChangeText={setCustomerSearch}
            />
            {customerSearch.trim() ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.customerRow}
              >
                {customers.map((customer) => (
                  <TouchableOpacity
                    key={customer.id}
                    style={[
                      styles.customerChip,
                      selectedCustomerId === Number(customer.id) &&
                        styles.customerChipActive,
                    ]}
                    onPress={() => fillCustomer(customer)}
                  >
                    <Text
                      style={[
                        styles.customerChipTitle,
                        directionStyle,
                        selectedCustomerId === Number(customer.id) && {
                          color: "#fff",
                        },
                      ]}
                    >
                      {customer.name}
                    </Text>
                    <Text
                      style={[
                        styles.customerChipMeta,
                        directionStyle,
                        selectedCustomerId === Number(customer.id) && {
                          color: "#dbeafe",
                        },
                      ]}
                    >
                      {customer.customerCode}
                    </Text>
                    {!customer.isComplete && (
                      <Text style={[styles.incompleteCustomer, directionStyle]}>
                        {t(
                          "بيانات ناقصة — يمكن المتابعة",
                          "Incomplete details — you can continue",
                        )}
                      </Text>
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : (
              <Text style={[styles.searchHint, directionStyle]}>
                {t("اكتب اسم العميل للبحث", "Type a customer name to search")}
              </Text>
            )}
            <View
              style={[
                styles.customerOptionsBar,
                { flexDirection: layoutDirection },
              ]}
            >
              <View
                style={[
                  styles.customerOptionGroup,
                  { flexDirection: layoutDirection },
                ]}
              >
                <Text style={[styles.customerOptionLabel, directionStyle]}>
                  {t("حالة العميل", "Customer status")}
                </Text>
                <View
                  style={[styles.choiceRow, { flexDirection: layoutDirection }]}
                >
                  <TouchableOpacity
                    style={[
                      styles.choice,
                      customerStatus === "old" && styles.choiceActive,
                    ]}
                    onPress={() => setCustomerStatus("old")}
                  >
                    <Text
                      style={[
                        styles.choiceText,
                        customerStatus === "old" && styles.choiceTextActive,
                      ]}
                    >
                      {t("قديم", "Existing")}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.choice,
                      customerStatus === "new" && styles.choiceActive,
                    ]}
                    onPress={() => setCustomerStatus("new")}
                  >
                    <Text
                      style={[
                        styles.choiceText,
                        customerStatus === "new" && styles.choiceTextActive,
                      ]}
                    >
                      {t("جديد", "New")}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
              <View
                style={[
                  styles.customerOptionGroup,
                  { flexDirection: layoutDirection },
                ]}
              >
                <Text style={[styles.customerOptionLabel, directionStyle]}>
                  {t("نوع الحساب", "Account type")}
                </Text>
                <View
                  style={[styles.choiceRow, { flexDirection: layoutDirection }]}
                >
                  <TouchableOpacity
                    style={[
                      styles.choice,
                      customerType === "institution" && styles.choiceActive,
                    ]}
                    onPress={() => setCustomerType("institution")}
                  >
                    <Text
                      style={[
                        styles.choiceText,
                        customerType === "institution" &&
                          styles.choiceTextActive,
                      ]}
                    >
                      {t("مؤسسة", "Organization")}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.choice,
                      customerType === "individual" && styles.choiceActive,
                    ]}
                    onPress={() => setCustomerType("individual")}
                  >
                    <Text
                      style={[
                        styles.choiceText,
                        customerType === "individual" &&
                          styles.choiceTextActive,
                      ]}
                    >
                      {t("فرد", "Individual")}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
            {customerType === "individual" ? (
              <View style={styles.customerTable}>
                <View
                  style={[
                    styles.tableHeading,
                    { flexDirection: layoutDirection },
                  ]}
                >
                  <MaterialIcons name="person" size={19} color="#0369a1" />
                  <Text style={[styles.tableHeadingText, directionStyle]}>
                    {t("بيانات الفرد", "Individual details")}
                  </Text>
                </View>
                <View
                  style={[styles.sheetRow, { flexDirection: layoutDirection }]}
                >
                  <TableCell
                    value={customerName}
                    onChangeText={setCustomerName}
                    placeholder={t("الاسم الكامل *", "Full name *")}
                    wide
                    invalid={showValidation && !customerName.trim()}
                  />
                  <TableCell
                    value={contactPhone}
                    onChangeText={setContactPhone}
                    placeholder={t("رقم الجوال *", "Mobile number *")}
                    keyboardType="phone-pad"
                    invalid={showValidation && !contactPhone.trim()}
                  />
                </View>
              </View>
            ) : (
              <View style={styles.customerTable}>
                <View
                  style={[
                    styles.tableHeading,
                    { flexDirection: layoutDirection },
                  ]}
                >
                  <MaterialIcons name="business" size={19} color="#0369a1" />
                  <Text style={[styles.tableHeadingText, directionStyle]}>
                    {selectedCustomer
                      ? english
                        ? `Organization profile ${selectedCustomer.customerCode}`
                        : `ملف المؤسسة ${selectedCustomer.customerCode}`
                      : t("بيانات المؤسسة", "Organization details")}
                  </Text>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator
                  contentContainerStyle={styles.sheetScroll}
                >
                  <View style={styles.sheetMinWidth}>
                    <View
                      style={[
                        styles.sheetHeaderRow,
                        { flexDirection: layoutDirection },
                      ]}
                    >
                      <Text style={[styles.sheetHeaderCell, directionStyle]}>
                        {t("اسم المؤسسة *", "Organization name *")}
                      </Text>
                      <Text style={[styles.sheetHeaderCell, directionStyle]}>
                        {t("السجل التجاري *", "Commercial registration *")}
                      </Text>
                      <Text style={[styles.sheetHeaderCell, directionStyle]}>
                        {t("الرقم الضريبي", "Tax number")}
                      </Text>
                      <Text style={[styles.sheetHeaderCell, directionStyle]}>
                        {t("رخصة البلدية", "Municipal license")}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.sheetRow,
                        { flexDirection: layoutDirection },
                      ]}
                    >
                      <TableCell
                        value={customerName}
                        onChangeText={setCustomerName}
                        placeholder={t("اسم المؤسسة", "Organization name")}
                        invalid={showValidation && !customerName.trim()}
                      />
                      <TableCell
                        value={commercialRegister}
                        onChangeText={setCommercialRegister}
                        placeholder={t(
                          "السجل التجاري",
                          "Commercial registration",
                        )}
                        invalid={showValidation && !commercialRegister.trim()}
                      />
                      <TableCell
                        value={taxNumber}
                        onChangeText={setTaxNumber}
                        placeholder={t("اختياري", "Optional")}
                      />
                      <TableCell
                        value={municipalLicense}
                        onChangeText={setMunicipalLicense}
                        placeholder={t("اختياري", "Optional")}
                      />
                    </View>
                    <View
                      style={[
                        styles.sheetHeaderRow,
                        { flexDirection: layoutDirection },
                      ]}
                    >
                      <Text style={[styles.sheetHeaderCell, directionStyle]}>
                        {t("العنوان الوطني *", "National address *")}
                      </Text>
                      <Text style={[styles.sheetHeaderCell, directionStyle]}>
                        {t("المدينة *", "City *")}
                      </Text>
                      <Text style={[styles.sheetHeaderCell, directionStyle]}>
                        {t("الحي *", "District *")}
                      </Text>
                      <Text style={[styles.sheetHeaderCell, directionStyle]}>
                        {t("الشارع *", "Street *")}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.sheetRow,
                        { flexDirection: layoutDirection },
                      ]}
                    >
                      <TableCell
                        value={nationalAddress}
                        onChangeText={setNationalAddress}
                        placeholder={t("العنوان الوطني", "National address")}
                      />
                      <TableCell
                        value={city}
                        onChangeText={setCity}
                        placeholder={t("المدينة", "City")}
                      />
                      <TableCell
                        value={district}
                        onChangeText={setDistrict}
                        placeholder={t("الحي", "District")}
                      />
                      <TableCell
                        value={street}
                        onChangeText={setStreet}
                        placeholder={t("الشارع", "Street")}
                      />
                    </View>
                    <View
                      style={[
                        styles.sheetHeaderRow,
                        { flexDirection: layoutDirection },
                      ]}
                    >
                      <Text style={[styles.sheetHeaderCell, directionStyle]}>
                        {t("اسم المالك *", "Owner name *")}
                      </Text>
                      <Text style={[styles.sheetHeaderCell, directionStyle]}>
                        {t("جوال المالك *", "Owner mobile *")}
                      </Text>
                      <Text style={[styles.sheetHeaderCell, directionStyle]}>
                        {t("اسم المسؤول *", "Contact name *")}
                      </Text>
                      <Text style={[styles.sheetHeaderCell, directionStyle]}>
                        {t("جوال المسؤول *", "Contact mobile *")}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.sheetRow,
                        { flexDirection: layoutDirection },
                      ]}
                    >
                      <TableCell
                        value={ownerName}
                        onChangeText={setOwnerName}
                        placeholder={t("اسم المالك", "Owner name")}
                      />
                      <TableCell
                        value={ownerPhone}
                        onChangeText={setOwnerPhone}
                        placeholder={t("جوال المالك", "Owner mobile")}
                        keyboardType="phone-pad"
                      />
                      <TableCell
                        value={contactName}
                        onChangeText={setContactName}
                        placeholder={t("اسم المسؤول", "Contact name")}
                      />
                      <TableCell
                        value={contactPhone}
                        onChangeText={setContactPhone}
                        placeholder={t("جوال المسؤول", "Contact mobile")}
                        keyboardType="phone-pad"
                      />
                    </View>
                    <View
                      style={[
                        styles.sheetHeaderRow,
                        { flexDirection: layoutDirection },
                      ]}
                    >
                      <Text style={[styles.sheetHeaderCell, directionStyle]}>
                        {t("البريد الإلكتروني", "Email")}
                      </Text>
                      <Text style={[styles.sheetHeaderCell, directionStyle]}>
                        {t("إيميل المسؤول", "Contact email")}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.sheetRow,
                        { flexDirection: layoutDirection },
                      ]}
                    >
                      <TableCell
                        value={email}
                        onChangeText={setEmail}
                        placeholder={t("اختياري", "Optional")}
                        keyboardType="email-address"
                      />
                      <TableCell
                        value={contactEmail}
                        onChangeText={setContactEmail}
                        placeholder={t("اختياري", "Optional")}
                        keyboardType="email-address"
                      />
                    </View>
                  </View>
                </ScrollView>
                <AttachmentField
                  label={t(
                    "مرفقات المؤسسة (السجل التجاري والعنوان الوطني إلزاميان)",
                    "Organization attachments (commercial registration and national address are required)",
                  )}
                  files={customerFiles}
                  onChange={setCustomerFiles}
                  required
                />
              </View>
            )}
            {type !== "visit" && (
              <View
                style={[styles.twoColumns, { flexDirection: layoutDirection }]}
              >
                <Input
                  label={t("تاريخ الطلب *", "Order date *")}
                  value={orderDate}
                  onChangeText={setOrderDate}
                />
                <Input
                  label={t("موعد التسليم", "Delivery date")}
                  value={deliveryDate}
                  onChangeText={setDeliveryDate}
                />
              </View>
            )}
            {type === "visit" && (
              <View style={styles.customerTable}>
                <Text style={[styles.sectionTitle, directionStyle]}>
                  {t("بيانات الزيارة", "Visit details")}
                </Text>
                <Text style={styles.label}>
                  {t("نوع الزيارة *", "Visit type *")}
                </Text>
                <View
                  style={[styles.choiceRow, { flexDirection: layoutDirection }]}
                >
                  <TouchableOpacity
                    style={[
                      styles.choice,
                      visitAction === "follow_up" && styles.choiceActive,
                    ]}
                    onPress={() => setVisitAction("follow_up")}
                  >
                    <Text
                      style={[
                        styles.choiceText,
                        visitAction === "follow_up" && styles.choiceTextActive,
                      ]}
                    >
                      {t("متابعة", "Follow-up")}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.choice,
                      visitAction === "product_presentation" &&
                        styles.choiceActive,
                    ]}
                    onPress={() => setVisitAction("product_presentation")}
                  >
                    <Text
                      style={[
                        styles.choiceText,
                        visitAction === "product_presentation" &&
                          styles.choiceTextActive,
                      ]}
                    >
                      {t("عرض منتج", "Product presentation")}
                    </Text>
                  </TouchableOpacity>
                </View>
                <Input
                  label={t("ملاحظات إضافية *", "Additional notes *")}
                  value={visitNotes}
                  onChangeText={setVisitNotes}
                  multiline
                />
              </View>
            )}
            {type === "return" && (
              <Input
                label={t("سبب المرتجع *", "Return reason *")}
                value={returnReason}
                onChangeText={setReturnReason}
                multiline
              />
            )}
            {type === "visit" ? null : type === "order" ? (
              <>
                <View
                  style={[
                    styles.sectionHeader,
                    { flexDirection: layoutDirection },
                  ]}
                >
                  <Text style={[styles.sectionTitle, directionStyle]}>
                    {t("جدول الأصناف والمنتجات", "Items and products table")} (
                    {items.length}/{MAX_REPRESENTATIVE_ITEMS})
                  </Text>
                  <Text style={[styles.tableHint, directionStyle]}>
                    {t(
                      "الترتيب العربي: م ← اسم المنتج ← اللون ← المقاس ← الكمية ← إجراء",
                      "Table order: # → Product name → Color → Size → Quantity → Action",
                    )}
                  </Text>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator
                  contentContainerStyle={styles.sheetScroll}
                >
                  <View style={styles.orderProductSheet}>
                    <View
                      style={[
                        styles.orderProductHeaderRow,
                        { flexDirection: layoutDirection },
                      ]}
                    >
                      <Text style={styles.orderProductHeaderCellNumber}>
                        {t("م", "#")}
                      </Text>
                      <Text style={styles.orderProductHeaderCellWide}>
                        {t("اسم المنتج", "Product name")}
                      </Text>
                      <Text style={styles.orderProductHeaderCell}>
                        {t("اللون", "Color")}
                      </Text>
                      <Text style={styles.orderProductHeaderCell}>
                        {t("المقاس", "Size")}
                      </Text>
                      <View style={styles.orderQuantityHeader}>
                        <Text style={styles.orderProductHeaderText}>
                          {t("الكمية", "Quantity")}
                        </Text>
                        <View
                          style={[
                            styles.orderQuantitySubHeader,
                            { flexDirection: layoutDirection },
                          ]}
                        >
                          <Text style={styles.orderQuantitySubText}>
                            {t("درزن", "Dozen")}
                          </Text>
                          <Text style={styles.orderQuantitySubText}>
                            {t("زوج", "Pair")}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.orderProductHeaderCell}>
                        {t("إجراء", "Action")}
                      </Text>
                    </View>
                    {items.map((item, index) => (
                      <View
                        key={index}
                        style={[
                          styles.orderProductRow,
                          { flexDirection: layoutDirection },
                        ]}
                      >
                        <Text style={styles.orderRowNumber}>{index + 1}</Text>
                        <View style={styles.productNameCell}>
                          <TextInput
                            value={item.productName}
                            onChangeText={(value) =>
                              void searchStockForItem(index, value)
                            }
                            placeholder={t(
                              "اكتب حرفين للبحث",
                              "Type two characters to search",
                            )}
                            style={styles.orderCellInput}
                            textAlign={textAlign}
                          />
                          {selectedStock[index] && (
                            <Text
                              style={[styles.variantSelected, directionStyle]}
                            >
                              {t("المتاح:", "Available:")}{" "}
                              {Number(
                                selectedStock[index].quantityDozen || 0,
                              ).toLocaleString(locale)}{" "}
                              {t("درزن · المطلوب:", "dozen · Requested:")}{" "}
                              {requestedDozen(item).toLocaleString(locale)}{" "}
                              {t("درزن · المتبقي:", "dozen · Remaining:")}{" "}
                              {Math.max(
                                0,
                                Number(
                                  selectedStock[index].quantityDozen || 0,
                                ) - requestedDozen(item),
                              ).toLocaleString(locale)}{" "}
                              {t("درزن ·", "dozen ·")}{" "}
                              {selectedStock[index].productSize ||
                                t("غير محدد", "Not specified")}{" "}
                              ·{" "}
                              {selectedStock[index].productColor ||
                                t("غير محدد", "Not specified")}{" "}
                              · {selectedStock[index].barcode}
                            </Text>
                          )}
                        </View>
                        <OrderTableCell
                          value={item.color}
                          onChangeText={(value) =>
                            updateVariantValue(index, "color", value)
                          }
                          placeholder={t("اللون", "Color")}
                          width={130}
                        />
                        <OrderTableCell
                          value={item.size}
                          onChangeText={(value) =>
                            updateVariantValue(index, "size", value)
                          }
                          placeholder={t("المقاس (اختياري)", "Size (optional)")}
                          width={130}
                        />
                        <View
                          style={[
                            styles.orderQuantityCell,
                            { flexDirection: layoutDirection },
                            showValidation &&
                              requestedDozen(item) <= 0 &&
                              styles.invalidCell,
                          ]}
                        >
                          <View style={styles.quantityColumn}>
                            <Text style={styles.quantityColumnLabel}>
                              {t("درزن", "Dozen")}
                            </Text>
                            <TextInput
                              value={String(item.quantityDozen || 0)}
                              onChangeText={(value) =>
                                updateQuantity(index, "quantityDozen", value)
                              }
                              placeholder="0"
                              keyboardType="numeric"
                              style={styles.orderQuantityInput}
                              textAlign="center"
                            />
                          </View>
                          <View style={styles.quantityColumn}>
                            <Text style={styles.quantityColumnLabel}>
                              {t("زوج", "Pair")}
                            </Text>
                            <TextInput
                              value={String(item.quantityPair || 0)}
                              onChangeText={(value) =>
                                updateQuantity(index, "quantityPair", value)
                              }
                              placeholder="0"
                              keyboardType="numeric"
                              style={styles.orderQuantityInput}
                              textAlign="center"
                            />
                          </View>
                        </View>
                        <TouchableOpacity
                          disabled={items.length === 1}
                          onPress={() =>
                            setItems(
                              items.filter(
                                (_, itemIndex) => itemIndex !== index,
                              ),
                            )
                          }
                          style={styles.orderDeleteCell}
                        >
                          <MaterialIcons
                            name="delete-outline"
                            size={19}
                            color={items.length === 1 ? "#cbd5e1" : "#dc2626"}
                          />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                </ScrollView>
                {activeStockSearchIndex !== null &&
                  (stockSuggestions[activeStockSearchIndex] || []).length >
                    0 && (
                    <View style={styles.bottomProductPicker}>
                      <Text
                        style={[
                          styles.bottomProductPickerTitle,
                          directionStyle,
                        ]}
                      >
                        {t(
                          "اختر المنتج المناسب —",
                          "Choose the right product —",
                        )}{" "}
                        {
                          (stockSuggestions[activeStockSearchIndex] || [])
                            .length
                        }{" "}
                        {t("نتيجة", "results")}
                      </Text>
                      <Text
                        style={[styles.bottomProductPickerHint, directionStyle]}
                      >
                        {t(
                          "مرر القائمة للأسفل لرؤية جميع النتائج. البحث بالاسم أو الباركود، والكمية تخص المقاس واللون المحددين فقط",
                          "Scroll down to view all results. Search by name or barcode; quantity applies only to the selected size and color.",
                        )}
                      </Text>
                      <ScrollView
                        style={styles.bottomProductResults}
                        nestedScrollEnabled
                        showsVerticalScrollIndicator
                        keyboardShouldPersistTaps="handled"
                      >
                        {(stockSuggestions[activeStockSearchIndex] || []).map(
                          (stock) => (
                            <TouchableOpacity
                              key={stock.id}
                              onPress={() =>
                                selectStockForItem(
                                  activeStockSearchIndex,
                                  stock,
                                )
                              }
                              style={styles.bottomProductOption}
                            >
                              <View
                                style={[
                                  styles.bottomProductOptionMain,
                                  { flexDirection: layoutDirection },
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.bottomProductName,
                                    directionStyle,
                                  ]}
                                >
                                  {stock.productName}
                                </Text>
                                <Text style={styles.bottomProductStock}>
                                  {Number(
                                    stock.quantityDozen || 0,
                                  ).toLocaleString(locale)}{" "}
                                  {t("درزن", "dozen")}{" "}
                                  {stock.noStockYet
                                    ? t(
                                        "— محفوظ في الدليل بلا رصيد",
                                        "— listed in the catalog with no stock",
                                      )
                                    : t("متاح", "Available")}
                                </Text>
                              </View>
                              <Text
                                style={[
                                  styles.bottomProductDetails,
                                  directionStyle,
                                ]}
                              >
                                {t("المقاس:", "Size:")}{" "}
                                {stock.productSize ||
                                  t("غير محدد", "Not specified")}{" "}
                                · {t("اللون:", "Color:")}{" "}
                                {stock.productColor ||
                                  t("غير محدد", "Not specified")}{" "}
                                · {t("الباركود:", "Barcode:")}{" "}
                                {stock.barcode || t("غير مسجل", "Not recorded")}
                              </Text>
                            </TouchableOpacity>
                          ),
                        )}
                      </ScrollView>
                      <Text style={styles.bottomProductPickerFooter}>
                        {t(
                          "اسحب داخل القائمة لرؤية بقية الأصناف ثم اضغط على النسخة المطلوبة",
                          "Scroll within the list to see the remaining items, then select the required variant",
                        )}
                      </Text>
                    </View>
                  )}
                <View
                  style={[
                    styles.stockNotice,
                    { flexDirection: layoutDirection },
                  ]}
                >
                  <MaterialIcons name="inventory" size={18} color="#166534" />
                  <Text style={[styles.stockNoticeText, directionStyle]}>
                    {t(
                      "يظهر رصيد المستودع بعد اختيار النسخة المحددة بالمقاس واللون والباركود. المطلوب والمتبقي يحسبان لهذه النسخة فقط.",
                      "Warehouse stock appears after selecting the exact size, color, and barcode variant. Requested and remaining amounts are calculated for this variant only.",
                    )}
                  </Text>
                  <TouchableOpacity
                    onPress={() =>
                      router.push("/product-manufacturing-request")
                    }
                  >
                    <Text style={styles.stockRequestLink}>
                      {t(
                        "طلب تصنيع عند النقص",
                        "Request manufacturing when short",
                      )}
                    </Text>
                  </TouchableOpacity>
                </View>
                {canAddRepresentativeItem(items.length) ? (
                  <TouchableOpacity
                    style={[styles.addItem, { flexDirection: layoutDirection }]}
                    onPress={() => setItems([...items, emptyItem(type)])}
                  >
                    <MaterialIcons
                      name="add-circle"
                      size={20}
                      color="#0a7ea4"
                    />
                    <Text style={[styles.link, directionStyle]}>
                      {t("إضافة صف منتج", "Add product row")} ({items.length}/
                      {MAX_REPRESENTATIVE_ITEMS})
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.limitNote}>
                    {t("تم الوصول إلى الحد الأقصى:", "Maximum reached:")}{" "}
                    {MAX_REPRESENTATIVE_ITEMS} {t("منتجات", "products")}
                  </Text>
                )}
              </>
            ) : (
              <>
                <View
                  style={[
                    styles.sectionHeader,
                    { flexDirection: layoutDirection },
                  ]}
                >
                  <Text style={[styles.sectionTitle, directionStyle]}>
                    {t("جدول الأصناف والمنتجات", "Items and products table")} (
                    {items.length}/{MAX_REPRESENTATIVE_ITEMS})
                  </Text>
                  <Text style={[styles.tableHint, directionStyle]}>
                    {t(
                      "جدول قابل للتمرير مثل Excel",
                      "Scrollable spreadsheet-style table",
                    )}
                  </Text>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator
                  contentContainerStyle={styles.sheetScroll}
                >
                  <View style={styles.productSheet}>
                    <View
                      style={[
                        styles.productHeaderRow,
                        { flexDirection: layoutDirection },
                      ]}
                    >
                      <Text style={styles.productHeaderCell}>#</Text>
                      <Text style={styles.productHeaderCellWide}>
                        {t("اسم المنتج", "Product name")}
                      </Text>
                      <Text style={styles.productHeaderCell}>
                        {t("المقاس", "Size")}
                      </Text>
                      <Text style={styles.productHeaderCell}>
                        {t("اللون", "Color")}
                      </Text>
                      <Text style={styles.productHeaderCell}>
                        {t("الكمية", "Quantity")}
                      </Text>
                      <Text style={styles.productHeaderCell}>
                        {t("الوحدة", "Unit")}
                      </Text>
                      <Text style={styles.productHeaderCell}>
                        {t("إجراء", "Action")}
                      </Text>
                    </View>
                    {items.map((item, index) => (
                      <View
                        key={index}
                        style={[
                          styles.productRow,
                          { flexDirection: layoutDirection },
                        ]}
                      >
                        <Text style={styles.rowNumber}>{index + 1}</Text>
                        <TableCell
                          value={item.productName}
                          onChangeText={(value) =>
                            updateItem(index, { productName: value })
                          }
                          placeholder={t("اسم المنتج", "Product name")}
                          wide
                        />
                        <TableCell
                          value={item.size}
                          onChangeText={(value) =>
                            updateItem(index, { size: value })
                          }
                          placeholder={t("المقاس", "Size")}
                        />
                        <TableCell
                          value={item.color}
                          onChangeText={(value) =>
                            updateItem(index, { color: value })
                          }
                          placeholder={t("اللون", "Color")}
                        />
                        <TableCell
                          value={String(item.quantity)}
                          onChangeText={(value) =>
                            updateItem(index, { quantity: Number(value || 0) })
                          }
                          placeholder="0"
                          keyboardType="numeric"
                        />
                        <View
                          style={[
                            styles.unitCell,
                            { flexDirection: layoutDirection },
                          ]}
                        >
                          {(["dozen", "pair"] as const).map((unit) => (
                            <TouchableOpacity
                              key={unit}
                              style={[
                                styles.unitButton,
                                item.quantityUnit === unit &&
                                  styles.unitButtonActive,
                              ]}
                              onPress={() =>
                                updateItem(index, { quantityUnit: unit })
                              }
                            >
                              <Text
                                style={[
                                  styles.unitButtonText,
                                  item.quantityUnit === unit &&
                                    styles.unitButtonTextActive,
                                ]}
                              >
                                {unit === "dozen"
                                  ? t("درزن", "Dozen")
                                  : t("زوج", "Pair")}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                        <TouchableOpacity
                          disabled={items.length === 1}
                          onPress={() =>
                            setItems(
                              items.filter(
                                (_, itemIndex) => itemIndex !== index,
                              ),
                            )
                          }
                          style={styles.deleteCell}
                        >
                          <MaterialIcons
                            name="delete-outline"
                            size={19}
                            color={items.length === 1 ? "#cbd5e1" : "#dc2626"}
                          />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                </ScrollView>
                {canAddRepresentativeItem(items.length) ? (
                  <TouchableOpacity
                    style={[styles.addItem, { flexDirection: layoutDirection }]}
                    onPress={() => setItems([...items, emptyItem(type)])}
                  >
                    <MaterialIcons
                      name="add-circle"
                      size={20}
                      color="#0a7ea4"
                    />
                    <Text style={[styles.link, directionStyle]}>
                      {t("إضافة صف منتج", "Add product row")} ({items.length}/
                      {MAX_REPRESENTATIVE_ITEMS})
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.limitNote}>
                    {t("تم الوصول إلى الحد الأقصى:", "Maximum reached:")}{" "}
                    {MAX_REPRESENTATIVE_ITEMS} {t("منتجات", "products")}
                  </Text>
                )}
              </>
            )}
            {isCustom && (
              <>
                <AttachmentField
                  label={t("نموذج التصنيع", "Manufacturing form")}
                  required
                  files={manufacturingFormFiles}
                  onChange={setManufacturingFormFiles}
                />
                <AttachmentField
                  label={t("ملف التصميم", "Design file")}
                  required
                  files={designFiles}
                  onChange={setDesignFiles}
                />
              </>
            )}
            {type === "sample" && (
              <AttachmentField
                label={t("إيصال تحويل 80 ريال", "80 SAR transfer receipt")}
                required
                files={samplePaymentFiles}
                onChange={setSamplePaymentFiles}
              />
            )}
            <AttachmentField
              label={t("مرفقات إضافية", "Additional attachments")}
              files={generalFiles}
              onChange={setGeneralFiles}
            />
            {saveError ? (
              <View style={styles.saveErrorBox}>
                <MaterialIcons name="error-outline" size={20} color="#b91c1c" />
                <Text style={[styles.saveErrorText, directionStyle]}>
                  {saveError}
                </Text>
              </View>
            ) : null}
            <View
              style={[styles.actionRow, { flexDirection: layoutDirection }]}
            >
              <TouchableOpacity
                style={[styles.actionButton, styles.secondaryButton]}
                onPress={reset}
                disabled={savingOrder}
              >
                <Text style={[styles.secondaryText, directionStyle]}>
                  {t("إلغاء", "Cancel")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  styles.primaryButton,
                  savingOrder && { opacity: 0.6 },
                ]}
                onPress={() => void saveDraft()}
                disabled={savingOrder}
              >
                <MaterialIcons name="save" size={19} color="#fff" />
                <Text style={[styles.primaryText, directionStyle]}>
                  {savingOrder
                    ? t("جارٍ الحفظ والإرسال...", "Saving and sending...")
                    : type === "order"
                      ? t(
                          "حفظ الطلب وإرساله لاعتماد التسويق",
                          "Save order and send for Sales approval",
                        )
                      : t("حفظ كمسودة", "Save as draft")}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </>
      ) : loading ? (
        <ActivityIndicator style={{ marginTop: 50 }} color={colors.primary} />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {transactions.length === 0 ? (
            <Text style={[styles.empty, directionStyle]}>
              {t(
                "لا توجد معاملات من هذا النوع",
                "No transactions of this type",
              )}
            </Text>
          ) : (
            transactions.map((transaction) => (
              <View key={transaction.id} style={styles.card}>
                <View
                  style={[
                    styles.cardHeader,
                    { flexDirection: layoutDirection },
                  ]}
                >
                  <View
                    style={[
                      styles.statusBadge,
                      transaction.isOverdue && { backgroundColor: "#fee2e2" },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        transaction.isOverdue && { color: "#b91c1c" },
                      ]}
                    >
                      {transaction.isOverdue ? t("متأخر · ", "Overdue · ") : ""}
                      {STATUS_LABELS[transaction.status]
                        ? localize(
                            language,
                            STATUS_LABELS[transaction.status].ar,
                            STATUS_LABELS[transaction.status].en,
                          )
                        : transaction.status}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardTitle, directionStyle]}>
                      {transaction.customerName}
                    </Text>
                    <Text style={[styles.cardMeta, directionStyle]}>
                      {transaction.referenceCode} · {transaction.orderDate} ·{" "}
                      {transaction.customerType === "individual"
                        ? t("فرد", "Individual")
                        : t("مؤسسة", "Organization")}{" "}
                      ·{" "}
                      {transaction.customerStatus === "new"
                        ? t("جديد", "New")
                        : t("قديم", "Existing")}
                    </Text>
                  </View>
                  <MaterialIcons
                    name={typeIcon as any}
                    size={24}
                    color="#0a7ea4"
                  />
                </View>
                <Text style={[styles.cardMeta, directionStyle]}>
                  {t("العميل:", "Customer:")}{" "}
                  {transaction.customer?.name || transaction.customerName} ·{" "}
                  {t("المسؤول:", "Contact:")}{" "}
                  {transaction.customer?.contactName || "—"} ·{" "}
                  {t("الجوال:", "Mobile:")}{" "}
                  {transaction.customer?.contactPhone || "—"}
                </Text>
                <Text style={[styles.cardMeta, directionStyle]}>
                  {t("النوع:", "Type:")}{" "}
                  {transaction.customer?.customerType === "individual"
                    ? t("فرد", "Individual")
                    : t("مؤسسة", "Organization")}{" "}
                  · {t("الحالة:", "Status:")}{" "}
                  {transaction.customerStatus === "new"
                    ? t("جديد", "New")
                    : t("قديم", "Existing")}{" "}
                  · {t("المدينة:", "City:")} {transaction.customer?.city || "—"}{" "}
                  · {t("العنوان:", "Address:")}{" "}
                  {transaction.customer?.nationalAddress || "—"}
                </Text>
                {type === "visit" && (
                  <Text style={[styles.cardMeta, directionStyle]}>
                    {t("الزيارة:", "Visit:")}{" "}
                    {(() => {
                      try {
                        const v = JSON.parse(transaction.visitReport || "{}");
                        return `${v.action === "product_presentation" ? t("عرض منتج", "Product presentation") : t("متابعة", "Follow-up")} · ${v.notes || "—"}`;
                      } catch {
                        return transaction.visitReport || "—";
                      }
                    })()}
                  </Text>
                )}
                <Text style={[styles.cardMeta, directionStyle]}>
                  {t("المندوب:", "Representative:")}{" "}
                  {transaction.representativeName}
                </Text>
                <Text style={[styles.cardMeta, directionStyle]}>
                  {t("المسؤول الحالي:", "Current department:")}{" "}
                  {transaction.currentDepartment}
                </Text>
                <View
                  style={[
                    styles.cardActions,
                    { flexDirection: layoutDirection },
                  ]}
                >
                  {transaction.status === "DRAFT" && (
                    <>
                      <TouchableOpacity
                        style={styles.editAction}
                        onPress={() => void editDraft(transaction)}
                      >
                        <MaterialIcons name="edit" size={17} color="#0369a1" />
                        <Text style={styles.editActionText}>
                          {t("تعديل", "Edit")}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.signAction}
                        onPress={() => setSigning(transaction)}
                      >
                        <MaterialIcons name="draw" size={17} color="#fff" />
                        <Text style={styles.signActionText}>
                          {t("التوقيع والإرسال", "Sign and send")}
                        </Text>
                      </TouchableOpacity>
                    </>
                  )}
                  <TouchableOpacity
                    style={styles.detailAction}
                    onPress={() =>
                      router.push({
                        pathname: "/representative-approvals",
                        params: { id: String(transaction.id) },
                      } as any)
                    }
                  >
                    <MaterialIcons name="history" size={17} color="#475569" />
                    <Text style={styles.detailActionText}>
                      {t("التفاصيل", "Details")}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: "#0a7ea4",
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  headerTitle: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "900",
    textAlign: "right",
  },
  headerSubtitle: {
    color: "#dbeafe",
    fontSize: 10,
    textAlign: "right",
    marginTop: 1,
  },
  headerButton: { backgroundColor: "#ffffff26", borderRadius: 18, padding: 7 },
  modeBar: {
    flexDirection: "row-reverse",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  modeButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 7,
    borderRadius: 7,
    backgroundColor: "#f1f5f9",
  },
  modeButtonActive: { backgroundColor: "#0a7ea4" },
  modeText: { color: "#475569", fontWeight: "800", fontSize: 10 },
  modeTextActive: { color: "#fff" },
  invalidCell: {
    borderColor: "#dc2626",
    borderWidth: 2,
    backgroundColor: "#fef2f2",
  },
  stockNotice: {
    backgroundColor: "#f0fdf4",
    borderWidth: 1,
    borderColor: "#bbf7d0",
    borderRadius: 8,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  stockNoticeText: {
    flex: 1,
    color: "#166534",
    fontSize: 12,
    textAlign: "right",
  },
  stockRequestLink: { color: "#2563eb", fontWeight: "800", fontSize: 12 },
  productNameCell: { width: 260, position: "relative", zIndex: 2 },
  rowSuggestions: { display: "none" },
  bottomProductPicker: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#38bdf8",
    borderRadius: 8,
    backgroundColor: "#fff",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 5,
    elevation: 4,
  },
  bottomProductPickerTitle: {
    backgroundColor: "#e0f2fe",
    color: "#075985",
    padding: 9,
    textAlign: "right",
    fontSize: 12,
    fontWeight: "900",
  },
  bottomProductPickerHint: {
    color: "#475569",
    paddingHorizontal: 9,
    paddingBottom: 6,
    textAlign: "right",
    fontSize: 10,
  },
  bottomProductResults: { maxHeight: 320 },
  bottomProductPickerFooter: {
    backgroundColor: "#f8fafc",
    color: "#0369a1",
    padding: 7,
    textAlign: "center",
    fontSize: 10,
    fontWeight: "800",
  },
  bottomProductOption: {
    padding: 9,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  bottomProductOptionMain: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    gap: 8,
  },
  bottomProductName: {
    color: "#0f172a",
    textAlign: "right",
    fontSize: 12,
    fontWeight: "900",
    flex: 1,
  },
  bottomProductStock: { color: "#166534", fontSize: 11, fontWeight: "900" },
  bottomProductDetails: {
    color: "#475569",
    textAlign: "right",
    fontSize: 10,
    marginTop: 3,
  },
  rowSuggestionTitle: {
    backgroundColor: "#e0f2fe",
    color: "#075985",
    padding: 7,
    textAlign: "right",
    fontSize: 10,
    fontWeight: "900",
  },
  rowSuggestion: {
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    gap: 3,
  },
  rowSuggestionName: {
    color: "#0f172a",
    textAlign: "right",
    fontSize: 12,
    fontWeight: "900",
  },
  rowSuggestionDetails: { color: "#475569", textAlign: "right", fontSize: 10 },
  variantSelected: {
    color: "#166534",
    backgroundColor: "#f0fdf4",
    padding: 4,
    textAlign: "right",
    fontSize: 10,
    fontWeight: "800",
  },
  form: { padding: 8, paddingBottom: 48, gap: 4 },
  formComfortable: { gap: 7, padding: 10 },
  formDesktop: { width: "100%", maxWidth: 1180, alignSelf: "center" },
  formMobile: { width: "100%", maxWidth: 560, alignSelf: "center" },
  viewToolbar: {
    flexDirection: "row-reverse",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: "#f8fafc",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  toolbarGroup: { flexDirection: "row-reverse", alignItems: "center", gap: 3 },
  toolbarLabel: { color: "#475569", fontSize: 10, fontWeight: "900" },
  toolbarButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 5,
    backgroundColor: "#e2e8f0",
  },
  toolbarButtonActive: { backgroundColor: "#0a7ea4" },
  toolbarButtonText: { color: "#475569", fontSize: 10, fontWeight: "800" },
  toolbarButtonTextActive: { color: "#fff" },
  toolbarHint: { color: "#64748b", fontSize: 9, marginRight: "auto" },
  notice: {
    flexDirection: "row-reverse",
    backgroundColor: "#e0f2fe",
    borderRadius: 8,
    padding: 8,
    gap: 6,
  },
  noticeText: {
    flex: 1,
    color: "#075985",
    textAlign: "right",
    lineHeight: 16,
    fontSize: 11,
  },
  visitDateTop: { width: "100%", marginBottom: 1 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: {
    color: "#0f172a",
    fontSize: 13,
    fontWeight: "900",
    textAlign: "right",
    marginTop: 3,
  },
  link: { color: "#0a7ea4", fontWeight: "800", fontSize: 12 },
  field: { flex: 1, gap: 3 },
  label: {
    color: "#0f172a",
    fontWeight: "700",
    textAlign: "right",
    fontSize: 11,
  },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 7,
    padding: 8,
    minHeight: 36,
    color: "#0f172a",
    fontSize: 12,
  },
  multiline: { minHeight: 60, textAlignVertical: "top" },
  twoColumns: { flexDirection: "row-reverse", gap: 6 },
  customerOptionsBar: { flexDirection: "row-reverse", gap: 6, marginBottom: 4 },
  customerOptionGroup: {
    flex: 1,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 5,
    padding: 4,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 6,
  },
  customerOptionLabel: {
    color: "#075985",
    fontSize: 10,
    fontWeight: "900",
    minWidth: 56,
    textAlign: "right",
  },
  customerTypeBar: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
    padding: 5,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 5,
  },
  customerTable: {
    width: "100%",
    alignSelf: "stretch",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#dbeafe",
    borderRadius: 9,
    padding: 7,
    gap: 6,
  },
  tableHeading: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 5,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#dbeafe",
  },
  tableHeadingText: {
    color: "#075985",
    fontSize: 12,
    fontWeight: "900",
    textAlign: "right",
  },
  tableHint: { color: "#64748b", fontSize: 9, textAlign: "right" },
  customerRow: { gap: 5, paddingVertical: 2, maxHeight: 58 },
  customerChip: {
    minWidth: 135,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 7,
    padding: 6,
  },
  customerChipActive: { backgroundColor: "#0a7ea4", borderColor: "#0a7ea4" },
  customerChipTitle: {
    color: "#0f172a",
    fontWeight: "800",
    textAlign: "right",
    fontSize: 11,
  },
  customerChipMeta: {
    color: "#64748b",
    fontSize: 9,
    textAlign: "right",
    marginTop: 2,
  },
  incompleteCustomer: {
    color: "#b45309",
    fontSize: 9,
    textAlign: "right",
    marginTop: 2,
    fontWeight: "700",
  },
  searchHint: {
    color: "#64748b",
    fontSize: 10,
    textAlign: "right",
    paddingVertical: 4,
  },
  choiceRow: { flex: 1, flexDirection: "row-reverse", gap: 4 },
  choice: {
    flex: 1,
    backgroundColor: "#f1f5f9",
    borderRadius: 5,
    alignItems: "center",
    paddingVertical: 5,
  },
  choiceActive: { backgroundColor: "#0a7ea4" },
  choiceText: { color: "#475569", fontWeight: "700", fontSize: 10 },
  choiceTextActive: { color: "#fff" },
  limitNote: {
    color: "#b45309",
    backgroundColor: "#fffbeb",
    borderRadius: 7,
    padding: 6,
    textAlign: "center",
    fontWeight: "800",
    fontSize: 11,
  },
  addItem: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 4,
    padding: 5,
  },
  attachmentBox: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    padding: 7,
    gap: 5,
  },
  actionRow: { flexDirection: "row", gap: 6, marginTop: 3 },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 10,
    borderRadius: 8,
  },
  secondaryButton: { backgroundColor: "#e2e8f0" },
  primaryButton: { backgroundColor: "#0a7ea4" },
  saveErrorBox: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 8,
    padding: 7,
  },
  saveErrorText: {
    flex: 1,
    color: "#b91c1c",
    fontWeight: "800",
    textAlign: "right",
    lineHeight: 16,
    fontSize: 11,
  },
  secondaryText: { color: "#475569", fontWeight: "800", fontSize: 12 },
  primaryText: { color: "#fff", fontWeight: "900", fontSize: 12 },
  list: { padding: 8, paddingBottom: 40, gap: 5 },
  empty: { color: "#64748b", textAlign: "center", marginTop: 30 },
  card: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 9,
    padding: 8,
    gap: 4,
  },
  cardHeader: { flexDirection: "row-reverse", alignItems: "center", gap: 6 },
  cardTitle: {
    color: "#0f172a",
    fontSize: 13,
    fontWeight: "900",
    textAlign: "right",
  },
  cardMeta: { color: "#64748b", fontSize: 10, textAlign: "right" },
  statusBadge: {
    backgroundColor: "#fef3c7",
    borderRadius: 9,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  statusText: { color: "#92400e", fontSize: 9, fontWeight: "800" },
  cardActions: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 5,
    marginTop: 3,
  },
  editAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#e0f2fe",
    borderRadius: 7,
    padding: 6,
  },
  editActionText: { color: "#0369a1", fontWeight: "800", fontSize: 10 },
  signAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#0a7ea4",
    borderRadius: 7,
    padding: 6,
  },
  signActionText: { color: "#fff", fontWeight: "800", fontSize: 10 },
  detailAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#f1f5f9",
    borderRadius: 7,
    padding: 6,
  },
  detailActionText: { color: "#475569", fontWeight: "800", fontSize: 10 },
  sheetScroll: {
    width: "100%",
    minWidth: "100%",
    paddingBottom: 1,
    alignSelf: "stretch",
    alignItems: "stretch",
  },
  sheetMinWidth: {
    width: "100%",
    minWidth: 0,
    alignSelf: "stretch",
    flexGrow: 1,
  },
  productSheet: {
    borderWidth: 1,
    borderColor: "#94a3b8",
    borderRadius: 4,
    overflow: "hidden",
    backgroundColor: "#fff",
  },
  sheetHeaderRow: {
    flexDirection: "row-reverse",
    backgroundColor: "#e2e8f0",
    borderBottomWidth: 1,
    borderBottomColor: "#94a3b8",
  },
  sheetRow: {
    flexDirection: "row-reverse",
    borderBottomWidth: 1,
    borderBottomColor: "#cbd5e1",
  },
  sheetHeaderCell: {
    flex: 1,
    minWidth: 0,
    minHeight: 24,
    paddingHorizontal: 5,
    paddingVertical: 4,
    borderLeftWidth: 1,
    borderLeftColor: "#94a3b8",
    color: "#1e293b",
    fontSize: 10,
    fontWeight: "900",
    textAlign: "right",
  },
  sheetCell: {
    flex: 1,
    minWidth: 0,
    minHeight: 36,
    padding: 3,
    borderLeftWidth: 1,
    borderLeftColor: "#cbd5e1",
    justifyContent: "center",
  },
  sheetCellWide: { flex: 1.1 },
  sheetInput: {
    height: 28,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 3,
    paddingHorizontal: 5,
    paddingVertical: 3,
    color: "#0f172a",
    backgroundColor: "#fff",
    fontSize: 11,
  },
  orderProductSheet: {
    borderWidth: 1,
    borderColor: "#1f2937",
    borderRadius: 1,
    overflow: "hidden",
    backgroundColor: "#fff",
    alignSelf: "flex-start",
  },
  orderProductHeaderRow: {
    flexDirection: "row-reverse",
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#1f2937",
    alignItems: "stretch",
  },
  orderProductHeaderCell: {
    width: 70,
    minHeight: 42,
    paddingHorizontal: 4,
    paddingVertical: 8,
    borderLeftWidth: 1,
    borderLeftColor: "#1f2937",
    color: "#111827",
    fontSize: 11,
    fontWeight: "900",
    textAlign: "center",
  },
  orderProductHeaderCellNumber: {
    width: 42,
    minHeight: 42,
    paddingVertical: 8,
    borderLeftWidth: 1,
    borderLeftColor: "#1f2937",
    color: "#111827",
    fontSize: 11,
    fontWeight: "900",
    textAlign: "center",
  },
  orderProductHeaderCellWide: {
    width: 260,
    minHeight: 42,
    paddingHorizontal: 5,
    paddingVertical: 8,
    borderLeftWidth: 1,
    borderLeftColor: "#1f2937",
    color: "#111827",
    fontSize: 11,
    fontWeight: "900",
    textAlign: "center",
  },
  orderProductHeaderText: {
    color: "#111827",
    fontSize: 11,
    fontWeight: "900",
    textAlign: "center",
  },
  orderQuantityHeader: {
    width: 150,
    minHeight: 42,
    borderLeftWidth: 1,
    borderLeftColor: "#1f2937",
    justifyContent: "center",
  },
  orderQuantitySubHeader: {
    flexDirection: "row-reverse",
    borderTopWidth: 1,
    borderTopColor: "#1f2937",
    marginTop: 5,
  },
  orderQuantitySubText: {
    flex: 1,
    color: "#111827",
    fontSize: 10,
    fontWeight: "900",
    textAlign: "center",
    paddingVertical: 3,
    borderLeftWidth: 1,
    borderLeftColor: "#1f2937",
  },
  orderProductRow: {
    flexDirection: "row-reverse",
    minHeight: 48,
    borderBottomWidth: 1,
    borderBottomColor: "#1f2937",
    alignItems: "stretch",
    backgroundColor: "#fff",
  },
  orderRowNumber: {
    width: 42,
    paddingTop: 15,
    borderLeftWidth: 1,
    borderLeftColor: "#1f2937",
    color: "#111827",
    fontSize: 11,
    fontWeight: "900",
    textAlign: "center",
  },
  orderCell: {
    minHeight: 48,
    padding: 5,
    borderLeftWidth: 1,
    borderLeftColor: "#1f2937",
    justifyContent: "center",
  },
  orderCellInput: {
    height: 34,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 3,
    paddingHorizontal: 7,
    color: "#111827",
    backgroundColor: "#fff",
    fontSize: 12,
  },
  orderQuantityCell: {
    width: 150,
    flexDirection: "row-reverse",
    borderLeftWidth: 1,
    borderLeftColor: "#1f2937",
    padding: 4,
    gap: 4,
  },
  quantityColumn: { flex: 1, gap: 2 },
  quantityColumnLabel: {
    color: "#475569",
    fontSize: 9,
    fontWeight: "900",
    textAlign: "center",
  },
  orderQuantityInput: {
    flex: 1,
    minWidth: 0,
    height: 34,
    borderWidth: 1,
    borderColor: "#9ca3af",
    paddingHorizontal: 3,
    color: "#111827",
    backgroundColor: "#fff",
    fontSize: 11,
  },
  orderDeleteCell: {
    width: 70,
    alignItems: "center",
    justifyContent: "center",
    borderLeftWidth: 1,
    borderLeftColor: "#1f2937",
  },
  productHeaderRow: {
    flexDirection: "row-reverse",
    backgroundColor: "#0a7ea4",
    borderBottomWidth: 1,
    borderBottomColor: "#075985",
    alignItems: "stretch",
  },
  productHeaderCell: {
    width: 78,
    paddingHorizontal: 5,
    paddingVertical: 8,
    borderLeftWidth: 1,
    borderLeftColor: "#38bdf8",
    color: "#fff",
    fontSize: 11,
    fontWeight: "900",
    textAlign: "center",
  },
  productHeaderCellWide: {
    width: 220,
    paddingHorizontal: 5,
    paddingVertical: 8,
    borderLeftWidth: 1,
    borderLeftColor: "#38bdf8",
    color: "#fff",
    fontSize: 11,
    fontWeight: "900",
    textAlign: "center",
  },
  productRow: {
    flexDirection: "row-reverse",
    minHeight: 58,
    borderBottomWidth: 1,
    borderBottomColor: "#cbd5e1",
    alignItems: "stretch",
    backgroundColor: "#fff",
  },
  rowNumber: {
    width: 42,
    paddingTop: 18,
    borderLeftWidth: 1,
    borderLeftColor: "#cbd5e1",
    color: "#64748b",
    fontWeight: "900",
    textAlign: "center",
  },
  unitCell: {
    width: 78,
    padding: 4,
    borderLeftWidth: 1,
    borderLeftColor: "#cbd5e1",
    justifyContent: "center",
    gap: 3,
  },
  unitButton: {
    borderRadius: 3,
    paddingVertical: 4,
    alignItems: "center",
    backgroundColor: "#f1f5f9",
  },
  unitButtonActive: { backgroundColor: "#0a7ea4" },
  unitButtonText: { color: "#475569", fontSize: 10, fontWeight: "800" },
  unitButtonTextActive: { color: "#fff" },
  typeCell: {
    width: 220,
    padding: 4,
    borderLeftWidth: 1,
    borderLeftColor: "#cbd5e1",
    justifyContent: "center",
    gap: 4,
  },
  compactChips: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 3 },
  compactChip: {
    backgroundColor: "#f1f5f9",
    borderRadius: 3,
    paddingHorizontal: 5,
    paddingVertical: 3,
  },
  compactChipActive: { backgroundColor: "#0f766e" },
  compactChipText: { color: "#475569", fontSize: 9, fontWeight: "700" },
  compactChipTextActive: { color: "#fff" },
  yarnCell: {
    width: 220,
    padding: 4,
    borderLeftWidth: 1,
    borderLeftColor: "#cbd5e1",
    justifyContent: "center",
    gap: 3,
  },
  yarnTotalCompact: { fontSize: 10, fontWeight: "900", textAlign: "center" },
  yarnCompactGrid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 3 },
  yarnCompactInput: {
    width: 32,
    height: 24,
    padding: 1,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 2,
    fontSize: 9,
    color: "#0f172a",
  },
  deleteCell: {
    width: 52,
    alignItems: "center",
    justifyContent: "center",
    borderLeftWidth: 1,
    borderLeftColor: "#cbd5e1",
  },
});
