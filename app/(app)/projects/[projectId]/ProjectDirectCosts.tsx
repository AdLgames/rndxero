"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { DirectCostCategory } from "@/lib/generated/prisma/client";
import { Spinner } from "@/app/components/icons";
import { buttonGhost, buttonPrimary, fieldLabel, input } from "@/app/components/ui";

const CATEGORY_OPTIONS: Array<{ value: DirectCostCategory; label: string }> = [
  { value: "CONSUMABLES", label: "Consumables & materials" },
  { value: "SOFTWARE_LICENCE", label: "Software licences" },
  { value: "CLOUD_COMPUTING", label: "Cloud computing / data" },
  { value: "SUBCONTRACTOR", label: "Subcontractor" },
  { value: "EPW", label: "Externally provided worker" },
  { value: "CLINICAL_TRIAL_VOLUNTEERS", label: "Clinical trial volunteers" },
  { value: "OTHER", label: "Other" },
];

const CATEGORY_LABEL = Object.fromEntries(CATEGORY_OPTIONS.map((o) => [o.value, o.label])) as Record<DirectCostCategory, string>;

export interface DirectCostRow {
  id: string;
  description: string;
  category: DirectCostCategory;
  amountMinorUnits: number;
  currency: string;
  isOverseas: boolean;
  isSubsidised: boolean;
  date: string;
}

function moneyLabel(minorUnits: number, currency: string): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(minorUnits / 100);
}

function todayInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Non-labour project costs — consumables, software, cloud, subcontractors, EPWs. Labour cost is always derived from hours × rate and never entered here. */
export function ProjectDirectCosts({ projectId, companyId, costs, canWrite }: { projectId: string; companyId: string; costs: DirectCostRow[]; canWrite: boolean }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<DirectCostCategory>("OTHER");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayInputValue());
  const [isOverseas, setIsOverseas] = useState(false);
  const [isSubsidised, setIsSubsidised] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [error, setError] = useState("");

  function reset() {
    setDescription("");
    setCategory("OTHER");
    setAmount("");
    setDate(todayInputValue());
    setIsOverseas(false);
    setIsSubsidised(false);
    setStatus("idle");
    setError("");
  }

  async function save() {
    const pounds = Number(amount);
    if (!description.trim() || !Number.isFinite(pounds) || pounds <= 0) {
      setStatus("error");
      setError("Enter a description and a positive amount");
      return;
    }
    setStatus("saving");
    setError("");
    try {
      const response = await fetch("/api/direct-costs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          projectId,
          description,
          category,
          amountMinorUnits: Math.round(pounds * 100),
          isOverseas,
          isSubsidised,
          date,
        }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Could not save");
      }
      setAdding(false);
      reset();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
      setStatus("error");
    }
  }

  const total = costs.reduce((sum, c) => sum + c.amountMinorUnits, 0);

  return (
    <div className="flex flex-col gap-3">
      {costs.length > 0 && (
        <div className="rounded-[16px] border border-black/[.06] bg-surface-sunken">
          {costs.map((c, i) => (
            <div key={c.id} className={`flex items-center justify-between gap-4 px-5 py-[13px] ${i > 0 ? "border-t border-black/[.055]" : ""}`}>
              <div className="min-w-0">
                <p className="m-0 truncate text-[13.5px] text-text">{c.description}</p>
                <p className="m-0 mt-[2px] text-[12px] text-text-tertiary">
                  {CATEGORY_LABEL[c.category]} · {new Date(c.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  {c.isOverseas ? " · overseas" : ""}
                  {c.isSubsidised ? " · subsidised" : ""}
                </p>
              </div>
              <span className="shrink-0 text-[13.5px] font-[590] text-text">{moneyLabel(c.amountMinorUnits, c.currency)}</span>
            </div>
          ))}
          <div className="flex items-center justify-between border-t border-black/[.055] px-5 py-[13px]">
            <span className="text-[12.5px] text-text-tertiary">Total</span>
            <span className="text-[13.5px] font-[640] text-text">{moneyLabel(total, costs[0]?.currency ?? "GBP")}</span>
          </div>
        </div>
      )}
      {costs.length === 0 && !adding && <p className="m-0 text-[13.5px] text-text-secondary">No direct costs recorded yet.</p>}

      {canWrite && !adding && (
        <button type="button" onClick={() => setAdding(true)} className={`self-start ${buttonGhost}`}>
          + Add cost
        </button>
      )}

      {canWrite && adding && (
        <div className="rounded-[16px] border border-black/[.06] bg-surface-sunken p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={fieldLabel}>Description</label>
              <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. AWS bill for the training cluster" className={input} />
            </div>
            <div>
              <label className={fieldLabel}>Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value as DirectCostCategory)} className={input}>
                {CATEGORY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={fieldLabel}>Amount (£)</label>
              <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0.00" className={input} />
            </div>
            <div>
              <label className={fieldLabel}>Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={input} />
            </div>
            <div className="flex items-end gap-5 pb-[10px]">
              <label className="flex items-center gap-[7px] text-[13px] text-text">
                <input type="checkbox" checked={isOverseas} onChange={(e) => setIsOverseas(e.target.checked)} />
                Overseas
              </label>
              <label className="flex items-center gap-[7px] text-[13px] text-text">
                <input type="checkbox" checked={isSubsidised} onChange={(e) => setIsSubsidised(e.target.checked)} />
                Subsidised / grant-funded
              </label>
            </div>
          </div>

          {status === "error" && <p className="m-0 mt-3 text-[13px] text-red-700">{error}</p>}

          <div className="mt-4 flex items-center gap-3">
            <button type="button" onClick={save} disabled={status === "saving"} className={buttonPrimary}>
              {status === "saving" && <Spinner />}
              {status === "saving" ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                reset();
              }}
              className={buttonGhost}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
