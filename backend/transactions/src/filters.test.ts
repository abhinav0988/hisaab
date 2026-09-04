import { describe, expect, it } from "vitest";
import { buildTransactionFilterSql } from "./filters";

const base = {
  page: 1,
  limit: 20,
  sort: "newest" as const,
};

describe("buildTransactionFilterSql", () => {
  it("always scopes to the user and excludes deleted rows", () => {
    const filter = buildTransactionFilterSql("user-1", base);
    expect(filter.where).toContain("t.user_id = ?");
    expect(filter.where).toContain("t.deleted_at IS NULL");
    expect(filter.values).toEqual(["user-1"]);
    expect(filter.offset).toBe(0);
  });

  it("applies type, category, account, and date bounds", () => {
    const filter = buildTransactionFilterSql("user-1", {
      ...base,
      type: "EXPENSE",
      category_id: "cat-food-dining",
      account_id: "acc-hdfc-001",
      from: "2026-09-01T00:00:00.000Z",
      to: "2026-09-05T00:00:00.000Z",
    });
    expect(filter.where).toContain("t.type = ?");
    expect(filter.where).toContain("t.category_id = ?");
    expect(filter.where).toContain("(t.account_id = ? OR t.destination_account_id = ?)");
    expect(filter.where).toContain("t.transaction_at >= ?");
    expect(filter.where).toContain("t.transaction_at < ?");
    expect(filter.values).toEqual([
      "user-1",
      "2026-09-01T00:00:00.000Z",
      "2026-09-05T00:00:00.000Z",
      "cat-food-dining",
      "acc-hdfc-001",
      "acc-hdfc-001",
      "EXPENSE",
    ]);
  });

  it("searches merchant, notes, category, and account fields", () => {
    const filter = buildTransactionFilterSql("user-1", { ...base, search: "food_50%" });
    expect(filter.where).toMatch(/t\.merchant LIKE/);
    expect(filter.where).toMatch(/c\.name LIKE/);
    expect(filter.where).toMatch(/a\.name LIKE/);
    expect(filter.where).toMatch(/dest\.name/);
    expect(filter.where).toMatch(/a\.institution_name/);
    expect(filter.values.slice(1)).toEqual([
      "%food\\_50\\%%",
      "%food\\_50\\%%",
      "%food\\_50\\%%",
      "%food\\_50\\%%",
      "%food\\_50\\%%",
      "%food\\_50\\%%",
    ]);
  });

  it("paginates with the requested sort", () => {
    const filter = buildTransactionFilterSql("user-1", {
      ...base,
      page: 3,
      limit: 20,
      sort: "amount_desc",
    });
    expect(filter.order).toBe("t.amount_minor DESC");
    expect(filter.offset).toBe(40);
    expect(filter.limit).toBe(20);
  });
});
