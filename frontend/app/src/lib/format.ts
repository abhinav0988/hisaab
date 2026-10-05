export function money(amountMinor: number, currency = "INR") {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amountMinor / 100);
  } catch {
    return `₹${(amountMinor / 100).toLocaleString("en-IN")}`;
  }
}

export function signedMoney(amountMinor: number, currency = "INR", type: "INCOME" | "EXPENSE" | "TRANSFER") {
  const value = money(Math.abs(amountMinor), currency);
  if (type === "INCOME") return `+ ${value}`;
  if (type === "EXPENSE") return `- ${value}`;
  return value;
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function localDateKey(value: string | Date = new Date()) {
  const date = typeof value === "string" ? new Date(value) : value;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
