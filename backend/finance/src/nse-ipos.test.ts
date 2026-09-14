import { describe, expect, it } from "vitest";
import { formatNsePriceBand, mapNseIpo, normalizeNseIpos, parseNseDate } from "./nse-ipos";

describe("NSE IPO mapping", () => {
  it("parses exchange dates and price bands", () => {
    expect(parseNseDate("11-Sep-2026")).toBe("2026-09-11");
    expect(formatNsePriceBand("Rs.40 to Rs.43")).toBe("₹40 - ₹43");
  });

  it("keeps open issues ahead of forthcoming ones", () => {
    const items = normalizeNseIpos([
      {
        companyName: "Hero Motors Limited",
        symbol: "HEROMOTORS",
        series: "EQ",
        status: "Forthcoming",
        issueStartDate: "16-Sep-2026",
        issueEndDate: "18-Sep-2026",
        issuePrice: "Rs.79 to Rs.84",
      },
      {
        companyName: "Manika Plastech Limited",
        symbol: "MANIKA",
        series: "EQ",
        status: "Active",
        issueStartDate: "11-Sep-2026",
        issueEndDate: "16-Sep-2026",
        issuePrice: "Rs.40 to Rs.43",
      },
    ]);
    expect(items.map((item) => item.symbol)).toEqual(["MANIKA", "HEROMOTORS"]);
    expect(items[0]?.status).toBe("Open");
    expect(mapNseIpo({ companyName: " ", symbol: "X" })).toBeNull();
  });
});
