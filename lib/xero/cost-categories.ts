/**
 * Heuristic classifier for the cost categories that matter for an R&D
 * claim (PLAN.md Phase 3): staff costs, subcontractor/external worker
 * costs, consumables, software, and data/cloud spend.
 *
 * This is a *suggestion* surfaced to a human for confirmation — see the
 * scope discipline in PLAN.md ("never auto-fill an apportionment
 * percentage... record, don't rule"). It never writes a CostAllocation by
 * itself; it only tags a mirrored GL line so the allocation UI can group
 * and pre-filter what a human reviews.
 */

export type RnDCostCategory =
  | "staff_costs"
  | "subcontractor_external_worker"
  | "consumables"
  | "software"
  | "data_cloud";

const KEYWORD_RULES: Array<{ category: RnDCostCategory; keywords: string[] }> = [
  {
    category: "staff_costs",
    keywords: ["salar", "wages", "payroll", "staff cost", "employer ni", "pension"],
  },
  {
    category: "subcontractor_external_worker",
    keywords: ["subcontract", "contractor", "freelance", "external worker", "agency staff"],
  },
  {
    category: "software",
    keywords: ["software", "saas", "subscription", "license", "licence"],
  },
  {
    category: "data_cloud",
    keywords: ["hosting", "cloud", "aws", "azure", "gcp", "google cloud", "data storage", "server"],
  },
  {
    category: "consumables",
    keywords: ["consumable", "materials", "prototype", "component", "supplies"],
  },
];

/**
 * Classifies a GL account by name using keyword matching. Returns `null`
 * when nothing matches — most accounts are not R&D-relevant, and a
 * conservative "no suggestion" beats a wrong suggestion for a category
 * this consequential.
 */
export function classifyRnDCostCategory(accountName: string): RnDCostCategory | null {
  const normalized = accountName.toLowerCase();
  for (const rule of KEYWORD_RULES) {
    if (rule.keywords.some((keyword) => normalized.includes(keyword))) {
      return rule.category;
    }
  }
  return null;
}
