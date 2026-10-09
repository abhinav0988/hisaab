import { createDatabase, tags, transactionTags } from "@hisaab/database";
import { normalizeTagName } from "@hisaab/validation";
import { AppError, newId, notFound, now } from "@hisaab/worker-lib";
import { and, asc, eq } from "drizzle-orm";

type Database = ReturnType<typeof createDatabase>;

export async function assignTransactionTags(
  db: Database,
  userId: string,
  transactionId: string,
  names?: string[],
  ids?: string[],
) {
  if (names === undefined && ids === undefined) return;
  await db.delete(transactionTags).where(eq(transactionTags.transactionId, transactionId));
  const linked = new Set<string>();
  for (const id of [...new Set(ids ?? [])]) {
    const tag = await db.query.tags.findFirst({ where: and(eq(tags.id, id), eq(tags.userId, userId)) });
    if (!tag) throw notFound("Tag");
    linked.add(tag.id);
  }
  for (const name of [...new Set(names ?? [])]) {
    const normalizedName = normalizeTagName(name);
    let tag = await db.query.tags.findFirst({
      where: and(eq(tags.userId, userId), eq(tags.normalizedName, normalizedName)),
    });
    if (!tag) {
      tag = { id: newId(), userId, name: name.trim(), normalizedName, createdAt: now() };
      await db.insert(tags).values(tag);
    }
    linked.add(tag.id);
  }
  for (const tagId of linked) {
    await db.insert(transactionTags).values({ transactionId, tagId }).onConflictDoNothing();
  }
}

export async function transactionTagNames(env: Env, userId: string, transactionId: string) {
  const rows = await env.DB.prepare(
    "SELECT tg.id AS id, tg.name AS name FROM transaction_tags tt JOIN tags tg ON tg.id = tt.tag_id WHERE tt.transaction_id = ? AND tg.user_id = ?",
  )
    .bind(transactionId, userId)
    .all<{ id: string; name: string }>();
  return {
    tags: rows.results.map((row) => row.name),
    tagIds: rows.results.map((row) => row.id),
  };
}

export async function listTags(env: Env, userId: string) {
  const db = createDatabase(env.DB);
  return db
    .select({ id: tags.id, name: tags.name, createdAt: tags.createdAt })
    .from(tags)
    .where(eq(tags.userId, userId))
    .orderBy(asc(tags.name));
}

export async function createTag(env: Env, userId: string, name: string) {
  const db = createDatabase(env.DB);
  const normalizedName = normalizeTagName(name);
  const existing = await db.query.tags.findFirst({
    where: and(eq(tags.userId, userId), eq(tags.normalizedName, normalizedName)),
  });
  if (existing) throw new AppError(409, "TAG_EXISTS", "You already have a tag with that name.");
  const row = { id: newId(), userId, name: name.trim(), normalizedName, createdAt: now() };
  await db.insert(tags).values(row);
  return { id: row.id, name: row.name, createdAt: row.createdAt };
}

export async function updateTag(env: Env, userId: string, id: string, name: string) {
  const db = createDatabase(env.DB);
  const current = await db.query.tags.findFirst({ where: and(eq(tags.id, id), eq(tags.userId, userId)) });
  if (!current) throw notFound("Tag");
  const normalizedName = normalizeTagName(name);
  const clash = await db.query.tags.findFirst({
    where: and(eq(tags.userId, userId), eq(tags.normalizedName, normalizedName)),
  });
  if (clash && clash.id !== id) throw new AppError(409, "TAG_EXISTS", "You already have a tag with that name.");
  await db.update(tags).set({ name: name.trim(), normalizedName }).where(eq(tags.id, id));
  return { id, name: name.trim(), createdAt: current.createdAt };
}

export async function deleteTag(env: Env, userId: string, id: string) {
  const db = createDatabase(env.DB);
  const current = await db.query.tags.findFirst({ where: and(eq(tags.id, id), eq(tags.userId, userId)) });
  if (!current) throw notFound("Tag");
  await db.delete(tags).where(and(eq(tags.id, id), eq(tags.userId, userId)));
}
