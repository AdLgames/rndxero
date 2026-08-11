import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-6 py-24">
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">ClaimTrail</p>

        <h1 className="mt-4 max-w-xl text-4xl font-semibold leading-tight tracking-tight text-black dark:text-zinc-50">
          Your claim is only as good as what you wrote down while you were doing the work.
        </h1>

        <p className="mt-6 max-w-xl text-lg leading-8 text-zinc-600 dark:text-zinc-400">
          Contemporaneous R&amp;D record-keeping that runs all year — time apportionment and the
          technical narrative captured as the work happens, not reconstructed at claim time. Connects
          to Xero for the cost side. Free while we&apos;re building this with early customers.
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

        <div className="mt-16 grid grid-cols-1 gap-8 border-t border-black/[.08] pt-10 sm:grid-cols-2 dark:border-white/[.08]">
          <div>
            <h2 className="text-sm font-semibold text-black dark:text-zinc-50">What it does</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              Records project uncertainties, attempts, and resolutions as they happen. Captures time
              with its basis — timesheet, sampled, or estimated — stated plainly, not smoothed over.
              Mirrors the relevant cost categories from Xero. Produces a claim-ready evidence pack per
              project, per accounting period.
            </p>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-black dark:text-zinc-50">What it does not do</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              It does not decide what qualifies as R&amp;D, calculate relief or credit values, or file
              anything with HMRC. That stays your call, or your adviser&apos;s — this is an evidence
              layer, not a tax advice product.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
