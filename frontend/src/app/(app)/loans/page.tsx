import type { Metadata } from "next";
import { LoansView } from "@/components/finance/loans-view";
export const metadata: Metadata = { title: "EMI & Loans" };
export default function LoansPage() {
  return <LoansView />;
}
