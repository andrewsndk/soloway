import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { BookingDialog } from "@/components/BookingDialog";
import { ClientCardDialog } from "@/components/ClientCardDialog";
import { CheckoutTimeDialog } from "@/components/CheckoutTimeDialog";
import { VisitNoteEditor } from "@/components/VisitNoteEditor";
import { BirthdayBadge } from "@/components/BirthdayBadge";
import { SoloAssistantButton } from "@/components/SoloAssistant";
import { SubscriptionPanel } from "@/components/SubscriptionPanel";
import { LunchStatusQuickSelect, LunchStatusSelect } from "@/components/LunchStatus";
import type { LunchStatus } from "@/lib/lunch";
import { fetchSettings, formatLabel } from "@/lib/settings";
import { actualStayMinutes, bookingStartDateTime, calcExtraDue, formatDate, formatDateTime, formatDuration, formatTime, formatUAH } from "@/lib/pricing";
import { PAYMENT_STATUSES, statusAfterPaymentChange } from "@/lib/payment";
import { downloadCSV } from "@/lib/csv";
import { compactDiff, logActionQuietly } from "@/lib/audit";
import { getBirthdayReminder } from "@/lib/birthday";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, Banknote, ChevronLeft, ChevronRight, CircleAlert, CreditCard, Download, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

type ProblemFilter = "unpaid" | "no-phone" | "completed-without-visit-map";

const PROBLEM_LABELS: Record<ProblemFilter, string> = {
  unpaid: "Не оплачено",
  "no-phone": "Без телефону",
  "completed-without-visit-map": "Завершено без карти",
};

const isProblemFilter = (value: unknown): value is ProblemFilter =>
  value === "unpaid" || value === "no-phone" || value === "completed-without-visit-map";

export const Route = createFileRoute("/_authenticated/bookings")({
  validateSearch: (search) => ({
    q: typeof search.q === "string" ? search.q : "",
    date: typeof search.date === "string" ? search.date : "",
    status: typeof search.status === "string" ? search.status : "all",
    format: typeof search.format === "string" ? search.format : "all",
    source: typeof search.source === "string" ? search.source : "all",
    problem: isProblemFilter(search.problem) ? search.problem : undefined,
  }),
  head: () => ({ meta: [{ title: "Бронювання — Soloway CRM" }] }),
  component: BookingsPage,
});

function BookingsPage() {
  const qc = useQueryClient();
  const search = Route.useSearch();
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
      return data;
    },
  });
  const { data: clientLabels } = useQuery({
    queryKey: ["client-attention-labels"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, attention_label, child_birthdate");
      if (error) throw error;
      return data ?? [];
    },
  });

  const [q, setQ] = useState(search.q);
  const [statusF, setStatusF] = useState(search.status);
  const [formatF, setFormatF] = useState(search.format);
  const [sourceF, setSourceF] = useState(search.source);
  const [dateF, setDateF] = useState(search.date);
  const [problemF, setProblemF] = useState<ProblemFilter | undefined>(search.problem);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<typeof bookings extends (infer U)[] | undefined ? U : never | undefined>(undefined as never);
  const [clientDialogId, setClientDialogId] = useState<string | null>(null);
  const [clientDialogOpen, setClientDialogOpen] = useState(false);
  const [completionBooking, setCompletionBooking] = useState<BookingRow | null>(null);
  const [completionComment, setCompletionComment] = useState("");
  const [completionParentSummary, setCompletionParentSummary] = useState("");
  const [completionLunchStatus, setCompletionLunchStatus] = useState<LunchStatus | "">("");
  const [timeDialog, setTimeDialog] = useState<{ booking: BookingRow; mode: "check-in" | "check-out"; defaultTime: string } | null>(null);
  const clientMetaById = useMemo(
    () => new Map((clientLabels ?? []).map((client) => [client.id, client])),
    [clientLabels],
  );

  const filtered = useMemo(() => {
    return (bookings ?? []).filter((b) => {
      if (statusF !== "all" && b.status !== statusF) return false;
      if (formatF !== "all" && b.format !== formatF) return false;
      if (sourceF !== "all" && !sourceMatchesFilter(b.source, sourceF)) return false;
      if (dateF && b.visit_date !== dateF) return false;
      if (problemF === "unpaid" && (b.status === "Скасовано" || b.status === "Не прийшли" || Number(b.amount ?? 0) <= 0 || b.payment_status !== "не оплачено")) return false;
      if (problemF === "no-phone" && b.phone?.trim()) return false;
      if (problemF === "completed-without-visit-map" && (b.status !== "Завершено" || b.teacher_comment?.trim())) return false;
      if (q) {
        const s = q.toLowerCase();
        if (
          !b.child_name.toLowerCase().includes(s) &&
          !b.parent_name.toLowerCase().includes(s) &&
          !(b.phone ?? "").toLowerCase().includes(s)
        ) return false;
      }
      return true;
    });
  }, [bookings, q, statusF, formatF, sourceF, dateF, problemF]);

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      const { data: before } = await supabase.from("bookings").select("*").eq("id", id).maybeSingle();
      const { error } = await supabase.from("bookings").delete().eq("id", id);
      if (error) throw error;
      if (before) {
        await logActionQuietly({
          action: "delete",
          entityType: "booking",
          entityId: id,
          entityLabel: `${before.child_name} · ${before.visit_date}`,
          summary: `Видалено бронювання для ${before.child_name} на ${before.visit_date}`,
          before,
        });
      }
    },
    onSuccess: () => {
      toast.success("Видалено");
      qc.invalidateQueries({ queryKey: ["bookings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const paymentMut = useMutation({
    mutationFn: async ({ id, payment_status }: { id: string; payment_status: string }) => {
      const { data: before } = await supabase.from("bookings").select("*").eq("id", id).maybeSingle();
      const nextStatus = before ? statusAfterPaymentChange(before.status, payment_status) : undefined;
      const payload = {
        payment_status,
        ...(nextStatus && nextStatus !== before?.status ? { status: nextStatus } : {}),
      };
      const { data: updated, error } = await supabase.from("bookings").update(payload).eq("id", id).select("*").single();
      if (error) throw error;
      await logActionQuietly({
        action: "update",
        entityType: "booking",
        entityId: id,
        entityLabel: `${updated.child_name} · ${updated.visit_date}`,
        summary: nextStatus && nextStatus !== before?.status
          ? `Змінено оплату бронювання для ${updated.child_name}: ${payment_status}, статус автоматично Підтверджено`
          : `Змінено оплату бронювання для ${updated.child_name}: ${payment_status}`,
        before: before ? compactDiff(before, updated) : null,
        after: updated,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bookings"] });
    },
    onError: (e: Error) => toast.error(e.message),
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
      const { data: updated, error } = await supabase.from("bookings").update(payload).eq("id", booking.id).select("*").single();
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
      qc.invalidateQueries({ queryKey: ["solo-insight"] });
    },
    onError: (e: Error) => toast.error(e.message),
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
      const { data: updated, error } = await supabase.from("bookings").update(payload).eq("id", booking.id).select("*").single();
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
    },
    onError: (e: Error) => toast.error(e.message),
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

  const exportCSV = () => {
    const rows = filtered.map((b) => ({
      Дата: b.visit_date,
      Час: b.visit_time ?? "",
      Батьки: b.parent_name,
      Дитина: b.child_name,
      Телефон: b.phone ?? "",
      Формат: settings ? formatLabel(settings.formats, b.format) : b.format,
      Годин: b.hours ?? "",
      Джерело: b.source ?? "",
      Послуги: (b.extra_services ?? []).join("; "),
      Сума: b.amount,
      Оплата: b.payment_status,
      Статус: b.status,
      "Чек-ін": b.check_in_at ?? bookingStartDateTime(b.visit_date, b.visit_time) ?? "",
      "Чек-аут": b.check_out_at ?? "",
      "Фактичний час": formatDuration(actualStayMinutes(b.check_in_at ?? bookingStartDateTime(b.visit_date, b.visit_time), b.check_out_at)),
      "Доплата": settings ? calcExtraDue(b.amount, b.format, b.check_in_at ?? bookingStartDateTime(b.visit_date, b.visit_time), b.check_out_at, settings) : 0,
    }));
    downloadCSV(`bookings-${new Date().toISOString().slice(0,10)}.csv`, rows);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold md:text-3xl">Бронювання</h1>
          <p className="text-sm text-muted-foreground">Усі візити дітей у вашому просторі</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCSV}><Download className="mr-1 h-4 w-4" />Експорт CSV</Button>
          <Button onClick={() => { setEditing(undefined as never); setOpen(true); }}>
            <Plus className="mr-1 h-4 w-4" />Додати
          </Button>
        </div>
      </div>

      <Tabs defaultValue="list">
        <TabsList>
          <TabsTrigger value="list">Список</TabsTrigger>
          <TabsTrigger value="calendar">Календар</TabsTrigger>
        </TabsList>
        <TabsContent value="list" className="space-y-4">
      <Card>
        <CardContent className="grid min-w-0 gap-2 p-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
          <Input placeholder="Пошук за іменем/телефоном…" value={q} onChange={(e) => setQ(e.target.value)} />
          <Input type="date" value={dateF} onChange={(e) => setDateF(e.target.value)} />
          <Select value={statusF} onValueChange={setStatusF}>
            <SelectTrigger><SelectValue placeholder="Статус" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Усі статуси</SelectItem>
              {settings?.statuses.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={formatF} onValueChange={setFormatF}>
            <SelectTrigger><SelectValue placeholder="Формат" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Усі формати</SelectItem>
              {settings?.formats.map((f) => <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={sourceF} onValueChange={setSourceF}>
            <SelectTrigger><SelectValue placeholder="Джерело" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Усі джерела</SelectItem>
              {settings?.sources.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
        {problemF ? (
          <CardContent className="flex items-center justify-between border-t px-4 py-3">
            <div className="text-sm text-muted-foreground">
              Активний фільтр: <span className="font-medium text-foreground">{PROBLEM_LABELS[problemF]}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setProblemF(undefined)}>
              Скинути
            </Button>
          </CardContent>
        ) : null}
      </Card>

      <Card>
        <CardContent className="grid min-w-0 gap-3 p-4">
          {filtered.length === 0 && (
            <div className="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">
              Немає бронювань за цими фільтрами
            </div>
          )}
          {filtered.map((b) => (
            <BookingListRow
              key={b.id}
              booking={b}
                attentionLabel={b.client_id ? clientMetaById.get(b.client_id)?.attention_label : null}
                childBirthdate={b.client_id ? clientMetaById.get(b.client_id)?.child_birthdate : null}
              settings={settings}
              checkPending={checkMut.isPending}
              statusPending={statusMut.isPending}
              onCheckIn={() => openVisitTimeDialog(b, "check-in")}
              onCheckOut={() => openVisitTimeDialog(b, "check-out")}
              onPaymentChange={(payment_status) => paymentMut.mutate({ id: b.id, payment_status })}
              onStatusChange={(status) => changeStatus(b, status)}
              onLunchStatusChange={(lunch_status) => statusMut.mutate({ booking: b, status: b.status, lunch_status })}
              onEdit={() => {
                setEditing(b as never);
                setOpen(true);
              }}
              onDelete={() => delMut.mutate(b.id)}
            />
          ))}
        </CardContent>
      </Card>
        </TabsContent>
        <TabsContent value="calendar">
          <CalendarView
            bookings={bookings ?? []}
            clientMetaById={clientMetaById}
            onSelect={(b) => {
              if (b.client_id) {
                setClientDialogId(b.client_id);
                setClientDialogOpen(true);
              } else {
                setEditing(b as never);
                setOpen(true);
              }
            }}
            formatLabelFn={(k) => settings ? formatLabel(settings.formats, k) : k}
          />
        </TabsContent>
      </Tabs>

      <BookingDialog
        open={open}
        onOpenChange={setOpen}
        initial={editing ? toDraft(editing) : undefined}
      />
      <ClientCardDialog
        open={clientDialogOpen}
        onOpenChange={setClientDialogOpen}
        clientId={clientDialogId}
      />
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

function timeValueFromDateTime(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function BookingListRow({
  booking,
  attentionLabel,
  childBirthdate,
  settings,
  checkPending,
  statusPending,
  onCheckIn,
  onCheckOut,
  onPaymentChange,
  onStatusChange,
  onLunchStatusChange,
  onEdit,
  onDelete,
}: {
  booking: BookingRow;
  attentionLabel?: string | null;
  childBirthdate?: string | null;
  settings?: Awaited<ReturnType<typeof fetchSettings>>;
  checkPending: boolean;
  statusPending: boolean;
  onCheckIn: () => void;
  onCheckOut: () => void;
  onPaymentChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onLunchStatusChange: (value: LunchStatus) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const formatName = settings ? formatLabel(settings.formats, booking.format) : booking.format;

  return (
    <div className="min-w-0 rounded-md border bg-card p-4">
      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(260px,1fr)_minmax(220px,0.8fr)] 2xl:grid-cols-[minmax(260px,1.25fr)_minmax(220px,0.9fr)_minmax(270px,1fr)_170px_145px_auto] 2xl:items-center">
        <div className="min-w-0">
          <div className="text-sm font-medium text-muted-foreground">
            {formatDate(booking.visit_date)} · {formatTime(booking.visit_time)}
          </div>
          <div className="mt-1 flex min-w-0 items-center gap-1 text-lg font-semibold leading-tight">
            {booking.client_id ? (
              <Link to="/clients/$id" params={{ id: booking.client_id }} className="break-words hover:underline">
                {booking.child_name}
              </Link>
            ) : (
              <span className="break-words">{booking.child_name}</span>
            )}
            <SoloAssistantButton clientId={booking.client_id} childName={booking.child_name} />
          </div>
          <div className="flex flex-wrap gap-1">
            <BirthdayBadge birthdate={childBirthdate} />
            <AttentionBadge label={attentionLabel} />
          </div>
          {booking.status === "Завершено" ? <LunchStatusQuickSelect value={booking.lunch_status as LunchStatus | null} onChange={onLunchStatusChange} /> : null}
          <div className="mt-1 break-words text-sm text-muted-foreground">
            {booking.parent_name} · {booking.phone || "без телефону"}
          </div>
          {booking.client_id ? <SubscriptionPanel clientId={booking.client_id} compact /> : null}
        </div>

        <div className="min-w-0 text-sm">
          <div className="font-medium">{formatName}</div>
          {booking.format === "other" && booking.hours ? (
            <div className="text-muted-foreground">{booking.hours} год</div>
          ) : null}
          <div className="mt-1 text-muted-foreground">{booking.source || "без джерела"}</div>
          <div className="mt-2 text-base font-semibold">{formatUAH(booking.amount)}</div>
        </div>

        <div className="min-w-0 lg:col-span-2 2xl:col-span-1">
          <CheckVisitCell
            booking={booking}
            settings={settings}
            pending={checkPending}
            onCheckIn={onCheckIn}
            onCheckOut={onCheckOut}
          />
        </div>

        <div className="min-w-0">
          <Select value={booking.payment_status ?? "не оплачено"} onValueChange={onPaymentChange}>
            <SelectTrigger className={`h-9 w-full min-w-0 border px-2 ${paymentStyle(booking.payment_status).trigger}`}>
              <PaymentStatusLabel status={booking.payment_status} />
            </SelectTrigger>
            <SelectContent>
              {PAYMENT_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  <PaymentStatusLabel status={status} />
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-0">
          <Select value={booking.status} onValueChange={onStatusChange} disabled={statusPending}>
            <SelectTrigger className={`h-9 w-full min-w-0 border px-2 ${statusStyle(booking.status).trigger}`}>
              <StatusLabel status={booking.status} />
            </SelectTrigger>
            <SelectContent>
              {settings?.statuses.map((status) => (
                <SelectItem key={status} value={status}>
                  <StatusLabel status={status} />
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex justify-end gap-1 lg:justify-start 2xl:justify-end">
          <Button size="icon" variant="ghost" onClick={onEdit} aria-label="Редагувати бронювання">
            <Pencil className="h-4 w-4" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="icon" variant="ghost" aria-label="Видалити бронювання">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Видалити бронювання?</AlertDialogTitle>
                <AlertDialogDescription>Дію не можна скасувати.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Скасувати</AlertDialogCancel>
                <AlertDialogAction onClick={onDelete}>Видалити</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}

function toDraft(b: BookingRow) {
  const source = splitSource(b.source);
  return {
    id: b.id,
    client_id: b.client_id,
    parent_name: b.parent_name,
    child_name: b.child_name,
    phone: b.phone ?? "",
    format: b.format,
    hours: b.hours != null ? String(b.hours) : "",
    visit_date: b.visit_date,
    visit_time: b.visit_time ? b.visit_time.slice(0, 5) : "",
    source: source.source,
    source_detail: source.source_detail,
    extra_services: b.extra_services ?? [],
    amount: String(b.amount ?? 0),
    amount_override: !!b.amount_override,
    check_in_at: b.check_in_at,
    check_out_at: b.check_out_at,
    payment_status: b.payment_status ?? "не оплачено",
    parent_comment: b.parent_comment ?? "",
    teacher_comment: b.teacher_comment ?? "",
    status: b.status,
  };
}

function isOtherSource(source?: string | null) {
  return (source ?? "").trim().toLowerCase().startsWith("інш");
}

function splitSource(source?: string | null) {
  const value = source?.trim() ?? "";
  if (!isOtherSource(value)) return { source: value, source_detail: "" };
  const [base, ...detailParts] = value.split(":");
  return {
    source: "Інше",
    source_detail: detailParts.join(":").trim(),
  };
}

function sourceMatchesFilter(source: string | null, filter: string) {
  if (source === filter) return true;
  return isOtherSource(filter) && isOtherSource(source);
}

function paymentStyle(status?: string | null) {
  switch (status) {
    case "оплачено готівкою":
      return {
        icon: Banknote,
        iconClass: "text-emerald-700",
        trigger: "border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100",
      };
    case "оплачено карткою":
      return {
        icon: CreditCard,
        iconClass: "text-sky-700",
        trigger: "border-sky-200 bg-sky-50 text-sky-900 hover:bg-sky-100",
      };
    default:
      return {
        icon: CircleAlert,
        iconClass: "text-amber-700",
        trigger: "border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100",
      };
  }
}

function PaymentStatusLabel({ status }: { status?: string | null }) {
  const normalized = status || "не оплачено";
  const style = paymentStyle(normalized);
  const Icon = style.icon;
  const label = normalized === "оплачено готівкою"
    ? "готівка"
    : normalized === "оплачено карткою"
      ? "картка"
      : "не опл.";

  return (
    <div className="inline-flex min-w-0 items-center gap-1.5 align-middle leading-none">
      <Icon className={`h-3.5 w-3.5 shrink-0 ${style.iconClass}`} />
      <span className="truncate leading-none">{label}</span>
    </div>
  );
}

function CheckVisitCell({
  booking,
  settings,
  pending,
  onCheckIn,
  onCheckOut,
}: {
  booking: BookingRow;
  settings?: Awaited<ReturnType<typeof fetchSettings>>;
  pending: boolean;
  onCheckIn: () => void;
  onCheckOut: () => void;
}) {
  const checkInAt = booking.check_in_at ?? bookingStartDateTime(booking.visit_date, booking.visit_time);
  const minutes = actualStayMinutes(checkInAt, booking.check_out_at);
  const extraDue = settings ? calcExtraDue(booking.amount, booking.format, checkInAt, booking.check_out_at, settings) : 0;

  return (
    <div className="min-w-0 space-y-1.5 rounded-md bg-muted/30 p-2 text-xs">
      <div className="grid grid-cols-2 gap-1 text-muted-foreground">
        <span className="min-w-0 break-words">Вхід: <b className="font-medium text-foreground">{formatDateTime(checkInAt)}</b></span>
        <span className="min-w-0 break-words">Вихід: <b className="font-medium text-foreground">{formatDateTime(booking.check_out_at)}</b></span>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <Button size="sm" variant="outline" className="h-7 px-2" onClick={onCheckIn} disabled={pending}>
          {booking.check_in_at ? "Змінити чек-ін" : "Чек-ін"}
        </Button>
        <Button size="sm" variant="outline" className="h-7 px-2" onClick={onCheckOut} disabled={pending}>
          {booking.check_out_at ? "Змінити чек-аут" : "Чек-аут"}
        </Button>
        {checkInAt && booking.check_out_at && (
          <Badge variant="secondary">{formatDuration(minutes)}</Badge>
        )}
        {extraDue > 0 ? <Badge variant="destructive">Доплата {formatUAH(extraDue)}</Badge> : null}
      </div>
    </div>
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

function AttentionBadge({ label }: { label?: string | null }) {
  if (!label?.trim()) return null;

  return (
    <Badge className="mt-1 inline-flex max-w-full items-center gap-1 border border-red-200 bg-red-50 text-red-800 hover:bg-red-50">
      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{label}</span>
    </Badge>
  );
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

function bookingHours(b: BookingRow): number | null {
  switch (b.format) {
    case "hour_1": return 1;
    case "hour_3": return 3;
    case "full_day": return 8;
    case "adaptation": return null;
    case "other": return b.hours != null ? Number(b.hours) : null;
    default: return null;
  }
}

function CalendarView({
  bookings,
  clientMetaById,
  onSelect,
  formatLabelFn,
}: {
  bookings: BookingRow[];
  clientMetaById: ReadonlyMap<string, { attention_label: string | null; child_birthdate: string | null }>;
  onSelect: (b: BookingRow) => void;
  formatLabelFn: (key: string) => string;
}) {
  const today = new Date();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const monthLabel = cursor.toLocaleDateString("uk-UA", { month: "long", year: "numeric" });

  const firstDay = new Date(year, month, 1);
  // Monday = 0
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const byDate = useMemo(() => {
    const map = new Map<string, BookingRow[]>();
    for (const b of bookings) {
      const arr = map.get(b.visit_date) ?? [];
      arr.push(b);
      map.set(b.visit_date, arr);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => (a.visit_time ?? "").localeCompare(b.visit_time ?? ""));
    }
    return map;
  }, [bookings]);

  const cells: (Date | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const weekdays = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"];
  const todayStr = new Date().toISOString().slice(0, 10);

  const childPalette = [
    "bg-[hsl(210_85%_90%)] text-[hsl(210_60%_25%)] hover:bg-[hsl(210_85%_85%)]",
    "bg-[hsl(150_60%_88%)] text-[hsl(150_50%_22%)] hover:bg-[hsl(150_60%_82%)]",
    "bg-[hsl(35_90%_88%)] text-[hsl(25_60%_28%)] hover:bg-[hsl(35_90%_82%)]",
    "bg-[hsl(330_80%_92%)] text-[hsl(330_55%_30%)] hover:bg-[hsl(330_80%_86%)]",
    "bg-[hsl(265_70%_92%)] text-[hsl(265_50%_30%)] hover:bg-[hsl(265_70%_86%)]",
    "bg-[hsl(190_75%_88%)] text-[hsl(190_60%_22%)] hover:bg-[hsl(190_75%_82%)]",
    "bg-[hsl(50_85%_85%)] text-[hsl(40_60%_25%)] hover:bg-[hsl(50_85%_78%)]",
    "bg-[hsl(0_75%_92%)] text-[hsl(0_55%_30%)] hover:bg-[hsl(0_75%_86%)]",
    "bg-[hsl(170_55%_85%)] text-[hsl(170_50%_22%)] hover:bg-[hsl(170_55%_78%)]",
  ];
  const childColor = (b: BookingRow) => {
    const key = b.client_id ?? `${b.parent_name}|${b.child_name}`.toLowerCase();
    let h = 0;
    for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
    return childPalette[h % childPalette.length];
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <Button variant="outline" size="icon" onClick={() => setCursor(new Date(year, month - 1, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-lg font-semibold capitalize">{monthLabel}</div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => {
              const t = new Date();
              setCursor(new Date(t.getFullYear(), t.getMonth(), 1));
            }}>Сьогодні</Button>
            <Button variant="outline" size="icon" onClick={() => setCursor(new Date(year, month + 1, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 text-xs text-muted-foreground">
          {weekdays.map((w) => <div key={w} className="px-2 py-1 text-center font-medium">{w}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((d, i) => {
            if (!d) return <div key={i} className="min-h-24 rounded-md bg-muted/20" />;
            const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
            const items = byDate.get(ds) ?? [];
            const isToday = ds === todayStr;
            const totalHours = items.reduce((sum, b) => sum + (bookingHours(b) ?? 0), 0);
            return (
              <div
                key={i}
                className={`min-h-24 rounded-md border p-1.5 text-xs flex flex-col gap-1 ${isToday ? "border-primary bg-primary/5" : "bg-card"}`}
              >
                <div className="flex items-center justify-between">
                  <span className={`font-semibold ${isToday ? "text-primary" : ""}`}>{d.getDate()}</span>
                  {items.length > 0 && (
                    <span className="text-[10px] text-muted-foreground">{items.length} · {totalHours}г</span>
                  )}
                </div>
                <div className="space-y-0.5">
                  {items.slice(0, 4).map((b) => {
                    const h = bookingHours(b);
                    const cancelled = b.status === "Скасовано";
                    const clientMeta = b.client_id ? clientMetaById.get(b.client_id) : null;
                    const attentionLabel = clientMeta?.attention_label ?? null;
                    const birthdayReminder = getBirthdayReminder(clientMeta?.child_birthdate);
                    const title = [
                      `${b.child_name} · ${formatLabelFn(b.format)}`,
                      h ? `${h} год` : "",
                      b.visit_time ? b.visit_time.slice(0, 5) : "",
                      birthdayReminder ? `День народження: ${birthdayReminder.dateLabel}` : "",
                      attentionLabel ? `Увага: ${attentionLabel}` : "",
                    ].filter(Boolean).join(" · ");
                    return (
                      <button
                        key={b.id}
                        onClick={() => onSelect(b)}
                        className={`flex w-full min-w-0 items-center gap-1 rounded px-1.5 py-0.5 text-left transition ${cancelled ? "bg-destructive/10 text-destructive line-through" : childColor(b)}`}
                        title={title}
                      >
                        {birthdayReminder ? (
                          <span className="shrink-0 leading-none" aria-label="День народження">🎂</span>
                        ) : null}
                        {attentionLabel ? (
                          <AlertTriangle className="h-3 w-3 shrink-0 text-red-700" />
                        ) : null}
                        <span className="truncate">
                          {b.visit_time ? <span className="font-medium">{b.visit_time.slice(0,5)} </span> : null}
                          {b.child_name}{h ? ` · ${h}г` : ""}
                        </span>
                      </button>
                    );
                  })}
                  {items.length > 4 && (
                    <div className="text-[10px] text-muted-foreground px-1">+{items.length - 4} ще</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
