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

// Fixed output schema (v1)
export interface InvestmentReportV1 {
  version: "v1";
  ticker: string;
  asset_type: "stock" | "crypto";
  investment_period_level: 1 | 2 | 3 | 4 | 5;
  summary_outlook: string; // 1-3 paragraphs
  technical_analysis: string | Record<string, unknown>; // narrative or structured
  key_levels: {
    support: number[];
    resistance: number[];
  };
  indicators_summary: Array<{
    name: string; // e.g., RSI, MACD, BBANDS
    value?: string | number | null;
    signal: "bullish" | "bearish" | "neutral";
    note?: string;
  }>;
  risks: string[]; // list of notable risks
  catalysts: string[]; // upcoming events/drivers
  confidence: number; // 0..100
  strategy: GeminiStrategy;
  references?: Array<{ title: string; url: string }>;
  _raw?: string; // model raw text (optional)
}

export async function generateReport(input: AnalysisPromptInput): Promise<InvestmentReportV1> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Missing GEMINI_API_KEY");

  const genAI = new GoogleGenerativeAI(apiKey);
  const modelName = process.env.GEMINI_MODEL || "gemini-2.5-pro-preview-03-25";
  const model = genAI.getGenerativeModel({ model: modelName });

  const system = `You are an expert investment analyst. Analyze multi-timeframe market data, technical indicators (BBANDS, RSI, MACD, MAs), and recent news to produce a comprehensive investment report.

IMPORTANT LANGUAGE REQUIREMENT: Write all narrative text in KOREAN (한국어). This includes summary_outlook, technical_analysis (if string), strategy.rationale, risks, catalysts, and any other natural language fields. Keep the JSON KEYS in English exactly as defined below. Use USD for monetary values (do not add currency symbols in JSON values).

Return STRICT JSON that matches exactly this schema (no extra keys, no markdown, no prose outside JSON):
{
  "version": "v1",
  "ticker": string,
  "asset_type": "stock" | "crypto",
  "investment_period_level": 1 | 2 | 3 | 4 | 5,
  "summary_outlook": string,
  "technical_analysis": string | object,
  "key_levels": { "support": number[], "resistance": number[] },
  "indicators_summary": Array<{ "name": string, "value"?: string | number | null, "signal": "bullish" | "bearish" | "neutral", "note"?: string }>,
  "risks": string[],
  "catalysts": string[],
  "confidence": number,
  "strategy": { "entry_price": number | null, "stop_loss": number | null, "rationale": string },
  "references"?: Array<{ "title": string, "url": string }>,
  "_raw"?: string
}`;

  const prompt = [
    system,
    `Ticker: ${input.ticker} (Asset: ${input.assetType}, InvestmentLevel: ${input.investmentLevel})`,
    `MarketData(JSON): ${JSON.stringify(input.marketData).slice(0, 250000)}`,
    `News(JSON): ${JSON.stringify(input.news).slice(0, 80000)}`,
    `Return ONLY the JSON with the exact schema. Do not include code fences. Remember: narrative text must be in Korean.`,
  ].join("\n\n");

  try {
    const result = await model.generateContent({ contents: [{ role: "user", parts: [{ text: prompt }] }] });
    const text = result.response.text();

    // Attempt to parse JSON; if wrapped in code fences, strip them
    const jsonString = text.replace(/^```(json)?/i, "").replace(/```$/, "").trim();
    try {
      const parsed = JSON.parse(jsonString) as InvestmentReportV1;
      // Light validation/coercion to ensure required fields exist
      return {
        version: "version" in parsed ? parsed.version : "v1",
        ticker: parsed.ticker ?? input.ticker,
        asset_type: parsed.asset_type ?? input.assetType,
        investment_period_level: (parsed.investment_period_level as any) ?? (input.investmentLevel as 1 | 2 | 3 | 4 | 5),
        summary_outlook: parsed.summary_outlook ?? "",
        technical_analysis: parsed.technical_analysis ?? "",
        key_levels: parsed.key_levels ?? { support: [], resistance: [] },
        indicators_summary: parsed.indicators_summary ?? [],
        risks: parsed.risks ?? [],
        catalysts: parsed.catalysts ?? [],
        confidence: parsed.confidence ?? 0,
        strategy: parsed.strategy ?? { entry_price: null, stop_loss: null, rationale: "" },
        references: parsed.references ?? [],
        _raw: parsed._raw,
      } as InvestmentReportV1;
    } catch {
      // Fallback structure
      return {
        version: "v1",
        ticker: input.ticker,
        asset_type: input.assetType,
        investment_period_level: input.investmentLevel as 1 | 2 | 3 | 4 | 5,
        summary_outlook: "",
        technical_analysis: text,
        key_levels: { support: [], resistance: [] },
        indicators_summary: [],
        risks: [],
        catalysts: [],
        confidence: 0,
        strategy: { entry_price: null, stop_loss: null, rationale: "" },
        references: [],
        _raw: text,
      };
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    // Return a structured error-like report so callers can persist it
    return {
      version: "v1",
      ticker: input.ticker,
      asset_type: input.assetType,
      investment_period_level: input.investmentLevel as 1 | 2 | 3 | 4 | 5,
      summary_outlook: "",
      technical_analysis: "",
      key_levels: { support: [], resistance: [] },
      indicators_summary: [],
      risks: [],
      catalysts: [],
      confidence: 0,
      strategy: { entry_price: null, stop_loss: null, rationale: "" },
      references: [],
      _raw: `Gemini error: ${message}. Consider setting GEMINI_MODEL=gemini-2.5-pro-preview-03-25 or reducing payload size.`,
    };
  }
}
