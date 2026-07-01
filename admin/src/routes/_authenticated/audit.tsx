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
                  <TableCell className="min-w-[280px] text-sm">{item.summary}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

