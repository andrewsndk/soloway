import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

type AuditAction = "create" | "update" | "delete";
type EntityType = "booking" | "client" | "settings" | "instructions";

export type AuditPayload = {
  action: AuditAction;
  entityType: EntityType;
  entityId?: string | null;
  entityLabel?: string | null;
  summary: string;
  before?: unknown;
  after?: unknown;
};

export function loginFromEmail(email?: string | null) {
  if (!email) return null;
  return email.endsWith("@soloway.local") ? email.replace("@soloway.local", "") : email;
}

export async function logAction(payload: AuditPayload) {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;

  const user = userData.user;
  if (!user) throw new Error("Користувач не авторизований");

  const { error } = await supabase.from("audit_logs").insert({
    actor_id: user.id,
    actor_email: user.email ?? null,
    actor_login: loginFromEmail(user.email),
    action: payload.action,
    entity_type: payload.entityType,
    entity_id: payload.entityId ?? null,
    entity_label: payload.entityLabel ?? null,
    summary: payload.summary,
    before_data: toJsonValue(payload.before),
    after_data: toJsonValue(payload.after),
  });

  if (error) throw error;
}

export async function logActionQuietly(payload: AuditPayload) {
  try {
    await logAction(payload);
  } catch (error) {
    console.error("[audit]", error);
  }
}

function toJsonValue(value: unknown): Json {
  if (value === undefined) return null;
  return JSON.parse(JSON.stringify(value)) as Json;
}

export function compactDiff(before: Record<string, unknown>, after: Record<string, unknown>): Json {
  const changes: Record<string, { before: Json; after: Json }> = {};
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);

  for (const key of keys) {
    const a = before[key] ?? null;
    const b = after[key] ?? null;
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      changes[key] = { before: toJsonValue(a), after: toJsonValue(b) };
    }
  }

  return changes;
}
