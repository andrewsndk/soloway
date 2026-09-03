export type SubscriptionPlan = "hour_1" | "hour_3" | "half_day" | "full_day" | "unlimited_month";
export type SubscriptionStatus = "pending" | "active" | "exhausted" | "expired" | "cancelled";

export const SUBSCRIPTION_PLANS: Array<{ key: SubscriptionPlan; label: string; amount: number; format: string; visitsLimit: number | null }> = [
  { key: "hour_1", label: "Абонемент: 1 година (10 відвідувань)", amount: 4200, format: "hour_1", visitsLimit: 10 },
  { key: "hour_3", label: "Абонемент: 3 години (10 відвідувань)", amount: 7200, format: "hour_3", visitsLimit: 10 },
  { key: "half_day", label: "Абонемент: Півдоби (10 відвідувань)", amount: 9200, format: "half_day", visitsLimit: 10 },
  { key: "full_day", label: "Абонемент: Цілий день (10 відвідувань)", amount: 11800, format: "full_day", visitsLimit: 10 },
  { key: "unlimited_month", label: "Абонемент: Безліміт на місяць", amount: 29900, format: "full_day", visitsLimit: null },
];

export function getSubscriptionPlan(key?: string | null) {
  return SUBSCRIPTION_PLANS.find((plan) => plan.key === key) ?? null;
}

export function subscriptionLabel(planType?: string | null, used?: number | null, limit?: number | null, expiresAt?: string | null) {
  const plan = getSubscriptionPlan(planType);
  if (!plan) return null;
  if (plan.key === "unlimited_month") {
    return `Абонемент ★ ∞ до ${expiresAt ? new Date(expiresAt).toLocaleDateString("uk-UA") : "—"}`;
  }
  return `Абонемент ★ ${used ?? 0}/${limit ?? 10}`;
}

export function addThirtyDays(date = new Date()) {
  return new Date(date.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
}

export function subscriptionStartFromBookingDate(visitDate?: string | null) {
  if (!visitDate) return null;
  const date = new Date(`${visitDate.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
