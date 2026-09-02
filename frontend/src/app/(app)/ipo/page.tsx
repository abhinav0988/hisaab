import type { Metadata } from "next";
import { IpoView } from "@/components/finance/ipo-view";
export const metadata: Metadata = { title: "IPO Tracker" };
export default function IpoPage() {
  return <IpoView />;
}
