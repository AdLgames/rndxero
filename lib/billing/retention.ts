/**
 * Retention is a product feature, not an afterthought (PLAN.md Phase 6):
 * records must survive the six-year HMRC enquiry window regardless of
 * whether the subscription that created them is still active. This
 * module only computes dates — it deliberately does not implement data
 * deletion. Evidence is append-only and this codebase never deletes it;
 * an eventual "delete my company's data" feature is a distinct,
 * explicitly-confirmed action for a human to design and approve, not
 * something to bolt on here. See RETENTION.md for the written policy.
 */

const HMRC_ENQUIRY_WINDOW_YEARS = 6;

/** The earliest date at which data tied to an accounting period could be considered for removal. */
export function computeRetentionExpiry(accountingPeriodEndDate: Date): Date {
  const expiry = new Date(accountingPeriodEndDate);
  expiry.setUTCFullYear(expiry.getUTCFullYear() + HMRC_ENQUIRY_WINDOW_YEARS);
  return expiry;
}

export function isWithinRetentionWindow(accountingPeriodEndDate: Date, referenceDate: Date = new Date()): boolean {
  return referenceDate < computeRetentionExpiry(accountingPeriodEndDate);
}
