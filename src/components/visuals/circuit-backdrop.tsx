/**
 * Ambient circuit backdrop — DESIGN_BRIEF.md §2.7
 *
 * A faint field of PCB traces behind the whole page, drifting very slowly,
 * with an occasional pulse of copper running along one of the long traces.
 * It extends the board the trace bus and project graph are drawn on; it is
 * not a separate motif.
 *
 * All CSS, no JavaScript and no canvas (see "CIRCUIT BACKDROP" in
 * globals.css). This is a Server Component that renders four empty elements.
 *
 * Decorative only: aria-hidden, pointer-events none, behind everything.
 */
export function CircuitBackdrop() {
  return (
    <div aria-hidden="true" className="circuit-backdrop">
      <div className="circuit-grid">
        <span className="circuit-pulse circuit-pulse-h" />
        <span className="circuit-pulse circuit-pulse-v" />
      </div>
    </div>
  );
}
