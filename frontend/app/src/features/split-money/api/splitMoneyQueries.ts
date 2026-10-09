/** Query-key factory keeps financial cache invalidation explicit and consistent. */
export const splitKeys = {
  root: ["split"] as const,
  dashboard: ["split", "dashboard"] as const,
  history: ["split", "history"] as const,
  expenses: ["split", "expenses"] as const,
  expense: (id: string) => ["split", "expense", id] as const,
  people: ["split", "people"] as const,
  person: (id: string) => ["split", "person", id] as const,
  groups: ["split", "groups"] as const,
  group: (id: string) => ["split", "group", id] as const,
};
