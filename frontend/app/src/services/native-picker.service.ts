import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";

export type PickedNativeFile = { uri: string; name: string; mimeType: string | null; size: number | null };

function imageAsset(asset: ImagePicker.ImagePickerAsset): PickedNativeFile {
  return { uri: asset.uri, name: asset.fileName ?? "receipt.jpg", mimeType: asset.mimeType ?? "image/jpeg", size: asset.fileSize ?? null };
}

const MAX_RECEIPT_BYTES = 8 * 1024 * 1024;

function assertReceiptSize(size: number | null) {
  if (size != null && size > MAX_RECEIPT_BYTES) {
    throw new Error("File is larger than 8 MB.");
  }
}

function permissionDeniedMessage(kind: "camera" | "photos", canAskAgain: boolean) {
  if (kind === "camera") {
    return canAskAgain
      ? "Camera permission was denied. Allow camera access to take a receipt photo, or choose Gallery or Documents."
      : "Camera access is blocked. Enable it in Android Settings › Apps › Hisaab › Permissions, or choose Gallery or Documents.";
  }
  return canAskAgain
    ? "Photo library permission was denied. Allow photos access, or choose Camera or Documents."
    : "Photo library access is blocked. Enable it in Android Settings › Apps › Hisaab › Permissions, or choose Documents.";
}

export const nativePickerService = {
  maxBytes: MAX_RECEIPT_BYTES,
  async pickImage(): Promise<PickedNativeFile | null> {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      throw new Error(permissionDeniedMessage("photos", permission.canAskAgain));
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.85 });
    if (result.canceled) return null;
    const file = imageAsset(result.assets[0]!);
    assertReceiptSize(file.size);
    return file;
  },
  async takePhoto(): Promise<PickedNativeFile | null> {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      throw new Error(permissionDeniedMessage("camera", permission.canAskAgain));
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.85 });
    if (result.canceled) return null;
    const file = imageAsset(result.assets[0]!);
    assertReceiptSize(file.size);
    return file;
  },
  async pickDocument(): Promise<PickedNativeFile | null> {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["image/jpeg", "image/png", "application/pdf"],
      copyToCacheDirectory: true,
    });
    if (result.canceled) return null;
    const asset = result.assets[0]!;
    const file: PickedNativeFile = {
      uri: asset.uri,
      name: asset.name,
      mimeType: asset.mimeType ?? null,
      size: asset.size ?? null,
    };
    assertReceiptSize(file.size);
    return file;
  },
};
