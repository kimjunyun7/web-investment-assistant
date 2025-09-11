"use client";
import { useEffect, useRef } from "react";

// Minimal typings for the global TradingView widget namespace
type TVWidgetConfig = {
    autosize?: boolean;
    symbol: string;
    interval?: string | number;
    timezone?: string;
    theme?: string;
    style?: string | number;
    locale?: string;
    toolbar_bg?: string;
    enable_publishing?: boolean;
    hide_top_toolbar?: boolean;
    hide_legend?: boolean;
    allow_symbol_change?: boolean;
    save_image?: boolean;
    studies?: string[];
    // Add studies_overrides to the type definition
    studies_overrides?: Record<string, unknown>;
    container_id: string;
    height?: number;
};

type TVWidgetConstructor = new (config: TVWidgetConfig) => unknown;
type TVNamespace = { widget: TVWidgetConstructor };

declare global {
    interface Window {
        TradingView: TVNamespace;
    }
}

export type TVChartProps = {
    symbol: string; // e.g., AAPL or BTCUSD
    height?: number;
    interval?: string; // e.g., "60", "D"
    theme?: "light" | "dark";
};

export default function TradingViewChart({
    symbol,
    height = 520,
    interval = "D",
    theme = "dark",
}: TVChartProps) {
    const containerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!containerRef.current) return;

        const scriptId = "tradingview-widget-script";
        const existing = document.getElementById(
            scriptId
        ) as HTMLScriptElement | null;

        const initWidget = () => {
            if (!window.TradingView || !containerRef.current) return;

            // Clear previous instance content (TV rewrites innerHTML)
            containerRef.current.innerHTML = "";

            // Use 'new' per TradingView embed docs
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
                // --- Start of Changes ---
                // 1. Add Ichimoku Cloud as a default study
                studies: ["IchimokuCloud@tv-basicstudies"],
                // 2. Configure the visibility of the Ichimoku Cloud lines
                studies_overrides: {
                    "IchimokuCloud.plots.conversion.visible": false,
                    "IchimokuCloud.plots.base.visible": false,
                    "IchimokuCloud.plots.lagging.visible": false,
                    "IchimokuCloud.plots.lead_a.visible": true,
                    "IchimokuCloud.plots.lead_b.visible": true,
                },
                // --- End of Changes ---
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
