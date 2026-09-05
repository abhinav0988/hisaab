import type { Metadata } from "next";
import { SchedulesView } from "@/components/recurring/schedules-view";

export const metadata: Metadata = { title: "Recurring" };

export default function SchedulesPage() {
  return <SchedulesView />;
}
