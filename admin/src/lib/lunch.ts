export type LunchStatus = "not_taken" | "unpaid" | "paid";

export function getLatestLunchStatus(
  bookings: Array<{ status?: string | null; lunch_status?: string | null; visit_date?: string | null; visit_time?: string | null }>,
): LunchStatus | null {
  return [...bookings]
    .filter((booking) => booking.status === "Завершено" && (booking.lunch_status === "paid" || booking.lunch_status === "unpaid"))
    .sort((a, b) => `${b.visit_date ?? ""}T${b.visit_time ?? "00:00"}`.localeCompare(`${a.visit_date ?? ""}T${a.visit_time ?? "00:00"}`))
    .map((booking) => booking.lunch_status as LunchStatus)[0] ?? null;
}
