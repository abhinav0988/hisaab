"use client";

import {
  BriefcaseBusiness,
  Building2,
  Bus,
  ChartNoAxesCombined,
  CircleDollarSign,
  Clapperboard,
  Gift,
  GraduationCap,
  HeartPulse,
  House,
  Laptop,
  Plane,
  Plug,
  RotateCcw,
  Shapes,
  ShoppingBag,
  ShoppingBasket,
  Sparkles,
  Tag,
  Utensils,
  Users,
  type LucideIcon,
} from "lucide-react";

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  briefcasebusiness: BriefcaseBusiness,
  building2: Building2,
  bus: Bus,
  chartnoaxescombined: ChartNoAxesCombined,
  circledollarsign: CircleDollarSign,
  clapperboard: Clapperboard,
  gift: Gift,
  graduationcap: GraduationCap,
  heartpulse: HeartPulse,
  house: House,
  laptop: Laptop,
  plane: Plane,
  plug: Plug,
  rotateccw: RotateCcw,
  shapes: Shapes,
  shoppingbag: ShoppingBag,
  shoppingbasket: ShoppingBasket,
  sparkles: Sparkles,
  tag: Tag,
  utensils: Utensils,
  users: Users,
};

function normalizeIconName(name: string) {
  return name.replace(/[-_\s]/g, "").toLowerCase();
}

export function CategoryGlyph({
  name,
  className,
  size = 18,
}: {
  name?: string | null;
  className?: string;
  size?: number;
}) {
  const Icon = name ? CATEGORY_ICONS[normalizeIconName(name)] : undefined;
  if (Icon) {
    return <Icon size={size} strokeWidth={2.25} className={className} aria-hidden />;
  }
  if (name && [...name].length <= 2) {
    return (
      <span className={className} aria-hidden>
        {name}
      </span>
    );
  }
  return <Tag size={size} strokeWidth={2.25} className={className} aria-hidden />;
}
