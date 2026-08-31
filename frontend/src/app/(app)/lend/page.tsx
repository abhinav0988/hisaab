import type { Metadata } from "next";
import { LendView } from "@/components/finance/finance-tools-views";
export const metadata: Metadata = { title: "Borrow / Lend" };
export default function LendPage() {
  return <LendView />;
}
