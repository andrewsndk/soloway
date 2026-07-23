import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Payload = {
  rawNote?: unknown;
  childName?: unknown;
  visitDate?: unknown;
  format?: unknown;
};

function jsonResponse(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function extractResponseText(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";
  const data = payload as {
    output_text?: unknown;
    output?: Array<{ content?: Array<{ text?: unknown }> }>;
  };

  if (typeof data.output_text === "string") return data.output_text.trim();

  return (data.output ?? [])
    .flatMap((item) => item.content ?? [])
    .map((item) => (typeof item.text === "string" ? item.text : ""))
    .filter(Boolean)
    .join("\n")
    .trim();
}

function extractGeminiText(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";
  const data = payload as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: unknown }>;
      };
    }>;
  };

  return (data.candidates ?? [])
    .flatMap((candidate) => candidate.content?.parts ?? [])
    .map((part) => (typeof part.text === "string" ? part.text : ""))
    .filter(Boolean)
    .join("\n")
    .trim();
}

function geminiFinishReasons(payload: unknown) {
  if (!payload || typeof payload !== "object") return [];
  const data = payload as {
    candidates?: Array<{
      finishReason?: unknown;
    }>;
  };

  return (data.candidates ?? [])
    .map((candidate) => (typeof candidate.finishReason === "string" ? candidate.finishReason : ""))
    .filter(Boolean);
}

function looksCutOff(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (/[.!?…)\]}»”’💛💕😊😌🥹✨🐣👌]$/.test(trimmed)) return false;
  if (/[,;:—-]$/.test(trimmed)) return true;

  const lastWord = trimmed.split(/\s+/).at(-1)?.toLowerCase() ?? "";
  return [
    "і",
    "й",
    "та",
    "але",
    "або",
    "що",
    "як",
    "у",
    "в",
    "з",
    "до",
    "для",
    "про",
    "не",
    "на",
  ].includes(lastWord);
}

function safeProviderError(value: string) {
  return value
    .replace(/xai-[A-Za-z0-9_-]+/g, "[redacted]")
    .replace(/sk-[A-Za-z0-9_-]+/g, "[redacted]")
    .replace(/AIza[A-Za-z0-9_-]+/g, "[redacted]")
    .slice(0, 700);
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableAiStatus(status: number) {
  return [429, 500, 502, 503, 504].includes(status);
}

async function geminiModelCandidates(ai: ReturnType<typeof aiConfig>) {
  const candidates = [
    ai.model,
    "gemini-flash-latest",
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-1.5-flash",
  ];

  try {
    const response = await fetch(`${ai.baseUrl}/models`, {
      headers: { "X-goog-api-key": ai.apiKey },
    });

    if (!response.ok) {
      console.error("gemini models lookup error:", response.status, await response.text());
      return unique(candidates);
    }

    const data = await response.json() as {
      models?: Array<{
        name?: unknown;
        supportedGenerationMethods?: unknown;
      }>;
    };

    const apiModels = (data.models ?? [])
      .filter((model) => {
        const methods = Array.isArray(model.supportedGenerationMethods) ? model.supportedGenerationMethods : [];
        return methods.includes("generateContent");
      })
      .map((model) => (typeof model.name === "string" ? model.name.replace(/^models\//, "") : ""))
      .filter((model) => model && /gemini/i.test(model))
      .filter((model) => !/(embedding|imagen|veo|tts|image|audio|live)/i.test(model));

    const flashModels = apiModels.filter((model) => /flash/i.test(model) && !/latest/i.test(model));
    const latestModels = apiModels.filter((model) => /flash/i.test(model) && /latest/i.test(model));
    const otherTextModels = apiModels.filter((model) => !/flash/i.test(model));

    return unique([
      ...flashModels,
      ...latestModels,
      ...otherTextModels,
      ...candidates,
    ]);
  } catch (error) {
    console.error("gemini models lookup failed:", error);
    return unique(candidates);
  }
}

async function xaiModelCandidates(ai: ReturnType<typeof aiConfig>) {
  if (ai.provider !== "xai") return [ai.model];

  const candidates = [
    ai.model,
    "grok-4.3-latest",
    "grok-latest",
    "grok-4-latest",
    "grok-4",
    "grok-420-reasoning",
  ];

  try {
    const response = await fetch(`${ai.baseUrl}/language-models`, {
      headers: { Authorization: `Bearer ${ai.apiKey}` },
    });
    if (!response.ok) {
      console.error("xai language-models error:", response.status, await response.text());
      return unique(candidates);
    }

    const data = await response.json() as {
      models?: Array<{
        id?: unknown;
        aliases?: unknown;
        input_modalities?: unknown;
        output_modalities?: unknown;
      }>;
    };

    for (const model of data.models ?? []) {
      const input = Array.isArray(model.input_modalities) ? model.input_modalities : [];
      const output = Array.isArray(model.output_modalities) ? model.output_modalities : [];
      const supportsText = input.includes("text") && output.includes("text");
      if (!supportsText) continue;
      if (typeof model.id === "string") candidates.push(model.id);
      if (Array.isArray(model.aliases)) {
        for (const alias of model.aliases) {
          if (typeof alias === "string") candidates.push(alias);
        }
      }
    }
  } catch (error) {
    console.error("xai language-models lookup failed:", error);
  }

  return unique(candidates);
}

function aiConfig() {
  const provider = (Deno.env.get("AI_PROVIDER") || "").trim().toLowerCase();
  const xaiApiKey = Deno.env.get("XAI_API_KEY") || Deno.env.get("GROK_API_KEY");
  const geminiApiKey = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_API_KEY");
  const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
  const useGemini = provider === "gemini" || provider === "google" || Boolean(geminiApiKey);
  const useXai = provider === "xai" || provider === "grok" || Boolean(xaiApiKey);

  if (useGemini) {
    return {
      provider: "gemini",
      baseUrl: Deno.env.get("GEMINI_BASE_URL") || "https://generativelanguage.googleapis.com/v1beta",
      apiKey: geminiApiKey || "",
      model: Deno.env.get("GEMINI_MODEL") || "gemini-flash-latest",
    };
  }

  if (useXai) {
    return {
      provider: "xai",
      baseUrl: Deno.env.get("XAI_BASE_URL") || "https://api.x.ai/v1",
      apiKey: xaiApiKey || openaiApiKey || "",
      model: Deno.env.get("XAI_MODEL") || Deno.env.get("GROK_MODEL") || Deno.env.get("OPENAI_MODEL") || "grok-4.3-latest",
    };
  }

  return {
    provider: "openai",
    baseUrl: Deno.env.get("OPENAI_BASE_URL") || "https://api.openai.com/v1",
    apiKey: openaiApiKey || "",
    model: Deno.env.get("OPENAI_MODEL") || "gpt-4o-mini",
  };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const ai = aiConfig();

  if (!supabaseUrl || !supabaseAnonKey) {
    return jsonResponse({ error: "Supabase auth is not configured" }, 500);
  }

  const authHeader = request.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  if (!ai.apiKey) {
    return jsonResponse({ error: "AI API key is not configured in Supabase secrets" }, 500);
  }

  let payload: Payload;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON payload" }, 400);
  }

  const rawNote = clean(payload.rawNote);
  const childName = clean(payload.childName) || "дитина";
  const visitDate = clean(payload.visitDate);
  const format = clean(payload.format);

  if (rawNote.length < 8) {
    return jsonResponse({ error: "Note is too short" }, 400);
  }

  if (rawNote.length > 2500) {
    return jsonResponse({ error: "Note is too long" }, 400);
  }

  const systemPrompt = [
    "Ти допомагаєш дитячому простору Soloway оформлювати короткі повідомлення для батьків після візиту дитини.",
    "Пиши українською мовою у стилі теплих текстових чатів Soloway: ніжно, живо, по-домашньому, без офіційного тону.",
    "Повідомлення має звучати так, ніби адміністратор Soloway пише батькам у месенджері.",
    "Фірмовий стиль: починай з «Цвірінь-цвірінь✨» або дуже близького теплого варіанту.",
    "Можна природно використовувати слова «пташеня», «пташенятко», «гніздечко», «наш простір», але без перебору.",
    "Доречні 2-5 теплих емодзі: 🐣, 💛, ✨, 🥹, 😌, 😊, 💕. Не перетворюй текст на набір емодзі.",
    "Не вигадуй фактів, не став діагнозів, не оцінюй дитину негативно.",
    "Збережи суть нотатки вихователя, прибери хаос усного мовлення.",
    "Формат: готове повідомлення в чат, 2-4 короткі абзаци, без маркерів, без заголовків, без слів «сводка», «звіт», «формат візиту».",
    "Спочатку м'яко заспокой або подякуй, далі коротко напиши що дитина робила і що її захопило, в кінці запроси ще або залиш тепле завершення.",
    "Не обіцяй фото, відео, договір або документи, якщо цього немає в сирій нотатці.",
    "Якщо в нотатці є складний момент, сформулюй його делікатно і підтримуюче, без тривожності.",
    "Якщо в нотатці мало фактів, не розтягуй текст.",
    "Оптимальна довжина: 350-700 символів. Краще коротко і тепло, ніж довго і офіційно.",
    "Обов'язково заверши всі речення повністю. Не обривай текст на середині слова або речення.",
    "",
    "Приклади стилю:",
    "Цвірінь-цвірінь✨ Дуже раді були бачити сьогодні вас і ваше пташенятко в нашому гніздечку🥹 Чекаємо обовʼязково вас ще раз в гості💛",
    "Цвірінь-цвірінь✨ У Софійки все добре, не переживайте 😊",
    "Цвірінь-цвірінь✨ Ваші чудові маленькі пташенята вже дуже добре адаптувалися в нашому гніздечку😌",
  ].join("\n");

  const userPrompt = [
    `Ім'я дитини: ${childName}`,
    visitDate ? `Дата візиту: ${visitDate}` : "",
    format ? `Формат: ${format}` : "",
    "",
    "Сира нотатка вихователя:",
    rawNote,
  ].filter(Boolean).join("\n");

  if (ai.provider === "gemini") {
    const errors: string[] = [];

    for (const model of await geminiModelCandidates(ai)) {
      for (let attempt = 1; attempt <= 2; attempt += 1) {
        const response = await fetch(`${ai.baseUrl}/models/${model}:generateContent`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-goog-api-key": ai.apiKey,
          },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: systemPrompt }],
            },
            contents: [
              {
                role: "user",
                parts: [{ text: userPrompt }],
              },
            ],
            generationConfig: {
              temperature: 0.4,
              maxOutputTokens: 4096,
            },
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const summary = extractGeminiText(data);
          const finishReasons = geminiFinishReasons(data);

          if (!summary) {
            errors.push(`${model}: empty response`);
            break;
          }

          if (finishReasons.includes("MAX_TOKENS")) {
            console.error("gemini response was truncated:", {
              model,
              finishReasons,
              length: summary.length,
            });
            return jsonResponse({
              error: "AI повернув обрізаний текст. Спробуйте ще раз або скоротіть внутрішню нотатку.",
              provider: ai.provider,
              model,
              finishReasons,
            }, 502);
          }

          if (looksCutOff(summary)) {
            console.error("gemini response looked truncated:", {
              model,
              length: summary.length,
            });
            return jsonResponse({
              error: "AI повернув обрізаний текст. Спробуйте ще раз або скоротіть внутрішню нотатку.",
              provider: ai.provider,
              model,
            }, 502);
          }

          return jsonResponse({ summary, model });
        }

        const errorText = await response.text();
        const safeError = safeProviderError(errorText);
        errors.push(`${model}: ${response.status} ${safeError}`);
        console.error("gemini response error:", model, response.status, errorText);

        if (!isRetryableAiStatus(response.status)) break;
        if (attempt < 2) await sleep(500 * attempt);
      }
    }

    return jsonResponse({
      error: "AI зараз перевантажений. Спробуйте ще раз через хвилину.",
      details: `Tried Gemini models: ${errors.join(" | ")}`,
      provider: ai.provider,
      model: ai.model,
    }, 503);
  }

  const candidates = await xaiModelCandidates(ai);
  const errors: string[] = [];
  let data: unknown = null;
  let usedModel = ai.model;

  for (const model of candidates) {
    const response = await fetch(`${ai.baseUrl}/responses`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ai.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: userPrompt,
          },
        ],
        temperature: 0.4,
        max_output_tokens: 2048,
      }),
    });

    if (response.ok) {
      data = await response.json();
      usedModel = model;
      break;
    }

    const errorText = await response.text();
    const safeError = safeProviderError(errorText);
    errors.push(`${model}: ${response.status} ${safeError}`);
    console.error(`${ai.provider} response error:`, model, response.status, errorText);

    if (!/model not found/i.test(errorText) && !/invalid-argument/i.test(errorText)) {
      break;
    }
  }

  if (!data) {
    return jsonResponse({
      error: `AI provider failed. Tried models: ${errors.join(" | ")}`,
      provider: ai.provider,
      model: ai.model,
    }, 502);
  }

  const summary = extractResponseText(data);
  if (!summary) {
    return jsonResponse({ error: `Empty AI response from model ${usedModel}` }, 502);
  }
  if (looksCutOff(summary)) {
    console.error(`${ai.provider} response looked truncated:`, {
      model: usedModel,
      length: summary.length,
    });
    return jsonResponse({
      error: "AI повернув обрізаний текст. Спробуйте ще раз або скоротіть внутрішню нотатку.",
      provider: ai.provider,
      model: usedModel,
    }, 502);
  }

  return jsonResponse({ summary, model: usedModel });
});
