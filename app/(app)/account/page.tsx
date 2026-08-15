import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { AccountClient } from "./AccountClient";

export default async function AccountPage() {
  const cookieStore = await cookies();
  const currentUser = await getCurrentUser(prisma, cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!currentUser) {
    redirect("/login");
  }

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: currentUser.id },
    select: { name: true, email: true, deletionRequestedAt: true },
  });

  return (
    <div className="mx-auto max-w-[720px] px-4 py-8 sm:px-8 sm:py-11 lg:px-12 lg:py-13">
      <h2 className="m-0 text-[30px] font-[640] tracking-[-0.028em] text-text">Account</h2>
      <p className="m-0 mt-3 mb-8 text-[15px] leading-[1.5] text-text-secondary">
        {user.name} · {user.email}
      </p>
      <AccountClient deletionRequestedAt={user.deletionRequestedAt ? user.deletionRequestedAt.toISOString() : null} />
    </div>
  );
}
