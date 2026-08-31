import type { Metadata } from "next";
import { IpoView } from "@/components/finance/finance-tools-views";
export const metadata: Metadata = { title: "IPO Tracker" };
export default function IpoPage() {
  return <IpoView />;
}
