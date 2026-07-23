import { Badge } from "@/components/ui/badge";
import { getBirthdayReminder } from "@/lib/birthday";

export function BirthdayBadge({
  birthdate,
  className = "",
}: {
  birthdate?: string | null;
  className?: string;
}) {
  const reminder = getBirthdayReminder(birthdate);
  if (!reminder) return null;

  const title = reminder.daysUntil === 0
    ? "День народження сьогодні"
    : `День народження через ${reminder.daysUntil} дн.`;

  return (
    <Badge
      className={`mt-1 inline-flex max-w-full items-center gap-1 border border-pink-200 bg-pink-50 text-pink-800 hover:bg-pink-50 ${className}`}
      title={title}
    >
      <span className="truncate">{reminder.label}</span>
    </Badge>
  );
}
