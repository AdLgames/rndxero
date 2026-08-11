"use client";

/** The pill-track control used for Adviser/Member, Estimated/From timesheet, All/Open/Locked, the project switcher, the board pager, and the export format picker. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  fullWidth = false,
  className = "",
  segmentClassName = "px-[15px] py-[7px]",
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
  fullWidth?: boolean;
  className?: string;
  segmentClassName?: string;
}) {
  return (
    <div className={`inline-flex rounded-[10px] bg-control-track p-[3px] transition-colors duration-150 ${fullWidth ? "w-full" : ""} ${className}`}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`${segmentClassName} rounded-[8px] text-[13px] transition-all duration-150 ease-out active:scale-[.985] ${fullWidth ? "flex-1" : ""} ${
              active ? "bg-white font-[590] text-text shadow-[0_1px_3px_rgba(0,0,0,.09)]" : "font-[500] text-text-secondary hover:text-text"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
