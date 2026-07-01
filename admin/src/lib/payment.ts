export const PAYMENT_STATUSES = [
  "не оплачено",
  "оплачено готівкою",
  "оплачено карткою",
] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
