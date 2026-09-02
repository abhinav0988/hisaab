import { Eyebrow } from "./chrome";
import {
  BarChart3,
  BellRing,
  CircleDollarSign,
  CreditCard,
  HandCoins,
  Landmark,
  LineChart,
  PiggyBank,
  ReceiptText,
  Settings2,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Target,
  UserRound,
  type LucideIcon,
} from "lucide-react";

const pageIcons: Record<string, LucideIcon> = {
  accounts: Landmark,
  bank: Landmark,
  analytics: BarChart3,
  "bills & reminders": BellRing,
  recurring: BellRing,
  "borrow / lend": HandCoins,
  "credit cards": CreditCard,
  investments: LineChart,
  "ipo tracker": ReceiptText,
  "savings goals": Target,
  "spending limits": PiggyBank,
  "upi credit": Smartphone,
  "emi & loans": CircleDollarSign,
  profile: UserRound,
  settings: Settings2,
  categories: ShieldCheck,
};

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
}) {
  const Icon = pageIcons[title.toLowerCase()] ?? Sparkles;
  return (
    <header className="feature-page-header">
      <div className="feature-page-copy">
        <span className="feature-page-icon" aria-hidden="true">
          <Icon size={22} strokeWidth={1.9} />
        </span>
        <div className="min-w-0">
          {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
          <h1 className="m-0 text-[clamp(27px,7vw,39px)] font-semibold leading-[1.08] tracking-[-0.055em]">
            {title}
          </h1>
          <p className="mt-[9px] max-w-[760px] text-[14px] leading-[1.65] text-[var(--muted-foreground)]">
            {description}
          </p>
        </div>
      </div>
      {actions ? <div className="feature-page-actions">{actions}</div> : null}
    </header>
  );
}
