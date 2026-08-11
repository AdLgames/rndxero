"use client";

import { useState } from "react";
import Link from "next/link";
import { Panel } from "../components/Panel";
import { buttonPrimary, eyebrow, input } from "../components/ui";

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
    <div className="flex flex-1 items-center justify-center">
      <Panel as="main" className="w-full max-w-sm p-8">
        <p className={eyebrow}>Trace</p>
        <h1 className="mt-1 text-xl font-bold text-foreground">Sign in</h1>
        <p className="mt-2 text-sm text-foreground/60">We&apos;ll email you a sign-in link. No password needed.</p>
        {status === "sent" ? (
          <p className="mt-6 border border-sage bg-sage/10 p-3 text-sm text-sage-dark">
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
              className={input.replace("mt-1 ", "")}
            />
            <button type="submit" disabled={status === "sending"} className={`${buttonPrimary} py-2.5`}>
              {status === "sending" ? "Sending…" : "Send sign-in link"}
            </button>
            {status === "error" && <p className="text-sm text-red-700">Something went wrong. Try again.</p>}
          </form>
        )}
        <p className="mt-6 text-sm text-foreground/60">
          New here?{" "}
          <Link href="/signup" className="font-semibold text-steel-dark underline decoration-steel/50">
            Create a company
          </Link>
        </p>
      </Panel>
    </div>
  );
}
