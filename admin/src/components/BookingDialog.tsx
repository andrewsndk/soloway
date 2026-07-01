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
import { fetchSettings, type AppSettings } from "@/lib/settings";
import { calcAmount } from "@/lib/pricing";
import { PAYMENT_STATUSES } from "@/lib/payment";
import { Banknote, CircleAlert, CreditCard } from "lucide-react";
import { toast } from "sonner";

type BookingDraft = {
  id?: string;
  parent_name: string;
  child_name: string;
  phone: string;
  format: string;
  hours: string;
  visit_date: string;
  visit_time: string;
  source: string;
  extra_services: string[];
  amount: string;
  amount_override: boolean;
  payment_status: string;
  parent_comment: string;
  teacher_comment: string;
  status: string;
};

const emptyDraft: BookingDraft = {
  parent_name: "",
  child_name: "",
  phone: "",
  format: "hour_3",
  hours: "",
  visit_date: new Date().toISOString().slice(0, 10),
  visit_time: "10:00",
  source: "Instagram",
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
  const [draft, setDraft] = useState<BookingDraft>(emptyDraft);

  useEffect(() => {
    if (open) {
      setDraft({ ...emptyDraft, ...defaults, ...initial } as BookingDraft);
    }
  }, [open, initial, defaults]);

  const computedAmount = useMemo(() => {
    if (!settings) return 0;
    return calcAmount(draft.format, draft.format === "other" ? Number(draft.hours) : null, settings);
  }, [draft.format, draft.hours, settings]);

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
      if (draft.format === "other" && !(Number(draft.hours) > 0)) {
        throw new Error("Вкажіть кількість годин");
      }
      if (draft.phone && !/^[+0-9\s()-]{5,}$/.test(draft.phone)) {
        throw new Error("Невірний формат телефону");
      }

      // Find or create client
      let clientId: string | null = null;
      const parent = draft.parent_name.trim();
      const child = draft.child_name.trim();
      const phone = draft.phone.trim();

      const orParts: string[] = [];
      if (phone) orParts.push(`phone.eq.${phone}`);
      const { data: matches } = await supabase
        .from("clients")
        .select("id,parent_name,child_name,phone")
        .or(
          [
            `and(parent_name.ilike.${parent},child_name.ilike.${child})`,
            ...orParts,
          ].join(","),
        );

      if (matches && matches.length > 0) {
        clientId = matches[0].id;
      } else {
        const { data: created, error: ce } = await supabase
          .from("clients")
          .insert({ parent_name: parent, child_name: child, phone: phone || null })
          .select("id")
          .single();
        if (ce) throw ce;
        clientId = created.id;
      }

      const payload = {
        client_id: clientId,
        parent_name: parent,
        child_name: child,
        phone: phone || null,
        format: draft.format,
        hours: draft.format === "other" ? Number(draft.hours) : null,
        visit_date: draft.visit_date,
        visit_time: draft.visit_time || null,
        source: draft.source || null,
        extra_services: draft.extra_services,
        amount: Number(draft.amount) || 0,
        amount_override: draft.amount_override,
        payment_status: draft.payment_status,
        parent_comment: draft.parent_comment || null,
        teacher_comment: draft.teacher_comment || null,
        status: draft.status,
      };

      if (draft.id) {
        const { error } = await supabase.from("bookings").update(payload).eq("id", draft.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("bookings").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(draft.id ? "Бронювання оновлено" : "Бронювання створено");
      qc.invalidateQueries({ queryKey: ["bookings"] });
      qc.invalidateQueries({ queryKey: ["clients"] });
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
            Клієнт буде знайдений або створений автоматично за іменами/телефоном.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2 md:grid-cols-2">
          <Field label="Ім'я батька/матері *">
            <Input value={draft.parent_name} onChange={(e) => setDraft({ ...draft, parent_name: e.target.value })} />
          </Field>
          <Field label="Ім'я дитини *">
            <Input value={draft.child_name} onChange={(e) => setDraft({ ...draft, child_name: e.target.value })} />
          </Field>
          <Field label="Телефон">
            <Input value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} placeholder="0671112233" />
          </Field>
          <Field label="Звідки заявка">
            <Select value={draft.source} onValueChange={(v) => setDraft({ ...draft, source: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {settings.sources.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Формат відвідування">
            <Select value={draft.format} onValueChange={(v) => setDraft({ ...draft, format: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {settings.formats.map((f) => <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label={draft.format === "other" ? "Кількість годин *" : "Кількість годин"}>
            <Input
              type="number"
              min="0"
              step="0.5"
              disabled={draft.format !== "other"}
              value={draft.hours}
              onChange={(e) => setDraft({ ...draft, hours: e.target.value })}
            />
          </Field>
          <Field label="Дата">
            <Input type="date" value={draft.visit_date} onChange={(e) => setDraft({ ...draft, visit_date: e.target.value })} />
          </Field>
          <Field label="Час">
            <Input type="time" value={draft.visit_time} onChange={(e) => setDraft({ ...draft, visit_time: e.target.value })} />
          </Field>
          <Field label="Статус">
            <Select value={draft.status} onValueChange={(v) => setDraft({ ...draft, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {settings.statuses.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
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
            <Select value={draft.payment_status} onValueChange={(v) => setDraft({ ...draft, payment_status: v })}>
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
    <span className="flex min-w-0 items-center gap-2 truncate">
      <Icon className={`h-4 w-4 shrink-0 ${style.iconClass}`} />
      <span className="truncate">{normalized}</span>
    </span>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}
