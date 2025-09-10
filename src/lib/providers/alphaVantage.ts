const BASE_URL = "https://www.alphavantage.co/query";

export type Timeframe =
  | "1h"
  | "6h"
  | "12h"
  | "1d"
  | "3d"
  | "1w"
  | "1m"
  | "1y";

export type AssetMarket = "US" | "KR" | "CRYPTO";

function tfToFunction(tf: Timeframe, assetType: "stock" | "crypto") {
  if (assetType === "crypto") {
    switch (tf) {
      case "1h":
        return { func: "CRYPTO_INTRADAY", interval: "60min" };
      case "6h":
        return { func: "CRYPTO_INTRADAY", interval: "60min" };
      case "12h":
        return { func: "CRYPTO_INTRADAY", interval: "60min" };
      case "1d":
      case "3d":
      case "1w":
      case "1m":
      case "1y":
        return { func: "DIGITAL_CURRENCY_DAILY" };
    }
  } else {
    // stocks/ETFs
    switch (tf) {
      case "1h":
        return { func: "TIME_SERIES_INTRADAY", interval: "60min" };
      case "6h":
        return { func: "TIME_SERIES_INTRADAY", interval: "60min" };
      case "12h":
        return { func: "TIME_SERIES_INTRADAY", interval: "60min" };
      case "1d":
      case "3d":
      case "1w":
      case "1m":
      case "1y":
        return { func: "TIME_SERIES_DAILY_ADJUSTED" };
    }
  }
}

export async function fetchTimeSeries(params: {
  symbol: string;
  assetType: "stock" | "crypto";
  timeframe: Timeframe;
  market?: AssetMarket; // for KR tickers mapping is up to caller
}) {
  const key = process.env.ALPHA_VANTAGE_API_KEY;
  if (!key) throw new Error("Missing ALPHA_VANTAGE_API_KEY");

  const map = tfToFunction(params.timeframe, params.assetType)!;
  const searchParams = new URLSearchParams();
  searchParams.set("apikey", key);
  searchParams.set("function", map.func);

  if (params.assetType === "crypto") {
    searchParams.set("symbol", params.symbol);
    searchParams.set("market", "USD");
    if (map.interval) searchParams.set("interval", map.interval);
  } else {
    searchParams.set("symbol", params.symbol);
    if (map.interval) searchParams.set("interval", map.interval);
  }

  const res = await fetch(`${BASE_URL}?${searchParams.toString()}`);
  if (!res.ok) throw new Error(`Alpha Vantage error ${res.status}`);
  return res.json();
}

export async function fetchIndicator(params: {
  symbol: string;
  indicator: string; // e.g., BBANDS, RSI, MACD, etc.
  interval?: string; // e.g., 60min, daily
  series_type?: string; // close/open/high/low
  time_period?: string;
}) {
  const key = process.env.ALPHA_VANTAGE_API_KEY;
  if (!key) throw new Error("Missing ALPHA_VANTAGE_API_KEY");

  const sp = new URLSearchParams();
  sp.set("apikey", key);
  sp.set("function", params.indicator);
  sp.set("symbol", params.symbol);
  if (params.interval) sp.set("interval", params.interval);
  if (params.series_type) sp.set("series_type", params.series_type);
  if (params.time_period) sp.set("time_period", params.time_period);

  const res = await fetch(`${BASE_URL}?${sp.toString()}`);
  if (!res.ok) throw new Error(`Alpha Vantage error ${res.status}`);
  return res.json();
}
