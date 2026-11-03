# Пилот открытого теста английского

Next.js 16 + Postgres. Без аккаунтов, имён и почты. Часть 1: словарь (yes/no, 60 слов), часть 2: чтение
(10 текстов по 3 вопроса), часть 3 (необязательная): аудирование, 4 записи по 3 вопроса. Часть 3 включается, когда в
`content/audio/` есть записи (см. `replica/listening-recording-guide.md`); без них тест идёт из двух частей. Результат предварительный. Адаптивность выключена намеренно: пока сложности заданий
неизвестны, пилот собирает данные для калибровки (см. `replica/methodology.md`).

## Запуск

```bash
cd app
cp .env.example .env.local        # заполнить DATABASE_URL, ADMIN_TOKEN
npm install
npm run migrate                   # создаёт таблицы (идемпотентно)
npm run dev                       # http://localhost:3000, содержимое копируется из ../content
npm test                          # модульные тесты подсчёта баллов
npm run test:e2e                  # Playwright (нужны собранное приложение, Postgres и DATABASE_URL)
```

Каталог `content/` в корне репозитория копируется в `app/content/` скриптом `sync-content` перед dev и build.
При деплое из каталога `app` нужно включить доступ к файлам вне корня проекта (на Vercel: "Include source files outside
of the Root Directory") либо собирать из корня репозитория командой `cd app && npm run build`.

## Данные

Выгрузка (нужен `ADMIN_TOKEN`):

```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" "https://HOST/api/admin/export?kind=responses" > responses.csv
curl -H "Authorization: Bearer $ADMIN_TOKEN" "https://HOST/api/admin/export?kind=sessions"  > sessions.csv
python3 ../engine/calibrate_pilot.py responses.csv --out calibration.json --pseudo ../content/vocab/pool.json
```

Выгружаются только завершённые сессии. Файл `calibration.json`: сложность заданий (логиты), список заданий на проверку,
подозрительные псевдослова.

## Что сделано, а что нет

Сделано: форма, сбор ответов, результат, выгрузка, калибровка, тесты (модульные и e2e), проверка контента, поддержка аудирования.
Не сделано: сами записи аудирования (сценарии написаны, нужно озвучить), адаптивная схема на боевых параметрах, письмо и речь,
почтовая отправка результата, удаление данных по запросу (вручную через SQL по номеру сессии), общее хранилище для
ограничения частоты запросов (сейчас в памяти процесса, годится для одного инстанса).

## Тесты

```bash
export DATABASE_URL=postgres://postgres@localhost:5544/pilot ADMIN_TOKEN=test-admin-token-0123456789
npm run build
node scripts/make-test-audio.mjs   # ТОЛЬКО для тестов: короткие WAV-заглушки вместо настоящих записей
npm run test:e2e
```
Заглушки создаются в `app/content/audio/` (каталог не коммитится) и не перезаписывают настоящие записи.
Перед выкладкой на боевой стенд удалите `app/content/audio/*.wav`, созданные заглушки.
