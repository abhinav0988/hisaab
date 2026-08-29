"use client";
import { Button, Card } from "@hisaab/ui";
import { useState } from "react";
import { toast } from "sonner";
import { ProLabel, ProgressBar } from "@/components/layout/chrome";
import { Modal } from "@/components/layout/modal";

const features = [
  ["▥", "Advanced analytics", "Long-term trends, deep category views, comparisons and financial health scoring."],
  ["✦", "Smart insights", "Personalized observations, anomaly detection and practical saving opportunities."],
  ["▣", "Receipt capture", "Scan receipts and prepare transaction details automatically."],
  ["∞", "Unlimited history", "Explore, search and export every month without time restrictions."],
  ["⌂", "Private household", "Share selected budgets and goals safely with trusted family members."],
  ["↻", "Custom automation", "Rules for categories, recurring bills, alerts, savings and goal contributions."],
  ["⌁", "Bill intelligence", "Detect subscriptions, recurring bills and upcoming payment changes."],
  ["◴", "Forecasting", "Predict month-end balance, category overspend risk and safe-to-spend pace."],
  ["⇩", "Premium exports", "Export clean CSV and printable monthly summaries for personal records."],
] as const;

export function PremiumView() {
  const [compare, setCompare] = useState(false);
  return (
    <div>
      <div className="grid items-center gap-[30px] rounded-[30px] bg-[radial-gradient(circle_at_85%_20%,rgba(235,203,135,.24),transparent_28%),linear-gradient(135deg,#0d3725,#226a47)] p-6 text-[#f2fff6] shadow-[0_25px_70px_rgba(8,55,34,.25)] sm:p-9 lg:grid-cols-[1.1fr_.9fr]">
        <div>
          <ProLabel>◆ HISAAB PREMIUM</ProLabel>
          <h1 className="my-3 text-[clamp(28px,8vw,46px)] font-semibold tracking-[-0.05em]">
            Deeper clarity.
            <br />
            Smarter decisions.
          </h1>
          <p className="max-w-xl text-sm leading-relaxed text-[#cae8d4]">
            Unlock advanced analytics, intelligent alerts, unlimited history, receipt capture,
            automation, forecasts and tools that actively help you save.
          </p>
          <div className="mt-[18px] flex flex-wrap gap-2">
            <Button
              className="bg-[#effff5] text-[#123b28] shadow-none"
              onClick={() => toast.success("14-day trial will start once billing is connected.")}
            >
              Start 14-day free trial
            </Button>
            <Button
              variant="secondary"
              className="border-white/25 bg-transparent text-white hover:bg-white/10"
              onClick={() => setCompare(true)}
            >
              Compare plans
            </Button>
          </div>
        </div>
        <div className="rounded-3xl border border-white/16 bg-white/[.09] p-[26px] backdrop-blur-[10px]">
          <div className="text-[11px] text-[#cae7d4]">Premium plan</div>
          <div className="text-[clamp(28px,10vw,42px)] font-black [overflow-wrap:anywhere]">
            ₹149 <small className="text-xs font-semibold text-[#d4eadb]">/ month</small>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-[#cae8d4]">
            INR ₹149 · NPR रु 239 · PKR Rs 499 · BDT ৳ 199 per month. Yearly from ₹1,499. Cancel anytime.
          </p>
          <ProgressBar className="mt-4 bg-white/12" value={100} tone="gold" />
          <small className="mt-2 block text-[#d5eadc]">Cancel anytime · No lock-in</small>
        </div>
      </div>
      <div className="mt-[18px] grid gap-[18px] sm:grid-cols-2 xl:grid-cols-3">
        {features.map(([icon, title, body]) => (
          <Card key={title} className="interactive-card p-[22px]">
            <span className="grid size-[46px] place-items-center rounded-[15px] bg-[var(--gold-soft)] text-[var(--gold)]">
              {icon}
            </span>
            <h3 className="mb-1 mt-[15px] text-[15px] font-semibold">{title}</h3>
            <p className="m-0 text-[11px] leading-[1.65] text-[var(--muted-foreground)]">{body}</p>
          </Card>
        ))}
      </div>
      <Modal open={compare} onClose={() => setCompare(false)} title="Compare plans">
        <div className="grid gap-3 sm:grid-cols-2">
          <Card className="p-[22px]">
            <h3 className="text-sm font-semibold">Free</h3>
            <div className="mt-2 text-2xl font-black">₹0</div>
            <p className="mt-2 text-xs text-[var(--muted-foreground)]">
              Core tracking, budgets and goals.
            </p>
          </Card>
          <Card className="border-[var(--gold)] p-[22px]">
            <ProLabel>RECOMMENDED</ProLabel>
            <h3 className="mt-2 text-sm font-semibold">Premium</h3>
            <div className="mt-2 text-2xl font-black">₹149</div>
            <p className="mt-2 text-xs text-[var(--muted-foreground)]">
              Analytics, forecasts, automation, receipt scan, unlimited history and exports.
            </p>
          </Card>
        </div>
      </Modal>
    </div>
  );
}
