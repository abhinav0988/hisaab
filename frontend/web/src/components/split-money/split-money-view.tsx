"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import "../../app/split-money.css";
import { CreateSplitWizard } from "./create-split-wizard";
import { ExpenseDetail } from "./expense-detail";
import { GroupsView, PeopleView } from "./groups-people";
import { ReceiptImportView } from "./receipt-import";
import { SplitDashboard } from "./split-dashboard";
import { SplitHistoryView } from "./split-history";

type View =
  | { kind: "dashboard" }
  | { kind: "create" }
  | { kind: "history" }
  | { kind: "groups" }
  | { kind: "people" }
  | { kind: "import" }
  | { kind: "expense"; id: string }
  | { kind: "settlements" };

function readExpenseId() {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("id");
}

function viewFromPath(pathname: string, expenseId: string | null): View {
  if (pathname.endsWith("/create")) return { kind: "create" };
  if (pathname.endsWith("/history")) return { kind: "history" };
  if (pathname.endsWith("/groups")) return { kind: "groups" };
  if (pathname.endsWith("/people")) return { kind: "people" };
  if (pathname.endsWith("/import-receipt")) return { kind: "import" };
  if (pathname.endsWith("/settlements")) return { kind: "settlements" };
  if (pathname.endsWith("/expense") && expenseId) return { kind: "expense", id: expenseId };
  return { kind: "dashboard" };
}

function sameView(a: View, b: View) {
  if (a.kind !== b.kind) return false;
  if (a.kind === "expense" && b.kind === "expense") return a.id === b.id;
  return true;
}

function pathForView(view: View) {
  switch (view.kind) {
    case "create":
      return "/split-money/create";
    case "history":
      return "/split-money/history";
    case "groups":
      return "/split-money/groups";
    case "people":
      return "/split-money/people";
    case "import":
      return "/split-money/import-receipt";
    case "settlements":
      return "/split-money/settlements";
    case "expense":
      return `/split-money/expense?id=${encodeURIComponent(view.id)}`;
    default:
      return "/split-money";
  }
}

export function SplitMoneyView() {
  const pathname = usePathname();
  const router = useRouter();
  const [view, setView] = useState<View>(() => viewFromPath(pathname, null));

  useEffect(() => {
    const sync = () => {
      const next = viewFromPath(pathname, readExpenseId());
      setView((prev) => (sameView(prev, next) ? prev : next));
    };
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, [pathname]);

  const go = (next: View) => {
    setView(next);
    router.push(pathForView(next));
  };

  if (view.kind === "create") {
    return (
      <CreateSplitWizard
        onClose={() => go({ kind: "dashboard" })}
        onCreated={(id) => go({ kind: "expense", id })}
      />
    );
  }
  if (view.kind === "expense") {
    return <ExpenseDetail expenseId={view.id} onBack={() => go({ kind: "dashboard" })} />;
  }
  if (view.kind === "history" || view.kind === "settlements") {
    return (
      <SplitHistoryView
        onBack={() => go({ kind: "dashboard" })}
        onOpenExpense={(id) => go({ kind: "expense", id })}
      />
    );
  }
  if (view.kind === "groups") {
    return <GroupsView onBack={() => go({ kind: "dashboard" })} />;
  }
  if (view.kind === "people") {
    return <PeopleView onBack={() => go({ kind: "dashboard" })} />;
  }
  if (view.kind === "import") {
    return (
      <ReceiptImportView
        onBack={() => go({ kind: "dashboard" })}
        onCreated={(id) => go({ kind: "expense", id })}
      />
    );
  }

  return (
    <SplitDashboard
      onCreate={() => go({ kind: "create" })}
      onOpenExpense={(id) => go({ kind: "expense", id })}
      onTab={(tab) => {
        if (tab === "groups") go({ kind: "groups" });
        if (tab === "people") go({ kind: "people" });
        if (tab === "history") go({ kind: "history" });
        if (tab === "settlements") go({ kind: "settlements" });
        if (tab === "import") go({ kind: "import" });
      }}
    />
  );
}
