import { RecurringView } from "@/components/recurring/recurring-view";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Bills & Reminders" };

export default function RecurringPage() {
  return <RecurringView />;
}
