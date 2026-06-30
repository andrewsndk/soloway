import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export type Tariffs = {
  hour_1: number;
  hour_3: number;
  full_day: number;
  adaptation: number;
  extra_per_hour: number;
  extra_per_hour_above3: number;
};

export type FormatOption = { key: string; label: string };

export type AppSettings = {
  tariffs: Tariffs;
  formats: FormatOption[];
  sources: string[];
  extra_services: string[];
  statuses: string[];
};

export const DEFAULT_SETTINGS: AppSettings = {
  tariffs: {
    hour_1: 180,
    hour_3: 450,
    full_day: 950,
    adaptation: 0,
    extra_per_hour: 180,
    extra_per_hour_above3: 150,
  },
  formats: [
    { key: "hour_1", label: "На 1 годину" },
    { key: "hour_3", label: "На 3 години" },
    { key: "full_day", label: "Повний день" },
    { key: "adaptation", label: "Адаптація" },
    { key: "other", label: "Інша кількість годин" },
  ],
  sources: ["Instagram", "Телефон", "Сайт", "Рекомендація", "Facebook", "Telegram", "Інше"],
  extra_services: [
    "Обід",
    "Перекус",
    "Майстер-клас",
    "Творче заняття",
    "Англійська",
    "Раннє прибуття",
    "Пізніше забирання",
    "Фотозвіт",
  ],
  statuses: ["Нове", "Підтверджено", "Завершено", "Скасовано"],
};

export async function fetchSettings(): Promise<AppSettings> {
  const { data, error } = await supabase
    .from("app_settings")
    .select("data")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return DEFAULT_SETTINGS;
  return { ...DEFAULT_SETTINGS, ...(data.data as Partial<AppSettings>) };
}

export async function saveSettings(s: AppSettings): Promise<void> {
  const { error } = await supabase
    .from("app_settings")
    .upsert({ id: 1, data: s as unknown as Json });
  if (error) throw error;
}

export function formatLabel(formats: FormatOption[], key: string): string {
  return formats.find((f) => f.key === key)?.label ?? key;
}