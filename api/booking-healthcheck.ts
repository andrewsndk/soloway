import type { IncomingMessage, ServerResponse } from "node:http";

const HEALTHCHECK_URL =
  "https://awkiifqbskmktqwlnfqx.supabase.co/functions/v1/booking-healthcheck";

function sendJson(response: ServerResponse, statusCode: number, payload: Record<string, unknown>) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(payload));
}

function getKyivTimeParts() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Kyiv",
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour12: false,
  }).formatToParts(new Date());

  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

async function sendWorkflowAlert(text: string) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) return;

  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
  } catch (error) {
    console.error("Vercel healthcheck Telegram alert failed:", error);
  }
}

export default async function handler(request: IncomingMessage, response: ServerResponse) {
  if (request.method !== "GET") {
    sendJson(response, 405, { error: "Method not allowed" });
    return;
  }

  const userAgent = request.headers["user-agent"] ?? "";
  const isVercelCron = Array.isArray(userAgent)
    ? userAgent.some((value) => value.includes("vercel-cron/1.0"))
    : userAgent.includes("vercel-cron/1.0");

  if (!isVercelCron) {
    sendJson(response, 401, { error: "Unauthorized" });
    return;
  }

  const kyivTime = getKyivTimeParts();
  const kyivHour = kyivTime.hour;
  const kyivMinute = kyivTime.minute;

  const secret = process.env.BOOKING_HEALTHCHECK_SECRET;

  if (!secret) {
    await sendWorkflowAlert(
      "⚠️ <b>Soloway: Vercel healthcheck не налаштований</b>\n\nНемає BOOKING_HEALTHCHECK_SECRET у Vercel Environment Variables.",
    );
    sendJson(response, 500, { error: "BOOKING_HEALTHCHECK_SECRET is not configured" });
    return;
  }

  try {
    const healthcheckResponse = await fetch(HEALTHCHECK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-healthcheck-secret": secret,
      },
      body: JSON.stringify({
        source: "vercel-cron",
        kyivTime: `${kyivTime.day}.${kyivTime.month}.${kyivTime.year} ${kyivHour}:${kyivMinute}`,
      }),
    });

    const payloadText = await healthcheckResponse.text();

    if (!healthcheckResponse.ok) {
      await sendWorkflowAlert([
        "⚠️ <b>Soloway: автоматична перевірка бронювання не пройшла</b>",
        "",
        `Статус: ${healthcheckResponse.status}`,
        `Час: ${kyivTime.day}.${kyivTime.month}.${kyivTime.year} ${kyivHour}:${kyivMinute} Київ`,
      ].join("\n"));
    }

    response.statusCode = healthcheckResponse.status;
    response.setHeader("Content-Type", healthcheckResponse.headers.get("content-type") ?? "application/json");
    response.end(payloadText);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    await sendWorkflowAlert([
      "⚠️ <b>Soloway: Vercel не зміг викликати healthcheck</b>",
      "",
      message,
      "",
      `Час: ${kyivTime.day}.${kyivTime.month}.${kyivTime.year} ${kyivHour}:${kyivMinute} Київ`,
    ].join("\n"));

    sendJson(response, 500, { error: message });
  }
}
