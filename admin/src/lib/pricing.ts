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