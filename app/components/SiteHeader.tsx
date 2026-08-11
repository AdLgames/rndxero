import Link from "next/link";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { getCurrentUser, SESSION_COOKIE_NAME } from "@/lib/auth/session";

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
    <header className="flex items-center justify-between border-b border-black/[.08] px-6 py-3 dark:border-white/[.08]">
      <Link href="/" className="text-sm font-semibold text-black dark:text-zinc-50">
        ClaimTrail
      </Link>

      {currentUser ? (
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/projects" className="text-zinc-600 hover:text-black dark:text-zinc-400 dark:hover:text-zinc-50">
            Projects
          </Link>
          <Link href="/capture" className="text-zinc-600 hover:text-black dark:text-zinc-400 dark:hover:text-zinc-50">
            Capture
          </Link>
          <Link href="/planner" className="text-zinc-600 hover:text-black dark:text-zinc-400 dark:hover:text-zinc-50">
            Planner
          </Link>
          <Link href="/board" className="text-zinc-600 hover:text-black dark:text-zinc-400 dark:hover:text-zinc-50">
            Board
          </Link>
          <Link href="/finance" className="text-zinc-600 hover:text-black dark:text-zinc-400 dark:hover:text-zinc-50">
            Finance
          </Link>
          <Link href="/export" className="text-zinc-600 hover:text-black dark:text-zinc-400 dark:hover:text-zinc-50">
            Export
          </Link>
          <span className="text-zinc-500 dark:text-zinc-400">Signed in as {currentUser.email}</span>
          <form action="/api/auth/signout" method="POST">
            <button
              type="submit"
              className="text-zinc-600 underline hover:text-black dark:text-zinc-400 dark:hover:text-zinc-50"
            >
              Sign out
            </button>
          </form>
        </nav>
      ) : (
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/login" className="text-zinc-600 hover:text-black dark:text-zinc-400 dark:hover:text-zinc-50">
            Sign in
          </Link>
          <Link href="/signup" className="font-medium text-black dark:text-zinc-50">
            Create your company
          </Link>
        </nav>
      )}
    </header>
  );
}
