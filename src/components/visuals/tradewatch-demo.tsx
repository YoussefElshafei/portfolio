"use client";

import { useId, useState, type KeyboardEvent } from "react";
import { DemoFrame } from "@/components/ui/demo-frame";
import { PipelineDiagram } from "@/components/visuals/pipeline";
import { LiveSignal } from "@/components/visuals/live-signal";
import { BacktestLab } from "@/components/visuals/backtest-lab";

/**
 * TradeWatch's three demos behind one row of tabs, so the project shows one
 * panel at a time instead of three stacked ones. Panels stay mounted while
 * hidden: each keeps its state, and the live chart's own visibility check
 * pauses it when its tab is not showing.
 */

const TABS = [
  { id: "pipeline", label: "Pipeline" },
  { id: "signal", label: "Anomaly check" },
  { id: "backtest", label: "Backtest" },
] as const;
type Tab = (typeof TABS)[number]["id"];

export function TradeWatchDemo() {
  const id = useId();
  const [tab, setTab] = useState<Tab>("pipeline");

  // Arrow keys move between tabs, as the ARIA tabs pattern expects.
  const onKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const i = TABS.findIndex((t) => t.id === tab);
    const next =
      TABS[(i + (e.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length];
    setTab(next.id);
    document.getElementById(`${id}-tab-${next.id}`)?.focus();
  };

  return (
    <div className="mt-8 w-full">
      <div
        role="tablist"
        aria-label="TradeWatch demos"
        className="flex gap-1 border-b border-hairline"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            id={`${id}-tab-${t.id}`}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            aria-controls={`${id}-panel-${t.id}`}
            tabIndex={tab === t.id ? 0 : -1}
            onClick={() => setTab(t.id)}
            onKeyDown={onKey}
            className={`-mb-px min-h-11 cursor-pointer border-b-2 px-3 text-micro transition-colors ${
              tab === t.id
                ? "border-copper text-silk"
                : "border-transparent text-silk-faint hover:text-silk"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {TABS.map((t) => (
        <div
          key={t.id}
          id={`${id}-panel-${t.id}`}
          role="tabpanel"
          aria-labelledby={`${id}-tab-${t.id}`}
          hidden={tab !== t.id}
          className="*:mt-4"
        >
          {t.id === "pipeline" && (
            <DemoFrame
              label="TradeWatch · Kafka pipeline"
              meta="6 consumer groups · own offsets"
              caption={
                <>
                  The real topology, read from TradeWatch&apos;s worker modules:
                  three consumer groups read the trades topic, the aggregator
                  turns trades into one-minute bars on a second topic, and the
                  anomaly detector&apos;s flags reach the alert dispatcher
                  through a third. Each group keeps its own offset, so a stopped
                  one falls behind without slowing anyone else and catches up
                  when it restarts. Simplified: one symbol, minutes end when you
                  say so, no paper-trading strategy is deployed (so no fills),
                  and a bar counts as unusual when it holds a spike, where the
                  real detector scores it against recent history.
                </>
              }
            >
              <PipelineDiagram />
            </DemoFrame>
          )}
          {t.id === "signal" && <LiveSignal />}
          {t.id === "backtest" && <BacktestLab />}
        </div>
      ))}
    </div>
  );
}
