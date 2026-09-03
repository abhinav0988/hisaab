export function nextGoalSaved(savedAmountMinor: number, contributionMinor: number) {
  return Math.max(0, savedAmountMinor + contributionMinor);
}

export function goalStatus(input: {
  isActive: boolean;
  savedAmountMinor: number;
  targetAmountMinor: number;
  targetDate?: string | null;
  today?: string;
}) {
  if (input.savedAmountMinor >= input.targetAmountMinor) return "completed";
  if (!input.isActive) return "paused";
  if (input.targetDate) {
    const end = input.targetDate.length === 7 ? `${input.targetDate}-28` : input.targetDate;
    if (end < (input.today ?? new Date().toISOString().slice(0, 10))) return "overdue";
  }
  return "active";
}
