import { ImageResponse } from "next/og";
import { SITE } from "@/config/site";

/**
 * The link preview card.
 *
 * Generated at build time by `next/og` rather than committed as a binary, so
 * it cannot drift out of date when the name or role changes, and there is no
 * 300KB PNG in the repository.
 *
 * Token values are written literally because this renders in a Satori
 * environment with no access to the stylesheet or CSS custom properties. They
 * are the dark-theme values from DESIGN_BRIEF.md §3.2 and must be kept in step
 * with globals.css by hand — the one place in the project where a colour is
 * duplicated.
 */

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = `${SITE.name} — ${SITE.role}`;

const SUBSTRATE = "#0b0e11";
const SILK = "#e6eaee";
const SILK_DIM = "#9aa6b2";
const SILK_FAINT = "#818e9b";
const COPPER = "#f0803c";
const HAIRLINE = "#1e252b";
const EDGE = "#5a646e";

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        backgroundColor: SUBSTRATE,
        color: SILK,
        fontFamily: "sans-serif",
      }}
    >
      {/* The trace bus, redrawn for the card: the same motif as the site. */}
      <div
        style={{
          display: "flex",
          width: 150,
          borderRight: `1px solid ${HAIRLINE}`,
          position: "relative",
        }}
      >
        <svg width="150" height="630" viewBox="0 0 150 630">
          <line
            x1="62"
            y1="150"
            x2="62"
            y2="480"
            stroke={HAIRLINE}
            strokeWidth="2"
          />
          <line
            x1="62"
            y1="150"
            x2="62"
            y2="300"
            stroke={COPPER}
            strokeWidth="2"
          />
          {[210, 270, 330, 390].map((y, i) => (
            <g key={y}>
              <path
                d={`M 62 ${y} H 78 L 92 ${y - 14} H 110`}
                fill="none"
                stroke={i === 1 ? COPPER : HAIRLINE}
                strokeWidth="2"
              />
              <rect
                x="110"
                y={y - 21}
                width="14"
                height="14"
                fill={i === 1 ? COPPER : SUBSTRATE}
                stroke={i === 1 ? COPPER : EDGE}
                strokeWidth="2"
              />
            </g>
          ))}
        </svg>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 72px",
          flex: 1,
        }}
      >
        <div
          style={{ fontSize: 88, fontWeight: 600, letterSpacing: "-0.02em" }}
        >
          {SITE.name}
        </div>
        <div style={{ fontSize: 36, color: SILK_DIM, marginTop: 16 }}>
          {SITE.role}
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 48,
            paddingTop: 28,
            borderTop: `1px solid ${HAIRLINE}`,
            fontSize: 24,
            color: SILK_FAINT,
          }}
        >
          {SITE.location} · {SITE.school}
        </div>
      </div>
    </div>,
    size,
  );
}
