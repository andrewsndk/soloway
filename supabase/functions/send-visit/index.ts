import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-healthcheck-secret",
};

type VisitPayload = {
  name?: unknown;
  lastName?: unknown;
  isNannyBooking?: unknown;
  childName?: unknown;
  childAge?: unknown;
  phone?: unknown;
  visitDate?: unknown;
  visitDateIso?: unknown;
  visitTime?: unknown;
  program?: unknown;
  parentComment?: unknown;
  healthcheck?: unknown;
};

type BookingFormat = "hour_1" | "hour_3" | "full_day" | "adaptation" | "other";

function jsonResponse(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function cleanField(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";

  if (digits.startsWith("380") && digits.length === 12) return digits;
  if (digits.startsWith("80") && digits.length === 11) return `3${digits}`;
  if (digits.startsWith("0") && digits.length === 10) return `38${digits}`;
  if (digits.length === 9) return `380${digits}`;

  return digits;
}

function formatPhoneForUkraine(value: string) {
  const normalized = normalizePhone(value);
  if (normalized.startsWith("380")) return `+${normalized}`;
  return value;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function getProgramDetails(program: string): { format: BookingFormat; hours: number | null; amount: number } {
  if (program.startsWith("Своя кількість годин")) {
    const hoursMatch = program.match(/\((\d+(?:[.,]\d+)?)\)/);
    const hours = hoursMatch ? Number(hoursMatch[1].replace(",", ".")) : null;
    return { format: "other", hours, amount: 0 };
  }

  switch (program) {
    case "Цілий день":
      return { format: "full_day", hours: null, amount: 1390 };
    case "Адаптація":
      return { format: "adaptation", hours: null, amount: 300 };
    case "На 3 години":
      return { format: "hour_3", hours: null, amount: 850 };
    case "На 1 годину":
      return { format: "hour_1", hours: null, amount: 500 };
    default:
      return { format: "other", hours: null, amount: 0 };
  }
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
  parentComment,
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
  parentComment: string;
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
    parentComment ? `<b>Коментар від батьків:</b> ${escapeHtml(parentComment)}` : "",
  ].filter(Boolean).join("\n");
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
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const healthcheckSecret = Deno.env.get("BOOKING_HEALTHCHECK_SECRET");

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "Supabase service role is not configured" }, 500);
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
  const phone = formatPhoneForUkraine(cleanField(payload.phone));
  const phoneNormalized = normalizePhone(phone);
  const visitDate = cleanField(payload.visitDate);
  const visitDateIso = cleanField(payload.visitDateIso);
  const visitTime = cleanField(payload.visitTime);
  const program = cleanField(payload.program);
  const parentComment = cleanField(payload.parentComment);
  const isHealthcheck = payload.healthcheck === true;

  if (!name || !lastName || !childName || !childAge || !phone || !visitDate || !visitDateIso || !visitTime || !program) {
    return jsonResponse({ error: "Missing required fields" }, 400);
  }

  if (isHealthcheck && (!healthcheckSecret || request.headers.get("x-healthcheck-secret") !== healthcheckSecret)) {
    return jsonResponse({ error: "Unauthorized healthcheck" }, 401);
  }

  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const parentName = `${name} ${lastName}`.trim();
    const programDetails = getProgramDetails(program);
    const pickupNote = isNannyBooking ? "Бронювання робить няня" : null;
    const parentQuestionnaire = [`Вік дитини: ${childAge}`, pickupNote].filter(Boolean).join("\n");

    if (isHealthcheck) {
      let testClientId: string | null = null;
      let testBookingId: string | null = null;

      try {
        const { data: createdClient, error: createClientError } = await supabase
          .from("clients")
          .insert({
            parent_name: parentName,
            child_name: childName,
            phone,
            phone_normalized: phoneNormalized || null,
            who_can_pickup: "Автоматична перевірка форми бронювання",
            parent_questionnaire: parentQuestionnaire,
          })
          .select("id")
          .single();

        if (createClientError) {
          throw createClientError;
        }

        testClientId = createdClient.id;

        const { data: createdBooking, error: bookingError } = await supabase
          .from("bookings")
          .insert({
            client_id: testClientId,
            parent_name: parentName,
            child_name: childName,
            phone,
            phone_normalized: phoneNormalized || null,
            format: programDetails.format,
            hours: programDetails.hours,
            visit_date: visitDateIso,
            visit_time: visitTime,
            source: "Healthcheck",
            amount: programDetails.amount,
            amount_override: false,
            parent_comment: [parentComment, parentQuestionnaire].filter(Boolean).join("\n") || null,
            status: "Нове",
          })
          .select("id")
          .single();

        if (bookingError) {
          throw bookingError;
        }

        testBookingId = createdBooking.id;

        const { error: deleteBookingError } = await supabase
          .from("bookings")
          .delete()
          .eq("id", testBookingId);

        if (deleteBookingError) {
          throw deleteBookingError;
        }

        testBookingId = null;

        const { error: deleteClientError } = await supabase
          .from("clients")
          .delete()
          .eq("id", testClientId);

        if (deleteClientError) {
          throw deleteClientError;
        }

        testClientId = null;

        return jsonResponse({
          ok: true,
          healthcheck: true,
          checked: ["payload", "client_insert", "booking_insert", "booking_cleanup", "client_cleanup"],
        });
      } catch (error) {
        if (testBookingId) {
          const { error: deleteBookingError } = await supabase
            .from("bookings")
            .delete()
            .eq("id", testBookingId);

          if (deleteBookingError) {
            console.error("Healthcheck booking cleanup failed:", deleteBookingError);
          }
        }

        if (testClientId) {
          const { error: deleteClientError } = await supabase
            .from("clients")
            .delete()
            .eq("id", testClientId);

          if (deleteClientError) {
            console.error("Healthcheck client cleanup failed:", deleteClientError);
          }
        }

        throw error;
      }
    }

    const { data: nameMatches, error: nameLookupError } = await supabase
      .from("clients")
      .select("id")
      .ilike("parent_name", parentName)
      .ilike("child_name", childName)
      .limit(1);

    if (nameLookupError) {
      throw nameLookupError;
    }

    let clientId = nameMatches?.[0]?.id as string | undefined;

    if (!clientId && phoneNormalized) {
      const { data: phoneChildMatches, error: phoneLookupError } = await supabase
        .from("clients")
        .select("id")
        .eq("phone_normalized", phoneNormalized)
        .ilike("child_name", childName)
        .limit(1);

      if (phoneLookupError) {
        throw phoneLookupError;
      }

      clientId = phoneChildMatches?.[0]?.id as string | undefined;
    }

    if (!clientId) {
      const { data: createdClient, error: createClientError } = await supabase
        .from("clients")
        .insert({
          parent_name: parentName,
          child_name: childName,
          phone,
          phone_normalized: phoneNormalized || null,
          who_can_pickup: pickupNote,
          parent_questionnaire: parentQuestionnaire,
        })
        .select("id")
        .single();

      if (createClientError) {
        throw createClientError;
      }

      clientId = createdClient.id;
    }

    const { error: bookingError } = await supabase.from("bookings").insert({
      client_id: clientId,
      parent_name: parentName,
      child_name: childName,
      phone,
      phone_normalized: phoneNormalized || null,
      format: programDetails.format,
      hours: programDetails.hours,
      visit_date: visitDateIso,
      visit_time: visitTime,
      source: "Сайт",
      amount: programDetails.amount,
      amount_override: false,
      parent_comment: [parentComment, parentQuestionnaire].filter(Boolean).join("\n") || null,
      status: "Нове",
    });

    if (bookingError) {
      throw bookingError;
    }

    if (botToken && chatId) {
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
            parentComment,
          }),
          parse_mode: "HTML",
        }),
      });

      if (!telegramResponse.ok) {
        const telegramError = await telegramResponse.text();
        console.error("Telegram API error:", telegramError);
      }
    }

    return jsonResponse({ ok: true, clientId });
  } catch (error) {
    console.error("Visit notification error:", error);
    return jsonResponse({ error: "Failed to send visit notification" }, 500);
  }
});
