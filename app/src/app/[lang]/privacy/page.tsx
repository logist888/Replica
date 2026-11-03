import Link from "next/link";
import { notFound } from "next/navigation";
import { LANGS, type Lang } from "@/lib/copy";

const text = {
  ru: {
    h: "Как мы обращаемся с вашими данными",
    intro: "Коротко: мы собираем только то, что нужно, чтобы сделать вопросы теста точнее. Имя, почта и телефон нам не нужны.",
    sections: [
      { t: "Что мы сохраняем", p: [
        "Ваши ответы на вопросы теста и время, за которое вы отвечали.",
        "То, что вы сами решили указать в начале: родной язык, сколько лет учите английский, как оцениваете свой уровень, результат другого теста.",
        "Случайный номер вашего прохождения и случайный идентификатор в браузере (cookie): по нему мы замечаем повторные прохождения.",
        "Укороченную строку с названием вашего браузера и устройства.",
      ] },
      { t: "Чего мы не сохраняем", p: [
        "Мы не спрашиваем имя, почту и телефон. Приложение не записывает ваш IP-адрес. Журналы хостинга могут его содержать: это зависит от провайдера, который размещает сайт.",
      ] },
      { t: "Зачем нам эти данные", p: [
        "Чтобы понять, какие вопросы слишком лёгкие, слишком трудные или сбивают с толку, и уточнить уровень каждого вопроса. Больше ни для чего мы их не используем.",
      ] },
      { t: "Публикация", p: [
        "Мы можем опубликовать статистику по вопросам и общие итоги пилота в открытом виде. В публикации не будет сведений, по которым можно узнать человека. Ответы отдельных людей мы не публикуем.",
      ] },
      { t: "Ссылка на результат", p: [
        "Результат открывается по длинной случайной ссылке. Кто знает ссылку, тот видит результат, поэтому не публикуйте её, если не хотите, чтобы его видели другие.",
      ] },
      { t: "Сколько хранится и как удалить", p: [
        "Данные пилота хранятся не дольше 24 месяцев. Чтобы удалить свои данные раньше, откройте обращение (issue) в репозитории проекта на GitHub и укажите номер прохождения: это последние восемь символов вашей ссылки на результат.",
      ] },
    ],
    note: "Текст составлен как рабочий черновик для пилота и не заменяет юридическую консультацию.",
    back: "Назад на главную",
  },
  en: {
    h: "How we handle your data",
    intro: "In short: we collect only what we need to make the test questions more accurate. We don’t need your name, email or phone number.",
    sections: [
      { t: "What we keep", p: [
        "Your answers to the test questions and how long you took to answer.",
        "Whatever you chose to tell us at the start: native language, years of studying English, how you rate your level, the result of another test.",
        "A random ID for your attempt and a random identifier in your browser (a cookie), which we use to notice repeat attempts.",
        "A shortened line naming your browser and device.",
      ] },
      { t: "What we don’t keep", p: [
        "We don’t ask for your name, email or phone number. The app does not record your IP address. The hosting provider’s logs may contain it; that depends on the provider that hosts the site.",
      ] },
      { t: "Why we need it", p: [
        "To find out which questions are too easy, too hard or confusing, and to settle how hard each question is. We use it for nothing else.",
      ] },
      { t: "Publication", p: [
        "We may publish statistics about the questions and overall results of the pilot in the open. Nothing in them will identify a person. We do not publish the answers of individual people.",
      ] },
      { t: "Your result link", p: [
        "Your result opens through a long random link. Anyone who has the link can see the result, so don’t post it if you don’t want others to see it.",
      ] },
      { t: "How long we keep it and how to delete it", p: [
        "Pilot data is kept for no more than 24 months. To have your data deleted sooner, open an issue in the project’s GitHub repository and include your attempt ID: the last eight characters of your result link.",
      ] },
    ],
    note: "This text is a working draft for the pilot and is not legal advice.",
    back: "Back to the home page",
  },
} as const;

export default async function Privacy({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!LANGS.includes(lang as Lang)) notFound();
  const t = text[lang as Lang];
  return (
    <main className="wrap stack" lang={lang}>
      <h1>{t.h}</h1>
      <p style={{ fontSize: 18 }}>{t.intro}</p>
      {t.sections.map((s) => (
        <section key={s.t}>
          <h2>{s.t}</h2>
          {s.p.map((x) => <p key={x}>{x}</p>)}
        </section>
      ))}
      <p className="muted small">{t.note}</p>
      <Link href={`/${lang}`}>{t.back}</Link>
    </main>
  );
}
