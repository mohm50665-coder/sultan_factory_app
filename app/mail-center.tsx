import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Modal, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { ScreenContainer } from "@/components/screen-container";
import { BackButton } from "@/components/back-button";
import { useColors } from "@/hooks/use-colors";
import { useLanguage } from "@/lib/language-context";
import { useAuth } from "@/lib/auth-context";
import { adminService, internalMessagesService } from "@/lib/services/api.service";

type Message = { id: number; subject: string; body: string; senderId: number; recipientUserId?: number | null; recipientDepartment?: string | null; relatedType?: string | null; relatedId?: number | null; attachments?: string[] | null; readAt?: string | null; dueAt?: string | null; createdAt: string };

type FormState = { subject: string; body: string; recipientUserId: string; recipientDepartment: string; relatedType: string; relatedId: string; attachments: string; dueAt: string };
const emptyForm: FormState = { subject: "", body: "", recipientUserId: "", recipientDepartment: "", relatedType: "", relatedId: "", attachments: "", dueAt: "" };

export default function MailCenterScreen() {
  const colors = useColors();
  const { language } = useLanguage();
  const { user } = useAuth();
  const router = useRouter();
  const isAr = language === "ar";
  const [tab, setTab] = useState<"inbox" | "sent">("inbox");
  const [inbox, setInbox] = useState<Message[]>([]);
  const [sent, setSent] = useState<Message[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [showCompose, setShowCompose] = useState(false);
  const [selected, setSelected] = useState<Message | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) return;
    try {
      const [inboxResult, sentResult, usersResult] = await Promise.all([internalMessagesService.inbox(user.id), internalMessagesService.sent(user.id), adminService.getAllUsers()]);
      setInbox(Array.isArray(inboxResult) ? inboxResult : []);
      setSent(Array.isArray(sentResult) ? sentResult : []);
      setUsers(Array.isArray(usersResult) ? usersResult : []);
    } catch (error) {
      Alert.alert(isAr ? "تعذر تحميل البريد" : "Could not load mail", error instanceof Error ? error.message : "Unexpected error");
    }
  }, [user?.id, isAr]);
  useEffect(() => { load(); }, [load]);

  const departments = useMemo(() => Array.from(new Set(users.map((item) => item.department).filter(Boolean))), [users]);
  const activeMessages = tab === "inbox" ? inbox : sent;
  const unreadCount = inbox.filter((item) => !item.readAt).length;
  const senderName = (id: number) => users.find((item) => item.id === id)?.name || (isAr ? `مستخدم رقم ${id}` : `User ${id}`);

  const openMessage = async (message: Message) => {
    setSelected(message);
    if (tab === "inbox" && !message.readAt && user?.id) {
      try { await internalMessagesService.markRead(message.id, user.id); setInbox((items) => items.map((item) => item.id === message.id ? { ...item, readAt: new Date().toISOString() } : item)); } catch { /* keep message visible if read receipt fails */ }
    }
  };
  const send = async () => {
    if (!user?.id || !form.subject.trim() || !form.body.trim() || (!form.recipientUserId && !form.recipientDepartment)) {
      Alert.alert(isAr ? "بيانات ناقصة" : "Missing data", isAr ? "أدخل العنوان والنص واختر موظفاً أو إدارة." : "Enter subject, body, and select an employee or department.");
      return;
    }
    try {
      setIsSaving(true);
      await internalMessagesService.create({ subject: form.subject.trim(), body: form.body.trim(), senderId: user.id, recipientUserId: form.recipientUserId ? Number(form.recipientUserId) : undefined, recipientDepartment: form.recipientDepartment || undefined, relatedType: form.relatedType.trim() || undefined, relatedId: form.relatedId ? Number(form.relatedId) : undefined, attachments: form.attachments.split(",").map((item) => item.trim()).filter(Boolean), dueAt: form.dueAt.trim() || undefined });
      setForm(emptyForm); setShowCompose(false); await load();
      Alert.alert(isAr ? "تم إرسال الرسالة" : "Message sent", isAr ? "تم حفظ الرسالة وإرسالها للجهة المحددة." : "The message was saved and sent to the selected recipient.");
    } catch (error) { Alert.alert(isAr ? "تعذر الإرسال" : "Could not send", error instanceof Error ? error.message : "Unexpected error"); } finally { setIsSaving(false); }
  };
  const printMessage = (message: Message) => {
    if (Platform.OS !== "web" || typeof window === "undefined") { Alert.alert(isAr ? "الطباعة من الويب" : "Web printing", isAr ? "افتح نسخة الويب لطباعة الرسالة." : "Open the web version to print the message."); return; }
    const popup = window.open("", "_blank", "width=900,height=700"); if (!popup) return;
    const safe = (value: string) => value.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] || c));
    popup.document.write(`<html dir="rtl"><head><meta charset="utf-8"><title>${safe(message.subject)}</title><style>body{font-family:Arial;padding:30px}h1{color:#0a7ea4}p{white-space:pre-wrap;line-height:1.8}</style></head><body><h1>${safe(message.subject)}</h1><p>${safe(message.body)}</p><hr><p>${isAr ? "المرسل" : "Sender"}: ${safe(senderName(message.senderId))}<br>${isAr ? "التاريخ" : "Date"}: ${safe(String(message.createdAt))}</p><script>window.onload=()=>window.print()</script></body></html>`); popup.document.close();
  };
  const field = (key: keyof FormState, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const replyTo = (message: Message) => {
    setForm({ ...emptyForm, subject: `${isAr ? "رد: " : "Re: "}${message.subject}`, recipientUserId: String(message.senderId) });
    setSelected(null);
    setShowCompose(true);
  };

  return <ScreenContainer edges={["top", "left", "right", "bottom"]}>
    <View style={{ paddingHorizontal: 16, paddingTop: 12, flexDirection: "row", alignItems: "center" }}><BackButton /><Text style={{ flex: 1, textAlign: "right", color: colors.foreground, fontSize: 20, fontWeight: "800" }}>{isAr ? "البريد والمراسلات" : "Mail & Correspondence"}</Text><MaterialIcons name="mail" size={26} color={colors.primary} /></View>
    <View style={{ margin: 16, backgroundColor: "#e0f2fe", borderRadius: 12, padding: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}><View><Text style={{ color: "#0369a1", fontSize: 24, fontWeight: "900" }}>{unreadCount}</Text><Text style={{ color: "#075985", fontSize: 11 }}>{isAr ? "رسائل غير مقروءة" : "Unread messages"}</Text></View><Text style={{ color: "#075985", fontWeight: "800", textAlign: "right" }}>{isAr ? "مركز المراسلات الداخلي" : "Internal correspondence center"}</Text></View>
    <View style={{ flexDirection: "row", marginHorizontal: 16, gap: 8 }}><TouchableOpacity onPress={() => setTab("inbox")} style={{ flex: 1, padding: 11, borderRadius: 9, alignItems: "center", backgroundColor: tab === "inbox" ? colors.primary : colors.surface }}><Text style={{ color: tab === "inbox" ? "#fff" : colors.foreground, fontWeight: "800" }}>{isAr ? "الوارد" : "Inbox"}</Text></TouchableOpacity><TouchableOpacity onPress={() => setTab("sent")} style={{ flex: 1, padding: 11, borderRadius: 9, alignItems: "center", backgroundColor: tab === "sent" ? colors.primary : colors.surface }}><Text style={{ color: tab === "sent" ? "#fff" : colors.foreground, fontWeight: "800" }}>{isAr ? "الصادر" : "Sent"}</Text></TouchableOpacity></View>
    <TouchableOpacity onPress={() => setShowCompose(true)} style={{ margin: 16, backgroundColor: "#16a34a", borderRadius: 10, padding: 12, alignItems: "center" }}><Text style={{ color: "#fff", fontWeight: "900" }}>{isAr ? "إنشاء رسالة جديدة" : "Compose new message"}</Text></TouchableOpacity>
    <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 30, gap: 9 }}>{activeMessages.length === 0 ? <Text style={{ color: colors.muted, textAlign: "center", padding: 30 }}>{isAr ? "لا توجد رسائل" : "No messages"}</Text> : activeMessages.map((message) => <TouchableOpacity key={message.id} onPress={() => openMessage(message)} style={{ backgroundColor: colors.surface, borderRadius: 11, padding: 13, borderWidth: 1, borderColor: message.readAt || tab === "sent" ? colors.border : colors.primary }}><View style={{ flexDirection: "row", justifyContent: "space-between" }}><Text style={{ color: colors.muted, fontSize: 11 }}>{new Date(message.createdAt).toLocaleString(isAr ? "ar-SA" : "en-US")}</Text><Text style={{ color: colors.foreground, fontWeight: message.readAt || tab === "sent" ? "600" : "900", textAlign: "right", flex: 1 }}>{message.subject}</Text></View><Text numberOfLines={2} style={{ color: colors.muted, textAlign: "right", marginTop: 7 }}>{message.body}</Text><Text style={{ color: colors.primary, fontSize: 11, textAlign: "right", marginTop: 7 }}>{tab === "inbox" ? (isAr ? `من: ${senderName(message.senderId)}` : `From: ${senderName(message.senderId)}`) : (isAr ? `إلى: ${message.recipientDepartment || senderName(message.recipientUserId || 0)}` : `To: ${message.recipientDepartment || senderName(message.recipientUserId || 0)}`)}</Text></TouchableOpacity>)}</ScrollView>

    <Modal visible={showCompose} animationType="slide" transparent><View style={{ flex: 1, backgroundColor: colors.background, paddingTop: 42 }}><View style={{ padding: 16, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: colors.border }}><TouchableOpacity onPress={() => setShowCompose(false)}><MaterialIcons name="close" size={25} color={colors.muted} /></TouchableOpacity><Text style={{ flex: 1, textAlign: "right", color: colors.foreground, fontWeight: "900", fontSize: 18 }}>{isAr ? "رسالة جديدة" : "New message"}</Text></View><ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}><TextInput value={form.subject} onChangeText={(v) => field("subject", v)} placeholder={isAr ? "عنوان الرسالة" : "Subject"} placeholderTextColor={colors.muted} style={{ color: colors.foreground, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 11, textAlign: "right" }} /><TextInput value={form.body} onChangeText={(v) => field("body", v)} placeholder={isAr ? "نص الرسالة" : "Message body"} placeholderTextColor={colors.muted} multiline style={{ color: colors.foreground, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 11, textAlign: "right", minHeight: 120 }} /><Text style={{ color: colors.foreground, textAlign: "right", fontWeight: "800" }}>{isAr ? "اختر الموظف المستلم" : "Select employee"}</Text><ScrollView horizontal contentContainerStyle={{ gap: 6 }}><TouchableOpacity onPress={() => field("recipientUserId", "")} style={{ padding: 8, borderWidth: 1, borderColor: !form.recipientUserId ? colors.primary : colors.border, borderRadius: 7 }}><Text style={{ color: colors.foreground }}>{isAr ? "بدون" : "None"}</Text></TouchableOpacity>{users.map((item) => <TouchableOpacity key={item.id} onPress={() => field("recipientUserId", String(item.id))} style={{ padding: 8, borderWidth: 1, borderColor: form.recipientUserId === String(item.id) ? colors.primary : colors.border, borderRadius: 7 }}><Text style={{ color: colors.foreground, fontSize: 11 }}>{item.name}</Text></TouchableOpacity>)}</ScrollView><Text style={{ color: colors.foreground, textAlign: "right", fontWeight: "800" }}>{isAr ? "أو اختر الإدارة" : "Or select department"}</Text><ScrollView horizontal contentContainerStyle={{ gap: 6 }}>{departments.map((department) => <TouchableOpacity key={department} onPress={() => field("recipientDepartment", department)} style={{ padding: 8, borderWidth: 1, borderColor: form.recipientDepartment === department ? colors.primary : colors.border, borderRadius: 7 }}><Text style={{ color: colors.foreground, fontSize: 11 }}>{department}</Text></TouchableOpacity>)}</ScrollView><TextInput value={form.relatedType} onChangeText={(v) => field("relatedType", v)} placeholder={isAr ? "نوع السجل المرتبط: تقرير / طلب / مهمة" : "Related record type: report / request / task"} placeholderTextColor={colors.muted} style={{ color: colors.foreground, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10, textAlign: "right" }} /><TextInput value={form.relatedId} onChangeText={(v) => field("relatedId", v)} keyboardType="numeric" placeholder={isAr ? "رقم السجل المرتبط (اختياري)" : "Related record ID (optional)"} placeholderTextColor={colors.muted} style={{ color: colors.foreground, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10, textAlign: "right" }} /><TextInput value={form.attachments} onChangeText={(v) => field("attachments", v)} placeholder={isAr ? "روابط المرفقات مفصولة بفاصلة" : "Attachment URLs separated by commas"} placeholderTextColor={colors.muted} style={{ color: colors.foreground, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10, textAlign: "right" }} /><TextInput value={form.dueAt} onChangeText={(v) => field("dueAt", v)} placeholder={isAr ? "آخر موعد للرد (YYYY-MM-DD)" : "Response due date (YYYY-MM-DD)"} placeholderTextColor={colors.muted} style={{ color: colors.foreground, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10, textAlign: "right" }} /><TouchableOpacity disabled={isSaving} onPress={send} style={{ backgroundColor: "#16a34a", borderRadius: 9, padding: 13, alignItems: "center", marginTop: 7 }}><Text style={{ color: "#fff", fontWeight: "900" }}>{isSaving ? (isAr ? "جارٍ الإرسال..." : "Sending...") : (isAr ? "إرسال الرسالة" : "Send message")}</Text></TouchableOpacity></ScrollView></View></Modal>

    <Modal visible={Boolean(selected)} animationType="slide" transparent><View style={{ flex: 1, backgroundColor: colors.background, paddingTop: 42 }}><View style={{ padding: 16, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: colors.border }}><TouchableOpacity onPress={() => setSelected(null)}><MaterialIcons name="close" size={25} color={colors.muted} /></TouchableOpacity><Text style={{ flex: 1, textAlign: "right", color: colors.foreground, fontWeight: "900", fontSize: 18 }}>{isAr ? "تفاصيل الرسالة" : "Message details"}</Text></View>{selected && <ScrollView contentContainerStyle={{ padding: 16, gap: 11 }}><Text style={{ color: colors.foreground, fontSize: 20, fontWeight: "900", textAlign: "right" }}>{selected.subject}</Text><Text style={{ color: colors.muted, textAlign: "right" }}>{isAr ? `المرسل: ${senderName(selected.senderId)}` : `Sender: ${senderName(selected.senderId)}`}</Text><Text style={{ color: colors.foreground, lineHeight: 25, textAlign: "right" }}>{selected.body}</Text>{selected.attachments?.length ? <Text style={{ color: colors.primary, textAlign: "right" }}>{isAr ? `المرفقات: ${selected.attachments.join("، ")}` : `Attachments: ${selected.attachments.join(", ")}`}</Text> : null}<View style={{ flexDirection: "row", gap: 8 }}><TouchableOpacity onPress={() => replyTo(selected)} style={{ flex: 1, backgroundColor: "#dcfce7", borderRadius: 9, padding: 12, alignItems: "center" }}><Text style={{ color: "#166534", fontWeight: "900" }}>{isAr ? "رد" : "Reply"}</Text></TouchableOpacity><TouchableOpacity onPress={() => printMessage(selected)} style={{ flex: 1, backgroundColor: "#e0e7ff", borderRadius: 9, padding: 12, alignItems: "center" }}><Text style={{ color: "#3730a3", fontWeight: "900" }}>{isAr ? "طباعة الرسالة" : "Print message"}</Text></TouchableOpacity></View></ScrollView>}</View></Modal>
  </ScreenContainer>;
}
