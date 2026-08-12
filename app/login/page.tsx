"use client";

import { useState } from "react";
import Link from "next/link";
import { PublicHeader } from "../components/PublicHeader";
import { Spinner } from "../components/icons";
import { buttonPrimary, input } from "../components/ui";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (status === "sending") return;
    setStatus("sending");
    const response = await fetch("/api/auth/request-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setStatus(response.ok ? "sent" : "error");
  }

  return (
    <div className="flex flex-1 flex-col">
      <PublicHeader />
      <main className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="w-full max-w-[380px] rounded-[16px] border border-black/[.06] bg-white p-8 shadow-[0_1px_3px_rgba(0,0,0,.035),0_16px_40px_-16px_rgba(0,0,0,.12)]">
          <h2 className="m-0 text-[19px] font-[640] tracking-[-0.02em] text-text">Sign in</h2>
          <p className="m-0 mt-2 text-[13.5px] leading-[1.5] text-text-secondary">We&apos;ll email you a sign-in link. No password needed.</p>
          {status === "sent" ? (
            <p className="mt-6 rounded-[10px] border border-accent-border bg-accent-wash p-3 text-[13.5px] text-accent">
              If that email has an account, a sign-in link is on its way.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3">
              <input type="email" required placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} className={input} />
              <button type="submit" disabled={status === "sending"} className={`${buttonPrimary} w-full py-[11px]`}>
                {status === "sending" && <Spinner />}
                {status === "sending" ? "Sending…" : "Send sign-in link"}
              </button>
              {status === "error" && <p className="m-0 text-[13px] text-red-700">Something went wrong. Try again.</p>}
            </form>
          )}
          <p className="m-0 mt-6 text-[13.5px] text-text-secondary">
            New here?{" "}
            <Link href="/signup" className="font-[590] text-accent hover:text-accent-hover">
              Create a company
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
