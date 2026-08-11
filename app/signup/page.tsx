"use client";

import { useState } from "react";
import Link from "next/link";
import { PublicHeader } from "../components/PublicHeader";
import { buttonPrimary, input } from "../components/ui";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "sent" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (status === "saving") return;
    setStatus("saving");
    const response = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name, companyName }),
    });
    if (response.ok) {
      setStatus("sent");
      return;
    }
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    setErrorMessage(body.error ?? "Something went wrong. Try again.");
    setStatus("error");
  }

  return (
    <div className="flex flex-1 flex-col">
      <PublicHeader />
      <main className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="w-full max-w-[380px] rounded-[16px] border border-black/[.06] bg-white p-8 shadow-[0_1px_3px_rgba(0,0,0,.035),0_16px_40px_-16px_rgba(0,0,0,.12)]">
          <h2 className="m-0 text-[19px] font-[640] tracking-[-0.02em] text-text">Set up your company</h2>
          <p className="m-0 mt-2 text-[13.5px] leading-[1.5] text-text-secondary">Free for now — no card required.</p>
          {status === "sent" ? (
            <p className="mt-6 rounded-[10px] border border-accent-border bg-accent-wash p-3 text-[13.5px] text-accent">
              Check your email for a sign-in link to finish setting up {companyName || "your company"}.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3">
              <input type="text" required placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} className={input} />
              <input type="email" required placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} className={input} />
              <input type="text" required placeholder="Company name" value={companyName} onChange={(e) => setCompanyName(e.target.value)} className={input} />
              <button type="submit" disabled={status === "saving"} className={`${buttonPrimary} w-full py-[11px]`}>
                {status === "saving" ? "Creating…" : "Create company"}
              </button>
              {status === "error" && <p className="m-0 text-[13px] text-red-700">{errorMessage}</p>}
            </form>
          )}
          <p className="m-0 mt-6 text-[13.5px] text-text-secondary">
            Already have an account?{" "}
            <Link href="/login" className="font-[590] text-accent hover:text-accent-hover">
              Sign in
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
