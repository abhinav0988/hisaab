import type { Metadata } from "next";
import { CardsView } from "@/components/finance/cards-view";
export const metadata: Metadata = { title: "Credit Cards" };
export default function CardsPage() {
  return <CardsView />;
}
