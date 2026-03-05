import sys
from pathlib import Path
from loguru import logger

# Add the project root to sys.path
sys.path.append(str(Path(__file__).parent.parent))

from src.data.ingestion import DataPipeline

# Top 20 stocks by market cap (approximate, current major tech & mega-caps)
TOP_20_TICKERS = [
    "AAPL", "MSFT", "NVDA", "GOOGL", "GOOG", "AMZN", "META", "BRK.B", "LLY", "TSM",
    "AVGO", "V", "JPM", "NVO", "WMT", "UNH", "MA", "XOM", "JNJ", "PG"
]

def main():
    BASE_DIR = Path(__file__).parent.parent
    DATA_DIR = BASE_DIR / "data"

    logger.info("=== FETCHING MAXIMUM HISTORY FOR TOP 20 MARKET CAP STOCKS ===")
    
    pipeline = DataPipeline(DATA_DIR / "raw", DATA_DIR / "processed")
    
    # Alpaca's historical free tier starts from ~2016-01-01
    start_date = "2016-01-01"
    
    # We will fetch up to "today" using a hardcoded safe recent date during backtesting
    # Or we can just dynamically grab today's date
    from datetime import datetime
    end_date = datetime.today().strftime('%Y-%m-%d')
    
    logger.info(f"Initiating fetch for {len(TOP_20_TICKERS)} tickers from {start_date} to {end_date}")
    
    pipeline.ingest_daily_bars(TOP_20_TICKERS, start_date, end_date)
    
    logger.success("Top 20 Mega-Cap Historical Data Fetch Complete.")

if __name__ == "__main__":
    main()
