import Link from "next/link";
import { notFound } from "next/navigation";
import { LANGS, type Lang } from "@/lib/copy";

const text = {
  ru: {
    h: "Конфиденциальность",
    p: [
      "Мы не просим имя, почту или телефон. Само приложение не сохраняет IP-адрес (но журналы хостинг-провайдера могут его содержать). Для связи ответов одного прохождения мы выдаём случайный номер сессии, а в браузере ставим случайный идентификатор (cookie), чтобы отсеивать повторные прохождения.",
      "Мы сохраняем ваши ответы, время ответов, укороченную строку User-Agent и необязательные сведения, которые вы указали: родной язык, годы изучения, самооценка уровня, результат внешнего теста. Эти сведения нужны только для калибровки заданий и проверки результата.",
      "Мы можем опубликовать статистику по заданиям и обобщённые результаты пилота в открытом виде без данных, которые позволяют установить личность. Данные отдельных людей не публикуются.",
      "Ссылка на ваш результат содержит длинный случайный код. Любой, у кого она есть, может открыть результат, поэтому не публикуйте её, если не хотите, чтобы результат видели другие.",
      "Данные пилота хранятся не дольше 24 месяцев. Чтобы удалить свои данные, пришлите номер сессии (последние символы ссылки на результат) оператору пилота.",
    ],
    back: "Назад",
  },
  en: {
    h: "Privacy",
    p: [
      "We do not ask for your name, email or phone number. The app itself does not store your IP address (the hosting provider's logs may contain it). We give each attempt a random session ID and set a random identifier (cookie) in your browser to filter out repeat attempts.",
      "We store your answers, answer timings, a shortened User-Agent string, and the optional details you give: native language, years of study, self-assessed level, an external test result. These are used only to calibrate the questions and check the result.",
      "We may publish item statistics and aggregate pilot results in open form, without data that identifies a person. Data of individual people is not published.",
      "Your result link contains a long random code. Anyone who has the link can open the result, so do not share it if you do not want others to see it.",
      "Pilot data is kept for no more than 24 months. To have your data deleted, send the session ID (the last characters of your result link) to the pilot operator.",
    ],
    back: "Back",
  },
} as const;

export default async function Privacy({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!LANGS.includes(lang as Lang)) notFound();
  const t = text[lang as Lang];
  return (
    <main className="wrap stack" lang={lang}>
      <h1>{t.h}</h1>
      {t.p.map((x) => <p key={x}>{x}</p>)}
      <Link href={`/${lang}`}>{t.back}</Link>
    </main>
  );
}
