"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Three workspace groups instead of seven flat links (spec: "Consolidated
 * Dashboard Architecture") — each groups screens that already exist as
 * separate routes, rather than merging them into single pages. That keeps
 * every screen's tested behaviour intact while giving the nav the feel of
 * three workspaces: log time, manage the technical record, and prep the
 * claim.
 */
const GROUPS = [
  {
    label: "Time & Activity",
    href: "/capture",
    links: [
      { href: "/capture", label: "Capture" },
      { href: "/planner", label: "Planner" },
      { href: "/github", label: "GitHub" },
    ],
  },
  {
    label: "Technical Register",
    href: "/projects",
    links: [
      { href: "/projects", label: "Projects" },
      { href: "/board", label: "Board" },
    ],
  },
  {
    label: "Finance & Claim Prep",
    href: "/finance",
    links: [
      { href: "/finance", label: "Finance" },
      { href: "/export", label: "Export" },
    ],
  },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function activeGroup(pathname: string) {
  return GROUPS.find((group) => group.links.some((link) => isActive(pathname, link.href))) ?? null;
}

/** The three primary group tabs. */
export function NavLinks() {
  const pathname = usePathname();
  const current = activeGroup(pathname);

  return (
    <>
      {GROUPS.map((group) => {
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

/** The active group's sub-links — a second, thinner row beneath the primary tabs. */
export function NavSubLinks() {
  const pathname = usePathname();
  const group = activeGroup(pathname);
  if (!group) return null;

  return (
    <>
      {group.links.map((link) => {
        const active = isActive(pathname, link.href);
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
