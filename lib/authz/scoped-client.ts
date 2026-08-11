import type { PrismaClient } from "@/lib/generated/prisma/client";

/**
 * Company-scoping at the query layer (BOARD-PLAN.md Phase 2): "the cheap,
 * reliable version" is forcing companyId into every query for models
 * that carry it directly, so a bug in a route handler that forgets a
 * `where: { companyId }` clause still can't leak or write across
 * tenants — the extension does it regardless.
 *
 * Coverage is deliberately scoped to models with a *direct* companyId
 * column (Membership, Project, WeeklySubmission, Rate, AuditLog).
 * Models reachable only via a relation (Uncertainty, UncertaintyNote,
 * PlanVersion, PlannedAllocation, DirectCost, ProjectMember, ...) are not
 * covered here — their repositories (built alongside the features that
 * use them, Phase 3+) must filter through the owning Project explicitly
 * (`where: { project: { companyId } }`). Extending this extension to
 * walk relations generically is possible but meaningfully more complex;
 * doing it half-right would be worse than the current explicit gap,
 * since it would look covered without being covered.
 */
const DIRECT_COMPANY_ID_MODELS = new Set(["Membership", "Project", "WeeklySubmission", "Rate", "AuditLog"]);

const READ_OPERATIONS = new Set([
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "findUnique",
  "findUniqueOrThrow",
  "count",
  "aggregate",
  "groupBy",
]);
const WHERE_WRITE_OPERATIONS = new Set(["update", "updateMany", "delete", "deleteMany"]);

type ScopableArgs = {
  where?: Record<string, unknown>;
  data?: Record<string, unknown> | Array<Record<string, unknown>>;
  create?: Record<string, unknown>;
};

/**
 * Returns a Prisma client bound to one company for the lifetime of the
 * object — create per-request, never share across requests/tenants.
 */
export function withCompanyScope(prisma: PrismaClient, companyId: string) {
  return prisma.$extends({
    name: "companyScope",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!DIRECT_COMPANY_ID_MODELS.has(model)) {
            return query(args);
          }

          const scoped = args as ScopableArgs;

          if (READ_OPERATIONS.has(operation) || WHERE_WRITE_OPERATIONS.has(operation)) {
            scoped.where = { ...(scoped.where ?? {}), companyId };
          }
          if (operation === "create" && scoped.data && !Array.isArray(scoped.data)) {
            scoped.data = { ...scoped.data, companyId };
          }
          if (operation === "createMany" && Array.isArray(scoped.data)) {
            scoped.data = scoped.data.map((row) => ({ ...row, companyId }));
          }
          if (operation === "upsert") {
            scoped.where = { ...(scoped.where ?? {}), companyId };
            if (scoped.create) scoped.create = { ...scoped.create, companyId };
          }

          return query(args);
        },
      },
    },
  });
}
