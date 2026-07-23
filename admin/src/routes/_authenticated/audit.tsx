import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatTime } from "@/lib/pricing";
import type { Json } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/audit")({
  head: () => ({ meta: [{ title: "Історія дій — Soloway CRM" }] }),
  component: AuditPage,
});

const ACTION_LABELS: Record<string, string> = {
  create: "Створення",
  update: "Зміна",
  delete: "Видалення",
};

const ENTITY_LABELS: Record<string, string> = {
  booking: "Бронювання",
  client: "Клієнт",
  settings: "Налаштування",
  instructions: "Інструкції",
};

const FIELD_LABELS: Record<string, string> = {
  action: "Дія",
  actor_email: "Email адміна",
  actor_login: "Адмін",
  admin_comment: "Коментар адміна",
  attention_label: "Особливість дитини",
  amount: "Сума",
  amount_override: "Сума вручну",
  check_in_at: "Чек-ін",
  check_out_at: "Чек-аут",
  child_birthdate: "Дата народження дитини",
  child_name: "Ім'я дитини",
  client_id: "Клієнт",
  extra_services: "Додаткові послуги",
  format: "Формат",
  hours: "Години",
  parent_comment: "Коментар батьків",
  parent_summary: "Сводка для батьків",
  parent_name: "Ім'я батьків",
  parent_questionnaire: "Анкета від батьків",
  payment_status: "Тип оплати",
  phone: "Телефон",
  photo_url: "Фото",
  source: "Джерело",
  status: "Статус",
  teacher_comment: "Коментар вихователя",
  visit_date: "Дата візиту",
  visit_time: "Час візиту",
  who_can_pickup: "Хто може забирати",
  tariffs: "Тарифи",
  formats: "Формати",
  sources: "Джерела заявок",
  extra_services_list: "Додаткові послуги",
  statuses: "Статуси",
  instructions: "Інструкції",
  administrator: "Для адміністратора",
  teacher: "Для вихователя",
};

type ChangeRow = {
  label: string;
  before?: Json | null;
  after?: Json | null;
};

function AuditPage() {
  const [q, setQ] = useState("");
  const [action, setAction] = useState("all");
  const [entity, setEntity] = useState("all");

  const { data } = useQuery({
    queryKey: ["audit-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    const search = q.toLowerCase().trim();
    return (data ?? []).filter((item) => {
      if (action !== "all" && item.action !== action) return false;
      if (entity !== "all" && item.entity_type !== entity) return false;
      if (!search) return true;
      return [
        item.actor_login,
        item.actor_email,
        item.summary,
        item.entity_label,
        ACTION_LABELS[item.action],
        ENTITY_LABELS[item.entity_type],
        ...extractChangeRows(item.action, item.before_data, item.after_data)
          .flatMap((row) => [row.label, formatValue(row.before), formatValue(row.after)]),
      ].some((value) => (value ?? "").toLowerCase().includes(search));
    });
  }, [action, data, entity, q]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold md:text-3xl">Історія дій</h1>
        <p className="text-sm text-muted-foreground">Хто і які зміни зробив у CRM</p>
      </div>

      <Card>
        <CardContent className="grid gap-2 p-4 md:grid-cols-3">
          <Input placeholder="Пошук за адміном, клієнтом або дією..." value={q} onChange={(e) => setQ(e.target.value)} />
          <Select value={action} onValueChange={setAction}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Усі дії</SelectItem>
              <SelectItem value="create">Створення</SelectItem>
              <SelectItem value="update">Зміни</SelectItem>
              <SelectItem value="delete">Видалення</SelectItem>
            </SelectContent>
          </Select>
          <Select value={entity} onValueChange={setEntity}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Усі розділи</SelectItem>
              <SelectItem value="booking">Бронювання</SelectItem>
              <SelectItem value="client">Клієнти</SelectItem>
              <SelectItem value="instructions">Інструкції</SelectItem>
              <SelectItem value="settings">Налаштування</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Дата</TableHead>
                <TableHead>Адмін</TableHead>
                <TableHead>Дія</TableHead>
                <TableHead>Розділ</TableHead>
                <TableHead>Об'єкт</TableHead>
                <TableHead>Опис</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                    Історія поки порожня
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="whitespace-nowrap">
                    <div className="font-medium">{formatDate(item.created_at.slice(0, 10))}</div>
                    <div className="text-xs text-muted-foreground">{formatTime(item.created_at.slice(11, 16))}</div>
                  </TableCell>
                  <TableCell>{item.actor_login ?? item.actor_email ?? "—"}</TableCell>
                  <TableCell><Badge variant={item.action === "delete" ? "destructive" : "secondary"}>{ACTION_LABELS[item.action] ?? item.action}</Badge></TableCell>
                  <TableCell>{ENTITY_LABELS[item.entity_type] ?? item.entity_type}</TableCell>
                  <TableCell>{item.entity_label ?? item.entity_id ?? "—"}</TableCell>
                  <TableCell className="min-w-[360px] text-sm">
                    <div className="font-medium">{item.summary}</div>
                    <ChangeDetails action={item.action} before={item.before_data} after={item.after_data} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function ChangeDetails({ action, before, after }: { action: string; before: Json | null; after: Json | null }) {
  const rows = extractChangeRows(action, before, after);
  if (rows.length === 0) {
    return <div className="mt-1 text-xs text-muted-foreground">Деталей зміни немає</div>;
  }

  return (
    <div className="mt-2 space-y-1.5">
      {rows.map((row, index) => (
        <div key={`${row.label}-${index}`} className="rounded-md border bg-muted/30 px-2 py-1.5">
          <div className="text-xs font-medium text-muted-foreground">{row.label}</div>
          {action === "update" ? (
            <div className="mt-1 grid gap-1 text-xs md:grid-cols-[1fr_auto_1fr]">
              <ValueBox tone="before" value={row.before} />
              <span className="self-center text-center text-muted-foreground">→</span>
              <ValueBox tone="after" value={row.after} />
            </div>
          ) : (
            <div className="mt-1 text-xs">
              <ValueText value={action === "delete" ? row.before : row.after} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ValueBox({ tone, value }: { tone: "before" | "after"; value?: Json | null }) {
  return (
    <div className={tone === "before" ? "rounded border border-red-200 bg-red-50 px-2 py-1 text-red-900" : "rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-900"}>
      <ValueText value={value} />
    </div>
  );
}

function ValueText({ value }: { value?: Json | null }) {
  return <span className="whitespace-pre-wrap break-words">{formatValue(value)}</span>;
}

function extractChangeRows(action: string, before: Json | null, after: Json | null): ChangeRow[] {
  if (action === "update" && isRecord(before)) {
    return Object.entries(before)
      .filter(([, value]) => isRecord(value) && ("before" in value || "after" in value))
      .map(([key, value]) => ({
        label: fieldLabel(key),
        before: isRecord(value) ? value.before ?? null : null,
        after: isRecord(value) ? value.after ?? null : null,
      }));
  }

  const source = action === "delete" ? before : after;
  if (!isRecord(source)) return [];

  return Object.entries(source)
    .filter(([key]) => !["id", "created_at", "updated_at", "client_id"].includes(key))
    .filter(([, value]) => value !== null && value !== "" && !(Array.isArray(value) && value.length === 0))
    .slice(0, 8)
    .map(([key, value]) => ({
      label: fieldLabel(key),
      before: action === "delete" ? value : null,
      after: action === "delete" ? null : value,
    }));
}

function fieldLabel(key: string) {
  return FIELD_LABELS[key] ?? key.replaceAll("_", " ");
}

function formatValue(value?: Json | null): string {
  if (value === null || value === undefined || value === "") return "порожньо";
  if (typeof value === "boolean") return value ? "так" : "ні";
  if (Array.isArray(value)) return value.length ? value.map(formatValue).join(", ") : "порожньо";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}

function isRecord(value: unknown): value is Record<string, Json> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
