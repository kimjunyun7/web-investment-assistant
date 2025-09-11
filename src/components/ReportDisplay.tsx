"use client";
import type { InvestmentReportV1 } from "@/lib/providers/gemini";

type Props = {
  report: unknown | null;
};

function isInvestmentReport(r: unknown): r is InvestmentReportV1 {
  if (!r || typeof r !== "object") return false;
  const o = r as Record<string, unknown>;
  return (
    o["version"] === "v1" &&
    typeof o["ticker"] === "string" &&
    "strategy" in o &&
    ("summary_outlook" in o || "technical_analysis" in o)
  );
}

export default function ReportDisplay({ report }: Props) {
  if (!report) return null;

  if (!isInvestmentReport(report)) {
    return null;
  }

  const { technical_analysis, summary_outlook, strategy, _raw, key_levels, indicators_summary, risks, catalysts, confidence } = report;

  const fmtUSD = (v: unknown) => {
    if (typeof v !== "number" || Number.isNaN(v)) return "-";
    try {
      return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(v);
    } catch {
      return `$${v}`;
    }
  };

  return (
    <div className="grid gap-8">
      {/* Summary */}
      <section className="">
        <h3 className="text-base font-semibold mb-2">요약 및 전망</h3>
        <p className="text-sm whitespace-pre-wrap leading-relaxed">
          {typeof summary_outlook === "string" && summary_outlook.trim().length > 0
            ? summary_outlook
            : "모델 요약이 비어 있습니다."}
        </p>
      </section>

      {/* Technical analysis */}
      <section className="">
        <h3 className="text-base font-semibold mb-2">기술적 분석</h3>
        <div className="text-sm whitespace-pre-wrap leading-relaxed">
          {typeof technical_analysis === "string"
            ? technical_analysis
            : JSON.stringify(technical_analysis, null, 2)}
        </div>
        {key_levels && (
          <div className="mt-3 text-sm">
            <div className="opacity-70">주요 레벨</div>
            <div>지지: {(key_levels.support || []).join(", ") || "-"}</div>
            <div>저항: {(key_levels.resistance || []).join(", ") || "-"}</div>
          </div>
        )}
        {indicators_summary && indicators_summary.length > 0 && (
          <div className="mt-3 grid gap-1 text-sm">
            <div className="opacity-70">지표 요약</div>
            {indicators_summary.map((it, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="font-medium">{it.name}</span>
                <span className="opacity-70">{it.value ?? ""}</span>
                <span className="text-xs px-2 py-0.5 rounded-full border">
                  {it.signal}
                </span>
                {it.note && <span className="opacity-70">· {it.note}</span>}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Strategy */}
      <section className="">
        <h3 className="text-base font-semibold mb-2">전략</h3>
        <div className="text-sm grid gap-1 leading-relaxed">
          <div>진입가: {fmtUSD(strategy.entry_price)}</div>
          <div>손절가: {fmtUSD(strategy.stop_loss)}</div>
          <div>근거: {strategy.rationale || "-"}</div>
        </div>
        <div className="mt-3 text-sm opacity-70">신뢰도: {typeof confidence === "number" ? `${confidence}%` : "-"}</div>
      </section>

      {/* Risks & Catalysts */}
      {(risks?.length || catalysts?.length) && (
        <section className="grid gap-4">
          {risks?.length ? (
            <div>
              <h3 className="text-base font-semibold mb-2">리스크</h3>
              <ul className="list-disc pl-5 space-y-1 text-sm">
                {risks.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {catalysts?.length ? (
            <div>
              <h3 className="text-base font-semibold mb-2">촉매</h3>
              <ul className="list-disc pl-5 space-y-1 text-sm">
                {catalysts.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      )}

      {_raw && (
        <section className="">
          <h3 className="text-base font-semibold mb-2">원문/에러</h3>
          <pre className="text-xs whitespace-pre-wrap overflow-auto">{_raw}</pre>
        </section>
      )}
    </div>
  );
}
