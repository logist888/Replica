# Размещение пилота на Timeweb Cloud

Состав: приложение (Next.js) + Postgres + Caddy (HTTPS и прокси) в Docker Compose на одном небольшом сервере.
Аудирование выключено само: в образ записи не попадают, часть 3 в тесте не показывается.

## Куда ставить

**На новый отдельный сервер.** Сервер из проекта «Динь» (195.80.50.14) уже занят боевым сервисом: порты 80 и 443 держит его Caddy. Ставить пилот рядом можно только отдельным блоком в тот же Caddy, и тогда любая ошибка касается обоих проектов. Для пилота хватает самого маленького облачного сервера (1–2 vCPU, 2 ГБ памяти, Ubuntu 22.04 или 24.04).

## Способ 1. Вручную (около 15 минут)

1. В панели Timeweb Cloud создайте сервер (Ubuntu), откройте порты 80 и 443, зайдите по SSH.
2. Установите Docker:
   ```bash
   apt-get update && apt-get install -y git docker.io docker-compose-v2 openssl
   systemctl enable --now docker
   ```
3. Скачайте проект и создайте настройки:
   ```bash
   git clone --depth 1 https://github.com/logist888/Replica.git /opt/pilot && cd /opt/pilot
   printf 'DB_PASSWORD=%s\nADMIN_TOKEN=%s\nSITE_ADDRESS=:80\n' "$(openssl rand -hex 24)" "$(openssl rand -hex 24)" > deploy/.env
   chmod 600 deploy/.env
   ```
4. Запустите:
   ```bash
   docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d --build
   ```
5. Проверьте: `http://IP-СЕРВЕРА/en` открывает главную, `/ru/privacy` открывает политику.

## Способ 2. Автоматически (нужен токен Timeweb Cloud API)

Файл `deploy/cloud-init.yml` делает шаги 2–4 при создании сервера. Сервер можно создать через API Timeweb, передав этот файл как cloud-init, тогда заходить по SSH не придётся. Для этого токен нужно добавить в настройки окружения сессии как переменную `TIMEWEB_API_TOKEN` (в чат токен не присылайте).

## Домен и HTTPS

1. Направьте A-запись домена на IP сервера.
2. В `deploy/.env` замените `SITE_ADDRESS=:80` на `SITE_ADDRESS=ваш.домен`.
3. `docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d`. Сертификат Caddy получит сам.

## После запуска

- Кнопка «Пройти тест» на сайте: `cd site && PILOT_URL=https://ваш.домен npm run build`, затем закоммитить и слить в `main`.
- Выгрузка данных:
  ```bash
  source /opt/pilot/deploy/.env
  curl -H "Authorization: Bearer $ADMIN_TOKEN" "https://ваш.домен/api/admin/export?kind=responses" > responses.csv
  curl -H "Authorization: Bearer $ADMIN_TOKEN" "https://ваш.домен/api/admin/export?kind=sessions" > sessions.csv
  ```
- Копия базы (раз в сутки, строка для `crontab -e`):
  `15 3 * * * docker exec $(docker ps -qf name=db) pg_dump -U pilot pilot | gzip > /root/pilot-$(date +\%F).sql.gz`
- Обновление: `cd /opt/pilot && git pull && docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d --build` (миграции выполняются сами).
- Логи: `docker compose -f deploy/docker-compose.yml logs -f app`.

## Что проверить сразу

1. Главная на русском и английском, политика, прохождение теста до результата самому (30 минут, можно отвечать наугад).
2. Выгрузка `sessions.csv` показывает вашу сессию.
3. Порт 5432 снаружи закрыт: `nc -zv IP 5432` не должен соединяться.
