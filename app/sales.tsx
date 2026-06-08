import React, { useState, useEffect } from "react";
import { useLanguage } from "@/lib/language-context";
import { BackButton } from "@/components/back-button";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  FlatList,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { MaterialIcons } from "@expo/vector-icons";
import { salesService, collectionService } from "@/lib/services/data.service";
import { useAuth } from "@/lib/auth-context";
import { AdminBadgeIcon } from "@/components/admin-badge-icon";
import { AdminCard } from "@/components/admin-card";
import { attachmentService, AttachmentFile } from "@/lib/services/attachment.service";


interface SaleEntry {
  id: string;
  sellerName: string;
  customerName: string;
  customerCategory: string;
  quantityDozen: string;
  quantityPairs: string;
  amount: string;
  invoiceNumber: string;
  invoiceDate: string;
  paymentMethod: string;
  attachments: string[];
  date: string;
}

interface CollectionEntry {
  id: string;
  collectorName: string;
  customerName: string;
  amount: string;
  receiptNumber: string;
  receiptDate: string;
  attachments: string[];
  date: string;
}

export default function SalesScreen() {
  const router = useRouter();
  const colors = useColors();
  const { language, t, isRtl } = useLanguage();
  const isAr = language === "ar";
  const { user } = useAuth();

  const SELLERS = isAr ? ["شلبي", "عمر", "المغربي", "ياسر", "متجر فالكون", "عادل", "تصنيع خاص"] : ["Shalaby", "Omar", "Al-Maghrabi", "Yasser", "Falcon Store", "Adel", "Special Manufacturing"];
  const CUSTOMER_CATEGORIES = isAr ? ["كلاو", "فالكون", "جملة", "تجزئة", "تصنيع خاص شركات", "تصنيع خاص افراد"] : ["Claw", "Falcon", "Wholesale", "Retail", "Special Manufacturing Companies", "Special Manufacturing Individuals"];
  const PAYMENT_METHODS = isAr ? ["نقداً", "آجل"] : ["Cash", "Credit"];

  const [activeTab, setActiveTab] = useState<"sales" | "collection">("sales");

  
  const [salesEntries, setSalesEntries] = useState<SaleEntry[]>([]);
  const [showSalesForm, setShowSalesForm] = useState(false);
  const [editingSale, setEditingSale] = useState<SaleEntry | null>(null);
  const [selectedSeller, setSelectedSeller] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [saleDozen, setSaleDozen] = useState("");
  const [salePairs, setSalePairs] = useState("");
  const [saleAmount, setSaleAmount] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [selectedPayment, setSelectedPayment] = useState("");
  const [saleAttachments, setSaleAttachments] = useState<string[]>([]);

  
  const [collectionEntries, setCollectionEntries] = useState<CollectionEntry[]>([]);
  const [showCollectionForm, setShowCollectionForm] = useState(false);
  const [editingCollection, setEditingCollection] = useState<CollectionEntry | null>(null);
  const [selectedCollector, setSelectedCollector] = useState("");
  const [collectionCustomer, setCollectionCustomer] = useState("");
  const [collectionAmount, setCollectionAmount] = useState("");
  const [receiptNumber, setReceiptNumber] = useState("");
  const [receiptDate, setReceiptDate] = useState("");
  const [collectionAttachments, setCollectionAttachments] = useState<string[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const salesData = await salesService.getAll();
      if (salesData) {
        setSalesEntries(salesData.map((s: any) => ({
          id: String(s.id),
          sellerName: s.sellerName || "",
          customerName: s.customerName || "",
          customerCategory: s.customerCategory || "",
          quantityDozen: String(s.quantityDozen || 0),
          quantityPairs: String(s.quantityPair || 0),
          amount: String(s.amount || 0),
          invoiceNumber: s.invoiceNumber || "",
          invoiceDate: s.invoiceDate || "",
          paymentMethod: s.paymentMethod === "cash" ? (language === "ar" ? "نقداً" : "Cash") : (language === "ar" ? "آجل" : "Credit"),
          attachments: [],
          date: s.createdAt ? new Date(s.createdAt).toLocaleDateString("ar-SA") : "",
        })));
      }
      const collData = await collectionService.getAll();
      if (collData) {
        setCollectionEntries(collData.map((c: any) => ({
          id: String(c.id),
          collectorName: c.collectorName || "",
          customerName: c.customerName || "",
          amount: String(c.amount || 0),
          receiptNumber: c.receiptNumber || "",
          receiptDate: c.receiptDate || "",
          attachments: [],
          date: c.createdAt ? new Date(c.createdAt).toLocaleDateString("ar-SA") : "",
        })));
      }
    } catch (e) {
      console.log("Error loading data:", e);
    }
  };

  // === المرفقات (مفعّلة) ===
  const pickDocument = async (setSetter: (items: string[]) => void, attachments: string[]) => {
    const file = await attachmentService.pickPDF();
    if (file) {
      const uploaded = await attachmentService.uploadAttachment(file);
      if (uploaded) {
        setSetter([...attachments, `[PDF] ${file.name} - ${uploaded}`]);
      }
    }
  };

  const pickImage = async (setSetter: (items: string[]) => void, attachments: string[]) => {
    const file = await attachmentService.pickImage();
    if (file) {
      const uploaded = await attachmentService.uploadAttachment(file);
      if (uploaded) {
        setSetter([...attachments, isAr ? `[صورة] ${file.name} - ${uploaded}` : `[Image] ${file.name} - ${uploaded}`]);
      }
    }
  };

  const takePhoto = async (setSetter: (items: string[]) => void, attachments: string[]) => {
    const file = await attachmentService.takePhoto();
    if (file) {
      const uploaded = await attachmentService.uploadAttachment(file);
      if (uploaded) {
        setSetter([...attachments, isAr ? `[صورة] ${file.name} - ${uploaded}` : `[Image] ${file.name} - ${uploaded}`]);
      }
    }
  };

  // === المبيعات ===
  const resetSalesForm = () => {
    setSelectedSeller("");
    setCustomerName("");
    setSelectedCategory("");
    setSaleDozen("");
    setSalePairs("");
    setSaleAmount("");
    setInvoiceNumber("");
    setInvoiceDate("");
    setSelectedPayment("");
    setSaleAttachments([]);
    setEditingSale(null);
  };

  const handleSaveSale = async () => {
    if (!selectedSeller) {
      Alert.alert(t('alert'), isAr ? 'يرجى اختيار اسم البائع' : 'Please select a seller name');
      return;
    }
    if (!selectedCategory) {
      Alert.alert(t('alert'), isAr ? 'يرجى اختيار فئة العميل' : 'Please select a customer category');
      return;
    }
    if (!saleDozen && !salePairs) {
      Alert.alert(t('alert'), isAr ? 'يرجى إدخال الكمية المباعة' : 'Please enter the sold quantity');
      return;
    }
    if (!selectedPayment) {
      Alert.alert(t('alert'), isAr ? 'يرجى اختيار طريقة الدفع' : 'Please select a payment method');
      return;
    }

    const entry: SaleEntry = {
      id: editingSale?.id || Date.now().toString(),
      sellerName: selectedSeller,
      customerName: customerName || "-",
      customerCategory: selectedCategory,
      quantityDozen: saleDozen || "0",
      quantityPairs: salePairs || "0",
      amount: saleAmount || "0",
      invoiceNumber: invoiceNumber || "",
      invoiceDate: invoiceDate || "",
      paymentMethod: selectedPayment,
      attachments: saleAttachments,
      date: new Date().toLocaleDateString("ar-SA"),
    };

    try {
      const paymentMap: Record<string, "cash" | "deferred"> = { "نقداً": "cash", "Cash": "cash", "آجل": "deferred", "Credit": "deferred" };
      const saleData = {
        sellerName: entry.sellerName,
        customerName: entry.customerName,
        customerCategory: entry.customerCategory,
        quantityDozen: parseInt(entry.quantityDozen) || 0,
        quantityPair: parseInt(entry.quantityPairs) || 0,
        amount: entry.amount,
        invoiceNumber: entry.invoiceNumber,
        invoiceDate: entry.invoiceDate,
        paymentMethod: paymentMap[entry.paymentMethod] || "cash",
        userId: user?.id || 1,
      };
      if (editingSale) {
        await salesService.update(parseInt(editingSale.id), saleData);
      } else {
        await salesService.create(saleData);
      }
      await loadData();
      resetSalesForm();
      setShowSalesForm(false);
      Alert.alert(t('success'), editingSale ? (isAr ? 'تم تعديل المبيعة' : 'Sale updated') : (isAr ? 'تم حفظ المبيعة' : 'Sale saved'));
    } catch (e) {
      Alert.alert(t('error'), t('operation_failed'));
    }
  };

  const handleEditSale = (entry: SaleEntry) => {
    setSelectedSeller(entry.sellerName);
    setCustomerName(entry.customerName);
    setSelectedCategory(entry.customerCategory);
    setSaleDozen(entry.quantityDozen);
    setSalePairs(entry.quantityPairs);
    setSaleAmount(entry.amount);
    setInvoiceNumber(entry.invoiceNumber);
    setInvoiceDate(entry.invoiceDate);
    setSelectedPayment(entry.paymentMethod);
    setSaleAttachments(entry.attachments);
    setEditingSale(entry);
    setShowSalesForm(true);
  };

  const handleDeleteSale = (entry: SaleEntry) => {
    Alert.alert(t('confirm_delete'), isAr ? `هل تريد حذف مبيعة ${entry.sellerName}؟` : `Do you want to delete sale ${entry.sellerName}?`, [
      { text: t('cancel'), style: "cancel" },
      {
        text: t('delete'),
        style: "destructive",
        onPress: async () => {
          try {
            await salesService.delete(parseInt(entry.id));
            await loadData();
            Alert.alert(t('done'), t('deleted_success'));
          } catch (e) { console.log(e); }
        },
      },
    ]);
  };

  // === التحصيل ===
  const resetCollectionForm = () => {
    setSelectedCollector("");
    setCollectionCustomer("");
    setCollectionAmount("");
    setReceiptNumber("");
    setReceiptDate("");
    setCollectionAttachments([]);
    setEditingCollection(null);
  };

  const handleSaveCollection = async () => {
    if (!selectedCollector) {
      Alert.alert(t('alert'), isAr ? 'يرجى اختيار اسم المحصل' : 'Please select a collector name');
      return;
    }
    if (!collectionCustomer) {
      Alert.alert(t('alert'), isAr ? 'يرجى إدخال اسم العميل' : 'Please enter the customer name');
      return;
    }
    if (!collectionAmount) {
      Alert.alert(t('alert'), isAr ? 'يرجى إدخال المبلغ' : 'Please enter the amount');
      return;
    }

    const entry: CollectionEntry = {
      id: editingCollection?.id || Date.now().toString(),
      collectorName: selectedCollector,
      customerName: collectionCustomer,
      amount: collectionAmount,
      receiptNumber: receiptNumber || "",
      receiptDate: receiptDate || "",
      attachments: collectionAttachments,
      date: new Date().toLocaleDateString("ar-SA"),
    };

    try {
      const collData = {
        collectorName: entry.collectorName,
        customerName: entry.customerName,
        amount: parseInt(entry.amount) || 0,
        receiptNumber: entry.receiptNumber,
        receiptDate: entry.receiptDate,
        userId: user?.id || 1,
      };
      if (editingCollection) {
        await collectionService.update(parseInt(editingCollection.id), collData);
      } else {
        await collectionService.create(collData);
      }
      await loadData();
      resetCollectionForm();
      setShowCollectionForm(false);
      Alert.alert(t('success'), editingCollection ? (isAr ? 'تم تعديل التحصيل' : 'Collection updated') : (isAr ? 'تم حفظ التحصيل' : 'Collection saved'));
    } catch (e) {
      Alert.alert(t('error'), t('operation_failed'));
    }
  };

  const handleEditCollection = (entry: CollectionEntry) => {
    setSelectedCollector(entry.collectorName);
    setCollectionCustomer(entry.customerName);
    setCollectionAmount(entry.amount);
    setReceiptNumber(entry.receiptNumber);
    setReceiptDate(entry.receiptDate);
    setCollectionAttachments(entry.attachments);
    setEditingCollection(entry);
    setShowCollectionForm(true);
  };

  const handleDeleteCollection = (entry: CollectionEntry) => {
    Alert.alert(t('confirm_delete'), isAr ? `هل تريد حذف تحصيل ${entry.customerName}؟` : `Do you want to delete collection ${entry.customerName}?`, [
      { text: t('cancel'), style: "cancel" },
      {
        text: t('delete'),
        style: "destructive",
        onPress: async () => {
          try {
            await collectionService.delete(parseInt(entry.id));
            await loadData();
            Alert.alert(t('done'), t('deleted_success'));
          } catch (e) { console.log(e); }
        },
      },
    ]);
  };

  
  const renderSaleItem = ({ item }: { item: SaleEntry }) => (
    <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.border }}>
      <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row', gap: 8 }}>
          <TouchableOpacity
            onPress={() => handleEditSale(item)}
            style={{ backgroundColor: "#0a7ea415", borderRadius: 20, padding: 8 }}
          >
            <MaterialIcons name="edit" size={18} color="#0a7ea4" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleDeleteSale(item)}
            style={{ backgroundColor: "#ef444415", borderRadius: 20, padding: 8 }}
          >
            <MaterialIcons name="delete" size={18} color="#ef4444" />
          </TouchableOpacity>
        </View>
        <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ color: colors.foreground, fontWeight: 'bold', fontSize: 16 }}>{item.sellerName}</Text>
          <View style={{ backgroundColor: "#0a7ea420", borderRadius: 16, padding: 6 }}>
            <MaterialIcons name="point-of-sale" size={18} color="#0a7ea4" />
          </View>
        </View>
      </View>

      <View style={{ backgroundColor: colors.background, borderRadius: 8, padding: 12 }}>
        <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <Text style={{ color: colors.foreground, fontSize: 14 }}>{item.customerCategory}</Text>
          <Text style={{ color: colors.muted, fontSize: 14, fontWeight: '600' }}>{t('customer_category')}</Text>
        </View>
        {item.customerName && item.customerName !== "-" ? (
          <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text style={{ color: colors.foreground, fontSize: 14 }}>{item.customerName}</Text>
            <Text style={{ color: colors.muted, fontSize: 14, fontWeight: '600' }}>{t('customer_name')}</Text>
          </View>
        ) : null}
        <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ color: colors.foreground, fontWeight: 'bold' }}>{item.quantityDozen}</Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>{t('dozen')}</Text>
            <Text style={{ color: colors.muted, marginHorizontal: 4 }}>|</Text>
            <Text style={{ color: colors.foreground, fontWeight: 'bold' }}>{item.quantityPairs}</Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>{t('pairs')}</Text>
          </View>
          <Text style={{ color: colors.muted, fontSize: 14, fontWeight: '600' }}>{t('quantity')}</Text>
        </View>
        {item.amount && item.amount !== "0" ? (
          <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text style={{ color: colors.foreground, fontWeight: 'bold' }}>{item.amount} {t('riyal')}</Text>
            <Text style={{ color: colors.muted, fontSize: 14, fontWeight: '600' }}>{t('amount')}</Text>
          </View>
        ) : null}
        {item.invoiceNumber ? (
          <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text style={{ color: colors.foreground, fontSize: 14 }}>{item.invoiceNumber}</Text>
            <Text style={{ color: colors.muted, fontSize: 14, fontWeight: '600' }}>{t('invoice_number')}</Text>
          </View>
        ) : null}
        {item.invoiceDate ? (
          <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text style={{ color: colors.foreground, fontSize: 14 }}>{item.invoiceDate}</Text>
            <Text style={{ color: colors.muted, fontSize: 14, fontWeight: '600' }}>{t('date')}</Text>
          </View>
        ) : null}
        <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View
            style={{
              backgroundColor: item.paymentMethod === (t('cash')) ? "#22c55e20" : "#f59e0b20",
              borderRadius: 12,
              paddingHorizontal: 10,
              paddingVertical: 4,
            }}
          >
            <Text
              style={{
                color: item.paymentMethod === (t('cash')) ? "#22c55e" : "#f59e0b",
                fontWeight: "600",
                fontSize: 12,
              }}
            >
              {item.paymentMethod}
            </Text>
          </View>
          <Text style={{ color: colors.muted, fontSize: 14, fontWeight: '600' }}>{t('payment_method')}</Text>
        </View>
        {item.attachments && item.attachments.length > 0 && (
          <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
            <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <MaterialIcons name="attach-file" size={14} color={colors.muted} />
              <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "600" }}>{isAr ? 'المرفقات' : 'Attachments'} ({item.attachments.length})</Text>
            </View>
            {item.attachments.map((att, idx) => (
              <Text key={idx} style={{ color: colors.primary, fontSize: 11, marginLeft: 20, marginBottom: 4 }}>• {att}</Text>
            ))}
          </View>
        )}
      </View>
    </View>
  );

  
  const renderSalesForm = () => (
    <ScrollView style={{ flex: 1, paddingHorizontal: 16, paddingVertical: 16 }}>
      <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 20, borderWidth: 1, borderColor: colors.border }}>
        <Text style={{ color: colors.foreground, fontWeight: 'bold', fontSize: 18, marginBottom: 20, textAlign: isRtl ? 'right' : 'left' }}>
          {editingSale ? (isAr ? '✏️ تعديل مبيعة' : '✏️ Edit Sale') : (isAr ? '➕ إضافة مبيعة جديدة' : '➕ Add New Sale')}
        </Text>

        
        <View style={{ marginBottom: 20 }}>
          <Text style={{ color: colors.foreground, fontWeight: '600', fontSize: 14, marginBottom: 12, textAlign: isRtl ? 'right' : 'left' }}>{t('seller_name')}</Text>
          <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end' }}>
            {SELLERS.map((name) => (
              <TouchableOpacity
                key={name}
                onPress={() => setSelectedSeller(name)}
                style={{
                  backgroundColor: selectedSeller === name ? "#0a7ea4" : "transparent",
                  borderColor: "#0a7ea4",
                  borderWidth: 1.5,
                  borderRadius: 22,
                  paddingHorizontal: 16,
                  paddingVertical: 9,
                }}
              >
                <Text
                  style={{
                    color: selectedSeller === name ? "white" : "#0a7ea4",
                    fontWeight: "700",
                    fontSize: 13,
                  }}
                >
                  {name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        
        <View style={{ marginBottom: 16 }}>
          <Text style={{ color: colors.foreground, fontWeight: '600', fontSize: 14, marginBottom: 8, textAlign: isRtl ? 'right' : 'left' }}>
            {isAr ? 'اسم العميل (اختياري)' : 'Customer Name (Optional)'}
          </Text>
          <TextInput
            style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12, color: colors.foreground, textAlign: isRtl ? 'right' : 'left', fontSize: 16 }}
            placeholder={isAr ? 'أدخل اسم العميل' : 'Enter customer name'}
            placeholderTextColor={colors.muted}
            value={customerName}
            onChangeText={setCustomerName}
            returnKeyType="next"
          />
        </View>

        
        <View style={{ marginBottom: 20 }}>
          <Text style={{ color: colors.foreground, fontWeight: '600', fontSize: 14, marginBottom: 12, textAlign: isRtl ? 'right' : 'left' }}>{t('customer_category')}</Text>
          <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end' }}>
            {CUSTOMER_CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                onPress={() => setSelectedCategory(cat)}
                style={{
                  backgroundColor: selectedCategory === cat ? "#059669" : "transparent",
                  borderColor: "#059669",
                  borderWidth: 1.5,
                  borderRadius: 22,
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                }}
              >
                <Text
                  style={{
                    color: selectedCategory === cat ? "white" : "#059669",
                    fontWeight: "700",
                    fontSize: 12,
                  }}
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        
        <View style={{ marginBottom: 16 }}>
          <Text style={{ color: colors.foreground, fontWeight: '600', fontSize: 14, marginBottom: 8, textAlign: isRtl ? 'right' : 'left' }}>
            {isAr ? 'الكمية المباعة (درزن)' : 'Sold Quantity (Dozen)'}
          </Text>
          <TextInput
            style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12, color: colors.foreground, textAlign: isRtl ? 'right' : 'left', fontSize: 16 }}
            placeholder="0"
            placeholderTextColor={colors.muted}
            value={saleDozen}
            onChangeText={setSaleDozen}
            keyboardType="numeric"
            returnKeyType="next"
          />
        </View>

        
        <View style={{ marginBottom: 16 }}>
          <Text style={{ color: colors.foreground, fontWeight: '600', fontSize: 14, marginBottom: 8, textAlign: isRtl ? 'right' : 'left' }}>
            {isAr ? 'الكمية المباعة (زوج)' : 'Sold Quantity (Pairs)'}
          </Text>
          <TextInput
            style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12, color: colors.foreground, textAlign: isRtl ? 'right' : 'left', fontSize: 16 }}
            placeholder="0"
            placeholderTextColor={colors.muted}
            value={salePairs}
            onChangeText={setSalePairs}
            keyboardType="numeric"
            returnKeyType="next"
          />
        </View>

        
        <View style={{ marginBottom: 16 }}>
          <Text style={{ color: colors.foreground, fontWeight: '600', fontSize: 14, marginBottom: 8, textAlign: isRtl ? 'right' : 'left' }}>
            {isAr ? 'المبلغ (ريال)' : 'Amount (SAR)'}
          </Text>
          <TextInput
            style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12, color: colors.foreground, textAlign: isRtl ? 'right' : 'left', fontSize: 16 }}
            placeholder="0"
            placeholderTextColor={colors.muted}
            value={saleAmount}
            onChangeText={setSaleAmount}
            keyboardType="numeric"
            returnKeyType="next"
          />
        </View>

        
        <View style={{ marginBottom: 16 }}>
          <Text style={{ color: colors.foreground, fontWeight: '600', fontSize: 14, marginBottom: 8, textAlign: isRtl ? 'right' : 'left' }}>
            {isAr ? 'رقم الفاتورة (اختياري)' : 'Invoice Number (Optional)'}
          </Text>
          <TextInput
            style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12, color: colors.foreground, textAlign: isRtl ? 'right' : 'left', fontSize: 16 }}
            placeholder={isAr ? 'أدخل رقم الفاتورة' : 'Enter invoice number'}
            placeholderTextColor={colors.muted}
            value={invoiceNumber}
            onChangeText={setInvoiceNumber}
            returnKeyType="next"
          />
        </View>

        
        <View style={{ marginBottom: 16 }}>
          <Text style={{ color: colors.foreground, fontWeight: '600', fontSize: 14, marginBottom: 8, textAlign: isRtl ? 'right' : 'left' }}>
            {isAr ? 'تاريخ الفاتورة (اختياري)' : 'Invoice Date (Optional)'}
          </Text>
          <TextInput
            style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12, color: colors.foreground, textAlign: isRtl ? 'right' : 'left', fontSize: 16 }}
            placeholder={isAr ? 'مثال: 2024-01-15' : 'Example: 2024-01-15'}
            placeholderTextColor={colors.muted}
            value={invoiceDate}
            onChangeText={setInvoiceDate}
            returnKeyType="next"
          />
        </View>

        
        <View style={{ marginBottom: 20 }}>
          <Text style={{ color: colors.foreground, fontWeight: '600', fontSize: 14, marginBottom: 12, textAlign: isRtl ? 'right' : 'left' }}>{t('payment_method')}</Text>
          <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row', gap: 12, justifyContent: 'flex-end' }}>
            {PAYMENT_METHODS.map((method) => (
              <TouchableOpacity
                key={method}
                onPress={() => setSelectedPayment(method)}
                style={{
                  backgroundColor: selectedPayment === method ? "#059669" : "transparent",
                  borderColor: "#059669",
                  borderWidth: 1.5,
                  borderRadius: 22,
                  paddingHorizontal: 24,
                  paddingVertical: 10,
                }}
              >
                <Text
                  style={{
                    color: selectedPayment === method ? "white" : "#059669",
                    fontWeight: "700",
                    fontSize: 14,
                  }}
                >
                  {method}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        
        <View style={{ marginBottom: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <Text style={{ color: colors.foreground, fontWeight: '600', fontSize: 14, marginBottom: 12, textAlign: isRtl ? 'right' : 'left' }}>{isAr ? 'المرفقات' : 'Attachments'}</Text>
          <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row', gap: 8, justifyContent: 'flex-end', marginBottom: 12 }}>
            <TouchableOpacity
              onPress={() => pickDocument(setSaleAttachments, saleAttachments)}
              style={{ backgroundColor: "#0a7ea420", borderRadius: 12, padding: 12, flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 6 }}
            >
              <MaterialIcons name="attach-file" size={20} color="#0a7ea4" />
              <Text style={{ color: "#0a7ea4", fontWeight: '600' }}>{isAr ? 'ملف' : 'File'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => pickImage(setSaleAttachments, saleAttachments)}
              style={{ backgroundColor: "#7c3aed20", borderRadius: 12, padding: 12, flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 6 }}
            >
              <MaterialIcons name="image" size={20} color="#7c3aed" />
              <Text style={{ color: "#7c3aed", fontWeight: '600' }}>{isAr ? 'صورة' : 'Image'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => takePhoto(setSaleAttachments, saleAttachments)}
              style={{ backgroundColor: "#f59e0b20", borderRadius: 12, padding: 12, flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 6 }}
            >
              <MaterialIcons name="camera-alt" size={20} color="#f59e0b" />
              <Text style={{ color: "#f59e0b", fontWeight: '600' }}>{isAr ? 'كاميرا' : 'Camera'}</Text>
            </TouchableOpacity>
          </View>
          {saleAttachments.length > 0 && (
            <View>
              {saleAttachments.map((att, idx) => (
                <View key={idx} style={{ flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: idx < saleAttachments.length - 1 ? 1 : 0, borderBottomColor: colors.border }}>
                  <TouchableOpacity onPress={() => setSaleAttachments(saleAttachments.filter((_, i) => i !== idx))}>
                    <MaterialIcons name="close" size={18} color="#ef4444" />
                  </TouchableOpacity>
                  <Text style={{ color: colors.foreground, fontSize: 13 }}>{att}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        
        <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row', gap: 12, marginTop: 8 }}>
          <TouchableOpacity
            onPress={() => {
              setShowSalesForm(false);
              resetSalesForm();
            }}
            style={{
              flex: 1,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 12,
              paddingVertical: 14,
              flexDirection: "row",
              justifyContent: "center",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Text style={{ color: colors.foreground, fontWeight: '600', fontSize: 16 }}>{t('cancel')}</Text>
            <MaterialIcons name="close" size={20} color={colors.foreground} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleSaveSale}
            style={{
              flex: 1,
              backgroundColor: "#0a7ea4",
              borderRadius: 12,
              paddingVertical: 14,
              flexDirection: "row",
              justifyContent: "center",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Text style={{ color: '#ffffff', fontWeight: '600', fontSize: 16 }}>
              {editingSale ? (t('edit')) : (t('save'))}
            </Text>
            <MaterialIcons name={editingSale ? "edit" : "save"} size={20} color="white" />
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );

  
  const renderCollectionItem = ({ item }: { item: CollectionEntry }) => (
    <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.border }}>
      <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row', gap: 8 }}>
          <TouchableOpacity
            onPress={() => handleEditCollection(item)}
            style={{ backgroundColor: "#7c3aed15", borderRadius: 20, padding: 8 }}
          >
            <MaterialIcons name="edit" size={18} color="#7c3aed" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleDeleteCollection(item)}
            style={{ backgroundColor: "#ef444415", borderRadius: 20, padding: 8 }}
          >
            <MaterialIcons name="delete" size={18} color="#ef4444" />
          </TouchableOpacity>
        </View>
        <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ color: colors.foreground, fontWeight: 'bold', fontSize: 16 }}>{item.collectorName}</Text>
          <View style={{ backgroundColor: "#7c3aed20", borderRadius: 16, padding: 6 }}>
            <MaterialIcons name="account-balance-wallet" size={18} color="#7c3aed" />
          </View>
        </View>
      </View>

      <View style={{ backgroundColor: colors.background, borderRadius: 8, padding: 12 }}>
        <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <Text style={{ color: colors.foreground, fontSize: 14 }}>{item.customerName}</Text>
          <Text style={{ color: colors.muted, fontSize: 14, fontWeight: '600' }}>{t('customer_name')}</Text>
        </View>
        <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <Text style={{ color: colors.foreground, fontWeight: 'bold', fontSize: 16 }}>{item.amount} {t('riyal')}</Text>
          <Text style={{ color: colors.muted, fontSize: 14, fontWeight: '600' }}>{t('amount')}</Text>
        </View>
        {item.receiptNumber ? (
          <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text style={{ color: colors.foreground, fontSize: 14 }}>{item.receiptNumber}</Text>
            <Text style={{ color: colors.muted, fontSize: 14, fontWeight: '600' }}>{isAr ? 'رقم السند' : 'Receipt #'}</Text>
          </View>
        ) : null}
        {item.receiptDate ? (
          <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: colors.foreground, fontSize: 14 }}>{item.receiptDate}</Text>
            <Text style={{ color: colors.muted, fontSize: 14, fontWeight: '600' }}>{isAr ? 'تاريخ السند' : 'Receipt Date'}</Text>
          </View>
        ) : null}
        {item.attachments && item.attachments.length > 0 && (
          <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
            <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <MaterialIcons name="attach-file" size={14} color={colors.muted} />
              <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "600" }}>{isAr ? 'المرفقات' : 'Attachments'} ({item.attachments.length})</Text>
            </View>
            {item.attachments.map((att, idx) => (
              <Text key={idx} style={{ color: colors.primary, fontSize: 11, marginLeft: 20, marginBottom: 4 }}>• {att}</Text>
            ))}
          </View>
        )}
      </View>
    </View>
  );

  
  const renderCollectionForm = () => (
    <ScrollView style={{ flex: 1, paddingHorizontal: 16, paddingVertical: 16 }}>
      <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 20, borderWidth: 1, borderColor: colors.border }}>
        <Text style={{ color: colors.foreground, fontWeight: 'bold', fontSize: 18, marginBottom: 20, textAlign: isRtl ? 'right' : 'left' }}>
          {editingCollection ? (isAr ? '✏️ تعديل تحصيل' : '✏️ Edit Collection') : (isAr ? '➕ إضافة تحصيل جديد' : '➕ Add New Collection')}
        </Text>

        
        <View style={{ marginBottom: 20 }}>
          <Text style={{ color: colors.foreground, fontWeight: '600', fontSize: 14, marginBottom: 12, textAlign: isRtl ? 'right' : 'left' }}>{t('collector_name')}</Text>
          <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end' }}>
            {SELLERS.map((name) => (
              <TouchableOpacity
                key={name}
                onPress={() => setSelectedCollector(name)}
                style={{
                  backgroundColor: selectedCollector === name ? "#7c3aed" : "transparent",
                  borderColor: "#7c3aed",
                  borderWidth: 1.5,
                  borderRadius: 22,
                  paddingHorizontal: 16,
                  paddingVertical: 9,
                }}
              >
                <Text
                  style={{
                    color: selectedCollector === name ? "white" : "#7c3aed",
                    fontWeight: "700",
                    fontSize: 13,
                  }}
                >
                  {name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        
        <View style={{ marginBottom: 16 }}>
          <Text style={{ color: colors.foreground, fontWeight: '600', fontSize: 14, marginBottom: 8, textAlign: isRtl ? 'right' : 'left' }}>
            {isAr ? 'اسم العميل المحصل منه' : 'Collected From Customer'}
          </Text>
          <TextInput
            style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12, color: colors.foreground, textAlign: isRtl ? 'right' : 'left', fontSize: 16 }}
            placeholder={isAr ? 'أدخل اسم العميل' : 'Enter customer name'}
            placeholderTextColor={colors.muted}
            value={collectionCustomer}
            onChangeText={setCollectionCustomer}
            returnKeyType="next"
          />
        </View>

        
        <View style={{ marginBottom: 16 }}>
          <Text style={{ color: colors.foreground, fontWeight: '600', fontSize: 14, marginBottom: 8, textAlign: isRtl ? 'right' : 'left' }}>
            {isAr ? 'المبلغ (ريال)' : 'Amount (SAR)'}
          </Text>
          <TextInput
            style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12, color: colors.foreground, textAlign: isRtl ? 'right' : 'left', fontSize: 16 }}
            placeholder="0"
            placeholderTextColor={colors.muted}
            value={collectionAmount}
            onChangeText={setCollectionAmount}
            keyboardType="numeric"
            returnKeyType="next"
          />
        </View>

        
        <View style={{ marginBottom: 16 }}>
          <Text style={{ color: colors.foreground, fontWeight: '600', fontSize: 14, marginBottom: 8, textAlign: isRtl ? 'right' : 'left' }}>
            {isAr ? 'رقم السند (اختياري)' : 'Receipt Number (Optional)'}
          </Text>
          <TextInput
            style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12, color: colors.foreground, textAlign: isRtl ? 'right' : 'left', fontSize: 16 }}
            placeholder={isAr ? 'أدخل رقم السند' : 'Enter receipt number'}
            placeholderTextColor={colors.muted}
            value={receiptNumber}
            onChangeText={setReceiptNumber}
            returnKeyType="next"
          />
        </View>

        
        <View style={{ marginBottom: 16 }}>
          <Text style={{ color: colors.foreground, fontWeight: '600', fontSize: 14, marginBottom: 8, textAlign: isRtl ? 'right' : 'left' }}>
            {isAr ? 'تاريخ السند (اختياري)' : 'Receipt Date (Optional)'}
          </Text>
          <TextInput
            style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12, color: colors.foreground, textAlign: isRtl ? 'right' : 'left', fontSize: 16 }}
            placeholder={isAr ? 'مثال: 2024-01-15' : 'Example: 2024-01-15'}
            placeholderTextColor={colors.muted}
            value={receiptDate}
            onChangeText={setReceiptDate}
            returnKeyType="next"
          />
        </View>

        
        <View style={{ marginBottom: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <Text style={{ color: colors.foreground, fontWeight: '600', fontSize: 14, marginBottom: 12, textAlign: isRtl ? 'right' : 'left' }}>{isAr ? 'المرفقات' : 'Attachments'}</Text>
          <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row', gap: 8, justifyContent: 'flex-end', marginBottom: 12 }}>
            <TouchableOpacity
              onPress={() => pickDocument(setCollectionAttachments, collectionAttachments)}
              style={{ backgroundColor: "#0a7ea420", borderRadius: 12, padding: 12, flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 6 }}
            >
              <MaterialIcons name="attach-file" size={20} color="#0a7ea4" />
              <Text style={{ color: "#0a7ea4", fontWeight: '600' }}>{isAr ? 'ملف' : 'File'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => pickImage(setCollectionAttachments, collectionAttachments)}
              style={{ backgroundColor: "#7c3aed20", borderRadius: 12, padding: 12, flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 6 }}
            >
              <MaterialIcons name="image" size={20} color="#7c3aed" />
              <Text style={{ color: "#7c3aed", fontWeight: '600' }}>{isAr ? 'صورة' : 'Image'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => takePhoto(setCollectionAttachments, collectionAttachments)}
              style={{ backgroundColor: "#f59e0b20", borderRadius: 12, padding: 12, flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 6 }}
            >
              <MaterialIcons name="camera-alt" size={20} color="#f59e0b" />
              <Text style={{ color: "#f59e0b", fontWeight: '600' }}>{isAr ? 'كاميرا' : 'Camera'}</Text>
            </TouchableOpacity>
          </View>
          {collectionAttachments.length > 0 && (
            <View>
              {collectionAttachments.map((att, idx) => (
                <View key={idx} style={{ flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: idx < collectionAttachments.length - 1 ? 1 : 0, borderBottomColor: colors.border }}>
                  <TouchableOpacity onPress={() => setCollectionAttachments(collectionAttachments.filter((_, i) => i !== idx))}>
                    <MaterialIcons name="close" size={18} color="#ef4444" />
                  </TouchableOpacity>
                  <Text style={{ color: colors.foreground, fontSize: 13 }}>{att}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        
        <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row', gap: 12, marginTop: 8 }}>
          <TouchableOpacity
            onPress={() => {
              setShowCollectionForm(false);
              resetCollectionForm();
            }}
            style={{
              flex: 1,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 12,
              paddingVertical: 14,
              flexDirection: "row",
              justifyContent: "center",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Text style={{ color: colors.foreground, fontWeight: '600', fontSize: 16 }}>{t('cancel')}</Text>
            <MaterialIcons name="close" size={20} color={colors.foreground} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleSaveCollection}
            style={{
              flex: 1,
              backgroundColor: "#7c3aed",
              borderRadius: 12,
              paddingVertical: 14,
              flexDirection: "row",
              justifyContent: "center",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Text style={{ color: '#ffffff', fontWeight: '600', fontSize: 16 }}>
              {editingCollection ? (t('edit')) : (t('save'))}
            </Text>
            <MaterialIcons name={editingCollection ? "edit" : "save"} size={20} color="white" />
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );

  return (
    <ScreenContainer style={{ backgroundColor: colors.background }}>
      
      <View
        style={{ backgroundColor: "#0a7ea4", paddingHorizontal: 24, paddingVertical: 20, flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between' }}
      >
        
        <TouchableOpacity
          onPress={() => {
            if (activeTab === "sales") {
              resetSalesForm();
              setShowSalesForm(true);
            } else {
              resetCollectionForm();
              setShowCollectionForm(true);
            }
          }}
          style={{ backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 20, padding: 8 }}
        >
          <MaterialIcons name="add" size={24} color="white" />
        </TouchableOpacity>

        
        <AdminBadgeIcon />
        
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={{ color: '#ffffff', fontWeight: 'bold', fontSize: 20 }}>{isAr ? 'المبيعات والتحصيل' : 'Sales and Collection'}</Text>
          <Text style={{ fontSize: 14, marginTop: 4 }}>
            {activeTab === "sales"
              ? (isAr ? `${salesEntries.length} مبيعة` : `${salesEntries.length} Sales`)
              : (isAr ? `${collectionEntries.length} تحصيل` : `${collectionEntries.length} Collections`)}
          </Text>
        </View>

        
        <BackButton />
      </View>

      
      <AdminCard />

      
      <View style={{ flexDirection: isRtl ? 'row-reverse' : 'row', borderBottomWidth: 1, borderColor: colors.border }}>
        <TouchableOpacity
          onPress={() => setActiveTab("sales")}
          style={{
            flex: 1,
            paddingVertical: 14,
            alignItems: "center",
            borderBottomWidth: 3,
            borderBottomColor: activeTab === "sales" ? "#0a7ea4" : "transparent",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text
              style={{
                color: activeTab === "sales" ? "#0a7ea4" : colors.muted,
                fontWeight: "700",
                fontSize: 15,
              }}
            >
              {t('sales')}
            </Text>
            <MaterialIcons
              name="point-of-sale"
              size={20}
              color={activeTab === "sales" ? "#0a7ea4" : colors.muted}
            />
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab("collection")}
          style={{
            flex: 1,
            paddingVertical: 14,
            alignItems: "center",
            borderBottomWidth: 3,
            borderBottomColor: activeTab === "collection" ? "#7c3aed" : "transparent",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text
              style={{
                color: activeTab === "collection" ? "#7c3aed" : colors.muted,
                fontWeight: "700",
                fontSize: 15,
              }}
            >
              {t('collection')}
            </Text>
            <MaterialIcons
              name="account-balance-wallet"
              size={20}
              color={activeTab === "collection" ? "#7c3aed" : colors.muted}
            />
          </View>
        </TouchableOpacity>
      </View>

      
      {activeTab === "sales" ? (
        showSalesForm ? (
          renderSalesForm()
        ) : (
          <FlatList
            data={salesEntries}
            keyExtractor={(item) => item.id}
            renderItem={renderSaleItem}
            contentContainerStyle={{ padding: 16, flexGrow: 1 }}
            ListEmptyComponent={
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80 }}>
                <View style={{ backgroundColor: "#0a7ea415", borderRadius: 40, padding: 20 }}>
                  <MaterialIcons name="point-of-sale" size={48} color="#0a7ea4" />
                </View>
                <Text style={{ color: colors.foreground, fontSize: 18, marginTop: 20, fontWeight: 'bold' }}>{t('sales')}</Text>
                <Text style={{ color: colors.muted, fontSize: 14, marginTop: 8, textAlign: 'center', paddingHorizontal: 32 }}>
                  {t('no_sales')}{"\n"}{isAr ? 'اضغط على زر (+) لإضافة مبيعة جديدة.' : 'Press (+) to add a new sale.'}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    resetSalesForm();
                    setShowSalesForm(true);
                  }}
                  style={{ backgroundColor: "#0a7ea4", marginTop: 24, paddingHorizontal: 32, paddingVertical: 12, borderRadius: 12 }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text style={{ color: '#ffffff', fontWeight: '600' }}>{t('add_sale')}</Text>
                    <MaterialIcons name="add" size={20} color="white" />
                  </View>
                </TouchableOpacity>
              </View>
            }
          />
        )
      ) : showCollectionForm ? (
        renderCollectionForm()
      ) : (
        <FlatList
          data={collectionEntries}
          keyExtractor={(item) => item.id}
          renderItem={renderCollectionItem}
          contentContainerStyle={{ padding: 16, flexGrow: 1 }}
          ListEmptyComponent={
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80 }}>
              <View style={{ backgroundColor: "#7c3aed15", borderRadius: 40, padding: 20 }}>
                <MaterialIcons name="account-balance-wallet" size={48} color="#7c3aed" />
              </View>
              <Text style={{ color: colors.foreground, fontSize: 18, marginTop: 20, fontWeight: 'bold' }}>{t('collection')}</Text>
              <Text style={{ color: colors.muted, fontSize: 14, marginTop: 8, textAlign: 'center', paddingHorizontal: 32 }}>
                {t('no_collections')}{"\n"}{isAr ? 'اضغط على زر (+) لإضافة تحصيل جديد.' : 'Press (+) to add a new collection.'}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  resetCollectionForm();
                  setShowCollectionForm(true);
                }}
                style={{ backgroundColor: "#7c3aed", marginTop: 24, paddingHorizontal: 32, paddingVertical: 12, borderRadius: 12 }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={{ color: '#ffffff', fontWeight: '600' }}>{isAr ? 'إضافة تحصيل' : 'Add Collection'}</Text>
                  <MaterialIcons name="add" size={20} color="white" />
                </View>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </ScreenContainer>
  );
}
