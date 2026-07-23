export const PAYMENT_STATUSES = [
  "не оплачено",
  "оплачено готівкою",
  "оплачено карткою",
] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export function isPaidPaymentStatus(status?: string | null) {
  return status === "оплачено готівкою" || status === "оплачено карткою";
}

export function statusAfterPaymentChange(currentStatus: string, paymentStatus: string) {
  if (!isPaidPaymentStatus(paymentStatus)) return currentStatus;
  if (currentStatus === "Завершено" || currentStatus === "Скасовано" || currentStatus === "Не прийшли") return currentStatus;
  return "Підтверджено";
}
