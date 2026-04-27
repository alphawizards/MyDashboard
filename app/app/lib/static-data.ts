import type { AuthorProfile, AuthorKey, AutopilotPortfolio, Tweet } from "./types";

export const lastRefresh = "2026-04-27 08:50 AEST";

export const watchedTickers = [
  "AAOI",
  "AEHR",
  "AVEX",
  "BE",
  "CIEN",
  "COHR",
  "FLY",
  "LITE",
  "MU",
  "TSEM",
  "VIAV"
] as const;

export const authors = [
  {
    "key": "s",
    "slug": "sikand",
    "name": "Michael Sikand",
    "shortName": "Sikand",
    "handle": "michaelsikand",
    "color": "#4fc3f7",
    "bio": "Investor ? $17M AUM @joinautopilot ? Forbes 30u30 ? Defense & Space focus",
    "followers": "63,446",
    "avatar": "https://pbs.twimg.com/profile_images/1536185134684119040/X0UukfQa_normal.jpg"
  },
  {
    "key": "w",
    "slug": "wolff",
    "name": "Peter Wolff",
    "shortName": "Wolff",
    "handle": "peterjwolff",
    "color": "#10b981",
    "bio": "Dermatology NP ? $140M AUM @joinautopilot ? Tech / Macro / Precious metals",
    "followers": "15,334",
    "avatar": "https://pbs.twimg.com/profile_images/1588706338443431936/ZKGkvq8P_normal.jpg"
  },
  {
    "key": "a",
    "slug": "serenity",
    "name": "Serenity",
    "shortName": "Serenity",
    "handle": "aleabitoreddit",
    "color": "#a78bfa",
    "bio": "Ex-Reddit WSB trader ? AI / Semi supply-chain analyst ? ex RISC-V FDN / AI research",
    "followers": "224,473",
    "avatar": "https://pbs.twimg.com/profile_images/1996176688414367744/LXfA_lIx_normal.jpg"
  },
  {
    "key": "b",
    "slug": "bryzonx",
    "name": "BryzonX",
    "shortName": "BryzonX",
    "handle": "BryzonX",
    "color": "#f43f5e",
    "bio": "Trader / Analyst",
    "followers": "N/A",
    "avatar": null
  },
  {
    "key": "v",
    "slug": "venu",
    "name": "Venu",
    "shortName": "Venu",
    "handle": "Venu_7_",
    "color": "#f59e0b",
    "bio": "Research-driven thematic investor & swing trader · Semiconductor stage-base watchlists",
    "followers": "35,204",
    "avatar": "https://pbs.twimg.com/profile_images/1990648718882910208/ZguIUF9X_normal.jpg"
  }
] as const satisfies readonly AuthorProfile[];

export const stocks = [
  {
    "ticker": "FLY",
    "company": "Firefly Aerospace Inc.",
    "exchange": "NGM",
    "price": 35.13,
    "change": -8.85,
    "prevClose": 38.54,
    "open": 39.18,
    "dayHigh": 39.31,
    "dayLow": 35.0,
    "fiftyTwoHigh": 73.8,
    "fiftyTwoLow": 16.0,
    "volume": 4973597,
    "avgVolume": 6347350,
    "marketCap": 5624531456,
    "sector": "Industrials",
    "target": 0.0,
    "perf1M": 48.2,
    "perf3M": 19.69,
    "perf6M": 40.24,
    "catalyst": "",
    "priority": "medium"
  },
  {
    "ticker": "SPIR",
    "company": "Spire Global, Inc.",
    "exchange": "NYQ",
    "price": 16.51,
    "change": -5.87,
    "prevClose": 17.54,
    "open": 17.5,
    "dayHigh": 18.01,
    "dayLow": 16.23,
    "fiftyTwoHigh": 23.59,
    "fiftyTwoLow": 6.6,
    "volume": 1680609,
    "avgVolume": 2695470,
    "marketCap": 636126400,
    "sector": "Industrials",
    "target": 0.0,
    "perf1M": 33.58,
    "perf3M": 25.17,
    "perf6M": 54.88,
    "catalyst": "",
    "priority": "medium"
  },
  {
    "ticker": "SATL",
    "company": "Satellogic Inc.",
    "exchange": "NCM",
    "price": 6.17,
    "change": -9.4,
    "prevClose": 6.81,
    "open": 6.93,
    "dayHigh": 7.0,
    "dayLow": 6.02,
    "fiftyTwoHigh": 8.35,
    "fiftyTwoLow": 1.25,
    "volume": 8025507,
    "avgVolume": 9947830,
    "marketCap": 883812416,
    "sector": "Industrials",
    "target": 0.0,
    "perf1M": 4.05,
    "perf3M": 12.18,
    "perf6M": 231.72,
    "catalyst": "",
    "priority": "medium"
  },
  {
    "ticker": "SIDU",
    "company": "Sidus Space, Inc.",
    "exchange": "NCM",
    "price": 3.42,
    "change": -7.82,
    "prevClose": 3.71,
    "open": 3.72,
    "dayHigh": 3.76,
    "dayLow": 3.18,
    "fiftyTwoHigh": 5.99,
    "fiftyTwoLow": 0.63,
    "volume": 22703647,
    "avgVolume": 32901710,
    "marketCap": 268918176,
    "sector": "Industrials",
    "target": 0.0,
    "perf1M": 50.66,
    "perf3M": -5.52,
    "perf6M": 197.39,
    "catalyst": "",
    "priority": "medium"
  },
  {
    "ticker": "AAOI",
    "company": "Applied Optoelectronics, Inc.",
    "exchange": "NGM",
    "price": 162.17,
    "change": 17.74,
    "prevClose": 137.73,
    "open": 142.12,
    "dayHigh": 164.87,
    "dayLow": 140.0,
    "fiftyTwoHigh": 173.41,
    "fiftyTwoLow": 11.87,
    "volume": 13924392,
    "avgVolume": 9973200,
    "marketCap": 12596574208,
    "sector": "Technology",
    "target": 0.0,
    "perf1M": 65.13,
    "perf3M": 333.73,
    "perf6M": 357.07,
    "catalyst": "",
    "priority": "medium"
  },
  {
    "ticker": "BE",
    "company": "Bloom Energy Corporation",
    "exchange": "NYQ",
    "price": 231.17,
    "change": -2.69,
    "prevClose": 237.57,
    "open": 240.56,
    "dayHigh": 242.2,
    "dayLow": 231.02,
    "fiftyTwoHigh": 242.2,
    "fiftyTwoLow": 16.05,
    "volume": 6502289,
    "avgVolume": 11112050,
    "marketCap": 65698684928,
    "sector": "Industrials",
    "target": 0.0,
    "perf1M": 73.5,
    "perf3M": 51.78,
    "perf6M": 72.89,
    "catalyst": "Solid-oxide fuel cells for clean power generation; data centre & grid-scale deployments; +1213% from 52w low of $16.01",
    "priority": "medium"
  },
  {
    "ticker": "MU",
    "company": "Micron Technology, Inc.",
    "exchange": "NMS",
    "price": 496.72,
    "change": 3.11,
    "prevClose": 481.72,
    "open": 496.1,
    "dayHigh": 506.99,
    "dayLow": 489.36,
    "fiftyTwoHigh": 506.99,
    "fiftyTwoLow": 73.5,
    "volume": 35379587,
    "avgVolume": 37618410,
    "marketCap": 560168042496,
    "sector": "Technology",
    "target": 0.0,
    "perf1M": 39.11,
    "perf3M": 21.13,
    "perf6M": 119.36,
    "catalyst": "Leading DRAM & NAND flash memory; HBM3E for AI accelerators; near 52w high; +597% from 52w low",
    "priority": "medium"
  },
  {
    "ticker": "ASTS",
    "company": "AST SpaceMobile, Inc.",
    "exchange": "NMS",
    "price": 76.4,
    "change": -2.98,
    "prevClose": 78.75,
    "open": 79.07,
    "dayHigh": 79.6,
    "dayLow": 75.95,
    "fiftyTwoHigh": 129.89,
    "fiftyTwoLow": 22.07,
    "volume": 11878588,
    "avgVolume": 21361720,
    "marketCap": 22357469184,
    "sector": "Technology",
    "target": 0.0,
    "perf1M": -2.89,
    "perf3M": -31.38,
    "perf6M": -4.57,
    "catalyst": "",
    "priority": "medium"
  },
  {
    "ticker": "INTC",
    "company": "Intel Corporation",
    "exchange": "NMS",
    "price": 82.57,
    "change": 23.7,
    "prevClose": 66.75,
    "open": 82.13,
    "dayHigh": 85.22,
    "dayLow": 79.62,
    "fiftyTwoHigh": 85.22,
    "fiftyTwoLow": 18.97,
    "volume": 281405214,
    "avgVolume": 125829080,
    "marketCap": 414996824064,
    "sector": "Technology",
    "target": 0.0,
    "perf1M": 91.37,
    "perf3M": 87.89,
    "perf6M": 99.66,
    "catalyst": "",
    "priority": "medium"
  },
  {
    "ticker": "AVEX",
    "company": "AEVEX Corp.",
    "exchange": "NYQ",
    "price": 29.7,
    "change": -6.52,
    "prevClose": 31.77,
    "open": 31.26,
    "dayHigh": 31.45,
    "dayLow": 28.66,
    "fiftyTwoHigh": 42.34,
    "fiftyTwoLow": 23.0,
    "volume": 2434804,
    "avgVolume": 8440600,
    "marketCap": 1507102080,
    "sector": "Industrials",
    "target": 0.0,
    "perf1M": null,
    "perf3M": null,
    "perf6M": null,
    "catalyst": "Defense drones incl. Phoenix Ghost one-way attack aircraft; IPO'd NYSE 17 Apr 2026 at $20; 2025 rev $433M (~78% DoD); Madison Dearborn-backed",
    "priority": "medium"
  },
  {
    "ticker": "AEHR",
    "company": "Aehr Test Systems, Inc.",
    "exchange": "NCM",
    "price": 95.91,
    "change": 0.42,
    "prevClose": 95.51,
    "open": 98.78,
    "dayHigh": 102.48,
    "dayLow": 94.53,
    "fiftyTwoHigh": 102.48,
    "fiftyTwoLow": 8.02,
    "volume": 2657936,
    "avgVolume": 3874870,
    "marketCap": 3016681728,
    "sector": "Technology",
    "target": 0,
    "perf1M": 194.93,
    "perf3M": 245.62,
    "perf6M": 255.22,
    "catalyst": "",
    "priority": "medium"
  },
  {
    "ticker": "CIEN",
    "company": "Ciena Corporation",
    "exchange": "NYQ",
    "price": 520.8,
    "change": 0.96,
    "prevClose": 515.85,
    "open": 514.82,
    "dayHigh": 527.5,
    "dayLow": 505.63,
    "fiftyTwoHigh": 527.86,
    "fiftyTwoLow": 64.71,
    "volume": 1410681,
    "avgVolume": 2398970,
    "marketCap": 73640304640,
    "sector": "Technology",
    "target": 0,
    "perf1M": 29.68,
    "perf3M": 110.41,
    "perf6M": 175.16,
    "catalyst": "",
    "priority": "medium"
  },
  {
    "ticker": "COHR",
    "company": "Coherent Corp.",
    "exchange": "NYQ",
    "price": 336.09,
    "change": -0.47,
    "prevClose": 337.68,
    "open": 337.36,
    "dayHigh": 343.77,
    "dayLow": 326.34,
    "fiftyTwoHigh": 364.8,
    "fiftyTwoLow": 61.05,
    "volume": 5276257,
    "avgVolume": 5195000,
    "marketCap": 63010775040,
    "sector": "Technology",
    "target": 0,
    "perf1M": 38.04,
    "perf3M": 57.05,
    "perf6M": 143.44,
    "catalyst": "",
    "priority": "medium"
  },
  {
    "ticker": "LITE",
    "company": "Lumentum Holdings Inc.",
    "exchange": "NMS",
    "price": 881.64,
    "change": 4.1,
    "prevClose": 846.89,
    "open": 836.0,
    "dayHigh": 896.11,
    "dayLow": 829.13,
    "fiftyTwoHigh": 960.0,
    "fiftyTwoLow": 56.8,
    "volume": 4205835,
    "avgVolume": 5012570,
    "marketCap": 62949097472,
    "sector": "Technology",
    "target": 0,
    "perf1M": 25.46,
    "perf3M": 137.86,
    "perf6M": 311.44,
    "catalyst": "",
    "priority": "medium"
  },
  {
    "ticker": "TSEM",
    "company": "Tower Semiconductor Ltd.",
    "exchange": "NMS",
    "price": 200.35,
    "change": -0.55,
    "prevClose": 201.46,
    "open": 202.56,
    "dayHigh": 207.48,
    "dayLow": 192.52,
    "fiftyTwoHigh": 228.73,
    "fiftyTwoLow": 34.73,
    "volume": 3224761,
    "avgVolume": 2764730,
    "marketCap": 23839451136,
    "sector": "Technology",
    "target": 0,
    "perf1M": 16.65,
    "perf3M": 51.21,
    "perf6M": 140.17,
    "catalyst": "",
    "priority": "medium"
  },
  {
    "ticker": "VIAV",
    "company": "Viavi Solutions Inc.",
    "exchange": "NMS",
    "price": 47.75,
    "change": 3.47,
    "prevClose": 46.15,
    "open": 47.42,
    "dayHigh": 48.89,
    "dayLow": 46.89,
    "fiftyTwoHigh": 48.89,
    "fiftyTwoLow": 8.1,
    "volume": 4589910,
    "avgVolume": 5453350,
    "marketCap": 11048841216,
    "sector": "Technology",
    "target": 0,
    "perf1M": 37.85,
    "perf3M": 130.68,
    "perf6M": 241.56,
    "catalyst": "",
    "priority": "medium"
  }
];

export const tweetsByAuthor = {
  "v": [
      {
        "id": "2048227395757625520",
        "text": "@jjeebhoy 💯",
        "created_at": "Apr 26, 12:27 AEST",
        "likes": 0,
        "retweets": 0,
        "replies": 0,
        "cashtags": [],
        "url": "https://x.com/Venu_7_/status/2048227395757625520"
      },
      {
        "id": "2048215637282173233",
        "text": "@lakshminarasima Nothing :) it’s just for watchlist at this point",
        "created_at": "Apr 26, 11:40 AEST",
        "likes": 1,
        "retweets": 0,
        "replies": 0,
        "cashtags": [],
        "url": "https://x.com/Venu_7_/status/2048215637282173233"
      },
      {
        "id": "2048215561692397732",
        "text": "@QuikInsightz Thank you!",
        "created_at": "Apr 26, 11:40 AEST",
        "likes": 0,
        "retweets": 0,
        "replies": 0,
        "cashtags": [],
        "url": "https://x.com/Venu_7_/status/2048215561692397732"
      },
      {
        "id": "2048214523056963606",
        "text": "@options_selling Yep!!",
        "created_at": "Apr 26, 11:36 AEST",
        "likes": 0,
        "retweets": 0,
        "replies": 0,
        "cashtags": [],
        "url": "https://x.com/Venu_7_/status/2048214523056963606"
      },
      {
        "id": "2048214477842334041",
        "text": "@wey_how12640 Thank you bro 🫡🙌🏻",
        "created_at": "Apr 26, 11:36 AEST",
        "likes": 2,
        "retweets": 0,
        "replies": 0,
        "cashtags": [],
        "url": "https://x.com/Venu_7_/status/2048214477842334041"
      },
      {
        "id": "2048202368744030657",
        "text": "@big_Drew19 💯💯",
        "created_at": "Apr 26, 10:47 AEST",
        "likes": 1,
        "retweets": 0,
        "replies": 0,
        "cashtags": [],
        "url": "https://x.com/Venu_7_/status/2048202368744030657"
      },
      {
        "id": "2048197077566619855",
        "text": "in $MRVL case, 1.618 Fib Extension around $210 level as well which aligns with measured move!\n\nthat's a place it might take a break but I don't think move is nowhere close to done, IMO!",
        "created_at": "Apr 26, 10:26 AEST",
        "likes": 12,
        "retweets": 1,
        "replies": 3,
        "cashtags": [
          "$MRVL"
        ],
        "url": "https://x.com/Venu_7_/status/2048197077566619855"
      },
      {
        "id": "2048197075272417565",
        "text": "Measured moves - the simplest way to find targets\n\nwhen there’s no clear resistance, you can use measured moves as an alternative to fib extensions\n\nfrom classical technical analysis - Wyckoff, Edwards & Magee, Stan Weinstein the idea:\n\nbase = accumulation\nbreakout → move = size https://t.co/Cro0fcjiOO",
        "created_at": "Apr 26, 10:26 AEST",
        "likes": 114,
        "retweets": 4,
        "replies": 7,
        "cashtags": [],
        "url": "https://x.com/Venu_7_/status/2048197075272417565"
      },
      {
        "id": "2048187474720264244",
        "text": "@Praath 💯💯💯 https://t.co/AYwYFJvsdh",
        "created_at": "Apr 26, 09:48 AEST",
        "likes": 0,
        "retweets": 0,
        "replies": 0,
        "cashtags": [],
        "url": "https://x.com/Venu_7_/status/2048187474720264244"
      },
      {
        "id": "2048185642321137951",
        "text": "RT @jrouldz: Making a desperate plea to X here because I’m not sure what else to do\n\nI have a dozens of subscribers messaging me that my su…",
        "created_at": "Apr 26, 09:41 AEST",
        "likes": 0,
        "retweets": 8,
        "replies": 0,
        "cashtags": [],
        "url": "https://x.com/Venu_7_/status/2048185642321137951"
      },
      {
        "id": "2048185319783284790",
        "text": "@RemoteNavigator @schaneru79 @aleabitoreddit @crux_capital_ @dannycheng2022 😅 https://t.co/n8LIQX2Qm9",
        "created_at": "Apr 26, 09:40 AEST",
        "likes": 1,
        "retweets": 0,
        "replies": 3,
        "cashtags": [],
        "url": "https://x.com/Venu_7_/status/2048185319783284790"
      },
      {
        "id": "2048177306313932873",
        "text": "@SrihariHS1 Never fan a screener - most of these come from logical thinking while finding the themes. Once finding the theme - drills down to best companies in the theme!",
        "created_at": "Apr 26, 09:08 AEST",
        "likes": 0,
        "retweets": 0,
        "replies": 0,
        "cashtags": [],
        "url": "https://x.com/Venu_7_/status/2048177306313932873"
      },
      {
        "id": "2048176542338150540",
        "text": "@schaneru79 @aleabitoreddit @crux_capital_ @dannycheng2022 Thank you - I appreciate the shoutout, have a good weekend 🙌🏻",
        "created_at": "Apr 26, 09:05 AEST",
        "likes": 3,
        "retweets": 0,
        "replies": 3,
        "cashtags": [],
        "url": "https://x.com/Venu_7_/status/2048176542338150540"
      },
      {
        "id": "2048176160543236172",
        "text": "@Erik96754 💯🫡 thank you for sharing your view Erik!",
        "created_at": "Apr 26, 09:03 AEST",
        "likes": 1,
        "retweets": 0,
        "replies": 1,
        "cashtags": [],
        "url": "https://x.com/Venu_7_/status/2048176160543236172"
      },
      {
        "id": "2048145777252606382",
        "text": "@yegeinal 🫡🫡",
        "created_at": "Apr 26, 07:03 AEST",
        "likes": 1,
        "retweets": 0,
        "replies": 0,
        "cashtags": [],
        "url": "https://x.com/Venu_7_/status/2048145777252606382"
      },
      {
        "id": "2048138927559901692",
        "text": "@RanierisEcho Thank you, brother 🫡🙌🏻",
        "created_at": "Apr 26, 06:35 AEST",
        "likes": 1,
        "retweets": 0,
        "replies": 0,
        "cashtags": [],
        "url": "https://x.com/Venu_7_/status/2048138927559901692"
      },
      {
        "id": "2048133631840047497",
        "text": "@TheLongInvest Hey TLI,\n\nI still see plenty of high-quality semiconductor names with upside, especially on a pullback.\n\nSharing a list here - worth keeping on  radar. https://t.co/61XvokBhZh",
        "created_at": "Apr 26, 06:14 AEST",
        "likes": 25,
        "retweets": 2,
        "replies": 2,
        "cashtags": [],
        "url": "https://x.com/Venu_7_/status/2048133631840047497"
      },
      {
        "id": "2048078874559611109",
        "text": "Semiconductor sub-themes still in Stage 1 bases\n\n10 names building massive Stage 1 bases\n\nas semis pull back in the coming weeks, these are the names worth keeping on your watchlist\n\n$ENTG $ICHR $PENG $NVTS $AOSL $SYNA $CRDO $GFS $PLAB $COHU",
        "created_at": "Apr 25, 16:37 AEST",
        "likes": 100,
        "retweets": 6,
        "replies": 7,
        "cashtags": [
          "$ENTG",
          "$ICHR",
          "$PENG",
          "$NVTS",
          "$AOSL",
          "$SYNA",
          "$CRDO",
          "$GFS",
          "$PLAB",
          "$COHU"
        ],
        "url": "https://x.com/venu_7_/status/2048078874559611109"
      }
    ],
  "s": [
    {
      "id": "2047777599334580626",
      "text": "Woah.\n\nMy photonics fund on @joinautopilot now has over $10M AUM.\n\nSince Iran, the fund is up 47.8% vs. 2.2% for the S&amp;P with AUM growing 4000%.\n\n99% of people will NEVER pick individual stocks.\n\nAutopilot is forever disrupting the multi-trillion dollar ETF industry... https://t.co/QEehYpMBmW",
      "created_at": "Apr 25, 06:40 AEST",
      "likes": 11,
      "retweets": 0,
      "replies": 3,
      "cashtags": [],
      "url": "https://x.com/michaelsikand/status/2047777599334580626"
    },
    {
      "id": "2047776487051497518",
      "text": "@damndanielsa I love Avex",
      "created_at": "Apr 25, 06:35 AEST",
      "likes": 0,
      "retweets": 0,
      "replies": 0,
      "cashtags": [],
      "url": "https://x.com/michaelsikand/status/2047776487051497518"
    },
    {
      "id": "2047762110336348551",
      "text": "This Anduril competitor $AVEX is still my favorite public drone stock even though I'm bagged 11%.\n\nhttps://t.co/93VQXemFef",
      "created_at": "Apr 25, 05:38 AEST",
      "likes": 12,
      "retweets": 0,
      "replies": 0,
      "cashtags": [
        "$AVEX"
      ],
      "url": "https://x.com/michaelsikand/status/2047762110336348551"
    },
    {
      "id": "2047761714423513122",
      "text": "@realstockfox tons of buying opportunities in defense.",
      "created_at": "Apr 25, 05:36 AEST",
      "likes": 2,
      "retweets": 0,
      "replies": 0,
      "cashtags": [],
      "url": "https://x.com/michaelsikand/status/2047761714423513122"
    },
    {
      "id": "2047761593241567452",
      "text": "@MoonShotMarty defense supercycle is so undeniable.",
      "created_at": "Apr 25, 05:36 AEST",
      "likes": 5,
      "retweets": 0,
      "replies": 0,
      "cashtags": [],
      "url": "https://x.com/michaelsikand/status/2047761593241567452"
    },
    {
      "id": "2047757991597023294",
      "text": "If Anduril was public, the stock would be getting smoked rn. \n\nHow utterly insane does that sound? https://t.co/85ITe5oBdD",
      "created_at": "Apr 25, 05:22 AEST",
      "likes": 55,
      "retweets": 4,
      "replies": 19,
      "cashtags": [],
      "url": "https://x.com/michaelsikand/status/2047757991597023294"
    },
    {
      "id": "2047722079060206015",
      "text": "@JDPunkin yeah they got cooked rotating with me",
      "created_at": "Apr 25, 02:59 AEST",
      "likes": 0,
      "retweets": 0,
      "replies": 0,
      "cashtags": [],
      "url": "https://x.com/michaelsikand/status/2047722079060206015"
    },
    {
      "id": "2047722009887637787",
      "text": "@bclay3984 there are many, like earnings, orders from navies etc.",
      "created_at": "Apr 25, 02:59 AEST",
      "likes": 3,
      "retweets": 0,
      "replies": 1,
      "cashtags": [],
      "url": "https://x.com/michaelsikand/status/2047722009887637787"
    },
    {
      "id": "2047721911850070513",
      "text": "@Tanr45 high roller",
      "created_at": "Apr 25, 02:58 AEST",
      "likes": 1,
      "retweets": 0,
      "replies": 1,
      "cashtags": [],
      "url": "https://x.com/michaelsikand/status/2047721911850070513"
    },
    {
      "id": "2047717588416016527",
      "text": "Sounds like the average American missed photonics? https://t.co/fVFruF3GQY",
      "created_at": "Apr 25, 02:41 AEST",
      "likes": 102,
      "retweets": 0,
      "replies": 15,
      "cashtags": [],
      "url": "https://x.com/michaelsikand/status/2047717588416016527"
    },
    {
      "id": "2047716421325688989",
      "text": "@JasonSa31374445 TARP came out with a modest profit/breakeven.",
      "created_at": "Apr 25, 02:36 AEST",
      "likes": 0,
      "retweets": 0,
      "replies": 0,
      "cashtags": [],
      "url": "https://x.com/michaelsikand/status/2047716421325688989"
    },
    {
      "id": "2047707901373124907",
      "text": "I usually make money in America and spend it in Europe.\n\nThis week was different. \n\nSince we called the Euro AI rotation last week.\n\n$SOI +15% $AIXA +9% $LPKF +19%\n\nVs. $LITE -0.73%, $AAOI -1.2% $COHR -1.4% https://t.co/nphNvJ8AQS",
      "created_at": "Apr 25, 02:03 AEST",
      "likes": 69,
      "retweets": 1,
      "replies": 15,
      "cashtags": [
        "$SOI",
        "$AIXA",
        "$LPKF",
        "$LITE",
        "$AAOI",
        "$COHR"
      ],
      "url": "https://x.com/michaelsikand/status/2047707901373124907"
    },
    {
      "id": "2047471570847924292",
      "text": "This is crazy.\n\nTrump just became the first U.S. President to make taxpayers multi-bagger returns.\n\n$INTC is up 20% today on a major beat. Trump turned $9B into $33B in 8 months, up 290%.\n\nThe previous record for a federal equity stake was Citigroup after 2008 (+27%). https://t.co/EW74T2t91i https://t.co/tg3GhCYndj",
      "created_at": "Apr 24, 10:23 AEST",
      "likes": 148,
      "retweets": 5,
      "replies": 11,
      "cashtags": [
        "$INTC"
      ],
      "url": "https://x.com/michaelsikand/status/2047471570847924292"
    },
    {
      "id": "2047448459217944811",
      "text": "@cmsinvests https://t.co/Kqylhp4V48",
      "created_at": "Apr 24, 08:52 AEST",
      "likes": 0,
      "retweets": 0,
      "replies": 0,
      "cashtags": [],
      "url": "https://x.com/michaelsikand/status/2047448459217944811"
    },
    {
      "id": "2047438271136043057",
      "text": "The market still sees $FLY as a space stock.\n\nI see it as an orbital defense powerhouse with a lunar economy and launch lottery ticket.\n\nI've been geeking on defense since the $1.5T budget dropped. \n\n$FLY looks perfectly positioned for two massive line items.\n\nGolden Dome has https://t.co/8xssVRu8sY",
      "created_at": "Apr 24, 08:11 AEST",
      "likes": 144,
      "retweets": 14,
      "replies": 12,
      "cashtags": [
        "$FLY",
        "$FLY"
      ],
      "url": "https://x.com/michaelsikand/status/2047438271136043057"
    },
    {
      "id": "2047409779384160576",
      "text": "@PepInvestStocks fohsho!",
      "created_at": "Apr 24, 06:18 AEST",
      "likes": 2,
      "retweets": 0,
      "replies": 0,
      "cashtags": [],
      "url": "https://x.com/michaelsikand/status/2047409779384160576"
    },
    {
      "id": "2047405873291759992",
      "text": "@Santosha22x https://t.co/4u10OgZyhN",
      "created_at": "Apr 24, 06:02 AEST",
      "likes": 0,
      "retweets": 0,
      "replies": 0,
      "cashtags": [],
      "url": "https://x.com/michaelsikand/status/2047405873291759992"
    },
    {
      "id": "2047405696644464967",
      "text": "@bobby128482 To be totally honest with you I don't have that single stock conviction where I'd buy a LEAP on any one at this time. Sometimes those ideas come where you want to go hard and really know what the market doesn't. Makes sense to use leverage there.",
      "created_at": "Apr 24, 06:02 AEST",
      "likes": 2,
      "retweets": 0,
      "replies": 0,
      "cashtags": [],
      "url": "https://x.com/michaelsikand/status/2047405696644464967"
    },
    {
      "id": "2047403877277049275",
      "text": "@bobby128482 I like options when you make money on them with IV expansion. This was great with EWY earlier in the year. So you find options for stocks the market isn't attributing vol too when they should be ig.",
      "created_at": "Apr 24, 05:54 AEST",
      "likes": 0,
      "retweets": 0,
      "replies": 1,
      "cashtags": [],
      "url": "https://x.com/michaelsikand/status/2047403877277049275"
    },
    {
      "id": "2047401324816613655",
      "text": "@bobby128482 I mostly just run concentrated equity positions. It's so simple that way. I don't get crushed on spreads or have to wait for limits, nor do I get raped during the Iran War volatility. LEAPS make sense in some cases though.",
      "created_at": "Apr 24, 05:44 AEST",
      "likes": 1,
      "retweets": 0,
      "replies": 1,
      "cashtags": [],
      "url": "https://x.com/michaelsikand/status/2047401324816613655"
    }
  ],
  "w": [
    {
      "id": "2047735462383812709",
      "text": "@kryptosopus @joinautopilot Thanks to strategic trims based on macro/technicals data, we continued raising our cash equivalent allocations into this last crisis.\n\nHighest point was 27% $SGOV until conditions started turning around.\n\nNot perfect, but better than many other high risk strategies",
      "created_at": "Apr 25, 03:52 AEST",
      "likes": 1,
      "retweets": 0,
      "replies": 1,
      "cashtags": [
        "$SGOV"
      ],
      "url": "https://x.com/peterjwolff/status/2047735462383812709"
    },
    {
      "id": "2047732481043091549",
      "text": "@btconly007 @joinautopilot Still bullish \ud83e\udd42",
      "created_at": "Apr 25, 03:40 AEST",
      "likes": 1,
      "retweets": 0,
      "replies": 0,
      "cashtags": [],
      "url": "https://x.com/peterjwolff/status/2047732481043091549"
    },
    {
      "id": "2047732407693181026",
      "text": "@Carterstrick96 @joinautopilot Thank you \ud83e\udd42",
      "created_at": "Apr 25, 03:40 AEST",
      "likes": 2,
      "retweets": 0,
      "replies": 1,
      "cashtags": [],
      "url": "https://x.com/peterjwolff/status/2047732407693181026"
    },
    {
      "id": "2047730846384406955",
      "text": "@crypt0CG @joinautopilot In most brokerages yes. In some, I believe you have to approve the trades when they\u2019re placed. \n\nNot sure on which is which, but I\u2019d recommend reaching out to autopilot support for more details if you\u2019re interested!",
      "created_at": "Apr 25, 03:34 AEST",
      "likes": 1,
      "retweets": 0,
      "replies": 0,
      "cashtags": [],
      "url": "https://x.com/peterjwolff/status/2047730846384406955"
    },
    {
      "id": "2047729929161441699",
      "text": "@JasonRodlund Welcome aboard \ud83e\udd42",
      "created_at": "Apr 25, 03:30 AEST",
      "likes": 1,
      "retweets": 0,
      "replies": 0,
      "cashtags": [],
      "url": "https://x.com/peterjwolff/status/2047729929161441699"
    },
    {
      "id": "2047729713599365211",
      "text": "@clankslop Big numbers! \ud83e\udd42",
      "created_at": "Apr 25, 03:29 AEST",
      "likes": 0,
      "retweets": 0,
      "replies": 0,
      "cashtags": [],
      "url": "https://x.com/peterjwolff/status/2047729713599365211"
    },
    {
      "id": "2047729469008519657",
      "text": "@burrytracker \ud83e\udd42",
      "created_at": "Apr 25, 03:28 AEST",
      "likes": 1,
      "retweets": 0,
      "replies": 0,
      "cashtags": [],
      "url": "https://x.com/peterjwolff/status/2047729469008519657"
    },
    {
      "id": "2047717599505768913",
      "text": "@btconly007 We\u2019ve been accumulating both since early 2025 \ud83e\udd42",
      "created_at": "Apr 25, 02:41 AEST",
      "likes": 2,
      "retweets": 0,
      "replies": 1,
      "cashtags": [],
      "url": "https://x.com/peterjwolff/status/2047717599505768913"
    },
    {
      "id": "2047717032687526251",
      "text": "@BennyJ503 Thank you Ben \ud83e\udd42",
      "created_at": "Apr 25, 02:39 AEST",
      "likes": 1,
      "retweets": 0,
      "replies": 0,
      "cashtags": [],
      "url": "https://x.com/peterjwolff/status/2047717032687526251"
    },
    {
      "id": "2047716897358307652",
      "text": "@AlbertDzurka \ud83e\udd42",
      "created_at": "Apr 25, 02:38 AEST",
      "likes": 1,
      "retweets": 0,
      "replies": 0,
      "cashtags": [],
      "url": "https://x.com/peterjwolff/status/2047716897358307652"
    },
    {
      "id": "2047716467999990004",
      "text": "Wolff's Flagship Fund was launched in December 2024 with less than $10,000 in invested capital to start.\n\nToday, less than a year and a half later, this fund has passed $150M.\n\nWith wildly successful politician trackers and an expanding list of outperforming pilots, https://t.co/3vSnBaaml0",
      "created_at": "Apr 25, 02:37 AEST",
      "likes": 62,
      "retweets": 3,
      "replies": 9,
      "cashtags": [],
      "url": "https://x.com/peterjwolff/status/2047716467999990004"
    },
    {
      "id": "2047709091389387213",
      "text": "Trimmed some of these incredible $AMD profits across Autopilot accounts this morning and reallocated most of these gains to undervalued $META and $MSFT positions. https://t.co/v4u3YMiDZz",
      "created_at": "Apr 25, 02:07 AEST",
      "likes": 94,
      "retweets": 3,
      "replies": 9,
      "cashtags": [
        "$AMD",
        "$META",
        "$MSFT"
      ],
      "url": "https://x.com/peterjwolff/status/2047709091389387213"
    },
    {
      "id": "2047349156273135982",
      "text": "RT @joinautopilot: Two whales are going band for band\ud83d\udc0b\n\nSomeone just invested $305,057 into @michaelsikand's Photonics is Next portfolio\n\nT\u2026",
      "created_at": "Apr 24, 02:17 AEST",
      "likes": 0,
      "retweets": 2,
      "replies": 0,
      "cashtags": [],
      "url": "https://x.com/peterjwolff/status/2047349156273135982"
    },
    {
      "id": "2047118699442917541",
      "text": "@abeberg_ It was a good FAQ!\n\nI\u2019m looking forward to this event too; you\u2019ll probably notice that I sound very much how I write on my Substack.\n\nLooking forward to meeting some of my long term investors next week!",
      "created_at": "Apr 23, 11:01 AEST",
      "likes": 2,
      "retweets": 0,
      "replies": 0,
      "cashtags": [],
      "url": "https://x.com/peterjwolff/status/2047118699442917541"
    },
    {
      "id": "2047085775876207091",
      "text": "@Brandonkujo Not financial advice, but I like that interpretation too! \ud83e\udd42",
      "created_at": "Apr 23, 08:50 AEST",
      "likes": 2,
      "retweets": 0,
      "replies": 0,
      "cashtags": [],
      "url": "https://x.com/peterjwolff/status/2047085775876207091"
    },
    {
      "id": "2047046440300732793",
      "text": "@BarkerboyGaming Happy to hear it, welcome aboard \ud83e\udd42 I\u2019m excited for the future too!",
      "created_at": "Apr 23, 06:14 AEST",
      "likes": 1,
      "retweets": 0,
      "replies": 0,
      "cashtags": [],
      "url": "https://x.com/peterjwolff/status/2047046440300732793"
    },
    {
      "id": "2047044289797267782",
      "text": "Interestingly enough, those \u201cthis is a scam\u201d messages have completely stopped over the last couple weeks.\n\nAs I wrote in my letter to frustrated investors, I still highly recommend those individuals to seek counsel with their RIA and to use these rallies to rotate into https://t.co/8JNn9LenAK",
      "created_at": "Apr 23, 06:06 AEST",
      "likes": 12,
      "retweets": 0,
      "replies": 9,
      "cashtags": [],
      "url": "https://x.com/peterjwolff/status/2047044289797267782"
    },
    {
      "id": "2047039326299820313",
      "text": "Thank you @LisaSu for navigating the company through a year where high level execution was critical!\n\nMany didn\u2019t believe $AMD would outperform when their share price was in the low $100\u2019s! https://t.co/v4u3YMiDZz",
      "created_at": "Apr 23, 05:46 AEST",
      "likes": 36,
      "retweets": 1,
      "replies": 6,
      "cashtags": [
        "$AMD"
      ],
      "url": "https://x.com/peterjwolff/status/2047039326299820313"
    },
    {
      "id": "2046996231457763645",
      "text": "Be careful trusting all your BREAKING \ud83d\udea8 bear market information sources on social media.\n\nThanks for calling it out @LynAldenContact https://t.co/kA4M32niW2",
      "created_at": "Apr 23, 02:55 AEST",
      "likes": 29,
      "retweets": 2,
      "replies": 3,
      "cashtags": [],
      "url": "https://x.com/peterjwolff/status/2046996231457763645"
    },
    {
      "id": "2046792318691471767",
      "text": "@DGretta_Author Bear markets are the worst!",
      "created_at": "Apr 22, 13:24 AEST",
      "likes": 4,
      "retweets": 0,
      "replies": 0,
      "cashtags": [],
      "url": "https://x.com/peterjwolff/status/2046792318691471767"
    }
  ],
  "a": [
    {
      "id": "2047762479917482350",
      "text": "@hamza_hsn Oh nice! What positions did you end up taking",
      "created_at": "Apr 25, 05:39 AEST",
      "likes": 8,
      "retweets": 0,
      "replies": 4,
      "cashtags": [],
      "url": "https://x.com/aleabitoreddit/status/2047762479917482350"
    },
    {
      "id": "2047733429199106486",
      "text": "@Minnvestor It\u2019s true. I don\u2019t think US completely mapped out all the upstream chokepoints yet.\n\nWhich is why China was still able to acquire different monopolies required by US hyperscalers and steal IP over time.\n\nRetail ownership is a great way to prevent hostile takeovers and control",
      "created_at": "Apr 25, 03:44 AEST",
      "likes": 139,
      "retweets": 2,
      "replies": 7,
      "cashtags": [],
      "url": "https://x.com/aleabitoreddit/status/2047733429199106486"
    },
    {
      "id": "2047732066603942395",
      "text": "@Yolo365247isme I do have $AMSC and $PLPC as the executive order beneficiaries as well but not as high conviction. \n\nI mean AMSC is up 8.58% and PLPC is up 6.37% today, they don\u2019t just go up 48% in a day.",
      "created_at": "Apr 25, 03:39 AEST",
      "likes": 26,
      "retweets": 1,
      "replies": 3,
      "cashtags": [
        "$AMSC",
        "$PLPC"
      ],
      "url": "https://x.com/aleabitoreddit/status/2047732066603942395"
    },
    {
      "id": "2047730369253036160",
      "text": "@nodeflowsol Transformer/switchgear bottlenecks are like 1.5-5 years\u2026 and it was designated as a national security risk few days ago + got the defense production act invoked by the President.\n\nLot of these players will get record inflows for capex + capacity growth from federal funding.",
      "created_at": "Apr 25, 03:32 AEST",
      "likes": 33,
      "retweets": 0,
      "replies": 2,
      "cashtags": [],
      "url": "https://x.com/aleabitoreddit/status/2047730369253036160"
    },
    {
      "id": "2047729814581432398",
      "text": "@01100101j When $SIVE hits 1000% sure.",
      "created_at": "Apr 25, 03:30 AEST",
      "likes": 60,
      "retweets": 1,
      "replies": 3,
      "cashtags": [
        "$SIVE"
      ],
      "url": "https://x.com/aleabitoreddit/status/2047729814581432398"
    },
    {
      "id": "2047729405309640899",
      "text": "If you listened to Optimus Prime\u2026\n\nYou\u2019d be up 47% in just 3 weeks with $HPS.A.\n\nDid you listen to Optimus anon? https://t.co/dUWQBpPu0y https://t.co/NkOSKHXXDo",
      "created_at": "Apr 25, 03:28 AEST",
      "likes": 483,
      "retweets": 11,
      "replies": 65,
      "cashtags": [
        "$HPS.A"
      ],
      "url": "https://x.com/aleabitoreddit/status/2047729405309640899"
    },
    {
      "id": "2047711415994376288",
      "text": "@offermemoneyXYZ Yeah, I was down a bit on $AXTI but glad it\u2019s back at 1057% gains\u2026 https://t.co/VU9achD3MW",
      "created_at": "Apr 25, 02:17 AEST",
      "likes": 54,
      "retweets": 0,
      "replies": 5,
      "cashtags": [
        "$AXTI"
      ],
      "url": "https://x.com/aleabitoreddit/status/2047711415994376288"
    },
    {
      "id": "2047709936860508501",
      "text": "@troyofsparta No clue lol, I literally said it was a good opportunity for scale across in subscribers chat.\n\nMy neighbors kept going at it and I got too distracted past few days",
      "created_at": "Apr 25, 02:11 AEST",
      "likes": 38,
      "retweets": 0,
      "replies": 8,
      "cashtags": [],
      "url": "https://x.com/aleabitoreddit/status/2047709936860508501"
    },
    {
      "id": "2047707424703049809",
      "text": "@UlquiorraRises No? I\u2019m still holding $IQE just down a lot to a small 246% gain https://t.co/eAXSp0sb75",
      "created_at": "Apr 25, 02:01 AEST",
      "likes": 55,
      "retweets": 0,
      "replies": 3,
      "cashtags": [
        "$IQE"
      ],
      "url": "https://x.com/aleabitoreddit/status/2047707424703049809"
    },
    {
      "id": "2047706321160729032",
      "text": "@mi20483980476 Eh, adjacent, they\u2019re in multiple spaces but have T1 optical transceiver companies",
      "created_at": "Apr 25, 01:56 AEST",
      "likes": 26,
      "retweets": 0,
      "replies": 3,
      "cashtags": [],
      "url": "https://x.com/aleabitoreddit/status/2047706321160729032"
    },
    {
      "id": "2047705901486985666",
      "text": "Photonics go brrr.\n\n$MXL +76.2% (lol)\n$AAOI +15.03%\n$SIVE +12.69%\n$AEHR +7.07%\n$SOI +6.19%\n$LITE +4.96%\n\nHope you didn\u2019t sell and try and chase other bottlenecks anon? https://t.co/Ft2p94bDWR",
      "created_at": "Apr 25, 01:55 AEST",
      "likes": 1123,
      "retweets": 65,
      "replies": 131,
      "cashtags": [
        "$MXL",
        "$AAOI",
        "$SIVE",
        "$AEHR",
        "$SOI",
        "$LITE"
      ],
      "url": "https://x.com/aleabitoreddit/status/2047705901486985666"
    },
    {
      "id": "2047688270231027947",
      "text": "Who thought it was a good idea to give Tangerine Peel inspired companies the funds\u2026\n\nTo short the fastest growing names in photonics and memory?\n\n$SNDK and $AAOI have been on a hyperbolic run. \n\nAnd I see names like AAOI continuing to grow as optical transceiver + Made in https://t.co/M2BkraORUe",
      "created_at": "Apr 25, 00:45 AEST",
      "likes": 639,
      "retweets": 30,
      "replies": 62,
      "cashtags": [
        "$SNDK",
        "$AAOI"
      ],
      "url": "https://x.com/aleabitoreddit/status/2047688270231027947"
    },
    {
      "id": "2047682921545498835",
      "text": "@CludioNune67383 Yeah? That means $SIVE is actively doing the steps to list on Nasdaq not just \u201cthinking about it\u201d",
      "created_at": "Apr 25, 00:23 AEST",
      "likes": 48,
      "retweets": 1,
      "replies": 2,
      "cashtags": [
        "$SIVE"
      ],
      "url": "https://x.com/aleabitoreddit/status/2047682921545498835"
    },
    {
      "id": "2047590663450243208",
      "text": "@miraclemaster07 A lot of Taiwanese stocks like shunsin, fittech, win semi and others corrected recently. It's just normal volatility, nothing's fundamentally changed, still like them all.",
      "created_at": "Apr 24, 18:17 AEST",
      "likes": 47,
      "retweets": 0,
      "replies": 5,
      "cashtags": [],
      "url": "https://x.com/aleabitoreddit/status/2047590663450243208"
    },
    {
      "id": "2047586879328170151",
      "text": "@UnmaskedBillion Hi, appreciate the more productive discussion.  \n\nBut I've never seen anyone aside from Europeans complain about 2.5% $13M dilution to get listed on NASDAQ. \n\nOver in the US... we have random Bitcoin miners with $6B+ dilution (over half the MC) just to attempt a pivot and buy",
      "created_at": "Apr 24, 18:02 AEST",
      "likes": 85,
      "retweets": 2,
      "replies": 5,
      "cashtags": [],
      "url": "https://x.com/aleabitoreddit/status/2047586879328170151"
    },
    {
      "id": "2047584052451176687",
      "text": "@fredrikmob49943 Hi Swedish local. If it's not $AAPL:\n\nPlease name me another US Fortune 100 company (not Samsung by elimination) shipping 50M+ units yearly...\n\nThat fits $SIVE R&amp;D laser specs + applications then?",
      "created_at": "Apr 24, 17:50 AEST",
      "likes": 70,
      "retweets": 0,
      "replies": 3,
      "cashtags": [
        "$AAPL",
        "$SIVE"
      ],
      "url": "https://x.com/aleabitoreddit/status/2047584052451176687"
    },
    {
      "id": "2047578859319840953",
      "text": "@sharion73 @veggiepoultry @StormDirac $AAPL won't confirm BOM and upstream vendors in their supply chain. But almost 100% sure, maybe 99%. \n\nMaybe you can name another consumer hardware company shipping 50M+ units yearly that fits their R&amp;D laser specs + applications?",
      "created_at": "Apr 24, 17:30 AEST",
      "likes": 54,
      "retweets": 0,
      "replies": 1,
      "cashtags": [
        "$AAPL"
      ],
      "url": "https://x.com/aleabitoreddit/status/2047578859319840953"
    },
    {
      "id": "2047578228878143488",
      "text": "@AndreasSch52269 Thank you for pointing that out.\n\nI thought it would be more of a positive sum socialist mindset where everyone in an economy benefits if a local company does.\n\nNot the \"bring anyone else successful down\" type socialism.",
      "created_at": "Apr 24, 17:27 AEST",
      "likes": 55,
      "retweets": 0,
      "replies": 6,
      "cashtags": [],
      "url": "https://x.com/aleabitoreddit/status/2047578228878143488"
    },
    {
      "id": "2047577584528162838",
      "text": "@veggiepoultry @StormDirac Rockley went down, which is likely the reason why $SIVE became the $AAPL supplier.",
      "created_at": "Apr 24, 17:25 AEST",
      "likes": 39,
      "retweets": 0,
      "replies": 1,
      "cashtags": [
        "$SIVE",
        "$AAPL"
      ],
      "url": "https://x.com/aleabitoreddit/status/2047577584528162838"
    },
    {
      "id": "2047576877574103455",
      "text": "@Embezzl3r Yeah makes sense about seeing their reactions to $AAPL as their hinted hyperscaler customer for volume ramp.",
      "created_at": "Apr 24, 17:22 AEST",
      "likes": 33,
      "retweets": 0,
      "replies": 0,
      "cashtags": [
        "$AAPL"
      ],
      "url": "https://x.com/aleabitoreddit/status/2047576877574103455"
    }
  ],
  "b": [
    {
      "id": "2047871713460052475",
      "text": "@jukan05 Love $PENG for a CXL pure play",
      "created_at": "Apr 25, 12:53 AEST",
      "likes": 0,
      "retweets": 0,
      "replies": 0,
      "cashtags": [
        "$PENG"
      ],
      "url": "https://x.com/BryzonX/status/2047871713460052475"
    },
    {
      "id": "2047870826175930781",
      "text": "Jukan has CXL on his watchlist \n\n$PENG https://t.co/q10GSR224S",
      "created_at": "Apr 25, 12:50 AEST",
      "likes": 4,
      "retweets": 0,
      "replies": 1,
      "cashtags": [
        "$PENG"
      ],
      "url": "https://x.com/BryzonX/status/2047870826175930781"
    },
    {
      "id": "2047810128607584632",
      "text": "@wapital3 \ud83d\ude02\ud83d\ude02\ud83d\ude02",
      "created_at": "Apr 25, 08:49 AEST",
      "likes": 1,
      "retweets": 0,
      "replies": 0,
      "cashtags": [],
      "url": "https://x.com/BryzonX/status/2047810128607584632"
    },
    {
      "id": "2047809646883471856",
      "text": "RT @amazonnews: https://t.co/gyTXUJRWDu",
      "created_at": "Apr 25, 08:47 AEST",
      "likes": 0,
      "retweets": 68,
      "replies": 0,
      "cashtags": [],
      "url": "https://x.com/BryzonX/status/2047809646883471856"
    },
    {
      "id": "2047790779763237162",
      "text": "@roy_salman289 I haven't sold a share if that means anything",
      "created_at": "Apr 25, 07:32 AEST",
      "likes": 1,
      "retweets": 0,
      "replies": 0,
      "cashtags": [],
      "url": "https://x.com/BryzonX/status/2047790779763237162"
    },
    {
      "id": "2047790595847156056",
      "text": "I hold this to be true to this day https://t.co/SH0qYCvuds",
      "created_at": "Apr 25, 07:31 AEST",
      "likes": 2,
      "retweets": 0,
      "replies": 0,
      "cashtags": [],
      "url": "https://x.com/BryzonX/status/2047790595847156056"
    },
    {
      "id": "2047789156307546443",
      "text": "$POWI is on the verge of breaking out of a 5 year downtrend off the back of a huge impulse move from HTF support.\n\nPower semi's are starting to heat up as data centers transition to 800v for the new chip cycle.\n\nIf you got in with me at $47, you are sitting 50% in profit and https://t.co/c6RFVS5b3H https://t.co/f3No5k15Z5",
      "created_at": "Apr 25, 07:25 AEST",
      "likes": 6,
      "retweets": 0,
      "replies": 2,
      "cashtags": [
        "$POWI"
      ],
      "url": "https://x.com/BryzonX/status/2047789156307546443"
    },
    {
      "id": "2047778282058481986",
      "text": "@learnallday1 Appreciate you my man! Just sharing ideas as they come.",
      "created_at": "Apr 25, 06:42 AEST",
      "likes": 0,
      "retweets": 0,
      "replies": 0,
      "cashtags": [],
      "url": "https://x.com/BryzonX/status/2047778282058481986"
    },
    {
      "id": "2047762540273570101",
      "text": "@TristanMacinnes Big chilling",
      "created_at": "Apr 25, 05:40 AEST",
      "likes": 1,
      "retweets": 0,
      "replies": 0,
      "cashtags": [],
      "url": "https://x.com/BryzonX/status/2047762540273570101"
    },
    {
      "id": "2047755300581875909",
      "text": "@roy_salman289 Would wait for a pullback on $MXL\n\nDon\u2019t worry, it\u2019s coming. Luckily we\u2019re well positioned for volatility.",
      "created_at": "Apr 25, 05:11 AEST",
      "likes": 0,
      "retweets": 0,
      "replies": 0,
      "cashtags": [
        "$MXL"
      ],
      "url": "https://x.com/BryzonX/status/2047755300581875909"
    },
    {
      "id": "2047755117202690535",
      "text": "@TristanMacinnes Lots of upside on this one. Was down 30% at one point and bought calls now deep ITM!",
      "created_at": "Apr 25, 05:10 AEST",
      "likes": 1,
      "retweets": 0,
      "replies": 1,
      "cashtags": [],
      "url": "https://x.com/BryzonX/status/2047755117202690535"
    },
    {
      "id": "2047750218486280478",
      "text": "$SYNA nice follow through since this tweet\n\nSuper excited for this name moving forward as edge inference becomes a larger TAM as we integrate AI into everyday devices https://t.co/1ugmBjlP93 https://t.co/mYjS4UJd40",
      "created_at": "Apr 25, 04:51 AEST",
      "likes": 5,
      "retweets": 0,
      "replies": 2,
      "cashtags": [
        "$SYNA"
      ],
      "url": "https://x.com/BryzonX/status/2047750218486280478"
    },
    {
      "id": "2047744358573822232",
      "text": "Deep dive on a small cap I\u2019ve been flat on for about a month and doubled down today \n\nComing up",
      "created_at": "Apr 25, 04:27 AEST",
      "likes": 6,
      "retweets": 0,
      "replies": 2,
      "cashtags": [],
      "url": "https://x.com/BryzonX/status/2047744358573822232"
    },
    {
      "id": "2047727994488369546",
      "text": "@P_Earns24 This IS financial advice.",
      "created_at": "Apr 25, 03:22 AEST",
      "likes": 3,
      "retweets": 0,
      "replies": 1,
      "cashtags": [],
      "url": "https://x.com/BryzonX/status/2047727994488369546"
    },
    {
      "id": "2047725386734415872",
      "text": "A lot of people are seeing the $AMD &amp; $INTC run as a short term \"CPU shortage\" move that can't possibly go any longer\n\nIn reality this is a fundamental shift in the AI evolution as a whole\n\nFor years, $NVDA dominated the training industry as models started to collect data and now https://t.co/KgdFA8856Q",
      "created_at": "Apr 25, 03:12 AEST",
      "likes": 7,
      "retweets": 0,
      "replies": 0,
      "cashtags": [
        "$AMD",
        "$INTC",
        "$NVDA"
      ],
      "url": "https://x.com/BryzonX/status/2047725386734415872"
    },
    {
      "id": "2047721809035088331",
      "text": "RT @BryzonX: The CPU shortage is here... $AMD is positioned to be the next big winner in 2026 \u23f3\n\nData center CPU shortages are emerging as\u2026",
      "created_at": "Apr 25, 02:58 AEST",
      "likes": 0,
      "retweets": 1,
      "replies": 0,
      "cashtags": [
        "$AMD"
      ],
      "url": "https://x.com/BryzonX/status/2047721809035088331"
    },
    {
      "id": "2047718452325167120",
      "text": "$PENG breaking out of its 8 year base \ud83d\udc40\n\nDon't underestimate a HTF breakout https://t.co/cLAO8SMSkD https://t.co/bg8BRoXm34",
      "created_at": "Apr 25, 02:44 AEST",
      "likes": 1,
      "retweets": 0,
      "replies": 0,
      "cashtags": [
        "$PENG"
      ],
      "url": "https://x.com/BryzonX/status/2047718452325167120"
    },
    {
      "id": "2047713809763275201",
      "text": "@LogicalThesis $PENG looks so primed",
      "created_at": "Apr 25, 02:26 AEST",
      "likes": 1,
      "retweets": 0,
      "replies": 0,
      "cashtags": [
        "$PENG"
      ],
      "url": "https://x.com/BryzonX/status/2047713809763275201"
    },
    {
      "id": "2047713622466642408",
      "text": "@bubbleboi Goals",
      "created_at": "Apr 25, 02:25 AEST",
      "likes": 0,
      "retweets": 0,
      "replies": 0,
      "cashtags": [],
      "url": "https://x.com/BryzonX/status/2047713622466642408"
    }
  ]
} as const satisfies Record<AuthorKey, readonly Tweet[]>;

export const farsideHtml = "<div class=\"farside-section\">\n  <div class=\"farside-section-header\">\n    <span class=\"farside-logo\">FARSIDE</span>\n    <h3>Bitcoin ETF Net Flows \u00b7 Last 10 Days (US$ millions)</h3>\n    <span class=\"farside-fetched\">Fetched 2026-04-27 08:50 AEST</span>\n    <a class=\"farside-link\" href=\"https://farside.co.uk/btc/\" target=\"_blank\" rel=\"noopener noreferrer\">farside.co.uk \u2197</a>\n  </div>\n  <div class=\"farside-wrap\">\n<table class=\"farside\">\n  <thead>\n    <tr>\n      <th>Date</th>\n      <th>IBIT</th>\n      <th>FBTC</th>\n      <th>BITB</th>\n      <th>ARKB</th>\n      <th>BTCO</th>\n      <th>EZBC</th>\n      <th>BRRR</th>\n      <th>HODL</th>\n      <th>BTCW</th>\n      <th>MSBT</th>\n      <th>GBTC</th>\n      <th>BTC</th>\n      <th class=\"total\">Total</th>\n    </tr>\n  </thead>\n  <tbody>\n  <tr>\n    <td>13 Apr 2026</td>\n    <td class=\"pos\">34.7</td>\n    <td class=\"neg\">(229.2)</td>\n    <td class=\"pos\">11.9</td>\n    <td class=\"neg\">(62.9)</td>\n    <td class=\"zero\">0.0</td>\n    <td class=\"zero\">0.0</td>\n    <td class=\"zero\">0.0</td>\n    <td class=\"neg\">(2.6)</td>\n    <td class=\"zero\">0.0</td>\n    <td class=\"pos\">6.3</td>\n    <td class=\"neg\">(38.2)</td>\n    <td class=\"neg\">(11.0)</td>\n    <td class=\"total neg\">(291.0)</td>\n  </tr>\n  <tr>\n    <td>14 Apr 2026</td>\n    <td class=\"pos\">213.8</td>\n    <td class=\"pos\">45.3</td>\n    <td class=\"pos\">12.5</td>\n    <td class=\"pos\">113.1</td>\n    <td class=\"zero\">0.0</td>\n    <td class=\"zero\">0.0</td>\n    <td class=\"zero\">0.0</td>\n    <td class=\"pos\">6.3</td>\n    <td class=\"zero\">0.0</td>\n    <td class=\"pos\">15.5</td>\n    <td class=\"zero\">0.0</td>\n    <td class=\"pos\">4.9</td>\n    <td class=\"total pos\">411.4</td>\n  </tr>\n  <tr>\n    <td>15 Apr 2026</td>\n    <td class=\"pos\">291.9</td>\n    <td class=\"neg\">(47.3)</td>\n    <td class=\"neg\">(8.5)</td>\n    <td class=\"neg\">(42.2)</td>\n    <td class=\"zero\">0.0</td>\n    <td class=\"zero\">0.0</td>\n    <td class=\"zero\">0.0</td>\n    <td class=\"neg\">(3.7)</td>\n    <td class=\"zero\">0.0</td>\n    <td class=\"pos\">19.3</td>\n    <td class=\"neg\">(23.4)</td>\n    <td class=\"zero\">0.0</td>\n    <td class=\"total pos\">186.1</td>\n  </tr>\n  <tr>\n    <td>16 Apr 2026</td>\n    <td class=\"pos\">81.7</td>\n    <td class=\"neg\">(36.0)</td>\n    <td class=\"zero\">0.0</td>\n    <td class=\"neg\">(27.4)</td>\n    <td class=\"zero\">0.0</td>\n    <td class=\"zero\">0.0</td>\n    <td class=\"zero\">0.0</td>\n    <td class=\"zero\">0.0</td>\n    <td class=\"zero\">0.0</td>\n    <td class=\"pos\">13.4</td>\n    <td class=\"neg\">(22.3)</td>\n    <td class=\"pos\">16.7</td>\n    <td class=\"total pos\">26.1</td>\n  </tr>\n  <tr>\n    <td>17 Apr 2026</td>\n    <td class=\"pos\">284.0</td>\n    <td class=\"pos\">163.4</td>\n    <td class=\"pos\">38.2</td>\n    <td class=\"pos\">117.9</td>\n    <td class=\"pos\">3.9</td>\n    <td class=\"zero\">0.0</td>\n    <td class=\"zero\">0.0</td>\n    <td class=\"pos\">6.6</td>\n    <td class=\"zero\">0.0</td>\n    <td class=\"pos\">16.6</td>\n    <td class=\"pos\">4.2</td>\n    <td class=\"pos\">29.1</td>\n    <td class=\"total pos\">663.9</td>\n  </tr>\n  <tr>\n    <td>20 Apr 2026</td>\n    <td class=\"pos\">256.0</td>\n    <td class=\"neg\">(6.6)</td>\n    <td class=\"zero\">0.0</td>\n    <td class=\"zero\">0.0</td>\n    <td class=\"zero\">0.0</td>\n    <td class=\"zero\">0.0</td>\n    <td class=\"pos\">5.8</td>\n    <td class=\"zero\">0.0</td>\n    <td class=\"zero\">0.0</td>\n    <td class=\"pos\">8.1</td>\n    <td class=\"neg\">(24.9)</td>\n    <td class=\"zero\">0.0</td>\n    <td class=\"total pos\">238.4</td>\n  </tr>\n  <tr>\n    <td>21 Apr 2026</td>\n    <td class=\"pos\">39.3</td>\n    <td class=\"neg\">(6.6)</td>\n    <td class=\"neg\">(12.7)</td>\n    <td class=\"neg\">(14.5)</td>\n    <td class=\"zero\">0.0</td>\n    <td class=\"zero\">0.0</td>\n    <td class=\"zero\">0.0</td>\n    <td class=\"neg\">(4.3)</td>\n    <td class=\"zero\">0.0</td>\n    <td class=\"pos\">10.8</td>\n    <td class=\"neg\">(17.5)</td>\n    <td class=\"pos\">17.3</td>\n    <td class=\"total pos\">11.8</td>\n  </tr>\n  <tr>\n    <td>22 Apr 2026</td>\n    <td class=\"pos\">246.9</td>\n    <td class=\"pos\">56.7</td>\n    <td class=\"pos\">15.4</td>\n    <td class=\"pos\">11.9</td>\n    <td class=\"zero\">0.0</td>\n    <td class=\"zero\">0.0</td>\n    <td class=\"zero\">0.0</td>\n    <td class=\"pos\">3.9</td>\n    <td class=\"pos\">6.3</td>\n    <td class=\"pos\">11.3</td>\n    <td class=\"neg\">(16.6)</td>\n    <td class=\"zero\">0.0</td>\n    <td class=\"total pos\">335.8</td>\n  </tr>\n  <tr>\n    <td>23 Apr 2026</td>\n    <td class=\"pos\">167.5</td>\n    <td class=\"neg\">(16.9)</td>\n    <td class=\"neg\">(7.6)</td>\n    <td class=\"pos\">71.2</td>\n    <td class=\"zero\">0.0</td>\n    <td class=\"zero\">0.0</td>\n    <td class=\"zero\">0.0</td>\n    <td class=\"neg\">(5.5)</td>\n    <td class=\"zero\">0.0</td>\n    <td class=\"pos\">9.4</td>\n    <td class=\"zero\">0.0</td>\n    <td class=\"pos\">5.2</td>\n    <td class=\"total pos\">223.3</td>\n  </tr>\n  <tr>\n    <td>24 Apr 2026</td>\n    <td class=\"pos\">22.9</td>\n    <td class=\"neg\">(1.7)</td>\n    <td class=\"neg\">(8.9)</td>\n    <td class=\"neg\">(9.0)</td>\n    <td class=\"zero\">0.0</td>\n    <td class=\"zero\">0.0</td>\n    <td class=\"zero\">0.0</td>\n    <td class=\"zero\">0.0</td>\n    <td class=\"zero\">0.0</td>\n    <td class=\"pos\">11.1</td>\n    <td class=\"zero\">0.0</td>\n    <td class=\"zero\">0.0</td>\n    <td class=\"total pos\">14.4</td>\n  </tr>\n  <tr class=\"summary\">\n    <td>Cumulative</td>\n    <td class=\"pos\">65,365</td>\n    <td class=\"pos\">11,043</td>\n    <td class=\"pos\">2,127</td>\n    <td class=\"pos\">1,615</td>\n    <td class=\"pos\">249</td>\n    <td class=\"pos\">375</td>\n    <td class=\"pos\">331</td>\n    <td class=\"pos\">1,164</td>\n    <td class=\"pos\">92</td>\n    <td class=\"pos\">184</td>\n    <td class=\"neg\">(26,215)</td>\n    <td class=\"pos\">2,257</td>\n    <td class=\"total pos\">58,587</td>\n  </tr>\n  </tbody>\n</table>\n  </div>\n</div>\n<!-- FARSIDE:END -->\n\n<div class=\"summary-bar\">\n  <div class=\"summary-card\"><div class=\"label\">Watching</div><div class=\"value blue\" id=\"totalCount\">0</div></div>\n  <div class=\"summary-card\"><div class=\"label\">Gainers</div><div class=\"value green\" id=\"bullishCount\">0</div></div>\n  <div class=\"summary-card\"><div class=\"label\">Losers</div><div class=\"value red\" id=\"bearishCount\">0</div></div>\n  <div class=\"summary-card\"><div class=\"label\">Avg Change</div><div class=\"value\" id=\"avgChange\">\u2014</div></div>\n  <div class=\"summary-card\"><div class=\"label\">Avg Upside to Target</div><div class=\"value\" id=\"avgUpside\">\u2014</div></div>\n</div>";

export const autopilotPortfolios = [
  {
    id: "sikand-asymmetric-bets",
    ownerKey: "sikand",
    ownerName: "Michael Sikand",
    title: "Asymmetric Bets",
    status: "tracked",
    returnAllTime: 54.2,
    source: "Autopilot screenshots provided 2026-04-25",
    updatedAt: "2026-04-25",
    holdings: [
      { ticker: "VIAV", weight: 27, company: "Viavi Solutions" },
      { ticker: "MU", weight: 17, company: "Micron Technology" },
      { ticker: "AVEX", weight: 16, company: "Aviat/AVEX watchlist holding" },
      { ticker: "BE", weight: 14, company: "Bloom Energy" },
      { ticker: "AAOI", weight: 13, company: "Applied Optoelectronics" },
      { ticker: "FLY", weight: 13, company: "Firefly Aerospace" },
    ],
  },
  {
    id: "wolff-flagship-fund",
    ownerKey: "wolff",
    ownerName: "Peter Wolff",
    title: "Wolff's Flagship Fund",
    status: "tracked",
    returnAllTime: null,
    source: "User-provided Wolff's Flagship Fund screenshots; displayed weights are rounded by the source app",
    updatedAt: "2026-04-27",
    holdings: [
      { ticker: "SGOV", weight: 10 },
      { ticker: "GLTR", weight: 9 },
      { ticker: "IREN", weight: 9 },
      { ticker: "CIFR", weight: 7 },
      { ticker: "MSFT", weight: 6 },
      { ticker: "META", weight: 6 },
      { ticker: "AMZN", weight: 5 },
      { ticker: "WULF", weight: 5 },
      { ticker: "ELV", weight: 4 },
      { ticker: "AVGO", weight: 4 },
      { ticker: "NBIS", weight: 4 },
      { ticker: "GRAB", weight: 4 },
      { ticker: "MELI", weight: 4 },
      { ticker: "LLY", weight: 4 },
      { ticker: "BN", weight: 4 },
      { ticker: "NVDA", weight: 4 },
      { ticker: "AMD", weight: 4 },
      { ticker: "PLTR", weight: 3 },
      { ticker: "MCO", weight: 3 },
      { ticker: "REGN", weight: 3 },
    ],
  },
  {
    id: "venu-semiconductor-stage-1",
    ownerKey: "venu",
    ownerName: "Venu",
    title: "Semiconductor Stage 1 Base Watchlist",
    status: "tracked",
    returnAllTime: null,
    source: "User-provided screenshots from Venu's semiconductor Stage 1 base thread",
    updatedAt: "2026-04-27",
    holdings: [
      { ticker: "ENTG", weight: 10, note: "watch" },
      { ticker: "ICHR", weight: 10, note: "watch" },
      { ticker: "PENG", weight: 10, note: "watch" },
      { ticker: "NVTS", weight: 10, note: "watch" },
      { ticker: "AOSL", weight: 10, note: "watch" },
      { ticker: "SYNA", weight: 10, note: "watch" },
      { ticker: "CRDO", weight: 10, note: "watch" },
      { ticker: "GFS", weight: 10, note: "watch" },
      { ticker: "PLAB", weight: 10, note: "watch" },
      { ticker: "COHU", weight: 10, note: "watch" },
    ],
  },
] as const satisfies readonly AutopilotPortfolio[];
