import Link from "next/link";
import { Gem } from "lucide-react";
import { HisaabMark, Logo } from "./logo";
import { ThemeToggle } from "./theme-toggle";

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh overflow-x-hidden bg-[var(--background)] lg:grid-cols-[minmax(460px,1.08fr)_minmax(440px,0.92fr)]">
      <section className="relative isolate hidden min-h-dvh flex-col justify-between overflow-hidden bg-gradient-to-br from-[#082d1e] via-[#0d422b] to-[#1f7650] p-10 text-[#f7fff9] xl:p-[54px_58px] lg:flex">
        <div className="pointer-events-none absolute inset-0 -z-20 bg-[radial-gradient(circle_at_18%_13%,rgba(247,215,148,.24),transparent_25%),radial-gradient(circle_at_82%_82%,rgba(123,220,164,.18),transparent_30%)]" />
        <div className="pointer-events-none absolute -right-[220px] top-[14%] -z-10 size-[560px] rounded-full border border-white/8 shadow-[0_0_0_60px_rgba(255,255,255,.025),0_0_0_130px_rgba(255,255,255,.018)]" />
        <Logo inverse compact />
        <div className="max-w-[700px]">
          <div className="inline-flex w-max items-center gap-2 rounded-full border border-[rgba(245,218,153,.24)] bg-white/10 px-2.5 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.11em] text-[#f4d58e] backdrop-blur">
            <Gem size={12} aria-hidden="true" /> Premium money intelligence
          </div>
          <h1 className="mt-4 max-w-[720px] text-[clamp(48px,5vw,74px)] font-semibold leading-[0.92] tracking-[-0.07em]">
            Money clarity
            <br />
            that feels effortless.
          </h1>
          <p className="mt-5 max-w-[590px] text-sm leading-[1.75] text-[#cde8d6]">
            A private financial command center for spending, budgets, goals and smarter
            decisions—designed to make every rupee easier to understand.
          </p>
          <div className="mt-8 w-full max-w-[620px] rounded-[26px] border border-white/12 bg-white/[.075] p-[15px] shadow-[0_30px_70px_rgba(0,0,0,.18)] backdrop-blur-md">
            <div className="flex items-center justify-between px-1 pb-3 text-[10px] text-[#cde6d5]">
              <span>Your financial pulse</span>
              <span>● Live</span>
            </div>
            <div className="rounded-[18px] border border-white/8 bg-[rgba(7,37,24,.42)] p-[18px]">
              <small className="text-[#b9d8c5]">Safe to spend this month</small>
              <strong className="mt-1 block text-[30px] tracking-[-0.04em]">₹18,450</strong>
              <div className="mt-2.5 grid grid-cols-3 gap-2">
                {[
                  ["Saved", "₹53,450"],
                  ["Budget used", "63%"],
                  ["Goal pace", "On track"],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-[14px] bg-white/8 p-2.5">
                    <small className="block text-[9px] text-[#b9d8c5]">{label}</small>
                    <b className="mt-1 block text-xs">{value}</b>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          {[
            ["Bank-grade mindset", "Private-by-design experience"],
            ["4 currencies", "Built for South Asia"],
            ["Smart insights", "Simple, useful guidance"],
          ].map(([title, copy]) => (
            <div
              key={title}
              className="rounded-2xl border border-white/13 bg-white/[.055] px-[15px] py-3.5 backdrop-blur-sm"
            >
              <b className="block text-base">{title}</b>
              <small className="mt-1 block text-[9px] text-[#bddac7]">{copy}</small>
            </div>
          ))}
        </div>
      </section>
      <section
        className="relative flex min-h-dvh flex-col items-center justify-start overflow-y-auto bg-[radial-gradient(circle_at_90%_0%,color-mix(in_srgb,var(--mint)_55%,transparent),transparent_30%),var(--background)] px-3 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-[max(4rem,calc(3rem+env(safe-area-inset-top)))] sm:px-[22px]"
        data-auth-panel
      >
        <ThemeToggle className="absolute right-5 top-5 z-10 sm:right-7 sm:top-7" />
        <div className="pointer-events-none absolute inset-[22px] rounded-[30px] border border-[color-mix(in_srgb,var(--border)_76%,transparent)] max-sm:inset-2.5 max-sm:rounded-[24px]" />
        <div className="relative z-0 my-auto flex w-full flex-col items-center">
          <div
            className="auth-shell-card relative w-full rounded-[34px] border border-[color-mix(in_srgb,var(--border)_84%,transparent)] bg-gradient-to-b from-[color-mix(in_srgb,var(--surface)_98%,white)] to-[color-mix(in_srgb,var(--surface-2)_96%,white)] p-6 shadow-[0_28px_80px_rgba(12,34,22,.10)] backdrop-blur-xl transition-[max-width,padding] sm:p-9"
            data-auth-card
          >
            <div className="mb-6 flex lg:hidden">
              <div className="flex items-center gap-3 text-[22px] font-black tracking-[-0.04em]">
                <HisaabMark />
                Hisaab
              </div>
            </div>
            {children}
          </div>
          <p
            className="relative mt-8 max-w-lg px-4 text-center text-[11px] text-[var(--muted-foreground)]"
            data-auth-legal
          >
            By continuing, you agree to Hisaab’s{" "}
            <Link href="/terms" className="font-semibold text-[var(--foreground)]">
              Terms
            </Link>{" "}
            &{" "}
            <Link href="/privacy" className="font-semibold text-[var(--foreground)]">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </section>
    </main>
  );
}
