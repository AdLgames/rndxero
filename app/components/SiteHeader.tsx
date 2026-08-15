import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { NavLinks, NavSubLinks } from "./NavLinks";
import { NewProjectDrawer } from "./NewProjectDrawer";
import { MobileMenu } from "./MobileMenu";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}

/**
 * The in-shell nav bar for every authenticated screen — lives inside the
 * white shell card built by app/(app)/layout.tsx, not as a page-wide
 * header above it. Redirects to /login itself (rather than letting each
 * screen do it) since every (app)/* route requires a session.
 */
export async function SiteHeader() {
  const cookieStore = await cookies();
  const currentUser = await getCurrentUser(prisma, cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!currentUser) {
    redirect("/login");
  }

  const ownerCompanyIds = currentUser.memberships.filter((m) => m.role === "OWNER").map((m) => m.companyId);
  const ownerCompanies = ownerCompanyIds.length
    ? await prisma.company.findMany({ where: { id: { in: ownerCompanyIds } }, select: { id: true, name: true } })
    : [];

  return (
    <div className="border-b border-black/[.06] bg-white/80 backdrop-blur-[20px] backdrop-saturate-[180%]">
      <nav className="flex items-center gap-4 px-4 pt-[18px] pb-[10px] sm:gap-7 sm:px-8">
        <Link href="/home" className="mr-[6px] text-[17px] font-[700] tracking-[-0.025em] text-text">
          Trace
        </Link>

        <span className="hidden items-center gap-7 md:flex">
          <NavLinks />
        </span>

        <span className="ml-auto flex items-center gap-[10px] sm:gap-[14px]">
          <NewProjectDrawer companies={ownerCompanies} />
          <Link href="/account" className="hidden items-center gap-[10px] md:flex">
            <span className="text-[13px] text-text-tertiary">{currentUser.email}</span>
            <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-accent-tint text-[11px] font-[640] text-accent">
              {initials(currentUser.name)}
            </span>
          </Link>
          <Link
            href="/account"
            className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-accent-tint text-[11px] font-[640] text-accent md:hidden"
          >
            {initials(currentUser.name)}
          </Link>
          <form action="/api/auth/signout" method="POST" className="hidden md:block">
            <button type="submit" className="text-[13px] font-[500] text-text-tertiary hover:text-text">
              Sign out
            </button>
          </form>
          <MobileMenu email={currentUser.email} initials={initials(currentUser.name)} />
        </span>
      </nav>
      <div className="hidden items-center gap-5 px-8 pb-[12px] pl-[46px] md:flex">
        <NavSubLinks />
      </div>
    </div>
  );
}
