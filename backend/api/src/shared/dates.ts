export function zonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(value.year),
    month: Number(value.month),
    day: Number(value.day),
    hour: Number(value.hour),
    minute: Number(value.minute),
    second: Number(value.second),
  };
}

export function zonedDateToUtc(year: number, month: number, day: number, timeZone: string) {
  const target = Date.UTC(year, month - 1, day);
  let candidate = target;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const local = zonedParts(new Date(candidate), timeZone);
    const represented = Date.UTC(
      local.year,
      local.month - 1,
      local.day,
      local.hour,
      local.minute,
      local.second,
    );
    candidate += target - represented;
  }
  return new Date(candidate);
}

export function monthBounds(month: string, timeZone: string) {
  const [yearText, monthText] = month.split("-");
  const year = Number(yearText);
  const value = Number(monthText);
  if (!year || value < 1 || value > 12) throw new Error("Invalid month");
  const nextYear = value === 12 ? year + 1 : year;
  const nextMonth = value === 12 ? 1 : value + 1;
  return {
    from: zonedDateToUtc(year, value, 1, timeZone).toISOString(),
    to: zonedDateToUtc(nextYear, nextMonth, 1, timeZone).toISOString(),
  };
}

export function currentMonth(timeZone: string, date = new Date()) {
  const part = zonedParts(date, timeZone);
  return `${part.year}-${String(part.month).padStart(2, "0")}`;
}
export function addFrequency(iso: string, frequency: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY") {
  const date = new Date(iso);
  if (frequency === "DAILY") date.setUTCDate(date.getUTCDate() + 1);
  if (frequency === "WEEKLY") date.setUTCDate(date.getUTCDate() + 7);
  if (frequency === "MONTHLY") date.setUTCMonth(date.getUTCMonth() + 1);
  if (frequency === "YEARLY") date.setUTCFullYear(date.getUTCFullYear() + 1);
  return date.toISOString();
}
