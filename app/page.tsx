import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { Panel } from "./components/Panel";
import { buttonPrimary, buttonSecondary, eyebrow } from "./components/ui";

const ILLUSTRATION_LANES = [
  { name: "Widget Engine", cells: ["blocker", "fail", "attempt", "resolve", "", "attempt", "attempt", ""] },
  { name: "Payments Sync", cells: ["", "attempt", "attempt", "", "fail", "resolve", "", "attempt"] },
  { name: "Onboarding v2", cells: ["attempt", "", "", "blocker", "attempt", "", "resolve", ""] },
];

const CELL_STYLE: Record<string, string> = {
  attempt: "bg-steel",
  blocker: "bg-steel-dark",
  fail: "border-2 border-sage-dark",
  resolve: "bg-sage",
  "": "border border-dashed border-steel/30",
};

/** A schematic of the board, not a literal screenshot — the real thing needs your own data to look like anything. */
function BoardIllustration() {
  return (
    <Panel className="p-4">
      <p className={eyebrow}>Board — planned vs actual</p>
      <div className="mt-3 flex flex-col gap-2">
        {ILLUSTRATION_LANES.map((lane) => (
          <div key={lane.name} className="flex items-center gap-2">
            <span className="w-28 shrink-0 truncate text-xs font-medium text-foreground/70">{lane.name}</span>
            <div className="flex gap-1">
              {lane.cells.map((cell, i) => (
                <span key={i} className={`h-4 w-4 ${CELL_STYLE[cell]}`} />
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-foreground/50">
        Each lane is a project workstream, each column a week — hit-a-wall entries (sage outline) are the strongest
        evidence on the board, not something to hide.
      </p>
    </Panel>
  );
}

export default async function Home() {
  const cookieStore = await cookies();
  const currentUser = await getCurrentUser(prisma, cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (currentUser) {
    redirect("/projects");
  }

  return (
    <div className="flex flex-1 flex-col">
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-6 py-24">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <p className={eyebrow}>Trace — R&amp;D Project Capture</p>

            <h1 className="mt-4 max-w-xl text-4xl font-bold leading-tight tracking-tight text-foreground">
              The evidence record for R&amp;D, captured weekly.
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-8 text-foreground/70">
              Founders and engineers log time in under a minute. Accountants and advisers review, lock, and export
              it. One shared record turns week-by-week activity into a defensible, dated claim file — never
              reconstructed after the fact.
            </p>

            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <Link href="/signup" className={`${buttonPrimary} flex h-12 items-center justify-center px-6`}>
                Create your company
              </Link>
              <Link href="/login" className={`${buttonSecondary} flex h-12 items-center justify-center px-6`}>
                Sign in
              </Link>
            </div>
          </div>

          <BoardIllustration />
        </div>

        <div className="mt-16 grid grid-cols-1 gap-8 border-t border-steel/30 pt-10 sm:grid-cols-3">
          <div>
            <h2 className={eyebrow}>What it does</h2>
            <p className="mt-2 text-sm leading-6 text-foreground/70">
              A minute a week per project logs hours and what happened to each open uncertainty. A plan sets
              proposed hours in advance; the board shows planned against actual, week by week, at a glance. Once a
              week closes, finance can seal it — corrections after that append, they never overwrite.
            </p>
          </div>
          <div>
            <h2 className={eyebrow}>Your accountant, free</h2>
            <p className="mt-2 text-sm leading-6 text-foreground/70">
              Adviser seats never count toward your bill, however many you invite. They see the board, plan-vs-actual,
              and can pull a full evidence dossier — PDF, CSV or JSON — without you upgrading anything or filing a
              support ticket on their behalf.
            </p>
          </div>
          <div>
            <h2 className={eyebrow}>What it does not do</h2>
            <p className="mt-2 text-sm leading-6 text-foreground/70">
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
