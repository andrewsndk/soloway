const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type VisitPayload = {
  name?: unknown;
  lastName?: unknown;
  isNannyBooking?: unknown;
  childName?: unknown;
  childAge?: unknown;
  phone?: unknown;
  visitDate?: unknown;
  visitTime?: unknown;
  program?: unknown;
};

function jsonResponse(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function cleanField(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildTelegramMessage({
  name,
  lastName,
  isNannyBooking,
  childName,
  childAge,
  phone,
  visitDate,
  visitTime,
  program,
}: {
  name: string;
  lastName: string;
  isNannyBooking: boolean;
  childName: string;
  childAge: string;
  phone: string;
  visitDate: string;
  visitTime: string;
  program: string;
}) {
  return [
    "📅 <b>Нова заявка на візит</b>",
    "",
    `<b>Ім'я:</b> ${escapeHtml(name)}`,
    `<b>Прізвище:</b> ${escapeHtml(lastName)}`,
    `<b>Бронює няня:</b> ${isNannyBooking ? "Так" : "Ні"}`,
    `<b>Ім'я дитини:</b> ${escapeHtml(childName)}`,
    `<b>Вік дитини:</b> ${escapeHtml(childAge)}`,
    `<b>Телефон:</b> ${escapeHtml(phone)}`,
    `<b>Формат відвідування:</b> ${escapeHtml(program)}`,
    `<b>Дата:</b> ${escapeHtml(visitDate)}`,
    `<b>Час:</b> ${escapeHtml(visitTime)}`,
  ].join("\n");
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const chatId = Deno.env.get("TELEGRAM_CHAT_ID");

  if (!botToken || !chatId) {
    return jsonResponse({ error: "Telegram is not configured" }, 500);
  }

  let payload: VisitPayload;

  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON payload" }, 400);
  }

  const name = cleanField(payload.name);
  const lastName = cleanField(payload.lastName);
  const isNannyBooking = payload.isNannyBooking === true;
  const childName = cleanField(payload.childName);
  const childAge = cleanField(payload.childAge);
  const phone = cleanField(payload.phone);
  const visitDate = cleanField(payload.visitDate);
  const visitTime = cleanField(payload.visitTime);
  const program = cleanField(payload.program);

  if (!name || !lastName || !childName || !childAge || !phone || !visitDate || !visitTime || !program) {
    return jsonResponse({ error: "Missing required fields" }, 400);
  }

  try {
    const telegramResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: buildTelegramMessage({
          name,
          lastName,
          isNannyBooking,
          childName,
          childAge,
          phone,
          visitDate,
          visitTime,
          program,
        }),
        parse_mode: "HTML",
      }),
    });

    if (!telegramResponse.ok) {
      const telegramError = await telegramResponse.text();
      console.error("Telegram API error:", telegramError);
      return jsonResponse({ error: "Failed to send Telegram notification" }, 502);
    }

    return jsonResponse({ ok: true });
  } catch (error) {
    console.error("Visit notification error:", error);
    return jsonResponse({ error: "Failed to send visit notification" }, 500);
  }
});
