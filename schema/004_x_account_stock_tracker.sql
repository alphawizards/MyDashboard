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

create table if not exists tweet_ticker_mentions (
  tweet_id       text not null references tweets(id) on delete cascade,
  author_key     text not null,
  ticker         text not null,
  mention_count  int not null default 1,
  posted_at      timestamptz not null,
  first_seen_at  timestamptz not null default now(),
  primary key (tweet_id, ticker)
);

create index if not exists tweet_ticker_mentions_ticker_idx on tweet_ticker_mentions (ticker);
create index if not exists tweet_ticker_mentions_author_ticker_idx on tweet_ticker_mentions (author_key, ticker);
create index if not exists tweet_ticker_mentions_ticker_posted_idx on tweet_ticker_mentions (ticker, posted_at desc);

create table if not exists x_refresh_runs (
  id                bigserial primary key,
  request_id        text not null,
  triggered_by      text not null default 'unknown',
  started_at        timestamptz not null default now(),
  finished_at       timestamptz,
  ok                boolean,
  mode              text,
  message           text,
  total_new_tweets  int not null default 0,
  diagnostics       jsonb
);

create index if not exists x_refresh_runs_started_idx on x_refresh_runs (started_at desc);
create index if not exists x_refresh_runs_request_idx on x_refresh_runs (request_id);

create table if not exists x_account_refresh_events (
  id                      bigserial primary key,
  refresh_run_id          bigint not null references x_refresh_runs(id) on delete cascade,
  author_key              text not null,
  handle                  text not null,
  previous_last_tweet_id  text,
  new_last_tweet_id       text,
  new_tweet_count         int not null default 0,
  new_tweet_ids           jsonb not null default '[]'::jsonb,
  new_tickers             jsonb not null default '[]'::jsonb,
  status                  text not null,
  error                   text,
  created_at              timestamptz not null default now()
);

create index if not exists x_account_refresh_events_run_idx on x_account_refresh_events (refresh_run_id);
create index if not exists x_account_refresh_events_author_created_idx on x_account_refresh_events (author_key, created_at desc);

insert into tweet_ticker_mentions (tweet_id, author_key, ticker, mention_count, posted_at, first_seen_at)
select distinct on (t.id, normalized.ticker)
  t.id,
  t.author_key,
  normalized.ticker,
  1,
  t.posted_at,
  t.fetched_at
from tweets t
cross join lateral (
  select upper(regexp_replace(tag.value, '^\$', '')) as ticker
  from jsonb_array_elements_text(t.cashtags) as tag(value)
) normalized
where t.author_key is not null
  and normalized.ticker <> ''
on conflict (tweet_id, ticker) do nothing;

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
