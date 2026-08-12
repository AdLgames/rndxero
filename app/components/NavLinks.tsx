"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HOME_LINK, NAV_GROUPS, activeNavGroup, isNavActive } from "./nav-groups";

/**
 * Three workspace groups instead of seven flat links (spec: "Consolidated
 * Dashboard Architecture") — each groups screens that already exist as
 * separate routes, rather than merging them into single pages. That keeps
 * every screen's tested behaviour intact while giving the nav the feel of
 * three workspaces: log time, manage the technical record, and prep the
 * claim. Home sits outside the groups — it's a standalone destination, not
 * a workspace with sub-screens.
 */

/** Desktop only (hidden on mobile — see MobileMenu) — the primary group tabs, plus Home. */
export function NavLinks() {
  const pathname = usePathname();
  const current = activeNavGroup(pathname);
  const onHome = isNavActive(pathname, HOME_LINK.href);

  return (
    <>
      <Link
        href={HOME_LINK.href}
        aria-current={onHome ? "page" : undefined}
        className={`relative py-[6px] text-[13.5px] tracking-[-0.01em] transition-colors duration-150 ${
          onHome
            ? "font-[590] text-text after:absolute after:-bottom-[14px] after:left-[-2px] after:right-[-2px] after:h-[2px] after:rounded-[2px] after:bg-accent"
            : "font-[500] text-text-secondary hover:text-text"
        }`}
      >
        {HOME_LINK.label}
      </Link>
      {NAV_GROUPS.map((group) => {
        const active = group === current;
        return (
          <Link
            key={group.label}
            href={group.href}
            aria-current={active ? "page" : undefined}
            className={`relative py-[6px] text-[13.5px] tracking-[-0.01em] transition-colors duration-150 ${
              active
                ? "font-[590] text-text after:absolute after:-bottom-[14px] after:left-[-2px] after:right-[-2px] after:h-[2px] after:rounded-[2px] after:bg-accent"
                : "font-[500] text-text-secondary hover:text-text"
            }`}
          >
            {group.label}
          </Link>
        );
      })}
    </>
  );
}

/** The active group's sub-links — a second, thinner row beneath the primary tabs. Nothing renders on /home, which has no sub-links. */
export function NavSubLinks() {
  const pathname = usePathname();
  const group = activeNavGroup(pathname);
  if (!group) return null;

  return (
    <>
      {group.links.map((link) => {
        const active = isNavActive(pathname, link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`text-[12.5px] tracking-[-0.005em] transition-colors duration-150 ${
              active ? "font-[590] text-accent" : "font-[500] text-text-tertiary hover:text-text"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </>
  );
}
