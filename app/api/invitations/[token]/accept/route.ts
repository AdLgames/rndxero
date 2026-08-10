import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { acceptInvitation, InvitationError } from "@/lib/auth/invitations";
import { createSessionCookieValue, SESSION_COOKIE_NAME } from "@/lib/auth/session";

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { name } = (await request.json()) as { name?: string };
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  try {
    const { user } = await acceptInvitation(prisma, { token, name });
    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE_NAME, createSessionCookieValue(user.id), {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60,
      path: "/",
    });
    return response;
  } catch (error) {
    if (error instanceof InvitationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
