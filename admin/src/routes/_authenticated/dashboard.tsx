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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { BookingDialog } from "@/components/BookingDialog";
import { ClientCardDialog } from "@/components/ClientCardDialog";
import { CheckoutTimeDialog } from "@/components/CheckoutTimeDialog";
import { VisitNoteEditor } from "@/components/VisitNoteEditor";
import { BirthdayBadge } from "@/components/BirthdayBadge";
import { SoloAssistantButton } from "@/components/SoloAssistant";
import { SubscriptionPanel } from "@/components/SubscriptionPanel";
import { LunchStatusQuickSelect, LunchStatusSelect } from "@/components/LunchStatus";
import type { LunchStatus } from "@/lib/lunch";
import { PAYMENT_STATUSES, statusAfterPaymentChange } from "@/lib/payment";
import { actualStayMinutes, bookingStartDateTime, calcExtraDue, formatDate, formatDateTime, formatDuration, formatTime, formatUAH } from "@/lib/pricing";
import { formatLabel, fetchSettings } from "@/lib/settings";
import { compactDiff, logActionQuietly } from "@/lib/audit";
import { downloadDashboardStatsPdf } from "@/lib/dashboard-report-pdf";
import logoSrc from "@/assets/l.png";
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
  Trash2,
  TrendingUp,
  Users,
} from "lucide-react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { toast } from "sonner";

type StatsRangeMode = "day" | "week" | "month" | "custom";
type ExpensePaymentMethod = "cash" | "card";
type ReportExpenseDraft = { id: string; name: string; amount: string; paymentMethod: ExpensePaymentMethod };

const visitsChartConfig = {
  visits: {
    label: "Візити",
    color: "hsl(var(--primary))",
  },
  completed: {
    label: "Завершено",
    color: "hsl(158 64% 38%)",
  },
} satisfies ChartConfig;

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
  const { data: cashExpenses = [] } = useQuery({
    queryKey: ["cash-expenses-dashboard"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cash_expenses")
        .select("id, expense_date, name, amount, payment_method")
        .order("expense_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const [bookingOpen, setBookingOpen] = useState(false);
  const [clientDialogId, setClientDialogId] = useState<string | null>(null);
  const [clientDialogOpen, setClientDialogOpen] = useState(false);
  const [completionBooking, setCompletionBooking] = useState<BookingRow | null>(null);
  const [completionComment, setCompletionComment] = useState("");
  const [completionParentSummary, setCompletionParentSummary] = useState("");
  const [completionLunchStatus, setCompletionLunchStatus] = useState<LunchStatus | "">("");
  const [timeDialog, setTimeDialog] = useState<{ booking: BookingRow; mode: "check-in" | "check-out"; defaultTime: string } | null>(null);
  const [statsRangeMode, setStatsRangeMode] = useState<StatsRangeMode>("week");
  const [customStatsFrom, setCustomStatsFrom] = useState(() => localDate());
  const [customStatsTo, setCustomStatsTo] = useState(() => localDate());
  const [statsPdfOpen, setStatsPdfOpen] = useState(false);
  const [statsPdfExpenses, setStatsPdfExpenses] = useState<ReportExpenseDraft[]>(() => [createExpenseDraft()]);

  const today = localDate();
  const tomorrow = addDays(today, 1);
  const weekStart = startOfCalendarWeek(today);
  const weekEnd = addDays(weekStart, 6);
  const monthStart = today.slice(0, 8) + "01";
  const monthEnd = endOfCalendarMonth(today);

  const allBookings = bookings ?? [];
  const allClients = clients ?? [];
  const clientMetaById = useMemo(
    () => new Map(allClients.map((client) => [client.id, client])),
    [allClients],
  );
  const todaysBookings = useMemo(
    () => allBookings.filter((booking) => booking.visit_date === today).sort(byDateTimeAsc),
    [allBookings, today],
  );
  const tomorrowBookings = useMemo(
    () => allBookings.filter((booking) => booking.visit_date === tomorrow).sort(byDateTimeAsc),
    [allBookings, tomorrow],
  );
  const weekBookings = useMemo(
    () => allBookings.filter((booking) => booking.visit_date >= weekStart && booking.visit_date <= weekEnd).sort(byDateTimeAsc),
    [allBookings, weekStart, weekEnd],
  );

  const problemBookings = useMemo(() => {
    const newBookings = allBookings.filter((booking) => booking.status === "Нове");
    const unpaid = allBookings.filter((booking) =>
      booking.status !== "Скасовано" &&
      booking.status !== "Не прийшли" &&
      Number(booking.amount ?? 0) > 0 &&
      booking.payment_status === "не оплачено"
    );
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
  const statsRange = useMemo(
    () => getStatsRange(statsRangeMode, {
      today,
      weekStart,
      weekEnd,
      monthStart,
      monthEnd,
      customFrom: customStatsFrom,
      customTo: customStatsTo,
    }),
    [customStatsFrom, customStatsTo, monthEnd, monthStart, statsRangeMode, today, weekEnd, weekStart],
  );
  const statsRangeInvalid = statsRange.start > statsRange.end;
  const periodBookings = useMemo(
    () => statsRangeInvalid
      ? []
      : allBookings
        .filter((booking) => booking.visit_date >= statsRange.start && booking.visit_date <= statsRange.end)
        .sort(byDateTimeAsc),
    [allBookings, statsRange.end, statsRange.start, statsRangeInvalid],
  );
  const periodMoney = moneyStats(periodBookings);
  const periodExpenses = useMemo(
    () => statsRangeInvalid ? [] : cashExpenses
      .filter((expense) => expense.expense_date >= statsRange.start && expense.expense_date <= statsRange.end)
      .map((expense) => ({
        name: expense.name,
        amount: Number(expense.amount) || 0,
        paymentMethod: expense.payment_method === "card" ? "card" as const : "cash" as const,
      })),
    [cashExpenses, statsRange.end, statsRange.start, statsRangeInvalid],
  );
  const periodCashExpenses = sum(periodExpenses.filter((expense) => expense.paymentMethod === "cash").map((expense) => expense.amount));
  const periodCashBalance = periodMoney.cash - periodCashExpenses;
  const periodVisits = visitStats(periodBookings);
  const periodStatusSummary = useMemo(() => statusSummary(periodBookings), [periodBookings]);
  const periodDays = useMemo(
    () => statsRangeInvalid ? [] : buildDateRange(statsRange.start, statsRange.end).map((date) => {
      const dayBookings = allBookings.filter((booking) => booking.visit_date === date);
      const money = moneyStats(dayBookings);
      const visits = visitStats(dayBookings);
      return {
        date,
        label: formatShortDate(date),
        visits: visits.scheduled,
        completed: visits.completed,
        count: visits.scheduled,
        amount: money.received,
      };
    }),
    [allBookings, statsRange.end, statsRange.start, statsRangeInvalid],
  );
  const maxPeriodAmount = Math.max(...periodDays.map((day) => day.amount), 1);
  const todayVisits = visitStats(todaysBookings);

  const paymentMut = useMutation({
    mutationFn: async ({ booking, payment_status }: { booking: BookingRow; payment_status: string }) => {
      const { data: before } = await supabase.from("bookings").select("*").eq("id", booking.id).maybeSingle();
      const sourceStatus = before?.status ?? booking.status;
      const nextStatus = statusAfterPaymentChange(sourceStatus, payment_status);
      const payload = {
        payment_status,
        ...(nextStatus !== sourceStatus ? { status: nextStatus } : {}),
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
        summary: nextStatus !== sourceStatus
          ? `Змінено оплату бронювання для ${updated.child_name}: ${payment_status}, статус автоматично Підтверджено`
          : `Змінено оплату бронювання для ${updated.child_name}: ${payment_status}`,
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
      parent_summary,
      lunch_status,
    }: {
      booking: BookingRow;
      status: string;
      teacher_comment?: string;
      parent_summary?: string;
      lunch_status?: LunchStatus;
    }) => {
      const comment = teacher_comment?.trim();
      const summary = parent_summary?.trim();
      if (status === "Завершено" && !comment && !booking.teacher_comment?.trim()) {
        throw new Error("Для завершеного візиту додайте короткий коментар: що робила дитина і що її захопило");
      }
      if (status === "Завершено" && !lunch_status) throw new Error("Вкажіть статус додаткового обіду");

      const { data: before } = await supabase.from("bookings").select("*").eq("id", booking.id).maybeSingle();
      const payload = {
        status,
        ...(status === "Завершено" && comment ? { teacher_comment: comment } : {}),
        ...(status === "Завершено" && summary ? { parent_summary: summary } : {}),
        ...(status === "Завершено" ? { lunch_status } : {}),
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
      setCompletionParentSummary("");
      setCompletionLunchStatus("");
      qc.invalidateQueries({ queryKey: ["bookings"] });
      qc.invalidateQueries({ queryKey: ["client-bookings"] });
      qc.invalidateQueries({ queryKey: ["audit-logs-dashboard"] });
      qc.invalidateQueries({ queryKey: ["solo-insight"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const checkMut = useMutation({
    mutationFn: async ({
      booking,
      checkInAt,
      checkOutAt,
    }: {
      booking: BookingRow;
      checkInAt?: string;
      checkOutAt?: string;
    }) => {
      const payload = {
        ...(checkInAt ? { check_in_at: checkInAt } : {}),
        ...(checkOutAt ? {
          check_in_at: booking.check_in_at ?? bookingStartDateTime(booking.visit_date, booking.visit_time) ?? checkOutAt,
          check_out_at: checkOutAt,
        } : {}),
      };
      const { data: before } = await supabase.from("bookings").select("*").eq("id", booking.id).maybeSingle();
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
        summary: checkInAt ? `Оновлено час приходу дитини ${updated.child_name}` : `Оновлено час виходу дитини ${updated.child_name}`,
        before: before ? compactDiff(before, updated) : null,
        after: updated,
      });
    },
    onSuccess: () => {
      toast.success("Час візиту оновлено");
      setTimeDialog(null);
      qc.invalidateQueries({ queryKey: ["bookings"] });
      qc.invalidateQueries({ queryKey: ["client-bookings"] });
      qc.invalidateQueries({ queryKey: ["audit-logs-dashboard"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const changeStatus = (booking: BookingRow, status: string) => {
    if (status === booking.status) return;
    if (status === "Завершено") {
      setCompletionBooking(booking);
      setCompletionComment(booking.teacher_comment ?? "");
      setCompletionParentSummary(booking.parent_summary ?? "");
      setCompletionLunchStatus((booking.lunch_status as LunchStatus) ?? "");
      return;
    }
    statusMut.mutate({ booking, status });
  };

  const openVisitTimeDialog = (booking: BookingRow, mode: "check-in" | "check-out") => {
    const fallbackCheckIn = booking.check_in_at ?? bookingStartDateTime(booking.visit_date, booking.visit_time);
    setTimeDialog({
      booking,
      mode,
      defaultTime: timeValueFromDateTime(mode === "check-in" ? fallbackCheckIn : booking.check_out_at) ?? currentTimeValue(),
    });
  };

  const submitVisitTime = (time: string) => {
    if (!timeDialog) return;
    const { booking, mode } = timeDialog;
    const selectedAt = bookingStartDateTime(booking.visit_date, time);
    if (!selectedAt) {
      toast.error(mode === "check-in" ? "Оберіть коректний час чек-іну" : "Оберіть коректний час чек-ауту");
      return;
    }
    const checkInAt = mode === "check-in"
      ? selectedAt
      : booking.check_in_at ?? bookingStartDateTime(booking.visit_date, booking.visit_time);
    const checkOutAt = mode === "check-out" ? selectedAt : booking.check_out_at;
    if (checkInAt && checkOutAt && new Date(checkOutAt).getTime() <= new Date(checkInAt).getTime()) {
      toast.error("Чек-аут має бути пізніше часу входу");
      return;
    }
    checkMut.mutate({
      booking,
      ...(mode === "check-in" ? { checkInAt: selectedAt } : { checkOutAt: selectedAt }),
    });
  };

  const openClient = (clientId: string | null) => {
    if (!clientId) return;
    setClientDialogId(clientId);
    setClientDialogOpen(true);
  };

  const openStatsPdfDialog = () => {
    if (statsRangeInvalid) {
      toast.error("Оберіть коректний період для PDF");
      return;
    }
    setStatsPdfOpen(true);
  };

  const downloadStatsPdf = async () => {
    const expenses = statsPdfExpenses
      .map((expense) => ({
        name: expense.name.trim(),
        amount: Number(String(expense.amount).replace(",", ".")) || 0,
        paymentMethod: expense.paymentMethod,
      }))
      .filter((expense) => expense.name || expense.amount > 0);
    const cashExpenses = sum([
      ...periodExpenses.filter((expense) => expense.paymentMethod === "cash").map((expense) => expense.amount),
      ...expenses.filter((expense) => expense.paymentMethod === "cash").map((expense) => expense.amount),
    ]);

    try {
      await downloadDashboardStatsPdf({
        logoSrc,
        rangeLabel: statsRange.label,
        generatedAt: new Date().toLocaleString("uk-UA"),
        visits: periodVisits,
        money: periodMoney,
        days: periodDays,
        statuses: periodStatusSummary,
        expenses: [...periodExpenses, ...expenses],
        cashBalance: periodMoney.cash - cashExpenses,
      });
      setStatsPdfOpen(false);
      toast.success("PDF звіт сформовано");
    } catch (error) {
      console.error("PDF report error:", error);
      toast.error("Не вдалося сформувати PDF звіт");
    }
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
            <Stat icon={<CalendarDays className="h-5 w-5" />} label="Заплановано сьогодні" value={todayVisits.scheduled} />
            <Stat icon={<Users className="h-5 w-5" />} label="Дітей завтра" value={visitStats(tomorrowBookings).scheduled} />
            <Stat icon={<TrendingUp className="h-5 w-5" />} label="Отримано сьогодні" value={formatUAH(todayMoney.received)} />
            <Stat icon={<CircleAlert className="h-5 w-5" />} label="Очікується оплата" value={formatUAH(todayMoney.expected)} tone="warning" />
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
                    attentionLabel={booking.client_id ? clientMetaById.get(booking.client_id)?.attention_label : null}
                    childBirthdate={booking.client_id ? clientMetaById.get(booking.client_id)?.child_birthdate : null}
                    settings={settings}
                    paymentPending={paymentMut.isPending}
                    statusPending={statusMut.isPending}
                    checkPending={checkMut.isPending}
                    onPaymentChange={(payment_status) => paymentMut.mutate({ booking, payment_status })}
                    onStatusChange={(status) => changeStatus(booking, status)}
                    onLunchStatusChange={(lunch_status) => statusMut.mutate({ booking, status: booking.status, lunch_status })}
                    onCheckIn={() => openVisitTimeDialog(booking, "check-in")}
                    onCheckOut={() => openVisitTimeDialog(booking, "check-out")}
                    onOpenClient={() => openClient(booking.client_id)}
                  />
                ))}
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card>
                <CardHeader><CardTitle>Проблеми на контролі</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  <ProblemLink label="Нові непідтверджені" value={problemBookings.newBookings.length} search={{ status: "Нове" }} />
                  <ProblemLink label="Не оплачено" value={problemBookings.unpaid.length} search={{ problem: "unpaid" }} warning />
                  <ProblemLink label="Без телефону" value={problemBookings.noPhone.length} search={{ problem: "no-phone" }} />
                  <ProblemLink label="Завершено без карти" value={problemBookings.completedWithoutVisitMap.length} search={{ problem: "completed-without-visit-map" }} warning />
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Швидкі дії</CardTitle></CardHeader>
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
              <CardHeader><CardTitle>Візити цього тижня</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {weekBookings.length === 0 ? (
                  <EmptyLine text="На цей календарний тиждень немає запланованих візитів." />
                ) : weekBookings.slice(0, 8).map((booking) => (
                  <CompactBookingRow
                    key={booking.id}
                    booking={booking}
                    attentionLabel={booking.client_id ? clientMetaById.get(booking.client_id)?.attention_label : null}
                    childBirthdate={booking.client_id ? clientMetaById.get(booking.client_id)?.child_birthdate : null}
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
          <Card>
            <CardContent className="flex flex-col gap-4 p-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <CardTitle className="text-lg">Період статистики</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">{statsRange.label}</p>
                {statsRangeInvalid && (
                  <p className="mt-1 text-sm font-medium text-destructive">Дата початку має бути раніше дати завершення.</p>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-[190px_160px_160px_auto] sm:items-end">
                <div className="space-y-2">
                  <Label>Показати</Label>
                  <Select value={statsRangeMode} onValueChange={(value) => setStatsRangeMode(value as StatsRangeMode)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="day">1 день</SelectItem>
                      <SelectItem value="week">1 тиждень</SelectItem>
                      <SelectItem value="month">1 місяць</SelectItem>
                      <SelectItem value="custom">Свій період</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {statsRangeMode === "custom" && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="stats-from">Від</Label>
                      <Input
                        id="stats-from"
                        type="date"
                        value={customStatsFrom}
                        onChange={(event) => setCustomStatsFrom(event.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="stats-to">До</Label>
                      <Input
                        id="stats-to"
                        type="date"
                        value={customStatsTo}
                        onChange={(event) => setCustomStatsTo(event.target.value)}
                      />
                    </div>
                  </>
                )}
                <Button
                  type="button"
                  variant="outline"
                  onClick={openStatsPdfDialog}
                  disabled={statsRangeInvalid}
                  className={statsRangeMode === "custom" ? "" : "sm:col-start-2"}
                >
                  <Download className="mr-2 h-4 w-4" />PDF звіт
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat icon={<Sparkles className="h-5 w-5" />} label="Усього бронювань" value={periodVisits.total} />
            <Stat icon={<CalendarDays className="h-5 w-5" />} label="Активних візитів" value={periodVisits.scheduled} />
            <Stat icon={<CheckCircle2 className="h-5 w-5" />} label="Завершено" value={periodVisits.completed} />
            <Stat icon={<TrendingUp className="h-5 w-5" />} label="Отримано за період" value={formatUAH(periodMoney.received)} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Графік відвідувань</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={visitsChartConfig} className="h-[280px] w-full">
                <AreaChart data={periodDays} margin={{ left: 0, right: 12, top: 8 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    width={28}
                  />
                  <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent labelKey="date" />}
                  />
                  <Area
                    dataKey="visits"
                    type="monotone"
                    fill="var(--color-visits)"
                    fillOpacity={0.18}
                    dot={false}
                    activeDot={<LogoChartDot />}
                    stroke="var(--color-visits)"
                    strokeWidth={2}
                  />
                  <Area
                    dataKey="completed"
                    type="monotone"
                    fill="var(--color-completed)"
                    fillOpacity={0.12}
                    dot={false}
                    stroke="var(--color-completed)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <div className="grid gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
            <Card>
              <CardHeader><CardTitle>Фінанси за період</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <MoneyLine icon={<TrendingUp className="h-4 w-4" />} label="Отримано оплат" value={periodMoney.received} />
                <MoneyLine icon={<Banknote className="h-4 w-4" />} label="Оплачено готівкою" value={periodMoney.cash} />
                <MoneyLine icon={<CreditCard className="h-4 w-4" />} label="Оплачено карткою" value={periodMoney.card} />
                <MoneyLine icon={<AlertTriangle className="h-4 w-4" />} label="Очікується оплата" value={periodMoney.expected} />
                <MoneyLine icon={<CircleAlert className="h-4 w-4" />} label="Оплачені, але не прийшли" value={periodMoney.noShowPaid} muted />
                <MoneyLine icon={<CircleAlert className="h-4 w-4" />} label="Скасовано" value={periodMoney.cancelled} muted />
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Завантаження за період</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {periodDays.length === 0 ? (
                  <EmptyLine text="За цей період немає даних для статистики." />
                ) : periodDays.map((day) => (
                  <div key={day.date} className="grid gap-2 md:grid-cols-[120px_1fr_110px] md:items-center">
                    <div className="text-sm">
                      <div className="font-medium">{formatDate(day.date)}</div>
                      <div className="text-xs text-muted-foreground">{day.count} візитів</div>
                    </div>
                    <Progress value={(day.amount / maxPeriodAmount) * 100} />
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
              <CardHeader><CardTitle>Статуси бронювань за період</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {periodBookings.length === 0 ? (
                  <EmptyLine text="У вибраному періоді немає бронювань." />
                ) : periodStatusSummary.map((item) => (
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
        parentSummary={completionParentSummary}
        lunchStatus={completionLunchStatus}
        onCommentChange={setCompletionComment}
        onParentSummaryChange={setCompletionParentSummary}
        onLunchStatusChange={setCompletionLunchStatus}
        onOpenChange={(open) => {
          if (!open && !statusMut.isPending) {
            setCompletionBooking(null);
            setCompletionComment("");
            setCompletionParentSummary("");
          }
        }}
        onSubmit={() => {
          if (!completionBooking) return;
          statusMut.mutate({
            booking: completionBooking,
            status: "Завершено",
            teacher_comment: completionComment,
            parent_summary: completionParentSummary,
            lunch_status: completionLunchStatus as LunchStatus,
          });
        }}
        pending={statusMut.isPending}
      />
      <CheckoutTimeDialog
        open={!!timeDialog}
        childName={timeDialog?.booking.child_name}
        defaultTime={timeDialog?.defaultTime}
        mode={timeDialog?.mode}
        pending={checkMut.isPending}
        onOpenChange={(open) => {
          if (!open && !checkMut.isPending) {
            setTimeDialog(null);
          }
        }}
        onSubmit={submitVisitTime}
      />
      <StatsPdfDialog
        open={statsPdfOpen}
        onOpenChange={setStatsPdfOpen}
        expenses={statsPdfExpenses}
        onExpensesChange={setStatsPdfExpenses}
        onSubmit={downloadStatsPdf}
        received={periodMoney.received}
        savedExpenses={periodExpenses}
      />
    </div>
  );
}

function createExpenseDraft(): ReportExpenseDraft {
  return { id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, name: "", amount: "", paymentMethod: "cash" };
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
  check_in_at: string | null;
  check_out_at: string | null;
  payment_status: string;
  parent_comment: string | null;
  teacher_comment: string | null;
  parent_summary: string | null;
  lunch_status?: string | null;
  subscription_id?: string | null;
  subscription_plan?: string | null;
  status: string;
};

function currentTimeValue() {
  const date = new Date();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function StatsPdfDialog({
  open,
  onOpenChange,
  expenses,
  onExpensesChange,
  onSubmit,
  received,
  savedExpenses,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expenses: ReportExpenseDraft[];
  onExpensesChange: (expenses: ReportExpenseDraft[]) => void;
  onSubmit: () => void;
  received: number;
  savedExpenses: Array<{ name: string; amount: number; paymentMethod: ExpensePaymentMethod }>;
}) {
  const expensesTotal = [...savedExpenses, ...expenses].reduce((total, expense) => total + (Number(String(expense.amount).replace(",", ".")) || 0), 0);

  const updateExpense = (id: string, patch: Partial<ReportExpenseDraft>) => {
    onExpensesChange(expenses.map((expense) => expense.id === id ? { ...expense, ...patch } : expense));
  };

  const removeExpense = (id: string) => {
    const next = expenses.filter((expense) => expense.id !== id);
    onExpensesChange(next.length > 0 ? next : [createExpenseDraft()]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>PDF звіт з витратами</DialogTitle>
          <DialogDescription>
            Збережені витрати за період автоматично потраплять у звіт. Нові рядки нижче додаються лише до цього PDF.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="hidden gap-2 text-sm font-medium text-muted-foreground sm:grid sm:grid-cols-[minmax(0,1fr)_130px_150px_40px]">
            <div>На що</div>
            <div>Сума, ₴</div>
            <div>Оплата</div>
            <div />
          </div>
          {expenses.map((expense) => (
            <div key={expense.id} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_130px_150px_40px]">
              <Input
                value={expense.name}
                onChange={(event) => updateExpense(expense.id, { name: event.target.value })}
                placeholder="Наприклад: вода"
              />
              <Input
                value={expense.amount}
                onChange={(event) => updateExpense(expense.id, { amount: event.target.value })}
                inputMode="decimal"
                placeholder="450"
              />
              <Select
                value={expense.paymentMethod}
                onValueChange={(value) => updateExpense(expense.id, { paymentMethod: value as ExpensePaymentMethod })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Готівка</SelectItem>
                  <SelectItem value="card">Картка</SelectItem>
                </SelectContent>
              </Select>
              <Button type="button" variant="ghost" size="icon" onClick={() => removeExpense(expense.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            onClick={() => onExpensesChange([...expenses, createExpenseDraft()])}
          >
            <Plus className="mr-2 h-4 w-4" />Додати витрату
          </Button>
          <div className="grid gap-2 rounded-md border bg-muted/30 p-4 text-sm sm:grid-cols-3">
            <div>
              <div className="text-muted-foreground">Отримано</div>
              <div className="text-lg font-semibold">{formatUAH(received)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Витрати</div>
              <div className="text-lg font-semibold">{formatUAH(expensesTotal)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Після витрат</div>
              <div className="text-lg font-semibold">{formatUAH(received - expensesTotal)}</div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Скасувати
          </Button>
          <Button onClick={onSubmit}>
            <Download className="mr-2 h-4 w-4" />Згенерувати PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function timeValueFromDateTime(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function BookingWorkRow({
  booking,
  attentionLabel,
  childBirthdate,
  settings,
  paymentPending,
  statusPending,
  checkPending,
  onPaymentChange,
  onStatusChange,
  onLunchStatusChange,
  onCheckIn,
  onCheckOut,
  onOpenClient,
}: {
  booking: BookingRow;
  attentionLabel?: string | null;
  childBirthdate?: string | null;
  settings?: Awaited<ReturnType<typeof fetchSettings>>;
  paymentPending: boolean;
  statusPending: boolean;
  checkPending: boolean;
  onPaymentChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onLunchStatusChange: (value: LunchStatus) => void;
  onCheckIn: () => void;
  onCheckOut: () => void;
  onOpenClient: () => void;
}) {
  const checkInAt = booking.check_in_at ?? bookingStartDateTime(booking.visit_date, booking.visit_time);
  const minutes = actualStayMinutes(checkInAt, booking.check_out_at);
  const extraDue = settings ? calcExtraDue(booking.amount, booking.format, checkInAt, booking.check_out_at, settings) : 0;

  return (
    <div className="rounded-md border p-3">
      <div className="grid gap-3 2xl:grid-cols-[minmax(260px,1fr)_230px_170px_145px] 2xl:items-center">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-1">
            <button type="button" onClick={onOpenClient} className="break-words text-left font-semibold hover:underline">
              {formatTime(booking.visit_time)} · {booking.child_name}
            </button>
            <SoloAssistantButton clientId={booking.client_id} childName={booking.child_name} />
          </div>
          <div className="flex flex-wrap gap-1">
            <BirthdayBadge birthdate={childBirthdate} />
            <AttentionBadge label={attentionLabel} />
          </div>
          {booking.status === "Завершено" ? <LunchStatusQuickSelect value={booking.lunch_status as LunchStatus | null} onChange={onLunchStatusChange} /> : null}
          <div className="mt-1 break-words text-sm text-muted-foreground">
            {booking.parent_name} · {booking.phone || "без телефону"} · {settings ? formatLabel(settings.formats, booking.format) : booking.format}
          </div>
          {booking.client_id ? <SubscriptionPanel clientId={booking.client_id} compact /> : null}
          <div className="mt-1 text-sm font-medium">{formatUAH(booking.amount)}</div>
        </div>
        <CheckInOutControls
          booking={booking}
          pending={checkPending}
          checkInAt={checkInAt}
          minutes={minutes}
          extraDue={extraDue}
          onCheckIn={onCheckIn}
          onCheckOut={onCheckOut}
        />
        <PaymentSelect booking={booking} pending={paymentPending} onChange={onPaymentChange} />
        <StatusSelect booking={booking} settings={settings} pending={statusPending} onChange={onStatusChange} />
      </div>
    </div>
  );
}

function CheckInOutControls({
  booking,
  pending,
  checkInAt,
  minutes,
  extraDue,
  onCheckIn,
  onCheckOut,
}: {
  booking: BookingRow;
  pending: boolean;
  checkInAt: string | null;
  minutes: number | null;
  extraDue: number;
  onCheckIn: () => void;
  onCheckOut: () => void;
}) {
  return (
    <div className="min-w-0 space-y-2 rounded-md bg-muted/40 p-2">
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="min-w-0">
          <div className="text-muted-foreground">Прийшла</div>
          <div className="break-words font-medium">{formatDateTime(checkInAt)}</div>
        </div>
        <div className="min-w-0">
          <div className="text-muted-foreground">Пішла</div>
          <div className="break-words font-medium">{formatDateTime(booking.check_out_at)}</div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={onCheckIn} disabled={pending}>
          {booking.check_in_at ? "Змінити чек-ін" : "Чек-ін"}
        </Button>
        <Button size="sm" variant="outline" onClick={onCheckOut} disabled={pending}>
          {booking.check_out_at ? "Змінити чек-аут" : "Чек-аут"}
        </Button>
        {checkInAt && booking.check_out_at && (
          <Badge variant="secondary">{formatDuration(minutes)}</Badge>
        )}
        {extraDue > 0 && (
          <Badge variant="destructive">Доплата {formatUAH(extraDue)}</Badge>
        )}
      </div>
    </div>
  );
}

function CompactBookingRow({
  booking,
  attentionLabel,
  childBirthdate,
  settings,
  onOpenClient,
}: {
  booking: BookingRow;
  attentionLabel?: string | null;
  childBirthdate?: string | null;
  settings?: Awaited<ReturnType<typeof fetchSettings>>;
  onOpenClient: () => void;
}) {
  return (
    <button type="button" onClick={onOpenClient} className="w-full rounded-md border p-3 text-left transition hover:bg-accent/40">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="break-words font-medium">{formatDate(booking.visit_date)} {formatTime(booking.visit_time)} · {booking.child_name}</div>
          <div className="flex flex-wrap gap-1">
            <BirthdayBadge birthdate={childBirthdate} />
            <AttentionBadge label={attentionLabel} />
          </div>
        </div>
        <StatusLabel status={booking.status} />
      </div>
      <div className="mt-1 text-sm text-muted-foreground">
        {booking.parent_name} · {settings ? formatLabel(settings.formats, booking.format) : booking.format} · {formatUAH(booking.amount)}
      </div>
    </button>
  );
}

function AttentionBadge({ label }: { label?: string | null }) {
  if (!label?.trim()) return null;

  return (
    <Badge className="mt-1 inline-flex max-w-full items-center gap-1 border border-red-200 bg-red-50 text-red-800 hover:bg-red-50">
      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{label}</span>
    </Badge>
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
      <SelectTrigger className={`h-9 w-full min-w-0 2xl:w-[170px] ${paymentStyle(booking.payment_status)}`}>
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
      <SelectTrigger className={`h-9 w-full min-w-0 border 2xl:w-[145px] ${statusStyle(booking.status).trigger}`}>
        <StatusLabel status={booking.status} />
      </SelectTrigger>
      <SelectContent>
        {(settings?.statuses ?? ["Нове", "Підтверджено", "Завершено", "Не прийшли", "Скасовано"]).map((status) => (
          <SelectItem key={status} value={status}>
            <StatusLabel status={status} />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function StatusLabel({ status }: { status: string }) {
  const style = statusStyle(status);

  return (
    <span className="flex min-w-0 items-center gap-2">
      <Badge className={`border px-2 py-0.5 font-semibold ${style.badge}`}>
        {status}
      </Badge>
    </span>
  );
}

function CompletionCommentDialog({
  booking,
  comment,
  parentSummary,
  lunchStatus,
  onCommentChange,
  onParentSummaryChange,
  onLunchStatusChange,
  onOpenChange,
  onSubmit,
  pending,
}: {
  booking: BookingRow | null;
  comment: string;
  parentSummary: string;
  lunchStatus: LunchStatus | "";
  onCommentChange: (value: string) => void;
  onParentSummaryChange: (value: string) => void;
  onLunchStatusChange: (value: LunchStatus) => void;
  onOpenChange: (open: boolean) => void;
  onSubmit: () => void;
  pending: boolean;
}) {
  return (
    <Dialog open={!!booking} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Карта візиту перед завершенням</DialogTitle>
          <DialogDescription>
            {booking
              ? `Напишіть коротко, що робила дитина ${booking.child_name} і що її захопило.`
              : "Напишіть короткий коментар про візит."}
          </DialogDescription>
        </DialogHeader>
        <LunchStatusSelect value={lunchStatus} onChange={onLunchStatusChange} disabled={pending} />
        <VisitNoteEditor
          rawNote={comment}
          parentSummary={parentSummary}
          childName={booking?.child_name}
          visitDate={booking?.visit_date}
          format={booking?.format}
          onRawNoteChange={onCommentChange}
          onParentSummaryChange={onParentSummaryChange}
          disabled={pending}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Скасувати
          </Button>
          <Button onClick={onSubmit} disabled={pending || !comment.trim() || !lunchStatus}>
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

function ProblemLink({
  label,
  value,
  search,
  warning,
}: {
  label: string;
  value: number;
  search: { status?: string; problem?: "unpaid" | "no-phone" | "completed-without-visit-map" };
  warning?: boolean;
}) {
  const bookingSearch = {
    q: "",
    date: "",
    status: "all",
    format: "all",
    source: "all",
    problem: undefined,
    ...search,
  };

  return (
    <Button variant="outline" asChild className="h-auto w-full justify-between py-3">
      <Link to="/bookings" search={bookingSearch}>
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

function LogoChartDot(props: { cx?: number; cy?: number }) {
  const { cx, cy } = props;
  if (cx == null || cy == null) return null;

  return (
    <g transform={`translate(${cx - 16}, ${cy - 16})`}>
      <image href={logoSrc} x="0" y="0" width="32" height="32" preserveAspectRatio="xMidYMid meet" />
    </g>
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
  const paidBookings = bookings.filter((booking) => booking.status !== "Скасовано" && isPaid(booking));
  const expectedBookings = bookings.filter((booking) =>
    booking.status !== "Скасовано" &&
    booking.status !== "Не прийшли" &&
    Number(booking.amount ?? 0) > 0 &&
    booking.payment_status === "не оплачено"
  );
  const noShowPaidBookings = paidBookings.filter((booking) => booking.status === "Не прийшли");
  return {
    received: sum(paidBookings.map((booking) => booking.amount)),
    cash: sum(paidBookings.filter((booking) => booking.payment_status === "оплачено готівкою").map((booking) => booking.amount)),
    card: sum(paidBookings.filter((booking) => booking.payment_status === "оплачено карткою").map((booking) => booking.amount)),
    expected: sum(expectedBookings.map((booking) => booking.amount)),
    noShowPaid: sum(noShowPaidBookings.map((booking) => booking.amount)),
    cancelled: sum(bookings.filter((booking) => booking.status === "Скасовано").map((booking) => booking.amount)),
  };
}

function visitStats(bookings: BookingRow[]) {
  return {
    total: bookings.length,
    scheduled: bookings.filter((booking) => booking.status !== "Скасовано" && booking.status !== "Не прийшли").length,
    completed: bookings.filter((booking) => booking.status === "Завершено").length,
    noShow: bookings.filter((booking) => booking.status === "Не прийшли").length,
    cancelled: bookings.filter((booking) => booking.status === "Скасовано").length,
  };
}

function isPaid(booking: BookingRow) {
  return booking.payment_status === "оплачено готівкою" || booking.payment_status === "оплачено карткою";
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

function startOfCalendarWeek(dateString: string) {
  const date = new Date(`${dateString}T00:00:00`);
  const mondayOffset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - mondayOffset);
  return localDate(date);
}

function endOfCalendarMonth(dateString: string) {
  const [year, month] = dateString.split("-").map(Number);
  return localDate(new Date(year, month, 0));
}

function getStatsRange(
  mode: StatsRangeMode,
  dates: {
    today: string;
    weekStart: string;
    weekEnd: string;
    monthStart: string;
    monthEnd: string;
    customFrom: string;
    customTo: string;
  },
) {
  if (mode === "day") {
    return {
      start: dates.today,
      end: dates.today,
      label: `Календарний день: ${formatDate(dates.today)}`,
    };
  }

  if (mode === "month") {
    return {
      start: dates.monthStart,
      end: dates.monthEnd,
      label: `Календарний місяць: ${formatDate(dates.monthStart)} - ${formatDate(dates.monthEnd)}`,
    };
  }

  if (mode === "custom") {
    const start = isDateString(dates.customFrom) ? dates.customFrom : dates.today;
    const end = isDateString(dates.customTo) ? dates.customTo : dates.today;
    return {
      start,
      end,
      label: `Свій період: ${formatDate(start)} - ${formatDate(end)}`,
    };
  }

  return {
    start: dates.weekStart,
    end: dates.weekEnd,
    label: `Календарний тиждень: ${formatDate(dates.weekStart)} - ${formatDate(dates.weekEnd)}`,
  };
}

function buildDateRange(start: string, end: string) {
  const days: string[] = [];
  let current = start;
  while (current <= end) {
    days.push(current);
    current = addDays(current, 1);
  }
  return days;
}

function isDateString(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function formatShortDate(dateString: string) {
  const [, month, day] = dateString.split("-");
  return `${day}.${month}`;
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

function statusStyle(status?: string | null) {
  switch (status) {
    case "Завершено":
      return {
        trigger: "border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100",
        badge: "border-emerald-200 bg-emerald-100 text-emerald-900 hover:bg-emerald-100",
      };
    case "Підтверджено":
      return {
        trigger: "border-sky-200 bg-sky-50 text-sky-900 hover:bg-sky-100",
        badge: "border-sky-200 bg-sky-100 text-sky-900 hover:bg-sky-100",
      };
    case "Не прийшли":
      return {
        trigger: "border-violet-200 bg-violet-50 text-violet-900 hover:bg-violet-100",
        badge: "border-violet-200 bg-violet-100 text-violet-900 hover:bg-violet-100",
      };
    case "Скасовано":
      return {
        trigger: "border-red-200 bg-red-50 text-red-900 hover:bg-red-100",
        badge: "border-red-200 bg-red-100 text-red-900 hover:bg-red-100",
      };
    default:
      return {
        trigger: "border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100",
        badge: "border-amber-200 bg-amber-100 text-amber-900 hover:bg-amber-100",
      };
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
