-- Coolshi schema (spec §6)
-- Paste into Supabase SQL editor after creating a free-tier project.

create extension if not exists vector;

create table briefs (
  id uuid primary key default gen_random_uuid(),
  content text,
  anchor_articles jsonb,
  is_active boolean default true,
  location text,
  international_scope smallint check (international_scope between 0 and 100),
  recency_days smallint check (recency_days between 0 and 100),
  expertise_level smallint check (expertise_level between 0 and 100),
  interests text,
  preferences text,
  must_not_miss text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table sources (
  id uuid primary key default gen_random_uuid(),
  source_type text not null,
  source_tier text check (source_tier in ('A','B','C','D')),
  name text not null,
  config jsonb not null,
  is_active boolean default true,
  last_fetched_at timestamptz,
  last_error text,
  created_at timestamptz default now()
);

create table raw_items (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references sources(id),
  source_tier text,
  url text not null,
  title text,
  content text,
  author text,
  published_at timestamptz,
  raw_metadata jsonb,
  processed_in_batch text,
  embedding vector(1024),
  created_at timestamptz default now()
);

create unique index raw_items_url_uniq on raw_items(url);
create index raw_items_unprocessed_idx on raw_items(processed_in_batch)
  where processed_in_batch is null;

create table feed_cards (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(title) <= 100),
  synthesis text not null check (length(synthesis) <= 400),
  long_form text,
  sources jsonb not null,
  divergence_notes text,
  tags text[],
  card_type text check (card_type in ('news','deep_dive')) default 'news',
  importance_score int check (importance_score between 1 and 10),
  batch_id text not null,
  hero_image_url text,
  embedding vector(1024),
  created_at timestamptz default now()
);

create index feed_cards_batch_idx on feed_cards(batch_id);
create index feed_cards_created_at_idx on feed_cards(created_at desc);

create table feedback (
  id uuid primary key default gen_random_uuid(),
  card_id uuid references feed_cards(id) on delete cascade,
  signal text check (signal in ('like','dislike','neutral','skip')),
  dwell_ms int,
  created_at timestamptz default now()
);

create index feedback_card_idx on feedback(card_id);

create table saved_cards (
  card_id uuid primary key references feed_cards(id) on delete cascade,
  saved_at timestamptz not null default now()
);

create table manual_batch_jobs (
  id uuid primary key default gen_random_uuid(),
  requested_for_date date not null default (timezone('Europe/Brussels', now()))::date,
  requested_at timestamptz not null default now(),
  status text not null default 'in_progress'
    check (status in ('in_progress','completed','failed')),
  batch_id text,
  error_message text,
  completed_at timestamptz
);
create unique index manual_batch_jobs_daily_quota
  on manual_batch_jobs(requested_for_date);

create table agent_runs (
  id uuid primary key default gen_random_uuid(),
  batch_id text not null unique,
  topics_covered text[],
  sources_consulted text[],
  raw_items_ingested int,
  findings jsonb,
  cards_produced int,
  tokens_used int,
  started_at timestamptz default now(),
  ended_at timestamptz
);
