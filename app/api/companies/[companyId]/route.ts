import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { AuthorizationError, authorize } from "@/lib/authz/service";
import { updateCompanyAifDetails, type UpdateCompanyAifDetailsInput } from "@/lib/companies/repository";

interface PatchBody {
  utr?: string | null;
  seniorOfficerName?: string | null;
  seniorOfficerRole?: string | null;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;

  const currentUser = await getCurrentUser(prisma, request.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!currentUser) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  try {
    await authorize(prisma, { userId: currentUser.id, companyId, action: "company:update" });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: "Not permitted to edit company details" }, { status: 403 });
    }
    throw error;
  }

  const body = (await request.json()) as PatchBody;
  const input: UpdateCompanyAifDetailsInput = { companyId };
  if (body.utr !== undefined) input.utr = body.utr?.trim() || null;
  if (body.seniorOfficerName !== undefined) input.seniorOfficerName = body.seniorOfficerName?.trim() || null;
  if (body.seniorOfficerRole !== undefined) input.seniorOfficerRole = body.seniorOfficerRole?.trim() || null;

  const updated = await updateCompanyAifDetails(prisma, input);
  return NextResponse.json({ company: updated });
}
