import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser, SESSION_COOKIE_NAME } from "@/lib/auth/session";

const ILLUSTRATION_LANES = [
  { name: "Widget Engine", cells: ["blocker", "fail", "attempt", "resolve", "", "attempt", "attempt", ""] },
  { name: "Payments Sync", cells: ["", "attempt", "attempt", "", "fail", "resolve", "", "attempt"] },
  { name: "Onboarding v2", cells: ["attempt", "", "", "blocker", "attempt", "", "resolve", ""] },
];

const CELL_STYLE: Record<string, string> = {
  attempt: "bg-blue-400 dark:bg-blue-600",
  blocker: "bg-amber-400 dark:bg-amber-600",
  fail: "bg-red-500",
  resolve: "bg-green-500 dark:bg-green-600",
  "": "border border-dashed border-black/[.12] dark:border-white/[.12]",
};

/** A schematic of the board, not a literal screenshot — the real thing needs your own data to look like anything. */
function BoardIllustration() {
  return (
    <div className="rounded-xl border border-black/[.08] bg-white p-4 shadow-sm dark:border-white/[.08] dark:bg-zinc-900">
      <div className="flex flex-col gap-2">
        {ILLUSTRATION_LANES.map((lane) => (
          <div key={lane.name} className="flex items-center gap-2">
            <span className="w-28 shrink-0 truncate text-xs font-medium text-zinc-600 dark:text-zinc-400">{lane.name}</span>
            <div className="flex gap-1">
              {lane.cells.map((cell, i) => (
                <span key={i} className={`h-4 w-4 rounded-sm ${CELL_STYLE[cell]}`} />
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-zinc-400 dark:text-zinc-500">
        Each lane is a project workstream, each column a week — the failed attempts (red) are the strongest evidence
        on the board, not something to hide.
      </p>
    </div>
  );
}

export default async function Home() {
  const cookieStore = await cookies();
  const currentUser = await getCurrentUser(prisma, cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (currentUser) {
    redirect("/projects");
  }

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-6 py-24">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">ClaimTrail</p>

            <h1 className="mt-4 max-w-xl text-4xl font-semibold leading-tight tracking-tight text-black dark:text-zinc-50">
              Your claim is only as good as what you wrote down while you were doing the work.
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-8 text-zinc-600 dark:text-zinc-400">
              A weekly, sub-minute habit turns into a living board of every project&apos;s uncertainties — planned
              hours against what actually happened, attempts and failures kept exactly as written, corrections
              always appended and attributed, never rewritten.
            </p>

            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/signup"
                className="flex h-12 items-center justify-center rounded-full bg-foreground px-6 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
              >
                Create your company
              </Link>
              <Link
                href="/login"
                className="flex h-12 items-center justify-center rounded-full border border-black/[.12] px-6 text-sm font-medium text-black transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:text-zinc-50 dark:hover:bg-white/[.08]"
              >
                Sign in
              </Link>
            </div>
          </div>

          <BoardIllustration />
        </div>

        <div className="mt-16 grid grid-cols-1 gap-8 border-t border-black/[.08] pt-10 sm:grid-cols-3 dark:border-white/[.08]">
          <div>
            <h2 className="text-sm font-semibold text-black dark:text-zinc-50">What it does</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              A minute a week per project logs hours and what happened to each open uncertainty. A plan sets
              proposed hours in advance; the board shows planned against actual, week by week, at a glance. Once a
              week closes, finance can seal it — corrections after that append, they never overwrite.
            </p>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-black dark:text-zinc-50">Your accountant, free</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              Adviser seats never count toward your bill, however many you invite. They see the board, plan-vs-actual,
              and can pull a full claim pack — PDF, CSV or JSON — without you upgrading anything or filing a support
              ticket on their behalf.
            </p>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-black dark:text-zinc-50">What it does not do</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              It does not decide what qualifies as R&amp;D, calculate relief or credit values, or file anything with
              HMRC. That stays your call, or your adviser&apos;s — this is an evidence layer, not a tax advice
              product.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
