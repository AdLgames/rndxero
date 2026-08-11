import type { ElementType, ReactNode } from "react";

/** The base card shape everywhere in Trace: hairline border, 16px radius, no shadow (inner cards never shadow — only the screen shell does). */
export function Panel({
  as: Tag = "div",
  className = "",
  children,
}: {
  as?: ElementType;
  className?: string;
  children: ReactNode;
}) {
  return <Tag className={`rounded-[16px] border border-black/[.06] bg-surface-sunken ${className}`}>{children}</Tag>;
}
