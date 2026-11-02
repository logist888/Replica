-- Схема пилота. Без имён, почты и IP. Идемпотентна.
create extension if not exists pgcrypto;

create table if not exists participants (
  id uuid primary key default gen_random_uuid(),
  cookie_id text,                                  -- случайный идентификатор браузера, для отсева повторов
  consent_at timestamptz not null default now(),
  age_confirmed_16 boolean not null,
  native_language text,
  years_learning int check (years_learning is null or years_learning between 0 and 80),
  self_level text check (self_level is null or self_level in ('A1','A2','B1','B2','C1','C2','unknown')),
  ext_test text check (ext_test is null or ext_test in ('ielts','toefl','cambridge','duolingo','toeic','other')),
  ext_score text,
  created_at timestamptz not null default now()
);
create index if not exists participants_cookie_idx on participants (cookie_id);

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  participant_id uuid not null references participants(id) on delete cascade,
  status text not null default 'vocab' check (status in ('vocab','reading','done')),
  form jsonb not null default '{}',                -- ответы с ключами лежат только здесь, клиенту не отдаются
  results jsonb,
  user_agent text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists sessions_participant_idx on sessions (participant_id);

create table if not exists responses (
  id bigint generated always as identity primary key,
  session_id uuid not null references sessions(id) on delete cascade,
  part text not null check (part in ('vocab','reading')),
  item_id text not null,
  answer text not null,
  is_correct boolean not null,
  time_ms int check (time_ms is null or time_ms >= 0),
  answered_at timestamptz not null default now(),
  unique (session_id, item_id)
);
create index if not exists responses_item_idx on responses (item_id);

-- Часть 3 (аудирование): расширяем допустимые значения. Идемпотентно.
alter table sessions drop constraint if exists sessions_status_check;
alter table sessions add constraint sessions_status_check check (status in ('vocab','reading','listening','done'));
alter table responses drop constraint if exists responses_part_check;
alter table responses add constraint responses_part_check check (part in ('vocab','reading','listening'));
