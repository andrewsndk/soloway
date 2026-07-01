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
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { BookingDialog } from "@/components/BookingDialog";
import { ClientCardDialog } from "@/components/ClientCardDialog";
import { fetchSettings, formatLabel } from "@/lib/settings";
import { formatDate, formatTime, formatUAH } from "@/lib/pricing";
import { PAYMENT_STATUSES } from "@/lib/payment";
import { downloadCSV } from "@/lib/csv";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Banknote, ChevronLeft, ChevronRight, CircleAlert, CreditCard, Download, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/bookings")({
  head: () => ({ meta: [{ title: "Бронювання — Soloway CRM" }] }),
  component: BookingsPage,
});

function BookingsPage() {
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
      return data;
    },
  });

  const [q, setQ] = useState("");
  const [statusF, setStatusF] = useState("all");
  const [formatF, setFormatF] = useState("all");
  const [sourceF, setSourceF] = useState("all");
  const [dateF, setDateF] = useState("");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<typeof bookings extends (infer U)[] | undefined ? U : never | undefined>(undefined as never);
  const [clientDialogId, setClientDialogId] = useState<string | null>(null);
  const [clientDialogOpen, setClientDialogOpen] = useState(false);

  const filtered = useMemo(() => {
    return (bookings ?? []).filter((b) => {
      if (statusF !== "all" && b.status !== statusF) return false;
      if (formatF !== "all" && b.format !== formatF) return false;
      if (sourceF !== "all" && b.source !== sourceF) return false;
      if (dateF && b.visit_date !== dateF) return false;
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
  }, [bookings, q, statusF, formatF, sourceF, dateF]);

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("bookings").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Видалено");
      qc.invalidateQueries({ queryKey: ["bookings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const paymentMut = useMutation({
    mutationFn: async ({ id, payment_status }: { id: string; payment_status: string }) => {
      const { error } = await supabase.from("bookings").update({ payment_status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bookings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

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
        <CardContent className="grid gap-2 p-4 md:grid-cols-5">
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
      </Card>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Дата/час</TableHead>
                <TableHead>Дитина</TableHead>
                <TableHead>Батьки</TableHead>
                <TableHead>Формат</TableHead>
                <TableHead>Джерело</TableHead>
                <TableHead className="text-right">Сума</TableHead>
                <TableHead>Оплата</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-6">Немає бронювань за цими фільтрами</TableCell></TableRow>
              )}
              {filtered.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="whitespace-nowrap">
                    <div className="font-medium">{formatDate(b.visit_date)}</div>
                    <div className="text-xs text-muted-foreground">{formatTime(b.visit_time)}</div>
                  </TableCell>
                  <TableCell>
                    {b.client_id ? (
                      <Link to="/clients/$id" params={{ id: b.client_id }} className="font-medium hover:underline">{b.child_name}</Link>
                    ) : (
                      <span className="font-medium">{b.child_name}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    <div>{b.parent_name}</div>
                    <div className="text-xs text-muted-foreground">{b.phone}</div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {settings ? formatLabel(settings.formats, b.format) : b.format}
                    {b.format === "other" && b.hours ? <span className="text-muted-foreground"> · {b.hours} год</span> : null}
                  </TableCell>
                  <TableCell className="text-sm">{b.source}</TableCell>
                  <TableCell className="text-right font-semibold">{formatUAH(b.amount)}</TableCell>
                  <TableCell>
                    <Select
                      value={b.payment_status ?? "не оплачено"}
                      onValueChange={(payment_status) => paymentMut.mutate({ id: b.id, payment_status })}
                    >
                      <SelectTrigger className={`h-8 w-[190px] border ${paymentStyle(b.payment_status).trigger}`}>
                        <PaymentStatusLabel status={b.payment_status} />
                      </SelectTrigger>
                      <SelectContent>
                        {PAYMENT_STATUSES.map((status) => (
                          <SelectItem key={status} value={status}>
                            <PaymentStatusLabel status={status} />
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell><Badge variant={b.status === "Скасовано" ? "destructive" : "secondary"}>{b.status}</Badge></TableCell>
                  <TableCell>
                    <div className="flex gap-1 justify-end">
                      <Button size="icon" variant="ghost" onClick={() => { setEditing(b as never); setOpen(true); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="icon" variant="ghost"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Видалити бронювання?</AlertDialogTitle>
                            <AlertDialogDescription>Дію не можна скасувати.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Скасувати</AlertDialogCancel>
                            <AlertDialogAction onClick={() => delMut.mutate(b.id)}>Видалити</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
        </TabsContent>
        <TabsContent value="calendar">
          <CalendarView
            bookings={bookings ?? []}
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

function toDraft(b: BookingRow) {
  return {
    id: b.id,
    parent_name: b.parent_name,
    child_name: b.child_name,
    phone: b.phone ?? "",
    format: b.format,
    hours: b.hours != null ? String(b.hours) : "",
    visit_date: b.visit_date,
    visit_time: b.visit_time ? b.visit_time.slice(0, 5) : "",
    source: b.source ?? "",
    extra_services: b.extra_services ?? [],
    amount: String(b.amount ?? 0),
    amount_override: !!b.amount_override,
    payment_status: b.payment_status ?? "не оплачено",
    parent_comment: b.parent_comment ?? "",
    teacher_comment: b.teacher_comment ?? "",
    status: b.status,
  };
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

  return (
    <span className="flex min-w-0 items-center gap-2 truncate">
      <Icon className={`h-4 w-4 shrink-0 ${style.iconClass}`} />
      <span className="truncate">{normalized}</span>
    </span>
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
  onSelect,
  formatLabelFn,
}: {
  bookings: BookingRow[];
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
                    return (
                      <button
                        key={b.id}
                        onClick={() => onSelect(b)}
                        className={`w-full truncate rounded px-1.5 py-0.5 text-left transition ${cancelled ? "bg-destructive/10 text-destructive line-through" : childColor(b)}`}
                        title={`${b.child_name} · ${formatLabelFn(b.format)}${h ? ` · ${h} год` : ""}${b.visit_time ? ` · ${b.visit_time.slice(0,5)}` : ""}`}
                      >
                        {b.visit_time ? <span className="font-medium">{b.visit_time.slice(0,5)} </span> : null}
                        {b.child_name}{h ? ` · ${h}г` : ""}
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
