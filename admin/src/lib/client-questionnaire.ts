export const CLIENT_QUESTIONNAIRE_EMPTY = {
  preferred_name: "",
  food_allergies: "",
  other_allergies: "",
  snack_consent: "",
  toilet_habits: "",
  hygiene_notes: "",
  adaptation_notes: "",
  calming_notes: "",
  interests: "",
  physical_restrictions: "",
  photo_consent: "",
  important_notes: "",
};

export type ClientQuestionnaireKey = keyof typeof CLIENT_QUESTIONNAIRE_EMPTY;

export const CLIENT_QUESTIONNAIRE_GROUPS: Array<{
  title: string;
  fields: Array<{ key: ClientQuestionnaireKey; label: string; rows?: number }>;
}> = [
  {
    title: "Загальна інформація",
    fields: [
      { key: "preferred_name", label: "Як дитина любить, щоб її називали" },
    ],
  },
  {
    title: "Харчування та алергії",
    fields: [
      { key: "food_allergies", label: "Алергії на продукти", rows: 2 },
      { key: "other_allergies", label: "Інші алергії", rows: 2 },
      { key: "snack_consent", label: "Перекус: згода або обмеження", rows: 2 },
    ],
  },
  {
    title: "Побутові навички та гігієна",
    fields: [
      { key: "toilet_habits", label: "Навички туалету", rows: 2 },
      { key: "hygiene_notes", label: "Ритуали чи прохання щодо гігієни", rows: 2 },
    ],
  },
  {
    title: "Психологічні та індивідуальні особливості",
    fields: [
      { key: "adaptation_notes", label: "Реакція на нове середовище та людей", rows: 2 },
      { key: "calming_notes", label: "Що допомагає заспокоїтися", rows: 2 },
      { key: "interests", label: "Улюблені заняття, теми або іграшки", rows: 2 },
      { key: "physical_restrictions", label: "Обмеження щодо фізичної активності", rows: 2 },
    ],
  },
  {
    title: "Фото, безпека та примітки",
    fields: [
      { key: "photo_consent", label: "Згода на фото- та відеозйомку", rows: 2 },
      { key: "important_notes", label: "Страхи, поведінка, зміни в житті, досвід Монтессорі", rows: 3 },
    ],
  },
];

export function normalizeQuestionnairePayload<T extends Record<string, string>>(form: T) {
  return Object.fromEntries(
    Object.entries(form).map(([key, value]) => [key, value.trim() || null]),
  ) as { [K in keyof T]: string | null };
}
