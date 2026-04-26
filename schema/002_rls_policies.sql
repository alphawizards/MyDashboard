-- Row-level security — single-user mode
-- Authenticated users: read everything.
-- Service role (cron worker): writes everything. Bypasses RLS automatically.
-- Anon: no access.

alter table watchlist             enable row level security;
alter table quotes                enable row level security;
alter table polymarket_markets    enable row level security;
alter table tweets                enable row level security;
alter table refresh_runs          enable row level security;

create policy "auth read watchlist"          on watchlist          for select to authenticated using (true);
create policy "auth read quotes"             on quotes             for select to authenticated using (true);
create policy "auth read polymarket"         on polymarket_markets for select to authenticated using (true);
create policy "auth read tweets"             on tweets             for select to authenticated using (true);
create policy "auth read refresh_runs"       on refresh_runs       for select to authenticated using (true);

-- Authenticated UI writes: only watchlist metadata edits (catalyst, price_target, priority, notes, sort_order).
-- Ticker changes go through a migration, not the UI.
create policy "auth update watchlist metadata"
  on watchlist for update to authenticated
  using (true)
  with check (true);
