export function subscriptionBookingAmount(
  savedAmount: number,
  draftAmount: number,
  manual: boolean,
) {
  if (!manual) return savedAmount;
  if (!Number.isFinite(draftAmount) || draftAmount < 0) {
    throw new Error("Вкажіть коректну суму оплати");
  }
  if (savedAmount > 0 && draftAmount === 0) {
    throw new Error("Оплату абонемента не можна обнулити. Нульова сума застосовується до наступних візитів.");
  }
  if (savedAmount === 0 && draftAmount > 0) {
    throw new Error("Цей візит уже покритий абонементом. Змінюйте оплату в бронюванні, де оформлено пакет.");
  }
  return draftAmount;
}
