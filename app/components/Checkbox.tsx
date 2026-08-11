"use client";

import { CheckIcon } from "./icons";

export function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: (checked: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-[10px] text-[14px] text-text">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span
        className={`flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-[6px] border transition-colors duration-150 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-accent peer-focus-visible:outline-offset-2 ${
          checked ? "border-accent bg-accent text-white" : "border-black/[.16] bg-white"
        }`}
      >
        {checked && <CheckIcon />}
      </span>
      {label}
    </label>
  );
}
