import { supabase } from "@/integrations/supabase/client";
import type { Json, Tables } from "@/integrations/supabase/types";

type ClientRow = Tables<"clients">;
type BookingRow = Tables<"bookings">;
type AuditLogRow = Tables<"audit_logs">;
type AppSettingsRow = Tables<"app_settings">;

type BackupData = {
  clients: ClientRow[];
  bookings: BookingRow[];
  audit_logs: AuditLogRow[];
  app_settings: AppSettingsRow[];
};

type BackupCounts = Record<keyof BackupData | "instructions", number>;

const CLIENT_COLUMNS: Array<keyof ClientRow> = [
  "id",
  "parent_name",
  "child_name",
  "phone",
  "child_birthdate",
  "photo_url",
  "who_can_pickup",
  "parent_questionnaire",
  "admin_comment",
  "teacher_comment",
  "created_at",
  "updated_at",
];

const BOOKING_COLUMNS: Array<keyof BookingRow> = [
  "id",
  "client_id",
  "parent_name",
  "child_name",
  "phone",
  "format",
  "hours",
  "visit_date",
  "visit_time",
  "source",
  "extra_services",
  "amount",
  "amount_override",
  "payment_status",
  "parent_comment",
  "teacher_comment",
  "status",
  "created_at",
  "updated_at",
];

const AUDIT_COLUMNS: Array<keyof AuditLogRow> = [
  "id",
  "actor_id",
  "actor_email",
  "actor_login",
  "action",
  "entity_type",
  "entity_id",
  "entity_label",
  "summary",
  "before_data",
  "after_data",
  "created_at",
];

const SETTINGS_COLUMNS: Array<keyof AppSettingsRow> = ["id", "data", "updated_at"];

export async function downloadDatabaseBackupCsv(): Promise<BackupCounts> {
  const data = await fetchBackupData();
  const instructions = instructionsRows(data.app_settings);
  const stamp = backupStamp();

  downloadTextFile(
    `soloway-backup-${stamp}-clients.csv`,
    toCsv(CLIENT_COLUMNS, data.clients),
    "text/csv;charset=utf-8;",
  );
  downloadTextFile(
    `soloway-backup-${stamp}-bookings.csv`,
    toCsv(BOOKING_COLUMNS, data.bookings),
    "text/csv;charset=utf-8;",
  );
  downloadTextFile(
    `soloway-backup-${stamp}-instructions.csv`,
    toCsv(["section", "title", "text"], instructions),
    "text/csv;charset=utf-8;",
  );
  downloadTextFile(
    `soloway-backup-${stamp}-audit_logs.csv`,
    toCsv(AUDIT_COLUMNS, data.audit_logs),
    "text/csv;charset=utf-8;",
  );
  downloadTextFile(
    `soloway-backup-${stamp}-app_settings.csv`,
    toCsv(SETTINGS_COLUMNS, data.app_settings),
    "text/csv;charset=utf-8;",
  );

  return counts(data, instructions.length);
}

export async function downloadDatabaseBackupSql(): Promise<BackupCounts> {
  const data = await fetchBackupData();
  const instructions = instructionsRows(data.app_settings);
  const stamp = backupStamp();
  const sql = [
    "-- Soloway CRM Supabase backup",
    `-- Created at: ${new Date().toISOString()}`,
    "-- Restore in Supabase SQL Editor after the project schema/migrations are applied.",
    "",
    "begin;",
    "",
    tableInsertSql("clients", CLIENT_COLUMNS, data.clients, "id"),
    tableInsertSql("bookings", BOOKING_COLUMNS, data.bookings, "id"),
    tableInsertSql("app_settings", SETTINGS_COLUMNS, data.app_settings, "id"),
    tableInsertSql("audit_logs", AUDIT_COLUMNS, data.audit_logs, "id"),
    "commit;",
    "",
  ].join("\n");

  downloadTextFile(`soloway-backup-${stamp}-supabase.sql`, sql, "application/sql;charset=utf-8;");
  return counts(data, instructions.length);
}

async function fetchBackupData(): Promise<BackupData> {
  const [clients, bookings, auditLogs, appSettings] = await Promise.all([
    supabase.from("clients").select("*").order("created_at", { ascending: true }),
    supabase.from("bookings").select("*").order("visit_date", { ascending: true }).order("visit_time", { ascending: true }),
    supabase.from("audit_logs").select("*").order("created_at", { ascending: true }),
    supabase.from("app_settings").select("*").order("id", { ascending: true }),
  ]);

  if (clients.error) throw clients.error;
  if (bookings.error) throw bookings.error;
  if (auditLogs.error) throw auditLogs.error;
  if (appSettings.error) throw appSettings.error;

  return {
    clients: clients.data ?? [],
    bookings: bookings.data ?? [],
    audit_logs: auditLogs.data ?? [],
    app_settings: appSettings.data ?? [],
  };
}

function tableInsertSql<T extends Record<string, unknown>>(
  table: string,
  columns: string[],
  rows: T[],
  conflictColumn: string,
) {
  if (rows.length === 0) return `-- public.${table}: no rows`;

  const quotedColumns = columns.map(quoteIdent).join(", ");
  const values = rows
    .map((row) => `  (${columns.map((column) => sqlValue(column, row[column])).join(", ")})`)
    .join(",\n");
  const updates = columns
    .filter((column) => column !== conflictColumn)
    .map((column) => `${quoteIdent(column)} = excluded.${quoteIdent(column)}`)
    .join(", ");

  return [
    `insert into public.${quoteIdent(table)} (${quotedColumns}) values`,
    values,
    `on conflict (${quoteIdent(conflictColumn)}) do update set ${updates};`,
    "",
  ].join("\n");
}

function sqlValue(column: string, value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (column === "data" || column === "before_data" || column === "after_data") {
    return `${sqlString(JSON.stringify(value))}::jsonb`;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return "ARRAY[]::text[]";
    return `ARRAY[${value.map((item) => sqlString(String(item))).join(", ")}]::text[]`;
  }
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "object") return `${sqlString(JSON.stringify(value))}::jsonb`;
  return sqlString(String(value));
}

function sqlString(value: string) {
  return `'${value.replace(/'/g, "''")}'`;
}

function quoteIdent(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function toCsv<T extends Record<string, unknown>>(headers: string[], rows: T[]) {
  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvValue(row[header])).join(",")),
  ];
  return `\uFEFF${lines.join("\n")}`;
}

function csvValue(value: unknown) {
  if (value === null || value === undefined) return "";
  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  if (/[",\n;]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function instructionsRows(settingsRows: AppSettingsRow[]) {
  const settings = settingsRows[0]?.data as {
    instructions?: { administrator?: string; teacher?: string };
  } | null;
  return [
    {
      section: "administrator",
      title: "Для Адміністратора",
      text: settings?.instructions?.administrator ?? "",
    },
    {
      section: "teacher",
      title: "Для Вихователя",
      text: settings?.instructions?.teacher ?? "",
    },
  ];
}

function counts(data: BackupData, instructions: number): BackupCounts {
  return {
    clients: data.clients.length,
    bookings: data.bookings.length,
    instructions,
    audit_logs: data.audit_logs.length,
    app_settings: data.app_settings.length,
  };
}

function downloadTextFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function backupStamp() {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}
