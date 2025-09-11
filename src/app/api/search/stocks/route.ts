import { NextResponse } from "next/server";

interface AlphaMatch {
  [key: string]: string | undefined;
  "1. symbol": string;
  "2. name": string;
  "3. type": string;
  "4. region": string;
  "8. currency": string;
  "9. matchScore"?: string;
}

interface AlphaSearchResponse {
  bestMatches?: AlphaMatch[];
}

type StockItem = {
  symbol: string;
  name: string;
  region?: string;
  currency?: string;
  type?: string;
  matchScore?: number;
  marketCap?: number;
};

// Alpha Vantage SYMBOL_SEARCH for equities
// Docs: https://www.alphavantage.co/documentation/#symbolsearch
export async function GET(req: Request) {
  const url = new URL(req.url);
  const query = url.searchParams.get("q")?.trim();
  const wantCap = (url.searchParams.get("sort") || "").toLowerCase() === "cap";
  if (!query) return NextResponse.json({ items: [] });

  const key = process.env.ALPHA_VANTAGE_API_KEY;

  let json: AlphaSearchResponse | null = null;
  if (key) {
    const sp = new URLSearchParams({ function: "SYMBOL_SEARCH", keywords: query, apikey: key });
    try {
      const res = await fetch(`https://www.alphavantage.co/query?${sp.toString()}`);
      if (res.ok) {
        json = await res.json();
      }
    } catch {}
  }

  // Map to a common suggestion shape (include matchScore)
  let base: StockItem[] = (json?.bestMatches || []).map((m: AlphaMatch) => ({
    symbol: m["1. symbol"],
    name: m["2. name"],
    region: m["4. region"],
    currency: m["8. currency"],
    type: m["3. type"],
    matchScore: parseFloat(m["9. matchScore"] || "0") || 0,
  }));

  // Fallback: Yahoo Finance search (unofficial, server-side only).
  if (!base.length) {
    try {
      const y = await fetch(`https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}`, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "application/json",
        },
      });
      if (y.ok) {
        const jy: { quotes?: Array<{
          symbol: string;
          shortname?: string;
          longname?: string;
          exchange?: string;
          currency?: string;
          quoteType?: string;
          marketCap?: number;
        }> } = await y.json();
        const quotes = Array.isArray(jy.quotes) ? jy.quotes : [];
        base = quotes
          .filter((q) => q.quoteType === "EQUITY" || q.quoteType === "ETF")
          .map((q) => ({
            symbol: q.symbol,
            name: q.shortname || q.longname || q.symbol,
            region: q.exchange || "",
            currency: q.currency || "USD",
            type: q.quoteType || "equity",
            matchScore: 1,
            marketCap: q.marketCap as number | undefined,
          }));
      }
    } catch {}
  }

  let items: StockItem[] = base;

  // Optionally enrich top N with market cap (Alpha Vantage OVERVIEW). Beware of rate limits.
  if (wantCap && base.length > 0 && key) {
    const top = base.slice(0, Math.min(5, base.length));
    const enriched = await Promise.all(
      top.map(async (it) => {
        try {
          const ov = new URLSearchParams({ function: "OVERVIEW", symbol: it.symbol, apikey: key });
          const r = await fetch(`https://www.alphavantage.co/query?${ov.toString()}`);
          const j = await r.json();
          const mc = j?.MarketCapitalization ? Number(j.MarketCapitalization) : undefined;
          return { ...it, marketCap: Number.isFinite(mc as number) ? Number(mc) : undefined };
        } catch {
          return { ...it, marketCap: undefined };
        }
      })
    );
    // Merge enriched back with others
    const rest = base.slice(enriched.length);
    items = [...enriched, ...rest];
    // Sort by marketCap desc first, then matchScore desc
    items.sort((a: StockItem, b: StockItem) => {
      const am = a.marketCap ?? -1;
      const bm = b.marketCap ?? -1;
      if (am !== bm) return bm - am;
      return (b.matchScore || 0) - (a.matchScore || 0);
    });
  } else {
    // Fallback sort by matchScore only
    items.sort((a: StockItem, b: StockItem) => (b.matchScore || 0) - (a.matchScore || 0));
  }

  return NextResponse.json({ items });
}
