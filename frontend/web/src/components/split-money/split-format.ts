import type { SplitExpenseStatus, SplitParticipantStatus } from "@hisaab/types";

export function statusLabel(status: string) {
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function statusClass(status: SplitExpenseStatus | SplitParticipantStatus | string) {
  return statusLabel(status).toLowerCase().replaceAll(" ", "-");
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function avatarTone(index: number) {
  return (["me", "blue", "gold", "rose", "purple"] as const)[index % 5]!;
}

export const DRAFT_KEY = "hisaab.split-expense.draft.v1";

export type SplitWizardDraft = {
  step: number;
  title: string;
  amountMajor: string;
  category: string;
  expenseDate: string;
  expenseTime: string;
  groupId: string;
  description: string;
  payerMode: "single" | "multiple";
  payerIds: string[];
  payerAmounts: Record<string, string>;
  participantIds: string[];
  method: "equal" | "exact" | "percentage" | "shares" | "itemwise";
  exactAmounts: Record<string, string>;
  percentages: Record<string, string>;
  shares: Record<string, string>;
  items: Array<{
    name: string;
    quantity: number;
    priceMajor: string;
    kind: "item" | "tax" | "tip";
    personIds: string[];
  }>;
  dueDate: string;
  remindersEnabled: boolean;
  reminderChannels: Array<"in_app" | "email" | "whatsapp" | "sms">;
  firstReminderDays: number;
  frequencyDays: number;
  recurring: boolean;
  stopAfterSettlement: boolean;
  reminderMessage: string;
  noteForParticipants: string;
  allowPartialPayments: boolean;
  sendNotifications: boolean;
};

export function defaultDraft(): SplitWizardDraft {
  const today = new Date();
  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  return {
    step: 1,
    title: "",
    amountMajor: "",
    category: "Food & Dining",
    expenseDate: iso,
    expenseTime: "20:30",
    groupId: "",
    description: "",
    payerMode: "single",
    payerIds: [],
    payerAmounts: {},
    participantIds: [],
    method: "equal",
    exactAmounts: {},
    percentages: {},
    shares: {},
    items: [],
    dueDate: "",
    remindersEnabled: true,
    reminderChannels: ["in_app"],
    firstReminderDays: 2,
    frequencyDays: 2,
    recurring: true,
    stopAfterSettlement: true,
    reminderMessage: "",
    noteForParticipants: "",
    allowPartialPayments: true,
    sendNotifications: true,
  };
}

export function loadDraft(): SplitWizardDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return { ...defaultDraft(), ...(JSON.parse(raw) as SplitWizardDraft) };
  } catch {
    return null;
  }
}

export function saveDraft(draft: SplitWizardDraft) {
  if (typeof window === "undefined") return;
  localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

export function clearDraft() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(DRAFT_KEY);
}

export function majorStringToMinor(value: string): number {
  const normalized = value.replace(/,/g, "").trim();
  if (!normalized) return 0;
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) throw new Error("Enter a valid amount");
  const [whole = "0", fraction = ""] = normalized.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}
