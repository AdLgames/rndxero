"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { PublicHeader } from "../../components/PublicHeader";
import { Spinner } from "../../components/icons";
import { buttonPrimary, input } from "../../components/ui";

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
      router.push("/home");
      return;
    }
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    setError(body.error ?? "Could not accept invitation");
    setStatus("error");
  }

  return (
    <div className="flex flex-1 flex-col">
      <PublicHeader />
      <main className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="w-full max-w-[380px] rounded-[16px] border border-black/[.06] bg-white p-8 shadow-[0_1px_3px_rgba(0,0,0,.035),0_16px_40px_-16px_rgba(0,0,0,.12)]">
          <h2 className="m-0 text-[19px] font-[640] tracking-[-0.02em] text-text">Join</h2>
          <p className="m-0 mt-2 text-[13.5px] leading-[1.5] text-text-secondary">Enter your name to accept the invitation.</p>
          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3">
            <input type="text" required placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} className={input} />
            <button type="submit" disabled={status === "saving"} className={`${buttonPrimary} w-full py-[11px]`}>
              {status === "saving" && <Spinner />}
              {status === "saving" ? "Joining…" : "Accept invitation"}
            </button>
            {status === "error" && <p className="m-0 text-[13px] text-red-700">{error}</p>}
          </form>
        </div>
      </main>
    </div>
  );
}
