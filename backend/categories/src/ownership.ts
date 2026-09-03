export function canMutateCategory(row: { userId: string | null; isSystem: boolean | number }, userId: string) {
  if (row.userId !== userId) return false;
  if (row.isSystem === true || Number(row.isSystem) === 1) return false;
  return true;
}
