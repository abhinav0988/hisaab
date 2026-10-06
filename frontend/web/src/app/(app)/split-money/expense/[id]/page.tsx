import type { Metadata } from "next";
import { SplitMoneyView } from "@/components/split-money/split-money-view";

export const metadata: Metadata = { title: "Split Money" };

export default function SplitMoneyEntityPage() {
  return <SplitMoneyView />;
}
