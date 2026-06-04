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

const DATA_ENTRY_NAMES = ["حيدر", "شميم", "غلام"];
const PRODUCT_TYPES = ["إنتاج تام", "نخب ثاني"];
const DOCUMENT_TYPES = ["فاتورة مرتجعات", "نموذج إدخال إنتاج تام"];

interface FinishedEntry {
  id: string;
  dataEntryName: string;
  entryDate: string;
  productType: string;
  documentType: string;
  orderNumber: string;
  orderDate: string;
  totalQuantity: string;
  firstGradeQty: string;
  secondGradeQty: string;
  documentAttached: boolean;
}

const SECTION_KEY = "finished";

const formatDate = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export default function WarehouseFinishedScreen() {
  const router = useRouter();
  const colors = useColors();
  const { user } = useAuth();
  const [entries, setEntries] = useState<FinishedEntry[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<FinishedEntry | null>(null);

  const [dataEntryName, setDataEntryName] = useState("");
  const [entryDate, setEntryDate] = useState(formatDate(new Date()));
  const [productType, setProductType] = useState("");
  const [documentType, setDocumentType] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [orderDate, setOrderDate] = useState(formatDate(new Date()));
  const [totalQuantity, setTotalQuantity] = useState("");
  const [firstGradeQty, setFirstGradeQty] = useState("");
  const [secondGradeQty, setSecondGradeQty] = useState("");

  const [documentAttached, setDocumentAttached] = useState(false);

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
    setProductType("");
    setDocumentType("");
    setOrderNumber("");
    setOrderDate(formatDate(new Date()));
    setTotalQuantity("");
    setFirstGradeQty("");
    setSecondGradeQty("");

    setDocumentAttached(false);
    setEditingEntry(null);
  };

  const handleSave = async () => {
    if (!dataEntryName) { Alert.alert("تنبيه", "يرجى اختيار اسم مدخل البيانات"); return; }
    if (!productType) { Alert.alert("تنبيه", "يرجى اختيار نوع الصنف"); return; }

    const entry: FinishedEntry = {
      id: editingEntry?.id || Date.now().toString(),
      dataEntryName,
      entryDate,
      productType,
      documentType: documentType || "-",
      orderNumber: orderNumber || "-",
      orderDate,
      totalQuantity: totalQuantity || "0",
      firstGradeQty: firstGradeQty || "0",
      secondGradeQty: secondGradeQty || "0",
      documentAttached,
    };

    let newEntries: FinishedEntry[];
    if (editingEntry) {
      newEntries = entries.map((e) => (e.id === editingEntry.id ? entry : e));
    } else {
      newEntries = [entry, ...entries];
    }
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
      Alert.alert("تم بنجاح ✓", editingEntry ? "تم تعديل البيانات" : "تم حفظ البيانات");
    } catch (e) {
      Alert.alert("خطأ", "فشل حفظ البيانات");
    }
  };

  const handleEdit = (entry: FinishedEntry) => {
    setDataEntryName(entry.dataEntryName);
    setEntryDate(entry.entryDate);
    setProductType(entry.productType);
    setDocumentType(entry.documentType || "");
    setOrderNumber(entry.orderNumber);
    setOrderDate(entry.orderDate);
    setTotalQuantity(entry.totalQuantity);
    setFirstGradeQty(entry.firstGradeQty);
    setSecondGradeQty(entry.secondGradeQty);

    setDocumentAttached(entry.documentAttached);
    setEditingEntry(entry);
    setShowForm(true);
  };

  const handleDelete = (entry: FinishedEntry) => {
    const doDelete = async () => {
      try {
        await warehouseEntriesService.delete(parseInt(entry.id));
        await loadEntries();
      } catch (e) { console.log(e); }
    };
    if (Platform.OS === "web") {
      if (confirm("هل تريد حذف هذا السجل؟")) {
        doDelete();
      }
    } else {
      Alert.alert("تأكيد الحذف", "هل تريد حذف هذا السجل؟", [
        { text: "إلغاء", style: "cancel" },
        { text: "حذف", style: "destructive", onPress: doDelete },
      ]);
    }
  };

  const renderForm = () => (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
      <View style={styles.formCard}>
        <Text style={styles.formTitle}>
          {editingEntry ? "✏️ تعديل بيانات" : "➕ إدخال إنتاج تام"}
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

        {/* نوع الصنف */}
        <Text style={styles.label}>نوع الصنف</Text>
        <View style={styles.chipRow}>
          {PRODUCT_TYPES.map((type) => (
            <TouchableOpacity
              key={type}
              onPress={() => setProductType(type)}
              style={[styles.chip, productType === type && styles.chipActive]}
            >
              <Text style={[styles.chipText, productType === type && styles.chipTextActive]}>{type}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* نوع المستند */}
        <Text style={styles.label}>نوع المستند</Text>
        <View style={styles.chipRow}>
          {DOCUMENT_TYPES.map((type) => (
            <TouchableOpacity
              key={type}
              onPress={() => setDocumentType(type)}
              style={[styles.chip, documentType === type && styles.chipActive]}
            >
              <Text style={[styles.chipText, documentType === type && styles.chipTextActive]}>{type}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* رقم مستند الإدخال */}
        <Text style={styles.label}>رقم مستند الإدخال</Text>
        <TextInput
          style={styles.input}
          placeholder="رقم المستند"
          placeholderTextColor={colors.muted}
          value={orderNumber}
          onChangeText={setOrderNumber}
        />

        {/* تاريخ المستند */}
        <Text style={styles.label}>تاريخ المستند</Text>
        <TextInput
          style={styles.input}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.muted}
          value={orderDate}
          onChangeText={setOrderDate}
        />

        {/* الكمية المدخلة */}
        <Text style={styles.label}>الكمية المدخلة (إجمالي)</Text>
        <TextInput
          style={styles.input}
          placeholder="0"
          placeholderTextColor={colors.muted}
          value={totalQuantity}
          onChangeText={setTotalQuantity}
          keyboardType="numeric"
        />

        {/* نخب أول */}
        <Text style={styles.label}>كمية النخب الأول</Text>
        <TextInput
          style={styles.input}
          placeholder="0"
          placeholderTextColor={colors.muted}
          value={firstGradeQty}
          onChangeText={setFirstGradeQty}
          keyboardType="numeric"
        />

        {/* نخب ثاني */}
        <Text style={styles.label}>كمية النخب الثاني</Text>
        <TextInput
          style={styles.input}
          placeholder="0"
          placeholderTextColor={colors.muted}
          value={secondGradeQty}
          onChangeText={setSecondGradeQty}
          keyboardType="numeric"
        />


        {/* إرفاق مستند */}
        <TouchableOpacity
          onPress={() => setDocumentAttached(!documentAttached)}
          style={[styles.attachBtn, documentAttached && styles.attachBtnActive]}
        >
          <Text style={[styles.attachText, documentAttached && { color: "white" }]}>
            {documentAttached ? "✓ تم إرفاق المستند" : "📎 إرفاق مستند الإدخال"}
          </Text>
          <MaterialIcons name={documentAttached ? "check-circle" : "attach-file"} size={20} color={documentAttached ? "white" : "#16a34a"} />
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
            <MaterialIcons name="inventory" size={48} color="#16a34a" />
          </View>
          <Text style={styles.emptyTitle}>مستودع الإنتاج التام</Text>
          <Text style={styles.emptySubtitle}>لا توجد بيانات بعد. اضغط (+) لإضافة إدخال جديد.</Text>
          <TouchableOpacity onPress={() => { resetForm(); setShowForm(true); }} style={styles.addBtnEmpty}>
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
                <Text style={styles.entryDate}>{entry.entryDate}</Text>
                <MaterialIcons name="calendar-today" size={14} color="#16a34a" />
              </View>
            </View>
            <View style={styles.entryBody}>
              <View style={styles.entryRow}>
                <Text style={styles.entryValue}>{entry.dataEntryName}</Text>
                <Text style={styles.entryLabel}>مدخل البيانات:</Text>
              </View>
              <View style={styles.entryRow}>
                <Text style={styles.entryValue}>{entry.productType}</Text>
                <Text style={styles.entryLabel}>نوع الصنف:</Text>
              </View>
              <View style={styles.entryRow}>
                <Text style={styles.entryValue}>{entry.documentType || "-"}</Text>
                <Text style={styles.entryLabel}>نوع المستند:</Text>
              </View>
              <View style={styles.entryRow}>
                <Text style={styles.entryValue}>{entry.orderNumber} ({entry.orderDate})</Text>
                <Text style={styles.entryLabel}>رقم المستند:</Text>
              </View>
              <View style={styles.entryRow}>
                <Text style={styles.entryValue}>{entry.totalQuantity}</Text>
                <Text style={styles.entryLabel}>الكمية الإجمالية:</Text>
              </View>
              <View style={styles.entryRow}>
                <Text style={styles.entryValue}>نخب أول: {entry.firstGradeQty} | نخب ثاني: {entry.secondGradeQty}</Text>
                <Text style={styles.entryLabel}>التفاصيل:</Text>
              </View>

              {entry.documentAttached && (
                <View style={styles.entryRow}>
                  <Text style={[styles.entryValue, { color: "#16a34a" }]}>✓ مرفق</Text>
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
    <ScreenContainer style={{ backgroundColor: colors.background }}>
      <View style={[styles.header, { backgroundColor: "#16a34a" }]}>
        <TouchableOpacity onPress={() => { resetForm(); setShowForm(true); }} style={styles.headerBtn}>
          <MaterialIcons name="add" size={24} color="white" />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={styles.headerTitle}>مستودع الإنتاج التام</Text>
          <Text style={styles.headerSub}>{entries.length} سجل</Text>
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
  chip: { borderWidth: 1.5, borderColor: "#16a34a", borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  chipActive: { backgroundColor: "#16a34a" },
  chipText: { color: "#16a34a", fontWeight: "600", fontSize: 13 },
  chipTextActive: { color: "white" },
  attachBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1.5, borderColor: "#16a34a", borderRadius: 12, padding: 12, marginTop: 16 },
  attachBtnActive: { backgroundColor: "#16a34a" },
  attachText: { color: "#16a34a", fontWeight: "600", fontSize: 13 },
  buttonRow: { flexDirection: "row", gap: 12, marginTop: 24 },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 12, paddingVertical: 14, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6 },
  cancelText: { color: "#11181C", fontWeight: "600", fontSize: 14 },
  editBtn: { flex: 1, backgroundColor: "#0a7ea4", borderRadius: 12, paddingVertical: 14, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6 },
  editBtnText: { color: "white", fontWeight: "600", fontSize: 14 },
  saveBtn: { flex: 1, backgroundColor: "#16a34a", borderRadius: 12, paddingVertical: 14, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6 },
  saveBtnText: { color: "white", fontWeight: "600", fontSize: 14 },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 80 },
  emptyIcon: { backgroundColor: "#16a34a15", borderRadius: 40, padding: 20 },
  emptyTitle: { fontSize: 18, fontWeight: "bold", color: "#11181C", marginTop: 20 },
  emptySubtitle: { fontSize: 13, color: "#687076", marginTop: 8, textAlign: "center" },
  addBtnEmpty: { backgroundColor: "#16a34a", marginTop: 24, paddingHorizontal: 32, paddingVertical: 12, borderRadius: 12, flexDirection: "row", alignItems: "center", gap: 8 },
  entryCard: { backgroundColor: "white", borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "#E5E7EB" },
  entryHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  entryDate: { fontSize: 13, fontWeight: "600", color: "#11181C" },
  actionBtn: { backgroundColor: "#0a7ea415", borderRadius: 16, padding: 6 },
  deleteBtn: { backgroundColor: "#ef444415", borderRadius: 16, padding: 6 },
  entryBody: { backgroundColor: "#f5f5f5", borderRadius: 10, padding: 12 },
  entryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 4 },
  entryLabel: { fontSize: 12, color: "#687076", fontWeight: "600" },
  entryValue: { fontSize: 12, color: "#11181C", fontWeight: "500" },
});
