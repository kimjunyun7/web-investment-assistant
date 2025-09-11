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
  const json: { coins?: Array<{ id: string; symbol: string; name: string }> } = await res.json();

  const basic = (json?.coins ?? []).map((c) => ({
    id: c.id,
    symbol: String(c.symbol || "").toUpperCase(),
    name: c.name,
  }));

  // Enrich top N with market cap rank via /coins/markets for better ordering
  const topIds = basic.slice(0, Math.min(10, basic.length)).map((c) => c.id);
  let rankMap: Record<string, number | undefined> = {};
  if (topIds.length) {
    const mr = await fetch(
      `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${encodeURIComponent(topIds.join(","))}&order=market_cap_desc&per_page=${topIds.length}&page=1&sparkline=false`
    );
    if (mr.ok) {
      const arr: Array<{ id: string; market_cap_rank?: number }> = await mr.json();
      rankMap = Object.fromEntries(arr.map((a) => [a.id, a.market_cap_rank]));
    }
  }

  const items = basic
    .map((c) => ({ ...c, market_cap_rank: rankMap[c.id] }))
    .sort((a, b) => {
      const ar = a.market_cap_rank ?? Number.POSITIVE_INFINITY;
      const br = b.market_cap_rank ?? Number.POSITIVE_INFINITY;
      return ar - br; // lower rank = bigger cap
    });

  return NextResponse.json({ items });
}
