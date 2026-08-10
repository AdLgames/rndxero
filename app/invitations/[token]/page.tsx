"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";

export default function AcceptInvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const router = useRouter();
  const [name, setName] = useState("");
  const [status, setStatus] = useState<"idle" | "error" | "success">("idle");
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch(`/api/invitations/${token}/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (response.ok) {
      setStatus("success");
      router.push("/");
      return;
    }
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    setError(body.error ?? "Could not accept invitation");
    setStatus("error");
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 dark:bg-black">
      <main className="w-full max-w-sm rounded-lg border border-black/[.08] bg-white p-8 dark:border-white/[.145] dark:bg-zinc-950">
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Join ClaimTrail</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Enter your name to accept the invitation.
        </p>
        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3">
          <input
            type="text"
            required
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded border border-black/[.12] px-3 py-2 text-sm text-black dark:border-white/[.145] dark:bg-black dark:text-zinc-50"
          />
          <button
            type="submit"
            className="rounded bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
          >
            Accept invitation
          </button>
          {status === "error" && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        </form>
      </main>
    </div>
  );
}
