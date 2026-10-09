import { detectUploadMime, MAX_UPLOAD_BYTES } from "@hisaab/validation";
import { AppError, fileUrl, newId, notFound, now, requireOwnedFile, assertFileDeletable } from "@hisaab/worker-lib";
import { createDatabase, storedFiles } from "@hisaab/database";
import { and, eq } from "drizzle-orm";

const EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "application/pdf": "pdf",
};

function safeOriginalName(name: string) {
  const base = name.split(/[/\\]/).pop() ?? "upload";
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 180);
  return cleaned || "upload";
}

export function toStoredFile(row: {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}) {
  return {
    id: row.id,
    fileUrl: fileUrl(row.id),
    originalName: row.originalName,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    createdAt: row.createdAt,
  };
}

export async function storeUpload(env: Env, userId: string, file: File) {
  if (!env.FILES) throw new AppError(503, "STORAGE_UNAVAILABLE", "File storage is not configured.");
  if (file.size <= 0 || file.size > MAX_UPLOAD_BYTES) {
    throw new AppError(413, "PAYLOAD_TOO_LARGE", "Files must be between 1 byte and 8 MB.");
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = detectUploadMime(bytes, file.type);
  if (!mime) throw new AppError(400, "UNSUPPORTED_FILE", "Upload a JPEG, PNG, or PDF.");
  const id = newId();
  const storageKey = `users/${userId}/files/${id}.${EXTENSION[mime]}`;
  await env.FILES.put(storageKey, bytes, { httpMetadata: { contentType: mime } });
  const row = {
    id,
    userId,
    storageKey,
    originalName: safeOriginalName(file.name || `upload.${EXTENSION[mime]}`),
    mimeType: mime,
    sizeBytes: bytes.byteLength,
    createdAt: now(),
  };
  const db = createDatabase(env.DB);
  await db.insert(storedFiles).values(row);
  return toStoredFile(row);
}

export async function readOwnedFile(env: Env, userId: string, id: string) {
  const row = await requireOwnedFile(env.DB, userId, id);
  if (!env.FILES) throw new AppError(503, "STORAGE_UNAVAILABLE", "File storage is not configured.");
  const object = await env.FILES.get(row.storageKey);
  if (!object) throw notFound("File");
  const filename = row.originalName.replace(/["\r\n]/g, "");
  return new Response(object.body, {
    headers: {
      "content-type": row.mimeType,
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "private, no-store",
    },
  });
}

export async function deleteOwnedFile(env: Env, userId: string, id: string) {
  const row = await requireOwnedFile(env.DB, userId, id);
  await assertFileDeletable(env.DB, userId, id);
  const db = createDatabase(env.DB);
  await db.delete(storedFiles).where(and(eq(storedFiles.id, id), eq(storedFiles.userId, userId)));
  if (env.FILES) await env.FILES.delete(row.storageKey);
}
