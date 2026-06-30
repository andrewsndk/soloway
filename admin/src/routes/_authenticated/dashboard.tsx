import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatTime, formatUAH } from "@/lib/pricing";
import { formatLabel, fetchSettings } from "@/lib/settings";
import { CalendarDays, TrendingUp, Users, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Дашборд — Soloway CRM" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: fetchSettings });
  const { data: bookings } = useQuery({
    queryKey: ["bookings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bookings").select("*").order("visit_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const { data: clients } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id");
      if (error) throw error;
      return data;
    },
  });

  const today = new Date().toISOString().slice(0, 10);
  const weekFrom = new Date();
  weekFrom.setDate(weekFrom.getDate() - 6);
  const weekFromStr = weekFrom.toISOString().slice(0, 10);

  const todaysBookings = (bookings ?? []).filter((b) => b.visit_date === today);
  const weekBookings = (bookings ?? []).filter((b) => b.visit_date >= weekFromStr);
  const weekRevenue = weekBookings
    .filter((b) => b.status !== "Скасовано")
    .reduce((s, b) => s + Number(b.amount || 0), 0);
  const upcoming = (bookings ?? [])
    .filter((b) => b.visit_date >= today && b.status !== "Скасовано")
    .sort((a, b) => (a.visit_date + (a.visit_time ?? "")).localeCompare(b.visit_date + (b.visit_time ?? "")))
    .slice(0, 6);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Доброго дня!</h1>
        <p className="text-sm text-muted-foreground">Огляд по дитячому простору Soloway</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={<CalendarDays className="h-5 w-5" />} label="Бронювань сьогодні" value={todaysBookings.length} />
        <Stat icon={<Sparkles className="h-5 w-5" />} label="За тиждень" value={weekBookings.length} />
        <Stat icon={<TrendingUp className="h-5 w-5" />} label="Дохід (7 днів)" value={formatUAH(weekRevenue)} />
        <Stat icon={<Users className="h-5 w-5" />} label="Активні клієнти" value={clients?.length ?? 0} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Найближчі візити</CardTitle>
        </CardHeader>
        <CardContent>
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">Поки що немає запланованих візитів.</p>
          ) : (
            <div className="divide-y">
              {upcoming.map((b) => (
                <Link
                  key={b.id}
                  to="/clients/$id"
                  params={{ id: b.client_id ?? "" }}
                  className="flex flex-wrap items-center justify-between gap-2 py-3 hover:bg-accent/30 px-2 -mx-2 rounded-md transition"
                >
                  <div>
                    <div className="font-medium">{b.child_name} <span className="text-muted-foreground font-normal">({b.parent_name})</span></div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(b.visit_date)} {formatTime(b.visit_time)} · {settings ? formatLabel(settings.formats, b.format) : b.format}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary">{b.status}</Badge>
                    <span className="font-semibold">{formatUAH(b.amount)}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">{icon}</div>
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-xl font-semibold">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}