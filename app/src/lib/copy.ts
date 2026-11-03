export type Lang = "ru" | "en";
export const LANGS: Lang[] = ["ru", "en"];

export const copy = {
  ru: {
    title: "Проверьте свой английский: бесплатный пилот",
    lead: "Это пилот открытого теста уровня английского. Он нужен, чтобы откалибровать задания, поэтому результат предварительный. Тест бесплатный, без регистрации и без почты.",
    what: "Что вас ждёт",
    items: [
      "Около 30 минут. Часть 1: 60 слов, нужно отвечать «знаю» или «не знаю». Часть 2: 10 коротких текстов с вопросами.",
      "Сам тест и все задания на английском. Телефон или компьютер, тишина не нужна, звук не требуется.",
      "В конце вы увидите ориентировочный диапазон уровня по шкале CEFR (от A1 до C2).",
    ],
    rules: "Правила",
    rulesItems: [
      "Проходите один раз и без помощи: от честных ответов зависит качество теста.",
      "Не используйте словари, переводчики и подсказки. Закрывать вкладку до конца нельзя, прогресс не сохраняется.",
      "Вам должно быть не меньше 16 лет.",
    ],
    notOfficial: "Это не официальный сертификат и не заменяет экзамен. Диапазон уровня предварительный и будет уточнён по итогам пилота.",
    start: "Начать тест",
    privacy: "Конфиденциальность",
  },
  en: {
    title: "Check your English: free pilot",
    lead: "This is a pilot of an open English placement test. It is used to calibrate the questions, so your result is provisional. It is free, with no sign-up and no email.",
    what: "What to expect",
    items: [
      "About 30 minutes. Part 1: 60 words, answer 'I know it' or 'I don't know it'. Part 2: 10 short texts with questions.",
      "The test and all questions are in English. Works on a phone or a computer. No sound is needed.",
      "At the end you see an estimated range on the CEFR scale (A1 to C2).",
    ],
    rules: "Rules",
    rulesItems: [
      "Take it once and without help: the quality of the test depends on honest answers.",
      "Do not use dictionaries, translators or hints. Please do not close the tab: progress is not saved.",
      "You must be at least 16 years old.",
    ],
    notOfficial: "This is not an official certificate and does not replace an exam. The level range is provisional and will be refined after the pilot.",
    start: "Start the test",
    privacy: "Privacy",
  },
} as const;
