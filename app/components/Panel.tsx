import type { ElementType, ReactNode } from "react";

/** A registration-marked, square-cornered container — the base card shape everywhere in Trace's blueprint system. */
export function Panel({
  as: Tag = "div",
  className = "",
  children,
}: {
  as?: ElementType;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Tag className={`relative border border-steel/40 bg-white ${className}`}>
      <span className="corner-mark corner-mark-tl" />
      <span className="corner-mark corner-mark-tr" />
      <span className="corner-mark corner-mark-bl" />
      <span className="corner-mark corner-mark-br" />
      {children}
    </Tag>
  );
}
