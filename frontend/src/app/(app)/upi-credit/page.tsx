import type { Metadata } from "next";
import { UpiCreditView } from "@/components/finance/finance-tools-views";
export const metadata: Metadata = { title: "UPI Credit" };
export default function UpiCreditPage() {
  return <UpiCreditView />;
}
