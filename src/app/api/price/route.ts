import { NextResponse } from "next/server";

// GET /api/price?asset=stock|crypto&symbol=AAPL or BTC
export async function GET(req: Request) {
  const url = new URL(req.url);
  const asset = (url.searchParams.get("asset") || "").toLowerCase();
  const symbol = (url.searchParams.get("symbol") || "").toUpperCase().trim();

  if (!asset || !symbol) {
    return NextResponse.json({ error: "Missing asset or symbol" }, { status: 400 });
  }

  try {
    if (asset === "stock") {
      const key = process.env.ALPHA_VANTAGE_API_KEY;
      if (!key) return NextResponse.json({ error: "Missing ALPHA_VANTAGE_API_KEY" }, { status: 500 });
      const sp = new URLSearchParams({ function: "GLOBAL_QUOTE", symbol, apikey: key });
      const res = await fetch(`https://www.alphavantage.co/query?${sp.toString()}`);
      const json = await res.json();
      const q = json?.["Global Quote"] || {};
      const price = parseFloat(q["05. price"] || q["05. Price"] || q["price"] || "NaN");
      const ts = q["07. latest trading day"] || q["latest trading day"] || new Date().toISOString().slice(0, 10);
      if (!Number.isFinite(price)) {
        return NextResponse.json({ error: "No price from Alpha Vantage" }, { status: 502 });
      }
      return NextResponse.json({ asset: "stock", symbol, price, currency: q["08. previous close"] ? "USD" : "USD", time: ts, source: "alpha_vantage_global_quote" });
    }

    if (asset === "crypto") {
      // Use Binance public price (USDT-based); assume USD≈USDT
      const pair = `${symbol}USDT`;
      const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${pair}`);
      if (!res.ok) return NextResponse.json({ error: `Binance error ${res.status}` }, { status: 502 });
      const json = (await res.json()) as { symbol: string; price: string };
      const price = parseFloat(json.price);
      if (!Number.isFinite(price)) {
        return NextResponse.json({ error: "No price from Binance" }, { status: 502 });
      }
      return NextResponse.json({ asset: "crypto", symbol, price, currency: "USD", time: new Date().toISOString(), source: "binance_ticker_USDT" });
    }

    return NextResponse.json({ error: "Unsupported asset" }, { status: 400 });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
