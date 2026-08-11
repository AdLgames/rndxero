"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/projects", label: "Projects" },
  { href: "/capture", label: "Capture" },
  { href: "/board", label: "Board" },
  { href: "/planner", label: "Planner" },
  { href: "/finance", label: "Finance" },
  { href: "/export", label: "Export" },
  { href: "/github", label: "GitHub" },
];

/** Active nav state needs the current path — the only reason this is split out of the server-rendered SiteHeader. */
export function NavLinks() {
  const pathname = usePathname();

  return (
    <>
      {LINKS.map((link) => {
        const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`px-2 py-1 text-xs font-semibold uppercase tracking-wide transition-colors ${
              active ? "border-b-2 border-sage text-sage-dark" : "text-foreground/60 hover:text-steel-dark"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </>
  );
}
