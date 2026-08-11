/**
 * Shared Tailwind class strings for Trace's blueprint design system —
 * plain string exports rather than wrapper components, since most call
 * sites are existing <button>/<input> elements that already carry their
 * own handlers and don't need a new component layer, just consistent
 * classes.
 */

export const eyebrow = "text-xs font-semibold uppercase tracking-widest text-steel-dark";

export const buttonPrimary =
  "border border-steel bg-steel px-4 py-2 text-sm font-semibold uppercase tracking-wide text-white transition-colors hover:bg-steel-dark disabled:opacity-50 disabled:cursor-not-allowed";

export const buttonSecondary =
  "border border-steel/50 bg-white px-4 py-2 text-sm font-semibold uppercase tracking-wide text-steel-dark transition-colors hover:bg-steel/10 disabled:opacity-50 disabled:cursor-not-allowed";

export const buttonGhost =
  "text-xs font-semibold uppercase tracking-wide text-steel-dark underline decoration-steel/50 underline-offset-2 hover:text-steel-dark";

export const chip =
  "border border-steel/40 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-steel-dark transition-colors hover:bg-steel/10";

export const chipActive = "border border-steel bg-steel px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white";

export const badgeSage =
  "inline-block border border-sage bg-sage/10 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-sage-dark";

export const badgeSteel =
  "inline-block border border-steel/50 bg-steel/5 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-steel-dark";

export const badgeNeutral =
  "inline-block border border-black/15 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-foreground/60";

export const fieldLabel = "block text-xs font-semibold uppercase tracking-wide text-steel-dark";

export const input = "mt-1 w-full border border-steel/40 bg-white px-3 py-2 text-sm text-foreground placeholder:text-foreground/35 focus:border-steel focus:outline-none";

export const select = "border border-steel/40 bg-white px-2 py-1.5 text-sm text-foreground focus:border-steel focus:outline-none";
