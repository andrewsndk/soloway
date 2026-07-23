import { supabase } from "@/integrations/supabase/client";

export type VisitNoteSummaryInput = {
  rawNote: string;
  childName?: string | null;
  visitDate?: string | null;
  format?: string | null;
};

export async function formatVisitNote(input: VisitNoteSummaryInput) {
  const rawNote = input.rawNote.trim();
  if (!rawNote) {
    throw new Error("Спочатку додайте нотатку про візит.");
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) {
    throw new Error("Сесія закінчилась. Увійдіть в адмінку ще раз.");
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !publishableKey) {
    throw new Error("Supabase URL або publishable key не налаштовані.");
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/format-visit-note`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: publishableKey,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      rawNote,
      childName: input.childName,
      visitDate: input.visitDate,
      format: input.format,
    }),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = typeof data?.error === "string" ? data.error : "Не вдалося оформити текст.";
    throw new Error(message);
  }

  const summary = typeof data?.summary === "string" ? data.summary.trim() : "";
  if (!summary) {
    throw new Error("AI не повернув текст сводки. Спробуйте ще раз.");
  }

  return summary;
}
