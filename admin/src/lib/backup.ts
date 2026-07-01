import { supabase } from "@/integrations/supabase/client";
import type { Json, Tables } from "@/integrations/supabase/types";
import { DEFAULT_SETTINGS, type AppSettings } from "@/lib/settings";

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

  const zip = createZip([
    { name: "clients.csv", content: toCsv(CLIENT_COLUMNS, data.clients) },
    { name: "bookings.csv", content: toCsv(BOOKING_COLUMNS, data.bookings) },
    { name: "instructions.csv", content: toCsv(["section", "title", "text"], instructions) },
    { name: "audit_logs.csv", content: toCsv(AUDIT_COLUMNS, data.audit_logs) },
    { name: "app_settings.csv", content: toCsv(SETTINGS_COLUMNS, data.app_settings) },
  ]);
  downloadBlob(`soloway-backup-${stamp}-csv.zip`, new Blob([zip], { type: "application/zip" }));

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

export async function downloadAccountantPeriodCsv({
  dateFrom,
  dateTo,
}: {
  dateFrom: string;
  dateTo: string;
}): Promise<{ count: number; total: number }> {
  if (!dateFrom || !dateTo) throw new Error("Оберіть дату початку і дату завершення періоду");
  if (dateFrom > dateTo) throw new Error("Дата початку не може бути пізніше дати завершення");

  const [{ data: bookings, error }, settings] = await Promise.all([
    supabase
      .from("bookings")
      .select("*")
      .gte("visit_date", dateFrom)
      .lte("visit_date", dateTo)
      .order("visit_date", { ascending: true })
      .order("visit_time", { ascending: true }),
    fetchBackupSettings(),
  ]);
  if (error) throw error;

  const rows = (bookings ?? []).map((booking) => ({
    date: booking.visit_date,
    time: booking.visit_time?.slice(0, 5) ?? "",
    child_name: booking.child_name,
    parent_name: booking.parent_name,
    phone: booking.phone ?? "",
    format: formatLabel(settings, booking.format),
    hours: booking.hours ?? "",
    payment_status: booking.payment_status,
    status: booking.status,
    amount: booking.amount,
    source: booking.source ?? "",
    extra_services: booking.extra_services ?? [],
    parent_comment: booking.parent_comment ?? "",
    teacher_comment: booking.teacher_comment ?? "",
  }));

  const activeRows = rows.filter((row) => row.status !== "Скасовано");
  const total = sum(activeRows.map((row) => row.amount));
  const paidCash = sum(activeRows.filter((row) => row.payment_status === "оплачено готівкою").map((row) => row.amount));
  const paidCard = sum(activeRows.filter((row) => row.payment_status === "оплачено карткою").map((row) => row.amount));
  const unpaid = sum(activeRows.filter((row) => row.payment_status === "не оплачено").map((row) => row.amount));
  const cancelled = sum(rows.filter((row) => row.status === "Скасовано").map((row) => row.amount));

  const csv = toCsv(
    [
      "Дата",
      "Час",
      "Дитина",
      "Батьки",
      "Телефон",
      "Формат",
      "Годин",
      "Оплата",
      "Статус",
      "Сума",
      "Джерело",
      "Послуги",
      "Коментар батьків",
      "Карта візиту",
    ],
    rows.map((row) => ({
      Дата: row.date,
      Час: row.time,
      Дитина: row.child_name,
      Батьки: row.parent_name,
      Телефон: row.phone,
      Формат: row.format,
      Годин: row.hours,
      Оплата: row.payment_status,
      Статус: row.status,
      Сума: row.amount,
      Джерело: row.source,
      Послуги: row.extra_services,
      "Коментар батьків": row.parent_comment,
      "Карта візиту": row.teacher_comment,
    })),
    [
      [],
      ["Підсумки за період", `${dateFrom} — ${dateTo}`],
      ["Усього бронювань", rows.length],
      ["Активних бронювань без скасованих", activeRows.length],
      ["Сума без скасованих", total],
      ["Оплачено готівкою", paidCash],
      ["Оплачено карткою", paidCard],
      ["Не оплачено", unpaid],
      ["Скасовано на суму", cancelled],
    ],
  );

  downloadTextFile(`soloway-accounting-${dateFrom}_${dateTo}.csv`, csv, "text/csv;charset=utf-8;");
  return { count: rows.length, total };
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

function toCsv<T extends Record<string, unknown>>(headers: string[], rows: T[], footerRows: unknown[][] = []) {
  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvValue(row[header])).join(",")),
    ...footerRows.map((row) => row.map(csvValue).join(",")),
  ];
  return `\uFEFF${lines.join("\n")}`;
}

async function fetchBackupSettings(): Promise<AppSettings> {
  const { data, error } = await supabase
    .from("app_settings")
    .select("data")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw error;
  return { ...DEFAULT_SETTINGS, ...((data?.data as Partial<AppSettings> | null) ?? {}) };
}

function formatLabel(settings: AppSettings, key: string) {
  return settings.formats.find((format) => format.key === key)?.label ?? key;
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + Number(value || 0), 0);
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
  downloadBlob(filename, blob);
}

function downloadBlob(filename: string, blob: Blob) {
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

type ZipInputFile = {
  name: string;
  content: string;
};

function createZip(files: ZipInputFile[]) {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;
  const date = new Date();
  const dosTimeValue = dosTime(date);
  const dosDateValue = dosDate(date);

  files.forEach((file) => {
    const nameBytes = encoder.encode(file.name);
    const data = encoder.encode(file.content);
    const crc = crc32(data);

    const localHeader = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(localHeader.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0x0800, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, dosTimeValue, true);
    localView.setUint16(12, dosDateValue, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, data.length, true);
    localView.setUint32(22, data.length, true);
    localView.setUint16(26, nameBytes.length, true);
    localView.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(centralHeader.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0x0800, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, dosTimeValue, true);
    centralView.setUint16(14, dosDateValue, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, data.length, true);
    centralView.setUint32(24, data.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, 0, true);
    centralView.setUint32(42, offset, true);
    centralHeader.set(nameBytes, 46);

    localParts.push(localHeader, data);
    centralParts.push(centralHeader);
    offset += localHeader.length + data.length;
  });

  const centralOffset = offset;
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const endRecord = new Uint8Array(22);
  const endView = new DataView(endRecord.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(4, 0, true);
  endView.setUint16(6, 0, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, centralOffset, true);
  endView.setUint16(20, 0, true);

  return concatBytes([...localParts, ...centralParts, endRecord]);
}

function concatBytes(parts: Uint8Array[]) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  parts.forEach((part) => {
    out.set(part, offset);
    offset += part.length;
  });
  return out;
}

let crcTable: Uint32Array | null = null;

function crc32(data: Uint8Array) {
  const table = getCrcTable();
  let crc = 0xffffffff;
  data.forEach((byte) => {
    crc = (crc >>> 8) ^ table[(crc ^ byte) & 0xff];
  });
  return (crc ^ 0xffffffff) >>> 0;
}

function getCrcTable() {
  if (crcTable) return crcTable;

  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let value = i;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[i] = value >>> 0;
  }
  crcTable = table;
  return table;
}

function dosTime(date: Date) {
  return (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
}

function dosDate(date: Date) {
  return ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
}
