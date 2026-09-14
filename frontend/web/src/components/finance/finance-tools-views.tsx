"use client";

import { Button, Card } from "@hisaab/ui";
import { ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { CardHead, ProLabel } from "@/components/layout/chrome";
import { PageHeader } from "@/components/layout/page-header";

export { InvestmentsView } from "@/components/investments/investments-view";
export { UpiCreditView } from "@/components/finance/upi-credit-view";
export { LendView } from "@/components/finance/lend-view";

export function CoachView() {
  return (
    <div>
      <PageHeader
        eyebrow="Premium"
        title="AI Financial Coach"
        description="Ask questions about spending, saving, debt and goals. This coach unlocks with Hisaab Premium."
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,.8fr)]">
        <Card className="oc-card">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="m-0 text-[18px] font-semibold">Ask Hisaab AI</h2>
            <ProLabel />
          </div>
          <p className="text-sm leading-relaxed text-[var(--muted-foreground)]">
            The live coach stays gated. Explore Premium for personalised recommendations. This page
            will not start a trial or change your plan.
          </p>
          <Button
            className="mt-4"
            onClick={() => toast.info("AI Financial Coach is included with Hisaab Premium.")}
          >
            <Sparkles size={16} /> Ask Hisaab AI
          </Button>
        </Card>
        <Card className="oc-card">
          <CardHead title="Suggested questions" />
          <div className="oc-actions">
            {[
              "Can I afford a ₹20,000 purchase?",
              "Which category should I reduce?",
              "How much should I invest monthly?",
            ].map((question) => (
              <button
                key={question}
                type="button"
                className="oc-action"
                onClick={() => toast.info("AI Financial Coach is included with Hisaab Premium.")}
              >
                {question}
              </button>
            ))}
          </div>
          <Link href="/premium" className="oc-link mt-4 inline-flex">
            Explore Premium <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </Card>
      </div>
    </div>
  );
}
