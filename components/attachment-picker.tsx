import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  Alert,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useColors } from "@/hooks/use-colors";
import { attachmentService, AttachmentFile } from "@/lib/services/attachment.service";

interface AttachmentPickerProps {
  attachments: AttachmentFile[];
  onAttachmentsChange: (attachments: AttachmentFile[]) => void;
  language?: "ar" | "en";
  maxAttachments?: number;
}

export function AttachmentPicker({
  attachments,
  onAttachmentsChange,
  language = "ar",
  maxAttachments = 10,
}: AttachmentPickerProps) {
  const colors = useColors();
  const isAr = language === "ar";
  const [uploading, setUploading] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [previewFile, setPreviewFile] = useState<AttachmentFile | null>(null);

  const handleAddAttachment = async (type: "camera" | "gallery" | "pdf") => {
    setShowOptions(false);

    if (attachments.length >= maxAttachments) {
      Alert.alert(
        isAr ? "تنبيه" : "Warning",
        isAr ? `الحد الأقصى ${maxAttachments} مرفقات` : `Maximum ${maxAttachments} attachments`
      );
      return;
    }

    setUploading(true);
    try {
      let file: AttachmentFile | null = null;

      switch (type) {
        case "camera":
          file = await attachmentService.takePhoto();
          break;
        case "gallery":
          file = await attachmentService.pickImage();
          break;
        case "pdf":
          file = await attachmentService.pickPDF();
          break;
      }

      if (file) {
        // رفع المرفق إلى السيرفر
        const uploadedUrl = await attachmentService.uploadAttachment(file);
        if (uploadedUrl) {
          file.uploadedUrl = uploadedUrl;
        }
        onAttachmentsChange([...attachments, file]);
      }
    } catch (error: any) {
      Alert.alert(
        isAr ? "خطأ" : "Error",
        isAr ? "فشل إضافة المرفق" : "Failed to add attachment"
      );
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveAttachment = (index: number) => {
    Alert.alert(
      isAr ? "تأكيد الحذف" : "Confirm Delete",
      isAr ? "هل تريد حذف هذا المرفق؟" : "Do you want to delete this attachment?",
      [
        { text: isAr ? "إلغاء" : "Cancel", style: "cancel" },
        {
          text: isAr ? "حذف" : "Delete",
          style: "destructive",
          onPress: () => {
            const newAttachments = [...attachments];
            newAttachments.splice(index, 1);
            onAttachmentsChange(newAttachments);
          },
        },
      ]
    );
  };

  const renderAttachmentItem = ({ item, index }: { item: AttachmentFile; index: number }) => (
    <TouchableOpacity
      onPress={() => setPreviewFile(item)}
      style={[styles.attachmentItem, { borderColor: colors.border }]}
    >
      {item.type === "image" ? (
        <Image
          source={{ uri: item.uri }}
          style={styles.thumbnail}
          contentFit="cover"
        />
      ) : (
        <View style={[styles.pdfIcon, { backgroundColor: colors.error + "19" }]}>
          <MaterialIcons name="picture-as-pdf" size={24} color={colors.error} />
        </View>
      )}
      <View style={styles.attachmentInfo}>
        <Text style={{ color: colors.foreground, fontSize: 12 }} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={{ color: colors.muted, fontSize: 10 }}>
          {item.type === "image" ? (isAr ? "صورة" : "Image") : "PDF"}
          {item.size ? ` - ${(item.size / 1024).toFixed(0)} KB` : ""}
        </Text>
      </View>
      <TouchableOpacity
        onPress={() => handleRemoveAttachment(index)}
        style={styles.removeBtn}
      >
        <MaterialIcons name="close" size={16} color={colors.error} />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* عنوان المرفقات */}
      <View style={styles.header}>
        <MaterialIcons name="attach-file" size={20} color={colors.primary} />
        <Text style={[styles.title, { color: colors.foreground }]}>
          {isAr ? "المرفقات" : "Attachments"}
          {attachments.length > 0 && ` (${attachments.length})`}
        </Text>
      </View>

      {/* قائمة المرفقات */}
      {attachments.length > 0 && (
        <FlatList
          data={attachments}
          renderItem={renderAttachmentItem}
          keyExtractor={(_, index) => index.toString()}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.attachmentList}
          contentContainerStyle={{ gap: 8 }}
        />
      )}

      {/* زر إضافة مرفق */}
      <TouchableOpacity
        onPress={() => setShowOptions(true)}
        style={[styles.addButton, { borderColor: colors.primary, backgroundColor: colors.primary + "0D" }]}
        disabled={uploading}
      >
        {uploading ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <>
            <MaterialIcons name="add" size={20} color={colors.primary} />
            <Text style={{ color: colors.primary, fontWeight: "600", marginLeft: 4 }}>
              {isAr ? "إضافة مرفق" : "Add Attachment"}
            </Text>
          </>
        )}
      </TouchableOpacity>

      {/* خيارات المرفقات */}
      <Modal
        visible={showOptions}
        transparent
        animationType="fade"
        onRequestClose={() => setShowOptions(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowOptions(false)}
        >
          <View style={[styles.optionsContainer, { backgroundColor: colors.background }]}>
            <Text style={[styles.optionsTitle, { color: colors.foreground }]}>
              {isAr ? "اختر نوع المرفق" : "Choose Attachment Type"}
            </Text>

            <TouchableOpacity
              style={[styles.optionItem, { borderBottomColor: colors.border }]}
              onPress={() => handleAddAttachment("camera")}
            >
              <MaterialIcons name="camera-alt" size={24} color="#0891b2" />
              <Text style={[styles.optionText, { color: colors.foreground }]}>
                {isAr ? "التقاط صورة بالكاميرا" : "Take Photo"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.optionItem, { borderBottomColor: colors.border }]}
              onPress={() => handleAddAttachment("gallery")}
            >
              <MaterialIcons name="photo-library" size={24} color="#7c3aed" />
              <Text style={[styles.optionText, { color: colors.foreground }]}>
                {isAr ? "اختيار صورة من المعرض" : "Pick from Gallery"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.optionItem, { borderBottomColor: colors.border }]}
              onPress={() => handleAddAttachment("pdf")}
            >
              <MaterialIcons name="picture-as-pdf" size={24} color="#dc2626" />
              <Text style={[styles.optionText, { color: colors.foreground }]}>
                {isAr ? "اختيار ملف PDF" : "Pick PDF File"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelOption}
              onPress={() => setShowOptions(false)}
            >
              <Text style={{ color: colors.error, fontWeight: "600", fontSize: 16 }}>
                {isAr ? "إلغاء" : "Cancel"}
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* معاينة المرفق */}
      <Modal
        visible={!!previewFile}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewFile(null)}
      >
        <View style={styles.previewOverlay}>
          <View style={[styles.previewContainer, { backgroundColor: colors.background }]}>
            {/* رأس المعاينة */}
            <View style={[styles.previewHeader, { borderBottomColor: colors.border }]}>
              <Text style={{ color: colors.foreground, fontWeight: "bold", fontSize: 16 }} numberOfLines={1}>
                {previewFile?.name}
              </Text>
              <TouchableOpacity onPress={() => setPreviewFile(null)}>
                <MaterialIcons name="close" size={24} color={colors.foreground} />
              </TouchableOpacity>
            </View>

            {/* محتوى المعاينة */}
            <View style={styles.previewContent}>
              {previewFile?.type === "image" ? (
                <Image
                  source={{ uri: previewFile.uri }}
                  style={styles.previewImage}
                  contentFit="contain"
                />
              ) : (
                <View style={styles.pdfPreview}>
                  <MaterialIcons name="picture-as-pdf" size={64} color={colors.error} />
                  <Text style={{ color: colors.foreground, marginTop: 16, fontSize: 16, fontWeight: "600" }}>
                    {previewFile?.name}
                  </Text>
                  <Text style={{ color: colors.muted, marginTop: 8 }}>
                    {previewFile?.size ? `${(previewFile.size / 1024).toFixed(0)} KB` : ""}
                  </Text>
                  <Text style={{ color: colors.muted, marginTop: 4, textAlign: "center" }}>
                    {isAr ? "ملف PDF - يمكن عرضه بعد التحميل" : "PDF file - viewable after download"}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
    marginBottom: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: "600",
  },
  attachmentList: {
    marginBottom: 8,
  },
  attachmentItem: {
    width: 100,
    borderRadius: 8,
    borderWidth: 1,
    overflow: "hidden",
  },
  thumbnail: {
    width: 100,
    height: 70,
  },
  pdfIcon: {
    width: 100,
    height: 70,
    justifyContent: "center",
    alignItems: "center",
  },
  attachmentInfo: {
    padding: 4,
  },
  removeBtn: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 10,
    padding: 2,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: "dashed",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  optionsContainer: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
  },
  optionsTitle: {
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 20,
  },
  optionItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  optionText: {
    fontSize: 16,
  },
  cancelOption: {
    alignItems: "center",
    paddingVertical: 16,
    marginTop: 8,
  },
  previewOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  previewContainer: {
    width: "90%",
    height: "80%",
    borderRadius: 16,
    overflow: "hidden",
  },
  previewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
  },
  previewContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
  pdfPreview: {
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
});
