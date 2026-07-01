import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { BookingDialog } from "@/components/BookingDialog";
import { ClientCardDialog } from "@/components/ClientCardDialog";
import { PAYMENT_STATUSES } from "@/lib/payment";
import { formatDate, formatTime, formatUAH } from "@/lib/pricing";
import { formatLabel, fetchSettings } from "@/lib/settings";
import { compactDiff, logActionQuietly } from "@/lib/audit";
import {
  AlertTriangle,
  Banknote,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  ClipboardList,
  CreditCard,
  Download,
  History,
  MessageSquareText,
  Plus,
  Settings,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Дашборд — Soloway CRM" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  const qc = useQueryClient();
  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: fetchSettings });
  const { data: bookings } = useQuery({
    queryKey: ["bookings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("*")
        .order("visit_date", { ascending: false })
        .order("visit_time", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: clients } = useQuery({
    queryKey: ["clients-dashboard"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: auditLogs } = useQuery({
    queryKey: ["audit-logs-dashboard"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return data ?? [];
    },
  });

  const [bookingOpen, setBookingOpen] = useState(false);
  const [clientDialogId, setClientDialogId] = useState<string | null>(null);
  const [clientDialogOpen, setClientDialogOpen] = useState(false);
  const [completionBooking, setCompletionBooking] = useState<BookingRow | null>(null);
  const [completionComment, setCompletionComment] = useState("");

  const today = localDate();
  const tomorrow = addDays(today, 1);
  const weekEnd = addDays(today, 6);
  const monthStart = today.slice(0, 8) + "01";

  const allBookings = bookings ?? [];
  const allClients = clients ?? [];
  const todaysBookings = useMemo(
    () => allBookings.filter((booking) => booking.visit_date === today).sort(byDateTimeAsc),
    [allBookings, today],
  );
  const tomorrowBookings = useMemo(
    () => allBookings.filter((booking) => booking.visit_date === tomorrow).sort(byDateTimeAsc),
    [allBookings, tomorrow],
  );
  const weekBookings = useMemo(
    () => allBookings.filter((booking) => booking.visit_date >= today && booking.visit_date <= weekEnd).sort(byDateTimeAsc),
    [allBookings, today, weekEnd],
  );
  const monthBookings = useMemo(
    () => allBookings.filter((booking) => booking.visit_date >= monthStart && booking.visit_date <= today),
    [allBookings, monthStart, today],
  );

  const problemBookings = useMemo(() => {
    const newBookings = allBookings.filter((booking) => booking.status === "Нове");
    const unpaid = allBookings.filter((booking) => booking.status !== "Скасовано" && booking.payment_status === "не оплачено");
    const noPhone = allBookings.filter((booking) => !booking.phone?.trim());
    const completedWithoutVisitMap = allBookings.filter((booking) => booking.status === "Завершено" && !booking.teacher_comment?.trim());
    return { newBookings, unpaid, noPhone, completedWithoutVisitMap };
  }, [allBookings]);

  const importantClients = useMemo(
    () => allClients.filter((client) =>
      client.admin_comment?.trim() ||
      client.teacher_comment?.trim() ||
      client.parent_questionnaire?.trim() ||
      client.who_can_pickup?.trim(),
    ).slice(0, 6),
    [allClients],
  );

  const todayMoney = moneyStats(todaysBookings);
  const weekMoney = moneyStats(weekBookings);
  const monthMoney = moneyStats(monthBookings);
  const weekDays = buildWeekDays(today).map((date) => {
    const dayBookings = allBookings.filter((booking) => booking.visit_date === date);
    const amount = moneyStats(dayBookings).active;
    return { date, count: dayBookings.length, amount };
  });
  const maxDayAmount = Math.max(...weekDays.map((day) => day.amount), 1);

  const paymentMut = useMutation({
    mutationFn: async ({ booking, payment_status }: { booking: BookingRow; payment_status: string }) => {
      const { data: before } = await supabase.from("bookings").select("*").eq("id", booking.id).maybeSingle();
      const { data: updated, error } = await supabase
        .from("bookings")
        .update({ payment_status })
        .eq("id", booking.id)
        .select("*")
        .single();
      if (error) throw error;
      await logActionQuietly({
        action: "update",
        entityType: "booking",
        entityId: booking.id,
        entityLabel: `${updated.child_name} · ${updated.visit_date}`,
        summary: `Змінено оплату бронювання для ${updated.child_name}: ${payment_status}`,
        before: before ? compactDiff(before, updated) : null,
        after: updated,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bookings"] });
      qc.invalidateQueries({ queryKey: ["audit-logs-dashboard"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const statusMut = useMutation({
    mutationFn: async ({
      booking,
      status,
      teacher_comment,
    }: {
      booking: BookingRow;
      status: string;
      teacher_comment?: string;
    }) => {
      const comment = teacher_comment?.trim();
      if (status === "Завершено" && !comment && !booking.teacher_comment?.trim()) {
        throw new Error("Для завершеного візиту додайте короткий коментар: що робила дитина і що її захопило");
      }

      const { data: before } = await supabase.from("bookings").select("*").eq("id", booking.id).maybeSingle();
      const payload = {
        status,
        ...(status === "Завершено" && comment ? { teacher_comment: comment } : {}),
      };
      const { data: updated, error } = await supabase
        .from("bookings")
        .update(payload)
        .eq("id", booking.id)
        .select("*")
        .single();
      if (error) throw error;

      await logActionQuietly({
        action: "update",
        entityType: "booking",
        entityId: booking.id,
        entityLabel: `${updated.child_name} · ${updated.visit_date}`,
        summary: status === "Завершено"
          ? `Завершено візит для ${updated.child_name} з картою візиту`
          : `Змінено статус бронювання для ${updated.child_name}: ${status}`,
        before: before ? compactDiff(before, updated) : null,
        after: updated,
      });
    },
    onSuccess: () => {
      toast.success("Статус оновлено");
      setCompletionBooking(null);
      setCompletionComment("");
      qc.invalidateQueries({ queryKey: ["bookings"] });
      qc.invalidateQueries({ queryKey: ["client-bookings"] });
      qc.invalidateQueries({ queryKey: ["audit-logs-dashboard"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const changeStatus = (booking: BookingRow, status: string) => {
    if (status === booking.status) return;
    if (status === "Завершено" && !booking.teacher_comment?.trim()) {
      setCompletionBooking(booking);
      setCompletionComment("");
      return;
    }
    statusMut.mutate({ booking, status });
  };

  const openClient = (clientId: string | null) => {
    if (!clientId) return;
    setClientDialogId(clientId);
    setClientDialogOpen(true);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Дашборд</h1>
          <p className="text-sm text-muted-foreground">Робочий екран дня і загальна статистика Soloway</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setBookingOpen(true)}>
            <Plus className="mr-1 h-4 w-4" />Додати бронювання
          </Button>
          <Button variant="outline" asChild>
            <Link to="/settings"><Download className="mr-1 h-4 w-4" />Експорт</Link>
          </Button>
        </div>
      </div>

      <Tabs defaultValue="today" className="space-y-4">
        <TabsList>
          <TabsTrigger value="today">Сьогодні</TabsTrigger>
          <TabsTrigger value="stats">Статистика</TabsTrigger>
        </TabsList>

        <TabsContent value="today" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat icon={<CalendarDays className="h-5 w-5" />} label="Візитів сьогодні" value={todaysBookings.length} />
            <Stat icon={<Users className="h-5 w-5" />} label="Дітей завтра" value={tomorrowBookings.length} />
            <Stat icon={<TrendingUp className="h-5 w-5" />} label="Очікувана сума" value={formatUAH(todayMoney.active)} />
            <Stat icon={<CircleAlert className="h-5 w-5" />} label="Не оплачено" value={formatUAH(todayMoney.unpaid)} tone="warning" />
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <CardTitle>Сьогоднішні візити</CardTitle>
                <Badge variant="secondary">{formatDate(today)}</Badge>
              </CardHeader>
              <CardContent className="space-y-3">
                {todaysBookings.length === 0 ? (
                  <EmptyLine text="На сьогодні немає бронювань." />
                ) : todaysBookings.map((booking) => (
                  <BookingWorkRow
                    key={booking.id}
                    booking={booking}
                    settings={settings}
                    paymentPending={paymentMut.isPending}
                    statusPending={statusMut.isPending}
                    onPaymentChange={(payment_status) => paymentMut.mutate({ booking, payment_status })}
                    onStatusChange={(status) => changeStatus(booking, status)}
                    onOpenClient={() => openClient(booking.client_id)}
                  />
                ))}
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card>
                <CardHeader><CardTitle>Проблеми на контролі</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  <ProblemLink label="Нові непідтверджені" value={problemBookings.newBookings.length} to="/bookings" />
                  <ProblemLink label="Не оплачено" value={problemBookings.unpaid.length} to="/bookings" warning />
                  <ProblemLink label="Без телефону" value={problemBookings.noPhone.length} to="/bookings" />
                  <ProblemLink label="Завершено без карти" value={problemBookings.completedWithoutVisitMap.length} to="/bookings" warning />
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Быстрые действия</CardTitle></CardHeader>
                <CardContent className="grid gap-2">
                  <Button variant="outline" asChild className="justify-start">
                    <Link to="/instructions"><ClipboardList className="mr-2 h-4 w-4" />Інструкції для команди</Link>
                  </Button>
                  <Button variant="outline" asChild className="justify-start">
                    <Link to="/audit"><History className="mr-2 h-4 w-4" />Останні зміни</Link>
                  </Button>
                  <Button variant="outline" asChild className="justify-start">
                    <Link to="/settings"><Settings className="mr-2 h-4 w-4" />Бекап і бухгалтерія</Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Найближчі візити</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {weekBookings.length === 0 ? (
                  <EmptyLine text="На найближчі 7 днів немає запланованих візитів." />
                ) : weekBookings.slice(0, 8).map((booking) => (
                  <CompactBookingRow
                    key={booking.id}
                    booking={booking}
                    settings={settings}
                    onOpenClient={() => openClient(booking.client_id)}
                  />
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Діти з важливими нотатками</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {importantClients.length === 0 ? (
                  <EmptyLine text="Поки немає заповнених нотаток у картках клієнтів." />
                ) : importantClients.map((client) => (
                  <button
                    key={client.id}
                    type="button"
                    onClick={() => openClient(client.id)}
                    className="w-full rounded-md border p-3 text-left transition hover:bg-accent/40"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium">{client.child_name}</div>
                      <Badge variant="secondary">{client.parent_name}</Badge>
                    </div>
                    <div className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {client.teacher_comment || client.admin_comment || client.parent_questionnaire || client.who_can_pickup}
                    </div>
                  </button>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="stats" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat icon={<Sparkles className="h-5 w-5" />} label="Візитів за 7 днів" value={weekBookings.length} />
            <Stat icon={<TrendingUp className="h-5 w-5" />} label="Дохід за 7 днів" value={formatUAH(weekMoney.active)} />
            <Stat icon={<Users className="h-5 w-5" />} label="Клієнтів у базі" value={allClients.length} />
            <Stat icon={<CheckCircle2 className="h-5 w-5" />} label="Завершено за місяць" value={monthBookings.filter((b) => b.status === "Завершено").length} />
          </div>

          <div className="grid gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
            <Card>
              <CardHeader><CardTitle>Фінанси за місяць</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <MoneyLine icon={<TrendingUp className="h-4 w-4" />} label="Всього без скасованих" value={monthMoney.active} />
                <MoneyLine icon={<Banknote className="h-4 w-4" />} label="Оплачено готівкою" value={monthMoney.cash} />
                <MoneyLine icon={<CreditCard className="h-4 w-4" />} label="Оплачено карткою" value={monthMoney.card} />
                <MoneyLine icon={<AlertTriangle className="h-4 w-4" />} label="Не оплачено" value={monthMoney.unpaid} />
                <MoneyLine icon={<CircleAlert className="h-4 w-4" />} label="Скасовано" value={monthMoney.cancelled} muted />
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Завантаження на 7 днів</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {weekDays.map((day) => (
                  <div key={day.date} className="grid gap-2 md:grid-cols-[120px_1fr_110px] md:items-center">
                    <div className="text-sm">
                      <div className="font-medium">{formatDate(day.date)}</div>
                      <div className="text-xs text-muted-foreground">{day.count} візитів</div>
                    </div>
                    <Progress value={(day.amount / maxDayAmount) * 100} />
                    <div className="text-right text-sm font-semibold">{formatUAH(day.amount)}</div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Останні дії</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {(auditLogs ?? []).length === 0 ? (
                  <EmptyLine text="Історія дій поки порожня." />
                ) : (auditLogs ?? []).map((log) => (
                  <div key={log.id} className="rounded-md border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Badge variant={log.action === "delete" ? "destructive" : "secondary"}>{auditActionLabel(log.action)}</Badge>
                      <span className="text-xs text-muted-foreground">{formatDate(log.created_at.slice(0, 10))} {formatTime(log.created_at.slice(11, 16))}</span>
                    </div>
                    <div className="mt-2 text-sm font-medium">{log.summary}</div>
                    <div className="text-xs text-muted-foreground">{log.actor_login ?? log.actor_email ?? "—"}</div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Статуси бронювань за місяць</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {statusSummary(monthBookings).map((item) => (
                  <div key={item.status} className="flex items-center justify-between rounded-md border px-3 py-2">
                    <Badge variant={item.status === "Скасовано" ? "destructive" : item.status === "Завершено" ? "default" : "secondary"}>
                      {item.status}
                    </Badge>
                    <div className="font-semibold">{item.count}</div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <BookingDialog open={bookingOpen} onOpenChange={setBookingOpen} />
      <ClientCardDialog open={clientDialogOpen} onOpenChange={setClientDialogOpen} clientId={clientDialogId} />
      <CompletionCommentDialog
        booking={completionBooking}
        comment={completionComment}
        onCommentChange={setCompletionComment}
        onOpenChange={(open) => {
          if (!open && !statusMut.isPending) {
            setCompletionBooking(null);
            setCompletionComment("");
          }
        }}
        onSubmit={() => {
          if (!completionBooking) return;
          statusMut.mutate({
            booking: completionBooking,
            status: "Завершено",
            teacher_comment: completionComment,
          });
        }}
        pending={statusMut.isPending}
      />
    </div>
  );
}

type BookingRow = {
  id: string;
  client_id: string | null;
  parent_name: string;
  child_name: string;
  phone: string | null;
  format: string;
  hours: number | null;
  visit_date: string;
  visit_time: string | null;
  source: string | null;
  extra_services: string[];
  amount: number;
  amount_override: boolean;
  payment_status: string;
  parent_comment: string | null;
  teacher_comment: string | null;
  status: string;
};

function BookingWorkRow({
  booking,
  settings,
  paymentPending,
  statusPending,
  onPaymentChange,
  onStatusChange,
  onOpenClient,
}: {
  booking: BookingRow;
  settings?: Awaited<ReturnType<typeof fetchSettings>>;
  paymentPending: boolean;
  statusPending: boolean;
  onPaymentChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onOpenClient: () => void;
}) {
  return (
    <div className="rounded-md border p-3">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_190px_160px] lg:items-center">
        <div>
          <button type="button" onClick={onOpenClient} className="text-left font-semibold hover:underline">
            {formatTime(booking.visit_time)} · {booking.child_name}
          </button>
          <div className="text-sm text-muted-foreground">
            {booking.parent_name} · {booking.phone || "без телефону"} · {settings ? formatLabel(settings.formats, booking.format) : booking.format}
          </div>
          <div className="mt-1 text-sm font-medium">{formatUAH(booking.amount)}</div>
        </div>
        <PaymentSelect booking={booking} pending={paymentPending} onChange={onPaymentChange} />
        <StatusSelect booking={booking} settings={settings} pending={statusPending} onChange={onStatusChange} />
      </div>
    </div>
  );
}

function CompactBookingRow({
  booking,
  settings,
  onOpenClient,
}: {
  booking: BookingRow;
  settings?: Awaited<ReturnType<typeof fetchSettings>>;
  onOpenClient: () => void;
}) {
  return (
    <button type="button" onClick={onOpenClient} className="w-full rounded-md border p-3 text-left transition hover:bg-accent/40">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-medium">{formatDate(booking.visit_date)} {formatTime(booking.visit_time)} · {booking.child_name}</div>
        <Badge variant={booking.status === "Скасовано" ? "destructive" : "secondary"}>{booking.status}</Badge>
      </div>
      <div className="mt-1 text-sm text-muted-foreground">
        {booking.parent_name} · {settings ? formatLabel(settings.formats, booking.format) : booking.format} · {formatUAH(booking.amount)}
      </div>
    </button>
  );
}

function PaymentSelect({
  booking,
  pending,
  onChange,
}: {
  booking: BookingRow;
  pending: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <Select value={booking.payment_status ?? "не оплачено"} onValueChange={onChange} disabled={pending}>
      <SelectTrigger className={`h-9 ${paymentStyle(booking.payment_status)}`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {PAYMENT_STATUSES.map((status) => (
          <SelectItem key={status} value={status}>{status}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function StatusSelect({
  booking,
  settings,
  pending,
  onChange,
}: {
  booking: BookingRow;
  settings?: Awaited<ReturnType<typeof fetchSettings>>;
  pending: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <Select value={booking.status} onValueChange={onChange} disabled={pending}>
      <SelectTrigger className="h-9">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {(settings?.statuses ?? ["Нове", "Підтверджено", "Завершено", "Скасовано"]).map((status) => (
          <SelectItem key={status} value={status}>{status}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function CompletionCommentDialog({
  booking,
  comment,
  onCommentChange,
  onOpenChange,
  onSubmit,
  pending,
}: {
  booking: BookingRow | null;
  comment: string;
  onCommentChange: (value: string) => void;
  onOpenChange: (open: boolean) => void;
  onSubmit: () => void;
  pending: boolean;
}) {
  return (
    <Dialog open={!!booking} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Карта візиту перед завершенням</DialogTitle>
          <DialogDescription>
            {booking
              ? `Напишіть коротко, що робила дитина ${booking.child_name} і що її захопило.`
              : "Напишіть короткий коментар про візит."}
          </DialogDescription>
        </DialogHeader>
        <Textarea
          rows={5}
          value={comment}
          onChange={(event) => onCommentChange(event.target.value)}
          placeholder="Наприклад: малювала фарбами, грала з конструктором, зацікавилась сенсорними іграми..."
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Скасувати
          </Button>
          <Button onClick={onSubmit} disabled={pending || !comment.trim()}>
            {pending ? "Збереження..." : "Завершити візит"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stat({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  tone?: "warning";
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-5">
        <div className={`flex h-10 w-10 items-center justify-center rounded-full ${tone === "warning" ? "bg-amber-100 text-amber-700" : "bg-primary/10 text-primary"}`}>
          {icon}
        </div>
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-xl font-semibold">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function ProblemLink({ label, value, to, warning }: { label: string; value: number; to: "/bookings"; warning?: boolean }) {
  return (
    <Button variant="outline" asChild className="h-auto w-full justify-between py-3">
      <Link to={to}>
        <span className="flex items-center gap-2">
          {warning ? <AlertTriangle className="h-4 w-4 text-amber-600" /> : <CircleAlert className="h-4 w-4 text-muted-foreground" />}
          {label}
        </span>
        <Badge variant={warning && value > 0 ? "destructive" : "secondary"}>{value}</Badge>
      </Link>
    </Button>
  );
}

function MoneyLine({ icon, label, value, muted }: { icon: React.ReactNode; label: string; value: number; muted?: boolean }) {
  return (
    <div>
      <div className={`flex items-center justify-between gap-3 ${muted ? "text-muted-foreground" : ""}`}>
        <div className="flex items-center gap-2 text-sm">
          {icon}
          {label}
        </div>
        <div className="font-semibold">{formatUAH(value)}</div>
      </div>
      <Separator className="mt-3" />
    </div>
  );
}

function EmptyLine({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

function moneyStats(bookings: BookingRow[]) {
  const activeBookings = bookings.filter((booking) => booking.status !== "Скасовано");
  return {
    active: sum(activeBookings.map((booking) => booking.amount)),
    cash: sum(activeBookings.filter((booking) => booking.payment_status === "оплачено готівкою").map((booking) => booking.amount)),
    card: sum(activeBookings.filter((booking) => booking.payment_status === "оплачено карткою").map((booking) => booking.amount)),
    unpaid: sum(activeBookings.filter((booking) => booking.payment_status === "не оплачено").map((booking) => booking.amount)),
    cancelled: sum(bookings.filter((booking) => booking.status === "Скасовано").map((booking) => booking.amount)),
  };
}

function statusSummary(bookings: BookingRow[]) {
  const counts = new Map<string, number>();
  bookings.forEach((booking) => counts.set(booking.status, (counts.get(booking.status) ?? 0) + 1));
  return Array.from(counts.entries()).map(([status, count]) => ({ status, count }));
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + Number(value || 0), 0);
}

function byDateTimeAsc(a: BookingRow, b: BookingRow) {
  return `${a.visit_date} ${a.visit_time ?? ""}`.localeCompare(`${b.visit_date} ${b.visit_time ?? ""}`);
}

function localDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(dateString: string, days: number) {
  const date = new Date(`${dateString}T00:00:00`);
  date.setDate(date.getDate() + days);
  return localDate(date);
}

function buildWeekDays(start: string) {
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

function paymentStyle(status?: string | null) {
  switch (status) {
    case "оплачено готівкою":
      return "border-emerald-200 bg-emerald-50 text-emerald-900";
    case "оплачено карткою":
      return "border-sky-200 bg-sky-50 text-sky-900";
    default:
      return "border-amber-200 bg-amber-50 text-amber-900";
  }
}

function auditActionLabel(action: string) {
  switch (action) {
    case "create":
      return "Створення";
    case "update":
      return "Зміна";
    case "delete":
      return "Видалення";
    default:
      return action;
  }
}
