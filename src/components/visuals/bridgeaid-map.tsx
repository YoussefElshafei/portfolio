"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useMemo, useState } from "react";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import {
  DISASTER_TYPES,
  HAMILTON,
  REPORT_LOCATIONS,
  SAMPLE_INCIDENTS,
  type DisasterType,
  type LatLng,
} from "@/data/bridgeaid-demo";

/**
 * The BridgeAid map demo itself. Loaded only in the browser (Leaflet needs
 * `window`) and only once it is near the viewport; see bridgeaid-demo.tsx.
 *
 * Pins are inline-SVG divIcons rather than Leaflet's default marker images.
 * The default icon is a PNG referenced by a relative URL that bundlers break,
 * and a single SVG shape in two colours is lighter and crisper anyway.
 *
 * Red and blue are the demo's semantic pin colours (system sample vs. user
 * report), requested explicitly. They are map furniture, like the tiles, not
 * site accents, so they deliberately sit outside the palette tokens.
 */

const PIN = (fill: string) =>
  L.divIcon({
    className: "", // Leaflet's default class adds a white square behind it.
    iconSize: [22, 30],
    iconAnchor: [11, 29],
    popupAnchor: [0, -26],
    html: `<svg width="22" height="30" viewBox="0 0 22 30" aria-hidden="true"><path d="M11 29C11 29 21 17.6 21 11A10 10 0 0 0 1 11C1 17.6 11 29 11 29Z" fill="${fill}" stroke="#ffffff" stroke-width="1.5"/><circle cx="11" cy="11" r="3.5" fill="#ffffff"/></svg>`,
  });

const RED = PIN("#d6453d");
const BLUE = PIN("#2f6fd6");

type Report = { id: number; type: DisasterType; place: string; at: LatLng };

const field =
  "rounded-trace border border-hairline bg-substrate px-2 py-1.5 text-micro text-silk focus-visible:border-copper";

export default function BridgeAidMap() {
  const [formOpen, setFormOpen] = useState(false);
  const [type, setType] = useState<DisasterType>(DISASTER_TYPES[0]);
  const [placeIndex, setPlaceIndex] = useState(0);
  const [reports, setReports] = useState<readonly Report[]>([]);

  // A phone swipe over the map should scroll the page, not pan the map, or
  // the map becomes a trap in the middle of the page. Touch users still get
  // the zoom buttons and the popups.
  const coarse = useMemo(
    () => window.matchMedia("(pointer: coarse)").matches,
    [],
  );

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const place = REPORT_LOCATIONS[placeIndex];
    // Several reports at the same preset would stack exactly on top of each
    // other. Nudge each repeat a little north-east so all of them show.
    const repeats = reports.filter((r) => r.place === place.name).length;
    const at: LatLng = [
      place.at[0] + repeats * 0.0012,
      place.at[1] + repeats * 0.0016,
    ];
    setReports((prev) => [
      ...prev,
      { id: prev.length + 1, type, place: place.name, at },
    ]);
    setFormOpen(false);
  };

  return (
    <div>
      {/*
        `isolate` gives the map its own stacking context. Leaflet's panes and
        controls use z-indexes up to 1000, which would otherwise paint over
        the sticky site header (z-40) as the page scrolls past.
      */}
      <div className="isolate overflow-hidden rounded-trace border border-hairline">
        <MapContainer
          center={HAMILTON as [number, number]}
          zoom={12}
          scrollWheelZoom={false}
          dragging={!coarse}
          className="h-80 w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            // The single-host URL OSM asks for; the a/b/c subdomains are
            // deprecated. It is also the only third-party origin the CSP in
            // next.config.ts allows.
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {SAMPLE_INCIDENTS.map((s) => (
            <Marker key={s.id} position={s.at as [number, number]} icon={RED}>
              <Popup>
                <strong>{s.type}</strong>
                <br />
                {s.label}
              </Popup>
            </Marker>
          ))}
          {reports.map((r) => (
            <Marker
              key={r.id}
              position={r.at as [number, number]}
              icon={BLUE}
              // Open the new pin's popup straight away, so the result of the
              // submit is unmistakable.
              eventHandlers={{ add: (e) => e.target.openPopup() }}
            >
              <Popup>
                <strong>{r.type}</strong>
                <br />
                {r.place}
                <br />
                <em>User reported</em>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        {!formOpen && (
          <button
            type="button"
            onClick={() => setFormOpen(true)}
            className="inline-flex cursor-pointer items-center gap-2 rounded-trace border border-hairline px-3 py-1.5 text-micro text-silk-dim hover:border-edge hover:text-copper"
          >
            Report an incident
          </button>
        )}
        {reports.length > 0 && (
          <span className="text-micro text-silk-faint">
            {/* The count is a machine fact (§2.6). */}
            <span className="font-mono">{reports.length}</span>{" "}
            {reports.length === 1 ? "report" : "reports"} added this session
          </span>
        )}
      </div>

      {formOpen && (
        <form
          onSubmit={submit}
          className="mt-3 flex flex-wrap items-end gap-3 rounded-trace border border-hairline bg-surface p-3"
        >
          <label className="flex flex-col gap-1 text-micro text-silk-dim">
            What happened
            <select
              value={type}
              onChange={(e) => setType(e.target.value as DisasterType)}
              className={field}
            >
              {DISASTER_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-micro text-silk-dim">
            Where
            <select
              value={placeIndex}
              onChange={(e) => setPlaceIndex(Number(e.target.value))}
              className={field}
            >
              {REPORT_LOCATIONS.map((l, i) => (
                <option key={l.name} value={i}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex gap-2">
            <button
              type="submit"
              className="cursor-pointer rounded-trace border border-copper bg-copper px-3 py-1.5 text-micro font-semibold text-substrate hover:opacity-85"
            >
              Drop pin
            </button>
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="cursor-pointer rounded-trace border border-hairline px-3 py-1.5 text-micro text-silk-dim hover:border-edge hover:text-silk"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
