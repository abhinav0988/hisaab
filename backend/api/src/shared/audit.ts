import type { Database } from "@hisaab/database";
import { auditLogs } from "@hisaab/database";
import { newId, now } from "./http";

export async function audit(
  db: Database,
  input: {
    userId: string;
    action: string;
    entityType: string;
    entityId: string;
    oldValue?: unknown;
    newValue?: unknown;
    ipHash?: string;
  },
) {
  await db.insert(auditLogs).values({
    id: newId(),
    userId: input.userId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    oldValueJson: input.oldValue === undefined ? null : JSON.stringify(input.oldValue),
    newValueJson: input.newValue === undefined ? null : JSON.stringify(input.newValue),
    ipHash: input.ipHash ?? null,
    createdAt: now(),
  });
}
