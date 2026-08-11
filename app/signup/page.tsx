"use client";

import { useState } from "react";
import Link from "next/link";
import { Panel } from "../components/Panel";
import { buttonPrimary, eyebrow, input } from "../components/ui";

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

  const fieldClass = input.replace("mt-1 ", "");

  return (
    <div className="flex flex-1 items-center justify-center">
      <Panel as="main" className="w-full max-w-sm p-8">
        <p className={eyebrow}>Trace</p>
        <h1 className="mt-1 text-xl font-bold text-foreground">Set up your company</h1>
        <p className="mt-2 text-sm text-foreground/60">Free for now — no card required.</p>
        {status === "sent" ? (
          <p className="mt-6 border border-sage bg-sage/10 p-3 text-sm text-sage-dark">
            Check your email for a sign-in link to finish setting up {companyName || "your company"}.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3">
            <input
              type="text"
              required
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={fieldClass}
            />
            <input
              type="email"
              required
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={fieldClass}
            />
            <input
              type="text"
              required
              placeholder="Company name"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className={fieldClass}
            />
            <button type="submit" disabled={status === "saving"} className={`${buttonPrimary} py-2.5`}>
              {status === "saving" ? "Creating…" : "Create company"}
            </button>
            {status === "error" && <p className="text-sm text-red-700">{errorMessage}</p>}
          </form>
        )}
        <p className="mt-6 text-sm text-foreground/60">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-steel-dark underline decoration-steel/50">
            Sign in
          </Link>
        </p>
      </Panel>
    </div>
  );
}
