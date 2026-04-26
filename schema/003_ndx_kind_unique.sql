-- Add unique constraint on polymarket_markets.kind so the refresh worker can
-- safely update NDX daily tokens using .eq('kind', 'ndx_daily') without risk
-- of matching multiple rows if a duplicate were ever inserted.
alter table polymarket_markets add constraint polymarket_markets_kind_unique unique (kind);
