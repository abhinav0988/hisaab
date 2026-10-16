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
  /** Self person id of the account that wrote the draft; drafts never cross accounts on a shared browser. */
  ownerId?: string;
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

const clampInt = (value: unknown, min: number, max: number, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : fallback;
const uniqueStrings = (value: unknown) =>
  Array.isArray(value) ? [...new Set(value.filter((id): id is string => typeof id === "string" && id.length > 0))] : [];
const stringRecord = (value: unknown) =>
  value && typeof value === "object" && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string"))
    : {};

/** Stored drafts outlive releases and edits; coerce every field so a stale draft cannot reach the API malformed. */
export function sanitizeDraft(raw: unknown): SplitWizardDraft {
  const base = defaultDraft();
  const value = (raw && typeof raw === "object" ? raw : {}) as Partial<Record<keyof SplitWizardDraft, unknown>>;
  const str = (key: keyof SplitWizardDraft, fallback: string) =>
    typeof value[key] === "string" ? (value[key] as string) : fallback;
  const bool = (key: keyof SplitWizardDraft, fallback: boolean) =>
    typeof value[key] === "boolean" ? (value[key] as boolean) : fallback;
  const methods: SplitWizardDraft["method"][] = ["equal", "exact", "percentage", "shares", "itemwise"];
  const time = str("expenseTime", base.expenseTime).slice(0, 5);
  return {
    step: clampInt(value.step, 1, 6, 1),
    title: str("title", ""),
    amountMajor: str("amountMajor", ""),
    category: str("category", base.category) || base.category,
    expenseDate: /^\d{4}-\d{2}-\d{2}$/.test(str("expenseDate", "")) ? str("expenseDate", "") : base.expenseDate,
    expenseTime: /^\d{2}:\d{2}$/.test(time) ? time : "",
    groupId: str("groupId", ""),
    description: str("description", ""),
    payerMode: value.payerMode === "multiple" ? "multiple" : "single",
    payerIds: uniqueStrings(value.payerIds),
    payerAmounts: stringRecord(value.payerAmounts),
    participantIds: uniqueStrings(value.participantIds),
    method: methods.includes(value.method as SplitWizardDraft["method"]) ? (value.method as SplitWizardDraft["method"]) : "equal",
    exactAmounts: stringRecord(value.exactAmounts),
    percentages: stringRecord(value.percentages),
    shares: stringRecord(value.shares),
    items: Array.isArray(value.items)
      ? (value.items as SplitWizardDraft["items"])
          .filter((item) => item && typeof item === "object")
          .map((item) => ({
            name: typeof item.name === "string" ? item.name : "",
            quantity: clampInt(item.quantity, 1, 9999, 1),
            priceMajor: typeof item.priceMajor === "string" ? item.priceMajor : "",
            kind: item.kind === "tax" || item.kind === "tip" ? item.kind : "item",
            personIds: uniqueStrings(item.personIds),
          }))
      : [],
    dueDate: /^\d{4}-\d{2}-\d{2}$/.test(str("dueDate", "")) ? str("dueDate", "") : "",
    remindersEnabled: bool("remindersEnabled", base.remindersEnabled),
    reminderChannels: ["in_app"],
    firstReminderDays: clampInt(value.firstReminderDays, 0, 30, base.firstReminderDays),
    frequencyDays: clampInt(value.frequencyDays, 1, 30, base.frequencyDays),
    recurring: bool("recurring", base.recurring),
    stopAfterSettlement: bool("stopAfterSettlement", base.stopAfterSettlement),
    reminderMessage: str("reminderMessage", "").slice(0, 200),
    noteForParticipants: str("noteForParticipants", "").slice(0, 200),
    allowPartialPayments: bool("allowPartialPayments", base.allowPartialPayments),
    sendNotifications: bool("sendNotifications", base.sendNotifications),
    ownerId: typeof value.ownerId === "string" ? value.ownerId : undefined,
  };
}

/** Drops people that no longer exist (or are archived) for this account, and the draft itself if it belongs to another account. */
export function reconcileDraftPeople(draft: SplitWizardDraft, selfId: string, activeIds: Set<string>): SplitWizardDraft | null {
  if (draft.ownerId && draft.ownerId !== selfId) return null;
  const keep = (ids: string[]) => ids.filter((id) => activeIds.has(id));
  const payerIds = keep(draft.payerIds);
  const participantIds = keep(draft.participantIds);
  const lostPayer = payerIds.length !== draft.payerIds.length;
  const lostParticipant = participantIds.length !== draft.participantIds.length;
  if (draft.ownerId === selfId && !lostPayer && !lostParticipant) return draft;
  return {
    ...draft,
    ownerId: selfId,
    payerIds,
    participantIds,
    items: draft.items.map((item) => ({ ...item, personIds: keep(item.personIds) })),
    step: lostPayer ? Math.min(draft.step, 2) : lostParticipant ? Math.min(draft.step, 3) : draft.step,
  };
}

export function loadDraft(): SplitWizardDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return sanitizeDraft(JSON.parse(raw));
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
