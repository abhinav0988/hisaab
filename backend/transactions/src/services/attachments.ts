import { createDatabase, transactionAttachments } from "@hisaab/database";
import { fileUrl, newId, notFound, now, requireOwnedFile } from "@hisaab/worker-lib";
import { and, eq } from "drizzle-orm";
import { getTransaction } from "./service";

export async function listAttachments(env: Env, userId: string, transactionId: string) {
  await getTransaction(env, userId, transactionId);
  const rows = await env.DB.prepare(
    `SELECT a.id AS id, a.transaction_id AS transactionId, a.file_id AS fileId, f.original_name AS originalName, f.mime_type AS mimeType, a.created_at AS createdAt
     FROM transaction_attachments a JOIN stored_files f ON f.id = a.file_id
     WHERE a.transaction_id = ? AND a.user_id = ? ORDER BY a.created_at ASC`,
  )
    .bind(transactionId, userId)
    .all<{ id: string; transactionId: string; fileId: string; originalName: string; mimeType: string; createdAt: string }>();
  return rows.results.map((row) => ({ ...row, fileUrl: fileUrl(row.fileId) }));
}

export async function attachToTransaction(env: Env, userId: string, transactionId: string, fileId: string) {
  await getTransaction(env, userId, transactionId);
  await requireOwnedFile(env.DB, userId, fileId);
  const db = createDatabase(env.DB);
  const existing = await db.query.transactionAttachments.findFirst({
    where: and(eq(transactionAttachments.transactionId, transactionId), eq(transactionAttachments.fileId, fileId)),
  });
  if (existing) return { id: existing.id, transactionId, fileId, fileUrl: fileUrl(fileId), createdAt: existing.createdAt };
  const row = { id: newId(), transactionId, fileId, userId, createdAt: now() };
  await db.insert(transactionAttachments).values(row);
  return { id: row.id, transactionId, fileId, fileUrl: fileUrl(fileId), createdAt: row.createdAt };
}

export async function removeAttachment(env: Env, userId: string, transactionId: string, attachmentId: string) {
  const db = createDatabase(env.DB);
  const row = await db.query.transactionAttachments.findFirst({
    where: and(
      eq(transactionAttachments.id, attachmentId),
      eq(transactionAttachments.transactionId, transactionId),
      eq(transactionAttachments.userId, userId),
    ),
  });
  if (!row) throw notFound("Attachment");
  await db.delete(transactionAttachments).where(eq(transactionAttachments.id, row.id));
}
