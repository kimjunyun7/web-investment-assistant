import { NextResponse } from "next/server";

// Alpha Vantage SYMBOL_SEARCH for equities
// Docs: https://www.alphavantage.co/documentation/#symbolsearch
export async function GET(req: Request) {
  const url = new URL(req.url);
  const query = url.searchParams.get("q")?.trim();
  if (!query) return NextResponse.json({ items: [] });

  const key = process.env.ALPHA_VANTAGE_API_KEY;
  if (!key) return NextResponse.json({ error: "Missing ALPHA_VANTAGE_API_KEY" }, { status: 500 });

  const sp = new URLSearchParams({ function: "SYMBOL_SEARCH", keywords: query, apikey: key });
  const res = await fetch(`https://www.alphavantage.co/query?${sp.toString()}`);
  if (!res.ok) return NextResponse.json({ error: `Alpha Vantage error ${res.status}` }, { status: 502 });
  const json = await res.json();

  // Map to a common suggestion shape
  const items = (json?.bestMatches || []).map((m: Record<string, string>) => ({
    symbol: m["1. symbol"],
    name: m["2. name"],
    region: m["4. region"],
    currency: m["8. currency"],
    type: m["3. type"],
  }));

  return NextResponse.json({ items });
}
