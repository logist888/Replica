# Компоненты

Источник значений: `tokens.json`. Здесь только поведение и состояния. Тексты внутри теста английские; тексты посадочной — ru/en. Иконки: Lucide (ISC), шрифт Inter (SIL OFL). Всё нарисовано заново, ассетов EF нет.

Общие правила:
- цель касания не меньше 44x44 px (`min-touch-target`);
- фокус виден всегда: кольцо 2 px цвета `focus`, смещение 2 px;
- цвет не единственный носитель смысла: уровни CEFR всегда подписаны текстом;
- при `prefers-reduced-motion` переходы отключаются;
- язык документа `lang="en"` внутри теста, `lang` посадочной по локали.

## Button
```
variants  primary, secondary, ghost, danger
sizes     md 44px (по умолчанию), lg 52px
states    default, hover, active, focus-visible, disabled, loading
tokens    primary: bg accent, hover accent-hover, text on-accent, radius md, font base/600
a11y      настоящий <button>; loading оставляет подпись и ставит aria-busy
used on   S01-S03, S08, S09, S10, S11, S13
```

## OptionCard (вариант ответа, один из многих)
```
element   <input type=radio> внутри <label>, группа в <fieldset> с <legend> = вопрос
states    default, hover, selected, focus-visible, disabled
selected  рамка accent 2px + заливка surface + индикатор-точка (не только цвет)
size      на всю ширину колонки теста, высота от 52px
a11y      клавиши: стрелки внутри группы, Space выбирает; ответ не помечается верным/неверным
note      после выбора ответ можно сменить до нажатия Next; обратной связи о правильности нет
used on   S10, S11, S16
```

## GapInput (C-test и пропуски)
```
element   <input> по одной букве или одно поле на слово
states    default, focus, filled, error (пустое поле при Next)
a11y      aria-label "Missing letters of word N"; автопереход между полями без ловушки клавиатуры
tokens    border-input, radius sm, mono не используется
used on   S10 (если формат c_test)
```

## YesNoWord (проверка словаря)
```
element   карточка слова + две кнопки Yes / No (радио-группа)
states    default, selected-yes, selected-no, focus-visible
a11y      подпись "Is this a real English word?"
used on   S10
```

## Passage (текст для чтения)
```
element   <article>, ширина test-max-width, font passage 18/30
layout    на десктопе текст слева, вопросы справа от 1024px; на мобильном текст над вопросом
a11y      заголовок, язык en; разметка абзацев; без фиксации высоты
used on   S10
```

## AudioPlayer
```
controls  Play/Pause, прогресс (только чтение), оставшиеся прослушивания
states    idle, loading, playing, paused, ended, error, limit-reached
rules     запуск только по нажатию (автовоспроизведение блокируется в Safari);
          число прослушиваний задаётся заданием (1 или 2), показывается как "Plays left: 1"
a11y      <button> с aria-label; обновление статуса через aria-live="polite"
no        транскрипт не показывается; скачивание отключено; ссылка подписанная, 60 секунд
used on   S11
```

## Timer
```
variants  общий таймер сессии (по умолчанию); таймер вопроса отключён в v1
states    normal, low (последние 5 минут: фон timer-low-bg, текст danger), expired
a11y      НЕ объявлять каждую секунду; aria-live="polite" только на 10, 5, 1 минуту
          и текстовая альтернатива "12 minutes left"; клиентский таймер сверяется с сервером
tokens    sm/600, моно-цифры (font-variant-numeric: tabular-nums)
used on   S10, S11
```

## StageProgress
```
what      "Part 1 of 3" по стадиям ca-MST; число вопросов не показывается,
          потому что оно не фиксировано при адаптивной схеме
element   <ol> из трёх шагов + текст; aria-current="step"
states    done, current, upcoming
used on   S10, S11
```

## QuestionCard
```
slots     номер модуля (скрыт для читающих с экрана, не нужен), текст вопроса (question 20/30), опции, кнопка Next
rules     кнопка Next неактивна, пока нет ответа, но не скрыта (disabled с пояснением aria-describedby)
          возврата к предыдущему вопросу нет (правило теста), кнопки Back нет
          выделение текста и копирование блокируются визуально (user-select: none) —
          это не защита, а сдерживание; вспомогательным технологиям текст остаётся доступен
used on   S10, S11, S16
```

## LevelBadge (CEFR)
```
variants  pre-A1, A1, A2, B1, B2, C1, C2
shape     pill, подпись всегда текстом ("B1"), цвет cefr-*-bg
tokens    A1-B2 текст cefr-text-light; C1-C2 текст cefr-text-dark
used on   S13, S14, S04
```

## LevelScale
```
what      горизонтальная шкала A1...C2 с отметкой результата и диапазоном неопределённости (se)
a11y      role="img" + aria-label "Reading: B2, between B1 and C1 likely"; под шкалой таблица той же информации
note      показывать диапазон, а не точку: до калибровки границы предварительные
used on   S13, S14
```

## ScoreCard
```
slots     навык (Reading / Listening), балл 0-100 (score 56/60), LevelBadge, LevelScale, подпись "Provisional estimate"
states    ready, provisional (до калибровки), unavailable (сессия прервана)
used on   S13, S14
```

## CertificateCard
```
slots     имя, дата, баллы по навыкам, уровни, ссылка/QR на проверку, пометка "Diagnostic result, not an official certificate"
states    public, hidden (is_public=false)
print     вертикальный A4, поля 16 мм, чёрно-белая печать читаема (уровни подписаны)
used on   S14, S15
no        без логотипов и графики третьих лиц
```

## ConsentCheckbox
```
element   <input type=checkbox> + label со ссылками на Terms и Privacy
states    default, checked, error ("Please accept to continue"), disabled
used on   S08
```

## LanguageSwitch (только посадочная и кабинет)
```
variants  ru | en
element   ссылка-переключатель с lang на каждом пункте; не <select>
note      внутри теста переключателя нет
used on   S01, S04-S07
```

## Alert / Banner
```
variants  info, warning (warning-bg + warning), error (danger), success
a11y      role="status" для info/success, role="alert" для error; иконка + текст
used on   S08, S09, S12
```

## SessionDialog (фатальная ошибка, истёк таймер)
```
variants  expired, error, offline
actions   Resume (если разрешено архитектурой), Go to results, Close
a11y      <dialog>, фокус внутрь, возврат фокуса, Esc не закрывает обязательный
used on   S12
```

## Header / Footer
```
header    56px, логотип-заглушка (будет заменён в replica-brand), LanguageSwitch
test mode в тесте шапка минимальная: название, Timer, без навигации
footer    Terms, Privacy, контакт; на посадочной
```

## Состояния экранов (минимум)
- загрузка: скелетон вопроса, без спиннера на всю страницу;
- нет сети: SessionDialog offline, ответы сохраняются локально на 60 секунд;
- пусто: у кабинета без результатов — приглашение пройти тест;
- ошибка: Alert error с причиной и действием.
