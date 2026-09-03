import { CheckCircle2, CircleAlert, Utensils } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { LunchStatus } from "@/lib/lunch";
import { subscriptionLabel } from "@/lib/subscriptions";

export function LunchStatusSelect({ value, onChange, disabled = false }: { value: LunchStatus | ""; onChange: (value: LunchStatus) => void; disabled?: boolean }) {
  return (
    <div className="space-y-2">
      <Label>Додатковий обід *</Label>
      <Select value={value || "__unset__"} onValueChange={(next) => next !== "__unset__" && onChange(next as LunchStatus)} disabled={disabled}>
        <SelectTrigger><SelectValue placeholder="Оберіть варіант" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__unset__" disabled>Оберіть варіант</SelectItem>
          <SelectItem value="not_taken">Не брали</SelectItem>
          <SelectItem value="unpaid">Брали, не оплачено</SelectItem>
          <SelectItem value="paid">Брали, оплачено</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

export function LunchStatusQuickSelect({ value, onChange, disabled = false }: { value?: LunchStatus | null; onChange: (value: LunchStatus) => void; disabled?: boolean }) {
  return (
    <Select value={value || "__unset__"} onValueChange={(next) => next !== "__unset__" && onChange(next as LunchStatus)} disabled={disabled}>
      <SelectTrigger className="h-8 w-[150px] px-2 text-xs"><SelectValue placeholder="Статус обіду" /></SelectTrigger>
      <SelectContent>
        <SelectItem value="__unset__" disabled>Статус обіду</SelectItem>
        <SelectItem value="not_taken">Не брали</SelectItem>
        <SelectItem value="unpaid">Брали, не оплачено</SelectItem>
        <SelectItem value="paid">Брали, оплачено</SelectItem>
      </SelectContent>
    </Select>
  );
}

export function LunchStatusBadge({ status }: { status?: LunchStatus | null }) {
  if (status === "unpaid") return <Badge variant="destructive"><CircleAlert className="mr-1 h-3 w-3" />Обід не оплачений</Badge>;
  if (status === "paid") return <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50"><CheckCircle2 className="mr-1 h-3 w-3" />Останній обід оплачений</Badge>;
  return null;
}

export function SubscriptionBadge({ subscription }: { subscription?: { plan_type?: string | null; status?: string | null; visits_used?: number | null; visits_limit?: number | null; expires_at?: string | null } | null }) {
  if (!subscription || subscription.status === "cancelled" || subscription.status === "expired" || subscription.status === "exhausted") return null;
  const label = subscription.status === "pending"
    ? "Абонемент ★ очікує активації"
    : subscriptionLabel(subscription.plan_type, subscription.visits_used, subscription.visits_limit, subscription.expires_at);
  if (!label) return null;
  return <Badge className="border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-50"><Utensils className="mr-1 h-3 w-3" />{label}</Badge>;
}

export { Utensils };
