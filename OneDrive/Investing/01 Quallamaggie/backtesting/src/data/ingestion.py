import pandas as pd
import polars as pl
from pathlib import Path
from loguru import logger
import os
import requests
import time

class DataPipeline:
    def __init__(self, raw_dir: Path, processed_dir: Path):
        self.raw_dir = Path(raw_dir)
        self.processed_dir = Path(processed_dir)
        
        os.makedirs(self.raw_dir, exist_ok=True)
        os.makedirs(self.processed_dir, exist_ok=True)

    def ingest_daily_bars(self, tickers: list[str], start_date: str, end_date: str):
        """
        Fetches adjusted daily OHLCV bars using Alpaca Market Data API.
        Automatically backoffs on rate limits and handles pagination.
        """
        logger.info(f"Downloading data for {len(tickers)} tickers from {start_date} to {end_date} via Alpaca...")
        
        # Pull API keys from environment
        # Fallback to the provided keys only if absolutely necessary (Warning: Never commit secrets)
        api_key = os.environ.get("APCA_API_KEY_ID", "PKAA2IQTT63RGOLMEOXRNDWKB2")
        secret_key = os.environ.get("APCA_API_SECRET_KEY", "9Zvr9Xt3d3d2rdRRi7dtZSkvEdhVKVZf8Pkk2NC3xVPv")
        
        if not api_key or not secret_key:
            logger.error("Alpaca API keys are missing. Please set them in your environment variables.")
            return

        headers = {
            "accept": "application/json",
            "APCA-API-KEY-ID": api_key,
            "APCA-API-SECRET-KEY": secret_key
        }

        # Alpaca expects dates in RFC3339 format, e.g. 2020-01-01T00:00:00Z
        start_dt = f"{start_date}T00:00:00Z"
        end_dt = f"{end_date}T23:59:59Z"
        
        url = "https://data.alpaca.markets/v2/stocks/bars"
        
        # Alpaca limit per request is normally 10,000 items in response. 
        # Chunk the tickers to manage payload sizes safely.
        chunk_size = 100 
        all_bars_data = []

        for i in range(0, len(tickers), chunk_size):
            chunk = tickers[i:i + chunk_size]
            
            logger.info(f"Fetching chunk {i//chunk_size + 1}/{max(1, (len(tickers) - 1)//chunk_size + 1)}: {chunk[0]} - {chunk[-1]}")
            
            params = {
                "symbols": ",".join(chunk),
                "timeframe": "1Day",
                "start": start_dt,
                "end": end_dt,
                "limit": 10000,
                "adjustment": "all",  # CRITICAL for Quallamaggie: adjust for splits & dividends
                "feed": "iex"         # Required for Free Tier. Upgraded accounts use 'sip'
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
                    
                    # Process the incoming bars
                    if 'bars' in data and data['bars']:
                        for ticker, bars_list in data['bars'].items():
                            for b in bars_list:
                                # Convert timestamp to naive date object (standard format)
                                current_date = pd.to_datetime(b['t']).tz_localize(None).normalize()
                                
                                all_bars_data.append({
                                    'ticker': ticker,
                                    'date': current_date,
                                    'open': b['o'],
                                    'high': b['h'],
                                    'low': b['l'],
                                    'close': b['c'],
                                    'volume': b['v'],
                                    'vwap': b.get('vw', b['c'])  # Fallback to close if vw missing
                                })
                                
                    # Pagination Token Check
                    next_token = data.get('next_page_token')
                    if next_token:
                        params['page_token'] = next_token
                    else:
                        break  # Chunk complete
                        
                except Exception as e:
                    logger.error(f"Failed to fetch data for chunk {chunk[0]}... - {e}")
                    break
                    
            # Mild delay to respect rate limit (200 requests per minute limit)
            time.sleep(0.35)

        if not all_bars_data:
            logger.error("No valid data retrieved from Alpaca.")
            return

        final_df = pd.DataFrame(all_bars_data)
        
        raw_path = self.raw_dir / "raw_alpaca_data.csv"
        final_df.to_csv(raw_path, index=False)
        logger.info(f"Saved raw data to {raw_path}")
        
        self.serialize_to_parquet(final_df, "historical_bars")

    def serialize_to_parquet(self, df: pd.DataFrame, file_name: str):
        """
        Converts raw pandas DataFrames into Polars-native Parquet files
        for vectorized compute speed.
        """
        try:
            df_pl = pl.from_pandas(df)
            out_path = self.processed_dir / f"{file_name}.parquet"
            df_pl.write_parquet(out_path)
            logger.success(f"Successfully serialized data to {out_path} ({len(df_pl)} rows)")
        except Exception as e:
            logger.error(f"Failed to serialize to parquet: {e}")
