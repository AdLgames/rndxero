import Link from "next/link";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { getCurrentUser, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { NavLinks } from "./NavLinks";

/**
 * Always-visible sign-in state, on every page. The one thing signup and
 * magic-link sign-in had no way to confirm on their own — a successful
 * sign-in and an unconfirmed one looked identical, since nothing on
 * screen said which had happened.
 */
export async function SiteHeader() {
  const cookieStore = await cookies();
  const currentUser = await getCurrentUser(prisma, cookieStore.get(SESSION_COOKIE_NAME)?.value);

  return (
    <header className="flex items-center justify-between border-b border-steel/40 bg-white px-6 py-3">
      <Link href="/" className="flex items-center gap-2 text-base font-semibold tracking-wide text-foreground">
        <span className="flex h-5 w-5 items-center justify-center border border-steel text-[10px] font-bold text-steel-dark">
          T
        </span>
        TRACE
      </Link>

      {currentUser ? (
        <nav className="flex items-center gap-4">
          <NavLinks />
          <span className="hidden text-xs text-foreground/50 sm:inline">{currentUser.email}</span>
          <form action="/api/auth/signout" method="POST">
            <button
              type="submit"
              className="text-xs font-semibold uppercase tracking-wide text-foreground/60 underline decoration-steel/50 underline-offset-2 hover:text-steel-dark"
            >
              Sign out
            </button>
          </form>
        </nav>
      ) : (
        <nav className="flex items-center gap-4">
          <Link href="/login" className="text-xs font-semibold uppercase tracking-wide text-foreground/60 hover:text-steel-dark">
            Sign in
          </Link>
          <Link
            href="/signup"
            className="border border-steel bg-steel px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-white hover:bg-steel-dark"
          >
            Create your company
          </Link>
        </nav>
      )}
    </header>
  );
}
