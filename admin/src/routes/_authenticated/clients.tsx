import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ClientCardDialog } from "@/components/ClientCardDialog";
import { BirthdayBadge } from "@/components/BirthdayBadge";
import { LunchStatusBadge, SubscriptionBadge } from "@/components/LunchStatus";
import type { LunchStatus } from "@/lib/lunch";
import { downloadCSV } from "@/lib/csv";
import { formatDate, formatUAH } from "@/lib/pricing";
import { logActionQuietly } from "@/lib/audit";
import { AlertTriangle, Download, ImageIcon, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/clients")({
  head: () => ({ meta: [{ title: "Клієнти — Soloway CRM" }] }),
  component: ClientsPage,
});

function ClientsPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [clientDialogId, setClientDialogId] = useState<string | null>(null);
  const [clientDialogOpen, setClientDialogOpen] = useState(false);
  const { data } = useQuery({
    queryKey: ["clients-with-stats"],
    queryFn: async () => {
      const [{ data: clients, error: e1 }, { data: bookings, error: e2 }, { data: subscriptions, error: e3 }] = await Promise.all([
        supabase.from("clients").select("*").order("created_at", { ascending: false }),
        supabase.from("bookings").select("client_id,visit_date,visit_time,amount,status,payment_status,lunch_status"),
        supabase.from("client_subscriptions").select("client_id,plan_type,status,visits_used,visits_limit,expires_at,created_at").in("status", ["pending", "active"]).order("created_at", { ascending: false }),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      if (e3) throw e3;
      const subscriptionByClient = new Map<string, (typeof subscriptions)[number]>();
      (subscriptions ?? []).forEach((subscription) => {
        if (!subscriptionByClient.has(subscription.client_id)) subscriptionByClient.set(subscription.client_id, subscription);
      });
      const byClient = new Map<string, { count: number; total: number; first?: string; last?: string; lastLunchStatus?: LunchStatus; lastLunchSort?: string }>();
      (bookings ?? []).forEach((b) => {
        if (!b.client_id) return;
        if (b.status === "Скасовано") return;
        const cur = byClient.get(b.client_id) ?? { count: 0, total: 0 };
        cur.count += 1;
        if (b.payment_status === "оплачено готівкою" || b.payment_status === "оплачено карткою") {
          cur.total += Number(b.amount || 0);
        }
        if (!cur.first || b.visit_date < cur.first) cur.first = b.visit_date;
        if (!cur.last || b.visit_date > cur.last) cur.last = b.visit_date;
        if (b.status === "Завершено" && (b.lunch_status === "paid" || b.lunch_status === "unpaid")) {
          const lunchSort = `${b.visit_date}T${b.visit_time ?? "00:00"}`;
          if (!cur.lastLunchSort || lunchSort > cur.lastLunchSort) {
            cur.lastLunchSort = lunchSort;
            cur.lastLunchStatus = b.lunch_status as LunchStatus;
          }
        }
        byClient.set(b.client_id, cur);
      });
      return (clients ?? []).map((c) => ({ ...c, stats: byClient.get(c.id) ?? { count: 0, total: 0 }, subscription: subscriptionByClient.get(c.id) ?? null }));
    },
  });

  const filtered = useMemo(() => {
    const s = q.toLowerCase().trim();
    if (!s) return data ?? [];
    return (data ?? []).filter((c) =>
      c.child_name.toLowerCase().includes(s) ||
      c.parent_name.toLowerCase().includes(s) ||
      (c.phone ?? "").toLowerCase().includes(s),
    );
  }, [data, q]);
  const totalClients = data?.length ?? 0;
  const isSearching = q.trim().length > 0;

  const exportCSV = () => {
    const rows = filtered.map((c) => ({
      Дитина: c.child_name,
      Батьки: c.parent_name,
      Телефон: c.phone ?? "",
      "Дата народження": c.child_birthdate ?? "",
      "Особливість": c.attention_label ?? "",
      Відвідувань: c.stats.count,
      "Витрачено, UAH": c.stats.total,
      "Перший візит": c.stats.first ?? "",
      "Останній візит": c.stats.last ?? "",
    }));
    downloadCSV(`clients-${new Date().toISOString().slice(0,10)}.csv`, rows);
  };

  const openClient = (id: string) => {
    setClientDialogId(id);
    setClientDialogOpen(true);
  };

  const deleteMut = useMutation({
    mutationFn: async (client: ClientWithStats) => {
      const { data: before } = await supabase.from("clients").select("*").eq("id", client.id).maybeSingle();
      const { error } = await supabase.from("clients").delete().eq("id", client.id);
      if (error) throw error;
      await logActionQuietly({
        action: "delete",
        entityType: "client",
        entityId: client.id,
        entityLabel: `${client.child_name} · ${client.parent_name}`,
        summary: `Видалено картку клієнта ${client.child_name}`,
        before: before ?? client,
      });
    },
    onSuccess: () => {
      toast.success("Клієнта видалено");
      qc.invalidateQueries({ queryKey: ["clients-with-stats"] });
      qc.invalidateQueries({ queryKey: ["bookings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold md:text-3xl">Клієнти</h1>
          <p className="text-sm text-muted-foreground">
            Усього клієнтів: <span className="font-medium text-foreground">{totalClients}</span>
            {isSearching && (
              <>
                {" · "}знайдено: <span className="font-medium text-foreground">{filtered.length}</span>
              </>
            )}
          </p>
        </div>
        <Button variant="outline" onClick={exportCSV}><Download className="mr-1 h-4 w-4" />Експорт CSV</Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <Input placeholder="Пошук за іменем дитини, батьків або телефоном…" value={q} onChange={(e) => setQ(e.target.value)} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
                <TableRow>
                  <TableHead className="w-[72px]">Фото</TableHead>
                  <TableHead>Дитина</TableHead>
                  <TableHead>Батьки</TableHead>
                <TableHead>Телефон</TableHead>
                  <TableHead className="text-center">Візитів</TableHead>
                  <TableHead className="text-right">Витрачено</TableHead>
                  <TableHead>Останній візит</TableHead>
                  <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={8} className="py-6 text-center text-muted-foreground">Клієнтів не знайдено</TableCell></TableRow>
              )}
              {filtered.map((c) => (
                <TableRow
                  key={c.id}
                  className="cursor-pointer"
                  tabIndex={0}
                  onClick={() => openClient(c.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      openClient(c.id);
                    }
                  }}
                >
                  <TableCell>
                    <div className="h-11 w-11 overflow-hidden rounded-md border bg-muted">
                      {c.photo_url ? (
                        <img src={c.photo_url} alt={c.child_name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                          <ImageIcon className="h-5 w-5" />
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <button
                      type="button"
                      className="text-left font-medium hover:underline"
                      onClick={(event) => {
                        event.stopPropagation();
                        openClient(c.id);
                      }}
                    >
                      {c.child_name}
                    </button>
                    {c.child_birthdate && (
                      <div className="text-xs text-muted-foreground">нар. {formatDate(c.child_birthdate)}</div>
                    )}
                    <div className="flex flex-wrap gap-1">
                      <BirthdayBadge birthdate={c.child_birthdate} />
                      <AttentionBadge label={c.attention_label} />
                      <LunchStatusBadge status={c.stats.lastLunchStatus} />
                      <SubscriptionBadge subscription={c.subscription} />
                    </div>
                  </TableCell>
                  <TableCell>{c.parent_name}</TableCell>
                  <TableCell>{c.phone ?? "—"}</TableCell>
                  <TableCell className="text-center">{c.stats.count}</TableCell>
                  <TableCell className="text-right font-semibold">{formatUAH(c.stats.total)}</TableCell>
                  <TableCell>{c.stats.last ? formatDate(c.stats.last) : "—"}</TableCell>
                  <TableCell className="text-right">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={(event) => event.stopPropagation()}
                          disabled={deleteMut.isPending}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent onClick={(event) => event.stopPropagation()}>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Видалити клієнта?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Картку {c.child_name} буде видалено. Бронювання залишаться в системі, але без прив'язки до цієї картки.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Скасувати</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteMut.mutate(c)}>Видалити</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ClientCardDialog
        open={clientDialogOpen}
        onOpenChange={setClientDialogOpen}
        clientId={clientDialogId}
      />
    </div>
  );
}

type ClientWithStats = {
  id: string;
  parent_name: string;
  child_name: string;
  phone: string | null;
  photo_url: string | null;
  child_birthdate: string | null;
  attention_label: string | null;
  stats: {
    count: number;
    total: number;
    first?: string;
    last?: string;
    lastLunchStatus?: LunchStatus;
    lastLunchSort?: string;
  };
  subscription: {
    client_id: string;
    plan_type: string;
    status: string;
    visits_used: number;
    visits_limit: number | null;
    expires_at: string | null;
    created_at: string;
  } | null;
};

function AttentionBadge({ label }: { label?: string | null }) {
  if (!label?.trim()) return null;

  return (
    <Badge className="mt-1 inline-flex max-w-[220px] items-center gap-1 border border-red-200 bg-red-50 text-red-800 hover:bg-red-50">
      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{label}</span>
    </Badge>
  );
}
