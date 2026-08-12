import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { NavLinks, NavSubLinks } from "./NavLinks";
import { NewProjectDrawer } from "./NewProjectDrawer";
import { PulseIcon } from "./icons";

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
      <nav className="flex items-center gap-7 px-8 pt-[18px] pb-[10px]">
        <Link href="/projects" className="mr-[6px] flex items-center gap-[9px] text-[15px] font-[640] tracking-[-0.02em] text-text">
          <span className="flex h-[22px] w-[22px] items-center justify-center rounded-[7px] bg-accent text-white">
            <PulseIcon />
          </span>
          Trace
        </Link>

        <NavLinks />

        <span className="ml-auto flex items-center gap-[14px]">
          <NewProjectDrawer companies={ownerCompanies} />
          <span className="text-[13px] text-text-tertiary">{currentUser.email}</span>
          <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-accent-tint text-[11px] font-[640] text-accent">
            {initials(currentUser.name)}
          </span>
          <form action="/api/auth/signout" method="POST">
            <button type="submit" className="text-[13px] font-[500] text-text-tertiary hover:text-text">
              Sign out
            </button>
          </form>
        </span>
      </nav>
      <div className="flex items-center gap-5 px-8 pb-[12px] pl-[46px]">
        <NavSubLinks />
      </div>
    </div>
  );
}
