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
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AdminBadgeIcon } from "@/components/admin-badge-icon";
import { AdminCard } from "@/components/admin-card";



interface SaleEntry {
  id: string;
  sellerName: string;
  customerName: string;
  customerCategory: string;
  quantityDozen: string;
  quantityPairs: string;
  paymentMethod: string;
  date: string;
}

interface CollectionEntry {
  id: string;
  collectorName: string;
  customerName: string;
  amount: string;
  date: string;
}

const SALES_KEY = "sultan_sales_data";
const COLLECTION_KEY = "sultan_collection_data";

export default function SalesScreen() {
  const router = useRouter();
  const colors = useColors();
  const { language } = useLanguage();
  const isAr = language === "ar";

  const SELLERS = isAr ? ["شلبي", "عمر", "المغربي", "ياسر", "متجر فالكون", "عادل", "تصنيع خاص"] : ["Shalaby", "Omar", "Al-Maghrabi", "Yasser", "Falcon Store", "Adel", "Special Manufacturing"];
  const CUSTOMER_CATEGORIES = isAr ? ["كلاو", "فالكون", "جملة", "تجزئة", "تصنيع خاص شركات", "تصنيع خاص افراد"] : ["Claw", "Falcon", "Wholesale", "Retail", "Special Manufacturing Companies", "Special Manufacturing Individuals"];
  const PAYMENT_METHODS = isAr ? ["نقداً", "آجل"] : ["Cash", "Credit"];

  // التبويب الحالي: sales أو collection
  const [activeTab, setActiveTab] = useState<"sales" | "collection">("sales");

  // بيانات المبيعات
  const [salesEntries, setSalesEntries] = useState<SaleEntry[]>([]);
  const [showSalesForm, setShowSalesForm] = useState(false);
  const [editingSale, setEditingSale] = useState<SaleEntry | null>(null);
  const [selectedSeller, setSelectedSeller] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [saleDozen, setSaleDozen] = useState("");
  const [salePairs, setSalePairs] = useState("");
  const [selectedPayment, setSelectedPayment] = useState("");

  // بيانات التحصيل
  const [collectionEntries, setCollectionEntries] = useState<CollectionEntry[]>([]);
  const [showCollectionForm, setShowCollectionForm] = useState(false);
  const [editingCollection, setEditingCollection] = useState<CollectionEntry | null>(null);
  const [selectedCollector, setSelectedCollector] = useState("");
  const [collectionCustomer, setCollectionCustomer] = useState("");
  const [collectionAmount, setCollectionAmount] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const salesData = await AsyncStorage.getItem(SALES_KEY);
      if (salesData) setSalesEntries(JSON.parse(salesData));
      const collData = await AsyncStorage.getItem(COLLECTION_KEY);
      if (collData) setCollectionEntries(JSON.parse(collData));
    } catch (e) {
      console.log("Error loading data:", e);
    }
  };

  const saveSales = async (entries: SaleEntry[]) => {
    await AsyncStorage.setItem(SALES_KEY, JSON.stringify(entries));
    setSalesEntries(entries);
  };

  const saveCollections = async (entries: CollectionEntry[]) => {
    await AsyncStorage.setItem(COLLECTION_KEY, JSON.stringify(entries));
    setCollectionEntries(entries);
  };

  // === المبيعات ===
  const resetSalesForm = () => {
    setSelectedSeller("");
    setCustomerName("");
    setSelectedCategory("");
    setSaleDozen("");
    setSalePairs("");
    setSelectedPayment("");
    setEditingSale(null);
  };

  const handleSaveSale = async () => {
    if (!selectedSeller) {
      Alert.alert(isAr ? "تنبيه" : "Alert", isAr ? "يرجى اختيار اسم البائع" : "Please select a seller name");
      return;
    }
    if (!selectedCategory) {
      Alert.alert(isAr ? "تنبيه" : "Alert", isAr ? "يرجى اختيار فئة العميل" : "Please select a customer category");
      return;
    }
    if (!saleDozen && !salePairs) {
      Alert.alert(isAr ? "تنبيه" : "Alert", isAr ? "يرجى إدخال الكمية المباعة" : "Please enter the sold quantity");
      return;
    }
    if (!selectedPayment) {
      Alert.alert(isAr ? "تنبيه" : "Alert", isAr ? "يرجى اختيار طريقة الدفع" : "Please select a payment method");
      return;
    }

    const entry: SaleEntry = {
      id: editingSale?.id || Date.now().toString(),
      sellerName: selectedSeller,
      customerName: customerName || "-",
      customerCategory: selectedCategory,
      quantityDozen: saleDozen || "0",
      quantityPairs: salePairs || "0",
      paymentMethod: selectedPayment,
      date: new Date().toLocaleDateString("ar-SA"),
    };

    let newEntries: SaleEntry[];
    if (editingSale) {
      newEntries = salesEntries.map((e) => (e.id === editingSale.id ? entry : e));
    } else {
      newEntries = [entry, ...salesEntries];
    }

    await saveSales(newEntries);
    resetSalesForm();
    setShowSalesForm(false);
    Alert.alert(isAr ? "تم بنجاح ✓" : "Success ✓", editingSale ? (isAr ? "تم تعديل المبيعة" : "Sale updated") : (isAr ? "تم حفظ المبيعة" : "Sale saved"));
  };

  const handleEditSale = (entry: SaleEntry) => {
    setSelectedSeller(entry.sellerName);
    setCustomerName(entry.customerName);
    setSelectedCategory(entry.customerCategory);
    setSaleDozen(entry.quantityDozen);
    setSalePairs(entry.quantityPairs);
    setSelectedPayment(entry.paymentMethod);
    setEditingSale(entry);
    setShowSalesForm(true);
  };

  const handleDeleteSale = (entry: SaleEntry) => {
    Alert.alert(isAr ? "تأكيد الحذف" : "Confirm Deletion", isAr ? `هل تريد حذف مبيعة "${entry.sellerName}"؟` : `Do you want to delete sale "${entry.sellerName}"?`, [
      { text: isAr ? "إلغاء" : "Cancel", style: "cancel" },
      {
        text: isAr ? "حذف" : "Delete",
        style: "destructive",
        onPress: async () => {
          const newEntries = salesEntries.filter((e) => e.id !== entry.id);
          await saveSales(newEntries);
          Alert.alert(isAr ? "تم ✓" : "Done ✓", isAr ? "تم حذف السجل" : "Record deleted");
        },
      },
    ]);
  };

  // === التحصيل ===
  const resetCollectionForm = () => {
    setSelectedCollector("");
    setCollectionCustomer("");
    setCollectionAmount("");
    setEditingCollection(null);
  };

  const handleSaveCollection = async () => {
    if (!selectedCollector) {
      Alert.alert(isAr ? "تنبيه" : "Alert", isAr ? "يرجى اختيار اسم المحصل" : "Please select a collector name");
      return;
    }
    if (!collectionCustomer) {
      Alert.alert(isAr ? "تنبيه" : "Alert", isAr ? "يرجى إدخال اسم العميل" : "Please enter the customer name");
      return;
    }
    if (!collectionAmount) {
      Alert.alert(isAr ? "تنبيه" : "Alert", isAr ? "يرجى إدخال المبلغ" : "Please enter the amount");
      return;
    }

    const entry: CollectionEntry = {
      id: editingCollection?.id || Date.now().toString(),
      collectorName: selectedCollector,
      customerName: collectionCustomer,
      amount: collectionAmount,
      date: new Date().toLocaleDateString("ar-SA"),
    };

    let newEntries: CollectionEntry[];
    if (editingCollection) {
      newEntries = collectionEntries.map((e) => (e.id === editingCollection.id ? entry : e));
    } else {
      newEntries = [entry, ...collectionEntries];
    }

    await saveCollections(newEntries);
    resetCollectionForm();
    setShowCollectionForm(false);
    Alert.alert(isAr ? "تم بنجاح ✓" : "Success ✓", editingCollection ? (isAr ? "تم تعديل التحصيل" : "Collection updated") : (isAr ? "تم حفظ التحصيل" : "Collection saved"));
  };

  const handleEditCollection = (entry: CollectionEntry) => {
    setSelectedCollector(entry.collectorName);
    setCollectionCustomer(entry.customerName);
    setCollectionAmount(entry.amount);
    setEditingCollection(entry);
    setShowCollectionForm(true);
  };

  const handleDeleteCollection = (entry: CollectionEntry) => {
    Alert.alert(isAr ? "تأكيد الحذف" : "Confirm Deletion", isAr ? `هل تريد حذف تحصيل "${entry.customerName}"؟` : `Do you want to delete collection "${entry.customerName}"?`, [
      { text: isAr ? "إلغاء" : "Cancel", style: "cancel" },
      {
        text: isAr ? "حذف" : "Delete",
        style: "destructive",
        onPress: async () => {
          const newEntries = collectionEntries.filter((e) => e.id !== entry.id);
          await saveCollections(newEntries);
          Alert.alert(isAr ? "تم ✓" : "Done ✓", isAr ? "تم حذف السجل" : "Record deleted");
        },
      },
    ]);
  };

  // عرض سجل مبيعات
  const renderSaleItem = ({ item }: { item: SaleEntry }) => (
    <View className="bg-surface rounded-xl p-4 mb-3 border border-border">
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row gap-2">
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
        <View className="flex-row items-center gap-2">
          <Text className="text-foreground font-bold text-base">{item.sellerName}</Text>
          <View style={{ backgroundColor: "#0a7ea420", borderRadius: 16, padding: 6 }}>
            <MaterialIcons name="point-of-sale" size={18} color="#0a7ea4" />
          </View>
        </View>
      </View>

      <View className="bg-background rounded-lg p-3">
        <View className="flex-row justify-between items-center mb-2">
          <Text className="text-foreground text-sm">{item.customerCategory}</Text>
          <Text className="text-muted text-sm font-semibold">{isAr ? "فئة العميل" : "Customer Category"}</Text>
        </View>
        {item.customerName && item.customerName !== "-" ? (
          <View className="flex-row justify-between items-center mb-2">
            <Text className="text-foreground text-sm">{item.customerName}</Text>
            <Text className="text-muted text-sm font-semibold">{isAr ? "اسم العميل" : "Customer Name"}</Text>
          </View>
        ) : null}
        <View className="flex-row justify-between items-center mb-2">
          <View className="flex-row items-center gap-2">
            <Text className="text-foreground font-bold">{item.quantityDozen}</Text>
            <Text className="text-muted text-xs">{isAr ? "درزن" : "Dozen"}</Text>
            <Text className="text-muted mx-1">|</Text>
            <Text className="text-foreground font-bold">{item.quantityPairs}</Text>
            <Text className="text-muted text-xs">{isAr ? "زوج" : "Pair"}</Text>
          </View>
          <Text className="text-muted text-sm font-semibold">{isAr ? "الكمية" : "Quantity"}</Text>
        </View>
        <View className="flex-row justify-between items-center">
          <View
            style={{
              backgroundColor: item.paymentMethod === (isAr ? "نقداً" : "Cash") ? "#22c55e20" : "#f59e0b20",
              borderRadius: 12,
              paddingHorizontal: 10,
              paddingVertical: 4,
            }}
          >
            <Text
              style={{
                color: item.paymentMethod === (isAr ? "نقداً" : "Cash") ? "#22c55e" : "#f59e0b",
                fontWeight: "700",
                fontSize: 12,
              }}
            >
              {item.paymentMethod}
            </Text>
          </View>
          <Text className="text-muted text-sm font-semibold">{isAr ? "طريقة الدفع" : "Payment Method"}</Text>
        </View>
      </View>
      <Text className="text-muted text-xs mt-2 text-right">{item.date}</Text>
    </View>
  );

  // عرض سجل تحصيل
  const renderCollectionItem = ({ item }: { item: CollectionEntry }) => (
    <View className="bg-surface rounded-xl p-4 mb-3 border border-border">
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row gap-2">
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
        <View className="flex-row items-center gap-2">
          <Text className="text-foreground font-bold text-base">{item.collectorName}</Text>
          <View style={{ backgroundColor: "#7c3aed20", borderRadius: 16, padding: 6 }}>
            <MaterialIcons name="account-balance-wallet" size={18} color="#7c3aed" />
          </View>
        </View>
      </View>

      <View className="bg-background rounded-lg p-3">
        <View className="flex-row justify-between items-center mb-2">
          <Text className="text-foreground text-sm">{item.customerName}</Text>
          <Text className="text-muted text-sm font-semibold">{isAr ? "العميل المحصل منه" : "Collected From"}</Text>
        </View>
        <View className="flex-row justify-between items-center">
          <View className="flex-row items-center gap-1">
            <Text className="text-foreground font-bold text-lg">{item.amount}</Text>
            <Text className="text-muted text-sm">{isAr ? "ريال" : "SAR"}</Text>
          </View>
          <Text className="text-muted text-sm font-semibold">{isAr ? "المبلغ" : "Amount"}</Text>
        </View>
      </View>
      <Text className="text-muted text-xs mt-2 text-right">{item.date}</Text>
    </View>
  );

  // نموذج المبيعات
  const renderSalesForm = () => (
    <ScrollView className="flex-1 px-4 py-4">
      <View className="bg-surface rounded-xl p-5 border border-border">
        <Text className="text-foreground font-bold text-lg mb-5 text-right">
          {editingSale ? (isAr ? "✏️ تعديل مبيعة" : "✏️ Edit Sale") : (isAr ? "➕ إضافة مبيعة جديدة" : "➕ Add New Sale")}
        </Text>

        {/* اسم البائع */}
        <View className="mb-5">
          <Text className="text-foreground font-semibold text-sm mb-3 text-right">{isAr ? "اسم البائع" : "Seller Name"}</Text>
          <View className="flex-row flex-wrap gap-2 justify-end">
            {SELLERS.map((seller) => (
              <TouchableOpacity
                key={seller}
                onPress={() => setSelectedSeller(seller)}
                style={{
                  backgroundColor: selectedSeller === seller ? "#0a7ea4" : "transparent",
                  borderColor: "#0a7ea4",
                  borderWidth: 1.5,
                  borderRadius: 22,
                  paddingHorizontal: 16,
                  paddingVertical: 9,
                }}
              >
                <Text
                  style={{
                    color: selectedSeller === seller ? "white" : "#0a7ea4",
                    fontWeight: "700",
                    fontSize: 13,
                  }}
                >
                  {seller}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* فئة العميل */}
        <View className="mb-5">
          <Text className="text-foreground font-semibold text-sm mb-3 text-right">{isAr ? "فئة العميل" : "Customer Category"}</Text>
          <View className="flex-row flex-wrap gap-2 justify-end">
            {CUSTOMER_CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                onPress={() => setSelectedCategory(cat)}
                style={{
                  backgroundColor: selectedCategory === cat ? "#7c3aed" : "transparent",
                  borderColor: "#7c3aed",
                  borderWidth: 1.5,
                  borderRadius: 22,
                  paddingHorizontal: 16,
                  paddingVertical: 9,
                }}
              >
                <Text
                  style={{
                    color: selectedCategory === cat ? "white" : "#7c3aed",
                    fontWeight: "700",
                    fontSize: 13,
                  }}
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* اسم العميل */}
        <View className="mb-4">
          <Text className="text-foreground font-semibold text-sm mb-2 text-right">
            {isAr ? "اسم العميل (اختياري)" : "Customer Name (Optional)"}
          </Text>
          <TextInput
            className="bg-background border border-border rounded-lg px-4 py-3 text-foreground text-right text-base"
            placeholder={isAr ? "أدخل اسم العميل" : "Enter customer name"}
            placeholderTextColor={colors.muted}
            value={customerName}
            onChangeText={setCustomerName}
            returnKeyType="next"
          />
        </View>

        {/* الكمية بالدرزن */}
        <View className="mb-4">
          <Text className="text-foreground font-semibold text-sm mb-2 text-right">
            {isAr ? "الكمية المباعة (درزن)" : "Sold Quantity (Dozen)"}
          </Text>
          <TextInput
            className="bg-background border border-border rounded-lg px-4 py-3 text-foreground text-right text-base"
            placeholder="0"
            placeholderTextColor={colors.muted}
            value={saleDozen}
            onChangeText={setSaleDozen}
            keyboardType="numeric"
            returnKeyType="next"
          />
        </View>

        {/* الكمية بالزوج */}
        <View className="mb-4">
          <Text className="text-foreground font-semibold text-sm mb-2 text-right">
            {isAr ? "الكمية المباعة (زوج)" : "Sold Quantity (Pairs)"}
          </Text>
          <TextInput
            className="bg-background border border-border rounded-lg px-4 py-3 text-foreground text-right text-base"
            placeholder="0"
            placeholderTextColor={colors.muted}
            value={salePairs}
            onChangeText={setSalePairs}
            keyboardType="numeric"
            returnKeyType="next"
          />
        </View>

        {/* طريقة الدفع */}
        <View className="mb-5">
          <Text className="text-foreground font-semibold text-sm mb-3 text-right">{isAr ? "طريقة الدفع" : "Payment Method"}</Text>
          <View className="flex-row gap-3 justify-end">
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

        {/* أزرار */}
        <View className="flex-row gap-3 mt-2">
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
            <Text className="text-foreground font-semibold text-base">{isAr ? "إلغاء" : "Cancel"}</Text>
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
            <Text className="text-white font-semibold text-base">
              {editingSale ? (isAr ? "تعديل" : "Edit") : (isAr ? "حفظ" : "Save")}
            </Text>
            <MaterialIcons name={editingSale ? "edit" : "save"} size={20} color="white" />
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );

  // نموذج التحصيل
  const renderCollectionForm = () => (
    <ScrollView className="flex-1 px-4 py-4">
      <View className="bg-surface rounded-xl p-5 border border-border">
        <Text className="text-foreground font-bold text-lg mb-5 text-right">
          {editingCollection ? (isAr ? "✏️ تعديل تحصيل" : "✏️ Edit Collection") : (isAr ? "➕ إضافة تحصيل جديد" : "➕ Add New Collection")}
        </Text>

        {/* اسم المحصل */}
        <View className="mb-5">
          <Text className="text-foreground font-semibold text-sm mb-3 text-right">{isAr ? "اسم المحصل" : "Collector Name"}</Text>
          <View className="flex-row flex-wrap gap-2 justify-end">
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

        {/* اسم العميل المحصل منه */}
        <View className="mb-4">
          <Text className="text-foreground font-semibold text-sm mb-2 text-right">
            {isAr ? "اسم العميل المحصل منه" : "Collected From Customer"}
          </Text>
          <TextInput
            className="bg-background border border-border rounded-lg px-4 py-3 text-foreground text-right text-base"
            placeholder={isAr ? "أدخل اسم العميل" : "Enter customer name"}
            placeholderTextColor={colors.muted}
            value={collectionCustomer}
            onChangeText={setCollectionCustomer}
            returnKeyType="next"
          />
        </View>

        {/* المبلغ بالريال */}
        <View className="mb-5">
          <Text className="text-foreground font-semibold text-sm mb-2 text-right">
            {isAr ? "المبلغ (ريال)" : "Amount (SAR)"}
          </Text>
          <TextInput
            className="bg-background border border-border rounded-lg px-4 py-3 text-foreground text-right text-base"
            placeholder="0"
            placeholderTextColor={colors.muted}
            value={collectionAmount}
            onChangeText={setCollectionAmount}
            keyboardType="numeric"
            returnKeyType="done"
          />
        </View>

        {/* أزرار */}
        <View className="flex-row gap-3 mt-2">
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
            <Text className="text-foreground font-semibold text-base">{isAr ? "إلغاء" : "Cancel"}</Text>
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
            <Text className="text-white font-semibold text-base">
              {editingCollection ? (isAr ? "تعديل" : "Edit") : (isAr ? "حفظ" : "Save")}
            </Text>
            <MaterialIcons name={editingCollection ? "edit" : "save"} size={20} color="white" />
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );

  return (
    <ScreenContainer className="bg-background">
      {/* رأس الصفحة */}
      <View
        style={{ backgroundColor: "#0a7ea4" }}
        className="px-6 py-5 flex-row items-center justify-between"
      >
        {/* زر الإضافة */}
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

        {/* أيقونة الإجراءات الإدارية */}
        <AdminBadgeIcon />
        {/* العنوان */}
        <View className="flex-1 items-center">
          <Text className="text-white font-bold text-xl">{isAr ? "المبيعات والتحصيل" : "Sales and Collection"}</Text>
          <Text className="text-white/80 text-sm mt-1">
            {activeTab === "sales"
              ? (isAr ? `${salesEntries.length} مبيعة` : `${salesEntries.length} Sales`)
              : (isAr ? `${collectionEntries.length} تحصيل` : `${collectionEntries.length} Collections`)}
          </Text>
        </View>

        {/* زر الرجوع */}
        <BackButton />
      </View>

      {/* بطاقة الإجراءات الإدارية - كبيرة وواضحة */}
      <AdminCard />

      {/* التبويبات */}
      <View className="flex-row border-b border-border">
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
              {isAr ? "المبيعات" : "Sales"}
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
              {isAr ? "التحصيل" : "Collection"}
            </Text>
            <MaterialIcons
              name="account-balance-wallet"
              size={20}
              color={activeTab === "collection" ? "#7c3aed" : colors.muted}
            />
          </View>
        </TouchableOpacity>
      </View>

      {/* المحتوى */}
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
              <View className="flex-1 items-center justify-center py-20">
                <View style={{ backgroundColor: "#0a7ea415", borderRadius: 40, padding: 20 }}>
                  <MaterialIcons name="point-of-sale" size={48} color="#0a7ea4" />
                </View>
                <Text className="text-foreground text-lg mt-5 font-bold">{isAr ? "المبيعات" : "Sales"}</Text>
                <Text className="text-muted text-sm mt-2 text-center px-8">
                  {isAr ? "لا توجد بيانات مبيعات بعد." : "No sales data yet."}{"\n"}{isAr ? "اضغط على زر (+) لإضافة مبيعة جديدة." : "Press (+) to add a new sale."}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    resetSalesForm();
                    setShowSalesForm(true);
                  }}
                  style={{ backgroundColor: "#0a7ea4", marginTop: 24, paddingHorizontal: 32, paddingVertical: 12, borderRadius: 12 }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text className="text-white font-semibold">{isAr ? "إضافة مبيعة" : "Add Sale"}</Text>
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
            <View className="flex-1 items-center justify-center py-20">
              <View style={{ backgroundColor: "#7c3aed15", borderRadius: 40, padding: 20 }}>
                <MaterialIcons name="account-balance-wallet" size={48} color="#7c3aed" />
              </View>
              <Text className="text-foreground text-lg mt-5 font-bold">{isAr ? "التحصيل" : "Collection"}</Text>
              <Text className="text-muted text-sm mt-2 text-center px-8">
                {isAr ? "لا توجد بيانات تحصيل بعد." : "No collection data yet."}{"\n"}{isAr ? "اضغط على زر (+) لإضافة تحصيل جديد." : "Press (+) to add a new collection."}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  resetCollectionForm();
                  setShowCollectionForm(true);
                }}
                style={{ backgroundColor: "#7c3aed", marginTop: 24, paddingHorizontal: 32, paddingVertical: 12, borderRadius: 12 }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text className="text-white font-semibold">{isAr ? "إضافة تحصيل" : "Add Collection"}</Text>
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
