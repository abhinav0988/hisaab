import { AppError, notFound } from "./errors";

export type StoredFileRow = {
  id: string;
  userId: string;
  storageKey: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
};

/** Missing and cross-user rows are the same 404 so file existence is not leaked. */
export async function requireOwnedFile(binding: D1Database, userId: string, fileId: string) {
  const row = await binding
    .prepare(
      "SELECT id, user_id AS userId, storage_key AS storageKey, original_name AS originalName, mime_type AS mimeType, size_bytes AS sizeBytes, created_at AS createdAt FROM stored_files WHERE id = ? AND user_id = ?",
    )
    .bind(fileId, userId)
    .first<StoredFileRow>();
  if (!row) throw notFound("File");
  return row;
}

export async function assertFileDeletable(binding: D1Database, userId: string, fileId: string) {
  const [attachment, receipt] = await Promise.all([
    binding
      .prepare("SELECT id FROM transaction_attachments WHERE file_id = ? AND user_id = ?")
      .bind(fileId, userId)
      .first<{ id: string }>(),
    binding
      .prepare("SELECT id FROM split_receipts WHERE file_id = ? AND user_id = ?")
      .bind(fileId, userId)
      .first<{ id: string }>(),
  ]);
  if (attachment || receipt) {
    throw new AppError(409, "FILE_IN_USE", "Remove the receipt or attachment before deleting this file.");
  }
}

export function fileUrl(fileId: string) {
  return `/api/v1/files/${fileId}`;
}
