/**
 * Shared between the desktop top nav (NavLinks) and the mobile slide-over
 * (MobileMenu) so both render the same three workspaces from one source.
 */
export interface NavLink {
  href: string;
  label: string;
}

export interface NavGroup {
  label: string;
  href: string;
  links: NavLink[];
}

/** Reachable via the logo everywhere, and its own entry in both nav surfaces. */
export const HOME_LINK: NavLink = { href: "/home", label: "Home" };

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Time & Activity",
    href: "/capture",
    links: [{ href: "/capture", label: "Quick Capture" }],
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
      { href: "/team", label: "Team" },
    ],
  },
];

export function isNavActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function activeNavGroup(pathname: string): NavGroup | null {
  return NAV_GROUPS.find((group) => group.links.some((link) => isNavActive(pathname, link.href))) ?? null;
}
