import { ApiError } from "../services/api-client";

const messages: Record<string, string> = {
  FILE_IN_USE: "Remove this file from its receipt or attachment before deleting it.",
  TAG_EXISTS: "This tag already exists.",
  OCR_UNAVAILABLE: "Receipt scanning is temporarily unavailable.",
  OCR_PROVIDER_FAILED: "Could not scan this receipt. You can enter the details manually.",
  OCR_TIMEOUT: "Scanning took too long. Try again or enter the details manually.",
  OCR_UNSUPPORTED: "Only JPEG and PNG receipts can be scanned. PDFs can still be attached.",
  PAYLOAD_TOO_LARGE: "Files must be 8 MB or smaller.",
  UNSUPPORTED_FILE: "Upload a JPEG, PNG, or PDF.",
  STORAGE_UNAVAILABLE: "File storage is unavailable right now. Nothing was uploaded.",
  NOT_FOUND: "This item is no longer available.",
  TIMEOUT: "The request timed out. Check your connection and try again.",
};

/** Maps backend error codes to user-facing copy; never returns stack traces. */
export function friendlyError(error: unknown, fallback = "Please try again.") {
  if (error instanceof ApiError) {
    if (messages[error.code]) return messages[error.code]!;
    if (error.code === "INTERNAL_ERROR") return "Something went wrong on our side. Nothing was saved.";
    return error.message || fallback;
  }
  if (error instanceof TypeError || (error instanceof Error && /network request failed/i.test(error.message))) {
    return "Network request failed. Check your connection — nothing was saved.";
  }
  return error instanceof Error && error.message ? error.message : fallback;
}

export function errorCode(error: unknown) {
  return error instanceof ApiError ? error.code : null;
}
