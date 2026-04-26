-- Morning Dashboard — initial schema
-- Single-user mode: no user_id column, no per-user RLS. Add if multi-user ever becomes a real need.

create table watchlist (
  ticker       text primary key,
  exchange     text,
  catalyst     text,
  price_target numeric,
  priority     int,
  notes        text,
  sort_order   int,
  updated_at   timestamptz not null default now()
);

create table quotes (
  ticker        text primary key references watchlist(ticker) on delete cascade,
  price         numeric,
  change_pct    numeric,
  volume        bigint,
  avg_vol_10d   bigint,
  market_cap    numeric,
  day_range     text,
  fetched_at    timestamptz not null default now()
);

create table polymarket_markets (
  slug              text primary key,
  title             text not null,
  kind              text not null check (kind in ('ndx_daily','recession_2026','spx_yearend_2026')),
  token_yes         text,
  token_no          text,
  auto_detect       boolean not null default false,
  detected_for_date date
);

create table tweets (
  id            text primary key,
  author_handle text not null,
  author_id     text not null,
  posted_at     timestamptz not null,
  text          text not null,
  url           text not null,
  fetched_at    timestamptz not null default now()
);
create index tweets_author_posted_idx on tweets (author_handle, posted_at desc);

create table refresh_runs (
  id          bigserial primary key,
  kind        text not null check (kind in ('stocks','poly','tweets','all')),
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  ok          boolean,
  error       text
);
