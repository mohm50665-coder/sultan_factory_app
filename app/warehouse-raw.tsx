import React, { useState, useEffect } from "react";
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
import AsyncStorage from "@react-native-async-storage/async-storage";

const DATA_ENTRY_NAMES = ["حيدر", "شميم", "غلام"];
const UNITS = ["طن", "كيلو", "غرام", "كرتون", "حبة"];

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

const STORAGE_KEY = "sultan_warehouse_raw";

const formatDate = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export default function WarehouseRawScreen() {
  const router = useRouter();
  const colors = useColors();
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

  useEffect(() => { loadEntries(); }, []);

  const loadEntries = async () => {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      if (data) setEntries(JSON.parse(data));
    } catch (e) { console.log(e); }
  };

  const saveEntries = async (newEntries: RawEntry[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newEntries));
      setEntries(newEntries);
    } catch (e) { console.log(e); }
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
    if (!dataEntryName) { Alert.alert("تنبيه", "يرجى اختيار اسم مدخل البيانات"); return; }
    if (!itemName) { Alert.alert("تنبيه", "يرجى إدخال اسم الصنف"); return; }

    const entry: RawEntry = {
      id: editingEntry?.id || Date.now().toString(),
      dataEntryName,
      entryDate,
      itemName,
      supplier: supplier || "-",
      quantity: quantity || "0",
      unit: unit || "كيلو",
      receiverName: receiverName || "-",
      documentAttached,
    };

    let newEntries: RawEntry[];
    if (editingEntry) {
      newEntries = entries.map((e) => (e.id === editingEntry.id ? entry : e));
    } else {
      newEntries = [entry, ...entries];
    }
    await saveEntries(newEntries);
    resetForm();
    setShowForm(false);
    Alert.alert("تم بنجاح ✓", editingEntry ? "تم تعديل البيانات" : "تم حفظ البيانات");
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
    if (Platform.OS === "web") {
      if (confirm("هل تريد حذف هذا السجل؟")) {
        saveEntries(entries.filter((e) => e.id !== entry.id));
      }
    } else {
      Alert.alert("تأكيد الحذف", "هل تريد حذف هذا السجل؟", [
        { text: "إلغاء", style: "cancel" },
        { text: "حذف", style: "destructive", onPress: () => saveEntries(entries.filter((e) => e.id !== entry.id)) },
      ]);
    }
  };

  const renderForm = () => (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
      <View style={styles.formCard}>
        <Text style={styles.formTitle}>
          {editingEntry ? "✏️ تعديل بيانات" : "➕ إدخال مواد خام"}
        </Text>

        {/* اسم مدخل البيانات */}
        <Text style={styles.label}>اسم مدخل البيانات</Text>
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

        {/* تاريخ الإدخال */}
        <Text style={styles.label}>تاريخ الإدخال</Text>
        <TextInput
          style={styles.input}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.muted}
          value={entryDate}
          onChangeText={setEntryDate}
        />

        {/* اسم الصنف */}
        <Text style={styles.label}>اسم الصنف</Text>
        <TextInput
          style={styles.input}
          placeholder="مثال: خيوط بوليستر"
          placeholderTextColor={colors.muted}
          value={itemName}
          onChangeText={setItemName}
        />

        {/* المورد */}
        <Text style={styles.label}>المورد</Text>
        <TextInput
          style={styles.input}
          placeholder="اسم المورد"
          placeholderTextColor={colors.muted}
          value={supplier}
          onChangeText={setSupplier}
        />

        {/* الكمية */}
        <Text style={styles.label}>الكمية</Text>
        <TextInput
          style={styles.input}
          placeholder="0"
          placeholderTextColor={colors.muted}
          value={quantity}
          onChangeText={setQuantity}
          keyboardType="numeric"
        />

        {/* الوحدة */}
        <Text style={styles.label}>الوحدة</Text>
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

        {/* اسم الشخص المستلم */}
        <Text style={styles.label}>اسم الشخص المستلم</Text>
        <TextInput
          style={styles.input}
          placeholder="اسم المستلم"
          placeholderTextColor={colors.muted}
          value={receiverName}
          onChangeText={setReceiverName}
        />

        {/* إرفاق مستند */}
        <TouchableOpacity
          onPress={() => setDocumentAttached(!documentAttached)}
          style={[styles.attachBtn, documentAttached && styles.attachBtnActive]}
        >
          <Text style={[styles.attachText, documentAttached && { color: "white" }]}>
            {documentAttached ? "✓ تم إرفاق المستند" : "📎 إرفاق مستند الإدخال"}
          </Text>
          <MaterialIcons name={documentAttached ? "check-circle" : "attach-file"} size={20} color={documentAttached ? "white" : "#3b82f6"} />
        </TouchableOpacity>

        {/* أزرار */}
        <View style={styles.buttonRow}>
          <TouchableOpacity onPress={() => { setShowForm(false); resetForm(); }} style={styles.cancelBtn}>
            <Text style={styles.cancelText}>إلغاء</Text>
            <MaterialIcons name="close" size={18} color="#11181C" />
          </TouchableOpacity>
          {editingEntry && (
            <TouchableOpacity onPress={handleSave} style={styles.editBtn}>
              <Text style={styles.editBtnText}>تعديل</Text>
              <MaterialIcons name="edit" size={18} color="white" />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={handleSave} style={styles.saveBtn}>
            <Text style={styles.saveBtnText}>حفظ</Text>
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
          <Text style={styles.emptyTitle}>مستودع المواد الخام</Text>
          <Text style={styles.emptySubtitle}>لا توجد بيانات بعد. اضغط (+) لإضافة إدخال جديد.</Text>
          <TouchableOpacity onPress={() => { resetForm(); setShowForm(true); }} style={[styles.addBtnEmpty, { backgroundColor: "#3b82f6" }]}>
            <Text style={{ color: "white", fontWeight: "600" }}>إضافة إدخال</Text>
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
                <Text style={styles.entryLabel}>مدخل البيانات:</Text>
              </View>
              <View style={styles.entryRow}>
                <Text style={styles.entryValue}>{entry.itemName}</Text>
                <Text style={styles.entryLabel}>الصنف:</Text>
              </View>
              <View style={styles.entryRow}>
                <Text style={styles.entryValue}>{entry.supplier}</Text>
                <Text style={styles.entryLabel}>المورد:</Text>
              </View>
              <View style={styles.entryRow}>
                <Text style={styles.entryValue}>{entry.quantity} {entry.unit}</Text>
                <Text style={styles.entryLabel}>الكمية:</Text>
              </View>
              <View style={styles.entryRow}>
                <Text style={styles.entryValue}>{entry.receiverName}</Text>
                <Text style={styles.entryLabel}>المستلم:</Text>
              </View>
              {entry.documentAttached && (
                <View style={styles.entryRow}>
                  <Text style={[styles.entryValue, { color: "#3b82f6" }]}>✓ مرفق</Text>
                  <Text style={styles.entryLabel}>المستند:</Text>
                </View>
              )}
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );

  return (
    <ScreenContainer className="bg-background">
      <View style={[styles.header, { backgroundColor: "#3b82f6" }]}>
        <TouchableOpacity onPress={() => { resetForm(); setShowForm(true); }} style={styles.headerBtn}>
          <MaterialIcons name="add" size={24} color="white" />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={styles.headerTitle}>مستودع المواد الخام</Text>
          <Text style={styles.headerSub}>{entries.length} سجل</Text>
        </View>
        <TouchableOpacity onPress={() => router.replace("/(tabs)")} style={styles.headerBtn}>
          <MaterialIcons name="arrow-forward" size={24} color="white" />
        </TouchableOpacity>
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
