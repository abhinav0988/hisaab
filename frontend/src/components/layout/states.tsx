import { Button, Card } from "@hisaab/ui";
import { Inbox, TriangleAlert } from "lucide-react";
export function PageSkeleton() {
  return (
    <div className="grid gap-5">
      <div className="skeleton h-10 w-64 rounded-xl" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="skeleton h-32 rounded-2xl" />
        ))}
      </div>
      <div className="skeleton h-80 rounded-2xl" />
    </div>
  );
}
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <Card className="grid place-items-center p-10 text-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-[var(--muted)] text-[var(--muted-foreground)]">
        <Inbox />
      </span>
      <h3 className="mt-4 font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-[var(--muted-foreground)]">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </Card>
  );
}
export function ErrorState({ retry }: { retry: () => void }) {
  return (
    <Card className="grid place-items-center p-10 text-center">
      <TriangleAlert className="text-[var(--danger)]" />
      <h3 className="mt-4 font-semibold">We couldn’t load this page</h3>
      <p className="mt-1 text-sm text-[var(--muted-foreground)]">
        Check your connection and try again.
      </p>
      <Button className="mt-5" variant="secondary" onClick={retry}>
        Try again
      </Button>
    </Card>
  );
}
