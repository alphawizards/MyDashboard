-- X account stock-pick tracker cache tables.
-- Apply after 001_initial.sql.

create table if not exists tracked_accounts (
  key                 text primary key,
  slug                text not null unique,
  handle              text not null unique,
  name                text not null,
  short_name          text not null,
  color               text not null,
  bio                 text not null default '',
  followers           text not null default 'N/A',
  avatar              text,
  platform            text not null default 'X',
  win_rate            int,
  shadow_score        int,
  rank_source         text,
  author_id           text,
  active              boolean not null default true,
  last_tweet_id       text,
  last_refreshed_at   timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table tweets add column if not exists author_key text;
alter table tweets add column if not exists like_count int not null default 0;
alter table tweets add column if not exists retweet_count int not null default 0;
alter table tweets add column if not exists reply_count int not null default 0;
alter table tweets add column if not exists cashtags jsonb not null default '[]'::jsonb;

create index if not exists tweets_author_key_posted_idx on tweets (author_key, posted_at desc);

create table if not exists ticker_profiles (
  ticker      text primary key,
  company     text not null,
  sector      text,
  industry    text,
  theme       text not null,
  fetched_at  timestamptz not null default now()
);

create table if not exists ticker_performance_snapshots (
  ticker      text primary key references ticker_profiles(ticker) on delete cascade,
  perf_1m     numeric,
  perf_12m    numeric,
  fetched_at  timestamptz not null default now()
);
