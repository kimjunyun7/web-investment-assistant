import { fetchTimeSeries, fetchIndicator, Timeframe } from "@/lib/providers/alphaVantage";
import { fetchNews, type NewsItem } from "@/lib/providers/serper";
import { generateReport, type GeminiReport } from "@/lib/providers/gemini";

export interface AnalyzeInput {
  ticker: string;
  assetType: "stock" | "crypto";
  investmentLevel: number; // 1..5
}

export type AggregatedData = {
  marketData: Record<string, unknown>;
  indicators: Record<string, unknown>;
};

export interface AnalyzeOutput {
  aggregated: AggregatedData;
  news: NewsItem[];
  report: GeminiReport;
}

const TIMEFRAMES: Timeframe[] = ["1h", "6h", "12h", "1d", "3d", "1w", "1m", "1y"];

export async function runAnalysis(input: AnalyzeInput): Promise<AnalyzeOutput> {
  // 1) Fetch time series across timeframes
  const marketData: Record<string, unknown> = {};
  for (const tf of TIMEFRAMES) {
    try {
      marketData[tf] = await fetchTimeSeries({
        symbol: input.ticker,
        assetType: input.assetType,
        timeframe: tf,
      });
    } catch (e) {
      marketData[tf] = { error: (e as Error).message };
    }
  }

  // 2) Fetch a set of indicators (AV free tier supports many; include common ones)
  const indicators: Record<string, unknown> = {};
  const indicatorList = [
    { func: "BBANDS", interval: "daily", series_type: "close", time_period: "20" },
    { func: "RSI", interval: "daily", series_type: "close", time_period: "14" },
    { func: "MACD", interval: "daily", series_type: "close" },
    { func: "SMA", interval: "daily", series_type: "close", time_period: "50" },
    { func: "EMA", interval: "daily", series_type: "close", time_period: "200" },
  ];
  for (const ind of indicatorList) {
    try {
      indicators[ind.func] = await fetchIndicator({
        symbol: input.ticker,
        indicator: ind.func,
        interval: ind.interval,
        series_type: ind.series_type,
        time_period: ind.time_period,
      });
    } catch (e) {
      indicators[ind.func] = { error: (e as Error).message };
    }
  }

  // 3) News via Serper
  let news: NewsItem[] = [];
  try {
    news = await fetchNews(input.ticker, 10);
  } catch (e) {
    news = [
      {
        title: "Error fetching news",
        link: "#",
        snippet: (e as Error).message,
      },
    ];
  }

  const aggregated: AggregatedData = {
    marketData,
    indicators,
  };

  // 4) Gemini report
  const report = await generateReport({
    ticker: input.ticker,
    assetType: input.assetType,
    investmentLevel: input.investmentLevel,
    marketData: aggregated,
    news,
  });

  return { aggregated, news, report };
}
