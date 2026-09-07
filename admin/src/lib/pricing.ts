import type { AppSettings } from "./settings";

export function calcAmount(
  format: string,
  hours: number | null | undefined,
  settings: AppSettings,
): number {
  const t = settings.tariffs;
  switch (format) {
    case "hour_1":
      return t.hour_1;
    case "hour_3":
      return t.hour_3;
    case "half_day":
      return t.half_day;
    case "full_day":
      return t.full_day;
    case "adaptation":
      return t.adaptation;
    case "other": {
      const h = Number(hours) || 0;
      if (h <= 0) return 0;
      if (h < 3) return Math.round(h * t.extra_per_hour);
      return Math.round(t.hour_3 + (h - 3) * t.extra_per_hour_above3);
    }
    default:
      return 0;
  }
}

export function actualStayMinutes(checkInAt?: string | null, checkOutAt?: string | null): number | null {
  if (!checkInAt || !checkOutAt) return null;
  const start = new Date(checkInAt).getTime();
  const end = new Date(checkOutAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  return Math.round((end - start) / 60000);
}

export function bookingStartDateTime(visitDate?: string | null, visitTime?: string | null): string | null {
  if (!visitDate) return null;
  const time = visitTime ? visitTime.slice(0, 5) : "00:00";
  const date = new Date(`${visitDate}T${time}:00`);
  if (isNaN(date.getTime())) return null;
  return date.toISOString();
}

export function formatDuration(minutes: number | null | undefined): string {
  if (!minutes || minutes <= 0) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} хв`;
  if (m === 0) return `${h} год`;
  return `${h} год ${m} хв`;
}

export function calcActualAmountByTime(
  format: string,
  checkInAt: string | null | undefined,
  checkOutAt: string | null | undefined,
  settings: AppSettings,
): number | null {
  const minutes = actualStayMinutes(checkInAt, checkOutAt);
  if (!minutes) return null;
  if (format === "full_day") return settings.tariffs.full_day;
  if (format === "half_day") return settings.tariffs.half_day;
  if (format === "adaptation") return settings.tariffs.adaptation;
  if (format === "hour_1" && minutes <= 60) return settings.tariffs.hour_1;
  if (format === "hour_3" && minutes <= 180) return settings.tariffs.hour_3;

  const billedHours = Math.max(1, Math.ceil(minutes / 60));
  return calcAmount("other", billedHours, settings);
}

export function calcExtraDue(
  currentAmount: number | null | undefined,
  format: string,
  checkInAt: string | null | undefined,
  checkOutAt: string | null | undefined,
  settings: AppSettings,
  booking?: { subscription_id?: string | null; amount_override?: boolean; status?: string },
): number {
  // Package payments and an administrator's agreed total must not be repriced.
  if (booking?.subscription_id || booking?.amount_override || booking?.status === "Скасовано" || booking?.status === "Не прийшли") return 0;
  const actualAmount = calcActualAmountByTime(format, checkInAt, checkOutAt, settings);
  if (actualAmount == null) return 0;
  return Math.max(0, actualAmount - Number(currentAmount ?? 0));
}

export function formatUAH(n: number | null | undefined): string {
  const v = Number(n ?? 0);
  return `${v.toLocaleString("uk-UA")} ₴`;
}

export function formatDate(d: string | null | undefined): string {
  if (!d) return "—";
  const date = new Date(d);
  if (isNaN(date.getTime())) return d;
  return date.toLocaleDateString("uk-UA");
}

export function formatTime(t: string | null | undefined): string {
  if (!t) return "";
  return t.slice(0, 5);
}

export function formatDateTime(t: string | null | undefined): string {
  if (!t) return "—";
  const date = new Date(t);
  if (isNaN(date.getTime())) return t;
  return date.toLocaleString("uk-UA", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
