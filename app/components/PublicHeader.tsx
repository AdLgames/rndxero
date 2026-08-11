import Link from "next/link";
import { PulseIcon } from "./icons";
import { buttonPrimary } from "./ui";

/** The header for pre-auth pages (homepage, login, signup, invitations) — no session lookup, no nav items, just the brand and the two entry points. */
export function PublicHeader() {
  return (
    <header className="flex items-center justify-between px-10 py-6">
      <Link href="/" className="flex items-center gap-[9px] text-[15px] font-[640] tracking-[-0.02em] text-text">
        <span className="flex h-[22px] w-[22px] items-center justify-center rounded-[7px] bg-accent text-white">
          <PulseIcon />
        </span>
        Trace
      </Link>
      <nav className="flex items-center gap-5">
        <Link href="/login" className="text-[13.5px] font-[500] text-text-secondary hover:text-text">
          Sign in
        </Link>
        <Link href="/signup" className={buttonPrimary}>
          Create your company
        </Link>
      </nav>
    </header>
  );
}
