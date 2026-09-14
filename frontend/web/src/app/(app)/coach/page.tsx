import type { Metadata } from "next";
import { CoachView } from "@/components/finance/finance-tools-views";
export const metadata: Metadata = { title: "AI Financial Coach" };
export default function CoachPage() {
  return <CoachView />;
}
