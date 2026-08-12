import { SiteHeader } from "@/app/components/SiteHeader";
import { SummaryBanner } from "@/app/components/SummaryBanner";

/**
 * Every authenticated screen is one white "shell" card floating on the
 * grey ground, nav bar inside it, page content directly below — per the
 * design handoff, not a page-wide header with content underneath. The
 * summary banner sits between the nav and the page content so its KPIs
 * stay visible across every tab without following scroll (spec: "Sticky
 * Summary Header... fixed across navigation tabs").
 */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex flex-1 justify-center bg-ground px-10 py-16">
      <div className="h-fit w-full max-w-[1320px] overflow-hidden rounded-[20px] border border-black/[.055] bg-white shadow-[0_1px_3px_rgba(0,0,0,.035),0_16px_40px_-16px_rgba(0,0,0,.12)]">
        <SiteHeader />
        <SummaryBanner />
        {children}
      </div>
    </div>
  );
}
