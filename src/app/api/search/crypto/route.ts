import { NextResponse } from "next/server";

// CoinGecko free search for coins by name/symbol
// Docs: https://www.coingecko.com/api/documentations/v3#/search/get_search
export async function GET(req: Request) {
  const url = new URL(req.url);
  const query = url.searchParams.get("q")?.trim();
  if (!query) return NextResponse.json({ items: [] });

  const res = await fetch(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(query)}`, {
    headers: { "Accept": "application/json" },
    // public endpoint; rate-limited — fine for small usage
  });
  if (!res.ok) return NextResponse.json({ error: `CoinGecko error ${res.status}` }, { status: 502 });
  const json = await res.json();

  const items = (json?.coins || []).map((c: any) => ({
    id: c.id as string,
    symbol: String(c.symbol || "").toUpperCase(),
    name: c.name as string,
  }));

  return NextResponse.json({ items });
}
