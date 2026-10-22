"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { DemoFrame } from "@/components/ui/demo-frame";

/**
 * BridgeAid map demo: the shell.
 *
 * Two kinds of laziness:
 *
 *  1. `ssr: false`. Leaflet reads `window` at import time, so it cannot be
 *     server-rendered at all. Next only allows `ssr: false` inside a Client
 *     Component, which is why this wrapper exists: the project entry that
 *     renders it is a Server Component.
 *  2. Near-viewport. Leaflet and its CSS are ~40KB gzipped plus map tiles.
 *     Nobody reading the hero needs them, so nothing is requested until the
 *     demo is within a screen's height of being visible.
 *
 * The placeholder has the map's exact height, so the page does not shift when
 * the real map replaces it.
 */

const BridgeAidMap = dynamic(
  () => import("@/components/visuals/bridgeaid-map"),
  { ssr: false, loading: () => <Placeholder /> },
);

function Placeholder() {
  return (
    <div className="flex h-[30rem] w-full items-center justify-center text-micro text-silk-faint lg:h-[27rem]">
      Loading map
    </div>
  );
}

export function BridgeAidDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: "100% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    // data-js-only: without JavaScript there is no map to show, and an empty
    // "Loading map" box would promise something that never arrives.
    <div ref={ref} data-js-only>
      <DemoFrame
        label="BridgeAid · report verification"
        meta="200 m · 3 people · 10 min cooldown"
        caption={
          <>
            BridgeAid&apos;s rule for keeping false reports off the public map,
            running in your browser on a port of the real backend code. A report
            is only accepted onto the map once three different people report the
            same kind of incident within 200 metres of each other. The same
            person reporting again within 10 minutes is refused, so one panicked
            user cannot confirm anything alone. In the real app a confirmed
            incident is then also cross-checked against public news by a
            language model; this demo stops before that step. Nothing you tap is
            sent anywhere.
          </>
        }
      >
        {near ? <BridgeAidMap /> : <Placeholder />}
      </DemoFrame>
    </div>
  );
}
