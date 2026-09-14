import type { Metadata } from "next";
import { BankView } from "@/components/bank/bank-view";

export const metadata: Metadata = { title: "Bank" };

export default function BankPage() {
  return <BankView />;
}
