import { supabase } from "@/integrations/supabase/client";

export type SoloInsight = {
  remember: string;
  ask: string;
  activity: string;
  watchOut: string;
};

export type SoloInsightResult =
  | { status: "empty"; sourceCount: 0 }
  | {
      status: "ready";
      insight: SoloInsight;
      sourceCount: number;
      generatedAt: string;
      cached: boolean;
    };

export async function fetchSoloInsight(
  clientId: string,
  force = false,
): Promise<SoloInsightResult> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("Сесія закінчилась. Увійдіть в адмінку ще раз.");

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const publishableKey =
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !publishableKey) throw new Error("Supabase не налаштований.");

  const response = await fetch(`${supabaseUrl}/functions/v1/generate-solo-insight`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: publishableKey,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ clientId, force }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(typeof data?.error === "string" ? data.error : "Не вдалося завантажити СОЛО.");
  }
  if (data?.status === "empty") return { status: "empty", sourceCount: 0 };
  if (data?.status !== "ready" || !data.insight)
    throw new Error("СОЛО повернув некоректну відповідь.");

  return data as SoloInsightResult;
}
