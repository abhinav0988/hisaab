import type { Metadata } from "next";
import { InvestmentsView } from "@/components/finance/finance-tools-views";
export const metadata: Metadata = { title: "Investments" };
export default function InvestmentsPage() {
  return <InvestmentsView />;
}
