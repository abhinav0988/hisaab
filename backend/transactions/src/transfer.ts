export function transferDestinationError(input: {
  type: string;
  accountId: string;
  destinationAccountId?: string | null;
}) {
  if (input.type !== "TRANSFER") return null;
  if (!input.destinationAccountId) return "Choose the destination account for this transfer.";
  if (input.destinationAccountId === input.accountId) {
    return "Source and destination accounts must be different.";
  }
  return null;
}
