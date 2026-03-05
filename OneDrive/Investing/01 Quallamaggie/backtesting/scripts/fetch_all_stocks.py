import sys
import os
import requests
import time
from pathlib import Path
from loguru import logger
from datetime import datetime
import pandas as pd
import polars as pl

# Add the project root to sys.path
sys.path.append(str(Path(__file__).parent.parent))

def get_all_active_tickers():
    api_key = os.environ.get("APCA_API_KEY_ID", "PKAA2IQTT63RGOLMEOXRNDWKB2")
    secret_key = os.environ.get("APCA_API_SECRET_KEY", "9Zvr9Xt3d3d2rdRRi7dtZSkvEdhVKVZf8Pkk2NC3xVPv")
    
    headers = {
        "accept": "application/json",
        "APCA-API-KEY-ID": api_key,
        "APCA-API-SECRET-KEY": secret_key
    }
    
    url = "https://paper-api.alpaca.markets/v2/assets"
    params = {
        "status": "active",
        "asset_class": "us_equity"
    }
    
    res = requests.get(url, headers=headers, params=params)
    res.raise_for_status()
    
    assets = res.json()
    tickers = []
    for asset in assets:
        if asset.get('tradable') and asset.get('fractionable') is not None:
            tickers.append(asset['symbol'])
            
    return sorted(tickers)

def main():
    BASE_DIR = Path(__file__).parent.parent
    DATA_DIR = BASE_DIR / "data"
    
    CHUNKS_DIR = DATA_DIR / "raw" / "alpaca_chunks"
    os.makedirs(CHUNKS_DIR, exist_ok=True)
    os.makedirs(DATA_DIR / "processed", exist_ok=True)

    logger.info("=== FETCHING MAXIMUM HISTORY FOR ALL ACTIVE STOCKS (OPTIMIZED) ===")
    
    api_key = os.environ.get("APCA_API_KEY_ID", "PKAA2IQTT63RGOLMEOXRNDWKB2")
    secret_key = os.environ.get("APCA_API_SECRET_KEY", "9Zvr9Xt3d3d2rdRRi7dtZSkvEdhVKVZf8Pkk2NC3xVPv")
    headers = {
        "accept": "application/json",
        "APCA-API-KEY-ID": api_key,
        "APCA-API-SECRET-KEY": secret_key
    }
    
    start_date = "2016-01-01T00:00:00Z"
    end_date = f"{datetime.today().strftime('%Y-%m-%d')}T23:59:59Z"
    
    tickers = get_all_active_tickers()
    logger.info(f"Found {len(tickers)} active tradeable tickers.")
    
    chunk_size = 100 
    url = "https://data.alpaca.markets/v2/stocks/bars"

    for i in range(0, len(tickers), chunk_size):
        chunk = tickers[i:i + chunk_size]
        chunk_idx = i // chunk_size + 1
        
        out_path = CHUNKS_DIR / f"chunk_{chunk_idx:04d}.parquet"
        if out_path.exists():
            logger.info(f"Chunk {chunk_idx} already exists. Skipping.")
            continue
            
        logger.info(f"Fetching chunk {chunk_idx}: {chunk[0]} - {chunk[-1]}")
        
        all_bars_data = []
        params = {
            "symbols": ",".join(chunk),
            "timeframe": "1Day",
            "start": start_date,
            "end": end_date,
            "limit": 10000,
            "adjustment": "all",
            "feed": "iex"
        }
        
        while True:
            try:
                res = requests.get(url, headers=headers, params=params, timeout=15)
                
                if res.status_code == 429:
                    logger.warning("Alpaca rate limit hit. Sleeping for 30s...")
                    time.sleep(30)
                    continue
                    
                if res.status_code != 200:
                    logger.error(f"Alpaca API error: {res.status_code} - {res.text}")
                    break
                    
                data = res.json()
                
                if 'bars' in data and data['bars']:
                    for ticker, bars_list in data['bars'].items():
                        for b in bars_list:
                            all_bars_data.append({
                                'ticker': ticker,
                                'date': b['t'][:10], # Keep as string slice to save memory, convert later
                                'open': b['o'],
                                'high': b['h'],
                                'low': b['l'],
                                'close': b['c'],
                                'volume': b['v'],
                                'vwap': b.get('vw', b['c'])
                            })
                            
                next_token = data.get('next_page_token')
                if next_token:
                    params['page_token'] = next_token
                else:
                    break
                    
            except Exception as e:
                logger.error(f"Failed to fetch data for chunk {chunk[0]}... - {e}")
                time.sleep(5)
                # Don't break immediately, could implement a retry, but let's just break for simplicity right now
                break
                
            # Add a slight delay between pagination to respect rate limits
            time.sleep(0.35)

        if all_bars_data:
            # Convert to DataFrame and save to Parquet
            df = pd.DataFrame(all_bars_data)
            df['date'] = pd.to_datetime(df['date'])
            df_pl = pl.from_pandas(df)
            df_pl.write_parquet(out_path)
            logger.success(f"Saved {out_path.name} with {len(df_pl)} rows.")
        
        # Respect overall 200 requests/minute (10000 per 50 min) limit 
        # But we only make 1 initial request + pagination requests.
        # Just to be safe:
        time.sleep(0.35)

    # After all chunks are processed, combine them into one file using Polars
    logger.info("Combining all Parquet chunks...")
    try:
        combined_path = DATA_DIR / "processed" / "historical_bars.parquet"
        df_combined = pl.read_parquet(CHUNKS_DIR / "*.parquet")
        df_combined.write_parquet(combined_path)
        logger.success(f"Successfully created combined historical_bars.parquet ({len(df_combined)} rows)!")
    except Exception as e:
        logger.error(f"Failed to combine parquet files: {e}")

if __name__ == "__main__":
    main()
