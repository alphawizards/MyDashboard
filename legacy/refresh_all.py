#!/usr/bin/env python3
"""
Morning Dashboard Refresh — refresh_all.py

Fetches fresh stock data, Polymarket odds, and tweets,
then injects them into the HTML dashboard files.
Preserves your manually-set catalyst notes, targets, and priorities.

Usage:
  python refresh_all.py            # full refresh (stocks + poly + tweets)
  python refresh_all.py --stocks   # stocks only
  python refresh_all.py --poly     # polymarket only
  python refresh_all.py --tweets   # tweets only

Requirements:
  pip install yfinance requests
"""

import json, re, sys, time
import requests
from datetime import datetime, timedelta
from pathlib import Path

try:
    import yfinance as yf
except ImportError:
    sys.exit("Missing dep. Run: pip install yfinance requests")

try:
    from zoneinfo import ZoneInfo
    AEST = ZoneInfo("Australia/Sydney")
    def now_aest():
        return datetime.now(AEST).strftime("%Y-%m-%d %H:%M AEST")
except ImportError:
    def now_aest():  # Python < 3.9 fallback (UTC+10)
        return (datetime.utcnow() + timedelta(hours=10)).strftime("%Y-%m-%d %H:%M AEST")

# ── CONFIG ────────────────────────────────────────────────────────────────────
CFG_PATH = Path(__file__).parent / "config.json"
try:
    with open(CFG_PATH) as f:
        cfg = json.load(f)
except FileNotFoundError:
    sys.exit(f"config.json not found at {CFG_PATH}")

OUT_DIR   = Path(cfg["output_dir"])
if not OUT_DIR.exists():
    OUT_DIR = Path(__file__).parent  # fallback when running in Claude's sandbox
    print(f"  ⚠ Output dir not found, writing to {OUT_DIR}")

BEARER   = cfg["twitter_bearer_token"]
TICKERS  = cfg["stocks"]
TW_USERS = cfg["twitter_users"]
POLY_CFG = cfg["polymarket"]

args      = set(sys.argv[1:])
do_stocks = not args or "--stocks" in args
do_poly   = not args or "--poly"   in args
do_tweets = not args or "--tweets" in args

print(f"\n🌅 Dashboard Refresh — {now_aest()}\n")

# ── 1. STOCKS ─────────────────────────────────────────────────────────────────
new_stocks = []

if do_stocks:
    print("📈 Fetching stock data...")

    def fetch_one(ticker):
        try:
            t    = yf.Ticker(ticker)
            info = t.info
            hist = t.history(period="6mo")

            price      = float(info.get("currentPrice") or info.get("regularMarketPrice") or 0)
            prev_close = float(info.get("previousClose") or info.get("regularMarketPreviousClose") or 0)
            change     = ((price - prev_close) / prev_close * 100) if prev_close else 0

            perf = {"perf1M": None, "perf3M": None, "perf6M": None}
            if len(hist) >= 5:
                close = hist["Close"]
                curr  = float(close.iloc[-1])
                idx   = close.index.tz_localize(None) if close.index.tz else close.index
                now   = datetime.now()
                for days, key in [(30, "perf1M"), (90, "perf3M"), (180, "perf6M")]:
                    past = close[idx <= now - timedelta(days=days)]
                    if len(past):
                        perf[key] = round((curr - float(past.iloc[-1])) / float(past.iloc[-1]) * 100, 2)

            return {
                "company":      info.get("longName", ticker),
                "exchange":     info.get("exchange", "NASDAQ"),
                "price":        round(price, 2),
                "change":       round(change, 2),
                "prevClose":    round(prev_close, 2),
                "open":         round(float(info.get("open") or 0), 2),
                "dayHigh":      round(float(info.get("dayHigh") or 0), 2),
                "dayLow":       round(float(info.get("dayLow") or 0), 2),
                "fiftyTwoHigh": round(float(info.get("fiftyTwoWeekHigh") or 0), 2),
                "fiftyTwoLow":  round(float(info.get("fiftyTwoWeekLow") or 0), 2),
                "volume":       int(info.get("volume") or 0),
                "avgVolume":    int(info.get("averageVolume10days") or info.get("averageVolume") or 0),
                "marketCap":    int(info.get("marketCap") or 0),
                "sector":       info.get("sector", ""),
                **perf,
            }
        except Exception as e:
            print(f"    ✗ {ticker}: {e}")
            return None

    # Read existing HTML to preserve user metadata (catalyst, target, priority)
    watchlist_path = OUT_DIR / "morning-watchlist.html"
    watchlist_html = watchlist_path.read_text(encoding="utf-8")

    # Parse the existing JS object-literal array directly (not JSON — keys are
    # unquoted). Extract catalyst / target / priority per ticker so they're
    # preserved across refreshes. If any ticker fails to parse, leave existing
    # data untouched AND abort the refresh — silent metadata loss is worse than
    # a loud failure.
    existing_meta = {}
    block = re.search(
        r'const defaultStocks = (\[[\s\S]*?\]);(?=\s*\nfunction init)',
        watchlist_html,
    )
    if block:
        entry_re = re.compile(
            r'\{\s*ticker:\s*"(?P<ticker>[^"]+)"[\s\S]*?\}',
        )
        field_re = {
            "catalyst": re.compile(r'catalyst:\s*"((?:[^"\\]|\\.)*)"'),
            "target":   re.compile(r'target:\s*([0-9.]+)'),
            "priority": re.compile(r'priority:\s*"([^"]+)"'),
        }
        for entry in entry_re.finditer(block.group(1)):
            ticker = entry.group("ticker")
            text = entry.group(0)
            cat = field_re["catalyst"].search(text)
            tgt = field_re["target"].search(text)
            pri = field_re["priority"].search(text)
            existing_meta[ticker] = {
                "catalyst": cat.group(1) if cat else "",
                "target":   float(tgt.group(1)) if tgt else 0,
                "priority": pri.group(1) if pri else "medium",
            }
        if not existing_meta:
            sys.exit(
                "  ✗ Refusing to refresh: could not extract any existing stock "
                "metadata. Investigate before running again (metadata loss risk)."
            )
    else:
        print("  ⚠ No existing defaultStocks block found — treating as first run")

    for ticker in TICKERS:
        print(f"  {ticker}...", end=" ", flush=True)
        data = fetch_one(ticker)
        if data:
            meta = existing_meta.get(ticker, {})
            new_stocks.append({
                "ticker":      ticker,
                "company":     data.get("company", ticker),
                "exchange":    data.get("exchange", "NASDAQ"),
                "price":       data.get("price", 0),
                "change":      data.get("change", 0),
                "prevClose":   data.get("prevClose", 0),
                "open":        data.get("open", 0),
                "dayHigh":     data.get("dayHigh", 0),
                "dayLow":      data.get("dayLow", 0),
                "fiftyTwoHigh":data.get("fiftyTwoHigh", 0),
                "fiftyTwoLow": data.get("fiftyTwoLow", 0),
                "volume":      data.get("volume", 0),
                "avgVolume":   data.get("avgVolume", 0),
                "marketCap":   data.get("marketCap", 0),
                "sector":      data.get("sector", ""),
                "target":      meta.get("target", 0),
                "perf1M":      data.get("perf1M"),
                "perf3M":      data.get("perf3M"),
                "perf6M":      data.get("perf6M"),
                "catalyst":    meta.get("catalyst", ""),
                "priority":    meta.get("priority", "medium"),
            })
            print(f"${data['price']} ({data['change']:+.2f}%)")
        time.sleep(0.3)

# ── 2. POLYMARKET ─────────────────────────────────────────────────────────────
ndx_slug = ndx_up_token = ndx_dn_token = None
ndx_up_price = rec_yes_price = None
spx_prices = []

if do_poly:
    print("\n🎲 Fetching Polymarket data...")

    GAMMA = "https://gamma-api.polymarket.com"
    CLOB  = "https://clob.polymarket.com"

    def clob_midpoint(token_id):
        try:
            r = requests.get(f"{CLOB}/book?token_id={token_id}", timeout=10)
            d = r.json()
            bids = d.get("bids", [])
            asks = d.get("asks", [])
            best_bid = max((float(b["price"]) for b in bids), default=None)
            best_ask = min((float(a["price"]) for a in asks), default=None)
            if best_bid is not None and best_ask is not None:
                return (best_bid + best_ask) / 2
        except Exception as e:
            print(f"    CLOB error: {e}")
        return None

    def get_ndx_today():
        """Auto-detect today's (or next trading day's) NDX daily market."""
        try:
            from zoneinfo import ZoneInfo
            now_dt = datetime.now(ZoneInfo("Australia/Sydney"))
        except ImportError:
            now_dt = datetime.utcnow() + timedelta(hours=10)
        for delta in range(5):
            candidate = now_dt + timedelta(days=delta)
            if candidate.weekday() >= 5:  # skip weekends
                continue
            slug = "ndx-up-or-down-on-{}-{}-{}".format(
                candidate.strftime("%B").lower(), candidate.day, candidate.year
            )
            try:
                r = requests.get(f"{GAMMA}/markets?slug={slug}", timeout=10)
                markets = r.json()
                if markets:
                    tokens = markets[0].get("tokens", [])
                    up = next((t["token_id"] for t in tokens if "Up"   in t.get("outcome", "")), None)
                    dn = next((t["token_id"] for t in tokens if "Down" in t.get("outcome", "")), None)
                    if up and dn:
                        print(f"  NDX market: {slug}")
                        return slug, up, dn
            except Exception as e:
                print(f"  Gamma error ({slug}): {e}")
        return None, None, None

    ndx_slug, ndx_up_token, ndx_dn_token = get_ndx_today()

    if ndx_up_token:
        ndx_up_price = clob_midpoint(ndx_up_token)
        print(f"  NDX: {round(ndx_up_price * 100)}% up" if ndx_up_price else "  NDX: fetch failed")

    rec_yes_price = clob_midpoint(POLY_CFG["recession"]["yes_token"])
    if rec_yes_price:
        print(f"  Recession: {round(rec_yes_price * 100)}% yes")

    for bucket in POLY_CFG["spx"]:
        p = clob_midpoint(bucket["token"])
        spx_prices.append(round(p, 4) if p else 0)
        time.sleep(0.1)

poly_fetched = now_aest()

# ── 3. TWEETS ─────────────────────────────────────────────────────────────────
sikand_tweets = []
wolff_tweets  = []

if do_tweets:
    print("\n🐦 Fetching tweets...")

    TW_BASE = "https://api.twitter.com/2"
    TW_HDR  = {"Authorization": f"Bearer {BEARER}"}
    TW_FLDS = "id,text,created_at,public_metrics,entities"

    def fmt_time(created_at):
        try:
            dt      = datetime.strptime(created_at, "%Y-%m-%dT%H:%M:%S.%fZ")
            dt_aest = dt + timedelta(hours=10)
            return f"{dt_aest.strftime('%b')} {dt_aest.day}, {dt_aest.strftime('%H:%M')} AEST"
        except Exception:
            return created_at

    def fetch_tweets(user_id, handle, max_results=20):
        results = []
        try:
            r = requests.get(
                f"{TW_BASE}/users/{user_id}/tweets",
                headers=TW_HDR,
                params={"max_results": max_results, "tweet.fields": TW_FLDS},
                timeout=15,
            )
            if r.status_code != 200:
                print(f"  ✗ @{handle}: HTTP {r.status_code} — {r.text[:120]}")
                return []
            for tw in r.json().get("data", []):
                m = tw.get("public_metrics", {})
                cashtags = [f"${c['tag'].upper()}" for c in tw.get("entities", {}).get("cashtags", [])]
                results.append({
                    "id":         tw["id"],
                    "text":       tw["text"],
                    "created_at": fmt_time(tw.get("created_at", "")),
                    "likes":      m.get("like_count", 0),
                    "retweets":   m.get("retweet_count", 0),
                    "replies":    m.get("reply_count", 0),
                    "cashtags":   cashtags,
                    "url":        f"https://x.com/{handle}/status/{tw['id']}",
                })
            print(f"  ✓ @{handle}: {len(results)} tweets")
        except Exception as e:
            print(f"  ✗ @{handle}: {e}")
        return results

    sikand_tweets = fetch_tweets(TW_USERS["michaelsikand"], "michaelsikand")
    wolff_tweets  = fetch_tweets(TW_USERS["peterjwolff"],   "peterjwolff")

tw_fetched = now_aest()

# ── 4. INJECT INTO HTML ───────────────────────────────────────────────────────
print("\n📝 Updating HTML files...")

def to_js(v):
    if v is None:           return "null"
    if isinstance(v, bool): return "true" if v else "false"
    if isinstance(v, str):  return json.dumps(v, ensure_ascii=False)
    return str(v)

def stocks_to_js(stocks):
    keys = ["ticker","company","exchange","price","change","prevClose","open",
            "dayHigh","dayLow","fiftyTwoHigh","fiftyTwoLow","volume","avgVolume",
            "marketCap","sector","target","perf1M","perf3M","perf6M","catalyst","priority"]
    rows = ["  { " + ", ".join(f"{k}: {to_js(s.get(k))}" for k in keys if k in s) + " }"
            for s in stocks]
    return "[\n" + ",\n".join(rows) + "\n]"

def poly_to_js():
    up_p  = round(ndx_up_price, 4)       if ndx_up_price  else 0.5
    dn_p  = round(1 - ndx_up_price, 4)   if ndx_up_price  else 0.5
    yes_p = round(rec_yes_price, 4)       if rec_yes_price else 0.265
    no_p  = round(1 - rec_yes_price, 4)  if rec_yes_price else 0.735

    spx_items = []
    for i, b in enumerate(POLY_CFG["spx"]):
        p = spx_prices[i] if i < len(spx_prices) else 0
        spx_items.append(
            f'    {{ label: {json.dumps(b["label"])}, token: "{b["token"]}", price: "{p}" }}'
        )
    spx_js = "[\n" + ",\n".join(spx_items) + "\n  ]"

    return (
        f'{{\n'
        f'  ndx: {{\n'
        f'    slug: "{ndx_slug or ""}",\n'
        f'    upToken:   "{ndx_up_token or ""}",\n'
        f'    downToken: "{ndx_dn_token or ""}",\n'
        f'    upPrice: "{up_p}", downPrice: "{dn_p}"\n'
        f'  }},\n'
        f'  recession: {{\n'
        f'    yesToken: "{POLY_CFG["recession"]["yes_token"]}",\n'
        f'    noToken:  "{POLY_CFG["recession"]["no_token"]}",\n'
        f'    yesPrice: "{yes_p}", noPrice: "{no_p}"\n'
        f'  }},\n'
        f'  spx: {spx_js},\n'
        f'  fetched: "{poly_fetched}"\n'
        f'}}'
    )

# ── Update morning-watchlist.html ─────────────────────────────────────────────
watchlist_path = OUT_DIR / "morning-watchlist.html"
html = watchlist_path.read_text(encoding="utf-8")

if do_stocks and new_stocks:
    # re.sub processes backslash escapes in the replacement string (\n, \t,
    # \1..\99, \g<name>). External data injected verbatim WILL trip this —
    # e.g. json.dumps emits \n for a newline, re.sub converts it back to a
    # real newline inside a JS string literal, and the file no longer parses.
    # Wrap replacements in a lambda to pass them through untouched.
    new_last_refresh = f'const LAST_REFRESH = "{now_aest()}";'
    html = re.sub(
        r'const LAST_REFRESH = ".*?";',
        lambda _m: new_last_refresh,
        html
    )
    new_default_stocks = f'const defaultStocks = {stocks_to_js(new_stocks)};'
    html = re.sub(
        r'const defaultStocks = \[[\s\S]*?\];(?=\s*\nfunction init)',
        lambda _m: new_default_stocks,
        html
    )
    print("  ✓ Stocks injected")

if do_poly and ndx_slug:
    new_poly_data = f'const POLY_DATA = {poly_to_js()};'
    html = re.sub(
        r'const POLY_DATA = \{[\s\S]*?\};(?=\s*\n// Compute midpoint)',
        lambda _m: new_poly_data,
        html
    )
    print("  ✓ Polymarket injected")

watchlist_path.write_text(html, encoding="utf-8")
print("  ✓ morning-watchlist.html saved")

# ── Update sikand-feed.html ───────────────────────────────────────────────────
if do_tweets and (sikand_tweets or wolff_tweets):
    feed_path = OUT_DIR / "sikand-feed.html"
    feed = feed_path.read_text(encoding="utf-8")

    if sikand_tweets:
        sikand_block = f'const SIKAND_TWEETS = {json.dumps(sikand_tweets, indent=2, ensure_ascii=False)};'
        feed = re.sub(
            r'const SIKAND_TWEETS = \[[\s\S]*?\];(?=\s*\nconst WOLFF_TWEETS)',
            lambda _m: sikand_block,
            feed
        )

    if wolff_tweets:
        wolff_block = f'const WOLFF_TWEETS = {json.dumps(wolff_tweets, indent=2, ensure_ascii=False)};'
        feed = re.sub(
            r'const WOLFF_TWEETS = \[[\s\S]*?\];(?=\s*\n// ── STATE)',
            lambda _m: wolff_block,
            feed
        )

    new_fetched = f'Fetched {tw_fetched}'
    feed = re.sub(
        r'Fetched \d{4}-\d{2}-\d{2} \d{2}:\d{2} AEST',
        lambda _m: new_fetched,
        feed
    )

    feed_path.write_text(feed, encoding="utf-8")
    print("  ✓ sikand-feed.html saved")

print(f"\n✅ Refresh complete — {now_aest()}")
print(f"   Dashboard: {OUT_DIR / 'morning-watchlist.html'}")
