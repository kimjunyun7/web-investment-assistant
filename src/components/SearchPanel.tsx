"use client";
import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import ReportDisplay from "@/components/ReportDisplay";
import TradingViewChart from "@/components/TradingViewChart";

type AssetType = "stock" | "crypto";

const LEVELS = [
  { id: 1, label: "기간 1 (~1개월)" },
  { id: 2, label: "기간 2 (1~3개월)" },
  { id: 3, label: "기간 3 (3~6개월)" },
  { id: 4, label: "기간 4 (6~12개월)" },
  { id: 5, label: "기간 5 (12개월~)" },
];

type StockSuggestion = {
  kind: "stock";
  symbol: string;
  name: string;
  region?: string;
  currency?: string;
};

type CryptoSuggestion = {
  kind: "crypto";
  id: string; // coingecko id
  symbol: string; // e.g., BTC
  name: string; // e.g., Bitcoin
};

type Suggestion = StockSuggestion | CryptoSuggestion;

export default function SearchPanel() {
  const [query, setQuery] = useState("");
  // Asset 유형 버튼 제거: 선택한 제안에서 자산 유형을 추론합니다
  const [level, setLevel] = useState<number>(3);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loadingSuggest, setLoadingSuggest] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Suggestion | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pollAttemptsRef = useRef<number>(0);

  // Analyze result state
  const [analyzing, setAnalyzing] = useState(false);
  const [reportStatus, setReportStatus] = useState<"idle" | "pending" | "completed" | "failed">("idle");
  const [reportData, setReportData] = useState<unknown | null>(null);
  const [lastSubmitted, setLastSubmitted] = useState<{ symbol: string; asset: AssetType } | null>(null);

  // API response types
  type ReportResponse = {
    id: string;
    status: "pending" | "completed" | "failed";
    report_data?: unknown;
    created_at?: string;
    updated_at?: string;
    error?: string;
  };

  const analyzeWith = async (ticker: string, assetKind: AssetType) => {
    if (!ticker) return;

    // Reset state
    setAnalyzing(true);
    setReportStatus("pending");
    setReportData(null);

    try {
      type AnalyzeOK = { search_id: string; report_id: string };
      type AnalyzeErr = { error: string };
      type AnalyzeResp = AnalyzeOK | AnalyzeErr;
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker,
          asset_type: assetKind,
          investment_level: level,
        }),
      });
      const data: AnalyzeResp = await res.json();
      if (!res.ok) throw new Error("분석 요청 실패");
      if ("error" in data) throw new Error(data.error);
      const { report_id } = data;
      setLastSubmitted({ symbol: ticker, asset: assetKind });

      // Start polling
      pollTimerRef.current && clearInterval(pollTimerRef.current);
      pollAttemptsRef.current = 0;
      pollTimerRef.current = setInterval(async () => {
        try {
          const r = await fetch(`/api/report?id=${encodeURIComponent(report_id)}`);
          if (r.status === 404) {
            // Record might not be visible yet due to eventual consistency — keep polling a bit
            pollAttemptsRef.current += 1;
            if (pollAttemptsRef.current > 20) {
              setReportStatus("failed");
              setReportData({ error: "보고서를 찾을 수 없습니다 (타임아웃)" });
              if (pollTimerRef.current) clearInterval(pollTimerRef.current);
              setAnalyzing(false);
            }
            return;
          }
          const j: ReportResponse = await r.json();
          if (!r.ok) throw new Error(j.error || "보고서 조회 실패");
          setReportStatus(j.status);
          if (j.status === "completed" || j.status === "failed") {
            // Normalize payload: our API stores { aggregated, news, report }
            const payload = (j.report_data as any) || null;
            const gemini = payload && typeof payload === "object" && "report" in (payload as Record<string, unknown>)
              ? (payload as Record<string, unknown>)["report"]
              : payload;
            setReportData(gemini ?? null);
            if (pollTimerRef.current) clearInterval(pollTimerRef.current);
            setAnalyzing(false);
          }
        } catch (err) {
          if (err instanceof DOMException && err.name === "AbortError") return;
          // Stop polling on hard error
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          setAnalyzing(false);
          setReportStatus("failed");
          setReportData({ error: err instanceof Error ? err.message : String(err) });
        }
      }, 3000);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setAnalyzing(false);
      setReportStatus("failed");
      setReportData({ error: err instanceof Error ? err.message : String(err) });
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    // 사용자는 제안 목록에서 선택해야 합니다. 엔터/버튼 제출 막기
    e.preventDefault();
  };

  // Debounced search when query or asset changes
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setOpen(false);
      setSelected(null);
      setSuggestError(null);
      return;
    }

    const handler = setTimeout(async () => {
      try {
        abortRef.current?.abort();
        const ac = new AbortController();
        abortRef.current = ac;
        setLoadingSuggest(true);
        setSuggestError(null);
        // 주식/코인 동시 검색 후 병합
        const [stocksRes, cryptoRes] = await Promise.all([
          fetch(`/api/search/stocks?q=${encodeURIComponent(q)}&sort=cap`, { signal: ac.signal }).catch(() => null),
          fetch(`/api/search/crypto?q=${encodeURIComponent(q)}`, { signal: ac.signal }).catch(() => null),
        ]);

        let merged: Suggestion[] = [];
        if (stocksRes) {
          const data = await stocksRes.json();
          if (stocksRes.ok) {
            type StockAPIItem = { symbol: string; name: string; region?: string; currency?: string };
            const items = ((data.items ?? []) as StockAPIItem[]).map((it) => ({
              kind: "stock",
              symbol: it.symbol,
              name: it.name,
              region: it.region,
              currency: it.currency,
            } as StockSuggestion));
            merged = merged.concat(items);
          }
        }
        if (cryptoRes) {
          const data = await cryptoRes.json();
          if (cryptoRes.ok) {
            type CryptoAPIItem = { id: string; symbol: string; name: string };
            const items = ((data.items ?? []) as CryptoAPIItem[]).map((it) => ({
              kind: "crypto",
              id: it.id,
              symbol: String(it.symbol || "").toUpperCase(),
              name: it.name,
            } as CryptoSuggestion));
            merged = merged.concat(items);
          }
        }

        setSuggestions(merged);
        setOpen(true);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setSuggestions([]);
        setSuggestError(err instanceof Error ? err.message : String(err));
        setOpen(true); // 오류도 드롭다운에 표시
      } finally {
        setLoadingSuggest(false);
      }
    }, 500);

    return () => clearTimeout(handler);
  }, [query]);

  // Close suggestions on outside click
  const containerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  // 통합 검색으로 자산 유형을 구분하지 않기 때문에 고정 placeholder를 사용합니다.

  const sticky = reportStatus !== "idle";

  return (
    <div className="w-full flex flex-col items-center gap-6">
      {/* Brand/title */}
      <div
        className={clsx(
          "w-full max-w-5xl z-20",
          sticky ? "sticky top-0 bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/50 border-b border-black/10 dark:border-white/15" : ""
        )}
      >
        <div className={clsx("mx-auto flex items-center gap-4 px-2", sticky ? "py-3" : "py-10 justify-center")}> 
          <div className={clsx("font-semibold tracking-tight select-none", sticky ? "text-2xl" : "text-5xl sm:text-7xl")}> 
            <span className="text-[#4285F4]">W</span>
            <span className="text-[#EA4335]">I</span>
            <span className="text-[#FBBC05]">A</span>
          </div>
        </div>
      </div>

      {/* Search bar */}
      <form
        onSubmit={onSubmit}
        className="w-full max-w-3xl mx-auto flex flex-col items-center gap-4"
      >
        <div ref={containerRef} className="w-full relative">
          <div className="w-full rounded-full border border-black/10 dark:border-white/15 bg-white/80 dark:bg-black/30 backdrop-blur-sm px-5 py-3 flex items-center gap-3 shadow-sm focus-within:shadow-md transition-shadow">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="opacity-60"
          >
            <path
              d="M21 21L16.65 16.65M19 11.5C19 15.09 16.09 18 12.5 18C8.91 18 6 15.09 6 11.5C6 7.91 8.91 5 12.5 5C16.09 5 19 7.91 19 11.5Z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={"종목/코인명을 입력하세요 (예: Apple, 삼성전자, Bitcoin)"}
            className="flex-1 bg-transparent outline-none text-base"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
              }
            }}
          />
          </div>

          {/* Autocomplete dropdown */}
          {open && (
            <div className="absolute left-0 right-0 mt-2 rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-neutral-900 shadow-lg overflow-hidden z-10">
              {loadingSuggest && (
                <div className="px-4 py-3 text-sm opacity-70">검색 중…</div>
              )}
              {!loadingSuggest && suggestError && (
                <div className="px-4 py-3 text-xs text-red-500">{suggestError}</div>
              )}
              {!loadingSuggest && !suggestError && (
                <ul className="max-h-80 overflow-auto">
                  {suggestions.length === 0 ? (
                    <li className="px-4 py-3 text-sm opacity-70">결과 없음</li>
                  ) : (
                    suggestions.map((s, idx) => (
                      <li key={idx}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelected(s);
                            setQuery(s.name);
                            setOpen(false);
                            // 제안 클릭 시 즉시 분석 시작
                            const ticker = s.symbol;
                            void analyzeWith(ticker, s.kind);
                          }}
                          className="w-full text-left px-4 py-3 hover:bg-black/5 dark:hover:bg-white/5 flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xs px-2 py-0.5 rounded-full border border-black/10 dark:border-white/15">
                              {s.kind === "stock" ? s.symbol : s.symbol}
                            </span>
                            <span className="font-medium">{s.name}</span>
                          </div>
                          {s.kind === "stock" && (
                            <span className="text-xs opacity-60">{s.region} · {s.currency}</span>
                          )}
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Investment Level pills */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          {LEVELS.map((lv) => (
            <button
              type="button"
              key={lv.id}
              onClick={() => setLevel(lv.id)}
              className={clsx(
                "px-3 py-1 rounded-full text-sm border transition-colors",
                level === lv.id
                  ? "bg-foreground text-background border-transparent"
                  : "border-black/10 dark:border-white/15 hover:bg-black/5 dark:hover:bg-white/5"
              )}
              aria-pressed={level === lv.id}
            >
              {lv.label}
            </button>
          ))}
        </div>
      </form>

      {/* Minimal results / status area */}
      <div className="w-full max-w-5xl grid gap-6">
        {reportStatus !== "idle" && (
          <div className="mt-6 grid gap-6">
            {/* Result header */}
            {lastSubmitted && (
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm">
                  <span className="font-medium mr-2">결과</span>
                  <span className="text-xs px-2 py-0.5 rounded-full border border-black/10 dark:border-white/15 mr-2">
                    {lastSubmitted.asset === "crypto" ? "코인" : "주식"}
                  </span>
                  <span className="font-mono">{lastSubmitted.symbol.toUpperCase()}</span>
                </div>
                <button
                  type="button"
                  onClick={() => lastSubmitted && analyzeWith(lastSubmitted.symbol, lastSubmitted.asset)}
                  disabled={analyzing}
                  className={clsx(
                    "text-xs h-8 px-3 rounded-full border transition-colors",
                    analyzing
                      ? "opacity-60 cursor-not-allowed border-black/10 dark:border-white/15"
                      : "border-black/10 dark:border-white/15 hover:bg-black/5 dark:hover:bg-white/5"
                  )}
                >
                  {analyzing ? "분석 중…" : "다시 시도"}
                </button>
              </div>
            )}
            <div className="rounded-xl border border-black/10 dark:border-white/15 p-4">
              <div className="text-sm mb-2">
                상태: {reportStatus}
                {analyzing && <span className="ml-2 animate-pulse opacity-70">분석 중...</span>}
              </div>
              {/* Pretty report */}
              {reportData && <ReportDisplay report={reportData} />}
              {/* Raw fallback if needed */}
              {!reportData && (
                <div className="text-xs opacity-70">결과를 불러오는 중...</div>
              )}
            </div>

            {/* TradingView Chart */}
            {lastSubmitted && (
              <div className="">
                <div className="text-sm font-medium mb-2">차트</div>
                <TradingViewChart
                  symbol={
                    lastSubmitted.asset === "crypto"
                      ? `${lastSubmitted.symbol.toUpperCase()}USD`
                      : lastSubmitted.symbol.toUpperCase()
                  }
                  interval={"D"}
                  theme={"dark"}
                  height={520}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* 통합 검색: 자산 유형 버튼 제거 */}
    </div>
  );
}
