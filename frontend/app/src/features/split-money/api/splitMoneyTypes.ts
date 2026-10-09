import type {
  SplitDashboard,
  SplitExpense,
  SplitGroup,
  SplitHistory,
  SplitPerson,
} from "@hisaab/types";
import type {
  SplitAdjustmentInput,
  SplitExpenseInput,
  SplitGroupInput,
  SplitPaymentInput,
  SplitPersonInput,
  SplitReceiptUploadInput,
} from "@hisaab/validation";

export type CreateSplitExpenseInput = SplitExpenseInput;
export type CreateSplitPersonInput = SplitPersonInput;
export type CreateSplitGroupInput = SplitGroupInput;
export type RecordSplitPaymentInput = SplitPaymentInput;
export type CreateSplitAdjustmentInput = SplitAdjustmentInput;
export type UploadSplitReceiptInput = SplitReceiptUploadInput;

export type SplitExpensePage = { items: SplitExpense[]; total?: number; nextOffset?: number | null };
export type SplitMoneyData = {
  dashboard: SplitDashboard;
  history: SplitHistory;
  people: SplitPerson[];
  groups: SplitGroup[];
};
