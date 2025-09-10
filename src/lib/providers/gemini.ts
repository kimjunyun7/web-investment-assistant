import { GoogleGenerativeAI } from "@google/generative-ai";

export interface AnalysisPromptInput {
  ticker: string;
  assetType: "stock" | "crypto";
  investmentLevel: number; // 1..5
  marketData: unknown; // aggregated json of all timeframes & indicators
  news: Array<{ title: string; link: string; snippet?: string; date?: string; source?: string }>;
}

export type GeminiStrategy = {
  entry_price: number | null;
  stop_loss: number | null;
  rationale: string;
};

export type GeminiReport = {
  technical_analysis: unknown | string;
  summary_outlook: string;
  strategy: GeminiStrategy;
  _raw?: string;
};

export async function generateReport(input: AnalysisPromptInput): Promise<GeminiReport> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Missing GEMINI_API_KEY");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-pro-exp-02-05" });

  const system = `You are an expert investment analyst. You will analyze multi-timeframe market data, technical indicators (including Bollinger Bands, RSI, MACD), and recent news to produce a comprehensive investment report. Structure the response as strict JSON with keys: technical_analysis, summary_outlook, strategy { entry_price, stop_loss, rationale }.`;

  const prompt = [
    system,
    `Ticker: ${input.ticker} (Asset: ${input.assetType}, InvestmentLevel: ${input.investmentLevel})`,
    `MarketData(JSON): ${JSON.stringify(input.marketData).slice(0, 200000)}`,
    `News(JSON): ${JSON.stringify(input.news).slice(0, 50000)}`,
    `Return only JSON. No markdown.`,
  ].join("\n\n");

  const result = await model.generateContent({ contents: [{ role: "user", parts: [{ text: prompt }] }] });
  const text = result.response.text();

  // Attempt to parse JSON; if wrapped in code fences, strip them
  const jsonString = text.replace(/^```(json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(jsonString) as GeminiReport;
  } catch {
    // Fallback structure
    return {
      technical_analysis: text,
      summary_outlook: "",
      strategy: { entry_price: null, stop_loss: null, rationale: "" },
      _raw: text,
    };
  }
}
