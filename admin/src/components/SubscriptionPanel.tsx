import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, CreditCard, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getSubscriptionPlan, addThirtyDays, subscriptionLabel, subscriptionStartFromBookingDate } from "@/lib/subscriptions";
import { formatUAH } from "@/lib/pricing";
import { toast } from "sonner";

export function SubscriptionPanel({ clientId, compact = false }: { clientId: string; compact?: boolean }) {
  const qc = useQueryClient();
  const [paymentMethod, setPaymentMethod] = useState<"" | "оплачено готівкою" | "оплачено карткою">("");
  const { data: subscription } = useQuery({
    queryKey: ["client-subscription", clientId],
    queryFn: async () => {
      const { data, error } = await supabase.from("client_subscriptions").select("*").eq("client_id", clientId).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const { data: firstBooking } = useQuery({
    queryKey: ["subscription-first-booking", subscription?.id],
    enabled: Boolean(subscription?.id),
    queryFn: async () => {
      const { data, error } = await supabase.from("bookings").select("id,visit_date,amount,payment_status").eq("subscription_id", subscription!.id).order("visit_date", { ascending: true }).limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const activateMut = useMutation({
    mutationFn: async (selectedPaymentMethod: "оплачено готівкою" | "оплачено карткою") => {
      if (!subscription || subscription.status !== "pending") return;
      const { data: charge, error: chargeError } = await supabase
        .from("bookings")
        .select("id")
        .eq("subscription_id", subscription.id)
        .gt("amount", 0)
        .maybeSingle();
      if (chargeError) throw chargeError;
      if (!charge) throw new Error("У бронюванні відсутня сума оплати абонемента. Спочатку перевірте оплату пакета.");
      const now = new Date();
      const startAt = subscription.starts_at ?? subscriptionStartFromBookingDate(firstBooking?.visit_date) ?? now.toISOString();
      const { data, error } = await supabase.from("client_subscriptions").update({
        status: "active",
        starts_at: startAt,
        expires_at: addThirtyDays(new Date(startAt)),
        paid_at: now.toISOString(),
        activated_at: now.toISOString(),
      }).eq("id", subscription.id).select("*").single();
      if (error) throw error;
      const { error: bookingPaymentError } = await supabase
        .from("bookings")
        .update({ payment_status: selectedPaymentMethod })
        .eq("subscription_id", subscription.id)
        .gt("amount", 0)
        .eq("payment_status", "не оплачено");
      if (bookingPaymentError) throw bookingPaymentError;
      return data;
    },
    onSuccess: () => {
      toast.success("Абонемент активовано");
      qc.invalidateQueries({ queryKey: ["client-subscription", clientId] });
      qc.invalidateQueries({ queryKey: ["clients-with-stats"] });
      qc.invalidateQueries({ queryKey: ["bookings"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!subscription || ["cancelled", "expired", "exhausted"].includes(subscription.status)) return null;
  const plan = getSubscriptionPlan(subscription.plan_type);
  if (!plan) return null;
  const label = subscription.status === "active"
    ? subscriptionLabel(subscription.plan_type, subscription.visits_used, subscription.visits_limit, subscription.expires_at)
    : "Абонемент ★ очікує активації";

  if (compact) {
    return (
      <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md border border-violet-200 bg-violet-50/60 px-2 py-1.5 text-xs">
        <span className="flex items-center gap-1 font-medium text-violet-900"><Star className="h-3.5 w-3.5" />{label}</span>
        {subscription.status === "pending" ? (
          <>
            <Select value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as typeof paymentMethod)}>
              <SelectTrigger className="h-7 w-[108px] px-2 text-xs"><SelectValue placeholder="Оплата" /></SelectTrigger>
              <SelectContent><SelectItem value="оплачено готівкою">Готівка</SelectItem><SelectItem value="оплачено карткою">Картка</SelectItem></SelectContent>
            </Select>
            <Button size="sm" className="h-7 px-2 text-xs" onClick={() => paymentMethod && activateMut.mutate(paymentMethod)} disabled={activateMut.isPending || !paymentMethod}>
              <CreditCard className="mr-1 h-3.5 w-3.5" />{activateMut.isPending ? "Активація..." : "Активувати"}
            </Button>
          </>
        ) : (
          <Badge variant="secondary" className="h-6">Активний</Badge>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-violet-200 bg-violet-50/60 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-medium text-violet-900"><Star className="h-4 w-4" />{label}</div>
        <Badge variant={subscription.status === "active" ? "default" : "secondary"}>{subscription.status === "active" ? "Активний" : "Очікує активації"}</Badge>
      </div>
      <div className="mt-1 text-sm text-violet-800">{plan.label} · {formatUAH(subscription.amount)}</div>
      {subscription.status === "pending" ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Select value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as typeof paymentMethod)}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="Спосіб оплати" /></SelectTrigger>
            <SelectContent><SelectItem value="оплачено готівкою">Готівка</SelectItem><SelectItem value="оплачено карткою">Картка</SelectItem></SelectContent>
          </Select>
          <Button size="sm" onClick={() => paymentMethod && activateMut.mutate(paymentMethod)} disabled={activateMut.isPending || !paymentMethod}>
            <CreditCard className="mr-2 h-4 w-4" />{activateMut.isPending ? "Активація..." : "Оплату отримано · активувати"}
          </Button>
        </div>
      ) : (
        <div className="mt-2 flex items-center gap-1 text-xs text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" />Діє до {new Date(subscription.expires_at ?? "").toLocaleDateString("uk-UA")}</div>
      )}
    </div>
  );
}
