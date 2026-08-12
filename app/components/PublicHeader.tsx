import Link from "next/link";
import { buttonPrimary } from "./ui";

/** The header for pre-auth pages (homepage, login, signup, invitations) — no session lookup, no nav items, just the brand and the two entry points. */
export function PublicHeader() {
  return (
    <header className="flex items-center justify-between px-10 py-6">
      <Link href="/" className="text-[17px] font-[700] tracking-[-0.025em] text-text">
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
