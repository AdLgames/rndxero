/**
 * Shared Tailwind class strings for Trace's Apple-style design system —
 * plain string exports rather than wrapper components, since most call
 * sites are existing <button>/<input> elements that already carry their
 * own handlers and don't need a new component layer, just consistent
 * classes.
 */

export const eyebrow = "text-[12.5px] text-text-tertiary";

export const buttonPrimary =
  "inline-flex items-center justify-center gap-[7px] rounded-[10px] border-none bg-accent px-[18px] py-[10px] text-[13.5px] font-[590] text-white shadow-[0_1px_2px_rgba(14,122,88,.3)] transition-all duration-150 ease-out hover:bg-accent-hover active:scale-[.985] disabled:opacity-50 disabled:cursor-not-allowed";

export const buttonSecondary =
  "inline-flex items-center justify-center gap-[7px] rounded-[10px] border border-black/[.11] bg-white px-[18px] py-[10px] text-[13.5px] font-[590] text-text transition-all duration-150 ease-out hover:bg-[#FAFAFA] active:scale-[.985] disabled:opacity-50 disabled:cursor-not-allowed";

export const buttonGhost = "text-[13.5px] font-[500] text-accent hover:text-accent-hover";

export const chip =
  "rounded-full bg-control-track px-[13px] py-[7px] text-[13px] font-[500] text-text-secondary transition-all duration-150 ease-out hover:text-text active:scale-[.985]";

export const chipActive = "rounded-full bg-accent px-[13px] py-[7px] text-[13px] font-[590] text-white transition-all duration-150 ease-out active:scale-[.985]";

export const badgeAccent = "inline-flex items-center gap-[5px] rounded-full bg-accent-tint px-[11px] py-[3px] text-[11px] font-[590] text-accent";

export const badgeNeutral = "inline-flex items-center gap-[5px] rounded-full bg-control-track px-[11px] py-[3px] text-[11px] font-[500] text-text-tertiary";

export const fieldLabel = "mb-[6px] block text-[12.5px] text-text-secondary";

export const input =
  "w-full box-border rounded-[10px] border border-black/[.11] bg-white px-[13px] py-[10px] text-[14px] text-text placeholder:text-text-quaternary outline-none transition-colors duration-150";

export const cardRow = "flex items-center justify-between rounded-[14px] border border-black/[.06] bg-surface-sunken px-[22px] py-[20px]";
