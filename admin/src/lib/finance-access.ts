import { useSyncExternalStore } from 'react';

const financeEmails = new Set(['yulia@soloway.local', 'olena@soloway.local', 'andrew@soloway.local']);
const enforced = import.meta.env?.VITE_FINANCE_ACCESS_CONTROL === 'true';
let visible = !enforced;
const listeners = new Set<() => void>();

export function setFinanceUser(email?: string | null) {
  const next = !enforced || financeEmails.has(email?.trim().toLowerCase() || '');
  if (next === visible) return;
  visible = next;
  listeners.forEach((listener) => listener());
}
export function canSeeFinance() { return visible; }
export function canSeeVisitAmounts() {
  return visible || import.meta.env?.VITE_VISIT_AMOUNTS_VISIBLE === 'true';
}
export function requireFinanceAccess() {
  if (!visible) throw new Error('Доступ до фінансів обмежено.');
}
export function useFinanceAccess() {
  return useSyncExternalStore((listener) => { listeners.add(listener); return () => listeners.delete(listener); }, canSeeFinance, () => !enforced);
}
