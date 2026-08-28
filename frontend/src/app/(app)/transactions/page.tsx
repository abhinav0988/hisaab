import { Suspense } from "react";
import { PageSkeleton } from "@/components/layout/states";
import { TransactionsView } from "@/components/transactions/transactions-view";
export default function TransactionsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <TransactionsView />
    </Suspense>
  );
}
