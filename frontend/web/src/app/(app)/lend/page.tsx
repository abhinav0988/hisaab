import type { Metadata } from "next";
import { LendView } from "@/components/finance/lend-view";
export const metadata: Metadata = { title: "Borrow / Lend" };
export default function LendPage() {
  return <LendView />;
}
