import { addFrequency } from "@hisaab/worker-lib";

export function nextRecurringRun(
  scheduledFor: string,
  frequency: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY",
) {
  return addFrequency(scheduledFor, frequency);
}

export function shouldSkipDuplicateOccurrence(existingId: string | null | undefined) {
  return Boolean(existingId);
}
