import requests
import json
from datetime import datetime
import pandas as pd

url = "https://data.alpaca.markets/v2/stocks/bars"

headers = {
    "accept": "application/json",
    "APCA-API-KEY-ID": "PKAA2IQTT63RGOLMEOXRNDWKB2",
    "APCA-API-SECRET-KEY": "9Zvr9Xt3d3d2rdRRi7dtZSkvEdhVKVZf8Pkk2NC3xVPv"
}

params = {
    "symbols": "AAPL,TSLA",
    "timeframe": "1Day",
    "start": "2024-01-01T00:00:00Z",
    "end": "2024-01-05T23:59:59Z",
    "limit": 1000,
    "feed": "iex"  # Typically required for free tier
}

response = requests.get(url, headers=headers, params=params)

if response.status_code == 200:
    data = response.json()
    print("Success. Keys:")
    print(data.keys())
    
    # Just print the first bar for TSLA
    if 'bars' in data and 'TSLA' in data['bars']:
        print("\nTSLA first bar:")
        print(data['bars']['TSLA'][0])
else:
    print(f"Error {response.status_code}: {response.text}")
