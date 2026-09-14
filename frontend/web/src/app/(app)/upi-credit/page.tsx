import type { Metadata } from "next";
import { UpiCreditView } from "@/components/finance/upi-credit-view";
export const metadata: Metadata = { title: "UPI Credit" };
export default function UpiCreditPage() {
  return <UpiCreditView />;
}
