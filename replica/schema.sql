-- Схема диагностического теста английского (собственный продукт, вдохновлён функциями EF SET)
-- Postgres 15+. Время только timestamptz (UTC). Права: RLS включён, банк заданий клиенту не отдаётся.

create extension if not exists pgcrypto;

-- Пользователи (при Supabase Auth ссылаться на auth.users, здесь отдельный профиль)
create table profiles (
  id uuid primary key,                         -- = auth user id
  email text not null unique,
  display_name text,
  locale text not null default 'ru' check (locale in ('ru','en')),
  birth_year int check (birth_year between 1900 and 2100),
  age_confirmed_16 boolean not null default false,
  terms_accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Источники контента и лицензии: запрещает хранить задание без указания происхождения
create table content_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  license text not null check (license in ('own','cc0','cc-by','cc-by-sa','public-domain','licensed')),
  commercial_use_ok boolean not null,          -- false для CC BY-NC и подобных: такие задания не попадают в боевой банк
  url text,
  attribution text,
  created_at timestamptz not null default now()
);

-- Задания (item) — банк. Тексты, аудио и ключи наружу не отдаются никогда.
create table items (
  id uuid primary key default gen_random_uuid(),
  skill text not null check (skill in ('reading','listening')),
  format text not null check (format in ('mcq','c_test','yes_no_vocab','gap_fill')),
  stem text not null,
  options jsonb,                               -- для mcq; для c_test — пусто
  answer_key jsonb not null,
  audio_path text,                             -- путь в приватном хранилище
  passage_id uuid,                             -- общий текст для группы вопросов
  cefr_target text check (cefr_target in ('A1','A2','B1','B2','C1','C2')),
  source_id uuid not null references content_sources(id),
  status text not null default 'draft'
    check (status in ('draft','pilot','active','retired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint listening_has_audio check (skill <> 'listening' or audio_path is not null)
);
create index on items (skill, status);
create index on items (source_id);
create index on items (passage_id);

-- Калибровка (Rasch): b = сложность на шкале theta, версия калибровки хранится
create table calibrations (
  id uuid primary key default gen_random_uuid(),
  version int not null unique,
  method text not null,                        -- например 'JML' | 'CML'
  sample_size int not null check (sample_size > 0),
  note text,
  created_at timestamptz not null default now()
);

create table item_difficulty (
  item_id uuid not null references items(id) on delete cascade,
  calibration_id uuid not null references calibrations(id) on delete cascade,
  b double precision not null,
  se double precision,
  infit double precision,
  n_responses int not null default 0,
  primary key (item_id, calibration_id)
);
create index on item_difficulty (calibration_id);

-- Панель ca-MST: стадии и модули
create table panels (
  id uuid primary key default gen_random_uuid(),
  skill text not null check (skill in ('reading','listening')),
  version int not null,
  calibration_id uuid not null references calibrations(id),
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  unique (skill, version)
);
create unique index one_active_panel_per_skill on panels (skill) where is_active;

create table modules (
  id uuid primary key default gen_random_uuid(),
  panel_id uuid not null references panels(id) on delete cascade,
  stage int not null check (stage between 1 and 3),
  code text not null,                          -- M1..M8
  target_cefr text not null,
  unique (panel_id, code)
);
create index on modules (panel_id, stage);

create table module_items (
  module_id uuid not null references modules(id) on delete cascade,
  item_id uuid not null references items(id) on delete restrict,
  position int not null,
  primary key (module_id, item_id),
  unique (module_id, position)
);
create index on module_items (item_id);

-- Правила маршрутизации: порог по сумме баллов ведёт в следующий модуль
create table routing_rules (
  id uuid primary key default gen_random_uuid(),
  from_module_id uuid not null references modules(id) on delete cascade,
  min_score numeric not null,
  max_score numeric not null,
  to_module_id uuid not null references modules(id) on delete cascade,
  check (max_score >= min_score)
);
create index on routing_rules (from_module_id);
create index on routing_rules (to_module_id);

-- Отсечки CEFR на шкале theta (из пилота; перекалибровываются)
create table cut_scores (
  id uuid primary key default gen_random_uuid(),
  calibration_id uuid not null references calibrations(id) on delete cascade,
  skill text not null check (skill in ('reading','listening')),
  level text not null check (level in ('A1','A2','B1','B2','C1','C2')),
  theta_min double precision not null,
  unique (calibration_id, skill, level)
);
create index on cut_scores (skill);

-- Сессии прохождения
create table test_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  kind text not null check (kind in ('practice','diagnostic')),
  status text not null default 'in_progress'
    check (status in ('in_progress','completed','cancelled','expired')),
  started_at timestamptz not null default now(),
  deadline_at timestamptz not null,
  finished_at timestamptz,
  user_agent text,
  created_at timestamptz not null default now(),
  constraint finished_after_start check (finished_at is null or finished_at >= started_at)
);
create index on test_sessions (user_id, started_at desc);
create index on test_sessions (status, deadline_at);

-- Не больше одной незавершённой сессии на пользователя
create unique index one_open_session_per_user
  on test_sessions (user_id) where status = 'in_progress';

-- Лимит 1 диагностической попытки за 90 дней
create or replace function enforce_attempt_limit() returns trigger as $$
begin
  if new.kind = 'diagnostic' and exists (
    select 1 from test_sessions
    where user_id = new.user_id
      and kind = 'diagnostic'
      and status = 'completed'
      and finished_at > now() - interval '90 days'
  ) then
    raise exception 'attempt limit: one diagnostic per 90 days' using errcode = 'P0001';
  end if;
  return new;
end $$ language plpgsql;

create trigger test_sessions_attempt_limit
  before insert on test_sessions
  for each row execute function enforce_attempt_limit();

-- Какие модули пользователь проходил в рамках сессии
create table session_modules (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references test_sessions(id) on delete cascade,
  skill text not null check (skill in ('reading','listening')),
  module_id uuid not null references modules(id),
  stage int not null check (stage between 1 and 3),
  started_at timestamptz not null default now(),
  unique (session_id, skill, stage)
);
create index on session_modules (module_id);

-- Ответы: уникальность гарантирует идемпотентность повторной отправки
create table responses (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references test_sessions(id) on delete cascade,
  item_id uuid not null references items(id),
  answer jsonb not null,
  is_correct boolean not null,
  time_ms int check (time_ms >= 0),
  answered_at timestamptz not null default now(),
  unique (session_id, item_id)
);
create index on responses (item_id);

-- Результат по навыку
create table results (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references test_sessions(id) on delete cascade,
  skill text not null check (skill in ('reading','listening')),
  theta double precision not null,
  se double precision not null,
  score_0_100 int not null check (score_0_100 between 0 and 100),
  cefr_level text not null check (cefr_level in ('pre-A1','A1','A2','B1','B2','C1','C2')),
  calibration_id uuid not null references calibrations(id),
  created_at timestamptz not null default now(),
  unique (session_id, skill)
);
create index on results (calibration_id);

-- Публичная ссылка на результат. Токен длинный и случайный, один актуальный на пользователя.
create table certificates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references profiles(id) on delete cascade,
  session_id uuid not null references test_sessions(id),
  public_token text not null unique default encode(gen_random_bytes(16), 'hex'),
  is_public boolean not null default true,
  issued_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on certificates (session_id);

-- Журнал событий для антифрода (смена вкладки, копирование, таймер)
create table session_events (
  id bigint generated always as identity primary key,
  session_id uuid not null references test_sessions(id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index on session_events (session_id, created_at);

-- Права доступа
alter table profiles enable row level security;
alter table test_sessions enable row level security;
alter table session_modules enable row level security;
alter table responses enable row level security;
alter table results enable row level security;
alter table certificates enable row level security;
alter table session_events enable row level security;
alter table items enable row level security;           -- без политик: клиенту недоступно
alter table item_difficulty enable row level security;
alter table module_items enable row level security;
alter table modules enable row level security;
alter table panels enable row level security;
alter table routing_rules enable row level security;
alter table cut_scores enable row level security;
alter table calibrations enable row level security;
alter table content_sources enable row level security;

create policy own_profile on profiles for select using (id = auth.uid());
create policy own_profile_update on profiles for update using (id = auth.uid());
create policy own_sessions on test_sessions for select using (user_id = auth.uid());
create policy own_results on results for select using (
  session_id in (select id from test_sessions where user_id = auth.uid())
);
create policy own_certificate on certificates for select using (user_id = auth.uid());
-- Публичное чтение сертификата идёт через серверный маршрут по public_token, не через RLS.
-- Запись во все таблицы теста — только серверным ключом (service role).
