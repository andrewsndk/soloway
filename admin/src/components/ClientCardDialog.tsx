import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { fetchSettings, formatLabel } from "@/lib/settings";
import { actualStayMinutes, bookingStartDateTime, formatDate, formatDateTime, formatDuration, formatTime, formatUAH } from "@/lib/pricing";
import { ClientPhotoUpload } from "@/components/ClientPhotoUpload";
import { ClientQuestionnaireEditor, ClientQuestionnaireView } from "@/components/ClientQuestionnaireSection";
import { VisitSummaryCell } from "@/components/VisitSummaryCell";
import { BookingDialog } from "@/components/BookingDialog";
import { BirthdayBadge } from "@/components/BirthdayBadge";
import { SoloAssistantCard } from "@/components/SoloAssistant";
import { compactDiff, logActionQuietly } from "@/lib/audit";
import { CLIENT_QUESTIONNAIRE_EMPTY, normalizeQuestionnairePayload, type ClientQuestionnaireKey } from "@/lib/client-questionnaire";
import { formatPhoneForUkraineInput, normalizePhone } from "@/lib/phone";
import { AlertTriangle, CalendarPlus, ClipboardList, Edit3, ExternalLink, ImageIcon, MessageSquareText, Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";

export function ClientCardDialog({
  clientId,
  open,
  onOpenChange,
}: {
  clientId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: fetchSettings });
  const [editing, setEditing] = useState(false);
  const [bookingDialogOpen, setBookingDialogOpen] = useState(false);

  const { data: client } = useQuery({
    queryKey: ["client", clientId],
    enabled: !!clientId && open,
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").eq("id", clientId!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: bookings } = useQuery({
    queryKey: ["client-bookings", clientId],
    enabled: !!clientId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings").select("*").eq("client_id", clientId!)
        .order("visit_date", { ascending: false })
        .order("visit_time", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const [form, setForm] = useState({
    parent_name: "", child_name: "", phone: "", who_can_pickup: "",
    child_birthdate: "", parent_questionnaire: "", admin_comment: "", teacher_comment: "", attention_label: "",
    ...CLIENT_QUESTIONNAIRE_EMPTY,
  });

  useEffect(() => {
    if (client && !editing) {
      setForm({
        parent_name: client.parent_name ?? "",
        child_name: client.child_name ?? "",
        phone: client.phone ?? "",
        who_can_pickup: client.who_can_pickup ?? "",
        child_birthdate: client.child_birthdate ?? "",
        parent_questionnaire: client.parent_questionnaire ?? "",
        admin_comment: client.admin_comment ?? "",
        teacher_comment: client.teacher_comment ?? "",
        attention_label: client.attention_label ?? "",
        preferred_name: client.preferred_name ?? "",
        food_allergies: client.food_allergies ?? "",
        other_allergies: client.other_allergies ?? "",
        snack_consent: client.snack_consent ?? "",
        toilet_habits: client.toilet_habits ?? "",
        hygiene_notes: client.hygiene_notes ?? "",
        adaptation_notes: client.adaptation_notes ?? "",
        calming_notes: client.calming_notes ?? "",
        interests: client.interests ?? "",
        physical_restrictions: client.physical_restrictions ?? "",
        photo_consent: client.photo_consent ?? "",
        important_notes: client.important_notes ?? "",
      });
    }
  }, [client, editing]);

  useEffect(() => {
    if (open) setEditing(false);
  }, [open, clientId]);

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!clientId) return;
      const questionnairePayload = normalizeQuestionnairePayload(
        Object.fromEntries(
          Object.keys(CLIENT_QUESTIONNAIRE_EMPTY).map((key) => [key, form[key as ClientQuestionnaireKey]]),
        ) as typeof CLIENT_QUESTIONNAIRE_EMPTY,
      );
      const payload = {
        ...form,
        ...questionnairePayload,
        child_birthdate: form.child_birthdate || null,
        parent_questionnaire: form.parent_questionnaire.trim() || null,
        admin_comment: form.admin_comment.trim() || null,
        teacher_comment: form.teacher_comment.trim() || null,
        attention_label: form.attention_label.trim() || null,
        phone: formatPhoneForUkraineInput(form.phone) || null,
        phone_normalized: normalizePhone(form.phone) || null,
        who_can_pickup: form.who_can_pickup.trim() || null,
      };
      const { data: before } = await supabase.from("clients").select("*").eq("id", clientId).maybeSingle();
      const { data: updated, error } = await supabase.from("clients").update(payload).eq("id", clientId).select("*").single();
      if (error) throw error;
      await logActionQuietly({
        action: "update",
        entityType: "client",
        entityId: clientId,
        entityLabel: `${updated.child_name} · ${updated.parent_name}`,
        summary: `Оновлено картку клієнта ${updated.child_name}`,
        before: before ? compactDiff(before, updated) : null,
        after: updated,
      });
    },
    onSuccess: () => {
      toast.success("Збережено");
      setEditing(false);
      qc.invalidateQueries({ queryKey: ["client", clientId] });
      qc.invalidateQueries({ queryKey: ["clients-with-stats"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async () => {
      if (!clientId || !client) return;
      const { data: before } = await supabase.from("clients").select("*").eq("id", clientId).maybeSingle();
      const { error } = await supabase.from("clients").delete().eq("id", clientId);
      if (error) throw error;
      await logActionQuietly({
        action: "delete",
        entityType: "client",
        entityId: clientId,
        entityLabel: `${client.child_name} · ${client.parent_name}`,
        summary: `Видалено картку клієнта ${client.child_name}`,
        before: before ?? client,
      });
    },
    onSuccess: () => {
      toast.success("Клієнта видалено");
      onOpenChange(false);
      qc.invalidateQueries({ queryKey: ["clients-with-stats"] });
      qc.invalidateQueries({ queryKey: ["bookings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const stats = (bookings ?? []).reduce(
    (acc, b) => {
      if (b.status === "Скасовано") return acc;
      acc.count += 1;
      if (b.payment_status === "оплачено готівкою" || b.payment_status === "оплачено карткою") {
        acc.total += Number(b.amount || 0);
      }
      if (!acc.first || b.visit_date < acc.first) acc.first = b.visit_date;
      if (!acc.last || b.visit_date > acc.last) acc.last = b.visit_date;
      return acc;
    },
    { count: 0, total: 0, first: "", last: "" },
  );
  const latestVisit = bookings?.[0] ?? null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[92vh] max-w-[min(1120px,calc(100vw-2rem))] overflow-y-auto">
          <DialogHeader>
            <div className="flex flex-col gap-3 pr-8 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <DialogTitle>
                  {client ? client.child_name : "Картка клієнта"}
                </DialogTitle>
                <DialogDescription>
                  {client ? `Батьки: ${client.parent_name}` : "Завантаження…"}
                </DialogDescription>
              </div>
              {client ? (
                <Button className="w-full sm:w-auto" onClick={() => setBookingDialogOpen(true)}>
                  <CalendarPlus className="mr-2 h-4 w-4" />Нове бронювання
                </Button>
              ) : null}
            </div>
          </DialogHeader>

        {client && (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-[180px_1fr]">
              {editing ? (
                <ClientPhotoUpload clientId={client.id} childName={client.child_name} photoUrl={client.photo_url} />
              ) : (
                <ClientPhotoPreview childName={client.child_name} photoUrl={client.photo_url} />
              )}
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                <Stat label="Відвідувань" value={stats.count} />
                <Stat label="Витрачено" value={formatUAH(stats.total)} />
                <Stat label="Перший візит" value={stats.first ? formatDate(stats.first) : "—"} />
                <Stat label="Останній візит" value={stats.last ? formatDate(stats.last) : "—"} />
              </div>
            </div>
            {editing ? (
              <F label="Особливість / увага">
                <Input
                  value={form.attention_label}
                  onChange={(event) => setForm({ ...form, attention_label: event.target.value })}
                  placeholder="Наприклад: алергія на горіхи, астма, не давати молоко"
                />
                <p className="text-xs text-muted-foreground">
                  Короткий лейбл буде помітний у картці клієнта та в усіх бронюваннях.
                </p>
              </F>
            ) : (
              <div className="flex flex-wrap gap-2">
                <BirthdayBadge birthdate={client.child_birthdate} />
                <AttentionLabel label={client.attention_label} />
              </div>
            )}

            {!editing ? <SoloAssistantCard clientId={client.id} childName={client.child_name} /> : null}

            <div className="grid gap-3 lg:grid-cols-2">
              {editing ? (
                <F label="Загальна характеристика дитини">
                  <Textarea
                    rows={7}
                    value={form.teacher_comment}
                    onChange={(e) => setForm({ ...form, teacher_comment: e.target.value })}
                    placeholder="Коротко опишіть характер, темп адаптації, що допомагає включитися, що дитину зацікавлює, на що звернути увагу вихователю."
                  />
                  <p className="text-xs text-muted-foreground">
                    Складається вихователем на основі анкети батьків і власних спостережень.
                  </p>
                </F>
              ) : (
                <ClientFocusCard
                  icon={<ClipboardList className="h-4 w-4" />}
                  title="Загальна характеристика"
                  text={client.teacher_comment}
                  empty="Поки немає загальної характеристики. Додайте її в режимі редагування."
                />
              )}
              <ClientFocusCard
                icon={<MessageSquareText className="h-4 w-4" />}
                title="Внутрішня нотатка з останнього візиту"
                subtitle={latestVisit ? `${formatDate(latestVisit.visit_date)} ${formatTime(latestVisit.visit_time)}` : undefined}
                text={latestVisit?.teacher_comment}
                empty={latestVisit ? "В останньому візиті ще немає внутрішньої нотатки." : "У дитини поки немає візитів."}
              />
            </div>

            {editing ? (
              <div className="grid gap-4 md:grid-cols-2">
                <F label="Ім'я батьків"><Input value={form.parent_name} onChange={(e) => setForm({ ...form, parent_name: e.target.value })} /></F>
                <F label="Ім'я дитини"><Input value={form.child_name} onChange={(e) => setForm({ ...form, child_name: e.target.value })} /></F>
                <F label="Телефон"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></F>
                <F label="Дата народження дитини"><Input type="date" value={form.child_birthdate} onChange={(e) => setForm({ ...form, child_birthdate: e.target.value })} /></F>
                <F label="Хто має право забирати дитину" className="md:col-span-2"><Input value={form.who_can_pickup} onChange={(e) => setForm({ ...form, who_can_pickup: e.target.value })} /></F>
                <div className="md:col-span-2">
                  <ClientQuestionnaireEditor
                    form={form}
                    onFieldChange={(key, value) => setForm({ ...form, [key]: value })}
                  />
                </div>
                <F label="Додаткові нотатки з анкети" className="md:col-span-2"><Textarea rows={3} value={form.parent_questionnaire} onChange={(e) => setForm({ ...form, parent_questionnaire: e.target.value })} /></F>
                <F label="Коментар від адміна"><Textarea rows={2} value={form.admin_comment} onChange={(e) => setForm({ ...form, admin_comment: e.target.value })} /></F>
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                <Info label="Ім'я батьків" value={client.parent_name} />
                <Info label="Ім'я дитини" value={client.child_name} />
                <Info label="Телефон" value={client.phone} />
                <Info label="Дата народження дитини" value={client.child_birthdate ? formatDate(client.child_birthdate) : null} />
                <Info label="Хто має право забирати дитину" value={client.who_can_pickup} className="md:col-span-2" />
                <div className="md:col-span-2">
                  <ClientQuestionnaireView client={client} />
                </div>
                <Info label="Додаткові нотатки з анкети" value={client.parent_questionnaire} className="md:col-span-2" multiline />
                <Info label="Коментар від адміна" value={client.admin_comment} multiline />
              </div>
            )}

            <div>
              <div className="mb-2 text-sm font-medium">Історія відвідувань</div>
              <Card>
                <CardContent className="p-0 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Дата</TableHead>
                        <TableHead>Час</TableHead>
                        <TableHead>Факт</TableHead>
                        <TableHead>Формат</TableHead>
                        <TableHead>Годин</TableHead>
                        <TableHead className="text-right">Сума</TableHead>
                        <TableHead>Статус</TableHead>
                        <TableHead>Карта візиту</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(bookings ?? []).length === 0 && (
                        <TableRow><TableCell colSpan={8} className="py-6 text-center text-muted-foreground">Поки що немає візитів</TableCell></TableRow>
                      )}
                      {(bookings ?? []).map((b) => (
                        <VisitHistoryRow key={b.id} booking={b} settings={settings} />
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          {client && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" className="mr-auto text-destructive" disabled={deleteMut.isPending}>
                  <Trash2 className="mr-1 h-4 w-4" />Видалити
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Видалити клієнта?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Картку {client.child_name} буде видалено. Бронювання залишаться в системі, але без прив'язки до цієї картки.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Скасувати</AlertDialogCancel>
                  <AlertDialogAction onClick={() => deleteMut.mutate()}>Видалити</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {clientId && (
            <Button variant="outline" asChild>
              <Link to="/clients/$id" params={{ id: clientId }} onClick={() => onOpenChange(false)}>
                <ExternalLink className="mr-1 h-4 w-4" />Відкрити повну сторінку
              </Link>
            </Button>
          )}
          {client && (
            <Button variant="outline" onClick={() => setBookingDialogOpen(true)}>
              <CalendarPlus className="mr-1 h-4 w-4" />Бронювання
            </Button>
          )}
          {editing ? (
            <>
              <Button variant="outline" onClick={() => setEditing(false)} disabled={saveMut.isPending}>
                <X className="mr-1 h-4 w-4" />Скасувати
              </Button>
              <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending || !client}>
                <Save className="mr-1 h-4 w-4" />{saveMut.isPending ? "Збереження…" : "Зберегти"}
              </Button>
            </>
          ) : (
            <Button onClick={() => setEditing(true)} disabled={!client}>
              <Edit3 className="mr-1 h-4 w-4" />Редагувати
            </Button>
          )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {client ? (
        <BookingDialog
          open={bookingDialogOpen}
          onOpenChange={setBookingDialogOpen}
          defaults={{
            client_id: client.id,
            parent_name: client.parent_name,
            child_name: client.child_name,
            phone: client.phone ?? "",
            source: "Інше",
            source_detail: "Картка клієнта",
          }}
        />
      ) : null}
    </>
  );
}

function VisitHistoryRow({
  booking,
  settings,
}: {
  booking: {
    id: string;
    child_name: string;
    visit_date: string;
    visit_time: string | null;
    check_in_at: string | null;
    check_out_at: string | null;
    format: string;
    hours: number | null;
    amount: number;
    status: string;
    teacher_comment: string | null;
    parent_summary: string | null;
  };
  settings?: Awaited<ReturnType<typeof fetchSettings>>;
}) {
  const checkInAt = booking.check_in_at ?? bookingStartDateTime(booking.visit_date, booking.visit_time);
  return (
    <TableRow>
      <TableCell>{formatDate(booking.visit_date)}</TableCell>
      <TableCell>{formatTime(booking.visit_time)}</TableCell>
      <TableCell className="text-xs">
        <div>{formatDateTime(checkInAt)} → {formatDateTime(booking.check_out_at)}</div>
        <div className="text-muted-foreground">{formatDuration(actualStayMinutes(checkInAt, booking.check_out_at))}</div>
      </TableCell>
      <TableCell>{settings ? formatLabel(settings.formats, booking.format) : booking.format}</TableCell>
      <TableCell>{booking.hours ?? "—"}</TableCell>
      <TableCell className="text-right">{formatUAH(booking.amount)}</TableCell>
      <TableCell><Badge variant={booking.status === "Скасовано" ? "destructive" : "secondary"}>{booking.status}</Badge></TableCell>
      <TableCell>
        <VisitSummaryCell booking={booking} />
      </TableCell>
    </TableRow>
  );
}

function ClientPhotoPreview({ childName, photoUrl }: { childName: string; photoUrl?: string | null }) {
  return (
    <div className="aspect-square w-full overflow-hidden rounded-md border bg-muted">
      {photoUrl ? (
        <img src={photoUrl} alt={childName} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground">
          <ImageIcon className="h-8 w-8" />
          <span className="text-xs">Без фото</span>
        </div>
      )}
    </div>
  );
}

function AttentionLabel({ label }: { label?: string | null }) {
  if (!label?.trim()) return null;

  return (
    <div className="rounded-md border border-red-200 bg-red-50 p-3 text-red-950">
      <div className="flex min-w-0 items-center gap-2">
        <AlertTriangle className="h-5 w-5 shrink-0 text-red-600" />
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-wide text-red-700">Особливість дитини</div>
          <div className="break-words text-base font-semibold">{label}</div>
        </div>
      </div>
    </div>
  );
}

function ClientFocusCard({
  icon,
  title,
  subtitle,
  text,
  empty,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  text?: string | null;
  empty: string;
}) {
  return (
    <div className="rounded-md border bg-muted/20 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            {icon}
          </span>
          <div className="min-w-0">
            <div className="font-semibold">{title}</div>
            {subtitle ? <div className="text-xs text-muted-foreground">{subtitle}</div> : null}
          </div>
        </div>
      </div>
      <div className="mt-3 whitespace-pre-wrap text-sm leading-6">
        {text?.trim() || <span className="text-muted-foreground">{empty}</span>}
      </div>
    </div>
  );
}

function Info({
  label,
  value,
  className,
  multiline,
}: {
  label: string;
  value?: React.ReactNode;
  className?: string;
  multiline?: boolean;
}) {
  return (
    <div className={`rounded-md border bg-muted/30 p-3 ${className ?? ""}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 text-sm font-medium ${multiline ? "whitespace-pre-wrap leading-6" : ""}`}>
        {value || "—"}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-base font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}

function F({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}
