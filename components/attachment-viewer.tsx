import React, { useState } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Platform,
  Linking,
  StyleSheet,
} from "react-native";
import { Image } from "expo-image";
import { MaterialIcons } from "@expo/vector-icons";
import { useColors } from "@/hooks/use-colors";
import { AttachmentFile } from "@/lib/services/attachment.service";

interface AttachmentViewerProps {
  attachments: AttachmentFile[];
  language?: string;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

export function AttachmentViewer({ attachments, language = "ar" }: AttachmentViewerProps) {
  const colors = useColors();
  const isAr = language === "ar";
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  if (!attachments || attachments.length === 0) return null;

  const handleOpenPDF = async (uri: string) => {
    if (Platform.OS === "web") {
      window.open(uri, "_blank");
    } else {
      await Linking.openURL(uri);
    }
  };

  const imageAttachments = attachments.filter((a) => a.type === "image");
  const pdfAttachments = attachments.filter((a) => a.type === "pdf");

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: colors.foreground }]}>
        {isAr ? `المرفقات (${attachments.length})` : `Attachments (${attachments.length})`}
      </Text>

      {/* عرض الصور */}
      {imageAttachments.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageScroll}>
          {imageAttachments.map((attachment, index) => (
            <TouchableOpacity
              key={index}
              onPress={() => setSelectedImage(attachment.uri)}
              style={[styles.imageThumb, { borderColor: colors.border }]}
            >
              <Image
                source={{ uri: attachment.uri }}
                style={styles.thumbImage}
                contentFit="cover"
              />
              <View style={styles.imageOverlay}>
                <MaterialIcons name="zoom-in" size={16} color="white" />
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* عرض ملفات PDF */}
      {pdfAttachments.length > 0 && (
        <View style={styles.pdfList}>
          {pdfAttachments.map((attachment, index) => (
            <TouchableOpacity
              key={index}
              onPress={() => handleOpenPDF(attachment.uri)}
              style={[styles.pdfItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <MaterialIcons name="picture-as-pdf" size={24} color="#ef4444" />
              <View style={styles.pdfInfo}>
                <Text style={[styles.pdfName, { color: colors.foreground }]} numberOfLines={1}>
                  {attachment.name}
                </Text>
                <Text style={[styles.pdfSize, { color: colors.muted }]}>
                  {attachment.size ? `${(attachment.size / 1024).toFixed(1)} KB` : "PDF"}
                </Text>
              </View>
              <MaterialIcons name="open-in-new" size={18} color={colors.primary} />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Modal لعرض الصورة بالحجم الكامل */}
      <Modal visible={!!selectedImage} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={() => setSelectedImage(null)}
          >
            <MaterialIcons name="close" size={28} color="white" />
          </TouchableOpacity>
          {selectedImage && (
            <Image
              source={{ uri: selectedImage }}
              style={styles.fullImage}
              contentFit="contain"
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 12,
    marginBottom: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  imageScroll: {
    marginBottom: 8,
  },
  imageThumb: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 8,
    borderWidth: 1,
    overflow: "hidden",
    position: "relative",
  },
  thumbImage: {
    width: "100%",
    height: "100%",
  },
  imageOverlay: {
    position: "absolute",
    bottom: 4,
    right: 4,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 10,
    padding: 2,
  },
  pdfList: {
    gap: 8,
  },
  pdfItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
  },
  pdfInfo: {
    flex: 1,
  },
  pdfName: {
    fontSize: 13,
    fontWeight: "500",
  },
  pdfSize: {
    fontSize: 11,
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.95)",
    justifyContent: "center",
    alignItems: "center",
  },
  closeBtn: {
    position: "absolute",
    top: 50,
    right: 20,
    zIndex: 10,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 20,
    padding: 8,
  },
  fullImage: {
    width: SCREEN_WIDTH * 0.95,
    height: SCREEN_HEIGHT * 0.75,
  },
});
