export function money(minor: number, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(minor / 100);
}

export function signedMoney(minor: number, currency: string, type: "INCOME" | "EXPENSE") {
  return `${type === "INCOME" ? "+ " : "− "}${money(minor, currency)}`;
}

function asDate(value: string | Date) {
  return value instanceof Date ? value : new Date(value);
}

/** Local calendar YYYY-MM-DD — do not use toISOString() for day keys (UTC shift). */
export function localDateKey(value: string | Date) {
  const date = asDate(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function sameCalendarYear(value: Date, now = new Date()) {
  return value.getFullYear() === now.getFullYear();
}

export function compactTime(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  }).format(asDate(value));
}

export function transactionStamp(value: string) {
  const date = asDate(value);
  const day = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
  const time = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
  return `${day}, ${time}`;
}

export function dateTime(value: string) {
  const date = asDate(value);
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    ...(sameCalendarYear(date) ? {} : { year: "numeric" }),
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function dayGroupLabel(value: string) {
  const date = asDate(value);
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    ...(sameCalendarYear(date) ? {} : { year: "numeric" }),
  }).format(date);
}

export function longDate(value = new Date()) {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(value);
}

export function greetingForHour(hour = new Date().getHours()) {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
