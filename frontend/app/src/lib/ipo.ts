import type { IpoMarketCategory, IpoStatus } from "@hisaab/types";
import { transactionService } from "../services/transaction.service";

export const IPO_STATUSES: IpoStatus[] = [
  "Applied",
  "In progress",
  "Allotted",
  "Not Allotted",
  "Listed",
];

export const IPO_MARKET_CATEGORIES: IpoMarketCategory[] = ["Mainboard", "SME"];

export function shouldBlockBankHold(status: IpoStatus) {
  return status === "Applied" || status === "In progress";
}

export function shouldReleaseBankHold(status: IpoStatus) {
  return status === "Not Allotted";
}

export function isAllottedStatus(status: IpoStatus) {
  return status === "Allotted" || status === "Listed";
}

function expenseCategoryId(categories: { id: string; name: string; type: string }[]) {
  const match =
    categories.find((item) => item.name === "Other" && item.type === "EXPENSE") ??
    categories.find((item) => item.type === "EXPENSE");
  if (!match) throw new Error("No expense category found. Add a category first.");
  return match.id;
}

function incomeCategoryId(categories: { id: string; name: string; type: string }[]) {
  const match =
    categories.find((item) => item.name === "Salary" && item.type === "INCOME") ??
    categories.find((item) => item.name === "Other" && item.type === "INCOME") ??
    categories.find((item) => item.type === "INCOME");
  if (!match) throw new Error("No income category found. Add a category first.");
  return match.id;
}

/** Deduct applied amount from the selected bank (web parity). */
export async function blockBankForIpo(
  bankAccountId: string,
  categories: { id: string; name: string; type: string }[],
  payload: {
    amountMinor: number;
    name: string;
    appliedOn: string;
    currency: string;
  },
) {
  await transactionService.create({
    type: "EXPENSE",
    accountId: bankAccountId,
    categoryId: expenseCategoryId(categories),
    amountMinor: payload.amountMinor,
    currency: payload.currency,
    merchant: `IPO: ${payload.name}`,
    notes: "IPO application amount blocked in bank",
    transactionAt: new Date(`${payload.appliedOn}T12:00:00`).toISOString(),
  });
}

/** Credit applied amount back when IPO is not allotted (web parity). */
export async function releaseBankForIpo(
  bankAccountId: string,
  categories: { id: string; name: string; type: string }[],
  payload: {
    amountMinor: number;
    name: string;
    currency: string;
  },
) {
  await transactionService.create({
    type: "INCOME",
    accountId: bankAccountId,
    categoryId: incomeCategoryId(categories),
    amountMinor: payload.amountMinor,
    currency: payload.currency,
    merchant: `IPO refund: ${payload.name}`,
    notes: "IPO not allotted — application amount credited back to bank",
    transactionAt: new Date().toISOString(),
  });
}
