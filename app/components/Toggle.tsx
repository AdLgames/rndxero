"use client";

/** The "Nothing this week" switch. Off-state track colour matches the design spec's --toggle-off; on is accent. */
export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (checked: boolean) => void; label?: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-[7px] text-[13px] text-text-tertiary">
      {label}
      <span
        role="switch"
        aria-checked={checked}
        tabIndex={0}
        onClick={() => onChange(!checked)}
        onKeyDown={(e) => {
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            onChange(!checked);
          }
        }}
        className={`relative inline-block h-[23px] w-[38px] rounded-full transition-colors duration-150 ${checked ? "bg-accent" : "bg-toggle-off"}`}
      >
        <span
          className="absolute top-[2px] h-[19px] w-[19px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,.20)] transition-all duration-150"
          style={{ left: checked ? "17px" : "2px" }}
        />
      </span>
    </label>
  );
}
