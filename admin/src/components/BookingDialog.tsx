import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { fetchSettings, type AppSettings } from "@/lib/settings";
import { calcAmount } from "@/lib/pricing";
import { PAYMENT_STATUSES, statusAfterPaymentChange } from "@/lib/payment";
import { compactDiff, logActionQuietly } from "@/lib/audit";
import { formatPhoneForUkraineInput, normalizePhone } from "@/lib/phone";
import { BirthdayBadge } from "@/components/BirthdayBadge";
import { SoloAssistantCard } from "@/components/SoloAssistant";
import { Banknote, CircleAlert, CreditCard, X } from "lucide-react";
import { toast } from "sonner";

const visibleBookingFormats = (settings: AppSettings) => settings.formats;

const TIME_OPTIONS = Array.from({ length: 49 }, (_, index) => {
  const minutes = index * 30;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
});

function timeToMinutes(value?: string | null) {
  const normalized = value?.slice(0, 5) ?? "";
  const match = /^(\d{2}):(\d{2})$/.exec(normalized);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours === 24 && minutes === 0) return 24 * 60;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function minutesToTime(totalMinutes: number) {
  const minutes = Math.max(0, Math.min(24 * 60, Math.round(totalMinutes)));
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

function durationHoursFromTimes(start?: string | null, end?: string | null) {
  const startMinutes = timeToMinutes(start);
  const endMinutes = timeToMinutes(end);
  if (startMinutes == null || endMinutes == null || endMinutes <= startMinutes) return null;
  return (endMinutes - startMinutes) / 60;
}

function endTimeFromStartAndHours(start?: string | null, hours?: string | number | null) {
  const startMinutes = timeToMinutes(start);
  const duration = Number(hours);
  if (startMinutes == null || !(duration > 0)) return "13:00";
  return minutesToTime(startMinutes + duration * 60);
}

function bookingFormatLabel(format: { key: string; label: string }) {
  return format.key === "other" ? "Кастомний час" : format.label;
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

type BookingDraft = {
  id?: string;
  client_id?: string | null;
  parent_name: string;
  child_name: string;
  phone: string;
  format: string;
  hours: string;
  custom_end_time: string;
  visit_date: string;
  visit_time: string;
  source: string;
  source_detail: string;
  extra_services: string[];
  amount: string;
  amount_override: boolean;
  payment_status: string;
  parent_comment: string;
  teacher_comment: string;
  status: string;
};

const emptyDraft: BookingDraft = {
  client_id: null,
  parent_name: "",
  child_name: "",
  phone: "",
  format: "hour_3",
  hours: "",
  custom_end_time: "13:00",
  visit_date: new Date().toISOString().slice(0, 10),
  visit_time: "10:00",
  source: "Instagram",
  source_detail: "",
  extra_services: [],
  amount: "0",
  amount_override: false,
  payment_status: "не оплачено",
  parent_comment: "",
  teacher_comment: "",
  status: "Нове",
};

export function BookingDialog({
  open,
  onOpenChange,
  initial,
  defaults,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: Partial<BookingDraft> & { id?: string };
  defaults?: Partial<BookingDraft>;
}) {
  const qc = useQueryClient();
  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: fetchSettings });
  const { data: clients } = useQuery({
    queryKey: ["booking-dialog-clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id,parent_name,child_name,phone,phone_normalized,attention_label,child_birthdate")
        .order("child_name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: open,
  });
  const [draft, setDraft] = useState<BookingDraft>(emptyDraft);

  useEffect(() => {
    if (open) {
      const nextDraft = { ...emptyDraft, ...defaults, ...initial } as BookingDraft;
      const parsedSource = splitSource(nextDraft.source);
      const custom_end_time = nextDraft.format === "other"
        ? nextDraft.custom_end_time || endTimeFromStartAndHours(nextDraft.visit_time, nextDraft.hours)
        : nextDraft.custom_end_time;
      setDraft({ ...nextDraft, ...parsedSource, custom_end_time });
    }
  }, [open, initial, defaults]);

  const customDurationHours = useMemo(
    () => durationHoursFromTimes(draft.visit_time, draft.custom_end_time),
    [draft.visit_time, draft.custom_end_time],
  );

  const computedAmount = useMemo(() => {
    if (!settings) return 0;
    return calcAmount(draft.format, draft.format === "other" ? customDurationHours : null, settings);
  }, [customDurationHours, draft.format, settings]);

  const selectedClient = useMemo(
    () => clients?.find((client) => client.id === draft.client_id) ?? null,
    [clients, draft.client_id],
  );

  const clientSuggestions = useMemo(() => {
    const query = draft.child_name.trim().toLowerCase();
    const phoneQuery = normalizePhone(draft.phone);
    if (!clients || draft.client_id || (query.length < 1 && phoneQuery.length < 6)) return [];
    return clients
      .filter((client) => {
        const child = (client.child_name ?? "").toLowerCase();
        const parent = (client.parent_name ?? "").toLowerCase();
        const phone = (client.phone ?? "").toLowerCase();
        const normalizedPhone = client.phone_normalized ?? normalizePhone(client.phone);
        return (
          (query.length > 0 && (child.includes(query) || parent.includes(query) || phone.includes(query))) ||
          (phoneQuery.length >= 6 && normalizedPhone.includes(phoneQuery))
        );
      })
      .slice(0, 8);
  }, [clients, draft.child_name, draft.client_id, draft.phone]);

  const applyClient = (client: NonNullable<typeof clients>[number]) => {
    setDraft((current) => ({
      ...current,
      client_id: client.id,
      parent_name: client.parent_name ?? "",
      child_name: client.child_name ?? "",
      phone: client.phone ?? "",
    }));
  };

  const clearSelectedClient = () => {
    setDraft((current) => ({ ...current, client_id: null }));
  };

  useEffect(() => {
    if (draft.format === "other" && customDurationHours != null && String(customDurationHours) !== draft.hours) {
      setDraft((d) => ({ ...d, hours: String(customDurationHours) }));
    }
  }, [customDurationHours, draft.format, draft.hours]);

  useEffect(() => {
    if (!draft.amount_override) {
      setDraft((d) => ({ ...d, amount: String(computedAmount) }));
    }
  }, [computedAmount, draft.amount_override]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!settings) throw new Error("Налаштування не завантажились");
      if (!draft.parent_name.trim() || !draft.child_name.trim()) {
        throw new Error("Вкажіть ім'я батьків та дитини");
      }
      if (draft.format === "other" && customDurationHours == null) {
        throw new Error("Оберіть коректний кастомний час з 00:00 до 24:00");
      }
      if (draft.phone && !/^[+0-9\s()-]{5,}$/.test(draft.phone)) {
        throw new Error("Невірний формат телефону");
      }
      if (isOtherSource(draft.source) && !draft.source_detail.trim()) {
        throw new Error("Вкажіть, звідки саме прийшла заявка");
      }
      if (draft.status === "Завершено" && !draft.teacher_comment.trim()) {
        throw new Error("Для завершеного візиту додайте короткий коментар: що робила дитина і що її захопило");
      }

      let clientId: string | null = null;
      const parent = draft.parent_name.trim();
      const child = draft.child_name.trim();
      const phone = formatPhoneForUkraineInput(draft.phone.trim());
      const phoneNormalized = normalizePhone(phone);

      if (draft.client_id) {
        clientId = draft.client_id;
      } else {
        const nameMatches = await supabase
          .from("clients")
          .select("id,parent_name,child_name,phone,phone_normalized")
          .ilike("parent_name", parent)
          .ilike("child_name", child)
          .limit(1);
        if (nameMatches.error) throw nameMatches.error;

        const phoneChildMatches = !nameMatches.data?.length && phoneNormalized
          ? await supabase
            .from("clients")
            .select("id,parent_name,child_name,phone,phone_normalized")
            .eq("phone_normalized", phoneNormalized)
            .ilike("child_name", child)
            .limit(1)
          : { data: null, error: null };
        if (phoneChildMatches.error) throw phoneChildMatches.error;

        const matches = nameMatches.data && nameMatches.data.length > 0
          ? nameMatches.data
          : phoneChildMatches.data;

        if (matches && matches.length > 0) {
          clientId = matches[0].id;
        } else {
          const { data: created, error: ce } = await supabase
            .from("clients")
            .insert({ parent_name: parent, child_name: child, phone: phone || null, phone_normalized: phoneNormalized || null })
            .select("*")
            .single();
          if (ce) throw ce;
          clientId = created.id;
          await logActionQuietly({
            action: "create",
            entityType: "client",
            entityId: created.id,
            entityLabel: `${created.child_name} · ${created.parent_name}`,
            summary: `Створено клієнта ${created.child_name} під час створення бронювання`,
            after: created,
          });
        }
      }

      const nextStatus = statusAfterPaymentChange(draft.status, draft.payment_status);
      const source = isOtherSource(draft.source)
        ? `${draft.source}: ${draft.source_detail.trim()}`
        : draft.source;
      const payload = {
        client_id: clientId,
        parent_name: parent,
        child_name: child,
        phone: phone || null,
        phone_normalized: phoneNormalized || null,
        format: draft.format,
        hours: draft.format === "other" ? customDurationHours : null,
        visit_date: draft.visit_date,
        visit_time: draft.visit_time || null,
        source: source || null,
        extra_services: draft.extra_services,
        amount: Number(draft.amount) || 0,
        amount_override: draft.amount_override,
        payment_status: draft.payment_status,
        parent_comment: draft.parent_comment || null,
        teacher_comment: draft.teacher_comment || null,
        status: nextStatus,
      };

      if (draft.id) {
        const { data: before } = await supabase.from("bookings").select("*").eq("id", draft.id).maybeSingle();
        const { data: updated, error } = await supabase.from("bookings").update(payload).eq("id", draft.id).select("*").single();
        if (error) throw error;
        await logActionQuietly({
          action: "update",
          entityType: "booking",
          entityId: draft.id,
          entityLabel: `${child} · ${draft.visit_date}`,
          summary: `Оновлено бронювання для ${child} на ${draft.visit_date}`,
          before: before ? compactDiff(before, updated) : null,
          after: updated,
        });
      } else {
        const { data: created, error } = await supabase.from("bookings").insert(payload).select("*").single();
        if (error) throw error;
        await logActionQuietly({
          action: "create",
          entityType: "booking",
          entityId: created.id,
          entityLabel: `${child} · ${draft.visit_date}`,
          summary: `Створено бронювання для ${child} на ${draft.visit_date}`,
          after: created,
        });
      }
    },
    onSuccess: () => {
      toast.success(draft.id ? "Бронювання оновлено" : "Бронювання створено");
      qc.invalidateQueries({ queryKey: ["bookings"] });
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["client-bookings"] });
      qc.invalidateQueries({ queryKey: ["clients-with-stats"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!settings) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{draft.id ? "Редагувати бронювання" : "Нове бронювання"}</DialogTitle>
          <DialogDescription>
            Оберіть існуючу дитину зі списку або введіть дані вручну.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2 md:grid-cols-2">
          {selectedClient ? (
            <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-2 rounded-md border border-primary/20 bg-primary/5 p-3 text-sm">
              <div>
                <span className="font-medium">Обрано клієнта: </span>
                {selectedClient.child_name} ({selectedClient.parent_name})
                <span className="ml-2 inline-flex flex-wrap gap-1 align-middle">
                  <BirthdayBadge birthdate={selectedClient.child_birthdate} className="mt-0" />
                  {selectedClient.attention_label ? (
                    <Badge variant="secondary">{selectedClient.attention_label}</Badge>
                  ) : null}
                </span>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={clearSelectedClient}>
                <X className="mr-1 h-4 w-4" />Змінити
              </Button>
            </div>
          ) : null}
          {draft.client_id ? (
            <div className="md:col-span-2">
              <SoloAssistantCard clientId={draft.client_id} childName={draft.child_name} />
            </div>
          ) : null}
          <Field label="Ім'я батька/матері *">
            <Input value={draft.parent_name} onChange={(e) => setDraft({ ...draft, client_id: null, parent_name: e.target.value })} />
          </Field>
          <Field label="Ім'я дитини *" className="relative">
            <Input value={draft.child_name} onChange={(e) => setDraft({ ...draft, client_id: null, child_name: e.target.value })} />
            {clientSuggestions.length > 0 ? (
              <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-md border bg-background p-1 shadow-lg">
                {clientSuggestions.map((client) => (
                  <button
                    key={client.id}
                    type="button"
                    className="flex w-full items-start justify-between gap-2 rounded-sm px-3 py-2 text-left text-sm hover:bg-accent"
                    onClick={() => applyClient(client)}
                  >
                    <span>
                      <span className="font-medium">{client.child_name}</span>
                      <span className="text-muted-foreground"> ({client.parent_name})</span>
                      {client.phone ? <span className="block text-xs text-muted-foreground">{client.phone}</span> : null}
                    </span>
                    <span className="flex shrink-0 flex-wrap justify-end gap-1">
                      <BirthdayBadge birthdate={client.child_birthdate} className="mt-0" />
                      {client.attention_label ? (
                        <Badge variant="secondary">{client.attention_label}</Badge>
                      ) : null}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </Field>
          <Field label="Телефон">
            <Input value={draft.phone} onChange={(e) => setDraft({ ...draft, client_id: null, phone: e.target.value })} onBlur={() => setDraft((current) => ({ ...current, phone: formatPhoneForUkraineInput(current.phone) }))} placeholder="+380671112233" />
          </Field>
          <Field label="Звідки заявка">
            <Select value={draft.source} onValueChange={(v) => setDraft({ ...draft, source: v, source_detail: isOtherSource(v) ? draft.source_detail : "" })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {settings.sources.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          {isOtherSource(draft.source) ? (
            <Field label="Звідки саме">
              <Input
                value={draft.source_detail}
                onChange={(e) => setDraft({ ...draft, source_detail: e.target.value })}
                placeholder="Наприклад: сусіди, Google, знайомі, афіша..."
              />
            </Field>
          ) : null}
          <Field label="Формат відвідування">
            <Select value={draft.format} onValueChange={(v) => setDraft({ ...draft, format: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {visibleBookingFormats(settings).map((f) => <SelectItem key={f.key} value={f.key}>{bookingFormatLabel(f)}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          {draft.format === "other" ? (
            <Field label="Кастомний час *">
              <div className="grid grid-cols-2 gap-2">
                <Select value={draft.visit_time} onValueChange={(v) => setDraft({ ...draft, visit_time: v })}>
                  <SelectTrigger><SelectValue placeholder="З" /></SelectTrigger>
                  <SelectContent>
                    {TIME_OPTIONS.slice(0, -1).map((time) => <SelectItem key={time} value={time}>з {time}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={draft.custom_end_time} onValueChange={(v) => setDraft({ ...draft, custom_end_time: v })}>
                  <SelectTrigger><SelectValue placeholder="До" /></SelectTrigger>
                  <SelectContent>
                    {TIME_OPTIONS.slice(1).map((time) => <SelectItem key={time} value={time}>до {time}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">
                {customDurationHours != null
                  ? `Тривалість: ${customDurationHours.toLocaleString("uk-UA")} год`
                  : "Кінець має бути пізніше початку"}
              </p>
            </Field>
          ) : null}
          <Field label="Дата">
            <Input type="date" value={draft.visit_date} onChange={(e) => setDraft({ ...draft, visit_date: e.target.value })} />
          </Field>
          {draft.format !== "other" ? (
            <Field label="Час">
              <Input type="time" value={draft.visit_time} onChange={(e) => setDraft({ ...draft, visit_time: e.target.value })} />
            </Field>
          ) : null}
          <Field label="Статус">
            <Select value={draft.status} onValueChange={(v) => setDraft({ ...draft, status: v })}>
              <SelectTrigger className={`border ${statusStyle(draft.status).trigger}`}>
                <StatusLabel status={draft.status} />
              </SelectTrigger>
              <SelectContent>
                {settings.statuses.map((s) => (
                  <SelectItem key={s} value={s}>
                    <StatusLabel status={s} />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={`Сума чеку, ₴ ${draft.amount_override ? "(вручну)" : "(авто)"}`}>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="0"
                value={draft.amount}
                disabled={!draft.amount_override}
                onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
              />
              <label className="flex items-center gap-1 text-xs whitespace-nowrap">
                <Checkbox
                  checked={draft.amount_override}
                  onCheckedChange={(v) => setDraft({ ...draft, amount_override: !!v })}
                />
                Вручну
              </label>
            </div>
          </Field>
          <Field label="Тип оплати">
            <Select
              value={draft.payment_status}
              onValueChange={(v) => setDraft({
                ...draft,
                payment_status: v,
                status: statusAfterPaymentChange(draft.status, v),
              })}
            >
              <SelectTrigger className={`border ${paymentStyle(draft.payment_status).trigger}`}>
                <PaymentStatusLabel status={draft.payment_status} />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    <PaymentStatusLabel status={status} />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <div className="md:col-span-2">
            <Label className="mb-2 block">Додаткові послуги</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {settings.extra_services.map((s) => {
                const checked = draft.extra_services.includes(s);
                return (
                  <label key={s} className="flex items-center gap-2 rounded-md border p-2 text-sm cursor-pointer hover:bg-accent/40">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(v) => {
                        const next = v
                          ? [...draft.extra_services, s]
                          : draft.extra_services.filter((x) => x !== s);
                        setDraft({ ...draft, extra_services: next });
                      }}
                    />
                    {s}
                  </label>
                );
              })}
            </div>
          </div>

          <Field label="Коментар від мами" className="md:col-span-2">
            <Textarea value={draft.parent_comment} onChange={(e) => setDraft({ ...draft, parent_comment: e.target.value })} rows={2} />
          </Field>
          <Field label="Коментар від вихователя" className="md:col-span-2">
            <Textarea value={draft.teacher_comment} onChange={(e) => setDraft({ ...draft, teacher_comment: e.target.value })} rows={2} />
          </Field>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Скасувати</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? "Збереження…" : "Зберегти"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
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
    <div className="inline-flex min-w-0 items-center gap-1.5 align-middle leading-none">
      <Icon className={`h-3.5 w-3.5 shrink-0 ${style.iconClass}`} />
      <span className="truncate leading-none">{normalized}</span>
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

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}
