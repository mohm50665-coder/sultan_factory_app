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

const DATA_ENTRY_NAMES_AR = ["حيدر", "شميم", "غلام"];
const DATA_ENTRY_NAMES_EN = ["Haider", "Shameem", "Ghulam"];
const UNITS_AR = ["طن", "كيلو", "غرام", "كرتون", "حبة"];
const UNITS_EN = ["Ton", "Kg", "Gram", "Carton", "Piece"];

interface RawEntry {
  id: string;
  dataEntryName: string;
  entryDate: string;
  itemName: string;
  supplier: string;
  quantity: string;
  unit: string;
  receiverName: string;
  documentAttached: boolean;
}

const SECTION_KEY = "raw";

const formatDate = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export default function WarehouseRawScreen() {
  const router = useRouter();
  const colors = useColors();
  const { user } = useAuth();
  const { language } = useLanguage();
  const isAr = language === "ar";
  const [entries, setEntries] = useState<RawEntry[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<RawEntry | null>(null);

  const [dataEntryName, setDataEntryName] = useState("");
  const [entryDate, setEntryDate] = useState(formatDate(new Date()));
  const [itemName, setItemName] = useState("");
  const [supplier, setSupplier] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");
  const [receiverName, setReceiverName] = useState("");
  const [documentAttached, setDocumentAttached] = useState(false);
  const [warehouseAttachments, setWarehouseAttachments] = useState<AttachmentFile[]>([]);

  const DATA_ENTRY_NAMES = isAr ? DATA_ENTRY_NAMES_AR : DATA_ENTRY_NAMES_EN;
  const UNITS = isAr ? UNITS_AR : UNITS_EN;

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
    setDataEntryName("");
    setEntryDate(formatDate(new Date()));
    setItemName("");
    setSupplier("");
    setQuantity("");
    setUnit("");
    setReceiverName("");
    setDocumentAttached(false);
    setEditingEntry(null);
  };

  const handleSave = async () => {
    if (!dataEntryName) { Alert.alert(isAr ? "تنبيه" : "Alert", isAr ? "يرجى اختيار اسم مدخل البيانات" : "Please select data entry name"); return; }
    if (!itemName) { Alert.alert(isAr ? "تنبيه" : "Alert", isAr ? "يرجى إدخال اسم الصنف" : "Please enter item name"); return; }

    const entry: RawEntry = {
      id: editingEntry?.id || Date.now().toString(),
      dataEntryName,
      entryDate,
      itemName,
      supplier: supplier || "-",
      quantity: quantity || "0",
      unit: unit || (isAr ? "كيلو" : "Kg"),
      receiverName: receiverName || "-",
      documentAttached,
    };

    try {
      const { id, ...entryData } = entry;
      if (editingEntry) {
        await warehouseEntriesService.update(parseInt(editingEntry.id), entryData, entryDate);
      } else {
        await warehouseEntriesService.create(SECTION_KEY, entryData, entryDate, user?.id);
      }
      await loadEntries();
      resetForm();
      setShowForm(false);
      Alert.alert(isAr ? "تم بنجاح ✓" : "Success ✓", editingEntry ? (isAr ? "تم تعديل البيانات" : "Data updated") : (isAr ? "تم حفظ البيانات" : "Data saved"));
    } catch (e) {
      Alert.alert(isAr ? "خطأ" : "Error", isAr ? "فشل حفظ البيانات" : "Failed to save data");
    }
  };

  const handleEdit = (entry: RawEntry) => {
    setDataEntryName(entry.dataEntryName);
    setEntryDate(entry.entryDate);
    setItemName(entry.itemName);
    setSupplier(entry.supplier);
    setQuantity(entry.quantity);
    setUnit(entry.unit);
    setReceiverName(entry.receiverName);
    setDocumentAttached(entry.documentAttached);
    setEditingEntry(entry);
    setShowForm(true);
  };

  const handleDelete = (entry: RawEntry) => {
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

  const renderForm = () => (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
      <View style={styles.formCard}>
        <Text style={styles.formTitle}>
          {editingEntry ? (isAr ? "✏️ تعديل بيانات" : "✏️ Edit Data") : (isAr ? "➕ إدخال مواد خام" : "➕ Add Raw Material")}
        </Text>

        <Text style={styles.label}>{isAr ? "اسم مدخل البيانات" : "Data Entry Name"}</Text>
        <View style={styles.chipRow}>
          {DATA_ENTRY_NAMES.map((name) => (
            <TouchableOpacity
              key={name}
              onPress={() => setDataEntryName(name)}
              style={[styles.chip, dataEntryName === name && styles.chipActive]}
            >
              <Text style={[styles.chipText, dataEntryName === name && styles.chipTextActive]}>{name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>{isAr ? "تاريخ الإدخال" : "Entry Date"}</Text>
        <TextInput
          style={styles.input}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.muted}
          value={entryDate}
          onChangeText={setEntryDate}
        />

        <Text style={styles.label}>{isAr ? "اسم الصنف" : "Item Name"}</Text>
        <TextInput
          style={styles.input}
          placeholder={isAr ? "مثال: خيوط بوليستر" : "e.g. Polyester Thread"}
          placeholderTextColor={colors.muted}
          value={itemName}
          onChangeText={setItemName}
        />

        <Text style={styles.label}>{isAr ? "المورد" : "Supplier"}</Text>
        <TextInput
          style={styles.input}
          placeholder={isAr ? "اسم المورد" : "Supplier Name"}
          placeholderTextColor={colors.muted}
          value={supplier}
          onChangeText={setSupplier}
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
          {UNITS.map((u) => (
            <TouchableOpacity
              key={u}
              onPress={() => setUnit(u)}
              style={[styles.chip, unit === u && styles.chipActive]}
            >
              <Text style={[styles.chipText, unit === u && styles.chipTextActive]}>{u}</Text>
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

        <TouchableOpacity
          onPress={() => setDocumentAttached(!documentAttached)}
          style={[styles.attachBtn, documentAttached && styles.attachBtnActive]}
        >
          <Text style={[styles.attachText, documentAttached && { color: "white" }]}>
            {documentAttached ? (isAr ? "✓ تم إرفاق المستند" : "✓ Document Attached") : (isAr ? "📎 إرفاق مستند الإدخال" : "📎 Attach Document")}
          </Text>
          <MaterialIcons name={documentAttached ? "check-circle" : "attach-file"} size={20} color={documentAttached ? "white" : "#3b82f6"} />
        </TouchableOpacity>

        <AttachmentPicker
          attachments={warehouseAttachments}
          onAttachmentsChange={setWarehouseAttachments}
          language={language}
        />

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
      </View>
    </ScrollView>
  );

  const renderEntries = () => (
    <ScrollView contentContainerStyle={{ padding: 16, flexGrow: 1 }}>
      {entries.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <MaterialIcons name="inventory-2" size={48} color="#3b82f6" />
          </View>
          <Text style={styles.emptyTitle}>{isAr ? "مستودع المواد الخام" : "Raw Materials Warehouse"}</Text>
          <Text style={styles.emptySubtitle}>{isAr ? "لا توجد بيانات بعد. اضغط (+) لإضافة إدخال جديد." : "No data yet. Press (+) to add a new entry."}</Text>
          <TouchableOpacity onPress={() => { resetForm(); setShowForm(true); }} style={[styles.addBtnEmpty, { backgroundColor: "#3b82f6" }]}>
            <Text style={{ color: "white", fontWeight: "600" }}>{isAr ? "إضافة إدخال" : "Add Entry"}</Text>
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
                <Text style={styles.entryDateText}>{entry.entryDate}</Text>
                <MaterialIcons name="calendar-today" size={14} color="#3b82f6" />
              </View>
            </View>
            <View style={styles.entryBody}>
              <View style={styles.entryRow}>
                <Text style={styles.entryValue}>{entry.dataEntryName}</Text>
                <Text style={styles.entryLabel}>{isAr ? "مدخل البيانات:" : "Data Entry:"}</Text>
              </View>
              <View style={styles.entryRow}>
                <Text style={styles.entryValue}>{entry.itemName}</Text>
                <Text style={styles.entryLabel}>{isAr ? "الصنف:" : "Item:"}</Text>
              </View>
              <View style={styles.entryRow}>
                <Text style={styles.entryValue}>{entry.supplier}</Text>
                <Text style={styles.entryLabel}>{isAr ? "المورد:" : "Supplier:"}</Text>
              </View>
              <View style={styles.entryRow}>
                <Text style={styles.entryValue}>{entry.quantity} {entry.unit}</Text>
                <Text style={styles.entryLabel}>{isAr ? "الكمية:" : "Quantity:"}</Text>
              </View>
              <View style={styles.entryRow}>
                <Text style={styles.entryValue}>{entry.receiverName}</Text>
                <Text style={styles.entryLabel}>{isAr ? "المستلم:" : "Receiver:"}</Text>
              </View>
              {entry.documentAttached && (
                <View style={styles.entryRow}>
                  <Text style={[styles.entryValue, { color: "#3b82f6" }]}>{isAr ? "✓ مرفق" : "✓ Attached"}</Text>
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
      <View style={[styles.header, { backgroundColor: "#3b82f6" }]}>
        <TouchableOpacity onPress={() => { resetForm(); setShowForm(true); }} style={styles.headerBtn}>
          <MaterialIcons name="add" size={24} color="white" />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={styles.headerTitle}>{isAr ? "مستودع المواد الخام" : "Raw Materials Warehouse"}</Text>
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
  chip: { borderWidth: 1.5, borderColor: "#3b82f6", borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  chipActive: { backgroundColor: "#3b82f6" },
  chipText: { color: "#3b82f6", fontWeight: "600", fontSize: 13 },
  chipTextActive: { color: "white" },
  attachBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1.5, borderColor: "#3b82f6", borderRadius: 12, padding: 12, marginTop: 16 },
  attachBtnActive: { backgroundColor: "#3b82f6" },
  attachText: { color: "#3b82f6", fontWeight: "600", fontSize: 13 },
  buttonRow: { flexDirection: "row", gap: 12, marginTop: 24 },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 12, paddingVertical: 14, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6 },
  cancelText: { color: "#11181C", fontWeight: "600", fontSize: 14 },
  editBtn: { flex: 1, backgroundColor: "#0a7ea4", borderRadius: 12, paddingVertical: 14, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6 },
  editBtnText: { color: "white", fontWeight: "600", fontSize: 14 },
  saveBtn: { flex: 1, backgroundColor: "#3b82f6", borderRadius: 12, paddingVertical: 14, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6 },
  saveBtnText: { color: "white", fontWeight: "600", fontSize: 14 },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 80 },
  emptyIcon: { backgroundColor: "#3b82f615", borderRadius: 40, padding: 20 },
  emptyTitle: { fontSize: 18, fontWeight: "bold", color: "#11181C", marginTop: 20 },
  emptySubtitle: { fontSize: 13, color: "#687076", marginTop: 8, textAlign: "center" },
  addBtnEmpty: { marginTop: 24, paddingHorizontal: 32, paddingVertical: 12, borderRadius: 12, flexDirection: "row", alignItems: "center", gap: 8 },
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
