import React, { useState, useEffect } from "react";
import { BackButton } from "@/components/back-button";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { MaterialIcons } from "@expo/vector-icons";
import { warehouseEntriesService } from "@/lib/services/data.service";
import { useAuth } from "@/lib/auth-context";
import { AttachmentPicker } from "@/components/attachment-picker";
import { AttachmentFile } from "@/lib/services/attachment.service";
import { useLanguage } from "@/lib/language-context";

const WAREHOUSE_TYPES_AR = ["مستودع الإنتاج التام", "مستودع المواد الخام"];
const WAREHOUSE_TYPES_EN = ["Finished Products Warehouse", "Raw Materials Warehouse"];
const FINISHED_ITEMS_AR = ["جوارب إنتاج تام", "جوارب نخب ثاني"];
const FINISHED_ITEMS_EN = ["Finished Socks", "Second Grade Socks"];
const RAW_ITEMS_AR = ["خيوط", "قطع غيار"];
const RAW_ITEMS_EN = ["Thread", "Spare Parts"];
const INVOICE_TYPES_AR = ["مبيعات", "عينات", "هدايا"];
const INVOICE_TYPES_EN = ["Sales", "Samples", "Gifts"];
const RAW_UNITS_AR = ["كيلو", "غرام", "حبة", "كرتون"];
const RAW_UNITS_EN = ["Kg", "Gram", "Piece", "Carton"];

interface OutEntry {
  id: string;
  warehouseType: string;
  itemCategory: string;
  itemName: string;
  supplier: string;
  invoiceNumber: string;
  invoiceType: string;
  invoiceDate: string;
  quantityDozen: string;
  quantityPairs: string;
  quantity: string;
  unit: string;
  receiverName: string;
  documentAttached: boolean;
}

const SECTION_KEY = "out";

const formatDate = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export default function WarehouseOutScreen() {
  const router = useRouter();
  const colors = useColors();
  const { user } = useAuth();
  const { language } = useLanguage();
  const isAr = language === "ar";
  const [entries, setEntries] = useState<OutEntry[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<OutEntry | null>(null);

  const [warehouseType, setWarehouseType] = useState("");
  const [itemCategory, setItemCategory] = useState("");
  const [itemName, setItemName] = useState("");
  const [supplier, setSupplier] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceType, setInvoiceType] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(formatDate(new Date()));
  const [quantityDozen, setQuantityDozen] = useState("");
  const [quantityPairs, setQuantityPairs] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");
  const [receiverName, setReceiverName] = useState("");
  const [documentAttached, setDocumentAttached] = useState(false);
  const [warehouseOutAttachments, setWarehouseOutAttachments] = useState<AttachmentFile[]>([]);

  const WAREHOUSE_TYPES = isAr ? WAREHOUSE_TYPES_AR : WAREHOUSE_TYPES_EN;
  const FINISHED_ITEMS = isAr ? FINISHED_ITEMS_AR : FINISHED_ITEMS_EN;
  const RAW_ITEMS = isAr ? RAW_ITEMS_AR : RAW_ITEMS_EN;
  const INVOICE_TYPES = isAr ? INVOICE_TYPES_AR : INVOICE_TYPES_EN;
  const RAW_UNITS = isAr ? RAW_UNITS_AR : RAW_UNITS_EN;

  useEffect(() => { loadEntries(); }, []);

  const loadEntries = async () => {
    try {
      const results = await warehouseEntriesService.getBySection(SECTION_KEY);
      if (results && results.length > 0) {
        setEntries(results.map((r: any) => ({
          id: String(r.id),
          ...(r.data || {}),
        })));
      } else {
        setEntries([]);
      }
    } catch (e) { console.log(e); setEntries([]); }
  };

  const resetForm = () => {
    setWarehouseType("");
    setItemCategory("");
    setItemName("");
    setSupplier("");
    setInvoiceNumber("");
    setInvoiceType("");
    setInvoiceDate(formatDate(new Date()));
    setQuantityDozen("");
    setQuantityPairs("");
    setQuantity("");
    setUnit("");
    setReceiverName("");
    setDocumentAttached(false);
    setEditingEntry(null);
  };

  const handleSave = async () => {
    if (!warehouseType) { Alert.alert(isAr ? "تنبيه" : "Alert", isAr ? "يرجى اختيار المستودع" : "Please select warehouse"); return; }
    if (!itemCategory) { Alert.alert(isAr ? "تنبيه" : "Alert", isAr ? "يرجى اختيار الصنف" : "Please select item"); return; }

    const entry: OutEntry = {
      id: editingEntry?.id || Date.now().toString(),
      warehouseType,
      itemCategory,
      itemName: itemName || "-",
      supplier: supplier || "-",
      invoiceNumber: invoiceNumber || "-",
      invoiceType: invoiceType || "-",
      invoiceDate,
      quantityDozen: quantityDozen || "0",
      quantityPairs: quantityPairs || "0",
      quantity: quantity || "0",
      unit: unit || "-",
      receiverName: receiverName || "-",
      documentAttached,
    };

    try {
      const { id, ...entryData } = entry;
      if (editingEntry) {
        await warehouseEntriesService.update(parseInt(editingEntry.id), entryData, invoiceDate);
      } else {
        await warehouseEntriesService.create(SECTION_KEY, entryData, invoiceDate, user?.id);
      }
      await loadEntries();
      resetForm();
      setShowForm(false);
      Alert.alert(isAr ? "تم بنجاح ✓" : "Success ✓", editingEntry ? (isAr ? "تم تعديل البيانات" : "Data updated") : (isAr ? "تم حفظ البيانات" : "Data saved"));
    } catch (e) {
      Alert.alert(isAr ? "خطأ" : "Error", isAr ? "فشل حفظ البيانات" : "Failed to save data");
    }
  };

  const handleEdit = (entry: OutEntry) => {
    setWarehouseType(entry.warehouseType);
    setItemCategory(entry.itemCategory);
    setItemName(entry.itemName);
    setSupplier(entry.supplier);
    setInvoiceNumber(entry.invoiceNumber);
    setInvoiceType(entry.invoiceType);
    setInvoiceDate(entry.invoiceDate);
    setQuantityDozen(entry.quantityDozen);
    setQuantityPairs(entry.quantityPairs);
    setQuantity(entry.quantity);
    setUnit(entry.unit);
    setReceiverName(entry.receiverName);
    setDocumentAttached(entry.documentAttached);
    setEditingEntry(entry);
    setShowForm(true);
  };

  const handleDelete = (entry: OutEntry) => {
    const doDelete = async () => {
      try {
        await warehouseEntriesService.delete(parseInt(entry.id));
        await loadEntries();
      } catch (e) { console.log(e); }
    };
    if (Platform.OS === "web") {
      if (confirm(isAr ? "هل تريد حذف هذا السجل؟" : "Do you want to delete this record?")) {
        doDelete();
      }
    } else {
      Alert.alert(isAr ? "تأكيد الحذف" : "Confirm Deletion", isAr ? "هل تريد حذف هذا السجل؟" : "Do you want to delete this record?", [
        { text: isAr ? "إلغاء" : "Cancel", style: "cancel" },
        { text: isAr ? "حذف" : "Delete", style: "destructive", onPress: doDelete },
      ]);
    }
  };

  const isFinishedWarehouse = warehouseType === WAREHOUSE_TYPES[0];
  const isRawWarehouse = warehouseType === WAREHOUSE_TYPES[1];

  const renderForm = () => (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
      <View style={styles.formCard}>
        <Text style={styles.formTitle}>
          {editingEntry ? (isAr ? "✏️ تعديل بيانات" : "✏️ Edit Data") : (isAr ? "➕ إخراج من المستودع" : "➕ Warehouse Output")}
        </Text>

        <Text style={styles.label}>{isAr ? "اختر المستودع" : "Select Warehouse"}</Text>
        <View style={styles.chipRow}>
          {WAREHOUSE_TYPES.map((type) => (
            <TouchableOpacity
              key={type}
              onPress={() => { setWarehouseType(type); setItemCategory(""); }}
              style={[styles.chip, warehouseType === type && styles.chipActiveRed]}
            >
              <Text style={[styles.chipTextRed, warehouseType === type && styles.chipTextActive]}>{type}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {isFinishedWarehouse && (
          <>
            <Text style={styles.label}>{isAr ? "اسم الصنف" : "Item Name"}</Text>
            <View style={styles.chipRow}>
              {FINISHED_ITEMS.map((item) => (
                <TouchableOpacity
                  key={item}
                  onPress={() => setItemCategory(item)}
                  style={[styles.chip, itemCategory === item && styles.chipActiveRed]}
                >
                  <Text style={[styles.chipTextRed, itemCategory === item && styles.chipTextActive]}>{item}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>{isAr ? "رقم فاتورة المبيعات" : "Sales Invoice No."}</Text>
            <TextInput
              style={styles.input}
              placeholder={isAr ? "رقم الفاتورة" : "Invoice No."}
              placeholderTextColor={colors.muted}
              value={invoiceNumber}
              onChangeText={setInvoiceNumber}
            />

            <Text style={styles.label}>{isAr ? "نوع الفاتورة" : "Invoice Type"}</Text>
            <View style={styles.chipRow}>
              {INVOICE_TYPES.map((type) => (
                <TouchableOpacity
                  key={type}
                  onPress={() => setInvoiceType(type)}
                  style={[styles.chip, invoiceType === type && styles.chipActiveRed]}
                >
                  <Text style={[styles.chipTextRed, invoiceType === type && styles.chipTextActive]}>{type}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>{isAr ? "تاريخ الفاتورة" : "Invoice Date"}</Text>
            <TextInput
              style={styles.input}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.muted}
              value={invoiceDate}
              onChangeText={setInvoiceDate}
            />

            <Text style={styles.label}>{isAr ? "الكمية (درزن)" : "Quantity (Dozen)"}</Text>
            <TextInput
              style={styles.input}
              placeholder="0"
              placeholderTextColor={colors.muted}
              value={quantityDozen}
              onChangeText={setQuantityDozen}
              keyboardType="numeric"
            />
            <Text style={styles.label}>{isAr ? "الكمية (زوج)" : "Quantity (Pairs)"}</Text>
            <TextInput
              style={styles.input}
              placeholder="0"
              placeholderTextColor={colors.muted}
              value={quantityPairs}
              onChangeText={setQuantityPairs}
              keyboardType="numeric"
            />
          </>
        )}

        {isRawWarehouse && (
          <>
            <Text style={styles.label}>{isAr ? "نوع الصنف" : "Item Type"}</Text>
            <View style={styles.chipRow}>
              {RAW_ITEMS.map((item) => (
                <TouchableOpacity
                  key={item}
                  onPress={() => setItemCategory(item)}
                  style={[styles.chip, itemCategory === item && styles.chipActiveRed]}
                >
                  <Text style={[styles.chipTextRed, itemCategory === item && styles.chipTextActive]}>{item}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>{isAr ? "اسم الصنف" : "Item Name"}</Text>
            <TextInput
              style={styles.input}
              placeholder={isAr ? "اسم الصنف" : "Item Name"}
              placeholderTextColor={colors.muted}
              value={itemName}
              onChangeText={setItemName}
            />

            <Text style={styles.label}>{isAr ? "الكمية" : "Quantity"}</Text>
            <TextInput
              style={styles.input}
              placeholder="0"
              placeholderTextColor={colors.muted}
              value={quantity}
              onChangeText={setQuantity}
              keyboardType="numeric"
            />

            <Text style={styles.label}>{isAr ? "الوحدة" : "Unit"}</Text>
            <View style={styles.chipRow}>
              {RAW_UNITS.map((u) => (
                <TouchableOpacity
                  key={u}
                  onPress={() => setUnit(u)}
                  style={[styles.chip, unit === u && styles.chipActiveRed]}
                >
                  <Text style={[styles.chipTextRed, unit === u && styles.chipTextActive]}>{u}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>{isAr ? "اسم الشخص المستلم" : "Receiver Name"}</Text>
            <TextInput
              style={styles.input}
              placeholder={isAr ? "اسم المستلم" : "Receiver"}
              placeholderTextColor={colors.muted}
              value={receiverName}
              onChangeText={setReceiverName}
            />
          </>
        )}

        {(isFinishedWarehouse || isRawWarehouse) && (
          <TouchableOpacity
            onPress={() => setDocumentAttached(!documentAttached)}
            style={[styles.attachBtn, documentAttached && styles.attachBtnActive]}
          >
            <Text style={[styles.attachText, documentAttached && { color: "white" }]}>
              {documentAttached ? (isAr ? "✓ تم إرفاق المستند" : "✓ Document Attached") : (isAr ? "📎 إرفاق مستند الإخراج" : "📎 Attach Output Document")}
            </Text>
            <MaterialIcons name={documentAttached ? "check-circle" : "attach-file"} size={20} color={documentAttached ? "white" : "#ef4444"} />
          </TouchableOpacity>
        )}

        <AttachmentPicker
          attachments={warehouseOutAttachments}
          onAttachmentsChange={setWarehouseOutAttachments}
          language={language}
        />

        {(isFinishedWarehouse || isRawWarehouse) && (
          <View style={styles.buttonRow}>
            <TouchableOpacity onPress={() => { setShowForm(false); resetForm(); }} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>{isAr ? "إلغاء" : "Cancel"}</Text>
              <MaterialIcons name="close" size={18} color="#11181C" />
            </TouchableOpacity>
            {editingEntry && (
              <TouchableOpacity onPress={handleSave} style={styles.editBtn}>
                <Text style={styles.editBtnText}>{isAr ? "تعديل" : "Edit"}</Text>
                <MaterialIcons name="edit" size={18} color="white" />
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={handleSave} style={styles.saveBtn}>
              <Text style={styles.saveBtnText}>{isAr ? "حفظ" : "Save"}</Text>
              <MaterialIcons name="save" size={18} color="white" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>
  );

  const renderEntries = () => (
    <ScrollView contentContainerStyle={{ padding: 16, flexGrow: 1 }}>
      {entries.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <MaterialIcons name="output" size={48} color="#ef4444" />
          </View>
          <Text style={styles.emptyTitle}>{isAr ? "الخارج من المستودعات" : "Warehouse Output"}</Text>
          <Text style={styles.emptySubtitle}>{isAr ? "لا توجد بيانات بعد. اضغط (+) لإضافة إخراج جديد." : "No data yet. Press (+) to add a new output."}</Text>
          <TouchableOpacity onPress={() => { resetForm(); setShowForm(true); }} style={styles.addBtnEmpty}>
            <Text style={{ color: "white", fontWeight: "600" }}>{isAr ? "إضافة إخراج" : "Add Output"}</Text>
            <MaterialIcons name="add" size={20} color="white" />
          </TouchableOpacity>
        </View>
      ) : (
        entries.map((entry) => (
          <View key={entry.id} style={styles.entryCard}>
            <View style={styles.entryHeader}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TouchableOpacity onPress={() => handleEdit(entry)} style={styles.actionBtn}>
                  <MaterialIcons name="edit" size={16} color="#0a7ea4" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(entry)} style={styles.deleteBtn}>
                  <MaterialIcons name="delete" size={16} color="#ef4444" />
                </TouchableOpacity>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={styles.entryDateText}>{entry.invoiceDate}</Text>
                <MaterialIcons name="calendar-today" size={14} color="#ef4444" />
              </View>
            </View>
            <View style={styles.entryBody}>
              <View style={styles.entryRow}>
                <Text style={[styles.entryValue, { color: "#ef4444" }]}>{entry.warehouseType}</Text>
                <Text style={styles.entryLabel}>{isAr ? "المستودع:" : "Warehouse:"}</Text>
              </View>
              <View style={styles.entryRow}>
                <Text style={styles.entryValue}>{entry.itemCategory}</Text>
                <Text style={styles.entryLabel}>{isAr ? "الصنف:" : "Item:"}</Text>
              </View>
              {(entry.warehouseType === "مستودع الإنتاج التام" || entry.warehouseType === "Finished Products Warehouse") ? (
                <>
                  <View style={styles.entryRow}>
                    <Text style={styles.entryValue}>{entry.invoiceNumber} ({entry.invoiceType})</Text>
                    <Text style={styles.entryLabel}>{isAr ? "الفاتورة:" : "Invoice:"}</Text>
                  </View>
                  <View style={styles.entryRow}>
                    <Text style={styles.entryValue}>{entry.quantityDozen} {isAr ? "درزن" : "dz"} | {entry.quantityPairs} {isAr ? "زوج" : "pairs"}</Text>
                    <Text style={styles.entryLabel}>{isAr ? "الكمية:" : "Quantity:"}</Text>
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.entryRow}>
                    <Text style={styles.entryValue}>{entry.itemName}</Text>
                    <Text style={styles.entryLabel}>{isAr ? "اسم الصنف:" : "Item Name:"}</Text>
                  </View>
                  <View style={styles.entryRow}>
                    <Text style={styles.entryValue}>{entry.quantity} {entry.unit}</Text>
                    <Text style={styles.entryLabel}>{isAr ? "الكمية:" : "Quantity:"}</Text>
                  </View>
                  <View style={styles.entryRow}>
                    <Text style={styles.entryValue}>{entry.receiverName}</Text>
                    <Text style={styles.entryLabel}>{isAr ? "المستلم:" : "Receiver:"}</Text>
                  </View>
                </>
              )}
              {entry.documentAttached && (
                <View style={styles.entryRow}>
                  <Text style={[styles.entryValue, { color: "#ef4444" }]}>{isAr ? "✓ مرفق" : "✓ Attached"}</Text>
                  <Text style={styles.entryLabel}>{isAr ? "المستند:" : "Document:"}</Text>
                </View>
              )}
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );

  return (
    <ScreenContainer style={{ backgroundColor: colors.background }}>
      <View style={[styles.header, { backgroundColor: "#ef4444" }]}>
        <TouchableOpacity onPress={() => { resetForm(); setShowForm(true); }} style={styles.headerBtn}>
          <MaterialIcons name="add" size={24} color="white" />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={styles.headerTitle}>{isAr ? "الخارج من المستودعات" : "Warehouse Output"}</Text>
          <Text style={styles.headerSub}>{entries.length} {isAr ? "سجل" : "records"}</Text>
        </View>
        <BackButton />
      </View>

      {showForm ? renderForm() : renderEntries()}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 24, paddingVertical: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerBtn: { backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 20, padding: 8 },
  headerTitle: { color: "white", fontWeight: "bold", fontSize: 18 },
  headerSub: { color: "rgba(255,255,255,0.8)", fontSize: 12, marginTop: 2 },
  formCard: { backgroundColor: "white", borderRadius: 16, padding: 20, borderWidth: 1, borderColor: "#E5E7EB" },
  formTitle: { fontSize: 18, fontWeight: "bold", color: "#11181C", textAlign: "right", marginBottom: 20 },
  label: { fontSize: 13, fontWeight: "600", color: "#11181C", textAlign: "right", marginBottom: 8, marginTop: 12 },
  input: { backgroundColor: "#f5f5f5", borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, textAlign: "right", color: "#11181C" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "flex-end" },
  chip: { borderWidth: 1.5, borderColor: "#ef4444", borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  chipActiveRed: { backgroundColor: "#ef4444" },
  chipTextRed: { color: "#ef4444", fontWeight: "600", fontSize: 13 },
  chipTextActive: { color: "white" },
  attachBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1.5, borderColor: "#ef4444", borderRadius: 12, padding: 12, marginTop: 16 },
  attachBtnActive: { backgroundColor: "#ef4444" },
  attachText: { color: "#ef4444", fontWeight: "600", fontSize: 13 },
  buttonRow: { flexDirection: "row", gap: 12, marginTop: 24 },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 12, paddingVertical: 14, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6 },
  cancelText: { color: "#11181C", fontWeight: "600", fontSize: 14 },
  editBtn: { flex: 1, backgroundColor: "#0a7ea4", borderRadius: 12, paddingVertical: 14, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6 },
  editBtnText: { color: "white", fontWeight: "600", fontSize: 14 },
  saveBtn: { flex: 1, backgroundColor: "#ef4444", borderRadius: 12, paddingVertical: 14, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6 },
  saveBtnText: { color: "white", fontWeight: "600", fontSize: 14 },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 80 },
  emptyIcon: { backgroundColor: "#ef444415", borderRadius: 40, padding: 20 },
  emptyTitle: { fontSize: 18, fontWeight: "bold", color: "#11181C", marginTop: 20 },
  emptySubtitle: { fontSize: 13, color: "#687076", marginTop: 8, textAlign: "center" },
  addBtnEmpty: { backgroundColor: "#ef4444", marginTop: 24, paddingHorizontal: 32, paddingVertical: 12, borderRadius: 12, flexDirection: "row", alignItems: "center", gap: 8 },
  entryCard: { backgroundColor: "white", borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "#E5E7EB" },
  entryHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  entryDateText: { fontSize: 13, fontWeight: "600", color: "#11181C" },
  actionBtn: { backgroundColor: "#0a7ea415", borderRadius: 16, padding: 6 },
  deleteBtn: { backgroundColor: "#ef444415", borderRadius: 16, padding: 6 },
  entryBody: { backgroundColor: "#f5f5f5", borderRadius: 10, padding: 12 },
  entryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 4 },
  entryLabel: { fontSize: 12, color: "#687076", fontWeight: "600" },
  entryValue: { fontSize: 12, color: "#11181C", fontWeight: "500" },
});
