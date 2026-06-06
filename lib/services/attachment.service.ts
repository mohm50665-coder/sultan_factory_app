import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { Platform, Alert } from "react-native";
import { getApiBaseUrl } from "@/constants/oauth";

export interface AttachmentFile {
  uri: string;
  name: string;
  type: string; // "image" | "pdf"
  mimeType: string;
  size?: number;
  uploadedUrl?: string; // URL after upload to server
}

class AttachmentService {
  /**
   * التقاط صورة بالكاميرا
   */
  async takePhoto(): Promise<AttachmentFile | null> {
    try {
      // طلب إذن الكاميرا
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "إذن مطلوب",
          "يرجى السماح بالوصول إلى الكاميرا لالتقاط الصور"
        );
        return null;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.8,
        base64: false,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return null;
      }

      const asset = result.assets[0];
      const fileName = `photo_${Date.now()}.jpg`;

      return {
        uri: asset.uri,
        name: fileName,
        type: "image",
        mimeType: asset.mimeType || "image/jpeg",
        size: asset.fileSize,
      };
    } catch (error: any) {
      console.error("Error taking photo:", error);
      Alert.alert("خطأ", "فشل التقاط الصورة: " + (error.message || "خطأ غير معروف"));
      return null;
    }
  }

  /**
   * اختيار صورة من المعرض
   */
  async pickImage(): Promise<AttachmentFile | null> {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.8,
        base64: false,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return null;
      }

      const asset = result.assets[0];
      const ext = asset.mimeType?.includes("png") ? "png" : "jpg";
      const fileName = `image_${Date.now()}.${ext}`;

      return {
        uri: asset.uri,
        name: fileName,
        type: "image",
        mimeType: asset.mimeType || "image/jpeg",
        size: asset.fileSize,
      };
    } catch (error: any) {
      console.error("Error picking image:", error);
      Alert.alert("خطأ", "فشل اختيار الصورة: " + (error.message || "خطأ غير معروف"));
      return null;
    }
  }

  /**
   * اختيار ملف PDF
   */
  async pickPDF(): Promise<AttachmentFile | null> {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return null;
      }

      const asset = result.assets[0];

      return {
        uri: asset.uri,
        name: asset.name || `document_${Date.now()}.pdf`,
        type: "pdf",
        mimeType: asset.mimeType || "application/pdf",
        size: asset.size,
      };
    } catch (error: any) {
      console.error("Error picking PDF:", error);
      Alert.alert("خطأ", "فشل اختيار الملف: " + (error.message || "خطأ غير معروف"));
      return null;
    }
  }

  /**
   * رفع المرفق إلى السيرفر
   */
  async uploadAttachment(file: AttachmentFile): Promise<string | null> {
    try {
      const baseUrl = getApiBaseUrl();
      const formData = new FormData();

      if (Platform.OS === "web") {
        // Web: fetch the blob and append
        const response = await fetch(file.uri);
        const blob = await response.blob();
        formData.append("file", blob, file.name);
      } else {
        // Native: use uri directly
        formData.append("file", {
          uri: file.uri,
          name: file.name,
          type: file.mimeType,
        } as any);
      }

      const uploadResponse = await fetch(`${baseUrl}/api/upload`, {
        method: "POST",
        body: formData,
        headers: {
          "Accept": "application/json",
        },
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.status}`);
      }

      const data = await uploadResponse.json();
      return data.url || data.key || null;
    } catch (error: any) {
      console.error("Error uploading attachment:", error);
      // Return local URI as fallback
      return file.uri;
    }
  }

  /**
   * عرض خيارات المرفقات (كاميرا / معرض / PDF)
   */
  showAttachmentOptions(
    onSelect: (file: AttachmentFile) => void,
    language: "ar" | "en" = "ar"
  ): void {
    const isAr = language === "ar";
    const options = [
      {
        text: isAr ? "التقاط صورة بالكاميرا" : "Take Photo",
        onPress: async () => {
          const file = await this.takePhoto();
          if (file) onSelect(file);
        },
      },
      {
        text: isAr ? "اختيار صورة من المعرض" : "Pick from Gallery",
        onPress: async () => {
          const file = await this.pickImage();
          if (file) onSelect(file);
        },
      },
      {
        text: isAr ? "اختيار ملف PDF" : "Pick PDF File",
        onPress: async () => {
          const file = await this.pickPDF();
          if (file) onSelect(file);
        },
      },
      {
        text: isAr ? "إلغاء" : "Cancel",
        style: "cancel" as const,
      },
    ];

    Alert.alert(
      isAr ? "إضافة مرفق" : "Add Attachment",
      isAr ? "اختر نوع المرفق" : "Choose attachment type",
      options
    );
  }
}

export const attachmentService = new AttachmentService();
