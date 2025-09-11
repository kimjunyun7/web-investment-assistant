"use client";
import { useEffect, useRef } from "react";

declare global {
  interface Window {
    TradingView?: {
      widget: (options: Record<string, unknown>) => void;
    };
  }
}

export type TVChartProps = {
  symbol: string; // e.g., AAPL or BTCUSD
  height?: number;
  interval?: string; // e.g., "60", "D"
  theme?: "light" | "dark";
};

export default function TradingViewChart({ symbol, height = 520, interval = "D", theme = "dark" }: TVChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const scriptId = "tradingview-widget-script";
    const existing = document.getElementById(scriptId) as HTMLScriptElement | null;

    const initWidget = () => {
      if (!window.TradingView || !containerRef.current) return;

      // Clear previous instance content (TV rewrites innerHTML)
      containerRef.current.innerHTML = "";

      // Use 'new' per TradingView embed docs
      // eslint-disable-next-line new-cap
      new window.TradingView.widget({
        autosize: true,
        symbol,
        interval,
        timezone: "Etc/UTC",
        theme,
        style: "1",
        locale: "en",
        toolbar_bg: "rgba(0, 0, 0, 0)",
        enable_publishing: false,
        hide_top_toolbar: false,
        hide_legend: false,
        container_id: `tv-container-${symbol}`,
      });
    };

    if (existing) {
      initWidget();
    } else {
      const script = document.createElement("script");
      script.id = scriptId;
      script.src = "https://s3.tradingview.com/tv.js";
      script.type = "text/javascript";
      script.onload = () => initWidget();
      document.body.appendChild(script);
    }

    return () => {
      // No explicit dispose API for this embed; rely on unmount
    };
  }, [symbol, interval, theme]);

  return (
    <div className="rounded-xl border border-black/10 dark:border-white/15 overflow-hidden">
      <div
        id={`tv-container-${symbol}`}
        ref={containerRef}
        style={{ width: "100%", height }}
      />
    </div>
  );
}
