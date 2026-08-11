"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { Panel } from "../../components/Panel";
import { buttonPrimary, eyebrow, input } from "../../components/ui";

export default function AcceptInvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const router = useRouter();
  const [name, setName] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "error" | "success">("idle");
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (status === "saving") return;
    setStatus("saving");
    const response = await fetch(`/api/invitations/${token}/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (response.ok) {
      setStatus("success");
      router.push("/projects");
      return;
    }
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    setError(body.error ?? "Could not accept invitation");
    setStatus("error");
  }

  return (
    <div className="flex flex-1 items-center justify-center">
      <Panel as="main" className="w-full max-w-sm p-8">
        <p className={eyebrow}>Trace</p>
        <h1 className="mt-1 text-xl font-bold text-foreground">Join</h1>
        <p className="mt-2 text-sm text-foreground/60">Enter your name to accept the invitation.</p>
        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3">
          <input
            type="text"
            required
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={input.replace("mt-1 ", "")}
          />
          <button type="submit" disabled={status === "saving"} className={`${buttonPrimary} py-2.5`}>
            {status === "saving" ? "Joining…" : "Accept invitation"}
          </button>
          {status === "error" && <p className="text-sm text-red-700">{error}</p>}
        </form>
      </Panel>
    </div>
  );
}
