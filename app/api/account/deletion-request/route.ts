import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { cancelAccountDeletionRequest, DeletionError, requestAccountDeletion } from "@/lib/gdpr/deletion";

export async function POST(request: NextRequest) {
  const currentUser = await getCurrentUser(prisma, request.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!currentUser) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { action } = (await request.json()) as { action?: "request" | "cancel" };
  if (action !== "request" && action !== "cancel") {
    return NextResponse.json({ error: "action must be 'request' or 'cancel'" }, { status: 400 });
  }

  try {
    const user =
      action === "request" ? await requestAccountDeletion(prisma, currentUser.id) : await cancelAccountDeletionRequest(prisma, currentUser.id);
    return NextResponse.json({ deletionRequestedAt: user.deletionRequestedAt });
  } catch (error) {
    if (error instanceof DeletionError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
