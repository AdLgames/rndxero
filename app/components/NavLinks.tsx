"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/projects", label: "Projects" },
  { href: "/capture", label: "Capture" },
  { href: "/planner", label: "Planner" },
  { href: "/board", label: "Board" },
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
            aria-current={active ? "page" : undefined}
            className={`relative py-[6px] text-[13.5px] tracking-[-0.01em] transition-colors duration-150 ${
              active
                ? "font-[590] text-text after:absolute after:-bottom-[14px] after:left-[-2px] after:right-[-2px] after:h-[2px] after:rounded-[2px] after:bg-accent"
                : "font-[500] text-text-secondary hover:text-text"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </>
  );
}
