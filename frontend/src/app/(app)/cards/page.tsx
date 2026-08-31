import type { Metadata } from "next";
import { CardsView } from "@/components/finance/finance-tools-views";
export const metadata: Metadata = { title: "Credit Cards" };
export default function CardsPage() {
  return <CardsView />;
}
