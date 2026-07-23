export function normalizePhone(value?: string | null) {
  const digits = (value ?? "").replace(/\D/g, "");
  if (!digits) return "";

  if (digits.startsWith("380") && digits.length === 12) return digits;
  if (digits.startsWith("80") && digits.length === 11) return `3${digits}`;
  if (digits.startsWith("0") && digits.length === 10) return `38${digits}`;
  if (digits.length === 9) return `380${digits}`;

  return digits;
}

export function formatPhoneForUkraineInput(value?: string | null) {
  const normalized = normalizePhone(value);
  if (normalized.startsWith("380")) return `+${normalized}`;
  return value ?? "";
}
