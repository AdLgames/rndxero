import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { PublicHeader } from "./components/PublicHeader";
import { buttonPrimary, buttonSecondary, eyebrow } from "./components/ui";

const ILLUSTRATION_LANES = [
  { name: "Widget Engine", cells: ["blocker", "wall", "attempt", "resolve", "", "attempt", "attempt", ""] },
  { name: "Payments Sync", cells: ["", "attempt", "attempt", "", "wall", "resolve", "", "attempt"] },
  { name: "Onboarding v2", cells: ["attempt", "", "", "blocker", "attempt", "", "resolve", ""] },
];

const CELL_STYLE: Record<string, string> = {
  attempt: "bg-accent/40",
  blocker: "bg-accent/60",
  wall: "bg-accent/80",
  resolve: "bg-accent",
  "": "border border-dashed border-black/[.12]",
};

/** A schematic of the board, not a literal screenshot — the real thing needs your own data to look like anything. */
function BoardIllustration() {
  return (
    <div className="rounded-[16px] border border-black/[.06] bg-surface-sunken p-5">
      <p className={eyebrow}>Board — planned vs actual</p>
      <div className="mt-3 flex flex-col gap-2">
        {ILLUSTRATION_LANES.map((lane) => (
          <div key={lane.name} className="flex items-center gap-2">
            <span className="w-28 shrink-0 truncate text-[12px] font-[500] text-text-tertiary">{lane.name}</span>
            <div className="flex gap-1">
              {lane.cells.map((cell, i) => (
                <span key={i} className={`h-4 w-4 rounded-[4px] ${CELL_STYLE[cell]}`} />
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] leading-[1.5] text-text-quaternary">
        Each lane is a project workstream, each column a week — hit-a-wall entries are the strongest evidence on the
        board, not something to hide.
      </p>
    </div>
  );
}

export default async function Home() {
  const cookieStore = await cookies();
  const currentUser = await getCurrentUser(prisma, cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (currentUser) {
    redirect("/home");
  }

  return (
    <div className="flex flex-1 flex-col">
      <PublicHeader />
      <main className="mx-auto flex w-full max-w-[1180px] flex-1 flex-col justify-center px-10 py-20">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <p className={eyebrow}>Trace — R&amp;D Project Capture</p>

            <h1 className="mt-4 max-w-xl text-[42px] font-[640] leading-[1.1] tracking-[-0.03em] text-text">
              The evidence record for R&amp;D, captured weekly.
            </h1>

            <p className="mt-6 max-w-xl text-[16px] leading-[1.6] text-text-secondary">
              Founders and engineers log time in under a minute. Accountants and advisers review, lock, and export
              it. One shared record turns week-by-week activity into a defensible, dated claim file — never
              reconstructed after the fact.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link href="/signup" className={`${buttonPrimary} h-[46px] px-7 text-[14.5px]`}>
                Create your company
              </Link>
              <Link href="/login" className={`${buttonSecondary} h-[46px] px-7 text-[14.5px]`}>
                Sign in
              </Link>
            </div>
          </div>

          <BoardIllustration />
        </div>

        <div className="mt-16 grid grid-cols-1 gap-9 border-t border-black/[.06] pt-11 sm:grid-cols-3">
          <div>
            <h2 className={eyebrow}>What it does</h2>
            <p className="mt-2 text-[13.5px] leading-[1.6] text-text-secondary">
              A minute a week per project logs hours and what happened to each open uncertainty. A plan sets
              proposed hours in advance; the board shows planned against actual, week by week, at a glance. Once a
              week closes, finance can seal it — corrections after that append, they never overwrite.
            </p>
          </div>
          <div>
            <h2 className={eyebrow}>Your accountant, free</h2>
            <p className="mt-2 text-[13.5px] leading-[1.6] text-text-secondary">
              Adviser seats never count toward your bill, however many you invite. They see the board, plan-vs-actual,
              and can pull a full evidence dossier — PDF, CSV or JSON — without you upgrading anything or filing a
              support ticket on their behalf.
            </p>
          </div>
          <div>
            <h2 className={eyebrow}>What it does not do</h2>
            <p className="mt-2 text-[13.5px] leading-[1.6] text-text-secondary">
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
