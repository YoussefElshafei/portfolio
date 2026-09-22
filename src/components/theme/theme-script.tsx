/**
 * Runs before first paint, in <head>, synchronously.
 *
 * Resolution order (DESIGN_BRIEF.md §3.2):
 *   1. an explicit choice the visitor previously made (localStorage)
 *   2. the OS preference
 *   3. dark, which is the default for this site
 *
 * Because this sets data-theme before the body is painted there is no
 * flash-of-wrong-theme, and because globals.css only transitions colours while
 * [data-theme-transition] is set, this initial write cannot animate either.
 */
const script = `(function(){try{var r=document.documentElement,s=localStorage.getItem("theme");r.dataset.theme=(s==="light"||s==="dark")?s:(window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark")}catch(e){document.documentElement.dataset.theme="dark"}})()`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
