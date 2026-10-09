import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";

export type PickedNativeFile = { uri: string; name: string; mimeType: string | null; size: number | null };

function imageAsset(asset: ImagePicker.ImagePickerAsset): PickedNativeFile {
  return { uri: asset.uri, name: asset.fileName ?? "receipt.jpg", mimeType: asset.mimeType ?? "image/jpeg", size: asset.fileSize ?? null };
}

export const nativePickerService = {
  async pickImage(): Promise<PickedNativeFile | null> {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.85 });
    return result.canceled ? null : imageAsset(result.assets[0]!);
  },
  async takePhoto(): Promise<PickedNativeFile | null> {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      throw new Error(
        permission.canAskAgain
          ? "Camera permission was denied. Allow camera access to take a receipt photo, or choose from Gallery."
          : "Camera access is blocked. Enable it in Android Settings › Apps › Permissions, or choose from Gallery.",
      );
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.85 });
    return result.canceled ? null : imageAsset(result.assets[0]!);
  },
  async pickDocument(): Promise<PickedNativeFile | null> {
    const result = await DocumentPicker.getDocumentAsync({ type: ["image/jpeg", "image/png", "application/pdf"], copyToCacheDirectory: true });
    if (result.canceled) return null;
    const asset = result.assets[0]!;
    return { uri: asset.uri, name: asset.name, mimeType: asset.mimeType ?? null, size: asset.size ?? null };
  },
};
