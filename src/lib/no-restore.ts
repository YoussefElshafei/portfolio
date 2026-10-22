/**
 * Spread onto a <button> whose `disabled` changes while the page is in use.
 *
 * Firefox remembers form controls' state across a reload and puts it back
 * before React hydrates, so a button that was enabled when the visitor
 * reloaded comes back enabled while React expects it disabled, which is a
 * hydration mismatch. `autocomplete="off"` opts the control out. React's
 * button type doesn't list the attribute, hence a spread rather than a prop.
 */
export const NO_RESTORE = { autoComplete: "off" } as const;
