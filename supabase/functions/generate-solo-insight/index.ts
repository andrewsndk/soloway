import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Payload = { clientId?: unknown; force?: unknown };
type VisitSource = {
  id: string;
  visit_date: string;
  updated_at: string;
  parent_summary: string | null;
};

type InterestRule = {
  label: string;
  activity: string;
  ask: (name: string) => string;
  patterns: RegExp[];
};

const interestRules: InterestRule[] = [
  {
    label: "машинки й транспорт",
    activity: "гру з машинками, гаражем або транспортним треком",
    ask: (name) => `${name}, хочеш сьогодні побудувати гараж для машинок?`,
    patterns: [/машин/i, /транспорт/i, /гараж/i, /потяг/i, /залізниц/i],
  },
  {
    label: "конструктор",
    activity: "спільне будівництво з конструктора",
    ask: (name) => `${name}, що будемо будувати з конструктора сьогодні?`,
    patterns: [/конструктор/i, /кубик/i, /лего/i, /будува/i],
  },
  {
    label: "малювання й творчість",
    activity: "малювання, ліплення або просту творчу роботу",
    ask: (name) => `${name}, що тобі хотілося б намалювати сьогодні?`,
    patterns: [/малюва/i, /фарб/i, /олівц/i, /ліпи/i, /пластилін/i, /аплікац/i, /кле/i],
  },
  {
    label: "музика",
    activity: "музичну гру з простими інструментами",
    ask: (name) => `${name}, хочеш сьогодні пограти музику?`,
    patterns: [/музик/i, /піанін/i, /співа/i, /танцю/i, /інструмент/i],
  },
  {
    label: "рольові ігри",
    activity: "сюжетну гру в кухню, магазин або дім",
    ask: (name) => `${name}, у що пограємо сьогодні?`,
    patterns: [/рольов/i, /кухн/i, /готува/i, /магазин/i, /лікар/i, /ляльк/i],
  },
  {
    label: "вода й сенсорні ігри",
    activity: "спокійну сенсорну гру з водою або сипучими матеріалами",
    ask: (name) => `${name}, хочеш сьогодні пограти з водою чи піском?`,
    patterns: [/водич/i, /водою/i, /сенсор/i, /пісок/i, /круп/i],
  },
  {
    label: "книжки й історії",
    activity: "читання короткої історії або гру за її сюжетом",
    ask: (name) => `${name}, яку історію почитаємо сьогодні?`,
    patterns: [/книж/i, /читат/i, /історі/i, /казк/i],
  },
  {
    label: "пазли й логічні завдання",
    activity: "пазл, сортер або коротке логічне завдання",
    ask: (name) => `${name}, хочеш разом скласти новий пазл?`,
    patterns: [/пазл/i, /сортер/i, /головолом/i, /цифр/i, /рахува/i],
  },
  {
    label: "рухливі ігри",
    activity: "коротку рухливу гру або смугу перешкод",
    ask: (name) => `${name}, хочеш сьогодні пограти в рухливу гру?`,
    patterns: [/біга/i, /стриба/i, /рухлив/i, /м'яч/i, /перешкод/i],
  },
  {
    label: "допомога дорослим",
    activity: "просте доручення або спільну побутову справу",
    ask: (name) => `${name}, допоможеш мені сьогодні з важливою справою?`,
    patterns: [/допомага/i, /прибира/i, /миє руч/i, /дорученн/i],
  },
];

const difficultyPatterns = [
  /складно/i,
  /важко/i,
  /не хоті/i,
  /не вдалося/i,
  /плака/i,
  /засмути/i,
  /боя/i,
  /конфлікт/i,
  /ділитися/i,
  /адаптац/i,
  /мама була поруч/i,
];

const positiveOutcomePatterns = [
  /адаптац.{0,30}(чудов|добре|легко|успіш)/i,
  /без (труднощ|складнощ)/i,
  /дуже комунікабельн/i,
  /все (було|пройшло) добре/i,
];

const sensitiveAskPatterns = [
  /алерг/i,
  /діагноз/i,
  /лікар/i,
  /туалет/i,
  /горщик/i,
  /страх/i,
  /вибух/i,
  /тривог/i,
  /конфлікт/i,
  /мама|тато|батьк/i,
];

function jsonResponse(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function clean(value: unknown, maxLength = 500) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function currentKyivDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Kyiv",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function sentences(text: string) {
  return text
    .replace(/[✨🐣💛🥹😌😊💕]/gu, " ")
    .split(/(?<=[.!?])\s+|\n+/u)
    .map((sentence) => sentence.replace(/\s+/g, " ").trim())
    .filter((sentence) => sentence.length >= 12);
}

function shortenSentence(value: string, maxLength = 220) {
  const withoutGreeting = value
    .replace(/^цвірінь[-–— ]цвірінь[!,. ]*/i, "")
    .replace(/^сьогодні\s+/i, "")
    .trim();
  if (withoutGreeting.length <= maxLength) return withoutGreeting;
  return `${withoutGreeting.slice(0, maxLength - 1).trimEnd()}…`;
}

function listText(values: string[]) {
  if (values.length <= 1) return values[0] || "";
  return `${values.slice(0, -1).join(", ")} та ${values.at(-1)}`;
}

function analyzeVisits(childName: string, visits: VisitSource[]) {
  const allText = visits.map((visit) => visit.parent_summary?.trim() || "").join("\n");
  const allSentences = visits.flatMap((visit) => sentences(visit.parent_summary?.trim() || ""));
  const interests = interestRules.filter((rule) => rule.patterns.some((pattern) => pattern.test(allText)));

  const socialSentence = allSentences.find((sentence) =>
    /(разом із|разом з|грав(?:ся|ла)? з|грала з|домовил)/i.test(sentence),
  );
  const difficultySentence = allSentences.find((sentence) =>
    difficultyPatterns.some((pattern) => pattern.test(sentence)) &&
    !positiveOutcomePatterns.some((pattern) => pattern.test(sentence)),
  );

  const remembered: string[] = [];
  if (interests.length > 0) {
    remembered.push(`${childName} цікавили ${listText(interests.slice(0, 3).map((rule) => rule.label))}.`);
  }
  if (socialSentence) remembered.push(shortenSentence(socialSentence, 180));
  if (remembered.length === 0 && allSentences[0]) remembered.push(shortenSentence(allSentences[0], 220));

  let ask = interests[0]?.ask(childName) || "";
  if (/день народження/i.test(allText)) {
    ask = `${childName}, ти вже придумав чи придумала, як хочеш святкувати день народження?`;
  }
  if (sensitiveAskPatterns.some((pattern) => pattern.test(ask))) ask = "";

  const activity = interests[0]
    ? `Запропонувати ${interests[0].activity}.`
    : "Запропонувати спокійну знайому гру й дати дитині обрати напрям.";

  return {
    remember: remembered.join(" ").slice(0, 420),
    ask: ask.slice(0, 260),
    activity: activity.slice(0, 260),
    watch_out: difficultySentence
      ? shortenSentence(difficultySentence, 350)
      : "",
  };
}

async function sourceHash(visits: VisitSource[]) {
  const source = visits.map((visit) => [
    visit.id,
    visit.updated_at,
    visit.parent_summary?.trim() || "",
  ].join("|")).join("\n");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(source));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authHeader = request.headers.get("Authorization");
  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return jsonResponse({ error: "Supabase auth is not configured" }, 500);
  }
  if (!authHeader) return jsonResponse({ error: "Unauthorized" }, 401);

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false },
  });
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return jsonResponse({ error: "Unauthorized" }, 401);

  let payload: Payload;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON payload" }, 400);
  }

  const clientId = clean(payload.clientId, 80);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clientId)) {
    return jsonResponse({ error: "Invalid client id" }, 400);
  }

  const [{ data: client, error: clientError }, { data: visits, error: visitsError }] = await Promise.all([
    supabase.from("clients").select("id,child_name").eq("id", clientId).maybeSingle(),
    supabase
      .from("bookings")
      .select("id,visit_date,updated_at,parent_summary")
      .eq("client_id", clientId)
      .not("parent_summary", "is", null)
      .neq("status", "Скасовано")
      .lte("visit_date", currentKyivDate())
      .order("visit_date", { ascending: false })
      .order("visit_time", { ascending: false })
      .limit(5),
  ]);

  if (clientError || !client) return jsonResponse({ error: "Client not found" }, 404);
  if (visitsError) return jsonResponse({ error: "Could not load visit history" }, 500);

  const sourceVisits = ((visits ?? []) as VisitSource[])
    .filter((visit) => (visit.parent_summary?.trim().length ?? 0) >= 8)
    .slice(0, 5);
  if (sourceVisits.length === 0) return jsonResponse({ status: "empty", sourceCount: 0 });

  const hash = await sourceHash(sourceVisits);
  if (payload.force !== true) {
    const { data: cached } = await supabaseAdmin
      .from("solo_insights")
      .select("remember,ask,activity,watch_out,generated_at,source_booking_ids,source_hash")
      .eq("client_id", clientId)
      .maybeSingle();
    if (cached?.source_hash === hash) {
      return jsonResponse({
        status: "ready",
        insight: {
          remember: cached.remember,
          ask: cached.ask,
          activity: cached.activity,
          watchOut: cached.watch_out,
        },
        sourceCount: cached.source_booking_ids.length,
        generatedAt: cached.generated_at,
        cached: true,
      });
    }
  }

  const insight = analyzeVisits(client.child_name, sourceVisits);
  const generatedAt = new Date().toISOString();
  const { error: saveError } = await supabaseAdmin.from("solo_insights").upsert({
    client_id: clientId,
    source_hash: hash,
    source_booking_ids: sourceVisits.map((visit) => visit.id),
    remember: insight.remember,
    ask: insight.ask,
    activity: insight.activity,
    watch_out: insight.watch_out,
    generated_at: generatedAt,
  });
  if (saveError) {
    console.error("Could not cache SOLO insight", saveError.message);
    return jsonResponse({ error: "Не вдалося зберегти підказки СОЛО." }, 500);
  }

  return jsonResponse({
    status: "ready",
    insight: {
      remember: insight.remember,
      ask: insight.ask,
      activity: insight.activity,
      watchOut: insight.watch_out,
    },
    sourceCount: sourceVisits.length,
    generatedAt,
    cached: false,
    model: "solo-rules-v1",
  });
});
