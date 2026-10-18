/** Local calendar helpers — avoid UTC day shifts from ISO string slicing. */

export function localDateKey(value: string | Date = new Date()) {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return localDateKey(new Date());
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function localTimeKey(value: string | Date = new Date()) {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "12:00";
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

/** Combine local YYYY-MM-DD + HH:mm into an offset ISO string for the API. */
export function combineLocalDateTime(dateKey: string, timeKey: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey.trim());
  const time = /^(\d{1,2}):(\d{2})$/.exec(timeKey.trim());
  if (!match || !time) throw new Error("Enter a valid date and time.");
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hours = Number(time[1]);
  const minutes = Number(time[2]);
  const local = new Date(year, month - 1, day, hours, minutes, 0, 0);
  if (
    Number.isNaN(local.getTime()) ||
    local.getFullYear() !== year ||
    local.getMonth() !== month - 1 ||
    local.getDate() !== day
  ) {
    throw new Error("Enter a valid date and time.");
  }
  return local.toISOString();
}

export function startOfLocalDay(dateKey: string) {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(y!, m! - 1, d!, 0, 0, 0, 0);
}

export function endOfLocalDay(dateKey: string) {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(y!, m! - 1, d!, 23, 59, 59, 999);
}

export function shiftLocalDateKey(dateKey: string, days: number) {
  const date = startOfLocalDay(dateKey);
  date.setDate(date.getDate() + days);
  return localDateKey(date);
}

export function formatDisplayDate(dateKey: string) {
  const date = startOfLocalDay(dateKey);
  return date.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatCompactTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

/** Relative day + time for recent lists (Today · 9:57 am / Yesterday · … / 17 Oct · …). */
export function formatCompactDateTime(iso: string, todayKey = localDateKey()) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const day = groupLabelForDateKey(localDateKey(date), todayKey);
  const shortDay =
    day === "Today" || day === "Yesterday"
      ? day
      : date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  return `${shortDay} · ${formatCompactTime(iso)}`;
}

export function groupLabelForDateKey(dateKey: string, todayKey = localDateKey()) {
  if (dateKey === todayKey) return "Today";
  if (dateKey === shiftLocalDateKey(todayKey, -1)) return "Yesterday";
  return formatDisplayDate(dateKey);
}
