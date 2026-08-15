"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { HOME_LINK, NAV_GROUPS, isNavActive } from "./nav-groups";
import { MenuIcon, XIcon } from "./icons";

/**
 * Below md, SiteHeader hides its horizontal nav/email/sign-out (see the
 * `hidden md:flex` classes there) and this is the only way to reach them
 * — a single hamburger trigger opening a right-hand slide-over with the
 * full nav (grouped, same source as desktop's NavLinks/NavSubLinks) plus
 * account info and sign-out. Own state (not the drawer pattern's caller)
 * since nothing else needs to know whether it's open.
 *
 * Portalled to document.body: SiteHeader's backdrop-blur makes it a CSS
 * containing block for position:fixed descendants (same rule as
 * transform/filter), so a plain nested `fixed inset-0` here would resolve
 * against the header bar's small box instead of the viewport — the panel
 * would only ever show as a sliver behind the page instead of covering it.
 * No SSR guard needed for the portal target: `open` starts false and only
 * flips true from a click handler, so `document` is always defined by
 * the time this actually renders into it.
 */
export function MobileMenu({ email, initials }: { email: string; initials: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  function linkClass(active: boolean) {
    return `rounded-[9px] px-3 py-[9px] text-[14px] transition-colors duration-150 ${
      active ? "bg-accent-tint font-[590] text-accent" : "font-[500] text-text-secondary hover:bg-control-track hover:text-text"
    }`;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        className="flex h-8 w-8 items-center justify-center rounded-[8px] text-text-secondary hover:bg-control-track hover:text-text md:hidden"
      >
        <MenuIcon />
      </button>

      {open &&
        createPortal(
          <div className="fixed inset-0 z-50 flex justify-end md:hidden">
            <button type="button" aria-label="Close menu" onClick={() => setOpen(false)} className="absolute inset-0 bg-black/[.28] backdrop-blur-[2px]" />
            <div className="relative flex h-full w-full max-w-[320px] flex-col overflow-y-auto bg-white p-6 shadow-[-16px_0_40px_rgba(0,0,0,.12)]">
              <div className="mb-5 flex items-center justify-between">
                <Link href="/account" onClick={() => setOpen(false)} className="flex min-w-0 items-center gap-[10px]">
                  <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-accent-tint text-[12px] font-[640] text-accent">
                    {initials}
                  </span>
                  <span className="truncate text-[13px] text-text-secondary">{email}</span>
                </Link>
                <button type="button" onClick={() => setOpen(false)} aria-label="Close menu" className="shrink-0 text-text-tertiary hover:text-text">
                  <XIcon />
                </button>
              </div>

              <nav className="flex flex-col gap-[3px]">
                <Link href={HOME_LINK.href} onClick={() => setOpen(false)} className={linkClass(isNavActive(pathname, HOME_LINK.href))}>
                  {HOME_LINK.label}
                </Link>

                {NAV_GROUPS.map((group) => (
                  <div key={group.label} className="mt-4 first:mt-4">
                    <p className="px-3 text-[11px] font-[590] uppercase tracking-[.04em] text-text-quaternary">{group.label}</p>
                    <div className="mt-1 flex flex-col gap-[3px]">
                      {group.links.map((link) => (
                        <Link key={link.href} href={link.href} onClick={() => setOpen(false)} className={linkClass(isNavActive(pathname, link.href))}>
                          {link.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </nav>

              <form action="/api/auth/signout" method="POST" className="mt-auto border-t border-black/[.06] pt-4">
                <button type="submit" className="text-[13.5px] font-[500] text-text-tertiary hover:text-text">
                  Sign out
                </button>
              </form>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
