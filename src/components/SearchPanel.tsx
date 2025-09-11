"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";

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
  const [asset, setAsset] = useState<AssetType>("stock");
  const [level, setLevel] = useState<number>(3);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Suggestion | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Analyze result state
  const [analyzing, setAnalyzing] = useState(false);
  const [reportStatus, setReportStatus] = useState<"idle" | "pending" | "completed" | "failed">("idle");
  const [reportData, setReportData] = useState<unknown | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Determine ticker symbol to send
    const ticker = (() => {
      if (selected) {
        if (selected.kind === "stock") return selected.symbol;
        return selected.symbol; // crypto: use symbol like BTC
      }
      // Fallback: use the raw query (trimmed)
      return query.trim();
    })();

    if (!ticker) return;

    // Reset state
    setAnalyzing(true);
    setReportStatus("pending");
    setReportData(null);

    try {
      type AnalyzeResp = { search_id: string; report_id: string } | { error: string };
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker,
          asset_type: asset,
          investment_level: level,
        }),
      });
      const data: AnalyzeResp = await res.json();
      if (!res.ok || (data as any).error) {
        throw new Error(((data as any).error as string) || "분석 요청 실패");
      }
      const { report_id } = data as { search_id: string; report_id: string };

      // Start polling
      pollTimerRef.current && clearInterval(pollTimerRef.current);
      pollTimerRef.current = setInterval(async () => {
        try {
          const r = await fetch(`/api/report?id=${encodeURIComponent(report_id)}`);
          const j = await r.json();
          if (!r.ok) throw new Error(j?.error || "보고서 조회 실패");
          setReportStatus(j.status as typeof reportStatus);
          if (j.status === "completed" || j.status === "failed") {
            setReportData(j.report_data ?? null);
            if (pollTimerRef.current) clearInterval(pollTimerRef.current);
            setAnalyzing(false);
          }
        } catch (err) {
          // Stop polling on hard error
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          setAnalyzing(false);
          setReportStatus("failed");
          setReportData({ error: err instanceof Error ? err.message : String(err) });
        }
      }, 3000);
    } catch (err) {
      setAnalyzing(false);
      setReportStatus("failed");
      setReportData({ error: err instanceof Error ? err.message : String(err) });
    }
  };

  // Debounced search when query or asset changes
  useEffect(() => {
    if (!query.trim()) {
      setSuggestions([]);
      setOpen(false);
      setSelected(null);
      return;
    }

    const handler = setTimeout(async () => {
      try {
        abortRef.current?.abort();
        const ac = new AbortController();
        abortRef.current = ac;
        const url = asset === "stock" ? `/api/search/stocks?q=${encodeURIComponent(query)}` : `/api/search/crypto?q=${encodeURIComponent(query)}`;
        const res = await fetch(url, { signal: ac.signal });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "검색 실패");

        const items: Suggestion[] = (data.items || []).map((it: any) =>
          asset === "stock"
            ? ({ kind: "stock", symbol: it.symbol, name: it.name, region: it.region, currency: it.currency } as StockSuggestion)
            : ({ kind: "crypto", id: it.id, symbol: String(it.symbol || "").toUpperCase(), name: it.name } as CryptoSuggestion)
        );
        setSuggestions(items);
        setOpen(true);
      } catch (err) {
        if ((err as any)?.name === "AbortError") return;
        setSuggestions([]);
        setOpen(false);
      }
    }, 300);

    return () => clearTimeout(handler);
  }, [query, asset]);

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

  const placeholder = useMemo(
    () => (asset === "stock" ? "종목명을 입력하세요 (예: Apple, 삼성전자)" : "코인명을 입력하세요 (예: Bitcoin, 이더리움)"),
    [asset]
  );

  return (
    <div className="w-full flex flex-col items-center gap-6">
      {/* Large brand/title (placeholder for now) */}
      <div className="text-5xl sm:text-7xl font-semibold tracking-tight select-none">
        <span className="text-[#4285F4]">W</span>
        <span className="text-[#EA4335]">I</span>
        <span className="text-[#FBBC05]">A</span>
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
            placeholder={placeholder}
            className="flex-1 bg-transparent outline-none text-base"
          />
          <button
            type="submit"
            className="shrink-0 rounded-full bg-foreground text-background h-10 px-5 text-sm font-medium"
          >
            분석
          </button>
          </div>

          {/* Autocomplete dropdown */}
          {open && suggestions.length > 0 && (
            <div className="absolute left-0 right-0 mt-2 rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-neutral-900 shadow-lg overflow-hidden z-10">
              <ul className="max-h-80 overflow-auto">
                {suggestions.map((s, idx) => (
                  <li key={idx}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelected(s);
                        setQuery(s.name);
                        setOpen(false);
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
                ))}
              </ul>
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
      <div className="w-full max-w-3xl">
        {reportStatus !== "idle" && (
          <div className="mt-6 rounded-xl border border-black/10 dark:border-white/15 p-4">
            <div className="text-sm mb-2">
              상태: {reportStatus}
              {analyzing && <span className="ml-2 animate-pulse opacity-70">분석 중...</span>}
            </div>
            {reportData && (
              <pre className="text-xs overflow-auto max-h-[50vh] whitespace-pre-wrap">
                {JSON.stringify(reportData, null, 2)}
              </pre>
            )}
          </div>
        )}
      </div>

      {/* Large selectors for Asset Type */}
      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-3xl">
        {([
          { key: "stock", title: "주식 / ETF", desc: "한국/미국 주식과 ETF" },
          { key: "crypto", title: "암호화폐", desc: "BTC, ETH 등 주요 코인" },
        ] as const).map((opt) => (
          <button
            type="button"
            key={opt.key}
            onClick={() => setAsset(opt.key)}
            className={clsx(
              "rounded-2xl border p-6 text-left hover:shadow-md transition-shadow",
              asset === opt.key
                ? "border-foreground"
                : "border-black/10 dark:border-white/15"
            )}
            aria-pressed={asset === opt.key}
          >
            <div className="text-lg font-semibold">{opt.title}</div>
            <div className="text-sm opacity-70">{opt.desc}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
