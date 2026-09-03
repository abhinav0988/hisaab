"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Search, Target, WalletCards } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CategoryGlyph } from "@/components/finance/category-glyph";
import { money } from "@/lib/format";
import { budgetService } from "@/services/budget.service";
import { categoryService } from "@/services/category.service";
import { goalService } from "@/services/goal.service";
import { desktopNavigation } from "./nav-config";

type SearchItem = {
  label: string;
  sub: string;
  type: string;
  icon: ReactNode;
  href: string;
};

export function GlobalSearch() {
  const router = useRouter();
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const month = useMemo(() => new Date().toISOString().slice(0, 7), []);
  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: () => categoryService.list(),
    enabled: open,
  });
  const budgets = useQuery({
    queryKey: ["budgets", month],
    queryFn: () => budgetService.list(month),
    enabled: open,
  });
  const goals = useQuery({
    queryKey: ["goals"],
    queryFn: () => goalService.list(),
    enabled: open,
    retry: false,
  });
  const items = useMemo(() => {
    const pages: SearchItem[] = desktopNavigation.map((item) => ({
      label: item.label,
      sub: item.hint,
      type: item.href === "/premium" ? "Feature" : "Page",
      icon: <item.icon size={17} aria-hidden="true" />,
      href: item.href,
    }));
    const cats: SearchItem[] = (categories.data ?? []).map((item) => ({
      label: item.name,
      sub: `View ${item.name} category activity`,
      type: "Category",
      icon: <CategoryGlyph name={item.icon || item.name} size={17} />,
      href: `/transactions?q=${encodeURIComponent(item.name)}`,
    }));
    const limits: SearchItem[] = (budgets.data ?? [])
      .filter((item) => item.categoryName)
      .map((item) => ({
        label: `${item.categoryName} budget`,
        sub: `${Math.round(item.percentageUsed)}% of monthly limit used`,
        type: "Budget",
        href: "/budgets",
        icon: <WalletCards size={17} aria-hidden="true" />,
      }));
    const savings: SearchItem[] = (goals.data ?? []).map((item) => ({
      label: item.name,
      sub: `${money(item.savedAmountMinor, item.currency)} of ${money(item.targetAmountMinor, item.currency)} saved`,
      type: "Goal",
      href: "/goals",
      icon: item.icon ? <CategoryGlyph name={item.icon} size={17} /> : <Target size={17} aria-hidden="true" />,
    }));
    const all = [...pages, ...cats, ...limits, ...savings];
    const q = query.trim().toLowerCase();
    if (q) {
      return all.filter((item) =>
        `${item.label} ${item.sub} ${item.type}`.toLowerCase().includes(q),
      );
    }
    const pick = (type: string) => all.find((item) => item.type === type);
    return [
      pages.find((item) => item.href === "/transactions"),
      pick("Category"),
      pick("Budget"),
      pick("Goal"),
      pages.find((item) => item.href === "/reports"),
      pages.find((item) => item.href === "/premium"),
      pages.find((item) => item.href === "/settings"),
    ].filter((item): item is SearchItem => Boolean(item));
  }, [categories.data, budgets.data, goals.data, query]);
  const [trackedQuery, setTrackedQuery] = useState(query);
  if (query !== trackedQuery) {
    setTrackedQuery(query);
    setIndex(0);
  }
  const safeIndex = Math.min(index, Math.max(0, items.length - 1));
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);
  const go = (item?: SearchItem) => {
    if (item) router.push(item.href);
    else router.push(`/transactions?q=${encodeURIComponent(query.trim())}`);
    setOpen(false);
  };
  return (
    <div
      ref={wrapRef}
      className={`topbar-search relative hidden min-w-0 max-w-[620px] flex-1 lg:block${open ? " search-open" : ""}`}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          go(items[safeIndex]);
        }}
      >
        <div className="search-shell">
          <span className="search-icon" aria-hidden="true">
            <Search size={16} />
          </span>
          <input
            ref={inputRef}
            name="q"
            role="combobox"
            autoComplete="off"
            placeholder="Search anything in Hisaab..."
            aria-label="Search Hisaab"
            aria-expanded={open}
            aria-controls="global-search-results"
            aria-autocomplete="list"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setIndex((value) => Math.min(value + 1, Math.max(0, items.length - 1)));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setIndex((value) => Math.max(0, value - 1));
              } else if (event.key === "Escape") {
                setOpen(false);
                inputRef.current?.blur();
              }
            }}
          />
          <span className="search-shortcut">⌘ K</span>
        </div>
      </form>
      <div className="search-panel" id="global-search-results" role="listbox">
        <div className="search-panel-head">
          <b>Quick search</b>
          <small>Transactions, budgets, goals & features</small>
        </div>
        <div className="search-results">
          {items.length ? (
            items.map((item, i) => (
              <button
                key={`${item.type}-${item.href}-${item.label}`}
                type="button"
                role="option"
                aria-selected={i === safeIndex}
                className={`search-result${i === safeIndex ? " active" : ""}`}
                onMouseEnter={() => setIndex(i)}
                onClick={() => go(item)}
              >
                <span className="search-result-icon">{item.icon}</span>
                <span>
                  <b>{item.label}</b>
                  <small>{item.sub}</small>
                </span>
                <span className="search-result-type">{item.type}</span>
                <ArrowRight className="search-result-arrow" size={14} aria-hidden="true" />
              </button>
            ))
          ) : (
            <div className="search-empty">No matching item. Press Enter to search your transactions.</div>
          )}
        </div>
        <div className="search-footer">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> Navigate
          </span>
          <span>
            <kbd>Enter</kbd> Open
          </span>
        </div>
      </div>
    </div>
  );
}
