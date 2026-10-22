"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useMemo, useState } from "react";
import {
  Circle,
  MapContainer,
  Marker,
  TileLayer,
  useMapEvents,
} from "react-leaflet";
import {
  CLUSTER_THRESHOLD,
  COOLDOWN_MIN,
  DISTANCE_THRESHOLD_M,
  INCIDENT_TYPES,
  report,
  type IncidentType,
  type State,
} from "@/lib/bridgeaid";

/**
 * The BridgeAid demo: you are several residents of Hamilton reporting the
 * same emergency, and the map only believes it once enough different people
 * have. Every decision is made by lib/bridgeaid.ts, a port of the real
 * backend's rules, and each one is printed in the log the way the API
 * answers it (201 accepted, 429 duplicate).
 *
 * Loaded only in the browser (Leaflet needs `window`) and only near the
 * viewport; see bridgeaid-demo.tsx.
 *
 * Pin colours are map furniture, like the tiles, so they sit outside the
 * site palette on purpose: one colour per resident, red for a confirmed
 * incident.
 */

const CENTRE: [number, number] = [43.2557, -79.8711];

const PEOPLE = [
  { id: "amira", name: "Amira", colour: "#2f6fd6" },
  { id: "ben", name: "Ben", colour: "#2a9d8f" },
  { id: "chen", name: "Chen", colour: "#9b5de5" },
  { id: "dana", name: "Dana", colour: "#d08c1f" },
] as const;
type PersonId = (typeof PEOPLE)[number]["id"];
const PERSON = Object.fromEntries(PEOPLE.map((p) => [p.id, p])) as Record<
  PersonId,
  (typeof PEOPLE)[number]
>;

const dot = (colour: string, letter: string) =>
  L.divIcon({
    className: "",
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    html: `<svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true"><circle cx="11" cy="11" r="9" fill="${colour}" stroke="#fff" stroke-width="1.5"/><text x="11" y="15" text-anchor="middle" font-family="monospace" font-size="11" fill="#fff">${letter}</text></svg>`,
  });

const confirmedPin = (count: number) =>
  L.divIcon({
    className: "",
    iconSize: [28, 36],
    iconAnchor: [14, 35],
    html: `<svg width="28" height="36" viewBox="0 0 28 36" aria-hidden="true"><path d="M14 35C14 35 27 21 27 13A13 13 0 0 0 1 13C1 21 14 35 14 35Z" fill="#d6453d" stroke="#fff" stroke-width="1.5"/><text x="14" y="17.5" text-anchor="middle" font-family="monospace" font-size="11" font-weight="700" fill="#fff">${count}</text></svg>`,
  });

type LogLine = { id: number; tone: "ok" | "warn" | "win"; text: string };

function Clicks({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) });
  return null;
}

const chip =
  "inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-trace border px-2.5 text-micro pointer-coarse:min-h-11";

export default function BridgeAidMap() {
  const [state, setState] = useState<State>({ reports: [], confirmed: [] });
  const [who, setWho] = useState<PersonId>("amira");
  const [incident, setIncident] = useState<IncidentType>("Flooding");
  const [now, setNow] = useState(0);
  const [log, setLog] = useState<LogLine[]>([]);
  const [last, setLast] = useState<{ lat: number; lng: number } | null>(null);

  // A phone swipe over the map should scroll the page, not pan the map, or
  // the map becomes a trap in the middle of the page. Taps still report.
  const coarse = useMemo(
    () => window.matchMedia("(pointer: coarse)").matches,
    [],
  );

  const push = (tone: LogLine["tone"], text: string) =>
    setLog((l) => [
      ...l.slice(-7),
      { id: Date.now() + Math.random(), tone, text },
    ]);

  function pick(lat: number, lng: number) {
    const [next, out] = report(state, { user: who, incident, lat, lng, now });
    const name = PERSON[who].name;
    if (out.status === 429) {
      push("warn", `429 ${name}: ${out.error}`);
      return;
    }
    setState(next);
    setLast({ lat, lng });
    if (out.confirmed && out.merged) {
      push(
        "win",
        `201 ${name}: merged into the confirmed ${incident.toLowerCase()} (${out.confirmed.verifiedUsers.length} people)`,
      );
    } else if (out.confirmed) {
      push(
        "win",
        `201 ${name}: CONFIRMED, ${CLUSTER_THRESHOLD} different people within ${DISTANCE_THRESHOLD_M} m`,
      );
    } else {
      push(
        "ok",
        `201 ${name}: accepted, ${out.nearbyUsers.length}/${CLUSTER_THRESHOLD} different people nearby`,
      );
    }
    // Hand the phone to the next resident, so the obvious next tap makes
    // progress rather than tripping the cooldown.
    const i = PEOPLE.findIndex((p) => p.id === who);
    setWho(PEOPLE[(i + 1) % PEOPLE.length].id);
  }

  function reset() {
    setState({ reports: [], confirmed: [] });
    setNow(0);
    setLog([]);
    setLast(null);
    setWho("amira");
  }

  return (
    <div className="grid lg:grid-cols-[1fr_20rem] lg:divide-x lg:divide-hairline">
      <div>
        <div className="flex flex-wrap items-center gap-2 border-b border-hairline px-4 py-3">
          <span className="text-micro text-silk-faint">Reporting as</span>
          {PEOPLE.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={who === p.id}
              onClick={() => setWho(p.id)}
              className={`${chip} ${
                who === p.id
                  ? "border-copper text-silk"
                  : "border-hairline text-silk-dim hover:border-edge"
              }`}
            >
              <span
                aria-hidden="true"
                className="size-2.5 rounded-full"
                style={{ background: p.colour }}
              />
              {p.name}
            </button>
          ))}
          <label className="ml-auto flex items-center gap-2 text-micro text-silk-faint">
            <span className="sr-only sm:not-sr-only">Incident</span>
            <select
              value={incident}
              onChange={(e) => setIncident(e.target.value as IncidentType)}
              className="min-h-9 rounded-trace border border-hairline bg-substrate px-2 text-silk pointer-coarse:min-h-11"
            >
              {INCIDENT_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
        </div>

        {/*
          `isolate` gives the map its own stacking context. Leaflet's panes
          and controls use z-indexes up to 1000, which would otherwise paint
          over the sticky site header (z-40) as the page scrolls past.
        */}
        <div className="relative isolate">
          <MapContainer
            center={CENTRE}
            zoom={15}
            scrollWheelZoom={false}
            dragging={!coarse}
            className="h-96 w-full cursor-crosshair"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              // The single-host URL OSM asks for, and the only third-party
              // origin the CSP in next.config.ts allows.
              url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <Clicks onPick={pick} />
            {last && (
              <Circle
                center={[last.lat, last.lng]}
                radius={DISTANCE_THRESHOLD_M}
                pathOptions={{
                  color: "#2f6fd6",
                  weight: 1,
                  dashArray: "4 4",
                  fillOpacity: 0.06,
                }}
              />
            )}
            {state.confirmed.map((c) => (
              <Circle
                key={`zone-${c.id}`}
                center={[c.lat, c.lng]}
                radius={DISTANCE_THRESHOLD_M}
                pathOptions={{
                  color: "#d6453d",
                  weight: 1.5,
                  fillOpacity: 0.12,
                }}
              />
            ))}
            {state.reports.map((r) => {
              const p = PERSON[r.userId as PersonId];
              return (
                <Marker
                  key={r.id}
                  position={[r.lat, r.lng]}
                  icon={dot(p.colour, p.name[0])}
                  title={`${r.incident} reported by ${p.name}`}
                  interactive={false}
                />
              );
            })}
            {state.confirmed.map((c) => (
              <Marker
                key={c.id}
                position={[c.lat, c.lng]}
                icon={confirmedPin(c.verifiedUsers.length)}
                title={`Confirmed ${c.incident}, ${c.verifiedUsers.length} people`}
                zIndexOffset={1000}
              />
            ))}
          </MapContainer>
          {state.reports.length === 0 && (
            <p className="pointer-events-none absolute inset-x-0 top-3 z-[1000] mx-auto w-fit rounded-trace border border-hairline bg-surface/95 px-3 py-1.5 text-micro text-silk">
              Tap the map to report a {incident.toLowerCase()}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-col">
        <div className="flex items-center justify-between border-y border-hairline px-4 py-2.5 lg:border-t-0">
          <span className="font-mono text-micro text-silk-faint">
            POST /api/incidents · t+{now} min
          </span>
        </div>
        <ol
          aria-live="polite"
          className="flex min-h-40 flex-1 flex-col gap-1.5 px-4 py-3 font-mono text-micro"
        >
          {log.length === 0 && (
            <li className="text-silk-faint">
              One report never reaches the public map. It needs{" "}
              {CLUSTER_THRESHOLD} different people within {DISTANCE_THRESHOLD_M}{" "}
              m. Try reporting twice as the same person.
            </li>
          )}
          {log.map((l) => (
            <li
              key={l.id}
              className={
                l.tone === "warn"
                  ? "text-copper"
                  : l.tone === "win"
                    ? "text-signal"
                    : "text-silk-dim"
              }
            >
              {l.text}
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap gap-2 border-t border-hairline px-4 py-3">
          <button
            type="button"
            onClick={() => {
              setNow((n) => n + COOLDOWN_MIN);
              push("ok", `… ${COOLDOWN_MIN} minutes pass`);
            }}
            className={`${chip} border-edge text-silk-dim hover:border-copper hover:text-copper`}
          >
            Wait {COOLDOWN_MIN} min
          </button>
          <button
            type="button"
            onClick={reset}
            className={`${chip} border-hairline text-silk-faint hover:border-edge hover:text-silk`}
          >
            Reset
          </button>
          <span className="ml-auto self-center font-mono text-micro text-silk-faint">
            {state.reports.length} reports · {state.confirmed.length} confirmed
          </span>
        </div>
      </div>
    </div>
  );
}
