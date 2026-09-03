import { describe, expect, it } from "vitest";
import type { IpoApplication } from "@hisaab/types";
import { ipoCurrentPlBars, ipoListingVsCurrent } from "./ipo";

function ipo(partial: Partial<IpoApplication> & Pick<IpoApplication, "id" | "name" | "status">): IpoApplication {
  return {
    appliedOn: "2026-01-10",
    allotmentOn: "2026-01-20",
    amountMinor: 100000,
    lots: 1,
    marketCategory: "Mainboard",
    allottedAmountMinor: 100000,
    listingPriceMinor: 10000,
    currentPriceMinor: 12000,
    paymentSource: null,
    holdReleased: true,
    currency: "INR",
    createdAt: "2026-01-10T00:00:00.000Z",
    updatedAt: "2026-01-10T00:00:00.000Z",
    ...partial,
  };
}

describe("ipoCurrentPlBars", () => {
  it("plots current P/L per IPO instead of a dated running total", () => {
    const bars = ipoCurrentPlBars([
      ipo({ id: "a", name: "Alpha", status: "Listed", currentPriceMinor: 15000 }),
      ipo({ id: "b", name: "Beta", status: "Applied", currentPriceMinor: 20000 }),
    ]);
    expect(bars).toHaveLength(1);
    expect(bars[0]?.label).toBe("Alpha");
    expect(bars[0]?.value).toBe(50000);
  });
});

describe("ipoListingVsCurrent", () => {
  it("includes only listed IPOs with both prices", () => {
    const rows = ipoListingVsCurrent([
      ipo({ id: "a", name: "Alpha", status: "Listed", listingPriceMinor: 10000, currentPriceMinor: 12000 }),
      ipo({ id: "b", name: "Beta", status: "Allotted", listingPriceMinor: 10000, currentPriceMinor: 12000 }),
    ]);
    expect(rows).toEqual([{ label: "Alpha", listing: 10000, current: 12000 }]);
  });
});
