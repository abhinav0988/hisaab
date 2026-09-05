import { redirect } from "next/navigation";

/** Legacy route — Recurring merged into Bills & Reminders. */
export default function SchedulesRedirectPage() {
  redirect("/recurring");
}
