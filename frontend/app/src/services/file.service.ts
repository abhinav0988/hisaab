import type { OcrReceiptResult, StoredFile } from "@hisaab/types";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { API_URL } from "../config/env";
import type { PickedNativeFile } from "./native-picker.service";
import { api, rawFetch, requestHeaders } from "./api-client";
import { ApiError } from "./api-client";

export const fileService = {
  async upload(file: PickedNativeFile): Promise<StoredFile> {
    const body = new FormData();
    body.append("file", { uri: file.uri, name: file.name, type: file.mimeType ?? "application/octet-stream" } as unknown as Blob);
    const response = await rawFetch("/api/v1/files", { method: "POST", body });
    const payload = (await response.json()) as { success: boolean; data: StoredFile; error?: { message: string; code: string } };
    if (!response.ok || !payload.success) {
      throw new ApiError(payload.error?.message ?? "Upload failed.", payload.error?.code ?? "UPLOAD_FAILED");
    }
    return payload.data;
  },
  scanReceipt: (fileId: string) => api<OcrReceiptResult>("/api/v1/ocr/receipt", { method: "POST", body: JSON.stringify({ fileId }) }),
  /** Downloads a private file with the session cookie into the cache, then hands it to the Android opener. */
  async open(fileId: string, name: string, mimeType: string) {
    const target = new File(Paths.cache, `${fileId}-${name.replace(/[^a-zA-Z0-9._-]/g, "-")}`);
    if (target.exists) target.delete();
    let response: Response;
    try {
      response = await fetch(`${API_URL}/api/v1/files/${fileId}`, { headers: await requestHeaders() });
    } catch {
      throw new ApiError("Network request failed. Check your connection.", "NETWORK");
    }
    if (response.status === 404) throw new ApiError("This file is no longer available.", "NOT_FOUND");
    if (!response.ok) throw new ApiError("Could not download this file.", "DOWNLOAD_FAILED");
    target.create();
    target.write(new Uint8Array(await response.arrayBuffer()));
    if (!(await Sharing.isAvailableAsync())) throw new ApiError("No app is available to open this file.", "SHARE_UNAVAILABLE");
    await Sharing.shareAsync(target.uri, { mimeType, dialogTitle: name });
  },
};

export function fileKind(mimeType: string | null | undefined) {
  if (mimeType === "application/pdf") return "PDF";
  if (mimeType === "image/png") return "PNG";
  if (mimeType === "image/jpeg") return "JPEG";
  return "File";
}

export const isScannable = (mimeType: string | null | undefined) => mimeType === "image/jpeg" || mimeType === "image/png";
