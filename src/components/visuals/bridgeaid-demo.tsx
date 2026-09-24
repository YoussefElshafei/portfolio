"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

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
    <div className="flex h-80 w-full items-center justify-center rounded-trace border border-hairline bg-surface text-micro text-silk-faint">
      Loading map
    </div>
  );
}

export function BridgeAidDemo() {
  const ref = useRef<HTMLElement>(null);
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
    <figure ref={ref} data-js-only className="mt-8 w-full max-w-column">
      {near ? <BridgeAidMap /> : <Placeholder />}
      <figcaption className="mt-3 text-micro text-silk-faint">
        A small working demo of BridgeAid&apos;s core idea, running entirely in
        your browser. The red pins are illustrative sample incidents, not real
        reports. Pins you add are blue, exist only for this visit, and vanish on
        reload: nothing is sent anywhere, and this is not connected to
        BridgeAid&apos;s own backend, which is not deployed.
      </figcaption>
    </figure>
  );
}
