import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ClientCardDialog } from "@/components/ClientCardDialog";
import { downloadCSV } from "@/lib/csv";
import { formatDate, formatUAH } from "@/lib/pricing";
import { Download, ImageIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/clients")({
  head: () => ({ meta: [{ title: "Клієнти — Soloway CRM" }] }),
  component: ClientsPage,
});

function ClientsPage() {
  const [q, setQ] = useState("");
  const [clientDialogId, setClientDialogId] = useState<string | null>(null);
  const [clientDialogOpen, setClientDialogOpen] = useState(false);
  const { data } = useQuery({
    queryKey: ["clients-with-stats"],
    queryFn: async () => {
      const [{ data: clients, error: e1 }, { data: bookings, error: e2 }] = await Promise.all([
        supabase.from("clients").select("*").order("created_at", { ascending: false }),
        supabase.from("bookings").select("client_id,visit_date,amount,status"),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      const byClient = new Map<string, { count: number; total: number; first?: string; last?: string }>();
      (bookings ?? []).forEach((b) => {
        if (!b.client_id) return;
        const cur = byClient.get(b.client_id) ?? { count: 0, total: 0 };
        cur.count += 1;
        if (b.status !== "Скасовано") cur.total += Number(b.amount || 0);
        if (!cur.first || b.visit_date < cur.first) cur.first = b.visit_date;
        if (!cur.last || b.visit_date > cur.last) cur.last = b.visit_date;
        byClient.set(b.client_id, cur);
      });
      return (clients ?? []).map((c) => ({ ...c, stats: byClient.get(c.id) ?? { count: 0, total: 0 } }));
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

  const exportCSV = () => {
    const rows = filtered.map((c) => ({
      Дитина: c.child_name,
      Батьки: c.parent_name,
      Телефон: c.phone ?? "",
      "Дата народження": c.child_birthdate ?? "",
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold md:text-3xl">Клієнти</h1>
          <p className="text-sm text-muted-foreground">Картки клієнтів створюються автоматично з бронювань</p>
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={7} className="py-6 text-center text-muted-foreground">Клієнтів не знайдено</TableCell></TableRow>
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
                  </TableCell>
                  <TableCell>{c.parent_name}</TableCell>
                  <TableCell>{c.phone ?? "—"}</TableCell>
                  <TableCell className="text-center">{c.stats.count}</TableCell>
                  <TableCell className="text-right font-semibold">{formatUAH(c.stats.total)}</TableCell>
                  <TableCell>{c.stats.last ? formatDate(c.stats.last) : "—"}</TableCell>
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
