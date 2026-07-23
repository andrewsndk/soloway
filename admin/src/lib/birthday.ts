const DAY_MS = 24 * 60 * 60 * 1000;

export type BirthdayReminder = {
  label: string;
  daysUntil: number;
  dateLabel: string;
};

export function getBirthdayReminder(birthdate?: string | null, now = new Date()): BirthdayReminder | null {
  if (!birthdate) return null;

  const [year, month, day] = birthdate.split("-").map(Number);
  if (!year || !month || !day) return null;

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  let birthday = new Date(today.getFullYear(), month - 1, day);
  birthday.setHours(0, 0, 0, 0);

  if (birthday.getTime() < today.getTime()) {
    birthday = new Date(today.getFullYear() + 1, month - 1, day);
    birthday.setHours(0, 0, 0, 0);
  }

  const daysUntil = Math.round((birthday.getTime() - today.getTime()) / DAY_MS);
  if (daysUntil < 0 || daysUntil > 3) return null;

  const dateLabel = `${String(day).padStart(2, "0")}.${String(month).padStart(2, "0")}`;

  return {
    label: `🎂 ${dateLabel}`,
    daysUntil,
    dateLabel,
  };
}
