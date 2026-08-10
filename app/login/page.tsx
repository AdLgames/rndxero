"use client";

import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sent" | "error">("idle");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/auth/request-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setStatus(response.ok ? "sent" : "error");
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 dark:bg-black">
      <main className="w-full max-w-sm rounded-lg border border-black/[.08] bg-white p-8 dark:border-white/[.145] dark:bg-zinc-950">
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Sign in to ClaimTrail</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          We&apos;ll email you a sign-in link. No password needed.
        </p>
        {status === "sent" ? (
          <p className="mt-6 rounded bg-black/[.04] p-3 text-sm text-black dark:bg-white/[.08] dark:text-zinc-50">
            If that email has an account, a sign-in link is on its way.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3">
            <input
              type="email"
              required
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded border border-black/[.12] px-3 py-2 text-sm text-black dark:border-white/[.145] dark:bg-black dark:text-zinc-50"
            />
            <button
              type="submit"
              className="rounded bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
            >
              Send sign-in link
            </button>
            {status === "error" && (
              <p className="text-sm text-red-600 dark:text-red-400">Something went wrong. Try again.</p>
            )}
          </form>
        )}
      </main>
    </div>
  );
}
