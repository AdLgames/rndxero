import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { InviteForm } from "./InviteForm";
import { CompanyAifDetails } from "./CompanyAifDetails";

export default async function TeamPage() {
  const cookieStore = await cookies();
  const currentUser = await getCurrentUser(prisma, cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!currentUser) {
    redirect("/login");
  }

  const ownerCompanyIds = currentUser.memberships.filter((m) => m.role === "OWNER").map((m) => m.companyId);
  const companies = await prisma.company.findMany({ where: { id: { in: ownerCompanyIds } } });

  const companiesWithMembers = await Promise.all(
    companies.map(async (company) => {
      const members = await prisma.membership.findMany({
        where: { companyId: company.id, status: "ACTIVE" },
        include: { user: { select: { name: true, email: true } } },
        orderBy: { createdAt: "asc" },
      });
      return { company, members };
    })
  );

  return (
    <div className="mx-auto max-w-[640px] px-4 py-8 sm:px-8 sm:py-11 lg:px-12 lg:py-13">
      <h2 className="m-0 text-[30px] font-[640] tracking-[-0.028em] text-text">Team</h2>
      <p className="m-0 mt-3 mb-8 text-[15px] leading-[1.5] text-text-secondary">
        Invite advisers and colleagues. Adviser seats are free and never count toward your bill.
      </p>

      <div className="flex flex-col gap-9">
        {companiesWithMembers.map(({ company, members }) => (
          <section key={company.id}>
            {companiesWithMembers.length > 1 && <h3 className="m-0 mb-3 text-[16.5px] font-[600] tracking-[-0.02em] text-text">{company.name}</h3>}
            <p className="m-0 mb-3 text-[12.5px] text-text-tertiary">Claim details — for the UK Additional Information Form</p>
            <CompanyAifDetails
              companyId={company.id}
              data={{ utr: company.utr, seniorOfficerName: company.seniorOfficerName, seniorOfficerRole: company.seniorOfficerRole }}
            />
            <p className="m-0 mt-8 mb-3 text-[12.5px] text-text-tertiary">Team</p>
            <InviteForm companyId={company.id} seats={members.map((m) => ({ id: m.id, name: m.user.name, role: m.role }))} />
          </section>
        ))}
        {companiesWithMembers.length === 0 && <p className="text-sm text-text-secondary">You need to be a company owner to manage the team.</p>}
      </div>
    </div>
  );
}
