import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-healthcheck-secret",
};

type CheckResult = {
  name: string;
  ok: boolean;
  details?: string;
};

function jsonResponse(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function sendTelegramAlert(text: string) {
  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const chatId = Deno.env.get("TELEGRAM_CHAT_ID");

  if (!botToken || !chatId) return;

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });

    if (!response.ok) {
      console.error("Telegram healthcheck alert failed:", await response.text());
    }
  } catch (error) {
    console.error("Telegram healthcheck alert error:", error);
  }
}

async function checkTable(
  supabase: ReturnType<typeof createClient>,
  table: string,
  label: string,
): Promise<CheckResult> {
  const { count, error } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true });

  if (error) {
    return { name: label, ok: false, details: error.message };
  }

  return { name: label, ok: true, details: `${count ?? 0} rows reachable` };
}

async function checkLandingBookingForm({
  supabaseUrl,
  anonKey,
  healthcheckSecret,
}: {
  supabaseUrl: string;
  anonKey: string;
  healthcheckSecret: string;
}): Promise<CheckResult> {
  const now = new Date();
  const stamp = now.toISOString().replace(/\D/g, "").slice(0, 14);
  const visitDate = new Intl.DateTimeFormat("uk-UA", {
    timeZone: "Europe/Kyiv",
    dateStyle: "long",
  }).format(now);
  const visitDateIso = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Kyiv",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

  const response = await fetch(`${supabaseUrl}/functions/v1/send-visit`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${anonKey}`,
      apikey: anonKey,
      "x-healthcheck-secret": healthcheckSecret,
    },
    body: JSON.stringify({
      healthcheck: true,
      name: "Healthcheck",
      lastName: "Soloway",
      isNannyBooking: false,
      childName: `Test ${stamp}`,
      childAge: "3 роки",
      phone: "+380000000001",
      visitDate,
      visitDateIso,
      visitTime: "09:00",
      program: "На 1 годину",
      parentComment: "Автоматична перевірка форми бронювання з лендингу.",
    }),
  });

  const responseText = await response.text();

  if (!response.ok) {
    return {
      name: "Форма бронювання",
      ok: false,
      details: `send-visit HTTP ${response.status}: ${responseText.slice(0, 300)}`,
    };
  }

  return {
    name: "Форма бронювання",
    ok: true,
    details: "send-visit accepted payload and test booking insert worked",
  };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const expectedSecret = Deno.env.get("BOOKING_HEALTHCHECK_SECRET");
  const providedSecret = request.headers.get("x-healthcheck-secret") ?? "";

  if (!expectedSecret || providedSecret !== expectedSecret) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const startedAt = new Date();
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    await sendTelegramAlert("⚠️ <b>Soloway: healthcheck не налаштований</b>\n\nНемає Supabase env vars.");
    return jsonResponse({ error: "Supabase service role is not configured" }, 500);
  }

  if (!anonKey) {
    await sendTelegramAlert("⚠️ <b>Soloway: healthcheck не налаштований</b>\n\nНемає SUPABASE_ANON_KEY для перевірки форми.");
    return jsonResponse({ error: "Supabase anon key is not configured" }, 500);
  }

  const checks: CheckResult[] = [];

  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    checks.push(await checkTable(supabase, "clients", "Клієнти"));
    checks.push(await checkTable(supabase, "bookings", "Бронювання"));
    checks.push(await checkTable(supabase, "instructions", "Інструкції"));
    checks.push(await checkTable(supabase, "audit_logs", "Історія дій"));
    checks.push(await checkTable(supabase, "app_settings", "Налаштування"));
    checks.push(await checkLandingBookingForm({ supabaseUrl, anonKey, healthcheckSecret: expectedSecret }));

    const failedChecks = checks.filter((check) => !check.ok);

    if (failedChecks.length > 0) {
      const message = [
        "⚠️ <b>Soloway: проблема з системою бронювання</b>",
        "",
        ...failedChecks.map((check) => `• <b>${escapeHtml(check.name)}:</b> ${escapeHtml(check.details ?? "помилка")}`),
        "",
        `Час: ${startedAt.toISOString()}`,
      ].join("\n");

      await sendTelegramAlert(message);
      return jsonResponse({ ok: false, checks, checkedAt: startedAt.toISOString() }, 500);
    }

    await sendTelegramAlert([
      "✅ <b>Soloway: бронювання працює</b>",
      "",
      "Форма з лендингу приймає дані, тестова бронь створюється і одразу видаляється.",
      ...checks.map((check) => `• <b>${escapeHtml(check.name)}:</b> ${escapeHtml(check.details ?? "доступно")}`),
      "",
      `Час: ${startedAt.toISOString()}`,
    ].join("\n"));

    return jsonResponse({
      ok: true,
      checks,
      checkedAt: startedAt.toISOString(),
    });
  } catch (error) {
    const details = error instanceof Error ? error.message : "Unknown error";
    await sendTelegramAlert([
      "⚠️ <b>Soloway: healthcheck впав</b>",
      "",
      escapeHtml(details),
      "",
      `Час: ${startedAt.toISOString()}`,
    ].join("\n"));

    return jsonResponse({ ok: false, error: details, checks, checkedAt: startedAt.toISOString() }, 500);
  }
});
