import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { ScreenContainer } from "@/components/screen-container";
import { AttachmentPicker } from "@/components/attachment-picker";
import type { AttachmentFile } from "@/lib/services/attachment.service";
import { productsService } from "@/lib/services/api.service";
import { useAuth } from "@/lib/auth-context";

type Product = { id:number; barcode:string; name:string; size?:string|null; color?:string|null; weightGrams?:number|null; yarnDetails?:any; imageUrl?:string|null; attachments?:string[]|null };

export default function ProductsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<number | null>(null);
  const [files, setFiles] = useState<AttachmentFile[]>([]);
  const [name, setName] = useState(""); const [size, setSize] = useState(""); const [color, setColor] = useState("");
  const [weight, setWeight] = useState(""); const [yarn, setYarn] = useState(""); const [imageUrl, setImageUrl] = useState(""); const [attachment, setAttachment] = useState("");
  const load = useCallback(async () => { try { setItems((await productsService.list() as Product[]) || []); } catch (e:any) { Alert.alert("خطأ", e?.message || "تعذر تحميل المنتجات"); } finally { setLoading(false); } }, []);
  useEffect(() => { load(); }, [load]);
  const reset = () => { setEditing(null); setName(""); setSize(""); setColor(""); setWeight(""); setYarn(""); setImageUrl(""); setAttachment(""); setFiles([]); };
  const save = async () => {
    if (!name.trim()) return Alert.alert("تنبيه", "اكتب اسم المنتج");
    let yarnDetails:any = null; try { yarnDetails = yarn.trim() ? JSON.parse(yarn) : null; } catch { yarnDetails = yarn.trim() ? { description: yarn.trim() } : null; }
    const uploadedFiles = files.map((file) => file.uploadedUrl || file.uri).filter(Boolean);
    const firstImage = files.find((file) => file.type === "image");
    const data = { name:name.trim(), size:size.trim() || undefined, color:color.trim() || undefined, weightGrams:Math.max(0, Number(weight)||0), yarnDetails, imageUrl:imageUrl.trim() || firstImage?.uploadedUrl || firstImage?.uri || undefined, attachments:[...(attachment.trim() ? [attachment.trim()] : []), ...uploadedFiles] };
    try { if (editing) await productsService.update(editing, data); else await productsService.create({ ...data, createdBy:user?.id }); Alert.alert("تم", editing ? "تم تحديث المنتج" : "تم حفظ المنتج وإنشاء الباركود"); reset(); await load(); } catch (e:any) { Alert.alert("خطأ", e?.message || "تعذر حفظ المنتج"); }
  };
  const edit = (p:Product) => { setEditing(p.id); setName(p.name); setSize(p.size || ""); setColor(p.color || ""); setWeight(String(p.weightGrams || "")); setYarn(typeof p.yarnDetails === "string" ? p.yarnDetails : p.yarnDetails ? JSON.stringify(p.yarnDetails) : ""); setImageUrl(p.imageUrl || ""); setAttachment(p.attachments?.[0] || ""); };
  const remove = (p:Product) => Alert.alert("تأكيد الحذف", `حذف ${p.name} من دليل المنتجات؟`, [{ text:"إلغاء", style:"cancel" }, { text:"حذف", style:"destructive", onPress:async()=>{ await productsService.delete(p.id); await load(); } }]);
  return <ScreenContainer className="p-4"><ScrollView contentContainerStyle={styles.container}>
    <View style={styles.header}><Pressable onPress={() => router.back()} style={styles.back}><MaterialIcons name="arrow-forward" size={22} color="#fff" /></Pressable><View style={{flex:1}}><Text style={styles.title}>دليل المنتجات</Text><Text style={styles.subtitle}>تعريف مركزي للمنتجات والباركود والمكونات</Text></View><MaterialIcons name="inventory-2" size={32} color="#0a7ea4" /></View>
    <View style={styles.card}><Text style={styles.section}>{editing ? "تعديل بيانات المنتج" : "إضافة منتج جديد"}</Text><Text style={styles.label}>اسم المنتج *</Text><TextInput value={name} onChangeText={setName} style={styles.input} placeholder="مثال: ECO" />
      <View style={styles.row}><View style={styles.col}><Text style={styles.label}>المقاس</Text><TextInput value={size} onChangeText={setSize} style={styles.input} /></View><View style={styles.col}><Text style={styles.label}>اللون</Text><TextInput value={color} onChangeText={setColor} style={styles.input} /></View></View>
      <View style={styles.row}><View style={styles.col}><Text style={styles.label}>الوزن بالجرام</Text><TextInput value={weight} onChangeText={setWeight} keyboardType="numeric" style={styles.input} /></View><View style={styles.col}><Text style={styles.label}>الصورة (رابط)</Text><TextInput value={imageUrl} onChangeText={setImageUrl} style={styles.input} /></View></View>
      <Text style={styles.label}>خيوط التصنيع ونِسَبها (JSON أو وصف)</Text><TextInput value={yarn} onChangeText={setYarn} style={styles.input} placeholder='مثال: {"قطن":50,"نايلون":50}' />
      <Text style={styles.label}>مرفق المنتج (رابط اختياري)</Text><TextInput value={attachment} onChangeText={setAttachment} style={styles.input} />
      <AttachmentPicker attachments={files} onAttachmentsChange={setFiles} language="ar" maxAttachments={10} />
      <View style={styles.row}><Pressable onPress={save} style={styles.primary}><MaterialIcons name="save" size={19} color="#fff" /><Text style={styles.primaryText}>{editing ? "حفظ التعديل" : "حفظ وإنشاء باركود"}</Text></Pressable>{editing ? <Pressable onPress={reset} style={styles.secondary}><Text>إلغاء</Text></Pressable> : null}</View>
    </View>
    <View style={styles.card}><View style={styles.listHeader}><Text style={styles.section}>المنتجات المحفوظة ({items.length})</Text><Pressable onPress={load}><MaterialIcons name="refresh" size={22} color="#0a7ea4" /></Pressable></View>{loading ? <ActivityIndicator color="#0a7ea4" /> : items.length === 0 ? <Text style={styles.empty}>لا توجد منتجات محفوظة بعد</Text> : items.map(p => <View key={p.id} style={styles.item}><View style={styles.itemActions}><Pressable onPress={() => router.push({ pathname:"/barcode-labels", params:{ productName:p.name, color:p.color || "", barcode:p.barcode } } as any)}><MaterialIcons name="print" size={21} color="#0a7ea4" /></Pressable><Pressable onPress={() => edit(p)}><MaterialIcons name="edit" size={21} color="#f59e0b" /></Pressable><Pressable onPress={() => remove(p)}><MaterialIcons name="delete" size={21} color="#dc2626" /></Pressable></View><View style={{flex:1}}><Text style={styles.itemName}>{p.name} {p.size ? `• ${p.size}` : ""} {p.color ? `• ${p.color}` : ""}</Text><Text style={styles.barcode}>باركود: {p.barcode}</Text><Text style={styles.meta}>الوزن: {p.weightGrams || 0} جم</Text></View></View>)}</View>
  </ScrollView></ScreenContainer>;
}
const styles=StyleSheet.create({container:{gap:12,paddingBottom:30,maxWidth:900,width:"100%",alignSelf:"center"},header:{flexDirection:"row",alignItems:"center",gap:10},back:{backgroundColor:"#0a7ea4",padding:8,borderRadius:10},title:{fontSize:24,fontWeight:"800",textAlign:"right",color:"#11181C"},subtitle:{textAlign:"right",color:"#687076"},card:{backgroundColor:"#fff",borderWidth:1,borderColor:"#e1e6eb",borderRadius:16,padding:15,gap:7},section:{fontSize:18,fontWeight:"800",textAlign:"right",color:"#11181C"},label:{textAlign:"right",color:"#55616b",fontWeight:"700",marginTop:4},input:{borderWidth:1,borderColor:"#d5dbe1",borderRadius:9,padding:10,textAlign:"right",fontSize:15,color:"#11181C"},row:{flexDirection:"row",gap:9,alignItems:"center"},col:{flex:1},primary:{flex:1,backgroundColor:"#0a7ea4",padding:13,borderRadius:10,flexDirection:"row",justifyContent:"center",gap:7},primaryText:{color:"#fff",fontWeight:"800"},secondary:{padding:13,borderRadius:10,backgroundColor:"#eef1f3",alignItems:"center"},listHeader:{flexDirection:"row",justifyContent:"space-between",alignItems:"center"},empty:{textAlign:"right",color:"#687076",padding:14},item:{flexDirection:"row",gap:10,paddingVertical:12,borderTopWidth:1,borderTopColor:"#edf0f2",alignItems:"center"},itemActions:{flexDirection:"row",gap:14,alignItems:"center"},itemName:{textAlign:"right",fontWeight:"800",fontSize:16,color:"#11181C"},barcode:{textAlign:"right",color:"#0a7ea4",fontWeight:"700",marginTop:3},meta:{textAlign:"right",color:"#687076",fontSize:12,marginTop:2}});
